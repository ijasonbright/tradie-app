import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authResult = await auth()

    return NextResponse.json({
      authenticated: !!authResult.userId,
      userId: authResult.userId || null,
      sessionId: authResult.sessionId || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      authenticated: false,
    }, { status: 500 })
  }
}
