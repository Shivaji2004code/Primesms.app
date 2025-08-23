# 360dialog Admin Management - Production Deployment Guide

## ✅ Implementation Complete

The 360dialog admin user management system is now ready for production deployment with the following features:

### 🚀 **Completed Features:**

1. **Database Schema Migration (PostgreSQL)**
   - ✅ Safe additive migration keeping legacy Meta columns for rollback
   - ✅ New columns: `provider`, `channel_id`, `api_key`, `provider_meta`, `updated_at`
   - ✅ Proper indexes and constraints for performance
   - ✅ Auto-update triggers for timestamps

2. **Server-Side Admin API Endpoints**
   - ✅ `GET /api/admin/whatsapp/settings/:userId` - Get user settings
   - ✅ `PUT /api/admin/whatsapp/settings/:userId` - Update settings
   - ✅ `GET /api/admin/whatsapp/health/:userId` - Configuration health check
   - ✅ `POST /api/admin/whatsapp/test-send/:userId` - Test message sending
   - ✅ Proper validation, error handling, and security

3. **360dialog Webhook System**
   - ✅ Production-ready webhook at `/webhooks/360dialog`
   - ✅ Handles all 360dialog event types (messages, statuses, errors)
   - ✅ Optional Basic Auth security
   - ✅ Fast acknowledgment (< 250ms) and async processing
   - ✅ Debug endpoint for troubleshooting

4. **Admin Management Tools**
   - ✅ SQL scripts for manual database operations
   - ✅ Migration status checks and validation queries
   - ✅ User configuration helpers and diagnostics

## 🗄️ **Database Deployment Steps (Coolify)**

### Step 1: Run the Migration

**In Coolify Dashboard:**

1. Go to Database → Terminal
2. Connect to PostgreSQL:
   ```bash
   psql -U postgres -d PrimeSMS_W
   ```
3. Run the migration:
   ```sql
   \i migration_360dialog_add_columns.sql
   ```
4. Verify:
   ```sql
   \d user_business_info
   SELECT COUNT(*) FROM user_business_info WHERE provider = '360dialog';
   ```

### Step 2: Deploy Application

**In Coolify Dashboard:**

1. Deploy the updated application code
2. Add optional environment variables:
   ```env
   # Optional webhook Basic Auth
   D360_WEBHOOK_BASIC_USER=your_webhook_user
   D360_WEBHOOK_BASIC_PASS=your_secure_password
   
   # Optional webhook buffer size
   WEBHOOK_RING_SIZE=200
   
   # Optional webhook base URL (for webhook URL generation)
   WEBHOOK_BASE_URL=https://yourdomain.com
   ```

### Step 3: Test the Deployment

1. **Health Check:**
   ```bash
   curl "https://yourdomain.com/health"
   curl "https://yourdomain.com/webhooks/360dialog"
   ```

2. **Admin API Test** (replace USER_ID):
   ```bash
   curl -X GET "https://yourdomain.com/api/admin/whatsapp/settings/USER_ID" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## 📊 **API Usage Examples**

### Get User Settings
```bash
curl -X GET "https://yourdomain.com/api/admin/whatsapp/settings/123" \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "userId": "123",
  "businessName": "Test Business", 
  "whatsappNumber": "+1234567890",
  "provider": "360dialog",
  "channelId": "user-channel-id",
  "apiKeySet": true,
  "webhookUrl": "https://yourdomain.com/webhooks/360dialog",
  "updatedAt": "2025-08-23T10:00:00Z"
}
```

### Update User Settings
```bash
curl -X PUT "https://yourdomain.com/api/admin/whatsapp/settings/123" \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "new-channel-id",
    "apiKey": "new-360dialog-api-key"
  }'
```

**Response:**
```json
{
  "success": true,
  "updatedAt": "2025-08-23T11:00:00Z",
  "apiKeySet": true,
  "channelId": "new-channel-id"
}
```

## 🔐 **Security Features**

1. **API Key Storage:** Stored as plaintext in PostgreSQL (as requested)
2. **Never Exposed:** API keys never returned in API responses
3. **Write-Only:** Admin can set new API keys but cannot view existing ones
4. **Webhook Security:** Optional Basic Auth for webhook endpoints
5. **Input Validation:** Strict validation on channel IDs and API key formats

## 🛠️ **Admin Database Operations**

Use the provided `360dialog_admin_scripts.sql` for common operations:

### Check Migration Status
```sql
SELECT 
  provider,
  COUNT(*) as user_count,
  COUNT(CASE WHEN channel_id IS NOT NULL THEN 1 END) as with_channel_id,
  COUNT(CASE WHEN api_key IS NOT NULL THEN 1 END) as with_api_key
