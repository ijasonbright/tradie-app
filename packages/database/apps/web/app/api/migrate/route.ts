import { NextResponse } from 'next/server'
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      )
    }

    const sql = neon(process.env.DATABASE_URL)
    const db = drizzle(sql)

    // Run migrations from the migrations folder
    const migrationsFolder = join(process.cwd(), '../../packages/database/migrations')
    
    await migrate(db, { migrationsFolder })

    return NextResponse.json({
      message: 'Database schema updated successfully. Only new tables/columns were added.',
      success: true
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
