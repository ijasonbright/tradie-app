import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { generateApiKey } from '@/lib/api/api-key-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/api-keys
 * List all API keys for the organization
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
      return NextResponse.json({ error: 'Not authorized to manage API keys' }, { status: 403 })
    }

    const organizationId = users[0].organization_id

    // Get all API keys (without the actual key hash)
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
        u.full_name as created_by_name
      FROM api_keys ak
      LEFT JOIN users u ON ak.created_by_user_id = u.id
      WHERE ak.organization_id = ${organizationId}
      ORDER BY ak.created_at DESC
    `

    return NextResponse.json({
      api_keys: keys,
      count: keys.length,
    })
  } catch (error) {
    console.error('Error listing API keys:', error)
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 })
  }
}

/**
 * POST /api/developer/api-keys
 * Create a new API key
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
    const { name, key_type = 'standard', permissions = [], expires_in_days } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
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
      return NextResponse.json({ error: 'Not authorized to create API keys' }, { status: 403 })
    }

    const organizationId = users[0].organization_id
    const internalUserId = users[0].id

    // Generate the API key
    const prefix = key_type === 'tradieconnect' ? 'tc_api' : 'ta'
    const { rawKey, keyHash, keyPrefix } = generateApiKey(prefix)

    // Calculate expiry date if provided
    let expiresAt = null
    if (expires_in_days && expires_in_days > 0) {
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + expires_in_days)
      expiresAt = expiryDate.toISOString()
    }

    // Set default permissions based on key type
    let finalPermissions = permissions
    if (finalPermissions.length === 0) {
      switch (key_type) {
        case 'tradieconnect':
          finalPermissions = ['completion_forms.read', 'completion_forms.write', 'jobs.read']
          break
        case 'zapier':
          finalPermissions = ['*'] // Full access for Zapier
          break
        case 'readonly':
          finalPermissions = ['jobs.read', 'clients.read', 'invoices.read', 'quotes.read']
          break
        default:
          finalPermissions = ['*'] // Standard keys get full access by default
      }
    }

    // Create the API key record
    const result = await sql`
      INSERT INTO api_keys (
        organization_id,
        name,
        key_hash,
        key_prefix,
        key_type,
        permissions,
        created_by_user_id,
        expires_at
      ) VALUES (
        ${organizationId},
        ${name.trim()},
        ${keyHash},
        ${keyPrefix},
        ${key_type},
        ${JSON.stringify(finalPermissions)},
        ${internalUserId},
        ${expiresAt}
      )
      RETURNING id, name, key_prefix, key_type, permissions, is_active, expires_at, created_at
    `

    // Return the key - THIS IS THE ONLY TIME the raw key will be shown
    return NextResponse.json({
      api_key: {
        ...result[0],
        key: rawKey, // Only shown once!
      },
      message: 'API key created successfully. Save this key now - it will not be shown again.',
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}
