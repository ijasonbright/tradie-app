import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { triggerWebhooks, WebhookEventType } from '@/lib/api/webhooks'

export const dynamic = 'force-dynamic'

/**
 * POST /api/developer/webhooks/:id/test
 * Send a test webhook to verify the endpoint is working
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Get user's organization and verify they're owner/admin
    const users = await sql`
      SELECT u.id, om.organization_id, om.role
      FROM users u
      JOIN organization_members om ON u.id = om.user_id
      WHERE u.clerk_user_id = ${userId}
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const organizationId = users[0].organization_id

    // Get the webhook subscription
    const webhooks = await sql`
      SELECT
        id,
        subscription_id,
        event_type,
        target_url,
        is_active
      FROM webhook_subscriptions
      WHERE id = ${id}
      AND organization_id = ${organizationId}
      LIMIT 1
    `

    if (webhooks.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    const webhook = webhooks[0]

    if (!webhook.is_active) {
      return NextResponse.json({
        error: 'Webhook is not active. Enable it first to send test events.',
      }, { status: 400 })
    }

    // Generate sample test data based on event type
    const testData = generateTestData(webhook.event_type as WebhookEventType)

    // Trigger the webhook (this will create a log entry)
    await triggerWebhooks({
      organizationId,
      eventType: webhook.event_type as WebhookEventType,
      data: {
        ...testData,
        _test: true, // Mark as test event
      },
    })

    return NextResponse.json({
      message: 'Test webhook sent',
      event_type: webhook.event_type,
      target_url: webhook.target_url,
      test_data: testData,
    })
  } catch (error) {
    console.error('Error sending test webhook:', error)
    return NextResponse.json({ error: 'Failed to send test webhook' }, { status: 500 })
  }
}

/**
 * Generate sample test data based on event type
 */
function generateTestData(eventType: WebhookEventType): Record<string, any> {
  const now = new Date().toISOString()
  const sampleUUID = '00000000-0000-0000-0000-000000000000'

  switch (eventType) {
    case 'job.created':
    case 'job.updated':
    case 'job.completed':
    case 'job.status_changed':
    case 'job.assigned':
    case 'job.deleted':
      return {
        job_id: sampleUUID,
        job_number: 'JOB-2025-0001',
        title: 'Test Job',
        description: 'This is a test job created for webhook testing',
        status: 'scheduled',
        job_type: 'repair',
        priority: 'medium',
        client: {
          id: sampleUUID,
          name: 'Test Client',
          email: 'test@example.com',
          phone: '+61400000000',
        },
        site_address: {
          line1: '123 Test Street',
          city: 'Sydney',
          state: 'NSW',
          postcode: '2000',
        },
        scheduled_date: now,
        quoted_amount: '250.00',
        created_at: now,
      }

    case 'client.created':
    case 'client.updated':
    case 'client.deleted':
      return {
        client_id: sampleUUID,
        client_type: 'residential',
        first_name: 'Test',
        last_name: 'Client',
        email: 'test@example.com',
        phone: '+61400000000',
        address: {
          line1: '123 Test Street',
          city: 'Sydney',
          state: 'NSW',
          postcode: '2000',
        },
        created_at: now,
      }

    case 'invoice.created':
    case 'invoice.sent':
    case 'invoice.paid':
    case 'invoice.partially_paid':
    case 'invoice.overdue':
    case 'invoice.deleted':
      return {
        invoice_id: sampleUUID,
        invoice_number: 'INV-2025-0001',
        status: 'sent',
        client: {
          id: sampleUUID,
          name: 'Test Client',
          email: 'test@example.com',
        },
        job_id: sampleUUID,
        job_number: 'JOB-2025-0001',
        subtotal: '250.00',
        gst_amount: '25.00',
        total_amount: '275.00',
        paid_amount: '0.00',
        issue_date: now,
        due_date: now,
        created_at: now,
      }

    case 'quote.created':
    case 'quote.sent':
    case 'quote.accepted':
    case 'quote.rejected':
    case 'quote.expired':
    case 'quote.deleted':
      return {
        quote_id: sampleUUID,
        quote_number: 'QTE-2025-0001',
        status: 'sent',
        client: {
          id: sampleUUID,
          name: 'Test Client',
          email: 'test@example.com',
        },
        title: 'Test Quote',
        description: 'Quote for test services',
        subtotal: '500.00',
        gst_amount: '50.00',
        total_amount: '550.00',
        valid_until: now,
        created_at: now,
      }

    case 'appointment.created':
    case 'appointment.updated':
    case 'appointment.cancelled':
    case 'appointment.reminder':
      return {
        appointment_id: sampleUUID,
        title: 'Test Appointment',
        description: 'Test appointment for webhook testing',
        appointment_type: 'job',
        start_time: now,
        end_time: now,
        client: {
          id: sampleUUID,
          name: 'Test Client',
        },
        job_id: sampleUUID,
        created_at: now,
      }

    case 'expense.created':
    case 'expense.approved':
    case 'expense.rejected':
      return {
        expense_id: sampleUUID,
        category: 'materials',
        description: 'Test expense',
        amount: '50.00',
        gst_amount: '5.00',
        total_amount: '55.00',
        status: 'pending',
        expense_date: now,
        submitted_by: {
          id: sampleUUID,
          name: 'Test User',
        },
        created_at: now,
      }

    case 'sms.received':
    case 'sms.sent':
      return {
        sms_id: sampleUUID,
        direction: eventType === 'sms.received' ? 'inbound' : 'outbound',
        phone_number: '+61400000000',
        message_body: 'This is a test SMS message',
        client: {
          id: sampleUUID,
          name: 'Test Client',
        },
        created_at: now,
      }

    case 'time_log.created':
    case 'time_log.approved':
      return {
        time_log_id: sampleUUID,
        job_id: sampleUUID,
        job_number: 'JOB-2025-0001',
        user: {
          id: sampleUUID,
          name: 'Test Technician',
        },
        start_time: now,
        end_time: now,
        total_hours: '2.5',
        hourly_rate: '80.00',
        labor_cost: '200.00',
        status: 'pending',
        created_at: now,
      }

    case 'completion_form.submitted':
    case 'completion_form.updated':
      return {
        form_id: sampleUUID,
        job_id: sampleUUID,
        job_number: 'JOB-2025-0001',
        template_name: 'Standard Completion Form',
        status: 'submitted',
        completed_by: {
          id: sampleUUID,
          name: 'Test Technician',
        },
        answer_count: 10,
        completion_date: now,
        created_at: now,
      }

    case 'payment.received':
    case 'payment.refunded':
      return {
        payment_id: sampleUUID,
        invoice_id: sampleUUID,
        invoice_number: 'INV-2025-0001',
        amount: '275.00',
        payment_method: 'bank_transfer',
        payment_date: now,
        client: {
          id: sampleUUID,
          name: 'Test Client',
        },
        created_at: now,
      }

    default:
      return {
        event_type: eventType,
        message: 'Test webhook event',
        timestamp: now,
      }
  }
}
