import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Send invoice via SMS
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    const userId = clerkUserId

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Parse request body
    const body = await req.json()
    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json({ error: 'Phone and message are required' }, { status: 400 })
    }

    // Get invoice with organization check
    const invoices = await sql`
      SELECT i.*, o.name as organization_name, o.sms_credits, c.company_name, c.first_name, c.last_name, c.is_company
      FROM invoices i
      INNER JOIN organizations o ON i.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON i.client_id = c.id
      WHERE i.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Calculate SMS credits needed
    const messageLength = message.length
    const creditsNeeded = Math.ceil(messageLength / 160)

    // Check if organization has enough SMS credits
    const currentCredits = parseInt(invoice.sms_credits || '0')
    if (currentCredits < creditsNeeded) {
      return NextResponse.json(
        { error: `Insufficient SMS credits. Need ${creditsNeeded}, have ${currentCredits}` },
        { status: 400 }
      )
    }

    // TODO: Integrate with Tall Bob SMS API
    // For now, we'll just log the SMS details and return success
    console.log('Sending invoice SMS:', {
      to: phone,
      message,
      invoiceId: id,
      invoiceNumber: invoice.invoice_number,
      creditsUsed: creditsNeeded,
    })

    // In production, you would send the actual SMS here:
    /*
    await sendSMS({
      to: phone,
      message: message,
      organizationId: invoice.organization_id,
    })
    */

    // Deduct SMS credits (in demo mode, we'll still deduct to simulate)
    await sql`
      UPDATE organizations
      SET sms_credits = sms_credits - ${creditsNeeded}
      WHERE id = ${invoice.organization_id}
    `

    // Log SMS transaction
    await sql`
      INSERT INTO sms_transactions (
        organization_id,
        transaction_type,
        credits_amount,
        balance_after,
        description,
        recipient_phone,
        sender_user_id,
        sms_type,
        message_preview,
        delivery_status,
        related_invoice_id
      ) VALUES (
        ${invoice.organization_id},
        'usage',
        ${-creditsNeeded},
        ${currentCredits - creditsNeeded},
        'Invoice sent via SMS',
        ${phone},
        ${user.id},
        'invoice',
        ${message.substring(0, 50)},
        'sent',
        ${id}
      )
    `

    return NextResponse.json({
      success: true,
      message: 'Invoice SMS sent successfully (demo mode)',
      creditsUsed: creditsNeeded,
      creditsRemaining: currentCredits - creditsNeeded,
    })
  } catch (error) {
    console.error('Error sending invoice SMS:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
