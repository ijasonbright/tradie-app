import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

// GET /api/trade-types - List all trade types for organization
export async function GET() {
  try {
    const { userId, orgId } = await auth()
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tradeTypes = await sql`
      SELECT
        id,
        name,
        client_hourly_rate,
        default_employee_hourly_rate,
        client_callout_fee,
        is_active,
        created_at
      FROM trade_types
      WHERE organization_id = ${orgId}
      ORDER BY name ASC
    `

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
    const { userId, orgId } = await auth()
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Verify this trade type belongs to the user's organization
    const existing = await sql`
      SELECT id FROM trade_types
      WHERE id = ${id} AND organization_id = ${orgId}
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
