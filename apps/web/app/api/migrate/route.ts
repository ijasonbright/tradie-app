import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Show migration status and allow running from browser
export async function GET() {
  return NextResponse.json({
    message: 'Database Migration Endpoint',
    instructions: 'Send a POST request to this endpoint to run migrations, or add ?run=true to this URL',
    endpoint: '/api/migrate',
    method: 'POST or GET with ?run=true',
  })
}

// This endpoint runs the database migration
// Call it once to update the schema
export async function POST() {
  try {
    const sql = neon(process.env.DATABASE_URL!)

    const migrations = [
      // Add default rates to organizations
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_employee_cost DECIMAL(10, 2) DEFAULT 0`,

      // Add employment type and rates to organization_members
      `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'employee'`,
      `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS billing_rate DECIMAL(10, 2)`,
      `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS leave_balance_hours DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS available_for_scheduling BOOLEAN DEFAULT true`,

      // Add job scheduling fields
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration_hours DECIMAL(5, 2)`,
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_duration_hours DECIMAL(5, 2)`,
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER DEFAULT 0`,
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_latitude DECIMAL(10, 8)`,
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_longitude DECIMAL(11, 8)`,
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS site_place_id VARCHAR(255)`,

      // Create team_member_unavailability table
      `CREATE TABLE IF NOT EXISTS team_member_unavailability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        unavailability_type VARCHAR(50) NOT NULL,
        start_datetime TIMESTAMP NOT NULL,
        end_datetime TIMESTAMP NOT NULL,
        all_day BOOLEAN DEFAULT false,
        notes TEXT,
        approved_by_user_id UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_unavailability_user_dates ON team_member_unavailability(user_id, start_datetime, end_datetime)`,
      `CREATE INDEX IF NOT EXISTS idx_unavailability_org_dates ON team_member_unavailability(organization_id, start_datetime, end_datetime)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(site_latitude, site_longitude) WHERE site_latitude IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_dates ON jobs(scheduled_start_time, scheduled_end_time) WHERE scheduled_start_time IS NOT NULL`,

      // Update existing data
      `UPDATE organization_members SET employment_type = 'subcontractor' WHERE role = 'subcontractor'`,
      `UPDATE organization_members SET employment_type = 'employee' WHERE role != 'subcontractor'`,
      `UPDATE organization_members SET billing_rate = hourly_rate WHERE hourly_rate IS NOT NULL AND billing_rate IS NULL`,
    ]

    const results = []
    for (const migration of migrations) {
      try {
        await sql(migration)
        results.push({ statement: migration.substring(0, 100) + '...', status: 'success' })
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          results.push({ statement: migration.substring(0, 100) + '...', status: 'skipped (already exists)' })
        } else {
          results.push({ statement: migration.substring(0, 100) + '...', status: 'error', error: error.message })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
