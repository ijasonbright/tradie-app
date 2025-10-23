import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// DELETE - Delete a payment and recalculate invoice status
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: invoiceId, paymentId } = await params
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

    // Verify user has access to this invoice
    const invoices = await sql`
      SELECT i.* FROM invoices i
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

    // Get the payment to delete
    const payments = await sql`
      SELECT * FROM invoice_payments
      WHERE id = ${paymentId} AND invoice_id = ${invoiceId}
      LIMIT 1
    `

    if (payments.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const payment = payments[0]
    const paymentAmount = parseFloat(payment.amount)

    // Delete the payment
    await sql`
      DELETE FROM invoice_payments
      WHERE id = ${paymentId}
    `

    // Recalculate paid amount
    const currentPaidAmount = parseFloat(invoice.paid_amount || '0')
    const newPaidAmount = Math.max(0, currentPaidAmount - paymentAmount)
    const totalAmount = parseFloat(invoice.total_amount)

    // Determine new status
    let newStatus = 'draft'
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid'
    } else if (newPaidAmount > 0) {
      newStatus = 'partially_paid'
    } else if (invoice.sent_at) {
      newStatus = 'sent'
    }

    // Check if overdue
    const dueDate = new Date(invoice.due_date)
    const today = new Date()
    const isOverdue = today > dueDate && newPaidAmount < totalAmount

    if (isOverdue && newStatus !== 'paid') {
      newStatus = 'overdue'
    }

    // Update invoice
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
      message: 'Payment deleted successfully',
      invoice: {
        id: invoiceId,
        paid_amount: newPaidAmount,
        status: newStatus,
        remaining_balance: totalAmount - newPaidAmount,
      },
    })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
