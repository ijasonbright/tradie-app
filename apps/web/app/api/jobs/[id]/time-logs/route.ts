import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Add time log to a job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]
    const body = await req.json()

    // Verify user has access to this job
    const jobs = await sql`
      SELECT j.*, om.role, om.hourly_rate as member_hourly_rate
      FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 })
    }

    const job = jobs[0]

    // Validate required fields
    if (!body.startTime) {
      return NextResponse.json({ error: 'Start time is required' }, { status: 400 })
    }

    // Calculate total hours if endTime is provided
    let totalHours = null
    let laborCost = null

    if (body.endTime) {
      const start = new Date(body.startTime)
      const end = new Date(body.endTime)

      // Validate that end time is after start time
      if (end <= start) {
        return NextResponse.json(
          { error: 'End time must be after start time' },
          { status: 400 }
        )
      }

      const breakMinutes = body.breakDurationMinutes || 0

      const durationMs = end.getTime() - start.getTime()
      const durationHours = (durationMs / (1000 * 60 * 60)) - (breakMinutes / 60)
      totalHours = Math.max(0, durationHours).toFixed(2)

      // Calculate labor cost if hourly rate is available
      const hourlyRate = body.hourlyRate || job.member_hourly_rate
      if (hourlyRate) {
        laborCost = (Number(totalHours) * Number(hourlyRate)).toFixed(2)
      }
    }

    // Create time log
    const timeLogs = await sql`
      INSERT INTO job_time_logs (
        job_id, user_id, log_type,
        start_time, end_time, break_duration_minutes,
        total_hours, hourly_rate, labor_cost,
        notes, status,
        created_at, updated_at
      ) VALUES (
        ${jobId},
        ${user.id},
        ${body.logType || 'manual'},
        ${body.startTime},
        ${body.endTime || null},
        ${body.breakDurationMinutes || 0},
        ${totalHours},
        ${body.hourlyRate || job.member_hourly_rate || null},
        ${laborCost},
        ${body.notes || null},
        'pending',
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      timeLog: timeLogs[0],
    })
  } catch (error) {
    console.error('Error creating time log:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
