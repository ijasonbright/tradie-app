'use client'

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
        <div className="mb-4 text-6xl">✉️</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="mb-6 text-gray-600">
          We've sent you an email with a verification link. Please click the link in your email to complete your registration.
        </p>
        <p className="text-sm text-gray-500">
          After verifying your email, you'll be able to sign in and access your dashboard.
        </p>
      </div>
    </div>
  )
}
