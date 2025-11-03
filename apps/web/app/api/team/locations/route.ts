import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get all team member locations for the organization
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

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const maxAgeMinutes = parseInt(searchParams.get('maxAge') || '60') // Default: locations from last 60 minutes

    // Get user's organization
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

    // Get all team member locations
    // Filter by:
    // - Same organization
    // - Active location sharing (unless includeInactive=true)
    // - Updated within maxAgeMinutes
    // Calculate the timestamp for filtering
    const maxAgeDate = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const locations = await sql`
      SELECT
        tml.id,
        tml.user_id,
        tml.latitude,
        tml.longitude,
        tml.accuracy,
        tml.heading,
        tml.speed,
        tml.altitude,
        tml.is_active,
        tml.last_updated_at,
        u.full_name,
        u.email,
        u.phone,
        u.profile_photo_url,
        om.role,
        om.employment_type,
        tt.name as primary_trade_name,
        -- Calculate minutes since last update
        EXTRACT(EPOCH FROM (NOW() - tml.last_updated_at)) / 60 as minutes_since_update
      FROM team_member_locations tml
      INNER JOIN users u ON tml.user_id = u.id
      INNER JOIN organization_members om ON tml.user_id = om.user_id AND tml.organization_id = om.organization_id
      LEFT JOIN trade_types tt ON om.primary_trade_id = tt.id
      WHERE tml.organization_id = ${organizationId}
      AND om.status = 'active'
      ${includeInactive ? sql`` : sql`AND tml.is_active = true`}
      AND tml.last_updated_at > ${maxAgeDate.toISOString()}
      ORDER BY tml.last_updated_at DESC
    `

    return NextResponse.json({
      locations,
      count: locations.length,
      maxAgeMinutes,
    })
  } catch (error) {
    console.error('Error fetching team locations:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
