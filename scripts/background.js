// Import the grokService module using ES modules syntax
import * as grokService from './grokService.js';
import { iconManager } from './iconManager.js';
import { twitter, grokAi } from '../env.js';

// Log environment variables loading status
console.log('Environment loading status:', {
  twitterConfig1: !!twitter?.config1?.bearerToken,
  twitterConfig2: !!twitter?.config2?.bearerToken,
  grokApiKey: !!grokAi?.apiKey
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
    X_API_KEY: twitter.config1.xApiKey || process.env.TWITTER_API_1_X_API_KEY,
    CLIENT_ID: twitter.config1.clientId || process.env.TWITTER_API_1_CLIENT_ID,
    CLIENT_SECRET: twitter.config1.clientSecret || process.env.TWITTER_API_1_CLIENT_SECRET,
    BEARER_TOKEN: twitter.config1.bearerToken || process.env.TWITTER_API_1_BEARER_TOKEN,
    ACCESS_TOKEN: twitter.config1.accessToken || process.env.TWITTER_API_1_ACCESS_TOKEN,
    ACCESS_TOKEN_SECRET: twitter.config1.accessTokenSecret || process.env.TWITTER_API_1_ACCESS_TOKEN_SECRET,
    API_BASE_URL: twitter.config1.baseUrl || process.env.TWITTER_API_1_BASE_URL || 'https://api.twitter.com/2'
};

/**
 * Secondary/backup Twitter API configuration object
 * Contains authentication credentials and API endpoint for the fallback Twitter API access
 * Used when primary API hits rate limits or experiences issues
 * Includes additional X_API_KEY_SECRET for enhanced security
 * @constant {Object} API_CONFIG2 
 */
const API_CONFIG2 = {
    X_API_KEY: twitter.config2.xApiKey || process.env.TWITTER_API_2_X_API_KEY,
    X_API_KEY_SECRET: twitter.config2.xApiKeySecret || process.env.TWITTER_API_2_X_API_KEY_SECRET,
    CLIENT_ID: twitter.config2.clientId || process.env.TWITTER_API_2_CLIENT_ID,
    CLIENT_SECRET: twitter.config2.clientSecret || process.env.TWITTER_API_2_CLIENT_SECRET,
    BEARER_TOKEN: twitter.config2.bearerToken || process.env.TWITTER_API_2_BEARER_TOKEN,
    ACCESS_TOKEN: twitter.config2.accessToken || process.env.TWITTER_API_2_ACCESS_TOKEN,
    ACCESS_TOKEN_SECRET: twitter.config2.accessTokenSecret || process.env.TWITTER_API_2_ACCESS_TOKEN_SECRET,
    API_BASE_URL: twitter.config2.baseUrl || process.env.TWITTER_API_2_BASE_URL || 'https://api.twitter.com/2'
};

// API keys for grok AI 
const API_CONFIG3 = {
    API_KEY: grokAi.apiKey || process.env.GROK_AI_API_KEY,
    API_BASE_URL: grokAi.baseUrl || process.env.GROK_AI_BASE_URL || 'https://api.grok.com/v1'
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

// Reduced minimum time between requests to 5 seconds
const MIN_REQUEST_INTERVAL = 5000;

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

// Helper function to get stored API configuration
async function getAPIConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['apiConfig1', 'apiConfig2', 'rateLimits', 'activeConfigNum'], (result) => {
            console.log('Stored API configs:', {
                hasConfig1: !!result.apiConfig1,
                hasConfig2: !!result.apiConfig2,
                hasRateLimits: !!result.rateLimits,
                activeConfigNum: result.activeConfigNum
            });
            
            // Initialize configs with fallback values if not found in storage
            const config1 = result.apiConfig1 || API_CONFIG;
            const config2 = result.apiConfig2 || API_CONFIG2;
            
            // Check if configs are valid
            const isConfig1Valid = !!(config1.BEARER_TOKEN && config1.API_BASE_URL);
            const isConfig2Valid = !!(config2.BEARER_TOKEN && config2.API_BASE_URL);
            
            console.log('API config validation:', {
                isConfig1Valid,
                isConfig2Valid
            });
            
            // If no valid configs, use hardcoded defaults as a last resort
            if (!isConfig1Valid && !isConfig2Valid) {
                console.warn('No valid configs found, using hardcoded defaults');
                resolve({
                    config: {
                        BEARER_TOKEN: '***REMOVED_BEARER_TOKEN***',
                        API_BASE_URL: 'https://api.twitter.com/2'
                    },
                    configNum: 1
                });
                return;
            }
            
            const limits = result.rateLimits || RATE_LIMITS;
            const config1Used = limits.config1?.readRequests.used || 0;
            const config2Used = limits.config2?.readRequests.used || 0;
            const config1Total = limits.config1?.readRequests.total || 50;
            const config2Total = limits.config2?.readRequests.total || 50;
            
            // If we're at the limit for both configs, use the one that resets sooner
            if (config1Used >= config1Total && config2Used >= config2Total) {
                const config1Reset = new Date(limits.config1.readRequests.resetDate);
                const config2Reset = new Date(limits.config2.readRequests.resetDate);
                
                resolve({
                    config: config1Reset < config2Reset ? config1 : config2,
                    configNum: config1Reset < config2Reset ? 1 : 2
                });
                return;
            }
            
            // If one config is at limit, use the other
            if (config1Used >= config1Total) {
                resolve({
                    config: config2,
                    configNum: 2
                });
                return;
            }
            
            if (config2Used >= config2Total) {
                resolve({
                    config: config1,
                    configNum: 1
                });
                return;
            }
            
            // Otherwise use the configured active config, or config1 as default
            const activeConfigNum = result.activeConfigNum || 1;
            resolve({
                config: activeConfigNum === 1 ? config1 : config2,
                configNum: activeConfigNum
            });
        });
    });
}

// Helper function for forced delay
async function forceDelay() {
    return new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL));
}

