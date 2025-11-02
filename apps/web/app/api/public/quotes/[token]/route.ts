import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

/**
 * GET /api/public/quotes/[token]
 * Public endpoint to view a quote by its public token (no authentication required)
 */
export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token

    // Get the quote with all related data
    const quotes = await sql`
      SELECT
        q.*,
        c.first_name,
        c.last_name,
        c.company_name,
        c.is_company,
        c.email as client_email,
        o.name as organization_name,
        o.logo_url as organization_logo,
        o.phone as organization_phone,
        o.email as organization_email,
        o.address_line1 as organization_address_line1,
        o.address_line2 as organization_address_line2,
        o.city as organization_city,
        o.state as organization_state,
        o.postcode as organization_postcode,
        o.abn as organization_abn
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      JOIN organizations o ON q.organization_id = o.id
      WHERE q.public_token = ${token}
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Get line items
    const lineItems = await sql`
      SELECT *
      FROM quote_line_items
      WHERE quote_id = ${quote.id}
      ORDER BY line_order ASC
    `

    // Check if quote is expired
    const validUntil = new Date(quote.valid_until_date)
    const isExpired = validUntil < new Date()

    // Format client name
    const clientName = quote.is_company
      ? quote.company_name
      : `${quote.first_name} ${quote.last_name}`

    // Calculate deposit amount if required
    let depositAmount = null
    if (quote.deposit_required) {
      if (quote.deposit_amount) {
        depositAmount = parseFloat(quote.deposit_amount)
      } else if (quote.deposit_percentage) {
        const totalAmount = parseFloat(quote.total_amount)
        const percentage = parseFloat(quote.deposit_percentage)
        depositAmount = (totalAmount * percentage) / 100
      }
    }

    return NextResponse.json({
      quote: {
        id: quote.id,
        quoteNumber: quote.quote_number,
        title: quote.title,
        description: quote.description,
        status: quote.status,
        subtotal: quote.subtotal,
        gstAmount: quote.gst_amount,
        totalAmount: quote.total_amount,
        validUntilDate: quote.valid_until_date,
        isExpired,
        sentAt: quote.sent_at,
        acceptedAt: quote.accepted_at,
        rejectedAt: quote.rejected_at,
        rejectionReason: quote.rejection_reason,
        notes: quote.notes,
        createdAt: quote.created_at,
        // Deposit info
        depositRequired: quote.deposit_required,
        depositPercentage: quote.deposit_percentage,
        depositAmount: depositAmount,
        depositPaid: quote.deposit_paid,
        depositPaidAt: quote.deposit_paid_at,
        depositPaymentLinkUrl: quote.deposit_payment_link_url,
        // Acceptance info
        acceptedByName: quote.accepted_by_name,
        acceptedByEmail: quote.accepted_by_email,
      },
      lineItems: lineItems.map((item) => ({
        id: item.id,
        itemType: item.item_type,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        gstAmount: item.gst_amount,
        lineTotal: item.line_total,
      })),
      client: {
        name: clientName,
        email: quote.client_email,
      },
      organization: {
        name: quote.organization_name,
        logoUrl: quote.organization_logo,
        phone: quote.organization_phone,
        email: quote.organization_email,
        address: {
          line1: quote.organization_address_line1,
          line2: quote.organization_address_line2,
          city: quote.organization_city,
          state: quote.organization_state,
          postcode: quote.organization_postcode,
        },
        abn: quote.organization_abn,
      },
    })
  } catch (error) {
    console.error('Error fetching public quote:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch quote',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
