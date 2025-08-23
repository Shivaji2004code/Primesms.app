-- 360dialog Admin Management Scripts
-- Use these queries for manual admin operations in Coolify database console

-- ========================================
-- MIGRATION STATUS CHECKS
-- ========================================

-- Check migration status - see what provider types exist
SELECT 
  provider,
  COUNT(*) as user_count,
  COUNT(CASE WHEN channel_id IS NOT NULL THEN 1 END) as with_channel_id,
  COUNT(CASE WHEN api_key IS NOT NULL AND LENGTH(api_key) > 0 THEN 1 END) as with_api_key
FROM user_business_info 
GROUP BY provider
ORDER BY provider;

-- List all users and their WhatsApp configuration status
SELECT 
  u.id,
  u.username,
  u.name,
  u.email,
  ubi.provider,
  ubi.whatsapp_number,
  ubi.channel_id,
  CASE 
    WHEN ubi.api_key IS NOT NULL AND LENGTH(ubi.api_key) > 0 THEN 'SET' 
    ELSE 'NOT SET' 
  END as api_key_status,
  ubi.is_active,
  ubi.updated_at
FROM users u
LEFT JOIN user_business_info ubi ON u.id = ubi.user_id
ORDER BY u.id;

-- ========================================
-- USER-SPECIFIC OPERATIONS
-- ========================================

-- View specific user's 360dialog settings
-- Replace 'USER_ID_HERE' with actual user ID
SELECT 
  u.id as user_id,
  u.username,
  u.name as business_name,
  ubi.whatsapp_number,
  ubi.provider,
  ubi.channel_id,
  CASE 
    WHEN ubi.api_key IS NOT NULL AND LENGTH(ubi.api_key) > 0 THEN 'API Key Set (length: ' || LENGTH(ubi.api_key) || ')' 
    ELSE 'No API Key' 
  END as api_key_info,
  ubi.provider_meta,
  ubi.is_active,
  ubi.created_at,
  ubi.updated_at
FROM users u
LEFT JOIN user_business_info ubi ON u.id = ubi.user_id
WHERE u.id = 'USER_ID_HERE';

-- Set 360dialog settings for a specific user
-- Replace values as needed
/*
INSERT INTO user_business_info (
  user_id, provider, channel_id, api_key, whatsapp_number, 
  business_name, provider_meta, is_active, updated_at
) VALUES (
  'USER_ID_HERE',                    -- user_id
  '360dialog',                       -- provider
  'your-360dialog-channel-id',       -- channel_id
  'your-360dialog-api-key',          -- api_key
  '+1234567890',                     -- whatsapp_number
  'Business Name',                   -- business_name
  '{"webhook_configured": true}',    -- provider_meta (JSON)
  true,                              -- is_active
  CURRENT_TIMESTAMP                  -- updated_at
)
ON CONFLICT (user_id) 
DO UPDATE SET
  provider = EXCLUDED.provider,
  channel_id = EXCLUDED.channel_id,
  api_key = EXCLUDED.api_key,
  whatsapp_number = EXCLUDED.whatsapp_number,
  business_name = EXCLUDED.business_name,
  provider_meta = EXCLUDED.provider_meta,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;
*/

-- Update only channel ID for a user (keep existing API key)
/*
UPDATE user_business_info 
SET 
  channel_id = 'new-channel-id',
  updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'USER_ID_HERE' AND is_active = true;
*/

-- Update only API key for a user (keep existing channel ID)
/*
UPDATE user_business_info 
SET 
  api_key = 'new-api-key',
  updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'USER_ID_HERE' AND is_active = true;
*/

-- Clear API key for a user (keep channel ID)
/*
UPDATE user_business_info 
SET 
  api_key = NULL,
  updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'USER_ID_HERE' AND is_active = true;
*/

-- ========================================
-- BULK OPERATIONS
-- ========================================

-- Migrate all users from Meta to 360dialog provider (use with caution)
/*
UPDATE user_business_info 
SET 
  provider = '360dialog',
  updated_at = CURRENT_TIMESTAMP
WHERE provider = 'meta' OR provider IS NULL;
*/

-- Activate 360dialog for all users (set is_active = true)
/*
UPDATE user_business_info 
SET 
  is_active = true,
  updated_at = CURRENT_TIMESTAMP
WHERE provider = '360dialog';
*/

