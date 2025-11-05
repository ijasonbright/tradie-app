import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { neon } from '@neondatabase/serverless'
import { Expo, ExpoPushMessage } from 'expo-server-sdk'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
const expo = new Expo()

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
        const decoded = await verifyMobileToken(token)
        if (decoded) {
          userId = decoded.clerkUserId
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's push token
    const users = await sql`
      SELECT expo_push_token, full_name
      FROM users
      WHERE clerk_user_id = ${userId}
    `

    if (users.length === 0 || !users[0].expo_push_token) {
      return NextResponse.json(
        { error: 'No push token registered for this user' },
        { status: 404 }
      )
    }

    const pushToken = users[0].expo_push_token
    const fullName = users[0].full_name

    // Validate the push token
    if (!Expo.isExpoPushToken(pushToken)) {
      return NextResponse.json(
        { error: 'Invalid Expo push token format' },
        { status: 400 }
      )
    }

    // Create the push notification message
    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title: 'Test Notification 🔔',
      body: `Hi ${fullName}! Your push notifications are working perfectly.`,
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
      priority: 'high',
    }

    // Send the notification
    const chunks = expo.chunkPushNotifications([message])
    const tickets = []

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
        tickets.push(...ticketChunk)
      } catch (error) {
        console.error('Error sending push notification chunk:', error)
      }
    }

    // Check for errors in tickets
    const errors = tickets.filter(ticket => ticket.status === 'error')
    if (errors.length > 0) {
      console.error('Push notification errors:', errors)
      return NextResponse.json({
        success: false,
        message: 'Push notification sent with errors',
        tickets,
        errors,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully!',
      pushToken,
      tickets,
    })
  } catch (error) {
    console.error('Error sending test notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
