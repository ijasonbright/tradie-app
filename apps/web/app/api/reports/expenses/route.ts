import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET /api/reports/expenses - Expense report with date range filtering
export async function GET(req: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'category' // category, user, job, month, week

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get user's organization
    const members = await sql`
      SELECT organization_id, role
      FROM organization_members
      WHERE user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const { organization_id, role } = members[0]

    // Check permissions - owner/admin can view all, employees see own
    const canViewAll = role === 'owner' || role === 'admin'

    // Build date filter
    const dateConditions = []
    if (startDate) {
      dateConditions.push(`e.expense_date >= '${startDate}'::date`)
    }
    if (endDate) {
      dateConditions.push(`e.expense_date <= '${endDate}'::date`)
    }
    const dateFilter = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : ''

    // Build user filter for employees
    const userFilter = !canViewAll ? `AND e.user_id = '${user.id}'` : ''

    // Expenses by category
    const expensesByCategory = await sql(`
      SELECT
        e.category,
        COUNT(e.id)::INTEGER as expense_count,
        SUM(e.amount)::DECIMAL(10,2) as total_amount,
        SUM(e.gst_amount)::DECIMAL(10,2) as total_gst,
        SUM(e.total_amount)::DECIMAL(10,2) as total_with_gst,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::INTEGER as approved_count,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END)::INTEGER as pending_count,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END)::INTEGER as rejected_count,
        SUM(CASE WHEN e.status = 'approved' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as approved_amount,
        SUM(CASE WHEN e.status = 'pending' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as pending_amount
      FROM expenses e
      WHERE e.organization_id = '${organization_id}'
      ${dateFilter}
      ${userFilter}
      GROUP BY e.category
      ORDER BY total_with_gst DESC
    `)

    // Expenses by user
    const expensesByUser = await sql(`
      SELECT
        u.id as user_id,
        u.full_name,
        om.role,
        COUNT(e.id)::INTEGER as expense_count,
        SUM(e.total_amount)::DECIMAL(10,2) as total_amount,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::INTEGER as approved_count,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END)::INTEGER as pending_count,
        SUM(CASE WHEN e.status = 'approved' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as approved_amount,
        SUM(CASE WHEN e.status = 'approved' AND e.reimbursed_at IS NULL THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as pending_reimbursement,
        SUM(CASE WHEN e.status = 'approved' AND e.reimbursed_at IS NOT NULL THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as reimbursed_amount
      FROM expenses e
      INNER JOIN users u ON e.user_id = u.id
      INNER JOIN organization_members om ON u.id = om.user_id AND om.organization_id = e.organization_id
      WHERE e.organization_id = '${organization_id}'
      ${dateFilter}
      ${userFilter}
      GROUP BY u.id, u.full_name, om.role
      ORDER BY total_amount DESC
    `)

    // Expenses by job
    const expensesByJob = await sql(`
      SELECT
        j.id as job_id,
        j.job_number,
        j.title as job_title,
        j.status as job_status,
        c.company_name,
        CONCAT(c.first_name, ' ', c.last_name) as client_name,
        COUNT(e.id)::INTEGER as expense_count,
        SUM(e.total_amount)::DECIMAL(10,2) as total_amount,
        SUM(CASE WHEN e.status = 'approved' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as approved_amount,
        SUM(CASE WHEN e.status = 'pending' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as pending_amount
      FROM expenses e
      INNER JOIN jobs j ON e.job_id = j.id
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE e.organization_id = '${organization_id}'
      AND e.job_id IS NOT NULL
      ${dateFilter}
      ${userFilter}
      GROUP BY j.id, j.job_number, j.title, j.status, c.company_name, c.first_name, c.last_name
      ORDER BY total_amount DESC
      LIMIT 50
    `)

    // Expenses by time period
    let expensesByPeriod: any[] = []
    if (groupBy === 'month') {
      expensesByPeriod = await sql(`
        SELECT
          DATE_TRUNC('month', e.expense_date) as period,
          TO_CHAR(DATE_TRUNC('month', e.expense_date), 'YYYY-MM') as period_label,
          COUNT(e.id)::INTEGER as expense_count,
          SUM(e.total_amount)::DECIMAL(10,2) as total_amount,
          SUM(CASE WHEN e.status = 'approved' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as approved_amount,
          SUM(CASE WHEN e.status = 'pending' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as pending_amount
        FROM expenses e
        WHERE e.organization_id = '${organization_id}'
        ${dateFilter}
        ${userFilter}
        GROUP BY period
        ORDER BY period DESC
      `)
    } else if (groupBy === 'week') {
      expensesByPeriod = await sql(`
        SELECT
          DATE_TRUNC('week', e.expense_date) as period,
          TO_CHAR(DATE_TRUNC('week', e.expense_date), 'YYYY-MM-DD') as period_label,
          COUNT(e.id)::INTEGER as expense_count,
          SUM(e.total_amount)::DECIMAL(10,2) as total_amount,
          SUM(CASE WHEN e.status = 'approved' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as approved_amount,
          SUM(CASE WHEN e.status = 'pending' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as pending_amount
        FROM expenses e
        WHERE e.organization_id = '${organization_id}'
        ${dateFilter}
        ${userFilter}
        GROUP BY period
        ORDER BY period DESC
      `)
    }

    // Summary statistics
    const summary = await sql(`
      SELECT
        COUNT(e.id)::INTEGER as total_expenses,
        SUM(e.amount)::DECIMAL(10,2) as total_amount_ex_gst,
        SUM(e.gst_amount)::DECIMAL(10,2) as total_gst,
        SUM(e.total_amount)::DECIMAL(10,2) as total_amount_inc_gst,
        AVG(e.total_amount)::DECIMAL(10,2) as avg_expense_amount,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END)::INTEGER as approved_count,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END)::INTEGER as pending_count,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END)::INTEGER as rejected_count,
        SUM(CASE WHEN e.status = 'approved' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as approved_amount,
        SUM(CASE WHEN e.status = 'pending' THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as pending_amount,
        SUM(CASE WHEN e.status = 'approved' AND e.reimbursed_at IS NULL THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as pending_reimbursement,
        SUM(CASE WHEN e.status = 'approved' AND e.reimbursed_at IS NOT NULL THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as reimbursed_amount,
        COUNT(DISTINCT e.user_id)::INTEGER as unique_submitters,
        COUNT(DISTINCT e.job_id)::INTEGER as unique_jobs_with_expenses
      FROM expenses e
      WHERE e.organization_id = '${organization_id}'
      ${dateFilter}
      ${userFilter}
    `)

    // Reimbursement summary (by user)
    const reimbursementSummary = await sql(`
      SELECT
        u.id as user_id,
        u.full_name,
        SUM(CASE WHEN e.status = 'approved' AND e.reimbursed_at IS NULL THEN e.total_amount ELSE 0 END)::DECIMAL(10,2) as amount_owed,
        COUNT(CASE WHEN e.status = 'approved' AND e.reimbursed_at IS NULL THEN 1 END)::INTEGER as expenses_pending_reimbursement
      FROM expenses e
      INNER JOIN users u ON e.user_id = u.id
      WHERE e.organization_id = '${organization_id}'
      ${dateFilter}
      ${userFilter}
      GROUP BY u.id, u.full_name
      HAVING SUM(CASE WHEN e.status = 'approved' AND e.reimbursed_at IS NULL THEN e.total_amount ELSE 0 END) > 0
      ORDER BY amount_owed DESC
    `)

    return NextResponse.json({
      success: true,
      summary: summary[0],
      expensesByCategory,
      expensesByUser,
      expensesByJob,
      expensesByPeriod,
      reimbursementSummary,
    })
  } catch (error) {
    console.error('Error fetching expense report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense report' },
      { status: 500 }
    )
  }
}
