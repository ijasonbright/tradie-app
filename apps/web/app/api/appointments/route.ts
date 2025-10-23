import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - List all appointments for user's organization(s)
export async function GET(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const assignedToUserId = searchParams.get('assignedToUserId')

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Build query with optional filters
    let query = `
      SELECT a.*,
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
    `

    const params: any[] = [user.id]
    let paramIndex = 2

    if (startDate) {
      query += ` AND a.start_time >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      query += ` AND a.end_time <= $${paramIndex}`
      params.push(endDate)
      paramIndex++
    }

    if (assignedToUserId) {
      query += ` AND a.assigned_to_user_id = $${paramIndex}`
      params.push(assignedToUserId)
      paramIndex++
    }

    query += ' ORDER BY a.start_time ASC'

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
    const { userId } = await auth()

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
