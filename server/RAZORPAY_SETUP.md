# Razorpay Integration Setup Guide

This guide explains how to set up Razorpay payment integration for Prime SMS wallet top-ups.

## 🔧 Environment Variables

Add the following environment variables to your Coolify service configuration:

### Required Variables

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_R83wwNGkpXjVpx  # Replace with your actual key ID
RAZORPAY_KEY_SECRET=your_razorpay_key_secret  # Replace with your actual secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret   # Choose a strong secret (64+ chars)

# Credit Pricing
PRICE_PER_CREDIT_INR=1  # Default: 1 credit = ₹1

# Application Base URL
APP_BASE_URL=https://your-domain.com  # Your production domain
```

### Optional Variables

```bash
# Session Configuration (if not already set)
SESSION_SECRET=your_session_secret  # Strong secret for session encryption

# Database Connection (if not already configured)
DATABASE_URL=postgresql://user:password@host:port/database
```

## 🏗️ How to Set Environment Variables in Coolify

1. **Go to your Coolify dashboard**
2. **Navigate to your Prime SMS service**
3. **Click on "Environment Variables"**
4. **Add each variable:**
   - Name: `RAZORPAY_KEY_ID`
   - Value: `rzp_test_R83wwNGkpXjVpx` (replace with your actual key)
   - Click "Add"
   
5. **Repeat for all variables above**
6. **Deploy your service** to apply the changes

## 🔑 Getting Razorpay Keys

### Test Mode (Development/Testing)

1. **Sign up** at https://razorpay.com
2. **Go to Dashboard** → **Settings** → **API Keys**
3. **Generate Test Keys:**
   - Key ID starts with `rzp_test_`
   - Key Secret is a long string
4. **Use these for testing** (no real money transactions)

### Live Mode (Production)

1. **Complete KYC verification** in Razorpay dashboard
2. **Generate Live Keys:**
   - Key ID starts with `rzp_live_`
   - Key Secret is different from test
3. **Switch environment variables** when going live

## 🪝 Webhook Configuration

### Setting up Webhooks in Razorpay Dashboard

1. **Go to Razorpay Dashboard** → **Settings** → **Webhooks**
2. **Click "Create New Webhook"**
3. **Configure:**
   - **URL:** `https://your-domain.com/api/payments/razorpay/webhook`
   - **Secret:** Use the same value as `RAZORPAY_WEBHOOK_SECRET`
   - **Events to Enable:**
     - ✅ `payment.captured`
     - ✅ `order.paid`
     - ✅ `payment.failed`
4. **Save the webhook**

### Webhook Security

- Webhooks are **automatically verified** using HMAC-SHA256
- Only requests with valid signatures are processed
- Invalid webhooks return HTTP 400 and are logged

## 🧪 Testing the Integration

### Test Cards (Test Mode Only)

Use these test card numbers in Test Mode:

```
# Successful payments
Card: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date

# Failed payments
Card: 4111 1111 1111 1112
CVV: Any 3 digits
Expiry: Any future date
```

### Testing Flow

1. **Start your server** with test environment variables
2. **Go to** `/user/wallet-demo` (requires login)
3. **Select amount** (₹10,000 - ₹1,00,000)
4. **Click "Add Credits"**
5. **Use test card** in Razorpay checkout
6. **Verify credits** are added to user account

### UPI Testing

In test mode, use these UPI IDs:
- **Success:** `success@razorpay`
- **Failure:** `failure@razorpay`

## 📊 Monitoring & Logs

### Server Logs

The integration logs all payment activities:

```bash
# View payment logs
docker logs your_container_name | grep PAYMENT
docker logs your_container_name | grep RAZORPAY
docker logs your_container_name | grep WEBHOOK
```

### Razorpay Dashboard

Monitor payments in real-time:
1. **Dashboard** → **Transactions** → **Payments**
2. **View payment details, refunds, disputes**
3. **Download reports** for accounting

## 🚀 Going Live

### Pre-Launch Checklist

- [ ] **KYC completed** in Razorpay dashboard
- [ ] **Live API keys** generated and configured
- [ ] **Webhook URL** updated with live domain
- [ ] **Test a small transaction** (₹10,000 credits)
- [ ] **Verify webhook** receives events correctly
- [ ] **Check credit addition** in user account

### Switch to Live Mode

1. **Update environment variables:**
   ```bash
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxxx  # Live key
   RAZORPAY_KEY_SECRET=live_secret     # Live secret
   ```

2. **Update webhook URL** in dashboard:
   ```
   https://primesms.app/api/payments/razorpay/webhook
   ```

3. **Deploy** and test with a small amount

## 🔒 Security Best Practices

### Environment Variables
- ✅ **Never commit** secrets to Git
- ✅ **Use strong webhook secrets** (64+ characters)
- ✅ **Rotate secrets periodically**
- ✅ **Limit API key permissions** in Razorpay dashboard

### Server Security
- ✅ **HTTPS only** for webhooks
- ✅ **Signature verification** for all webhooks
- ✅ **Rate limiting** on payment endpoints
- ✅ **Input validation** on all payment amounts

### Monitoring
- ✅ **Log all payment attempts**
- ✅ **Alert on failed webhooks**
- ✅ **Monitor unusual patterns**
- ✅ **Regular backup** of payment data

## 🐛 Troubleshooting

### Common Issues

**"Order creation failed"**
- ✅ Check `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- ✅ Verify Razorpay account is active
- ✅ Check server logs for API errors

**"Signature verification failed"**
- ✅ Verify `RAZORPAY_KEY_SECRET` is correct
- ✅ Check webhook secret matches Razorpay dashboard
- ✅ Ensure no whitespace in environment variables

**"Webhook not received"**
- ✅ Check webhook URL is accessible (test with curl)
- ✅ Verify webhook events are enabled in dashboard
- ✅ Check Razorpay webhook logs for delivery status

**"Credits not added"**
- ✅ Check database connection is working
- ✅ Verify user session is valid
- ✅ Check credit system logs for errors

### Debug Endpoints

Access these endpoints for debugging (dev only):

```bash
# Payment statistics
GET /api/payments/razorpay/stats

# Session debug
GET /api/debug/session

# Files debug
GET /api/debug/files
```

## 📞 Support

For Razorpay-specific issues:
- **Razorpay Support:** https://razorpay.com/support/
- **Razorpay Docs:** https://razorpay.com/docs/

For Prime SMS integration issues:
- Check server logs first
- Verify environment variables
- Test with smaller amounts
- Use debug endpoints for diagnostics

## 🎯 Success Metrics

Monitor these KPIs:
- **Payment Success Rate** (target: >95%)
- **Webhook Delivery Rate** (target: >99%)
- **Average Payment Time** (target: <30 seconds)
- **Credit Addition Accuracy** (target: 100%)

---

🎉 **You're all set!** The Razorpay integration provides secure, reliable wallet top-ups for your Prime SMS users.