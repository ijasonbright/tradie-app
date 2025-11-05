import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const { id } = await params
    const templateId = id

    const userOrgs = await sql`
      SELECT om.organization_id
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.clerk_user_id = ${authResult.userId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (userOrgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = userOrgs[0].organization_id

    const templates = await sql`
      SELECT *
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

    const groups = await sql`
      SELECT *
      FROM completion_form_template_groups g
      WHERE g.template_id = ${templateId}
      ORDER BY g.sort_order ASC
    `

    const questions = await sql`
      SELECT *
      FROM completion_form_template_questions q
      WHERE q.template_id = ${templateId}
      ORDER BY q.sort_order ASC
    `

    const groupsWithQuestions = groups.map((group: any) => ({
      ...group,
      questions: questions.filter((q: any) => q.group_id === group.id),
    }))

    return NextResponse.json({
      ...template,
      groups: groupsWithQuestions,
    })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
