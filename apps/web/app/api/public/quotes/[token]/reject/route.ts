import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

/**
 * POST /api/public/quotes/[token]/reject
 * Public endpoint to reject a quote (no authentication required)
 */
export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token
    const body = await req.json()
    const { reason } = body

    // Get the quote
    const quotes = await sql`
      SELECT id, status, valid_until_date
      FROM quotes
      WHERE public_token = ${token}
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Check if already accepted or rejected
    if (quote.status === 'accepted') {
      return NextResponse.json(
        { error: 'Quote has already been accepted and cannot be rejected' },
        { status: 400 }
      )
    }

    if (quote.status === 'rejected') {
      return NextResponse.json(
        { error: 'Quote has already been rejected' },
        { status: 400 }
      )
    }

    // Reject the quote
    await sql`
      UPDATE quotes
      SET
        status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = ${reason || 'No reason provided'},
        updated_at = NOW()
      WHERE public_token = ${token}
    `

    // TODO: Send notification to organization owner/creator

    return NextResponse.json({
      success: true,
      message: 'Quote rejected',
      rejectedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error rejecting quote:', error)
    return NextResponse.json(
      {
        error: 'Failed to reject quote',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
