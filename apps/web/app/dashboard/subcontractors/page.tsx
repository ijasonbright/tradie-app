'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Subcontractor {
  id: string
  full_name: string
  email: string
  phone: string
  hourly_rate: string
  owed_amount: string
  user_id: string
}

export default function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubcontractors()
  }, [])

  const fetchSubcontractors = async () => {
    try {
      const res = await fetch('/api/organizations/members')
      const data = await res.json()

      // Filter only subcontractors
      const subs = data.members?.filter((m: any) => m.role === 'subcontractor') || []
      setSubcontractors(subs)
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(parseFloat(amount || '0'))
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">👷</div>
          <p className="mt-2 text-gray-600">Loading subcontractors...</p>
        </div>
      </div>
    )
  }

  const totalOwed = subcontractors.reduce(
    (sum, sub) => sum + parseFloat(sub.owed_amount || '0'),
    0
  )

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subcontractor Payments</h1>
        <Link
          href="/dashboard/team"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + Invite Subcontractor
        </Link>
      </div>

      {/* Summary Card */}
      <div className="mb-6 rounded-lg bg-orange-50 p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Amount Owed to Subcontractors</p>
            <p className="text-3xl font-bold text-orange-600">
              {formatCurrency(totalOwed.toString())}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {subcontractors.length} active subcontractor{subcontractors.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-6xl">💰</div>
        </div>
      </div>

      {/* Subcontractors List */}
      {subcontractors.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="text-4xl">👷</div>
          <p className="mt-4 text-gray-600">No subcontractors yet</p>
          <p className="mt-2 text-sm text-gray-500">
            Invite subcontractors from the Team page to start tracking payments
          </p>
          <Link
            href="/dashboard/team"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Team
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subcontractors.map((sub) => (
            <Link
              key={sub.id}
              href={`/dashboard/subcontractors/${sub.id}`}
              className="block rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">👤</div>
                  <div>
                    <h3 className="font-semibold">{sub.full_name}</h3>
                    <p className="text-sm text-gray-600">{sub.email}</p>
                    {sub.phone && (
                      <p className="text-sm text-gray-500">{sub.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hourly Rate:</span>
                  <span className="font-medium">
                    {sub.hourly_rate ? formatCurrency(sub.hourly_rate) : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Amount Owed:</span>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(sub.owed_amount)}
                  </span>
                </div>
              </div>

              <div className="mt-4 text-center text-sm font-medium text-blue-600">
                View Details & Make Payment →
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-lg bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900">💡 How It Works</h3>
        <ul className="mt-3 space-y-2 text-sm text-blue-800">
          <li>• Subcontractors log hours and materials on assigned jobs</li>
          <li>• You approve time logs and material costs</li>
          <li>• Approved amounts automatically add to "Amount Owed"</li>
          <li>• Record payments to track what's been paid</li>
          <li>• Optionally sync payments to Xero as Bills</li>
        </ul>
      </div>
    </div>
  )
}
