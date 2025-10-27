'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Job {
  id: string
  organization_id: string
  client_id: string
  trade_type_id: string | null
  pricing_type: string
  title: string
  description: string | null
  job_type: string
  status: string
  priority: string
  site_address_line1: string | null
  site_address_line2: string | null
  site_city: string | null
  site_state: string | null
  site_postcode: string | null
  site_access_notes: string | null
  quoted_amount: string | null
  scheduled_date: string | null
  scheduled_start_time: string | null
  scheduled_end_time: string | null
  organization_name: string
  client_name: string
}

interface TradeType {
  id: string
  name: string
  client_hourly_rate: string
  default_employee_hourly_rate: string
}

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [tradeTypes, setTradeTypes] = useState<TradeType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    jobType: 'repair',
    status: 'quoted',
    priority: 'medium',
    pricingType: 'time_and_materials',
    tradeTypeId: '',
    siteAddressLine1: '',
    siteAddressLine2: '',
    siteCity: '',
    siteState: '',
    sitePostcode: '',
    siteAccessNotes: '',
    quotedAmount: '',
    scheduledDate: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
  })

  useEffect(() => {
    params.then((p) => {
      setJobId(p.id)
    })
  }, [params])

  useEffect(() => {
    const loadJob = async () => {
      if (!jobId) return

      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) {
          throw new Error('Failed to fetch job')
        }
        const data = await res.json()
        const jobData = data.job

        setJob(jobData)

        // Fetch trade types
        const tradeTypesRes = await fetch('/api/trade-types')
        console.log('Trade types fetch status:', tradeTypesRes.status, tradeTypesRes.statusText)
        const tradeTypesData = await tradeTypesRes.json()
        console.log('Trade types response:', tradeTypesData)
        console.log('Trade types array:', tradeTypesData.tradeTypes)
        console.log('Trade types count:', tradeTypesData.tradeTypes?.length || 0)
        setTradeTypes(tradeTypesData.tradeTypes || [])

        // Pre-fill form
        setFormData({
          title: jobData.title || '',
          description: jobData.description || '',
          jobType: jobData.job_type || 'repair',
          status: jobData.status || 'quoted',
          priority: jobData.priority || 'medium',
          pricingType: jobData.pricing_type || 'time_and_materials',
          tradeTypeId: jobData.trade_type_id || '',
          siteAddressLine1: jobData.site_address_line1 || '',
          siteAddressLine2: jobData.site_address_line2 || '',
          siteCity: jobData.site_city || '',
          siteState: jobData.site_state || '',
          sitePostcode: jobData.site_postcode || '',
          siteAccessNotes: jobData.site_access_notes || '',
          quotedAmount: jobData.quoted_amount || '',
          scheduledDate: jobData.scheduled_date
            ? new Date(jobData.scheduled_date).toISOString().split('T')[0]
            : '',
          scheduledStartTime: jobData.scheduled_start_time
            ? new Date(jobData.scheduled_start_time).toISOString().slice(0, 16)
            : '',
          scheduledEndTime: jobData.scheduled_end_time
            ? new Date(jobData.scheduled_end_time).toISOString().slice(0, 16)
            : '',
        })
      } catch (error) {
        console.error('Error fetching job:', error)
        alert('Failed to load job')
      } finally {
        setLoading(false)
      }
    }

    loadJob()
  }, [jobId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        router.push(`/dashboard/jobs/${jobId}`)
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating job:', error)
      alert('Failed to update job')
    } finally {
      setSubmitting(false)
    }
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
        <div className="text-center">
          <h2 className="text-xl font-semibold">Job Not Found</h2>
          <Link
            href="/dashboard/jobs"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Jobs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href={`/dashboard/jobs/${jobId}`} className="text-blue-600 hover:text-blue-800">
          ← Back to Job
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-6 text-2xl font-bold">Edit Job</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Read-only Organization and Client */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Organization & Client</h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-600">Organization: </span>
                <span className="text-sm font-medium">{job.organization_name}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Client: </span>
                <span className="text-sm font-medium">{job.client_name}</span>
              </div>
              <p className="text-xs text-gray-500">
                Organization and client cannot be changed after job creation
              </p>
            </div>
          </div>

          {/* Job Details */}
          <div className="border-t pt-6">
            <h3 className="mb-4 text-lg font-semibold">Job Details</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Job Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g., Kitchen Renovation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Describe the job details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Job Type *</label>
                  <select
                    required
                    value={formData.jobType}
                    onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="repair">Repair</option>
                    <option value="installation">Installation</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inspection">Inspection</option>
                    <option value="quote">Quote</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="quoted">Quoted</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Pricing Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Pricing Type *
                </label>
                <select
                  required
                  value={formData.pricingType}
                  onChange={(e) =>
                    setFormData({ ...formData, pricingType: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="fixed_price">Fixed Price (From Quote)</option>
                  <option value="time_and_materials">Time & Materials</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.pricingType === 'fixed_price' ? (
                    <>
                      <strong>Fixed Price:</strong> Invoice amount comes from the quote. Time tracking is for internal costing only.
                    </>
                  ) : (
                    <>
                      <strong>Time & Materials:</strong> Invoice amount calculated from actual hours worked + materials used.
                    </>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Trade Type *</label>
                <select
                  required
                  value={formData.tradeTypeId}
                  onChange={(e) => setFormData({ ...formData, tradeTypeId: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Select a trade type</option>
                  {tradeTypes.map((tradeType) => (
                    <option key={tradeType.id} value={tradeType.id}>
                      {tradeType.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  This determines the hourly rates used for time tracking and invoicing.
                  {tradeTypes.length === 0 && (
                    <span className="block mt-1 text-amber-600">
                      No trade types found. <Link href="/dashboard/settings/trades" className="text-blue-600 hover:text-blue-800">Configure trade rates</Link> first.
                    </span>
                  )}
                  {!formData.tradeTypeId && job?.trade_type_id === null && (
                    <span className="block mt-1 text-amber-600">
                      ⚠️ This job has no trade type set. Time tracking will show $0.00 costs until a trade type is selected.
                    </span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Quoted Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quotedAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, quotedAmount: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Site Location */}
          <div className="border-t pt-6">
            <h3 className="mb-4 text-lg font-semibold">Site Location</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
                <input
                  type="text"
                  value={formData.siteAddressLine1}
                  onChange={(e) =>
                    setFormData({ ...formData, siteAddressLine1: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                <input
                  type="text"
                  value={formData.siteAddressLine2}
                  onChange={(e) =>
                    setFormData({ ...formData, siteAddressLine2: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    value={formData.siteCity}
                    onChange={(e) => setFormData({ ...formData, siteCity: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <input
                    type="text"
                    value={formData.siteState}
                    onChange={(e) => setFormData({ ...formData, siteState: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., NSW"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Postcode</label>
                  <input
                    type="text"
                    value={formData.sitePostcode}
                    onChange={(e) => setFormData({ ...formData, sitePostcode: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Site Access Notes
                </label>
                <textarea
                  value={formData.siteAccessNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, siteAccessNotes: e.target.value })
                  }
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Parking info, gate codes, access instructions..."
                />
              </div>
            </div>
          </div>

          {/* Scheduling */}
          <div className="border-t pt-6">
            <h3 className="mb-4 text-lg font-semibold">Scheduling</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Scheduled Date</label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledStartTime}
                    onChange={(e) =>
                      setFormData({ ...formData, scheduledStartTime: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledEndTime}
                    onChange={(e) =>
                      setFormData({ ...formData, scheduledEndTime: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 border-t pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/dashboard/jobs/${jobId}`}
              className="rounded bg-gray-200 px-6 py-2 text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
