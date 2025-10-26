import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { sendEmail } from '@/lib/email/ses'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function GET(req: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const today = new Date()
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(today.getDate() + 30)

    const ninetyDaysFromNow = new Date(today)
    ninetyDaysFromNow.setDate(today.getDate() + 90)

    // Find all documents expiring in the next 30 days or already expired
    const expiringDocs = await sql`
      SELECT
        ud.id,
        ud.user_id,
        ud.document_type,
        ud.title,
        ud.expiry_date,
        ud.document_number,
        u.full_name,
        u.email,
        om.organization_id,
        o.name as organization_name
      FROM user_documents ud
      JOIN users u ON u.id = ud.user_id
      JOIN organization_members om ON om.user_id = u.id
      JOIN organizations o ON o.id = om.organization_id
      WHERE ud.expiry_date IS NOT NULL
      AND ud.expiry_date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}
      AND om.status = 'active'
      ORDER BY ud.expiry_date ASC
    `

    const emailsSent = []
    const errors = []

    // Group documents by user
    const userDocs = expiringDocs.reduce((acc: any, doc: any) => {
      if (!acc[doc.user_id]) {
        acc[doc.user_id] = {
          user: {
            full_name: doc.full_name,
            email: doc.email,
            organization_name: doc.organization_name,
          },
          documents: [],
        }
      }
      acc[doc.user_id].documents.push(doc)
      return acc
    }, {})

    // Send emails to each user
    for (const userId in userDocs) {
      const { user, documents } = userDocs[userId]

      try {
        const expiredDocs = documents.filter((d: any) => new Date(d.expiry_date) < today)
        const expiringSoonDocs = documents.filter((d: any) => {
          const expiryDate = new Date(d.expiry_date)
          return expiryDate >= today && expiryDate <= thirtyDaysFromNow
        })

        const documentsList = documents
          .map((doc: any) => {
            const expiryDate = new Date(doc.expiry_date)
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const status = daysUntilExpiry < 0 ? '🔴 EXPIRED' : `⚠️ Expires in ${daysUntilExpiry} days`

            return `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                  <strong>${doc.title}</strong><br>
                  <span style="color: #6b7280; font-size: 14px;">${doc.document_number || 'No number'}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                  ${new Date(doc.expiry_date).toLocaleDateString()}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: ${daysUntilExpiry < 0 ? '#dc2626' : '#f59e0b'}; font-weight: 600;">
                    ${status}
                  </span>
                </td>
              </tr>
            `
          })
          .join('')

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              table { width: 100%; background-color: white; border-radius: 6px; margin: 20px 0; border-collapse: collapse; }
              th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .alert-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Document Expiry Alert</h1>
              </div>
              <div class="content">
                <h2>Hi ${user.full_name},</h2>
                <p>This is a reminder that you have compliance documents that are expiring soon or have already expired.</p>

                ${expiredDocs.length > 0 ? `
                  <div class="alert-box">
                    <strong>🔴 ${expiredDocs.length} document(s) have EXPIRED</strong>
                    <p style="margin: 8px 0 0 0;">These documents are no longer valid and must be renewed immediately.</p>
                  </div>
                ` : ''}

                ${expiringSoonDocs.length > 0 ? `
                  <div class="alert-box" style="background-color: #fef3c7; border-left-color: #f59e0b;">
                    <strong>⚠️ ${expiringSoonDocs.length} document(s) expiring within 30 days</strong>
                    <p style="margin: 8px 0 0 0;">Please renew these documents as soon as possible.</p>
                  </div>
                ` : ''}

                <h3>Document Details:</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${documentsList}
                  </tbody>
                </table>

                <p>
                  <strong>Action Required:</strong><br>
                  Please upload updated versions of these documents to maintain your compliance status.
                </p>

                <div style="text-align: center;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/compliance" class="button">
                    Update Documents
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  This is an automated reminder from ${user.organization_name}.
                  If you have already renewed these documents, please upload the updated versions to avoid future alerts.
                </p>
              </div>
            </div>
          </body>
          </html>
        `

        const emailText = `
Hi ${user.full_name},

This is a reminder that you have compliance documents that are expiring soon or have already expired.

${expiredDocs.length > 0 ? `
⚠️ ${expiredDocs.length} document(s) have EXPIRED
These documents are no longer valid and must be renewed immediately.
` : ''}

${expiringSoonDocs.length > 0 ? `
⚠️ ${expiringSoonDocs.length} document(s) expiring within 30 days
Please renew these documents as soon as possible.
` : ''}

Document Details:
${documents.map((doc: any) => {
  const expiryDate = new Date(doc.expiry_date)
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return `- ${doc.title}: Expires ${expiryDate.toLocaleDateString()} (${daysUntilExpiry < 0 ? 'EXPIRED' : `${daysUntilExpiry} days`})`
}).join('\n')}

Please update your documents at: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/compliance

This is an automated reminder from ${user.organization_name}.
        `

        await sendEmail({
          to: user.email,
          from: process.env.DEFAULT_FROM_EMAIL || 'hello@taskforce.com.au',
          subject: `⚠️ Document Expiry Alert - ${expiredDocs.length > 0 ? 'Action Required' : 'Expiring Soon'}`,
          htmlBody: emailHtml,
          textBody: emailText,
        })

        emailsSent.push({
          email: user.email,
          documents: documents.length,
          expired: expiredDocs.length,
          expiring_soon: expiringSoonDocs.length,
        })
      } catch (error) {
        console.error(`Error sending email to ${user.email}:`, error)
        errors.push({
          email: user.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Also notify organization owners/admins about team member expiring documents
    const ownerNotifications = await sql`
      SELECT DISTINCT
        u.id,
        u.full_name,
        u.email,
        om.organization_id,
        o.name as organization_name
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.role IN ('owner', 'admin')
      AND om.status = 'active'
      AND om.organization_id IN (
        SELECT DISTINCT om2.organization_id
        FROM user_documents ud
        JOIN users u2 ON u2.id = ud.user_id
        JOIN organization_members om2 ON om2.user_id = u2.id
        WHERE ud.expiry_date IS NOT NULL
        AND ud.expiry_date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}
      )
    `

    for (const owner of ownerNotifications) {
      try {
        // Get all expiring documents for this organization
        const orgExpiringDocs = await sql`
          SELECT
            ud.id,
            ud.title,
            ud.expiry_date,
            ud.document_type,
            u.full_name as team_member_name
          FROM user_documents ud
          JOIN users u ON u.id = ud.user_id
          JOIN organization_members om ON om.user_id = u.id
          WHERE om.organization_id = ${owner.organization_id}
          AND ud.expiry_date IS NOT NULL
          AND ud.expiry_date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}
          AND om.status = 'active'
          ORDER BY ud.expiry_date ASC
        `

        if (orgExpiringDocs.length === 0) continue

        const orgExpiredCount = orgExpiringDocs.filter((d: any) => new Date(d.expiry_date) < today).length
        const orgExpiringSoonCount = orgExpiringDocs.length - orgExpiredCount

        const ownerEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .stat-box { background-color: white; padding: 20px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #2563eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📋 Team Compliance Alert</h1>
              </div>
              <div class="content">
                <h2>Hi ${owner.full_name},</h2>
                <p>This is your daily compliance summary for <strong>${owner.organization_name}</strong>.</p>

                <div class="stat-box">
                  <h3 style="margin: 0 0 10px 0; color: #dc2626;">🔴 ${orgExpiredCount} Expired Document(s)</h3>
                  <h3 style="margin: 0; color: #f59e0b;">⚠️ ${orgExpiringSoonCount} Expiring Soon</h3>
                </div>

                <p>
                  Some team members have compliance documents that require attention.
                  Please review the team compliance dashboard to see details.
                </p>

                <div style="text-align: center;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team/compliance" class="button">
                    View Team Compliance
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  This is an automated daily summary. Team members have been notified directly about their expiring documents.
                </p>
              </div>
            </div>
          </body>
          </html>
        `

        await sendEmail({
          to: owner.email,
          from: process.env.DEFAULT_FROM_EMAIL || 'hello@taskforce.com.au',
          subject: `📋 Team Compliance Alert - ${orgExpiredCount + orgExpiringSoonCount} Document(s) Need Attention`,
          htmlBody: ownerEmailHtml,
          textBody: `Hi ${owner.full_name},\n\nDaily compliance summary for ${owner.organization_name}:\n\n🔴 ${orgExpiredCount} Expired Documents\n⚠️ ${orgExpiringSoonCount} Expiring Soon\n\nView details: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team/compliance`,
        })

        emailsSent.push({
          email: owner.email,
          type: 'owner_summary',
          documents: orgExpiringDocs.length,
        })
      } catch (error) {
        console.error(`Error sending owner notification to ${owner.email}:`, error)
        errors.push({
          email: owner.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent: emailsSent.length,
      errors: errors.length,
      details: {
        emailsSent,
        errors,
      },
    })
  } catch (error) {
    console.error('Error in document expiry cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
