# 360dialog Migration - Coolify Database Setup

## 🎯 Overview

This guide covers the database migration steps to switch Prime SMS from Meta WhatsApp Business API to 360dialog integration. The migration is designed to be **safe and reversible** with minimal downtime.

## 📋 Prerequisites

- Coolify dashboard access
- Database admin access (PostgreSQL or MySQL)
- Backup of current database
- 360dialog account with Channel ID and API Key

## 🗄️ Database Migration Steps

### Step 1: Create Database Backup

**In Coolify Dashboard:**

1. Go to your Prime SMS project
2. Navigate to the Database service
3. Click "Backups" → "Create Backup"
4. Wait for backup completion before proceeding

### Step 2: Run Migration V1 (Add 360dialog columns)

**For PostgreSQL:**

1. In Coolify Dashboard, go to Database → Terminal
2. Connect to your database:
   ```bash
   psql -U postgres -d PrimeSMS_W
   ```
3. Copy and paste the contents of `migration_360dialog_add_columns.sql`
4. Verify the migration:
   ```sql
   \d user_business_info
   SELECT COUNT(*) FROM user_business_info WHERE provider = '360dialog';
   ```

**For MySQL:**

1. In Coolify Dashboard, go to Database → Terminal
2. Connect to your database:
   ```bash
   mysql -u root -p PrimeSMS_W
   ```
3. Copy and paste the contents of `migration_360dialog_add_columns_mysql.sql`
4. Verify the migration:
   ```sql
   DESCRIBE user_business_info;
   SELECT COUNT(*) FROM user_business_info WHERE provider = '360dialog';
   ```

### Step 3: Deploy Updated Application

**In Coolify Dashboard:**

1. Update your Prime SMS application with the new code
2. Add environment variables in Settings → Environment Variables:
   ```env
   # Optional - for webhook Basic Auth
   D360_WEBHOOK_BASIC_USER=your_webhook_user
   D360_WEBHOOK_BASIC_PASS=your_secure_password
   
   # Optional - webhook ring buffer size
   WEBHOOK_RING_SIZE=200
   
   # Required - encryption key for API key storage
   ENCRYPTION_KEY=your-32-byte-base64-encryption-key
   ```
3. Deploy the application
4. Verify health endpoints work:
   - `https://yourdomain.com/health`
   - `https://yourdomain.com/webhooks/360dialog`

### Step 4: Configure Admin Settings

1. Login to Prime SMS Admin panel
2. Go to WhatsApp Business Settings
3. You should see the new 360dialog form with:
   - **Channel ID** field (required)
   - **API Key** field (write-only)
   - **Webhook URL** (read-only, for 360dialog setup)

### Step 5: Register Webhook with 360dialog

**Get your webhook URL from the admin panel**, then register it:

```bash
# Generate Base64 credentials (if using Basic Auth)
CREDS=$(printf '%s' 'your_webhook_user:your_secure_password' | base64)

# Register webhook (phone-level, recommended)
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

### Step 6: Test the Integration

**Test webhook reception:**

1. Send a test message to your WhatsApp Business number
2. Check webhook debug endpoint:
   ```bash
   curl "https://yourdomain.com/webhooks/360dialog/debug/recent?limit=5"
   ```
3. Check application logs in Coolify for webhook processing

**Test outbound messaging:**

1. Use the Prime SMS interface to send a test message
2. Verify delivery status updates are received
3. Check the campaign logs in admin panel

## 🔒 Security Considerations

### API Key Encryption

The API key is stored encrypted using AES-GCM. Generate a secure encryption key:

```bash
# Generate 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add this to Coolify environment variables as `ENCRYPTION_KEY`.

### Database Security

1. **Verify column encryption**:
   ```sql
   -- PostgreSQL
   SELECT user_id, channel_id, 
          CASE WHEN api_key_ciphertext IS NOT NULL THEN 'ENCRYPTED' ELSE 'NULL' END as api_key_status
   FROM user_business_info WHERE provider = '360dialog';
   
   -- MySQL
   SELECT user_id, channel_id,
          CASE WHEN api_key_ciphertext IS NOT NULL THEN 'ENCRYPTED' ELSE 'NULL' END as api_key_status
   FROM user_business_info WHERE provider = '360dialog';
   ```

