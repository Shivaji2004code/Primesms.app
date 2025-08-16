-- ============================================================================
-- EMERGENCY DATABASE SCHEMA FIX - RUN IMMEDIATELY
-- ============================================================================
-- This fixes the critical user_id type mismatch and constraint issues

-- Step 1: Check current user_id type in campaign_logs
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaign_logs' AND column_name = 'user_id';

-- Step 2: Check user_id type in users table  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';

-- Step 3: Fix user_id type mismatch (if campaign_logs.user_id is INTEGER but users.id is UUID)
-- CRITICAL: This will only work if campaign_logs table is empty or has valid UUID strings
-- If you have data, backup first!

-- Drop foreign key constraint temporarily
ALTER TABLE campaign_logs DROP CONSTRAINT IF EXISTS campaign_logs_user_id_fkey;

-- Change user_id from INTEGER to UUID 
ALTER TABLE campaign_logs 
ALTER COLUMN user_id TYPE UUID USING user_id::TEXT::UUID;

-- Restore foreign key constraint
ALTER TABLE campaign_logs 
ADD CONSTRAINT campaign_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 4: Add missing read_at column if it doesn't exist
ALTER TABLE campaign_logs 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

-- Step 5: Drop any conflicting indexes
DROP INDEX IF EXISTS idx_campaign_logs_user_message_unique;
DROP INDEX IF EXISTS idx_campaign_logs_message_id_unique;

-- Step 6: Create the correct unique constraint for message_id (for ON CONFLICT)
CREATE UNIQUE INDEX idx_campaign_logs_message_id_unique 
    ON campaign_logs(message_id) 
    WHERE message_id IS NOT NULL AND message_id != '';

-- Step 7: Create other performance indexes
CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_message 
    ON campaign_logs(user_id, message_id) 
    WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_logs_status_message ON campaign_logs(status, message_id)
    WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_status ON campaign_logs(user_id, status);

-- Step 8: Ensure status field accepts all required values
ALTER TABLE campaign_logs 
DROP CONSTRAINT IF EXISTS campaign_logs_status_check;

ALTER TABLE campaign_logs 
ADD CONSTRAINT campaign_logs_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused', 'sent', 'delivered', 'read'));

-- Step 9: Clean up any bad data
UPDATE campaign_logs 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL;

UPDATE campaign_logs 
SET message_id = NULL 
WHERE message_id = '';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify user_id is now UUID type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaign_logs' AND column_name = 'user_id';

-- Verify unique constraint exists
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'campaign_logs' AND indexname = 'idx_campaign_logs_message_id_unique';

-- Count records
SELECT COUNT(*) as total_campaign_logs FROM campaign_logs;

-- ============================================================================
-- NOTE: If the ALTER COLUMN command fails due to data format issues:
-- 1. Check what data exists: SELECT DISTINCT user_id FROM campaign_logs LIMIT 10;
-- 2. If user_id values are not valid UUIDs, you may need to:
--    - Truncate the table: TRUNCATE campaign_logs;
--    - Or map integer user_ids to actual UUID values from users table
-- ============================================================================