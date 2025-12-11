import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { withApiKeyAuth, ApiKeyPayload, hasPermission } from '@/lib/api/api-key-auth'
import { triggerJobWebhook } from '@/lib/api/webhooks'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/jobs
 * List jobs for the organization (API key authenticated)
 */
export const GET = withApiKeyAuth(
  async (request: NextRequest, { apiKey }: { params: Promise<Record<string, string>>; apiKey: ApiKeyPayload }) => {
    const sql = neon(process.env.DATABASE_URL!)
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const status = searchParams.get('status')
    const clientId = searchParams.get('client_id')
    const assignedTo = searchParams.get('assigned_to')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') === 'asc' ? 'ASC' : 'DESC'

    // Build query with filters
    let jobs
    if (status && clientId) {
      jobs = await sql`
        SELECT
          j.id,
          j.job_number,
          j.title,
          j.description,
          j.job_type,
          j.status,
          j.priority,
          j.site_address_line1,
          j.site_address_line2,
          j.site_city,
          j.site_state,
          j.site_postcode,
          j.quoted_amount,
          j.actual_amount,
          j.scheduled_date,
          j.scheduled_start_time,
          j.scheduled_end_time,
          j.completed_at,
          j.created_at,
          j.updated_at,
          j.client_id,
          c.first_name as client_first_name,
          c.last_name as client_last_name,
          c.company_name as client_company_name,
          c.email as client_email,
          c.phone as client_phone,
          j.assigned_to_user_id,
          u.full_name as assigned_to_name
        FROM jobs j
        LEFT JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.assigned_to_user_id = u.id
        WHERE j.organization_id = ${apiKey.organizationId}
        AND j.status = ${status}
        AND j.client_id = ${clientId}
        ORDER BY j.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    } else if (status) {
      jobs = await sql`
        SELECT
          j.id,
          j.job_number,
          j.title,
          j.description,
          j.job_type,
          j.status,
          j.priority,
          j.site_address_line1,
          j.site_address_line2,
          j.site_city,
          j.site_state,
          j.site_postcode,
          j.quoted_amount,
          j.actual_amount,
          j.scheduled_date,
          j.scheduled_start_time,
          j.scheduled_end_time,
          j.completed_at,
          j.created_at,
          j.updated_at,
          j.client_id,
          c.first_name as client_first_name,
          c.last_name as client_last_name,
          c.company_name as client_company_name,
          c.email as client_email,
          c.phone as client_phone,
          j.assigned_to_user_id,
          u.full_name as assigned_to_name
        FROM jobs j
        LEFT JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.assigned_to_user_id = u.id
        WHERE j.organization_id = ${apiKey.organizationId}
        AND j.status = ${status}
        ORDER BY j.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    } else if (clientId) {
      jobs = await sql`
        SELECT
          j.id,
          j.job_number,
          j.title,
          j.description,
          j.job_type,
          j.status,
          j.priority,
          j.site_address_line1,
          j.site_address_line2,
          j.site_city,
          j.site_state,
          j.site_postcode,
          j.quoted_amount,
          j.actual_amount,
          j.scheduled_date,
          j.scheduled_start_time,
          j.scheduled_end_time,
          j.completed_at,
          j.created_at,
          j.updated_at,
          j.client_id,
          c.first_name as client_first_name,
          c.last_name as client_last_name,
          c.company_name as client_company_name,
          c.email as client_email,
          c.phone as client_phone,
          j.assigned_to_user_id,
          u.full_name as assigned_to_name
        FROM jobs j
        LEFT JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.assigned_to_user_id = u.id
        WHERE j.organization_id = ${apiKey.organizationId}
        AND j.client_id = ${clientId}
        ORDER BY j.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    } else {
      jobs = await sql`
        SELECT
          j.id,
          j.job_number,
          j.title,
          j.description,
          j.job_type,
          j.status,
          j.priority,
          j.site_address_line1,
          j.site_address_line2,
          j.site_city,
          j.site_state,
          j.site_postcode,
          j.quoted_amount,
          j.actual_amount,
          j.scheduled_date,
          j.scheduled_start_time,
          j.scheduled_end_time,
          j.completed_at,
          j.created_at,
          j.updated_at,
          j.client_id,
          c.first_name as client_first_name,
          c.last_name as client_last_name,
          c.company_name as client_company_name,
          c.email as client_email,
          c.phone as client_phone,
          j.assigned_to_user_id,
          u.full_name as assigned_to_name
        FROM jobs j
        LEFT JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.assigned_to_user_id = u.id
        WHERE j.organization_id = ${apiKey.organizationId}
        ORDER BY j.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    }

    // Format response
    const formattedJobs = jobs.map((j: any) => ({
      id: j.id,
      job_number: j.job_number,
      title: j.title,
      description: j.description,
      job_type: j.job_type,
      status: j.status,
      priority: j.priority,
      site_address: {
        line1: j.site_address_line1,
        line2: j.site_address_line2,
        city: j.site_city,
        state: j.site_state,
        postcode: j.site_postcode,
      },
      quoted_amount: j.quoted_amount,
      actual_amount: j.actual_amount,
      scheduled_date: j.scheduled_date,
      scheduled_start_time: j.scheduled_start_time,
      scheduled_end_time: j.scheduled_end_time,
      completed_at: j.completed_at,
      client: j.client_id ? {
        id: j.client_id,
        name: j.client_company_name || `${j.client_first_name} ${j.client_last_name}`.trim(),
        email: j.client_email,
        phone: j.client_phone,
      } : null,
      assigned_to: j.assigned_to_user_id ? {
        id: j.assigned_to_user_id,
        name: j.assigned_to_name,
      } : null,
      created_at: j.created_at,
      updated_at: j.updated_at,
    }))

    return NextResponse.json({
      jobs: formattedJobs,
      count: formattedJobs.length,
      limit,
      offset,
    })
  },
  { requiredPermission: 'jobs.read' }
)

