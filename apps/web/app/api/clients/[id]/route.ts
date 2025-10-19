import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Get a single client by ID
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get client with organization access check
    const clients = await sql`
      SELECT
        c.*,
        o.name as organization_name
      FROM clients c
      INNER JOIN organizations o ON c.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE c.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (clients.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({
      client: clients[0],
    })
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update a client
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    // Verify user has access to this client's organization
    const clients = await sql`
      SELECT c.*, om.role, om.can_create_jobs
      FROM clients c
      INNER JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE c.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (clients.length === 0) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 })
    }

    const client = clients[0]

    // Check permissions
    if (client.role !== 'owner' && client.role !== 'admin' && !client.can_create_jobs) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Update client
    const updatedClients = await sql`
      UPDATE clients
      SET
        client_type = COALESCE(${body.clientType}, client_type),
        is_company = COALESCE(${body.isCompany}, is_company),
        company_name = ${body.companyName !== undefined ? body.companyName : client.company_name},
        first_name = ${body.firstName !== undefined ? body.firstName : client.first_name},
        last_name = ${body.lastName !== undefined ? body.lastName : client.last_name},
        email = ${body.email !== undefined ? body.email : client.email},
        phone = ${body.phone !== undefined ? body.phone : client.phone},
        mobile = ${body.mobile !== undefined ? body.mobile : client.mobile},
        site_address_line1 = ${body.siteAddressLine1 !== undefined ? body.siteAddressLine1 : client.site_address_line1},
        site_address_line2 = ${body.siteAddressLine2 !== undefined ? body.siteAddressLine2 : client.site_address_line2},
        site_city = ${body.siteCity !== undefined ? body.siteCity : client.site_city},
        site_state = ${body.siteState !== undefined ? body.siteState : client.site_state},
        site_postcode = ${body.sitePostcode !== undefined ? body.sitePostcode : client.site_postcode},
        billing_address_same_as_site = COALESCE(${body.billingAddressSameAsSite}, billing_address_same_as_site),
        billing_address_line1 = ${body.billingAddressLine1 !== undefined ? body.billingAddressLine1 : client.billing_address_line1},
        billing_address_line2 = ${body.billingAddressLine2 !== undefined ? body.billingAddressLine2 : client.billing_address_line2},
        billing_city = ${body.billingCity !== undefined ? body.billingCity : client.billing_city},
        billing_state = ${body.billingState !== undefined ? body.billingState : client.billing_state},
        billing_postcode = ${body.billingPostcode !== undefined ? body.billingPostcode : client.billing_postcode},
        notes = ${body.notes !== undefined ? body.notes : client.notes},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      client: updatedClients[0],
    })
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a client
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has access and is owner/admin
    const clients = await sql`
      SELECT c.*, om.role
      FROM clients c
      INNER JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE c.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (clients.length === 0) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 })
    }

    const client = clients[0]

    // Only owner or admin can delete clients
    if (client.role !== 'owner' && client.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can delete clients' }, { status: 403 })
    }

    // Delete client
    await sql`
      DELETE FROM clients WHERE id = ${id}
    `

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
