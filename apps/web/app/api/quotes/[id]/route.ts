import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Get single quote with line items
export async function GET(
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

    // Get quote with organization check
    const quotes = await sql`
      SELECT
        q.id, q.organization_id, q.client_id, q.quote_number, q.title, q.description,
        q.status, q.subtotal, q.gst_amount, q.total_amount, q.valid_until_date,
        q.sent_at, q.accepted_at, q.rejected_at, q.rejection_reason,
        q.converted_to_job_id, q.notes, q.created_at, q.updated_at,
        o.name as organization_name,
        c.company_name, c.first_name, c.last_name, c.is_company, c.email as client_email,
        u.full_name as created_by_name
      FROM quotes q
      INNER JOIN organizations o ON q.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON q.client_id = c.id
      LEFT JOIN users u ON q.created_by_user_id = u.id
      WHERE q.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Get line items
    const lineItems = await sql`
      SELECT * FROM quote_line_items
      WHERE quote_id = ${id}
      ORDER BY line_order ASC, created_at ASC
    `

    return NextResponse.json({
      quote,
      lineItems,
    })
  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update quote
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

    // Check quote exists and user has access
    const existingQuotes = await sql`
      SELECT q.* FROM quotes q
      INNER JOIN organization_members om ON q.organization_id = om.organization_id
      WHERE q.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (existingQuotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Calculate totals if provided
    let subtotal = body.subtotal !== undefined ? parseFloat(body.subtotal) : parseFloat(existingQuotes[0].subtotal)
    let gstAmount = body.gstAmount !== undefined ? parseFloat(body.gstAmount) : parseFloat(existingQuotes[0].gst_amount)
    let totalAmount = subtotal + gstAmount

    // Update quote
    const quotes = await sql`
      UPDATE quotes
      SET
        title = ${body.title !== undefined ? body.title : existingQuotes[0].title},
        description = ${body.description !== undefined ? body.description : existingQuotes[0].description},
        status = ${body.status !== undefined ? body.status : existingQuotes[0].status},
        subtotal = ${subtotal},
        gst_amount = ${gstAmount},
        total_amount = ${totalAmount},
        valid_until_date = ${body.validUntilDate !== undefined ? body.validUntilDate : existingQuotes[0].valid_until_date},
        notes = ${body.notes !== undefined ? body.notes : existingQuotes[0].notes},
        sent_at = ${body.sentAt !== undefined ? body.sentAt : existingQuotes[0].sent_at},
        accepted_at = ${body.acceptedAt !== undefined ? body.acceptedAt : existingQuotes[0].accepted_at},
        rejected_at = ${body.rejectedAt !== undefined ? body.rejectedAt : existingQuotes[0].rejected_at},
        rejection_reason = ${body.rejectionReason !== undefined ? body.rejectionReason : existingQuotes[0].rejection_reason},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    return NextResponse.json({ quote: quotes[0] })
  } catch (error) {
    console.error('Error updating quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete quote
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

    // Check quote exists and user has permission
    const quotes = await sql`
      SELECT q.*, om.role FROM quotes q
      INNER JOIN organization_members om ON q.organization_id = om.organization_id
      WHERE q.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Only owners and admins can delete quotes
    if (quote.role !== 'owner' && quote.role !== 'admin') {
      return NextResponse.json({ error: 'No permission to delete quotes' }, { status: 403 })
    }

    // Delete quote (cascade will delete line items)
    await sql`DELETE FROM quotes WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
