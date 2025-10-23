-- Migration: Add business rates, employment types, and scheduling features
-- Date: 2025-01-20

-- ============================================================================
-- ORGANIZATIONS: Add default business rates
-- ============================================================================
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_employee_cost DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN organizations.default_hourly_rate IS 'Default rate to charge clients per hour';
COMMENT ON COLUMN organizations.default_employee_cost IS 'Default rate to pay employees per hour';

-- ============================================================================
-- ORGANIZATION MEMBERS: Add employment type, billing rates, and availability
-- ============================================================================
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS billing_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS leave_balance_hours DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_for_scheduling BOOLEAN DEFAULT true;

COMMENT ON COLUMN organization_members.employment_type IS 'employee or subcontractor';
COMMENT ON COLUMN organization_members.billing_rate IS 'Rate to charge clients for this person (overrides org default)';
COMMENT ON COLUMN organization_members.leave_balance_hours IS 'Annual leave balance in hours (employees only)';
COMMENT ON COLUMN organization_members.available_for_scheduling IS 'Whether this person shows up in job assignment lists';

-- Add constraint for employment type
ALTER TABLE organization_members
ADD CONSTRAINT check_employment_type
CHECK (employment_type IN ('employee', 'subcontractor'));

-- ============================================================================
-- TEAM MEMBER UNAVAILABILITY: Leave and roster tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_member_unavailability (
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
);

COMMENT ON TABLE team_member_unavailability IS 'Tracks employee leave and subcontractor roster offs';
COMMENT ON COLUMN team_member_unavailability.unavailability_type IS 'annual_leave, sick_leave, rostered_off, public_holiday, other';
COMMENT ON COLUMN team_member_unavailability.status IS 'pending, approved, rejected';

-- Add constraint for unavailability type
ALTER TABLE team_member_unavailability
ADD CONSTRAINT check_unavailability_type
CHECK (unavailability_type IN ('annual_leave', 'sick_leave', 'rostered_off', 'public_holiday', 'other'));

-- Add constraint for status
ALTER TABLE team_member_unavailability
ADD CONSTRAINT check_unavailability_status
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_unavailability_user_dates
ON team_member_unavailability(user_id, start_datetime, end_datetime);

CREATE INDEX IF NOT EXISTS idx_unavailability_org_dates
ON team_member_unavailability(organization_id, start_datetime, end_datetime);

CREATE INDEX IF NOT EXISTS idx_unavailability_status
ON team_member_unavailability(status) WHERE status = 'approved';

-- ============================================================================
-- JOBS: Add duration, geolocation, and scheduling fields
-- ============================================================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS estimated_duration_hours DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS actual_duration_hours DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS site_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS site_place_id VARCHAR(255);

COMMENT ON COLUMN jobs.estimated_duration_hours IS 'Expected job length in hours';
COMMENT ON COLUMN jobs.actual_duration_hours IS 'Actual time taken (calculated from time logs)';
COMMENT ON COLUMN jobs.travel_time_minutes IS 'Estimated travel time to job site';
COMMENT ON COLUMN jobs.site_latitude IS 'Job site latitude for mapping';
COMMENT ON COLUMN jobs.site_longitude IS 'Job site longitude for mapping';
COMMENT ON COLUMN jobs.site_place_id IS 'Google Place ID for address verification';

-- Add index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_jobs_location
ON jobs(site_latitude, site_longitude) WHERE site_latitude IS NOT NULL;

-- Add index for scheduling queries
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_dates
ON jobs(scheduled_start_time, scheduled_end_time) WHERE scheduled_start_time IS NOT NULL;

-- ============================================================================
-- Update existing data with sensible defaults
-- ============================================================================

-- Set employment_type based on role (subcontractors already identified by role)
UPDATE organization_members
SET employment_type = 'subcontractor'
WHERE role = 'subcontractor';

UPDATE organization_members
SET employment_type = 'employee'
WHERE role != 'subcontractor';

-- Copy existing hourly_rate to billing_rate for initial setup
UPDATE organization_members
SET billing_rate = hourly_rate
WHERE hourly_rate IS NOT NULL AND billing_rate IS NULL;
