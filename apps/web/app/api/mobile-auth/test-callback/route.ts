import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    message: 'Mobile auth test-callback endpoint working!',
    timestamp: new Date().toISOString(),
    path: '/api/mobile-auth/test-callback'
  })
}
