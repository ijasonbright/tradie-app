import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromRequest } from '@/lib/auth'
import { createQuoteDepositPaymentLink, generatePublicToken } from '@/lib/stripe/payment-links'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quoteId = params.id

    // Get the quote
    const quotes = await sql`
      SELECT
        q.*,
        c.first_name,
        c.last_name,
        c.company_name,
        c.is_company
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      WHERE q.id = ${quoteId}
        AND q.organization_id = ${user.organizationId}
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Check if deposit is required
    if (!quote.deposit_required) {
      return NextResponse.json(
        { error: 'This quote does not require a deposit' },
        { status: 400 }
      )
    }

    // Calculate deposit amount
    let depositAmount = 0
    if (quote.deposit_amount) {
      // Fixed deposit amount
      depositAmount = parseFloat(quote.deposit_amount)
    } else if (quote.deposit_percentage) {
      // Percentage-based deposit
      const totalAmount = parseFloat(quote.total_amount)
      const percentage = parseFloat(quote.deposit_percentage)
      depositAmount = (totalAmount * percentage) / 100
    } else {
      return NextResponse.json(
        { error: 'Deposit amount or percentage not configured' },
        { status: 400 }
      )
    }

    // Generate public token if not already exists
    let publicToken = quote.public_token
    if (!publicToken) {
      publicToken = generatePublicToken()
      await sql`
        UPDATE quotes
        SET public_token = ${publicToken}, updated_at = NOW()
        WHERE id = ${quoteId}
      `
    }

    // Create client name
    const clientName = quote.is_company
      ? quote.company_name
      : `${quote.first_name} ${quote.last_name}`

    // Create Stripe Payment Link
    const { paymentLink } = await createQuoteDepositPaymentLink({
      quoteId,
      quoteNumber: quote.quote_number,
      organizationId: user.organizationId,
      depositAmount,
      publicToken,
      clientName,
    })

    // Update quote with payment link URL
    await sql`
      UPDATE quotes
      SET
        deposit_payment_link_url = ${paymentLink.url},
        updated_at = NOW()
      WHERE id = ${quoteId}
    `

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: paymentLink.id,
        url: paymentLink.url,
      },
      publicUrl: `${process.env.NEXT_PUBLIC_APP_URL}/public/quotes/${publicToken}`,
      depositAmount,
    })
  } catch (error) {
    console.error('Error creating quote payment link:', error)
    return NextResponse.json(
      {
        error: 'Failed to create payment link',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
