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

    const { id: questionId } = await params
    const body = await req.json()
    const { answer_options } = body

    if (!Array.isArray(answer_options)) {
      return NextResponse.json(
        { error: 'answer_options must be an array' },
        { status: 400 }
      )
    }

    const sql = neon(process.env.DATABASE_URL!)

    const accessCheck = await sql`
      SELECT q.id
      FROM completion_form_template_questions q
      JOIN completion_form_template_groups g ON q.group_id = g.id
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

    const formattedOptions = answer_options.map((option, index) => ({
      id: option.id && !option.id.startsWith('temp-') ? option.id : `option-${index + 1}`,
      text: option.text,
      value: option.value || option.text,
      option_order: index + 1,
    }))

    await sql`
      UPDATE completion_form_template_questions
      SET answer_options = ${JSON.stringify(formattedOptions)},
          updated_at = NOW()
      WHERE id = ${questionId}
    `

    return NextResponse.json({
      success: true,
      answer_options: formattedOptions,
    })
  } catch (error) {
    console.error('Error updating answer options:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
