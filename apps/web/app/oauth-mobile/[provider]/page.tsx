'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

export default function MobileOAuthPage() {
  const { provider } = useParams()

  useEffect(() => {
    // Get the publishable key and extract the frontend API
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    if (!publishableKey) {
      console.error('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')
      return
    }

    // Extract frontend API from publishable key (format: pk_test_XXXXX or pk_live_XXXXX)
    const parts = publishableKey.split('_')
    if (parts.length < 3) {
      console.error('Invalid publishable key format')
      return
    }

    // Construct the Clerk OAuth URL
    // Format: https://[frontend-api].clerk.accounts.com/oauth/authorize/[provider]
    const frontendApi = parts.slice(2).join('_')
    const callbackUrl = `${window.location.origin}/api/mobile-auth/oauth/callback`

    // Redirect directly to Clerk's OAuth URL
    const strategyMap: Record<string, string> = {
      apple: 'oauth_apple',
      google: 'oauth_google',
      facebook: 'oauth_facebook',
    }

    const strategy = strategyMap[provider as string] || 'oauth_apple'

    // Clerk OAuth URL format
    const oauthUrl = `https://${frontendApi}.clerk.accounts.com/v1/oauth/authorize/${strategy}?redirect_url=${encodeURIComponent(callbackUrl)}`

    console.log('Redirecting to Clerk OAuth:', oauthUrl)

    // Redirect immediately
    window.location.href = oauthUrl
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
