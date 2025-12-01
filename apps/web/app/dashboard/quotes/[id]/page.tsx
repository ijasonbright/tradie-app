'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Quote {
  id: string
  organization_id: string
  client_id: string
  quote_number: string
  title: string
  description: string
  status: string
  subtotal: string
  gst_amount: string
  total_amount: string
  valid_until_date: string
  notes: string
  created_at: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  is_company: boolean
  client_email: string
  client_phone: string | null
  client_mobile: string | null
  organization_name: string
  created_by_name: string
  converted_to_job_id: string | null
  public_token: string
  // Job linking fields
  job_id: string | null
  job_number: string | null
  external_work_order_id: string | null
  external_source: string | null
  // Property Pal approval fields
  approval_response_at: string | null
  approval_response_by: string | null
  rejection_reason: string | null
}

interface LineItem {
  id: string
  item_type: string
  description: string
  quantity: string
  unit_price: string
  gst_amount: string
  line_total: string
  line_order: number
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [submittingToPropertyPal, setSubmittingToPropertyPal] = useState(false)

  // Send modal state
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendViaEmail, setSendViaEmail] = useState(true)
  const [sendViaSMS, setSendViaSMS] = useState(false)
  const [sending, setSending] = useState(false)

  // Form fields
  const [emailAddress, setEmailAddress] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsMessage, setSmsMessage] = useState('')

  useEffect(() => {
    if (params.id) {
      fetchQuote()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchQuote = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/quotes/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch quote')

      const data = await res.json()
      setQuote(data.quote)
      setLineItems(data.lineItems || [])
    } catch (error) {
      console.error('Error fetching quote:', error)
      alert('Failed to load quote')
    } finally {
      setLoading(false)
    }
  }

  const getClientName = () => {
    if (!quote) return 'Unknown Client'
    if (quote.is_company && quote.company_name) {
      return quote.company_name
    }
    return [quote.first_name, quote.last_name].filter(Boolean).join(' ') || 'Unknown Client'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'accepted':
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
      case 'declined':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`
  }

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
      cleaned = '61' + cleaned.substring(1)
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned
    }
    return cleaned
  }

  const openSendModal = () => {
    if (!quote) return

    const clientName = getClientName()
    const quoteLink = `https://tradie-app-web.vercel.app/public/quotes/${quote.public_token}`

    // Pre-fill form fields
    setEmailAddress(quote.client_email || '')
    setEmailSubject(`Quote ${quote.quote_number} from ${quote.organization_name}`)
    setEmailMessage(
      `Hi ${clientName},\n\n` +
      `Please find your quote ${quote.quote_number} for ${formatCurrency(quote.total_amount)}.\n\n` +
      `${quote.title ? `Project: ${quote.title}\n\n` : ''}` +
      `Valid until: ${formatDate(quote.valid_until_date)}\n\n` +
      `View and approve your quote online: ${quoteLink}\n\n` +
      `Thank you for considering our services!\n\n` +
      `${quote.organization_name}`
    )

    const rawPhone = quote.client_mobile || quote.client_phone || ''
    setPhoneNumber(rawPhone ? formatPhoneNumber(rawPhone) : '')
    setSmsMessage(
      `Hi ${clientName}, your quote ${quote.quote_number} for ${formatCurrency(quote.total_amount)} is ready. View and approve it here: ${quoteLink}`
    )

    setShowSendModal(true)
  }

  const handleSend = async () => {
    if (!sendViaEmail && !sendViaSMS) {
      alert('Please select at least one method (Email or SMS)')
      return
    }

    if (sendViaEmail && !emailAddress) {
      alert('Email address is required')
      return
    }

    if (sendViaSMS && !phoneNumber) {
      alert('Phone number is required')
      return
    }

    setSending(true)

    try {
      // Update quote status to 'sent' if draft
      if (quote?.status === 'draft') {
        await fetch(`/api/quotes/${params.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent', sentAt: new Date().toISOString() }),
        })
      }

      // Send via email
      if (sendViaEmail) {
        const emailRes = await fetch(`/api/quotes/${params.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailAddress,
            subject: emailSubject,
            message: emailMessage,
          }),
        })

        if (!emailRes.ok) {
          const error = await emailRes.json()
          throw new Error(error.error || 'Failed to send email')
        }
      }

      // Send via SMS
      if (sendViaSMS) {
        const smsRes = await fetch(`/api/quotes/${params.id}/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: formatPhoneNumber(phoneNumber),
            message: smsMessage,
          }),
        })

        if (!smsRes.ok) {
          const error = await smsRes.json()
          throw new Error(error.error || 'Failed to send SMS')
        }
      }

      alert(
        `Quote sent successfully via ${sendViaEmail && sendViaSMS ? 'email and SMS' : sendViaEmail ? 'email' : 'SMS'}`
      )
      setShowSendModal(false)
      fetchQuote() // Refresh to show updated status
    } catch (error) {
      console.error('Error sending quote:', error)
      alert(error instanceof Error ? error.message : 'Failed to send quote')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!quote) return

    try {
      const updateData: any = { status: newStatus }

      if (newStatus === 'sent') {
        updateData.sentAt = new Date().toISOString()
      } else if (newStatus === 'accepted') {
        updateData.acceptedAt = new Date().toISOString()
      } else if (newStatus === 'rejected') {
        const reason = prompt('Please provide a rejection reason:')
        if (!reason) return
        updateData.rejectedAt = new Date().toISOString()
        updateData.rejectionReason = reason
      }

      const res = await fetch(`/api/quotes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) throw new Error('Failed to update quote')

      fetchQuote()
    } catch (error) {
      console.error('Error updating quote:', error)
      alert('Failed to update quote status')
    }
  }

  const handleConvertToJob = async () => {
    if (!quote) return

    if (!confirm('Convert this quote to a job?')) return

    setConverting(true)

    try {
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: quote.organization_id,
          clientId: quote.client_id,
          title: quote.title,
          description: quote.description || `Created from ${quote.quote_number}`,
          jobType: 'service',
          status: 'scheduled',
          priority: 'medium',
          quotedAmount: quote.total_amount,
          quoteId: quote.id,
        }),
      })

      if (!jobRes.ok) throw new Error('Failed to create job')

      const jobData = await jobRes.json()
      const jobId = jobData.job.id

      await fetch(`/api/quotes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
          convertedToJobId: jobId,
        }),
      })

      router.push(`/dashboard/jobs/${jobId}`)
    } catch (error) {
      console.error('Error converting quote:', error)
      alert('Failed to convert quote to job')
    } finally {
      setConverting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this quote?')) return

    try {
      const res = await fetch(`/api/quotes/${params.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete quote')

      router.push('/dashboard/quotes')
    } catch (error) {
      console.error('Error deleting quote:', error)
      alert('Failed to delete quote')
    }
  }

  const handleDownloadPDF = async () => {
    if (!quote) return

    setDownloading(true)

    try {
      const res = await fetch(`/api/quotes/${params.id}/pdf`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to download PDF')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quote.quote_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert(error instanceof Error ? error.message : 'Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const handleSubmitToPropertyPal = async () => {
    if (!quote) return

    if (!confirm('Submit this quote to Property Pal for approval? The property manager will be notified.')) return

    setSubmittingToPropertyPal(true)

    try {
      const res = await fetch(`/api/quotes/${params.id}/submit-to-property-pal`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit quote to Property Pal')
      }

      alert('Quote submitted to Property Pal successfully! The property manager has been notified.')
      fetchQuote() // Refresh to show updated status
    } catch (error) {
      console.error('Error submitting to Property Pal:', error)
      alert(error instanceof Error ? error.message : 'Failed to submit quote to Property Pal')
    } finally {
      setSubmittingToPropertyPal(false)
    }
  }

  const isPropertyPalJob = quote?.external_source === 'property_pal' && quote?.external_work_order_id

  const smsCharCount = smsMessage.length
  const smsCredits = Math.ceil(smsCharCount / 160)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading quote...</p>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Quote not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard/quotes"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Back to Quotes
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{quote.quote_number}</h1>
              <p className="text-sm text-gray-500 mt-1">{quote.organization_name}</p>
            </div>
            <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusColor(quote.status)}`}>
              {quote.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Client</p>
              <p className="font-medium text-gray-900">{getClientName()}</p>
              {quote.client_email && (
                <p className="text-gray-600 text-xs">{quote.client_email}</p>
              )}
            </div>
            <div>
              <p className="text-gray-600">Created</p>
              <p className="font-medium text-gray-900">{formatDate(quote.created_at)}</p>
              <p className="text-gray-600 text-xs">by {quote.created_by_name}</p>
            </div>
            <div>
              <p className="text-gray-600">Valid Until</p>
              <p className="font-medium text-gray-900">{formatDate(quote.valid_until_date)}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Amount</p>
              <p className="font-bold text-xl text-gray-900">{formatCurrency(quote.total_amount)}</p>
            </div>
          </div>

          {quote.description && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">Description</p>
              <p className="text-sm text-gray-900 mt-1">{quote.description}</p>
            </div>
          )}

          {/* Property Pal Job Link Banner */}
          {isPropertyPalJob && (
            <div className="mt-4 pt-4 border-t">
              <div className={`border rounded-lg p-4 ${
                quote.status === 'approved' ? 'bg-green-50 border-green-200' :
                quote.status === 'declined' ? 'bg-red-50 border-red-200' :
                'bg-purple-50 border-purple-200'
              }`}>
                <div className="flex items-start gap-3">
                  <svg className={`w-5 h-5 mt-0.5 ${
                    quote.status === 'approved' ? 'text-green-600' :
                    quote.status === 'declined' ? 'text-red-600' :
                    'text-purple-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {quote.status === 'approved' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : quote.status === 'declined' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    )}
                  </svg>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${
                      quote.status === 'approved' ? 'text-green-900' :
                      quote.status === 'declined' ? 'text-red-900' :
                      'text-purple-900'
                    }`}>
                      {quote.status === 'approved' ? 'Approved by Property Pal' :
                       quote.status === 'declined' ? 'Declined by Property Pal' :
                       'Linked to Property Pal'}
                    </h3>
                    <p className={`text-sm mt-1 ${
                      quote.status === 'approved' ? 'text-green-800' :
                      quote.status === 'declined' ? 'text-red-800' :
                      'text-purple-800'
                    }`}>
                      Work Order #{quote.external_work_order_id}
                    </p>
                    {quote.status === 'approved' && quote.approval_response_at && (
                      <p className="text-xs text-green-700 mt-2">
                        Approved by {quote.approval_response_by || 'Property Manager'} on {formatDate(quote.approval_response_at)}
                      </p>
                    )}
                    {quote.status === 'declined' && (
                      <div className="mt-2">
                        <p className="text-xs text-red-700">
                          Declined on {quote.approval_response_at ? formatDate(quote.approval_response_at) : 'N/A'}
                        </p>
                        {quote.rejection_reason && (
                          <p className="text-sm text-red-800 mt-1">
                            Reason: {quote.rejection_reason}
                          </p>
                        )}
                      </div>
                    )}
                    {quote.status === 'draft' && (
                      <p className="text-xs text-purple-700 mt-2">
                        Submit this quote to Property Pal for approval by the property manager.
                      </p>
                    )}
                    {quote.status === 'sent' && (
                      <p className="text-xs text-purple-700 mt-2">
                        Quote has been submitted to Property Pal and is awaiting approval from the property manager.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h2>

          <div className="space-y-2">
            {lineItems.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No line items</p>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 pb-2 border-b">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-5">Description</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 text-sm py-2 border-b">
                    <div className="col-span-2 capitalize text-gray-600">{item.item_type}</div>
                    <div className="col-span-5 text-gray-900">{item.description}</div>
                    <div className="col-span-1 text-right text-gray-900">{parseFloat(item.quantity).toFixed(2)}</div>
                    <div className="col-span-2 text-right text-gray-900">{formatCurrency(item.unit_price)}</div>
                    <div className="col-span-2 text-right font-medium text-gray-900">{formatCurrency(item.line_total)}</div>
                  </div>
                ))}

                {/* Totals */}
                <div className="pt-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (10%):</span>
                    <span className="font-medium">{formatCurrency(quote.gst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(quote.total_amount)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Internal Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/dashboard/quotes/${params.id}/edit`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              Edit Quote
            </Link>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>

            <button
              onClick={openSendModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Send Quote
            </button>

            {/* Submit to Property Pal button - only show for Property Pal linked quotes in draft status */}
            {isPropertyPalJob && quote.status === 'draft' && (
              <button
                onClick={handleSubmitToPropertyPal}
                disabled={submittingToPropertyPal}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {submittingToPropertyPal ? 'Submitting...' : 'Submit to Property Pal'}
              </button>
            )}

            {quote.status === 'draft' && (
              <button
                onClick={() => handleStatusChange('sent')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Mark as Sent
              </button>
            )}

            {quote.status === 'sent' && (
              <>
                <button
                  onClick={() => handleStatusChange('accepted')}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  Mark as Accepted
                </button>
                <button
                  onClick={() => handleStatusChange('rejected')}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                >
                  Mark as Rejected
                </button>
              </>
            )}

            {quote.status === 'accepted' && !quote.converted_to_job_id && (
              <button
                onClick={handleConvertToJob}
                disabled={converting}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium disabled:opacity-50"
              >
                {converting ? 'Converting...' : 'Convert to Job'}
              </button>
            )}

            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium"
            >
              Delete Quote
            </button>
          </div>
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Send Quote</h2>
                <button
                  onClick={() => setShowSendModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="space-y-6">
                {/* Send Method Selection */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-gray-700">Send via:</p>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendViaEmail}
                      onChange={(e) => setSendViaEmail(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium">Email (Free)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendViaSMS}
                      onChange={(e) => setSendViaSMS(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium">
                      SMS ({smsCredits} credit{smsCredits !== 1 ? 's' : ''} - ${(smsCredits * 0.05).toFixed(2)})
                    </span>
                  </label>
                </div>

                {/* Email Fields */}
                {sendViaEmail && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Email Details</h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="client@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject *
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message *
                      </label>
                      <textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={8}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* SMS Fields */}
                {sendViaSMS && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">SMS Details</h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="+61 4XX XXX XXX"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message *
                      </label>
                      <textarea
                        value={smsMessage}
                        onChange={(e) => setSmsMessage(e.target.value)}
                        rows={4}
                        maxLength={480}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {smsCharCount} characters • {smsCredits} credit{smsCredits !== 1 ? 's' : ''} (${(smsCredits * 0.05).toFixed(2)})
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Quote'}
                  </button>
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
