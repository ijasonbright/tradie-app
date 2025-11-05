import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sendPushNotification } from '@/lib/push/send-push'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, message, data } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      )
    }

    const result = await sendPushNotification({
      userId,
      title,
      body: message,
      data: data || {},
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to send push notification',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Push notification sent successfully',
      tickets: result.tickets,
    })
  } catch (error) {
    console.error('Error in test push notification:', error)
    return NextResponse.json(
      {
        error: 'Failed to send test push notification',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
