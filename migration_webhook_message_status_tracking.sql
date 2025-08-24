-- ============================================================================
-- WEBHOOK MESSAGE STATUS TRACKING MIGRATION
-- Adds indexes and optimizations for 360dialog webhook message status updates
-- ============================================================================

-- Add index on message_id for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_campaign_logs_message_id ON campaign_logs(message_id)
WHERE message_id IS NOT NULL;

-- Add index on recipient_number for reporting
CREATE INDEX IF NOT EXISTS idx_campaign_logs_recipient_number ON campaign_logs(recipient_number)
WHERE recipient_number IS NOT NULL;

-- Add composite index for user reports with status filtering
CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_status_created ON campaign_logs(user_id, status, created_at DESC);

-- Add index for sent_at timestamp queries
CREATE INDEX IF NOT EXISTS idx_campaign_logs_sent_at ON campaign_logs(sent_at DESC)
WHERE sent_at IS NOT NULL;

-- Add index for delivered_at timestamp queries  
CREATE INDEX IF NOT EXISTS idx_campaign_logs_delivered_at ON campaign_logs(delivered_at DESC)
WHERE delivered_at IS NOT NULL;

-- Verify the message_id column can handle non-integer values
-- (It's already VARCHAR(255) so this is just a check)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'campaign_logs' 
        AND column_name = 'message_id' 
        AND data_type = 'character varying'
    ) THEN
        RAISE NOTICE '✅ message_id column is VARCHAR - ready for non-integer 360dialog message IDs';
    ELSE
        RAISE WARNING '⚠️  message_id column type needs verification';
    END IF;
END $$;

-- Add column for webhook processing metadata (optional)
ALTER TABLE campaign_logs 
ADD COLUMN IF NOT EXISTS webhook_processed_at TIMESTAMP DEFAULT NULL;

-- Add column for message pricing info from webhook (optional)
ALTER TABLE campaign_logs 
ADD COLUMN IF NOT EXISTS message_pricing JSONB DEFAULT NULL;

-- Add comment to message_id column for documentation
COMMENT ON COLUMN campaign_logs.message_id IS '360dialog message ID (non-integer, format: wamid.xxxxx)';

-- Verify indexes were created
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE tablename = 'campaign_logs' 
    AND indexname IN (
        'idx_campaign_logs_message_id',
        'idx_campaign_logs_recipient_number', 
        'idx_campaign_logs_user_status_created',
        'idx_campaign_logs_sent_at',
        'idx_campaign_logs_delivered_at'
    );
    
    RAISE NOTICE '✅ Created % webhook-related indexes on campaign_logs table', index_count;
END $$;

-- ============================================================================
-- WEBHOOK TESTING DATA (FOR DEVELOPMENT ONLY)
-- ============================================================================

-- Insert test records for webhook testing (only if in development)
-- Uncomment these lines for local testing:

/*
INSERT INTO campaign_logs (
    user_id, campaign_name, template_used, phone_number_id, recipient_number,
    message_id, status, total_recipients, successful_sends, failed_sends,
    sent_at, created_at, updated_at
) VALUES 
(
    (SELECT id FROM users LIMIT 1), -- Use first available user
    'WEBHOOK_TEST_' || extract(epoch from now()),
    'test_template', 
    'test_phone_id',
    '+919398424270',
    'wamid.HBgMOTE5Mzk4NDI0MjcwFQIAERgSQjNFNzEzRjE1NTQ3ODk4QzUE',
    'sent',
    1,
    1,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;
*/

-- ============================================================================
-- QUERY EXAMPLES FOR WEBHOOK STATUS TRACKING
-- ============================================================================

-- Query to find campaign by message_id (used by webhook)
/* 
SELECT id, user_id, status, recipient_number, template_used
FROM campaign_logs 
WHERE message_id = 'wamid.HBgMOTE5Mzk4NDI0MjcwFQIAERgSQjNFNzEzRjE1NTQ3ODk4QzUE';
*/

-- Query to get delivery status summary for user
/*
SELECT 
    template_used,
    status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE sent_at IS NOT NULL) as sent_count,
    COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) as delivered_count
FROM campaign_logs 
WHERE user_id = 'user-uuid-here'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY template_used, status
ORDER BY template_used, status;
*/

-- Query to find messages that haven't received delivery confirmation
/*
SELECT 
    id, message_id, recipient_number, template_used, sent_at,
    CURRENT_TIMESTAMP - sent_at as time_since_sent
FROM campaign_logs 
WHERE status = 'sent' 
    AND sent_at IS NOT NULL 
    AND delivered_at IS NULL
    AND sent_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
ORDER BY sent_at DESC;
*/

RAISE NOTICE '🎯 Webhook message status tracking migration completed successfully';
RAISE NOTICE '📊 Tables are ready for 360dialog webhook status updates';
RAISE NOTICE '⚡ Added optimized indexes for fast message_id lookups';