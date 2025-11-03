'use client'

import { SignIn } from '@clerk/nextjs'
import { useParams } from 'next/navigation'

export default function MobileOAuthPage() {
  const { provider } = useParams()

  // Callback URL after sign-in completes
  const callbackUrl = '/api/mobile-auth/oauth/callback'

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
        />
      </div>
    </div>
  )
}
