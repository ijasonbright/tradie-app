import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Simple health check endpoint for /api/documents
export async function GET() {
  return NextResponse.json({
    message: 'Documents API is working',
    endpoints: {
      user: '/api/docs/user',
      organization: '/api/docs/organization',
      upload: '/api/docs/upload'
    }
  })
}
