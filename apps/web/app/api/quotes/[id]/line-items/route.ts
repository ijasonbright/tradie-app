import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch all line items for a quote
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
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

    // Check quote exists and user has access
    const quotes = await sql`
      SELECT q.* FROM quotes q
      INNER JOIN organization_members om ON q.organization_id = om.organization_id
      WHERE q.id = ${quoteId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Fetch line items ordered by line_order
    const lineItems = await sql`
      SELECT *
      FROM quote_line_items
      WHERE quote_id = ${quoteId}
      ORDER BY line_order ASC, created_at ASC
    `

    return NextResponse.json({ lineItems })
  } catch (error) {
    console.error('Error fetching line items:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Add line item to quote
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
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
    if (!body.itemType || !body.description || body.quantity === undefined || body.unitPrice === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: itemType, description, quantity, unitPrice' },
        { status: 400 }
      )
    }

    // Check quote exists and user has access
    const quotes = await sql`
      SELECT q.* FROM quotes q
      INNER JOIN organization_members om ON q.organization_id = om.organization_id
      WHERE q.id = ${quoteId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Calculate line total and GST (10%)
    const quantity = parseFloat(body.quantity)
    const unitPrice = parseFloat(body.unitPrice)
    const lineSubtotal = quantity * unitPrice
    const gstAmount = lineSubtotal * 0.1
    const lineTotal = lineSubtotal + gstAmount

    // Create line item
    const lineItems = await sql`
      INSERT INTO quote_line_items (
        quote_id, item_type, description, quantity, unit_price, gst_amount, line_total, line_order
      ) VALUES (
        ${quoteId},
        ${body.itemType},
        ${body.description},
        ${quantity},
        ${unitPrice},
        ${gstAmount.toFixed(2)},
        ${lineTotal.toFixed(2)},
        ${body.lineOrder || 0}
      ) RETURNING *
    `

    // Recalculate quote totals
    const totals = await sql`
      SELECT
        SUM(line_total - gst_amount) as subtotal,
        SUM(gst_amount) as gst_amount,
        SUM(line_total) as total_amount
      FROM quote_line_items
      WHERE quote_id = ${quoteId}
    `

    if (totals.length > 0 && totals[0].subtotal !== null) {
      await sql`
        UPDATE quotes
        SET
          subtotal = ${totals[0].subtotal},
          gst_amount = ${totals[0].gst_amount},
          total_amount = ${totals[0].total_amount},
          updated_at = NOW()
        WHERE id = ${quoteId}
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

// PUT - Update line item
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
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

    if (!body.lineItemId) {
      return NextResponse.json({ error: 'Missing lineItemId' }, { status: 400 })
    }

    // Check quote exists and user has access
    const quotes = await sql`
      SELECT q.* FROM quotes q
      INNER JOIN organization_members om ON q.organization_id = om.organization_id
      WHERE q.id = ${quoteId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Get existing line item
    const existingItems = await sql`
      SELECT * FROM quote_line_items
      WHERE id = ${body.lineItemId} AND quote_id = ${quoteId}
      LIMIT 1
    `

    if (existingItems.length === 0) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    const existing = existingItems[0]

    // Calculate new totals
    const quantity = body.quantity !== undefined ? parseFloat(body.quantity) : parseFloat(existing.quantity)
    const unitPrice = body.unitPrice !== undefined ? parseFloat(body.unitPrice) : parseFloat(existing.unit_price)
    const lineSubtotal = quantity * unitPrice
    const gstAmount = lineSubtotal * 0.1
    const lineTotal = lineSubtotal + gstAmount

    // Update line item
    const lineItems = await sql`
      UPDATE quote_line_items
      SET
        item_type = ${body.itemType !== undefined ? body.itemType : existing.item_type},
        description = ${body.description !== undefined ? body.description : existing.description},
        quantity = ${quantity},
        unit_price = ${unitPrice},
        gst_amount = ${gstAmount.toFixed(2)},
        line_total = ${lineTotal.toFixed(2)},
        line_order = ${body.lineOrder !== undefined ? body.lineOrder : existing.line_order}
      WHERE id = ${body.lineItemId}
      RETURNING *
    `

    // Recalculate quote totals
    const totals = await sql`
      SELECT
        SUM(line_total - gst_amount) as subtotal,
        SUM(gst_amount) as gst_amount,
        SUM(line_total) as total_amount
      FROM quote_line_items
      WHERE quote_id = ${quoteId}
    `

    if (totals.length > 0 && totals[0].subtotal !== null) {
      await sql`
        UPDATE quotes
        SET
          subtotal = ${totals[0].subtotal},
          gst_amount = ${totals[0].gst_amount},
          total_amount = ${totals[0].total_amount},
          updated_at = NOW()
        WHERE id = ${quoteId}
      `
    }

    return NextResponse.json({ lineItem: lineItems[0] })
  } catch (error) {
    console.error('Error updating line item:', error)
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
    const { id: quoteId } = await params
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
    const lineItemId = searchParams.get('lineItemId')

    if (!lineItemId) {
      return NextResponse.json({ error: 'Missing lineItemId' }, { status: 400 })
    }

    // Check quote exists and user has access
    const quotes = await sql`
      SELECT q.* FROM quotes q
      INNER JOIN organization_members om ON q.organization_id = om.organization_id
      WHERE q.id = ${quoteId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Delete line item
    await sql`
      DELETE FROM quote_line_items
      WHERE id = ${lineItemId} AND quote_id = ${quoteId}
    `

    // Recalculate quote totals
    const totals = await sql`
      SELECT
        SUM(line_total - gst_amount) as subtotal,
        SUM(gst_amount) as gst_amount,
        SUM(line_total) as total_amount
      FROM quote_line_items
      WHERE quote_id = ${quoteId}
    `

    if (totals.length > 0 && totals[0].subtotal !== null) {
      await sql`
        UPDATE quotes
        SET
          subtotal = ${totals[0].subtotal},
          gst_amount = ${totals[0].gst_amount},
          total_amount = ${totals[0].total_amount},
          updated_at = NOW()
        WHERE id = ${quoteId}
      `
    } else {
      // No line items left, reset to 0
      await sql`
        UPDATE quotes
        SET
          subtotal = 0,
          gst_amount = 0,
          total_amount = 0,
          updated_at = NOW()
        WHERE id = ${quoteId}
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
