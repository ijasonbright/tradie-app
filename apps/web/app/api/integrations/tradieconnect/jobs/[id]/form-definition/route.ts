import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import {
  fetchTCFormDefinition,
  transformTCFormToOurFormat,
} from '@/lib/tradieconnect/form-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/integrations/tradieconnect/jobs/:tcJobId/form-definition
 *
 * Fetches the form definition from TradieConnect for a specific job
 * and transforms it to our format for rendering.
 *
 * This is part of the parallel testing system for dynamic TC form sync.
 * The existing template-based system remains unchanged.
 *
 * Authentication: Clerk (web) + JWT (mobile)
 *
 * Response format:
 * {
 *   success: true,
 *   form: {
 *     template_id: "tc_form_80",
 *     template_name: "Rentsafe Inspection New",
 *     tc_form_id: 80,
 *     tc_job_id: 283294,
 *     groups: [
 *       {
 *         id: "tc_g_134",
 *         name: "Section 134",
 *         csv_group_id: 134,
 *         sort_order: 0,
 *         questions: [...]
 *       }
 *     ]
 *   },
 *   cached: false
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tcJobId } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Dual auth: Clerk (web) + JWT (mobile)
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT
    }

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

    // Get user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get active TradieConnect connection
    const connections = await sql`
      SELECT
        id,
        tc_user_id,
        tc_token
      FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      AND is_active = true
      LIMIT 1
    `

    if (connections.length === 0) {
      return NextResponse.json(
        { error: 'TradieConnect not connected', message: 'Please connect your TradieConnect account first', needs_connect: true },
        { status: 400 }
      )
    }

    const connection = connections[0]

    // Tokens are stored as plain text (no decryption needed)
    const tcToken = connection.tc_token

    // Fetch form definition from TC
    const result = await fetchTCFormDefinition(
      tcJobId,
      connection.tc_user_id,
      tcToken
    )

    if (!result.success || !result.form) {
      // Check if token expired
      if (result.unauthorized) {
        return NextResponse.json(
          { error: 'TradieConnect session expired', message: 'Please reconnect your TradieConnect account' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch form definition', details: result.error },
        { status: 500 }
      )
    }

    // Transform to our format
    const ourForm = transformTCFormToOurFormat(result.form, parseInt(tcJobId))

    // Return the form definition
    const response = NextResponse.json({
      success: true,
      form: ourForm,
      cached: false,
      _debug: {
        tc_form_id: result.form.jobTypeFormId,
        tc_form_name: result.form.name,
        question_count: result.form.questions?.length || 0,
        group_count: ourForm.groups.length,
        fetched_at: new Date().toISOString(),
      },
    })

    // Add no-cache headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Error getting TC form definition:', error)
    return NextResponse.json(
      {
        error: 'Failed to get form definition',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
