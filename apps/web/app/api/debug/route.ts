import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hasDbUrl = !!process.env.DATABASE_URL

    if (!hasDbUrl) {
      return NextResponse.json({
        error: 'DATABASE_URL not set',
        hasDbUrl,
      })
    }

    const sql = neon(process.env.DATABASE_URL!)

    const result = await sql`SELECT 1 as test`

    return NextResponse.json({
      success: true,
      hasDbUrl,
      testQuery: result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
