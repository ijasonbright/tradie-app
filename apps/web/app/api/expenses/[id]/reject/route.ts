import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Reject expense
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const body = await req.json()

    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Check permissions
    const check = await sql`
      SELECT e.*, om.role, om.can_approve_expenses
      FROM expenses e
      INNER JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (check.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const expense = check[0]

    // Only owner/admin or users with can_approve_expenses permission can reject
    if (expense.role !== 'owner' && expense.role !== 'admin' && !expense.can_approve_expenses) {
      return NextResponse.json({ error: 'Insufficient permissions to reject expenses' }, { status: 403 })
    }

    // Reject expense
    const rejected = await sql`
      UPDATE expenses
      SET
        status = 'rejected',
        rejection_reason = ${body.reason || 'No reason provided'},
        approved_by_user_id = ${user.id},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({ success: true, expense: rejected[0] })
  } catch (error) {
    console.error('Error rejecting expense:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
