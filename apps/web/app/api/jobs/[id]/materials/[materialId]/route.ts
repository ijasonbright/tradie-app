import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// PUT - Update material
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
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

    const { id: jobId, materialId } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

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

    // Get existing material
    const existingMaterials = await sql`
      SELECT * FROM job_materials
      WHERE id = ${materialId} AND job_id = ${jobId}
      LIMIT 1
    `

    if (existingMaterials.length === 0) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    const existing = existingMaterials[0]

    // Calculate new total if quantity or unit price changed
    const quantity = body.quantity !== undefined ? parseFloat(body.quantity) : parseFloat(existing.quantity)
    const unitPrice = body.unitPrice !== undefined ? parseFloat(body.unitPrice) : parseFloat(existing.unit_price)
    const totalCost = quantity * unitPrice

    // Update material
    const materials = await sql`
      UPDATE job_materials
      SET
        material_type = ${body.materialType !== undefined ? body.materialType : existing.material_type},
        description = ${body.description !== undefined ? body.description : existing.description},
        supplier_name = ${body.supplierName !== undefined ? body.supplierName : existing.supplier_name},
        quantity = ${quantity},
        unit_price = ${unitPrice},
        total_cost = ${totalCost.toFixed(2)},
        receipt_url = ${body.receiptUrl !== undefined ? body.receiptUrl : existing.receipt_url},
        allocated_to_user_id = ${body.allocatedToUserId !== undefined ? body.allocatedToUserId : existing.allocated_to_user_id},
        updated_at = NOW()
      WHERE id = ${materialId}
      RETURNING *
    `

    return NextResponse.json({ material: materials[0] })
  } catch (error) {
    console.error('Error updating material:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete material
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
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

    const { id: jobId, materialId } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Check job exists and user has access
    const jobs = await sql`
      SELECT j.*, om.role FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Only owner, admin, or the person who added it can delete
    const material = await sql`SELECT * FROM job_materials WHERE id = ${materialId} AND job_id = ${jobId} LIMIT 1`

    if (material.length === 0) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    if (job.role !== 'owner' && job.role !== 'admin' && material[0].added_by_user_id !== user.id) {
      return NextResponse.json({ error: 'No permission to delete this material' }, { status: 403 })
    }

    // Delete material
    await sql`DELETE FROM job_materials WHERE id = ${materialId} AND job_id = ${jobId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting material:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
