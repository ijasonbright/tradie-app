import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { extractApiKeyFromHeader, verifyApiKey, hasPermission } from '@/lib/api/api-key-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/tradieconnect/jobs/:tcJobId/completion-form/answers
 *
 * Returns all answers for a TC job completion form, mapped with csv_question_id
 * for syncing back to TradieConnect.
 *
 * Authentication (supports all three methods):
 * 1. API Key (for TradieConnect integration) - "Bearer tc_api_xxx" or "Bearer ta_xxx"
 *    Required permission: tc_completion_forms.read or completion_forms.read
 * 2. Clerk (web dashboard)
 * 3. JWT (mobile app)
 *
 * Response format:
 * {
 *   tc_job_id: "283294",
 *   tc_job_code: "TC-283294",
 *   form_status: "draft" | "submitted",
 *   template_name: "Rentsafe Inspection New",
 *   completed_at: "2025-01-15T10:30:00Z",
 *   answers: [
 *     {
 *       csv_question_id: 583,
 *       question_id: "uuid",
 *       question_text: "Was the smoke alarm tested?",
 *       field_type: "radio",
 *       value: "Yes",
 *       group_number: 1,
 *       group_name: "Safety Checks",
 *       sort_order: 1
 *     },
 *     ...
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tcJobId } = await params
    const sql = neon(process.env.DATABASE_URL!)
    let organizationId: string | null = null

    const authHeader = request.headers.get('authorization')

    // Try API Key authentication first (for TradieConnect integration)
    const apiKey = extractApiKeyFromHeader(authHeader)

    if (apiKey) {
      const apiKeyPayload = await verifyApiKey(apiKey)
      if (apiKeyPayload) {
        // Check for required permission
        if (!hasPermission(apiKeyPayload, 'tc_completion_forms.read') &&
            !hasPermission(apiKeyPayload, 'completion_forms.read')) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'Missing required permission: tc_completion_forms.read' },
            { status: 403 }
          )
        }
        organizationId = apiKeyPayload.organizationId
      }
    }

    // If no API key auth, try Clerk (web) + JWT (mobile)
    if (!organizationId) {
      let clerkUserId: string | null = null

      try {
        const authResult = await auth()
        clerkUserId = authResult.userId
      } catch (error) {
        // Clerk auth failed, try JWT
      }

      if (!clerkUserId) {
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

      // Get user and organization
      const users = await sql`
        SELECT u.id, om.organization_id
        FROM users u
        JOIN organization_members om ON u.id = om.user_id
        WHERE u.clerk_user_id = ${clerkUserId}
        LIMIT 1
      `

      if (users.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      organizationId = users[0].organization_id
    }

    // Get the completion form for this TC job
    const forms = await sql`
      SELECT
        jcf.id,
        jcf.template_id,
        jcf.form_data,
        jcf.status,
        jcf.completion_date,
        jcf.created_at,
        jcf.updated_at,
        cft.name as template_name
      FROM job_completion_forms jcf
      JOIN completion_form_templates cft ON jcf.template_id = cft.id
      WHERE jcf.organization_id = ${organizationId}
      AND jcf.form_data->>'tc_job_id' = ${tcJobId}
      ORDER BY jcf.created_at DESC
      LIMIT 1
    `

    if (forms.length === 0) {
      return NextResponse.json({
        error: 'Completion form not found for this TC job',
        tc_job_id: tcJobId
      }, { status: 404 })
    }

    const form = forms[0]
    const formData = form.form_data || {}
    const templateId = form.template_id

    // Get all questions for this template with their groups
    const questions = await sql`
      SELECT
        q.id as question_id,
        q.question_text,
        q.field_type,
        q.csv_question_id,
        q.sort_order as question_sort_order,
        q.answer_options,
        g.id as group_id,
        g.name as group_name,
        g.sort_order as group_sort_order,
        g.csv_group_id as group_number
      FROM completion_form_template_questions q
      JOIN completion_form_template_groups g ON q.group_id = g.id
      WHERE q.template_id = ${templateId}
      ORDER BY g.sort_order, q.sort_order
    `

    // Get photo metadata for file fields
    const photos = await sql`
      SELECT
        p.id,
        p.question_id,
        p.photo_url,
        p.caption,
        p.photo_type,
        p.uploaded_at,
        u.full_name as uploaded_by_name
      FROM job_completion_form_photos p
      LEFT JOIN users u ON p.uploaded_by_user_id = u.id
      WHERE p.completion_form_id = ${form.id}
      ORDER BY p.uploaded_at ASC
    `

    // Group photos by question_id for easy lookup
    const photosByQuestion: Record<string, any[]> = {}
    for (const photo of photos) {
      if (photo.question_id) {
        if (!photosByQuestion[photo.question_id]) {
          photosByQuestion[photo.question_id] = []
        }
        photosByQuestion[photo.question_id].push({
          url: photo.photo_url,
          caption: photo.caption,
          photo_type: photo.photo_type,
          uploaded_at: photo.uploaded_at,
          uploaded_by: photo.uploaded_by_name,
        })
      }
    }

    // Build the answers array by matching form_data with questions
    const answers = questions
      .filter((q: any) => {
        // Only include questions that have answers
        const value = formData[q.question_id]
        return value !== undefined && value !== null && value !== ''
      })
      .map((q: any) => {
        const value = formData[q.question_id]

        // For dropdown/radio/checkbox, try to get the display text if answer_options exist
        let displayValue = value
        if (q.answer_options && Array.isArray(q.answer_options)) {
          const option = q.answer_options.find((opt: any) => opt.id === value || opt.text === value)
          if (option) {
            displayValue = option.text
          }
        }

        // Base answer object
        const answer: any = {
          csv_question_id: q.csv_question_id,
          question_id: q.question_id,
          question_text: q.question_text,
          field_type: q.field_type,
          value: value,
          display_value: displayValue,
          group_number: q.group_number,
          group_name: q.group_name,
          group_sort_order: q.group_sort_order,
          question_sort_order: q.question_sort_order,
        }

        // For file fields, include photo metadata
        if (q.field_type === 'file') {
          const questionPhotos = photosByQuestion[q.question_id] || []
          answer.photos = questionPhotos
          answer.photo_count = questionPhotos.length
        }

        return answer
      })

    return NextResponse.json({
      tc_job_id: tcJobId,
      tc_job_code: formData.tc_job_code || `TC-${tcJobId}`,
      form_id: form.id,
      form_status: form.status,
      template_id: templateId,
      template_name: form.template_name,
      completed_at: form.completion_date,
      created_at: form.created_at,
      updated_at: form.updated_at,
      answers: answers,
      answer_count: answers.length,
    })
  } catch (error) {
    console.error('Error getting TC job completion form answers:', error)
    return NextResponse.json(
      {
        error: 'Failed to get completion form answers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
