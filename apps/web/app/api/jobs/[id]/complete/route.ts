import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Check if user has permission to complete jobs
    const members = await sql`
      SELECT om.can_edit_all_jobs, om.role
      FROM organization_members om
      JOIN jobs j ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'Not authorized to complete this job' }, { status: 403 })
    }

    const member = members[0]
    if (!member.can_edit_all_jobs && member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to complete this job' }, { status: 403 })
    }

    // Check for any pending approvals
    const pendingTimeLogs = await sql`
      SELECT COUNT(*) as count
      FROM job_time_logs
      WHERE job_id = ${jobId}
      AND status = 'pending'
    `

    const pendingMaterials = await sql`
      SELECT COUNT(*) as count
      FROM job_materials
      WHERE job_id = ${jobId}
      AND status = 'pending'
    `

    const warnings = []
    if (parseInt(pendingTimeLogs[0].count) > 0) {
      warnings.push(`${pendingTimeLogs[0].count} time log(s) pending approval`)
    }
    if (parseInt(pendingMaterials[0].count) > 0) {
      warnings.push(`${pendingMaterials[0].count} material(s) pending approval`)
    }

    // Update job status to completed
    const updatedJob = await sql`
      UPDATE jobs
      SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${jobId}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      job: updatedJob[0],
      warnings: warnings.length > 0 ? warnings : null,
      message: 'Job marked as completed',
    })
  } catch (error) {
    console.error('Error completing job:', error)
    return NextResponse.json(
      { error: 'Failed to complete job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
