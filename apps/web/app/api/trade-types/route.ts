import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'


// GET /api/trade-types - List all trade types for organization
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get trade types for organizations the user is a member of
    const tradeTypes = await sql`
      SELECT DISTINCT
        tt.id,
        tt.name,
        tt.client_hourly_rate,
        tt.default_employee_hourly_rate,
        tt.client_callout_fee,
        tt.is_active,
        tt.created_at
      FROM trade_types tt
      INNER JOIN organizations o ON tt.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      AND tt.is_active = true
      ORDER BY tt.name ASC
    `

    console.log('Fetched trade types:', tradeTypes)
    return NextResponse.json({ tradeTypes })
  } catch (error) {
    console.error('Error fetching trade types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trade types' },
      { status: 500 }
    )
  }
}

// PUT /api/trade-types - Update a trade type's rates
export async function PUT(req: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    const {
      id,
      clientHourlyRate,
      defaultEmployeeHourlyRate,
      clientCalloutFee,
    } = await req.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Trade type ID is required' },
        { status: 400 }
      )
    }

    // Verify this trade type belongs to an organization the user is a member of
    const existing = await sql`
      SELECT tt.id
      FROM trade_types tt
      INNER JOIN organizations o ON tt.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE tt.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Trade type not found' },
        { status: 404 }
      )
    }

    const updated = await sql`
      UPDATE trade_types
      SET
        client_hourly_rate = ${clientHourlyRate || 0},
        default_employee_hourly_rate = ${defaultEmployeeHourlyRate || 0},
        client_callout_fee = ${clientCalloutFee || 0},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      tradeType: updated[0],
    })
  } catch (error) {
    console.error('Error updating trade type:', error)
    return NextResponse.json(
      { error: 'Failed to update trade type' },
      { status: 500 }
    )
  }
}
