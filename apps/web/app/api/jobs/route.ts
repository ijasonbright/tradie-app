import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - List all jobs for user's organizations
export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Build query with optional filters
    let jobs

    if (status && clientId) {
      jobs = await sql`
        SELECT
          j.*,
          o.name as organization_name,
          c.company_name, c.first_name, c.last_name, c.is_company,
          u.full_name as created_by_name,
          a.full_name as assigned_to_name
        FROM jobs j
        INNER JOIN organizations o ON j.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.created_by_user_id = u.id
        LEFT JOIN users a ON j.assigned_to_user_id = a.id
        WHERE om.user_id = ${user.id}
        AND om.status = 'active'
        AND j.status = ${status}
        AND j.client_id = ${clientId}
        ORDER BY j.created_at DESC
      `
    } else if (status) {
      jobs = await sql`
        SELECT
          j.*,
          o.name as organization_name,
          c.company_name, c.first_name, c.last_name, c.is_company,
          u.full_name as created_by_name,
          a.full_name as assigned_to_name
        FROM jobs j
        INNER JOIN organizations o ON j.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.created_by_user_id = u.id
        LEFT JOIN users a ON j.assigned_to_user_id = a.id
        WHERE om.user_id = ${user.id}
        AND om.status = 'active'
        AND j.status = ${status}
        ORDER BY j.created_at DESC
      `
    } else if (clientId) {
      jobs = await sql`
        SELECT
          j.*,
          o.name as organization_name,
          c.company_name, c.first_name, c.last_name, c.is_company,
          u.full_name as created_by_name,
          a.full_name as assigned_to_name
        FROM jobs j
        INNER JOIN organizations o ON j.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.created_by_user_id = u.id
        LEFT JOIN users a ON j.assigned_to_user_id = a.id
        WHERE om.user_id = ${user.id}
        AND om.status = 'active'
        AND j.client_id = ${clientId}
        ORDER BY j.created_at DESC
      `
    } else {
      jobs = await sql`
        SELECT
          j.*,
          o.name as organization_name,
          c.company_name, c.first_name, c.last_name, c.is_company,
          u.full_name as created_by_name,
          a.full_name as assigned_to_name
        FROM jobs j
        INNER JOIN organizations o ON j.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.created_by_user_id = u.id
        LEFT JOIN users a ON j.assigned_to_user_id = a.id
        WHERE om.user_id = ${user.id}
        AND om.status = 'active'
        ORDER BY j.created_at DESC
      `
    }

    return NextResponse.json({
      jobs,
    })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create a new job
export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth()

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

    // Validate required fields
    if (!body.organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    if (!body.clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    if (!body.title) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }

    if (!body.jobType) {
      return NextResponse.json({ error: 'Job type is required' }, { status: 400 })
    }

    // Verify user has access to this organization
    const membership = await sql`
      SELECT * FROM organization_members
      WHERE organization_id = ${body.organizationId}
      AND user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Access denied to this organization' }, { status: 403 })
    }

    // Check permissions
    const member = membership[0]
    if (member.role !== 'owner' && member.role !== 'admin' && !member.can_create_jobs) {
      return NextResponse.json({ error: 'Insufficient permissions to create jobs' }, { status: 403 })
    }

    // Generate job number (simple sequential approach)
    const jobCount = await sql`
      SELECT COUNT(*) as count FROM jobs WHERE organization_id = ${body.organizationId}
    `
    const jobNumber = `JOB-${String(Number(jobCount[0].count) + 1).padStart(5, '0')}`

    // Create job
    const jobs = await sql`
      INSERT INTO jobs (
        organization_id, client_id, created_by_user_id, assigned_to_user_id,
        job_number, title, description, job_type, status, priority,
        pricing_type,
        site_address_line1, site_address_line2,
        site_city, site_state, site_postcode, site_access_notes,
        quoted_amount, quote_id, scheduled_date,
        scheduled_start_time, scheduled_end_time,
        trade_type_id,
        created_at, updated_at
      ) VALUES (
        ${body.organizationId},
        ${body.clientId},
        ${user.id},
        ${body.assignedToUserId || null},
        ${jobNumber},
        ${body.title},
        ${body.description || null},
        ${body.jobType},
        ${body.status || 'quoted'},
        ${body.priority || 'medium'},
        ${body.pricingType || 'time_and_materials'},
        ${body.siteAddressLine1 || null},
        ${body.siteAddressLine2 || null},
        ${body.siteCity || null},
        ${body.siteState || null},
        ${body.sitePostcode || null},
        ${body.siteAccessNotes || null},
        ${body.quotedAmount || null},
        ${body.quoteId || null},
        ${body.scheduledDate || null},
        ${body.scheduledStartTime || null},
        ${body.scheduledEndTime || null},
        ${body.tradeTypeId || null},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      job: jobs[0],
    })
  } catch (error) {
    console.error('Error creating job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
