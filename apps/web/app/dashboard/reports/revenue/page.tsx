'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RevenueData {
  summary: {
    total_invoices: number
    total_revenue: string
    total_paid: string
    total_outstanding: string
    average_invoice_value: string
    paid_invoices: number
    overdue_invoices: number
  }
  revenueByPeriod: Array<{
    period_label: string
    invoice_count: number
    total_revenue: string
    paid_amount: string
    outstanding_amount: string
  }>
  revenueByClient: Array<{
    client_id: string
    client_name: string
    invoice_count: number
    total_revenue: string
    paid_amount: string
    outstanding_amount: string
  }>
  revenueByJobType: Array<{
    job_type: string
    invoice_count: number
    total_revenue: string
    paid_amount: string
  }>
}

export default function RevenueReportPage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [groupBy, setGroupBy] = useState('month')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate, groupBy])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('groupBy', groupBy)

      const res = await fetch(`/api/reports/revenue?${params}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching revenue report:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = async () => {
    try {
      setExporting(true)
      const res = await fetch('/api/reports/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'revenue',
          startDate,
          endDate,
          groupBy,
        }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `revenue-report-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(parseFloat(amount || '0'))
  }

  if (loading && !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">📊</div>
          <p className="mt-2 text-gray-600">Loading revenue report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard/reports" className="text-sm text-blue-600 hover:underline">
            ← Back to Reports
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Revenue Report</h1>
        </div>
        <button
          onClick={exportToCSV}
          disabled={exporting}
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
        >
          {exporting ? 'Exporting...' : '📥 Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setGroupBy('month')
              }}
              className="w-full rounded border px-3 py-2 hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data.summary.total_revenue)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {data.summary.total_invoices} invoices
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Paid</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.summary.total_paid)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {data.summary.paid_invoices} paid
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(data.summary.total_outstanding)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {data.summary.overdue_invoices} overdue
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Avg Invoice</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.summary.average_invoice_value)}
              </p>
            </div>
          </div>

          {/* Revenue by Period */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Revenue by {groupBy === 'month' ? 'Month' : 'Week'}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm">
                    <th className="pb-2">Period</th>
                    <th className="pb-2 text-right">Invoices</th>
                    <th className="pb-2 text-right">Total Revenue</th>
                    <th className="pb-2 text-right">Paid</th>
                    <th className="pb-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenueByPeriod.map((period, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-3 font-medium">{period.period_label}</td>
                      <td className="py-3 text-right">{period.invoice_count}</td>
                      <td className="py-3 text-right font-semibold">
                        {formatCurrency(period.total_revenue)}
                      </td>
                      <td className="py-3 text-right text-green-600">
                        {formatCurrency(period.paid_amount)}
                      </td>
                      <td className="py-3 text-right text-orange-600">
                        {formatCurrency(period.outstanding_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue by Client */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Top Clients by Revenue</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm">
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Invoices</th>
                    <th className="pb-2 text-right">Total Revenue</th>
                    <th className="pb-2 text-right">Paid</th>
                    <th className="pb-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenueByClient.map((client) => (
                    <tr key={client.client_id} className="border-b">
                      <td className="py-3 font-medium">{client.client_name}</td>
                      <td className="py-3 text-right">{client.invoice_count}</td>
                      <td className="py-3 text-right font-semibold">
                        {formatCurrency(client.total_revenue)}
                      </td>
                      <td className="py-3 text-right text-green-600">
                        {formatCurrency(client.paid_amount)}
                      </td>
                      <td className="py-3 text-right text-orange-600">
                        {formatCurrency(client.outstanding_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue by Job Type */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Revenue by Job Type</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm">
                    <th className="pb-2">Job Type</th>
                    <th className="pb-2 text-right">Invoices</th>
                    <th className="pb-2 text-right">Total Revenue</th>
                    <th className="pb-2 text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenueByJobType.map((jobType, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-3 font-medium capitalize">
                        {jobType.job_type || 'No Job'}
                      </td>
                      <td className="py-3 text-right">{jobType.invoice_count}</td>
                      <td className="py-3 text-right font-semibold">
                        {formatCurrency(jobType.total_revenue)}
                      </td>
                      <td className="py-3 text-right text-green-600">
                        {formatCurrency(jobType.paid_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
