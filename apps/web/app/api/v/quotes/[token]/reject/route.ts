import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Reject quote via public link
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

    // Validate quote can be rejected
    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Quote has already been accepted and cannot be rejected' }, { status: 400 })
    }

    if (quote.status === 'rejected') {
      return NextResponse.json({ error: 'Quote has already been rejected' }, { status: 400 })
    }

    // Update quote to rejected status
    await sql`
      UPDATE quotes
      SET
        status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = ${body.reason || null},
        updated_at = NOW()
      WHERE id = ${quote.id}
    `

    // TODO: Send notification email to organization
    // await sendEmail({
    //   to: quote.organization_email,
    //   subject: `Quote ${quote.quote_number} Declined`,
    //   body: `Quote ${quote.quote_number} has been declined. Reason: ${body.reason || 'Not provided'}`
    // })

    return NextResponse.json({
      success: true,
      message: 'Quote declined successfully',
    })
  } catch (error) {
    console.error('Error rejecting quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
