-- Migration V2: Clean up legacy Meta columns (PostgreSQL)
-- Run this AFTER successful 360dialog migration and testing
-- WARNING: This removes rollback capability to Meta fields

-- Verify all records have been migrated to 360dialog
DO $$
DECLARE
    legacy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO legacy_count 
    FROM user_business_info 
    WHERE provider = 'meta' OR provider IS NULL;
    
    IF legacy_count > 0 THEN
        RAISE EXCEPTION 'Cannot proceed: % records still use Meta provider. Complete migration first.', legacy_count;
    END IF;
    
    RAISE NOTICE 'Migration check passed: All % records use 360dialog provider', 
        (SELECT COUNT(*) FROM user_business_info);
END $$;

-- Replace updated_at column with new one
ALTER TABLE user_business_info DROP COLUMN IF EXISTS updated_at;
ALTER TABLE user_business_info RENAME COLUMN updated_at_new TO updated_at;

-- Drop legacy Meta columns (IRREVERSIBLE)
ALTER TABLE user_business_info 
  DROP COLUMN IF EXISTS whatsapp_number_id,
  DROP COLUMN IF EXISTS waba_id,
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS webhook_verify_token,
  DROP COLUMN IF EXISTS app_id,
  DROP COLUMN IF EXISTS app_secret;

-- Update enum to remove 'meta' option (optional - keeps backward compatibility)
-- Uncomment if you want to completely remove meta from enum:
-- ALTER TYPE waba_provider RENAME TO waba_provider_old;
-- CREATE TYPE waba_provider AS ENUM ('360dialog');
-- ALTER TABLE user_business_info ALTER COLUMN provider TYPE waba_provider USING provider::text::waba_provider;
-- DROP TYPE waba_provider_old;

-- Add NOT NULL constraints for required 360dialog fields
ALTER TABLE user_business_info 
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN channel_id SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- Update constraint name to reflect cleanup
ALTER TABLE user_business_info 
  DROP CONSTRAINT IF EXISTS user_business_info_user_provider_unique;

-- Since we now only support 360dialog, make it unique per user
ALTER TABLE user_business_info 
  ADD CONSTRAINT user_business_info_user_unique UNIQUE (user_id);

-- Add constraint for channel_id format validation
ALTER TABLE user_business_info 
  ADD CONSTRAINT user_business_info_channel_id_format 
  CHECK (channel_id ~ '^[A-Za-z0-9._-]+$' AND LENGTH(channel_id) BETWEEN 2 AND 128);

-- Drop old indexes that referenced legacy columns
DROP INDEX IF EXISTS idx_user_business_info_waba_id;
DROP INDEX IF EXISTS idx_user_business_info_phone_number_id;

-- Add new optimized indexes
CREATE INDEX IF NOT EXISTS idx_user_business_info_channel_id 
  ON user_business_info (channel_id);

CREATE INDEX IF NOT EXISTS idx_user_business_info_active 
  ON user_business_info (user_id, is_active) WHERE is_active = true;

-- Update comments
COMMENT ON TABLE user_business_info IS 'User WhatsApp Business settings - 360dialog integration only';
COMMENT ON COLUMN user_business_info.provider IS 'Always 360dialog after migration cleanup';

-- Verify final state
DO $$
DECLARE
    final_count INTEGER;
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO final_count FROM user_business_info WHERE provider = '360dialog';
    SELECT COUNT(*) INTO orphan_count FROM user_business_info WHERE channel_id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE WARNING 'Found % records without channel_id - manual cleanup needed', orphan_count;
    END IF;
    
    RAISE NOTICE 'Migration V2 completed: % 360dialog records, % orphan records', final_count, orphan_count;
END $$;

-- Migration completed
SELECT 'Migration V2: Legacy columns cleaned up successfully' as status;