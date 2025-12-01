import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// Verify API key from Property Pal
function verifyApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.PROPERTY_PAL_API_KEY

  // For development, allow if no key is set
  if (!expectedKey) return true

  return apiKey === expectedKey
}

interface CreateJobRequest {
  work_order_id: string           // Property Pal work order ID
  property_id: string             // Property Pal property ID
  property_address: string        // Full address
  address_line1?: string
  address_city?: string
  address_state?: string
  address_postcode?: string
  description: string
  category: string                // Work order category (PLUMBING, ELECTRICAL, etc.)
  priority: string                // LOW, MEDIUM, HIGH, EMERGENCY
  requested_date?: string         // ISO date string
  client_name?: string            // Property owner/tenant name
  client_phone?: string
  client_email?: string
  organization_id: string         // TradieApp organization ID
  notes?: string
}

// POST - Create a new job from Property Pal work order
export async function POST(req: Request) {
  try {
    if (!verifyApiKey(req)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body: CreateJobRequest = await req.json()

    // Validate required fields
    if (!body.work_order_id) {
      return NextResponse.json({ error: 'work_order_id is required' }, { status: 400 })
    }
    if (!body.organization_id) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
    }
    if (!body.description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Check if a job already exists for this work order
    const existingJobs = await sql`
      SELECT id, job_number, status
      FROM jobs
      WHERE external_work_order_id = ${body.work_order_id}
      AND external_source = 'property_pal'
      LIMIT 1
    `

    if (existingJobs.length > 0) {
      // Return existing job details
      return NextResponse.json({
        success: true,
        job_id: existingJobs[0].id,
        job_number: existingJobs[0].job_number,
        status: existingJobs[0].status,
        already_exists: true,
      })
    }

    // Verify organization exists
    const organizations = await sql`
      SELECT id, name FROM organizations WHERE id = ${body.organization_id} LIMIT 1
    `

    if (organizations.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get or create a client for this property/owner
    let clientId: string

    // Try to find an existing client by email if provided
    if (body.client_email) {
      const existingClients = await sql`
        SELECT id FROM clients
        WHERE organization_id = ${body.organization_id}
        AND email = ${body.client_email}
        LIMIT 1
      `

      if (existingClients.length > 0) {
        clientId = existingClients[0].id
      } else {
        // Create a new client
        const newClients = await sql`
          INSERT INTO clients (
            organization_id,
            first_name,
            email,
            phone,
            site_address_line1,
            site_city,
            site_state,
            site_postcode,
            notes,
            client_type,
            is_company,
            created_at,
            updated_at
          ) VALUES (
            ${body.organization_id},
            ${body.client_name || 'Property Pal Client'},
            ${body.client_email || null},
            ${body.client_phone || null},
            ${body.address_line1 || body.property_address || null},
            ${body.address_city || null},
            ${body.address_state || null},
            ${body.address_postcode || null},
            ${'Auto-created from Property Pal work order ' + body.work_order_id},
            'residential',
            false,
            NOW(),
            NOW()
          )
          RETURNING id
        `
        clientId = newClients[0].id
      }
    } else {
      // Try to find or create a generic Property Pal client
      const genericClients = await sql`
        SELECT id FROM clients
        WHERE organization_id = ${body.organization_id}
        AND first_name = 'Property Pal Client'
        AND notes LIKE '%Property Pal%'
        LIMIT 1
      `

      if (genericClients.length > 0) {
        clientId = genericClients[0].id
      } else {
        const newClients = await sql`
          INSERT INTO clients (
            organization_id,
            first_name,
            notes,
            client_type,
            is_company,
            created_at,
            updated_at
          ) VALUES (
            ${body.organization_id},
            'Property Pal Client',
            'Generic client for Property Pal work orders',
            'residential',
            false,
            NOW(),
            NOW()
          )
          RETURNING id
        `
        clientId = newClients[0].id
      }
    }

    // Get the organization owner to use as created_by
    const orgMembers = await sql`
      SELECT user_id FROM organization_members
      WHERE organization_id = ${body.organization_id}
      AND role = 'owner'
      AND status = 'active'
      LIMIT 1
    `

    if (orgMembers.length === 0) {
      return NextResponse.json(
        { error: 'No active owner found for organization' },
        { status: 400 }
      )
    }

    const createdByUserId = orgMembers[0].user_id

    // Generate job number
    const jobCount = await sql`
      SELECT COUNT(*) as count FROM jobs WHERE organization_id = ${body.organization_id}
    `
    const jobNumber = `JOB-${String(Number(jobCount[0].count) + 1).padStart(5, '0')}`

    // Map Property Pal priority to TradieApp priority
    const priorityMap: Record<string, string> = {
      'LOW': 'low',
      'MEDIUM': 'medium',
      'HIGH': 'high',
      'EMERGENCY': 'urgent',
    }

    // Map Property Pal category to job type
    // These can be mapped or use a default
    const jobType = 'repair' // Default for work orders

    // Create the job
    const jobs = await sql`
      INSERT INTO jobs (
        organization_id,
        client_id,
        created_by_user_id,
        job_number,
        title,
        description,
        job_type,
        status,
        priority,
        pricing_type,
        site_address_line1,
        site_city,
        site_state,
        site_postcode,
        scheduled_date,
        external_work_order_id,
        external_source,
        external_synced_at,
        external_property_id,
        created_at,
        updated_at
      ) VALUES (
        ${body.organization_id},
        ${clientId},
        ${createdByUserId},
        ${jobNumber},
        ${body.category + ': ' + (body.description.substring(0, 100))},
        ${body.description},
        ${jobType},
        'pending',
        ${priorityMap[body.priority] || 'medium'},
        'time_and_materials',
        ${body.address_line1 || body.property_address || null},
        ${body.address_city || null},
        ${body.address_state || null},
        ${body.address_postcode || null},
        ${body.requested_date ? new Date(body.requested_date) : null},
        ${body.work_order_id},
        'property_pal',
        NOW(),
        ${body.property_id},
        NOW(),
        NOW()
      )
      RETURNING id, job_number, status
    `

    const job = jobs[0]

    // Add any notes if provided
    if (body.notes) {
      await sql`
        INSERT INTO job_notes (
          job_id,
          user_id,
          note_text,
          note_type,
          created_at
        ) VALUES (
          ${job.id},
          ${createdByUserId},
          ${body.notes},
          'client_request',
          NOW()
        )
      `
    }

    return NextResponse.json({
      success: true,
      job_id: job.id,
      job_number: job.job_number,
      status: job.status,
      already_exists: false,
    })
  } catch (error) {
    console.error('Error creating job from Property Pal:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET - Get job status by work order ID
export async function GET(req: Request) {
  try {
    if (!verifyApiKey(req)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workOrderId = searchParams.get('work_order_id')

    if (!workOrderId) {
      return NextResponse.json({ error: 'work_order_id is required' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    const jobs = await sql`
      SELECT
        j.id,
        j.job_number,
        j.title,
        j.status,
        j.priority,
        j.scheduled_date,
        j.completed_at,
        j.quoted_amount,
        j.actual_amount,
        j.created_at,
        j.updated_at
      FROM jobs j
      WHERE j.external_work_order_id = ${workOrderId}
      AND j.external_source = 'property_pal'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Get job photos
    const photos = await sql`
      SELECT photo_url, thumbnail_url, caption, photo_type, uploaded_at
      FROM job_photos
      WHERE job_id = ${job.id}
      ORDER BY uploaded_at DESC
    `

    // Get job notes
    const notes = await sql`
      SELECT note_text, note_type, created_at
      FROM job_notes
      WHERE job_id = ${job.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      job: {
        ...job,
        photos,
        notes,
      },
    })
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
