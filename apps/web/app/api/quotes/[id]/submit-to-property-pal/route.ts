import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

const PROPERTY_PAL_API_URL = process.env.PROPERTY_PAL_API_URL || 'https://property-pal.vercel.app'
const PROPERTY_PAL_WEBHOOK_SECRET = process.env.PROPERTY_PAL_WEBHOOK_SECRET || ''
const PROPERTY_PAL_BYPASS_TOKEN = process.env.PROPERTY_PAL_BYPASS_TOKEN || ''

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/quotes/[id]/submit-to-property-pal - Submit quote to Property Pal for approval
export async function POST(req: Request, context: RouteContext) {
  try {
    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: quoteId } = await context.params

    const sql = neon(process.env.DATABASE_URL!)

    // Get the quote with job and organization details
    const quotes = await sql`
      SELECT
        q.*,
        j.id as job_id,
        j.external_work_order_id,
        j.external_source,
        o.name as organization_name
      FROM quotes q
      LEFT JOIN jobs j ON q.job_id = j.id
      INNER JOIN organizations o ON q.organization_id = o.id
      WHERE q.id = ${quoteId}
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Verify this quote is linked to a Property Pal job
    if (!quote.job_id || quote.external_source !== 'property_pal' || !quote.external_work_order_id) {
      return NextResponse.json(
        { error: 'This quote is not linked to a Property Pal work order' },
        { status: 400 }
      )
    }

    // Get line items
    const lineItems = await sql`
      SELECT * FROM quote_line_items
      WHERE quote_id = ${quoteId}
      ORDER BY line_order
    `

    // Build the webhook payload
    const webhookPayload = {
      event: 'quote.submitted',
      quote_id: quote.id,
      quote_number: quote.quote_number,
      external_work_order_id: quote.external_work_order_id,
      job_id: quote.job_id,
      job_number: quote.job_number || '',
      title: quote.title,
      description: quote.description,
      subtotal: parseFloat(quote.subtotal),
      gst_amount: parseFloat(quote.gst_amount),
      total_amount: parseFloat(quote.total_amount),
      valid_until_date: quote.valid_until_date,
      line_items: lineItems.map(item => ({
        item_type: item.item_type,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        line_total: parseFloat(item.line_total),
      })),
      notes: quote.notes,
      submitted_at: new Date().toISOString(),
    }

    // Send to Property Pal webhook endpoint
    // Include bypass token for Vercel deployment protection if configured
    let webhookUrl = `${PROPERTY_PAL_API_URL}/api/webhooks/tradieapp/quotes`
    if (PROPERTY_PAL_BYPASS_TOKEN) {
      webhookUrl += `?x-vercel-protection-bypass=${PROPERTY_PAL_BYPASS_TOKEN}`
    }

    console.log('Sending quote to Property Pal:', webhookUrl)
    console.log('Payload:', JSON.stringify(webhookPayload, null, 2))

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PROPERTY_PAL_WEBHOOK_SECRET,
        ...(PROPERTY_PAL_BYPASS_TOKEN && { 'x-vercel-protection-bypass': PROPERTY_PAL_BYPASS_TOKEN }),
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Property Pal webhook failed:', response.status, errorData)
      return NextResponse.json(
        { error: 'Failed to submit quote to Property Pal', details: errorData },
        { status: 502 }
      )
    }

    // Update quote status to 'sent' and record submission
    await sql`
      UPDATE quotes
      SET
        status = 'sent',
        sent_at = NOW(),
        updated_at = NOW()
      WHERE id = ${quoteId}
    `

    return NextResponse.json({
      success: true,
      message: 'Quote submitted to Property Pal for approval',
      quote_id: quoteId,
    })
  } catch (error) {
    console.error('Error submitting quote to Property Pal:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
