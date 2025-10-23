-- Migration: Add trade types and enhanced team member fields
-- Date: 2025-01-20

-- ============================================================================
-- TRADE TYPES: Per-trade billing rates
-- ============================================================================
CREATE TABLE IF NOT EXISTS trade_types (
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
);

COMMENT ON TABLE trade_types IS 'Different trade types with their respective rates';
COMMENT ON COLUMN trade_types.client_hourly_rate IS 'Hourly rate charged to clients for this trade';
COMMENT ON COLUMN trade_types.client_daily_rate IS 'Daily rate charged to clients (optional)';
COMMENT ON COLUMN trade_types.default_employee_cost IS 'Default cost rate for employees of this trade';

CREATE INDEX IF NOT EXISTS idx_trade_types_org ON trade_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_trade_types_active ON trade_types(organization_id, is_active) WHERE is_active = true;

-- ============================================================================
-- UPDATE ORGANIZATION MEMBERS: Add trade assignment and rate types
-- ============================================================================
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS primary_trade_id UUID REFERENCES trade_types(id),
ADD COLUMN IF NOT EXISTS rate_type VARCHAR(20) DEFAULT 'hourly',
ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10, 2);

COMMENT ON COLUMN organization_members.primary_trade_id IS 'Primary trade type for this team member';
COMMENT ON COLUMN organization_members.rate_type IS 'hourly or daily';
COMMENT ON COLUMN organization_members.daily_rate IS 'Daily rate for subcontractors who charge per day';

-- Rename existing columns for clarity
DO $$
BEGIN
  -- Only rename if column doesn't already have the new name
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'organization_members'
             AND column_name = 'hourly_rate') THEN
    ALTER TABLE organization_members RENAME COLUMN hourly_rate TO cost_rate;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'organization_members'
             AND column_name = 'billing_rate') THEN
    ALTER TABLE organization_members RENAME COLUMN billing_rate TO override_billing_rate;
  END IF;
END $$;

COMMENT ON COLUMN organization_members.cost_rate IS 'What the organization pays this person (hourly or daily based on rate_type)';
COMMENT ON COLUMN organization_members.override_billing_rate IS 'Override the trade default rate when billing this person to clients';

-- ============================================================================
-- UPDATE JOBS: Link to trade types
-- ============================================================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS trade_type_id UUID REFERENCES trade_types(id);

COMMENT ON COLUMN jobs.trade_type_id IS 'Trade type for this job (determines billing rate)';

CREATE INDEX IF NOT EXISTS idx_jobs_trade_type ON jobs(trade_type_id);

-- ============================================================================
-- ENHANCE USER DOCUMENTS: Add verification
-- ============================================================================
ALTER TABLE user_documents
ADD COLUMN IF NOT EXISTS document_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

COMMENT ON COLUMN user_documents.document_category IS 'license, insurance, certification, other';
COMMENT ON COLUMN user_documents.verified_by_user_id IS 'Admin who verified this document';

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================

-- For each organization, create a "General" trade type from their default rates
INSERT INTO trade_types (organization_id, name, client_hourly_rate, default_employee_cost, is_active)
SELECT
  id as organization_id,
  'General' as name,
  COALESCE(default_hourly_rate, 0) as client_hourly_rate,
  COALESCE(default_employee_cost, 0) as default_employee_cost,
  true as is_active
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM trade_types
  WHERE trade_types.organization_id = organizations.id
  AND trade_types.name = 'General'
);

-- Link all existing team members to the "General" trade
UPDATE organization_members om
SET primary_trade_id = (
  SELECT id FROM trade_types tt
  WHERE tt.organization_id = om.organization_id
  AND tt.name = 'General'
  LIMIT 1
)
WHERE primary_trade_id IS NULL;

-- Set rate_type to 'daily' for subcontractors who have a daily_rate
UPDATE organization_members
SET rate_type = 'daily'
WHERE employment_type = 'subcontractor'
AND daily_rate IS NOT NULL
AND daily_rate > 0;
