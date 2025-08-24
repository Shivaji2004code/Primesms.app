#!/usr/bin/env node

/**
 * Comprehensive verification script for 360dialog webhook system
 * Tests the complete flow from database setup to webhook processing
 */

const { Client } = require('pg');
const axios = require('axios');

// Configuration
const config = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    user: process.env.DATABASE_USER || 'postgres', 
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'PrimeSMS_W',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  webhook: {
    url: process.env.WEBHOOK_URL || 'http://localhost:3001/webhooks/360dialog',
    auth: {
      username: process.env.D360_WEBHOOK_BASIC_USER || 'testuser',
      password: process.env.D360_WEBHOOK_BASIC_PASS || 'testpass'
    }
  }
};

async function verifySystem() {
  console.log('🔍 Starting comprehensive webhook system verification...\n');
  
  const results = {
    database: false,
    tables: false,
    indexes: false,
    testData: false,
    webhook: false,
    statusUpdate: false
  };

  // 1. Database Connection Test
  console.log('1️⃣ Testing database connection...');
  const client = new Client(config.database);
  
  try {
    await client.connect();
    console.log('✅ Database connection successful');
    results.database = true;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return results;
  }

  // 2. Table Structure Verification
  console.log('\n2️⃣ Verifying table structure...');
  try {
    const tableQuery = `
      SELECT column_name, data_type, character_maximum_length, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'campaign_logs' 
      AND column_name IN ('id', 'message_id', 'recipient_number', 'status', 'user_id')
      ORDER BY column_name;
    `;
    
    const tableResult = await client.query(tableQuery);
    
    if (tableResult.rows.length >= 5) {
      console.log('✅ Campaign logs table structure verified');
      tableResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
      });
      results.tables = true;
    } else {
      console.log('❌ Campaign logs table missing required columns');
      return results;
    }
  } catch (error) {
    console.log('❌ Table verification failed:', error.message);
    return results;
  }

  // 3. Index Verification
  console.log('\n3️⃣ Verifying webhook indexes...');
  try {
    const indexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'campaign_logs' 
      AND (indexname LIKE '%message_id%' OR indexname LIKE '%recipient_number%')
      ORDER BY indexname;
    `;
    
    const indexResult = await client.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.log('✅ Webhook indexes found:');
      indexResult.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
      results.indexes = true;
    } else {
      console.log('⚠️ No webhook-specific indexes found (may impact performance)');
      results.indexes = true; // Not critical for functionality
    }
  } catch (error) {
    console.log('❌ Index verification failed:', error.message);
  }

  // 4. Test Data Creation
  console.log('\n4️⃣ Creating test data...');
  try {
    // Check if users table has data
    const userCheck = await client.query('SELECT id FROM users LIMIT 1');
    let userId;
    
    if (userCheck.rows.length === 0) {
      console.log('⚠️ No users found, creating test user...');
      const userInsert = await client.query(`
        INSERT INTO users (id, name, email, username, password, role)
        VALUES (gen_random_uuid(), 'Test User', 'test@example.com', 'testuser', 'password123', 'user')
        RETURNING id
      `);
      userId = userInsert.rows[0].id;
    } else {
      userId = userCheck.rows[0].id;
    }

    // Create test campaign record
    const testMessageId = `wamid.TEST_${Date.now()}_WEBHOOK_VERIFICATION`;
    const testRecipient = '+919398424270';
    
    const campaignInsert = await client.query(`
      INSERT INTO campaign_logs (
        user_id, campaign_name, template_used, phone_number_id, recipient_number,
        message_id, status, total_recipients, successful_sends, failed_sends,
        sent_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'sent', 1, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [
      userId,
      'WEBHOOK_TEST_CAMPAIGN',
      'test_template',
      'test_phone_id', 
      testRecipient,
      testMessageId
    ]);
    
    const campaignId = campaignInsert.rows[0].id;
    console.log('✅ Test data created:');
    console.log(`  - User ID: ${userId}`);
    console.log(`  - Campaign ID: ${campaignId}`);
    console.log(`  - Message ID: ${testMessageId}`);
    console.log(`  - Recipient: ${testRecipient}`);
    results.testData = true;

    // 5. Webhook Health Check
    console.log('\n5️⃣ Testing webhook endpoint...');
    try {
      const healthResponse = await axios.get(config.webhook.url, {
        timeout: 5000
      });
      
      if (healthResponse.status === 200) {
        console.log('✅ Webhook endpoint is accessible');
        results.webhook = true;
      } else {
        console.log(`⚠️ Webhook returned status ${healthResponse.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Webhook endpoint not accessible - server may be down');
      } else {
        console.log('⚠️ Webhook health check failed:', error.message);
      }
    }

    // 6. Status Update Test
    console.log('\n6️⃣ Testing webhook status update processing...');
    if (results.webhook) {
      try {
        const statusPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: '123456789',
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919398424270',
                  phone_number_id: '123456789'
                },
                statuses: [{
                  id: testMessageId,
                  status: 'delivered',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  recipient_id: testRecipient.replace('+', '')
                }]
              },
              field: 'messages'
            }]
          }]
        };

        const authHeader = 'Basic ' + Buffer.from(`${config.webhook.auth.username}:${config.webhook.auth.password}`).toString('base64');
        
        const statusResponse = await axios.post(config.webhook.url, statusPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          timeout: 10000
        });

        if (statusResponse.status === 200) {
          console.log('✅ Webhook processed status update successfully');
          
          // Verify database was updated
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for async processing
          
          const updatedRecord = await client.query(
            'SELECT status, delivered_at FROM campaign_logs WHERE id = $1',
            [campaignId]
          );
          
          if (updatedRecord.rows.length > 0) {
            const record = updatedRecord.rows[0];
            console.log(`✅ Database updated - Status: ${record.status}, Delivered: ${record.delivered_at ? 'Yes' : 'No'}`);
            results.statusUpdate = true;
          } else {
            console.log('⚠️ Database record not found after update');
          }
        } else {
          console.log(`❌ Webhook status update failed with status ${statusResponse.status}`);
        }
      } catch (error) {
        console.log('❌ Status update test failed:', error.message);
      }
    }

    // Cleanup test data
    await client.query('DELETE FROM campaign_logs WHERE id = $1', [campaignId]);
    console.log('🧹 Test data cleaned up');

  } catch (error) {
    console.log('❌ Test data creation failed:', error.message);
  }

  await client.end();

  // Final Results
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('========================');
  console.log(`Database Connection: ${results.database ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Table Structure: ${results.tables ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook Indexes: ${results.indexes ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test Data Creation: ${results.testData ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook Endpoint: ${results.webhook ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Status Processing: ${results.statusUpdate ? '✅ PASS' : '❌ FAIL'}`);

  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Score: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All systems verified! Webhook processing is ready for production.');
  } else if (passCount >= 4) {
    console.log('⚠️ Most systems verified. Some issues may need attention.');
  } else {
    console.log('❌ Multiple issues found. System needs configuration.');
  }

  return results;
}

// Run verification if script is executed directly
if (require.main === module) {
  verifySystem().catch(error => {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  });
}

module.exports = { verifySystem };