import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '')

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occurred', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data

    try {
      // Create user in our database
      await db.insert(users).values({
        clerkUserId: id,
        email: email_addresses[0]?.email_address ?? '',
        fullName: `${first_name ?? ''} ${last_name ?? ''}`.trim() || 'User',
        phone: phone_numbers[0]?.phone_number,
        profilePhotoUrl: image_url,
      })

      console.log('User created:', id)
    } catch (error) {
      console.error('Error creating user:', error)
      return new Response('Error creating user', { status: 500 })
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data

    try {
      // Update user in our database
      await db
        .update(users)
        .set({
          email: email_addresses[0]?.email_address ?? '',
          fullName: `${first_name ?? ''} ${last_name ?? ''}`.trim() || 'User',
          phone: phone_numbers[0]?.phone_number,
          profilePhotoUrl: image_url,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkUserId, id))

      console.log('User updated:', id)
    } catch (error) {
      console.error('Error updating user:', error)
      return new Response('Error updating user', { status: 500 })
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data

    try {
      // Delete user from our database
      await db.delete(users).where(eq(users.clerkUserId, id!))

      console.log('User deleted:', id)
    } catch (error) {
      console.error('Error deleting user:', error)
      return new Response('Error deleting user', { status: 500 })
    }
  }

  return new Response('', { status: 200 })
}
