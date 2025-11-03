'use client'

import { useEffect } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useParams, useSearchParams } from 'next/navigation'

export default function MobileOAuthPage() {
  const { provider } = useParams()
  const searchParams = useSearchParams()
  const { signIn } = useSignIn()

  useEffect(() => {
    const startOAuth = async () => {
      if (!signIn) return

      try {
        const callbackUrl = `${window.location.origin}/api/mobile-auth/oauth/callback`

        // Start OAuth with the specific provider
        await signIn.authenticateWithRedirect({
          strategy: `oauth_${provider}` as any,
          redirectUrl: callbackUrl,
          redirectUrlComplete: callbackUrl,
        })
      } catch (error) {
        console.error('OAuth error:', error)
      }
    }

    startOAuth()
  }, [signIn, provider])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      background: '#f5f5f5'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #2563eb',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <h2 style={{ color: '#333', margin: '0 0 0.5rem' }}>
          Signing in with {String(provider).charAt(0).toUpperCase() + String(provider).slice(1)}
        </h2>
        <p style={{ color: '#666', margin: 0 }}>Please wait...</p>

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
