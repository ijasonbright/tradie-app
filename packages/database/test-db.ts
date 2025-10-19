import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function testDatabase() {
  try {
    console.log('Testing database connection...')

    // Test 1: Check if users table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      );
    `
    console.log('Users table exists:', tableCheck[0].exists)

    // Test 2: Count users
    const countResult = await sql`
      SELECT COUNT(*) as count FROM users
    `
    console.log('User count:', countResult[0].count)

    // Test 3: Get recent users
    const users = await sql`
      SELECT id, email, full_name, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `
    console.log('Recent users:', users)

  } catch (error) {
    console.error('Database error:', error)
  }
}

testDatabase()
