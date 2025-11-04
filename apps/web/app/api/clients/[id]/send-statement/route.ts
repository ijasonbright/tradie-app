import { NextRequest, NextResponse } from 'next/server'
import { db } from '@tradie-app/database'
import { invoices, clients } from '@tradie-app/database'
import { eq, and } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { sendStatementEmail } from '../../../../../lib/reminders/send-statement-email'

/**
 * POST /api/clients/[id]/send-statement
 * Manually send a monthly statement to a specific client
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

    const clientId = params.id

    // Get client details
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, orgId)
        )
      )
      .limit(1)

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    if (!client.email) {
      return NextResponse.json(
        { error: 'Client has no email address' },
        { status: 400 }
      )
    }

    // Get all invoices for this client
    const clientInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, orgId),
          eq(invoices.clientId, clientId)
        )
      )
      .orderBy(invoices.dueDate)

    if (clientInvoices.length === 0) {
      return NextResponse.json(
        { error: 'Client has no invoices' },
        { status: 400 }
      )
    }

    // Calculate total outstanding
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
        invoices: clientInvoices,
        organizationId: orgId,
        totalOutstanding,
      })

      return NextResponse.json({
        success: true,
        message: `Statement sent to ${client.email}`,
        summary: {
          clientName: client.companyName || `${client.firstName} ${client.lastName}`,
          totalInvoices: clientInvoices.length,
          outstandingInvoices: outstandingInvoices.length,
          totalOutstanding: totalOutstanding.toFixed(2),
        },
      })
    } catch (error) {
      console.error('[API] Error sending statement:', error)
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send statement',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API] Error in send-statement endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
