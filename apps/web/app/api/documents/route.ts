import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Simple health check endpoint for /api/documents
export async function GET() {
  return NextResponse.json({
    message: 'Documents API is working',
    endpoints: {
      user: '/api/documents/user',
      organization: '/api/documents/organization',
      upload: '/api/documents/upload'
    }
  })
}
