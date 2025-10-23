-- Add comprehensive pricing fields to trade_types table

-- Client billing rate fields
ALTER TABLE trade_types
ADD COLUMN IF NOT EXISTS client_first_hour_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS client_callout_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_after_hours_callout_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_after_hours_extra_percent DECIMAL(5, 2) DEFAULT 0;

-- Employee/Contractor cost fields
ALTER TABLE trade_types
ADD COLUMN IF NOT EXISTS default_employee_hourly_rate DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_employee_daily_rate DECIMAL(10, 2);

-- Rename/migrate old fields to new structure
-- Copy old default_employee_cost to new default_employee_hourly_rate if not set
UPDATE trade_types
SET default_employee_hourly_rate = default_employee_cost
WHERE default_employee_hourly_rate IS NULL OR default_employee_hourly_rate = 0;

-- Add comments for clarity
COMMENT ON COLUMN trade_types.client_hourly_rate IS 'Standard hourly rate charged to clients';
COMMENT ON COLUMN trade_types.client_first_hour_rate IS 'Optional higher rate for first hour of service';
COMMENT ON COLUMN trade_types.client_callout_fee IS 'Call-out fee for standard business hours';
COMMENT ON COLUMN trade_types.client_after_hours_callout_fee IS 'Call-out fee for after hours service';
COMMENT ON COLUMN trade_types.client_after_hours_extra_percent IS 'Extra percentage added to hourly rate for after hours (e.g., 50 for 50% extra)';
COMMENT ON COLUMN trade_types.default_employee_hourly_rate IS 'Default hourly cost for employees/contractors';
COMMENT ON COLUMN trade_types.default_employee_daily_rate IS 'Default daily rate for employees/contractors';
