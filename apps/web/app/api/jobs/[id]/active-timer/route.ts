import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobId = params.id

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
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
