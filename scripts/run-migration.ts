import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

// Load .env.local file (contains Vercel env vars)
config({ path: '.env.local' })

async function runMigration() {
  // Try to get DATABASE_URL from command line args, then env
  const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL

  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set')
    console.error('Usage: npm run migrate <DATABASE_URL>')
    console.error('Or set DATABASE_URL in .env.local file')
    process.exit(1)
  }

  console.log('Connecting to database...')
  const client = new Client({
    connectionString: DATABASE_URL,
  })

  try {
    await client.connect()
    console.log('Connected successfully!')

    // Read the migration file
    const migrationPath = join(__dirname, '../packages/database/migrations/0005_flimsy_galactus.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    console.log('Running migration: 0005_flimsy_galactus.sql (Reminder System)')
    console.log('Executing migration SQL...')

    // Execute the migration
    await client.query(migrationSQL)

    console.log('✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
