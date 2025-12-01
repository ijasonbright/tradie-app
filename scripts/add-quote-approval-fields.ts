import { neon } from '@neondatabase/serverless'

async function addQuoteApprovalFields() {
  const sql = neon(process.env.DATABASE_URL!)

  console.log('Adding quote approval response fields...')

  try {
    // Check if columns already exist
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quotes'
      AND column_name IN ('approval_response_at', 'approval_response_by')
    `

    const existingColumns = columns.map(c => c.column_name)

    if (!existingColumns.includes('approval_response_at')) {
      await sql`ALTER TABLE quotes ADD COLUMN approval_response_at TIMESTAMP`
      console.log('Added approval_response_at column')
    } else {
      console.log('approval_response_at column already exists')
    }

    if (!existingColumns.includes('approval_response_by')) {
      await sql`ALTER TABLE quotes ADD COLUMN approval_response_by VARCHAR(100)`
      console.log('Added approval_response_by column')
    } else {
      console.log('approval_response_by column already exists')
    }

    console.log('Done!')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

addQuoteApprovalFields()
