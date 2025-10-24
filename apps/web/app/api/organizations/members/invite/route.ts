import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { randomBytes } from 'crypto'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// Initialize SES client only if credentials are available
const getSESClient = () => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return null
  }
  return new SESClient({
    region: process.env.AWS_REGION || 'ap-southeast-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      email,
      full_name,
      phone,
      role,
      employment_type,
      primary_trade_id,
      hourly_rate,
      billing_rate,
      can_create_jobs,
      can_edit_all_jobs,
      can_create_invoices,
      can_view_financials,
      can_approve_expenses,
      can_approve_timesheets,
      requires_trade_license,
      requires_police_check,
      requires_working_with_children,
      requires_public_liability,
    } = body

    // Get user's organization
    const userOrgs = await sql`
      SELECT om.organization_id, om.role, o.name as organization_name
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = (
        SELECT id FROM users WHERE clerk_user_id = ${userId}
      )
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
    `

    if (!userOrgs || userOrgs.length === 0) {
      return NextResponse.json(
        { error: 'No organization found or insufficient permissions' },
        { status: 403 }
      )
    }

    const orgId = userOrgs[0].organization_id
    const organizationName = userOrgs[0].organization_name

    // Check if email already exists in this organization
    const existingMember = await sql`
      SELECT om.id
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId}
      AND u.email = ${email}
    `

    if (existingMember && existingMember.length > 0) {
      return NextResponse.json(
        { error: 'A team member with this email already exists' },
        { status: 400 }
      )
    }

    // Generate invitation token
    const invitationToken = randomBytes(32).toString('hex')

    // Create user record first (if doesn't exist)
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email}
    `

    let user_id
    if (existingUser && existingUser.length > 0) {
      user_id = existingUser[0].id
    } else {
      // Create new user
      const newUser = await sql`
        INSERT INTO users (email, full_name, phone)
        VALUES (${email}, ${full_name}, ${phone || null})
        RETURNING id
      `
      user_id = newUser[0].id
    }

    // Create organization member record with invitation
    const member = await sql`
      INSERT INTO organization_members (
        organization_id,
        user_id,
        role,
        status,
        employment_type,
        primary_trade_id,
        hourly_rate,
        billing_rate,
        invitation_token,
        invitation_sent_at,
        can_create_jobs,
        can_edit_all_jobs,
        can_create_invoices,
        can_view_financials,
        can_approve_expenses,
        can_approve_timesheets
      )
      VALUES (
        ${orgId},
        ${user_id},
        ${role},
        'invited',
        ${employment_type || null},
        ${primary_trade_id || null},
        ${hourly_rate || null},
        ${billing_rate || null},
        ${invitationToken},
        NOW(),
        ${can_create_jobs || false},
        ${can_edit_all_jobs || false},
        ${can_create_invoices || false},
        ${can_view_financials || false},
        ${can_approve_expenses || false},
        ${can_approve_timesheets || false}
      )
      RETURNING id
    `

    // Store compliance requirements (we'll create a separate table for this)
    // For now, we'll store it in a JSON field or separate table
    // TODO: Create compliance_requirements table if needed

    // Send invitation email via AWS SES
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation/${invitationToken}`

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .details { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You've Been Invited!</h1>
          </div>
          <div class="content">
            <p>Hi ${full_name},</p>
            <p>You've been invited to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.</p>

            <div class="details">
              <h3>What's Next?</h3>
              <ol>
                <li>Click the button below to accept your invitation</li>
                <li>Complete your profile information</li>
                <li>Upload required compliance documents</li>
                <li>Start collaborating with the team!</li>
              </ol>
            </div>

            <div style="text-align: center;">
              <a href="${invitationUrl}" class="button">Accept Invitation</a>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const emailText = `
      You've Been Invited to ${organizationName}!

      Hi ${full_name},

      You've been invited to join ${organizationName} as a ${role}.

      To accept your invitation, please visit:
      ${invitationUrl}

      What's next?
      1. Click the link above to accept your invitation
      2. Complete your profile information
      3. Upload required compliance documents
      4. Start collaborating with the team!

      This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.

      © ${new Date().getFullYear()} ${organizationName}. All rights reserved.
    `

    // Send email if SES is configured
    const sesClient = getSESClient()
    if (sesClient) {
      try {
        const sendEmailCommand = new SendEmailCommand({
          Source: process.env.AWS_SES_FROM_EMAIL || 'noreply@tradie-app.com',
          Destination: {
            ToAddresses: [email],
          },
          Message: {
            Subject: {
              Data: `You've been invited to join ${organizationName}`,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: emailHtml,
                Charset: 'UTF-8',
              },
              Text: {
                Data: emailText,
                Charset: 'UTF-8',
              },
            },
          },
        })

        await sesClient.send(sendEmailCommand)
      } catch (emailError) {
        console.error('Error sending email:', emailError)
        // Continue anyway - invitation is created, just email failed
      }
    } else {
      console.warn('AWS SES not configured - invitation created but email not sent')
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      member_id: member[0].id,
    })
  } catch (error) {
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}
