import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/api-keys/:id
 * Get details of a specific API key
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

    // Get the API key
    const keys = await sql`
      SELECT
        ak.id,
        ak.name,
        ak.key_prefix,
        ak.key_type,
        ak.permissions,
        ak.is_active,
        ak.last_used_at,
        ak.usage_count,
        ak.rate_limit_per_minute,
        ak.rate_limit_per_hour,
        ak.expires_at,
        ak.created_at,
        ak.updated_at,
        u.full_name as created_by_name
      FROM api_keys ak
      LEFT JOIN users u ON ak.created_by_user_id = u.id
      WHERE ak.id = ${id}
      AND ak.organization_id = ${organizationId}
      LIMIT 1
    `

    if (keys.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Get recent usage stats
    const usageStats = await sql`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
        AVG(response_time_ms) as avg_response_time_ms
      FROM api_request_logs
      WHERE api_key_id = ${id}
      AND created_at > NOW() - INTERVAL '7 days'
    `

    return NextResponse.json({
      api_key: keys[0],
      usage_stats: usageStats[0],
    })
  } catch (error) {
    console.error('Error getting API key:', error)
    return NextResponse.json({ error: 'Failed to get API key' }, { status: 500 })
  }
}

/**
 * PUT /api/developer/api-keys/:id
 * Update an API key (name, permissions, status)
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

    // Verify the key belongs to this organization
    const existing = await sql`
      SELECT id FROM api_keys
      WHERE id = ${id}
      AND organization_id = ${organizationId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Build update query based on provided fields
    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) {
      updates.push('name')
      values.push(body.name.trim())
    }

    if (body.is_active !== undefined) {
      updates.push('is_active')
      values.push(body.is_active)
    }

    if (body.permissions !== undefined) {
      updates.push('permissions')
      values.push(JSON.stringify(body.permissions))
    }

    if (body.rate_limit_per_minute !== undefined) {
      updates.push('rate_limit_per_minute')
      values.push(body.rate_limit_per_minute)
    }

    if (body.rate_limit_per_hour !== undefined) {
      updates.push('rate_limit_per_hour')
      values.push(body.rate_limit_per_hour)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the key
    const result = await sql`
      UPDATE api_keys
      SET
        name = COALESCE(${body.name?.trim()}, name),
        is_active = COALESCE(${body.is_active}, is_active),
        permissions = COALESCE(${body.permissions ? JSON.stringify(body.permissions) : null}::jsonb, permissions),
        rate_limit_per_minute = COALESCE(${body.rate_limit_per_minute}, rate_limit_per_minute),
        rate_limit_per_hour = COALESCE(${body.rate_limit_per_hour}, rate_limit_per_hour),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, key_prefix, key_type, permissions, is_active, rate_limit_per_minute, rate_limit_per_hour, expires_at, updated_at
    `

    return NextResponse.json({
      api_key: result[0],
      message: 'API key updated successfully',
    })
  } catch (error) {
    console.error('Error updating API key:', error)
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 })
  }
}

/**
 * DELETE /api/developer/api-keys/:id
 * Delete (revoke) an API key
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

    // Delete the key
    const result = await sql`
      DELETE FROM api_keys
      WHERE id = ${id}
      AND organization_id = ${organizationId}
      RETURNING id, name
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Also deactivate any webhook subscriptions using this key
    await sql`
      UPDATE webhook_subscriptions
      SET is_active = false, updated_at = NOW()
      WHERE api_key_id = ${id}
    `

    return NextResponse.json({
      message: 'API key deleted successfully',
      deleted_key: result[0],
    })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
  }
}
