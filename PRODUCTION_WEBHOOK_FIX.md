# Production Webhook Fix for Prime SMS

## Issue Identified
The webhook is showing `user 1` but not forwarding messages because:
1. Production database has different data than development
2. User 1 in production has phone_number_id `711843948681844` but empty `webhook_url`
3. The `app_secret` column might be missing in production database

## Steps to Fix in Coolify Production

### 1. Connect to Production Database
In Coolify dashboard, open database terminal and run:

```sql
-- Check if app_secret column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_business_info' 
AND column_name = 'app_secret';

-- If app_secret column doesn't exist, add it:
ALTER TABLE user_business_info ADD COLUMN IF NOT EXISTS app_secret TEXT;
COMMENT ON COLUMN user_business_info.app_secret IS 'Meta App Secret for webhook signature verification';
```

### 2. Check Current User Data
```sql
-- Find the user with the phone number ID from logs
SELECT user_id, business_name, whatsapp_number_id, webhook_url, app_secret 
FROM user_business_info 
WHERE whatsapp_number_id = '711843948681844';

-- Check what user this maps to
SELECT u.id, u.name, u.username, ubi.webhook_url
FROM users u 
LEFT JOIN user_business_info ubi ON u.id = ubi.user_id 
WHERE ubi.whatsapp_number_id = '711843948681844';
```

### 3. Update Webhook URL for the User
Replace `<USER_WEBHOOK_URL>` with the actual webhook URL for n8n forwarding:

```sql
-- Update webhook URL for the user
UPDATE user_business_info 
SET webhook_url = '<USER_WEBHOOK_URL>', 
    updated_at = CURRENT_TIMESTAMP 
WHERE whatsapp_number_id = '711843948681844';

-- Verify the update
SELECT user_id, business_name, webhook_url 
FROM user_business_info 
WHERE whatsapp_number_id = '711843948681844';
```

### 4. Update App Secret (if needed)
If the user needs their own app secret:

```sql
-- Update app secret for the user
UPDATE user_business_info 
SET app_secret = '<USER_APP_SECRET>', 
    updated_at = CURRENT_TIMESTAMP 
WHERE whatsapp_number_id = '711843948681844';
```

### 5. Test the Fix
After updating the database, send a test message to the WhatsApp number and check the logs. You should see:

```
🎯 [N8N_WEBHOOK_PROCESSOR] Found webhook URL for user 1: <USER_WEBHOOK_URL>
📤 [N8N_FORWARDER] Successfully forwarded inbound message to n8n for user 1
```

## Expected Behavior After Fix
1. Incoming messages to phone number ID `711843948681844` will be mapped to the correct user
2. The webhook URL will be found in the database
3. Messages will be forwarded to the configured n8n webhook URL
4. App secret will be used for signature verification if configured

## Files that DON'T need changes
The code logic is correct - the issue is just missing data in production database:
- ✅ `metaWebhook.ts` - correctly looks up user by phone_number_id
- ✅ `n8nWebhookProcessor.ts` - correctly checks for webhook_url
- ✅ `admin.ts` - already supports webhook_url in business info updates

## Admin Panel Alternative
Instead of SQL commands, you can also:
1. Login to admin panel in production
2. Go to user management
3. Find the user with phone number ID `711843948681844` 
4. Update their business info with the webhook URL
5. Save the changes