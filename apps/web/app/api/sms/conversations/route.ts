import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const userOrgs = await sql`
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = (
        SELECT id FROM users WHERE clerk_user_id = ${userId}
      )
      AND om.status = 'active'
      LIMIT 1
    `

    if (!userOrgs || userOrgs.length === 0) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      )
    }

    const orgId = userOrgs[0].organization_id

    // Get all conversations with last message
    const conversations = await sql`
      SELECT
        sc.id,
        sc.phone_number,
        c.company_name || ' ' || c.first_name || ' ' || c.last_name as client_name,
        sc.last_message_at,
        (
          SELECT message_body
          FROM sms_messages
          WHERE conversation_id = sc.id
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*)
          FROM sms_messages
          WHERE conversation_id = sc.id
          AND direction = 'inbound'
          AND read_at IS NULL
        ) as unread_count
      FROM sms_conversations sc
      LEFT JOIN clients c ON c.id = sc.client_id
      WHERE sc.organization_id = ${orgId}
      ORDER BY sc.last_message_at DESC
    `

    return NextResponse.json({
      conversations,
    })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
