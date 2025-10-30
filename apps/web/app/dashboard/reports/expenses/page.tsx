'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ExpenseReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [groupBy, setGroupBy] = useState('category')

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

      const res = await fetch(`/api/reports/expenses?${params}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching expense report:', error)
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
          <div className="text-4xl">💳</div>
          <p className="mt-2 text-gray-600">Loading expense report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <Link href="/dashboard/reports" className="text-sm text-blue-600 hover:underline">
          ← Back to Reports
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Expense Report</h1>
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
              <option value="category">Category</option>
              <option value="user">Team Member</option>
              <option value="month">Month</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setGroupBy('category')
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
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold">{formatCurrency(data.summary.total_amount_inc_gst)}</p>
              <p className="mt-1 text-xs text-gray-500">{data.summary.total_expenses} expenses</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data.summary.approved_amount)}
              </p>
              <p className="mt-1 text-xs text-gray-500">{data.summary.approved_count} approved</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(data.summary.pending_amount)}
              </p>
              <p className="mt-1 text-xs text-gray-500">{data.summary.pending_count} pending</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">To Reimburse</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(data.summary.pending_reimbursement)}
              </p>
            </div>
          </div>

          {/* Expenses by Category */}
          {groupBy === 'category' && data.expensesByCategory && (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Expenses by Category</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm">
                      <th className="pb-2">Category</th>
                      <th className="pb-2 text-right">Count</th>
                      <th className="pb-2 text-right">Total Amount</th>
                      <th className="pb-2 text-right">Approved</th>
                      <th className="pb-2 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expensesByCategory.map((cat: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="py-3 font-medium capitalize">{cat.category}</td>
                        <td className="py-3 text-right">{cat.expense_count}</td>
                        <td className="py-3 text-right font-semibold">
                          {formatCurrency(cat.total_with_gst)}
                        </td>
                        <td className="py-3 text-right text-green-600">
                          {formatCurrency(cat.approved_amount)}
                        </td>
                        <td className="py-3 text-right text-yellow-600">
                          {formatCurrency(cat.pending_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expenses by User */}
          {groupBy === 'user' && data.expensesByUser && (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Expenses by Team Member</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm">
                      <th className="pb-2">Team Member</th>
                      <th className="pb-2 text-right">Count</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-right">Approved</th>
                      <th className="pb-2 text-right">To Reimburse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expensesByUser.map((user: any) => (
                      <tr key={user.user_id} className="border-b">
                        <td className="py-3 font-medium">{user.full_name}</td>
                        <td className="py-3 text-right">{user.expense_count}</td>
                        <td className="py-3 text-right font-semibold">
                          {formatCurrency(user.total_amount)}
                        </td>
                        <td className="py-3 text-right text-green-600">
                          {formatCurrency(user.approved_amount)}
                        </td>
                        <td className="py-3 text-right text-orange-600">
                          {formatCurrency(user.pending_reimbursement)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reimbursement Summary */}
          {data.reimbursementSummary && data.reimbursementSummary.length > 0 && (
            <div className="rounded-lg bg-orange-50 p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-orange-900">
                💰 Pending Reimbursements
              </h2>
              <div className="space-y-2">
                {data.reimbursementSummary.map((item: any) => (
                  <div
                    key={item.user_id}
                    className="flex items-center justify-between rounded bg-white p-3"
                  >
                    <span className="font-medium">{item.full_name}</span>
                    <div className="text-right">
                      <div className="font-semibold text-orange-600">
                        {formatCurrency(item.amount_owed)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.expenses_pending_reimbursement} expenses
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
