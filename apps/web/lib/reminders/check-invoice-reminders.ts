import { db } from '@tradie-app/database'
import { invoices, clients, reminderSettings, reminderHistory } from '@tradie-app/database'
import { and, eq, sql, lte, gte, isNull, or } from 'drizzle-orm'
import { sendReminderEmail } from './send-reminder-email'
import { sendReminderSms } from './send-reminder-sms'

/**
 * Check and send invoice reminders for all organizations
 * Runs daily at 9 AM AEST
 */
export async function checkInvoiceReminders() {
  console.log('[Reminders] Starting invoice reminder check...')

  try {
    // Get all organizations with invoice reminders enabled
    const orgsWithReminders = await db
      .select({
        organizationId: reminderSettings.organizationId,
        reminderDaysBeforeDue: reminderSettings.reminderDaysBeforeDue,
        reminderDaysAfterDue: reminderSettings.reminderDaysAfterDue,
        invoiceReminderMethod: reminderSettings.invoiceReminderMethod,
        enableSmsEscalation: reminderSettings.enableSmsEscalation,
        smsEscalationDaysOverdue: reminderSettings.smsEscalationDaysOverdue,
      })
      .from(reminderSettings)
      .where(eq(reminderSettings.invoiceRemindersEnabled, true))

    console.log(`[Reminders] Found ${orgsWithReminders.length} organizations with reminders enabled`)

    let totalRemindersProcessed = 0
    let totalRemindersSent = 0
    let totalRemindersFailed = 0

    // Process each organization
    for (const org of orgsWithReminders) {
      try {
        const results = await processOrganizationReminders(org)
        totalRemindersProcessed += results.processed
        totalRemindersSent += results.sent
        totalRemindersFailed += results.failed
      } catch (error) {
        console.error(`[Reminders] Error processing org ${org.organizationId}:`, error)
      }
    }

    console.log('[Reminders] Invoice reminder check complete', {
      processed: totalRemindersProcessed,
      sent: totalRemindersSent,
      failed: totalRemindersFailed,
    })

    return {
      success: true,
      processed: totalRemindersProcessed,
      sent: totalRemindersSent,
      failed: totalRemindersFailed,
    }
  } catch (error) {
    console.error('[Reminders] Fatal error in checkInvoiceReminders:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process reminders for a single organization
 */
async function processOrganizationReminders(orgSettings: {
  organizationId: string
  reminderDaysBeforeDue: string | null
  reminderDaysAfterDue: string | null
  invoiceReminderMethod: string
  enableSmsEscalation: boolean
  smsEscalationDaysOverdue: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Reset to start of day

  // Parse reminder days
  const daysBeforeDue = orgSettings.reminderDaysBeforeDue
    ? orgSettings.reminderDaysBeforeDue.split(',').map(d => parseInt(d.trim()))
    : []
  const daysAfterDue = orgSettings.reminderDaysAfterDue
    ? orgSettings.reminderDaysAfterDue.split(',').map(d => parseInt(d.trim()))
    : []

  let processed = 0
  let sent = 0
  let failed = 0

  // Find invoices that need reminders
  const invoicesToRemind = await db
    .select({
      invoice: invoices,
      client: clients,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.organizationId, orgSettings.organizationId),
        or(
          eq(invoices.status, 'sent'),
          eq(invoices.status, 'overdue'),
          eq(invoices.status, 'partially_paid')
        )
      )
    )

  console.log(`[Reminders] Org ${orgSettings.organizationId}: Found ${invoicesToRemind.length} unpaid invoices`)

  // Check each invoice
  for (const { invoice, client } of invoicesToRemind) {
    processed++

    const dueDate = new Date(invoice.dueDate)
    dueDate.setHours(0, 0, 0, 0)

    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Check if we should send a reminder today
    let shouldSendReminder = false
    let reminderType: 'before' | 'after' = 'before'
    let daysDifference = 0

    // Check "before due" reminders
    if (daysUntilDue > 0 && daysBeforeDue.includes(daysUntilDue)) {
      shouldSendReminder = true
      reminderType = 'before'
      daysDifference = daysUntilDue
    }

    // Check "after due" (overdue) reminders
    if (daysUntilDue < 0) {
      const daysOverdue = Math.abs(daysUntilDue)
      if (daysAfterDue.includes(daysOverdue)) {
        shouldSendReminder = true
        reminderType = 'after'
        daysDifference = -daysOverdue // negative for overdue
      }
    }

    if (!shouldSendReminder) {
      continue
    }

    // Check if we already sent a reminder today for this invoice
    const alreadySentToday = await db
      .select()
      .from(reminderHistory)
      .where(
        and(
          eq(reminderHistory.invoiceId, invoice.id),
          eq(reminderHistory.reminderType, 'invoice_reminder'),
          gte(reminderHistory.sentAt, today)
        )
      )
      .limit(1)

    if (alreadySentToday.length > 0) {
      console.log(`[Reminders] Already sent reminder today for invoice ${invoice.invoiceNumber}`)
      continue
    }

    // Determine method: Email first, then SMS escalation after X days overdue
    let method = orgSettings.invoiceReminderMethod
    if (
      orgSettings.enableSmsEscalation &&
      reminderType === 'after' &&
      Math.abs(daysDifference) >= orgSettings.smsEscalationDaysOverdue
    ) {
      method = 'sms' // Escalate to SMS
      console.log(`[Reminders] Escalating invoice ${invoice.invoiceNumber} to SMS (${Math.abs(daysDifference)} days overdue)`)
    }

    // Send reminder
    try {
      if (method === 'email' || method === 'both') {
        await sendReminderEmail({
          invoice,
          client,
          organizationId: orgSettings.organizationId,
          daysBeforeDue: reminderType === 'before' ? daysDifference : undefined,
          daysOverdue: reminderType === 'after' ? Math.abs(daysDifference) : undefined,
        })
        sent++
      }

      if (method === 'sms' || method === 'both') {
        await sendReminderSms({
          invoice,
          client,
          organizationId: orgSettings.organizationId,
          daysBeforeDue: reminderType === 'before' ? daysDifference : undefined,
          daysOverdue: reminderType === 'after' ? Math.abs(daysDifference) : undefined,
        })
        sent++
      }

      console.log(`[Reminders] Sent ${method} reminder for invoice ${invoice.invoiceNumber} (${daysDifference} days)`)
    } catch (error) {
      failed++
      console.error(`[Reminders] Failed to send reminder for invoice ${invoice.id}:`, error)

      // Log failed reminder
      await db.insert(reminderHistory).values({
        organizationId: orgSettings.organizationId,
        reminderType: 'invoice_reminder',
        clientId: client.id,
        invoiceId: invoice.id,
        sentVia: method,
        recipientEmail: client.email || undefined,
        recipientPhone: client.mobile || client.phone || undefined,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        daysBeforeDue: daysDifference,
        invoiceAmount: invoice.totalAmount,
        creditsUsed: 0,
      })
    }
  }

  return { processed, sent, failed }
}
