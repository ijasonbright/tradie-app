import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

/**
 * GET /api/completion-forms/templates/by-tc-form-id?tc_form_id=80
 *
 * Looks up a completion form template by its TradieConnect form ID (tc_form_id).
 * Used by the mobile app to find the correct completion form for a TC job.
 */
export async function GET(request: NextRequest) {
  try {
    // Try Clerk auth first (web)
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization')
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

    // Get tc_form_id from query params
    const { searchParams } = new URL(request.url)
    const tcFormId = searchParams.get('tc_form_id')

    if (!tcFormId) {
      return NextResponse.json({ error: 'Missing tc_form_id parameter' }, { status: 400 })
    }

    const tcFormIdNum = parseInt(tcFormId, 10)
    if (isNaN(tcFormIdNum)) {
      return NextResponse.json({ error: 'Invalid tc_form_id parameter' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get the user's organization
    const userOrgs = await sql`
      SELECT om.organization_id
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.clerk_user_id = ${clerkUserId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (userOrgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = userOrgs[0].organization_id

    // Look up template by tc_form_id
    // First check for org-specific template, then fall back to global
    const templates = await sql`
      SELECT
        t.id,
        t.organization_id,
        t.name,
        t.description,
        t.code,
        t.job_type,
        t.is_global,
        t.is_active,
        t.tc_form_id,
        t.navigation_type,
        t.include_photos,
        t.include_before_after_photos,
        t.include_signature,
        t.include_technician_signature,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT g.id)::integer as group_count,
        COUNT(DISTINCT q.id)::integer as question_count
      FROM completion_form_templates t
      LEFT JOIN completion_form_template_groups g ON g.template_id = t.id
      LEFT JOIN completion_form_template_questions q ON q.template_id = t.id
      WHERE t.tc_form_id = ${tcFormIdNum}
      AND t.is_active = true
      AND (
        t.is_global = true
        OR t.organization_id = ${organizationId}
      )
      GROUP BY t.id
      ORDER BY
        CASE WHEN t.organization_id = ${organizationId} THEN 0 ELSE 1 END,
        t.created_at DESC
      LIMIT 1
    `

    if (templates.length === 0) {
      return NextResponse.json({
        error: 'No completion form template found for this TC form ID',
        tc_form_id: tcFormIdNum,
        template: null
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      template: templates[0],
    })
  } catch (error) {
    console.error('Error looking up template by tc_form_id:', error)
    return NextResponse.json(
      { error: 'Failed to lookup template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
