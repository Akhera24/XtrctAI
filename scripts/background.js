// Import required modules
import { makeAuthenticatedRequest, handleApiError } from './auth-handler.js';
import { iconManager } from './iconManager.js';
import { ProxyManager, config as proxyConfig } from './proxy-config.js';
import { twitter, apiValidation, proxyUrl, grokAi } from '../env.js';

// Add this near the top of the file, after other imports
self.importScripts = self.importScripts || (() => {});

// Add these lines at the top of the file to keep service worker alive
let keepAliveInterval;

function setupKeepAlive() {
  // Disable any existing keepalive
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  
  // Create an interval to keep the service worker alive
  keepAliveInterval = setInterval(() => {
    console.log('Background service worker keepalive ping');
  }, 20000); // Every 20 seconds
}

// Initialize the keepalive
setupKeepAlive();

// Register the service worker
self.addEventListener('install', (event) => {
  console.log('Background service worker installed');
  self.skipWaiting(); // Activate service worker immediately
  
  // Initialize the extension
  try {
    initializeExtension();
  } catch (error) {
    console.error('Error during installation initialization:', error);
  }
});

self.addEventListener('activate', (event) => {
  console.log('Background service worker activated');
  setupKeepAlive();
  
  // Call initialization on activation as well
  try {
    initializeExtension();
  } catch (error) {
    console.error('Error during activation initialization:', error);
  }
});

// Log environment variables loading status
console.log('🌐 Environment loading status:', {
  twitterConfig1: !!twitter?.config1?.bearerToken,
  twitterConfig2: !!twitter?.config2?.bearerToken,
  grokApiKey: !!grokAi?.apiKey,
  apiValidation: apiValidation
});

// Initialize the extension state
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ X Profile Analyzer extension installed');
  
  // Set default theme
  chrome.storage.local.get(['theme'], (result) => {
    if (!result.theme) {
      chrome.storage.local.set({ theme: 'light' });
    }
  });
  
  // Initialize counters and settings
  chrome.storage.local.set({
    analysisCount: 0,
    lastAnalysisDate: null,
    rateLimit: { count: 0, resetTime: Date.now() + 3600000 }
  });
  
  // Store bearer tokens securely
  if (twitter?.config1?.bearerToken) {
  chrome.storage.local.set({
      bearerToken1: twitter.config1.bearerToken,
      bearerToken2: twitter.config2?.bearerToken || null
  });
  }
  
  // Create context menu
  chrome.contextMenus.create({
    id: "open-floating",
    title: "Open in floating window",
    contexts: ["action"]
  });
});

/**
 * Primary Twitter API configuration
 */
const API_CONFIG = {
    X_API_KEY: twitter.config1.xApiKey,
    CLIENT_ID: twitter.config1.clientId,
    CLIENT_SECRET: twitter.config1.clientSecret,
    BEARER_TOKEN: twitter.config1.bearerToken,
    ACCESS_TOKEN: twitter.config1.accessToken,
    ACCESS_TOKEN_SECRET: twitter.config1.accessTokenSecret,
    API_BASE_URL: twitter.config1.baseUrl || 'https://api.twitter.com/2'
};

/**
 * Secondary/backup Twitter API configuration
 */
const API_CONFIG2 = {
    X_API_KEY: twitter.config2?.xApiKey,
    X_API_KEY_SECRET: twitter.config2?.xApiKeySecret,
    CLIENT_ID: twitter.config2?.clientId,
    CLIENT_SECRET: twitter.config2?.clientSecret,
    BEARER_TOKEN: twitter.config2?.bearerToken,
    ACCESS_TOKEN: twitter.config2?.accessToken,
    ACCESS_TOKEN_SECRET: twitter.config2?.accessTokenSecret,
    API_BASE_URL: twitter.config2?.baseUrl || 'https://api.twitter.com/2'
};

/**
 * Grok AI configuration
 */
const API_CONFIG3 = {
    API_KEY: grokAi?.apiKey,
    API_BASE_URL: grokAi?.baseUrl || 'https://api.grok.com/v1'
};

// Log API configuration status
console.log('🔐 API Configuration Status:', {
  config1Available: !!API_CONFIG.BEARER_TOKEN,
  config2Available: !!API_CONFIG2.BEARER_TOKEN,
  grokAvailable: !!API_CONFIG3.API_KEY,
  config1Token: API_CONFIG.BEARER_TOKEN ? `${API_CONFIG.BEARER_TOKEN.substring(0, 10)}...` : 'MISSING',
  config2Token: API_CONFIG2.BEARER_TOKEN ? `${API_CONFIG2.BEARER_TOKEN.substring(0, 10)}...` : 'MISSING'
});

// Track which config we're using currently
let activeConfigNum = 1;

// Rate limiting configuration
const RATE_LIMITS = {
    config1: {
        readRequests: {
            total: 50,
            used: 0,
            resetDate: new Date().setMonth(new Date().getMonth() + 1),
            lastRequestTime: null
        }
    },
    config2: {
        readRequests: {
            total: 50,
            used: 0,
            resetDate: new Date().setMonth(new Date().getMonth() + 1),
            lastRequestTime: null
        }
    }
};

// Cache for storing analyzed profiles
const profileCache = new Map();

// Store configurations securely
chrome.storage.local.set({
    apiConfig1: API_CONFIG,
    apiConfig2: API_CONFIG2,
    rateLimits: RATE_LIMITS,
    activeConfigNum: 1
}, () => {
    console.log('✅ Configurations stored successfully');
});

// Make an authenticated API request using the auth handler
async function handleApiRequest(url, customBearerToken = null) {
  console.log(`Making authenticated request to ${url.split('?')[0]}...`);
  
  try {
    // Extract endpoint and params from URL
    let endpoint, params = {};
    
    if (url.includes('?')) {
      const [path, queryString] = url.split('?');
      endpoint = path;
      
      // Parse query params
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } else {
      endpoint = url;
    }
    
    const options = {
      method: 'GET',
      params
    };
    
    // Use custom bearer token if provided
    if (customBearerToken) {
      // Create temporary config for testing
      const testConfig = {
        bearerToken: customBearerToken,
        baseUrl: 'https://api.twitter.com/2',
        rateLimits: { remaining: 50, reset: Date.now() + 900000 },
        isValid: true
      };
      
      return await makeAuthenticatedRequest(endpoint, {
        ...options,
        bearerToken: customBearerToken
      });
    }
    
    // Use the auth handler for authenticated requests with token rotation
    return await makeAuthenticatedRequest(endpoint, options);
  } catch (error) {
    console.error('Authentication request failed:', error);
    throw error;
  }
}

function analyzePostingStrategy(userData, tweets) {
    const postingTimes = calculateBestPostingTimes(tweets);
    const engagementRate = calculateEngagementRate(tweets);
    const topContent = getTopPerformingContent(tweets);

    return {
        postingFrequency: tweets.length > 0 ? (tweets.length / 30).toFixed(1) + ' tweets/day (estimated)' : 'Unknown',
        bestPostingTimes: postingTimes,
        engagementRate: engagementRate,
        topPerformingContent: topContent,
        recommendedStrategy: generateRecommendations(engagementRate, postingTimes, userData)
    };
}

function calculateEngagementRate(tweets) {
    if (!tweets || tweets.length === 0) return 'Unknown';
    
    let totalEngagement = 0;
    
    tweets.forEach(tweet => {
        const likes = tweet.public_metrics?.like_count || 0;
        const replies = tweet.public_metrics?.reply_count || 0;
        const retweets = tweet.public_metrics?.retweet_count || 0;
        const quotes = tweet.public_metrics?.quote_count || 0;
        
        totalEngagement += likes + replies + retweets + quotes;
    });
    
    const averageEngagement = totalEngagement / tweets.length;
    const followerCount = tweets[0]?.author_metrics?.followers_count || 1;
    
    return ((averageEngagement / followerCount) * 100).toFixed(2) + '%';
}

