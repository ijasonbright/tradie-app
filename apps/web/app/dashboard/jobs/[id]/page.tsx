'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Job {
  id: string
  job_number: string
  title: string
  description: string | null
  status: string
  priority: string
  job_type: string
  client_id: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  is_company: boolean
  client_email: string | null
  client_phone: string | null
  quoted_amount: string | null
  scheduled_date: string | null
  created_at: string
}

interface TimeLog {
  id: string
  user_name: string
  start_time: string
  end_time: string | null
  total_hours: string | null
  labor_cost: string | null
  notes: string | null
  status: string
}

interface Quote {
  id: string
  quote_number: string
  title: string
  description: string | null
  status: string
  subtotal: string
  gst_amount: string
  total_amount: string
  valid_until_date: string | null
  created_at: string
  created_by_name: string
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showTimeLogForm, setShowTimeLogForm] = useState(false)
  const [timeLogForm, setTimeLogForm] = useState({
    startTime: '',
    endTime: '',
    breakDurationMinutes: '0',
    notes: '',
  })

  useEffect(() => {
    if (params.id) {
      // Sync user data to ensure full_name is up to date
      fetch('/api/users/sync', { method: 'POST' }).catch(console.error)
      fetchJob()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setJob(data.job)
        setQuote(data.quote)
        setTimeLogs(data.timeLogs || [])
      } else {
        alert('Job not found')
        router.push('/dashboard/jobs')
      }
    } catch (error) {
      console.error('Error fetching job:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTimeLog = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch(`/api/jobs/${params.id}/time-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...timeLogForm,
          breakDurationMinutes: parseInt(timeLogForm.breakDurationMinutes),
        }),
      })

      if (res.ok) {
        setShowTimeLogForm(false)
        setTimeLogForm({
          startTime: '',
          endTime: '',
          breakDurationMinutes: '0',
          notes: '',
        })
        fetchJob() // Refresh to show new time log
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding time log:', error)
      alert('Failed to add time log')
    }
  }

  const getClientName = () => {
    if (!job) return ''
    if (job.is_company) {
      return job.company_name || 'Unnamed Company'
    }
    return `${job.first_name || ''} ${job.last_name || ''}`.trim() || 'Unnamed Client'
  }

  const handleCompleteJob = async () => {
    if (!job || !confirm('Mark this job as completed?')) return

    try {
      const res = await fetch(`/api/jobs/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      if (res.ok) {
        fetchJob()
        alert('Job marked as completed!')
      } else {
        alert('Failed to update job status')
      }
    } catch (error) {
      console.error('Error updating job:', error)
      alert('Failed to update job status')
    }
  }

  const handleCreateInvoice = () => {
    if (!job) return
    // Redirect to invoice creation with pre-filled data
    router.push(`/dashboard/invoices/new?jobId=${job.id}&clientId=${job.client_id}`)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      quoted: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      invoiced: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Job not found</p>
      </div>
    )
  }

  const totalHours = timeLogs.reduce((sum, log) => sum + (parseFloat(log.total_hours || '0')), 0)
  const totalCost = timeLogs.reduce((sum, log) => sum + (parseFloat(log.labor_cost || '0')), 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/jobs" className="text-blue-600 hover:text-blue-800">
            ← Back to Jobs
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold">{job.title}</h2>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(
                  job.status
                )}`}
              >
                {job.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-2 text-gray-600">Job #{job.job_number}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Job Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Info */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold">Job Information</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Client</dt>
                  <dd className="mt-1 text-sm text-gray-900">{getClientName()}</dd>
                </div>
                {job.description && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{job.description}</dd>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.job_type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Priority</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.priority}</dd>
                  </div>
                  {job.quoted_amount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Quoted Amount</dt>
                      <dd className="mt-1 text-sm text-gray-900">${parseFloat(job.quoted_amount).toFixed(2)}</dd>
                    </div>
                  )}
                </div>
              </dl>
            </div>

            {/* Quote Information */}
            {quote && (
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Related Quote</h3>
                  <Link
                    href={`/dashboard/quotes/${quote.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View Quote →
                  </Link>
                </div>
                <dl className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Quote Number</dt>
                      <dd className="mt-1 text-sm font-medium text-gray-900">{quote.quote_number}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1">
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                          {quote.status}
                        </span>
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Quote Title</dt>
                    <dd className="mt-1 text-sm text-gray-900">{quote.title}</dd>
                  </div>
                  {quote.description && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Description</dt>
                      <dd className="mt-1 text-sm text-gray-900">{quote.description}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Subtotal</dt>
                      <dd className="mt-1 text-sm text-gray-900">${parseFloat(quote.subtotal).toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">GST</dt>
                      <dd className="mt-1 text-sm text-gray-900">${parseFloat(quote.gst_amount).toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Total</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">${parseFloat(quote.total_amount).toFixed(2)}</dd>
                    </div>
                  </div>
                </dl>
              </div>
            )}

            {/* Action Buttons */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold">Job Actions</h3>
              <div className="flex gap-3">
                {job.status !== 'completed' && job.status !== 'cancelled' && (
                  <button
                    onClick={handleCompleteJob}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                  >
                    Mark as Completed
                  </button>
                )}
                <button
                  onClick={handleCreateInvoice}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                >
                  Create Invoice
                </button>
                {quote && (
                  <Link
                    href={`/dashboard/quotes/${quote.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium inline-flex items-center"
                  >
                    Edit Quote
                  </Link>
                )}
              </div>
            </div>

            {/* Time Logs */}
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Time Logs</h3>
                  <p className="text-sm text-gray-600">
                    Total: {totalHours.toFixed(2)} hours · ${totalCost.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setShowTimeLogForm(!showTimeLogForm)}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  {showTimeLogForm ? 'Cancel' : 'Log Time'}
                </button>
              </div>

              {showTimeLogForm && (
                <form onSubmit={handleAddTimeLog} className="mb-6 rounded-lg bg-gray-50 p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Start Time *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={timeLogForm.startTime}
                          onChange={(e) =>
                            setTimeLogForm({ ...timeLogForm, startTime: e.target.value })
                          }
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          End Time
                        </label>
                        <input
                          type="datetime-local"
                          value={timeLogForm.endTime}
                          onChange={(e) =>
                            setTimeLogForm({ ...timeLogForm, endTime: e.target.value })
                          }
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Break Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={timeLogForm.breakDurationMinutes}
                        onChange={(e) =>
                          setTimeLogForm({ ...timeLogForm, breakDurationMinutes: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        value={timeLogForm.notes}
                        onChange={(e) =>
                          setTimeLogForm({ ...timeLogForm, notes: e.target.value })
                        }
                        rows={2}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Add Time Log
                    </button>
                  </div>
                </form>
              )}

              {timeLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No time logs yet</p>
              ) : (
                <div className="space-y-3">
                  {timeLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{log.user_name}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(log.start_time).toLocaleString()} -{' '}
                            {log.end_time ? new Date(log.end_time).toLocaleString() : 'In progress'}
                          </p>
                          {log.notes && (
                            <p className="mt-2 text-sm text-gray-600">{log.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {log.total_hours && (
                            <p className="text-sm font-medium">{log.total_hours} hrs</p>
                          )}
                          {log.labor_cost && (
                            <p className="text-sm text-gray-600">${log.labor_cost}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Client & Status */}
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold">Client Contact</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{getClientName()}</dd>
                </div>
                {job.client_email && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <a href={`mailto:${job.client_email}`} className="text-blue-600 hover:text-blue-800">
                        {job.client_email}
                      </a>
                    </dd>
                  </div>
                )}
                {job.client_phone && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phone</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <a href={`tel:${job.client_phone}`} className="text-blue-600 hover:text-blue-800">
                        {job.client_phone}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold">Schedule</h3>
              <dl className="space-y-3">
                {job.scheduled_date && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Scheduled Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(job.scheduled_date).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(job.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
    </div>
  )
}
