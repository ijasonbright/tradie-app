import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'


// GET /api/jobs/[id]/variations - List all variations for a job
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id: jobId } = params

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
      SELECT j.*, om.role, om.can_view_financials
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

    // Get all variations for this job
    const variations = await sql`
      SELECT
        qv.*,
        u.full_name as created_by_name
      FROM quote_variations qv
      LEFT JOIN users u ON qv.created_by_user_id = u.id
      WHERE qv.job_id = ${jobId}
      ORDER BY qv.created_at DESC
    `

    // Get line items for each variation
    const variationsWithLineItems = await Promise.all(
      variations.map(async (variation) => {
        const lineItems = await sql`
          SELECT * FROM quote_variation_line_items
          WHERE variation_id = ${variation.id}
          ORDER BY line_order ASC
        `
        return {
          ...variation,
          line_items: lineItems,
        }
      })
    )

    return NextResponse.json({
      success: true,
      variations: variationsWithLineItems,
    })
  } catch (error) {
    console.error('Error fetching variations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch variations' },
      { status: 500 }
    )
  }
}

// POST /api/jobs/[id]/variations - Create a new variation
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { id: jobId } = params
    const body = await req.json()

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Verify user has permission to create variations
    const jobAccess = await sql`
      SELECT
        j.*,
        om.role,
        om.can_create_invoices,
        om.organization_id
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

    // Check permissions - must be owner/admin or have can_create_invoices
    const canCreate = job.role === 'owner' || job.role === 'admin' || job.can_create_invoices
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create variations' },
        { status: 403 }
      )
    }

    // Generate variation number
    const existingVariations = await sql`
      SELECT variation_number FROM quote_variations
      WHERE job_id = ${jobId}
      ORDER BY created_at DESC
      LIMIT 1
    `

    let variationNumber = 'VAR-001'
    if (existingVariations.length > 0) {
      const lastNumber = existingVariations[0].variation_number
      const match = lastNumber.match(/VAR-(\d+)/)
      if (match) {
        const nextNum = parseInt(match[1]) + 1
        variationNumber = `VAR-${nextNum.toString().padStart(3, '0')}`
      }
    }

    // Calculate totals from line items
    const lineItems = body.lineItems || []
    let subtotal = 0
    let gstAmount = 0

    lineItems.forEach((item: any) => {
      const lineTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice)
      const lineGst = lineTotal * 0.1 // 10% GST
      subtotal += lineTotal
      gstAmount += lineGst
    })

    const totalAmount = subtotal + gstAmount

    // Create variation
    const newVariations = await sql`
      INSERT INTO quote_variations (
        quote_id,
        job_id,
        organization_id,
        variation_number,
        title,
        description,
        status,
        subtotal,
        gst_amount,
        total_amount,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (
        ${job.quote_id || null},
        ${jobId},
        ${job.organization_id},
        ${variationNumber},
        ${body.title},
        ${body.description || null},
        'pending',
        ${subtotal},
        ${gstAmount},
        ${totalAmount},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    const variation = newVariations[0]

    // Insert line items
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i]
      const lineTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice)
      const lineGst = lineTotal * 0.1

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
          ${variation.id},
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

    // Fetch the complete variation with line items
    const lineItemsResult = await sql`
      SELECT * FROM quote_variation_line_items
      WHERE variation_id = ${variation.id}
      ORDER BY line_order ASC
    `

    return NextResponse.json({
      success: true,
      variation: {
        ...variation,
        line_items: lineItemsResult,
      },
    })
  } catch (error) {
    console.error('Error creating variation:', error)
    return NextResponse.json(
      { error: 'Failed to create variation' },
      { status: 500 }
    )
  }
}
