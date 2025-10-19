'use client'

import { useEffect, useState } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  role: string
  status: string
}

export default function DashboardPage() {
  const { user } = useUser()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    abn: '',
    tradeType: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      const data = await res.json()
      setOrganizations(data.organizations || [])
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setShowCreateForm(false)
        setFormData({ name: '', abn: '', tradeType: '', phone: '', email: '' })
        fetchOrganizations()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      alert('Failed to create organization')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold">Tradie App</h1>
              <div className="flex gap-4">
                <Link href="/dashboard" className="font-medium text-blue-600">
                  Organizations
                </Link>
                <Link href="/dashboard/clients" className="text-gray-600 hover:text-gray-900">
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
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Your Organizations</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Create Organization
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Create New Organization</h3>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ABN
                </label>
                <input
                  type="text"
                  value={formData.abn}
                  onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Trade Type
                </label>
                <input
                  type="text"
                  value={formData.tradeType}
                  onChange={(e) => setFormData({ ...formData, tradeType: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g., Electrician, Plumber, Carpenter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {organizations.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <h3 className="text-lg font-medium text-gray-900">No organizations yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              Get started by creating your first organization
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <div key={org.id} className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-lg font-semibold">{org.name}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {org.role}
                  </span>
                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    {org.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
