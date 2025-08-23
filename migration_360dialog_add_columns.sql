-- Migration V1: Add 360dialog columns to user_business_info (PostgreSQL)
-- Safe additive migration - keeps existing Meta columns for rollback

-- Add provider enum type (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waba_provider') THEN
        CREATE TYPE waba_provider AS ENUM ('meta', '360dialog');
    ELSE
        -- Add 360dialog to existing enum if not present
        ALTER TYPE waba_provider ADD VALUE IF NOT EXISTS '360dialog';
    END IF;
END $$;

-- Add 360dialog columns to user_business_info
ALTER TABLE user_business_info 
  ADD COLUMN IF NOT EXISTS provider waba_provider DEFAULT '360dialog',
  ADD COLUMN IF NOT EXISTS channel_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS api_key TEXT, -- Store API key directly (plaintext)
  ADD COLUMN IF NOT EXISTS provider_meta JSONB,
  ADD COLUMN IF NOT EXISTS updated_at_new TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Make legacy Meta columns nullable (safe for rollback)
ALTER TABLE user_business_info 
  ALTER COLUMN whatsapp_number_id DROP NOT NULL,
  ALTER COLUMN waba_id DROP NOT NULL,
  ALTER COLUMN access_token DROP NOT NULL;

-- Create unique constraint: one provider profile per user
-- This allows future multi-provider support if needed
ALTER TABLE user_business_info 
  ADD CONSTRAINT user_business_info_user_provider_unique 
  UNIQUE (user_id, provider);

-- Create index for fast lookups by provider and channel
CREATE INDEX IF NOT EXISTS idx_user_business_info_provider_channel 
  ON user_business_info (provider, channel_id);

-- Create index on updated_at for performance
CREATE INDEX IF NOT EXISTS idx_user_business_info_updated_at 
  ON user_business_info (updated_at_new);

-- Create trigger to auto-update updated_at_new column
CREATE OR REPLACE FUNCTION update_user_business_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at_new = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_business_info_updated_at ON user_business_info;
CREATE TRIGGER trigger_update_user_business_info_updated_at
    BEFORE UPDATE ON user_business_info
    FOR EACH ROW
    EXECUTE FUNCTION update_user_business_info_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN user_business_info.provider IS '360dialog or meta - standardizing on 360dialog';
COMMENT ON COLUMN user_business_info.channel_id IS '360dialog Channel ID (per-number identifier)';
COMMENT ON COLUMN user_business_info.api_key IS '360dialog API key (stored as plaintext)';
COMMENT ON COLUMN user_business_info.provider_meta IS 'JSON metadata for provider-specific settings';
COMMENT ON COLUMN user_business_info.updated_at_new IS 'Auto-updated timestamp for settings changes';

-- Update existing records to use 360dialog provider (if any exist)
-- This assumes migration to 360dialog - adjust as needed
UPDATE user_business_info 
SET provider = '360dialog', updated_at_new = CURRENT_TIMESTAMP 
WHERE provider IS NULL;

-- Grant necessary permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE ON user_business_info TO app_user;
-- GRANT USAGE ON SEQUENCE user_business_info_id_seq TO app_user;

-- Migration completed successfully
SELECT 'Migration V1: 360dialog columns added successfully' as status;