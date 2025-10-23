'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Invoice {
  id: string
  invoice_number: string
  job_number: string | null
  job_title: string | null
  status: string
  subtotal: string
  gst_amount: string
  total_amount: string
  paid_amount: string
  issue_date: string
  due_date: string
  paid_date: string | null
  sent_at: string | null
  payment_terms: string | null
  payment_method: string | null
  notes: string | null
  footer_text: string | null
  created_at: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  is_company: boolean
  client_email: string
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postcode: string | null
  organization_name: string
  created_by_name: string
}

interface LineItem {
  id: string
  item_type: string
  description: string
  quantity: string
  unit_price: string
  gst_amount: string
  line_total: string
}

interface Payment {
  id: string
  payment_date: string
  amount: string
  payment_method: string
  reference_number: string | null
  notes: string | null
  recorded_by_name: string
  created_at: string
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    notes: '',
  })

  useEffect(() => {
    if (params.id) {
      fetchInvoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/invoices/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch invoice')

      const data = await res.json()
      setInvoice(data.invoice)
      setLineItems(data.lineItems || [])
      setPayments(data.payments || [])

      // Set payment amount to remaining balance
      if (data.invoice) {
        const remaining = parseFloat(data.invoice.total_amount) - parseFloat(data.invoice.paid_amount)
        setPaymentForm(prev => ({ ...prev, amount: remaining.toFixed(2) }))
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
      alert('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  const getClientName = () => {
    if (!invoice) return 'Unknown Client'
    if (invoice.is_company && invoice.company_name) {
      return invoice.company_name
    }
    return [invoice.first_name, invoice.last_name].filter(Boolean).join(' ') || 'Unknown Client'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'partially_paid':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  const getAmountOwing = () => {
    if (!invoice) return 0
    return parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount)
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return

    try {
      const res = await fetch(`/api/invoices/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) throw new Error('Failed to update invoice')

      fetchInvoice()
    } catch (error) {
      console.error('Error updating invoice:', error)
      alert('Failed to update invoice status')
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentForm.paymentDate || !paymentForm.amount || !paymentForm.paymentMethod) {
      alert('Please fill in all required payment fields')
      return
    }

    try {
      const res = await fetch(`/api/invoices/${params.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to record payment')
      }

      // Reset form
      setPaymentForm({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMethod: 'bank_transfer',
        referenceNumber: '',
        notes: '',
      })
      setShowPaymentForm(false)

      // Refresh invoice data
      fetchInvoice()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert(error instanceof Error ? error.message : 'Failed to record payment')
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/invoices/${params.id}/pdf`)
      if (!res.ok) throw new Error('Failed to generate PDF')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice?.invoice_number || 'invoice'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to download PDF')
    }
  }

  const handleSendInvoice = async () => {
    if (!invoice) return
    if (!confirm(`Send invoice to ${invoice.client_email}?`)) return

    try {
      const res = await fetch(`/api/invoices/${params.id}/send`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        console.error('Send invoice error response:', error)
        // Show details field if available for better debugging
        const errorMessage = error.details || error.error || 'Failed to send invoice'
        throw new Error(errorMessage)
      }

      alert('Invoice sent successfully!')
      fetchInvoice() // Refresh to show updated sent_at timestamp
    } catch (error) {
      console.error('Error sending invoice:', error)
      alert(error instanceof Error ? error.message : 'Failed to send invoice')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice?')) return

    try {
      const res = await fetch(`/api/invoices/${params.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete invoice')

      router.push('/dashboard/invoices')
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert('Failed to delete invoice')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading invoice...</p>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Invoice not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard/invoices"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Back to Invoices
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
              <p className="text-sm text-gray-500 mt-1">{invoice.organization_name}</p>
            </div>
            <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
              {invoice.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Bill To</p>
              <p className="font-medium text-gray-900">{getClientName()}</p>
              {invoice.client_email && (
                <p className="text-gray-600 text-xs">{invoice.client_email}</p>
              )}
              {invoice.billing_address_line1 && (
                <p className="text-gray-600 text-xs mt-1">
                  {invoice.billing_address_line1}
                  {invoice.billing_address_line2 && <>, {invoice.billing_address_line2}</>}
                  <br />
                  {invoice.billing_city && <>{invoice.billing_city}, </>}
                  {invoice.billing_state} {invoice.billing_postcode}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-gray-600">Issue Date</p>
                <p className="font-medium text-gray-900">{formatDate(invoice.issue_date)}</p>
              </div>
              <div>
                <p className="text-gray-600">Due Date</p>
                <p className="font-medium text-gray-900">{formatDate(invoice.due_date)}</p>
              </div>
              {invoice.job_number && (
                <div>
                  <p className="text-gray-600">Related Job</p>
                  <p className="font-medium text-gray-900">{invoice.job_number}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.total_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Paid Amount</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(invoice.paid_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Amount Owing</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(getAmountOwing())}</p>
            </div>
          </div>
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
                    <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (10%):</span>
                    <span className="font-medium">{formatCurrency(invoice.gst_amount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
            {getAmountOwing() > 0 && (
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showPaymentForm ? 'Cancel' : '+ Record Payment'}
              </button>
            )}
          </div>

          {showPaymentForm && (
            <form onSubmit={handleAddPayment} className="mb-6 p-4 bg-blue-50 rounded-md space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., Transaction ID"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Payment notes..."
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Record Payment
              </button>
            </form>
          )}

          {payments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No payments recorded</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                      <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                        {payment.payment_method.replace('_', ' ')}
                      </span>
                      {payment.reference_number && (
                        <span className="text-xs text-gray-500">Ref: {payment.reference_number}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatDate(payment.payment_date)} • Recorded by {payment.recorded_by_name}
                    </p>
                    {payment.notes && (
                      <p className="text-xs text-gray-600 mt-1">{payment.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
            >
              Download PDF
            </button>

            <button
              onClick={handleSendInvoice}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Send Invoice
            </button>

            {invoice.status === 'draft' && (
              <button
                onClick={() => handleStatusChange('sent')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Mark as Sent
              </button>
            )}

            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium"
            >
              Delete Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
