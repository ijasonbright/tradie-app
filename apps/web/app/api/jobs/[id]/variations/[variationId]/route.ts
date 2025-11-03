import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'


// GET /api/jobs/[id]/variations/[variationId] - Get a single variation
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; variationId: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id: jobId, variationId } = params

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has access to this job's organization
    const jobAccess = await sql`
      SELECT j.*, om.role
      FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobAccess.length === 0) {
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 })
    }

    // Get variation
    const variations = await sql`
      SELECT
        qv.*,
        u.full_name as created_by_name
      FROM quote_variations qv
      LEFT JOIN users u ON qv.created_by_user_id = u.id
      WHERE qv.id = ${variationId}
      AND qv.job_id = ${jobId}
      LIMIT 1
    `

    if (variations.length === 0) {
      return NextResponse.json({ error: 'Variation not found' }, { status: 404 })
    }

    const variation = variations[0]

    // Get line items
    const lineItems = await sql`
      SELECT * FROM quote_variation_line_items
      WHERE variation_id = ${variationId}
      ORDER BY line_order ASC
    `

    return NextResponse.json({
      success: true,
      variation: {
        ...variation,
        line_items: lineItems,
      },
    })
  } catch (error) {
    console.error('Error fetching variation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch variation' },
      { status: 500 }
    )
  }
}

// PUT /api/jobs/[id]/variations/[variationId] - Update variation (edit or approve/reject)
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string; variationId: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id: jobId, variationId } = params
    const body = await req.json()

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has permission
    const jobAccess = await sql`
      SELECT
        j.*,
        om.role,
        om.can_create_invoices
      FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobAccess.length === 0) {
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 })
    }

    const job = jobAccess[0]

    // Check permissions
    const canEdit = job.role === 'owner' || job.role === 'admin' || job.can_create_invoices
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update variation' },
        { status: 403 }
      )
    }

    // Get current variation
    const variations = await sql`
      SELECT * FROM quote_variations
      WHERE id = ${variationId}
      AND job_id = ${jobId}
      LIMIT 1
    `

    if (variations.length === 0) {
      return NextResponse.json({ error: 'Variation not found' }, { status: 404 })
    }

    const variation = variations[0]

    // Handle approval/rejection
    if (body.action === 'approve') {
      const updatedVariations = await sql`
        UPDATE quote_variations
        SET
          status = 'approved',
          approved_by_client_at = NOW(),
          updated_at = NOW()
        WHERE id = ${variationId}
        RETURNING *
      `

      // Update job's quoted_amount to include approved variation
      const currentQuotedAmount = parseFloat(job.quoted_amount || '0')
      const variationAmount = parseFloat(variation.total_amount)
      const newQuotedAmount = currentQuotedAmount + variationAmount

      await sql`
        UPDATE jobs
        SET quoted_amount = ${newQuotedAmount}
        WHERE id = ${jobId}
      `

      return NextResponse.json({
        success: true,
        variation: updatedVariations[0],
        message: 'Variation approved and added to job quoted amount',
      })
    } else if (body.action === 'reject') {
      const updatedVariations = await sql`
        UPDATE quote_variations
        SET
          status = 'rejected',
          rejected_by_client_at = NOW(),
          rejection_reason = ${body.rejectionReason || null},
          updated_at = NOW()
        WHERE id = ${variationId}
        RETURNING *
      `

      return NextResponse.json({
        success: true,
        variation: updatedVariations[0],
        message: 'Variation rejected',
      })
    } else {
      // Regular update (title, description, line items)
      // Only allow editing if status is still pending
      if (variation.status !== 'pending') {
        return NextResponse.json(
          { error: 'Cannot edit variation that has been approved or rejected' },
          { status: 400 }
        )
      }

      // Calculate new totals if line items are being updated
      let subtotal = parseFloat(variation.subtotal)
      let gstAmount = parseFloat(variation.gst_amount)
      let totalAmount = parseFloat(variation.total_amount)

      if (body.lineItems) {
        subtotal = 0
        gstAmount = 0

        // Delete old line items
        await sql`
          DELETE FROM quote_variation_line_items
          WHERE variation_id = ${variationId}
        `

        // Insert new line items
        for (let i = 0; i < body.lineItems.length; i++) {
          const item = body.lineItems[i]
          const lineTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice)
          const lineGst = lineTotal * 0.1

          subtotal += lineTotal
          gstAmount += lineGst

          await sql`
            INSERT INTO quote_variation_line_items (
              variation_id,
              item_type,
              description,
              quantity,
              unit_price,
              gst_amount,
              line_total,
              line_order
            ) VALUES (
              ${variationId},
              ${item.itemType},
              ${item.description},
              ${item.quantity},
              ${item.unitPrice},
              ${lineGst},
              ${lineTotal},
              ${i}
            )
          `
        }

        totalAmount = subtotal + gstAmount
      }

      // Update variation
      const updatedVariations = await sql`
        UPDATE quote_variations
        SET
          title = COALESCE(${body.title}, title),
          description = ${body.description !== undefined ? body.description : variation.description},
          subtotal = ${subtotal},
          gst_amount = ${gstAmount},
          total_amount = ${totalAmount},
          updated_at = NOW()
        WHERE id = ${variationId}
        RETURNING *
      `

      // Fetch updated line items
      const lineItems = await sql`
        SELECT * FROM quote_variation_line_items
        WHERE variation_id = ${variationId}
        ORDER BY line_order ASC
      `

      return NextResponse.json({
        success: true,
        variation: {
          ...updatedVariations[0],
          line_items: lineItems,
        },
      })
    }
  } catch (error) {
    console.error('Error updating variation:', error)
    return NextResponse.json(
      { error: 'Failed to update variation' },
      { status: 500 }
    )
  }
}

// DELETE /api/jobs/[id]/variations/[variationId] - Delete a variation
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string; variationId: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id: jobId, variationId } = params

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has permission
    const jobAccess = await sql`
      SELECT
        j.*,
        om.role,
        om.can_create_invoices
      FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobAccess.length === 0) {
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 })
    }

    const job = jobAccess[0]

    // Check permissions
    const canDelete = job.role === 'owner' || job.role === 'admin'
    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only owners and admins can delete variations' },
        { status: 403 }
      )
    }

    // Check if variation exists and is pending
    const variations = await sql`
      SELECT * FROM quote_variations
      WHERE id = ${variationId}
      AND job_id = ${jobId}
      LIMIT 1
    `

    if (variations.length === 0) {
      return NextResponse.json({ error: 'Variation not found' }, { status: 404 })
    }

    const variation = variations[0]

    // Only allow deletion of pending variations
    if (variation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete variation that has been approved or rejected' },
        { status: 400 }
      )
    }

    // Delete variation (line items will be deleted automatically via CASCADE)
    await sql`
      DELETE FROM quote_variations
      WHERE id = ${variationId}
    `

    return NextResponse.json({
      success: true,
      message: 'Variation deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting variation:', error)
    return NextResponse.json(
      { error: 'Failed to delete variation' },
      { status: 500 }
    )
  }
}
