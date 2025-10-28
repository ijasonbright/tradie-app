'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TimeTrackingData {
  summary: {
    total_logs: number
    total_hours: string
    approved_hours: string
    pending_hours: string
    rejected_hours: string
    total_labor_cost: string
    total_billing_amount: string
    avg_hours_per_log: string
    avg_cost_rate: string
    unique_team_members: number
    unique_jobs: number
    utilization_rate: string
    profit_margin: string
  }
  hoursByUser: Array<{
    user_id: string
    full_name: string
    role: string
    log_count: number
    total_hours: string
    approved_hours: string
    pending_hours: string
    total_labor_cost: string
    total_billing_amount: string
    avg_cost_rate: string
  }>
  hoursByJob: Array<{
    job_id: string
    job_number: string
    job_title: string
    job_status: string
    job_type: string
    client_name: string
    log_count: number
    total_hours: string
    approved_hours: string
    total_labor_cost: string
    total_billing_amount: string
    quoted_amount: string
    hours_vs_quote_percentage: string
  }>
  hoursByPeriod: Array<{
    period_label: string
    log_count: number
    total_hours: string
    approved_hours: string
    total_labor_cost: string
    total_billing_amount: string
  }>
}

export default function TimeTrackingReportPage() {
  const [data, setData] = useState<TimeTrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [groupBy, setGroupBy] = useState('user')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, groupBy])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('groupBy', groupBy)

      const res = await fetch(`/api/reports/time-tracking?${params}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching time tracking report:', error)
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
          reportType: 'time-tracking',
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
        a.download = `time-tracking-report-${new Date().toISOString().split('T')[0]}.csv`
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

  const formatHours = (hours: string) => {
    const h = parseFloat(hours || '0')
    return `${h.toFixed(1)}h`
  }

  if (loading && !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">⏱️</div>
          <p className="mt-2 text-gray-600">Loading time tracking report...</p>
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
          <h1 className="mt-2 text-3xl font-bold">Time Tracking Report</h1>
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
              <option value="user">Team Member</option>
              <option value="job">Job</option>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setGroupBy('user')
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
          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold">{formatHours(data.summary.total_hours)}</p>
              <p className="mt-1 text-xs text-gray-500">{data.summary.total_logs} logs</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Approved Hours</p>
              <p className="text-2xl font-bold text-green-600">
                {formatHours(data.summary.approved_hours)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {data.summary.utilization_rate}% utilization
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Labor Cost</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(data.summary.total_labor_cost)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Avg {formatCurrency(data.summary.avg_cost_rate)}/hr
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Billing Amount</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.summary.total_billing_amount)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {data.summary.profit_margin}% margin
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Team Members</p>
              <p className="text-2xl font-bold">{data.summary.unique_team_members}</p>
              <p className="mt-1 text-xs text-gray-500">
                {data.summary.unique_jobs} jobs
              </p>
            </div>
          </div>

          {/* Hours by Team Member */}
          {groupBy === 'user' && (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Hours by Team Member</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm">
                      <th className="pb-2">Team Member</th>
                      <th className="pb-2">Role</th>
                      <th className="pb-2 text-right">Logs</th>
                      <th className="pb-2 text-right">Total Hours</th>
                      <th className="pb-2 text-right">Approved</th>
                      <th className="pb-2 text-right">Labor Cost</th>
                      <th className="pb-2 text-right">Billing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hoursByUser.map((user) => (
                      <tr key={user.user_id} className="border-b">
                        <td className="py-3 font-medium">{user.full_name}</td>
                        <td className="py-3 capitalize text-gray-600">{user.role}</td>
                        <td className="py-3 text-right">{user.log_count}</td>
                        <td className="py-3 text-right font-semibold">
                          {formatHours(user.total_hours)}
                        </td>
                        <td className="py-3 text-right text-green-600">
                          {formatHours(user.approved_hours)}
                        </td>
                        <td className="py-3 text-right text-orange-600">
                          {formatCurrency(user.total_labor_cost)}
                        </td>
                        <td className="py-3 text-right text-blue-600">
                          {formatCurrency(user.total_billing_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hours by Job */}
          {groupBy === 'job' && (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Hours by Job</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2">Job</th>
                      <th className="pb-2">Client</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Hours</th>
                      <th className="pb-2 text-right">Labor Cost</th>
                      <th className="pb-2 text-right">Billing</th>
                      <th className="pb-2 text-right">Quote</th>
                      <th className="pb-2 text-right">vs Quote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hoursByJob.map((job) => (
                      <tr key={job.job_id} className="border-b">
                        <td className="py-3">
                          <div className="font-medium">{job.job_number}</div>
                          <div className="text-xs text-gray-500">{job.job_title}</div>
                        </td>
                        <td className="py-3 text-gray-600">{job.client_name}</td>
                        <td className="py-3">
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs capitalize">
                            {job.job_status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold">
                          {formatHours(job.total_hours)}
                        </td>
                        <td className="py-3 text-right text-orange-600">
                          {formatCurrency(job.total_labor_cost)}
                        </td>
                        <td className="py-3 text-right text-blue-600">
                          {formatCurrency(job.total_billing_amount)}
                        </td>
                        <td className="py-3 text-right">
                          {job.quoted_amount ? formatCurrency(job.quoted_amount) : '-'}
                        </td>
                        <td className="py-3 text-right">
                          {job.hours_vs_quote_percentage ? (
                            <span
                              className={
                                parseFloat(job.hours_vs_quote_percentage) > 100
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }
                            >
                              {job.hours_vs_quote_percentage}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hours by Period */}
          {(groupBy === 'day' || groupBy === 'week' || groupBy === 'month') && (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">
                Hours by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm">
                      <th className="pb-2">Period</th>
                      <th className="pb-2 text-right">Logs</th>
                      <th className="pb-2 text-right">Total Hours</th>
                      <th className="pb-2 text-right">Approved</th>
                      <th className="pb-2 text-right">Labor Cost</th>
                      <th className="pb-2 text-right">Billing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hoursByPeriod.map((period, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-3 font-medium">{period.period_label}</td>
                        <td className="py-3 text-right">{period.log_count}</td>
                        <td className="py-3 text-right font-semibold">
                          {formatHours(period.total_hours)}
                        </td>
                        <td className="py-3 text-right text-green-600">
                          {formatHours(period.approved_hours)}
                        </td>
                        <td className="py-3 text-right text-orange-600">
                          {formatCurrency(period.total_labor_cost)}
                        </td>
                        <td className="py-3 text-right text-blue-600">
                          {formatCurrency(period.total_billing_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
