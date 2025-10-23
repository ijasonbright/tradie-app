import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch organization settings
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
      SELECT o.*
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

    return NextResponse.json({ organization: orgs[0] })
  } catch (error) {
    console.error('Error fetching organization settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update organization settings
export async function PUT(req: Request) {
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
      SELECT o.id, om.role
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

    // Update organization
    const updated = await sql`
      UPDATE organizations
      SET
        name = COALESCE(${body.name}, name),
        abn = COALESCE(${body.abn}, abn),
        trade_type = COALESCE(${body.tradeType}, trade_type),
        phone = COALESCE(${body.phone}, phone),
        email = COALESCE(${body.email}, email),
        address_line1 = COALESCE(${body.addressLine1}, address_line1),
        address_line2 = COALESCE(${body.addressLine2}, address_line2),
        city = COALESCE(${body.city}, city),
        state = COALESCE(${body.state}, state),
        postcode = COALESCE(${body.postcode}, postcode),
        bank_name = COALESCE(${body.bankName}, bank_name),
        bank_bsb = COALESCE(${body.bankBsb}, bank_bsb),
        bank_account_number = COALESCE(${body.bankAccountNumber}, bank_account_number),
        bank_account_name = COALESCE(${body.bankAccountName}, bank_account_name),
        default_hourly_rate = COALESCE(${body.defaultHourlyRate}, default_hourly_rate),
        default_employee_cost = COALESCE(${body.defaultEmployeeCost}, default_employee_cost),
        updated_at = NOW()
      WHERE id = ${org.id}
      RETURNING *
    `

    return NextResponse.json({ organization: updated[0] })
  } catch (error) {
    console.error('Error updating organization settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
