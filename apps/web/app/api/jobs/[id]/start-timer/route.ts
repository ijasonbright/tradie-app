import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'


export async function POST(
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

    // Check if user already has an active timer for this job
    const activeTimers = await sql`
      SELECT id FROM job_time_logs
      WHERE job_id = ${jobId}
      AND user_id = ${user.id}
      AND end_time IS NULL
      LIMIT 1
    `

    if (activeTimers.length > 0) {
      return NextResponse.json(
        { error: 'You already have an active timer for this job' },
        { status: 400 }
      )
    }

    // Get hourly rates from job's trade type
    const jobRates = await sql`
      SELECT
        tt.default_employee_hourly_rate as cost_rate,
        tt.client_hourly_rate as billing_rate
      FROM jobs j
      JOIN trade_types tt ON tt.id = j.trade_type_id
      WHERE j.id = ${jobId}
      LIMIT 1
    `

    // If no trade type or rates not set, use 0 (will show warning)
    const costRate = jobRates.length > 0 ? (jobRates[0].cost_rate || 0) : 0
    const billingRate = jobRates.length > 0 ? (jobRates[0].billing_rate || 0) : 0

    // Create new time log with start time
    const newTimeLog = await sql`
      INSERT INTO job_time_logs (
        job_id,
        user_id,
        log_type,
        start_time,
        hourly_rate,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${jobId},
        ${user.id},
        'timer',
        NOW(),
        ${costRate},
        'pending',
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      timeLog: newTimeLog[0],
      billingRate: billingRate, // Return billing rate for reference
      message: 'Timer started successfully',
    })
  } catch (error) {
    console.error('Error starting timer:', error)
    return NextResponse.json(
      { error: 'Failed to start timer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
