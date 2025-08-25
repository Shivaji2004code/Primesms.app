-- Create Global Pricing Defaults Table
-- Migration Script for Prime SMS Pricing System
-- Date: August 25, 2025

-- Create global_pricing_defaults table
CREATE TABLE IF NOT EXISTS global_pricing_defaults (
  id SERIAL PRIMARY KEY,
  marketing_price DECIMAL(10,4) NOT NULL DEFAULT 0.80,
  utility_price DECIMAL(10,4) NOT NULL DEFAULT 0.15,
  authentication_price DECIMAL(10,4) NOT NULL DEFAULT 0.15,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial default values
INSERT INTO global_pricing_defaults (marketing_price, utility_price, authentication_price, currency)
VALUES (0.80, 0.15, 0.15, 'INR')
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_global_pricing_defaults_updated_at 
BEFORE UPDATE ON global_pricing_defaults 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE global_pricing_defaults IS 'Global default pricing for WhatsApp message categories';
COMMENT ON COLUMN global_pricing_defaults.marketing_price IS 'Default price per marketing message in INR';
COMMENT ON COLUMN global_pricing_defaults.utility_price IS 'Default price per utility message in INR';
COMMENT ON COLUMN global_pricing_defaults.authentication_price IS 'Default price per authentication message in INR';
COMMENT ON COLUMN global_pricing_defaults.currency IS 'Currency code (INR)';

-- Verify the table was created
\d global_pricing_defaults;