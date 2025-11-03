import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Reject quote via public token
export async function POST(req: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!)

    // Get token from query parameter
    const url = new URL(req.url)
    const publicToken = url.searchParams.get('token')

    if (!publicToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const body = await req.json()
    const { reason } = body

    // Get quote by public token
    const quotes = await sql`
      SELECT id, status
      FROM quotes
      WHERE public_token = ${publicToken}
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Check if quote is already rejected or accepted
    if (quote.status === 'rejected') {
      return NextResponse.json({ error: 'Quote has already been rejected' }, { status: 400 })
    }
    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Cannot reject an accepted quote' }, { status: 400 })
    }

    // Update quote: mark as rejected
    await sql`
      UPDATE quotes
      SET
        status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = ${reason || 'No reason provided'},
        updated_at = NOW()
      WHERE id = ${quote.id}
    `

    // TODO: Send notification to business owner

    return NextResponse.json({
      success: true,
      message: 'Quote rejected successfully',
    })
  } catch (error) {
    console.error('Error rejecting quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
