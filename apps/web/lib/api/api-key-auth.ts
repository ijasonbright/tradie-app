import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'

/**
 * API Key Authentication Module
 *
 * Supports two types of API key formats:
 * - ta_xxx... : Standard Tradie App API keys
 * - tc_api_xxx... : TradieConnect integration keys
 */

export interface ApiKeyPayload {
  apiKeyId: string
  organizationId: string
  organizationName: string
  keyType: string
  permissions: string[]
}

/**
 * Generate a new API key
 * @returns Object with raw key (show once) and hash (store in DB)
 */
export function generateApiKey(prefix: string = 'ta'): { rawKey: string; keyHash: string; keyPrefix: string } {
  // Generate 32 random bytes and encode as base64url
  const randomBytes = crypto.randomBytes(32)
  const keyBody = randomBytes.toString('base64url')

  // Create the full key with prefix
  const rawKey = `${prefix}_${keyBody}`

  // Hash the key for storage
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  // Create a prefix for display (first 8 chars of body)
  const keyPrefix = `${prefix}_${keyBody.substring(0, 8)}...`

  return { rawKey, keyHash, keyPrefix }
}

/**
 * Hash an API key for lookup
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

/**
 * Extract API key from Authorization header
 * Supports: "Bearer ta_xxx" or "Bearer tc_api_xxx"
 */
export function extractApiKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null

  // Handle "Bearer xxx" format
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    // Check if it's an API key (starts with ta_ or tc_api_)
    if (token.startsWith('ta_') || token.startsWith('tc_api_')) {
      return token
    }
  }

  // Handle direct API key (for backward compatibility)
  if (authHeader.startsWith('ta_') || authHeader.startsWith('tc_api_')) {
    return authHeader
  }

  return null
}

/**
 * Verify an API key and return the payload
 */
export async function verifyApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const keyHash = hashApiKey(apiKey)

    const keys = await sql`
      SELECT
        ak.id,
        ak.organization_id,
        ak.key_type,
        ak.permissions,
        ak.is_active,
        ak.expires_at,
        ak.rate_limit_per_minute,
        ak.rate_limit_per_hour,
        o.name as organization_name
      FROM api_keys ak
      JOIN organizations o ON ak.organization_id = o.id
      WHERE ak.key_hash = ${keyHash}
      LIMIT 1
    `

    if (keys.length === 0) {
      return null
    }

    const key = keys[0]

    // Check if key is active
    if (!key.is_active) {
      return null
    }

    // Check if key is expired
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return null
    }

    // Update last used timestamp and increment usage count
    await sql`
      UPDATE api_keys
      SET last_used_at = NOW(), usage_count = usage_count + 1, updated_at = NOW()
      WHERE id = ${key.id}
    `

    return {
      apiKeyId: key.id,
      organizationId: key.organization_id,
      organizationName: key.organization_name,
      keyType: key.key_type,
      permissions: key.permissions || [],
    }
  } catch (error) {
    console.error('Error verifying API key:', error)
    return null
  }
}

/**
 * Check if an API key has a specific permission
 */
export function hasPermission(payload: ApiKeyPayload, permission: string): boolean {
  // Admin/full access keys have all permissions
  if (payload.permissions.includes('*') || payload.permissions.includes('all')) {
    return true
  }

  // Check for exact permission match
  if (payload.permissions.includes(permission)) {
    return true
  }

  // Check for wildcard permissions (e.g., 'jobs.*' matches 'jobs.read')
  const [resource, action] = permission.split('.')
  if (payload.permissions.includes(`${resource}.*`)) {
    return true
  }

  return false
}

/**
 * Log API request for analytics
 */
export async function logApiRequest(params: {
  organizationId: string
  apiKeyId: string | null
  method: string
  path: string
  queryParams?: Record<string, any>
  statusCode: number
  responseTimeMs: number
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  try {
    const sql = neon(process.env.DATABASE_URL!)

    await sql`
      INSERT INTO api_request_logs (
        organization_id,
        api_key_id,
        method,
        path,
        query_params,
        status_code,
        response_time_ms,
        error_message,
        ip_address,
        user_agent
      ) VALUES (
        ${params.organizationId},
        ${params.apiKeyId},
        ${params.method},
        ${params.path},
        ${JSON.stringify(params.queryParams || {})},
        ${params.statusCode},
        ${params.responseTimeMs},
        ${params.errorMessage || null},
        ${params.ipAddress || null},
        ${params.userAgent || null}
      )
    `
  } catch (error) {
    // Don't throw - logging shouldn't break the request
    console.error('Error logging API request:', error)
  }
}

/**
 * Higher-order function to wrap API routes with API key authentication
 */
export function withApiKeyAuth(
  handler: (
    request: NextRequest,
    context: { params: Promise<Record<string, string>>; apiKey: ApiKeyPayload }
  ) => Promise<NextResponse>,
  options: { requiredPermission?: string } = {}
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const startTime = Date.now()

    // Extract API key from header
    const authHeader = request.headers.get('authorization')
    const apiKey = extractApiKeyFromHeader(authHeader)

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'API key required' },
        { status: 401 }
      )
    }

    // Verify API key
    const payload = await verifyApiKey(apiKey)

    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired API key' },
        { status: 401 }
      )
    }

    // Check permission if required
    if (options.requiredPermission && !hasPermission(payload, options.requiredPermission)) {
      return NextResponse.json(
        { error: 'Forbidden', message: `Missing required permission: ${options.requiredPermission}` },
        { status: 403 }
      )
    }

    try {
      // Call the handler with the authenticated context
      const response = await handler(request, { params: context.params, apiKey: payload })

      // Log the request
      await logApiRequest({
        organizationId: payload.organizationId,
        apiKeyId: payload.apiKeyId,
        method: request.method,
        path: new URL(request.url).pathname,
        statusCode: response.status,
        responseTimeMs: Date.now() - startTime,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      })

      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Log the error
      await logApiRequest({
        organizationId: payload.organizationId,
        apiKeyId: payload.apiKeyId,
        method: request.method,
        path: new URL(request.url).pathname,
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      })

      console.error('API error:', error)
      return NextResponse.json(
        { error: 'Internal Server Error', message: errorMessage },
        { status: 500 }
      )
    }
  }
}
