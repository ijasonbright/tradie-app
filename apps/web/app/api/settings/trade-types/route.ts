import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch all trade types for organization
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get organization where user is owner or admin
    const orgs = await sql`
      SELECT o.id
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      AND (om.role = 'owner' OR om.role = 'admin')
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'No organization found or insufficient permissions' }, { status: 404 })
    }

    const org = orgs[0]

    // Get all trade types for organization
    const tradeTypes = await sql`
      SELECT *
      FROM trade_types
      WHERE organization_id = ${org.id}
      ORDER BY is_active DESC, name ASC
    `

    return NextResponse.json({ tradeTypes })
  } catch (error) {
    console.error('Error fetching trade types:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new trade type
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

    // Get organization where user is owner or admin
    const orgs = await sql`
      SELECT o.id
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      AND (om.role = 'owner' OR om.role = 'admin')
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'No organization found or insufficient permissions' }, { status: 403 })
    }

    const org = orgs[0]

    // Validate required fields
    if (!body.jobTypeId || !body.name || body.clientHourlyRate === undefined) {
      return NextResponse.json({ error: 'Job type, name, and client hourly rate are required' }, { status: 400 })
    }

    // Check if this job type already exists for this organization
    const existing = await sql`
      SELECT id FROM trade_types
      WHERE organization_id = ${org.id} AND job_type_id = ${body.jobTypeId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: 'This trade type already exists for your organization' }, { status: 409 })
    }

    // Create trade type
    const tradeType = await sql`
      INSERT INTO trade_types (
        organization_id,
        job_type_id,
        name,
        client_hourly_rate,
        client_first_hour_rate,
        client_callout_fee,
        client_after_hours_callout_fee,
        client_after_hours_extra_percent,
        default_employee_hourly_rate,
        default_employee_daily_rate,
        is_active
      )
      VALUES (
        ${org.id},
        ${body.jobTypeId},
        ${body.name},
        ${body.clientHourlyRate},
        ${body.clientFirstHourRate || null},
        ${body.clientCalloutFee || 0},
        ${body.clientAfterHoursCalloutFee || 0},
        ${body.clientAfterHoursExtraPercent || 0},
        ${body.defaultEmployeeHourlyRate || 0},
        ${body.defaultEmployeeDailyRate || null},
        ${body.isActive !== undefined ? body.isActive : true}
      )
      RETURNING *
    `

    return NextResponse.json({ tradeType: tradeType[0] })
  } catch (error) {
    console.error('Error creating trade type:', error)

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json({ error: 'A trade with this name already exists' }, { status: 409 })
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
