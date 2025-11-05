import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

/**
 * GET /api/completion-forms/templates/:id
 *
 * Get a single completion form template with all groups and questions
 * Returns complete template structure ready for form rendering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Dual authentication: Clerk (web) + JWT (mobile)
  let clerkUserId: string | null = null

  try {
    const authResult = await auth()
    clerkUserId = authResult.userId
  } catch (error) {
    // Clerk auth failed, try JWT token
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

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const templateId = params.id

    // Get user's organization
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

    // Get template (must be global or belong to organization)
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
        t.navigation_type,
        t.include_photos,
        t.include_before_after_photos,
        t.include_signature,
        t.include_technician_signature,
        t.site_id,
        t.csv_job_type_id,
        t.csv_form_type_id,
        t.created_at,
        t.updated_at
      FROM completion_form_templates t
      WHERE t.id = ${templateId}
      AND (
        t.is_global = true
        OR t.organization_id = ${organizationId}
      )
      LIMIT 1
    `

    if (templates.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const template = templates[0]

    // Get all groups for this template
    const groups = await sql`
      SELECT
        g.id,
        g.template_id,
        g.name,
        g.description,
        g.sort_order,
        g.is_collapsible,
        g.is_completion_group,
        g.conditional_logic,
        g.csv_group_id,
        g.created_at,
        g.updated_at
      FROM completion_form_template_groups g
      WHERE g.template_id = ${templateId}
      ORDER BY g.sort_order ASC
    `

    // Get all questions for this template
    const questions = await sql`
      SELECT
        q.id,
        q.template_id,
        q.group_id,
        q.question_text,
        q.placeholder,
        q.help_text,
        q.help_url,
        q.default_value,
        q.field_type,
        q.config,
        q.is_required,
        q.validation_message,
        q.validation_rules,
        q.sort_order,
        q.column_span,
        q.conditional_logic,
        q.answer_options,
        q.csv_question_id,
        q.csv_group_no,
        q.csv_field,
        q.created_at,
        q.updated_at
      FROM completion_form_template_questions q
      WHERE q.template_id = ${templateId}
      ORDER BY q.sort_order ASC
    `

    // Organize questions by group
    const groupsWithQuestions = groups.map((group: any) => ({
      ...group,
      questions: questions.filter((q: any) => q.group_id === group.id),
    }))

    // Return complete template structure
    return NextResponse.json({
      ...template,
      groups: groupsWithQuestions,
      summary: {
        total_groups: groups.length,
        total_questions: questions.length,
      },
    })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
