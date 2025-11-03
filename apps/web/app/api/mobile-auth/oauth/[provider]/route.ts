import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Mobile OAuth Initiation
 * Starts the OAuth flow for a specific provider (apple, google, facebook)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const provider = params.provider.toLowerCase()

    // Validate provider
    const validProviders = ['apple', 'google', 'facebook']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid OAuth provider' },
        { status: 400 }
      )
    }

    // Get the base URL
    const baseUrl = new URL(request.url).origin

    // The callback URL after OAuth completes
    const callbackUrl = `${baseUrl}/api/mobile-auth/oauth/callback`

    // Construct Clerk's OAuth URL directly
    // Format: https://accounts.clerk.com/v1/oauth/authorize/oauth_{provider}?client_id=...&redirect_uri=...
    const clerkFrontendApi = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.split('_')[1] // Extract the instance ID

    // Use Clerk's sign-in page with a specific strategy parameter
    const oauthUrl = `${baseUrl}/sign-in?redirect_url=${encodeURIComponent(callbackUrl)}`

    // Create an HTML page that auto-redirects but passes provider context
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Signing in with ${provider}...</title>
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
            .provider-note {
              margin-top: 1rem;
              padding: 1rem;
              background: #fef3c7;
              border-radius: 6px;
              color: #92400e;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h2>Signing in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}</h2>
            <p>Redirecting to sign in page...</p>
            <div class="provider-note">
              Please select <strong>${provider.charAt(0).toUpperCase() + provider.slice(1)}</strong> on the next page
            </div>
          </div>

          <script>
            // Store the provider preference in session storage
            sessionStorage.setItem('oauth_provider', '${provider}');

            // Redirect after a brief delay
            setTimeout(() => {
              window.location.href = '${oauthUrl}';
            }, 1500);
          </script>
        </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  } catch (error) {
    console.error('OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    )
  }
}
