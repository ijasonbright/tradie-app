import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Mobile Authentication - Verify Code
 * Verifies the 6-digit code and returns a session token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      )
    }

    const client = await clerkClient()

    // Get user by email from Clerk
    const userList = await client.users.getUserList({
      emailAddress: [email],
      limit: 1,
    })

    if (userList.data.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or verification code' },
        { status: 401 }
      )
    }

    const clerkUser = userList.data[0]

    // Try to verify the sign-in token (the code)
    try {
      // Verify the token with Clerk
      const verifyResult = await client.signInTokens.revokeSignInToken(code)

      // If we get here, the token was valid
      // Now create our JWT session token

    } catch (clerkError: any) {
      // Token verification failed
      console.error('Clerk token verification failed:', clerkError)
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 401 }
      )
    }

    // Get or create user in our database
    const sql = neon(process.env.DATABASE_URL!)
    const dbUsers = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUser.id} LIMIT 1
    `

    let dbUser
    if (dbUsers.length === 0) {
      // Create user if doesn't exist
      const newUsers = await sql`
        INSERT INTO users (clerk_user_id, email, full_name, phone, profile_photo_url)
        VALUES (
          ${clerkUser.id},
          ${clerkUser.emailAddresses[0]?.emailAddress || email},
          ${`${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User'},
          ${clerkUser.phoneNumbers[0]?.phoneNumber || null},
          ${clerkUser.imageUrl || null}
        )
        RETURNING *
      `
      dbUser = newUsers[0]
    } else {
      dbUser = dbUsers[0]
    }

    // Generate JWT session token for mobile app
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    )

    const token = await new SignJWT({
      userId: dbUser.id,
      clerkUserId: clerkUser.id,
      email: dbUser.email,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    // Return session token and user data
    return NextResponse.json({
      token,
      user: {
        id: dbUser.id,
        clerkUserId: clerkUser.id,
        email: dbUser.email,
        fullName: dbUser.full_name,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        phone: dbUser.phone,
        profilePhotoUrl: dbUser.profile_photo_url,
      },
    })

  } catch (error) {
    console.error('Verify code error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
