import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get map overview with team locations and job locations
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
    const maxAgeMinutes = parseInt(searchParams.get('maxAge') || '60')
    const jobStatus = searchParams.get('jobStatus') || 'scheduled,in_progress' // Default: active jobs

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

    // Get team member locations
    const teamLocations = await sql`
      SELECT
        tml.id,
        tml.user_id,
        tml.latitude,
        tml.longitude,
        tml.accuracy,
        tml.heading,
        tml.speed,
        tml.last_updated_at,
        u.full_name,
        u.email,
        u.profile_photo_url,
        om.role,
        tt.name as primary_trade_name,
        EXTRACT(EPOCH FROM (NOW() - tml.last_updated_at)) / 60 as minutes_since_update
      FROM team_member_locations tml
      INNER JOIN users u ON tml.user_id = u.id
      INNER JOIN organization_members om ON tml.user_id = om.user_id AND tml.organization_id = om.organization_id
      LEFT JOIN trade_types tt ON om.primary_trade_id = tt.id
      WHERE tml.organization_id = ${organizationId}
      AND om.status = 'active'
      AND tml.is_active = true
      AND tml.last_updated_at > NOW() - INTERVAL '${sql.raw(maxAgeMinutes.toString())} minutes'
      ORDER BY tml.last_updated_at DESC
    `

    // Get job locations (jobs with valid addresses)
    // Parse job statuses
    const statuses = jobStatus.split(',').map(s => s.trim())

    const jobLocations = await sql`
      SELECT
        j.id,
        j.job_number,
        j.title,
        j.description,
        j.status,
        j.priority,
        j.site_address_line1,
        j.site_address_line2,
        j.site_city,
        j.site_state,
        j.site_postcode,
        j.scheduled_date,
        j.scheduled_start_time,
        j.scheduled_end_time,
        j.assigned_to_user_id,
        assigned_user.full_name as assigned_to_name,
        c.company_name,
        c.first_name as client_first_name,
        c.last_name as client_last_name,
        c.is_company as client_is_company
      FROM jobs j
      LEFT JOIN users assigned_user ON j.assigned_to_user_id = assigned_user.id
      INNER JOIN clients c ON j.client_id = c.id
      WHERE j.organization_id = ${organizationId}
      AND j.status = ANY(${statuses})
      AND j.site_address_line1 IS NOT NULL
      ORDER BY
        CASE j.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        j.scheduled_date ASC NULLS LAST
    `

    // Calculate distances between team members and jobs
    // Haversine formula for distance calculation
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371 // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c // Distance in km
    }

    // For each job, find the nearest team member
    // Note: This is a simple implementation. For production, you might want to use a geocoding service
    // to get exact lat/long for job addresses
    const jobsWithNearestTeam = jobLocations.map(job => {
      // For now, we'll just return the job without distance calculations
      // In a full implementation, you'd geocode the job address to get lat/long
      return {
        ...job,
        // nearestTeamMember: null, // Would calculate if we had job coordinates
        // distanceKm: null,
      }
    })

    return NextResponse.json({
      teamLocations: teamLocations.map(loc => ({
        ...loc,
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        accuracy: loc.accuracy ? parseFloat(loc.accuracy) : null,
        heading: loc.heading ? parseFloat(loc.heading) : null,
        speed: loc.speed ? parseFloat(loc.speed) : null,
      })),
      jobLocations: jobsWithNearestTeam,
      stats: {
        activeTeamMembers: teamLocations.length,
        activeJobs: jobLocations.length,
        maxAgeMinutes,
      },
    })
  } catch (error) {
    console.error('Error fetching map overview:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