2. **Verify no plaintext secrets**:
   ```sql
   -- Should return 0 rows with readable API keys
   SELECT * FROM user_business_info WHERE api_key_ciphertext LIKE '%sk_%' OR api_key_ciphertext LIKE '%key_%';
   ```

## 🚨 Rollback Procedure (If Needed)

### Emergency Rollback

If issues occur, you can rollback quickly:

1. **Revert application** in Coolify to previous deployment
2. **Restore database** from backup if needed
3. **Re-enable Meta endpoints** temporarily

### Partial Rollback (Keep New Schema)

The migration keeps legacy Meta columns for safety:

```sql
-- PostgreSQL - Switch a user back to Meta temporarily
UPDATE user_business_info 
SET provider = 'meta' 
WHERE user_id = 'USER_ID' AND whatsapp_number_id IS NOT NULL;

-- MySQL - Same query
UPDATE user_business_info 
SET provider = 'meta' 
WHERE user_id = 'USER_ID' AND whatsapp_number_id IS NOT NULL;
```

## 🧹 Cleanup Phase (After Successful Migration)

**⚠️ Only run after 1-2 weeks of successful 360dialog operation**

### Step 7: Remove Legacy Columns (Optional)

This step is **irreversible** - only proceed when confident:

**For PostgreSQL:**
```sql
-- Run migration_360dialog_cleanup_legacy.sql
\i migration_360dialog_cleanup_legacy.sql
```

**For MySQL:**
```sql
-- Run migration_360dialog_cleanup_legacy_mysql.sql
source migration_360dialog_cleanup_legacy_mysql.sql
```

## 📊 Monitoring & Verification

### Key Metrics to Monitor

1. **Webhook Success Rate**:
   ```bash
   curl "https://yourdomain.com/webhooks/360dialog/debug/recent?limit=50" | jq '.data[].auth' | sort | uniq -c
   ```

2. **Database Health**:
   ```sql
   -- Check migration status
   SELECT 
     provider,
     COUNT(*) as user_count,
     COUNT(CASE WHEN channel_id IS NOT NULL THEN 1 END) as with_channel_id,
     COUNT(CASE WHEN api_key_ciphertext IS NOT NULL THEN 1 END) as with_encrypted_key
   FROM user_business_info 
   GROUP BY provider;
   ```

3. **Application Logs** in Coolify:
   - Look for `[360DIALOG]` webhook entries
   - Verify no encryption/decryption errors
   - Check message sending success rates

### Health Check Endpoints

- **App Health**: `https://yourdomain.com/health`
- **Database Health**: `https://yourdomain.com/api/health/db`
- **360dialog Webhook**: `https://yourdomain.com/webhooks/360dialog`

## 🆘 Troubleshooting

### Common Issues

1. **Webhook 401/403 Errors**:
   - Check Basic Auth credentials in 360dialog webhook config
   - Verify environment variables in Coolify

2. **API Key Decryption Errors**:
   - Verify `ENCRYPTION_KEY` environment variable
   - Check encryption key format (should be base64)

3. **Database Connection Issues**:
   - Verify database migrations completed successfully
   - Check foreign key constraints

4. **Missing UI Components**:
   - Rebuild client with `npm run build` in server directory
   - Verify new React components are included in build

### Support Commands

**Check webhook registration:**
```bash
curl -H "D360-API-KEY: YOUR_API_KEY" \
  "https://waba-v2.360dialog.io/v1/configs/webhook"
```

**Test webhook manually:**
```bash
curl -X POST "https://yourdomain.com/webhooks/360dialog" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YOUR_BASE64_CREDS" \
  --data '{"object":"whatsapp_business_account","entry":[{"id":"test","changes":[{"field":"messages","value":{"messages":[{"id":"test","from":"1234567890","type":"text","text":{"body":"test"}}]}}]}]}'
```

The migration is now complete and ready for production use! 🚀