/**
 * POST /api/v1/jobs
 * Create a new job (API key authenticated)
 */
export const POST = withApiKeyAuth(
  async (request: NextRequest, { apiKey }: { params: Promise<Record<string, string>>; apiKey: ApiKeyPayload }) => {
    const sql = neon(process.env.DATABASE_URL!)
    const body = await request.json()

    // Validate required fields
    const { title, client_id, job_type = 'repair' } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // Verify client belongs to organization if provided
    if (client_id) {
      const clients = await sql`
        SELECT id FROM clients
        WHERE id = ${client_id}
        AND organization_id = ${apiKey.organizationId}
      `
      if (clients.length === 0) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }
    }

    // Generate job number
    const year = new Date().getFullYear()
    const countResult = await sql`
      SELECT COUNT(*) as count FROM jobs
      WHERE organization_id = ${apiKey.organizationId}
      AND created_at >= ${`${year}-01-01`}
    `
    const jobNumber = `JOB-${year}-${String(parseInt(countResult[0].count) + 1).padStart(4, '0')}`

    // Create the job
    const result = await sql`
      INSERT INTO jobs (
        organization_id,
        job_number,
        client_id,
        title,
        description,
        job_type,
        status,
        priority,
        site_address_line1,
        site_address_line2,
        site_city,
        site_state,
        site_postcode,
        site_access_notes,
        quoted_amount,
        scheduled_date,
        scheduled_start_time,
        scheduled_end_time
      ) VALUES (
        ${apiKey.organizationId},
        ${jobNumber},
        ${client_id || null},
        ${title},
        ${body.description || null},
        ${job_type},
        ${body.status || 'quoted'},
        ${body.priority || 'medium'},
        ${body.site_address?.line1 || null},
        ${body.site_address?.line2 || null},
        ${body.site_address?.city || null},
        ${body.site_address?.state || null},
        ${body.site_address?.postcode || null},
        ${body.site_access_notes || null},
        ${body.quoted_amount || null},
        ${body.scheduled_date || null},
        ${body.scheduled_start_time || null},
        ${body.scheduled_end_time || null}
      )
      RETURNING *
    `

    const job = result[0]

    // Trigger webhook
    await triggerJobWebhook(apiKey.organizationId, 'job.created', {
      job_id: job.id,
      job_number: job.job_number,
      title: job.title,
      description: job.description,
      job_type: job.job_type,
      status: job.status,
      priority: job.priority,
      client_id: job.client_id,
      site_address: {
        line1: job.site_address_line1,
        line2: job.site_address_line2,
        city: job.site_city,
        state: job.site_state,
        postcode: job.site_postcode,
      },
      quoted_amount: job.quoted_amount,
      scheduled_date: job.scheduled_date,
      created_at: job.created_at,
    })

    return NextResponse.json({
      job: {
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        description: job.description,
        job_type: job.job_type,
        status: job.status,
        priority: job.priority,
        client_id: job.client_id,
        site_address: {
          line1: job.site_address_line1,
          line2: job.site_address_line2,
          city: job.site_city,
          state: job.site_state,
          postcode: job.site_postcode,
        },
        quoted_amount: job.quoted_amount,
        scheduled_date: job.scheduled_date,
        created_at: job.created_at,
      },
      message: 'Job created successfully',
    }, { status: 201 })
  },
  { requiredPermission: 'jobs.write' }
)
