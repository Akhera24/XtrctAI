// Import the grokService module using ES modules syntax
import * as grokService from './grokService.js';
import { iconManager } from './iconManager.js';

/**
 * Primary Twitter API configuration object
 * Contains authentication credentials and API endpoint for the main Twitter API access
 * Used for primary API requests and authentication flows
 * @constant {Object} API_CONFIG
 */
const API_CONFIG = {
    X_API_KEY: process.env.TWITTER_API_1_X_API_KEY,
    CLIENT_ID: process.env.TWITTER_API_1_CLIENT_ID,
    CLIENT_SECRET: process.env.TWITTER_API_1_CLIENT_SECRET,
    BEARER_TOKEN: process.env.TWITTER_API_1_BEARER_TOKEN,
    ACCESS_TOKEN: process.env.TWITTER_API_1_ACCESS_TOKEN,
    ACCESS_TOKEN_SECRET: process.env.TWITTER_API_1_ACCESS_TOKEN_SECRET,
    API_BASE_URL: process.env.TWITTER_API_1_BASE_URL
};

/**
 * Secondary/backup Twitter API configuration object
 * Contains authentication credentials and API endpoint for the fallback Twitter API access
 * Used when primary API hits rate limits or experiences issues
 * Includes additional X_API_KEY_SECRET for enhanced security
 * @constant {Object} API_CONFIG2 
 */
const API_CONFIG2 = {
    X_API_KEY: process.env.TWITTER_API_2_X_API_KEY,
    X_API_KEY_SECRET: process.env.TWITTER_API_2_X_API_KEY_SECRET,
    CLIENT_ID: process.env.TWITTER_API_2_CLIENT_ID,
    CLIENT_SECRET: process.env.TWITTER_API_2_CLIENT_SECRET,
    BEARER_TOKEN: process.env.TWITTER_API_2_BEARER_TOKEN,
    ACCESS_TOKEN: process.env.TWITTER_API_2_ACCESS_TOKEN,
    ACCESS_TOKEN_SECRET: process.env.TWITTER_API_2_ACCESS_TOKEN_SECRET,
    API_BASE_URL: process.env.TWITTER_API_2_BASE_URL
};

// API keys for grok AI 
const API_CONFIG3 = {
    API_KEY: process.env.GROK_AI_API_KEY,
    API_BASE_URL: process.env.GROK_AI_BASE_URL
};
// Track which config we're using currently
let activeConfigNum = 1;

// More generous rate limiting while still being conservative
const RATE_LIMITS = {
    config1: {
        readRequests: {
            total: 25,  // Conservative limit per month
            used: 0,
            resetDate: new Date().setMonth(new Date().getMonth() + 1),
            lastRequestTime: null
        }
    },
    config2: {
        readRequests: {
            total: 25,  // Conservative limit per month  
            used: 0,
            resetDate: new Date().setMonth(new Date().getMonth() + 1),
            lastRequestTime: null
        }
    }
};

