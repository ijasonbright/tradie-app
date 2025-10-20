'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
}

export default function NewClientPage() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    organizationId: '',
    clientType: 'residential',
    isCompany: false,
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    siteAddressLine1: '',
    siteAddressLine2: '',
    siteCity: '',
    siteState: '',
    sitePostcode: '',
    billingAddressSameAsSite: true,
    billingAddressLine1: '',
    billingAddressLine2: '',
    billingCity: '',
    billingState: '',
    billingPostcode: '',
    notes: '',
  })

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      const data = await res.json()
      const orgs = data.organizations || []
      setOrganizations(orgs)

      // Auto-select first organization if only one exists
      if (orgs.length === 1) {
        setFormData((prev) => ({ ...prev, organizationId: orgs[0].id }))
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        router.push('/dashboard/clients')
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating client:', error)
      alert('Failed to create client')
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
          <Link href="/dashboard/clients" className="text-blue-600 hover:text-blue-800">
            ← Back to Clients
          </Link>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-6 text-2xl font-bold">Add New Client</h2>

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

            {/* Client Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Client Type *
              </label>
              <select
                required
                value={formData.clientType}
                onChange={(e) =>
                  setFormData({ ...formData, clientType: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            {/* Company or Individual */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isCompany}
                  onChange={(e) =>
                    setFormData({ ...formData, isCompany: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  This is a company
                </span>
              </label>
            </div>

            {/* Company Name or Individual Names */}
            {formData.isCompany ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div className="border-t pt-6">
              <h3 className="mb-4 text-lg font-semibold">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Mobile
                    </label>
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData({ ...formData, mobile: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Site Address */}
            <div className="border-t pt-6">
              <h3 className="mb-4 text-lg font-semibold">Site Address</h3>
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
              </div>
            </div>

            {/* Billing Address */}
            <div className="border-t pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Billing Address</h3>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.billingAddressSameAsSite}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        billingAddressSameAsSite: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Same as site address</span>
                </label>
              </div>

              {!formData.billingAddressSameAsSite && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.billingAddressLine1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingAddressLine1: e.target.value,
                        })
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
                      value={formData.billingAddressLine2}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          billingAddressLine2: e.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.billingCity}
                        onChange={(e) =>
                          setFormData({ ...formData, billingCity: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        State
                      </label>
                      <input
                        type="text"
                        value={formData.billingState}
                        onChange={(e) =>
                          setFormData({ ...formData, billingState: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Postcode
                      </label>
                      <input
                        type="text"
                        value={formData.billingPostcode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            billingPostcode: e.target.value,
                          })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="border-t pt-6">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Any additional notes about this client..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-2 border-t pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {submitting ? 'Creating...' : 'Create Client'}
              </button>
              <Link
                href="/dashboard/clients"
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
