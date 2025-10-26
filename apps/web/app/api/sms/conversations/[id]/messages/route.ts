import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: conversationId } = await params

    // Verify user has access to this conversation
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

    // Verify conversation belongs to organization
    const conversations = await sql`
      SELECT id FROM sms_conversations
      WHERE id = ${conversationId}
      AND organization_id = ${orgId}
    `

    if (conversations.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get messages
    const messages = await sql`
      SELECT
        sm.id,
        sm.direction,
        sm.message_body,
        sm.created_at,
        sm.status,
        u.full_name as sender_name
      FROM sms_messages sm
      LEFT JOIN users u ON u.id = sm.sender_user_id
      WHERE sm.conversation_id = ${conversationId}
      ORDER BY sm.created_at ASC
    `

    // Mark inbound messages as read
    await sql`
      UPDATE sms_messages
      SET read_at = NOW()
      WHERE conversation_id = ${conversationId}
      AND direction = 'inbound'
      AND read_at IS NULL
    `

    return NextResponse.json({
      messages,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
