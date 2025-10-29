import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function MobileCallbackPage() {
  const { userId } = await auth()

  if (userId) {
    // User is authenticated, redirect to API for token generation
    redirect('/api/health?oauth_callback=true')
  } else {
    // Not authenticated, redirect to sign-in
    redirect('/sign-in?redirect_url=/mobile-callback')
  }

  return null
}