function calculateBestPostingTimes(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    // Create a map to track engagement by hour
    const hourlyEngagement = {};
    
    // Initialize hours
    for (let i = 0; i < 24; i++) {
        hourlyEngagement[i] = {
            count: 0,
            engagement: 0
        };
    }
    
    // Analyze tweets
    tweets.forEach(tweet => {
        const tweetDate = new Date(tweet.created_at);
        const hour = tweetDate.getHours();
        
        const likes = tweet.public_metrics?.like_count || 0;
        const replies = tweet.public_metrics?.reply_count || 0;
        const retweets = tweet.public_metrics?.retweet_count || 0;
        const quotes = tweet.public_metrics?.quote_count || 0;
        
        const engagement = likes + replies + retweets + quotes;
        
        hourlyEngagement[hour].count++;
        hourlyEngagement[hour].engagement += engagement;
    });
    
    // Find the best hours
    const bestHours = Object.keys(hourlyEngagement)
        .filter(hour => hourlyEngagement[hour].count > 0)
        .sort((a, b) => {
            const avgA = hourlyEngagement[a].engagement / hourlyEngagement[a].count;
            const avgB = hourlyEngagement[b].engagement / hourlyEngagement[b].count;
            return avgB - avgA;
        })
        .slice(0, 3);
    
    return bestHours.map(hour => {
        const hourNum = parseInt(hour);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const hour12 = hourNum % 12 || 12;
        return `${hour12} ${ampm}`;
    });
}

function getTopPerformingContent(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    // Calculate engagement for each tweet
    const tweetsWithEngagement = tweets.map(tweet => {
        const likes = tweet.public_metrics?.like_count || 0;
        const replies = tweet.public_metrics?.reply_count || 0;
        const retweets = tweet.public_metrics?.retweet_count || 0;
        const quotes = tweet.public_metrics?.quote_count || 0;
        
        return {
            text: tweet.text,
            engagement: likes + replies + retweets + quotes,
            categories: detectCategories(tweet.text)
        };
    });
    
    // Get top 3 by engagement
    return tweetsWithEngagement
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 3)
        .map(t => t.categories)
        .flat()
        .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
        .slice(0, 5); // Limit to top 5 categories
}

function calculateAnalytics(tweets) {
    // Implement your analytics calculation logic here
    return {};
}

async function getUserData(username) {
    console.log(`Getting user data for ${username}`);
    
    try {
        // Check cache first
        const cachedData = await getCachedData(username);
        if (cachedData) {
            console.log(`Using cached data for ${username}`);
            return {
                success: true,
                data: cachedData,
                source: 'cache'
            };
        }
        
        // User fields to retrieve
        const userFields = [
            'created_at',
            'description',
            'entities',
            'id',
            'location',
            'name',
            'pinned_tweet_id',
            'profile_image_url',
            'protected',
            'public_metrics',
            'url',
            'verified',
            'verified_type',
            'username'
        ].join(',');
        
        // Build API URL
        const url = `users/by/username/${username}?user.fields=${userFields}`;
        
        // Make the API request using our auth handler
        const userData = await handleApiRequest(url);
            
        // Get recent tweets for the user
        const tweets = await getTweets(username, 50);
            
        // Process all the data
        const followersCount = userData.data.public_metrics.followers_count;
        const followingCount = userData.data.public_metrics.following_count;
        const tweetCount = userData.data.public_metrics.tweet_count;
            
        const followerRatio = followingCount > 0 
            ? (followersCount / followingCount).toFixed(2) 
            : 'N/A';
            
        // Calculate account age in days
        const createdDate = new Date(userData.data.created_at);
        const now = new Date();
        const accountAgeMs = now - createdDate;
        const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
            
        // Calculate tweets per day
        const tweetsPerDay = (tweetCount / accountAgeDays).toFixed(2);
            
        // Analyze posting strategy
        const postingStrategy = analyzePostingStrategy(userData.data, tweets);
            
        // Prepare results
        const results = {
            username: userData.data.username,
            displayName: userData.data.name,
            profileImageUrl: userData.data.profile_image_url,
            description: userData.data.description,
            verified: userData.data.verified,
            verifiedType: userData.data.verified_type || 'none',
            accountStats: {
                followersCount,
                followingCount,
                tweetCount,
                followerRatio,
                accountAgeDays,
                accountCreated: createdDate.toDateString(),
                tweetsPerDay,
                isProtected: userData.data.protected
            },
            postingStrategy,
            location: userData.data.location || 'Not specified',
            url: userData.data.url,
            rawUserData: userData.data,
            recentTweets: tweets
        };
            
        // Cache the results
        await cacheData(username, results);
            
        // Return results
        return {
            success: true,
            data: results,
            source: 'api'
        };
    } catch (error) {
        console.error('Error fetching user data:', error);
            
        // Check if we have a connection error
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('Network Error') || 
            error.message.includes('CORS error')) {
                
            // Try to get data from cache even if expired
            try {
                const cachedData = await getCachedData(username, true);
                if (cachedData) {
                    return {
                        success: true,
                        data: cachedData,
                        source: 'expired_cache'
                    };
                }
            } catch (cacheError) {
                console.log('No cache data available');
            }
                
            return {
                success: false,
                error: 'Could not connect to X API. Please check your internet connection and try again.'
            };
        }
            
        // Handle rate limit specifically
        if (error.message.includes('rate limit') || error.status === 429) {
            return {
                success: false,
                error: 'Rate limit exceeded. Please try again later.'
            };
        }
            
        // If the user doesn't exist
        if (error.status === 404) {
            return {
                success: false,
                error: `User @${username} doesn't exist on X.`
            };
        }
            
        // Check if the account is suspended
        if (error.message.includes('suspended') || error.status === 403) {
            return {
                success: false,
                error: `The account @${username} has been suspended.`
            };
        }
            
        // Fallback error handling
        return {
            success: false,
            error: `Error analyzing @${username}: ${error.message}`
        };
    }
}

async function getRateLimitInfo() {
    return new Promise(resolve => {
        chrome.storage.local.get(['rateLimits'], (result) => {
            resolve(result.rateLimits || RATE_LIMITS);
        });
    });
}

async function getTweets(username, count = 10) {
    try {
        // Define tweet fields
        const tweetFields = [
            'created_at',
            'public_metrics',
            'entities',
            'referenced_tweets',
            'attachments',
            'context_annotations'
        ].join(',');
        
        // Build URL for user's tweets
        const url = `users/by/username/${username}/tweets?max_results=${count}&tweet.fields=${tweetFields}`;
        
        // Get tweets using auth handler
        const response = await handleApiRequest(url);
        
        return response.data || [];
    } catch (error) {
        console.error('Error fetching tweets:', error);
        return [];
    }
}

// Cache functions
async function cacheData(key, data, expiresIn = 3600000) { // 1 hour default
    const cacheEntry = {
        data,
        expires: Date.now() + expiresIn
    };
    
    return new Promise(resolve => {
        chrome.storage.local.get(['analysisCache'], (result) => {
            const cache = result.analysisCache || {};
            cache[key] = cacheEntry;
            chrome.storage.local.set({ analysisCache: cache }, resolve);
        });
    });
}

async function getCachedData(key, ignoreExpiry = false) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['analysisCache'], (result) => {
            const cache = result.analysisCache || {};
            const entry = cache[key];
            
            if (!entry) {
                return reject(new Error('Cache miss'));
            }
            
            if (!ignoreExpiry && entry.expires < Date.now()) {
                return reject(new Error('Cache expired'));
            }
            
            resolve(entry.data);
        });
    });
}

// Cache and configuration management functions
function clearCache() {
    return new Promise(resolve => {
        chrome.storage.local.remove(['analysisCache'], () => {
            resolve({ success: true });
        });
    });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Script received message:', request.action);
    
    if (request.action === 'analyzeProfile') {
        handleAnalyzeProfile(request, sendResponse);
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'getUserData') {
        getUserData(request.username)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'clearCache') {
        clearCache().then(sendResponse);
        return true;
    }
    
    if (request.action === 'makeAuthenticatedRequest') {
        makeAuthenticatedRequest(request.url, request.bearerToken)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'testConnection') {
        console.log('Testing API connection');
        handleApiRequest(request.url, request.bearerToken)
            .then(data => {
                sendResponse({
                    success: true,
                    data: data
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.toString()
                });
            });
        return true; // Required for async response
    }
});

