import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get a single property by ID
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params

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

    // Get property with organization membership check
    const properties = await sql`
      SELECT
        p.*,
        o.name as organization_name,
        (SELECT COUNT(*) FROM assets a WHERE a.property_id = p.id) as asset_count
      FROM properties p
      INNER JOIN organizations o ON p.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE p.id = ${propertyId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (properties.length === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    return NextResponse.json({
      property: properties[0],
    })
  } catch (error) {
    console.error('Error fetching property:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update a property
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params

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

    // Check property exists and user has access
    const existing = await sql`
      SELECT p.*, om.role
      FROM properties p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = ${propertyId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Check permissions
    const member = existing[0]
    if (member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Update property
    const properties = await sql`
      UPDATE properties SET
        address_street = COALESCE(${body.address_street}, address_street),
        address_suburb = COALESCE(${body.address_suburb}, address_suburb),
        address_state = COALESCE(${body.address_state}, address_state),
        address_postcode = COALESCE(${body.address_postcode}, address_postcode),
        property_type = COALESCE(${body.property_type}, property_type),
        bedrooms = COALESCE(${body.bedrooms}, bedrooms),
        bathrooms = COALESCE(${body.bathrooms}, bathrooms),
        owner_name = COALESCE(${body.owner_name}, owner_name),
        owner_phone = COALESCE(${body.owner_phone}, owner_phone),
        owner_email = COALESCE(${body.owner_email}, owner_email),
        tenant_name = COALESCE(${body.tenant_name}, tenant_name),
        tenant_phone = COALESCE(${body.tenant_phone}, tenant_phone),
        tenant_email = COALESCE(${body.tenant_email}, tenant_email),
        access_instructions = COALESCE(${body.access_instructions}, access_instructions),
        notes = COALESCE(${body.notes}, notes),
        updated_at = NOW()
      WHERE id = ${propertyId}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      property: properties[0],
    })
  } catch (error) {
    console.error('Error updating property:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a property
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params

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

    // Check property exists and user has access
    const existing = await sql`
      SELECT p.*, om.role
      FROM properties p
      INNER JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = ${propertyId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Only owners can delete
    if (existing[0].role !== 'owner') {
      return NextResponse.json({ error: 'Only organization owners can delete properties' }, { status: 403 })
    }

    // Delete property (assets will cascade delete due to FK)
    await sql`DELETE FROM properties WHERE id = ${propertyId}`

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting property:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
