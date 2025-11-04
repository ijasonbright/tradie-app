import { NextRequest, NextResponse } from 'next/server'
import { db } from '@tradie-app/database'
import { invoices, clients, organizations } from '@tradie-app/database'
import { eq, and } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { sendReminderEmail } from '../../../../../lib/reminders/send-reminder-email'
import { sendReminderSms } from '../../../../../lib/reminders/send-reminder-sms'

/**
 * POST /api/invoices/[id]/send-reminder
 * Manually send a reminder for a specific invoice
 *
 * Body:
 * {
 *   method: 'email' | 'sms' | 'both'
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, orgId } = await auth()

    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = params.id
    const body = await request.json()
    const method = body.method || 'email'

    if (!['email', 'sms', 'both'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid method. Must be "email", "sms", or "both"' },
        { status: 400 }
      )
    }

    // Get invoice with client details
    const [invoiceData] = await db
      .select({
        invoice: invoices,
        client: clients,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.organizationId, orgId)
        )
      )
      .limit(1)

    if (!invoiceData) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    const { invoice, client } = invoiceData

    // Check if invoice is paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot send reminder for paid invoice' },
        { status: 400 }
      )
    }

    // Calculate days until/overdue
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(invoice.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    const reminderData = {
      invoice,
      client,
      organizationId: orgId,
      daysBeforeDue: daysUntilDue > 0 ? daysUntilDue : undefined,
      daysOverdue: daysUntilDue < 0 ? Math.abs(daysUntilDue) : undefined,
    }

    const results = {
      email: null as any,
      sms: null as any,
    }

    // Send email reminder
    if (method === 'email' || method === 'both') {
      try {
        results.email = await sendReminderEmail(reminderData)
      } catch (error) {
        console.error('[API] Error sending email reminder:', error)
        results.email = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send email',
        }
      }
    }

    // Send SMS reminder
    if (method === 'sms' || method === 'both') {
      try {
        results.sms = await sendReminderSms(reminderData)
      } catch (error) {
        console.error('[API] Error sending SMS reminder:', error)
        results.sms = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send SMS',
        }
      }
    }

    // Determine overall success
    const emailSuccess = method !== 'email' && method !== 'both' || results.email?.success
    const smsSuccess = method !== 'sms' && method !== 'both' || results.sms?.success
    const overallSuccess = emailSuccess && smsSuccess

    return NextResponse.json({
      success: overallSuccess,
      method,
      results,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        daysUntilDue,
      },
    })
  } catch (error) {
    console.error('[API] Error in send-reminder endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
