import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all members across user's organizations
export async function GET(req: Request) {
  try {
    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

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

    // Get all members from organizations the user belongs to
    const members = await sql`
      SELECT
        om.id,
        u.id as user_id,
        u.full_name,
        u.email,
        u.phone,
        om.role,
        om.status,
        om.employment_type,
        om.hourly_rate,
        om.billing_rate,
        om.invitation_sent_at,
        om.invitation_accepted_at,
        om.joined_at,
        om.can_create_jobs,
        om.can_edit_all_jobs,
        om.can_create_invoices,
        om.can_view_financials,
        om.can_approve_expenses,
        om.can_approve_timesheets,
        om.organization_id,
        o.name as organization_name,
        tt.name as primary_trade_name
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      INNER JOIN organizations o ON om.organization_id = o.id
      LEFT JOIN trade_types tt ON om.primary_trade_id = tt.id
      WHERE om.organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = ${user.id}
        AND status = 'active'
      )
      ORDER BY
        CASE om.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'employee' THEN 3
          WHEN 'subcontractor' THEN 4
          ELSE 5
        END,
        om.status DESC,
        u.full_name ASC
    `

    return NextResponse.json({
      members,
    })
  } catch (error) {
    console.error('Error fetching organization members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
