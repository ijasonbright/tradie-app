import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params
    const body = await req.json()
    const { breakDurationMinutes = 0, notes = '' } = body

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
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
    const totalMinutes = Math.floor(totalMilliseconds / 60000) - parseInt(breakDurationMinutes)
    const totalHours = (totalMinutes / 60).toFixed(2)
    const laborCost = (parseFloat(totalHours) * parseFloat(timeLog.hourly_rate)).toFixed(2)

    // Update time log with end time and calculations
    const updatedTimeLog = await sql`
      UPDATE job_time_logs
      SET
        end_time = NOW(),
        break_duration_minutes = ${breakDurationMinutes},
        total_hours = ${totalHours},
        labor_cost = ${laborCost},
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
