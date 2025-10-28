import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

// GET /api/reports/time-tracking - Time tracking report with date range filtering
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
    const groupBy = searchParams.get('groupBy') || 'user' // user, job, day, week, month

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

    // Check permissions - owner/admin can view all, employees see own data
    const canViewAll = role === 'owner' || role === 'admin'

    // Build date filter
    const dateConditions = []
    if (startDate) {
      dateConditions.push(`tl.start_time >= '${startDate}'::timestamp`)
    }
    if (endDate) {
      dateConditions.push(`tl.start_time <= '${endDate}'::timestamp`)
    }
    const dateFilter = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : ''

    // Build user filter for employees
    const userFilter = !canViewAll ? `AND tl.user_id = '${user.id}'` : ''

    // Hours by team member
    const hoursByUser = await sql(`
      SELECT
        u.id as user_id,
        u.full_name,
        om.role,
        COUNT(tl.id)::INTEGER as log_count,
        SUM(tl.total_hours)::DECIMAL(10,2) as total_hours,
        SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as approved_hours,
        SUM(CASE WHEN tl.status = 'pending' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as pending_hours,
        SUM(COALESCE(tl.labor_cost, 0))::DECIMAL(10,2) as total_labor_cost,
        SUM(COALESCE(tl.billing_amount, 0))::DECIMAL(10,2) as total_billing_amount,
        AVG(tl.hourly_rate)::DECIMAL(10,2) as avg_cost_rate
      FROM job_time_logs tl
      INNER JOIN users u ON tl.user_id = u.id
      INNER JOIN organization_members om ON u.id = om.user_id
      INNER JOIN jobs j ON tl.job_id = j.id
      WHERE j.organization_id = '${organization_id}'
      AND om.organization_id = '${organization_id}'
      ${dateFilter}
      ${userFilter}
      GROUP BY u.id, u.full_name, om.role
      ORDER BY total_hours DESC
    `)

    // Hours by job
    const hoursByJob = await sql(`
      SELECT
        j.id as job_id,
        j.job_number,
        j.title as job_title,
        j.status as job_status,
        j.job_type,
        c.company_name,
        CONCAT(c.first_name, ' ', c.last_name) as client_name,
        COUNT(tl.id)::INTEGER as log_count,
        SUM(tl.total_hours)::DECIMAL(10,2) as total_hours,
        SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as approved_hours,
        SUM(COALESCE(tl.labor_cost, 0))::DECIMAL(10,2) as total_labor_cost,
        SUM(COALESCE(tl.billing_amount, 0))::DECIMAL(10,2) as total_billing_amount,
        j.quoted_amount,
        CASE
          WHEN j.quoted_amount IS NOT NULL AND j.quoted_amount > 0
          THEN ((SUM(COALESCE(tl.billing_amount, 0)) / j.quoted_amount) * 100)::DECIMAL(10,2)
          ELSE NULL
        END as hours_vs_quote_percentage
      FROM job_time_logs tl
      INNER JOIN jobs j ON tl.job_id = j.id
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.organization_id = '${organization_id}'
      ${dateFilter}
      ${userFilter}
      GROUP BY j.id, j.job_number, j.title, j.status, j.job_type, j.quoted_amount, c.company_name, c.first_name, c.last_name
      ORDER BY total_hours DESC
      LIMIT 50
    `)

    // Hours by time period
    let hoursByPeriod: any[] = []
    if (groupBy === 'day') {
      hoursByPeriod = await sql(`
        SELECT
          DATE_TRUNC('day', tl.start_time) as period,
          TO_CHAR(DATE_TRUNC('day', tl.start_time), 'YYYY-MM-DD') as period_label,
          COUNT(tl.id)::INTEGER as log_count,
          SUM(tl.total_hours)::DECIMAL(10,2) as total_hours,
          SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as approved_hours,
          SUM(COALESCE(tl.labor_cost, 0))::DECIMAL(10,2) as total_labor_cost,
          SUM(COALESCE(tl.billing_amount, 0))::DECIMAL(10,2) as total_billing_amount
        FROM job_time_logs tl
        INNER JOIN jobs j ON tl.job_id = j.id
        WHERE j.organization_id = '${organization_id}'
        ${dateFilter}
        ${userFilter}
        GROUP BY period
        ORDER BY period DESC
      `)
    } else if (groupBy === 'week') {
      hoursByPeriod = await sql(`
        SELECT
          DATE_TRUNC('week', tl.start_time) as period,
          TO_CHAR(DATE_TRUNC('week', tl.start_time), 'YYYY-MM-DD') as period_label,
          COUNT(tl.id)::INTEGER as log_count,
          SUM(tl.total_hours)::DECIMAL(10,2) as total_hours,
          SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as approved_hours,
          SUM(COALESCE(tl.labor_cost, 0))::DECIMAL(10,2) as total_labor_cost,
          SUM(COALESCE(tl.billing_amount, 0))::DECIMAL(10,2) as total_billing_amount
        FROM job_time_logs tl
        INNER JOIN jobs j ON tl.job_id = j.id
        WHERE j.organization_id = '${organization_id}'
        ${dateFilter}
        ${userFilter}
        GROUP BY period
        ORDER BY period DESC
      `)
    } else if (groupBy === 'month') {
      hoursByPeriod = await sql(`
        SELECT
          DATE_TRUNC('month', tl.start_time) as period,
          TO_CHAR(DATE_TRUNC('month', tl.start_time), 'YYYY-MM') as period_label,
          COUNT(tl.id)::INTEGER as log_count,
          SUM(tl.total_hours)::DECIMAL(10,2) as total_hours,
          SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as approved_hours,
          SUM(COALESCE(tl.labor_cost, 0))::DECIMAL(10,2) as total_labor_cost,
          SUM(COALESCE(tl.billing_amount, 0))::DECIMAL(10,2) as total_billing_amount
        FROM job_time_logs tl
        INNER JOIN jobs j ON tl.job_id = j.id
        WHERE j.organization_id = '${organization_id}'
        ${dateFilter}
        ${userFilter}
        GROUP BY period
        ORDER BY period DESC
      `)
    }

    // Summary statistics
    const summary = await sql(`
      SELECT
        COUNT(tl.id)::INTEGER as total_logs,
        SUM(tl.total_hours)::DECIMAL(10,2) as total_hours,
        SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as approved_hours,
        SUM(CASE WHEN tl.status = 'pending' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as pending_hours,
        SUM(CASE WHEN tl.status = 'rejected' THEN tl.total_hours ELSE 0 END)::DECIMAL(10,2) as rejected_hours,
        SUM(COALESCE(tl.labor_cost, 0))::DECIMAL(10,2) as total_labor_cost,
        SUM(COALESCE(tl.billing_amount, 0))::DECIMAL(10,2) as total_billing_amount,
        AVG(tl.total_hours)::DECIMAL(10,2) as avg_hours_per_log,
        AVG(tl.hourly_rate)::DECIMAL(10,2) as avg_cost_rate,
        COUNT(DISTINCT tl.user_id)::INTEGER as unique_team_members,
        COUNT(DISTINCT tl.job_id)::INTEGER as unique_jobs
      FROM job_time_logs tl
      INNER JOIN jobs j ON tl.job_id = j.id
      WHERE j.organization_id = '${organization_id}'
      ${dateFilter}
      ${userFilter}
    `)

    // Calculate utilization and profit margin
    const summaryData = summary[0]
    const utilizationRate = summaryData.approved_hours && summaryData.total_hours
      ? ((parseFloat(summaryData.approved_hours) / parseFloat(summaryData.total_hours)) * 100).toFixed(2)
      : '0.00'

    const profitMargin = summaryData.total_billing_amount && summaryData.total_labor_cost
      ? (((parseFloat(summaryData.total_billing_amount) - parseFloat(summaryData.total_labor_cost)) / parseFloat(summaryData.total_billing_amount)) * 100).toFixed(2)
      : '0.00'

    return NextResponse.json({
      success: true,
      summary: {
        ...summaryData,
        utilization_rate: utilizationRate,
        profit_margin: profitMargin,
      },
      hoursByUser,
      hoursByJob,
      hoursByPeriod,
    })
  } catch (error) {
    console.error('Error fetching time tracking report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch time tracking report' },
      { status: 500 }
    )
  }
}
