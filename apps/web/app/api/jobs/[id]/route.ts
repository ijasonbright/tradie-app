import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Get a single job by ID with related data
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get job with organization access check
    const jobs = await sql`
      SELECT
        j.*,
        o.name as organization_name,
        c.company_name, c.first_name, c.last_name, c.is_company, c.email as client_email, c.phone as client_phone, c.mobile as client_mobile,
        u.full_name as created_by_name,
        a.full_name as assigned_to_name
      FROM jobs j
      INNER JOIN organizations o ON j.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON j.client_id = c.id
      LEFT JOIN users u ON j.created_by_user_id = u.id
      LEFT JOIN users a ON j.assigned_to_user_id = a.id
      WHERE j.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Get time logs for this job
    const timeLogs = await sql`
      SELECT
        tl.*,
        u.full_name as user_name
      FROM job_time_logs tl
      LEFT JOIN users u ON tl.user_id = u.id
      WHERE tl.job_id = ${id}
      ORDER BY tl.start_time DESC
    `

    // Get materials for this job
    const materials = await sql`
      SELECT
        m.*,
        u.full_name as added_by_name
      FROM job_materials m
      LEFT JOIN users u ON m.added_by_user_id = u.id
      WHERE m.job_id = ${id}
      ORDER BY m.created_at DESC
    `

    // Get notes for this job
    const notes = await sql`
      SELECT
        n.*,
        u.full_name as user_name
      FROM job_notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.job_id = ${id}
      ORDER BY n.created_at DESC
    `

    return NextResponse.json({
      job,
      timeLogs,
      materials,
      notes,
    })
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update a job
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    // Verify user has access to this job's organization
    const jobs = await sql`
      SELECT j.*, om.role, om.can_edit_all_jobs
      FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 })
    }

    const job = jobs[0]

    // Check permissions
    const canEdit = job.role === 'owner' || job.role === 'admin' || job.can_edit_all_jobs || job.created_by_user_id === user.id
    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions to edit this job' }, { status: 403 })
    }

    // Update job
    const updatedJobs = await sql`
      UPDATE jobs
      SET
        title = COALESCE(${body.title}, title),
        description = ${body.description !== undefined ? body.description : job.description},
        job_type = COALESCE(${body.jobType}, job_type),
        status = COALESCE(${body.status}, status),
        priority = COALESCE(${body.priority}, priority),
        assigned_to_user_id = ${body.assignedToUserId !== undefined ? body.assignedToUserId : job.assigned_to_user_id},
        site_address_line1 = ${body.siteAddressLine1 !== undefined ? body.siteAddressLine1 : job.site_address_line1},
        site_address_line2 = ${body.siteAddressLine2 !== undefined ? body.siteAddressLine2 : job.site_address_line2},
        site_city = ${body.siteCity !== undefined ? body.siteCity : job.site_city},
        site_state = ${body.siteState !== undefined ? body.siteState : job.site_state},
        site_postcode = ${body.sitePostcode !== undefined ? body.sitePostcode : job.site_postcode},
        site_access_notes = ${body.siteAccessNotes !== undefined ? body.siteAccessNotes : job.site_access_notes},
        quoted_amount = ${body.quotedAmount !== undefined ? body.quotedAmount : job.quoted_amount},
        actual_amount = ${body.actualAmount !== undefined ? body.actualAmount : job.actual_amount},
        scheduled_date = ${body.scheduledDate !== undefined ? body.scheduledDate : job.scheduled_date},
        scheduled_start_time = ${body.scheduledStartTime !== undefined ? body.scheduledStartTime : job.scheduled_start_time},
        scheduled_end_time = ${body.scheduledEndTime !== undefined ? body.scheduledEndTime : job.scheduled_end_time},
        actual_start_time = ${body.actualStartTime !== undefined ? body.actualStartTime : job.actual_start_time},
        actual_end_time = ${body.actualEndTime !== undefined ? body.actualEndTime : job.actual_end_time},
        completed_at = ${body.completedAt !== undefined ? body.completedAt : job.completed_at},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      job: updatedJobs[0],
    })
  } catch (error) {
    console.error('Error updating job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a job
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has access and is owner/admin
    const jobs = await sql`
      SELECT j.*, om.role
      FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 })
    }

    const job = jobs[0]

    // Only owner or admin can delete jobs
    if (job.role !== 'owner' && job.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can delete jobs' }, { status: 403 })
    }

    // Delete job (this will cascade delete related records if FK constraints are set up)
    await sql`
      DELETE FROM jobs WHERE id = ${id}
    `

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
