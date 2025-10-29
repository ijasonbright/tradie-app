import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

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
        c.company_name, c.first_name, c.last_name, c.is_company,
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
        c.company_name, c.first_name, c.last_name, c.is_company,
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

      ORDER BY start_time ASC
    `

    const appointments = await sql(query, params)

    return NextResponse.json({ appointments })
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
    if (!body.organizationId || !body.title || !body.appointmentType || !body.startTime || !body.endTime || !body.assignedToUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to this organization
    const membership = await sql`
      SELECT * FROM organization_members
      WHERE organization_id = ${body.organizationId}
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
        ${body.organizationId},
        ${body.title},
        ${body.description || null},
        ${body.appointmentType},
        ${body.startTime},
        ${body.endTime},
        ${body.allDay || false},
        ${body.jobId || null},
        ${body.clientId || null},
        ${body.assignedToUserId},
        ${user.id},
        ${body.locationAddress || null},
        ${body.reminderMinutesBefore || null}
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
