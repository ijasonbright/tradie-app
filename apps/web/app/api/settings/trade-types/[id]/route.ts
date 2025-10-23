import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// PUT - Update trade type
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: tradeTypeId } = await params
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

    // Verify trade type belongs to organization
    const existingTrade = await sql`
      SELECT id FROM trade_types
      WHERE id = ${tradeTypeId} AND organization_id = ${org.id}
    `

    if (existingTrade.length === 0) {
      return NextResponse.json({ error: 'Trade type not found' }, { status: 404 })
    }

    // Update trade type
    const updated = await sql`
      UPDATE trade_types
      SET
        name = COALESCE(${body.name}, name),
        client_hourly_rate = COALESCE(${body.clientHourlyRate}, client_hourly_rate),
        client_daily_rate = ${body.clientDailyRate !== undefined ? body.clientDailyRate : null},
        default_employee_cost = COALESCE(${body.defaultEmployeeCost}, default_employee_cost),
        is_active = COALESCE(${body.isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${tradeTypeId}
      RETURNING *
    `

    return NextResponse.json({ tradeType: updated[0] })
  } catch (error) {
    console.error('Error updating trade type:', error)

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

// DELETE - Delete trade type (soft delete by setting is_active = false)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: tradeTypeId } = await params
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
      return NextResponse.json({ error: 'No organization found or insufficient permissions' }, { status: 403 })
    }

    const org = orgs[0]

    // Verify trade type belongs to organization
    const existingTrade = await sql`
      SELECT id FROM trade_types
      WHERE id = ${tradeTypeId} AND organization_id = ${org.id}
    `

    if (existingTrade.length === 0) {
      return NextResponse.json({ error: 'Trade type not found' }, { status: 404 })
    }

    // Check if trade type is in use (has team members or jobs)
    const membersCount = await sql`
      SELECT COUNT(*) as count FROM organization_members
      WHERE primary_trade_id = ${tradeTypeId}
    `

    const jobsCount = await sql`
      SELECT COUNT(*) as count FROM jobs
      WHERE trade_type_id = ${tradeTypeId}
    `

    if (parseInt(membersCount[0].count) > 0 || parseInt(jobsCount[0].count) > 0) {
      // Soft delete - deactivate instead of delete
      await sql`
        UPDATE trade_types
        SET is_active = false, updated_at = NOW()
        WHERE id = ${tradeTypeId}
      `
      return NextResponse.json({
        success: true,
        message: 'Trade type deactivated (in use by team members or jobs)'
      })
    } else {
      // Hard delete if not in use
      await sql`DELETE FROM trade_types WHERE id = ${tradeTypeId}`
      return NextResponse.json({ success: true, message: 'Trade type deleted' })
    }
  } catch (error) {
    console.error('Error deleting trade type:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
