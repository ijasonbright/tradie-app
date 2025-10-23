import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - List all members across user's organizations
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

    // Get all members from organizations the user belongs to
    const members = await sql`
      SELECT DISTINCT
        u.id as user_id,
        u.full_name,
        u.email,
        om.role,
        om.organization_id,
        o.name as organization_name
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      INNER JOIN organizations o ON om.organization_id = o.id
      WHERE om.organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = ${user.id}
        AND status = 'active'
      )
      AND om.status = 'active'
      ORDER BY u.full_name ASC
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
