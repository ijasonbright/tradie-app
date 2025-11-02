import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

/**
 * GET /api/public/invoices/[token]
 * Public endpoint to view an invoice by its public token (no authentication required)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Get the invoice with all related data
    const invoices = await sql`
      SELECT
        i.*,
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
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN organizations o ON i.organization_id = o.id
      WHERE i.public_token = ${token}
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Get line items
    const lineItems = await sql`
      SELECT *
      FROM invoice_line_items
      WHERE invoice_id = ${invoice.id}
      ORDER BY line_order ASC
    `

    // Get payment history
    const payments = await sql`
      SELECT
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes
      FROM invoice_payments
      WHERE invoice_id = ${invoice.id}
      ORDER BY payment_date DESC
    `

    // Calculate amounts
    const totalAmount = parseFloat(invoice.total_amount)
    const paidAmount = parseFloat(invoice.paid_amount || '0')
    const remainingAmount = totalAmount - paidAmount

    // Check if overdue
    const dueDate = new Date(invoice.due_date)
    const isOverdue = dueDate < new Date() && remainingAmount > 0

    // Format client name
    const clientName = invoice.is_company
      ? invoice.company_name
      : `${invoice.first_name} ${invoice.last_name}`

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        subtotal: invoice.subtotal,
        gstAmount: invoice.gst_amount,
        totalAmount: invoice.total_amount,
        paidAmount: invoice.paid_amount,
        remainingAmount: remainingAmount.toFixed(2),
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        paidDate: invoice.paid_date,
        isOverdue,
        paymentTerms: invoice.payment_terms,
        notes: invoice.notes,
        footerText: invoice.footer_text,
        sentAt: invoice.sent_at,
        createdAt: invoice.created_at,
        // Stripe payment info
        stripePaymentLinkUrl: invoice.stripe_payment_link_url,
        // Deposit info
        isDepositInvoice: invoice.is_deposit_invoice,
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
      payments: payments.map((payment) => ({
        date: payment.payment_date,
        amount: payment.amount,
        method: payment.payment_method,
        reference: payment.reference_number,
        notes: payment.notes,
      })),
      client: {
        name: clientName,
        email: invoice.client_email,
      },
      organization: {
        name: invoice.organization_name,
        logoUrl: invoice.organization_logo,
        phone: invoice.organization_phone,
        email: invoice.organization_email,
        address: {
          line1: invoice.organization_address_line1,
          line2: invoice.organization_address_line2,
          city: invoice.organization_city,
          state: invoice.organization_state,
          postcode: invoice.organization_postcode,
        },
        abn: invoice.organization_abn,
      },
    })
  } catch (error) {
    console.error('Error fetching public invoice:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
