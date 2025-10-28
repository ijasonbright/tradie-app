import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Mobile Authentication - Verify Token
 * Verifies the JWT session token and returns user data
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify JWT token
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    )

    const { payload } = await jwtVerify(token, secret)

    // Get user from database
    const sql = neon(process.env.DATABASE_URL!)
    const users = await sql`
      SELECT * FROM users WHERE id = ${payload.userId as string} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = users[0]

    return NextResponse.json({
      user: {
        id: user.id,
        clerkUserId: user.clerk_user_id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        profilePhotoUrl: user.profile_photo_url,
      },
    })

  } catch (error) {
    console.error('Mobile auth verify error:', error)
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    )
  }
}
