import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authResult = await auth()

  return NextResponse.json({
    test: 'working',
    authenticated: !!authResult.userId,
    userId: authResult.userId || null,
  })
}
