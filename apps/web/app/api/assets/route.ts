import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all assets for a property or organization
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

    // Get query params
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('property_id')
    const organizationId = searchParams.get('organization_id')
    const category = searchParams.get('category')
    const condition = searchParams.get('condition')
    const room = searchParams.get('room')

    let assets
    if (propertyId) {
      // Verify user has access to property's organization
      const property = await sql`
        SELECT p.*, om.role
        FROM properties p
        INNER JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE p.id = ${propertyId}
        AND om.user_id = ${user.id}
        AND om.status = 'active'
        LIMIT 1
      `

      if (property.length === 0) {
        return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })
      }

      // Build query with filters
      assets = await sql`
        SELECT
          a.*,
          p.address_street,
          p.address_suburb,
          (SELECT COUNT(*) FROM asset_photos ap WHERE ap.asset_id = a.id) as photo_count
        FROM assets a
        INNER JOIN properties p ON a.property_id = p.id
        WHERE a.property_id = ${propertyId}
        ${category ? sql`AND a.category = ${category}` : sql``}
        ${condition ? sql`AND a.condition = ${condition}` : sql``}
        ${room ? sql`AND a.room = ${room}` : sql``}
        ORDER BY a.room, a.name
      `
    } else if (organizationId) {
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

      // Get all assets for organization
      assets = await sql`
        SELECT
          a.*,
          p.address_street,
          p.address_suburb,
          (SELECT COUNT(*) FROM asset_photos ap WHERE ap.asset_id = a.id) as photo_count
        FROM assets a
        INNER JOIN properties p ON a.property_id = p.id
        WHERE a.organization_id = ${organizationId}
        ${category ? sql`AND a.category = ${category}` : sql``}
        ${condition ? sql`AND a.condition = ${condition}` : sql``}
        ${room ? sql`AND a.room = ${room}` : sql``}
        ORDER BY p.address_suburb, p.address_street, a.room, a.name
      `
    } else {
      // Get all assets for all user's organizations
      assets = await sql`
        SELECT
          a.*,
          p.address_street,
          p.address_suburb,
          o.name as organization_name,
          (SELECT COUNT(*) FROM asset_photos ap WHERE ap.asset_id = a.id) as photo_count
        FROM assets a
        INNER JOIN properties p ON a.property_id = p.id
        INNER JOIN organizations o ON a.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ${user.id}
        AND om.status = 'active'
        ${category ? sql`AND a.category = ${category}` : sql``}
        ${condition ? sql`AND a.condition = ${condition}` : sql``}
        ${room ? sql`AND a.room = ${room}` : sql``}
        ORDER BY o.name, p.address_suburb, p.address_street, a.room, a.name
      `
    }

    return NextResponse.json({
      assets,
    })
  } catch (error) {
    console.error('Error fetching assets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new asset
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
    if (!body.property_id) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
    }

    if (!body.name) {
      return NextResponse.json({ error: 'Asset name is required' }, { status: 400 })
    }

    // Verify user has access to property's organization
    const property = await sql`
      SELECT p.*, om.role, om.can_create_jobs
      FROM properties p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = ${body.property_id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (property.length === 0) {
      return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })
    }

    const propertyData = property[0]

    // Create asset
    const assets = await sql`
      INSERT INTO assets (
        organization_id, property_id,
        name, category, brand, model, serial_number,
        room, location,
        condition, estimated_age, warranty_status, warranty_expiry, maintenance_required,
        current_value, replacement_cost, expected_lifespan_years,
        notes, captured_by_id,
        external_asset_id, synced_at,
        created_at, updated_at
      ) VALUES (
        ${propertyData.organization_id},
        ${body.property_id},
        ${body.name},
        ${body.category || 'OTHER'},
        ${body.brand || null},
        ${body.model || null},
        ${body.serial_number || null},
        ${body.room || null},
        ${body.location || null},
        ${body.condition || 'GOOD'},
        ${body.estimated_age || null},
        ${body.warranty_status || null},
        ${body.warranty_expiry || null},
        ${body.maintenance_required || 'NONE'},
        ${body.current_value || null},
        ${body.replacement_cost || null},
        ${body.expected_lifespan_years || null},
        ${body.notes || null},
        ${user.id},
        ${body.external_asset_id || null},
        ${body.external_asset_id ? sql`NOW()` : null},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      asset: assets[0],
    })
  } catch (error) {
    console.error('Error creating asset:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
