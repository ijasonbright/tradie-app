import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST /api/webhooks/property-pal/quote-response - Receive quote approval/rejection from Property Pal
export async function POST(req: Request) {
  try {
    // Verify API key
    const apiKey = req.headers.get('x-api-key')
    const expectedApiKey = process.env.PROPERTY_PAL_WEBHOOK_SECRET

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { event, data } = body

    if (!event || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: event, data' },
        { status: 400 }
      )
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Handle quote approval/rejection events
    if (event === 'quote.approved' || event === 'quote.rejected') {
      const {
        quote_id,
        quote_number,
        work_order_id,
        status,
        approved_by,
        approved_at,
        rejection_reason,
      } = data

      if (!quote_id) {
        return NextResponse.json(
          { error: 'Missing quote_id in data' },
          { status: 400 }
        )
      }

      // Find the quote
      const quotes = await sql`
        SELECT id, status FROM quotes WHERE id = ${quote_id}
      `

      if (quotes.length === 0) {
        return NextResponse.json(
          { error: 'Quote not found' },
          { status: 404 }
        )
      }

      // Map Property Pal status to TradieApp status
      let newStatus: string
      if (status === 'APPROVED') {
        newStatus = 'approved'
      } else if (status === 'REJECTED') {
        newStatus = 'declined'
      } else {
        newStatus = status.toLowerCase()
      }

      // Update the quote status
      await sql`
        UPDATE quotes
        SET
          status = ${newStatus},
          approval_response_at = ${approved_at ? new Date(approved_at) : new Date()},
          approval_response_by = ${approved_by || 'Property Manager'},
          rejection_reason = ${rejection_reason || null},
          updated_at = NOW()
        WHERE id = ${quote_id}
      `

      // If approved, update the linked job status
      if (newStatus === 'approved') {
        const quoteWithJob = await sql`
          SELECT job_id FROM quotes WHERE id = ${quote_id}
        `

        if (quoteWithJob.length > 0 && quoteWithJob[0].job_id) {
          await sql`
            UPDATE jobs
            SET
              status = 'scheduled',
              updated_at = NOW()
            WHERE id = ${quoteWithJob[0].job_id}
            AND status = 'pending'
          `
        }
      }

      return NextResponse.json({
        success: true,
        message: `Quote ${status.toLowerCase()} successfully`,
        quote_id,
        new_status: newStatus,
      })
    }

    return NextResponse.json(
      { error: `Unknown event type: ${event}` },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing Property Pal webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
