import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { fetchProviderCalendar, TCJob, TCProvider, TCTeam } from '@/lib/tradieconnect'

export const dynamic = 'force-dynamic'

interface JobWithCoworkers extends TCJob {
  coworkers: TCProvider[]
  teamName: string
}

/**
 * GET /api/integrations/tradieconnect/my-jobs
 *
 * Fetches jobs assigned to the current user from TradieConnect.
 * Matches user by tc_provider_id if stored, otherwise by email address.
 * After first successful match by email, stores the tc_provider_id for future syncs.
 *
 * Query params:
 * - date: Specific date to fetch (YYYY-MM-DD format). If not provided, fetches today.
 * - days: Number of days to fetch (default 2 = today + tomorrow)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const daysParam = searchParams.get('days')

    // Parse parameters
    const days = daysParam ? parseInt(daysParam, 10) : 2

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

    // Get the user from database including tc_provider_id (stored during SSO)
    const users = await sql`
      SELECT id, tc_provider_id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]
    const tcProviderId: number | null = user.tc_provider_id

    // tc_provider_id is required - it's stored during TradieConnect SSO authentication
    if (!tcProviderId) {
      return NextResponse.json({
        error: 'TradieConnect provider ID not found. Please reconnect to TradieConnect.',
        needs_reconnect: true,
      }, { status: 400 })
    }

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

    // Fetch calendar for each date and filter to user's jobs
    const results: {
      date: string
      jobs: JobWithCoworkers[]
    }[] = []

    let totalJobs = 0

    for (const date of dates) {
      const result = await fetchProviderCalendar(
        connection.tc_user_id,
        tcToken,
        date,
        0, // all teams
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

      // Build a map of all providers by team for co-worker lookup
      const teamProviders = new Map<number, TCProvider[]>()
      const teamNames = new Map<number, string>()

      for (const team of result.teams || []) {
        teamNames.set(team.teamId, team.name)
        for (const schedule of team.schedules) {
          const existing = teamProviders.get(team.teamId) || []
          for (const provider of schedule.providers) {
            if (!existing.find(p => p.providerId === provider.providerId)) {
              existing.push(provider)
            }
          }
          teamProviders.set(team.teamId, existing)
        }
      }

      // Find jobs where this user (provider) is assigned
      // A provider is assigned to jobs in teams they're part of
      const userJobs: JobWithCoworkers[] = []

      for (const team of result.teams || []) {
        for (const schedule of team.schedules) {
          // Check if this user is in this team's providers for this schedule
          const isUserInTeam = schedule.providers.some(p => p.providerId === tcProviderId)

          if (isUserInTeam) {
            // User is assigned to this team's jobs for this date
            for (const job of schedule.jobs) {
              // Get co-workers (other providers in the same team, excluding self)
              const coworkers = (teamProviders.get(team.teamId) || [])
                .filter(p => p.providerId !== tcProviderId)

              userJobs.push({
                ...job,
                coworkers,
                teamName: team.name,
              })
            }
          }
        }
      }

      totalJobs += userJobs.length

      results.push({
        date,
        jobs: userJobs,
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
      tc_provider_id: tcProviderId,
      dates: results,
      summary: {
        totalJobs,
        dateRange: {
          from: dates[0],
          to: dates[dates.length - 1],
        },
      },
    })
  } catch (error) {
    console.error('Error fetching TradieConnect my-jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch TradieConnect jobs' },
      { status: 500 }
    )
  }
}
