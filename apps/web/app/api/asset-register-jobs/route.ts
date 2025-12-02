import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all asset register jobs for user's organizations
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
    const assignedToMe = searchParams.get('assignedToMe') === 'true'

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Build query - asset register jobs for user's organizations
    let jobs

    if (assignedToMe) {
      // Get jobs assigned to this user specifically
      if (status) {
        jobs = await sql`
          SELECT
            arj.*,
            o.name as organization_name,
            p.address_street, p.address_suburb, p.address_state, p.address_postcode,
            p.owner_name, p.tenant_name,
            u.full_name as assigned_to_name
          FROM asset_register_jobs arj
          INNER JOIN organizations o ON arj.organization_id = o.id
          INNER JOIN properties p ON arj.property_id = p.id
          LEFT JOIN users u ON arj.assigned_to_user_id = u.id
          WHERE arj.assigned_to_user_id = ${user.id}
          AND arj.status = ${status}
          ORDER BY
            CASE arj.priority
              WHEN 'HIGH' THEN 1
              WHEN 'MEDIUM' THEN 2
              WHEN 'LOW' THEN 3
            END,
            arj.scheduled_date ASC NULLS LAST,
            arj.created_at DESC
        `
      } else {
        jobs = await sql`
          SELECT
            arj.*,
            o.name as organization_name,
            p.address_street, p.address_suburb, p.address_state, p.address_postcode,
            p.owner_name, p.tenant_name,
            u.full_name as assigned_to_name
          FROM asset_register_jobs arj
          INNER JOIN organizations o ON arj.organization_id = o.id
          INNER JOIN properties p ON arj.property_id = p.id
          LEFT JOIN users u ON arj.assigned_to_user_id = u.id
          WHERE arj.assigned_to_user_id = ${user.id}
          ORDER BY
            CASE arj.priority
              WHEN 'HIGH' THEN 1
              WHEN 'MEDIUM' THEN 2
              WHEN 'LOW' THEN 3
            END,
            arj.scheduled_date ASC NULLS LAST,
            arj.created_at DESC
        `
      }
    } else {
      // Get all jobs for user's organizations
      if (status) {
        jobs = await sql`
          SELECT
            arj.*,
            o.name as organization_name,
            p.address_street, p.address_suburb, p.address_state, p.address_postcode,
            p.owner_name, p.tenant_name,
            u.full_name as assigned_to_name
          FROM asset_register_jobs arj
          INNER JOIN organizations o ON arj.organization_id = o.id
          INNER JOIN organization_members om ON o.id = om.organization_id
          INNER JOIN properties p ON arj.property_id = p.id
          LEFT JOIN users u ON arj.assigned_to_user_id = u.id
          WHERE om.user_id = ${user.id}
          AND om.status = 'active'
          AND arj.status = ${status}
          ORDER BY
            CASE arj.priority
              WHEN 'HIGH' THEN 1
              WHEN 'MEDIUM' THEN 2
              WHEN 'LOW' THEN 3
            END,
            arj.scheduled_date ASC NULLS LAST,
            arj.created_at DESC
        `
      } else {
        jobs = await sql`
          SELECT
            arj.*,
            o.name as organization_name,
            p.address_street, p.address_suburb, p.address_state, p.address_postcode,
            p.owner_name, p.tenant_name,
            u.full_name as assigned_to_name
          FROM asset_register_jobs arj
          INNER JOIN organizations o ON arj.organization_id = o.id
          INNER JOIN organization_members om ON o.id = om.organization_id
          INNER JOIN properties p ON arj.property_id = p.id
          LEFT JOIN users u ON arj.assigned_to_user_id = u.id
          WHERE om.user_id = ${user.id}
          AND om.status = 'active'
          ORDER BY
            CASE arj.priority
              WHEN 'HIGH' THEN 1
              WHEN 'MEDIUM' THEN 2
              WHEN 'LOW' THEN 3
            END,
            arj.scheduled_date ASC NULLS LAST,
            arj.created_at DESC
        `
      }
    }

    return NextResponse.json({
      jobs,
    })
  } catch (error) {
    console.error('Error fetching asset register jobs:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create a new asset register job (typically from Property Pal sync)
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

    if (!body.property_id) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
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

    // Create asset register job
    const jobs = await sql`
      INSERT INTO asset_register_jobs (
        organization_id, property_id, assigned_to_user_id,
        status, priority, scheduled_date, notes,
        external_request_id, external_source, external_property_id,
        created_at, updated_at
      ) VALUES (
        ${body.organization_id},
        ${body.property_id},
        ${body.assigned_to_user_id || null},
        ${body.status || 'CREATED'},
        ${body.priority || 'MEDIUM'},
        ${body.scheduled_date || null},
        ${body.notes || null},
        ${body.external_request_id || null},
        ${body.external_source || 'property_pal'},
        ${body.external_property_id || null},
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
    console.error('Error creating asset register job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
