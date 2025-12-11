import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get completion form for a TC job (if exists)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tcJobId: string }> }
) {
  try {
    const { tcJobId } = await params

    // Dual auth: Clerk (web) + JWT (mobile)
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT
    }

    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization')
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

    // Get user and organization
    const users = await sql`
      SELECT u.id, om.organization_id
      FROM users u
      JOIN organization_members om ON u.id = om.user_id
      WHERE u.clerk_user_id = ${clerkUserId}
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = users[0].id
    const organizationId = users[0].organization_id

    // Check for existing completion form for this TC job
    const forms = await sql`
      SELECT jcf.*, cft.name as template_name
      FROM job_completion_forms jcf
      JOIN completion_form_templates cft ON jcf.template_id = cft.id
      WHERE jcf.organization_id = ${organizationId}
      AND jcf.form_data->>'tc_job_id' = ${tcJobId}
      ORDER BY jcf.created_at DESC
      LIMIT 1
    `

    if (forms.length > 0) {
      return NextResponse.json({ form: forms[0] })
    }

    return NextResponse.json({ form: null })
  } catch (error) {
    console.error('Error getting TC job completion form:', error)
    return NextResponse.json(
      { error: 'Failed to get completion form' },
      { status: 500 }
    )
  }
}

// POST - Create or update completion form for a TC job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tcJobId: string }> }
) {
  try {
    const { tcJobId } = await params
    const body = await request.json()
    const { template_id, tc_job_code, form_data, status } = body

    // Dual auth: Clerk (web) + JWT (mobile)
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT
    }

    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization')
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

    // Get user and organization
    const users = await sql`
      SELECT u.id, om.organization_id
      FROM users u
      JOIN organization_members om ON u.id = om.user_id
      WHERE u.clerk_user_id = ${clerkUserId}
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = users[0].id
    const organizationId = users[0].organization_id

    // Merge TC job info into form_data
    const enrichedFormData = {
      ...form_data,
      tc_job_id: tcJobId,
      tc_job_code: tc_job_code,
    }

    // Check for existing form
    const existingForms = await sql`
      SELECT id FROM job_completion_forms
      WHERE organization_id = ${organizationId}
      AND form_data->>'tc_job_id' = ${tcJobId}
      LIMIT 1
    `

    let form

    if (existingForms.length > 0) {
      // Update existing form
      const result = await sql`
        UPDATE job_completion_forms
        SET
          form_data = ${JSON.stringify(enrichedFormData)},
          status = ${status},
          updated_at = NOW()
        WHERE id = ${existingForms[0].id}
        RETURNING *
      `
      form = result[0]
    } else {
      // Create new form - we need a job_id, so we'll create a placeholder
      // For TC jobs, we create a virtual job reference
      const result = await sql`
        INSERT INTO job_completion_forms (
          organization_id,
          job_id,
          template_id,
          completed_by_user_id,
          form_data,
          status,
          created_at,
          updated_at
        )
        SELECT
          ${organizationId},
          (SELECT id FROM jobs WHERE organization_id = ${organizationId} LIMIT 1),
          ${template_id},
          ${userId},
          ${JSON.stringify(enrichedFormData)},
          ${status},
          NOW(),
          NOW()
        RETURNING *
      `
      form = result[0]
    }

    return NextResponse.json({ success: true, form })
  } catch (error) {
    console.error('Error saving TC job completion form:', error)
    return NextResponse.json(
      { error: 'Failed to save completion form' },
      { status: 500 }
    )
  }
}
