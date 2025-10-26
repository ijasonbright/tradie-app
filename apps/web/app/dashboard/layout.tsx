'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ExpiryNotifications from '@/components/ExpiryNotifications'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useUser()
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(path)
  }

  const navLinks = [
    { href: '/dashboard', label: 'Organizations' },
    { href: '/dashboard/clients', label: 'Clients' },
    { href: '/dashboard/jobs', label: 'Jobs' },
    { href: '/dashboard/calendar', label: 'Calendar' },
    { href: '/dashboard/expenses', label: 'Expenses' },
    { href: '/dashboard/quotes', label: 'Quotes' },
    { href: '/dashboard/invoices', label: 'Invoices' },
    { href: '/dashboard/sms', label: 'SMS' },
    { href: '/dashboard/team', label: 'Team' },
    { href: '/dashboard/settings', label: 'Settings' },
  ]

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
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-medium ${
                      isActive(link.href)
                        ? 'text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ExpiryNotifications />
              <span className="text-sm text-gray-600">
                {user?.emailAddresses[0]?.emailAddress}
              </span>
              <UserButton />
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
