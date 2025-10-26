import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Show migration status and allow running from browser
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const run = searchParams.get('run')

  if (run === 'true') {
    // Run migrations via GET request
    return POST()
  }

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
      // ========== PENDING INVITATIONS TABLE ==========
      // Create pending_invitations table to store invitation data before user signup
      `CREATE TABLE IF NOT EXISTS pending_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
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
      )`,

      // Create indexes for pending_invitations
      `CREATE INDEX IF NOT EXISTS idx_pending_invitations_token ON pending_invitations(invitation_token)`,
      `CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON pending_invitations(email)`,
      `CREATE INDEX IF NOT EXISTS idx_pending_invitations_org ON pending_invitations(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pending_invitations_status ON pending_invitations(status) WHERE status = 'pending'`,

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

      // ========== TRADE TYPES MIGRATION ==========

      // Create trade_types table
      `CREATE TABLE IF NOT EXISTS trade_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(100) NOT NULL,
        client_hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
        client_daily_rate DECIMAL(10, 2),
        default_employee_cost DECIMAL(10, 2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(organization_id, name)
      )`,

      // Add trade-related columns to organization_members
      `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS primary_trade_id UUID REFERENCES trade_types(id)`,
      `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS rate_type VARCHAR(20) DEFAULT 'hourly'`,
      `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10, 2)`,

      // Add trade to jobs
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS trade_type_id UUID REFERENCES trade_types(id)`,

      // Enhance user_documents with verification
      `ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS document_category VARCHAR(50)`,
      `ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id)`,
      `ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP`,
      `ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS verification_notes TEXT`,
      `ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS ai_verification_status VARCHAR(50)`,
      `ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS ai_verification_notes TEXT`,
      `ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS ai_extracted_expiry_date DATE`,

      // Add job_type_id to trade_types
      `ALTER TABLE trade_types ADD COLUMN IF NOT EXISTS job_type_id INTEGER`,

      // Create standard_trade_types reference table
      `CREATE TABLE IF NOT EXISTS standard_trade_types (
        job_type_id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255)
      )`,

      // Insert standard trade types
      `INSERT INTO standard_trade_types (job_type_id, name, description) VALUES
        (12070, 'Air Conditioning', 'Air conditioning installation, repair, and maintenance'),
        (12022, 'Antennas', 'Antenna installation and repair services'),
        (3300, 'Appliance Repair', 'Household appliance repair and maintenance'),
        (3700, 'Bricklaying', 'Bricklaying and masonry services'),
        (12051, 'Cabinet Making', 'Custom cabinet design and installation'),
        (3900, 'Carpentry', 'General carpentry and woodworking services'),
        (12033, 'Carpet Cleaning', 'Professional carpet cleaning services'),
        (4000, 'Carpet Laying', 'Carpet installation and repair'),
        (4100, 'Cleaning', 'General cleaning services'),
        (4700, 'Electrical', 'Licensed electrical services'),
        (4800, 'Fencing', 'Fence installation and repair'),
        (12064, 'Glazing', 'Window and glass installation services'),
        (6500, 'Handyman', 'General handyman and maintenance services'),
        (6000, 'Landscaping', 'Landscape design and maintenance'),
        (6100, 'Lawn Mowing', 'Lawn mowing and garden maintenance'),
        (7200, 'Locksmithing', 'Lock installation and security services'),
        (7500, 'Painting', 'Interior and exterior painting services'),
        (10600, 'Pest Control', 'Pest inspection and treatment services'),
        (7900, 'Plastering', 'Plastering and rendering services'),
        (2600, 'Plumbing', 'Licensed plumbing services'),
        (8300, 'Roofing', 'Roof installation, repair, and maintenance'),
        (9400, 'Tiling', 'Floor and wall tiling services')
      ON CONFLICT (job_type_id) DO NOTHING`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_trade_types_org ON trade_types(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trade_types_active ON trade_types(organization_id, is_active) WHERE is_active = true`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_trade_type ON jobs(trade_type_id)`,

      // Drop old unique constraint on organization_id + name
      `ALTER TABLE trade_types DROP CONSTRAINT IF EXISTS trade_types_organization_id_name_key`,

      // Add new unique constraint on organization_id + job_type_id
      `ALTER TABLE trade_types ADD CONSTRAINT trade_types_organization_id_job_type_id_key
       UNIQUE(organization_id, job_type_id)`,

      // Create "General" trade for each organization from their default rates
      `INSERT INTO trade_types (organization_id, job_type_id, name, client_hourly_rate, default_employee_cost, is_active)
       SELECT id, 9999, 'General', COALESCE(default_hourly_rate, 0), COALESCE(default_employee_cost, 0), true
       FROM organizations
       WHERE NOT EXISTS (
         SELECT 1 FROM trade_types
         WHERE trade_types.organization_id = organizations.id AND (trade_types.name = 'General' OR trade_types.job_type_id = 9999)
       )`,

      // Update existing trade types to match job_type_id where possible
      `UPDATE trade_types t
       SET job_type_id = s.job_type_id
       FROM standard_trade_types s
       WHERE LOWER(t.name) = LOWER(s.name)
       AND t.job_type_id IS NULL`,

      // Link existing team members to General trade
      `UPDATE organization_members om
       SET primary_trade_id = (
         SELECT id FROM trade_types tt
         WHERE tt.organization_id = om.organization_id AND tt.name = 'General'
         LIMIT 1
       )
       WHERE primary_trade_id IS NULL`,

      // Add comprehensive pricing fields
      `ALTER TABLE trade_types ADD COLUMN IF NOT EXISTS client_first_hour_rate DECIMAL(10, 2)`,
      `ALTER TABLE trade_types ADD COLUMN IF NOT EXISTS client_callout_fee DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE trade_types ADD COLUMN IF NOT EXISTS client_after_hours_callout_fee DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE trade_types ADD COLUMN IF NOT EXISTS client_after_hours_extra_percent DECIMAL(5, 2) DEFAULT 0`,
      `ALTER TABLE trade_types ADD COLUMN IF NOT EXISTS default_employee_hourly_rate DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE trade_types ADD COLUMN IF NOT EXISTS default_employee_daily_rate DECIMAL(10, 2)`,

      // Migrate old default_employee_cost to new default_employee_hourly_rate
      `UPDATE trade_types
       SET default_employee_hourly_rate = default_employee_cost
       WHERE (default_employee_hourly_rate IS NULL OR default_employee_hourly_rate = 0)
       AND default_employee_cost IS NOT NULL AND default_employee_cost > 0`,

      // ========== CALENDAR & EXPENSES MIGRATION ==========

      // Create appointments table
      `CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        appointment_type VARCHAR(50) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        all_day BOOLEAN DEFAULT false,
        job_id UUID REFERENCES jobs(id),
        client_id UUID REFERENCES clients(id),
        assigned_to_user_id UUID REFERENCES users(id) NOT NULL,
        created_by_user_id UUID REFERENCES users(id) NOT NULL,
        location_address TEXT,
        reminder_minutes_before VARCHAR(50),
        reminder_sent_at TIMESTAMP,
        is_recurring BOOLEAN DEFAULT false,
        recurrence_rule TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create expenses table
      `CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        user_id UUID REFERENCES users(id) NOT NULL,
        job_id UUID REFERENCES jobs(id),
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        gst_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        receipt_url TEXT,
        expense_date TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' NOT NULL,
        approved_by_user_id UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        reimbursed_at TIMESTAMP,
        xero_expense_id VARCHAR(255),
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Add new expense columns for AI receipt scanning and accounting integration
      `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255)`,
      `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_code VARCHAR(50)`,

      // Create indexes for better query performance
      `CREATE INDEX IF NOT EXISTS appointments_organization_id_idx ON appointments(organization_id)`,
      `CREATE INDEX IF NOT EXISTS appointments_assigned_to_user_id_idx ON appointments(assigned_to_user_id)`,
      `CREATE INDEX IF NOT EXISTS appointments_start_time_idx ON appointments(start_time)`,
      `CREATE INDEX IF NOT EXISTS appointments_job_id_idx ON appointments(job_id)`,
      `CREATE INDEX IF NOT EXISTS expenses_organization_id_idx ON expenses(organization_id)`,
      `CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses(user_id)`,
      `CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses(status)`,
      `CREATE INDEX IF NOT EXISTS expenses_job_id_idx ON expenses(job_id)`,

      // ========== XERO INTEGRATION ==========

      // Create xero_connections table
      `CREATE TABLE IF NOT EXISTS xero_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
        tenant_id VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        connected_at TIMESTAMP DEFAULT NOW() NOT NULL,
        last_sync_at TIMESTAMP,
        sync_contacts BOOLEAN DEFAULT true,
        sync_invoices BOOLEAN DEFAULT true,
        sync_expenses BOOLEAN DEFAULT true,
        sync_bills BOOLEAN DEFAULT true,
        auto_sync_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS xero_connections_organization_id_idx ON xero_connections(organization_id)`,
      `CREATE INDEX IF NOT EXISTS xero_connections_tenant_id_idx ON xero_connections(tenant_id)`,

      // ========== SMS SYSTEM ==========

      // SMS Transactions - Track all SMS credits (purchases and usage)
      `CREATE TABLE IF NOT EXISTS sms_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'adjustment', 'refund')),
        credits_amount INTEGER NOT NULL,
        cost_amount DECIMAL(10, 2) DEFAULT 0,
        balance_after INTEGER NOT NULL,
        description TEXT,
        recipient_phone VARCHAR(20),
        sender_user_id UUID REFERENCES users(id),
        sms_type VARCHAR(50),
        message_preview TEXT,
        tallbob_message_id VARCHAR(255),
        delivery_status VARCHAR(50),
        related_invoice_id UUID REFERENCES invoices(id),
        related_quote_id UUID REFERENCES quotes(id),
        related_job_id UUID REFERENCES jobs(id),
        stripe_payment_intent_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // SMS Conversations - Thread SMS messages by phone number
      `CREATE TABLE IF NOT EXISTS sms_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        client_id UUID REFERENCES clients(id),
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(organization_id, phone_number)
      )`,

      // SMS Messages - Individual messages in conversations
      `CREATE TABLE IF NOT EXISTS sms_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES sms_conversations(id) ON DELETE CASCADE NOT NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        direction VARCHAR(20) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
        sender_user_id UUID REFERENCES users(id),
        recipient_phone VARCHAR(20),
        sender_phone VARCHAR(20),
        message_body TEXT NOT NULL,
        character_count INTEGER NOT NULL,
        credits_used INTEGER DEFAULT 0,
        tallbob_message_id VARCHAR(255) UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        job_id UUID REFERENCES jobs(id),
        invoice_id UUID REFERENCES invoices(id),
        quote_id UUID REFERENCES quotes(id),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Tall Bob Webhooks - Log all webhook events
      `CREATE TABLE IF NOT EXISTS tallbob_webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_type VARCHAR(50) NOT NULL,
        tallbob_message_id VARCHAR(255),
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // SMS Templates - Customizable SMS templates
      `CREATE TABLE IF NOT EXISTS sms_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        template_type VARCHAR(50) NOT NULL,
        message_template TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(organization_id, template_type, is_default)
      )`,

      // Add bank details to organizations table
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_bsb VARCHAR(10)`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50)`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255)`,

      // Add SMS credits to organizations table
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sms_credits INTEGER DEFAULT 0`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sms_phone_number VARCHAR(20)`,

      // Create indexes for SMS tables
      `CREATE INDEX IF NOT EXISTS sms_transactions_organization_id_idx ON sms_transactions(organization_id)`,
      `CREATE INDEX IF NOT EXISTS sms_transactions_created_at_idx ON sms_transactions(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS sms_conversations_organization_id_idx ON sms_conversations(organization_id)`,
      `CREATE INDEX IF NOT EXISTS sms_conversations_phone_number_idx ON sms_conversations(phone_number)`,
      `CREATE INDEX IF NOT EXISTS sms_messages_conversation_id_idx ON sms_messages(conversation_id)`,
      `CREATE INDEX IF NOT EXISTS sms_messages_organization_id_idx ON sms_messages(organization_id)`,
      `CREATE INDEX IF NOT EXISTS sms_messages_created_at_idx ON sms_messages(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS sms_messages_tallbob_message_id_idx ON sms_messages(tallbob_message_id)`,
      `CREATE INDEX IF NOT EXISTS tallbob_webhooks_processed_idx ON tallbob_webhooks(processed)`,
      `CREATE INDEX IF NOT EXISTS tallbob_webhooks_created_at_idx ON tallbob_webhooks(created_at DESC)`,
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
