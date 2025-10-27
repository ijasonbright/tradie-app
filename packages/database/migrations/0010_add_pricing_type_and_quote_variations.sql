-- Add pricing_type to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(50) DEFAULT 'time_and_materials';

COMMENT ON COLUMN jobs.pricing_type IS 'Determines how the job is billed: fixed_price (from quote) or time_and_materials (actual hours + materials)';

-- Update existing jobs based on whether they have a quote
UPDATE jobs
SET pricing_type = CASE
  WHEN quote_id IS NOT NULL THEN 'fixed_price'
  ELSE 'time_and_materials'
END
WHERE pricing_type IS NULL OR pricing_type = 'time_and_materials';

-- Create quote_variations table
CREATE TABLE IF NOT EXISTS quote_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  variation_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending/approved/rejected
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  approved_by_client_at TIMESTAMP,
  rejected_by_client_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quote_variations IS 'Variations (change orders) to approved quotes - additional work beyond original scope';
COMMENT ON COLUMN quote_variations.variation_number IS 'Auto-generated: VAR-001, VAR-002, etc.';
COMMENT ON COLUMN quote_variations.status IS 'pending = awaiting client approval, approved = accepted by client, rejected = declined by client';

-- Create quote_variation_line_items table
CREATE TABLE IF NOT EXISTS quote_variation_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id UUID NOT NULL REFERENCES quote_variations(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- labor/material/equipment/other
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  line_order INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE quote_variation_line_items IS 'Individual line items for each quote variation';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quote_variations_quote_id ON quote_variations(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_variations_job_id ON quote_variations(job_id);
CREATE INDEX IF NOT EXISTS idx_quote_variations_organization_id ON quote_variations(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_variations_status ON quote_variations(status);
CREATE INDEX IF NOT EXISTS idx_quote_variation_line_items_variation_id ON quote_variation_line_items(variation_id);
