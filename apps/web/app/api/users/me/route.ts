import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - Get current user profile
export async function GET(req: Request) {
  try {
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

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT
        id,
        clerk_user_id,
        email,
        phone,
        full_name,
        profile_photo_url,
        sms_phone_number,
        created_at,
        updated_at
      FROM users
      WHERE clerk_user_id = ${clerkUserId}
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: users[0] })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT - Update current user profile
export async function PUT(req: Request) {
  try {
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

    const sql = neon(process.env.DATABASE_URL!)
    const body = await req.json()

    // Get user from database with current values
    const users = await sql`
      SELECT id, phone, profile_photo_url, sms_phone_number
      FROM users
      WHERE clerk_user_id = ${clerkUserId}
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Update user profile
    const updatedUsers = await sql`
      UPDATE users
      SET
        full_name = COALESCE(${body.fullName}, full_name),
        phone = ${body.phone !== undefined ? body.phone : user.phone},
        profile_photo_url = ${body.profilePhotoUrl !== undefined ? body.profilePhotoUrl : user.profile_photo_url},
        sms_phone_number = ${body.smsPhoneNumber !== undefined ? body.smsPhoneNumber : user.sms_phone_number},
        updated_at = NOW()
      WHERE id = ${user.id}
      RETURNING
        id,
        clerk_user_id,
        email,
        phone,
        full_name,
        profile_photo_url,
        sms_phone_number,
        created_at,
        updated_at
    `

    return NextResponse.json({
      success: true,
      user: updatedUsers[0],
    })
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