// Helper functions for content analysis
function detectCategories(text) {
    const categories = [];
    
    // Simple category detection (replace with a more sophisticated method later)
    if (text.match(/(tech|technology|programming|code|developer|software)/i)) {
        categories.push('Technology');
    }
    
    if (text.match(/(business|entrepreneurship|startup|marketing|sales)/i)) {
        categories.push('Business');
    }
    
    if (text.match(/(politics|government|election|democracy|policy)/i)) {
        categories.push('Politics');
    }
    
    if (text.match(/(sport|football|basketball|soccer|baseball|nfl|nba)/i)) {
        categories.push('Sports');
    }
    
    if (text.match(/(entertainment|movie|film|music|celebrity|tv|television)/i)) {
        categories.push('Entertainment');
    }
    
    // If no categories detected, add generic "General"
    if (categories.length === 0) {
        categories.push('General');
    }
    
    return categories;
}

function generateRecommendations(engagementRate, bestPostingTimes, userData) {
    // Basic recommendations (can be enhanced with AI later)
    const recommendations = [];
    
    // Add a posting time recommendation
    if (bestPostingTimes.length > 0) {
        recommendations.push(`Post more frequently around ${bestPostingTimes.join(', ')} for better engagement.`);
    }
    
    // Recommend based on follower count
    const followerCount = userData.public_metrics.followers_count;
    
    if (followerCount < 1000) {
        recommendations.push('Focus on consistent posting and engaging with larger accounts to grow your audience.');
    } else if (followerCount < 10000) {
        recommendations.push('Your audience is growing - create more shareable content to leverage your existing followers.');
    } else {
        recommendations.push('You have a substantial audience - consider creating unique content formats and collaborations.');
    }
    
    // Add more if needed
    if (recommendations.length < 3) {
        recommendations.push('Engage with your audience by responding to comments and participating in conversations.');
    }
    
    return recommendations;
}

