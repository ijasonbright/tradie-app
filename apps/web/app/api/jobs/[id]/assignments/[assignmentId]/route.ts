import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// DELETE - Remove assignment (mark as removed)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id: jobId, assignmentId } = await params
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

    // Check job exists and user has permission
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

    const member = await sql`
      SELECT * FROM organization_members
      WHERE user_id = ${user.id} AND organization_id = ${job.organization_id} AND status = 'active'
      LIMIT 1
    `

    // Only owner, admin, or users with can_create_jobs permission can remove assignments
    if (job.role !== 'owner' && job.role !== 'admin' && !member[0].can_create_jobs) {
      return NextResponse.json({ error: 'No permission to remove assignments' }, { status: 403 })
    }

    // Mark assignment as removed
    await sql`
      UPDATE job_assignments
      SET removed_at = NOW()
      WHERE id = ${assignmentId} AND job_id = ${jobId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing assignment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
