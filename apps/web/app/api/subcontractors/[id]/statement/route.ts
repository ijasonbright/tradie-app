import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// GET /api/subcontractors/[id]/statement - Generate subcontractor statement (CSV format)
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

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = searchParams.get('format') || 'json' // json or csv

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

    // Verify subcontractor exists
    const subcontractorMembers = await sql`
      SELECT
        om.*,
        u.full_name,
        u.email,
        u.phone,
        o.name as organization_name,
        o.abn as organization_abn,
        o.address_line1,
        o.city,
        o.state,
        o.postcode
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      INNER JOIN organizations o ON om.organization_id = o.id
      WHERE om.id = ${subcontractorId}
      AND om.organization_id = ${organization_id}
      AND om.role = 'subcontractor'
      LIMIT 1
    `

    if (subcontractorMembers.length === 0) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    const subcontractor = subcontractorMembers[0]

    // Check permissions
    const canView = role === 'owner' || role === 'admin' || user.id === subcontractor.user_id
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build date filter
    let dateFilter = sql``
    if (startDate && endDate) {
      dateFilter = sql`AND sp.created_at >= ${startDate}::timestamp AND sp.created_at <= ${endDate}::timestamp`
    } else if (startDate) {
      dateFilter = sql`AND sp.created_at >= ${startDate}::timestamp`
    } else if (endDate) {
      dateFilter = sql`AND sp.created_at <= ${endDate}::timestamp`
    }

    // Get all payments in date range
    const payments = await sql`
      SELECT
        sp.*,
        u.full_name as processed_by_name
      FROM subcontractor_payments sp
      LEFT JOIN users u ON sp.created_by_user_id = u.id
      WHERE sp.subcontractor_user_id = ${subcontractor.user_id}
      AND sp.organization_id = ${organization_id}
      ${dateFilter}
      ORDER BY sp.created_at ASC
    `

    // Get payment items for each payment
    const paymentsWithItems = await Promise.all(
      payments.map(async (payment) => {
        const items = await sql`
          SELECT * FROM subcontractor_payment_items
          WHERE payment_id = ${payment.id}
          ORDER BY created_at ASC
        `
        return {
          ...payment,
          items,
        }
      })
    )

    // Calculate summary
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.total_amount || '0'), 0)
    const totalLabor = payments.reduce((sum, p) => sum + parseFloat(p.labor_amount || '0'), 0)
    const totalMaterials = payments.reduce((sum, p) => sum + parseFloat(p.materials_amount || '0'), 0)
    const totalEquipment = payments.reduce((sum, p) => sum + parseFloat(p.equipment_amount || '0'), 0)

    const statement = {
      subcontractor: {
        full_name: subcontractor.full_name,
        email: subcontractor.email,
        phone: subcontractor.phone,
        hourly_rate: subcontractor.hourly_rate,
      },
      organization: {
        name: subcontractor.organization_name,
        abn: subcontractor.organization_abn,
        address: `${subcontractor.address_line1}, ${subcontractor.city}, ${subcontractor.state} ${subcontractor.postcode}`,
      },
      period: {
        start_date: startDate || 'All time',
        end_date: endDate || 'Present',
      },
      summary: {
        total_payments: payments.length,
        total_paid: totalPaid.toFixed(2),
        total_labor: totalLabor.toFixed(2),
        total_materials: totalMaterials.toFixed(2),
        total_equipment: totalEquipment.toFixed(2),
        current_owed: subcontractor.owed_amount,
      },
      payments: paymentsWithItems,
      generated_at: new Date().toISOString(),
    }

    // Return as JSON
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        statement,
      })
    }

    // Return as CSV
    if (format === 'csv') {
      // Create CSV header
      let csv = 'Payment Date,Reference Number,Payment Method,Labor Amount,Materials Amount,Equipment Amount,Total Amount,Status,Notes\n'

      // Add payment rows
      for (const payment of paymentsWithItems) {
        const row = [
          payment.paid_date || payment.created_at,
          payment.reference_number || '',
          payment.payment_method || '',
          payment.labor_amount || '0.00',
          payment.materials_amount || '0.00',
          payment.equipment_amount || '0.00',
          payment.total_amount || '0.00',
          payment.status || '',
          (payment.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
        ].join(',')
        csv += row + '\n'
      }

      // Add summary rows
      csv += '\n'
      csv += `Total Payments,${payments.length}\n`
      csv += `Total Labor,${totalLabor.toFixed(2)}\n`
      csv += `Total Materials,${totalMaterials.toFixed(2)}\n`
      csv += `Total Equipment,${totalEquipment.toFixed(2)}\n`
      csv += `Total Paid,${totalPaid.toFixed(2)}\n`
      csv += `Current Amount Owed,${subcontractor.owed_amount}\n`

      const filename = `subcontractor-statement-${subcontractor.full_name.replace(/\s/g, '-')}-${startDate || 'all'}-to-${endDate || 'present'}.csv`

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    console.error('Error generating statement:', error)
    return NextResponse.json(
      { error: 'Failed to generate statement' },
      { status: 500 }
    )
  }
}
