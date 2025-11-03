'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function PaymentSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  useEffect(() => {
    // Redirect back to quote page after 3 seconds
    const timer = setTimeout(() => {
      router.push(`/public/quotes/${token}`)
    }, 3000)

    return () => clearTimeout(timer)
  }, [token, router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{
        textAlign: 'center',
        backgroundColor: '#fff',
        padding: '48px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        maxWidth: '500px',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#10b981',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <span style={{ color: '#fff', fontSize: '32px' }}>✓</span>
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#111827',
          marginBottom: '16px',
        }}>
          Payment Successful!
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          marginBottom: '24px',
        }}>
          Your deposit payment has been received. You will be redirected back to the quote page shortly...
        </p>

        <a
          href={`/public/quotes/${token}`}
          style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          Return to Quote
        </a>
      </div>
    </div>
  )
}
