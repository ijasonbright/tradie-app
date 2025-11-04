import { db } from '@tradie-app/database'
import { organizations, reminderHistory } from '@tradie-app/database'
import { eq } from 'drizzle-orm'

interface SendReminderEmailParams {
  invoice: any
  client: any
  organizationId: string
  daysBeforeDue?: number
  daysOverdue?: number
}

/**
 * Send invoice reminder email to client
 */
export async function sendReminderEmail({
  invoice,
  client,
  organizationId,
  daysBeforeDue,
  daysOverdue,
}: SendReminderEmailParams) {
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

  // Calculate outstanding amount
  const totalAmount = parseFloat(invoice.totalAmount)
  const paidAmount = parseFloat(invoice.paidAmount || '0')
  const outstandingAmount = totalAmount - paidAmount

  // Determine due status text
  let dueStatusText = ''
  if (daysBeforeDue) {
    dueStatusText = `due in ${daysBeforeDue} day${daysBeforeDue === 1 ? '' : 's'}`
  } else if (daysOverdue) {
    dueStatusText = `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`
  } else {
    dueStatusText = 'due today'
  }

  // Format dates
  const issueDate = new Date(invoice.issueDate).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Build email subject and body
  const subject = daysOverdue
    ? `Overdue Invoice Reminder: #${invoice.invoiceNumber} - ${org.name}`
    : `Invoice Reminder: #${invoice.invoiceNumber} - ${org.name}`

  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${org.primaryColor || '#1E40AF'}; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .invoice-details { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid ${org.primaryColor || '#1E40AF'}; }
    .amount { font-size: 24px; font-weight: bold; color: ${daysOverdue ? '#DC2626' : '#059669'}; }
    .button { display: inline-block; background-color: ${org.primaryColor || '#1E40AF'}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    ${daysOverdue ? '.overdue-badge { background-color: #FEE2E2; color: #DC2626; padding: 8px 16px; border-radius: 4px; display: inline-block; font-weight: bold; margin-bottom: 15px; }' : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${org.logoUrl ? `<img src="${org.logoUrl}" alt="${org.name}" style="max-height: 60px; margin-bottom: 10px;">` : ''}
      <h1>Invoice Reminder</h1>
    </div>

    <div class="content">
      <p>Hi ${client.firstName || client.companyName || 'there'},</p>

      ${daysOverdue ? `<div class="overdue-badge">⚠️ OVERDUE: ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}</div>` : ''}

      <p>This is a ${daysOverdue ? 'friendly' : 'reminder'} that invoice <strong>#${invoice.invoiceNumber}</strong> is ${dueStatusText}.</p>

      <div class="invoice-details">
        <h3>Invoice Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;"><strong>Invoice Number:</strong></td>
            <td style="padding: 8px 0;">#${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Issue Date:</strong></td>
            <td style="padding: 8px 0;">${issueDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
            <td style="padding: 8px 0;">${dueDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
            <td style="padding: 8px 0;">$${totalAmount.toFixed(2)}</td>
          </tr>
          ${paidAmount > 0 ? `
          <tr>
            <td style="padding: 8px 0;"><strong>Paid:</strong></td>
            <td style="padding: 8px 0;">$${paidAmount.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #ddd;">
            <td style="padding: 12px 0 0 0;"><strong>Amount Due:</strong></td>
            <td style="padding: 12px 0 0 0;"><span class="amount">$${outstandingAmount.toFixed(2)}</span></td>
          </tr>
        </table>
      </div>

      ${invoice.publicToken ? `
      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_WEB_URL}/invoices/view/${invoice.publicToken}" class="button">
          View & Pay Invoice
        </a>
      </div>
      ` : ''}

      ${org.bankAccountNumber ? `
      <div style="margin-top: 30px; padding: 20px; background-color: white; border-radius: 5px;">
        <h3 style="margin-top: 0;">Payment Details</h3>
        <p style="margin: 5px 0;"><strong>Account Name:</strong> ${org.bankAccountName || org.name}</p>
        <p style="margin: 5px 0;"><strong>BSB:</strong> ${org.bankBsb}</p>
        <p style="margin: 5px 0;"><strong>Account Number:</strong> ${org.bankAccountNumber}</p>
        <p style="margin: 5px 0;"><strong>Reference:</strong> INV-${invoice.invoiceNumber}</p>
      </div>
      ` : ''}

      <p style="margin-top: 30px;">If you have any questions or have already made payment, please don't hesitate to contact us.</p>

      <p>Thank you for your business!</p>

      <p><strong>${org.name}</strong><br>
      ${org.phone ? `Phone: ${org.phone}<br>` : ''}
      ${org.email ? `Email: ${org.email}` : ''}</p>
    </div>

    <div class="footer">
      <p>This is an automated reminder from ${org.name}</p>
    </div>
  </div>
</body>
</html>
`

  // TODO: Integrate with your email service (Resend, SendGrid, etc.)
  // For now, we'll log the email
  console.log('[Email] Sending invoice reminder email:', {
    to: client.email,
    subject,
    organizationId,
    invoiceNumber: invoice.invoiceNumber,
  })

  // Example integration with Resend:
  /*
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: `${org.name} <invoices@yourdomain.com>`,
    to: client.email,
    subject,
    html: body,
  })
  */

  // Log to reminder history
  await db.insert(reminderHistory).values({
    organizationId,
    reminderType: 'invoice_reminder',
    clientId: client.id,
    invoiceId: invoice.id,
    sentVia: 'email',
    recipientEmail: client.email,
    status: 'sent',
    daysBeforeDue: daysBeforeDue ? daysBeforeDue : (daysOverdue ? -daysOverdue : 0),
    invoiceAmount: outstandingAmount.toFixed(2),
    creditsUsed: 0,
  })

  return { success: true }
}
