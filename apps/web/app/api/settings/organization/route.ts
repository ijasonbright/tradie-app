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

    // Build dynamic update query based on provided fields
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(body.name || null)
    }
    if (body.abn !== undefined) {
      updates.push(`abn = $${paramIndex++}`)
      values.push(body.abn || null)
    }
    if (body.tradeType !== undefined) {
      updates.push(`trade_type = $${paramIndex++}`)
      values.push(body.tradeType || null)
    }
    if (body.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`)
      values.push(body.phone || null)
    }
    if (body.email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      values.push(body.email || null)
    }
    if (body.addressLine1 !== undefined) {
      updates.push(`address_line1 = $${paramIndex++}`)
      values.push(body.addressLine1 || null)
    }
    if (body.addressLine2 !== undefined) {
      updates.push(`address_line2 = $${paramIndex++}`)
      values.push(body.addressLine2 || null)
    }
    if (body.city !== undefined) {
      updates.push(`city = $${paramIndex++}`)
      values.push(body.city || null)
    }
    if (body.state !== undefined) {
      updates.push(`state = $${paramIndex++}`)
      values.push(body.state || null)
    }
    if (body.postcode !== undefined) {
      updates.push(`postcode = $${paramIndex++}`)
      values.push(body.postcode || null)
    }
    if (body.bankName !== undefined) {
      updates.push(`bank_name = $${paramIndex++}`)
      values.push(body.bankName || null)
    }
    if (body.bankBsb !== undefined) {
      updates.push(`bank_bsb = $${paramIndex++}`)
      values.push(body.bankBsb || null)
    }
    if (body.bankAccountNumber !== undefined) {
      updates.push(`bank_account_number = $${paramIndex++}`)
      values.push(body.bankAccountNumber || null)
    }
    if (body.bankAccountName !== undefined) {
      updates.push(`bank_account_name = $${paramIndex++}`)
      values.push(body.bankAccountName || null)
    }
    if (body.defaultHourlyRate !== undefined) {
      updates.push(`default_hourly_rate = $${paramIndex++}`)
      values.push(body.defaultHourlyRate && body.defaultHourlyRate !== '' ? parseFloat(body.defaultHourlyRate) : null)
    }
    if (body.defaultEmployeeCost !== undefined) {
      updates.push(`default_employee_cost = $${paramIndex++}`)
      values.push(body.defaultEmployeeCost && body.defaultEmployeeCost !== '' ? parseFloat(body.defaultEmployeeCost) : null)
    }
    if (body.smsPhoneNumber !== undefined) {
      updates.push(`sms_phone_number = $${paramIndex++}`)
      values.push(body.smsPhoneNumber || null)
    }
    if (body.logoUrl !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`)
      values.push(body.logoUrl || null)
    }
    if (body.primaryColor !== undefined) {
      updates.push(`primary_color = $${paramIndex++}`)
      values.push(body.primaryColor || null)
    }

    // Always update timestamp
    updates.push(`updated_at = NOW()`)

    if (updates.length === 1) {
      // Only timestamp update, no actual changes
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Add org ID as last parameter
    values.push(org.id)

    // Update organization
    const query = `
      UPDATE organizations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const updated = await sql(query, values)

    return NextResponse.json({ organization: updated[0] })
  } catch (error) {
    console.error('Error updating organization settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
