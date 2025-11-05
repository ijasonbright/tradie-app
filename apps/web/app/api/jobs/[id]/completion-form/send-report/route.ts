import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { auth } from '@clerk/nextjs/server'
import { sendEmail } from '@/lib/email/ses'
import { generateCompletionFormPDF } from '@/lib/pdf-generator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
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

    // Get optional custom message and recipient from request body
    const body = await request.json().catch(() => ({}))
    const customMessage = body.message || ''
    const recipientEmail = body.recipient_email || null

    // Fetch the completion form with all related data
    const forms = await sql`
      SELECT jcf.*, cft.name as template_name, cft.description as template_description
      FROM job_completion_forms jcf
      JOIN completion_form_templates cft ON jcf.template_id = cft.id
      WHERE jcf.job_id = ${jobId}
      AND jcf.status = 'submitted'
      LIMIT 1
    `

    if (forms.length === 0) {
      return NextResponse.json({ error: 'No submitted completion form found' }, { status: 404 })
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

    // Determine recipient email
    const toEmail = recipientEmail || job.client_email
    if (!toEmail) {
      return NextResponse.json({ error: 'No email address available for client' }, { status: 400 })
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
          const answer = form.form_data?.[q.id] || null
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

    console.log('[Email Report] Generating PDF for job:', jobId)

    // Generate PDF
    const pdfBuffer = await generateCompletionFormPDF(pdfData)

    console.log('[Email Report] PDF generated, size:', pdfBuffer.length, 'bytes')

    // Prepare email content
    const clientName = job.company_name || `${job.first_name} ${job.last_name}`
    const completedDate = new Date(form.completed_at || form.updated_at).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Completion Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    ${job.logo_url ? `<img src="${job.logo_url}" alt="${job.org_name}" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` : ''}
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Job Completion Report</h1>
    <p style="margin: 10px 0 0; opacity: 0.9; font-size: 14px;">Job #${job.job_number}</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${clientName},</p>

    ${customMessage ? `<p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 4px;">${customMessage}</p>` : ''}

    <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
      We're pleased to inform you that the work for <strong>${job.title}</strong> has been completed on ${completedDate}.
    </p>

    <p style="font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
      Attached to this email, you'll find a detailed completion report that includes:
    </p>

    <ul style="font-size: 14px; line-height: 1.8; margin-bottom: 25px; padding-left: 20px;">
      <li>Comprehensive inspection details</li>
      <li>Photos of the completed work</li>
      <li>Technical specifications and findings</li>
      <li>Technician signature and notes</li>
    </ul>

    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h2 style="margin: 0 0 15px; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Job Summary</h2>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 40%;">Job Number:</td>
          <td style="padding: 8px 0; font-weight: 600;">${job.job_number}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Completed:</td>
          <td style="padding: 8px 0; font-weight: 600;">${completedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Technician:</td>
          <td style="padding: 8px 0; font-weight: 600;">${completedBy.full_name}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
      If you have any questions about this report or need clarification on any aspect of the work performed, please don't hesitate to contact us.
    </p>

    <p style="font-size: 14px; line-height: 1.6; margin-bottom: 5px;">
      Best regards,<br>
      <strong>${job.org_name}</strong>
    </p>

    ${job.org_phone ? `<p style="font-size: 13px; color: #666; margin: 5px 0;">Phone: ${job.org_phone}</p>` : ''}
    ${job.org_email ? `<p style="font-size: 13px; color: #666; margin: 5px 0;">Email: ${job.org_email}</p>` : ''}
  </div>

  <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
    <p style="margin: 0;">This is an automated email from ${job.org_name}</p>
  </div>
</body>
</html>
    `

    console.log('[Email Report] Sending email to:', toEmail)

    // Prepare from email (use verified SES email)
    const fromEmail = 'hello@taskforce.com.au'

    // Send email with PDF attachment using AWS SES
    await sendEmail({
      from: fromEmail,
      to: toEmail,
      subject: `Job Completion Report - ${job.title} (${job.job_number})`,
      htmlBody: emailHtml,
      attachments: [
        {
          filename: `completion-report-${job.job_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })

    console.log('[Email Report] Email sent successfully via AWS SES')

    // Update form to track that report was sent
    await sql`
      UPDATE job_completion_forms
      SET report_sent_at = NOW(),
          report_sent_to = ${toEmail}
      WHERE id = ${form.id}
    `

    return NextResponse.json({
      success: true,
      message: `Completion report sent to ${toEmail}`,
    })
  } catch (error) {
    console.error('[Email Report] Error sending report:', error)
    return NextResponse.json(
      {
        error: 'Failed to send completion report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
