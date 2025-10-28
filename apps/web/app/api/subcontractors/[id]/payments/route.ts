import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// GET /api/subcontractors/[id]/payments - Get payment history for subcontractor
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

    // Verify subcontractor exists
    const subcontractorMembers = await sql`
      SELECT om.*, u.full_name
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

    // Check permissions
    const canView = role === 'owner' || role === 'admin' || user.id === subcontractor.user_id
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get all payments with details
    const payments = await sql`
      SELECT
        sp.*,
        u.full_name as processed_by_name
      FROM subcontractor_payments sp
      LEFT JOIN users u ON sp.created_by_user_id = u.id
      WHERE sp.subcontractor_user_id = ${subcontractor.user_id}
      AND sp.organization_id = ${organization_id}
      ORDER BY sp.created_at DESC
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

    return NextResponse.json({
      success: true,
      payments: paymentsWithItems,
    })
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    )
  }
}

// POST /api/subcontractors/[id]/payments - Create a new payment
export async function POST(
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
    const body = await req.json()

    const {
      payment_date,
      payment_method,
      reference_number,
      notes,
      time_log_ids = [],
      material_ids = [],
      sync_to_xero = false,
    } = body

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

    // Check permissions - only owner/admin can create payments
    const canCreate = role === 'owner' || role === 'admin'
    if (!canCreate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify subcontractor exists
    const subcontractorMembers = await sql`
      SELECT om.*, u.full_name
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

    // Get time logs
    let laborAmount = 0
    const timeLogs = []
    if (time_log_ids.length > 0) {
      const logs = await sql`
        SELECT tl.*, j.job_number, j.title as job_title
        FROM job_time_logs tl
        INNER JOIN jobs j ON tl.job_id = j.id
        WHERE tl.id = ANY(${time_log_ids})
        AND tl.user_id = ${subcontractor.user_id}
        AND j.organization_id = ${organization_id}
        AND tl.status = 'approved'
      `

      for (const log of logs) {
        laborAmount += parseFloat(log.labor_cost || '0')
        timeLogs.push(log)
      }
    }

    // Get materials
    let materialsAmount = 0
    const materials = []
    if (material_ids.length > 0) {
      const mats = await sql`
        SELECT jm.*, j.job_number, j.title as job_title
        FROM job_materials jm
        INNER JOIN jobs j ON jm.job_id = j.id
        WHERE jm.id = ANY(${material_ids})
        AND jm.allocated_to_user_id = ${subcontractor.user_id}
        AND j.organization_id = ${organization_id}
        AND jm.status = 'approved'
      `

      for (const mat of mats) {
        materialsAmount += parseFloat(mat.total_cost || '0')
        materials.push(mat)
      }
    }

    const totalAmount = laborAmount + materialsAmount

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment must include at least one approved item' },
        { status: 400 }
      )
    }

    // Create payment record
    const newPayments = await sql`
      INSERT INTO subcontractor_payments (
        organization_id,
        subcontractor_user_id,
        payment_period_start,
        payment_period_end,
        labor_amount,
        materials_amount,
        equipment_amount,
        total_amount,
        paid_amount,
        status,
        paid_date,
        payment_method,
        reference_number,
        notes,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (
        ${organization_id},
        ${subcontractor.user_id},
        ${payment_date},
        ${payment_date},
        ${laborAmount},
        ${materialsAmount},
        0,
        ${totalAmount},
        ${totalAmount},
        'paid',
        ${payment_date},
        ${payment_method},
        ${reference_number || null},
        ${notes || null},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    const payment = newPayments[0]

    // Create payment items for time logs
    for (const log of timeLogs) {
      await sql`
        INSERT INTO subcontractor_payment_items (
          payment_id,
          item_type,
          source_id,
          description,
          amount
        ) VALUES (
          ${payment.id},
          'time_log',
          ${log.id},
          ${`${log.job_number} - ${log.job_title} (${log.total_hours} hours @ $${log.hourly_rate}/hr)`},
          ${log.labor_cost}
        )
      `
    }

    // Create payment items for materials
    for (const mat of materials) {
      await sql`
        INSERT INTO subcontractor_payment_items (
          payment_id,
          item_type,
          source_id,
          description,
          amount
        ) VALUES (
          ${payment.id},
          'material',
          ${mat.id},
          ${`${mat.job_number} - ${mat.description} (qty: ${mat.quantity})`},
          ${mat.total_cost}
        )
      `
    }

    // Update subcontractor's owed_amount
    const currentOwed = parseFloat(subcontractor.owed_amount || '0')
    const newOwedAmount = currentOwed - totalAmount

    await sql`
      UPDATE organization_members
      SET owed_amount = ${newOwedAmount}
      WHERE id = ${subcontractorId}
    `

    // If sync to Xero is requested, we'll handle that in a separate endpoint
    // (Xero sync will be implemented in the next file)

    // Fetch complete payment with items
    const items = await sql`
      SELECT * FROM subcontractor_payment_items
      WHERE payment_id = ${payment.id}
    `

    return NextResponse.json({
      success: true,
      payment: {
        ...payment,
        items,
      },
      message: 'Payment recorded successfully',
    })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}
