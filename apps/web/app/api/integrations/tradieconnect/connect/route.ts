import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAuthUrl } from '@/lib/tradieconnect'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/tradieconnect/connect
 *
 * Initiates the TradieConnect SSO flow by redirecting to the auth URL.
 * The user will authenticate with TradieConnect and be redirected back
 * to our fixed callback URL (/admin/secure/setauth).
 */
export async function GET() {
  try {
    // Verify user is authenticated
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the TradieConnect auth URL
    const authUrl = getAuthUrl()

    // Return the auth URL for the client to redirect to
    return NextResponse.json({
      authUrl,
      message: 'Redirect to this URL to authenticate with TradieConnect',
    })
  } catch (error) {
    console.error('Error initiating TradieConnect connection:', error)
    return NextResponse.json(
      { error: 'Failed to initiate TradieConnect connection' },
      { status: 500 }
    )
  }
}
