import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { createQuoteDepositPaymentLink } from '@/lib/stripe/payment-links'

export const dynamic = 'force-dynamic'

// POST - Create Stripe payment link for quote deposit
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
      SELECT
        q.id, q.quote_number, q.organization_id, q.total_amount,
        q.deposit_required, q.deposit_percentage, q.deposit_amount,
        q.deposit_paid, q.deposit_payment_link_url, q.public_token,
        c.company_name, c.first_name, c.last_name, c.is_company
      FROM quotes q
      INNER JOIN clients c ON q.client_id = c.id
      WHERE q.public_token = ${publicToken}
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Check if deposit is required
    if (!quote.deposit_required) {
      return NextResponse.json({ error: 'No deposit required for this quote' }, { status: 400 })
    }

    // Check if deposit is already paid
    if (quote.deposit_paid) {
      return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 })
    }

    // If payment link already exists, return it
    if (quote.deposit_payment_link_url) {
      return NextResponse.json({ paymentUrl: quote.deposit_payment_link_url })
    }

    // Calculate deposit amount
    const totalAmount = parseFloat(quote.total_amount)
    let depositAmount = 0
    if (quote.deposit_percentage) {
      depositAmount = (totalAmount * parseFloat(quote.deposit_percentage)) / 100
    } else if (quote.deposit_amount) {
      depositAmount = parseFloat(quote.deposit_amount)
    }

    if (depositAmount <= 0) {
      return NextResponse.json({ error: 'Invalid deposit amount' }, { status: 400 })
    }

    // Format client name
    const clientName = quote.is_company && quote.company_name
      ? quote.company_name
      : [quote.first_name, quote.last_name].filter(Boolean).join(' ') || 'Valued Client'

    // Create Stripe payment link
    const { paymentLink } = await createQuoteDepositPaymentLink({
      quoteId: quote.id,
      quoteNumber: quote.quote_number,
      organizationId: quote.organization_id,
      depositAmount,
      publicToken: quote.public_token,
      clientName,
    })

    // Save payment link URL to database
    await sql`
      UPDATE quotes
      SET deposit_payment_link_url = ${paymentLink.url}, updated_at = NOW()
      WHERE id = ${quote.id}
    `

    return NextResponse.json({ paymentUrl: paymentLink.url })
  } catch (error) {
    console.error('Error creating deposit payment link:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
