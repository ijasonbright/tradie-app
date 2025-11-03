'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Quote {
  id: string
  quoteNumber: string
  title: string
  description: string
  status: string
  subtotal: string
  gstAmount: string
  totalAmount: string
  validUntilDate: string
  isExpired: boolean
  depositRequired: boolean
  depositAmount: number | null
  depositPercentage: string | null
  depositPaid: boolean
  depositPaymentLinkUrl: string | null
  acceptedByName: string | null
  acceptedByEmail: string | null
  notes: string | null
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

export default function PublicQuotePage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [client, setClient] = useState<Client | null>(null)

  // Accept/Reject form state
  const [showAcceptForm, setShowAcceptForm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [acceptName, setAcceptName] = useState('')
  const [acceptEmail, setAcceptEmail] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchQuote()
  }, [token])

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/share/quotes/${token}`)
      if (!response.ok) {
        throw new Error('Quote not found')
      }
      const data = await response.json()
      setQuote(data.quote)
      setLineItems(data.lineItems)
      setOrganization(data.organization)
      setClient(data.client)

      // Pre-fill acceptance form with client details
      if (data.client) {
        setAcceptName(data.client.name || '')
        setAcceptEmail(data.client.email || '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quote')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMessage(null)

    try {
      const response = await fetch(`/api/share/quotes/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptedByName: acceptName,
          acceptedByEmail: acceptEmail,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresDeposit) {
          setSubmitMessage({ type: 'error', text: 'Please pay the deposit before accepting this quote.' })
        } else {
          throw new Error(data.error || 'Failed to accept quote')
        }
      } else {
        setSubmitMessage({ type: 'success', text: 'Quote accepted successfully! The business will be notified.' })
        setShowAcceptForm(false)
        // Refresh quote data
        await fetchQuote()
      }
    } catch (err) {
      setSubmitMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to accept quote' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMessage(null)

    try {
      const response = await fetch(`/api/share/quotes/${token}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject quote')
      }

      setSubmitMessage({ type: 'success', text: 'Quote rejected. The business will be notified.' })
      setShowRejectForm(false)
      // Refresh quote data
      await fetchQuote()
    } catch (err) {
      setSubmitMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to reject quote' })
    } finally {
      setSubmitting(false)
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
      case 'accepted':
        return { color: '#10b981', label: 'Accepted' }
      case 'rejected':
        return { color: '#ef4444', label: 'Rejected' }
      case 'expired':
        return { color: '#6b7280', label: 'Expired' }
      case 'sent':
        return { color: '#3b82f6', label: 'Pending' }
      default:
        return { color: '#6b7280', label: status }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div>Loading quote...</div>
      </div>
    )
  }

  if (error || !quote || !organization || !client) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ color: '#ef4444' }}>{error || 'Quote not found'}</div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(quote.status)
  const brandColor = '#2563eb'
  const canInteract = quote.status === 'sent' && !quote.isExpired

  return (
    <html lang="en">
      <head>
        <title>Quote {quote.quoteNumber} - {organization.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>

          {/* Status Message */}
          {submitMessage && (
            <div style={{
              backgroundColor: submitMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: submitMessage.type === 'success' ? '#065f46' : '#991b1b',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: `1px solid ${submitMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
            }}>
              {submitMessage.text}
            </div>
          )}

          {/* Main Quote Card */}
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
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>QUOTE</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111' }}>#{quote.quoteNumber}</div>
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

            {/* Quote Details */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>{quote.title}</h2>
              {quote.description && (
                <p style={{ color: '#666', marginBottom: '16px', whiteSpace: 'pre-wrap' }}>{quote.description}</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Valid Until</div>
                  <div style={{ fontWeight: 'bold', color: quote.isExpired ? '#ef4444' : '#111' }}>
                    {formatDate(quote.validUntilDate)}
                    {quote.isExpired && <span style={{ marginLeft: '8px', fontSize: '12px' }}>(Expired)</span>}
                  </div>
                </div>
                {quote.acceptedByName && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Accepted By</div>
                    <div style={{ fontWeight: 'bold' }}>{quote.acceptedByName}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Deposit Info */}
            {quote.depositRequired && (
              <div style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '32px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1e40af', marginBottom: '4px' }}>
                      Deposit Required
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>
                      {quote.depositAmount && formatCurrency(quote.depositAmount)}
                      {quote.depositPercentage && ` (${quote.depositPercentage}%)`}
                    </div>
                  </div>
                  {quote.depositPaid ? (
                    <div style={{
                      backgroundColor: '#10b981',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                    }}>
                      ✓ Paid
                    </div>
                  ) : quote.depositPaymentLinkUrl ? (
                    <a
                      href={quote.depositPaymentLinkUrl}
                      style={{
                        backgroundColor: '#3b82f6',
                        color: '#fff',
                        padding: '12px 24px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: 'bold',
                        display: 'inline-block',
                      }}
                    >
                      Pay Deposit
                    </a>
                  ) : null}
                </div>
              </div>
            )}

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
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #e5e7eb' }}>
                  <span>GST (10%):</span>
                  <span>{formatCurrency(quote.gstAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  <span>Total:</span>
                  <span style={{ color: brandColor }}>{formatCurrency(quote.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '6px', marginBottom: '32px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>NOTES</div>
                <div style={{ fontSize: '14px', color: '#374151', whiteSpace: 'pre-wrap' }}>{quote.notes}</div>
              </div>
            )}

            {/* Action Buttons */}
            {canInteract && !showAcceptForm && !showRejectForm && (
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '32px' }}>
                <button
                  onClick={() => setShowAcceptForm(true)}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#fff',
                    padding: '14px 32px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Accept Quote
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  style={{
                    backgroundColor: '#fff',
                    color: '#ef4444',
                    padding: '14px 32px',
                    borderRadius: '8px',
                    border: '2px solid #ef4444',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Decline Quote
                </button>
              </div>
            )}

            {/* Accept Form */}
            {showAcceptForm && (
              <form onSubmit={handleAccept} style={{
                backgroundColor: '#f0fdf4',
                border: '2px solid #10b981',
                borderRadius: '8px',
                padding: '24px',
                marginTop: '32px',
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#065f46' }}>Accept This Quote</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#065f46' }}>
                  Please confirm your details before accepting:
                </p>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={acceptName}
                    onChange={(e) => setAcceptName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      backgroundColor: '#f9fafb',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Your Email *
                  </label>
                  <input
                    type="email"
                    value={acceptEmail}
                    onChange={(e) => setAcceptEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      backgroundColor: '#f9fafb',
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                    Update if needed - we'll use this to send confirmation
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#fff',
                      padding: '12px 24px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? 'Accepting...' : 'Confirm Acceptance'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAcceptForm(false)}
                    disabled={submitting}
                    style={{
                      backgroundColor: '#fff',
                      color: '#666',
                      padding: '12px 24px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Reject Form */}
            {showRejectForm && (
              <form onSubmit={handleReject} style={{
                backgroundColor: '#fef2f2',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                padding: '24px',
                marginTop: '32px',
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#991b1b' }}>Decline This Quote</h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Reason (optional)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      fontFamily: 'Arial, sans-serif',
                    }}
                    placeholder="Let us know why you're declining..."
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      padding: '12px 24px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? 'Declining...' : 'Confirm Decline'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    disabled={submitting}
                    style={{
                      backgroundColor: '#fff',
                      color: '#666',
                      padding: '12px 24px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
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
