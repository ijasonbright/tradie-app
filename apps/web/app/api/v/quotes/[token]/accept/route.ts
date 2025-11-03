import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Accept quote via public link
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()

    const sql = neon(process.env.DATABASE_URL!)

    // Get quote by public token
    const quotes = await sql`
      SELECT q.*, o.name as organization_name, o.email as organization_email
      FROM quotes q
      INNER JOIN organizations o ON q.organization_id = o.id
      WHERE q.public_token = ${token}
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Validate quote can be accepted
    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote has already been accepted' }, { status: 400 })
    }

    if (quote.status === 'rejected') {
      return NextResponse.json({ error: 'Quote has been rejected and cannot be accepted' }, { status: 400 })
    }

    // Check if expired
    const validUntilDate = new Date(quote.valid_until_date)
    if (validUntilDate < new Date()) {
      return NextResponse.json({ error: 'Quote has expired' }, { status: 400 })
    }

    // Check if deposit is required but not paid
    if (quote.deposit_required && !quote.deposit_paid) {
      return NextResponse.json({
        error: 'Deposit payment is required before accepting this quote',
        requiresDeposit: true,
      }, { status: 400 })
    }

    // Update quote to accepted status
    await sql`
      UPDATE quotes
      SET
        status = 'accepted',
        accepted_at = NOW(),
        accepted_by_name = ${body.acceptedByName || null},
        accepted_by_email = ${body.acceptedByEmail || null},
        updated_at = NOW()
      WHERE id = ${quote.id}
    `

    // TODO: Send notification email to organization
    // await sendEmail({
    //   to: quote.organization_email,
    //   subject: `Quote ${quote.quote_number} Accepted`,
    //   body: `${body.acceptedByName} has accepted quote ${quote.quote_number}`
    // })

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
