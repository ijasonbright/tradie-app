import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all clients for user's organizations
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

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get all clients for organizations the user is a member of
    const clients = await sql`
      SELECT
        c.*,
        o.name as organization_name
      FROM clients c
      INNER JOIN organizations o ON c.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      ORDER BY c.created_at DESC
    `

    return NextResponse.json({
      clients,
    })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new client
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

    if (!body.clientType) {
      return NextResponse.json({ error: 'Client type is required' }, { status: 400 })
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

    // Check permissions (can_create_jobs permission also allows client creation)
    const member = membership[0]
    if (member.role !== 'owner' && member.role !== 'admin' && !member.can_create_jobs) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Create client
    const clients = await sql`
      INSERT INTO clients (
        organization_id, client_type, is_company,
        company_name, first_name, last_name,
        email, phone, mobile,
        site_address_line1, site_address_line2,
        site_city, site_state, site_postcode,
        billing_address_same_as_site,
        billing_address_line1, billing_address_line2,
        billing_city, billing_state, billing_postcode,
        notes, created_by_user_id,
        created_at, updated_at
      ) VALUES (
        ${body.organizationId},
        ${body.clientType},
        ${body.isCompany || false},
        ${body.companyName || null},
        ${body.firstName || null},
        ${body.lastName || null},
        ${body.email || null},
        ${body.phone || null},
        ${body.mobile || null},
        ${body.siteAddressLine1 || null},
        ${body.siteAddressLine2 || null},
        ${body.siteCity || null},
        ${body.siteState || null},
        ${body.sitePostcode || null},
        ${body.billingAddressSameAsSite !== false},
        ${body.billingAddressLine1 || null},
        ${body.billingAddressLine2 || null},
        ${body.billingCity || null},
        ${body.billingState || null},
        ${body.billingPostcode || null},
        ${body.notes || null},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      client: clients[0],
    })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
