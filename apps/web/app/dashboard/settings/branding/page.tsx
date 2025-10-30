'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BrandingSettings from '@/components/BrandingSettings'

export default function BrandingPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBranding()
  }, [])

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/settings/organization')
      if (res.ok) {
        const data = await res.json()
        setLogoUrl(data.organization.logo_url || null)
        setPrimaryColor(data.organization.primary_color || null)
      }
    } catch (error) {
      console.error('Error fetching branding:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (newLogoUrl: string | null, newPrimaryColor: string | null) => {
    const res = await fetch('/api/settings/organization', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logoUrl: newLogoUrl,
        primaryColor: newPrimaryColor,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to save branding')
    }

    // Refresh data
    await fetchBranding()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/dashboard/settings"
          className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Settings
        </Link>
        <h1 className="text-3xl font-bold">Logo & Branding</h1>
        <p className="mt-1 text-gray-600">
          Customize your business logo and brand colors
        </p>
      </div>

      <BrandingSettings
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        onSave={handleSave}
      />
    </div>
  )
}
