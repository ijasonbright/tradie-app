import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    message: 'Invoice send endpoints are deployed',
    timestamp: new Date().toISOString(),
  })
}
