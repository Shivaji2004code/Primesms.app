-- Add Pricing Columns to user_business_info Table
-- Migration Script for Prime SMS Pricing System
-- Date: August 25, 2025

-- Add pricing columns to user_business_info table
ALTER TABLE user_business_info 
ADD COLUMN IF NOT EXISTS marketing_price DECIMAL(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS utility_price DECIMAL(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS authentication_price DECIMAL(10,4) DEFAULT NULL;

-- Add index for faster pricing queries
CREATE INDEX IF NOT EXISTS idx_user_business_info_pricing 
ON user_business_info (user_id, marketing_price, utility_price, authentication_price);

-- Add comment for documentation
COMMENT ON COLUMN user_business_info.marketing_price IS 'Custom marketing message price per message in INR. NULL means use global defaults.';
COMMENT ON COLUMN user_business_info.utility_price IS 'Custom utility message price per message in INR. NULL means use global defaults.';
COMMENT ON COLUMN user_business_info.authentication_price IS 'Custom authentication message price per message in INR. NULL means use global defaults.';

-- Verify the columns were added
\d user_business_info;