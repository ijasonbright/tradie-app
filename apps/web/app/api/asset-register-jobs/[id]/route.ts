import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get a specific asset register job by ID
export async function GET(
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

    // Get asset register job with property details
    const jobs = await sql`
      SELECT
        arj.*,
        o.name as organization_name,
        p.address_street, p.address_suburb, p.address_state, p.address_postcode,
        p.property_type, p.bedrooms, p.bathrooms,
        p.owner_name, p.owner_phone, p.owner_email,
        p.tenant_name, p.tenant_phone, p.tenant_email,
        p.access_instructions, p.notes as property_notes,
        u.full_name as assigned_to_name, u.email as assigned_to_email, u.phone as assigned_to_phone
      FROM asset_register_jobs arj
      INNER JOIN organizations o ON arj.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN properties p ON arj.property_id = p.id
      LEFT JOIN users u ON arj.assigned_to_user_id = u.id
      WHERE arj.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Asset register job not found' }, { status: 404 })
    }

    // Get job photos
    const photos = await sql`
      SELECT * FROM asset_register_job_photos
      WHERE asset_register_job_id = ${id}
      ORDER BY created_at DESC
    `

    // Get job notes
    const notes = await sql`
      SELECT
        n.*,
        u.full_name as user_name
      FROM asset_register_job_notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.asset_register_job_id = ${id}
      ORDER BY n.created_at DESC
    `

    // Get completion forms
    const completionForms = await sql`
      SELECT * FROM asset_register_completion_forms
      WHERE asset_register_job_id = ${id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      job: jobs[0],
      photos,
      notes,
      completionForms,
    })
  } catch (error) {
    console.error('Error fetching asset register job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH - Update an asset register job
export async function PATCH(
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

    // Verify user has access to this job's organization
    const jobs = await sql`
      SELECT arj.*, om.role, om.can_manage_jobs
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

    // Build update fields dynamically
    const updateFields: string[] = []
    const updateValues: any[] = []

    if (body.status !== undefined) {
      updateFields.push('status')
      updateValues.push(body.status)

      // Auto-set dates based on status
      if (body.status === 'IN_PROGRESS' && !body.started_date) {
        updateFields.push('started_date')
        updateValues.push(new Date())
      }
      if (body.status === 'COMPLETED' && !body.completed_date) {
        updateFields.push('completed_date')
        updateValues.push(new Date())
      }
    }

    if (body.priority !== undefined) {
      updateFields.push('priority')
      updateValues.push(body.priority)
    }

    if (body.scheduled_date !== undefined) {
      updateFields.push('scheduled_date')
      updateValues.push(body.scheduled_date)
    }

    if (body.assigned_to_user_id !== undefined) {
      updateFields.push('assigned_to_user_id')
      updateValues.push(body.assigned_to_user_id)
    }

    if (body.notes !== undefined) {
      updateFields.push('notes')
      updateValues.push(body.notes)
    }

    if (body.completion_notes !== undefined) {
      updateFields.push('completion_notes')
      updateValues.push(body.completion_notes)
    }

    if (body.report_data !== undefined) {
      updateFields.push('report_data')
      updateValues.push(JSON.stringify(body.report_data))
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Build and execute update query
    const setClauses = updateFields.map((field, index) => `"${field.replace(/([A-Z])/g, '_$1').toLowerCase()}" = $${index + 2}`).join(', ')

    const updatedJobs = await sql(`
      UPDATE asset_register_jobs
      SET ${setClauses}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, ...updateValues])

    return NextResponse.json({
      success: true,
      job: updatedJobs[0],
    })
  } catch (error) {
    console.error('Error updating asset register job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
