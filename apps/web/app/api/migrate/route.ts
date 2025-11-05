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

      // Add branding to organizations table
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7)`,

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

      // ========== PRICING TYPE & QUOTE VARIATIONS ==========

      // Add billing_amount to job_time_logs for client billing rate
      `ALTER TABLE job_time_logs ADD COLUMN IF NOT EXISTS billing_amount DECIMAL(10, 2)`,

      // Add pricing_type to jobs table
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(50) DEFAULT 'time_and_materials'`,

      // Update existing jobs based on whether they have a quote
      `UPDATE jobs
       SET pricing_type = CASE
         WHEN quote_id IS NOT NULL THEN 'fixed_price'
         ELSE 'time_and_materials'
       END
       WHERE pricing_type IS NULL OR pricing_type = 'time_and_materials'`,

      // Create quote_variations table
      `CREATE TABLE IF NOT EXISTS quote_variations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id UUID NOT NULL,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        variation_number VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
        gst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        approved_by_client_at TIMESTAMP,
        rejected_by_client_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,

      // Create quote_variation_line_items table
      `CREATE TABLE IF NOT EXISTS quote_variation_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        variation_id UUID NOT NULL REFERENCES quote_variations(id) ON DELETE CASCADE,
        item_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
        unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        gst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        line_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
        line_order INTEGER NOT NULL DEFAULT 0
      )`,

      // Create indexes for quote variations
      `CREATE INDEX IF NOT EXISTS idx_quote_variations_quote_id ON quote_variations(quote_id)`,
      `CREATE INDEX IF NOT EXISTS idx_quote_variations_job_id ON quote_variations(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_quote_variations_organization_id ON quote_variations(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_quote_variations_status ON quote_variations(status)`,
      `CREATE INDEX IF NOT EXISTS idx_quote_variation_line_items_variation_id ON quote_variation_line_items(variation_id)`,

      // ========== SUBCONTRACTOR PAYMENTS ==========

      // Create subcontractor_payments table
      `CREATE TABLE IF NOT EXISTS subcontractor_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        subcontractor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payment_period_start DATE NOT NULL,
        payment_period_end DATE NOT NULL,
        labor_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        materials_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        equipment_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        paid_date DATE,
        payment_method VARCHAR(50),
        reference_number VARCHAR(100),
        notes TEXT,
        xero_bill_id VARCHAR(255),
        last_synced_at TIMESTAMP,
        created_by_user_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create subcontractor_payment_items table
      `CREATE TABLE IF NOT EXISTS subcontractor_payment_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id UUID NOT NULL REFERENCES subcontractor_payments(id) ON DELETE CASCADE,
        item_type VARCHAR(50) NOT NULL,
        source_id TEXT,
        description TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes for subcontractor payments
      `CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_organization_id ON subcontractor_payments(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_subcontractor_user_id ON subcontractor_payments(subcontractor_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_status ON subcontractor_payments(status)`,
      `CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_created_at ON subcontractor_payments(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_subcontractor_payment_items_payment_id ON subcontractor_payment_items(payment_id)`,
      `CREATE INDEX IF NOT EXISTS idx_subcontractor_payment_items_source_id ON subcontractor_payment_items(source_id)`,

      // ========== FIX INCORRECT GST CALCULATIONS ==========

      // Fix expenses where GST is 0 but total_amount > 0 (calculate GST from total)
      `UPDATE expenses
       SET gst_amount = ROUND(total_amount / 11, 2),
           amount = ROUND(total_amount - (total_amount / 11), 2)
       WHERE gst_amount = 0
       AND total_amount > 0`,

      // ========== INVOICES & PAYMENTS ==========

      // Create invoices table
      `CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        invoice_number VARCHAR(50) NOT NULL,
        job_id UUID REFERENCES jobs(id),
        client_id UUID REFERENCES clients(id) NOT NULL,
        created_by_user_id UUID REFERENCES users(id) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        gst_amount DECIMAL(10, 2) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        paid_amount DECIMAL(10, 2) DEFAULT 0,
        issue_date TIMESTAMP NOT NULL,
        due_date TIMESTAMP NOT NULL,
        paid_date TIMESTAMP,
        payment_terms VARCHAR(100),
        payment_method VARCHAR(50),
        notes TEXT,
        footer_text TEXT,
        sent_at TIMESTAMP,
        xero_invoice_id VARCHAR(255),
        last_synced_at TIMESTAMP,
        stripe_invoice_id VARCHAR(255),
        stripe_payment_intent_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create invoice_line_items table
      `CREATE TABLE IF NOT EXISTS invoice_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
        source_type VARCHAR(50),
        source_id UUID,
        item_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        gst_amount DECIMAL(10, 2) NOT NULL,
        line_total DECIMAL(10, 2) NOT NULL,
        line_order INTEGER NOT NULL
      )`,

      // Create invoice_payments table
      `CREATE TABLE IF NOT EXISTS invoice_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
        payment_date TIMESTAMP NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        reference_number VARCHAR(100),
        notes TEXT,
        recorded_by_user_id UUID REFERENCES users(id) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes for invoices
      `CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)`,
      `CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id)`,
      `CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id)`,

      // ========== STRIPE PAYMENT SYSTEM ==========

      // Add payment link fields to quotes
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT false NOT NULL`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_percentage DECIMAL(5, 2)`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2)`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT false NOT NULL`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_payment_intent_id VARCHAR(255)`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_payment_link_url VARCHAR(500)`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS public_token VARCHAR(100) UNIQUE`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_by_name VARCHAR(255)`,
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_by_email VARCHAR(255)`,

      // Add payment link fields to invoices
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_id VARCHAR(255)`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_url VARCHAR(500)`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_token VARCHAR(100) UNIQUE`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deposit_invoice BOOLEAN DEFAULT false NOT NULL`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_quote_id UUID REFERENCES quotes(id)`,

      // Create payment_requests table
      `CREATE TABLE IF NOT EXISTS payment_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        request_type VARCHAR(50) NOT NULL,
        related_quote_id UUID REFERENCES quotes(id),
        related_invoice_id UUID REFERENCES invoices(id),
        related_job_id UUID REFERENCES jobs(id),
        client_id UUID REFERENCES clients(id) NOT NULL,
        amount_requested DECIMAL(10, 2) NOT NULL,
        amount_paid DECIMAL(10, 2) DEFAULT 0 NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' NOT NULL,
        stripe_payment_intent_id VARCHAR(255),
        stripe_payment_link_id VARCHAR(255),
        stripe_payment_link_url VARCHAR(500),
        public_token VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        expires_at TIMESTAMP,
        paid_at TIMESTAMP,
        created_by_user_id UUID REFERENCES users(id) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes for payment requests
      `CREATE INDEX IF NOT EXISTS idx_payment_requests_organization_id ON payment_requests(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_requests_client_id ON payment_requests(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_requests_public_token ON payment_requests(public_token)`,

      // ========== TEAM MEMBER LOCATIONS ==========
      // Create team_member_locations table for real-time location tracking
      `CREATE TABLE IF NOT EXISTS team_member_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        latitude NUMERIC(10, 7) NOT NULL,
        longitude NUMERIC(10, 7) NOT NULL,
        accuracy NUMERIC(10, 2),
        heading NUMERIC(5, 2),
        speed NUMERIC(10, 2),
        altitude NUMERIC(10, 2),
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes for team_member_locations
      `CREATE INDEX IF NOT EXISTS idx_team_member_locations_user_id ON team_member_locations(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_team_member_locations_organization_id ON team_member_locations(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_team_member_locations_last_updated ON team_member_locations(last_updated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_team_member_locations_active ON team_member_locations(organization_id, is_active, last_updated_at) WHERE is_active = true`,

      // ========== REMINDER SYSTEM ==========
      // Create reminder_settings table for automated invoice reminders and monthly statements
      `CREATE TABLE IF NOT EXISTS reminder_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
        invoice_reminders_enabled BOOLEAN DEFAULT true NOT NULL,
        reminder_days_before_due TEXT DEFAULT '7,3,1',
        reminder_days_after_due TEXT DEFAULT '1,7,14',
        invoice_reminder_method VARCHAR(20) DEFAULT 'email' NOT NULL,
        enable_sms_escalation BOOLEAN DEFAULT true NOT NULL,
        sms_escalation_days_overdue INTEGER DEFAULT 14 NOT NULL,
        monthly_statements_enabled BOOLEAN DEFAULT true NOT NULL,
        statement_day_of_month INTEGER DEFAULT 1 NOT NULL,
        statement_method VARCHAR(20) DEFAULT 'email' NOT NULL,
        include_only_outstanding BOOLEAN DEFAULT true NOT NULL,
        invoice_reminder_email_template_id UUID,
        invoice_reminder_sms_template_id UUID,
        monthly_statement_email_template_id UUID,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create reminder_history table for audit trail
      `CREATE TABLE IF NOT EXISTS reminder_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) NOT NULL,
        reminder_type VARCHAR(50) NOT NULL,
        client_id UUID NOT NULL,
        invoice_id UUID,
        sent_via VARCHAR(20) NOT NULL,
        recipient_email VARCHAR(255),
        recipient_phone VARCHAR(50),
        status VARCHAR(20) DEFAULT 'sent' NOT NULL,
        error_message TEXT,
        days_before_due INTEGER,
        invoice_amount VARCHAR(50),
        credits_used INTEGER DEFAULT 0,
        sms_message_id UUID,
        sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
        delivered_at TIMESTAMP
      )`,

      // Create client_reminder_preferences table (future feature for opt-outs)
      `CREATE TABLE IF NOT EXISTS client_reminder_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) NOT NULL,
        client_id UUID NOT NULL,
        disable_invoice_reminders BOOLEAN DEFAULT false NOT NULL,
        disable_monthly_statements BOOLEAN DEFAULT false NOT NULL,
        preferred_reminder_method VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes for reminder system
      `CREATE INDEX IF NOT EXISTS idx_reminder_settings_organization_id ON reminder_settings(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reminder_history_organization_id ON reminder_history(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reminder_history_sent_at ON reminder_history(sent_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_reminder_history_client_id ON reminder_history(client_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reminder_history_invoice_id ON reminder_history(invoice_id)`,
      `CREATE INDEX IF NOT EXISTS idx_client_reminder_preferences_organization_id ON client_reminder_preferences(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_client_reminder_preferences_client_id ON client_reminder_preferences(client_id)`,

      // ========== PUSH NOTIFICATIONS ==========
      // Add expo_push_token to users table for push notification support
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT`,

      // ========== COMPLETION FORMS SYSTEM ==========
      // Create completion form templates table
      `CREATE TABLE IF NOT EXISTS completion_form_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        code VARCHAR(100),
        job_type VARCHAR(50),
        is_global BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        navigation_type VARCHAR(50) DEFAULT 'tabs',
        include_photos BOOLEAN DEFAULT true,
        include_before_after_photos BOOLEAN DEFAULT true,
        include_signature BOOLEAN DEFAULT true,
        include_technician_signature BOOLEAN DEFAULT true,
        site_id INTEGER,
        csv_job_type_id INTEGER,
        csv_form_type_id INTEGER,
        site_group_id INTEGER,
        created_by_user_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create completion form template groups (sections)
      `CREATE TABLE IF NOT EXISTS completion_form_template_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES completion_form_templates(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL,
        is_collapsible BOOLEAN DEFAULT true,
        is_completion_group BOOLEAN DEFAULT false,
        conditional_logic JSONB,
        csv_group_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create completion form template questions
      `CREATE TABLE IF NOT EXISTS completion_form_template_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES completion_form_templates(id) ON DELETE CASCADE,
        group_id UUID NOT NULL REFERENCES completion_form_template_groups(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        placeholder VARCHAR(255),
        help_text TEXT,
        help_url VARCHAR(500),
        default_value TEXT,
        field_type VARCHAR(50) NOT NULL,
        config JSONB,
        is_required BOOLEAN DEFAULT false,
        validation_message TEXT,
        validation_rules JSONB,
        sort_order INTEGER NOT NULL,
        column_span INTEGER DEFAULT 1,
        conditional_logic JSONB,
        answer_options JSONB,
        csv_question_id INTEGER,
        csv_group_no INTEGER,
        csv_field VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create job completion forms (submitted instances)
      `CREATE TABLE IF NOT EXISTS job_completion_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        template_id UUID NOT NULL REFERENCES completion_form_templates(id),
        completed_by_user_id UUID NOT NULL REFERENCES users(id),
        completion_date TIMESTAMP,
        form_data JSONB NOT NULL,
        client_signature_url VARCHAR(500),
        technician_signature_url VARCHAR(500),
        client_name VARCHAR(255),
        technician_name VARCHAR(255),
        pdf_url VARCHAR(500),
        pdf_generated_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'draft' NOT NULL,
        sent_to_client BOOLEAN DEFAULT false,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create job completion form photos
      `CREATE TABLE IF NOT EXISTS job_completion_form_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        completion_form_id UUID NOT NULL REFERENCES job_completion_forms(id) ON DELETE CASCADE,
        question_id UUID REFERENCES completion_form_template_questions(id),
        photo_url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500),
        caption TEXT,
        photo_type VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create job completion form answers (normalized - matches SQL Server structure)
      `CREATE TABLE IF NOT EXISTS job_completion_form_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        completion_form_id UUID NOT NULL REFERENCES job_completion_forms(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id),
        job_id UUID NOT NULL REFERENCES jobs(id),
        question_id UUID NOT NULL REFERENCES completion_form_template_questions(id),
        answer_id VARCHAR(100),
        value TEXT,
        value_numeric INTEGER,
        file_category VARCHAR(100),
        file_path VARCHAR(500),
        file_ref VARCHAR(255),
        file_suffix VARCHAR(50),
        file_name VARCHAR(255),
        file_size INTEGER,
        submission_type_id INTEGER DEFAULT 0,
        csv_question_id INTEGER,
        csv_answer_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // Create indexes for completion forms
      `CREATE INDEX IF NOT EXISTS idx_completion_form_templates_organization_id ON completion_form_templates(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_completion_form_templates_is_global ON completion_form_templates(is_global) WHERE is_global = true`,
      `CREATE INDEX IF NOT EXISTS idx_completion_form_template_groups_template_id ON completion_form_template_groups(template_id)`,
      `CREATE INDEX IF NOT EXISTS idx_completion_form_template_questions_template_id ON completion_form_template_questions(template_id)`,
      `CREATE INDEX IF NOT EXISTS idx_completion_form_template_questions_group_id ON completion_form_template_questions(group_id)`,
      `CREATE INDEX IF NOT EXISTS idx_job_completion_forms_organization_id ON job_completion_forms(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_job_completion_forms_job_id ON job_completion_forms(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_job_completion_forms_status ON job_completion_forms(status)`,
      `CREATE INDEX IF NOT EXISTS idx_job_completion_form_photos_completion_form_id ON job_completion_form_photos(completion_form_id)`,
      `CREATE INDEX IF NOT EXISTS idx_job_completion_form_answers_completion_form_id ON job_completion_form_answers(completion_form_id)`,
      `CREATE INDEX IF NOT EXISTS idx_job_completion_form_answers_job_id ON job_completion_form_answers(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_job_completion_form_answers_question_id ON job_completion_form_answers(question_id)`,
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
