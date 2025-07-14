// X Profile Analyzer Extension Test Script
// This script can be run in the browser console to test the extension

console.log('🧪 Testing X Profile Analyzer Extension...');

// Test 1: Check if background script is responsive
function testBackgroundConnection() {
  return new Promise((resolve) => {
    console.log('1️⃣ Testing background script connection...');
    
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Background script connection failed:', chrome.runtime.lastError.message);
        resolve(false);
      } else if (response && response.success) {
        console.log('✅ Background script is responsive');
        resolve(true);
      } else {
        console.error('❌ Background script returned invalid response');
        resolve(false);
      }
    });
  });
}

// Test 2: Test API connection
function testApiConnection() {
  return new Promise((resolve) => {
    console.log('2️⃣ Testing API connection...');
    
    chrome.runtime.sendMessage({ action: 'testConnection' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ API connection test failed:', chrome.runtime.lastError.message);
        resolve(false);
      } else if (response && response.success) {
        console.log('✅ API connection successful');
        console.log('📊 Test data:', response.data);
        resolve(true);
      } else {
        console.warn('⚠️ API connection failed:', response?.error || 'Unknown error');
        console.log('📊 Response:', response);
        resolve(false);
      }
    });
  });
}

// Test 3: Test profile analysis with a simple username
function testProfileAnalysis(username = 'twitter') {
  return new Promise((resolve) => {
    console.log(`3️⃣ Testing profile analysis for @${username}...`);
    
    const timeoutId = setTimeout(() => {
      console.error('❌ Profile analysis timed out');
      resolve(false);
    }, 30000); // 30 second timeout
    
    chrome.runtime.sendMessage({
      action: 'analyzeProfile',
      username: username,
      options: { forceRefresh: false }
    }, (response) => {
      clearTimeout(timeoutId);
      
      if (chrome.runtime.lastError) {
        console.error('❌ Profile analysis failed:', chrome.runtime.lastError.message);
        resolve(false);
      } else if (response && (response.success || response.data)) {
        if (response.success) {
          console.log('✅ Profile analysis successful');
        } else {
          console.warn('⚠️ Profile analysis failed but fallback data available');
        }
        console.log('📊 Analysis data:', {
          username: response.data?.username,
          followers: response.data?.metrics?.followers,
          dataSource: response.data?.dataSource,
          isRealData: response.data?.isRealData
        });
        resolve(true);
      } else {
        console.error('❌ Profile analysis failed without data');
        resolve(false);
      }
    });
  });
}

// Test 4: Test rate limit status
function testRateLimitStatus() {
  return new Promise((resolve) => {
    console.log('4️⃣ Testing rate limit status...');
    
    chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Rate limit status failed:', chrome.runtime.lastError.message);
        resolve(false);
      } else if (response) {
        console.log('✅ Rate limit status retrieved');
        console.log('📊 Rate limit info:', {
          requests: response.requests,
          maxRequests: response.maxRequests,
          remaining: response.remaining,
          cacheSize: response.cacheSize
        });
        resolve(true);
      } else {
        console.error('❌ No rate limit status received');
        resolve(false);
      }
    });
  });
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting X Profile Analyzer Extension Tests...\n');
  
  const results = {
    backgroundConnection: await testBackgroundConnection(),
    apiConnection: await testApiConnection(),
    profileAnalysis: await testProfileAnalysis(),
    rateLimitStatus: await testRateLimitStatus()
  };
  
  console.log('\n📋 Test Results Summary:');
  console.log('=======================');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Extension is working correctly.');
  } else if (passedTests > 0) {
    console.log('⚠️ Some tests failed. Extension has partial functionality.');
  } else {
    console.log('💥 All tests failed. Extension needs debugging.');
  }
  
  return results;
}

// Export functions for manual testing
window.XProfileAnalyzerTest = {
  runAllTests,
  testBackgroundConnection,
  testApiConnection,
  testProfileAnalysis,
  testRateLimitStatus
};

// Auto-run tests if in test mode
if (window.location.search.includes('test=true')) {
  runAllTests();
}

console.log('🧪 Test script loaded. Run XProfileAnalyzerTest.runAllTests() to start testing.'); 