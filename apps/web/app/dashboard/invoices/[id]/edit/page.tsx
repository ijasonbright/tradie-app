'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
}

interface Client {
  id: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  is_company: boolean
}

interface Job {
  id: string
  job_number: string
  title: string
  status: string
}

interface LineItem {
  id?: string
  itemType: string
  description: string
  quantity: string
  unitPrice: string
  lineTotal: number
}

export default function EditInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const [formData, setFormData] = useState({
    organizationId: '',
    clientId: '',
    jobId: '',
    issueDate: '',
    dueDate: '',
    paymentTerms: 'Net 30',
    notes: '',
    footerText: '',
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemType: 'labor', description: '', quantity: '1', unitPrice: '0', lineTotal: 0 }
  ])

  useEffect(() => {
    fetchOrganizations()
    fetchInvoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (formData.organizationId) {
      fetchClients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.organizationId])

  useEffect(() => {
    if (formData.clientId) {
      fetchJobs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.clientId])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      const data = await res.json()
      setOrganizations(data.organizations || [])
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch(`/api/clients?organizationId=${formData.organizationId}`)
      const data = await res.json()
      setClients(data.clients || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const fetchJobs = async () => {
    try {
      const res = await fetch(`/api/jobs?clientId=${formData.clientId}`)
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const fetchInvoice = async () => {
    try {
      setFetching(true)
      const res = await fetch(`/api/invoices/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch invoice')

      const data = await res.json()
      const invoice = data.invoice
      const items = data.lineItems || []

      // Set form data
      setFormData({
        organizationId: invoice.organization_id,
        clientId: invoice.client_id,
        jobId: invoice.job_id || '',
        issueDate: invoice.issue_date ? new Date(invoice.issue_date).toISOString().split('T')[0] : '',
        dueDate: invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : '',
        paymentTerms: invoice.payment_terms || 'Net 30',
        notes: invoice.notes || '',
        footerText: invoice.footer_text || '',
      })

      // Set line items
      if (items.length > 0) {
        setLineItems(items.map((item: any) => ({
          id: item.id,
          itemType: item.item_type,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          lineTotal: parseFloat(item.line_total),
        })))
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
      alert('Failed to load invoice')
    } finally {
      setFetching(false)
    }
  }

  const getClientName = (client: Client) => {
    if (client.is_company && client.company_name) {
      return client.company_name
    }
    return [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown'
  }

  const calculateLineTotal = (quantity: string, unitPrice: string) => {
    const qty = parseFloat(quantity) || 0
    const price = parseFloat(unitPrice) || 0
    const subtotal = qty * price
    const gst = subtotal * 0.1
    return subtotal + gst
  }

  const addLineItem = () => {
    setLineItems([...lineItems, { itemType: 'labor', description: '', quantity: '1', unitPrice: '0', lineTotal: 0 }])
  }

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const updateLineItem = (index: number, field: string, value: string) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }

    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].lineTotal = calculateLineTotal(
        field === 'quantity' ? value : updated[index].quantity,
        field === 'unitPrice' ? value : updated[index].unitPrice
      )
    }

    setLineItems(updated)
  }

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      return sum + (qty * price)
    }, 0)

    const gst = subtotal * 0.1
    const total = subtotal + gst

    return { subtotal, gst, total }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.organizationId || !formData.clientId || !formData.issueDate || !formData.dueDate) {
      alert('Please fill in all required fields')
      return
    }

    setLoading(true)

    try {
      const totals = calculateTotals()

      // Update invoice
      const invoiceRes = await fetch(`/api/invoices/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: formData.jobId || null,
          issueDate: formData.issueDate,
          dueDate: formData.dueDate,
          paymentTerms: formData.paymentTerms,
          notes: formData.notes,
          footerText: formData.footerText,
          subtotal: totals.subtotal.toFixed(2),
          gstAmount: totals.gst.toFixed(2),
        }),
      })

      if (!invoiceRes.ok) {
        const error = await invoiceRes.json()
        throw new Error(error.error || 'Failed to update invoice')
      }

      // Delete all existing line items
      const existingItems = lineItems.filter(item => item.id)
      for (const item of existingItems) {
        await fetch(`/api/invoices/${params.id}/line-items/${item.id}`, {
          method: 'DELETE',
        })
      }

      // Add updated line items
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i]
        if (!item.description || !item.quantity || !item.unitPrice) continue

        await fetch(`/api/invoices/${params.id}/line-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemType: item.itemType,
            description: item.description,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            sourceType: 'manual',
            lineOrder: i,
          }),
        })
      }

      // Redirect to invoice detail
      router.push(`/dashboard/invoices/${params.id}`)
    } catch (error) {
      console.error('Error updating invoice:', error)
      alert(error instanceof Error ? error.message : 'Failed to update invoice')
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading invoice...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href={`/dashboard/invoices/${params.id}`}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Back to Invoice
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Invoice</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization & Client - Read Only */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <select
                  value={formData.organizationId}
                  disabled
                  className="w-full rounded-md border-gray-300 shadow-sm bg-gray-100 cursor-not-allowed"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <select
                  value={formData.clientId}
                  disabled
                  className="w-full rounded-md border-gray-300 shadow-sm bg-gray-100 cursor-not-allowed"
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {getClientName(client)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Job (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related Job (Optional)
              </label>
              <select
                value={formData.jobId}
                onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">No related job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.job_number} - {job.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates & Payment Terms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date *
                </label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="Due on receipt">Due on receipt</option>
                  <option value="Net 7">Net 7</option>
                  <option value="Net 14">Net 14</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Line Item
                </button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-md">
                    <div className="col-span-2">
                      <select
                        value={item.itemType}
                        onChange={(e) => updateLineItem(index, 'itemType', e.target.value)}
                        className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="labor">Labor</option>
                        <option value="material">Material</option>
                        <option value="equipment">Equipment</option>
                        <option value="fee">Fee</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        placeholder="Description"
                        className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                        placeholder="Price"
                        className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 text-sm font-medium text-gray-900 pt-2">
                      ${item.lineTotal.toFixed(2)}
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                        disabled={lineItems.length === 1}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">GST (10%):</span>
                    <span className="font-medium">${totals.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>${totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Internal notes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Footer Text (shown on invoice)
                </label>
                <textarea
                  value={formData.footerText}
                  onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Thank you for your business!"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href={`/dashboard/invoices/${params.id}`}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
