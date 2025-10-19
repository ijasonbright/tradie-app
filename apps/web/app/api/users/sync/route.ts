import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// POST - Sync current user's data from Clerk
export async function POST() {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    const email = clerkUser.emailAddresses?.[0]?.emailAddress || ''
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || null
    const emailUsername = email.split('@')[0]
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || emailUsername || 'Unknown User'

    // Update user in database
    const users = await sql`
      UPDATE users
      SET
        email = ${email},
        phone = ${phone},
        full_name = ${fullName},
        profile_photo_url = ${clerkUser.imageUrl || null},
        updated_at = NOW()
      WHERE clerk_user_id = ${clerkUserId}
      RETURNING *
    `

    if (users.length === 0) {
      // User doesn't exist, create them
      const newUsers = await sql`
        INSERT INTO users (
          clerk_user_id, email, phone, full_name, profile_photo_url, created_at, updated_at
        ) VALUES (
          ${clerkUserId},
          ${email},
          ${phone},
          ${fullName},
          ${clerkUser.imageUrl || null},
          NOW(),
          NOW()
        )
        RETURNING *
      `

      return NextResponse.json({
        success: true,
        user: newUsers[0],
        message: 'User created successfully',
      })
    }

    return NextResponse.json({
      success: true,
      user: users[0],
      message: 'User synced successfully',
    })
  } catch (error) {
    console.error('Error syncing user:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
