import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

    if (!WEBHOOK_SECRET) {
      throw new Error('Please add CLERK_WEBHOOK_SECRET to your environment variables')
    }

    // Get headers
    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
    }

    // Get body
    const payload = await req.json()
    const body = JSON.stringify(payload)

    // Verify webhook
    const wh = new Webhook(WEBHOOK_SECRET)
    let evt: any

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as any
    } catch (err) {
      console.error('Error verifying webhook:', err)
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 })
    }

    // Handle the webhook
    const eventType = evt.type
    const sql = neon(process.env.DATABASE_URL!)

    if (eventType === 'user.created' || eventType === 'user.updated') {
      const { id, email_addresses, phone_numbers, first_name, last_name, image_url } = evt.data

      const email = email_addresses?.[0]?.email_address || ''
      const phone = phone_numbers?.[0]?.phone_number || null
      // Use email username as fallback if no name is provided
      const emailUsername = email.split('@')[0]
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || emailUsername || 'Unknown User'

      // Check if user already exists
      const existingUsers = await sql`
        SELECT * FROM users WHERE clerk_user_id = ${id} LIMIT 1
      `

      if (existingUsers.length === 0) {
        // Create new user
        await sql`
          INSERT INTO users (
            clerk_user_id, email, phone, full_name, profile_photo_url, created_at, updated_at
          ) VALUES (
            ${id},
            ${email},
            ${phone},
            ${fullName},
            ${image_url || null},
            NOW(),
            NOW()
          )
        `
        console.log('Created user:', id, email)
      } else {
        // Update existing user
        await sql`
          UPDATE users
          SET
            email = ${email},
            phone = ${phone},
            full_name = ${fullName},
            profile_photo_url = ${image_url || null},
            updated_at = NOW()
          WHERE clerk_user_id = ${id}
        `
        console.log('Updated user:', id, email)
      }
    } else if (eventType === 'user.deleted') {
      const { id } = evt.data

      await sql`
        DELETE FROM users WHERE clerk_user_id = ${id}
      `
      console.log('Deleted user:', id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