// Helper function to check rate limits for specific config
async function checkRateLimits(configNum) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['rateLimits'], (result) => {
            const configKey = `config${configNum}`;
            const limits = result.rateLimits && result.rateLimits[configKey] 
                ? result.rateLimits[configKey] 
                : RATE_LIMITS[configKey];
                
            const now = Date.now();

            // Reset counters if needed
            if (now >= new Date(limits.readRequests.resetDate)) {
                limits.readRequests.used = 0;
                limits.readRequests.resetDate = new Date().setMonth(new Date().getMonth() + 1);
                
                // Update storage
                const updatedLimits = result.rateLimits || RATE_LIMITS;
                updatedLimits[configKey] = limits;
                chrome.storage.local.set({ rateLimits: updatedLimits });
            }

            // Check if we've hit the rate limit
            if (limits.readRequests.used >= limits.readRequests.total) {
                reject(new Error(`Monthly rate limit exceeded for API config #${configNum}. Resets on ${new Date(limits.readRequests.resetDate).toLocaleDateString()}`));
                return;
            }

            // Always enforce the minimum delay
            resolve(limits);
        });
    });
}

// Function to update rate limit counter for specific config
async function incrementRateLimit(configNum) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['rateLimits'], (result) => {
            const configKey = `config${configNum}`;
            const updatedLimits = result.rateLimits || RATE_LIMITS;
            
            if (!updatedLimits[configKey]) {
                updatedLimits[configKey] = RATE_LIMITS[configKey];
            }
            
            updatedLimits[configKey].readRequests.used += 1;
            updatedLimits[configKey].readRequests.lastRequestTime = Date.now();
            
            chrome.storage.local.set({ rateLimits: updatedLimits }, () => resolve(updatedLimits[configKey].readRequests));
        });
    });
}

