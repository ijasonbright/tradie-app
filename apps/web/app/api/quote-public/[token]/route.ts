import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch quote by public token (for client approval)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const sql = neon(process.env.DATABASE_URL!)

    // Get quote by public token
    const quotes = await sql`
      SELECT
        q.*,
        c.company_name, c.first_name, c.last_name, c.is_company, c.email as client_email,
        o.name as organization_name, o.logo_url, o.phone as organization_phone,
        o.email as organization_email, o.abn,
        o.address_line1, o.address_line2, o.city, o.state, o.postcode,
        o.primary_color
      FROM quotes q
      INNER JOIN clients c ON q.client_id = c.id
      INNER JOIN organizations o ON q.organization_id = o.id
      WHERE q.public_token = ${token}
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Get line items
    const lineItems = await sql`
      SELECT * FROM quote_line_items
      WHERE quote_id = ${quote.id}
      ORDER BY line_order ASC
    `

    // Calculate if expired
    const validUntilDate = new Date(quote.valid_until_date)
    const isExpired = validUntilDate < new Date()

    // Calculate deposit amount if required
    let depositAmount: number | null = null
    if (quote.deposit_required) {
      const totalAmount = parseFloat(quote.total_amount)
      if (quote.deposit_percentage) {
        depositAmount = (totalAmount * parseFloat(quote.deposit_percentage)) / 100
      } else if (quote.deposit_amount) {
        depositAmount = parseFloat(quote.deposit_amount)
      }
    }

    // Get deposit payment link if deposit required and not paid
    let depositPaymentLinkUrl: string | null = null
    if (quote.deposit_required && !quote.deposit_paid && depositAmount) {
      // TODO: Generate Stripe payment link for deposit
      // For now, we'll leave this null and implement when Stripe payment links are set up
      depositPaymentLinkUrl = null
    }

    // Format client name
    const clientName = quote.is_company && quote.company_name
      ? quote.company_name
      : [quote.first_name, quote.last_name].filter(Boolean).join(' ') || 'Valued Client'

    // Return formatted data
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
        depositRequired: quote.deposit_required || false,
        depositAmount,
        depositPercentage: quote.deposit_percentage,
        depositPaid: quote.deposit_paid || false,
        depositPaymentLinkUrl,
        acceptedByName: quote.accepted_by_name,
        acceptedByEmail: quote.accepted_by_email,
        notes: quote.notes,
      },
      lineItems: lineItems.map((item: any) => ({
        id: item.id,
        itemType: item.item_type,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        gstAmount: item.gst_amount,
        lineTotal: item.line_total,
      })),
      organization: {
        name: quote.organization_name,
        logoUrl: quote.logo_url,
        phone: quote.organization_phone,
        email: quote.organization_email,
        address: {
          line1: quote.address_line1,
          line2: quote.address_line2,
          city: quote.city,
          state: quote.state,
          postcode: quote.postcode,
        },
        abn: quote.abn,
        primaryColor: quote.primary_color,
      },
      client: {
        name: clientName,
        email: quote.client_email,
      },
    })
  } catch (error) {
    console.error('Error fetching quote by token:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
