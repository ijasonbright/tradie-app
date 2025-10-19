import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Record payment for invoice
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
    if (!body.paymentDate || body.amount === undefined || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentDate, amount, paymentMethod' },
        { status: 400 }
      )
    }

    // Check invoice exists and user has access
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
    const amount = parseFloat(body.amount)

    // Record payment
    const payments = await sql`
      INSERT INTO invoice_payments (
        invoice_id, payment_date, amount, payment_method,
        reference_number, notes, recorded_by_user_id, created_at
      ) VALUES (
        ${invoiceId},
        ${body.paymentDate},
        ${amount},
        ${body.paymentMethod},
        ${body.referenceNumber || null},
        ${body.notes || null},
        ${user.id},
        NOW()
      ) RETURNING *
    `

    // Calculate total paid amount
    const totalPaid = await sql`
      SELECT SUM(amount) as total_paid
      FROM invoice_payments
      WHERE invoice_id = ${invoiceId}
    `

    const paidAmount = parseFloat(totalPaid[0].total_paid || '0')
    const totalAmount = parseFloat(invoice.total_amount)

    // Update invoice status and paid amount
    let newStatus = invoice.status
    let paidDate = invoice.paid_date

    if (paidAmount >= totalAmount) {
      newStatus = 'paid'
      paidDate = body.paymentDate
    } else if (paidAmount > 0) {
      newStatus = 'partially_paid'
    }

    await sql`
      UPDATE invoices
      SET
        paid_amount = ${paidAmount},
        status = ${newStatus},
        paid_date = ${paidDate},
        payment_method = ${body.paymentMethod},
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `

    return NextResponse.json({ payment: payments[0] }, { status: 201 })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete payment
export async function DELETE(
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

    const { searchParams } = new URL(req.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 })
    }

    // Check invoice exists and user has access (admin/owner only)
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

    // Only owners and admins can delete payments
    if (invoice.role !== 'owner' && invoice.role !== 'admin') {
      return NextResponse.json({ error: 'No permission to delete payments' }, { status: 403 })
    }

    // Delete payment
    await sql`
      DELETE FROM invoice_payments
      WHERE id = ${paymentId} AND invoice_id = ${invoiceId}
    `

    // Recalculate total paid amount
    const totalPaid = await sql`
      SELECT SUM(amount) as total_paid
      FROM invoice_payments
      WHERE invoice_id = ${invoiceId}
    `

    const paidAmount = parseFloat(totalPaid[0].total_paid || '0')
    const totalAmount = parseFloat(invoice.total_amount)

    // Update invoice status
    let newStatus = 'sent'
    let paidDate = null

    if (paidAmount >= totalAmount) {
      newStatus = 'paid'
      // Get latest payment date
      const latestPayment = await sql`
        SELECT payment_date FROM invoice_payments
        WHERE invoice_id = ${invoiceId}
        ORDER BY payment_date DESC
        LIMIT 1
      `
      if (latestPayment.length > 0) {
        paidDate = latestPayment[0].payment_date
      }
    } else if (paidAmount > 0) {
      newStatus = 'partially_paid'
    }

    await sql`
      UPDATE invoices
      SET
        paid_amount = ${paidAmount},
        status = ${newStatus},
        paid_date = ${paidDate},
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
