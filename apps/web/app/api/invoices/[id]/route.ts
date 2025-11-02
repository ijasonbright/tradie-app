import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get single invoice with line items and payments
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = clerkUserId

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get invoice with organization check
    const invoices = await sql`
      SELECT i.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
             c.email as client_email, c.phone as client_phone, c.mobile as client_mobile,
             c.billing_address_line1, c.billing_address_line2, c.billing_city, c.billing_state, c.billing_postcode,
             u.full_name as created_by_name, j.job_number, j.title as job_title
      FROM invoices i
      INNER JOIN organizations o ON i.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON i.client_id = c.id
      LEFT JOIN users u ON i.created_by_user_id = u.id
      LEFT JOIN jobs j ON i.job_id = j.id
      WHERE i.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Format client name
    const client_name = invoice.is_company
      ? invoice.company_name
      : `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim()

    // Get line items
    const lineItems = await sql`
      SELECT * FROM invoice_line_items
      WHERE invoice_id = ${id}
      ORDER BY line_order ASC
    `

    // Get payments
    const payments = await sql`
      SELECT ip.*, u.full_name as recorded_by_name
      FROM invoice_payments ip
      LEFT JOIN users u ON ip.recorded_by_user_id = u.id
      WHERE ip.invoice_id = ${id}
      ORDER BY ip.payment_date DESC, ip.created_at DESC
    `

    return NextResponse.json({
      invoice: {
        ...invoice,
        client_name,
      },
      lineItems,
      payments,
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update invoice
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Check invoice exists and user has access
    const existingInvoices = await sql`
      SELECT i.* FROM invoices i
      INNER JOIN organization_members om ON i.organization_id = om.organization_id
      WHERE i.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (existingInvoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const existing = existingInvoices[0]

    // Calculate totals if provided
    let subtotal = body.subtotal !== undefined ? parseFloat(body.subtotal) : parseFloat(existing.subtotal)
    let gstAmount = body.gstAmount !== undefined ? parseFloat(body.gstAmount) : parseFloat(existing.gst_amount)
    let totalAmount = subtotal + gstAmount

    // Update invoice
    const invoices = await sql`
      UPDATE invoices
      SET
        status = ${body.status !== undefined ? body.status : existing.status},
        subtotal = ${subtotal},
        gst_amount = ${gstAmount},
        total_amount = ${totalAmount},
        paid_amount = ${body.paidAmount !== undefined ? parseFloat(body.paidAmount) : parseFloat(existing.paid_amount)},
        issue_date = ${body.issueDate !== undefined ? body.issueDate : existing.issue_date},
        due_date = ${body.dueDate !== undefined ? body.dueDate : existing.due_date},
        paid_date = ${body.paidDate !== undefined ? body.paidDate : existing.paid_date},
        payment_terms = ${body.paymentTerms !== undefined ? body.paymentTerms : existing.payment_terms},
        payment_method = ${body.paymentMethod !== undefined ? body.paymentMethod : existing.payment_method},
        notes = ${body.notes !== undefined ? body.notes : existing.notes},
        footer_text = ${body.footerText !== undefined ? body.footerText : existing.footer_text},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({ invoice: invoices[0] })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete invoice
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Check invoice exists and user has permission
    const invoices = await sql`
      SELECT i.*, om.role FROM invoices i
      INNER JOIN organization_members om ON i.organization_id = om.organization_id
      WHERE i.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Only owners and admins can delete invoices
    if (invoice.role !== 'owner' && invoice.role !== 'admin') {
      return NextResponse.json({ error: 'No permission to delete invoices' }, { status: 403 })
    }

    // Delete related records first (no cascade configured)
    await sql`DELETE FROM invoice_payments WHERE invoice_id = ${id}`
    await sql`DELETE FROM invoice_line_items WHERE invoice_id = ${id}`

    // Delete invoice
    await sql`DELETE FROM invoices WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
