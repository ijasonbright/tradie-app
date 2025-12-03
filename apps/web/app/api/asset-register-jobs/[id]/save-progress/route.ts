import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Save asset register progress without completing
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
    const body = await req.json()

    // Verify user has access to this job
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

    // Check if there's an existing completion form to update
    const existingForms = await sql`
      SELECT * FROM asset_register_completion_forms
      WHERE asset_register_job_id = ${id}
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (existingForms.length > 0) {
      // Update existing form
      await sql`
        UPDATE asset_register_completion_forms
        SET
          form_data = ${JSON.stringify(body.form_data || {})},
          technician_name = ${body.technician_name || existingForms[0].technician_name},
          updated_at = NOW()
        WHERE id = ${existingForms[0].id}
      `
    } else {
      // Create new form for progress saving
      await sql`
        INSERT INTO asset_register_completion_forms (
          organization_id,
          asset_register_job_id,
          completed_by_user_id,
          form_data,
          technician_name,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${job.organization_id},
          ${id},
          ${user.id},
          ${JSON.stringify(body.form_data || {})},
          ${body.technician_name || user.full_name},
          'draft',
          NOW(),
          NOW()
        )
      `
    }

    // Update job with report_data if provided
    if (body.report_data) {
      await sql`
        UPDATE asset_register_jobs
        SET
          report_data = ${JSON.stringify(body.report_data)},
          updated_at = NOW()
        WHERE id = ${id}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving asset register progress:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
