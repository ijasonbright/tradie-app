import { Client } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function fixQuoteLineItems() {
  const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL

  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set')
    console.error('Usage: tsx scripts/fix-quote-line-items.ts <DATABASE_URL>')
    process.exit(1)
  }

  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('Connected to database')

    // Add created_at column if it doesn't exist
    console.log('Adding created_at column to quote_line_items...')
    await client.query(`
      ALTER TABLE quote_line_items
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
    `)

    console.log('✅ Fixed quote_line_items table')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

fixQuoteLineItems()
