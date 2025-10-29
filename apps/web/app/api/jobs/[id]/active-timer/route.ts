import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'


export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)

    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
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

    const { id: jobId } = await params

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Find active timer for this user and job
    const activeTimers = await sql`
      SELECT
        jtl.*,
        u.full_name as user_name
      FROM job_time_logs jtl
      JOIN users u ON u.id = jtl.user_id
      WHERE jtl.job_id = ${jobId}
      AND jtl.user_id = ${user.id}
      AND jtl.end_time IS NULL
      ORDER BY jtl.start_time DESC
      LIMIT 1
    `

    if (activeTimers.length === 0) {
      return NextResponse.json({
        hasActiveTimer: false,
        activeTimer: null,
      })
    }

    return NextResponse.json({
      hasActiveTimer: true,
      activeTimer: activeTimers[0],
    })
  } catch (error) {
    console.error('Error fetching active timer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active timer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
