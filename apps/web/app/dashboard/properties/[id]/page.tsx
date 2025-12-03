'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface AssetRegisterJob {
  id: string
  status: string
  priority: string
  scheduled_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  completed_date: string | null
  assigned_to_name: string | null
}

interface Property {
  id: string
  organization_id: string
  organization_name: string
  external_property_id: number
  address_street: string | null
  address_suburb: string | null
  address_state: string | null
  address_postcode: string | null
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  tenant_name: string | null
  tenant_phone: string | null
  tenant_email: string | null
  access_instructions: string | null
  notes: string | null
  synced_at: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-purple-100 text-purple-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  SCHEDULED: 'bg-cyan-100 text-cyan-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Created',
  ASSIGNED: 'Assigned',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export default function PropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [assetRegisterJobs, setAssetRegisterJobs] = useState<AssetRegisterJob[]>([])
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(true)
  const [creatingJob, setCreatingJob] = useState(false)

  const fetchProperty = async () => {
    try {
      const res = await fetch(`/api/properties/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setProperty(data.property)
      } else {
        alert('Property not found')
        router.push('/dashboard/properties')
      }
    } catch (error) {
      console.error('Error fetching property:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAssetRegisterJobs = async () => {
    if (!params.id) return

    try {
      const res = await fetch(`/api/asset-register-jobs?property_id=${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setAssetRegisterJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error fetching asset register jobs:', error)
    } finally {
      setJobsLoading(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchProperty()
      fetchAssetRegisterJobs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const handleCreateAssetRegister = async () => {
    if (!property) return

    setCreatingJob(true)
    try {
      const res = await fetch('/api/asset-register-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: property.organization_id,
          property_id: property.id,
          priority: 'MEDIUM',
          notes: `Asset register for ${property.address_street}`,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        // Refresh the list
        await fetchAssetRegisterJobs()
        // Navigate to the new job
        router.push(`/dashboard/jobs/asset-register/${data.job.id}`)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create asset register job')
      }
    } catch (error) {
      console.error('Error creating asset register job:', error)
      alert('Failed to create asset register job')
    } finally {
      setCreatingJob(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Property not found</p>
      </div>
    )
  }

  // Check if there's an active (non-completed, non-cancelled) asset register job
  const activeJob = assetRegisterJobs.find(
    (job) => job.status !== 'COMPLETED' && job.status !== 'CANCELLED'
  )
  const completedJobs = assetRegisterJobs.filter((job) => job.status === 'COMPLETED')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/properties" className="text-blue-600 hover:text-blue-800">
          ← Back to Properties
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">{property.address_street || 'Property'}</h2>
          <p className="mt-1 text-gray-600">
            {property.address_suburb}
            {property.address_suburb && property.address_state ? ', ' : ''}
            {property.address_state} {property.address_postcode}
          </p>
          <div className="mt-2 flex gap-2">
            {property.property_type && (
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                {property.property_type}
              </span>
            )}
            {property.bedrooms != null && (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
                {property.bedrooms} bed
              </span>
            )}
            {property.bathrooms != null && (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
                {property.bathrooms} bath
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Owner Information */}
        {(property.owner_name || property.owner_phone || property.owner_email) && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Owner</h3>
            <dl className="space-y-3">
              {property.owner_name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{property.owner_name}</dd>
                </div>
              )}
              {property.owner_phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`tel:${property.owner_phone}`} className="text-blue-600 hover:text-blue-800">
                      {property.owner_phone}
                    </a>
                  </dd>
                </div>
              )}
              {property.owner_email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`mailto:${property.owner_email}`} className="text-blue-600 hover:text-blue-800">
                      {property.owner_email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Tenant Information */}
        {(property.tenant_name || property.tenant_phone || property.tenant_email) && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Tenant</h3>
            <dl className="space-y-3">
              {property.tenant_name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{property.tenant_name}</dd>
                </div>
              )}
              {property.tenant_phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`tel:${property.tenant_phone}`} className="text-blue-600 hover:text-blue-800">
                      {property.tenant_phone}
                    </a>
                  </dd>
                </div>
              )}
              {property.tenant_email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`mailto:${property.tenant_email}`} className="text-blue-600 hover:text-blue-800">
                      {property.tenant_email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Access Instructions */}
        {property.access_instructions && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Access Instructions</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-900">
              {property.access_instructions}
            </p>
          </div>
        )}

        {/* Notes */}
        {property.notes && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Notes</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-900">{property.notes}</p>
          </div>
        )}
      </div>

      {/* Asset Register Section */}
      <div className="mt-8">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold">Asset Register</h3>
          {!activeJob && (
            <button
              onClick={handleCreateAssetRegister}
              disabled={creatingJob}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {creatingJob ? 'Creating...' : 'Start Asset Register'}
            </button>
          )}
        </div>

        {jobsLoading ? (
          <p className="text-gray-500">Loading asset register jobs...</p>
        ) : assetRegisterJobs.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Asset Register Yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              Start an asset register to capture all assets in this property.
            </p>
            <button
              onClick={handleCreateAssetRegister}
              disabled={creatingJob}
              className="mt-4 rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {creatingJob ? 'Creating...' : 'Start Asset Register'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Job */}
            {activeJob && (
              <div className="rounded-lg border-2 border-green-500 bg-white p-6 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-semibold">Active Asset Register</h4>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[activeJob.status]}`}>
                        {STATUS_LABELS[activeJob.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Created: {new Date(activeJob.created_at).toLocaleDateString()}
                      {activeJob.assigned_to_name && ` • Assigned to: ${activeJob.assigned_to_name}`}
                    </p>
                    {activeJob.scheduled_date && (
                      <p className="mt-1 text-sm text-gray-600">
                        Scheduled: {new Date(activeJob.scheduled_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/jobs/asset-register/${activeJob.id}`}
                    className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  >
                    {activeJob.status === 'IN_PROGRESS' ? 'Continue' : 'View'}
                  </Link>
                </div>
              </div>
            )}

            {/* Completed Jobs */}
            {completedJobs.length > 0 && (
              <div className="rounded-lg bg-white shadow">
                <div className="border-b px-6 py-4">
                  <h4 className="text-lg font-medium text-gray-900">Completed Asset Registers</h4>
                </div>
                <div className="divide-y">
                  {completedJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          Completed: {job.completed_date ? new Date(job.completed_date).toLocaleDateString() : 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {job.assigned_to_name && `By: ${job.assigned_to_name}`}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/jobs/asset-register/${job.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Report →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
