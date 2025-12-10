import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { validateToken, refreshToken } from '@/lib/tradieconnect'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tradieconnect/validate
 *
 * Validates the current user's TradieConnect token.
 * If the token is invalid, attempts to refresh it.
 *
 * Query params:
 * - force_refresh=true: Force a token refresh even if current token is valid (for testing)
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('force_refresh') === 'true'

    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get the user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get active TradieConnect connection
    const connections = await sql`
      SELECT
        id,
        tc_user_id,
        tc_token,
        tc_refresh_token
      FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      AND is_active = true
      LIMIT 1
    `

    if (connections.length === 0) {
      return NextResponse.json({
        valid: false,
        error: 'No active TradieConnect connection found',
      })
    }

    const connection = connections[0]

    // Tokens are stored as plain text (no decryption needed)
    const tcToken = connection.tc_token
    const tcRefreshToken = connection.tc_refresh_token

    // If force_refresh is requested, skip validation and go straight to refresh
    if (forceRefresh) {
      console.log('Force refresh requested, skipping token validation')
      console.log('Has refresh token in database:', !!tcRefreshToken)
    } else {
      // Validate the token with TradieConnect
      const validationResult = await validateToken(connection.tc_user_id, tcToken)

      if (validationResult.valid) {
        // Update last_synced_at timestamp
        await sql`
          UPDATE tradieconnect_connections
          SET last_synced_at = NOW(), updated_at = NOW()
          WHERE id = ${connection.id}
        `

        return NextResponse.json({
          valid: true,
          message: 'TradieConnect token is valid',
        })
      }
    }

    // Token is invalid (or force refresh), try to refresh if we have a refresh token
    if (tcRefreshToken) {
      console.log('Attempting token refresh for user:', connection.tc_user_id)
      const refreshResult = await refreshToken(connection.tc_user_id, tcRefreshToken)
      console.log('Refresh result:', {
        success: refreshResult.success,
        hasToken: !!refreshResult.token,
        hasRefreshToken: !!refreshResult.refreshToken,
        error: refreshResult.error,
      })

      if (refreshResult.success && refreshResult.token) {
        // Store new tokens as plain text
        const newToken = refreshResult.token
        const newRefreshToken = refreshResult.refreshToken || tcRefreshToken

        await sql`
          UPDATE tradieconnect_connections
          SET
            tc_token = ${newToken},
            tc_refresh_token = ${newRefreshToken},
            last_synced_at = NOW(),
            updated_at = NOW()
          WHERE id = ${connection.id}
        `

        return NextResponse.json({
          valid: true,
          message: 'TradieConnect token refreshed successfully',
          refreshed: true,
        })
      }
    }

    // Token invalid and couldn't refresh
    // Check if we attempted a refresh and it failed
    const noRefreshToken = !connection.tc_refresh_token
    return NextResponse.json({
      valid: false,
      error: noRefreshToken
        ? 'No refresh token available. Please reconnect to TradieConnect.'
        : 'TradieConnect token is invalid and could not be refreshed',
      needs_reconnect: true,
    })
  } catch (error) {
    console.error('Error validating TradieConnect token:', error)
    return NextResponse.json(
      { error: 'Failed to validate TradieConnect token' },
      { status: 500 }
    )
  }
}
