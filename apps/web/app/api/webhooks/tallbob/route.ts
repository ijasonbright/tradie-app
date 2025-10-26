import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { tallbob } from '@/lib/sms/tallbob'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function POST(req: Request) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await req.text()
    const signature = req.headers.get('x-tallbob-signature')

    // Verify webhook signature
    if (signature && process.env.TALLBOB_WEBHOOK_SECRET) {
      const isValid = tallbob.verifyWebhookSignature(
        body,
        signature,
        process.env.TALLBOB_WEBHOOK_SECRET
      )

      if (!isValid) {
        console.error('Invalid Tall Bob webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(body)

    // Log the webhook
    const webhookLog = await sql`
      INSERT INTO tallbob_webhooks (
        webhook_type,
        tallbob_message_id,
        payload,
        processed,
        created_at
      ) VALUES (
        ${payload.type || 'unknown'},
        ${payload.messageId || null},
        ${JSON.stringify(payload)},
        false,
        NOW()
      )
      RETURNING id
    `

    const webhookId = webhookLog[0].id

    // Handle different webhook types
    if (payload.type === 'inbound_message' || payload.event === 'message.received') {
      // Inbound SMS from client
      await handleInboundMessage(payload, webhookId)
    } else if (payload.type === 'delivery_status' || payload.event === 'message.status') {
      // Delivery status update
      await handleDeliveryStatus(payload, webhookId)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Tall Bob webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function handleInboundMessage(payload: any, webhookId: string) {
  if (!sql) return

  const { from, to, body: messageBody, messageId, receivedAt } = payload

  try {
    // Find which organization this SMS number belongs to
    const orgs = await sql`
      SELECT id, sms_phone_number
      FROM organizations
      WHERE sms_phone_number = ${to}
      LIMIT 1
    `

    if (orgs.length === 0) {
      console.error('No organization found for phone number:', to)
      return
    }

    const organizationId = orgs[0].id

    // Try to find existing client by phone number
    const clients = await sql`
      SELECT id FROM clients
      WHERE organization_id = ${organizationId}
      AND (phone = ${from} OR mobile = ${from})
      LIMIT 1
    `

    const clientId = clients.length > 0 ? clients[0].id : null

    // Get or create conversation
    let conversation = await sql`
      SELECT id FROM sms_conversations
      WHERE organization_id = ${organizationId}
      AND phone_number = ${from}
      LIMIT 1
    `

    let conversationId

    if (conversation.length === 0) {
      // Create new conversation
      const newConversation = await sql`
        INSERT INTO sms_conversations (
          organization_id,
          phone_number,
          client_id,
          last_message_at,
          created_at,
          updated_at
        ) VALUES (
          ${organizationId},
          ${from},
          ${clientId},
          NOW(),
          NOW(),
          NOW()
        )
        RETURNING id
      `
      conversationId = newConversation[0].id
    } else {
      conversationId = conversation[0].id

      // Update conversation
      await sql`
        UPDATE sms_conversations
        SET
          client_id = COALESCE(client_id, ${clientId}),
          last_message_at = NOW(),
          updated_at = NOW()
        WHERE id = ${conversationId}
      `
    }

    // Save inbound message
    await sql`
      INSERT INTO sms_messages (
        conversation_id,
        organization_id,
        direction,
        sender_user_id,
        recipient_phone,
        sender_phone,
        message_body,
        character_count,
        credits_used,
        tallbob_message_id,
        status,
        sent_at,
        created_at
      ) VALUES (
        ${conversationId},
        ${organizationId},
        'inbound',
        NULL,
        ${to},
        ${from},
        ${messageBody},
        ${messageBody.length},
        0,
        ${messageId},
        'received',
        ${receivedAt || new Date().toISOString()},
        NOW()
      )
    `

    // Mark webhook as processed
    await sql`
      UPDATE tallbob_webhooks
      SET processed = true, processed_at = NOW()
      WHERE id = ${webhookId}
    `

    console.log(`Inbound SMS processed: ${from} -> ${to}`)
  } catch (error) {
    console.error('Error handling inbound message:', error)
    throw error
  }
}

async function handleDeliveryStatus(payload: any, webhookId: string) {
  if (!sql) return

  const { messageId, status, deliveredAt, error } = payload

  try {
    // Update message status
    const updated = await sql`
      UPDATE sms_messages
      SET
        status = ${status},
        delivered_at = ${deliveredAt || null}
      WHERE tallbob_message_id = ${messageId}
      RETURNING id, organization_id
    `

    if (updated.length > 0) {
      // Update transaction delivery status
      await sql`
        UPDATE sms_transactions
        SET delivery_status = ${status}
        WHERE tallbob_message_id = ${messageId}
      `

      console.log(`Updated delivery status for message ${messageId}: ${status}`)
    }

    // Mark webhook as processed
    await sql`
      UPDATE tallbob_webhooks
      SET processed = true, processed_at = NOW()
      WHERE id = ${webhookId}
    `
  } catch (error) {
    console.error('Error handling delivery status:', error)
    throw error
  }
}
