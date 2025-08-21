#!/usr/bin/env node

/**
 * Asset Serving Test Script
 * 
 * This script tests if the server can correctly handle asset requests
 * with different filenames. It simulates the browser requesting assets
 * with various filenames and checks if the server responds correctly.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const SERVER_PORT = process.env.PORT || 5050;
const SERVER_HOST = 'localhost';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Helper function to make HTTP requests
function makeRequest(path, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'AssetTestScript/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          path
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Main test function
async function runTests() {
  console.log(`${colors.cyan}=== Asset Serving Test ====${colors.reset}`);
  console.log(`${colors.cyan}Testing server at ${SERVER_HOST}:${SERVER_PORT}${colors.reset}`);
  
  try {
    // Test 1: Check if server is running
    console.log(`\n${colors.yellow}Test 1: Server Health Check${colors.reset}`);
    const healthCheck = await makeRequest('/health');
    console.log(`Status: ${healthCheck.status === 200 ? colors.green + healthCheck.status + colors.reset : colors.red + healthCheck.status + colors.reset}`);
    
    // Test 2: Check debug-assets endpoint
    console.log(`\n${colors.yellow}Test 2: Debug Assets Endpoint${colors.reset}`);
    const debugAssets = await makeRequest('/debug-assets');
    console.log(`Status: ${debugAssets.status === 200 ? colors.green + debugAssets.status + colors.reset : colors.red + debugAssets.status + colors.reset}`);
    
    if (debugAssets.status === 200) {
      const assets = JSON.parse(debugAssets.body);
      console.log(`Available assets: ${colors.green}${assets.availableAssets.join(', ')}${colors.reset}`);
      
      // Test 3: Test each available JS asset
      console.log(`\n${colors.yellow}Test 3: Testing JS Assets${colors.reset}`);
      const jsAssets = assets.availableAssets.filter(file => file.endsWith('.js'));
      
      for (const jsAsset of jsAssets) {
        const jsTest = await makeRequest(`/assets/${jsAsset}`);
        console.log(`Asset: ${jsAsset}`);
        console.log(`Status: ${jsTest.status === 200 ? colors.green + jsTest.status + colors.reset : colors.red + jsTest.status + colors.reset}`);
        console.log(`Content-Type: ${jsTest.headers['content-type'] || 'not set'}`);
      }
      
      // Test 4: Test each available CSS asset
      console.log(`\n${colors.yellow}Test 4: Testing CSS Assets${colors.reset}`);
      const cssAssets = assets.availableAssets.filter(file => file.endsWith('.css'));
      
      for (const cssAsset of cssAssets) {
        const cssTest = await makeRequest(`/assets/${cssAsset}`);
        console.log(`Asset: ${cssAsset}`);
        console.log(`Status: ${cssTest.status === 200 ? colors.green + cssTest.status + colors.reset : colors.red + cssTest.status + colors.reset}`);
        console.log(`Content-Type: ${cssTest.headers['content-type'] || 'not set'}`);
      }
      
      // Test 5: Test non-existent assets with our fallback mechanism
      console.log(`\n${colors.yellow}Test 5: Testing Fallback Mechanism${colors.reset}`);
      const nonExistentJs = await makeRequest('/assets/non-existent-file.js');
      console.log(`Non-existent JS Status: ${nonExistentJs.status === 200 ? colors.green + nonExistentJs.status + colors.reset : colors.red + nonExistentJs.status + colors.reset}`);
      
      const nonExistentCss = await makeRequest('/assets/non-existent-file.css');
      console.log(`Non-existent CSS Status: ${nonExistentCss.status === 200 ? colors.green + nonExistentCss.status + colors.reset : colors.red + nonExistentCss.status + colors.reset}`);
      
      // Test 6: Test refresh endpoint
      console.log(`\n${colors.yellow}Test 6: Testing Refresh Endpoint${colors.reset}`);
      const refresh = await makeRequest('/refresh');
      console.log(`Status: ${refresh.status === 200 ? colors.green + refresh.status + colors.reset : colors.red + refresh.status + colors.reset}`);
      console.log(`Content-Type: ${refresh.headers['content-type'] || 'not set'}`);
      console.log(`Cache-Control: ${refresh.headers['cache-control'] || 'not set'}`);
      
      // Check if the HTML contains the correct asset references
      const jsAssetInHtml = jsAssets.some(asset => refresh.body.includes(`/assets/${asset}`));
      const cssAssetInHtml = cssAssets.some(asset => refresh.body.includes(`/assets/${asset}`));
      
      console.log(`JS asset in HTML: ${jsAssetInHtml ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
      console.log(`CSS asset in HTML: ${cssAssetInHtml ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
    }
    
    console.log(`\n${colors.cyan}=== Test Complete ====${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error running tests: ${error.message}${colors.reset}`);
  }
}

// Run the tests
runTests();
