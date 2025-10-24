'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'

interface InvitationData {
  id: string
  organization_name: string
  role: string
  email: string
  full_name: string
  phone: string | null
  requires_trade_license: boolean
  requires_police_check: boolean
  requires_working_with_children: boolean
  requires_public_liability: boolean
}

export default function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'verify' | 'signup' | 'documents' | 'complete'>('verify')

  useEffect(() => {
    verifyInvitation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verifyInvitation = async () => {
    try {
      const res = await fetch(`/api/invitations/verify/${resolvedParams.token}`)
      if (res.ok) {
        const data = await res.json()
        setInvitation(data.invitation)
        setStep('signup')
      } else {
        const error = await res.json()
        setError(error.error || 'Invalid or expired invitation')
      }
    } catch (err) {
      console.error('Error verifying invitation:', err)
      setError('Failed to verify invitation')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-600">Verifying your invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-6xl">⚠️</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Invalid Invitation</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to {invitation.organization_name}!</h1>
          <p className="mt-2 text-gray-600">
            You&apos;ve been invited to join as a <span className="font-semibold">{invitation.role}</span>
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step === 'signup' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === 'signup' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Sign Up</span>
            </div>

            <div className="h-px w-12 bg-gray-300"></div>

            <div className={`flex items-center gap-2 ${step === 'documents' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === 'documents' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Upload Documents</span>
            </div>

            <div className="h-px w-12 bg-gray-300"></div>

            <div className={`flex items-center gap-2 ${step === 'complete' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === 'complete' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                3
              </div>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg bg-white p-8 shadow-lg">
          {step === 'signup' && (
            <div>
              <h2 className="mb-6 text-2xl font-bold">Create Your Account</h2>
              <div className="flex justify-center">
                <SignUp
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      card: 'shadow-none',
                    },
                  }}
                  redirectUrl={`/accept-invitation/${resolvedParams.token}/documents`}
                />
              </div>
            </div>
          )}

          {step === 'documents' && (
            <div>
              <h2 className="mb-6 text-2xl font-bold">Upload Required Documents</h2>
              <p className="mb-6 text-gray-600">
                Please upload the following documents to complete your profile:
              </p>

              <div className="space-y-4">
                {invitation.requires_trade_license && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold">Trade License / Certification *</h3>
                    <p className="text-sm text-gray-600">Required for verification</p>
                    {/* Document upload component */}
                  </div>
                )}

                {invitation.requires_police_check && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold">Police Check</h3>
                    <p className="text-sm text-gray-600">Optional</p>
                    {/* Document upload component */}
                  </div>
                )}

                {invitation.requires_working_with_children && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold">Working with Children Check</h3>
                    <p className="text-sm text-gray-600">Optional</p>
                    {/* Document upload component */}
                  </div>
                )}

                {invitation.requires_public_liability && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold">Public Liability Insurance</h3>
                    <p className="text-sm text-gray-600">Required for subcontractors</p>
                    {/* Document upload component */}
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStep('complete')}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h2 className="mb-2 text-2xl font-bold">Welcome Aboard!</h2>
              <p className="mb-6 text-gray-600">
                Your account has been set up successfully. You can now access the dashboard.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
