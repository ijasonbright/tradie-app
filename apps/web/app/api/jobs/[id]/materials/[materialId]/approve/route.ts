import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Approve material
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id: jobId, materialId } = await params
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

    // Check user is owner or admin
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

    if (job.role !== 'owner' && job.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can approve materials' }, { status: 403 })
    }

    // Approve material
    const materials = await sql`
      UPDATE job_materials
      SET
        status = 'approved',
        approved_by_user_id = ${user.id},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${materialId} AND job_id = ${jobId}
      RETURNING *
    `

    if (materials.length === 0) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    return NextResponse.json({ material: materials[0] })
  } catch (error) {
    console.error('Error approving material:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
