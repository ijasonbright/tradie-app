import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { fetchTCJobDetails, decryptFromStorage, refreshToken, encryptForStorage } from '@/lib/tradieconnect'

/**
 * GET /api/integrations/tradieconnect/job?jobId=123
 * Fetches full job details from TradieConnect API
 */
export async function GET(request: NextRequest) {
  const sql = neon(process.env.DATABASE_URL!)

  // Try Clerk auth first (web)
  let clerkUserId: string | null = null

  try {
    const authResult = await auth()
    clerkUserId = authResult.userId
  } catch (error) {
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

  // Get jobId from query params
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 })
  }

  try {
    // Get the user record
    const users = await sql`
      SELECT id, tc_provider_id FROM users WHERE clerk_user_id = ${clerkUserId}
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get TradieConnect connection for this user
    const connections = await sql`
      SELECT
        tc_user_id,
        tc_token,
        tc_refresh_token,
        token_expires_at
      FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      LIMIT 1
    `

    if (connections.length === 0) {
      return NextResponse.json({
        error: 'TradieConnect not connected',
        needs_connection: true,
      }, { status: 400 })
    }

    const connection = connections[0]

    // Decrypt tokens
    let tcToken: string
    let tcRefreshToken: string | null = null

    try {
      tcToken = decryptFromStorage(connection.tc_token)
      if (connection.tc_refresh_token) {
        tcRefreshToken = decryptFromStorage(connection.tc_refresh_token)
      }
    } catch (decryptError) {
      console.error('Error decrypting TradieConnect tokens:', decryptError)
      return NextResponse.json({
        error: 'Failed to decrypt tokens',
        needs_reconnection: true,
      }, { status: 400 })
    }

    // Fetch job details from TradieConnect
    let result = await fetchTCJobDetails(
      jobId,
      connection.tc_user_id,
      tcToken
    )

    // If unauthorized, try to refresh the token
    if (!result.success && result.unauthorized && tcRefreshToken) {
      console.log('Token expired, attempting refresh for job details...')

      const refreshResult = await refreshToken(connection.tc_user_id, tcRefreshToken)

      if (refreshResult.success && refreshResult.token) {
        // Store new tokens
        const encryptedToken = encryptForStorage(refreshResult.token)
        const encryptedRefreshToken = refreshResult.refreshToken
          ? encryptForStorage(refreshResult.refreshToken)
          : null

        await sql`
          UPDATE tradieconnect_connections
          SET
            tc_token = ${encryptedToken},
            tc_refresh_token = ${encryptedRefreshToken},
            token_expires_at = ${refreshResult.expiry ? new Date(refreshResult.expiry) : null},
            updated_at = NOW()
          WHERE user_id = ${user.id}
        `

        // Retry the request with new token
        result = await fetchTCJobDetails(
          jobId,
          connection.tc_user_id,
          refreshResult.token
        )
      } else {
        return NextResponse.json({
          error: 'Token expired and refresh failed',
          needs_reconnection: true,
        }, { status: 401 })
      }
    }

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to fetch job details',
        needs_reconnection: result.unauthorized,
      }, { status: result.unauthorized ? 401 : 500 })
    }

    // Return the job details
    return NextResponse.json({
      success: true,
      job: result.job,
    })
  } catch (error) {
    console.error('Error fetching TC job details:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
