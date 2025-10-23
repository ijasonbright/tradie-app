'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Job {
  id: string
  job_number: string
  title: string
  status: string
  priority: string
  job_type: string
  organization_name: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  is_company: boolean
  assigned_to_name: string | null
  scheduled_date: string | null
  quoted_amount: string | null
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const url = statusFilter === 'all'
          ? '/api/jobs'
          : `/api/jobs?status=${statusFilter}`

        const res = await fetch(url)
        const data = await res.json()
        setJobs(data.jobs || [])
      } catch (error) {
        console.error('Error fetching jobs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
  }, [statusFilter])

  const getClientName = (job: Job) => {
    if (job.is_company) {
      return job.company_name || 'Unnamed Company'
    }
    return `${job.first_name || ''} ${job.last_name || ''}`.trim() || 'Unnamed Client'
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

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600',
    }
    return colors[priority] || 'bg-gray-100 text-gray-600'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Jobs</h2>
          <Link
            href="/dashboard/jobs/new"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Create Job
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded px-4 py-2 ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('quoted')}
            className={`rounded px-4 py-2 ${
              statusFilter === 'quoted'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Quoted
          </button>
          <button
            onClick={() => setStatusFilter('scheduled')}
            className={`rounded px-4 py-2 ${
              statusFilter === 'scheduled'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`rounded px-4 py-2 ${
              statusFilter === 'in_progress'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            In Progress
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`rounded px-4 py-2 ${
              statusFilter === 'completed'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Completed
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <h3 className="text-lg font-medium text-gray-900">No jobs found</h3>
            <p className="mt-2 text-sm text-gray-600">
              {statusFilter === 'all'
                ? 'Get started by creating your first job'
                : `No jobs with status "${statusFilter}"`}
            </p>
            {statusFilter === 'all' && (
              <Link
                href="/dashboard/jobs/new"
                className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Create Job
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Job #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {job.job_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {job.title}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {getClientName(job)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {job.job_type}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(
                          job.status
                        )}`}
                      >
                        {job.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPriorityColor(
                          job.priority
                        )}`}
                      >
                        {job.priority}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {job.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
        </div>
    </div>
  )
}