FROM user_business_info 
GROUP BY provider;
```

### Configure User Settings
```sql
INSERT INTO user_business_info (
  user_id, provider, channel_id, api_key, whatsapp_number, is_active
) VALUES (
  'USER_ID', '360dialog', 'channel-id', 'api-key', '+1234567890', true
)
ON CONFLICT (user_id) 
DO UPDATE SET
  channel_id = EXCLUDED.channel_id,
  api_key = EXCLUDED.api_key,
  updated_at = CURRENT_TIMESTAMP;
```

### View User Configuration
```sql
SELECT 
  u.username,
  ubi.channel_id,
  CASE WHEN ubi.api_key IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as api_key_status,
  ubi.updated_at
FROM users u
LEFT JOIN user_business_info ubi ON u.id = ubi.user_id
WHERE u.id = 'USER_ID';
```

## 🔧 **360dialog Webhook Registration**

After deployment, register your webhook with 360dialog:

```bash
# Generate Base64 credentials (if using Basic Auth)
CREDS=$(printf '%s' 'your_webhook_user:your_secure_password' | base64)

# Register webhook (phone-level)
curl -X POST "https://waba-v2.360dialog.io/v1/configs/webhook" \
  -H "Content-Type: application/json" \
  -H "D360-API-KEY: YOUR_360DIALOG_API_KEY" \
  -d "{
    \"url\": \"https://yourdomain.com/webhooks/360dialog\",
    \"headers\": {
      \"Authorization\": \"Basic $CREDS\"
    }
  }"
```

## 📈 **Monitoring & Health Checks**

### Application Health
- **App Health:** `https://yourdomain.com/health`
- **Database Health:** `https://yourdomain.com/api/health/db`
- **Webhook Health:** `https://yourdomain.com/webhooks/360dialog`

### Webhook Debugging
```bash
# View recent webhook events
curl "https://yourdomain.com/webhooks/360dialog/debug/recent?limit=10"

# Test webhook manually
curl -X POST "https://yourdomain.com/webhooks/360dialog" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $CREDS" \
  --data '{"object":"whatsapp_business_account","entry":[{"id":"test","changes":[{"field":"messages","value":{"messages":[{"id":"test","from":"1234567890","type":"text","text":{"body":"test"}}]}}]}]}'
```

### Database Monitoring
```sql
-- Check configuration completeness
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN ubi.channel_id IS NOT NULL THEN 1 END) as configured_users,
  COUNT(CASE WHEN ubi.api_key IS NOT NULL THEN 1 END) as users_with_keys
FROM users u
LEFT JOIN user_business_info ubi ON u.id = ubi.user_id
WHERE u.role = 'user';
```

## 🚨 **Rollback Plan (If Needed)**

The migration is designed to be safe and reversible:

1. **Application Rollback:** Deploy previous version in Coolify
2. **Database Rollback:** Legacy Meta columns are still available
3. **Revert Provider:**
   ```sql
   UPDATE user_business_info 
   SET provider = 'meta' 
   WHERE provider = '360dialog' AND whatsapp_number_id IS NOT NULL;
   ```

## ✨ **Next Steps**

1. **Deploy to Production:** Follow the steps above
2. **Configure Admin Users:** Use the API endpoints or SQL scripts
3. **Register Webhooks:** Set up 360dialog webhook integration
4. **Monitor:** Use health checks and debug endpoints
5. **Client UI:** The React components are ready for future frontend integration

## 📁 **Files Created:**

- **`server/src/routes/whatsapp360dialog.ts`** - Admin API endpoints
- **`server/src/routes/webhook360dialog.ts`** - Webhook receiver
- **`migration_360dialog_add_columns.sql`** - Database migration
- **`migration_360dialog_cleanup_legacy.sql`** - Future cleanup migration
- **`360dialog_admin_scripts.sql`** - Admin management scripts
- **`COOLIFY_360DIALOG_MIGRATION.md`** - Detailed migration guide
- **`360DIALOG_WEBHOOK_SETUP.md`** - Webhook setup documentation

The 360dialog admin management system is now **production-ready** for Coolify deployment! 🚀