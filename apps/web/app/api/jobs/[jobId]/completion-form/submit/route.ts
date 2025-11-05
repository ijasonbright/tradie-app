import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

/**
 * PUT /api/jobs/:jobId/completion-form/submit
 *
 * Submit completion form (finalize)
 * Changes status from draft to submitted
 * Sets completion_date
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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
    const jobId = params.jobId

    // Get user's organization
    const userOrgs = await sql`
      SELECT om.organization_id, u.id as user_id
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

    // Verify job belongs to organization
    const jobs = await sql`
      SELECT id, organization_id
      FROM jobs
      WHERE id = ${jobId}
      AND organization_id = ${organizationId}
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get existing form
    const forms = await sql`
      SELECT id, status, form_data, template_id
      FROM job_completion_forms
      WHERE job_id = ${jobId}
      LIMIT 1
    `

    if (forms.length === 0) {
      return NextResponse.json({ error: 'Completion form not found' }, { status: 404 })
    }

    const form = forms[0]

    if (form.status === 'submitted') {
      return NextResponse.json({ error: 'Form already submitted' }, { status: 400 })
    }

    // Submit the form
    const submitted = await sql`
      UPDATE job_completion_forms
      SET
        status = 'submitted',
        completion_date = NOW(),
        updated_at = NOW()
      WHERE id = ${form.id}
      RETURNING *
    `

    // Get template questions to create normalized answers
    const questions = await sql`
      SELECT
        id,
        question_text,
        field_type,
        answer_options,
        csv_question_id
      FROM completion_form_template_questions
      WHERE template_id = ${form.template_id}
    `

    // Create normalized answer rows (for SQL Server compatibility)
    const formData = form.form_data
    const answerInserts = []

    for (const question of questions) {
      const questionId = question.id
      const answer = formData[questionId]

      if (answer !== null && answer !== undefined && answer !== '') {
        // Handle different field types
        if (Array.isArray(answer)) {
          // Multi-select - create one row per selection
          for (const value of answer) {
            answerInserts.push(sql`
              INSERT INTO job_completion_form_answers (
                completion_form_id,
                organization_id,
                job_id,
                question_id,
                value,
                csv_question_id,
                created_at,
                updated_at
              ) VALUES (
                ${form.id},
                ${organizationId},
                ${jobId},
                ${questionId},
                ${String(value)},
                ${question.csv_question_id || null},
                NOW(),
                NOW()
              )
            `)
          }
        } else if (question.field_type === 'number') {
          // Numeric answer
          const numValue = parseInt(String(answer), 10)
          answerInserts.push(sql`
            INSERT INTO job_completion_form_answers (
              completion_form_id,
              organization_id,
              job_id,
              question_id,
              value,
              value_numeric,
              csv_question_id,
              created_at,
              updated_at
            ) VALUES (
              ${form.id},
              ${organizationId},
              ${jobId},
              ${questionId},
              ${String(answer)},
              ${numValue},
              ${question.csv_question_id || null},
              NOW(),
              NOW()
            )
          `)
        } else if (question.field_type === 'file') {
          // File upload - extract file info from URL
          const fileUrl = String(answer)
          const fileName = fileUrl.split('/').pop() || 'file'
          answerInserts.push(sql`
            INSERT INTO job_completion_form_answers (
              completion_form_id,
              organization_id,
              job_id,
              question_id,
              value,
              file_path,
              file_name,
              csv_question_id,
              created_at,
              updated_at
            ) VALUES (
              ${form.id},
              ${organizationId},
              ${jobId},
              ${questionId},
              ${fileName},
              ${fileUrl},
              ${fileName},
              ${question.csv_question_id || null},
              NOW(),
              NOW()
            )
          `)
        } else {
          // Text/other answers
          answerInserts.push(sql`
            INSERT INTO job_completion_form_answers (
              completion_form_id,
              organization_id,
              job_id,
              question_id,
              value,
              csv_question_id,
              created_at,
              updated_at
            ) VALUES (
              ${form.id},
              ${organizationId},
              ${jobId},
              ${questionId},
              ${String(answer)},
              ${question.csv_question_id || null},
              NOW(),
              NOW()
            )
          `)
        }
      }
    }

    // Execute all answer inserts
    if (answerInserts.length > 0) {
      await Promise.all(answerInserts)
    }

    return NextResponse.json({
      form: submitted[0],
      answers_created: answerInserts.length,
      message: 'Form submitted successfully',
    })
  } catch (error) {
    console.error('Error submitting completion form:', error)
    return NextResponse.json(
      { error: 'Failed to submit completion form', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
