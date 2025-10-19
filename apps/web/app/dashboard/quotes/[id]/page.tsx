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
  organization_name: string
  created_by_name: string
  converted_to_job_id: string | null
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
        return 'bg-green-100 text-green-800'
      case 'rejected':
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
      // Create job from quote
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: quote.organization_id,
          clientId: quote.client_id,
          title: quote.title,
          description: quote.description || `Created from ${quote.quote_number}`,
          status: 'scheduled',
          quoted_amount: quote.total_amount,
        }),
      })

      if (!jobRes.ok) throw new Error('Failed to create job')

      const jobData = await jobRes.json()
      const jobId = jobData.job.id

      // Update quote to mark as converted
      await fetch(`/api/quotes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
          convertedToJobId: jobId,
        }),
      })

      // Redirect to job
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
    </div>
  )
}
