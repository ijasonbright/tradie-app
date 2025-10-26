'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ExpiryNotificationsProps {
  className?: string
}

interface NotificationData {
  personal: {
    expired: number
    expiringSoon: number
    total: number
    documents: any[]
  }
  team: {
    expired: number
    expiringSoon: number
    total: number
    documents: any[]
  }
}

export default function ExpiryNotifications({ className = '' }: ExpiryNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    fetchNotifications()
    // Poll every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications/expiring-documents')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Error fetching expiring documents:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !notifications) return null

  const totalAlerts = notifications.personal.total + notifications.team.total
  const totalExpired = notifications.personal.expired + notifications.team.expired

  if (totalAlerts === 0) return null

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative rounded-lg p-2 hover:bg-gray-100"
        title="Document expiry alerts"
      >
        <span className="text-2xl">
          {totalExpired > 0 ? '🔴' : '⚠️'}
        </span>
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
          {totalAlerts}
        </span>
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-20 mt-2 w-96 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5">
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Document Alerts</h3>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Personal Documents */}
              {notifications.personal.total > 0 && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700">Your Documents</h4>
                    <Link
                      href="/dashboard/compliance"
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => setShowDropdown(false)}
                    >
                      View All →
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {notifications.personal.expired > 0 && (
                      <div className="rounded bg-red-50 p-3">
                        <p className="text-sm font-medium text-red-800">
                          🔴 {notifications.personal.expired} document(s) expired
                        </p>
                      </div>
                    )}
                    {notifications.personal.expiringSoon > 0 && (
                      <div className="rounded bg-yellow-50 p-3">
                        <p className="text-sm font-medium text-yellow-800">
                          ⚠️ {notifications.personal.expiringSoon} expiring within 30 days
                        </p>
                      </div>
                    )}

                    {notifications.personal.documents.slice(0, 3).map((doc) => {
                      const expiryDate = new Date(doc.expiry_date)
                      const today = new Date()
                      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      const isExpired = daysUntilExpiry < 0

                      return (
                        <div key={doc.id} className="border-l-4 border-gray-200 pl-3 text-sm">
                          <p className="font-medium">{doc.title}</p>
                          <p className={`text-xs ${isExpired ? 'text-red-600' : 'text-yellow-600'}`}>
                            {isExpired ? 'Expired' : `Expires in ${daysUntilExpiry} days`}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Team Documents (Owner/Admin only) */}
              {notifications.team.total > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700">Team Documents</h4>
                    <Link
                      href="/dashboard/team/compliance"
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => setShowDropdown(false)}
                    >
                      View All →
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {notifications.team.expired > 0 && (
                      <div className="rounded bg-red-50 p-3">
                        <p className="text-sm font-medium text-red-800">
                          🔴 {notifications.team.expired} team document(s) expired
                        </p>
                      </div>
                    )}
                    {notifications.team.expiringSoon > 0 && (
                      <div className="rounded bg-yellow-50 p-3">
                        <p className="text-sm font-medium text-yellow-800">
                          ⚠️ {notifications.team.expiringSoon} team documents expiring soon
                        </p>
                      </div>
                    )}

                    {notifications.team.documents.slice(0, 3).map((doc) => {
                      const expiryDate = new Date(doc.expiry_date)
                      const today = new Date()
                      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      const isExpired = daysUntilExpiry < 0

                      return (
                        <div key={doc.id} className="border-l-4 border-gray-200 pl-3 text-sm">
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-xs text-gray-600">{doc.team_member_name}</p>
                          <p className={`text-xs ${isExpired ? 'text-red-600' : 'text-yellow-600'}`}>
                            {isExpired ? 'Expired' : `Expires in ${daysUntilExpiry} days`}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
