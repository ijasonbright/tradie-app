import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function POST(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Dual authentication: Clerk (web) or JWT (mobile)
    let userId: string | null = null

    // Try Clerk first (for web dashboard usage)
    try {
      const { userId: clerkUserId } = await auth()
      if (clerkUserId) {
        userId = clerkUserId
      }
    } catch {
      // Clerk auth failed, try mobile JWT
    }

    // If no Clerk auth, try mobile JWT
    if (!userId) {
      const token = extractTokenFromHeader(request.headers.get('authorization') || '')
      if (token) {
        const decoded = verifyMobileToken(token)
        userId = decoded.userId
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { expo_push_token } = body

    if (!expo_push_token || typeof expo_push_token !== 'string') {
      return NextResponse.json(
        { error: 'expo_push_token is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate Expo Push Token format
    if (!expo_push_token.startsWith('ExponentPushToken[') && !expo_push_token.startsWith('ExpoPushToken[')) {
      return NextResponse.json(
        { error: 'Invalid Expo Push Token format' },
        { status: 400 }
      )
    }

    // Update user's push token
    const result = await sql`
      UPDATE users
      SET 
        expo_push_token = ${expo_push_token},
        updated_at = NOW()
      WHERE clerk_user_id = ${userId}
      RETURNING id, expo_push_token
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Push token registered successfully',
      expo_push_token: result[0].expo_push_token
    })
  } catch (error) {
    console.error('Error registering push token:', error)
    return NextResponse.json(
      {
        error: 'Failed to register push token',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Dual authentication
    let userId: string | null = null

    try {
      const { userId: clerkUserId } = await auth()
      if (clerkUserId) {
        userId = clerkUserId
      }
    } catch {
      // Try mobile JWT
    }

    if (!userId) {
      const token = extractTokenFromHeader(request.headers.get('authorization') || '')
      if (token) {
        const decoded = verifyMobileToken(token)
        userId = decoded.userId
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Remove push token (for logout/unregister)
    await sql`
      UPDATE users
      SET 
        expo_push_token = NULL,
        updated_at = NOW()
      WHERE clerk_user_id = ${userId}
    `

    return NextResponse.json({
      success: true,
      message: 'Push token removed successfully'
    })
  } catch (error) {
    console.error('Error removing push token:', error)
    return NextResponse.json(
      {
        error: 'Failed to remove push token',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
