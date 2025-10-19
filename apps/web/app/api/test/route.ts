import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { users } from '@tradie-app/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const db = drizzle(sql)

    // Try to query users table
    const allUsers = await db.select().from(users).limit(5)

    return NextResponse.json({
      success: true,
      message: 'Database connection successful!',
      userCount: allUsers.length,
      users: allUsers.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
      })),
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
