import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'
import { WebhookEventType } from '@/lib/api/webhooks'

export const dynamic = 'force-dynamic'

// Valid webhook event types
const VALID_EVENT_TYPES: WebhookEventType[] = [
  'job.created', 'job.updated', 'job.completed', 'job.status_changed', 'job.assigned', 'job.deleted',
  'client.created', 'client.updated', 'client.deleted',
  'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.partially_paid', 'invoice.overdue', 'invoice.deleted',
  'quote.created', 'quote.sent', 'quote.accepted', 'quote.rejected', 'quote.expired', 'quote.deleted',
  'appointment.created', 'appointment.updated', 'appointment.cancelled', 'appointment.reminder',
  'expense.created', 'expense.approved', 'expense.rejected',
  'sms.received', 'sms.sent',
  'time_log.created', 'time_log.approved',
  'completion_form.submitted', 'completion_form.updated',
  'payment.received', 'payment.refunded',
]

/**
 * GET /api/developer/webhooks
 * List all webhook subscriptions for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      return NextResponse.json({ error: 'Not authorized to manage webhooks' }, { status: 403 })
    }

    const organizationId = users[0].organization_id

    // Get all webhook subscriptions
    const webhooks = await sql`
      SELECT
        ws.id,
        ws.subscription_id,
        ws.name,
        ws.event_type,
        ws.target_url,
        ws.filters,
        ws.is_active,
        ws.last_triggered_at,
        ws.trigger_count,
        ws.failure_count,
        ws.last_failure_at,
        ws.last_failure_reason,
        ws.max_retries,
        ws.created_at,
        ak.name as api_key_name
      FROM webhook_subscriptions ws
      LEFT JOIN api_keys ak ON ws.api_key_id = ak.id
      WHERE ws.organization_id = ${organizationId}
      ORDER BY ws.created_at DESC
    `

    return NextResponse.json({
      webhooks,
      count: webhooks.length,
      available_event_types: VALID_EVENT_TYPES,
    })
  } catch (error) {
    console.error('Error listing webhooks:', error)
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 })
  }
}

/**
 * POST /api/developer/webhooks
 * Create a new webhook subscription
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    const body = await request.json()

    // Validate required fields
    const { name, event_type, target_url, filters, headers, max_retries = 3, generate_secret = true } = body

    if (!event_type || !target_url) {
      return NextResponse.json({ error: 'event_type and target_url are required' }, { status: 400 })
    }

    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json({
        error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
      }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(target_url)
    } catch {
      return NextResponse.json({ error: 'Invalid target_url' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'Not authorized to create webhooks' }, { status: 403 })
    }

    const organizationId = users[0].organization_id
    const internalUserId = users[0].id

    // Generate subscription ID and secret key
    const subscriptionId = `whsub_${crypto.randomBytes(16).toString('hex')}`
    const secretKey = generate_secret ? `whsec_${crypto.randomBytes(32).toString('hex')}` : null

    // Create the webhook subscription
    const result = await sql`
      INSERT INTO webhook_subscriptions (
        organization_id,
        subscription_id,
        name,
        event_type,
        target_url,
        filters,
        secret_key,
        headers,
        max_retries,
        created_by_user_id
      ) VALUES (
        ${organizationId},
        ${subscriptionId},
        ${name || `Webhook for ${event_type}`},
        ${event_type},
        ${target_url},
        ${JSON.stringify(filters || {})},
        ${secretKey},
        ${JSON.stringify(headers || {})},
        ${max_retries},
        ${internalUserId}
      )
      RETURNING id, subscription_id, name, event_type, target_url, filters, is_active, max_retries, created_at
    `

    return NextResponse.json({
      webhook: {
        ...result[0],
        secret_key: secretKey, // Only shown once!
      },
      message: secretKey
        ? 'Webhook created successfully. Save the secret_key now - it will not be shown again.'
        : 'Webhook created successfully.',
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating webhook:', error)
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 })
  }
}
