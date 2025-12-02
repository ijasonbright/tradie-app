import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Reopen a completed asset register job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has access to this job and it's currently completed
    const jobs = await sql`
      SELECT arj.*
      FROM asset_register_jobs arj
      INNER JOIN organization_members om ON arj.organization_id = om.organization_id
      WHERE arj.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Asset register job not found or access denied' }, { status: 404 })
    }

    const job = jobs[0]

    if (job.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Only completed jobs can be reopened' }, { status: 400 })
    }

    // Update job status back to IN_PROGRESS and clear completed_date
    const updatedJob = await sql`
      UPDATE asset_register_jobs
      SET
        status = 'IN_PROGRESS',
        completed_date = NULL,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    console.log(`Asset register job ${id} reopened by user ${user.id}`)

    return NextResponse.json({
      success: true,
      job: updatedJob[0],
    })
  } catch (error) {
    console.error('Error reopening asset register job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
