import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Complete an asset register job with form data
export async function POST(
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

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]
    const body = await req.json()

    // Verify user has access to this job
    const jobs = await sql`
      SELECT arj.*
      FROM asset_register_jobs arj
      INNER JOIN organization_members om ON arj.organization_id = om.organization_id
      WHERE arj.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Asset register job not found or access denied' }, { status: 404 })
    }

    const job = jobs[0]

    // Create completion form record
    const completionForms = await sql`
      INSERT INTO asset_register_completion_forms (
        organization_id,
        asset_register_job_id,
        template_id,
        completed_by_user_id,
        completion_date,
        form_data,
        client_signature_url,
        technician_signature_url,
        client_name,
        technician_name,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${job.organization_id},
        ${id},
        ${body.template_id || null},
        ${user.id},
        NOW(),
        ${JSON.stringify(body.form_data || {})},
        ${body.client_signature_url || null},
        ${body.technician_signature_url || null},
        ${body.client_name || null},
        ${body.technician_name || user.full_name},
        'submitted',
        NOW(),
        NOW()
      )
      RETURNING *
    `

    // Update job status to COMPLETED
    const updatedJob = await sql`
      UPDATE asset_register_jobs
      SET
        status = 'COMPLETED',
        completed_date = NOW(),
        completion_notes = ${body.completion_notes || null},
        report_data = ${body.report_data ? JSON.stringify(body.report_data) : null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    const completedJob = updatedJob[0]

    // Send webhook to PropertyPal if this job has an external request ID
    if (completedJob.external_request_id) {
      try {
        const webhookUrl = process.env.PROPERTYPAL_WEBHOOK_URL || 'https://property-pal-git-staging-jason-brights-projects.vercel.app/api/webhooks/tradieapp/asset-register'
        const webhookSecret = process.env.PROPERTYPAL_WEBHOOK_SECRET

        const webhookPayload = {
          event: 'asset_register.completed',
          asset_register_job_id: completedJob.id,
          external_request_id: completedJob.external_request_id,
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completion_notes: body.completion_notes || null,
          inspector_name: body.technician_name || user.full_name,
          report_data: body.report_data ? {
            total_items: body.report_data.total_items || 0,
            rooms_completed: body.report_data.rooms_completed || 0,
            rooms_data: body.report_data.rooms_data || {},
            completed_at: new Date().toISOString(),
            inspector_name: body.technician_name || user.full_name,
          } : null,
        }

        const webhookHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (webhookSecret) {
          webhookHeaders['x-api-key'] = webhookSecret
        }
        // Add Vercel protection bypass header for staging deployments
        const vercelBypassSecret = process.env.PROPERTY_PAL_BYPASS_TOKEN
        if (vercelBypassSecret) {
          webhookHeaders['x-vercel-protection-bypass'] = vercelBypassSecret
        }

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify(webhookPayload),
        })

        if (!webhookResponse.ok) {
          console.error('PropertyPal webhook failed:', await webhookResponse.text())
        } else {
          console.log('PropertyPal webhook sent successfully for job:', completedJob.id)
        }
      } catch (webhookError) {
        // Log but don't fail the request if webhook fails
        console.error('Error sending PropertyPal webhook:', webhookError)
      }
    }

    return NextResponse.json({
      success: true,
      job: completedJob,
      completionForm: completionForms[0],
    })
  } catch (error) {
    console.error('Error completing asset register job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
