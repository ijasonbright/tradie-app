'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth, useClerk } from '@clerk/nextjs'

export default function MobileOAuthPage() {
  const { provider } = useParams()
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()

  useEffect(() => {
    if (!isLoaded) return

    const handleOAuth = async () => {
      try {
        // If already signed in, sign out first
        if (isSignedIn) {
          await clerk.signOut()
          // Wait a bit for sign out to complete
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        // Start OAuth flow using Clerk's signIn method
        const callbackUrl = `${window.location.origin}/api/mobile-auth/oauth/callback`

        const strategyMap = {
          apple: 'oauth_apple',
          google: 'oauth_google',
          facebook: 'oauth_facebook',
        } as const

        const strategy = strategyMap[provider as keyof typeof strategyMap] || 'oauth_apple'

        // Use Clerk's signIn.authenticateWithRedirect for OAuth
        await clerk.signIn.authenticateWithRedirect({
          strategy,
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
