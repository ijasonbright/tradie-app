import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Simple test endpoint
export async function GET() {
  return NextResponse.json({ success: true, message: 'Share API is working' })
}