// Helper function to make authenticated requests to the Twitter API
async function makeAuthenticatedRequest(endpoint, method = 'GET', data = null) {
  try {
    // 1. Check rate limits and choose appropriate API config
    let { config, configNum } = await getAPIConfig();
    let limits = await checkRateLimits(configNum);
    
    // Log config information for debugging
    console.log('Making API request with config:', {
      configNum,
      baseUrl: config.API_BASE_URL,
      hasBearerToken: !!config.BEARER_TOKEN,
      endpoint
    });
    
    // 2. Enforce delay between requests
    await forceDelay();
    
    // 3. Prepare full URL - ensure correct API base URL
    const baseUrl = config.API_BASE_URL || 'https://api.twitter.com/2';
    const url = baseUrl + endpoint;
    console.log(`API Request (using config #${configNum}): ${url}`);
    
    // 4. Prepare request options with proper CORS handling
    const bearerToken = config.BEARER_TOKEN.trim();
    
    // Check if bearer token is URL encoded and decode if necessary
    let cleanedToken = bearerToken;
    if (bearerToken.includes('%')) {
      try {
        cleanedToken = decodeURIComponent(bearerToken);
      } catch (e) {
        console.warn('Error decoding bearer token, using as-is');
        cleanedToken = bearerToken;
      }
    }
    
    const headers = {
      'Authorization': `Bearer ${cleanedToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    const options = {
      method: method,
      headers: headers,
      mode: 'cors',
      credentials: 'omit'  // Important for CORS in extension context
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    // 5. Make the request with the first config
    let response;
    let success = false;
    let errorMessage = '';
    
    try {
      console.log(`Making API request to ${url} with options:`, {
        method: options.method,
        headerKeys: Object.keys(options.headers),
        mode: options.mode
      });
      
      // Add some randomness to bypass cache
      const cacheBuster = Date.now();
      const urlWithNoCacheParam = url.includes('?') ? 
        `${url}&_nocache=${cacheBuster}` : 
        `${url}?_nocache=${cacheBuster}`;
        
      response = await fetch(urlWithNoCacheParam, options);
      
      console.log('Response status:', response.status);
      
      // If response status is not ok, try to get error message
      if (!response.ok) {
        let responseText;
        try {
          responseText = await response.text();
          console.error(`Response error text: ${responseText}`);
          
          try {
            const errorBody = JSON.parse(responseText);
            errorMessage = errorBody.errors?.[0]?.message || errorBody.detail || `API error: ${response.status}`;
          } catch (jsonError) {
            errorMessage = `API error: ${response.status} - ${responseText}`;
          }
        } catch (e) {
          errorMessage = `API error: ${response.status}`;
          responseText = 'Could not read response text';
        }
        
        console.error(`API request failed with ${response.status}: ${errorMessage}`);
        console.error('Response headers:', {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          server: response.headers.get('server'),
          responseText
        });
        
        // Increment rate limit counter only for client errors
        if (response.status >= 400 && response.status < 500) {
          await incrementRateLimit(configNum);
        }
        
        // If rate limited or unauthorized, try with second config
        if ((response.status === 429 || response.status === 401 || response.status === 403) && configNum === 1) {
          console.log('Trying with second API config...');
          const isAvailable = await isConfig2Available();
          
          if (isAvailable) {
            // Get the second config and try again
            const configResult = await getAPIConfig();
            config = configResult.config;
            configNum = 2;
            
            // Clean the second token as well
            const secondBearerToken = config.BEARER_TOKEN.trim();
            let secondCleanedToken = secondBearerToken;
            if (secondBearerToken.includes('%')) {
              try {
                secondCleanedToken = decodeURIComponent(secondBearerToken);
              } catch (e) {
                console.warn('Error decoding second bearer token, using as-is');
                secondCleanedToken = secondBearerToken;
              }
            }
            
            headers.Authorization = `Bearer ${secondCleanedToken}`;
            options.headers = headers;
            
            console.log('Retrying with second config:', {
              baseUrl: config.API_BASE_URL,
              hasBearerToken: !!config.BEARER_TOKEN
            });
            
            response = await fetch(urlWithNoCacheParam, options);
            console.log('Second attempt response status:', response.status);

            if (!response.ok) {
              try {
                const errorResponseText = await response.text();
                console.error(`Second attempt response error text: ${errorResponseText}`);
                
                try {
                  const errorBody = JSON.parse(errorResponseText);
                  errorMessage = errorBody.errors?.[0]?.message || errorBody.detail || `API error: ${response.status}`;
                } catch (jsonError) {
                  errorMessage = `API error: ${response.status} - ${errorResponseText}`;
                }
              } catch (e) {
                errorMessage = `API error: ${response.status}`;
              }
              
              console.error(`Second API request failed with ${response.status}: ${errorMessage}`);
              await incrementRateLimit(configNum);
              throw new Error(errorMessage);
            } else {
              // Second request succeeded
              success = true;
            }
          } else {
            throw new Error(`API rate limit exceeded: ${errorMessage}`);
          }
        } else {
          throw new Error(errorMessage);
        }
      } else {
        // First request succeeded
        success = true;
      }
      
      // Process successful response
      if (success) {
        // Increment rate limit counter for successful requests
        await incrementRateLimit(configNum);
        
        try {
          const responseData = await response.json();
          
          // Get current rate limits
          const rateLimits = await new Promise(resolve => {
            chrome.storage.local.get(['rateLimits'], (data) => {
              resolve(data.rateLimits || RATE_LIMITS);
            });
          });
          
          // Add rate limit info to response
          const configKey = `config${configNum}`;
          const rateLimit = {
            used: rateLimits[configKey]?.readRequests.used || 0,
            total: rateLimits[configKey]?.readRequests.total || 50,
            resetDate: rateLimits[configKey]?.readRequests.resetDate || Date.now() + 2592000000, // Default: 30 days
            configNum: configNum
          };
          
          // Return formatted response
          return {
            success: true,
            data: responseData,
            rateLimit: rateLimit
          };
        } catch (jsonError) {
          console.error('Error parsing JSON response:', jsonError);
          throw new Error('Failed to parse API response');
        }
      }
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('API Request Error:', error);
    
    // Return formatted error response
    return {
      success: false,
      error: error.message || 'Unknown API error',
      errorDetails: error.stack
    };
  }
}

// Helper function to check if config2 is available and not rate limited
async function isConfig2Available() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['rateLimits', 'apiConfig2'], (data) => {
            if (!data.apiConfig2 || !data.apiConfig2.BEARER_TOKEN) {
                resolve(false);
                return;
            }
            
            const limits = data.rateLimits?.config2?.readRequests;
            if (!limits) {
                resolve(true);
                return;
            }
            
            resolve(limits.used < limits.total);
        });
    });
}

// Helper function to check if config1 is available and not rate limited
async function isConfig1Available() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['rateLimits', 'apiConfig1'], (data) => {
            if (!data.apiConfig1 || !data.apiConfig1.BEARER_TOKEN) {
                resolve(false);
                return;
            }
            
            const limits = data.rateLimits?.config1?.readRequests;
            if (!limits) {
                resolve(true);
                return;
            }
            
            resolve(limits.used < limits.total);
        });
    });
}

function analyzePostingStrategy(userData, tweets) {
    const strategy = {
        contentTypes: {
            text: 0,
            media: 0,
            links: 0
        },
        recommendations: []
    };

    // Simple content type analysis
    tweets.forEach(tweet => {
        if (tweet.entities?.urls?.length > 0) strategy.contentTypes.links++;
        if (tweet.attachments?.media_keys?.length > 0 || 
            tweet.entities?.media?.length > 0) strategy.contentTypes.media++;
        else strategy.contentTypes.text++;
    });

    // Basic recommendations based on follower count
    const followers = userData.public_metrics?.followers_count || 0;

    if (followers < 1000) {
        strategy.recommendations = [
            "Engage with conversations in your niche",
            "Use 1-2 relevant hashtags per post",
            "Focus on consistent daily posting"
        ];
    } else if (followers < 10000) {
        strategy.recommendations = [
            "Create more original content",
            "Balance engagement with content creation",
            "Build your unique voice"
        ];
    } else {
        strategy.recommendations = [
            "Leverage your audience for partnerships",
            "Maintain consistent brand messaging",
            "Experiment with different content formats"
        ];
    }

    return strategy;
}

/**
 * Calculates the engagement rate for a collection of tweets
 * Engagement rate = (total engagements / (total tweets * 100)) * 100
 * @param {Array} tweets - Array of tweet objects containing public_metrics
 * @returns {string} Engagement rate as a percentage with 2 decimal places
 */
function calculateEngagementRate(tweets) {
    if (!tweets || tweets.length === 0) return "0.00";
    
    let totalEngagement = 0;
    let totalPossibleEngagement = 0;
    
    tweets.forEach(tweet => {
        const metrics = tweet.public_metrics || {};
        // Sum of likes, retweets, and replies represents total engagement
        totalEngagement += (metrics.like_count || 0) + 
                         (metrics.retweet_count || 0) + 
                         (metrics.reply_count || 0);
        totalPossibleEngagement += 1; // Each tweet represents an engagement opportunity
    });
    
    return ((totalEngagement / (totalPossibleEngagement * 100)) * 100).toFixed(2);
}

/**
 * Analyzes tweets to determine the most effective posting times
 * Groups tweets by hour and calculates average engagement for each hour
 * @param {Array} tweets - Array of tweet objects with created_at and public_metrics
 * @returns {Array} Top 3 hours with highest average engagement
 */
function calculateBestPostingTimes(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    // Create hourly engagement tracking object
    const hourlyEngagement = {};
    
    tweets.forEach(tweet => {
        if (!tweet.created_at) return;
        
        const hour = new Date(tweet.created_at).getHours();
        const metrics = tweet.public_metrics || {};
        const engagement = (metrics.like_count || 0) + 
                         (metrics.retweet_count || 0) + 
                         (metrics.reply_count || 0);
        
        // Initialize hour data if not exists
        if (!hourlyEngagement[hour]) {
            hourlyEngagement[hour] = { total: 0, count: 0 };
        }
        
        // Accumulate engagement data
        hourlyEngagement[hour].total += engagement;
        hourlyEngagement[hour].count += 1;
    });
    
    // Transform and sort by average engagement
    return Object.entries(hourlyEngagement)
        .map(([hour, data]) => ({
            hour,
            average_engagement: (data.total / data.count).toFixed(1)
        }))
        .sort((a, b) => b.average_engagement - a.average_engagement)
        .slice(0, 3); // Return top 3 performing hours
}

/**
 * Identifies the top performing tweets based on total engagement
 * @param {Array} tweets - Array of tweet objects with public_metrics
 * @returns {Array} Top 3 tweets with highest engagement
 */
function getTopPerformingContent(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    // Calculate total engagement for each tweet
    const tweetsWithEngagement = tweets.map(tweet => {
        const metrics = tweet.public_metrics || {};
        const engagement = (metrics.like_count || 0) + 
                         (metrics.retweet_count || 0) + 
                         (metrics.reply_count || 0);
        
        return {
            text: tweet.text,
            engagement,
            created_at: tweet.created_at
        };
    });
    
    // Return top 3 tweets by engagement
    return tweetsWithEngagement
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 3);
}

/**
 * Aggregates all analytics calculations for a set of tweets
 * @param {Array} tweets - Array of tweet objects
 * @returns {Object} Combined analytics including engagement rate, posting times, and top content
 */
function calculateAnalytics(tweets) {
    return {
        engagement_rate: calculateEngagementRate(tweets),
        best_posting_times: calculateBestPostingTimes(tweets),
        top_performing_content: getTopPerformingContent(tweets)
    };
}

/**
 * Get user data from Twitter API or cache
 * @param {string} username - Twitter username without @ symbol
 * @returns {Promise<Object>} - User data response
 */
async function getUserData(username) {
    try {
        console.log(`Getting user data for: ${username}`);
        
        if (!username || typeof username !== 'string') {
            return {
                success: false,
                error: 'Invalid username provided',
                errorDetails: 'Username must be a non-empty string'
            };
        }

        // Get settings
        const settings = await getSettings();

        // Check if this username is in cache
        const cacheKey = `profile_${username.toLowerCase()}`;
        const cachedData = await new Promise(resolve => {
            chrome.storage.local.get([cacheKey], result => {
                resolve(result[cacheKey]);
            });
        });

        // Return cached data if it exists and is not expired
        if (cachedData && settings.cacheEnabled) {
            const now = Date.now();
            const cacheAge = now - cachedData.timestamp;
            
            // Cache is valid for 24 hours (86400000 ms)
            if (cacheAge < 86400000) {
                console.log(`Returning cached data for ${username}, age: ${Math.round(cacheAge / 60000)} minutes`);
                
                // Set the fromCache flag to let UI know
                cachedData.fromCache = true;
                return {
                    success: true,
                    ...cachedData
                };
            } else {
                console.log(`Cache expired for ${username}, fetching fresh data`);
            }
        } else {
            console.log(`No cache found for ${username} or cache disabled, fetching fresh data`);
        }

        // Fetch user data from API
        try {
            console.log(`Fetching user data for ${username} from Twitter API`);
            
            // Get API config first
            const { config, configNum } = await getAPIConfig();
            
            // Log the config being used
            console.log('Using API config:', {
                configNum,
                baseUrl: config.API_BASE_URL,
                hasBearerToken: !!config.BEARER_TOKEN,
                bearerTokenFirst15Chars: config.BEARER_TOKEN ? config.BEARER_TOKEN.substring(0, 15) + '...' : 'none'
            });
            
            // Prepare the request options
            const headers = {
                'Authorization': `Bearer ${config.BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            };
            
            const options = {
                method: 'GET',
                headers
            };
            
            // Use direct fetch for user data instead of makeAuthenticatedRequest for better debugging
            const userUrl = `${config.API_BASE_URL}/users/by/username/${username}?user.fields=public_metrics,description,profile_image_url,created_at,verified`;
            console.log(`Fetching from URL: ${userUrl}`);
            
            // Add unique timestamp to avoid caching issues
            const cacheBuster = Date.now();
            const userUrlNoCached = `${userUrl}&_nocache=${cacheBuster}`;
            
            // Fetch user data
            const userResponse = await fetch(userUrlNoCached, options);
            
            if (!userResponse.ok) {
                const statusText = userResponse.statusText;
                let errorText = '';
                
                try {
                    errorText = await userResponse.text();
                    console.error(`Error response from Twitter API: ${errorText}`);
                } catch (e) {
                    console.error('Could not read error response text');
                }
                
                // If we get an error, try the second config if available
                if ((userResponse.status === 429 || userResponse.status === 401 || userResponse.status === 403) && configNum === 1) {
                    console.log('First config failed, trying second config...');
                    
                    const isConfig2Available = await new Promise(resolve => {
                        chrome.storage.local.get(['rateLimits'], data => {
                            const limits = data.rateLimits || RATE_LIMITS;
                            const config2Used = limits.config2?.readRequests.used || 0;
                            const config2Total = limits.config2?.readRequests.total || 50;
                            resolve(config2Used < config2Total);
                        });
                    });
                    
                    if (isConfig2Available) {
                        const config2Result = await getAPIConfig(true);
                        const config2 = config2Result.config;
                        
                        const headers2 = {
                            'Authorization': `Bearer ${config2.BEARER_TOKEN}`,
                            'Content-Type': 'application/json'
                        };
                        
                        const options2 = {
                            method: 'GET',
                            headers: headers2
                        };
                        
                        console.log('Trying with second config:', {
                            baseUrl: config2.API_BASE_URL,
                            hasBearerToken: !!config2.BEARER_TOKEN
                        });
                        
                        const userResponse2 = await fetch(userUrlNoCached, options2);
                        
                        if (!userResponse2.ok) {
                            const status2 = userResponse2.status;
                            const statusText2 = userResponse2.statusText;
                            let errorText2 = '';
                            
                            try {
                                errorText2 = await userResponse2.text();
                                console.error(`Error response from second config: ${errorText2}`);
                            } catch (e) {
                                console.error('Could not read error response text for second config');
                            }
                            
                            await incrementRateLimit(2);
                            throw new Error(`API error (config2): ${status2} ${statusText2} - ${errorText2}`);
                        }
                        
                        // Parse the response from the second config
                        const userData2 = await userResponse2.json();
                        await incrementRateLimit(2);
                        
                        if (!userData2.data) {
                            throw new Error('User not found or API returned invalid data (config2)');
                        }
                        
                        // Second config success - proceed with this data
                        return await processUserData(userData2, username, config2, 2);
                    } else {
                        throw new Error(`API error (config1): ${userResponse.status} ${statusText} - ${errorText}`);
                    }
                } else {
                    throw new Error(`API error: ${userResponse.status} ${statusText} - ${errorText}`);
                }
            }

            // Parse the response
            const userData = await userResponse.json();
            await incrementRateLimit(configNum);
            
            if (!userData.data) {
                throw new Error('User not found or API returned invalid data');
            }
            
            // Continue with processing
            return await processUserData(userData, username, config, configNum);
        } catch (apiError) {
            console.error(`API error fetching data for ${username}:`, apiError);
            
            // Create a detailed error response with accurate error information
            const errorResponse = {
                success: false,
                error: apiError.message || 'Error fetching profile data',
                errorDetails: apiError.stack,
                errorCode: apiError.code || 'UNKNOWN_ERROR'
            };
            
            // Get current rate limits
            const rateLimits = await new Promise(resolve => {
                chrome.storage.local.get(['rateLimits'], (data) => {
                    resolve(data.rateLimits || RATE_LIMITS);
                });
            });
            
            // Add rate limit info
            const config1 = rateLimits.config1?.readRequests || { used: 0, total: 50 };
            const config2 = rateLimits.config2?.readRequests || { used: 0, total: 50 };
            errorResponse.rateLimit = {
                used: config1.used + config2.used,
                total: config1.total + config2.total,
                resetDate: Math.min(
                    config1.resetDate || Date.now() + 2592000000,
                    config2.resetDate || Date.now() + 2592000000
                )
            };
            
            // Attempt to get fallback data from cache even if it's expired
            try {
                const cachedData = await new Promise(resolve => {
                    chrome.storage.local.get([cacheKey], result => {
                        resolve(result[cacheKey]);
                    });
                });
                
                if (cachedData) {
                    console.log(`Using expired cache data for ${username} as fallback`);
                    cachedData.fromCache = true;
                    cachedData.usingExpiredCache = true;
                    return {
                        success: true,
                        ...cachedData,
                        error: errorResponse.error,
                        errorDetails: errorResponse.errorDetails
                    };
                }
            } catch (cacheError) {
                console.error('Error retrieving from cache:', cacheError);
            }
            
            return errorResponse;
        }
    } catch (error) {
        console.error(`Unexpected error in getUserData for ${username}:`, error);
        return {
            success: false,
            error: 'An unexpected error occurred',
            errorDetails: error.message
        };
    }
}

