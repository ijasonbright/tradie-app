import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!)

    const result = await sql`
      SELECT COUNT(*) as count FROM users
    `

    const users = await sql`
      SELECT id, email, full_name, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `

    return NextResponse.json({
      success: true,
      totalUsers: result[0].count,
      recentUsers: users,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
