'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import ExpiryNotifications from '@/components/ExpiryNotifications'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useUser()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [organization, setOrganization] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fetch organization data for branding
  useEffect(() => {
    async function loadOrganization() {
      try {
        const response = await fetch('/api/organizations/current')
        if (response.ok) {
          const data = await response.json()
          setOrganization(data.organization)
        }
      } catch (error) {
        console.error('Error loading organization:', error)
      } finally {
        setLoading(false)
      }
    }
    loadOrganization()
  }, [])

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(path)
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/dashboard/clients', label: 'Clients', icon: '👥' },
    { href: '/dashboard/properties', label: 'Properties', icon: '🏘️' },
    { href: '/dashboard/jobs', label: 'Jobs', icon: '🔨' },
    { href: '/dashboard/completion-forms', label: 'Completion Forms', icon: '📝' },
    { href: '/dashboard/form-builder', label: 'Form Builder', icon: '🔧' },
    { href: '/dashboard/calendar', label: 'Calendar', icon: '📅' },
    { href: '/dashboard/team/map', label: 'Map', icon: '🗺️' },
    { href: '/dashboard/expenses', label: 'Expenses', icon: '💳' },
    { href: '/dashboard/quotes', label: 'Quotes', icon: '📋' },
    { href: '/dashboard/invoices', label: 'Invoices', icon: '🧾' },
    { href: '/dashboard/reports', label: 'Reports', icon: '📊' },
    { href: '/dashboard/sms', label: 'SMS', icon: '💬' },
    { href: '/dashboard/team', label: 'Team', icon: '👷' },
    { href: '/dashboard/compliance', label: 'Compliance', icon: '📄' },
    { href: '/dashboard/subcontractors', label: 'Subcontractors', icon: '🤝' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ]

  const primaryColor = organization?.primary_color || organization?.primaryColor || '#2563eb'
  const logoUrl = organization?.logo_url || organization?.logoUrl

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Banner */}
      <div
        className="fixed top-0 left-0 right-0 z-30 shadow"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded p-2 hover:bg-white/10 lg:hidden"
              aria-label="Toggle sidebar"
            >
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <Link href="/dashboard" className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <span className="text-xl font-bold text-white">Tradie App</span>
              )}
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <ExpiryNotifications />
            <UserButton />
          </div>
        </div>
      </div>

      {/* Left Sidebar */}
      <aside
        className={`fixed top-16 left-0 z-20 h-[calc(100vh-4rem)] w-64 overflow-y-auto bg-white shadow-lg transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <nav className="space-y-1 p-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-xl">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="pt-16 lg:pl-64">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
