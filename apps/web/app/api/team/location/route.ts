import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Update current location
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

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

    // Validate required fields
    if (body.latitude === undefined || body.longitude === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: latitude, longitude' },
        { status: 400 }
      )
    }

    // Get user's active organization
    const memberships = await sql`
      SELECT organization_id FROM organization_members
      WHERE user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (memberships.length === 0) {
      return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    }

    const organizationId = memberships[0].organization_id

    // Check if location record exists
    const existingLocations = await sql`
      SELECT id FROM team_member_locations
      WHERE user_id = ${user.id}
      AND organization_id = ${organizationId}
      LIMIT 1
    `

    if (existingLocations.length > 0) {
      // Update existing location
      const locations = await sql`
        UPDATE team_member_locations
        SET
          latitude = ${body.latitude},
          longitude = ${body.longitude},
          accuracy = ${body.accuracy || null},
          heading = ${body.heading || null},
          speed = ${body.speed || null},
          altitude = ${body.altitude || null},
          is_active = ${body.isActive !== undefined ? body.isActive : true},
          last_updated_at = NOW()
        WHERE id = ${existingLocations[0].id}
        RETURNING *
      `

      return NextResponse.json({ location: locations[0] })
    } else {
      // Create new location record
      const locations = await sql`
        INSERT INTO team_member_locations (
          user_id, organization_id, latitude, longitude,
          accuracy, heading, speed, altitude, is_active,
          last_updated_at, created_at
        ) VALUES (
          ${user.id},
          ${organizationId},
          ${body.latitude},
          ${body.longitude},
          ${body.accuracy || null},
          ${body.heading || null},
          ${body.speed || null},
          ${body.altitude || null},
          ${body.isActive !== undefined ? body.isActive : true},
          NOW(),
          NOW()
        ) RETURNING *
      `

      return NextResponse.json({ location: locations[0] }, { status: 201 })
    }
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Toggle location sharing on/off
export async function PUT(req: Request) {
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

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

    // Validate required field
    if (body.isActive === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: isActive' },
        { status: 400 }
      )
    }

    // Get user's active organization
    const memberships = await sql`
      SELECT organization_id FROM organization_members
      WHERE user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (memberships.length === 0) {
      return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
    }

    const organizationId = memberships[0].organization_id

    // Update location sharing status
    const locations = await sql`
      UPDATE team_member_locations
      SET is_active = ${body.isActive}, last_updated_at = NOW()
      WHERE user_id = ${user.id}
      AND organization_id = ${organizationId}
      RETURNING *
    `

    if (locations.length === 0) {
      return NextResponse.json({ error: 'Location record not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: body.isActive ? 'Location sharing enabled' : 'Location sharing disabled',
      location: locations[0]
    })
  } catch (error) {
    console.error('Error toggling location sharing:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
