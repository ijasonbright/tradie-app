import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database using raw SQL
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]
    const body = await req.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    // Create organization using raw SQL
    const orgs = await sql`
      INSERT INTO organizations (
        name, abn, trade_type, phone, email,
        address_line1, address_line2, city, state, postcode,
        owner_id, sms_credits, created_at, updated_at
      ) VALUES (
        ${body.name},
        ${body.abn || null},
        ${body.tradeType || null},
        ${body.phone || null},
        ${body.email || null},
        ${body.addressLine1 || null},
        ${body.addressLine2 || null},
        ${body.city || null},
        ${body.state || null},
        ${body.postcode || null},
        ${user.id},
        0,
        NOW(),
        NOW()
      )
      RETURNING *
    `

    const organization = orgs[0]

    // Add user as owner member
    await sql`
      INSERT INTO organization_members (
        organization_id, user_id, role, status,
        can_create_jobs, can_edit_all_jobs, can_create_invoices,
        can_view_financials, can_approve_expenses, can_approve_timesheets,
        joined_at, created_at, updated_at
      ) VALUES (
        ${organization.id},
        ${user.id},
        'owner',
        'active',
        true, true, true, true, true, true,
        NOW(), NOW(), NOW()
      )
    `

    return NextResponse.json({
      success: true,
      organization,
    })
  } catch (error) {
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get user's organizations with their role
    const orgs = await sql`
      SELECT
        o.*,
        om.role,
        om.status
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
    `

    return NextResponse.json({
      organizations: orgs,
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
