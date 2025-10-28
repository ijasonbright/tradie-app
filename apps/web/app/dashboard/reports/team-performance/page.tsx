'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TeamPerformanceData {
  summary: {
    total_team_members: number
    total_jobs_completed: number
    total_jobs_in_progress: number
    total_hours_logged: string
    total_revenue_generated: string
    total_labor_cost: string
    avg_jobs_per_member: string
  }
  teamPerformance: Array<{
    user_id: string
    full_name: string
    email: string
    role: string
    cost_rate: string
    jobs_completed: number
    jobs_in_progress: number
    total_jobs_assigned: number
    total_hours: string
    approved_hours: string
    total_labor_cost: string
    total_billing_amount: string
    avg_completion_days: string
    profit_margin: string
    utilization_rate: string
    avg_revenue_per_job: string
  }>
  topPerformersByRevenue: Array<any>
  topPerformersByJobs: Array<any>
  jobsByStatus: Array<{
    status: string
    count: number
    total_quoted_amount: string
  }>
  jobsByType: Array<{
    job_type: string
    count: number
    avg_completion_days: string
    total_quoted_amount: string
  }>
}

export default function TeamPerformanceReportPage() {
  const [data, setData] = useState<TeamPerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/reports/team-performance?${params}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching team performance report:', error)
    } finally {
      setLoading(false)
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
          <div className="text-4xl">👥</div>
          <p className="mt-2 text-gray-600">Loading team performance report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/reports" className="text-sm text-blue-600 hover:underline">
          ← Back to Reports
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Team Performance Report</h1>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <div className="grid gap-4 md:grid-cols-3">
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
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
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
              <p className="text-sm text-gray-600">Team Members</p>
              <p className="text-2xl font-bold">{data.summary.total_team_members}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Jobs Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {data.summary.total_jobs_completed}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {data.summary.total_jobs_in_progress} in progress
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.summary.total_revenue_generated)}
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Avg Jobs/Member</p>
              <p className="text-2xl font-bold">{data.summary.avg_jobs_per_member}</p>
            </div>
          </div>

          {/* Top Performers */}
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            {/* Top by Revenue */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold">🏆 Top Performers by Revenue</h2>
              <div className="space-y-3">
                {data.topPerformersByRevenue.map((member, idx) => (
                  <div key={member.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'}</span>
                      <div>
                        <div className="font-medium">{member.full_name}</div>
                        <div className="text-xs text-gray-500 capitalize">{member.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-blue-600">
                        {formatCurrency(member.total_billing_amount)}
                      </div>
                      <div className="text-xs text-gray-500">{member.jobs_completed} jobs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top by Jobs */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold">🎯 Top Performers by Jobs Completed</h2>
              <div className="space-y-3">
                {data.topPerformersByJobs.map((member, idx) => (
                  <div key={member.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'}</span>
                      <div>
                        <div className="font-medium">{member.full_name}</div>
                        <div className="text-xs text-gray-500 capitalize">{member.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold text-green-600">
                        {member.jobs_completed}
                      </div>
                      <div className="text-xs text-gray-500">jobs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team Performance Table */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Team Member Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2">Team Member</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2 text-right">Jobs</th>
                    <th className="pb-2 text-right">Hours</th>
                    <th className="pb-2 text-right">Revenue</th>
                    <th className="pb-2 text-right">Profit %</th>
                    <th className="pb-2 text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teamPerformance.map((member) => (
                    <tr key={member.user_id} className="border-b">
                      <td className="py-3">
                        <div className="font-medium">{member.full_name}</div>
                        <div className="text-xs text-gray-500">{member.email}</div>
                      </td>
                      <td className="py-3 capitalize text-gray-600">{member.role}</td>
                      <td className="py-3 text-right">
                        <div className="font-semibold text-green-600">
                          {member.jobs_completed}
                        </div>
                        <div className="text-xs text-gray-500">
                          {member.jobs_in_progress} in progress
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div>{parseFloat(member.total_hours).toFixed(1)}h</div>
                        <div className="text-xs text-gray-500">
                          {parseFloat(member.approved_hours).toFixed(1)}h approved
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold text-blue-600">
                        {formatCurrency(member.total_billing_amount)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`rounded px-2 py-1 ${
                            parseFloat(member.profit_margin) > 30
                              ? 'bg-green-100 text-green-800'
                              : parseFloat(member.profit_margin) > 15
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {member.profit_margin}%
                        </span>
                      </td>
                      <td className="py-3 text-right">{member.utilization_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Jobs Overview */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Jobs by Status */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold">Jobs by Status</h2>
              <div className="space-y-2">
                {data.jobsByStatus.map((status) => (
                  <div
                    key={status.status}
                    className="flex items-center justify-between rounded bg-gray-50 p-3"
                  >
                    <span className="font-medium capitalize">{status.status}</span>
                    <div className="text-right">
                      <div className="font-semibold">{status.count}</div>
                      {status.total_quoted_amount && (
                        <div className="text-xs text-gray-500">
                          {formatCurrency(status.total_quoted_amount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Jobs by Type */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold">Jobs by Type</h2>
              <div className="space-y-2">
                {data.jobsByType.map((type) => (
                  <div
                    key={type.job_type}
                    className="flex items-center justify-between rounded bg-gray-50 p-3"
                  >
                    <div>
                      <div className="font-medium capitalize">{type.job_type || 'Other'}</div>
                      {type.avg_completion_days && (
                        <div className="text-xs text-gray-500">
                          Avg: {parseFloat(type.avg_completion_days).toFixed(1)} days
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{type.count}</div>
                      {type.total_quoted_amount && (
                        <div className="text-xs text-gray-500">
                          {formatCurrency(type.total_quoted_amount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
