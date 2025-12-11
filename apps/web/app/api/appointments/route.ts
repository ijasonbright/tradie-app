import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { fetchProviderCalendar, TCProvider, TCJob } from '@/lib/tradieconnect'

export const dynamic = 'force-dynamic'

interface TCAppointment {
  id: string
  organization_id: string | null
  title: string
  description: string
  appointment_type: string
  start_time: string
  end_time: string
  location_address: string
  job_id: string | null
  client_id: string | null
  assigned_to_user_id: string | null
  assigned_to_name: string | null
  created_by_name: string | null
  company_name: string | null
  first_name: string
  last_name: string
  is_company: boolean
  client_phone: string
  client_mobile: string
  job_number: string
  job_title: string
  // TradieConnect specific fields
  tc_job_id?: number
  tc_team_id?: number
  tc_team_name?: string
  tc_status?: string
  tc_lat?: number
  tc_long?: number
  coworkers?: TCProvider[]
}

// GET - List all appointments for user's organization(s)
export async function GET(req: Request) {
  try {
    // Try to get auth from Clerk (web) first
    let userId: string | null = null

    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!userId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          userId = payload.clerkUserId
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('start_date') || searchParams.get('startDate')
    const endDate = searchParams.get('end_date') || searchParams.get('endDate')
    const assignedToUserId = searchParams.get('assignedToUserId')

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const params: any[] = [user.id]

    // Build WHERE conditions for date filtering
    // For single day or specific range, we want items that START within the range
    let dateCondition = ''
    if (startDate && endDate) {
      dateCondition = ` AND start_time >= '${startDate}' AND start_time < '${endDate}'`
    } else if (startDate) {
      dateCondition = ` AND start_time >= '${startDate}'`
    } else if (endDate) {
      dateCondition = ` AND start_time < '${endDate}'`
    }

    let assignedCondition = ''
    if (assignedToUserId) {
      assignedCondition = ` AND assigned_to_user_id = '${assignedToUserId}'`
    }

    // Query to get both appointments AND scheduled jobs
    const query = `
      SELECT
        a.id,
        a.organization_id,
        a.title,
        a.description,
        a.appointment_type,
        a.start_time,
        a.end_time,
        a.location_address,
        a.job_id,
        a.client_id,
        a.assigned_to_user_id,
        u1.full_name as assigned_to_name,
        u2.full_name as created_by_name,
        c.company_name, c.first_name, c.last_name, c.is_company, c.phone as client_phone, c.mobile as client_mobile,
        j.job_number, j.title as job_title
      FROM appointments a
      INNER JOIN organizations o ON a.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      LEFT JOIN users u1 ON a.assigned_to_user_id = u1.id
      LEFT JOIN users u2 ON a.created_by_user_id = u2.id
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN jobs j ON a.job_id = j.id
      WHERE om.user_id = $1
      AND om.status = 'active'
      ${dateCondition}
      ${assignedCondition}

      UNION ALL

      SELECT
        jobs.id,
        jobs.organization_id,
        jobs.title,
        jobs.description,
        'job' as appointment_type,
        jobs.scheduled_start_time as start_time,
        jobs.scheduled_end_time as end_time,
        CONCAT_WS(', ', jobs.site_address_line1, jobs.site_city, jobs.site_state, jobs.site_postcode) as location_address,
        jobs.id as job_id,
        jobs.client_id,
        jobs.assigned_to_user_id,
        u1.full_name as assigned_to_name,
        u2.full_name as created_by_name,
        c.company_name, c.first_name, c.last_name, c.is_company, c.phone as client_phone, c.mobile as client_mobile,
        jobs.job_number, jobs.title as job_title
      FROM jobs
      INNER JOIN organizations o ON jobs.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      LEFT JOIN users u1 ON jobs.assigned_to_user_id = u1.id
      LEFT JOIN users u2 ON jobs.created_by_user_id = u2.id
      LEFT JOIN clients c ON jobs.client_id = c.id
      WHERE om.user_id = $1
      AND om.status = 'active'
      AND jobs.scheduled_start_time IS NOT NULL
      AND jobs.scheduled_end_time IS NOT NULL
      ${dateCondition.replace(/start_time/g, 'scheduled_start_time').replace(/end_time/g, 'scheduled_end_time')}
      ${assignedCondition}

      UNION ALL

      SELECT
        arj.id,
        arj.organization_id,
        CONCAT('Asset Register - ', p.address_street) as title,
        arj.notes as description,
        'asset_register' as appointment_type,
        arj.scheduled_date::timestamp as start_time,
        (arj.scheduled_date::timestamp + interval '2 hours') as end_time,
        CONCAT_WS(', ', p.address_street, p.address_suburb, p.address_state, p.address_postcode) as location_address,
        NULL as job_id,
        NULL as client_id,
        arj.assigned_to_user_id,
        u1.full_name as assigned_to_name,
        NULL as created_by_name,
        NULL as company_name, p.owner_name as first_name, NULL as last_name, false as is_company, p.owner_phone as client_phone, p.owner_phone as client_mobile,
        CONCAT('AR-', LPAD(arj.id::text, 5, '0')) as job_number, 'Asset Register' as job_title
      FROM asset_register_jobs arj
      INNER JOIN organizations o ON arj.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      LEFT JOIN properties p ON arj.property_id = p.id
      LEFT JOIN users u1 ON arj.assigned_to_user_id = u1.id
      WHERE om.user_id = $1
      AND om.status = 'active'
      AND arj.scheduled_date IS NOT NULL
      AND arj.status NOT IN ('COMPLETED', 'CANCELLED')
      ${dateCondition.replace(/start_time/g, 'arj.scheduled_date::timestamp')}
      ${assignedCondition}

      ORDER BY start_time ASC
    `

    const appointments = await sql(query, params)

    // Check if user wants to include TradieConnect jobs (default: true)
    const includeTc = searchParams.get('include_tc') !== 'false'

    let tcAppointments: TCAppointment[] = []

    if (includeTc && startDate) {
      // Fetch TradieConnect jobs if user has a connection
      try {
        // Get user's tc_provider_id (stored during SSO authentication)
        const userDetails = await sql`
          SELECT tc_provider_id FROM users WHERE id = ${user.id} LIMIT 1
        `

        if (userDetails.length > 0) {
          const tcProviderId: number | null = userDetails[0].tc_provider_id

          // Get active TradieConnect connection
          const connections = await sql`
            SELECT id, tc_user_id, tc_token
            FROM tradieconnect_connections
            WHERE user_id = ${user.id}
            AND is_active = true
            LIMIT 1
          `

          if (connections.length > 0 && tcProviderId) {
            const connection = connections[0]

            // Calculate which dates to fetch for TC
            const tcDates: string[] = []
            const tcStartDate = new Date(startDate)
            const tcEndDate = endDate ? new Date(endDate) : new Date(startDate)
            tcEndDate.setDate(tcEndDate.getDate() + 1) // Include end date

            for (let d = new Date(tcStartDate); d < tcEndDate; d.setDate(d.getDate() + 1)) {
              tcDates.push(d.toISOString().split('T')[0])
            }

            // Fetch TC calendar for each date
            for (const tcDate of tcDates) {
              const result = await fetchProviderCalendar(
                connection.tc_user_id,
                connection.tc_token,
                tcDate,
                0, // all teams
                0
              )

              if (result.success && result.teams) {
                // Build map of providers per team for coworker lookup
                const teamProviders = new Map<number, TCProvider[]>()

                for (const team of result.teams) {
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

                // Find jobs assigned to this user
                for (const team of result.teams) {
                  for (const schedule of team.schedules) {
                    const isUserInTeam = schedule.providers.some(p => p.providerId === tcProviderId)

                    if (isUserInTeam) {
                      for (const job of schedule.jobs) {
                        // Calculate end time from start + duration
                        const jobStart = new Date(job.start)
                        const jobEnd = new Date(jobStart.getTime() + job.duration * 60000) // duration is in minutes

                        // Get coworkers (other providers in same team)
                        const coworkers = (teamProviders.get(team.teamId) || [])
                          .filter(p => p.providerId !== tcProviderId)

                        tcAppointments.push({
                          id: `tc-${job.jobId}`,
                          organization_id: null,
                          title: job.title || job.jobType,
                          description: job.description || '',
                          appointment_type: 'tradieconnect',
                          start_time: job.start,
                          end_time: jobEnd.toISOString(),
                          location_address: job.address,
                          job_id: null,
                          client_id: null,
                          assigned_to_user_id: null,
                          assigned_to_name: null,
                          created_by_name: null,
                          company_name: null,
                          first_name: job.firstName,
                          last_name: job.lastName,
                          is_company: false,
                          client_phone: job.mobile,
                          client_mobile: job.mobile,
                          job_number: `TC-${job.jobId}`,
                          job_title: job.title || job.jobType,
                          tc_job_id: job.jobId,
                          tc_team_id: team.teamId,
                          tc_team_name: team.name,
                          tc_status: job.statusName,
                          tc_lat: job.lat,
                          tc_long: job.long,
                          coworkers,
                        })
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (tcError) {
        // Log but don't fail - TC jobs are supplementary
        console.error('Error fetching TradieConnect jobs for calendar:', tcError)
      }
    }

    // Merge and sort all appointments by start_time
    const allAppointments = [...appointments, ...tcAppointments].sort((a, b) => {
      const aTime = new Date(a.start_time).getTime()
      const bTime = new Date(b.start_time).getTime()
      return aTime - bTime
    })

    return NextResponse.json({
      appointments: allAppointments,
      tc_jobs_count: tcAppointments.length,
    })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new appointment
export async function POST(req: Request) {
  try {
    // Try to get auth from Clerk (web) first
    let userId: string | null = null

    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!userId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          userId = payload.clerkUserId
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const body = await req.json()

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Validate required fields
    if (!body.organization_id || !body.title || !body.appointment_type || !body.start_time || !body.end_time || !body.assigned_to_user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

    // Create appointment
    const appointments = await sql`
      INSERT INTO appointments (
        organization_id, title, description, appointment_type,
        start_time, end_time, all_day,
        job_id, client_id, assigned_to_user_id, created_by_user_id,
        location_address, reminder_minutes_before
      )
      VALUES (
        ${body.organization_id},
        ${body.title},
        ${body.description || null},
        ${body.appointment_type},
        ${body.start_time},
        ${body.end_time},
        ${body.all_day || false},
        ${body.job_id || null},
        ${body.client_id || null},
        ${body.assigned_to_user_id},
        ${user.id},
        ${body.location_address || null},
        ${body.reminder_minutes_before || null}
      )
      RETURNING *
    `

    return NextResponse.json({ success: true, appointment: appointments[0] })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
