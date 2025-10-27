'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    organizationId: '',
    clientId: '',
    jobId: '',
    issueDate: new Date().toISOString().split('T')[0],
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

    // Check for URL parameters to pre-fill from job
    const jobId = searchParams.get('jobId')
    const clientId = searchParams.get('clientId')

    if (jobId && clientId) {
      // Fetch job and quote data to pre-fill invoice
      fetchJobAndQuoteData(jobId, clientId)
    }
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

  // Auto-calculate due date when issue date or payment terms change
  useEffect(() => {
    if (formData.issueDate && formData.paymentTerms) {
      const issueDate = new Date(formData.issueDate)
      const daysMatch = formData.paymentTerms.match(/\d+/)
      const days = daysMatch ? parseInt(daysMatch[0]) : 30
      const dueDate = new Date(issueDate)
      dueDate.setDate(dueDate.getDate() + days)
      setFormData(prev => ({ ...prev, dueDate: dueDate.toISOString().split('T')[0] }))
    }
  }, [formData.issueDate, formData.paymentTerms])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      const data = await res.json()
      setOrganizations(data.organizations || [])

      if (data.organizations && data.organizations.length > 0) {
        setFormData(prev => ({ ...prev, organizationId: data.organizations[0].id }))
      }
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

  const fetchJobAndQuoteData = async (jobId: string, clientId: string) => {
    try {
      console.log('Fetching job and quote data for jobId:', jobId, 'clientId:', clientId)

      // Fetch job details which includes the quote
      const jobRes = await fetch(`/api/jobs/${jobId}`)
      if (!jobRes.ok) {
        console.error('Failed to fetch job:', jobRes.status, jobRes.statusText)
        return
      }

      const jobData = await jobRes.json()
      const job = jobData.job
      const quote = jobData.quote

      console.log('Job data:', job)
      console.log('Quote data:', quote)
      console.log('Job pricing type:', job.pricing_type)

      // Pre-fill form with job/client data
      setFormData(prev => ({
        ...prev,
        clientId: clientId,
        jobId: jobId,
        organizationId: job.organization_id || prev.organizationId,
        notes: quote ? `Invoice for ${quote.quote_number} - ${quote.title}` : `Invoice for ${job.title}`,
      }))

      // Check pricing type to determine how to populate invoice
      if (job.pricing_type === 'fixed_price') {
        // Fixed Price: Use quoted amount (single line item)
        console.log('Fixed price job - using quoted amount:', job.quoted_amount)

        const quotedAmount = parseFloat(job.quoted_amount || '0')
        if (quotedAmount > 0) {
          // Create a single line item for the fixed price
          const fixedPriceLineItem: LineItem = {
            itemType: 'other',
            description: job.title || 'Job completion',
            quantity: '1',
            unitPrice: (quotedAmount / 1.1).toFixed(2), // Remove GST for unit price (will be added back)
            lineTotal: quotedAmount,
          }
          setLineItems([fixedPriceLineItem])
          console.log('Fixed price line item created:', fixedPriceLineItem)
        } else if (quote) {
          // Fallback: if no quoted amount but quote exists, use quote line items
          console.log('No quoted amount, fetching quote line items')
          await fetchQuoteLineItems(quote.id)
        }
      } else {
        // Time & Materials: Pull actual time logs and materials
        console.log('Time & materials job - fetching time logs and materials')

        const invoiceLineItems: LineItem[] = []

        // Fetch time logs
        const timeLogsRes = await fetch(`/api/jobs/${jobId}/time-logs`)
        if (timeLogsRes.ok) {
          const timeLogsData = await timeLogsRes.json()
          const timeLogs = timeLogsData.timeLogs || []
          console.log('Time logs:', timeLogs)

          // Group time logs by user and create line items
          const userTimeMap = new Map<string, { hours: number; rate: number; name: string }>()

          timeLogs.forEach((log: any) => {
            if (log.status === 'approved') {
              const userId = log.user_id
              const hours = parseFloat(log.total_hours || '0')
              // Try billing_amount first, fallback to hourly_rate (which is cost rate)
              const billingAmount = parseFloat(log.billing_amount || '0')
              const billingRate = billingAmount > 0 ? billingAmount / hours : parseFloat(log.hourly_rate || '0')
              const userName = log.user_name || 'Team Member'

              if (!userTimeMap.has(userId)) {
                userTimeMap.set(userId, { hours: 0, rate: billingRate, name: userName })
              }
              const existing = userTimeMap.get(userId)!
              existing.hours += hours
            }
          })

          // Create line items for each user's time
          userTimeMap.forEach((data, userId) => {
            if (data.hours > 0) {
              const lineTotal = data.hours * data.rate
              invoiceLineItems.push({
                itemType: 'labor',
                description: `Labor - ${data.name} (${data.hours.toFixed(2)} hours @ $${data.rate.toFixed(2)}/hr)`,
                quantity: data.hours.toFixed(2),
                unitPrice: data.rate.toFixed(2),
                lineTotal: lineTotal * 1.1, // Add GST
              })
            }
          })
        }

        // Fetch materials
        const materialsRes = await fetch(`/api/jobs/${jobId}/materials`)
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json()
          const materials = materialsData.materials || []
          console.log('Materials:', materials)

          materials.forEach((material: any) => {
            if (material.status === 'approved') {
              const qty = parseFloat(material.quantity || '0')
              const unitPrice = parseFloat(material.unit_price || '0')
              const totalCost = parseFloat(material.total_cost || '0')

              invoiceLineItems.push({
                itemType: 'material',
                description: material.description || 'Material',
                quantity: qty.toString(),
                unitPrice: unitPrice.toString(),
                lineTotal: totalCost,
              })
            }
          })
        }

        if (invoiceLineItems.length > 0) {
          setLineItems(invoiceLineItems)
          console.log('Time & materials line items created:', invoiceLineItems)
        } else {
          console.log('No approved time logs or materials found')
          // Fallback to quote line items if available
          if (quote) {
            await fetchQuoteLineItems(quote.id)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching job/quote data:', error)
    }
  }

  const fetchQuoteLineItems = async (quoteId: string) => {
    try {
      console.log('Fetching line items for quote:', quoteId)
      const quoteLineItemsRes = await fetch(`/api/quotes/${quoteId}/line-items`)
      console.log('Line items response status:', quoteLineItemsRes.status)

      if (quoteLineItemsRes.ok) {
        const quoteLineItemsData = await quoteLineItemsRes.json()
        const quoteLineItems = quoteLineItemsData.lineItems || []

        console.log('Quote line items:', quoteLineItems)
        console.log('Number of line items:', quoteLineItems.length)

        if (quoteLineItems.length > 0) {
          // Convert quote line items to invoice line items
          const invoiceLineItems: LineItem[] = quoteLineItems.map((item: any) => ({
            itemType: item.item_type,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unit_price.toString(),
            lineTotal: parseFloat(item.line_total),
          }))
          console.log('Converted invoice line items:', invoiceLineItems)
          setLineItems(invoiceLineItems)
          console.log('Line items set successfully')
        } else {
          console.log('No line items found in quote')
        }
      } else {
        const errorText = await quoteLineItemsRes.text()
        console.error('Failed to fetch line items:', errorText)
      }
    } catch (error) {
      console.error('Error fetching quote line items:', error)
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

      // Create invoice
      const invoiceRes = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          jobId: formData.jobId || null,
          subtotal: totals.subtotal.toFixed(2),
          gstAmount: totals.gst.toFixed(2),
          status: 'draft',
        }),
      })

      if (!invoiceRes.ok) {
        const error = await invoiceRes.json()
        throw new Error(error.error || 'Failed to create invoice')
      }

      const invoiceData = await invoiceRes.json()
      const invoiceId = invoiceData.invoice.id

      // Add line items
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i]
        if (!item.description || !item.quantity || !item.unitPrice) continue

        await fetch(`/api/invoices/${invoiceId}/line-items`, {
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
      router.push(`/dashboard/invoices/${invoiceId}`)
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert(error instanceof Error ? error.message : 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Invoice</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization & Client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization *
                </label>
                <select
                  value={formData.organizationId}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value, clientId: '', jobId: '' })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, jobId: '' })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  disabled={!formData.organizationId}
                >
                  <option value="">Select client</option>
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
                disabled={!formData.clientId}
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
                {loading ? 'Creating...' : 'Create Invoice'}
              </button>
              <Link
                href="/dashboard/invoices"
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
