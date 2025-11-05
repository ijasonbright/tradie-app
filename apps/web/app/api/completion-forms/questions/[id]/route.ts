import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const sql = neon(process.env.DATABASE_URL!)

    // Validate user has access to this question's organization
    const accessCheck = await sql`
      SELECT q.id
      FROM completion_form_questions q
      JOIN completion_form_groups g ON q.group_id = g.id
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

    // Build update fields
    const updateFields: any = {}

    if (body.question_text !== undefined) {
      updateFields.question_text = body.question_text
    }

    if (body.field_type !== undefined) {
      updateFields.field_type = body.field_type
    }

    if (body.is_required !== undefined) {
      updateFields.is_required = body.is_required
    }

    if (body.help_text !== undefined) {
      updateFields.help_text = body.help_text
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Build the SET clause dynamically
    const setClauses = Object.keys(updateFields).map((key, index) => {
      return `${key} = $${index + 1}`
    })

    // Add updated_at
    setClauses.push(`updated_at = NOW()`)

    // Get values in the same order as the SET clauses
    const values = Object.values(updateFields)
    values.push(id) // Add ID as the last parameter

    const updateQuery = `
      UPDATE completion_form_questions
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `

    const result = await sql(updateQuery, values)

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
