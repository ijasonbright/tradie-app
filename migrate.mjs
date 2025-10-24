import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, 'apps/web/.env.local') })

const sql = neon(process.env.DATABASE_URL)

async function runMigration() {
  try {
    console.log('Running migration...')

    // Create pending_invitations table
    await sql`
      CREATE TABLE IF NOT EXISTS pending_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL CHECK (role IN ('employee', 'subcontractor', 'admin')),
        employment_type TEXT,
        primary_trade_id UUID REFERENCES trade_types(id),
        hourly_rate DECIMAL(10, 2),
        billing_rate DECIMAL(10, 2),
        invitation_token TEXT NOT NULL UNIQUE,
        invitation_sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
        can_create_jobs BOOLEAN DEFAULT FALSE,
        can_edit_all_jobs BOOLEAN DEFAULT FALSE,
        can_create_invoices BOOLEAN DEFAULT FALSE,
        can_view_financials BOOLEAN DEFAULT FALSE,
        can_approve_expenses BOOLEAN DEFAULT FALSE,
        can_approve_timesheets BOOLEAN DEFAULT FALSE,
        requires_trade_license BOOLEAN DEFAULT FALSE,
        requires_police_check BOOLEAN DEFAULT FALSE,
        requires_working_with_children BOOLEAN DEFAULT FALSE,
        requires_public_liability BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    console.log('✓ Table created')

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_pending_invitations_token ON pending_invitations(invitation_token)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON pending_invitations(email)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pending_invitations_org ON pending_invitations(organization_id)`

    console.log('✓ Indexes created')
    console.log('\n✓ Migration completed successfully')
  } catch (error) {
    console.error('Migration error:', error.message)
    process.exit(1)
  }
}

runMigration()
