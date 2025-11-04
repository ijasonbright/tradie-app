import { db } from '@tradie-app/database'
import { invoices, clients, reminderSettings, reminderHistory } from '@tradie-app/database'
import { and, eq, or, gte, sql } from 'drizzle-orm'
import { sendStatementEmail } from './send-statement-email'

/**
 * Check and send monthly statements for all organizations
 * Runs daily at 9 AM AEST
 */
export async function checkMonthlyStatements() {
  const today = new Date()
  const dayOfMonth = today.getDate()

  console.log('[Statements] Starting monthly statement check for day', dayOfMonth)

  try {
    // Get all organizations with monthly statements enabled for this day of month
    const orgsWithStatements = await db
      .select({
        organizationId: reminderSettings.organizationId,
        statementDayOfMonth: reminderSettings.statementDayOfMonth,
        statementMethod: reminderSettings.statementMethod,
        includeOnlyOutstanding: reminderSettings.includeOnlyOutstanding,
      })
      .from(reminderSettings)
      .where(
        and(
          eq(reminderSettings.monthlyStatementsEnabled, true),
          eq(reminderSettings.statementDayOfMonth, dayOfMonth)
        )
      )

    console.log(`[Statements] Found ${orgsWithStatements.length} organizations to send statements`)

    let totalStatementsProcessed = 0
    let totalStatementsSent = 0
    let totalStatementsFailed = 0

    // Process each organization
    for (const org of orgsWithStatements) {
      try {
        const results = await processOrganizationStatements(org)
        totalStatementsProcessed += results.processed
        totalStatementsSent += results.sent
        totalStatementsFailed += results.failed
      } catch (error) {
        console.error(`[Statements] Error processing org ${org.organizationId}:`, error)
      }
    }

    console.log('[Statements] Monthly statement check complete', {
      processed: totalStatementsProcessed,
      sent: totalStatementsSent,
      failed: totalStatementsFailed,
    })

    return {
      success: true,
      processed: totalStatementsProcessed,
      sent: totalStatementsSent,
      failed: totalStatementsFailed,
    }
  } catch (error) {
    console.error('[Statements] Fatal error in checkMonthlyStatements:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process statements for a single organization
 */
async function processOrganizationStatements(orgSettings: {
  organizationId: string
  statementDayOfMonth: number
  statementMethod: string
  includeOnlyOutstanding: boolean
}) {
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  let processed = 0
  let sent = 0
  let failed = 0

  // Get all clients with invoices
  const clientsWithInvoices = await db
    .select({
      clientId: invoices.clientId,
      client: clients,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.organizationId, orgSettings.organizationId))
    .groupBy(invoices.clientId, clients.id)

  console.log(`[Statements] Org ${orgSettings.organizationId}: Found ${clientsWithInvoices.length} clients with invoices`)

  // Process each client
  for (const { client } of clientsWithInvoices) {
    processed++

    // Get all invoices for this client
    const clientInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, orgSettings.organizationId),
          eq(invoices.clientId, client.id)
        )
      )
      .orderBy(invoices.dueDate)

    // Filter for outstanding invoices if configured
    const relevantInvoices = orgSettings.includeOnlyOutstanding
      ? clientInvoices.filter(inv =>
          inv.status === 'sent' ||
          inv.status === 'overdue' ||
          inv.status === 'partially_paid'
        )
      : clientInvoices

    // Skip if no relevant invoices
    if (relevantInvoices.length === 0) {
      console.log(`[Statements] No relevant invoices for client ${client.id}`)
      continue
    }

    // Check if we already sent a statement this month
    const alreadySentThisMonth = await db
      .select()
      .from(reminderHistory)
      .where(
        and(
          eq(reminderHistory.clientId, client.id),
          eq(reminderHistory.reminderType, 'monthly_statement'),
          gte(reminderHistory.sentAt, firstDayOfMonth)
        )
      )
      .limit(1)

    if (alreadySentThisMonth.length > 0) {
      console.log(`[Statements] Already sent statement this month for client ${client.id}`)
      continue
    }

    // Calculate totals
    const outstandingInvoices = clientInvoices.filter(inv =>
      inv.status === 'sent' ||
      inv.status === 'overdue' ||
      inv.status === 'partially_paid'
    )

    const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
      const total = parseFloat(inv.totalAmount)
      const paid = parseFloat(inv.paidAmount || '0')
      return sum + (total - paid)
    }, 0)

    // Send statement
    try {
      await sendStatementEmail({
        client,
        invoices: relevantInvoices,
        organizationId: orgSettings.organizationId,
        totalOutstanding,
      })

      sent++
      console.log(`[Statements] Sent statement to client ${client.id} (${relevantInvoices.length} invoices, $${totalOutstanding.toFixed(2)} outstanding)`)

      // Log successful send
      await db.insert(reminderHistory).values({
        organizationId: orgSettings.organizationId,
        reminderType: 'monthly_statement',
        clientId: client.id,
        invoiceId: null, // monthly statements aren't tied to a single invoice
        sentVia: 'email', // always email with PDF attachment
        recipientEmail: client.email || undefined,
        status: 'sent',
        invoiceAmount: totalOutstanding.toFixed(2),
        creditsUsed: 0,
      })
    } catch (error) {
      failed++
      console.error(`[Statements] Failed to send statement for client ${client.id}:`, error)

      // Log failed send
      await db.insert(reminderHistory).values({
        organizationId: orgSettings.organizationId,
        reminderType: 'monthly_statement',
        clientId: client.id,
        invoiceId: null,
        sentVia: 'email',
        recipientEmail: client.email || undefined,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        invoiceAmount: totalOutstanding.toFixed(2),
        creditsUsed: 0,
      })
    }
  }

  return { processed, sent, failed }
}
