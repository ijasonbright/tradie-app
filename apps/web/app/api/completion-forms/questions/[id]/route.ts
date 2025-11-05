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

    // Build update query dynamically based on provided fields
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (body.question_text !== undefined) {
      updates.push(`question_text = $${paramCount}`)
      values.push(body.question_text)
      paramCount++
    }

    if (body.field_type !== undefined) {
      updates.push(`field_type = $${paramCount}`)
      values.push(body.field_type)
      paramCount++
    }

    if (body.is_required !== undefined) {
      updates.push(`is_required = $${paramCount}`)
      values.push(body.is_required)
      paramCount++
    }

    if (body.help_text !== undefined) {
      updates.push(`help_text = $${paramCount}`)
      values.push(body.help_text)
      paramCount++
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`)

    // Add question ID as last parameter
    values.push(id)

    const updateQuery = `
      UPDATE completion_form_questions
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
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
