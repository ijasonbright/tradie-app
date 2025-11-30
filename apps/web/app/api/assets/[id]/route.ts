import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get a single asset by ID with photos
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params

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

    // Get asset with organization membership check
    const assets = await sql`
      SELECT
        a.*,
        p.address_street,
        p.address_suburb,
        p.address_state,
        p.address_postcode,
        o.name as organization_name
      FROM assets a
      INNER JOIN properties p ON a.property_id = p.id
      INNER JOIN organizations o ON a.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE a.id = ${assetId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (assets.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Get photos for the asset
    const photos = await sql`
      SELECT * FROM asset_photos
      WHERE asset_id = ${assetId}
      ORDER BY taken_at DESC
    `

    return NextResponse.json({
      asset: {
        ...assets[0],
        photos,
      },
    })
  } catch (error) {
    console.error('Error fetching asset:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update an asset
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params

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

    // Check asset exists and user has access
    const existing = await sql`
      SELECT a.*, om.role
      FROM assets a
      INNER JOIN organization_members om ON a.organization_id = om.organization_id
      WHERE a.id = ${assetId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Update asset
    const assets = await sql`
      UPDATE assets SET
        name = COALESCE(${body.name}, name),
        category = COALESCE(${body.category}, category),
        brand = COALESCE(${body.brand}, brand),
        model = COALESCE(${body.model}, model),
        serial_number = COALESCE(${body.serial_number}, serial_number),
        room = COALESCE(${body.room}, room),
        location = COALESCE(${body.location}, location),
        condition = COALESCE(${body.condition}, condition),
        estimated_age = COALESCE(${body.estimated_age}, estimated_age),
        warranty_status = COALESCE(${body.warranty_status}, warranty_status),
        warranty_expiry = COALESCE(${body.warranty_expiry}, warranty_expiry),
        maintenance_required = COALESCE(${body.maintenance_required}, maintenance_required),
        current_value = COALESCE(${body.current_value}, current_value),
        replacement_cost = COALESCE(${body.replacement_cost}, replacement_cost),
        expected_lifespan_years = COALESCE(${body.expected_lifespan_years}, expected_lifespan_years),
        notes = COALESCE(${body.notes}, notes),
        updated_at = NOW()
      WHERE id = ${assetId}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      asset: assets[0],
    })
  } catch (error) {
    console.error('Error updating asset:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an asset
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params

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

    // Check asset exists and user has access
    const existing = await sql`
      SELECT a.*, om.role
      FROM assets a
      INNER JOIN organization_members om ON a.organization_id = om.organization_id
      WHERE a.id = ${assetId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Check permissions (admin or owner)
    if (existing[0].role !== 'owner' && existing[0].role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Delete asset (photos will cascade delete due to FK)
    await sql`DELETE FROM assets WHERE id = ${assetId}`

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting asset:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
