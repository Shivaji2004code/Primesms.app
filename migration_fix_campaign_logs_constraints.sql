-- ============================================================================
-- MIGRATION: Fix Campaign Logs Constraints and Schema Issues
-- ============================================================================

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
-- COMMENT: These changes ensure:
-- 1. Webhooks can update existing campaign logs using ON CONFLICT
-- 2. Message tracking includes read receipts
-- 3. Performance is optimized for webhook lookups
-- 4. All status values are properly supported
-- ============================================================================