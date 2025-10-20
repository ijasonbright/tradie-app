'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

interface Job {
  id: string
  job_number: string
  title: string
  status: string
  created_at: string
}

interface Quote {
  id: string
  quote_number: string
  title: string
  status: string
  total_amount: string
  created_at: string
}

interface Invoice {
  id: string
  invoice_number: string
  status: string
  total_amount: string
  paid_amount: string
  created_at: string
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

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

  const fetchActivity = async () => {
    if (!params.id) return

    try {
      // Fetch jobs for this client
      const jobsRes = await fetch(`/api/jobs?clientId=${params.id}`)
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        setJobs(jobsData.jobs || [])
      }

      // Fetch quotes for this client
      const quotesRes = await fetch(`/api/quotes?clientId=${params.id}`)
      if (quotesRes.ok) {
        const quotesData = await quotesRes.json()
        setQuotes(quotesData.quotes || [])
      }

      // Fetch invoices for this client
      const invoicesRes = await fetch(`/api/invoices?clientId=${params.id}`)
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json()
        setInvoices(invoicesData.invoices || [])
      }
    } catch (error) {
      console.error('Error fetching activity:', error)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchClient()
      fetchActivity()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

        {/* Activity Section */}
        <div className="mt-6 space-y-6">
          {/* Jobs */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Jobs ({jobs.length})</h3>
              <Link
                href={`/dashboard/jobs/new?clientId=${client.id}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + New Job
              </Link>
            </div>
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-500">No jobs yet</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="block p-3 bg-gray-50 rounded-md hover:bg-gray-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{job.job_number}</p>
                        <p className="text-sm text-gray-600">{job.title}</p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {job.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quotes */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Quotes ({quotes.length})</h3>
              <Link
                href={`/dashboard/quotes/new?clientId=${client.id}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + New Quote
              </Link>
            </div>
            {quotes.length === 0 ? (
              <p className="text-sm text-gray-500">No quotes yet</p>
            ) : (
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/dashboard/quotes/${quote.id}`}
                    className="block p-3 bg-gray-50 rounded-md hover:bg-gray-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{quote.quote_number}</p>
                        <p className="text-sm text-gray-600">{quote.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm text-gray-900">${parseFloat(quote.total_amount).toFixed(2)}</p>
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          {quote.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Invoices ({invoices.length})</h3>
              <Link
                href={`/dashboard/invoices/new?clientId=${client.id}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + New Invoice
              </Link>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-500">No invoices yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="block p-3 bg-gray-50 rounded-md hover:bg-gray-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{invoice.invoice_number}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm text-gray-900">${parseFloat(invoice.total_amount).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">
                          Paid: ${parseFloat(invoice.paid_amount).toFixed(2)}
                        </p>
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
