import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch all assignments for a job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Check job exists and user has access
    const jobs = await sql`
      SELECT j.* FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch assignments with user names
    const assignments = await sql`
      SELECT
        ja.*,
        u.full_name as user_name,
        u.email as user_email
      FROM job_assignments ja
      LEFT JOIN users u ON ja.user_id = u.id
      WHERE ja.job_id = ${jobId}
      AND ja.removed_at IS NULL
      ORDER BY ja.assigned_at DESC
    `

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Assign user to job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

    if (!body.assignedUserId) {
      return NextResponse.json({ error: 'assignedUserId is required' }, { status: 400 })
    }

    // Check job exists and user has permission to assign
    const jobs = await sql`
      SELECT j.*, om.role FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Check if user can assign jobs
    const member = await sql`
      SELECT * FROM organization_members
      WHERE user_id = ${user.id} AND organization_id = ${job.organization_id} AND status = 'active'
      LIMIT 1
    `

    if (member.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only owner, admin, or users with can_create_jobs permission can assign
    if (job.role !== 'owner' && job.role !== 'admin' && !member[0].can_create_jobs) {
      return NextResponse.json({ error: 'No permission to assign jobs' }, { status: 403 })
    }

    // Check if already assigned
    const existing = await sql`
      SELECT * FROM job_assignments
      WHERE job_id = ${jobId} AND user_id = ${body.assignedUserId} AND removed_at IS NULL
      LIMIT 1
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: 'User already assigned to this job' }, { status: 400 })
    }

    // Create assignment
    const assignments = await sql`
      INSERT INTO job_assignments (
        job_id, user_id, role
      ) VALUES (
        ${jobId},
        ${body.assignedUserId},
        ${body.role || 'assistant'}
      ) RETURNING *
    `

    // Also update the job's assigned_to_user_id if this is the primary assignment
    if (body.role === 'primary' || !job.assigned_to_user_id) {
      await sql`
        UPDATE jobs
        SET assigned_to_user_id = ${body.assignedUserId}, updated_at = NOW()
        WHERE id = ${jobId}
      `
    }

    return NextResponse.json({ assignment: assignments[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating assignment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
