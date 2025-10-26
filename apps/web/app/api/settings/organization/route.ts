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

    // Convert numeric strings to numbers or null
    const defaultHourlyRate = body.defaultHourlyRate && body.defaultHourlyRate !== '' ? parseFloat(body.defaultHourlyRate) : null
    const defaultEmployeeCost = body.defaultEmployeeCost && body.defaultEmployeeCost !== '' ? parseFloat(body.defaultEmployeeCost) : null

    // Update organization
    const updated = await sql`
      UPDATE organizations
      SET
        name = ${body.name || null},
        abn = ${body.abn || null},
        trade_type = ${body.tradeType || null},
        phone = ${body.phone || null},
        email = ${body.email || null},
        address_line1 = ${body.addressLine1 || null},
        address_line2 = ${body.addressLine2 || null},
        city = ${body.city || null},
        state = ${body.state || null},
        postcode = ${body.postcode || null},
        bank_name = ${body.bankName || null},
        bank_bsb = ${body.bankBsb || null},
        bank_account_number = ${body.bankAccountNumber || null},
        bank_account_name = ${body.bankAccountName || null},
        default_hourly_rate = ${defaultHourlyRate},
        default_employee_cost = ${defaultEmployeeCost},
        sms_phone_number = ${body.smsPhoneNumber || null},
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
