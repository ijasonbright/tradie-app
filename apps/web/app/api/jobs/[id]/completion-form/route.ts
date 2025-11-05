import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

/**
 * GET /api/jobs/:jobId/completion-form
 *
 * Get completion form for a job (draft or submitted)
 * Returns form data with template structure if exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Dual authentication: Clerk (web) + JWT (mobile)
  let clerkUserId: string | null = null

  try {
    const authResult = await auth()
    clerkUserId = authResult.userId
  } catch (error) {
    // Clerk auth failed, try JWT token
  }

  // If no Clerk auth, try mobile JWT token
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

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { id } = await params
    const jobId = id

    // Get user's organization
    const userOrgs = await sql`
      SELECT om.organization_id, u.id as user_id
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.clerk_user_id = ${clerkUserId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (userOrgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = userOrgs[0].organization_id
    const userId = userOrgs[0].user_id

    // Verify job belongs to organization
    const jobs = await sql`
      SELECT id, organization_id, job_number, title, client_id, status
      FROM jobs
      WHERE id = ${jobId}
      AND organization_id = ${organizationId}
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Check if completion form exists for this job
    const forms = await sql`
      SELECT
        cf.id,
        cf.organization_id,
        cf.job_id,
        cf.template_id,
        cf.completed_by_user_id,
        cf.completion_date,
        cf.form_data,
        cf.client_signature_url,
        cf.technician_signature_url,
        cf.client_name,
        cf.technician_name,
        cf.pdf_url,
        cf.pdf_generated_at,
        cf.status,
        cf.sent_to_client,
        cf.sent_at,
        cf.created_at,
        cf.updated_at,
        t.name as template_name,
        t.description as template_description,
        u.full_name as completed_by_name
      FROM job_completion_forms cf
      JOIN completion_form_templates t ON cf.template_id = t.id
      LEFT JOIN users u ON cf.completed_by_user_id = u.id
      WHERE cf.job_id = ${jobId}
      LIMIT 1
    `

    if (forms.length === 0) {
      // No form exists yet - return job info with available templates
      const templates = await sql`
        SELECT
          t.id,
          t.name,
          t.description,
          t.job_type,
          COUNT(DISTINCT g.id)::integer as group_count,
          COUNT(DISTINCT q.id)::integer as question_count
        FROM completion_form_templates t
        LEFT JOIN completion_form_template_groups g ON g.template_id = t.id
        LEFT JOIN completion_form_template_questions q ON q.template_id = t.id
        WHERE (t.is_global = true OR t.organization_id = ${organizationId})
        AND t.is_active = true
        GROUP BY t.id
        ORDER BY t.name ASC
      `

      return NextResponse.json({
        job,
        form: null,
        available_templates: templates,
      })
    }

    const form = forms[0]

    // Get photos associated with this form
    const photos = await sql`
      SELECT
        id,
        completion_form_id,
        question_id,
        photo_url,
        thumbnail_url,
        caption,
        photo_type,
        sort_order,
        uploaded_at
      FROM job_completion_form_photos
      WHERE completion_form_id = ${form.id}
      ORDER BY sort_order ASC, uploaded_at ASC
    `

    return NextResponse.json({
      job,
      form: {
        ...form,
        photos,
      },
    })
  } catch (error) {
    console.error('Error fetching completion form:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completion form', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jobs/:jobId/completion-form
 *
 * Create or update completion form (save draft)
 * Stores form data in JSONB and creates normalized answer rows
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Dual authentication: Clerk (web) + JWT (mobile)
  let clerkUserId: string | null = null

  try {
    const authResult = await auth()
    clerkUserId = authResult.userId
  } catch (error) {
    // Clerk auth failed, try JWT token
  }

  // If no Clerk auth, try mobile JWT token
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

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { id } = await params
    const jobId = id
    const body = await request.json()

    // Validate required fields
    if (!body.template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
    }

    if (!body.form_data) {
      return NextResponse.json({ error: 'form_data is required' }, { status: 400 })
    }

    // Get user's organization
    const userOrgs = await sql`
      SELECT om.organization_id, u.id as user_id
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.clerk_user_id = ${clerkUserId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (userOrgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = userOrgs[0].organization_id
    const userId = userOrgs[0].user_id

    // Verify job belongs to organization
    const jobs = await sql`
      SELECT id, organization_id
      FROM jobs
      WHERE id = ${jobId}
      AND organization_id = ${organizationId}
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if form already exists
    const existingForms = await sql`
      SELECT id FROM job_completion_forms
      WHERE job_id = ${jobId}
      LIMIT 1
    `

    const formDataJson = JSON.stringify(body.form_data)
    const status = body.status || 'draft'
    const clientSignatureUrl = body.client_signature_url || null
    const technicianSignatureUrl = body.technician_signature_url || null
    const clientName = body.client_name || null
    const technicianName = body.technician_name || null

    if (existingForms.length > 0) {
      // Update existing form
      const formId = existingForms[0].id

      const updated = await sql`
        UPDATE job_completion_forms
        SET
          form_data = ${formDataJson}::jsonb,
          status = ${status},
          client_signature_url = ${clientSignatureUrl},
          technician_signature_url = ${technicianSignatureUrl},
          client_name = ${clientName},
          technician_name = ${technicianName},
          updated_at = NOW()
        WHERE id = ${formId}
        RETURNING *
      `

      // TODO: Update normalized answers in job_completion_form_answers table

      return NextResponse.json({
        form: updated[0],
        message: 'Form updated successfully',
      })
    } else {
      // Create new form
      const created = await sql`
        INSERT INTO job_completion_forms (
          organization_id,
          job_id,
          template_id,
          completed_by_user_id,
          form_data,
          status,
          client_signature_url,
          technician_signature_url,
          client_name,
          technician_name,
          created_at,
          updated_at
        ) VALUES (
          ${organizationId},
          ${jobId},
          ${body.template_id},
          ${userId},
          ${formDataJson}::jsonb,
          ${status},
          ${clientSignatureUrl},
          ${technicianSignatureUrl},
          ${clientName},
          ${technicianName},
          NOW(),
          NOW()
        )
        RETURNING *
      `

      // TODO: Create normalized answers in job_completion_form_answers table

      return NextResponse.json({
        form: created[0],
        message: 'Form created successfully',
      }, { status: 201 })
    }
  } catch (error) {
    console.error('Error saving completion form:', error)
    return NextResponse.json(
      { error: 'Failed to save completion form', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
