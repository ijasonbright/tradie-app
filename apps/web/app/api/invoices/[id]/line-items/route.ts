import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Add line item to invoice
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params

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

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

    // Validate required fields
    if (!body.itemType || !body.description || body.quantity === undefined || body.unitPrice === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: itemType, description, quantity, unitPrice' },
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

    // Calculate line total and GST (10%)
    const quantity = parseFloat(body.quantity)
    const unitPrice = parseFloat(body.unitPrice)
    const lineSubtotal = quantity * unitPrice
    const gstAmount = lineSubtotal * 0.1
    const lineTotal = lineSubtotal + gstAmount

    // Create line item
    const lineItems = await sql`
      INSERT INTO invoice_line_items (
        invoice_id, source_type, source_id, item_type, description,
        quantity, unit_price, gst_amount, line_total, line_order
      ) VALUES (
        ${invoiceId},
        ${body.sourceType || null},
        ${body.sourceId || null},
        ${body.itemType},
        ${body.description},
        ${quantity},
        ${unitPrice},
        ${gstAmount.toFixed(2)},
        ${lineTotal.toFixed(2)},
        ${body.lineOrder || 0}
      ) RETURNING *
    `

    // Recalculate invoice totals
    const totals = await sql`
      SELECT
        SUM(line_total - gst_amount) as subtotal,
        SUM(gst_amount) as gst_amount,
        SUM(line_total) as total_amount
      FROM invoice_line_items
      WHERE invoice_id = ${invoiceId}
    `

    if (totals.length > 0 && totals[0].subtotal !== null) {
      await sql`
        UPDATE invoices
        SET
          subtotal = ${totals[0].subtotal},
          gst_amount = ${totals[0].gst_amount},
          total_amount = ${totals[0].total_amount},
          updated_at = NOW()
        WHERE id = ${invoiceId}
      `
    }

    return NextResponse.json({ lineItem: lineItems[0] }, { status: 201 })
  } catch (error) {
    console.error('Error adding line item:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete line item
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params

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

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const { searchParams } = new URL(req.url)
    const lineItemId = searchParams.get('lineItemId')

    if (!lineItemId) {
      return NextResponse.json({ error: 'Missing lineItemId' }, { status: 400 })
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

    // Delete line item
    await sql`
      DELETE FROM invoice_line_items
      WHERE id = ${lineItemId} AND invoice_id = ${invoiceId}
    `

    // Recalculate invoice totals
    const totals = await sql`
      SELECT
        SUM(line_total - gst_amount) as subtotal,
        SUM(gst_amount) as gst_amount,
        SUM(line_total) as total_amount
      FROM invoice_line_items
      WHERE invoice_id = ${invoiceId}
    `

    if (totals.length > 0 && totals[0].subtotal !== null) {
      await sql`
        UPDATE invoices
        SET
          subtotal = ${totals[0].subtotal},
          gst_amount = ${totals[0].gst_amount},
          total_amount = ${totals[0].total_amount},
          updated_at = NOW()
        WHERE id = ${invoiceId}
      `
    } else {
      // No line items left, reset to 0
      await sql`
        UPDATE invoices
        SET
          subtotal = 0,
          gst_amount = 0,
          total_amount = 0,
          updated_at = NOW()
        WHERE id = ${invoiceId}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting line item:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
