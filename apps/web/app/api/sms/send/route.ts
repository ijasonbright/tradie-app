import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { tallbob, TallBobAPI } from '@/lib/sms/tallbob'

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

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { to, message, jobId, invoiceId, quoteId, smsType } = body

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Recipient phone number and message are required' },
        { status: 400 }
      )
    }

    // Get user's organization and check permissions
    const userOrgs = await sql`
      SELECT
        om.organization_id,
        om.role,
        o.sms_credits,
        o.sms_phone_number,
        u.id as user_id,
        u.full_name
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
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

    // Calculate credits needed
    const creditsNeeded = TallBobAPI.calculateCredits(message)

    // Check if organization has enough credits
    if (org.sms_credits < creditsNeeded) {
      return NextResponse.json(
        {
          error: 'Insufficient SMS credits',
          required: creditsNeeded,
          available: org.sms_credits
        },
        { status: 402 } // Payment Required
      )
    }

    if (!org.sms_phone_number) {
      return NextResponse.json(
        { error: 'Organization SMS phone number not configured' },
        { status: 400 }
      )
    }

    // Format phone number
    const formattedTo = TallBobAPI.formatPhoneNumber(to)

    // Send SMS via Tall Bob
    console.log('Sending SMS via Tall Bob:', {
      from: org.sms_phone_number,
      to: formattedTo,
      messageLength: message.length,
      credits: creditsNeeded
    })

    const result = await tallbob.sendSMS({
      from: org.sms_phone_number,
      to: formattedTo,
      message,
    })

    console.log('Tall Bob result:', result)

    if (!result.success) {
      console.error('Tall Bob SMS failed:', result.error)
      return NextResponse.json(
        {
          error: 'Failed to send SMS via Tall Bob',
          details: result.error || 'Unknown error from SMS provider'
        },
        { status: 500 }
      )
    }

    // Deduct credits from organization
    const newBalance = org.sms_credits - creditsNeeded

    await sql`
      UPDATE organizations
      SET sms_credits = ${newBalance}
      WHERE id = ${org.organization_id}
    `

    // Get or create conversation
    let conversation = await sql`
      SELECT id FROM sms_conversations
      WHERE organization_id = ${org.organization_id}
      AND phone_number = ${formattedTo}
      LIMIT 1
    `

    let conversationId

    if (conversation.length === 0) {
      // Create new conversation
      const newConversation = await sql`
        INSERT INTO sms_conversations (
          organization_id,
          phone_number,
          last_message_at,
          created_at,
          updated_at
        ) VALUES (
          ${org.organization_id},
          ${formattedTo},
          NOW(),
          NOW(),
          NOW()
        )
        RETURNING id
      `
      conversationId = newConversation[0].id
    } else {
      conversationId = conversation[0].id

      // Update last message time
      await sql`
        UPDATE sms_conversations
        SET last_message_at = NOW(), updated_at = NOW()
        WHERE id = ${conversationId}
      `
    }

    // Save message to database
    const savedMessage = await sql`
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
        job_id,
        invoice_id,
        quote_id,
        sent_at,
        created_at
      ) VALUES (
        ${conversationId},
        ${org.organization_id},
        'outbound',
        ${org.user_id},
        ${formattedTo},
        ${org.sms_phone_number},
        ${message},
        ${message.length},
        ${creditsNeeded},
        ${result.messageId},
        'sent',
        ${jobId || null},
        ${invoiceId || null},
        ${quoteId || null},
        NOW(),
        NOW()
      )
      RETURNING id
    `

    // Log transaction
    await sql`
      INSERT INTO sms_transactions (
        organization_id,
        transaction_type,
        credits_amount,
        cost_amount,
        balance_after,
        description,
        recipient_phone,
        sender_user_id,
        sms_type,
        message_preview,
        tallbob_message_id,
        delivery_status,
        related_invoice_id,
        related_quote_id,
        related_job_id,
        created_at
      ) VALUES (
        ${org.organization_id},
        'usage',
        ${-creditsNeeded},
        ${TallBobAPI.calculateCost(message)},
        ${newBalance},
        ${`SMS sent to ${formattedTo}`},
        ${formattedTo},
        ${org.user_id},
        ${smsType || 'manual'},
        ${message.substring(0, 50)},
        ${result.messageId},
        'sent',
        ${invoiceId || null},
        ${quoteId || null},
        ${jobId || null},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      messageId: savedMessage[0].id,
      tallbobMessageId: result.messageId,
      creditsUsed: creditsNeeded,
      creditsRemaining: newBalance,
    })
  } catch (error) {
    console.error('Error sending SMS:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      {
        error: 'Failed to send SMS',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
