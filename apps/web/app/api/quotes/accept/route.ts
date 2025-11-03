import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Accept quote via public token
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
    const { acceptedByName, acceptedByEmail } = body

    if (!acceptedByName || !acceptedByEmail) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Get quote by public token
    const quotes = await sql`
      SELECT id, deposit_required, deposit_paid, status
      FROM quotes
      WHERE public_token = ${publicToken}
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Check if quote is already accepted
    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote has already been accepted' }, { status: 400 })
    }

    // Check if deposit is required and not paid
    if (quote.deposit_required && !quote.deposit_paid) {
      return NextResponse.json(
        {
          error: 'Deposit payment is required before accepting this quote',
          requiresDeposit: true
        },
        { status: 400 }
      )
    }

    // Update quote: mark as accepted
    await sql`
      UPDATE quotes
      SET
        status = 'accepted',
        accepted_at = NOW(),
        accepted_by_name = ${acceptedByName},
        accepted_by_email = ${acceptedByEmail},
        updated_at = NOW()
      WHERE id = ${quote.id}
    `

    // TODO: Send notification to business owner

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully',
    })
  } catch (error) {
    console.error('Error accepting quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
