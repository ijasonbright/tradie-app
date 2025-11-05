import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { auth } from '@clerk/nextjs/server'
import { generateCompletionFormPDF } from '@/lib/pdf-generator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for PDF generation

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Dual authentication
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Try JWT
    }

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

    const sql = neon(process.env.DATABASE_URL!)
    const { id: jobId } = await params

    // Fetch the completion form with all related data
    const forms = await sql`
      SELECT jcf.*, cft.name as template_name, cft.description as template_description
      FROM job_completion_forms jcf
      JOIN completion_form_templates cft ON jcf.template_id = cft.id
      WHERE jcf.job_id = ${jobId}
      AND (jcf.status = 'submitted' OR jcf.status = 'sent_to_client')
      LIMIT 1
    `

    if (forms.length === 0) {
      return NextResponse.json({ error: 'No completion form found for this job' }, { status: 404 })
    }

    const form = forms[0]

    // Fetch job details with client and organization
    const jobs = await sql`
      SELECT
        j.*,
        c.company_name, c.first_name, c.last_name, c.email as client_email, c.phone as client_phone,
        o.name as org_name, o.logo_url, o.phone as org_phone, o.email as org_email, o.abn,
        o.address_line1 as org_address_line1, o.address_line2 as org_address_line2,
        o.city as org_city, o.state as org_state, o.postcode as org_postcode
      FROM jobs j
      JOIN clients c ON j.client_id = c.id
      JOIN organizations o ON j.organization_id = o.id
      WHERE j.id = ${jobId}
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Verify access
    const accessCheck = await sql`
      SELECT 1
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE om.organization_id = ${job.organization_id}
      AND u.clerk_user_id = ${clerkUserId}
      AND om.status = 'active'
    `

    if (accessCheck.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch completed by user details
    const completedByUsers = await sql`
      SELECT full_name, email
      FROM users
      WHERE id = ${form.completed_by_user_id}
      LIMIT 1
    `

    const completedBy: { full_name: string; email: string } = (completedByUsers[0] as any) || { full_name: 'Unknown', email: '' }

    // Fetch template structure (groups and questions)
    const groups = await sql`
      SELECT *
      FROM completion_form_template_groups
      WHERE template_id = ${form.template_id}
      ORDER BY sort_order ASC
    `

    const questions = await sql`
      SELECT *
      FROM completion_form_template_questions
      WHERE template_id = ${form.template_id}
      ORDER BY sort_order ASC
    `

    // Fetch photos
    const photos = await sql`
      SELECT photo_url, thumbnail_url, caption, photo_type
      FROM job_photos
      WHERE job_id = ${jobId}
      ORDER BY uploaded_at ASC
    `

    // Build groups with questions and answers
    const groupsWithQuestions = groups.map((group: any) => {
      const groupQuestions = questions.filter((q: any) => q.group_id === group.id)

      return {
        id: group.id,
        group_name: group.name,
        description: group.description,
        questions: groupQuestions.map((q: any) => {
          // Get answer from form_data
          const answer = form.form_data?.[q.id] || null

          // Get photos for this question
          const questionPhotos = photos
            .filter((p: any) => form.form_data?.[`${q.id}_photos`]?.includes(p.photo_url))
            .map((p: any) => ({
              photo_url: p.photo_url,
              caption: p.caption,
            }))

          return {
            id: q.id,
            question_text: q.question_text,
            field_type: q.field_type,
            answer,
            photos: questionPhotos,
          }
        }),
      }
    })

    // Prepare data for PDF generation
    const pdfData = {
      form: {
        id: form.id,
        template_id: form.template_id,
        completed_date: form.completed_at || form.updated_at,
        completed_by_user_id: form.completed_by_user_id,
        form_data: form.form_data,
        client_signature_url: form.client_signature_url,
        technician_signature_url: form.technician_signature_url,
      },
      job: {
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        client_id: job.client_id,
        site_address_line1: job.site_address_line1,
        site_address_line2: job.site_address_line2,
        site_city: job.site_city,
        site_state: job.site_state,
        site_postcode: job.site_postcode,
        completed_at: job.completed_at,
      },
      client: {
        company_name: job.company_name,
        first_name: job.first_name,
        last_name: job.last_name,
        email: job.client_email,
        phone: job.client_phone,
      },
      organization: {
        name: job.org_name,
        logo_url: job.logo_url,
        phone: job.org_phone,
        email: job.org_email,
        abn: job.abn,
        address_line1: job.org_address_line1,
        address_line2: job.org_address_line2,
        city: job.org_city,
        state: job.org_state,
        postcode: job.org_postcode,
      },
      template: {
        name: form.template_name,
        description: form.template_description,
      },
      groups: groupsWithQuestions,
      completedBy,
      photos: photos.map((p: any) => ({
        photo_url: p.photo_url,
        caption: p.caption,
        photo_type: p.photo_type,
      })),
    }

    console.log('[PDF Generation] Starting PDF generation for job:', jobId)

    // Generate PDF
    const pdfBuffer = await generateCompletionFormPDF(pdfData)

    console.log('[PDF Generation] PDF generated successfully, size:', pdfBuffer.length, 'bytes')

    // Return PDF
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="completion-report-${job.job_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[PDF Generation] Error generating PDF:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
