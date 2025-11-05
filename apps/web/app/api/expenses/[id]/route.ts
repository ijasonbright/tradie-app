import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Get single expense
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const expenses = await sql`
      SELECT e.*,
        u1.full_name as user_name,
        u2.full_name as approved_by_name,
        j.job_number, j.title as job_title
      FROM expenses e
      INNER JOIN organization_members om ON e.organization_id = om.organization_id
      LEFT JOIN users u1 ON e.user_id = u1.id
      LEFT JOIN users u2 ON e.approved_by_user_id = u2.id
      LEFT JOIN jobs j ON e.job_id = j.id
      WHERE e.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (expenses.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense: expenses[0] })
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update expense
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify user owns the expense or has permission
    const check = await sql`
      SELECT e.*, om.role, om.can_approve_expenses
      FROM expenses e
      INNER JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = ${id} AND om.user_id = ${user.id} AND om.status = 'active'
      LIMIT 1
    `

    if (check.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const expense = check[0]

    // Only allow owner to edit their own expenses (unless admin/owner)
    if (expense.user_id !== user.id && expense.role !== 'owner' && expense.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Calculate total if amount or GST changed
    const amount = body.amount !== undefined ? parseFloat(body.amount) : parseFloat(expense.amount)
    const gstAmount = body.gst_amount !== undefined ? parseFloat(body.gst_amount) : parseFloat(expense.gst_amount)
    const totalAmount = amount + gstAmount

    // Update expense
    const updated = await sql`
      UPDATE expenses
      SET
        category = ${body.category !== undefined ? body.category : expense.category},
        description = ${body.description !== undefined ? body.description : expense.description},
        amount = ${amount},
        gst_amount = ${gstAmount},
        total_amount = ${totalAmount},
        receipt_url = ${body.receipt_url !== undefined ? body.receipt_url : expense.receipt_url},
        expense_date = ${body.expense_date !== undefined ? body.expense_date : expense.expense_date},
        job_id = ${body.job_id !== undefined ? body.job_id : expense.job_id},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({ success: true, expense: updated[0] })
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete expense
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Verify user owns the expense or is admin/owner
    const check = await sql`
      SELECT e.*, om.role
      FROM expenses e
      INNER JOIN organization_members om ON e.organization_id = om.organization_id
      WHERE e.id = ${id} AND om.user_id = ${user.id} AND om.status = 'active'
      LIMIT 1
    `

    if (check.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const expense = check[0]

    // Only allow owner to delete their own expenses (unless admin/owner)
    if (expense.user_id !== user.id && expense.role !== 'owner' && expense.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    await sql`DELETE FROM expenses WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
