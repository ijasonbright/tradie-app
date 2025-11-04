import { db } from '@tradie-app/database'
import { organizations } from '@tradie-app/database'
import { eq } from 'drizzle-orm'
import { generateStatementPdf } from './generate-statement-pdf'

interface SendStatementEmailParams {
  client: any
  invoices: any[]
  organizationId: string
  totalOutstanding: number
}

/**
 * Send monthly statement email with PDF attachment to client
 */
export async function sendStatementEmail({
  client,
  invoices,
  organizationId,
  totalOutstanding,
}: SendStatementEmailParams) {
  // Get organization details
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)
    .then(rows => rows[0])

  if (!org) {
    throw new Error('Organization not found')
  }

  if (!client.email) {
    throw new Error('Client has no email address')
  }

  // Generate statement period (current month)
  const today = new Date()
  const statementMonth = today.toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  })

  // Calculate aging buckets
  const aging = calculateAging(invoices)

  // Generate PDF
  const pdfBuffer = await generateStatementPdf({
    client,
    invoices,
    organization: org,
    totalOutstanding,
    aging,
    statementDate: today,
  })

  // Build email subject and body
  const subject = `Monthly Statement - ${statementMonth} - ${org.name}`

  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${org.primaryColor || '#1E40AF'}; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .summary { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid ${org.primaryColor || '#1E40AF'}; }
    .amount { font-size: 24px; font-weight: bold; color: ${totalOutstanding > 0 ? '#DC2626' : '#059669'}; }
    .aging-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .aging-table th { background-color: #f3f4f6; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
    .aging-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .button { display: inline-block; background-color: ${org.primaryColor || '#1E40AF'}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${org.logoUrl ? `<img src="${org.logoUrl}" alt="${org.name}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
      <h1>Monthly Statement</h1>
      <p>${statementMonth}</p>
    </div>

    <div class="content">
      <p>Hi ${client.firstName || client.companyName || 'there'},</p>

      <p>Please find attached your monthly statement for ${statementMonth}.</p>

      <div class="summary">
        <h3>Account Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;"><strong>Total Invoices:</strong></td>
            <td style="padding: 8px 0;">${invoices.length}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Outstanding Invoices:</strong></td>
            <td style="padding: 8px 0;">${invoices.filter(inv => inv.status !== 'paid').length}</td>
          </tr>
          <tr style="border-top: 2px solid #ddd;">
            <td style="padding: 12px 0 0 0;"><strong>Total Outstanding:</strong></td>
            <td style="padding: 12px 0 0 0;"><span class="amount">$${totalOutstanding.toFixed(2)}</span></td>
          </tr>
        </table>

        ${totalOutstanding > 0 ? `
        <h4 style="margin-top: 20px; margin-bottom: 10px;">Aging Summary</h4>
        <table class="aging-table">
          <thead>
            <tr>
              <th>Period</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Current</td>
              <td style="text-align: right;">$${aging.current.toFixed(2)}</td>
            </tr>
            <tr>
              <td>1-30 days</td>
              <td style="text-align: right;">$${aging.days30.toFixed(2)}</td>
            </tr>
            <tr>
              <td>31-60 days</td>
              <td style="text-align: right;">$${aging.days60.toFixed(2)}</td>
            </tr>
            <tr>
              <td>61-90 days</td>
              <td style="text-align: right;">$${aging.days90.toFixed(2)}</td>
            </tr>
            <tr>
              <td>90+ days</td>
              <td style="text-align: right; color: #DC2626; font-weight: bold;">$${aging.days90Plus.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}
      </div>

      ${totalOutstanding > 0 && org.bankAccountNumber ? `
      <div style="margin-top: 30px; padding: 20px; background-color: white; border-radius: 5px;">
        <h3 style="margin-top: 0;">Payment Details</h3>
        <p style="margin: 5px 0;"><strong>Account Name:</strong> ${org.bankAccountName || org.name}</p>
        <p style="margin: 5px 0;"><strong>BSB:</strong> ${org.bankBsb}</p>
        <p style="margin: 5px 0;"><strong>Account Number:</strong> ${org.bankAccountNumber}</p>
        <p style="margin: 5px 0; color: #666; font-size: 14px;"><em>Please use your invoice number as reference</em></p>
      </div>
      ` : ''}

      <p style="margin-top: 30px;">If you have any questions or concerns regarding this statement, please don't hesitate to contact us.</p>

      <p>Thank you for your continued business!</p>

      <p><strong>${org.name}</strong><br>
      ${org.phone ? `Phone: ${org.phone}<br>` : ''}
      ${org.email ? `Email: ${org.email}` : ''}</p>
    </div>

    <div class="footer">
      <p>This is an automated statement from ${org.name}</p>
      <p>A detailed PDF statement is attached to this email</p>
    </div>
  </div>
</body>
</html>
`

  // TODO: Integrate with your email service (Resend, SendGrid, etc.)
  console.log('[Email] Sending monthly statement email:', {
    to: client.email,
    subject,
    organizationId,
    clientId: client.id,
    invoiceCount: invoices.length,
    totalOutstanding,
  })

  // Example integration with Resend:
  /*
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: `${org.name} <statements@yourdomain.com>`,
    to: client.email,
    subject,
    html: body,
    attachments: [
      {
        filename: `Statement-${statementMonth.replace(' ', '-')}-${client.companyName || client.lastName || 'Client'}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
  */

  return { success: true }
}

/**
 * Calculate aging buckets for outstanding invoices
 */
function calculateAging(invoices: any[]) {
  const today = new Date()
  const aging = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    days90Plus: 0,
  }

  for (const invoice of invoices) {
    // Only count unpaid/partially paid invoices
    if (invoice.status === 'paid') {
      continue
    }

    const totalAmount = parseFloat(invoice.totalAmount)
    const paidAmount = parseFloat(invoice.paidAmount || '0')
    const outstanding = totalAmount - paidAmount

    if (outstanding <= 0) {
      continue
    }

    const dueDate = new Date(invoice.dueDate)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysOverdue < 0) {
      // Not yet due - current
      aging.current += outstanding
    } else if (daysOverdue <= 30) {
      aging.days30 += outstanding
    } else if (daysOverdue <= 60) {
      aging.days60 += outstanding
    } else if (daysOverdue <= 90) {
      aging.days90 += outstanding
    } else {
      aging.days90Plus += outstanding
    }
  }

  return aging
}
