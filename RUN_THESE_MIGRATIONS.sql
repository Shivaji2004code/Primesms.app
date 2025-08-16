-- ============================================================================
-- REQUIRED DATABASE MIGRATIONS - RUN THESE IN ORDER
-- ============================================================================

-- 1. First, run the campaign logs constraints migration
-- This adds the missing read_at column and unique constraints for webhooks

-- Add missing read_at column if it doesn't exist
ALTER TABLE campaign_logs 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

-- Add unique constraint for message_id and user_id to support ON CONFLICT
-- This constraint is needed for webhook updates
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_logs_user_message_unique 
    ON campaign_logs(user_id, message_id) 
    WHERE message_id IS NOT NULL;

-- Add composite index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_campaign_logs_message_id ON campaign_logs(message_id)
    WHERE message_id IS NOT NULL;

-- Fix any existing data inconsistencies
UPDATE campaign_logs 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL;

-- Ensure status field accepts all required values
ALTER TABLE campaign_logs 
DROP CONSTRAINT IF EXISTS campaign_logs_status_check;

ALTER TABLE campaign_logs 
ADD CONSTRAINT campaign_logs_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused', 'sent', 'delivered', 'read'));

-- Add indexes for better webhook performance
CREATE INDEX IF NOT EXISTS idx_campaign_logs_status_message ON campaign_logs(status, message_id)
    WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_status ON campaign_logs(user_id, status);

-- ============================================================================
-- VERIFICATION QUERIES - Run these to verify the migration worked
-- ============================================================================

-- Check if read_at column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'campaign_logs' AND column_name = 'read_at';

-- Check if unique constraint exists  
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'campaign_logs' AND indexname = 'idx_campaign_logs_user_message_unique';

-- Count existing campaign logs
SELECT COUNT(*) as total_campaign_logs FROM campaign_logs;

-- ============================================================================
-- NOTES:
-- 1. These migrations are safe to run multiple times (IF NOT EXISTS clauses)
-- 2. The unique constraint is critical for webhook ON CONFLICT operations
-- 3. The read_at column is required for the enhanced frontend reports
-- 4. Run these BEFORE deploying the new application version
-- ============================================================================