// Increased minimum time between requests to 10 seconds
const MIN_REQUEST_INTERVAL = 10000;

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
            const limits = result.rateLimits || RATE_LIMITS;
            const config1Used = limits.config1?.readRequests.used || 0;
            const config2Used = limits.config2?.readRequests.used || 0;
            const config1Total = limits.config1?.readRequests.total || 25;
            const config2Total = limits.config2?.readRequests.total || 25;
            
            // If we're at the limit for both configs, use the one that resets sooner
            if (config1Used >= config1Total && config2Used >= config2Total) {
                const config1Reset = new Date(limits.config1.readRequests.resetDate);
                const config2Reset = new Date(limits.config2.readRequests.resetDate);
                
                resolve({
                    config: config1Reset < config2Reset ? result.apiConfig1 : result.apiConfig2,
                    configNum: config1Reset < config2Reset ? 1 : 2
                });
                return;
            }
            
            // If one config is at limit, use the other
            if (config1Used >= config1Total) {
                resolve({
                    config: result.apiConfig2,
                    configNum: 2
                });
                return;
            }
            
            if (config2Used >= config2Total) {
                resolve({
                    config: result.apiConfig1,
                    configNum: 1
                });
                return;
            }
            
            // Both have remaining quota, alternate between them
            activeConfigNum = activeConfigNum === 1 ? 2 : 1;
            
            resolve({
                config: activeConfigNum === 1 ? result.apiConfig1 : result.apiConfig2,
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

// Function to make authenticated API requests
async function makeAuthenticatedRequest(endpoint, method = 'GET', data = null) {
    // Get the config to use for this request
    const { config, configNum } = await getAPIConfig();
    
    // Check rate limits for this config
    await checkRateLimits(configNum);
    await forceDelay(); // Always enforce delay

    try {
        console.log(`Making request with config #${configNum} to: ${endpoint}`);
        
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${config.BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${config.API_BASE_URL}${endpoint}`, options);

        if (response.status === 429) {
            console.error(`Rate limit exceeded for API config #${configNum}`);
            throw new Error(`Rate limit exceeded for API config #${configNum}. Please try again later.`);
        }

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText };
            }
            
            console.error(`API request failed with config #${configNum}:`, response.status, errorData);
            throw new Error(`API request failed: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        // Update rate limit counter
        const updatedLimits = await incrementRateLimit(configNum);
        
        return {
            data: await response.json(),
            rateLimit: updatedLimits,
            configUsed: configNum
        };
    } catch (error) {
        console.error(`API request failed with config #${configNum}:`, error);
        throw error;
    }
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

// Function to get user information
async function getUserData(username) {
    try {
        iconManager.showLoading();
        // Check cache first
        if (profileCache.has(username)) {
            const cachedData = profileCache.get(username);
            const cacheAge = Date.now() - cachedData.timestamp;

            // Use cache if less than 1 hour old
            if (cacheAge < 3600000) {
                console.log(`Using cached data for ${username}`);
                return {
                    ...cachedData.data,
                    fromCache: true
                };
            }
        }

        console.log(`Fetching fresh data for ${username}`);

        // Minimal user fields to reduce data transfer
        const userResponse = await makeAuthenticatedRequest(
            `/users/by/username/${username}?user.fields=public_metrics,description`
        );

        if (!userResponse.data.data) {
            throw new Error('User not found');
        }

        // Get only 10 most recent tweets with minimal fields
        const tweetsResponse = await makeAuthenticatedRequest(
            `/users/${userResponse.data.data.id}/tweets?max_results=10&tweet.fields=public_metrics,created_at,entities,attachments&expansions=attachments.media_keys`
        );

        // Add Grok analysis if enabled
        const settings = await getSettings();
        let grokAnalysis = null;
        
        if (settings.grokEnabled) {
            grokAnalysis = await analyzeProfileWithGrok(
                userResponse.data.data, 
                tweetsResponse.data.data || []
            );
        }

        const result = {
            user: userResponse.data.data,
            tweets: tweetsResponse.data.data || [],
            analytics: calculateAnalytics(tweetsResponse.data.data || []),
            strategy: analyzePostingStrategy(userResponse.data.data, tweetsResponse.data.data || []),
            grokAnalysis: grokAnalysis?.success ? {
                engagementInsights: grokAnalysis.engagementInsights,
                growthStrategy: grokAnalysis.growthStrategy,
            } : null,
            tokenUsage: grokAnalysis?.tokenUsage,
            rateLimit: tweetsResponse.rateLimit,
            configUsed: tweetsResponse.configUsed,
            fromCache: false
        };

        // Cache the result
        profileCache.set(username, {
            data: result,
            timestamp: Date.now()
        });

        iconManager.showSuccess();
        return result;
    } catch (error) {
        iconManager.showError();
        console.error('Failed to fetch user data:', error);
        throw error;
    } finally {
        iconManager.stopLoading();
    }
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

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeProfile') {
        getUserData(request.username)
            .then(result => {
                sendResponse({
                    success: true,
                    data: result,
                    rateLimit: result.rateLimit,
                    fromCache: result.fromCache
                });
            })
            .catch(error => {
                console.error('Error in analyzeProfile:', error);
                chrome.storage.local.get(['rateLimits'], (data) => {
                    const limits = data.rateLimits || RATE_LIMITS;
                    const config1 = limits.config1?.readRequests || { used: 0, total: 25 };
                    const config2 = limits.config2?.readRequests || { used: 0, total: 25 };
                    
                    sendResponse({
                        success: false,
                        error: error.message,
                        rateLimit: {
                            used: config1.used + config2.used,
                            total: config1.total + config2.total,
                            resetDate: Math.min(
                                config1.resetDate || Date.now() + 2592000000,
                                config2.resetDate || Date.now() + 2592000000
                            )
                        }
                    });
                });
            });
        return true;
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
});