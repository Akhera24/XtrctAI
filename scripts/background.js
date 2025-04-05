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
console.log('Environment loading status:', {
  twitterConfig1: !!twitter?.config1?.bearerToken,
  twitterConfig2: !!twitter?.config2?.bearerToken,
  grokApiKey: !!grokAi?.apiKey,
  apiValidation: apiValidation
});

// Initialize the extension state
chrome.runtime.onInstalled.addListener(() => {
  console.log('X Profile Analyzer extension installed');
  
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
  
  // Store bearer tokens in local storage for easier access
  chrome.storage.local.set({
    bearerToken: twitter.config1.bearerToken,
    bearerToken2: twitter.config2.bearerToken
  });
  
  // Create context menu to open in floating mode
  chrome.contextMenus.create({
    id: "open-floating",
    title: "Open in floating window",
    contexts: ["action"]
  });
});

/**
 * Primary Twitter API configuration object
 * Contains authentication credentials and API endpoint for the main Twitter API access
 * Used for primary API requests and authentication flows
 * @constant {Object} API_CONFIG
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
 * Secondary/backup Twitter API configuration object
 * Contains authentication credentials and API endpoint for the fallback Twitter API access
 * Used when primary API hits rate limits or experiences issues
 * Includes additional X_API_KEY_SECRET for enhanced security
 * @constant {Object} API_CONFIG2 
 */
const API_CONFIG2 = {
    X_API_KEY: twitter.config2.xApiKey,
    X_API_KEY_SECRET: twitter.config2.xApiKeySecret,
    CLIENT_ID: twitter.config2.clientId,
    CLIENT_SECRET: twitter.config2.clientSecret,
    BEARER_TOKEN: twitter.config2.bearerToken,
    ACCESS_TOKEN: twitter.config2.accessToken,
    ACCESS_TOKEN_SECRET: twitter.config2.accessTokenSecret,
    API_BASE_URL: twitter.config2.baseUrl || 'https://api.twitter.com/2'
};

// API keys for grok AI 
const API_CONFIG3 = {
    API_KEY: grokAi.apiKey,
    API_BASE_URL: grokAi.baseUrl || 'https://api.grok.com/v1'
};

// Log API configuration status
console.log('API Configuration Status:', {
  config1Available: !!API_CONFIG.BEARER_TOKEN,
  config2Available: !!API_CONFIG2.BEARER_TOKEN,
  grokAvailable: !!API_CONFIG3.API_KEY
});

// Track which config we're using currently
let activeConfigNum = 1;

