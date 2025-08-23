# 360dialog Webhook Setup - Production Ready

## 🎯 Overview

Prime SMS now includes a production-ready 360dialog webhook receiver for WhatsApp Business API integration. The webhook handles all 360dialog notification types (messages, statuses, errors) with fast acknowledgment and asynchronous processing.

## 🔧 Configuration

### Environment Variables (Optional)

```bash
# Optional Basic Authentication (if set, webhook will require these credentials)
D360_WEBHOOK_BASIC_USER=your_webhook_user
D360_WEBHOOK_BASIC_PASS=your_secure_password

# Ring buffer size for debug logging (default: 200)
WEBHOOK_RING_SIZE=200
```

## 📍 Webhook Endpoints

### Health Check
```
GET /webhooks/360dialog
```
- Returns: `360dialog webhook operational`
- Also supports Meta-style hub challenge verification

### Main Webhook Receiver  
```
POST /webhooks/360dialog
```
- Accepts any 360dialog JSON payload
- Returns `200 OK` immediately (< 250ms)
- Processes all events asynchronously

### Debug Endpoint
```
GET /webhooks/360dialog/debug/recent?limit=50
```
- Shows recent webhook events from memory
- Useful for testing and troubleshooting

## 🔐 Security

- **Optional Basic Auth**: Only enabled if both `D360_WEBHOOK_BASIC_USER` and `D360_WEBHOOK_BASIC_PASS` are set
- **Fast ACK**: Always returns 200 OK to prevent 360dialog retries
- **IP Logging**: Logs client IP addresses for monitoring
- **Failed auth still returns 200** to avoid retry loops

## 🚀 360dialog Webhook Registration

### Option 1: Phone-Level Webhook (Recommended)

```bash
curl -X POST "https://waba-v2.360dialog.io/v1/configs/webhook" \
  -H "Content-Type: application/json" \
  -H "D360-API-KEY: YOUR_360DIALOG_API_KEY" \
  -d '{
    "url": "https://yourdomain.com/webhooks/360dialog",
    "headers": {
      "Authorization": "Basic BASE64_ENCODED_CREDENTIALS"
    }
  }'
```

**With Basic Auth Example:**
```bash
# Generate Base64 credentials
CREDS=$(printf '%s' 'your_webhook_user:your_secure_password' | base64)

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

### Option 2: WABA-Level Webhook (Fallback)

```bash
curl -X POST "https://waba-v2.360dialog.io/waba_webhook" \
  -H "Content-Type: application/json" \
  -H "D360-API-KEY: YOUR_360DIALOG_API_KEY" \
  -d '{
    "url": "https://yourdomain.com/webhooks/360dialog",
    "headers": {
      "Authorization": "Basic BASE64_ENCODED_CREDENTIALS"
    },
    "override_all": false
  }'
```

## 🧪 Testing Your Webhook

### 1. Health Check
```bash
curl "https://yourdomain.com/webhooks/360dialog"
# Expected: "360dialog webhook operational"
```

### 2. Test Message Webhook
```bash
curl -X POST "https://yourdomain.com/webhooks/360dialog" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YOUR_BASE64_CREDS" \
  --data '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WABA_TEST_123",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "12345",
            "phone_number_id": "67890"
          },
          "contacts": [{
            "wa_id": "15551234567",
            "profile": {"name": "Test User"}
          }],
          "messages": [{
            "id": "wamid.TEST123",
            "from": "15551234567",
            "timestamp": "1724380000",
            "type": "text",
            "text": {"body": "Test message from 360dialog"}
          }]
        }
      }]
    }]
  }'
```

### 3. Test Status Webhook
```bash
curl -X POST "https://yourdomain.com/webhooks/360dialog" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YOUR_BASE64_CREDS" \
  --data '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WABA_TEST_123",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "12345",
            "phone_number_id": "67890"
          },
          "statuses": [{
            "id": "wamid.STATUS123",
            "status": "delivered",
            "timestamp": "1724380000",
            "recipient_id": "15551234567"
          }]
        }
      }]
    }]
  }'
```

### 4. Check Debug Logs
```bash
curl "https://yourdomain.com/webhooks/360dialog/debug/recent?limit=5"
```

## 📊 Webhook Payload Types Handled

The webhook processes all 360dialog payload types:

- **Messages**: Incoming customer messages
- **Statuses**: Message delivery status updates
- **Errors**: Rate limits, delivery failures, etc.
- **Template Updates**: Template approval/rejection notifications

## 🔍 Logging & Debugging

### Console Logs
- All events are logged with timestamps and IP addresses
- Rich logging shows message counts, status types, error details
- Basic Auth success/failure is logged

### Debug Endpoint
- In-memory ring buffer stores last 200 events (configurable)
- Shows complete request headers and payload
- Includes processing summary and auth status

## ⚠️ Important Notes for 360dialog

1. **Fast Response**: Webhook always returns 200 OK within ~250ms
2. **No Signature Verification**: 360dialog doesn't use Meta's X-Hub-Signature-256
3. **Custom Headers**: Use Basic Auth via 360dialog's webhook headers config
4. **URL Requirements**: 
   - Must be HTTPS in production
   - No underscores in domain name
   - No port numbers in domain
5. **Retries**: 360dialog retries failed webhooks, so always return 200

## 🐳 Docker & Coolify Deployment

The webhook is already integrated into the existing Docker setup:

- Health checks work with Coolify
- No additional ports or services needed
- Environment variables work in Coolify
- Logs available in Coolify dashboard

## 📈 Production Monitoring

Monitor these logs for webhook health:

```
✅ [360DIALOG] Basic Auth successful from IP: xxx.xxx.xxx.xxx
📥 [360DIALOG] Processing 1 message(s)
📊 [360DIALOG] Processing 2 status update(s)
❌ [360DIALOG] Processing 1 error(s)
```

The webhook is now ready for production use with 360dialog!