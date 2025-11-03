'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'

export default function MobileOAuthPage() {
  const { provider} = useParams()
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()

  useEffect(() => {
    if (!isLoaded) return

    const handleOAuth = async () => {
      try {
        // If already signed in, sign out first
        if (isSignedIn) {
          await clerk.signOut()
        }

        // Start OAuth flow
        // This opens the provider's OAuth flow and returns to the callback URL
        const callbackUrl = `${window.location.origin}/api/mobile-auth/oauth/callback`

        await clerk.authenticateWithRedirect({
          strategy: provider === 'apple' ? 'oauth_apple' : provider === 'google' ? 'oauth_google' : 'oauth_facebook',
          redirectUrl: callbackUrl,
          redirectUrlComplete: callbackUrl,
        })
      } catch (err) {
        console.error('OAuth error:', err)
      }
    }

    handleOAuth()
  }, [isLoaded, isSignedIn, provider, clerk])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800">
          Signing in with {String(provider).charAt(0).toUpperCase() + String(provider).slice(1)}
        </h2>
        <p className="text-gray-600 mt-2">Please wait...</p>
      </div>
    </div>
  )
}
