'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Invoice {
  id: string
  invoiceNumber: string
  status: string
  subtotal: string
  gstAmount: string
  totalAmount: string
  paidAmount: string
  remainingAmount: string
  issueDate: string
  dueDate: string
  paidDate: string | null
  isOverdue: boolean
  paymentTerms: string | null
  notes: string | null
  footerText: string | null
  stripePaymentLinkUrl: string | null
  isDepositInvoice: boolean
}

interface LineItem {
  id: string
  itemType: string
  description: string
  quantity: string
  unitPrice: string
  gstAmount: string
  lineTotal: string
}

interface Payment {
  date: string
  amount: string
  method: string
  reference: string | null
  notes: string | null
}

interface Organization {
  name: string
  logoUrl: string | null
  phone: string
  email: string
  address: {
    line1: string
    line2: string | null
    city: string
    state: string
    postcode: string
  }
  abn: string
}

interface Client {
  name: string
  email: string
}

export default function PublicInvoicePage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [client, setClient] = useState<Client | null>(null)

  useEffect(() => {
    fetchInvoice()
  }, [token])

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/public/invoices/${token}`)
      if (!response.ok) {
        throw new Error('Invoice not found')
      }
      const data = await response.json()
      setInvoice(data.invoice)
      setLineItems(data.lineItems)
      setPayments(data.payments)
      setOrganization(data.organization)
      setClient(data.client)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'paid':
        return { color: '#10b981', label: 'Paid' }
      case 'sent':
        return { color: '#3b82f6', label: 'Unpaid' }
      case 'overdue':
        return { color: '#ef4444', label: 'Overdue' }
      case 'partially_paid':
        return { color: '#f59e0b', label: 'Partially Paid' }
      default:
        return { color: '#6b7280', label: status }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div>Loading invoice...</div>
      </div>
    )
  }

  if (error || !invoice || !organization) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ color: '#ef4444' }}>{error || 'Invoice not found'}</div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(invoice.status)
  const brandColor = '#2563eb'
  const remainingAmount = parseFloat(invoice.remainingAmount)
  const canPay = remainingAmount > 0 && invoice.stripePaymentLinkUrl

  return (
    <html lang="en">
      <head>
        <title>Invoice {invoice.invoiceNumber} - {organization.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>

          {/* Payment Banner */}
          {canPay && (
            <div style={{
              backgroundColor: '#eff6ff',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e40af', marginBottom: '8px' }}>
                  {invoice.isDepositInvoice ? 'Deposit Payment' : 'Payment Due'}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e40af' }}>
                  {formatCurrency(invoice.remainingAmount)}
                </div>
                <div style={{ fontSize: '14px', color: '#3b82f6', marginTop: '4px' }}>
                  Due: {formatDate(invoice.dueDate)}
                  {invoice.isOverdue && <span style={{ color: '#ef4444', marginLeft: '8px' }}>• OVERDUE</span>}
                </div>
              </div>
              <a
                href={invoice.stripePaymentLinkUrl || '#'}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  padding: '16px 32px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  display: 'inline-block',
                }}
              >
                Pay Now
              </a>
            </div>
          )}

          {/* Main Invoice Card */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '40px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '40px', paddingBottom: '20px', borderBottom: `3px solid ${brandColor}` }}>
              <div>
                {organization.logoUrl && (
                  <img
                    src={organization.logoUrl}
                    alt={organization.name}
                    style={{ maxWidth: '180px', maxHeight: '80px', marginBottom: '16px' }}
                  />
                )}
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#111' }}>{organization.name}</h1>
                <div style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
                  {organization.address.line1}<br />
                  {organization.address.line2 && <>{organization.address.line2}<br /></>}
                  {organization.address.city}, {organization.address.state} {organization.address.postcode}<br />
                  ABN: {organization.abn}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>INVOICE</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111' }}>#{invoice.invoiceNumber}</div>
                <div style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  backgroundColor: statusInfo.color,
                  color: '#fff',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'inline-block',
                }}>
                  {statusInfo.label}
                </div>
              </div>
            </div>

            {/* Invoice Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>BILL TO</div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{client.name}</div>
                <div style={{ color: '#666', fontSize: '14px' }}>{client.email}</div>
              </div>
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Issue Date</div>
                  <div style={{ fontWeight: 'bold' }}>{formatDate(invoice.issueDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Due Date</div>
                  <div style={{ fontWeight: 'bold', color: invoice.isOverdue ? '#ef4444' : '#111' }}>
                    {formatDate(invoice.dueDate)}
                    {invoice.isOverdue && <span style={{ marginLeft: '8px', fontSize: '12px' }}>(Overdue)</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>DESCRIPTION</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>QTY</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>UNIT PRICE</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 8px' }}>
                      <div style={{ fontWeight: '500' }}>{item.description}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {item.itemType}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '16px 8px' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '16px 8px' }}>{formatCurrency(item.unitPrice)}</td>
                    <td style={{ textAlign: 'right', padding: '16px 8px', fontWeight: 'bold' }}>
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
              <div style={{ minWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px' }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #e5e7eb' }}>
                  <span>GST (10%):</span>
                  <span>{formatCurrency(invoice.gstAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  <span>Total:</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                {parseFloat(invoice.paidAmount) > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', color: '#10b981' }}>
                      <span>Paid:</span>
                      <span>-{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '20px', fontWeight: 'bold', borderTop: '2px solid #e5e7eb' }}>
                      <span>Amount Due:</span>
                      <span style={{ color: remainingAmount > 0 ? brandColor : '#10b981' }}>
                        {formatCurrency(invoice.remainingAmount)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#666', marginBottom: '12px' }}>PAYMENT HISTORY</div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                  {payments.map((payment, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px 16px',
                        borderBottom: index < payments.length - 1 ? '1px solid #e5e7eb' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{formatCurrency(payment.amount)}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {formatDate(payment.date)} • {payment.method}
                          {payment.reference && ` • Ref: ${payment.reference}`}
                        </div>
                      </div>
                      <div style={{
                        backgroundColor: '#d1fae5',
                        color: '#065f46',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}>
                        Paid
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>NOTES</div>
                <div style={{ fontSize: '14px', color: '#374151', whiteSpace: 'pre-wrap' }}>{invoice.notes}</div>
              </div>
            )}

            {/* Footer Text */}
            {invoice.footerText && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#666', fontSize: '14px', borderTop: '1px solid #e5e7eb' }}>
                {invoice.footerText}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px', color: '#666', fontSize: '14px' }}>
            <div>Questions? Contact {organization.name}</div>
            <div style={{ marginTop: '8px' }}>
              {organization.phone} • {organization.email}
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
