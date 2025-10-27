'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

interface TradeType {
  id: string
  name: string
  client_hourly_rate: string
  default_employee_hourly_rate: string
}

export default function NewJobPage() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [tradeTypes, setTradeTypes] = useState<TradeType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    organizationId: '',
    clientId: '',
    tradeTypeId: '',
    title: '',
    description: '',
    jobType: 'repair',
    status: 'quoted',
    priority: 'medium',
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
    fetchOrganizations()
  }, [])

  useEffect(() => {
    if (formData.organizationId) {
      fetchClients()
      fetchTradeTypes()
    }
  }, [formData.organizationId])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      const data = await res.json()
      const orgs = data.organizations || []
      setOrganizations(orgs)

      if (orgs.length === 1) {
        setFormData((prev) => ({ ...prev, organizationId: orgs[0].id }))
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      setClients(data.clients || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const fetchTradeTypes = async () => {
    try {
      const res = await fetch('/api/trade-types')
      const data = await res.json()
      setTradeTypes(data.tradeTypes || [])
    } catch (error) {
      console.error('Error fetching trade types:', error)
    }
  }

  const getClientName = (client: Client) => {
    if (client.is_company) {
      return client.company_name || 'Unnamed Company'
    }
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unnamed Client'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/jobs/${data.job.id}`)
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job')
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

  if (organizations.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">No Organizations Found</h2>
          <p className="mt-2 text-gray-600">You need to create an organization first</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/jobs" className="text-blue-600 hover:text-blue-800">
            ← Back to Jobs
          </Link>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-6 text-2xl font-bold">Create New Job</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization *
              </label>
              <select
                required
                value={formData.organizationId}
                onChange={(e) =>
                  setFormData({ ...formData, organizationId: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select an organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Client *
              </label>
              <select
                required
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
                disabled={!formData.organizationId}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {getClientName(client)}
                  </option>
                ))}
              </select>
              {formData.organizationId && clients.length === 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  No clients found.{' '}
                  <Link href="/dashboard/clients/new" className="text-blue-600 hover:text-blue-800">
                    Create a client first
                  </Link>
                </p>
              )}
            </div>

            {/* Trade Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Trade Type *
              </label>
              <select
                required
                value={formData.tradeTypeId}
                onChange={(e) =>
                  setFormData({ ...formData, tradeTypeId: e.target.value })
                }
                disabled={!formData.organizationId}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
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
                {tradeTypes.length === 0 && formData.organizationId && (
                  <span className="block mt-1 text-amber-600">
                    No trade types found. <Link href="/dashboard/settings/trades" className="text-blue-600 hover:text-blue-800">Configure trade rates</Link> first.
                  </span>
                )}
              </p>
            </div>

            {/* Job Details */}
            <div className="border-t pt-6">
              <h3 className="mb-4 text-lg font-semibold">Job Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., Kitchen Renovation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={4}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="Describe the job details..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Job Type *
                    </label>
                    <select
                      required
                      value={formData.jobType}
                      onChange={(e) =>
                        setFormData({ ...formData, jobType: e.target.value })
                      }
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
                    <label className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value })
                      }
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
                  <label className="block text-sm font-medium text-gray-700">
                    Address Line 1
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700">
                    Address Line 2
                  </label>
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
                      onChange={(e) =>
                        setFormData({ ...formData, siteCity: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">State</label>
                    <input
                      type="text"
                      value={formData.siteState}
                      onChange={(e) =>
                        setFormData({ ...formData, siteState: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      placeholder="e.g., NSW"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Postcode
                    </label>
                    <input
                      type="text"
                      value={formData.sitePostcode}
                      onChange={(e) =>
                        setFormData({ ...formData, sitePostcode: e.target.value })
                      }
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
              <h3 className="mb-4 text-lg font-semibold">Scheduling (Optional)</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) =>
                      setFormData({ ...formData, scheduledDate: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Start Time
                    </label>
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
                    <label className="block text-sm font-medium text-gray-700">
                      End Time
                    </label>
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
                {submitting ? 'Creating...' : 'Create Job'}
              </button>
              <Link
                href="/dashboard/jobs"
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
