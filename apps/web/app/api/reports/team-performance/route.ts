import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// GET /api/reports/team-performance - Team performance metrics
export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `)

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get user's organization
    const members = await sql`
      SELECT organization_id, role
      FROM organization_members
      WHERE user_id = '${user.id}'
      AND status = 'active'
      LIMIT 1
    `)

    if (members.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const { organization_id, role } = members[0]

    // Check permissions - only owner/admin can view team performance
    const canViewTeamPerformance = role === 'owner' || role === 'admin'
    if (!canViewTeamPerformance) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build date filter for jobs
    const jobDateConditions = []
    if (startDate) {
      jobDateConditions.push(`j.completed_at >= '${startDate}'::timestamp`)
    }
    if (endDate) {
      jobDateConditions.push(`j.completed_at <= '${endDate}'::timestamp`)
    }
    const jobDateFilter = jobDateConditions.length > 0 ? `AND ${jobDateConditions.join(' AND ')}` : ''

    // Build date filter for time logs
    const timeLogDateConditions = []
    if (startDate) {
      timeLogDateConditions.push(`tl.start_time >= '${startDate}'::timestamp`)
    }
    if (endDate) {
      timeLogDateConditions.push(`tl.start_time <= '${endDate}'::timestamp`)
    }
    const timeLogDateFilter = timeLogDateConditions.length > 0 ? `AND ${timeLogDateConditions.join(' AND ')}` : ''

    // Team member performance summary
    const teamPerformance = await sql`
      SELECT
        u.id as user_id,
        u.full_name,
        u.email,
        om.role,
        om.hourly_rate as cost_rate,
        -- Job metrics
        COUNT(DISTINCT CASE WHEN j.status = 'completed' THEN j.id END)::INTEGER as jobs_completed,
        COUNT(DISTINCT CASE WHEN j.status = 'in_progress' THEN j.id END)::INTEGER as jobs_in_progress,
        COUNT(DISTINCT j.id)::INTEGER as total_jobs_assigned,
        -- Time metrics
        COALESCE(SUM(tl.total_hours), 0)::DECIMAL(10,2) as total_hours,
        COALESCE(SUM(CASE WHEN tl.status = 'approved' THEN tl.total_hours ELSE 0 END), 0)::DECIMAL(10,2) as approved_hours,
        -- Financial metrics
        COALESCE(SUM(tl.labor_cost), 0)::DECIMAL(10,2) as total_labor_cost,
        COALESCE(SUM(tl.billing_amount), 0)::DECIMAL(10,2) as total_billing_amount,
        -- Average completion time (days)
        AVG(
          CASE
            WHEN j.status = 'completed' AND j.completed_at IS NOT NULL AND j.scheduled_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (j.completed_at - j.scheduled_date::timestamp)) / 86400
            ELSE NULL
          END
        )::DECIMAL(10,2) as avg_completion_days
      FROM users u
      INNER JOIN organization_members om ON u.id = om.user_id
      LEFT JOIN job_assignments ja ON u.id = ja.user_id AND ja.removed_at IS NULL
      LEFT JOIN jobs j ON ja.job_id = j.id ${jobDateFilter}
      LEFT JOIN job_time_logs tl ON j.id = tl.job_id AND tl.user_id = u.id ${timeLogDateFilter}
      WHERE om.organization_id = '${organization_id}'
      AND om.status = 'active'
      GROUP BY u.id, u.full_name, u.email, om.role, om.hourly_rate
      ORDER BY jobs_completed DESC, total_hours DESC
    `)

    // Add calculated metrics to each team member
    const teamPerformanceWithMetrics = teamPerformance.map((member: any) => {
      const profitMargin = member.total_billing_amount && member.total_labor_cost
        ? (((parseFloat(member.total_billing_amount) - parseFloat(member.total_labor_cost)) / parseFloat(member.total_billing_amount)) * 100).toFixed(2)
        : '0.00'

      const utilizationRate = member.approved_hours && member.total_hours
        ? ((parseFloat(member.approved_hours) / parseFloat(member.total_hours)) * 100).toFixed(2)
        : '0.00'

      const avgRevenuePerJob = member.jobs_completed > 0
        ? (parseFloat(member.total_billing_amount) / member.jobs_completed).toFixed(2)
        : '0.00'

      return {
        ...member,
        profit_margin: profitMargin,
        utilization_rate: utilizationRate,
        avg_revenue_per_job: avgRevenuePerJob,
      }
    })

    // Job completion by status (organization-wide)
    const jobsByStatus = await sql`
      SELECT
        j.status,
        COUNT(j.id)::INTEGER as count,
        SUM(j.quoted_amount)::DECIMAL(10,2) as total_quoted_amount
      FROM jobs j
      WHERE j.organization_id = '${organization_id}'
      ${jobDateFilter}
      GROUP BY j.status
      ORDER BY count DESC
    `)

    // Job completion by type
    const jobsByType = await sql`
      SELECT
        j.job_type,
        COUNT(j.id)::INTEGER as count,
        AVG(
          CASE
            WHEN j.status = 'completed' AND j.completed_at IS NOT NULL AND j.scheduled_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (j.completed_at - j.scheduled_date::timestamp)) / 86400
            ELSE NULL
          END
        )::DECIMAL(10,2) as avg_completion_days,
        SUM(j.quoted_amount)::DECIMAL(10,2) as total_quoted_amount
      FROM jobs j
      WHERE j.organization_id = '${organization_id}'
      ${jobDateFilter}
      GROUP BY j.job_type
      ORDER BY count DESC
    `)

    // Top performers by revenue
    const topPerformersByRevenue = teamPerformanceWithMetrics
      .sort((a: any, b: any) => parseFloat(b.total_billing_amount) - parseFloat(a.total_billing_amount))
      .slice(0, 5)

    // Top performers by jobs completed
    const topPerformersByJobs = teamPerformanceWithMetrics
      .sort((a: any, b: any) => b.jobs_completed - a.jobs_completed)
      .slice(0, 5)

    // Organization summary
    const orgSummary = {
      total_team_members: teamPerformance.length,
      total_jobs_completed: teamPerformance.reduce((sum, m) => sum + m.jobs_completed, 0),
      total_jobs_in_progress: teamPerformance.reduce((sum, m) => sum + m.jobs_in_progress, 0),
      total_hours_logged: teamPerformance.reduce((sum, m) => sum + parseFloat(m.total_hours || '0'), 0).toFixed(2),
      total_revenue_generated: teamPerformance.reduce((sum, m) => sum + parseFloat(m.total_billing_amount || '0'), 0).toFixed(2),
      total_labor_cost: teamPerformance.reduce((sum, m) => sum + parseFloat(m.total_labor_cost || '0'), 0).toFixed(2),
      avg_jobs_per_member: teamPerformance.length > 0
        ? (teamPerformance.reduce((sum, m) => sum + m.jobs_completed, 0) / teamPerformance.length).toFixed(2)
        : '0.00',
    }

    return NextResponse.json({
      success: true,
      summary: orgSummary,
      teamPerformance: teamPerformanceWithMetrics,
      topPerformersByRevenue,
      topPerformersByJobs,
      jobsByStatus,
      jobsByType,
    })
  } catch (error) {
    console.error('Error fetching team performance report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team performance report' },
      { status: 500 }
    )
  }
}
