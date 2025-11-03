import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Suspend or unsuspend a team member
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()
    const action = body.action // 'suspend' or 'unsuspend'

    if (!action || (action !== 'suspend' && action !== 'unsuspend')) {
      return NextResponse.json({ error: 'Invalid action. Must be "suspend" or "unsuspend"' }, { status: 400 })
    }

    // Get member and verify permissions
    const members = await sql`
      SELECT om.*, requester.role as requester_role
      FROM organization_members om
      INNER JOIN organization_members requester ON requester.organization_id = om.organization_id
      WHERE om.id = ${id}
      AND requester.user_id = ${user.id}
      AND requester.status = 'active'
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'Member not found or access denied' }, { status: 404 })
    }

    const member = members[0]
    const requesterRole = member.requester_role

    // Only owners and admins can suspend/unsuspend members
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ error: 'No permission to suspend/unsuspend team members' }, { status: 403 })
    }

    // Cannot suspend the owner
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot suspend organization owner' }, { status: 403 })
    }

    // Update status
    const newStatus = action === 'suspend' ? 'suspended' : 'active'

    const updatedMembers = await sql`
      UPDATE organization_members
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      message: action === 'suspend' ? 'Team member suspended' : 'Team member reactivated',
      member: updatedMembers[0]
    })
  } catch (error) {
    console.error('Error suspending/unsuspending member:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
