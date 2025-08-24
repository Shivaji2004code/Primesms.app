#!/usr/bin/env node

/**
 * Script to run the webhook message status tracking migration
 * This ensures the database is properly set up for 360dialog webhook processing
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection config from environment variables
const config = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'PrimeSMS_W',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
};

async function runMigration() {
  console.log('🚀 Starting webhook message status tracking migration...');
  console.log('📍 Database config:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: !!config.ssl
  });

  const client = new Client(config);

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migration_webhook_message_status_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('⚡ Executing migration...');
    const result = await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Migration result:', result);

    // Verify indexes were created
    const indexCheckQuery = `
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename = 'campaign_logs' 
      AND indexname LIKE '%message_id%' OR indexname LIKE '%recipient_number%'
      ORDER BY indexname;
    `;
    
    const indexes = await client.query(indexCheckQuery);
    console.log('🔍 Webhook-related indexes created:');
    indexes.rows.forEach(row => {
      console.log(`  - ${row.indexname} on ${row.tablename}`);
    });

    // Check campaign_logs table structure
    const tableCheckQuery = `
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'campaign_logs' 
      AND column_name IN ('message_id', 'recipient_number', 'webhook_processed_at', 'message_pricing')
      ORDER BY column_name;
    `;
    
    const columns = await client.query(tableCheckQuery);
    console.log('📋 Campaign logs webhook-related columns:');
    columns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n🎯 Webhook message status tracking is ready!');
    console.log('📡 The system can now:');
    console.log('  - Receive 360dialog webhook status updates');
    console.log('  - Match message IDs to campaign records');
    console.log('  - Update delivery statuses in real-time');
    console.log('  - Handle non-integer message IDs properly');
    console.log('  - Emit SSE events for frontend updates');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Database connection refused. Please check:');
      console.error('  - Database is running');
      console.error('  - Host and port are correct');
      console.error('  - Network connectivity');
    } else if (error.code === '28P01') {
      console.error('💡 Authentication failed. Please check:');
      console.error('  - Username and password are correct');
      console.error('  - User has database access permissions');
    } else if (error.code === '3D000') {
      console.error('💡 Database does not exist. Please check:');
      console.error('  - Database name is correct');
      console.error('  - Database has been created');
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  runMigration().catch(error => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };