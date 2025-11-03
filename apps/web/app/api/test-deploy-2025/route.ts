import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    status: 'success',
    message: 'Test deploy endpoint working',
    timestamp: new Date().toISOString(),
  })
}
