import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// GET /api/reports/revenue - Revenue report with date range filtering
export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'month' // month, week, day, client, job_type

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

    // Check permissions - only owner/admin can view financial reports
    const canViewFinancials = role === 'owner' || role === 'admin'
    if (!canViewFinancials) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build date filter
    let dateFilter = sql``
    if (startDate && endDate) {
      dateFilter = sql`AND i.issue_date >= ${startDate} AND i.issue_date <= ${endDate}`
    } else if (startDate) {
      dateFilter = sql`AND i.issue_date >= ${startDate}`
    } else if (endDate) {
      dateFilter = sql`AND i.issue_date <= ${endDate}`
    }

    // Revenue by time period
    let revenueByPeriod: any[] = []
    if (groupBy === 'month') {
      revenueByPeriod = await sql`
        SELECT
          DATE_TRUNC('month', i.issue_date) as period,
          TO_CHAR(DATE_TRUNC('month', i.issue_date), 'YYYY-MM') as period_label,
          COUNT(*)::INTEGER as invoice_count,
          SUM(i.total_amount)::DECIMAL(10,2) as total_revenue,
          SUM(i.paid_amount)::DECIMAL(10,2) as paid_amount,
          SUM(i.total_amount - COALESCE(i.paid_amount, 0))::DECIMAL(10,2) as outstanding_amount
        FROM invoices i
        WHERE i.organization_id = ${organization_id}
        AND i.status != 'cancelled'
        ${dateFilter}
        GROUP BY period
        ORDER BY period DESC
      `
    } else if (groupBy === 'week') {
      revenueByPeriod = await sql`
        SELECT
          DATE_TRUNC('week', i.issue_date) as period,
          TO_CHAR(DATE_TRUNC('week', i.issue_date), 'YYYY-MM-DD') as period_label,
          COUNT(*)::INTEGER as invoice_count,
          SUM(i.total_amount)::DECIMAL(10,2) as total_revenue,
          SUM(i.paid_amount)::DECIMAL(10,2) as paid_amount,
          SUM(i.total_amount - COALESCE(i.paid_amount, 0))::DECIMAL(10,2) as outstanding_amount
        FROM invoices i
        WHERE i.organization_id = ${organization_id}
        AND i.status != 'cancelled'
        ${dateFilter}
        GROUP BY period
        ORDER BY period DESC
      `
    }

    // Revenue by client
    const revenueByClient = await sql`
      SELECT
        c.id as client_id,
        CASE
          WHEN c.is_company THEN c.company_name
          ELSE CONCAT(c.first_name, ' ', c.last_name)
        END as client_name,
        COUNT(*)::INTEGER as invoice_count,
        SUM(i.total_amount)::DECIMAL(10,2) as total_revenue,
        SUM(i.paid_amount)::DECIMAL(10,2) as paid_amount,
        SUM(i.total_amount - COALESCE(i.paid_amount, 0))::DECIMAL(10,2) as outstanding_amount
      FROM invoices i
      INNER JOIN clients c ON i.client_id = c.id
      WHERE i.organization_id = ${organization_id}
      AND i.status != 'cancelled'
      ${dateFilter}
      GROUP BY c.id, client_name
      ORDER BY total_revenue DESC
      LIMIT 20
    `

    // Revenue by job type
    const revenueByJobType = await sql`
      SELECT
        j.job_type,
        COUNT(DISTINCT i.id)::INTEGER as invoice_count,
        SUM(i.total_amount)::DECIMAL(10,2) as total_revenue,
        SUM(i.paid_amount)::DECIMAL(10,2) as paid_amount
      FROM invoices i
      LEFT JOIN jobs j ON i.job_id = j.id
      WHERE i.organization_id = ${organization_id}
      AND i.status != 'cancelled'
      ${dateFilter}
      GROUP BY j.job_type
      ORDER BY total_revenue DESC
    `

    // Summary statistics
    const summary = await sql`
      SELECT
        COUNT(*)::INTEGER as total_invoices,
        SUM(i.total_amount)::DECIMAL(10,2) as total_revenue,
        SUM(i.paid_amount)::DECIMAL(10,2) as total_paid,
        SUM(i.total_amount - COALESCE(i.paid_amount, 0))::DECIMAL(10,2) as total_outstanding,
        AVG(i.total_amount)::DECIMAL(10,2) as average_invoice_value,
        COUNT(CASE WHEN i.status = 'paid' THEN 1 END)::INTEGER as paid_invoices,
        COUNT(CASE WHEN i.status = 'overdue' THEN 1 END)::INTEGER as overdue_invoices
      FROM invoices i
      WHERE i.organization_id = ${organization_id}
      AND i.status != 'cancelled'
      ${dateFilter}
    `

    return NextResponse.json({
      success: true,
      summary: summary[0],
      revenueByPeriod,
      revenueByClient,
      revenueByJobType,
    })
  } catch (error) {
    console.error('Error fetching revenue report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revenue report' },
      { status: 500 }
    )
  }
}
