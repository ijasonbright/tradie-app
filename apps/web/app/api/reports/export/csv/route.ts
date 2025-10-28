import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'


// Helper function to convert array of objects to CSV
function convertToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) return ''

  const headerRow = headers.join(',')
  const rows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      // Handle null/undefined
      if (value === null || value === undefined) return ''
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  })

  return [headerRow, ...rows].join('\n')
}

// POST /api/reports/export/csv - Export report data to CSV
export async function POST(req: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reportType, startDate, endDate, groupBy } = body

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

    // Build date filter
    let dateFilter = sql``
    let dateFilterForTimeLog = sql``
    let dateFilterForExpense = sql``

    if (startDate && endDate) {
      dateFilter = sql`AND i.issue_date >= ${startDate} AND i.issue_date <= ${endDate}`
      dateFilterForTimeLog = sql`AND tl.start_time >= ${startDate}::timestamp AND tl.start_time <= ${endDate}::timestamp`
      dateFilterForExpense = sql`AND e.expense_date >= ${startDate}::date AND e.expense_date <= ${endDate}::date`
    } else if (startDate) {
      dateFilter = sql`AND i.issue_date >= ${startDate}`
      dateFilterForTimeLog = sql`AND tl.start_time >= ${startDate}::timestamp`
      dateFilterForExpense = sql`AND e.expense_date >= ${startDate}::date`
    } else if (endDate) {
      dateFilter = sql`AND i.issue_date <= ${endDate}`
      dateFilterForTimeLog = sql`AND tl.start_time <= ${endDate}::timestamp`
      dateFilterForExpense = sql`AND e.expense_date <= ${endDate}::date`
    }

    let csvData = ''
    let filename = ''

    switch (reportType) {
      case 'revenue': {
        // Check permissions
        const canViewFinancials = role === 'owner' || role === 'admin'
        if (!canViewFinancials) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const revenueData = await sql`
          SELECT
            i.invoice_number,
            i.issue_date,
            i.due_date,
            i.status,
            CASE
              WHEN c.is_company THEN c.company_name
              ELSE CONCAT(c.first_name, ' ', c.last_name)
            END as client_name,
            j.job_number,
            j.job_type,
            i.subtotal,
            i.gst_amount,
            i.total_amount,
            i.paid_amount,
            (i.total_amount - COALESCE(i.paid_amount, 0)) as outstanding_amount
          FROM invoices i
          LEFT JOIN clients c ON i.client_id = c.id
          LEFT JOIN jobs j ON i.job_id = j.id
          WHERE i.organization_id = ${organization_id}
          AND i.status != 'cancelled'
          ${dateFilter}
          ORDER BY i.issue_date DESC
        `

        const headers = [
          'invoice_number', 'issue_date', 'due_date', 'status', 'client_name',
          'job_number', 'job_type', 'subtotal', 'gst_amount', 'total_amount',
          'paid_amount', 'outstanding_amount'
        ]

        csvData = convertToCSV(revenueData, headers)
        filename = `revenue-report-${startDate || 'all'}-to-${endDate || 'all'}.csv`
        break
      }

      case 'time-tracking': {
        const canViewAll = role === 'owner' || role === 'admin'
        let userFilter = sql``
        if (!canViewAll) {
          userFilter = sql`AND tl.user_id = ${user.id}`
        }

        const timeTrackingData = await sql`
          SELECT
            tl.created_at::date as log_date,
            u.full_name as team_member,
            j.job_number,
            j.title as job_title,
            c.company_name,
            CONCAT(c.first_name, ' ', c.last_name) as client_name,
            tl.start_time,
            tl.end_time,
            tl.total_hours,
            tl.hourly_rate as cost_rate,
            tl.labor_cost,
            tl.billing_amount,
            tl.status,
            tl.notes
          FROM job_time_logs tl
          INNER JOIN users u ON tl.user_id = u.id
          INNER JOIN jobs j ON tl.job_id = j.id
          LEFT JOIN clients c ON j.client_id = c.id
          WHERE j.organization_id = ${organization_id}
          ${dateFilterForTimeLog}
          ${userFilter}
          ORDER BY tl.start_time DESC
        `

        const headers = [
          'log_date', 'team_member', 'job_number', 'job_title', 'company_name',
          'client_name', 'start_time', 'end_time', 'total_hours', 'cost_rate',
          'labor_cost', 'billing_amount', 'status', 'notes'
        ]

        csvData = convertToCSV(timeTrackingData, headers)
        filename = `time-tracking-report-${startDate || 'all'}-to-${endDate || 'all'}.csv`
        break
      }

      case 'expenses': {
        const canViewAll = role === 'owner' || role === 'admin'
        let userFilter = sql``
        if (!canViewAll) {
          userFilter = sql`AND e.user_id = ${user.id}`
        }

        const expenseData = await sql`
          SELECT
            e.expense_date,
            u.full_name as submitted_by,
            e.category,
            e.description,
            j.job_number,
            j.title as job_title,
            e.amount,
            e.gst_amount,
            e.total_amount,
            e.status,
            CASE WHEN e.reimbursed_at IS NOT NULL THEN 'Yes' ELSE 'No' END as reimbursed,
            e.reimbursed_at as reimbursement_date
          FROM expenses e
          INNER JOIN users u ON e.user_id = u.id
          LEFT JOIN jobs j ON e.job_id = j.id
          WHERE e.organization_id = ${organization_id}
          ${dateFilterForExpense}
          ${userFilter}
          ORDER BY e.expense_date DESC
        `

        const headers = [
          'expense_date', 'submitted_by', 'category', 'description', 'job_number',
          'job_title', 'amount', 'gst_amount', 'total_amount', 'status',
          'reimbursed', 'reimbursement_date'
        ]

        csvData = convertToCSV(expenseData, headers)
        filename = `expense-report-${startDate || 'all'}-to-${endDate || 'all'}.csv`
        break
      }

      case 'team-performance': {
        // Check permissions
        const canViewTeamPerformance = role === 'owner' || role === 'admin'
        if (!canViewTeamPerformance) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        const teamPerformanceData = await sql`
          SELECT
            u.full_name,
            om.role,
            COUNT(DISTINCT CASE WHEN j.status = 'completed' THEN j.id END) as jobs_completed,
            COUNT(DISTINCT CASE WHEN j.status = 'in_progress' THEN j.id END) as jobs_in_progress,
            COALESCE(SUM(tl.total_hours), 0) as total_hours,
            COALESCE(SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END), 0) as approved_hours,
            COALESCE(SUM(tl.labor_cost), 0) as total_labor_cost,
            COALESCE(SUM(tl.billing_amount), 0) as total_billing_amount,
            AVG(
              CASE
                WHEN j.status = 'completed' AND j.completed_at IS NOT NULL AND j.scheduled_date IS NOT NULL
                THEN EXTRACT(EPOCH FROM (j.completed_at - j.scheduled_date::timestamp)) / 86400
                ELSE NULL
              END
            ) as avg_completion_days
          FROM users u
          INNER JOIN organization_members om ON u.id = om.user_id
          LEFT JOIN job_assignments ja ON u.id = ja.user_id AND ja.removed_at IS NULL
          LEFT JOIN jobs j ON ja.job_id = j.id
          LEFT JOIN job_time_logs tl ON j.id = tl.job_id AND tl.user_id = u.id ${dateFilterForTimeLog}
          WHERE om.organization_id = ${organization_id}
          AND om.status = 'active'
          GROUP BY u.id, u.full_name, om.role
          ORDER BY jobs_completed DESC
        `

        const headers = [
          'full_name', 'role', 'jobs_completed', 'jobs_in_progress', 'total_hours',
          'approved_hours', 'total_labor_cost', 'total_billing_amount', 'avg_completion_days'
        ]

        csvData = convertToCSV(teamPerformanceData, headers)
        filename = `team-performance-report-${startDate || 'all'}-to-${endDate || 'all'}.csv`
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    // Return CSV as downloadable file
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting CSV:', error)
    return NextResponse.json(
      { error: 'Failed to export CSV' },
      { status: 500 }
    )
  }
}
