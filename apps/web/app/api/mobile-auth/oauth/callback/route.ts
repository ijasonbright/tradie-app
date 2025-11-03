import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Mobile OAuth Callback
 * Handles the callback after OAuth provider authentication
 * Generates JWT token and redirects back to mobile app
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await auth()
    const { userId } = authResult

    if (!userId) {
      // OAuth not completed yet, show waiting message
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Completing sign in...</title>
            <meta http-equiv="refresh" content="2">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #2563eb;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              h2 {
                color: #333;
                margin: 0 0 0.5rem;
              }
              p {
                color: #666;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="spinner"></div>
              <h2>Completing sign in</h2>
              <p>Please wait while we finish setting up your account...</p>
            </div>
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
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Sign in failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .error {
                color: #ef4444;
                font-size: 3rem;
                margin: 0 0 1rem;
              }
              h2 {
                color: #333;
                margin: 0 0 0.5rem;
              }
              p {
                color: #666;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">⚠️</div>
              <h2>User not found</h2>
              <p>Your account was not found in our database. Please contact support.</p>
            </div>
          </body>
        </html>`,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }
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

    // Use HTML with meta refresh for deep link redirect
    // This works with WebBrowser.openAuthSessionAsync by triggering the redirect URL callback
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="0;url=${redirectUrl}">
          <title>Redirecting to app...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .spinner {
              border: 3px solid #f3f3f3;
              border-top: 3px solid #10b981;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 0 auto 1rem;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h2 {
              color: #333;
              margin: 0 0 0.5rem;
            }
            p {
              color: #666;
              margin: 0;
            }
            .success {
              color: #10b981;
              font-size: 3rem;
              margin: 0 0 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h2>Sign in successful!</h2>
            <p>Returning to the app...</p>
            <div class="spinner" style="margin-top: 1rem;"></div>
          </div>

          <script>
            // Immediate redirect to deep link (backup to meta refresh)
            window.location.replace('${redirectUrl}');
          </script>
        </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )

  } catch (error) {
    console.error('Mobile OAuth callback error:', error)
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Sign in failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .error {
              color: #ef4444;
              font-size: 3rem;
              margin: 0 0 1rem;
            }
            h2 {
              color: #333;
              margin: 0 0 0.5rem;
            }
            p {
              color: #666;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">⚠️</div>
            <h2>Sign in failed</h2>
            <p>Something went wrong during authentication. Please try again.</p>
          </div>
        </body>
      </html>`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }
}
