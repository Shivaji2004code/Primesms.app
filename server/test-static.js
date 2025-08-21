#!/usr/bin/env node

/**
 * Simple Static File Test
 * 
 * Tests if the server can serve static files correctly
 * without requiring database connection.
 */

const http = require('http');

// Configuration
const SERVER_PORT = process.env.PORT || 5050;
const SERVER_HOST = 'localhost';

// Test paths
const paths = [
  '/health',
  '/assets/index-D2mMRYdK.js',
  '/assets/index-DJ2sFhe8.css',
  '/assets/non-existent.js',
  '/assets/non-existent.css',
  '/refresh',
  '/debug-assets'
];

// Make a request
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ ${path} - Status: ${res.statusCode}, Content-Type: ${res.headers['content-type'] || 'none'}`);
        resolve(true);
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ ${path} - Error: ${error.message}`);
      resolve(false);
    });
    
    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('🧪 Starting static file tests...\n');
  
  let success = 0;
  let failed = 0;
  
  // Start the server in a separate process
  console.log('🚀 Testing paths:');
  
  for (const path of paths) {
    try {
      const result = await makeRequest(path);
      if (result) success++;
      else failed++;
    } catch (error) {
      console.error(`Error testing ${path}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Results: ${success} passed, ${failed} failed`);
}

// Run the tests
runTests();
