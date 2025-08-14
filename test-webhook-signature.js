#!/usr/bin/env node

const crypto = require('crypto');

// Test webhook signature verification
function testWebhookSignature() {
  console.log('🧪 Testing Meta Webhook Signature Verification\n');

  // Sample webhook payload (you can replace with real payload)
  const samplePayload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "your_waba_id",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "+1234567890",
                "phone_number_id": "your_phone_number_id"
              },
              "messages": [
                {
                  "from": "1234567890",
                  "id": "test_message_id",
                  "timestamp": "1234567890",
                  "text": {
                    "body": "Hello, this is a test message"
                  },
                  "type": "text"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  };

  const payload = JSON.stringify(samplePayload);
  console.log('📦 Sample payload:', payload.substring(0, 100) + '...\n');

  // Test with different app secrets
  const testSecrets = [
    process.env.META_APP_SECRET,
    'your_test_secret_here', // Replace with your actual app secret
    'wrong_secret'
  ];

  testSecrets.forEach((secret, index) => {
    if (!secret) {
      console.log(`❌ Test ${index + 1}: No secret provided`);
      return;
    }

    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    console.log(`🔑 Test ${index + 1}: Secret length: ${secret.length}`);
    console.log(`📝 Generated signature: ${signature.substring(0, 30)}...`);
    console.log(`✅ This signature should match what Meta sends\n`);
  });

  console.log('💡 To test with real webhook:');
  console.log('1. Copy the actual webhook payload from your logs');
  console.log('2. Replace samplePayload with the real payload');
  console.log('3. Run this script again');
  console.log('4. Compare generated signature with X-Hub-Signature-256 header');
}

// Function to verify a real signature
function verifyRealSignature(payload, signature, secret) {
  if (!payload || !signature || !secret) {
    console.log('❌ Missing required parameters');
    return false;
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const isValid = signature === expected;
  
  console.log(`🔍 Payload length: ${payload.length}`);
  console.log(`🔍 Received signature: ${signature}`);
  console.log(`🔍 Expected signature: ${expected}`);
  console.log(`🔍 Match: ${isValid ? '✅' : '❌'}`);
  
  return isValid;
}

// Run the test
testWebhookSignature();

// Export for use in other scripts
module.exports = { verifyRealSignature };