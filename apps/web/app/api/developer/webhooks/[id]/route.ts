import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/webhooks/:id
 * Get details of a specific webhook subscription including delivery logs
 */
export async function GET(
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
        ws.id,
        ws.subscription_id,
        ws.name,
        ws.event_type,
        ws.target_url,
        ws.filters,
        ws.headers,
        ws.is_active,
        ws.last_triggered_at,
        ws.trigger_count,
        ws.failure_count,
        ws.last_failure_at,
        ws.last_failure_reason,
        ws.max_retries,
        ws.retry_delay_seconds,
        ws.created_at,
        ws.updated_at,
        u.full_name as created_by_name
      FROM webhook_subscriptions ws
      LEFT JOIN users u ON ws.created_by_user_id = u.id
      WHERE ws.id = ${id}
      AND ws.organization_id = ${organizationId}
      LIMIT 1
    `

    if (webhooks.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    // Get recent delivery logs
    const logs = await sql`
      SELECT
        id,
        event_type,
        event_id,
        status,
        status_code,
        delivery_duration_ms,
        retry_count,
        triggered_at,
        delivered_at
      FROM webhook_logs
      WHERE subscription_id = ${id}
      ORDER BY triggered_at DESC
      LIMIT 50
    `

    // Get delivery stats
    const stats = await sql`
      SELECT
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_deliveries,
        AVG(CASE WHEN status = 'success' THEN delivery_duration_ms END) as avg_delivery_time_ms
      FROM webhook_logs
      WHERE subscription_id = ${id}
      AND triggered_at > NOW() - INTERVAL '7 days'
    `

    return NextResponse.json({
      webhook: webhooks[0],
      recent_deliveries: logs,
      stats: stats[0],
    })
  } catch (error) {
    console.error('Error getting webhook:', error)
    return NextResponse.json({ error: 'Failed to get webhook' }, { status: 500 })
  }
}

/**
 * PUT /api/developer/webhooks/:id
 * Update a webhook subscription
 */
export async function PUT(
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
    const body = await request.json()

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

    // Verify the webhook belongs to this organization
    const existing = await sql`
      SELECT id FROM webhook_subscriptions
      WHERE id = ${id}
      AND organization_id = ${organizationId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    // Validate URL if provided
    if (body.target_url) {
      try {
        new URL(body.target_url)
      } catch {
        return NextResponse.json({ error: 'Invalid target_url' }, { status: 400 })
      }
    }

    // Update the webhook
    const result = await sql`
      UPDATE webhook_subscriptions
      SET
        name = COALESCE(${body.name}, name),
        target_url = COALESCE(${body.target_url}, target_url),
        filters = COALESCE(${body.filters ? JSON.stringify(body.filters) : null}::jsonb, filters),
        headers = COALESCE(${body.headers ? JSON.stringify(body.headers) : null}::jsonb, headers),
        is_active = COALESCE(${body.is_active}, is_active),
        max_retries = COALESCE(${body.max_retries}, max_retries),
        retry_delay_seconds = COALESCE(${body.retry_delay_seconds}, retry_delay_seconds),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, subscription_id, name, event_type, target_url, filters, is_active, max_retries, updated_at
    `

    return NextResponse.json({
      webhook: result[0],
      message: 'Webhook updated successfully',
    })
  } catch (error) {
    console.error('Error updating webhook:', error)
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 })
  }
}

/**
 * DELETE /api/developer/webhooks/:id
 * Delete a webhook subscription
 */
export async function DELETE(
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

    // Delete the webhook (logs will remain for history)
    const result = await sql`
      DELETE FROM webhook_subscriptions
      WHERE id = ${id}
      AND organization_id = ${organizationId}
      RETURNING id, name, event_type
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Webhook deleted successfully',
      deleted_webhook: result[0],
    })
  } catch (error) {
    console.error('Error deleting webhook:', error)
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 })
  }
}