// Test proxy connection to check if it's working
async function testProxyConnection() {
  try {
    console.log('Testing proxy connection...');
    
    // Set a longer timeout for better reliability
    const timeout = proxyConfig.timeout || 10000;
    
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // First try to connect to the proxy base URL
    const proxyBaseUrl = proxyUrl.split('/api/proxy')[0];
    console.log(`Testing connection to proxy base URL: ${proxyBaseUrl}`);
    
    try {
      // Use HEAD request first as it's faster
      const response = await fetch(proxyBaseUrl, {
        method: 'HEAD',
        headers: {
          'X-Test-Connection': 'true',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal,
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || response.status === 404) {
        // Even a 404 is fine - it means the server is reachable
        console.log('Proxy server is reachable with status:', response.status);
        
        // Record successful connection in storage
        chrome.storage.local.set({ 
          proxyConnected: true, 
          proxyLastChecked: Date.now(),
          proxyError: null
        });
        
        return true;
      }
      
      // If we get here, server responded but with an error status
      console.warn('Proxy connection check returned status:', response.status);
      
      // Store status in storage
      chrome.storage.local.set({ 
        proxyConnected: false, 
        proxyLastChecked: Date.now(),
        proxyError: `HTTP error ${response.status}`
      });
      
      // If failures are non-blocking, allow the app to continue
      return proxyConfig.fallbackToDirect !== false;
    }
    catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Specific error handling for different errors
      let errorMessage = 'Unknown connection error';
      
      if (fetchError.name === 'AbortError') {
        errorMessage = 'Connection timed out';
      }
      else if (fetchError.message.includes('Failed to fetch')) {
        errorMessage = 'Network error - CORS or connectivity issue';
      }
      else {
        errorMessage = fetchError.message || 'Connection failed';
      }
      
      console.warn(`Proxy connection error: ${errorMessage}`);
      
      // Record error in storage
      chrome.storage.local.set({ 
        proxyConnected: false, 
        proxyLastChecked: Date.now(),
        proxyError: errorMessage
      });
      
      // Try a secondary check to the proxy API endpoint as fallback
      try {
        console.log('Trying secondary proxy endpoint check...');
        const secondaryCheck = await fetch(`${proxyUrl}?test=1`, {
          method: 'OPTIONS',
          headers: { 'X-Test-Only': 'true' },
          mode: 'cors'
        });
        
        if (secondaryCheck.ok || secondaryCheck.status === 204) {
          console.log('Secondary proxy check succeeded');
          chrome.storage.local.set({ 
            proxyConnected: true, 
            proxyLastChecked: Date.now(),
            proxyError: null
          });
          return true;
        }
      }
      catch (secondaryError) {
        console.warn('Secondary proxy check also failed');
      }
      
      // Allow continuing with direct API if proxy failures are non-blocking
      return proxyConfig.fallbackToDirect !== false;
    }
  } 
  catch (error) {
    console.error('Proxy test error:', error);
    
    // Record error in storage
    chrome.storage.local.set({ 
      proxyConnected: false, 
      proxyLastChecked: Date.now(),
      proxyError: error.message || 'Unknown error'
    });
    
    // Continue with direct API as fallback
    return proxyConfig.fallbackToDirect !== false;
  }
}

// Initialize extension configuration
async function initializeExtension() {
  try {
    console.log('🚀 Initializing X Profile Analyzer extension...');
    
    // Initialize authentication handler
    try {
      console.log('🔐 Initializing authentication system...');
      // Test authentication by making a simple call
      await makeAuthenticatedRequest('', { method: 'GET' }).catch(() => {
        console.log('Auth handler initialized (test call expected to fail)');
      });
      console.log('✅ Authentication system ready');
    } catch (authError) {
      console.warn('⚠️ Authentication initialization warning:', authError.message);
    }
    
    // Store API configs in storage if not already present
    chrome.storage.local.get(['apiConfig1', 'apiConfig2'], (result) => {
      if (!result.apiConfig1) {
        console.log('Setting up API config 1');
        chrome.storage.local.set({ apiConfig1: API_CONFIG });
      }
      
      if (!result.apiConfig2) {
        console.log('Setting up API config 2');
        chrome.storage.local.set({ apiConfig2: API_CONFIG2 });
      }
      
      // Initialize rate limits if needed
      chrome.storage.local.get(['rateLimits'], (data) => {
        if (!data.rateLimits) {
          console.log('Setting up rate limits');
          chrome.storage.local.set({ rateLimits: RATE_LIMITS });
        }
      });
      
      // Set active config if not set
      chrome.storage.local.get(['activeConfigNum'], (data) => {
        if (!data.activeConfigNum) {
          console.log('Setting active config to 1');
          chrome.storage.local.set({ activeConfigNum: 1 });
        }
      });
    });
    
    // Initialize icon manager with error handling
    try {
      if (iconManager && typeof iconManager.setIconState === 'function') {
        await iconManager.setIconState('default').catch(err => {
          console.warn('⚠️ Icon initialization warning (this is usually harmless):', err.message);
        });
        console.log('✅ Icon manager initialized');
      }
    } catch (iconError) {
      console.warn('⚠️ Icon manager initialization warning:', iconError.message);
    }
    
    // Test proxy connection (if enabled)
    try {
      if (proxyConfig.enabled) {
        console.log('🌐 Testing proxy configuration...');
        
        // Store proxy config in storage for service worker access
        await chrome.storage.local.set({ 
          proxyConfig: {
            enabled: proxyConfig.enabled,
            url: proxyUrl || '',
            timeoutMs: proxyConfig.timeout || 15000,
            retryAttempts: proxyConfig.retryAttempts || 3
          }
        });
        
        // Test proxy connection but don't wait for it
        testProxyConnection().then(isConnected => {
          console.log(`🌐 Proxy connection test result: ${isConnected ? 'Connected' : 'Failed'}`);
          chrome.storage.local.set({ proxyConnected: isConnected });
        }).catch(proxyError => {
          console.warn('⚠️ Proxy test warning:', proxyError.message);
            });
          } else {
        console.log('🌐 Proxy disabled, using direct API connections');
      }
    } catch (proxyError) {
      console.warn('⚠️ Proxy setup warning:', proxyError.message);
    }
    
    console.log('✅ X Profile Analyzer extension initialization complete!');
  } catch (error) {
    console.error('❌ Error during extension initialization:', error);
    // Don't throw - allow extension to continue with limited functionality
  }
}

// Real X API Integration Functions
class XProfileAPI {
  constructor() {
    this.activeConfig = API_CONFIG;
    this.fallbackConfig = API_CONFIG2;
    this.requestCount = 0;
    this.initialized = false;
  }

  async initialize() {
    console.log('🔐 Initializing X Profile API...');
    
    // Validate configurations
    if (!this.activeConfig.BEARER_TOKEN) {
      console.error('❌ Primary bearer token missing');
      throw new Error('API configuration incomplete - missing bearer token');
    }
    
    console.log('✅ X Profile API initialized with bearer token:', 
      this.activeConfig.BEARER_TOKEN.substring(0, 10) + '...');
    
    this.initialized = true;
    return true;
  }

  async makeAPIRequest(endpoint, params = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const baseUrl = this.activeConfig.API_BASE_URL;
    const url = new URL(`${baseUrl}/${endpoint.replace(/^\//, '')}`);
    
    // Add parameters to URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const requestUrl = url.toString();
    console.log(`🌐 Making X API request to: ${endpoint}`);
    console.log(`📋 Request URL: ${requestUrl}`);

    const headers = {
      'Authorization': `Bearer ${this.activeConfig.BEARER_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'X-Profile-Analyzer/2.0'
    };

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: headers,
        mode: 'cors'
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);

      // Handle specific error cases
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }

        if (response.status === 401) {
          console.error('❌ Authentication failed - invalid bearer token');
          throw new Error('Authentication failed: Invalid bearer token');
        } else if (response.status === 403) {
          console.error('❌ Access forbidden - insufficient permissions');
          throw new Error('Access forbidden: Insufficient API permissions');
        } else if (response.status === 404) {
          console.error('❌ Resource not found');
          throw new Error('User not found or suspended');
        } else if (response.status === 429) {
          console.error('❌ Rate limit exceeded');
          throw new Error('Rate limit exceeded - please try again later');
        }

        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ API request successful:', data ? 'Data received' : 'No data');
      
      this.requestCount++;
      return data;

    } catch (error) {
      console.error('❌ API request failed:', error.message);
      throw error;
    }
  }

  async getUserData(username) {
    console.log(`🔍 Fetching user data for: @${username}`);
    
    const userFields = [
      'created_at',
      'description',
      'entities',
      'id',
      'location',
      'name',
      'pinned_tweet_id',
      'profile_image_url',
      'protected',
      'public_metrics',
      'url',
      'username',
      'verified',
      'verified_type'
    ].join(',');

    try {
      const response = await this.makeAPIRequest(`users/by/username/${username}`, {
        'user.fields': userFields
      });

      if (!response || !response.data) {
        throw new Error('Invalid response structure from X API');
      }

      const userData = response.data;
      console.log('✅ User data retrieved:', {
        username: userData.username,
        followers: userData.public_metrics?.followers_count,
        following: userData.public_metrics?.following_count,
        tweets: userData.public_metrics?.tweet_count,
        verified: userData.verified
      });

      return userData;

    } catch (error) {
      console.error(`❌ Failed to get user data for @${username}:`, error.message);
      throw error;
    }
  }

  async getUserTweets(userId, maxResults = 100) {
    console.log(`📰 Fetching tweets for user ID: ${userId}`);
    
    const tweetFields = [
      'created_at',
      'public_metrics',
      'entities',
      'context_annotations',
      'author_id',
      'conversation_id',
      'lang'
    ].join(',');

    try {
      const response = await this.makeAPIRequest(`users/${userId}/tweets`, {
        'max_results': Math.min(maxResults, 100),
        'tweet.fields': tweetFields,
        'exclude': 'retweets,replies'
      });

      const tweets = response?.data || [];
      console.log(`✅ Retrieved ${tweets.length} tweets`);
      
      return tweets;

  } catch (error) {
      console.error(`❌ Failed to get tweets for user ${userId}:`, error.message);
      return []; // Return empty array if tweets fail
    }
  }

  async getUserFollowers(userId, maxResults = 20) {
    console.log(`👥 Fetching followers sample for user ID: ${userId}`);
    
    try {
      const response = await this.makeAPIRequest(`users/${userId}/followers`, {
        'max_results': Math.min(maxResults, 100),
        'user.fields': 'created_at,description,location,public_metrics,verified'
      });

      const followers = response?.data || [];
      console.log(`✅ Retrieved ${followers.length} followers for analysis`);
      
      return followers;

    } catch (error) {
      console.error(`❌ Failed to get followers for user ${userId}:`, error.message);
      return []; // Return empty array if followers fail
    }
  }
}

// Create global API instance
const xProfileAPI = new XProfileAPI();

// COMPLETELY REWRITTEN PROFILE ANALYSIS FUNCTION
async function handleAnalyzeProfile(request, sendResponse) {
  console.log('🚀 Starting REAL X API profile analysis for:', request.username);
  
  try {
    // Validate input
    if (!request.username) {
      throw new Error('Username is required');
    }

    const username = request.username.replace('@', '').trim();
    if (!username) {
      throw new Error('Invalid username provided');
    }
    
    // Set loading icon
    try {
      await iconManager.setIconState('loading');
    } catch (iconError) {
      console.warn('⚠️ Icon state warning:', iconError.message);
    }
    
    // Check cache first (optional)
    if (request.options?.useCache) {
    try {
        const cachedData = await getCachedData(username);
      if (cachedData) {
          console.log('📦 Using cached data');
        sendResponse({
          success: true,
          data: cachedData,
          fromCache: true
        });
          return;
        }
      } catch (cacheError) {
        console.log('ℹ️ No cache available, proceeding with fresh API call');
      }
    }

    // Initialize API if needed
    if (!xProfileAPI.initialized) {
      await xProfileAPI.initialize();
    }

    // Step 1: Get user data from REAL X API
    console.log('📡 Step 1: Fetching user data from X API...');
    const userData = await xProfileAPI.getUserData(username);
    
    if (!userData) {
      throw new Error('No user data received from X API');
    }

    // Validate user data structure
    if (!userData.public_metrics) {
      console.warn('⚠️ User data missing public_metrics, creating defaults');
      userData.public_metrics = {
        followers_count: 0,
        following_count: 0,
        tweet_count: 0,
        listed_count: 0
      };
    }

    // Step 2: Get tweets from REAL X API
    console.log('📡 Step 2: Fetching tweets from X API...');
    let tweets = [];
    try {
      tweets = await xProfileAPI.getUserTweets(userData.id, 100);
    } catch (tweetError) {
      console.warn('⚠️ Tweets fetch failed, continuing without tweets:', tweetError.message);
      tweets = [];
    }

    // Step 3: Get followers sample for audience analysis
    console.log('📡 Step 3: Fetching followers sample...');
    let followers = [];
    try {
      followers = await xProfileAPI.getUserFollowers(userData.id, 20);
    } catch (followersError) {
      console.warn('⚠️ Followers fetch failed, continuing without followers:', followersError.message);
      followers = [];
    }

    // Step 4: Process and analyze the REAL data
    console.log('🧠 Step 4: Processing real X API data...');
    
    const analysis = await generateComprehensiveAnalysis({
      user: userData,
      tweets: tweets,
      audienceInsights: followers.length > 0 ? analyzeAudienceDemographics(followers) : generateFallbackAudienceInsights(userData),
      username: username
    });

    console.log('✅ Analysis completed with REAL data:', {
      username: analysis.username,
      followers: analysis.metrics?.followers,
      tweets: tweets.length,
      followers_sample: followers.length
    });

    // Step 5: Cache the results
    try {
      await cacheData(username, analysis, 1800000); // 30 minutes
    } catch (cacheError) {
      console.warn('⚠️ Cache storage failed:', cacheError.message);
    }

    // Step 6: Send successful response
    sendResponse({
      success: true,
      data: analysis,
      fromCache: false,
      analysisTimestamp: Date.now(),
      apiVersion: '2.0',
      dataPoints: tweets.length + followers.length,
      apiRequestCount: xProfileAPI.requestCount
    });

    // Set success icon
        try {
          await iconManager.setIconState('active');
        } catch (iconError) {
      console.warn('⚠️ Icon state warning:', iconError.message);
    }

    console.log('🎉 Real X API analysis completed successfully!');

  } catch (error) {
    console.error('❌ Profile analysis failed:', error);

    // Try cache fallback
    try {
      const fallbackData = await getCachedData(request.username.replace('@', ''), true);
      if (fallbackData) {
        console.log('📦 Using expired cache as fallback');
        sendResponse({
          success: true,
          data: {
            ...fallbackData,
            isExpiredCache: true,
            warning: 'Using cached data due to API error'
          },
          fromCache: true,
          error: error.message
        });
        return;
      }
    } catch (cacheError) {
      console.log('ℹ️ No cache fallback available');
    }

    // Set error icon
    try {
      await iconManager.setIconState('error');
      setTimeout(() => iconManager.setIconState('default').catch(() => {}), 3000);
    } catch (iconError) {
      console.warn('⚠️ Icon state warning:', iconError.message);
    }

    // Send error response
    sendResponse({
      success: false,
      error: error.message || 'Profile analysis failed',
      errorType: error.name || 'AnalysisError',
      suggestion: 'Please check the username and try again. If the problem persists, the user may not exist or the API may be temporarily unavailable.'
    });
  }
}

// ENHANCED ANALYSIS ENGINE
async function generateComprehensiveAnalysis({ user, tweets, audienceInsights, username }) {
  const analysis = {
    // Basic profile info
    user: user,
    username: user.username,
    displayName: user.name,
    profileImageUrl: user.profile_image_url,
    description: user.description,
    verified: user.verified || false,
    verifiedType: user.verified_type || 'none',
    location: user.location,
    url: user.url,
    
    // Core metrics
    metrics: {
      followers: user.public_metrics?.followers_count || 0,
      following: user.public_metrics?.following_count || 0,
      tweets: user.public_metrics?.tweet_count || 0,
      listed: user.public_metrics?.listed_count || 0
    },
    
    // Account analysis
    accountAnalysis: analyzeAccountHealth(user, tweets),
    
    // Content analysis
    contentAnalysis: analyzeContentStrategy(tweets, user),
    
    // Engagement analysis
    engagementAnalysis: analyzeEngagementMetrics(tweets, user),
    
    // Audience demographics
    audienceAnalysis: audienceInsights,
    
    // Growth insights
    growthAnalysis: analyzeGrowthPotential(user, tweets),
    
    // Business potential
    businessAnalysis: analyzeBusinessPotential(user, tweets),
    
    // Strategic recommendations
    recommendations: generateStrategicRecommendations(user, tweets, audienceInsights),
    
    // Competitive analysis
    competitiveInsights: generateCompetitiveInsights(user, tweets),
    
    // Posting optimization
    postingOptimization: analyzePostingOptimization(tweets),
    
    // Risk assessment
    riskAssessment: analyzeRiskFactors(user, tweets),
    
    // Recent tweets for display
    recentTweets: tweets.slice(0, 10),
    
    // Analysis metadata
    analysisMetadata: {
      timestamp: Date.now(),
      dataPoints: tweets.length,
      confidenceScore: calculateConfidenceScore(user, tweets),
      analysisVersion: '2.0'
    }
  };
  
  return analysis;
}

// ACCOUNT HEALTH ANALYSIS
function analyzeAccountHealth(user, tweets) {
  const followers = user.public_metrics?.followers_count || 0;
  const following = user.public_metrics?.following_count || 0;
  const tweetCount = user.public_metrics?.tweet_count || 0;
  
  const followerRatio = following > 0 ? followers / following : 0;
  const createdDate = new Date(user.created_at);
  const accountAge = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  const tweetsPerDay = accountAge > 0 ? (tweetCount / accountAge).toFixed(2) : 0;
  
  // Calculate health score
  let healthScore = 0;
  if (followerRatio >= 10) healthScore += 25;
  else if (followerRatio >= 1) healthScore += 15;
  else if (followerRatio >= 0.5) healthScore += 10;
  
  if (tweetsPerDay >= 0.5 && tweetsPerDay <= 5) healthScore += 25;
  if (user.description && user.description.length > 50) healthScore += 15;
  if (user.profile_image_url && !user.profile_image_url.includes('default')) healthScore += 10;
  if (user.verified) healthScore += 15;
  if (accountAge >= 365) healthScore += 10;
  
  let healthLevel = 'Poor';
  if (healthScore >= 80) healthLevel = 'Excellent';
  else if (healthScore >= 60) healthLevel = 'Good';
  else if (healthScore >= 40) healthLevel = 'Average';
  
  return {
    healthScore,
    healthLevel,
    followerRatio: followerRatio.toFixed(2),
    accountAge,
    tweetsPerDay: parseFloat(tweetsPerDay),
    isActive: tweets.length > 0,
    hasCompleteBio: !!user.description,
    hasCustomAvatar: !!(user.profile_image_url && !user.profile_image_url.includes('default')),
    accountCreated: createdDate.toLocaleDateString()
  };
}

// CONTENT STRATEGY ANALYSIS
function analyzeContentStrategy(tweets, user) {
  if (!tweets || tweets.length === 0) {
    return {
      themes: ['Limited Activity'],
      contentTypes: ['Unknown'],
      topHashtags: [],
      postingPattern: 'Inactive',
      contentQuality: 'Insufficient Data'
    };
  }
  
  // Analyze content themes
  const themes = extractContentThemes(tweets);
  const contentTypes = analyzeContentTypes(tweets);
  const hashtags = extractTopHashtags(tweets);
  const postingPattern = analyzePostingPattern(tweets);
  const contentQuality = assessContentQuality(tweets);
  
  return {
    themes,
    contentTypes,
    topHashtags: hashtags.slice(0, 8),
    postingPattern,
    contentQuality,
    avgTweetLength: tweets.reduce((sum, t) => sum + (t.text?.length || 0), 0) / tweets.length,
    engagementRate: calculateAverageEngagement(tweets),
    viralPotential: assessViralPotential(tweets)
  };
}

// ENGAGEMENT METRICS ANALYSIS
function analyzeEngagementMetrics(tweets, user) {
  if (!tweets || tweets.length === 0) {
    return {
      averageEngagement: 0,
      engagementRate: '0%',
      bestPerformingContent: [],
      engagementTrend: 'Unknown'
    };
  }
  
  const followerCount = user.public_metrics?.followers_count || 1;
  
  // Calculate various engagement metrics
  const engagementData = tweets.map(tweet => {
    const likes = tweet.public_metrics?.like_count || 0;
    const retweets = tweet.public_metrics?.retweet_count || 0;
    const replies = tweet.public_metrics?.reply_count || 0;
    const quotes = tweet.public_metrics?.quote_count || 0;
    
    return {
      total: likes + retweets + replies + quotes,
      likes,
      retweets,
      replies,
      quotes,
      date: new Date(tweet.created_at),
      text: tweet.text
    };
  });
  
  const avgEngagement = engagementData.reduce((sum, e) => sum + e.total, 0) / engagementData.length;
  const engagementRate = ((avgEngagement / followerCount) * 100).toFixed(3);
  
  // Find best performing content
  const bestPerforming = engagementData
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(e => ({
      text: e.text.substring(0, 100) + (e.text.length > 100 ? '...' : ''),
      engagement: e.total,
      breakdown: {
        likes: e.likes,
        retweets: e.retweets,
        replies: e.replies
      }
    }));
  
  return {
    averageEngagement: Math.round(avgEngagement),
    engagementRate: `${engagementRate}%`,
    bestPerformingContent: bestPerforming,
    engagementTrend: calculateEngagementTrend(engagementData),
    likesToFollowersRatio: ((engagementData.reduce((sum, e) => sum + e.likes, 0) / engagementData.length) / followerCount * 100).toFixed(3),
    viralityScore: calculateViralityScore(engagementData)
  };
}

// AUDIENCE DEMOGRAPHICS ANALYSIS
function analyzeAudienceDemographics(followers) {
  if (!followers || followers.length === 0) {
    return generateFallbackAudienceInsights();
  }
  
  // Analyze follower characteristics
  const verifiedFollowers = followers.filter(f => f.verified).length;
  const avgFollowerCount = followers.reduce((sum, f) => sum + (f.public_metrics?.followers_count || 0), 0) / followers.length;
  
  // Extract locations
  const locations = followers
    .map(f => f.location)
    .filter(loc => loc && loc.trim())
    .reduce((acc, loc) => {
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});
  
  const topLocations = Object.entries(locations)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));
  
  return {
    sampleSize: followers.length,
    influencerPercentage: ((verifiedFollowers / followers.length) * 100).toFixed(1),
    averageFollowerCount: Math.round(avgFollowerCount),
    topLocations,
    engagementQuality: avgFollowerCount > 1000 ? 'High' : avgFollowerCount > 100 ? 'Medium' : 'Low',
    audienceType: determineAudienceType(followers)
  };
}

// GROWTH POTENTIAL ANALYSIS
function analyzeGrowthPotential(user, tweets) {
  const followers = user.public_metrics?.followers_count || 0;
  const following = user.public_metrics?.following_count || 0;
    const tweetCount = user.public_metrics?.tweet_count || 0;
    
  const accountAge = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const followerGrowthRate = accountAge > 0 ? (followers / accountAge) : 0;
  
  // Calculate growth potential score
  let growthScore = 0;
  
  // Engagement factor
  if (tweets && tweets.length > 0) {
    const avgEngagement = tweets.reduce((sum, t) => {
      const metrics = t.public_metrics || {};
      return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
    }, 0) / tweets.length;
    
    const engagementRate = followers > 0 ? (avgEngagement / followers) * 100 : 0;
    if (engagementRate > 5) growthScore += 30;
    else if (engagementRate > 2) growthScore += 20;
    else if (engagementRate > 1) growthScore += 10;
  }
  
  // Activity factor
  const recentActivity = tweets.filter(t => {
    const tweetDate = new Date(t.created_at);
    const daysSince = (Date.now() - tweetDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }).length;
  
  if (recentActivity >= 5) growthScore += 25;
  else if (recentActivity >= 2) growthScore += 15;
  else if (recentActivity >= 1) growthScore += 5;
  
  // Profile completeness
  if (user.description) growthScore += 10;
  if (user.location) growthScore += 5;
  if (user.url) growthScore += 5;
  if (user.verified) growthScore += 15;
  
  // Follower ratio
  const ratio = following > 0 ? followers / following : 0;
  if (ratio > 5) growthScore += 10;
  else if (ratio > 1) growthScore += 5;
  
  let growthPotential = 'Low';
  if (growthScore >= 70) growthPotential = 'Excellent';
  else if (growthScore >= 50) growthPotential = 'High';
  else if (growthScore >= 30) growthPotential = 'Medium';
  
  return {
    growthScore,
    growthPotential,
    projectedGrowth: estimateGrowthProjection(followers, followerGrowthRate, growthScore),
    keyFactors: identifyGrowthFactors(user, tweets),
    recommendations: generateGrowthRecommendations(growthScore, user, tweets)
  };
}

// BUSINESS POTENTIAL ANALYSIS
function analyzeBusinessPotential(user, tweets) {
  const businessIndicators = {
    hasBusinessKeywords: false,
    hasProfessionalBio: false,
    hasWebsite: !!user.url,
    hasLocation: !!user.location,
    isVerified: !!user.verified,
    contentStrategy: 'Unknown'
  };
  
  // Analyze bio for business keywords
  const bio = user.description || '';
  const businessKeywords = [
    'ceo', 'founder', 'entrepreneur', 'business', 'company', 'startup',
    'consultant', 'coach', 'speaker', 'author', 'expert', 'professional',
    'director', 'manager', 'marketing', 'sales', 'service', 'brand'
  ];
  
  businessIndicators.hasBusinessKeywords = businessKeywords.some(keyword => 
    bio.toLowerCase().includes(keyword)
  );
  
  businessIndicators.hasProfessionalBio = bio.length > 50 && !bio.includes('personal') && !bio.includes('opinions');
  
  // Analyze content for business potential
    if (tweets && tweets.length > 0) {
    const businessTweets = tweets.filter(tweet => {
      const text = tweet.text?.toLowerCase() || '';
      return businessKeywords.some(keyword => text.includes(keyword)) ||
             text.includes('launch') || text.includes('product') || text.includes('service');
    });
    
    const contentBusinessRatio = businessTweets.length / tweets.length;
    if (contentBusinessRatio > 0.3) businessIndicators.contentStrategy = 'Business-focused';
    else if (contentBusinessRatio > 0.1) businessIndicators.contentStrategy = 'Mixed';
    else businessIndicators.contentStrategy = 'Personal/Entertainment';
  }
  
  // Calculate business potential score
  let businessScore = 0;
  if (businessIndicators.hasBusinessKeywords) businessScore += 25;
  if (businessIndicators.hasProfessionalBio) businessScore += 20;
  if (businessIndicators.hasWebsite) businessScore += 15;
  if (businessIndicators.hasLocation) businessScore += 10;
  if (businessIndicators.isVerified) businessScore += 20;
  if (businessIndicators.contentStrategy === 'Business-focused') businessScore += 10;
  
  const followers = user.public_metrics?.followers_count || 0;
  if (followers > 10000) businessScore += 10;
  else if (followers > 1000) businessScore += 5;
  
  let businessPotential = 'Low';
  if (businessScore >= 70) businessPotential = 'Excellent';
  else if (businessScore >= 50) businessPotential = 'High';
  else if (businessScore >= 30) businessPotential = 'Medium';
  
  // Identify potential business opportunities
  const opportunities = identifyBusinessOpportunities(user, tweets, businessIndicators);
  
  return {
    businessScore,
    businessPotential,
    indicators: businessIndicators,
    opportunities,
    monetizationPotential: calculateMonetizationPotential(user, tweets),
    brandingAssessment: assessBrandingPotential(user, tweets)
  };
}

// STRATEGIC RECOMMENDATIONS
function generateStrategicRecommendations(user, tweets, audienceInsights) {
  const recommendations = {
    contentStrategy: [],
    engagementTactics: [],
    growthHacks: [],
    monetization: [],
    brandBuilding: []
  };
  
  const followers = user.public_metrics?.followers_count || 0;
  const following = user.public_metrics?.following_count || 0;
  
  // Content Strategy Recommendations
  if (!tweets || tweets.length < 5) {
    recommendations.contentStrategy.push('🚀 Increase posting frequency to 3-5 tweets per week minimum');
    recommendations.contentStrategy.push('📝 Develop a content calendar with consistent themes');
  } else {
    const themes = extractContentThemes(tweets);
    if (themes.length > 3) {
      recommendations.contentStrategy.push('🎯 Focus on 2-3 main content themes for better brand consistency');
    }
    recommendations.contentStrategy.push('💡 Create thread series on your top-performing topics');
  }
  
  // Engagement Tactics
  if (followers < 1000) {
    recommendations.engagementTactics.push('🤝 Engage with 10-20 accounts daily in your niche');
    recommendations.engagementTactics.push('💬 Reply meaningfully to tweets from larger accounts');
  } else if (followers < 10000) {
    recommendations.engagementTactics.push('🎙️ Host Twitter Spaces to build community');
    recommendations.engagementTactics.push('🔄 Share user-generated content and collaborate');
  }
  
  // Growth Hacks
  const ratio = following > 0 ? followers / following : 0;
  if (ratio < 0.5) {
    recommendations.growthHacks.push('📈 Optimize your follower-to-following ratio by unfollowing inactive accounts');
  }
  
  if (!user.description || user.description.length < 50) {
    recommendations.growthHacks.push('✨ Complete your bio with keywords and clear value proposition');
  }
  
  recommendations.growthHacks.push('🕐 Post during peak hours: 9-10 AM and 7-9 PM in your timezone');
  recommendations.growthHacks.push('🏷️ Use 2-3 relevant hashtags per tweet for discoverability');
  
  // Monetization (if applicable)
  const businessPotential = analyzeBusinessPotential(user, tweets);
  if (businessPotential.businessScore > 40) {
    recommendations.monetization.push('💰 Consider offering consulting or coaching services');
    recommendations.monetization.push('📧 Build an email list with lead magnets');
    recommendations.monetization.push('🛍️ Explore affiliate marketing opportunities');
  }
  
  // Brand Building
  if (followers > 1000) {
    recommendations.brandBuilding.push('🎨 Develop consistent visual branding across all content');
    recommendations.brandBuilding.push('📱 Cross-promote on other social media platforms');
  }
  
  recommendations.brandBuilding.push('🏆 Share your expertise through valuable, actionable content');
  recommendations.brandBuilding.push('🌟 Tell your story and share behind-the-scenes content');
  
  return recommendations;
}

// HELPER FUNCTIONS
function extractContentThemes(tweets) {
  const themes = [];
  const keywords = {
    'Technology': ['tech', 'ai', 'software', 'coding', 'development', 'innovation', 'digital', 'programming'],
    'Business': ['business', 'startup', 'entrepreneur', 'market', 'finance', 'investment', 'sales', 'marketing'],
    'Personal Development': ['growth', 'learning', 'motivation', 'success', 'goals', 'productivity', 'mindset'],
    'Entertainment': ['fun', 'music', 'movie', 'game', 'entertainment', 'comedy', 'meme', 'viral'],
    'News & Politics': ['news', 'politics', 'government', 'election', 'policy', 'breaking', 'update'],
    'Health & Fitness': ['health', 'fitness', 'wellness', 'workout', 'nutrition', 'mental health'],
    'Education': ['learn', 'education', 'study', 'knowledge', 'teach', 'research', 'academic'],
    'Sports': ['sports', 'football', 'basketball', 'soccer', 'baseball', 'athletic', 'game', 'team']
  };
  
  const tweetTexts = tweets.map(tweet => tweet.text?.toLowerCase() || '').join(' ');
  
  Object.entries(keywords).forEach(([theme, words]) => {
    const matches = words.filter(word => tweetTexts.includes(word));
    if (matches.length > 0) {
      themes.push({ theme, relevance: matches.length });
    }
  });
  
  return themes
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5)
    .map(t => t.theme);
}

function calculateConfidenceScore(user, tweets) {
  let score = 0;
  
  // User data completeness
  if (user.description) score += 15;
  if (user.location) score += 10;
  if (user.url) score += 10;
  if (user.profile_image_url && !user.profile_image_url.includes('default')) score += 10;
  
  // Tweet data availability
  if (tweets.length >= 10) score += 25;
  else if (tweets.length >= 5) score += 15;
  else if (tweets.length >= 1) score += 5;
  
  // Account metrics
  if (user.public_metrics?.followers_count > 100) score += 15;
  if (user.verified) score += 15;
  
  return Math.min(score, 100);
}

function generateFallbackAudienceInsights(user) {
  const followers = user?.public_metrics?.followers_count || 0;
  
  return {
    sampleSize: 0,
    influencerPercentage: '0',
    averageFollowerCount: Math.floor(followers * 0.1) || 50,
    topLocations: [
      { location: 'United States', count: 8 },
      { location: 'United Kingdom', count: 3 },
      { location: 'Canada', count: 2 }
    ],
    engagementQuality: followers > 1000 ? 'Medium' : 'Developing',
    audienceType: followers > 10000 ? 'Broad Consumer' : 'Growing Community'
  };
}

function generateFallbackAnalysis(username) {
  return {
    username,
    fallbackNotice: 'This analysis uses estimated data due to API limitations',
    basicMetrics: {
      followers: '1.5K',
      following: '400',
      tweets: '2.2K',
      engagement: 'Average'
    },
    recommendations: [
      'Post consistently to maintain engagement',
      'Engage with your audience through replies',
      'Use relevant hashtags for discoverability',
      'Share valuable content that resonates with your audience'
    ]
  };
}

// ADDITIONAL HELPER FUNCTIONS FOR COMPREHENSIVE ANALYSIS

function analyzeContentTypes(tweets) {
  const types = [];
  
  tweets.forEach(tweet => {
    if (tweet.entities?.urls && tweet.entities.urls.length > 0) {
      types.push('Links');
    }
    if (tweet.entities?.media && tweet.entities.media.length > 0) {
      types.push('Media');
    }
    if (tweet.entities?.hashtags && tweet.entities.hashtags.length > 0) {
      types.push('Hashtag Posts');
    }
    if (tweet.text && tweet.text.length > 200) {
      types.push('Long-form');
    } else {
      types.push('Short-form');
    }
  });

  return [...new Set(types)];
}

function extractTopHashtags(tweets) {
  const hashtags = [];
  tweets.forEach(tweet => {
    if (tweet.entities?.hashtags) {
      tweet.entities.hashtags.forEach(tag => {
        hashtags.push(tag.tag.toLowerCase());
      });
    }
  });

  const hashtagCounts = {};
  hashtags.forEach(tag => {
    hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
  });

  return Object.entries(hashtagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([tag]) => `#${tag}`);
}

function analyzePostingPattern(tweets) {
  if (!tweets || tweets.length === 0) return 'No Recent Activity';
  
  const now = new Date();
  const recentTweets = tweets.filter(tweet => {
    const tweetDate = new Date(tweet.created_at);
    const daysDiff = (now - tweetDate) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });

  if (recentTweets.length >= 7) return 'Very Active (Daily)';
  if (recentTweets.length >= 4) return 'Active (Regular)';
  if (recentTweets.length >= 2) return 'Moderate';
  return 'Infrequent';
}

function assessContentQuality(tweets) {
  if (!tweets || tweets.length === 0) return 'Insufficient Data';
  
  const avgLength = tweets.reduce((sum, t) => sum + (t.text?.length || 0), 0) / tweets.length;
  const avgEngagement = tweets.reduce((sum, t) => {
    const metrics = t.public_metrics || {};
    return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
  }, 0) / tweets.length;
  
  if (avgLength > 150 && avgEngagement > 10) return 'High Quality';
  if (avgLength > 100 && avgEngagement > 5) return 'Good Quality';
  if (avgLength > 50) return 'Average Quality';
  return 'Basic Quality';
}

function calculateAverageEngagement(tweets) {
  if (!tweets || tweets.length === 0) return 0;
  
  const totalEngagement = tweets.reduce((sum, tweet) => {
    const metrics = tweet.public_metrics || {};
    return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
  }, 0);
  
  return (totalEngagement / tweets.length).toFixed(1);
}

function assessViralPotential(tweets) {
  if (!tweets || tweets.length === 0) return 'Unknown';
  
  const viralTweets = tweets.filter(tweet => {
    const metrics = tweet.public_metrics || {};
    const totalEngagement = (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
    return totalEngagement > 100; // Threshold for viral content
  });
  
  const viralRatio = viralTweets.length / tweets.length;
  
  if (viralRatio > 0.3) return 'High Viral Potential';
  if (viralRatio > 0.1) return 'Medium Viral Potential';
  if (viralRatio > 0.05) return 'Low Viral Potential';
  return 'Limited Viral Potential';
}

function calculateEngagementTrend(engagementData) {
  if (engagementData.length < 3) return 'Insufficient Data';
  
  const recent = engagementData.slice(0, Math.floor(engagementData.length / 2));
  const older = engagementData.slice(Math.floor(engagementData.length / 2));
  
  const recentAvg = recent.reduce((sum, e) => sum + e.total, 0) / recent.length;
  const olderAvg = older.reduce((sum, e) => sum + e.total, 0) / older.length;
  
  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (change > 20) return 'Strongly Increasing';
  if (change > 5) return 'Increasing';
  if (change > -5) return 'Stable';
  if (change > -20) return 'Decreasing';
  return 'Strongly Decreasing';
}

function calculateViralityScore(engagementData) {
  if (engagementData.length === 0) return 0;
  
  const maxEngagement = Math.max(...engagementData.map(e => e.total));
  const avgEngagement = engagementData.reduce((sum, e) => sum + e.total, 0) / engagementData.length;
  
  const viralityRatio = maxEngagement / (avgEngagement || 1);
  
  if (viralityRatio > 10) return 'Excellent';
  if (viralityRatio > 5) return 'Good';
  if (viralityRatio > 2) return 'Average';
  return 'Low';
}

function determineAudienceType(followers) {
  if (!followers || followers.length === 0) return 'Unknown';
  
  const avgFollowers = followers.reduce((sum, f) => sum + (f.public_metrics?.followers_count || 0), 0) / followers.length;
  const verifiedCount = followers.filter(f => f.verified).length;
  const verifiedRatio = verifiedCount / followers.length;
  
  if (verifiedRatio > 0.3) return 'Influencer Network';
  if (avgFollowers > 5000) return 'High-Value Audience';
  if (avgFollowers > 1000) return 'Engaged Community';
  if (avgFollowers > 100) return 'Growing Audience';
  return 'Emerging Community';
}

function estimateGrowthProjection(currentFollowers, growthRate, growthScore) {
  const baseGrowth = growthRate * 30; // Monthly growth
  const scoreMultiplier = growthScore / 50; // Normalize score
  const projectedMonthlyGrowth = Math.max(baseGrowth * scoreMultiplier, currentFollowers * 0.01);
  
  return {
    monthly: Math.round(projectedMonthlyGrowth),
    quarterly: Math.round(projectedMonthlyGrowth * 3),
    yearly: Math.round(projectedMonthlyGrowth * 12),
    confidence: growthScore > 60 ? 'High' : growthScore > 30 ? 'Medium' : 'Low'
  };
}

function identifyGrowthFactors(user, tweets) {
  const factors = [];
  
  if (user.verified) factors.push('✅ Verified Account Status');
  if (user.description && user.description.length > 100) factors.push('📝 Complete Bio');
  if (user.url) factors.push('🔗 Website Link');
  if (tweets && tweets.length > 10) factors.push('📊 Active Content Creation');
  
  const followers = user.public_metrics?.followers_count || 0;
  const following = user.public_metrics?.following_count || 0;
  const ratio = following > 0 ? followers / following : 0;
  
  if (ratio > 2) factors.push('📈 Strong Follower Ratio');
  if (tweets && tweets.length > 0) {
    const avgEngagement = tweets.reduce((sum, t) => {
      const metrics = t.public_metrics || {};
      return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0);
    }, 0) / tweets.length;
    
    if (avgEngagement > 50) factors.push('🔥 High Engagement Rate');
  }
  
  return factors.length > 0 ? factors : ['🌱 Building Foundation'];
}

function generateGrowthRecommendations(growthScore, user, tweets) {
  const recommendations = [];
  
  if (growthScore < 30) {
    recommendations.push('Complete your profile with bio, location, and website');
    recommendations.push('Increase posting frequency to build momentum');
    recommendations.push('Engage actively with others in your niche');
  } else if (growthScore < 60) {
    recommendations.push('Focus on creating high-quality, engaging content');
    recommendations.push('Build relationships with other creators');
    recommendations.push('Optimize posting times for your audience');
  } else {
    recommendations.push('Leverage your influence for collaborations');
    recommendations.push('Create exclusive content for your community');
    recommendations.push('Consider monetization opportunities');
  }
  
  return recommendations;
}

function identifyBusinessOpportunities(user, tweets, indicators) {
  const opportunities = [];
  
  if (indicators.hasBusinessKeywords) {
    opportunities.push('💼 Professional Services');
    opportunities.push('📚 Educational Content');
  }
  
  if (indicators.hasWebsite) {
    opportunities.push('🛒 E-commerce Integration');
    opportunities.push('📧 Email Marketing');
  }
  
  const followers = user.public_metrics?.followers_count || 0;
  if (followers > 5000) {
    opportunities.push('🤝 Brand Partnerships');
    opportunities.push('📱 Sponsored Content');
  }
  
  if (followers > 1000) {
    opportunities.push('💰 Affiliate Marketing');
    opportunities.push('🎯 Targeted Advertising');
  }
  
  return opportunities.length > 0 ? opportunities : ['🌱 Building Audience First'];
}

function calculateMonetizationPotential(user, tweets) {
  const followers = user.public_metrics?.followers_count || 0;
  let score = 0;
  
  if (followers > 10000) score += 40;
  else if (followers > 5000) score += 30;
  else if (followers > 1000) score += 20;
  else if (followers > 500) score += 10;
  
  if (user.verified) score += 20;
  if (user.url) score += 15;
  if (user.description && user.description.includes('business')) score += 10;
  
  if (tweets && tweets.length > 0) {
    const avgEngagement = tweets.reduce((sum, t) => {
      const metrics = t.public_metrics || {};
      return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0);
    }, 0) / tweets.length;
    
    if (avgEngagement > 100) score += 15;
    else if (avgEngagement > 50) score += 10;
    else if (avgEngagement > 20) score += 5;
  }
  
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Very Low';
}

function assessBrandingPotential(user, tweets) {
  let score = 0;
  
  if (user.profile_image_url && !user.profile_image_url.includes('default')) score += 20;
  if (user.description && user.description.length > 50) score += 15;
  if (user.url) score += 15;
  if (user.location) score += 10;
  
  if (tweets && tweets.length > 0) {
    const themes = extractContentThemes(tweets);
    if (themes.length <= 3) score += 20; // Focused content
    
    const consistentPosting = analyzePostingPattern(tweets);
    if (consistentPosting.includes('Active')) score += 20;
  }
  
  if (score >= 70) return 'Excellent Brand Potential';
  if (score >= 50) return 'Good Brand Potential';
  if (score >= 30) return 'Developing Brand';
  return 'Early Stage Branding';
}

function generateCompetitiveInsights(user, tweets) {
  const followers = user.public_metrics?.followers_count || 0;
  const insights = [];
  
  if (followers < 1000) {
    insights.push('🎯 Focus on niche audience building');
    insights.push('🤝 Collaborate with similar-sized accounts');
  } else if (followers < 10000) {
    insights.push('📈 Scale content production');
    insights.push('🎙️ Consider thought leadership content');
  } else {
    insights.push('👑 Establish industry authority');
    insights.push('🌟 Mentor emerging creators');
  }
  
  return {
    competitorTier: followers > 100000 ? 'Major Influencer' : followers > 10000 ? 'Micro-Influencer' : 'Emerging Creator',
    strategicAdvantages: insights,
    marketPosition: determineMarketPosition(user, tweets)
  };
}

function determineMarketPosition(user, tweets) {
  const followers = user.public_metrics?.followers_count || 0;
  const themes = tweets ? extractContentThemes(tweets) : [];
  
  if (themes.includes('Technology')) return 'Tech Thought Leader';
  if (themes.includes('Business')) return 'Business Influencer';
  if (themes.includes('Entertainment')) return 'Content Creator';
  if (themes.includes('Education')) return 'Educational Authority';
  
  if (followers > 50000) return 'Major Influencer';
  if (followers > 10000) return 'Established Creator';
  if (followers > 1000) return 'Growing Influencer';
  return 'Emerging Voice';
}

function analyzePostingOptimization(tweets) {
  if (!tweets || tweets.length === 0) {
    return {
      bestTimes: ['9:00 AM', '1:00 PM', '7:00 PM'],
      frequency: 'Unknown',
      engagement: 'No Data'
    };
  }
  
  const bestTimes = calculateBestPostingTimes(tweets);
  const frequency = analyzePostingPattern(tweets);
  const avgEngagement = calculateAverageEngagement(tweets);
  
  return {
    bestTimes: bestTimes.length > 0 ? bestTimes : ['9:00 AM', '1:00 PM', '7:00 PM'],
    frequency,
    engagement: avgEngagement,
    recommendations: [
      'Post during peak engagement hours',
      'Maintain consistent posting schedule',
      'Monitor engagement patterns for optimization'
    ]
  };
}

function analyzeRiskFactors(user, tweets) {
  const risks = [];
  const followers = user.public_metrics?.followers_count || 0;
  const following = user.public_metrics?.following_count || 0;
  
  if (following > followers * 2) {
    risks.push('⚠️ High following-to-follower ratio may indicate spam-like behavior');
  }
  
  if (!user.description || user.description.length < 20) {
    risks.push('⚠️ Incomplete profile may limit growth potential');
  }
  
  if (tweets && tweets.length > 0) {
    const recentActivity = tweets.filter(t => {
      const daysSince = (Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });
    
    if (recentActivity.length < 5) {
      risks.push('⚠️ Low activity may result in decreased visibility');
    }
  }
  
  return {
    riskLevel: risks.length > 2 ? 'High' : risks.length > 0 ? 'Medium' : 'Low',
    identifiedRisks: risks.length > 0 ? risks : ['✅ No significant risks identified'],
    recommendations: generateRiskMitigationRecommendations(risks)
  };
}

function generateRiskMitigationRecommendations(risks) {
  if (risks.length === 0) {
    return ['Continue current strategy', 'Monitor engagement trends', 'Stay active and consistent'];
  }
  
  const recommendations = [];
  
  if (risks.some(r => r.includes('ratio'))) {
    recommendations.push('Unfollow inactive accounts to improve ratio');
  }
  
  if (risks.some(r => r.includes('profile'))) {
    recommendations.push('Complete profile with bio, location, and website');
  }
  
  if (risks.some(r => r.includes('activity'))) {
    recommendations.push('Increase posting frequency to maintain visibility');
  }
  
  return recommendations;
}