-- Find users with incomplete 360dialog setup
SELECT 
  u.id,
  u.username,
  u.name,
  ubi.provider,
  CASE WHEN ubi.channel_id IS NULL OR ubi.channel_id = '' THEN 'Missing' ELSE 'OK' END as channel_id_status,
  CASE WHEN ubi.api_key IS NULL OR ubi.api_key = '' THEN 'Missing' ELSE 'OK' END as api_key_status,
  CASE WHEN ubi.whatsapp_number IS NULL OR ubi.whatsapp_number = '' THEN 'Missing' ELSE 'OK' END as phone_status
FROM users u
LEFT JOIN user_business_info ubi ON u.id = ubi.user_id
WHERE u.role = 'user' 
  AND (ubi.provider = '360dialog' OR ubi.provider IS NULL)
  AND (
    ubi.channel_id IS NULL OR ubi.channel_id = '' OR
    ubi.api_key IS NULL OR ubi.api_key = '' OR
    ubi.whatsapp_number IS NULL OR ubi.whatsapp_number = ''
  )
ORDER BY u.username;

-- ========================================
-- SECURITY & MAINTENANCE
-- ========================================

-- List all API keys (for security audit - be careful with this!)
-- Only run this in secure environment
/*
SELECT 
  u.username,
  ubi.channel_id,
  LEFT(ubi.api_key, 10) || '...' as api_key_preview,
  LENGTH(ubi.api_key) as key_length,
  ubi.updated_at
FROM users u
JOIN user_business_info ubi ON u.id = ubi.user_id
WHERE ubi.api_key IS NOT NULL AND LENGTH(ubi.api_key) > 0
ORDER BY ubi.updated_at DESC;
*/

-- Find duplicate channel IDs (should be unique per channel)
SELECT 
  channel_id,
  COUNT(*) as usage_count,
  STRING_AGG(u.username, ', ') as users
FROM user_business_info ubi
JOIN users u ON ubi.user_id = u.id
WHERE ubi.channel_id IS NOT NULL 
  AND ubi.is_active = true
GROUP BY channel_id
HAVING COUNT(*) > 1
ORDER BY usage_count DESC;

-- Clean up inactive/old settings
/*
DELETE FROM user_business_info 
WHERE is_active = false 
  AND updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 days');
*/

-- ========================================
-- WEBHOOK CONFIGURATION HELPERS
-- ========================================

-- Show webhook URLs for all active 360dialog users
SELECT 
  u.username,
  ubi.channel_id,
  ubi.whatsapp_number,
  'https://primesms.app/webhooks/360dialog' as webhook_url,
  CASE WHEN ubi.api_key IS NOT NULL THEN 'Configured' ELSE 'Missing' END as api_key_status
FROM users u
JOIN user_business_info ubi ON u.id = ubi.user_id
WHERE ubi.provider = '360dialog' 
  AND ubi.is_active = true 
  AND ubi.channel_id IS NOT NULL
ORDER BY u.username;

-- ========================================
-- DIAGNOSTIC QUERIES
-- ========================================

-- Check database schema has been migrated properly
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_business_info' 
  AND column_name IN ('provider', 'channel_id', 'api_key', 'provider_meta', 'updated_at')
ORDER BY column_name;

-- Check for any constraint violations or data issues
SELECT 
  'Channel ID format' as check_type,
  COUNT(*) as issue_count
FROM user_business_info 
WHERE channel_id IS NOT NULL 
  AND (
    channel_id !~ '^[A-Za-z0-9._-]+$' OR 
    LENGTH(channel_id) < 2 OR 
    LENGTH(channel_id) > 128
  )
UNION ALL
SELECT 
  'API key format' as check_type,
  COUNT(*) as issue_count
FROM user_business_info 
WHERE api_key IS NOT NULL 
  AND (
    LENGTH(api_key) < 10 OR 
    LENGTH(api_key) > 4096 OR
    api_key != TRIM(api_key)
  )
ORDER BY check_type;

-- Performance check - ensure indexes are working
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM user_business_info 
WHERE provider = '360dialog' AND channel_id = 'test-channel' AND is_active = true;

-- ========================================
-- SAMPLE DATA FOR TESTING
-- ========================================

-- Create test 360dialog configuration (for development)
/*
INSERT INTO user_business_info (
  user_id, provider, channel_id, api_key, whatsapp_number, 
  business_name, is_active, updated_at
) VALUES (
  (SELECT id FROM users WHERE username = 'primesms' LIMIT 1), -- Use admin user for testing
  '360dialog',
  'test-channel-123',
  'test-api-key-1234567890',
  '+1234567890',
  'Test Business',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) 
DO UPDATE SET
  provider = EXCLUDED.provider,
  channel_id = EXCLUDED.channel_id,
  api_key = EXCLUDED.api_key,
  whatsapp_number = EXCLUDED.whatsapp_number,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;
*/