import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all jobs for user's organizations (including asset register jobs)
export async function GET(req: Request) {
  try {
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
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')
    const includeAssetRegister = searchParams.get('includeAssetRegister') !== 'false' // Include by default

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Build query with optional filters - now using UNION to include asset register jobs
    let jobs

    // Map asset register status to job status for filtering
    const mapAssetRegisterStatus = (jobStatus: string) => {
      // Asset register uses: CREATED, ASSIGNED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
      // Jobs use: quoted, scheduled, in_progress, completed, invoiced
      const mapping: Record<string, string[]> = {
        'quoted': ['CREATED', 'ASSIGNED'],
        'scheduled': ['SCHEDULED'],
        'in_progress': ['IN_PROGRESS'],
        'completed': ['COMPLETED'],
      }
      return mapping[jobStatus] || []
    }

    if (status && clientId) {
      jobs = await sql`
        SELECT
          j.*,
          'job' as record_type,
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
      // Get regular jobs
      const regularJobs = await sql`
        SELECT
          j.*,
          'job' as record_type,
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

      // Get asset register jobs with matching status if included
      let assetRegisterJobs: any[] = []
      if (includeAssetRegister) {
        const arStatuses = mapAssetRegisterStatus(status)
        if (arStatuses.length > 0) {
          assetRegisterJobs = await sql`
            SELECT
              arj.id,
              arj.organization_id,
              arj.property_id,
              arj.assigned_to_user_id,
              arj.status,
              arj.priority,
              arj.scheduled_date,
              arj.notes as description,
              arj.created_at,
              arj.updated_at,
              'asset_register' as record_type,
              'Asset Register' as title,
              CONCAT('AR-', LPAD(arj.id::text, 5, '0')) as job_number,
              o.name as organization_name,
              p.address_street as site_address_line1,
              p.address_suburb as site_city,
              p.address_state as site_state,
              p.address_postcode as site_postcode,
              NULL as company_name,
              p.owner_name as first_name,
              NULL as last_name,
              false as is_company,
              NULL as created_by_name,
              u.full_name as assigned_to_name
            FROM asset_register_jobs arj
            INNER JOIN organizations o ON arj.organization_id = o.id
            INNER JOIN organization_members om ON o.id = om.organization_id
            LEFT JOIN properties p ON arj.property_id = p.id
            LEFT JOIN users u ON arj.assigned_to_user_id = u.id
            WHERE om.user_id = ${user.id}
            AND om.status = 'active'
            AND arj.status = ANY(${arStatuses})
            ORDER BY arj.created_at DESC
          `
        }
      }

      jobs = [...regularJobs, ...assetRegisterJobs]
    } else if (clientId) {
      jobs = await sql`
        SELECT
          j.*,
          'job' as record_type,
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
      // Get all jobs (regular + asset register)
      const regularJobs = await sql`
        SELECT
          j.*,
          'job' as record_type,
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

      // Get asset register jobs if included
      let assetRegisterJobs: any[] = []
      if (includeAssetRegister) {
        assetRegisterJobs = await sql`
          SELECT
            arj.id,
            arj.organization_id,
            arj.property_id,
            arj.assigned_to_user_id,
            arj.status,
            arj.priority,
            arj.scheduled_date,
            arj.notes as description,
            arj.created_at,
            arj.updated_at,
            'asset_register' as record_type,
            'Asset Register' as title,
            CONCAT('AR-', LPAD(arj.id::text, 5, '0')) as job_number,
            o.name as organization_name,
            p.address_street as site_address_line1,
            p.address_suburb as site_city,
            p.address_state as site_state,
            p.address_postcode as site_postcode,
            NULL as company_name,
            p.owner_name as first_name,
            NULL as last_name,
            false as is_company,
            NULL as created_by_name,
            u.full_name as assigned_to_name
          FROM asset_register_jobs arj
          INNER JOIN organizations o ON arj.organization_id = o.id
          INNER JOIN organization_members om ON o.id = om.organization_id
          LEFT JOIN properties p ON arj.property_id = p.id
          LEFT JOIN users u ON arj.assigned_to_user_id = u.id
          WHERE om.user_id = ${user.id}
          AND om.status = 'active'
          AND arj.status != 'COMPLETED'
          AND arj.status != 'CANCELLED'
          ORDER BY arj.created_at DESC
        `
      }

      jobs = [...regularJobs, ...assetRegisterJobs]
    }

    // Sort combined results by scheduled_date (earliest first), then by created_at
    jobs.sort((a: any, b: any) => {
      if (!a.scheduled_date && !b.scheduled_date) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (!a.scheduled_date) return 1
      if (!b.scheduled_date) return -1
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    })

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

    // Validate required fields
    if (!body.organization_id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    if (!body.client_id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    if (!body.title) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }

    if (!body.job_type) {
      return NextResponse.json({ error: 'Job type is required' }, { status: 400 })
    }

    // Verify user has access to this organization
    const membership = await sql`
      SELECT * FROM organization_members
      WHERE organization_id = ${body.organization_id}
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
      SELECT COUNT(*) as count FROM jobs WHERE organization_id = ${body.organization_id}
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
        ${body.organization_id},
        ${body.client_id},
        ${user.id},
        ${body.assigned_to_user_id || null},
        ${jobNumber},
        ${body.title},
        ${body.description || null},
        ${body.job_type},
        ${body.status || 'quoted'},
        ${body.priority || 'medium'},
        ${body.pricing_type || 'time_and_materials'},
        ${body.site_address_line1 || null},
        ${body.site_address_line2 || null},
        ${body.site_city || null},
        ${body.site_state || null},
        ${body.site_postcode || null},
        ${body.site_access_notes || null},
        ${body.quoted_amount || null},
        ${body.quote_id || null},
        ${body.scheduled_date || null},
        ${body.scheduled_start_time || null},
        ${body.scheduled_end_time || null},
        ${body.trade_type_id || null},
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
