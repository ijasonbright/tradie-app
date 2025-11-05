import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const sql = neon(process.env.DATABASE_URL!)

    // Validate user has access to this question's organization
    const accessCheck = await sql`
      SELECT q.id
      FROM completion_form_template_questions q
      JOIN completion_form_template_groups g ON q.group_id = g.id
      JOIN completion_form_templates t ON g.template_id = t.id
      JOIN organizations o ON t.organization_id = o.id
      JOIN organization_members om ON o.id = om.organization_id
      JOIN users u ON om.user_id = u.id
      WHERE q.id = ${id}
        AND u.clerk_user_id = ${authResult.userId}
        AND om.role IN ('owner', 'admin')
    `

    if (accessCheck.length === 0) {
      return NextResponse.json(
        { error: 'Not found or access denied' },
        { status: 404 }
      )
    }

    const updates: any[] = []

    if (body.question_text !== undefined) {
      updates.push({ field: 'question_text', value: body.question_text })
    }

    if (body.field_type !== undefined) {
      updates.push({ field: 'field_type', value: body.field_type })
    }

    if (body.is_required !== undefined) {
      updates.push({ field: 'is_required', value: body.is_required })
    }

    if (body.help_text !== undefined) {
      updates.push({ field: 'help_text', value: body.help_text })
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    for (const update of updates) {
      if (update.field === 'question_text') {
        await sql`UPDATE completion_form_template_questions SET question_text = ${update.value}, updated_at = NOW() WHERE id = ${id}`
      } else if (update.field === 'field_type') {
        await sql`UPDATE completion_form_template_questions SET field_type = ${update.value}, updated_at = NOW() WHERE id = ${id}`
      } else if (update.field === 'is_required') {
        await sql`UPDATE completion_form_template_questions SET is_required = ${update.value}, updated_at = NOW() WHERE id = ${id}`
      } else if (update.field === 'help_text') {
        await sql`UPDATE completion_form_template_questions SET help_text = ${update.value}, updated_at = NOW() WHERE id = ${id}`
      }
    }

    const result = await sql`
      SELECT * FROM completion_form_template_questions WHERE id = ${id}
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      question: result[0],
    })
  } catch (error) {
    console.error('Error updating question:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
