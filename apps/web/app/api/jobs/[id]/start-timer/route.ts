import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

export async function POST(
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

    // Get user's hourly rate from organization_members
    const members = await sql`
      SELECT om.hourly_rate
      FROM organization_members om
      JOIN jobs j ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      LIMIT 1
    `

    const hourlyRate = members.length > 0 ? members[0].hourly_rate : 0

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
        ${hourlyRate},
        'pending',
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      timeLog: newTimeLog[0],
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
