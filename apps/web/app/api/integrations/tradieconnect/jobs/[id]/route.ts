import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { decryptFromStorage, fetchJob } from '@/lib/tradieconnect'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/tradieconnect/jobs/[id]
 *
 * Fetches a job from TradieConnect by ID.
 * Used for testing the integration and fetching job details.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

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
        tc_token
      FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      AND is_active = true
      LIMIT 1
    `

    if (connections.length === 0) {
      return NextResponse.json({
        error: 'No active TradieConnect connection found',
        needs_connect: true,
      }, { status: 400 })
    }

    const connection = connections[0]

    // Decrypt the stored token
    let tcToken: string
    try {
      tcToken = decryptFromStorage(connection.tc_token)
    } catch (error) {
      console.error('Failed to decrypt stored token:', error)
      return NextResponse.json({
        error: 'Failed to decrypt stored credentials',
      }, { status: 500 })
    }

    // Fetch the job from TradieConnect
    const result = await fetchJob(jobId, connection.tc_user_id, tcToken)

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to fetch job from TradieConnect',
      }, { status: 400 })
    }

    // Update last_synced_at timestamp
    await sql`
      UPDATE tradieconnect_connections
      SET last_synced_at = NOW(), updated_at = NOW()
      WHERE id = ${connection.id}
    `

    return NextResponse.json({
      success: true,
      job: result.job,
    })
  } catch (error) {
    console.error('Error fetching TradieConnect job:', error)
    return NextResponse.json(
      { error: 'Failed to fetch TradieConnect job' },
      { status: 500 }
    )
  }
}
