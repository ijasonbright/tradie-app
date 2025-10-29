import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)

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

    const { id: clientId } = await params

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get user's organization memberships
    const memberships = await sql`
      SELECT organization_id
      FROM organization_members
      WHERE user_id = ${user.id}
      AND status = 'active'
    `

    if (memberships.length === 0) {
      return NextResponse.json({ error: 'No organization membership found' }, { status: 403 })
    }

    const organizationIds = memberships.map(m => m.organization_id)

    // Get client - ensure it belongs to one of user's organizations
    const clients = await sql`
      SELECT *
      FROM clients
      WHERE id = ${clientId}
      AND organization_id = ANY(${organizationIds})
      LIMIT 1
    `

    if (clients.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      client: clients[0],
    })
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: 'Failed to fetch client', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)

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

    const { id: clientId } = await params
    const body = await req.json()

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get user's organization memberships
    const memberships = await sql`
      SELECT organization_id
      FROM organization_members
      WHERE user_id = ${user.id}
      AND status = 'active'
    `

    if (memberships.length === 0) {
      return NextResponse.json({ error: 'No organization membership found' }, { status: 403 })
    }

    const organizationIds = memberships.map(m => m.organization_id)

    // Verify client belongs to user's organization
    const existingClients = await sql`
      SELECT *
      FROM clients
      WHERE id = ${clientId}
      AND organization_id = ANY(${organizationIds})
      LIMIT 1
    `

    if (existingClients.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Update client
    const updatedClients = await sql`
      UPDATE clients
      SET
        is_company = ${body.isCompany ?? existingClients[0].is_company},
        company_name = ${body.companyName ?? existingClients[0].company_name},
        first_name = ${body.firstName ?? existingClients[0].first_name},
        last_name = ${body.lastName ?? existingClients[0].last_name},
        email = ${body.email ?? existingClients[0].email},
        phone = ${body.phone ?? existingClients[0].phone},
        mobile = ${body.mobile ?? existingClients[0].mobile},
        abn = ${body.abn ?? existingClients[0].abn},
        site_address_line1 = ${body.siteAddressLine1 ?? existingClients[0].site_address_line1},
        site_address_line2 = ${body.siteAddressLine2 ?? existingClients[0].site_address_line2},
        site_city = ${body.siteCity ?? existingClients[0].site_city},
        site_state = ${body.siteState ?? existingClients[0].site_state},
        site_postcode = ${body.sitePostcode ?? existingClients[0].site_postcode},
        billing_address_same_as_site = ${body.billingAddressSameAsSite ?? existingClients[0].billing_address_same_as_site},
        billing_address_line1 = ${body.billingAddressLine1 ?? existingClients[0].billing_address_line1},
        billing_address_line2 = ${body.billingAddressLine2 ?? existingClients[0].billing_address_line2},
        billing_city = ${body.billingCity ?? existingClients[0].billing_city},
        billing_state = ${body.billingState ?? existingClients[0].billing_state},
        billing_postcode = ${body.billingPostcode ?? existingClients[0].billing_postcode},
        notes = ${body.notes ?? existingClients[0].notes},
        updated_at = NOW()
      WHERE id = ${clientId}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      client: updatedClients[0],
    })
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: 'Failed to update client', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
