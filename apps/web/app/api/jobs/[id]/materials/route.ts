import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch all materials for a job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
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

    // Check job exists and user has access
    const jobs = await sql`
      SELECT j.* FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch materials with user names
    const materials = await sql`
      SELECT
        jm.*,
        u.full_name as added_by_name,
        approver.full_name as approved_by_name
      FROM job_materials jm
      LEFT JOIN users u ON jm.added_by_user_id = u.id
      LEFT JOIN users approver ON jm.approved_by_user_id = approver.id
      WHERE jm.job_id = ${jobId}
      ORDER BY jm.created_at DESC
    `

    return NextResponse.json({ materials })
  } catch (error) {
    console.error('Error fetching materials:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Add material to job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
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
    if (!body.materialType || !body.description || body.quantity === undefined || body.unitPrice === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: materialType, description, quantity, unitPrice' },
        { status: 400 }
      )
    }

    // Check job exists and user has access
    const jobs = await sql`
      SELECT j.* FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Calculate total cost
    const quantity = parseFloat(body.quantity)
    const unitPrice = parseFloat(body.unitPrice)
    const totalCost = quantity * unitPrice

    // Create material
    const materials = await sql`
      INSERT INTO job_materials (
        job_id, added_by_user_id, material_type, description, supplier_name,
        quantity, unit_price, total_cost, receipt_url, allocated_to_user_id, status
      ) VALUES (
        ${jobId},
        ${user.id},
        ${body.materialType},
        ${body.description},
        ${body.supplierName || null},
        ${quantity},
        ${unitPrice},
        ${totalCost.toFixed(2)},
        ${body.receiptUrl || null},
        ${body.allocatedToUserId || null},
        'pending'
      ) RETURNING *
    `

    return NextResponse.json({ material: materials[0] }, { status: 201 })
  } catch (error) {
    console.error('Error adding material:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
