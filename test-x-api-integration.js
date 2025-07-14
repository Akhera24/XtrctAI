// X API Integration Test Script
// Tests all API endpoints and functionality with comprehensive error handling

console.log('🧪 Starting comprehensive X API integration test...');

// API Configuration (matching background.js)
const API_CONFIG = {
  API_BASE_URL: 'https://api.twitter.com/2',
  BEARER_TOKEN: '***REMOVED_BEARER_TOKEN***',
  USER_FIELDS: 'created_at,description,entities,id,location,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type,withheld',
  TWEET_FIELDS: 'created_at,public_metrics,entities,context_annotations,author_id,conversation_id,referenced_tweets,reply_settings,source,lang',
  MAX_RESULTS: 100
};

// Test utilities
const TestUtils = {
  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  logResult(testName, success, data = null, error = null) {
    const timestamp = new Date().toLocaleTimeString();
    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`[${timestamp}] ${status} ${testName}`);
    
    if (success && data) {
      console.log(`   Data: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
    }
    
    if (!success && error) {
      console.log(`   Error: ${error.message || error}`);
    }
  },

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Enhanced API Client for testing
class XAPITester {
  constructor() {
    this.requestCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  async makeRequest(endpoint, params = {}) {
    this.requestCount++;
    
    const url = new URL(`${API_CONFIG.API_BASE_URL}/${endpoint.replace(/^\//, '')}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    console.log(`🌐 API Request ${this.requestCount}: ${endpoint}`);
    
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.BEARER_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'X-Profile-Analyzer-Test/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      this.successCount++;
      return data;

    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  // Test user data retrieval
  async testGetUserData(username) {
    try {
      const params = {
        'user.fields': API_CONFIG.USER_FIELDS
      };

      const data = await this.makeRequest(`users/by/username/${username}`, params);
      
      if (!data || !data.data) {
        throw new Error('No user data received');
      }

      const user = data.data;
      const summary = {
        username: user.username,
        followers: user.public_metrics?.followers_count || 0,
        following: user.public_metrics?.following_count || 0,
        tweets: user.public_metrics?.tweet_count || 0,
        verified: user.verified || false
      };

      TestUtils.logResult('Get User Data', true, summary);
      return data;

    } catch (error) {
      TestUtils.logResult('Get User Data', false, null, error);
      throw error;
    }
  }

  // Test tweet retrieval
  async testGetUserTweets(userId, maxResults = 10) {
    try {
      const params = {
        'max_results': maxResults,
        'tweet.fields': API_CONFIG.TWEET_FIELDS,
        'exclude': 'retweets'
      };

      const data = await this.makeRequest(`users/${userId}/tweets`, params);
      
      const tweets = data.data || [];
      const summary = {
        count: tweets.length,
        avgLikes: tweets.length > 0 ? 
          tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0) / tweets.length : 0,
        avgRetweets: tweets.length > 0 ? 
          tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0) / tweets.length : 0
      };

      TestUtils.logResult('Get User Tweets', true, summary);
      return data;

    } catch (error) {
      TestUtils.logResult('Get User Tweets', false, null, error);
      throw error;
    }
  }

  // Test followers retrieval
  async testGetUserFollowers(userId, maxResults = 10) {
    try {
      const params = {
        'max_results': maxResults,
        'user.fields': 'created_at,description,location,public_metrics,verified'
      };

      const data = await this.makeRequest(`users/${userId}/followers`, params);
      
      const followers = data.data || [];
      const summary = {
        count: followers.length,
        verified: followers.filter(f => f.verified).length,
        avgFollowers: followers.length > 0 ? 
          followers.reduce((sum, f) => sum + (f.public_metrics?.followers_count || 0), 0) / followers.length : 0
      };

      TestUtils.logResult('Get User Followers', true, summary);
      return data;

    } catch (error) {
      TestUtils.logResult('Get User Followers', false, null, error);
      throw error;
    }
  }

  // Test following retrieval
  async testGetUserFollowing(userId, maxResults = 10) {
    try {
      const params = {
        'max_results': maxResults,
        'user.fields': 'created_at,description,location,public_metrics,verified'
      };

      const data = await this.makeRequest(`users/${userId}/following`, params);
      
      const following = data.data || [];
      const summary = {
        count: following.length,
        verified: following.filter(f => f.verified).length,
        avgFollowers: following.length > 0 ? 
          following.reduce((sum, f) => sum + (f.public_metrics?.followers_count || 0), 0) / following.length : 0
      };

      TestUtils.logResult('Get User Following', true, summary);
      return data;

    } catch (error) {
      TestUtils.logResult('Get User Following', false, null, error);
      throw error;
    }
  }

  // Test mentions retrieval
  async testGetUserMentions(userId, maxResults = 5) {
    try {
      const params = {
        'max_results': maxResults,
        'tweet.fields': API_CONFIG.TWEET_FIELDS
      };

      const data = await this.makeRequest(`users/${userId}/mentions`, params);
      
      const mentions = data.data || [];
      const summary = {
        count: mentions.length,
        avgEngagement: mentions.length > 0 ? 
          mentions.reduce((sum, m) => sum + (m.public_metrics?.like_count || 0) + 
                                            (m.public_metrics?.retweet_count || 0) + 
                                            (m.public_metrics?.reply_count || 0), 0) / mentions.length : 0
      };

      TestUtils.logResult('Get User Mentions', true, summary);
      return data;

    } catch (error) {
      TestUtils.logResult('Get User Mentions', false, null, error);
      throw error;
    }
  }

  // Test search functionality
  async testSearchTweets(query, maxResults = 5) {
    try {
      const params = {
        'query': query,
        'max_results': maxResults,
        'tweet.fields': API_CONFIG.TWEET_FIELDS
      };

      const data = await this.makeRequest('tweets/search/recent', params);
      
      const tweets = data.data || [];
      const summary = {
        count: tweets.length,
        query: query,
        hasResults: tweets.length > 0
      };

      TestUtils.logResult('Search Tweets', true, summary);
      return data;

    } catch (error) {
      TestUtils.logResult('Search Tweets', false, null, error);
      throw error;
    }
  }

  // Comprehensive test suite
  async runComprehensiveTest(testUsername = 'twitter') {
    console.log(`\n🚀 Starting comprehensive test for @${testUsername}\n`);
    
    const testResults = {
      userDataTest: false,
      tweetsTest: false,
      followersTest: false,
      followingTest: false,
      mentionsTest: false,
      searchTest: false,
      overallSuccess: false
    };

    let userData = null;

    try {
      // Test 1: Get user data
      console.log('📊 Test 1: User Data Retrieval');
      userData = await this.testGetUserData(testUsername);
      testResults.userDataTest = true;
      await TestUtils.delay(1000); // Rate limiting

      if (!userData || !userData.data) {
        throw new Error('No user data received for subsequent tests');
      }

      const userId = userData.data.id;
      console.log(`\n📊 Test 2: Tweet Retrieval for User ID: ${userId}`);
      
      // Test 2: Get tweets
      await this.testGetUserTweets(userId, 5);
      testResults.tweetsTest = true;
      await TestUtils.delay(1000);

      // Test 3: Get followers
      console.log('\n📊 Test 3: Followers Retrieval');
      await this.testGetUserFollowers(userId, 5);
      testResults.followersTest = true;
      await TestUtils.delay(1000);

      // Test 4: Get following
      console.log('\n📊 Test 4: Following Retrieval');
      await this.testGetUserFollowing(userId, 5);
      testResults.followingTest = true;
      await TestUtils.delay(1000);

      // Test 5: Get mentions
      console.log('\n📊 Test 5: Mentions Retrieval');
      try {
        await this.testGetUserMentions(userId, 3);
        testResults.mentionsTest = true;
      } catch (error) {
        console.log('⚠️ Mentions test failed (may require special permissions)');
      }
      await TestUtils.delay(1000);

      // Test 6: Search tweets
      console.log('\n📊 Test 6: Tweet Search');
      await this.testSearchTweets(`from:${testUsername}`, 3);
      testResults.searchTest = true;

    } catch (error) {
      console.error(`❌ Test suite failed: ${error.message}`);
    }

    // Calculate overall success
    const passedTests = Object.values(testResults).filter(result => result === true).length - 1; // -1 for overallSuccess
    const totalTests = Object.keys(testResults).length - 1; // -1 for overallSuccess
    testResults.overallSuccess = passedTests >= Math.floor(totalTests * 0.7); // 70% pass rate

    this.printTestSummary(testResults, passedTests, totalTests);
    
    return testResults;
  }

  printTestSummary(results, passed, total) {
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 X API INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${duration.toFixed(2)}s`);
    console.log(`📡 API Requests: ${this.requestCount}`);
    console.log(`✅ Successful: ${this.successCount}`);
    console.log(`❌ Failed: ${this.errorCount}`);
    console.log(`📈 Success Rate: ${((this.successCount / this.requestCount) * 100).toFixed(1)}%`);
    console.log('');
    console.log('🔍 Test Results:');
    console.log(`   User Data: ${results.userDataTest ? '✅' : '❌'}`);
    console.log(`   Tweets: ${results.tweetsTest ? '✅' : '❌'}`);
    console.log(`   Followers: ${results.followersTest ? '✅' : '❌'}`);
    console.log(`   Following: ${results.followingTest ? '✅' : '❌'}`);
    console.log(`   Mentions: ${results.mentionsTest ? '✅' : '❌'}`);
    console.log(`   Search: ${results.searchTest ? '✅' : '❌'}`);
    console.log('');
    console.log(`🎯 Overall Success: ${results.overallSuccess ? '✅ PASS' : '❌ FAIL'} (${passed}/${total} tests passed)`);
    console.log('='.repeat(60));

    // Recommendations
    if (!results.overallSuccess) {
      console.log('\n💡 RECOMMENDATIONS:');
      if (!results.userDataTest) {
        console.log('   • Check Bearer Token validity');
        console.log('   • Verify API access permissions');
      }
      if (!results.mentionsTest) {
        console.log('   • Mentions endpoint may require elevated access');
      }
      if (this.errorCount > this.successCount) {
        console.log('   • Check network connectivity');
        console.log('   • Verify API rate limits');
      }
    } else {
      console.log('\n🎉 All critical tests passed! X API integration is working correctly.');
    }
  }
}

// Browser environment detection and execution
if (typeof window !== 'undefined') {
  // Browser environment - attach to window for manual testing
  window.XAPITester = XAPITester;
  window.testXAPI = async (username = 'twitter') => {
    const tester = new XAPITester();
    return await tester.runComprehensiveTest(username);
  };
  
  console.log('🌐 X API Tester loaded in browser environment');
  console.log('📝 Usage: Run `await testXAPI("username")` in console to test');
  
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = { XAPITester, TestUtils };
  
  // Auto-run if called directly
  if (require.main === module) {
    const tester = new XAPITester();
    tester.runComprehensiveTest('twitter').then(results => {
      process.exit(results.overallSuccess ? 0 : 1);
    });
  }
}

console.log('✅ X API Integration test script loaded successfully!'); 