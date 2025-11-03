import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Manually mark deposit as paid (for testing when webhook doesn't fire)
export async function POST(req: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!)

    // Get token from query parameter
    const url = new URL(req.url)
    const publicToken = url.searchParams.get('token')

    if (!publicToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Get quote by public token
    const quotes = await sql`
      SELECT id, quote_number, deposit_required, deposit_paid
      FROM quotes
      WHERE public_token = ${publicToken}
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    if (!quote.deposit_required) {
      return NextResponse.json({ error: 'No deposit required for this quote' }, { status: 400 })
    }

    if (quote.deposit_paid) {
      return NextResponse.json({ message: 'Deposit already marked as paid' })
    }

    // Mark deposit as paid
    await sql`
      UPDATE quotes
      SET
        deposit_paid = true,
        deposit_paid_at = NOW(),
        updated_at = NOW()
      WHERE id = ${quote.id}
    `

    return NextResponse.json({
      success: true,
      message: `Deposit marked as paid for quote ${quote.quote_number}`,
    })
  } catch (error) {
    console.error('Error marking deposit as paid:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
