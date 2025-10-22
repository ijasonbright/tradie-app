import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { renderToStream } from '@react-pdf/renderer'
import { InvoicePDF } from '@/lib/pdf/InvoicePDF'
import { sendEmail } from '@/lib/email/ses'
import { generateInvoiceEmailHTML, generateInvoiceEmailText } from '@/lib/email/templates/invoice'

export const dynamic = 'force-dynamic'

// POST - Send invoice email to client
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get invoice with full details
    const invoices = await sql`
      SELECT i.*, o.name as organization_name,
             c.company_name, c.first_name, c.last_name, c.is_company,
             c.email as client_email, c.phone as client_phone, c.mobile as client_mobile,
             c.billing_address_line1, c.billing_address_line2, c.billing_city, c.billing_state, c.billing_postcode,
             j.job_number, j.title as job_title
      FROM invoices i
      INNER JOIN organizations o ON i.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON i.client_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      WHERE i.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Validate client email
    if (!invoice.client_email) {
      return NextResponse.json({ error: 'Client has no email address' }, { status: 400 })
    }

    // Get organization details
    const organizations = await sql`
      SELECT * FROM organizations WHERE id = ${invoice.organization_id} LIMIT 1
    `
    const organization = organizations[0]

    // Get line items
    const lineItems = await sql`
      SELECT * FROM invoice_line_items
      WHERE invoice_id = ${id}
      ORDER BY line_order ASC
    `

    // Generate PDF
    const pdfData = {
      invoice,
      lineItems,
      organization,
    } as any // Type assertion to bypass strict typing from database queries

    const stream = await renderToStream(<InvoicePDF data={pdfData} />)

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    const pdfBuffer = Buffer.concat(chunks)

    // Get client name
    const clientName = invoice.is_company && invoice.company_name
      ? invoice.company_name
      : [invoice.first_name, invoice.last_name].filter(Boolean).join(' ') || 'Valued Client'

    // Format currency
    const formatCurrency = (amount: string) => {
      return `$${parseFloat(amount).toFixed(2)}`
    }

    // Format date
    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    // Prepare email data
    const emailData = {
      invoiceNumber: invoice.invoice_number,
      clientName,
      organizationName: organization.name,
      totalAmount: formatCurrency(invoice.total_amount),
      dueDate: formatDate(invoice.due_date),
      organizationEmail: organization.email || undefined,
      organizationPhone: organization.phone || undefined,
    }

    // Determine FROM email address
    // Use organization email if verified with SES, otherwise use default
    const fromEmail = organization.email || process.env.DEFAULT_FROM_EMAIL || 'noreply@tradie-app.com'
    const replyToEmail = organization.email || undefined

    // Send email with PDF attachment
    await sendEmail({
      to: invoice.client_email,
      from: fromEmail,
      replyTo: replyToEmail,
      subject: `Invoice ${invoice.invoice_number} from ${organization.name}`,
      htmlBody: generateInvoiceEmailHTML(emailData),
      textBody: generateInvoiceEmailText(emailData),
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })

    // Update invoice: mark as sent and update sent_at timestamp
    await sql`
      UPDATE invoices
      SET sent_at = NOW(), status = 'sent', updated_at = NOW()
      WHERE id = ${id}
    `

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${invoice.client_email}`,
    })
  } catch (error) {
    console.error('Error sending invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
