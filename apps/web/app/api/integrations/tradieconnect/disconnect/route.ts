import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tradieconnect/disconnect
 *
 * Disconnects the current user's TradieConnect account.
 */
export async function POST(request: Request) {
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

    // Deactivate TradieConnect connection (soft delete)
    const result = await sql`
      UPDATE tradieconnect_connections
      SET
        is_active = false,
        updated_at = NOW()
      WHERE user_id = ${user.id}
      AND is_active = true
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active TradieConnect connection found',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'TradieConnect account disconnected successfully',
    })
  } catch (error) {
    console.error('Error disconnecting TradieConnect:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect TradieConnect account' },
      { status: 500 }
    )
  }
}
