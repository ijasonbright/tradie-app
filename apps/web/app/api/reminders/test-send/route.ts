import { NextRequest, NextResponse } from 'next/server'
import { db } from '@tradie-app/database'
import { invoices, clients, organizations } from '@tradie-app/database'
import { eq, and } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { sendReminderEmail } from '../../../../lib/reminders/send-reminder-email'
import { sendReminderSms } from '../../../../lib/reminders/send-reminder-sms'

/**
 * POST /api/reminders/test-send
 * Send a test reminder (for testing configuration)
 *
 * Body:
 * {
 *   type: 'email' | 'sms',
 *   testEmail?: string,
 *   testPhone?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()

    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, testEmail, testPhone } = body

    if (!type || !['email', 'sms'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "email" or "sms"' },
        { status: 400 }
      )
    }

    if (type === 'email' && !testEmail) {
      return NextResponse.json(
        { error: 'testEmail is required for email test' },
        { status: 400 }
      )
    }

    if (type === 'sms' && !testPhone) {
      return NextResponse.json(
        { error: 'testPhone is required for SMS test' },
        { status: 400 }
      )
    }

    // Get organization
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
      .then(rows => rows[0])

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Create mock invoice and client for testing
    const mockClient = {
      id: 'test-client-id',
      firstName: 'Test',
      lastName: 'Client',
      companyName: null,
      email: testEmail || 'test@example.com',
      phone: testPhone || '+61400000000',
      mobile: testPhone || '+61400000000',
    }

    const mockInvoice = {
      id: 'test-invoice-id',
      invoiceNumber: 'TEST-001',
      totalAmount: '1250.50',
      paidAmount: '0',
      issueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      publicToken: 'test-token-123',
    }

    // Send test reminder
    try {
      if (type === 'email') {
        await sendReminderEmail({
          invoice: mockInvoice,
          client: mockClient,
          organizationId: orgId,
          daysBeforeDue: 7,
        })

        return NextResponse.json({
          success: true,
          message: `Test email sent to ${testEmail}`,
        })
      } else {
        await sendReminderSms({
          invoice: mockInvoice,
          client: mockClient,
          organizationId: orgId,
          daysBeforeDue: 7,
        })

        return NextResponse.json({
          success: true,
          message: `Test SMS sent to ${testPhone}`,
        })
      }
    } catch (error) {
      console.error('[API] Error sending test reminder:', error)
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send test',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API] Error in test-send endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
