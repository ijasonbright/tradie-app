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
  try {
    console.log('[updateQuestion] Starting with questionId:', questionId, 'updates:', updates)

    const authResult = await auth()
    if (!authResult.userId) {
      console.error('[updateQuestion] No userId from auth')
      throw new Error('Unauthorized')
    }
    console.log('[updateQuestion] Auth successful, userId:', authResult.userId)

    const sql = neon(process.env.DATABASE_URL!)

    // Validate user has access to this question's organization
    console.log('[updateQuestion] Checking access for question:', questionId)

    // Debug: Check if question exists
    const questionCheck = await sql`SELECT q.id, q.group_id FROM completion_form_template_questions q WHERE q.id = ${questionId}`
    console.log('[updateQuestion] Question check:', questionCheck)

    if (questionCheck.length === 0) {
      console.error('[updateQuestion] Question not found')
      throw new Error('Question not found')
    }

    // Debug: Check group
    const groupCheck = await sql`
      SELECT g.id, g.template_id
      FROM completion_form_template_groups g
      WHERE g.id = ${questionCheck[0].group_id}
    `
    console.log('[updateQuestion] Group check:', groupCheck)

    // Debug: Check template
    if (groupCheck.length > 0) {
      const templateCheck = await sql`
        SELECT t.id, t.organization_id, t.is_global
        FROM completion_form_templates t
        WHERE t.id = ${groupCheck[0].template_id}
      `
      console.log('[updateQuestion] Template check:', templateCheck)

      // Debug: Check user's organization membership
      if (templateCheck.length > 0) {
        const userOrgCheck = await sql`
          SELECT om.id, om.role, om.organization_id, u.clerk_user_id
          FROM organization_members om
          JOIN users u ON om.user_id = u.id
          WHERE u.clerk_user_id = ${authResult.userId}
        `
        console.log('[updateQuestion] User org membership:', userOrgCheck)
      }
    }

    // Check if template is global or user has access to organization-specific template
    const accessCheck = await sql`
      SELECT q.id
      FROM completion_form_template_questions q
      JOIN completion_form_template_groups g ON q.group_id = g.id
      JOIN completion_form_templates t ON g.template_id = t.id
      WHERE q.id = ${questionId}
        AND (
          -- Global templates can be edited by any owner/admin
          (t.is_global = true AND EXISTS (
            SELECT 1 FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE u.clerk_user_id = ${authResult.userId}
              AND om.role IN ('owner', 'admin')
          ))
          -- Organization-specific templates can only be edited by that org's owner/admin
          OR (t.is_global = false AND EXISTS (
            SELECT 1 FROM organizations o
            JOIN organization_members om ON o.id = om.organization_id
            JOIN users u ON om.user_id = u.id
            WHERE t.organization_id = o.id
              AND u.clerk_user_id = ${authResult.userId}
              AND om.role IN ('owner', 'admin')
          ))
        )
    `
    console.log('[updateQuestion] Full access check result:', accessCheck)

    if (accessCheck.length === 0) {
      console.error('[updateQuestion] Access check failed - no access for user')
      throw new Error('Not found or access denied')
    }
    console.log('[updateQuestion] Access check passed')

    // Update fields one by one
    if (updates.question_text !== undefined) {
      console.log('[updateQuestion] Updating question_text:', updates.question_text)
      await sql`UPDATE completion_form_template_questions SET question_text = ${updates.question_text}, updated_at = NOW() WHERE id = ${questionId}`
    }

    if (updates.field_type !== undefined) {
      console.log('[updateQuestion] Updating field_type:', updates.field_type)
      await sql`UPDATE completion_form_template_questions SET field_type = ${updates.field_type}, updated_at = NOW() WHERE id = ${questionId}`
    }

    if (updates.is_required !== undefined) {
      console.log('[updateQuestion] Updating is_required:', updates.is_required)
      await sql`UPDATE completion_form_template_questions SET is_required = ${updates.is_required}, updated_at = NOW() WHERE id = ${questionId}`
    }

    if (updates.help_text !== undefined) {
      console.log('[updateQuestion] Updating help_text:', updates.help_text)
      await sql`UPDATE completion_form_template_questions SET help_text = ${updates.help_text}, updated_at = NOW() WHERE id = ${questionId}`
    }

    // Get the updated question
    console.log('[updateQuestion] Fetching updated question')
    const result = await sql`
      SELECT * FROM completion_form_template_questions WHERE id = ${questionId}
    `

    if (result.length === 0) {
      console.error('[updateQuestion] Question not found after update')
      throw new Error('Question not found after update')
    }

    console.log('[updateQuestion] Revalidating path')
    revalidatePath('/dashboard/form-builder')

    console.log('[updateQuestion] Success, returning question')
    return result[0]
  } catch (error) {
    console.error('[updateQuestion] Error occurred:', error)
    console.error('[updateQuestion] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

export async function updateAnswerOptions(
  questionId: string,
  answerOptions: Array<{ id: string; text: string; value: string; option_order: number }>
) {
  try {
    console.log('[updateAnswerOptions] Starting with questionId:', questionId, 'answerOptions:', answerOptions)

    const authResult = await auth()
    if (!authResult.userId) {
      console.error('[updateAnswerOptions] No userId from auth')
      throw new Error('Unauthorized')
    }
    console.log('[updateAnswerOptions] Auth successful, userId:', authResult.userId)

    const sql = neon(process.env.DATABASE_URL!)

    console.log('[updateAnswerOptions] Checking access for question:', questionId)
    // Check if template is global or user has access to organization-specific template
    const accessCheck = await sql`
      SELECT q.id
      FROM completion_form_template_questions q
      JOIN completion_form_template_groups g ON q.group_id = g.id
      JOIN completion_form_templates t ON g.template_id = t.id
      WHERE q.id = ${questionId}
        AND (
          -- Global templates can be edited by any owner/admin
          (t.is_global = true AND EXISTS (
            SELECT 1 FROM organization_members om
            JOIN users u ON om.user_id = u.id
            WHERE u.clerk_user_id = ${authResult.userId}
              AND om.role IN ('owner', 'admin')
          ))
          -- Organization-specific templates can only be edited by that org's owner/admin
          OR (t.is_global = false AND EXISTS (
            SELECT 1 FROM organizations o
            JOIN organization_members om ON o.id = om.organization_id
            JOIN users u ON om.user_id = u.id
            WHERE t.organization_id = o.id
              AND u.clerk_user_id = ${authResult.userId}
              AND om.role IN ('owner', 'admin')
          ))
        )
    `

    if (accessCheck.length === 0) {
      console.error('[updateAnswerOptions] Access check failed - no access for user')
      throw new Error('Not found or access denied')
    }
    console.log('[updateAnswerOptions] Access check passed')

    const formattedOptions = answerOptions.map((option, index) => ({
      id: option.id && !option.id.startsWith('temp-') ? option.id : `option-${index + 1}`,
      text: option.text,
      value: option.value || option.text,
      option_order: index + 1,
    }))
    console.log('[updateAnswerOptions] Formatted options:', formattedOptions)

    console.log('[updateAnswerOptions] Updating database with JSON:', JSON.stringify(formattedOptions))
    await sql`
      UPDATE completion_form_template_questions
      SET answer_options = ${JSON.stringify(formattedOptions)},
          updated_at = NOW()
      WHERE id = ${questionId}
    `

    console.log('[updateAnswerOptions] Revalidating path')
    revalidatePath('/dashboard/form-builder')

    console.log('[updateAnswerOptions] Success, returning formatted options')
    return formattedOptions
  } catch (error) {
    console.error('[updateAnswerOptions] Error occurred:', error)
    console.error('[updateAnswerOptions] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}
