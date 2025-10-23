'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Expense {
  id: string
  category: string
  description: string
  amount: string
  gst_amount: string
  total_amount: string
  expense_date: string
  status: string
  user_name: string
  approved_by_name: string | null
  job_number: string | null
  job_title: string | null
  receipt_url: string | null
  rejection_reason: string | null
  created_at: string
}

interface Organization {
  id: string
  name: string
}

interface Job {
  id: string
  job_number: string
  title: string
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showMyExpenses, setShowMyExpenses] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    organizationId: '',
    category: 'materials',
    description: '',
    amount: '',
    gstAmount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    jobId: '',
  })

  useEffect(() => {
    fetchOrganizations()
    fetchJobs()
    fetchExpenses()
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [statusFilter, showMyExpenses])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      const data = await res.json()
      setOrganizations(data.organizations || [])
      if (data.organizations?.length > 0) {
        setFormData(prev => ({ ...prev, organizationId: data.organizations[0].id }))
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      let url = '/api/expenses?'
      if (statusFilter !== 'all') {
        url += `status=${statusFilter}&`
      }
      if (showMyExpenses) {
        url += 'myExpenses=true'
      }

      const res = await fetch(url)
      const data = await res.json()
      setExpenses(data.expenses || [])
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          gstAmount: formData.gstAmount ? parseFloat(formData.gstAmount) : 0,
        }),
      })

      if (res.ok) {
        setShowAddForm(false)
        fetchExpenses()
        // Reset form
        setFormData({
          organizationId: formData.organizationId,
          category: 'materials',
          description: '',
          amount: '',
          gstAmount: '',
          expenseDate: new Date().toISOString().split('T')[0],
          jobId: '',
        })
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating expense:', error)
      alert('Failed to create expense')
    }
  }

  const handleApprove = async (expenseId: string) => {
    if (!confirm('Approve this expense?')) return

    try {
      const res = await fetch(`/api/expenses/${expenseId}/approve`, {
        method: 'POST',
      })

      if (res.ok) {
        fetchExpenses()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error approving expense:', error)
      alert('Failed to approve expense')
    }
  }

  const handleReject = async (expenseId: string) => {
    const reason = prompt('Reason for rejection:')
    if (!reason) return

    try {
      const res = await fetch(`/api/expenses/${expenseId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (res.ok) {
        fetchExpenses()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error rejecting expense:', error)
      alert('Failed to reject expense')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      reimbursed: 'bg-blue-100 text-blue-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      fuel: '⛽',
      materials: '🔨',
      tools: '🔧',
      vehicle: '🚗',
      subcontractor: '👷',
      meals: '🍽️',
      other: '📋',
    }
    return icons[category] || '📋'
  }

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const pendingExpenses = expenses.filter(e => e.status === 'pending')
  const totalPending = pendingExpenses.reduce((sum, e) => sum + parseFloat(e.total_amount), 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading expenses...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Expenses</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + Submit Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Pending Approval</p>
          <p className="text-2xl font-bold">{pendingExpenses.length}</p>
          <p className="text-sm text-gray-500">{formatCurrency(totalPending.toString())}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold">{expenses.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">This Month</p>
          <p className="text-2xl font-bold">
            {expenses.filter(e => {
              const expenseMonth = new Date(e.expense_date).getMonth()
              const currentMonth = new Date().getMonth()
              return expenseMonth === currentMonth
            }).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded px-3 py-1 ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`rounded px-3 py-1 ${statusFilter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`rounded px-3 py-1 ${statusFilter === 'approved' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`rounded px-3 py-1 ${statusFilter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
          >
            Rejected
          </button>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showMyExpenses}
            onChange={(e) => setShowMyExpenses(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">My Expenses Only</span>
        </label>
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {expenses.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">No expenses found</p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCategoryIcon(expense.category)}</span>
                    <div>
                      <h3 className="font-semibold">{expense.description}</h3>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
                        <span>📅 {formatDate(expense.expense_date)}</span>
                        <span>👤 {expense.user_name}</span>
                        <span className="capitalize">🏷️ {expense.category}</span>
                        {expense.job_number && (
                          <span>📋 Job #{expense.job_number}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {expense.rejection_reason && (
                    <div className="mt-2 rounded bg-red-50 p-2 text-sm text-red-800">
                      <strong>Rejection reason:</strong> {expense.rejection_reason}
                    </div>
                  )}
                </div>

                <div className="ml-4 text-right">
                  <div className="text-xl font-bold">{formatCurrency(expense.total_amount)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    +${parseFloat(expense.gst_amount).toFixed(2)} GST
                  </div>
                  <div className="mt-2">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${getStatusColor(expense.status)}`}>
                      {expense.status}
                    </span>
                  </div>

                  {expense.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleApprove(expense.id)}
                        className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(expense.id)}
                        className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {expense.receipt_url && (
                    <a
                      href={expense.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-xs text-blue-600 hover:underline"
                    >
                      📎 View Receipt
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Submit Expense</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    <option value="materials">Materials</option>
                    <option value="fuel">Fuel</option>
                    <option value="tools">Tools</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="subcontractor">Subcontractor</option>
                    <option value="meals">Meals</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Description *</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={3}
                  placeholder="Describe the expense..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Amount (excl. GST) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">GST Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.gstAmount}
                    onChange={(e) => setFormData({ ...formData, gstAmount: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Allocate to Job (Optional)</label>
                <select
                  value={formData.jobId}
                  onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="">No job allocation</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_number} - {job.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded bg-blue-50 p-3 text-sm text-blue-800">
                <strong>Total:</strong> $
                {(
                  parseFloat(formData.amount || '0') +
                  parseFloat(formData.gstAmount || '0')
                ).toFixed(2)}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded bg-blue-600 py-2 text-white hover:bg-blue-700"
                >
                  Submit Expense
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded border px-6 py-2 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
