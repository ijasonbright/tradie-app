import { db } from '@tradie-app/database'
import { organizations, reminderHistory, smsTransactions } from '@tradie-app/database'
import { eq } from 'drizzle-orm'

interface SendReminderSmsParams {
  invoice: any
  client: any
  organizationId: string
  daysBeforeDue?: number
  daysOverdue?: number
}

/**
 * Send invoice reminder SMS to client
 */
export async function sendReminderSms({
  invoice,
  client,
  organizationId,
  daysBeforeDue,
  daysOverdue,
}: SendReminderSmsParams) {
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

  // Check SMS credits
  if (!org.smsCredits || org.smsCredits < 1) {
    throw new Error('Insufficient SMS credits')
  }

  // Get client phone number
  const clientPhone = client.mobile || client.phone
  if (!clientPhone) {
    throw new Error('Client has no phone number')
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
    dueStatusText = `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} OVERDUE`
  } else {
    dueStatusText = 'due today'
  }

  // Build SMS message (keep under 160 characters for 1 credit)
  let message = ''

  if (daysOverdue && daysOverdue >= 14) {
    // Urgent overdue message
    message = `URGENT: Invoice #${invoice.invoiceNumber} for $${outstandingAmount.toFixed(2)} is ${dueStatusText}. Please pay ASAP.`
  } else if (daysOverdue) {
    // Overdue reminder
    message = `Reminder: Invoice #${invoice.invoiceNumber} for $${outstandingAmount.toFixed(2)} is ${dueStatusText}.`
  } else {
    // Standard reminder
    message = `Hi ${client.firstName || 'there'}, reminder that invoice #${invoice.invoiceNumber} for $${outstandingAmount.toFixed(2)} is ${dueStatusText}.`
  }

  // Add short link if available
  if (invoice.publicToken) {
    const shortLink = `${process.env.NEXT_PUBLIC_WEB_URL}/i/${invoice.publicToken}`
    message += ` View: ${shortLink}`
  }

  // Add business name
  message += ` - ${org.name}`

  // Calculate SMS credits needed (160 chars = 1 credit)
  const creditsNeeded = Math.ceil(message.length / 160)

  if (org.smsCredits < creditsNeeded) {
    throw new Error(`Insufficient SMS credits (need ${creditsNeeded}, have ${org.smsCredits})`)
  }

  // TODO: Integrate with Tall Bob SMS API
  console.log('[SMS] Sending invoice reminder SMS:', {
    to: clientPhone,
    message,
    creditsNeeded,
    organizationId,
    invoiceNumber: invoice.invoiceNumber,
  })

  // Example integration with Tall Bob:
  /*
  const tallBobResponse = await fetch(process.env.TALLBOB_API_URL + '/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TALLBOB_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: org.smsPhoneNumber,
      to: clientPhone,
      message,
    }),
  })

  const result = await tallBobResponse.json()
  const tallbobMessageId = result.messageId
  */

  // Deduct SMS credits
  await db
    .update(organizations)
    .set({
      smsCredits: org.smsCredits - creditsNeeded,
    })
    .where(eq(organizations.id, organizationId))

  // Log SMS transaction
  await db.insert(smsTransactions).values({
    organizationId,
    transactionType: 'usage',
    creditsAmount: -creditsNeeded,
    balanceAfter: org.smsCredits - creditsNeeded,
    description: `Invoice reminder SMS for ${invoice.invoiceNumber}`,
    recipientPhone: clientPhone,
    smsType: 'reminder',
    messagePreview: message.substring(0, 50),
    relatedInvoiceId: invoice.id,
    deliveryStatus: 'pending',
  })

  // Log to reminder history
  await db.insert(reminderHistory).values({
    organizationId,
    reminderType: 'invoice_reminder',
    clientId: client.id,
    invoiceId: invoice.id,
    sentVia: 'sms',
    recipientPhone: clientPhone,
    status: 'sent',
    daysBeforeDue: daysBeforeDue ? daysBeforeDue : (daysOverdue ? -daysOverdue : 0),
    invoiceAmount: outstandingAmount.toFixed(2),
    creditsUsed: creditsNeeded,
  })

  return { success: true, creditsUsed: creditsNeeded }
}
