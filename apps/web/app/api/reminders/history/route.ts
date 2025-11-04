import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reminders/history
 * Get reminder history for the current organization
 *
 * Query params:
 * - type: 'invoice_reminder' | 'monthly_statement' | 'all' (default: 'all')
 * - status: 'sent' | 'failed' | 'all' (default: 'all')
 * - clientId: filter by specific client
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get organization where user is a member
    const orgs = await sql`
      SELECT o.id
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const orgId = orgs[0].id

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all'
    const status = searchParams.get('status') || 'all'
    const clientId = searchParams.get('clientId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build dynamic query based on filters
    let query = `
      SELECT
        rh.*,
        COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as client_name
      FROM reminder_history rh
      INNER JOIN clients c ON rh.client_id = c.id
      WHERE rh.organization_id = $1
    `
    let countQuery = `
      SELECT COUNT(*) as count
      FROM reminder_history rh
      WHERE rh.organization_id = $1
    `

    const params: any[] = [orgId]
    let paramIndex = 2

    if (type !== 'all') {
      query += ` AND rh.reminder_type = $${paramIndex}`
      countQuery += ` AND rh.reminder_type = $${paramIndex}`
      params.push(type)
      paramIndex++
    }

    if (status !== 'all') {
      query += ` AND rh.status = $${paramIndex}`
      countQuery += ` AND rh.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (clientId) {
      query += ` AND rh.client_id = $${paramIndex}`
      countQuery += ` AND rh.client_id = $${paramIndex}`
      params.push(clientId)
      paramIndex++
    }

    if (startDate) {
      query += ` AND rh.sent_at >= $${paramIndex}`
      countQuery += ` AND rh.sent_at >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query += ` AND rh.sent_at <= $${paramIndex}`
      countQuery += ` AND rh.sent_at <= $${paramIndex}`
      params.push(end.toISOString())
      paramIndex++
    }

    query += ` ORDER BY rh.sent_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`

    // Fetch history with client details
    const history = await sql(query, [...params, limit, offset])

    // Get total count for pagination
    const countResult = await sql(countQuery, params)

    const total = parseInt(countResult[0]?.count || '0')

    return NextResponse.json({
      history,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching reminder history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
