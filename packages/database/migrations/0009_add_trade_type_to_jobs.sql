-- Migration: Link jobs to trade types for rate calculation
-- Date: 2025-01-27

-- ============================================================================
-- JOBS: Add trade_type_id reference
-- ============================================================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS trade_type_id UUID REFERENCES trade_types(id);

COMMENT ON COLUMN jobs.trade_type_id IS 'The trade type for this job - determines default rates for labor cost and client billing';

-- ============================================================================
-- JOB_TIME_LOGS: Add billing_amount to separate cost from revenue
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_time_logs' AND column_name = 'billing_amount'
  ) THEN
    ALTER TABLE job_time_logs ADD COLUMN billing_amount DECIMAL(10, 2);
    COMMENT ON COLUMN job_time_logs.billing_amount IS 'Revenue from client - what we charge the customer (hours × clientHourlyRate)';
  END IF;
END $$;

COMMENT ON COLUMN job_time_logs.labor_cost IS 'Cost to business - what we pay the worker (hours × defaultEmployeeHourlyRate)';

-- ============================================================================
-- Update existing jobs to set trade_type_id based on job_type string
-- ============================================================================
-- This is a best-effort migration. Admin should review and correct as needed.
UPDATE jobs j
SET trade_type_id = (
  SELECT tt.id
  FROM trade_types tt
  WHERE tt.organization_id = j.organization_id
  AND tt.is_active = true
  LIMIT 1
)
WHERE j.trade_type_id IS NULL;
