import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Record a payment for an invoice
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

    // Validate required fields
    if (!body.paymentDate || !body.amount || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentDate, amount, paymentMethod' },
        { status: 400 }
      )
    }

    // Check invoice exists and user has access
    const invoices = await sql`
      SELECT i.*, om.role FROM invoices i
      INNER JOIN organization_members om ON i.organization_id = om.organization_id
      WHERE i.id = ${invoiceId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Validate payment amount
    const paymentAmount = parseFloat(body.amount)
    const totalAmount = parseFloat(invoice.total_amount)
    const paidAmount = parseFloat(invoice.paid_amount || '0')
    const remainingBalance = totalAmount - paidAmount

    if (paymentAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })
    }

    if (paymentAmount > remainingBalance) {
      return NextResponse.json(
        { error: `Payment amount ($${paymentAmount.toFixed(2)}) exceeds remaining balance ($${remainingBalance.toFixed(2)})` },
        { status: 400 }
      )
    }

    // Record payment
    const payments = await sql`
      INSERT INTO invoice_payments (
        invoice_id, payment_date, amount, payment_method,
        reference_number, notes, recorded_by_user_id, created_at
      ) VALUES (
        ${invoiceId},
        ${body.paymentDate},
        ${paymentAmount},
        ${body.paymentMethod},
        ${body.referenceNumber || null},
        ${body.notes || null},
        ${user.id},
        NOW()
      )
      RETURNING *
    `

    const payment = payments[0]

    // Calculate new paid amount
    const newPaidAmount = paidAmount + paymentAmount

    // Determine new status
    let newStatus = invoice.status
    if (newPaidAmount >= totalAmount) {
      // Fully paid
      newStatus = 'paid'
    } else if (newPaidAmount > 0) {
      // Partially paid
      newStatus = 'partially_paid'
    }

    // Check if overdue
    const dueDate = new Date(invoice.due_date)
    const today = new Date()
    const isOverdue = today > dueDate && newPaidAmount < totalAmount

    if (isOverdue && newStatus !== 'paid') {
      newStatus = 'overdue'
    }

    // Update invoice paid amount and status
    await sql`
      UPDATE invoices
      SET
        paid_amount = ${newPaidAmount},
        status = ${newStatus},
        paid_date = ${newPaidAmount >= totalAmount ? new Date().toISOString() : null},
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `

    return NextResponse.json({
      success: true,
      payment,
      invoice: {
        id: invoiceId,
        paid_amount: newPaidAmount,
        status: newStatus,
        remaining_balance: totalAmount - newPaidAmount,
      },
    })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
