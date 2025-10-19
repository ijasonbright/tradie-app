'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

interface Client {
  id: string
  organization_id: string
  organization_name: string
  client_type: string
  is_company: boolean
  company_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  site_address_line1: string | null
  site_address_line2: string | null
  site_city: string | null
  site_state: string | null
  site_postcode: string | null
  billing_address_same_as_site: boolean
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postcode: string | null
  notes: string | null
  created_at: string
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchClient()
    }
  }, [params.id])

  const fetchClient = async () => {
    try {
      const res = await fetch(`/api/clients/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setClient(data.client)
      } else {
        alert('Client not found')
        router.push('/dashboard/clients')
      }
    } catch (error) {
      console.error('Error fetching client:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return
    }

    setDeleting(true)

    try {
      const res = await fetch(`/api/clients/${params.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/dashboard/clients')
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting client:', error)
      alert('Failed to delete client')
    } finally {
      setDeleting(false)
    }
  }

  const getClientName = () => {
    if (!client) return ''
    if (client.is_company) {
      return client.company_name || 'Unnamed Company'
    }
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unnamed Client'
  }

  const formatAddress = (
    line1: string | null,
    line2: string | null,
    city: string | null,
    state: string | null,
    postcode: string | null
  ) => {
    const parts = [line1, line2, city, state, postcode].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'No address provided'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Client not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold">
                Tradie App
              </Link>
              <div className="flex gap-4">
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Organizations
                </Link>
                <Link href="/dashboard/clients" className="font-medium text-blue-600">
                  Clients
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.emailAddresses[0]?.emailAddress}</span>
              <UserButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/clients" className="text-blue-600 hover:text-blue-800">
            ← Back to Clients
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold">{getClientName()}</h2>
            <div className="mt-2 flex gap-2">
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                {client.is_company ? 'Company' : 'Individual'}
              </span>
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
                {client.client_type}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-red-300"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Contact Information */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Contact Information</h3>
            <dl className="space-y-3">
              {client.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`mailto:${client.email}`} className="text-blue-600 hover:text-blue-800">
                      {client.email}
                    </a>
                  </dd>
                </div>
              )}
              {client.mobile && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Mobile</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`tel:${client.mobile}`} className="text-blue-600 hover:text-blue-800">
                      {client.mobile}
                    </a>
                  </dd>
                </div>
              )}
              {client.phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`tel:${client.phone}`} className="text-blue-600 hover:text-blue-800">
                      {client.phone}
                    </a>
                  </dd>
                </div>
              )}
              {!client.email && !client.mobile && !client.phone && (
                <p className="text-sm text-gray-500">No contact information available</p>
              )}
            </dl>
          </div>

          {/* Organization */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Organization</h3>
            <p className="text-sm text-gray-900">{client.organization_name}</p>
            <p className="mt-2 text-xs text-gray-500">
              Added {new Date(client.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Site Address */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Site Address</h3>
            <p className="text-sm text-gray-900">
              {formatAddress(
                client.site_address_line1,
                client.site_address_line2,
                client.site_city,
                client.site_state,
                client.site_postcode
              )}
            </p>
          </div>

          {/* Billing Address */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Billing Address</h3>
            {client.billing_address_same_as_site ? (
              <p className="text-sm text-gray-500">Same as site address</p>
            ) : (
              <p className="text-sm text-gray-900">
                {formatAddress(
                  client.billing_address_line1,
                  client.billing_address_line2,
                  client.billing_city,
                  client.billing_state,
                  client.billing_postcode
                )}
              </p>
            )}
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="rounded-lg bg-white p-6 shadow lg:col-span-2">
              <h3 className="mb-4 text-lg font-semibold">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-900">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Future: Jobs, Quotes, Invoices sections will go here */}
        <div className="mt-6 rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Activity</h3>
          <p className="text-sm text-gray-500">
            Jobs, quotes, and invoices will appear here once those features are implemented.
          </p>
        </div>
      </main>
    </div>
  )
}
