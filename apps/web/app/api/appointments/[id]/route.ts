import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Get single appointment
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const appointments = await sql`
      SELECT a.*,
        u1.full_name as assigned_to_name,
        u2.full_name as created_by_name,
        c.company_name, c.first_name, c.last_name, c.is_company,
        j.job_number, j.title as job_title
      FROM appointments a
      INNER JOIN organization_members om ON a.organization_id = om.organization_id
      LEFT JOIN users u1 ON a.assigned_to_user_id = u1.id
      LEFT JOIN users u2 ON a.created_by_user_id = u2.id
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN jobs j ON a.job_id = j.id
      WHERE a.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (appointments.length === 0) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ appointment: appointments[0] })
  } catch (error) {
    console.error('Error fetching appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update appointment
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const body = await req.json()

    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Verify access
    const check = await sql`
      SELECT a.* FROM appointments a
      INNER JOIN organization_members om ON a.organization_id = om.organization_id
      WHERE a.id = ${id} AND om.user_id = ${user.id} AND om.status = 'active'
      LIMIT 1
    `

    if (check.length === 0) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const current = check[0]

    // Update appointment
    const updated = await sql`
      UPDATE appointments
      SET
        title = ${body.title !== undefined ? body.title : current.title},
        description = ${body.description !== undefined ? body.description : current.description},
        appointment_type = ${body.appointmentType !== undefined ? body.appointmentType : current.appointment_type},
        start_time = ${body.startTime !== undefined ? body.startTime : current.start_time},
        end_time = ${body.endTime !== undefined ? body.endTime : current.end_time},
        all_day = ${body.allDay !== undefined ? body.allDay : current.all_day},
        job_id = ${body.jobId !== undefined ? body.jobId : current.job_id},
        client_id = ${body.clientId !== undefined ? body.clientId : current.client_id},
        assigned_to_user_id = ${body.assignedToUserId !== undefined ? body.assignedToUserId : current.assigned_to_user_id},
        location_address = ${body.locationAddress !== undefined ? body.locationAddress : current.location_address},
        reminder_minutes_before = ${body.reminderMinutesBefore !== undefined ? body.reminderMinutesBefore : current.reminder_minutes_before},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({ success: true, appointment: updated[0] })
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete appointment
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Verify access
    const check = await sql`
      SELECT a.* FROM appointments a
      INNER JOIN organization_members om ON a.organization_id = om.organization_id
      WHERE a.id = ${id} AND om.user_id = ${user.id} AND om.status = 'active'
      LIMIT 1
    `

    if (check.length === 0) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    await sql`DELETE FROM appointments WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
