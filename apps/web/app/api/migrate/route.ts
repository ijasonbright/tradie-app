import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function GET(request: NextRequest) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Check if we should actually run the migration
    const { searchParams } = new URL(request.url)
    const runMigration = searchParams.get('run') === 'true'

    if (!runMigration) {
      return NextResponse.json({
        message: 'Migration endpoint ready. Add ?run=true to execute.',
      })
    }

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

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_pending_invitations_token ON pending_invitations(invitation_token)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON pending_invitations(email)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pending_invitations_org ON pending_invitations(organization_id)`

    console.log('Migration completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      tables_created: ['pending_invitations'],
      indexes_created: [
        'idx_pending_invitations_token',
        'idx_pending_invitations_email',
        'idx_pending_invitations_org',
      ],
    })
  } catch (error) {
    console.error('Migration error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Migration failed', details: errorMessage },
      { status: 500 }
    )
  }
}