/**
 * Process user data from Twitter API
 * @param {Object} userData - User data from API
 * @param {string} username - Username
 * @param {Object} config - API config used
 * @param {number} configNum - Config number
 * @returns {Promise<Object>} - Processed data
 */
async function processUserData(userData, username, config, configNum) {
    try {
        // Fetch tweets for the user
        console.log(`Fetching tweets for user ID ${userData.data.id}`);
        
        // Prepare headers
        const headers = {
            'Authorization': `Bearer ${config.BEARER_TOKEN}`,
            'Content-Type': 'application/json'
        };
        
        const options = {
            method: 'GET',
            headers
        };
        
        let tweetsData = { data: [] };
        
        try {
            const tweetsUrl = `${config.API_BASE_URL}/users/${userData.data.id}/tweets?max_results=10&tweet.fields=public_metrics,created_at,entities,attachments&expansions=attachments.media_keys`;
            const cacheBuster = Date.now();
            const tweetsUrlNoCached = `${tweetsUrl}&_nocache=${cacheBuster}`;
            
            const tweetsResponse = await fetch(tweetsUrlNoCached, options);
            
            if (tweetsResponse.ok) {
                tweetsData = await tweetsResponse.json();
                console.log(`Retrieved ${tweetsData.data?.length || 0} tweets for ${username}`);
            } else {
                console.warn(`Failed to fetch tweets for ${username}: ${tweetsResponse.status} ${tweetsResponse.statusText}`);
                // Continue without tweets
            }
        } catch (tweetsError) {
            console.warn('Failed to fetch tweets, but continuing with user data only:', tweetsError);
        }
        
        // Get settings
        const settings = await getSettings();
        
        // Add Grok analysis if enabled
        let grokAnalysis = null;
        
        if (settings.grokEnabled) {
            try {
                grokAnalysis = await analyzeProfileWithGrok(
                    userData.data, 
                    tweetsData.data || []
                );
            } catch (grokError) {
                console.error('Grok analysis failed, but continuing:', grokError);
                // Continue without Grok analysis
            }
        }
        
        // Calculate engagement rate if we have tweets
        let engagementRate = 0;
        let bestPostingTimes = [];
        let topPerformingContent = [];
        
        if (tweetsData.data && tweetsData.data.length > 0) {
            engagementRate = calculateEngagementRate(tweetsData.data);
            bestPostingTimes = calculateBestPostingTimes(tweetsData.data);
            topPerformingContent = getTopPerformingContent(tweetsData.data);
        }
        
        // Determine posting strategy
        const strategy = analyzePostingStrategy(
            userData.data,
            tweetsData.data || []
        );
        
        // Calculate complete analytics
        const analytics = calculateAnalytics(tweetsData.data || []);
        analytics.engagement_rate = engagementRate;
        analytics.best_posting_times = bestPostingTimes;
        analytics.top_performing_content = topPerformingContent;
        
        // Get rate limits
        const rateLimits = await new Promise(resolve => {
            chrome.storage.local.get(['rateLimits'], (data) => {
                resolve(data.rateLimits || RATE_LIMITS);
            });
        });
        
        // Add rate limit info to response
        const configKey = `config${configNum}`;
        const rateLimit = {
            used: rateLimits[configKey]?.readRequests.used || 0,
            total: rateLimits[configKey]?.readRequests.total || 50,
            resetDate: rateLimits[configKey]?.readRequests.resetDate || Date.now() + 2592000000,
            configNum: configNum
        };
        
        // Combined response
        const result = {
            success: true,
            data: {
                user: userData.data,
                tweets: tweetsData.data || [],
                analytics: analytics,
                strategy: strategy,
                grokAnalysis: grokAnalysis
            },
            rateLimit: rateLimit,
            timestamp: Date.now(),
            fromCache: false
        };
        
        // Cache the result
        if (settings.cacheEnabled) {
            const cacheKey = `profile_${username.toLowerCase()}`;
            chrome.storage.local.set({ [cacheKey]: result });
            console.log(`Cached profile data for ${username}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error processing user data:', error);
        throw error;
    }
}

// Helper function to provide mock user data when needed
function getMockUserData(username) {
    console.log(`Generating mock data for ${username}`);
    
    // Create a basic user object with the username
    const user = {
        id: '123456789',
        name: username.startsWith('@') ? username.substring(1) : username,
        username: username.startsWith('@') ? username.substring(1) : username,
        description: `This is a mock profile for ${username}. Using sample data because the API is unavailable.`,
        public_metrics: {
            followers_count: Math.floor(Math.random() * 5000) + 500,
            following_count: Math.floor(Math.random() * 2000) + 200,
            tweet_count: Math.floor(Math.random() * 15000) + 1000,
            listed_count: Math.floor(Math.random() * 50) + 5
        }
    };
    
    // Generate mock tweets
    const tweets = [];
    const topics = ['tech', 'AI', 'marketing', 'social media', 'growth', 'career'];
    
    for (let i = 0; i < 10; i++) {
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const likes = Math.floor(Math.random() * 100) + 5;
        const retweets = Math.floor(Math.random() * 20) + 1;
        const replies = Math.floor(Math.random() * 10) + 1;
        
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        tweets.push({
            id: `mock_${i}_${Date.now()}`,
            text: `This is a sample tweet about ${topic} for demo purposes. #${topic.replace(' ', '')} #xanalyzer`,
            created_at: date.toISOString(),
            public_metrics: {
                like_count: likes,
                retweet_count: retweets,
                reply_count: replies,
                quote_count: Math.floor(Math.random() * 5)
            },
            entities: {
                hashtags: [
                    { tag: topic.replace(' ', '') },
                    { tag: 'xanalyzer' }
                ]
            },
            attachments: i % 3 === 0 ? { media_keys: ['mock_media'] } : undefined
        });
    }
    
    return {
        user,
        tweets,
        analytics: calculateAnalytics(tweets),
        strategy: analyzePostingStrategy(user, tweets),
        grokAnalysis: {
            engagementInsights: "Mock insights: Post consistently about industry topics. Use hashtags strategically. Engage with followers.",
            growthStrategy: "Mock strategy: Focus on quality content that provides value to your audience. Use Twitter's features like Spaces and Lists."
        },
        rateLimit: {
            used: 0,
            total: 100,
            resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000).getTime()
        },
        configUsed: 'mock',
        fromCache: false,
        isMockData: true
    };
}

