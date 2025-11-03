import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get single member details
export async function GET(
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

    // Get member details - verify requesting user is in same org
    const members = await sql`
      SELECT
        om.id,
        om.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.profile_photo_url,
        om.role,
        om.status,
        om.employment_type,
        om.hourly_rate,
        om.billing_rate,
        om.owed_amount,
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
        tt.name as primary_trade_name,
        requester.role as requester_role
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      INNER JOIN organizations o ON om.organization_id = o.id
      LEFT JOIN trade_types tt ON om.primary_trade_id = tt.id
      INNER JOIN organization_members requester ON requester.organization_id = om.organization_id
      WHERE om.id = ${id}
      AND requester.user_id = ${user.id}
      AND requester.status = 'active'
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'Member not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({ member: members[0] })
  } catch (error) {
    console.error('Error fetching member:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update team member
export async function PUT(
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

    // Only owners and admins can update members
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ error: 'No permission to update team members' }, { status: 403 })
    }

    // Prevent changing owner role (only one owner allowed)
    if (member.role === 'owner' && body.role && body.role !== 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 403 })
    }

    // Build update fields dynamically
    const updateFields: string[] = []
    const updateValues: any[] = []

    if (body.role !== undefined) {
      updateFields.push('role')
      updateValues.push(body.role)
    }
    if (body.employmentType !== undefined) {
      updateFields.push('employment_type')
      updateValues.push(body.employmentType)
    }
    if (body.hourlyRate !== undefined) {
      updateFields.push('hourly_rate')
      updateValues.push(body.hourlyRate)
    }
    if (body.billingRate !== undefined) {
      updateFields.push('billing_rate')
      updateValues.push(body.billingRate)
    }
    if (body.canCreateJobs !== undefined) {
      updateFields.push('can_create_jobs')
      updateValues.push(body.canCreateJobs)
    }
    if (body.canEditAllJobs !== undefined) {
      updateFields.push('can_edit_all_jobs')
      updateValues.push(body.canEditAllJobs)
    }
    if (body.canCreateInvoices !== undefined) {
      updateFields.push('can_create_invoices')
      updateValues.push(body.canCreateInvoices)
    }
    if (body.canViewFinancials !== undefined) {
      updateFields.push('can_view_financials')
      updateValues.push(body.canViewFinancials)
    }
    if (body.canApproveExpenses !== undefined) {
      updateFields.push('can_approve_expenses')
      updateValues.push(body.canApproveExpenses)
    }
    if (body.canApproveTimesheets !== undefined) {
      updateFields.push('can_approve_timesheets')
      updateValues.push(body.canApproveTimesheets)
    }
    if (body.primaryTradeId !== undefined) {
      updateFields.push('primary_trade_id')
      updateValues.push(body.primaryTradeId)
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Build the SQL update query
    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ')
    updateValues.push(id)

    const updateQuery = `
      UPDATE organization_members
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${updateValues.length}
      RETURNING *
    `

    const updatedMembers = await sql(updateQuery, updateValues)

    return NextResponse.json({ member: updatedMembers[0] })
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove team member (soft delete - change status to removed)
export async function DELETE(
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

    // Only owners and admins can remove members
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ error: 'No permission to remove team members' }, { status: 403 })
    }

    // Cannot remove the owner
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove organization owner' }, { status: 403 })
    }

    // Soft delete - update status to 'removed'
    await sql`
      UPDATE organization_members
      SET status = 'removed', updated_at = NOW()
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true, message: 'Team member removed' })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
