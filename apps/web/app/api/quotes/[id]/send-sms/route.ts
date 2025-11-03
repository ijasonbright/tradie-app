import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { tallbob, TallBobAPI } from '@/lib/sms/tallbob'

export const dynamic = 'force-dynamic'

// POST - Send quote via SMS
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
      const authHeader = req.headers.get('authorization')
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

    const userId = clerkUserId

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Parse request body
    const body = await req.json()
    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json({ error: 'Phone and message are required' }, { status: 400 })
    }

    // Get quote with organization check
    const quotes = await sql`
      SELECT q.*, o.name as organization_name, o.sms_credits, o.sms_phone_number,
             c.company_name, c.first_name, c.last_name, c.is_company
      FROM quotes q
      INNER JOIN organizations o ON q.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON q.client_id = c.id
      WHERE q.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Calculate SMS credits needed
    const messageLength = message.length
    const creditsNeeded = Math.ceil(messageLength / 160)

    // Check if organization has enough SMS credits
    const currentCredits = parseInt(quote.sms_credits || '0')
    if (currentCredits < creditsNeeded) {
      return NextResponse.json(
        { error: `Insufficient SMS credits. Need ${creditsNeeded}, have ${currentCredits}` },
        { status: 400 }
      )
    }

    // Format phone numbers
    const formattedTo = TallBobAPI.formatPhoneNumber(phone)
    const fromNumber = quote.sms_phone_number || process.env.TALLBOB_DEFAULT_FROM_NUMBER || ''

    if (!fromNumber) {
      return NextResponse.json(
        { error: 'Organization SMS phone number not configured' },
        { status: 400 }
      )
    }

    // Send SMS via Tall Bob
    const smsResult = await tallbob.sendSMS({
      from: fromNumber,
      to: formattedTo,
      message,
      messageId: `quote_${id}_${Date.now()}`,
    })

    if (!smsResult.success) {
      return NextResponse.json(
        { error: smsResult.error || 'Failed to send SMS' },
        { status: 500 }
      )
    }

    // Deduct SMS credits
    await sql`
      UPDATE organizations
      SET sms_credits = sms_credits - ${creditsNeeded}
      WHERE id = ${quote.organization_id}
    `

    // Log SMS transaction
    await sql`
      INSERT INTO sms_transactions (
        organization_id,
        transaction_type,
        credits_amount,
        balance_after,
        description,
        recipient_phone,
        sender_user_id,
        sms_type,
        message_preview,
        delivery_status,
        related_quote_id,
        tallbob_message_id
      ) VALUES (
        ${quote.organization_id},
        'usage',
        ${-creditsNeeded},
        ${currentCredits - creditsNeeded},
        'Quote sent via SMS',
        ${formattedTo},
        ${user.id},
        'quote',
        ${message.substring(0, 50)},
        'sent',
        ${id},
        ${smsResult.messageId}
      )
    `

    return NextResponse.json({
      success: true,
      message: 'Quote SMS sent successfully',
      creditsUsed: creditsNeeded,
      creditsRemaining: currentCredits - creditsNeeded,
      messageId: smsResult.messageId,
    })
  } catch (error) {
    console.error('Error sending quote SMS:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
