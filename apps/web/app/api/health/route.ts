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
      const authResult = await auth()
      const { userId } = authResult

      if (!userId) {
        // User not authenticated - this means they haven't completed sign-in yet
        // Return an HTML page that auto-redirects to sign-in with proper redirect_url
        const baseUrl = new URL(request.url).origin
        const callbackUrl = `${baseUrl}/api/health?oauth_callback=true`

        return new NextResponse(
          `<!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Signing in...</title>
              <script>
                // Redirect to Clerk sign-in with callback URL
                window.location.href = '${baseUrl}/sign-in?redirect_url=' + encodeURIComponent('${callbackUrl}');
              </script>
            </head>
            <body>
              <p>Redirecting to sign in...</p>
            </body>
          </html>`,
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }
        )
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
// Integration endpoints added Mon Dec  1 21:35:45 AEDT 2025