// Function to clear the profile cache
function clearCache() {
    profileCache.clear();
    console.log('Cache cleared');
    return true;
}

// Function to switch between API configurations
function switchAPIConfig(configNum) {
    return new Promise((resolve) => {
        activeConfigNum = configNum === 1 ? 1 : 2;
        chrome.storage.local.set({ activeConfigNum }, () => {
            console.log(`Switched to API configuration #${activeConfigNum}`);
            resolve(true);
        });
    });
}

// Add after your existing functions in background.js (before the chrome.runtime.onMessage.addListener block)

async function analyzeProfileWithGrok(userData, tweets) {
    try {
      // Prepare the data for Grok analysis
      const profileData = {
        user: userData,
        recentTweets: tweets.map(tweet => ({
          text: tweet.text,
          created_at: tweet.created_at,
          public_metrics: tweet.public_metrics,
          hasMedia: !!tweet.attachments?.media_keys?.length,
          hasLinks: !!tweet.entities?.urls?.length
        }))
      };
      
      // Get detailed engagement analysis
      const engagementAnalysis = await grokService.analyzeContent(
        profileData, 
        'engagement',
        { detailLevel: 'standard' }
      );
      
      // Get growth strategy recommendations
      const growthAnalysis = await grokService.analyzeContent(
        profileData, 
        'growth',
        { detailLevel: 'basic' }
      );
      
      // Return combined analysis results
      return {
        success: engagementAnalysis.success && growthAnalysis.success,
        engagementInsights: engagementAnalysis.success ? engagementAnalysis.analysis : null,
        growthStrategy: growthAnalysis.success ? growthAnalysis.analysis : null,
        tokenUsage: engagementAnalysis.tokenUsage?.overall || null,
        error: engagementAnalysis.error || growthAnalysis.error
      };
    } catch (error) {
      console.error('Failed to analyze with Grok:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async function compareWithSuccessfulProfile(username, successfulUsername) {
    try {
      // Get user data
      const userData = await getUserData(username);
      
      // Get successful profile data
      const successfulUserData = await getUserData(successfulUsername);
      
      // Run comparison analysis
      const comparison = await grokService.compareContent(
        {
          user: userData.user,
          recentTweets: userData.tweets
        },
        {
          user: successfulUserData.user,
          recentTweets: successfulUserData.tweets
        }
      );
      
      return {
        success: comparison.success,
        comparison: comparison.success ? comparison.analysis : null,
        metrics: comparison.metrics,
        tokenUsage: comparison.tokenUsage
      };
    } catch (error) {
      console.error('Comparison failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Settings management functions
  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['xtractSettings'], (result) => {
        if (result.xtractSettings) {
          resolve(result.xtractSettings);
        } else {
          resolve(getDefaultSettings());
        }
      });
    });
  }
  
  function getDefaultSettings() {
    return {
      grokEnabled: true,
      tokenLimit: 1000000,
      defaultDetailLevel: 'standard',
      cacheEnabled: true,
      cacheDuration: 86400000 // 24 hours
    };
  }
  
  async function saveSettings(settings) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ xtractSettings: settings }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            // Update grokService cache configuration if needed
            if (settings.cacheEnabled !== undefined || settings.cacheDuration !== undefined) {
              grokService.configureCaching({
                enabled: settings.cacheEnabled,
                maxAge: settings.cacheDuration
              });
            }
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  async function resetSettingsToDefault() {
    const defaultSettings = getDefaultSettings();
    return saveSettings(defaultSettings);
  }

