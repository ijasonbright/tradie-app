'use client'

import { SignIn, useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function MobileOAuthPage() {
  const { provider } = useParams()
  const { signOut, isSignedIn } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Callback URL after sign-in completes
  const callbackUrl = '/api/mobile-auth/oauth/callback'

  // Force sign out first to clear any cached sessions
  useEffect(() => {
    if (isSignedIn && !isSigningOut) {
      setIsSigningOut(true)
      signOut().then(() => {
        setIsSigningOut(false)
      })
    }
  }, [isSignedIn, signOut, isSigningOut])

  // Show loading while signing out
  if (isSigningOut || isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">Preparing sign in...</h2>
          <p className="text-gray-600 mt-2">Clearing previous session</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Sign in with {String(provider).charAt(0).toUpperCase() + String(provider).slice(1)}
        </h1>
        <SignIn
          afterSignInUrl={callbackUrl}
          afterSignUpUrl={callbackUrl}
          redirectUrl={callbackUrl}
          forceRedirectUrl={callbackUrl}
        />
      </div>
    </div>
  )
}
