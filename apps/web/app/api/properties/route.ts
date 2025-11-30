import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all properties for user's organizations
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

    // Get organization_id from query params if provided
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organization_id')

    let properties
    if (organizationId) {
      // Verify user has access to this organization
      const membership = await sql`
        SELECT * FROM organization_members
        WHERE organization_id = ${organizationId}
        AND user_id = ${user.id}
        AND status = 'active'
        LIMIT 1
      `

      if (membership.length === 0) {
        return NextResponse.json({ error: 'Access denied to this organization' }, { status: 403 })
      }

      // Get properties for specific organization
      properties = await sql`
        SELECT
          p.*,
          o.name as organization_name,
          (SELECT COUNT(*) FROM assets a WHERE a.property_id = p.id) as asset_count
        FROM properties p
        INNER JOIN organizations o ON p.organization_id = o.id
        WHERE p.organization_id = ${organizationId}
        ORDER BY p.address_suburb, p.address_street
      `
    } else {
      // Get all properties for organizations the user is a member of
      properties = await sql`
        SELECT
          p.*,
          o.name as organization_name,
          (SELECT COUNT(*) FROM assets a WHERE a.property_id = p.id) as asset_count
        FROM properties p
        INNER JOIN organizations o ON p.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ${user.id}
        AND om.status = 'active'
        ORDER BY p.address_suburb, p.address_street
      `
    }

    return NextResponse.json({
      properties,
    })
  } catch (error) {
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new property (typically via webhook from Property Pal)
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

    if (!body.external_property_id) {
      return NextResponse.json({ error: 'External property ID is required' }, { status: 400 })
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
    if (member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if property already exists (by external_property_id)
    const existing = await sql`
      SELECT * FROM properties
      WHERE organization_id = ${body.organization_id}
      AND external_property_id = ${body.external_property_id}
      LIMIT 1
    `

    if (existing.length > 0) {
      // Update existing property
      const properties = await sql`
        UPDATE properties SET
          address_street = ${body.address_street || null},
          address_suburb = ${body.address_suburb || null},
          address_state = ${body.address_state || null},
          address_postcode = ${body.address_postcode || null},
          property_type = ${body.property_type || null},
          bedrooms = ${body.bedrooms || null},
          bathrooms = ${body.bathrooms || null},
          owner_name = ${body.owner_name || null},
          owner_phone = ${body.owner_phone || null},
          owner_email = ${body.owner_email || null},
          tenant_name = ${body.tenant_name || null},
          tenant_phone = ${body.tenant_phone || null},
          tenant_email = ${body.tenant_email || null},
          access_instructions = ${body.access_instructions || null},
          notes = ${body.notes || null},
          synced_at = NOW(),
          updated_at = NOW()
        WHERE id = ${existing[0].id}
        RETURNING *
      `
      return NextResponse.json({
        success: true,
        property: properties[0],
        updated: true,
      })
    }

    // Create new property
    const properties = await sql`
      INSERT INTO properties (
        organization_id, external_property_id,
        address_street, address_suburb, address_state, address_postcode,
        property_type, bedrooms, bathrooms,
        owner_name, owner_phone, owner_email,
        tenant_name, tenant_phone, tenant_email,
        access_instructions, notes,
        synced_at, created_at, updated_at
      ) VALUES (
        ${body.organization_id},
        ${body.external_property_id},
        ${body.address_street || null},
        ${body.address_suburb || null},
        ${body.address_state || null},
        ${body.address_postcode || null},
        ${body.property_type || null},
        ${body.bedrooms || null},
        ${body.bathrooms || null},
        ${body.owner_name || null},
        ${body.owner_phone || null},
        ${body.owner_email || null},
        ${body.tenant_name || null},
        ${body.tenant_phone || null},
        ${body.tenant_email || null},
        ${body.access_instructions || null},
        ${body.notes || null},
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      property: properties[0],
    })
  } catch (error) {
    console.error('Error creating property:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
