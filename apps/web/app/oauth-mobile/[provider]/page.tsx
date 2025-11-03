'use client'

import { useEffect, useState } from 'react'
import { useSignIn, useClerk, useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'

export default function MobileOAuthPage() {
  const { provider } = useParams()
  const { signIn, isLoaded } = useSignIn()
  const { signOut } = useClerk()
  const { isSignedIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Initializing...')

  useEffect(() => {
    const startOAuth = async () => {
      // Wait for Clerk to fully load
      if (!isLoaded || !signIn) {
        console.log('Waiting for Clerk to load...', { isLoaded, signIn: !!signIn })
        setStatus('Loading...')
        return
      }

      try {
        // If already signed in, sign out first
        if (isSignedIn) {
          console.log('Already signed in, signing out first...')
          setStatus('Signing out...')
          await signOut()
          // Wait a moment for sign out to complete
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        console.log('Starting OAuth flow for provider:', provider)
        setStatus('Redirecting to sign in...')
        const callbackUrl = `${window.location.origin}/api/mobile-auth/oauth/callback`

        // Start OAuth with the specific provider
        await signIn.authenticateWithRedirect({
          strategy: `oauth_${provider}` as any,
          redirectUrl: callbackUrl,
          redirectUrlComplete: callbackUrl,
        })
      } catch (error: any) {
        console.error('OAuth error:', error)
        setError(error?.message || 'Failed to start OAuth')
      }
    }

    startOAuth()
  }, [signIn, isLoaded, provider, isSignedIn, signOut])

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
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '400px'
      }}>
        {error ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#ef4444', margin: '0 0 0.5rem' }}>
              Sign in failed
            </h2>
            <p style={{ color: '#666', margin: 0 }}>{error}</p>
          </>
        ) : (
          <>
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
            <p style={{ color: '#666', margin: 0 }}>
              {status}
            </p>
          </>
        )}

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
