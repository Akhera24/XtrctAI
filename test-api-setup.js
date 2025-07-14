#!/usr/bin/env node

// X Profile Analyzer - API Configuration Test Script
// This script helps you verify that your X API credentials are properly configured

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🧪 X Profile Analyzer - API Configuration Test\n');

// Function to read env.js and extract bearer token
function extractBearerToken() {
  try {
    const envPath = path.join(__dirname, 'env.js');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Look for bearerToken in the file
    const bearerTokenMatch = envContent.match(/bearerToken:\s*['"`]([^'"`]+)['"`]/);
    
    if (bearerTokenMatch && bearerTokenMatch[1] && bearerTokenMatch[1].trim() !== '') {
      return bearerTokenMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error reading env.js:', error.message);
    return null;
  }
}

// Function to validate bearer token format
function validateTokenFormat(token) {
  if (!token) {
    return { valid: false, reason: 'Token is empty or missing' };
  }
  
  if (typeof token !== 'string') {
    return { valid: false, reason: 'Token is not a string' };
  }
  
  const cleanToken = token.trim();
  
  if (!cleanToken.startsWith('AAAA')) {
    return { valid: false, reason: 'Real X API Bearer tokens should start with "AAAA"' };
  }
  
  if (cleanToken.length < 80) {
    return { valid: false, reason: 'Bearer token appears too short (should be 80+ characters)' };
  }
  
  if (cleanToken.includes('%')) {
    return { valid: false, reason: 'Token appears to be URL encoded (should be plain text)' };
  }
  
  return { valid: true, reason: 'Token format looks correct' };
}

// Function to test API connection
function testApiConnection(bearerToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.twitter.com',
      port: 443,
      path: '/2/users/by/username/twitter',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'X-Profile-Analyzer-Test/1.0'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: response,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: 'Invalid JSON response',
            rawData: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        error: error.message,
        code: error.code
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        success: false,
        error: 'Request timeout',
        code: 'TIMEOUT'
      });
    });

    req.end();
  });
}

// Function to check proxy server
function testProxyConnection() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '143.198.111.238',
      port: 3000,
      path: '/health',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: response
          });
        } catch (error) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: 'Invalid JSON response',
            rawData: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        error: error.message,
        code: error.code
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        success: false,
        error: 'Request timeout',
        code: 'TIMEOUT'
      });
    });

    req.end();
  });
}

// Main test function
async function runTests() {
  console.log('🔍 Step 1: Checking env.js configuration...\n');
  
  // Extract bearer token
  const bearerToken = extractBearerToken();
  
  if (!bearerToken) {
    console.log('❌ No Bearer Token found in env.js');
    console.log('📋 Setup Required:');
    console.log('   1. Open env.js file');
    console.log('   2. Replace empty bearerToken with your real X API Bearer Token');
    console.log('   3. Get your token from https://developer.twitter.com/en/portal/dashboard');
    console.log('   4. Run this test again\n');
    return;
  }
  
  // Validate token format
  const validation = validateTokenFormat(bearerToken);
  console.log(`🔑 Bearer Token: ${validation.valid ? '✅ Format looks correct' : '❌ ' + validation.reason}`);
  
  if (!validation.valid) {
    console.log('📋 Fix Required:');
    console.log('   - Ensure your Bearer Token starts with "AAAA"');
    console.log('   - Token should be 80+ characters long');
    console.log('   - Token should not be URL encoded');
    console.log('   - Get a fresh token from X Developer Portal if needed\n');
    return;
  }
  
  console.log(`📏 Token Length: ${bearerToken.length} characters`);
  console.log(`🔤 Token Prefix: ${bearerToken.substring(0, 10)}...`);
  console.log();
  
  // Test proxy server
  console.log('🔍 Step 2: Testing proxy server connection...\n');
  
  try {
    const proxyResult = await testProxyConnection();
    if (proxyResult.success) {
      console.log('✅ Proxy server is accessible');
      console.log(`📊 Status: ${proxyResult.data.status}`);
      console.log(`🌐 Environment: ${proxyResult.data.environment || 'unknown'}`);
    } else {
      console.log('⚠️ Proxy server test failed');
      console.log(`   Status Code: ${proxyResult.statusCode}`);
      console.log('   Note: You can still use the extension with direct API calls');
    }
  } catch (error) {
    console.log('⚠️ Proxy server not accessible');
    console.log(`   Error: ${error.error}`);
    console.log('   Note: Extension will attempt direct API calls');
  }
  console.log();
  
  // Test X API connection
  console.log('🔍 Step 3: Testing X API connection...\n');
  
  try {
    console.log('📡 Making test request to X API...');
    const apiResult = await testApiConnection(bearerToken);
    
    if (apiResult.success) {
      console.log('✅ X API connection successful!');
      console.log(`👤 Test Profile: @${apiResult.data.data.username}`);
      console.log(`📊 Followers: ${apiResult.data.data.public_metrics?.followers_count || 'N/A'}`);
      console.log(`✅ Verified: ${apiResult.data.data.verified ? 'Yes' : 'No'}`);
      
      // Check rate limits
      const rateLimit = apiResult.headers['x-rate-limit-remaining'];
      const rateLimitReset = apiResult.headers['x-rate-limit-reset'];
      
      if (rateLimit) {
        console.log(`⏱️ Rate Limit Remaining: ${rateLimit}/300`);
        if (rateLimitReset) {
          const resetTime = new Date(parseInt(rateLimitReset) * 1000);
          console.log(`🔄 Rate Limit Resets: ${resetTime.toLocaleTimeString()}`);
        }
      }
      
      console.log('\n🎉 SUCCESS: Your X Profile Analyzer is ready to use!');
      console.log('📱 You can now use the Chrome extension to analyze profiles with real data.');
      
    } else {
      console.log('❌ X API connection failed');
      console.log(`   Status Code: ${apiResult.statusCode}`);
      
      if (apiResult.statusCode === 401) {
        console.log('   Issue: Unauthorized - Your Bearer Token is invalid');
        console.log('   Solution: Get a new Bearer Token from X Developer Portal');
      } else if (apiResult.statusCode === 429) {
        console.log('   Issue: Rate limit exceeded');
        console.log('   Solution: Wait 15 minutes and try again');
      } else if (apiResult.statusCode === 403) {
        console.log('   Issue: Forbidden - Your app may not have the required permissions');
        console.log('   Solution: Check your X Developer Portal app settings');
      } else {
        console.log(`   Error Details: ${JSON.stringify(apiResult.data || apiResult.error, null, 2)}`);
      }
    }
    
  } catch (error) {
    console.log('❌ X API test failed');
    console.log(`   Error: ${error.error}`);
    console.log(`   Code: ${error.code}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('   Issue: DNS resolution failed - Check your internet connection');
    } else if (error.code === 'TIMEOUT') {
      console.log('   Issue: Request timeout - Check your internet connection');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   Issue: Connection refused - X API may be down');
    }
  }
  
  console.log('\n📋 Next Steps:');
  console.log('   1. If tests passed: Use the Chrome extension normally');
  console.log('   2. If tests failed: Fix the issues shown above');
  console.log('   3. Need help? Check the README.md for detailed setup instructions');
  console.log('   4. Still stuck? Open an issue on GitHub');
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
}); 