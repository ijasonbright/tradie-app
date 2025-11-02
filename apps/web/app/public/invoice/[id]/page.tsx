import { notFound } from 'next/navigation'
import { neon } from '@neondatabase/serverless'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PublicInvoicePage({ params }: PageProps) {
  const { id } = await params
  const sql = neon(process.env.DATABASE_URL!)

  // Fetch invoice details (no authentication required for public view)
  const invoices = await sql`
    SELECT i.*, o.name as organization_name, o.abn, o.email as org_email, o.phone as org_phone,
           o.address_line1, o.address_line2, o.city, o.state, o.postcode,
           o.logo_url, o.primary_color,
           o.bank_name, o.bank_bsb, o.bank_account_number, o.bank_account_name,
           c.company_name, c.first_name, c.last_name, c.is_company,
           c.email as client_email, c.phone as client_phone,
           c.billing_address_line1, c.billing_address_line2,
           c.billing_city, c.billing_state, c.billing_postcode
    FROM invoices i
    INNER JOIN organizations o ON i.organization_id = o.id
    INNER JOIN clients c ON i.client_id = c.id
    WHERE i.id = ${id}
    AND i.status != 'draft'
    LIMIT 1
  `

  if (invoices.length === 0) {
    notFound()
  }

  const invoice = invoices[0]

  // Get line items
  const lineItems = await sql`
    SELECT * FROM invoice_line_items
    WHERE invoice_id = ${id}
    ORDER BY line_order ASC
  `

  // Format client name
  const clientName = invoice.is_company
    ? invoice.company_name
    : `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim()

  // Format currency
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  // Get status color and label
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'paid':
        return { color: '#10b981', label: 'Paid' }
      case 'sent':
        return { color: '#3b82f6', label: 'Sent' }
      case 'overdue':
        return { color: '#ef4444', label: 'Overdue' }
      case 'partially_paid':
        return { color: '#f59e0b', label: 'Partially Paid' }
      default:
        return { color: '#6b7280', label: status }
    }
  }

  const statusInfo = getStatusInfo(invoice.status)
  const outstanding = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0')
  const brandColor = invoice.primary_color || '#2563eb'

  return (
    <html lang="en">
      <head>
        <title>Invoice {invoice.invoice_number} - {invoice.organization_name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          {/* Main Invoice Card */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '40px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {/* Header with Logo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '40px', paddingBottom: '20px', borderBottom: `3px solid ${brandColor}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {invoice.logo_url && (
                  <img
                    src={invoice.logo_url}
                    alt={invoice.organization_name}
                    style={{ maxWidth: '200px', maxHeight: '80px', objectFit: 'contain' }}
                  />
                )}
                <div>
                  <h1 style={{ margin: 0, fontSize: '32px', color: brandColor }}>INVOICE</h1>
                  <p style={{ margin: '8px 0 0 0', fontSize: '18px', color: '#6b7280' }}>{invoice.invoice_number}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: statusInfo.color,
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {statusInfo.label}
                </div>
              </div>
            </div>

            {/* From/To Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>From</h3>
                <p style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>{invoice.organization_name}</p>
                {invoice.abn && <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#6b7280' }}>ABN: {invoice.abn}</p>}
                {invoice.address_line1 && (
                  <>
                    <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>{invoice.address_line1}</p>
                    {invoice.address_line2 && <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>{invoice.address_line2}</p>}
                    <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                      {invoice.city}, {invoice.state} {invoice.postcode}
                    </p>
                  </>
                )}
                {invoice.org_phone && <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>{invoice.org_phone}</p>}
                {invoice.org_email && <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>{invoice.org_email}</p>}
              </div>

              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Bill To</h3>
                <p style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>{clientName}</p>
                {invoice.billing_address_line1 && (
                  <>
                    <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>{invoice.billing_address_line1}</p>
                    {invoice.billing_address_line2 && <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>{invoice.billing_address_line2}</p>}
                    <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                      {invoice.billing_city}, {invoice.billing_state} {invoice.billing_postcode}
                    </p>
                  </>
                )}
                {invoice.client_email && <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>{invoice.client_email}</p>}
                {invoice.client_phone && <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>{invoice.client_phone}</p>}
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px', paddingBottom: '40px', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Issue Date</p>
                <p style={{ margin: 0, fontSize: '16px', color: '#1f2937', fontWeight: '500' }}>{formatDate(invoice.issue_date)}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Due Date</p>
                <p style={{ margin: 0, fontSize: '16px', color: '#1f2937', fontWeight: '500' }}>{formatDate(invoice.due_date)}</p>
              </div>
            </div>

            {/* Line Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 0', textAlign: 'left', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Description</th>
                  <th style={{ padding: '12px 0', textAlign: 'right', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Qty</th>
                  <th style={{ padding: '12px 0', textAlign: 'right', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Unit Price</th>
                  <th style={{ padding: '12px 0', textAlign: 'right', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item: any, index: number) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 0', fontSize: '14px', color: '#1f2937' }}>{item.description}</td>
                    <td style={{ padding: '16px 0', textAlign: 'right', fontSize: '14px', color: '#1f2937' }}>{item.quantity}</td>
                    <td style={{ padding: '16px 0', textAlign: 'right', fontSize: '14px', color: '#1f2937' }}>{formatCurrency(item.unit_price)}</td>
                    <td style={{ padding: '16px 0', textAlign: 'right', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
              <div style={{ minWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>GST (10%)</span>
                  <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{formatCurrency(invoice.gst_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '2px solid #e5e7eb' }}>
                  <span style={{ fontSize: '18px', color: '#1f2937', fontWeight: '600' }}>Total</span>
                  <span style={{ fontSize: '20px', color: '#1f2937', fontWeight: '700' }}>{formatCurrency(invoice.total_amount)}</span>
                </div>
                {parseFloat(invoice.paid_amount || '0') > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                      <span style={{ fontSize: '14px', color: '#10b981' }}>Paid</span>
                      <span style={{ fontSize: '14px', color: '#10b981', fontWeight: '500' }}>{formatCurrency(invoice.paid_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '16px', color: '#ef4444', fontWeight: '600' }}>Amount Due</span>
                      <span style={{ fontSize: '18px', color: '#ef4444', fontWeight: '700' }}>{formatCurrency(outstanding)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280', textTransform: 'uppercase' }}>Notes</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#1f2937', lineHeight: '1.6' }}>{invoice.notes}</p>
              </div>
            )}

            {/* Payment Link Button - Placeholder for future online payment integration */}
            {false && ( // TODO: Enable when Stripe payment links are implemented
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <a
                  href="#"
                  style={{
                    display: 'inline-block',
                    backgroundColor: brandColor,
                    color: '#ffffff',
                    padding: '14px 28px',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '16px',
                  }}
                >
                  Pay Invoice Online
                </a>
              </div>
            )}

            {/* Payment Details */}
            {(invoice.bank_name || invoice.bank_bsb || invoice.bank_account_number) && (
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '6px', borderLeft: `4px solid ${brandColor}` }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>Payment Details</h3>
                {invoice.bank_account_name && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1f2937' }}>
                    <strong>Account Name:</strong> {invoice.bank_account_name}
                  </p>
                )}
                {invoice.bank_name && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1f2937' }}>
                    <strong>Bank:</strong> {invoice.bank_name}
                  </p>
                )}
                {invoice.bank_bsb && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1f2937' }}>
                    <strong>BSB:</strong> {invoice.bank_bsb}
                  </p>
                )}
                {invoice.bank_account_number && (
                  <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>
                    <strong>Account Number:</strong> {invoice.bank_account_number}
                  </p>
                )}
              </div>
            )}

            {/* Payment Terms */}
            {invoice.payment_terms && (
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280', textTransform: 'uppercase' }}>Payment Terms</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{invoice.payment_terms}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '20px', padding: '20px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
              This is an electronic invoice. No signature required.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
