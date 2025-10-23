import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// DELETE - Delete specific line item by ID
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  try {
    const { id: invoiceId, lineItemId } = await params
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
        COALESCE(SUM(line_total - gst_amount), 0) as subtotal,
        COALESCE(SUM(gst_amount), 0) as gst_amount,
        COALESCE(SUM(line_total), 0) as total_amount
      FROM invoice_line_items
      WHERE invoice_id = ${invoiceId}
    `

    await sql`
      UPDATE invoices
      SET
        subtotal = ${totals[0].subtotal},
        gst_amount = ${totals[0].gst_amount},
        total_amount = ${totals[0].total_amount},
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting line item:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
