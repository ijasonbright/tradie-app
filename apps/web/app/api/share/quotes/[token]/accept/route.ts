import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

/**
 * POST /api/public/quotes/[token]/accept
 * Public endpoint to accept a quote (no authentication required)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()
    const { acceptedByName, acceptedByEmail } = body

    if (!acceptedByName || !acceptedByEmail) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(acceptedByEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Get the quote
    const quotes = await sql`
      SELECT id, status, valid_until_date, deposit_required, deposit_paid
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
        { error: 'Quote has already been accepted' },
        { status: 400 }
      )
    }

    if (quote.status === 'rejected') {
      return NextResponse.json(
        { error: 'Quote has already been rejected' },
        { status: 400 }
      )
    }

    // Check if expired
    const validUntil = new Date(quote.valid_until_date)
    if (validUntil < new Date()) {
      return NextResponse.json(
        { error: 'Quote has expired' },
        { status: 400 }
      )
    }

    // Check if deposit is required and not paid
    if (quote.deposit_required && !quote.deposit_paid) {
      return NextResponse.json(
        {
          error: 'Deposit payment required before accepting quote',
          requiresDeposit: true,
        },
        { status: 400 }
      )
    }

    // Accept the quote
    await sql`
      UPDATE quotes
      SET
        status = 'accepted',
        accepted_at = NOW(),
        accepted_by_name = ${acceptedByName},
        accepted_by_email = ${acceptedByEmail},
        updated_at = NOW()
      WHERE public_token = ${token}
    `

    // TODO: Send notification to organization owner/creator
    // TODO: Optionally create a job from the quote (based on organization settings)

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully',
      acceptedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error accepting quote:', error)
    return NextResponse.json(
      {
        error: 'Failed to accept quote',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
