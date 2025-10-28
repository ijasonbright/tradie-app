import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// GET /api/subcontractors/[id]/summary - Get subcontractor payment summary
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id: subcontractorId } = params

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

    // Verify subcontractor exists and belongs to organization
    const subcontractorMembers = await sql`
      SELECT
        om.*,
        u.full_name,
        u.email,
        u.phone
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      WHERE om.id = ${subcontractorId}
      AND om.organization_id = ${organization_id}
      AND om.role = 'subcontractor'
      LIMIT 1
    `

    if (subcontractorMembers.length === 0) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    const subcontractor = subcontractorMembers[0]

    // Check permissions - owner/admin can view all, subcontractor can view own
    const canView = role === 'owner' || role === 'admin' || user.id === subcontractor.user_id
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get approved, unpaid time logs
    const unpaidTimeLogs = await sql`
      SELECT
        tl.*,
        j.job_number,
        j.title as job_title,
        j.job_type,
        c.company_name,
        CONCAT(c.first_name, ' ', c.last_name) as client_name
      FROM job_time_logs tl
      INNER JOIN jobs j ON tl.job_id = j.id
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE tl.user_id = ${subcontractor.user_id}
      AND j.organization_id = ${organization_id}
      AND tl.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM subcontractor_payment_items spi
        WHERE spi.source_id = tl.id::text AND spi.item_type = 'time_log'
      )
      ORDER BY tl.start_time DESC
    `

    // Get approved, unpaid materials (allocated to subcontractor)
    const unpaidMaterials = await sql`
      SELECT
        jm.*,
        j.job_number,
        j.title as job_title,
        c.company_name,
        CONCAT(c.first_name, ' ', c.last_name) as client_name
      FROM job_materials jm
      INNER JOIN jobs j ON jm.job_id = j.id
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE jm.allocated_to_user_id = ${subcontractor.user_id}
      AND j.organization_id = ${organization_id}
      AND jm.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM subcontractor_payment_items spi
        WHERE spi.source_id = jm.id::text AND spi.item_type = 'material'
      )
      ORDER BY jm.created_at DESC
    `

    // Calculate totals
    const laborAmount = unpaidTimeLogs.reduce((sum, log) => {
      return sum + parseFloat(log.labor_cost || '0')
    }, 0)

    const materialsAmount = unpaidMaterials.reduce((sum, material) => {
      return sum + parseFloat(material.total_cost || '0')
    }, 0)

    const totalOwed = laborAmount + materialsAmount

    // Get pending approval items
    const pendingTimeLogs = await sql`
      SELECT
        tl.*,
        j.job_number,
        j.title as job_title
      FROM job_time_logs tl
      INNER JOIN jobs j ON tl.job_id = j.id
      WHERE tl.user_id = ${subcontractor.user_id}
      AND j.organization_id = ${organization_id}
      AND tl.status = 'pending'
      ORDER BY tl.start_time DESC
    `

    const pendingMaterials = await sql`
      SELECT
        jm.*,
        j.job_number,
        j.title as job_title
      FROM job_materials jm
      INNER JOIN jobs j ON jm.job_id = j.id
      WHERE jm.allocated_to_user_id = ${subcontractor.user_id}
      AND j.organization_id = ${organization_id}
      AND jm.status = 'pending'
      ORDER BY jm.created_at DESC
    `

    const pendingLaborAmount = pendingTimeLogs.reduce((sum, log) => {
      return sum + parseFloat(log.labor_cost || '0')
    }, 0)

    const pendingMaterialsAmount = pendingMaterials.reduce((sum, material) => {
      return sum + parseFloat(material.total_cost || '0')
    }, 0)

    const totalPending = pendingLaborAmount + pendingMaterialsAmount

    // Get recent payments
    const recentPayments = await sql`
      SELECT
        sp.*,
        u.full_name as processed_by_name
      FROM subcontractor_payments sp
      LEFT JOIN users u ON sp.created_by_user_id = u.id
      WHERE sp.subcontractor_user_id = ${subcontractor.user_id}
      AND sp.organization_id = ${organization_id}
      ORDER BY sp.created_at DESC
      LIMIT 10
    `

    // Get payment history totals
    const paymentHistorySummary = await sql`
      SELECT
        COUNT(sp.id)::INTEGER as total_payments,
        SUM(sp.total_amount)::DECIMAL(10,2) as total_paid_all_time,
        SUM(CASE WHEN sp.created_at >= NOW() - INTERVAL '30 days' THEN sp.total_amount ELSE 0 END)::DECIMAL(10,2) as paid_last_30_days,
        SUM(CASE WHEN sp.created_at >= NOW() - INTERVAL '90 days' THEN sp.total_amount ELSE 0 END)::DECIMAL(10,2) as paid_last_90_days
      FROM subcontractor_payments sp
      WHERE sp.subcontractor_user_id = ${subcontractor.user_id}
      AND sp.organization_id = ${organization_id}
      AND sp.status = 'paid'
    `

    return NextResponse.json({
      success: true,
      subcontractor: {
        id: subcontractor.id,
        full_name: subcontractor.full_name,
        email: subcontractor.email,
        phone: subcontractor.phone,
        hourly_rate: subcontractor.hourly_rate,
        owed_amount: subcontractor.owed_amount,
      },
      summary: {
        total_owed: totalOwed.toFixed(2),
        labor_amount: laborAmount.toFixed(2),
        materials_amount: materialsAmount.toFixed(2),
        total_pending_approval: totalPending.toFixed(2),
        pending_labor_amount: pendingLaborAmount.toFixed(2),
        pending_materials_amount: pendingMaterialsAmount.toFixed(2),
        unpaid_time_log_count: unpaidTimeLogs.length,
        unpaid_materials_count: unpaidMaterials.length,
        pending_time_log_count: pendingTimeLogs.length,
        pending_materials_count: pendingMaterials.length,
      },
      unpaidItems: {
        timeLogs: unpaidTimeLogs,
        materials: unpaidMaterials,
      },
      pendingItems: {
        timeLogs: pendingTimeLogs,
        materials: pendingMaterials,
      },
      recentPayments,
      paymentHistory: paymentHistorySummary[0] || {
        total_payments: 0,
        total_paid_all_time: '0.00',
        paid_last_30_days: '0.00',
        paid_last_90_days: '0.00',
      },
    })
  } catch (error) {
    console.error('Error fetching subcontractor summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subcontractor summary' },
      { status: 500 }
    )
  }
}
