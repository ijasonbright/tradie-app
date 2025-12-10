import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/tradieconnect/status
 *
 * Returns the current user's TradieConnect connection status.
 */
export async function GET(request: Request) {
  try {
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

    // Check for active TradieConnect connection
    const connections = await sql`
      SELECT
        id,
        tc_user_id,
        connected_at,
        last_synced_at,
        is_active
      FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      AND is_active = true
      LIMIT 1
    `

    if (connections.length === 0) {
      return NextResponse.json({
        connected: false,
        message: 'No TradieConnect connection found',
      })
    }

    const connection = connections[0]

    return NextResponse.json({
      connected: true,
      tc_user_id: connection.tc_user_id,
      connected_at: connection.connected_at,
      last_synced_at: connection.last_synced_at,
    })
  } catch (error) {
    console.error('Error fetching TradieConnect status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { message: errorMessage, stack: errorStack })
    return NextResponse.json(
      { error: 'Failed to fetch TradieConnect status', details: errorMessage },
      { status: 500 }
    )
  }
}
