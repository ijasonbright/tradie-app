import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { fetchProviderCalendar } from '@/lib/tradieconnect'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/tradieconnect/calendar
 *
 * Fetches the provider calendar (teams, providers, and jobs) from TradieConnect.
 * By default, fetches today and tomorrow's schedule.
 *
 * Query params:
 * - date: Specific date to fetch (YYYY-MM-DD format). If not provided, fetches today.
 * - days: Number of days to fetch (default 2 = today + tomorrow)
 * - teamId: Filter by specific team ID (default 0 = all teams)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const daysParam = searchParams.get('days')
    const teamIdParam = searchParams.get('teamId')

    // Parse parameters
    const days = daysParam ? parseInt(daysParam, 10) : 2
    const teamId = teamIdParam ? parseInt(teamIdParam, 10) : 0

    // Calculate dates to fetch
    const dates: string[] = []
    const startDate = dateParam ? new Date(dateParam) : new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      // Format as YYYY-MM-DD
      dates.push(date.toISOString().split('T')[0])
    }

    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization')
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

    // Get the user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get active TradieConnect connection
    const connections = await sql`
      SELECT
        id,
        tc_user_id,
        tc_token,
        tc_refresh_token
      FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      AND is_active = true
      LIMIT 1
    `

    if (connections.length === 0) {
      return NextResponse.json({
        error: 'No active TradieConnect connection found',
        needs_connect: true,
      }, { status: 400 })
    }

    const connection = connections[0]
    const tcToken = connection.tc_token

    // Fetch calendar for each date
    const results: {
      date: string
      teams: any[]
      jobCount: number
      providerCount: number
    }[] = []

    let totalJobs = 0
    let totalProviders = 0
    const allTeams = new Map<number, { teamId: number; name: string }>()

    for (const date of dates) {
      const result = await fetchProviderCalendar(
        connection.tc_user_id,
        tcToken,
        date,
        teamId,
        0
      )

      if (!result.success) {
        // If unauthorized, indicate reconnection needed
        if (result.unauthorized) {
          return NextResponse.json({
            error: 'TradieConnect token expired',
            needs_reconnect: true,
          }, { status: 401 })
        }

        return NextResponse.json({
          error: result.error || 'Failed to fetch calendar',
        }, { status: 400 })
      }

      // Count jobs and providers for this date
      let dateJobCount = 0
      let dateProviderCount = 0
      const dateProviderIds = new Set<number>()

      for (const team of result.teams || []) {
        allTeams.set(team.teamId, { teamId: team.teamId, name: team.name })

        for (const schedule of team.schedules) {
          dateJobCount += schedule.jobs.length

          for (const provider of schedule.providers) {
            if (!dateProviderIds.has(provider.providerId)) {
              dateProviderIds.add(provider.providerId)
              dateProviderCount++
            }
          }
        }
      }

      totalJobs += dateJobCount
      totalProviders = Math.max(totalProviders, dateProviderCount) // Use max since providers repeat across days

      results.push({
        date,
        teams: result.teams || [],
        jobCount: dateJobCount,
        providerCount: dateProviderCount,
      })
    }

    // Update last_synced_at timestamp
    await sql`
      UPDATE tradieconnect_connections
      SET last_synced_at = NOW(), updated_at = NOW()
      WHERE id = ${connection.id}
    `

    return NextResponse.json({
      success: true,
      dates: results,
      summary: {
        totalJobs,
        totalProviders,
        totalTeams: allTeams.size,
        teams: Array.from(allTeams.values()),
        dateRange: {
          from: dates[0],
          to: dates[dates.length - 1],
        },
      },
    })
  } catch (error) {
    console.error('Error fetching TradieConnect calendar:', error)
    return NextResponse.json(
      { error: 'Failed to fetch TradieConnect calendar' },
      { status: 500 }
    )
  }
}
