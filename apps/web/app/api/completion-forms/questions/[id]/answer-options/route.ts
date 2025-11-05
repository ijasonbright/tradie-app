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

    const { id: questionId } = await params
    const body = await request.json()
    const { answer_options } = body

    if (!Array.isArray(answer_options)) {
      return NextResponse.json(
        { error: 'answer_options must be an array' },
        { status: 400 }
      )
    }

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
      WHERE q.id = ${questionId}
        AND u.clerk_user_id = ${authResult.userId}
        AND om.role IN ('owner', 'admin')
    `

    if (accessCheck.length === 0) {
      return NextResponse.json(
        { error: 'Not found or access denied' },
        { status: 404 }
      )
    }

    // Delete existing answer options for this question
    await sql`
      DELETE FROM completion_form_answer_options
      WHERE question_id = ${questionId}
    `

    // Insert new answer options
    const insertedOptions = []
    for (let i = 0; i < answer_options.length; i++) {
      const option = answer_options[i]
      const result = await sql`
        INSERT INTO completion_form_answer_options (
          question_id,
          text,
          value,
          option_order
        ) VALUES (
          ${questionId},
          ${option.text},
          ${option.value || option.text},
          ${i + 1}
        )
        RETURNING *
      `
      insertedOptions.push(result[0])
    }

    return NextResponse.json({
      success: true,
      answer_options: insertedOptions,
    })
  } catch (error) {
    console.error('Error updating answer options:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
