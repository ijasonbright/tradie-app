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

    // Parse body, handle empty body gracefully
    let breakDurationMinutes = 0
    let notes = ''
    try {
      const body = await req.json()
      breakDurationMinutes = body.breakDurationMinutes || 0
      notes = body.notes || ''
    } catch (err) {
      // No body or invalid JSON - use defaults
      console.log('No body in stop-timer request, using defaults')
    }

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Find active timer for this user and job
    const activeTimers = await sql`
      SELECT * FROM job_time_logs
      WHERE job_id = ${jobId}
      AND user_id = ${user.id}
      AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `

    if (activeTimers.length === 0) {
      return NextResponse.json(
        { error: 'No active timer found for this job' },
        { status: 400 }
      )
    }

    const timeLog = activeTimers[0]

    // Calculate total hours
    const startTime = new Date(timeLog.start_time)
    const endTime = new Date()
    const totalMilliseconds = endTime.getTime() - startTime.getTime()
    const totalMinutesWorked = Math.floor(totalMilliseconds / 60000)
    const breakMinutes = breakDurationMinutes || 0

    // Validate break duration doesn't exceed time worked
    if (breakMinutes > totalMinutesWorked) {
      return NextResponse.json(
        {
          error: 'Break duration cannot exceed time worked',
          details: `You worked ${totalMinutesWorked} minute(s) but entered ${breakMinutes} minute(s) break time`
        },
        { status: 400 }
      )
    }

    const totalMinutes = totalMinutesWorked - breakMinutes
    const totalHours = (totalMinutes / 60).toFixed(2)
    const costRate = parseFloat(timeLog.hourly_rate || 0)
    const laborCost = (parseFloat(totalHours) * costRate).toFixed(2)

    // Get billing rate from job's trade type (optional - defaults to 0 if not found)
    let billingRate = 0
    try {
      const jobRates = await sql`
        SELECT tt.client_hourly_rate as billing_rate
        FROM jobs j
        LEFT JOIN trade_types tt ON tt.id = j.trade_type_id
        WHERE j.id = ${jobId}
        LIMIT 1
      `
      if (jobRates.length > 0 && jobRates[0].billing_rate) {
        billingRate = parseFloat(jobRates[0].billing_rate)
      }
    } catch (err) {
      console.log('Could not fetch billing rate, defaulting to 0:', err)
    }
    const billingAmount = (parseFloat(totalHours) * billingRate).toFixed(2)

    // Update time log with end time and calculations
    const updatedTimeLog = await sql`
      UPDATE job_time_logs
      SET
        end_time = NOW(),
        break_duration_minutes = ${breakDurationMinutes},
        total_hours = ${totalHours},
        labor_cost = ${laborCost},
        billing_amount = ${billingAmount},
        notes = ${notes || timeLog.notes},
        updated_at = NOW()
      WHERE id = ${timeLog.id}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      timeLog: updatedTimeLog[0],
      message: 'Timer stopped successfully',
    })
  } catch (error) {
    console.error('Error stopping timer:', error)
    return NextResponse.json(
      { error: 'Failed to stop timer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
