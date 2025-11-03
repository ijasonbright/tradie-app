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

    // Create an HTML page that initiates Clerk OAuth with specific provider
    // This will use Clerk's signIn.authenticateWithRedirect() under the hood
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Signing in with ${provider}...</title>
          <script src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"></script>
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
            <h2>Signing in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}</h2>
            <p>Please wait...</p>
          </div>

          <script>
            (async function() {
              try {
                const clerk = window.Clerk;

                // Initialize Clerk
                await clerk.load({
                  publishableKey: '${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}'
                });

                // Start OAuth flow with specific provider
                await clerk.client.signIn.authenticateWithRedirect({
                  strategy: 'oauth_${provider}',
                  redirectUrl: '${callbackUrl}',
                  redirectUrlComplete: '${callbackUrl}?complete=true'
                });

              } catch (error) {
                console.error('OAuth error:', error);
                document.body.innerHTML = '<div class="container"><h2>Sign in failed</h2><p>' + error.message + '</p></div>';
              }
            })();
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
