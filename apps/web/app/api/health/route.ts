import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const isOAuthCallback = searchParams.get('oauth_callback') === 'true'

  // Handle OAuth callback for mobile
  if (isOAuthCallback) {
    try {
      const { userId } = await auth()

      if (!userId) {
        // User not authenticated, redirect to sign-in
        const signInUrl = new URL('/sign-in', request.url)
        signInUrl.searchParams.set('redirect_url', '/api/health?oauth_callback=true')
        return NextResponse.redirect(signInUrl)
      }

      // Get user from database
      const sql = neon(process.env.DATABASE_URL!)
      const dbUsers = await sql`
        SELECT * FROM users WHERE clerk_user_id = ${userId} LIMIT 1
      `

      if (dbUsers.length === 0) {
        return NextResponse.json(
          { error: 'User not found in database' },
          { status: 404 }
        )
      }

      const dbUser = dbUsers[0]

      // Generate JWT session token for mobile app
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      )

      const token = await new SignJWT({
        userId: dbUser.id,
        clerkUserId: userId,
        email: dbUser.email,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secret)

      // Redirect back to mobile app with token
      const redirectUrl = `tradieapp://auth-callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: dbUser.id,
        clerkUserId: userId,
        email: dbUser.email,
        fullName: dbUser.full_name,
        phone: dbUser.phone,
        profilePhotoUrl: dbUser.profile_photo_url,
      }))}`

      return NextResponse.redirect(redirectUrl)

    } catch (error) {
      console.error('Mobile OAuth callback error:', error)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    }
  }

  // Default health check response
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'API is running',
  })
}
