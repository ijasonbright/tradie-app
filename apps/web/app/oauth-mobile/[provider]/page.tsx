'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

export default function MobileOAuthPage() {
  const { provider } = useParams()

  useEffect(() => {
    // Simple redirect to the regular sign-in page with callback URL
    // This uses your existing working sign-in flow
    const callbackUrl = '/api/mobile-auth/oauth/callback'
    window.location.href = `/sign-in?redirect_url=${encodeURIComponent(callbackUrl)}`
  }, [provider])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800">
          Signing in with {String(provider).charAt(0).toUpperCase() + String(provider).slice(1)}
        </h2>
        <p className="text-gray-600 mt-2">Redirecting to sign in...</p>
      </div>
    </div>
  )
}