/**
 * Updates the extension badge with analysis status
 * @param {string} text - Badge text
 * @param {string} backgroundColor - Badge background color
 */
function updateBadge(text, backgroundColor = '#1DA1F2') {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: backgroundColor });
}

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('Extension installed or updated:', details.reason);
    initializeExtension();
});

// Also initialize on startup
chrome.runtime.onStartup.addListener(function() {
    console.log('Extension starting up');
    initializeExtension();
});

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
        
        console.log('Initialization complete');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background message received:', request.action);
    
    if (request.action === 'analyzeProfile') {
        console.log('Analyze profile request received for username:', request.username);
        
        // Debug API keys directly using the imported values
        console.log('API Keys Debug Information:', {
            twitterConfig1: {
                baseUrl: API_CONFIG.API_BASE_URL || 'undefined',
                bearerTokenExists: !!API_CONFIG.BEARER_TOKEN,
                bearerTokenFirstChars: API_CONFIG.BEARER_TOKEN ? `${API_CONFIG.BEARER_TOKEN.substring(0, 15)}...` : 'undefined',
                xApiKeyExists: !!API_CONFIG.X_API_KEY,
            },
            twitterConfig2: {
                baseUrl: API_CONFIG2.API_BASE_URL || 'undefined',
                bearerTokenExists: !!API_CONFIG2.BEARER_TOKEN,
                bearerTokenFirstChars: API_CONFIG2.BEARER_TOKEN ? `${API_CONFIG2.BEARER_TOKEN.substring(0, 15)}...` : 'undefined',
                xApiKeyExists: !!API_CONFIG2.X_API_KEY,
            }
        });
        
        // Start API request
        getUserData(request.username)
            .then(result => {
                console.log('Analysis result for', request.username, ':', result);
                
                // If the request succeeded directly
                if (result && result.success) {
                    sendResponse({
                        success: true,
                        data: result.data,
                        fromCache: result.fromCache,
                        rateLimit: result.rateLimit
                    });
                    
                    // Update badge to indicate successful analysis
                    updateBadge('', '#4CAF50');
                } else {
                    console.warn('API request failed:', result?.error || 'Unknown error');
                    
                    // Get current rate limits to include in the response
                    chrome.storage.local.get(['rateLimits'], (data) => {
                        const limits = data.rateLimits || RATE_LIMITS;
                        const config1 = limits.config1?.readRequests || { used: 0, total: 50 };
                        const config2 = limits.config2?.readRequests || { used: 0, total: 50 };
                        
                        // Generate fallback data
                        const fallbackData = generateFallbackData(request.username);
                        
                        sendResponse({
                            success: false,
                            error: result?.error || 'Unknown error fetching profile data',
                            errorDetails: result?.errorDetails || 'No additional details available',
                            // Include fallback data
                            data: fallbackData,
                            rateLimit: result?.rateLimit || {
                                used: config1.used + config2.used,
                                total: config1.total + config2.total,
                                resetDate: Math.min(
                                    config1.resetDate || Date.now() + 2592000000,
                                    config2.resetDate || Date.now() + 2592000000
                                )
                            }
                        });
                    });
                    
                    // Update badge to indicate error
                    updateBadge('!', '#F44336');
                    return true; // Keep the sendResponse function valid
                }
            })
            .catch(error => {
                console.error('Error in analyzeProfile handler:', error);
                
                // Generate fallback data
                const fallbackData = generateFallbackData(request.username);
                
                // Create a robust error response that won't crash the UI
                sendResponse({
                    success: false,
                    error: error.message || 'Failed to analyze profile',
                    data: fallbackData
                });
                
                // Update badge to indicate error
                updateBadge('!', '#F44336');
            });
        
        return true; // Keep sendResponse valid for async operation
    }
    else if (request.action === 'clearCache') {
        const success = clearCache();
        sendResponse({
            success: success
        });
        return false;
    }
    else if (request.action === 'switchAPIConfig') {
        switchAPIConfig(request.configNum)
            .then(success => {
                sendResponse({
                    success: success,
                    configNum: request.configNum
                });
            });
        return true;
    }
    else if (request.action === 'getRateLimits') {
        chrome.storage.local.get(['rateLimits'], (data) => {
            sendResponse({
                success: true,
                rateLimits: data.rateLimits || RATE_LIMITS
            });
        });
        return true;
    }
    
    // New event listeners for enhanced functionality
    else if (request.action === 'compareProfiles') {
        compareWithSuccessfulProfile(request.username, request.successfulUsername)
            .then(result => {
                sendResponse({
                    success: true,
                    data: result
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
    
    else if (request.action === 'getSettings') {
        getSettings()
            .then(settings => {
                sendResponse({
                    success: true,
                    settings
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
    
    else if (request.action === 'saveSettings') {
        saveSettings(request.settings)
            .then(() => {
                sendResponse({
                    success: true
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
    
    else if (request.action === 'resetSettings') {
        resetSettingsToDefault()
            .then(() => {
                sendResponse({
                    success: true
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
    
    else if (request.action === 'getTokenStats') {
        grokService.checkTokenAvailability(0)
            .then(tokenInfo => {
                sendResponse({
                    success: true,
                    stats: {
                        used: tokenInfo.used,
                        remaining: tokenInfo.remaining,
                        limit: tokenInfo.limit,
                        resetDate: tokenInfo.resetDate,
                        history: tokenInfo.usageStats.usageHistory,
                        cacheSavings: tokenInfo.usageStats.cacheSavings || 0
                    }
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
    
    else if (request.action === 'clearAnalysisCache') {
        grokService.clearAnalysisCache()
            .then(() => {
                sendResponse({
                    success: true
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
            });
        });
        return true;
    }
    
    // Add handler to test API keys
    else if (request.action === 'testApiKey') {
        // Use an immediately invoked async function expression to handle async operations
        (async function() {
            try {
                console.log('Testing Twitter API keys...');
                
                // Test config 1
                const config1Result = await testTwitterApiKey(API_CONFIG, 1);
                console.log('Config 1 test result:', config1Result);
                
                // Test config 2
                const config2Result = await testTwitterApiKey(API_CONFIG2, 2);
                console.log('Config 2 test result:', config2Result);
                
                // Return both results
                sendResponse({
                    config1Result,
                    config2Result
                });
            } catch (error) {
                console.error('Error testing API keys:', error);
                sendResponse({
                    success: false,
                    error: error.message || 'Unknown error testing API keys'
                });
            }
        })();
        return true; // Keep channel open for async response
    }
});

/**
 * Generate fallback data for a username
 * @param {string} username - The username
 * @returns {Object} - Fallback data structure
 */
function generateFallbackData(username) {
    // Generate random follower counts in a reasonable range
    const followers = Math.floor(Math.random() * 10000) + 500;
    const following = Math.floor(Math.random() * 1000) + 100;
    const tweets = Math.floor(Math.random() * 5000) + 200;
    const engagement = Math.floor(Math.random() * 10) + 1;
    
    return {
        user: {
            username: username,
            name: username,
            description: `This is fallback data for ${username}. The API request failed, so we're showing estimated data.`,
            profile_image_url: `https://unavatar.io/twitter/${username}`,
            public_metrics: {
                followers_count: followers,
                following_count: following,
                tweet_count: tweets,
                listed_count: Math.floor(followers / 100)
            },
            verified: false
        },
        tweets: [],
        analytics: {
            engagement_rate: engagement,
            best_posting_times: [
                { day: 'Monday', hour: '10-11 AM' },
                { day: 'Wednesday', hour: '2-3 PM' },
                { day: 'Friday', hour: '6-7 PM' }
            ],
            top_performing_content: [
                { type: 'hashtag', value: 'technology' },
                { type: 'hashtag', value: 'innovation' },
                { type: 'hashtag', value: 'ai' }
            ]
        },
        strategy: {
            summary: 'Regular posting with varied content types',
            recommendations: [
                'Post consistently',
                'Engage with your audience',
                'Use hashtags strategically',
                'Share visual content'
            ]
        },
        grokAnalysis: {
            engagementInsights: [
                'Posts with images receive higher engagement',
                'Questions tend to generate more replies',
                'Weekday mornings show better performance',
                'Content about trending topics performs well'
            ],
            growthStrategy: [
                'Increase posting frequency',
                'Engage with larger accounts in your niche',
                'Use more compelling visuals',
                'Create thread-style content for in-depth topics'
            ]
        }
    };
}

/**
 * Test Twitter API keys directly with better error handling and CORS compliance
 * @param {Object} config - API configuration to test
 * @param {number} configNum - Config number (1 or 2)
 * @returns {Promise<Object>} - Test results
 */
async function testTwitterApiKey(config, configNum) {
  console.log(`Testing Twitter API key config #${configNum}`);
  
  try {
    // Log configuration details (safely)
    console.log(`Config ${configNum} details:`, {
      baseUrl: config.API_BASE_URL || 'https://api.twitter.com/2',
      bearerTokenExists: !!config.BEARER_TOKEN,
      bearerTokenLength: config.BEARER_TOKEN ? config.BEARER_TOKEN.length : 0,
      bearerTokenFirstChars: config.BEARER_TOKEN ? `${config.BEARER_TOKEN.substring(0, 5)}...` : 'undefined'
    });
    
    // Set timeout for the entire test process
    const testPromise = new Promise(async (resolve, reject) => {
      try {
        // Clean and decode the bearer token if needed
        const bearerToken = config.BEARER_TOKEN?.trim() || '';
        let cleanedToken = bearerToken;
        
        if (bearerToken.includes('%')) {
          try {
            cleanedToken = decodeURIComponent(bearerToken);
          } catch (e) {
            console.warn('Error decoding bearer token, using as-is', e);
          }
        }
        
        // Start with a simple endpoint that doesn't require user authorization
        const baseUrl = config.API_BASE_URL || 'https://api.twitter.com/2';
        const testUrl = `${baseUrl}/tweets?ids=1228393702244134912`;
        
        // Prepare headers - use only what's absolutely needed
        const headers = {
          'Authorization': `Bearer ${cleanedToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        
        const options = {
          method: 'GET',
          headers: headers,
          // Important for CORS in browser extensions
          credentials: 'omit',
          mode: 'cors',
          cache: 'no-store'
        };
        
        console.log(`Sending test request to ${testUrl} with options:`, {
          method: options.method,
          headerKeys: Object.keys(options.headers),
          mode: options.mode,
          authorization: headers.Authorization ? 'Bearer ***' : 'None'
        });
        
        // Add a cache-busting parameter
        const cacheBuster = Date.now();
        const urlWithNoCacheParam = testUrl.includes('?') ? 
          `${testUrl}&_nocache=${cacheBuster}` : 
          `${testUrl}?_nocache=${cacheBuster}`;
        
        // Make the request
        const response = await fetch(urlWithNoCacheParam, options);
        
        // Check if the request was successful
        if (response.ok) {
          // Parse the JSON response
          const data = await response.json();
          console.log(`API key test successful for config #${configNum}:`, data);
          
          resolve({
            success: true,
            data: {
              id: data.data?.[0]?.id || 'unknown',
              text: data.data?.[0]?.text?.substring(0, 20) + '...' || 'Data received'
            },
            configNum: configNum
          });
        } else {
          // Parse the error response
          let errorText = 'Unknown error';
          try {
            errorText = await response.text();
          } catch (e) {
            console.error('Could not read error response text');
          }
          
          // Log the error
          console.error(`API key test failed for config #${configNum}:`, {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText?.substring(0, 100) // Limit error text length
          });
          
          // If we get a 401 or 403, the token is likely invalid
          if (response.status === 401 || response.status === 403) {
            resolve({
              success: false,
              error: `API key authentication failed: ${response.status} ${response.statusText}`,
              errorDetails: `Your API key may be invalid or expired. Please check your credentials.`,
              configNum: configNum
            });
          } else {
            // For other errors, return a generic message
            resolve({
              success: false,
              error: `API request failed: ${response.status} ${response.statusText}`,
              errorDetails: errorText?.substring(0, 200) || 'No detailed error information available',
              configNum: configNum
            });
          }
        }
      } catch (error) {
        // Handle any errors that occur during the fetch
        console.error(`API key test error for config #${configNum}:`, error);
        
        // Check for network errors
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          resolve({
            success: false,
            error: 'Network error: Failed to connect to Twitter API',
            errorDetails: 'This may be due to network connectivity issues or CORS restrictions. Try refreshing the extension.',
            configNum: configNum
          });
        } else {
          // For other errors
          resolve({
            success: false,
            error: error.message || 'Unknown error',
            errorDetails: error.stack ? error.stack.substring(0, 200) : 'No error details available',
            configNum: configNum
          });
        }
      }
    });
    
    // Set a timeout for the entire process
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API request timed out after 10 seconds')), 10000);
    });
    
    // Race the test against the timeout
    return await Promise.race([testPromise, timeoutPromise]);
    
  } catch (error) {
    // Catch any uncaught errors
    console.error(`Uncaught error in testTwitterApiKey for config #${configNum}:`, error);
    return {
      success: false,
      error: 'An unexpected error occurred while testing the API',
      errorDetails: error.message || 'No error details available',
      configNum: configNum
    };
  }
}