// More conservative rate limiting
const RATE_LIMITS = {
    config1: {
        readRequests: {
            total: 50,  // Increased from 25 to 50 requests per month
            used: 0,
            resetDate: new Date().setMonth(new Date().getMonth() + 1),
            lastRequestTime: null
        }
    },
    config2: {
        readRequests: {
            total: 50,  // Increased from 25 to 50 requests per month
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
    console.log('Configurations stored');
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
    console.log('Initializing extension configuration...');
    
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
    
    // Register proxy service worker
    try {
      // Check if proxy is enabled
      if (proxyConfig.enabled) {
        console.log('Setting up proxy configuration...');
        
        // Store proxy config in storage for service worker access
        await chrome.storage.local.set({ 
          proxyConfig: {
            enabled: proxyConfig.enabled,
            url: proxyUrl || '',
            timeoutMs: proxyConfig.timeout || 15000,
            retryAttempts: proxyConfig.retryAttempts || 3
          }
        });
        
        // Register the proxy service worker if possible
        try {
          // Get the chrome runtime URL for the proxy service worker
          const proxyServiceWorkerUrl = chrome.runtime.getURL('proxy-service-worker.js');
          console.log('Proxy service worker URL:', proxyServiceWorkerUrl);
          
          // Check if the service worker API is available
          if ('serviceWorker' in navigator) {
            // Attempt to register the proxy service worker
            navigator.serviceWorker.register(proxyServiceWorkerUrl, {
              scope: '/'
            }).then(registration => {
              console.log('Proxy service worker registered:', registration.scope);
              chrome.storage.local.set({ proxyServiceWorkerRegistered: true });
            }).catch(error => {
              console.error('Proxy service worker registration failed:', error);
              chrome.storage.local.set({ 
                proxyServiceWorkerRegistered: false,
                proxyServiceWorkerError: error.message
              });
            });
          } else {
            console.warn('Service Worker API not available in this context');
            chrome.storage.local.set({ 
              proxyServiceWorkerRegistered: false,
              proxyServiceWorkerError: 'Service Worker API not available'
            });
          }
        } catch (swError) {
          console.error('Error registering proxy service worker:', swError);
          chrome.storage.local.set({ 
            proxyServiceWorkerRegistered: false,
            proxyServiceWorkerError: swError.message
          });
        }
        
        // Test proxy connection but don't wait for it - just log the result
        testProxyConnection().then(isConnected => {
          console.log(`Proxy connection test result: ${isConnected ? 'Connected' : 'Failed'}`);
          
          // Store connection status in storage
          chrome.storage.local.set({ proxyConnected: isConnected });
          
          // Preload the icons after proxy check
          try {
            if (iconManager && typeof iconManager.setIconState === 'function') {
              iconManager.setIconState('default').catch(err => {
                console.warn('Unable to set initial icon state:', err);
              });
            }
          } catch (iconError) {
            console.warn('Icon manager error during initialization:', iconError);
          }
        });
      } else {
        console.log('Proxy is disabled, using direct API connections');
        
        // Still preload icons
        try {
          if (iconManager && typeof iconManager.setIconState === 'function') {
            iconManager.setIconState('default').catch(err => {
              console.warn('Unable to set initial icon state:', err);
            });
          }
        } catch (iconError) {
          console.warn('Icon manager error during initialization:', iconError);
        }
      }
    } catch (proxyError) {
      console.error('Error setting up proxy:', proxyError);
      
      // Still continue with initialization
      try {
        if (iconManager && typeof iconManager.setIconState === 'function') {
          iconManager.setIconState('default').catch(err => {
            console.warn('Unable to set initial icon state:', err);
          });
        }
      } catch (iconError) {
        console.warn('Icon manager error during initialization:', iconError);
      }
    }
    
    console.log('Initialization complete');
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

// Handle profile analysis request
async function handleAnalyzeProfile(request, sendResponse) {
  try {
    console.log('Analyzing profile for:', request.username);
    
    // Validate username
    if (!request.username) {
      throw new Error('Invalid username provided');
    }
    
    // Clean username
    const username = request.username.replace('@', '');
    
    // Set icon to loading state safely
    try {
      // Only update icon if in a suitable environment
      await iconManager.setIconState('loading');
    } catch (iconError) {
      console.warn('Unable to update icon state:', iconError);
      // Continue with the analysis - don't fail because of icon issues
    }
    
    // Try to get cached data first
    let cachedData = null;
    try {
      cachedData = await getCachedData(username);
      
      if (cachedData) {
        console.log('Using cached data for profile analysis');
        sendResponse({
          success: true,
          data: cachedData,
          fromCache: true
        });
        
        // Set icon to active state
        try {
          await iconManager.setIconState('active');
        } catch (iconError) {
          console.warn('Unable to update icon state:', iconError);
        }
        
        return;
      }
    } catch (cacheError) {
      console.log('No valid cache found, proceeding with API request');
    }
    
    // Make API request through proxy
    const response = await makeAuthenticatedRequest(`users/by/username/${username}`, {
      method: 'GET',
      params: {
        'user.fields': 'created_at,description,entities,id,location,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type'
      }
    });
    
    if (!response.success && !response.data) {
      throw new Error(response.error || 'Failed to fetch user data');
    }
    
    // Get user tweets
    let userData = response.data;
    let tweets = [];
    
    if (userData && userData.data && userData.data.id) {
      try {
        const tweetsResponse = await makeAuthenticatedRequest(`users/${userData.data.id}/tweets`, {
          method: 'GET',
          params: {
            'max_results': 10,
            'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
            'exclude': 'retweets,replies'
          }
        });
        
        if (tweetsResponse.success && tweetsResponse.data) {
          tweets = tweetsResponse.data.data || [];
        }
      } catch (tweetError) {
        console.error('Error fetching tweets:', tweetError);
        // Continue even if tweets fail
      }
    }
    
    // Ensure public_metrics exists (defensive coding)
    if (userData && userData.data) {
      if (!userData.data.public_metrics) {
        userData.data.public_metrics = {
          followers_count: userData.data.followers_count || 0,
          following_count: userData.data.following_count || 0,
          tweet_count: userData.data.statuses_count || userData.data.tweet_count || 0,
          listed_count: userData.data.listed_count || 0
        };
      }
    }
    
    // Process the data - create a more user-friendly result object
    const user = userData.data;
    
    // Only proceed if we have valid user data
    if (!user) {
      throw new Error('Invalid user data received from API');
    }
    
    // Calculate metrics - with defensive coding to handle potential missing fields
    const followersCount = user.public_metrics?.followers_count || 0;
    const followingCount = user.public_metrics?.following_count || 0;
    const tweetCount = user.public_metrics?.tweet_count || 0;
    
    const followerRatio = followingCount > 0 
      ? (followersCount / followingCount).toFixed(2) 
      : 'N/A';
    
    // Calculate account age
    const createdDate = new Date(user.created_at || Date.now());
    const now = new Date();
    const accountAgeMs = now - createdDate;
    const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24)) || 1; // Prevent division by zero
    
    // Calculate tweets per day
    const tweetsPerDay = accountAgeDays > 0 
      ? (tweetCount / accountAgeDays).toFixed(2) 
      : tweetCount;
    
    // Create the analysis result with enhanced format
    const analysisResult = {
      username: user.username,
      displayName: user.name,
      profileImageUrl: user.profile_image_url,
      description: user.description,
      verified: user.verified || false,
      verifiedType: user.verified_type || 'none',
      accountStats: {
        followersCount,
        followingCount,
        tweetCount,
        followerRatio,
        accountAgeDays,
        accountCreated: createdDate.toDateString(),
        tweetsPerDay,
        isProtected: user.protected || false
      },
      location: user.location || 'Not specified',
      url: user.url,
      rawUserData: user,
      recentTweets: tweets
    };
    
    // Add posting strategy insights if tweets are available
    if (tweets && tweets.length > 0) {
      try {
        analysisResult.postingStrategy = analyzePostingStrategy(user, tweets);
      } catch (strategyError) {
        console.error('Error analyzing posting strategy:', strategyError);
        // Continue without posting strategy
      }
    }
    
    // Cache the successful response
    try {
      await cacheData(username, analysisResult);
    } catch (cacheError) {
      console.warn('Failed to cache analysis result:', cacheError);
    }
    
    // Send response back to popup
    sendResponse({
      success: true,
      data: analysisResult,
      fromCache: false
    });
    
    // Update icon to success state
    try {
      await iconManager.setIconState('active');
    } catch (iconError) {
      console.warn('Unable to update icon state:', iconError);
    }
    
  } catch (error) {
    console.error('Error in handleAnalyzeProfile:', error);
    
    // Try to use cached data even if it's expired
    try {
      const expiredCache = await getCachedData(request.username, true);
      if (expiredCache) {
        sendResponse({
          success: true,
          data: expiredCache,
          fromCache: true,
          cacheExpired: true,
          warning: 'Using expired cached data due to API error'
        });
        
        // Set icon to a warning state
        try {
          await iconManager.setIconState('error');
          setTimeout(() => {
            iconManager.setIconState('default').catch(err => console.warn('Error setting default icon:', err));
          }, 2000);
        } catch (iconError) {
          console.warn('Unable to update icon state:', iconError);
        }
        
        return;
      }
    } catch (cacheError) {
      console.log('No expired cache available');
    }
    
    // Set icon to error state
    try {
      await iconManager.setIconState('error');
    } catch (iconError) {
      console.warn('Unable to update icon state:', iconError);
    }
    
    // Send error response
    sendResponse({
      success: false,
      error: error.message || 'An unknown error occurred',
      errorDetail: error.toString()
    });
  }
}