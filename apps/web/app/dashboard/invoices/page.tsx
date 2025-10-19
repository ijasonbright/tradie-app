'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  job_number: string | null
  job_title: string | null
  status: string
  total_amount: string
  paid_amount: string
  issue_date: string
  due_date: string
  created_at: string
  organization_name: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  is_company: boolean
  created_by_name: string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const url = statusFilter === 'all' ? '/api/invoices' : `/api/invoices?status=${statusFilter}`
      const res = await fetch(url)
      const data = await res.json()
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const getClientName = (invoice: Invoice) => {
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

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`
  }

  const getAmountOwing = (invoice: Invoice) => {
    const total = parseFloat(invoice.total_amount)
    const paid = parseFloat(invoice.paid_amount)
    return total - paid
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage your invoices and payments
              </p>
            </div>
            <Link
              href="/dashboard/invoices/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              + New Invoice
            </Link>
          </div>

          {/* Navigation */}
          <nav className="mt-6 flex gap-4 border-b border-gray-200">
            <Link
              href="/dashboard"
              className="pb-3 px-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/clients"
              className="pb-3 px-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Clients
            </Link>
            <Link
              href="/dashboard/jobs"
              className="pb-3 px-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Jobs
            </Link>
            <Link
              href="/dashboard/quotes"
              className="pb-3 px-1 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Quotes
            </Link>
            <Link
              href="/dashboard/invoices"
              className="pb-3 px-1 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
            >
              Invoices
            </Link>
          </nav>
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex gap-2">
          {['all', 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              {status === 'partially_paid' ? 'Partial' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Invoices List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No invoices found</p>
            <Link
              href="/dashboard/invoices/new"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first invoice
            </Link>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getClientName(invoice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.job_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {formatCurrency(invoice.paid_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(getAmountOwing(invoice).toString())}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.due_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
