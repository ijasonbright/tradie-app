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
    const sql = neon(process.env.DATABASE_URL!)

    // Check if this is a public access request via token query parameter
    const url = new URL(req.url)
    const publicToken = url.searchParams.get('token')

    if (publicToken) {
      // PUBLIC ACCESS MODE - use public_token instead of ID
      return await handlePublicInvoiceAccess(sql, publicToken)
    }

    // AUTHENTICATED ACCESS MODE - require authentication
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

// Helper function for public invoice access (no auth required)
async function handlePublicInvoiceAccess(sql: any, token: string) {
  try {
    const invoices = await sql`
      SELECT i.*, c.first_name, c.last_name, c.company_name, c.is_company, c.email as client_email,
             o.name as organization_name, o.logo_url as organization_logo, o.phone as organization_phone,
             o.email as organization_email, o.address_line1 as organization_address_line1,
             o.address_line2 as organization_address_line2, o.city as organization_city,
             o.state as organization_state, o.postcode as organization_postcode, o.abn as organization_abn
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN organizations o ON i.organization_id = o.id
      WHERE i.public_token = ${token}
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    const lineItems = await sql`SELECT * FROM invoice_line_items WHERE invoice_id = ${invoice.id} ORDER BY line_order ASC`
    const payments = await sql`SELECT payment_date, amount, payment_method, reference_number, notes FROM invoice_payments WHERE invoice_id = ${invoice.id} ORDER BY payment_date DESC`

    const totalAmount = parseFloat(invoice.total_amount)
    const paidAmount = parseFloat(invoice.paid_amount || '0')
    const remainingAmount = totalAmount - paidAmount
    const dueDate = new Date(invoice.due_date)
    const isOverdue = dueDate < new Date() && remainingAmount > 0
    const clientName = invoice.is_company ? invoice.company_name : `${invoice.first_name} ${invoice.last_name}`

    return NextResponse.json({
      invoice: {
        id: invoice.id, invoiceNumber: invoice.invoice_number, status: invoice.status,
        subtotal: invoice.subtotal, gstAmount: invoice.gst_amount, totalAmount: invoice.total_amount,
        paidAmount: invoice.paid_amount, remainingAmount: remainingAmount.toFixed(2),
        issueDate: invoice.issue_date, dueDate: invoice.due_date, paidDate: invoice.paid_date,
        isOverdue, paymentTerms: invoice.payment_terms, notes: invoice.notes, footerText: invoice.footer_text,
        sentAt: invoice.sent_at, createdAt: invoice.created_at,
        stripePaymentLinkUrl: invoice.stripe_payment_link_url, isDepositInvoice: invoice.is_deposit_invoice,
      },
      lineItems: lineItems.map((item: any) => ({ id: item.id, itemType: item.item_type, description: item.description, quantity: item.quantity, unitPrice: item.unit_price, gstAmount: item.gst_amount, lineTotal: item.line_total })),
      payments: payments.map((payment: any) => ({ date: payment.payment_date, amount: payment.amount, method: payment.payment_method, reference: payment.reference_number, notes: payment.notes })),
      client: { name: clientName, email: invoice.client_email },
      organization: { name: invoice.organization_name, logoUrl: invoice.organization_logo, phone: invoice.organization_phone, email: invoice.organization_email, address: { line1: invoice.organization_address_line1, line2: invoice.organization_address_line2, city: invoice.organization_city, state: invoice.organization_state, postcode: invoice.organization_postcode }, abn: invoice.organization_abn },
    })
  } catch (error) {
    console.error('Error fetching public invoice:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
