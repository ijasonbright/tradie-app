'use server'

import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'

export async function updateQuestion(
  questionId: string,
  updates: {
    question_text?: string
    field_type?: string
    is_required?: boolean
    help_text?: string | null
  }
) {
  const authResult = await auth()
  if (!authResult.userId) {
    throw new Error('Unauthorized')
  }

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
    WHERE q.id = ${questionId}
      AND u.clerk_user_id = ${authResult.userId}
      AND om.role IN ('owner', 'admin')
  `

  if (accessCheck.length === 0) {
    throw new Error('Not found or access denied')
  }

  // Update fields one by one
  if (updates.question_text !== undefined) {
    await sql`UPDATE completion_form_template_questions SET question_text = ${updates.question_text}, updated_at = NOW() WHERE id = ${questionId}`
  }

  if (updates.field_type !== undefined) {
    await sql`UPDATE completion_form_template_questions SET field_type = ${updates.field_type}, updated_at = NOW() WHERE id = ${questionId}`
  }

  if (updates.is_required !== undefined) {
    await sql`UPDATE completion_form_template_questions SET is_required = ${updates.is_required}, updated_at = NOW() WHERE id = ${questionId}`
  }

  if (updates.help_text !== undefined) {
    await sql`UPDATE completion_form_template_questions SET help_text = ${updates.help_text}, updated_at = NOW() WHERE id = ${questionId}`
  }

  // Get the updated question
  const result = await sql`
    SELECT * FROM completion_form_template_questions WHERE id = ${questionId}
  `

  revalidatePath('/dashboard/form-builder')

  return result[0]
}

export async function updateAnswerOptions(
  questionId: string,
  answerOptions: Array<{ id: string; text: string; value: string; option_order: number }>
) {
  const authResult = await auth()
  if (!authResult.userId) {
    throw new Error('Unauthorized')
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
    throw new Error('Not found or access denied')
  }

  const formattedOptions = answerOptions.map((option, index) => ({
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

  revalidatePath('/dashboard/form-builder')

  return formattedOptions
}
