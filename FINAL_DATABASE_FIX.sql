-- ============================================================================
-- FINAL DATABASE MIGRATION - RUN THIS IMMEDIATELY
-- ============================================================================
-- This fixes all webhook constraint issues and type mismatches

-- Step 1: Add missing read_at column if it doesn't exist
ALTER TABLE campaign_logs 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

-- Step 2: Drop any conflicting indexes
DROP INDEX IF EXISTS idx_campaign_logs_user_message_unique;
DROP INDEX IF EXISTS idx_campaign_logs_message_id_unique;

-- Step 3: Create the correct unique constraint for message_id (for ON CONFLICT)
-- This allows webhooks to update by message_id only
CREATE UNIQUE INDEX idx_campaign_logs_message_id_unique 
    ON campaign_logs(message_id) 
    WHERE message_id IS NOT NULL AND message_id != '';

-- Step 4: Create composite index for user_id + message_id (for faster lookups)
CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_message 
    ON campaign_logs(user_id, message_id) 
    WHERE message_id IS NOT NULL;

-- Step 5: Add other performance indexes
CREATE INDEX IF NOT EXISTS idx_campaign_logs_message_id_lookup ON campaign_logs(message_id)
    WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_logs_status_message ON campaign_logs(status, message_id)
    WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_status ON campaign_logs(user_id, status);

-- Step 6: Ensure status field accepts all required values
ALTER TABLE campaign_logs 
DROP CONSTRAINT IF EXISTS campaign_logs_status_check;

ALTER TABLE campaign_logs 
ADD CONSTRAINT campaign_logs_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused', 'sent', 'delivered', 'read'));

-- Step 7: Fix any existing NULL data
UPDATE campaign_logs 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL;

UPDATE campaign_logs 
SET message_id = NULL 
WHERE message_id = '';

-- ============================================================================
-- VERIFICATION QUERIES - Run these to verify the migration worked
-- ============================================================================

-- Check if read_at column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'campaign_logs' AND column_name = 'read_at';

-- Check if unique constraint exists  
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'campaign_logs' AND indexname = 'idx_campaign_logs_message_id_unique';

-- Count existing campaign logs
SELECT COUNT(*) as total_campaign_logs FROM campaign_logs;

-- Check for any duplicate message_ids (should be 0)
SELECT message_id, COUNT(*) 
FROM campaign_logs 
WHERE message_id IS NOT NULL AND message_id != ''
GROUP BY message_id 
HAVING COUNT(*) > 1;

-- ============================================================================
-- SUCCESS CONFIRMATION
-- If all queries above return expected results, the migration is complete!
-- ============================================================================