-- Add job_type_id column to trade_types table
ALTER TABLE trade_types
ADD COLUMN IF NOT EXISTS job_type_id INTEGER;

-- Add unique constraint on organization_id + job_type_id
-- This ensures each organization can only have one instance of each trade type
ALTER TABLE trade_types
DROP CONSTRAINT IF EXISTS trade_types_organization_id_name_key;

-- Add new unique constraint on organization + job_type_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_types_organization_id_job_type_id_key'
  ) THEN
    ALTER TABLE trade_types
    ADD CONSTRAINT trade_types_organization_id_job_type_id_key
    UNIQUE(organization_id, job_type_id);
  END IF;
END $$;

-- Create a reference table for standard trade types (this is just for documentation)
-- The actual dropdown will be in the application code
CREATE TABLE IF NOT EXISTS standard_trade_types (
  job_type_id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255)
);

-- Insert standard trade types based on the provided data
INSERT INTO standard_trade_types (job_type_id, name, description) VALUES
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
ON CONFLICT (job_type_id) DO NOTHING;

-- Update existing trade types to include job_type_id where possible
-- This will attempt to match existing names to standard types
UPDATE trade_types t
SET job_type_id = s.job_type_id
FROM standard_trade_types s
WHERE LOWER(t.name) = LOWER(s.name)
AND t.job_type_id IS NULL;

-- For the "General" trade type that was created during migration, assign a special ID
UPDATE trade_types
SET job_type_id = 9999
WHERE LOWER(name) = 'general' AND job_type_id IS NULL;
