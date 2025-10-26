'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VerifyEmailPage() {
  const router = useRouter()

  useEffect(() => {
    // Clerk handles the email verification automatically
    // After verification, redirect to dashboard
    const timer = setTimeout(() => {
      router.push('/dashboard')
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Verifying your email...</h1>
        <p className="text-gray-600">Please wait while we verify your email address.</p>
      </div>
    </div>
  )
}
