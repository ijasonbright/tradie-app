import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - List all expenses
export async function GET(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const myExpenses = searchParams.get('myExpenses') === 'true'

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Build query
    let query = `
      SELECT e.*,
        u1.full_name as user_name,
        u2.full_name as approved_by_name,
        j.job_number, j.title as job_title,
        o.name as organization_name
      FROM expenses e
      INNER JOIN organizations o ON e.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      LEFT JOIN users u1 ON e.user_id = u1.id
      LEFT JOIN users u2 ON e.approved_by_user_id = u2.id
      LEFT JOIN jobs j ON e.job_id = j.id
      WHERE om.user_id = $1
      AND om.status = 'active'
    `

    const params: any[] = [user.id]
    let paramIndex = 2

    if (myExpenses) {
      query += ` AND e.user_id = $${paramIndex}`
      params.push(user.id)
      paramIndex++
    }

    if (status) {
      query += ` AND e.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    query += ' ORDER BY e.expense_date DESC, e.created_at DESC'

    const expenses = await sql(query, params)

    return NextResponse.json({ expenses })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new expense
export async function POST(req: Request) {
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

    // Validate required fields
    if (!body.organizationId || !body.category || !body.description || !body.amount || !body.expenseDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to this organization
    const membership = await sql`
      SELECT * FROM organization_members
      WHERE organization_id = ${body.organizationId}
      AND user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Access denied to this organization' }, { status: 403 })
    }

    // Calculate total amount (amount + GST)
    const amount = parseFloat(body.amount)
    const gstAmount = body.gstAmount ? parseFloat(body.gstAmount) : 0
    const totalAmount = amount + gstAmount

    // Create expense
    const expenses = await sql`
      INSERT INTO expenses (
        organization_id, user_id, job_id,
        category, description,
        amount, gst_amount, total_amount,
        receipt_url, expense_date
      )
      VALUES (
        ${body.organizationId},
        ${user.id},
        ${body.jobId || null},
        ${body.category},
        ${body.description},
        ${amount},
        ${gstAmount},
        ${totalAmount},
        ${body.receiptUrl || null},
        ${body.expenseDate}
      )
      RETURNING *
    `

    return NextResponse.json({ success: true, expense: expenses[0] })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
