'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function MobileCallbackPage() {
  const { isSignedIn, userId, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // User is signed in, redirect to API endpoint for token generation
      window.location.href = '/api/health?oauth_callback=true'
    } else if (isLoaded && !isSignedIn) {
      // Not signed in, redirect to sign-in with this page as callback
      router.push('/sign-in?redirect_url=/mobile-callback')
    }
  }, [isLoaded, isSignedIn, router])

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'system-ui'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
        <h2>Completing sign in...</h2>
        <p>Please wait while we complete your authentication.</p>
      </div>
    </div>
  )
}
