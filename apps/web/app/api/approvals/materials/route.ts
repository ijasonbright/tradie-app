import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch all pending materials across all jobs for approval
export async function GET() {
  try {
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

    // Fetch all pending materials from jobs in organizations where user is owner/admin
    const materials = await sql`
      SELECT
        jm.*,
        u.full_name as added_by_name,
        j.title as job_title,
        j.job_number
      FROM job_materials jm
      INNER JOIN jobs j ON jm.job_id = j.id
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      LEFT JOIN users u ON jm.added_by_user_id = u.id
      WHERE jm.status = 'pending'
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      AND (om.role = 'owner' OR om.role = 'admin')
      ORDER BY jm.created_at DESC
    `

    return NextResponse.json({ materials })
  } catch (error) {
    console.error('Error fetching pending materials:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
