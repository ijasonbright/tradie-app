import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// GET - List SMS transactions for user's organization
export async function GET(req: Request) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Try to get auth from Clerk (web) first
    let userId: string | null = null

    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!userId) {
      const authHeader = req.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)

      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          userId = payload.clerkUserId
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // 'purchase' | 'usage' | 'all'

    // Get user's organization
    const userOrgs = await sql`
      SELECT
        om.organization_id,
        u.id as user_id
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.clerk_user_id = ${userId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (!userOrgs || userOrgs.length === 0) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      )
    }

    const org = userOrgs[0]

    // Build WHERE clause for filtering
    let typeCondition = ''
    if (type && type !== 'all') {
      typeCondition = ` AND transaction_type = '${type}'`
    }

    // Get transactions
    const query = `
      SELECT
        t.id,
        t.organization_id,
        t.transaction_type,
        t.credits_amount,
        t.cost_amount,
        t.balance_after,
        t.description,
        t.recipient_phone,
        t.sms_type,
        t.message_preview,
        t.tallbob_message_id,
        t.delivery_status,
        t.related_invoice_id,
        t.related_quote_id,
        t.related_job_id,
        t.stripe_payment_intent_id,
        t.created_at,
        u.full_name as sender_name
      FROM sms_transactions t
      LEFT JOIN users u ON t.sender_user_id = u.id
      WHERE t.organization_id = $1
      ${typeCondition}
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const transactions = await sql(query, [org.organization_id, limit, offset])

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sms_transactions
      WHERE organization_id = $1
      ${typeCondition}
    `
    const countResult = await sql(countQuery, [org.organization_id])
    const total = parseInt(countResult[0].total)

    return NextResponse.json({
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching SMS transactions:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch transactions',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
