#!/usr/bin/env node

/**
 * Test script for 360dialog webhook message status updates
 * This script simulates webhook payloads to test the message status update functionality
 */

const axios = require('axios');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/webhooks/360dialog';
const BASIC_USER = process.env.D360_WEBHOOK_BASIC_USER || 'testuser';
const BASIC_PASS = process.env.D360_WEBHOOK_BASIC_PASS || 'testpass';

// Test message IDs (these should exist in your database)
const TEST_MESSAGE_IDS = [
  'wamid.HBgMOTE5Mzk4NDI0MjcwFQIAERgSQjNFNzEzRjE1NTQ3ODk4QzUE',
  'wamid.HBgMOTE5Mzk4NDI0MjcwFQIAERgSQjNFNzEzRjE1NTQ3ODk4QzUF',
  'wamid.HBgMOTE5Mzk4NDI0MjcwFQIAERgSQjNFNzEzRjE1NTQ3ODk4QzUG'
];

// Create auth header
const authHeader = 'Basic ' + Buffer.from(`${BASIC_USER}:${BASIC_PASS}`).toString('base64');

/**
 * Send webhook payload to test endpoint
 */
async function sendWebhookPayload(payload, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log('📤 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'User-Agent': '360dialog-webhook-test/1.0'
      },
      timeout: 10000
    });
    
    console.log(`✅ Response: ${response.status} ${response.statusText}`);
    console.log('📥 Response Data:', response.data);
    
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ HTTP Error: ${error.response.status} ${error.response.statusText}`);
      console.log('📥 Error Data:', error.response.data);
      return { success: false, status: error.response.status, data: error.response.data };
    } else {
      console.log(`❌ Network Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Create message status update payload
 */
function createStatusUpdatePayload(messageId, status, recipientId = '+919398424270') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456789',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '919398424270',
                phone_number_id: '123456789'
              },
              statuses: [
                {
                  id: messageId,
                  status: status,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  recipient_id: recipientId.replace('+', ''),
                  conversation: {
                    id: 'conversation_id_example',
                    origin: {
                      type: 'user_initiated'
                    }
                  },
                  pricing: {
                    billable: true,
                    pricing_model: 'CBP',
                    category: 'user_initiated'
                  }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };
}

/**
 * Create message with errors payload
 */
function createErrorPayload(messageId, errors) {
  const payload = createStatusUpdatePayload(messageId, 'failed');
  payload.entry[0].changes[0].value.statuses[0].errors = errors;
  return payload;
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting 360dialog Webhook Status Update Tests');
  console.log(`📍 Target URL: ${WEBHOOK_URL}`);
  console.log(`🔐 Auth: ${BASIC_USER}:***`);
  
  const tests = [
    // Test 1: Health check
    {
      description: 'Health check (GET request)',
      test: async () => {
        try {
          const response = await axios.get(WEBHOOK_URL);
          return { success: true, status: response.status, data: response.data };
        } catch (error) {
          if (error.response) {
            return { success: false, status: error.response.status, data: error.response.data };
          }
          return { success: false, error: error.message };
        }
      }
    },
    
    // Test 2: Message sent status
    {
      description: 'Message sent status update',
      payload: createStatusUpdatePayload(TEST_MESSAGE_IDS[0], 'sent')
    },
    
    // Test 3: Message delivered status
    {
      description: 'Message delivered status update',
      payload: createStatusUpdatePayload(TEST_MESSAGE_IDS[0], 'delivered')
    },
    
    // Test 4: Message read status
    {
      description: 'Message read status update',
      payload: createStatusUpdatePayload(TEST_MESSAGE_IDS[0], 'read')
    },
    
    // Test 5: Message failed status
    {
      description: 'Message failed status with error',
      payload: createErrorPayload(TEST_MESSAGE_IDS[1], [
        {
          code: 1006,
          title: 'Message undeliverable',
          message: 'Message failed to deliver',
          error_data: {
            details: 'Phone number not reachable'
          }
        }
      ])
    },
    
    // Test 6: Unknown message ID
    {
      description: 'Status update for unknown message ID',
      payload: createStatusUpdatePayload('wamid.unknown_message_id_12345', 'delivered')
    },
    
    // Test 7: Invalid payload structure
    {
      description: 'Invalid payload structure',
      payload: {
        object: 'invalid_object',
        entry: []
      }
    },
    
    // Test 8: Multiple status updates in single payload
    {
      description: 'Multiple status updates in single payload',
      payload: {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '919398424270',
                    phone_number_id: '123456789'
                  },
                  statuses: [
                    {
                      id: TEST_MESSAGE_IDS[0],
                      status: 'delivered',
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      recipient_id: '919398424270'
                    },
                    {
                      id: TEST_MESSAGE_IDS[1],
                      status: 'read',
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      recipient_id: '919398424270'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      }
    }
  ];
  
  console.log(`\n📊 Running ${tests.length} tests...\n`);
  
  const results = [];
  
  for (const [index, test] of tests.entries()) {
    console.log(`\n--- Test ${index + 1}/${tests.length} ---`);
    
    let result;
    if (test.test) {
      result = await test.test();
    } else if (test.payload) {
      result = await sendWebhookPayload(test.payload, test.description);
    }
    
    results.push({
      test: test.description,
      ...result
    });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n\n📋 Test Summary');
  console.log('===============');
  
  const passed = results.filter(r => r.success && r.status === 200).length;
  const failed = results.length - passed;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  
  console.log('\n📝 Detailed Results:');
  results.forEach((result, index) => {
    const status = result.success && result.status === 200 ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.test} (Status: ${result.status || 'N/A'})`);
  });
  
  if (failed > 0) {
    console.log('\n❌ Some tests failed. Check the logs above for details.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, sendWebhookPayload, createStatusUpdatePayload };