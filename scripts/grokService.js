// grokService.js
/**
 * Service for interacting with Grok AI API and managing token usage
 */
// Import environment configuration
// Using ES modules import syntax since this is a modern browser extension
import * as env from './env.js';

/**
 * Token usage tracking for both monthly and session
 */
let tokenUsage = {
  monthly: {
    used: 0,
    limit: 1000000, // Example limit, adjust based on your plan
    resetDate: null
  },
  session: {
    used: 0,
    startTime: Date.now()
  },
  history: [], // Track historical usage
  analysisCache: {} // For caching analysis results
};

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  enabled: true,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  maxSize: 50 // Maximum number of cached analyses
};

/**
 * Analysis detail levels with token estimates
 */
const DETAIL_LEVELS = {
  basic: {
    maxTokens: 300,
    description: "Basic analysis with essential insights"
  },
  standard: {
    maxTokens: 600,
    description: "Standard analysis with detailed recommendations"
  },
  comprehensive: {
    maxTokens: 1000,
    description: "Comprehensive analysis with in-depth strategy"
  }
};

/**
 * Load token usage from storage
 * @returns {Promise<Object>} Token usage data
 */
async function loadTokenUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['grokTokenUsage'], (result) => {
      if (result.grokTokenUsage) {
        tokenUsage = {
          ...result.grokTokenUsage,
          session: {
            used: tokenUsage.session.used, // Preserve current session
            startTime: tokenUsage.session.startTime
          }
        };
        
        // Reset monthly if needed
        const now = new Date();
        const resetDate = new Date(tokenUsage.monthly.resetDate || 0);
        if (now > resetDate) {
          // Store previous month's usage in history
          tokenUsage.history.push({
            period: resetDate.toISOString().slice(0,7),
            used: tokenUsage.monthly.used
          });
          // Keep last 12 months of history
          if (tokenUsage.history.length > 12) {
            tokenUsage.history.shift();
          }
          
          tokenUsage.monthly.used = 0;
          tokenUsage.monthly.resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        }

        // Clean expired cache entries
        if (tokenUsage.analysisCache) {
          const currentTime = Date.now();
          Object.keys(tokenUsage.analysisCache).forEach(key => {
            if (currentTime - tokenUsage.analysisCache[key].timestamp > CACHE_CONFIG.maxAge) {
              delete tokenUsage.analysisCache[key];
            }
          });
        } else {
          tokenUsage.analysisCache = {};
        }
      } else {
        // Initialize with reset date if not exists
        tokenUsage.monthly.resetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime();
        tokenUsage.analysisCache = {};
      }
      resolve(tokenUsage);
    });
  });
}

/**
 * Save token usage to storage with error handling
 * @returns {Promise<void>}
 */
async function saveTokenUsage() {
  return new Promise((resolve, reject) => {
    try {
      // Create copy to avoid storing excessive session data
      const storageData = {
        ...tokenUsage,
        // Limit cache size for storage
        analysisCache: limitCacheSize(tokenUsage.analysisCache)
      };
      
      chrome.storage.local.set({ grokTokenUsage: storageData }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to save token usage: ${chrome.runtime.lastError.message}`));
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Limit cache size by removing oldest entries
 * @param {Object} cache The cache object to trim
 * @returns {Object} Trimmed cache
 */
function limitCacheSize(cache) {
  const keys = Object.keys(cache);
  if (keys.length <= CACHE_CONFIG.maxSize) {
    return cache;
  }
  
  // Sort by timestamp (oldest first)
  const sortedKeys = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
  
  // Remove oldest entries
  const keysToRemove = sortedKeys.slice(0, keys.length - CACHE_CONFIG.maxSize);
  const trimmedCache = { ...cache };
  
  keysToRemove.forEach(key => {
    delete trimmedCache[key];
  });
  
  return trimmedCache;
}

/**
 * Get usage statistics and predictions
 * @returns {Object} Usage statistics
 */
function getUsageStats() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  
  const dailyAverage = tokenUsage.monthly.used / dayOfMonth;
  const projectedMonthlyUsage = dailyAverage * daysInMonth;
  
  // Calculate efficiency metrics
  const cacheSavings = tokenUsage.session.cacheSavedTokens || 0;
  const cacheHitRate = tokenUsage.session.cacheHits 
    ? tokenUsage.session.cacheHits / (tokenUsage.session.cacheHits + tokenUsage.session.cacheMisses) 
    : 0;
  
  return {
    dailyAverage,
    projectedMonthlyUsage,
    usageHistory: tokenUsage.history,
    sessionUsage: tokenUsage.session.used,
    sessionDuration: (Date.now() - tokenUsage.session.startTime) / (1000 * 60), // in minutes
    cacheSavings,
    cacheHitRate: Math.round(cacheHitRate * 100) // As percentage
  };
}

/**
 * Check if user has enough tokens before making an API call
 * @param {number} estimatedTokens Estimated tokens needed
 * @returns {Promise<Object>} Token availability info
 */
async function checkTokenAvailability(estimatedTokens) {
  await loadTokenUsage();
  
  const remaining = tokenUsage.monthly.limit - tokenUsage.monthly.used;
  const stats = getUsageStats();
  
  return {
    hasEnoughTokens: remaining >= estimatedTokens,
    remaining,
    used: tokenUsage.monthly.used,
    limit: tokenUsage.monthly.limit,
    resetDate: tokenUsage.monthly.resetDate,
    usageStats: stats
  };
}

/**
 * Update token usage after API call with retry logic
 * @param {number} tokensUsed Number of tokens used
 * @param {boolean} cacheHit Whether result was from cache
 * @returns {Promise<void>}
 */
async function updateTokenUsage(tokensUsed, cacheHit = false) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await loadTokenUsage();
      
      if (!cacheHit) {
        // Only increment usage for actual API calls
        tokenUsage.monthly.used += tokensUsed;
        tokenUsage.session.used += tokensUsed;
      } else {
        // Track cache effectiveness
        tokenUsage.session.cacheSavedTokens = (tokenUsage.session.cacheSavedTokens || 0) + tokensUsed;
        tokenUsage.session.cacheHits = (tokenUsage.session.cacheHits || 0) + 1;
      }
      
      await saveTokenUsage();
      return;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        throw new Error(`Failed to update token usage after ${maxRetries} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
    }
  }
}

/**
 * Test the Grok API connection
 * @returns {Promise<Object>} Connection test results
 */
async function testGrokConnection() {
  try {
    const response = await fetch(env.grokAi.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.grokAi.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-1',
        messages: [
          {
            role: 'system',
            content: 'Test connection'
          },
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      throw new Error(`API test failed with status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Grok API connection successful',
      modelInfo: data.model || 'grok-1'
    };
  } catch (error) {
    return {
      success: false,
      error: `Grok API connection failed: ${error.message}`
    };
  }
}

/**
 * Generate a cache key for content and analysis type
 * @param {Object} content Content to analyze
 * @param {string} analysisType Type of analysis
 * @param {string} detailLevel Detail level
 * @returns {string} Cache key
 */
function generateCacheKey(content, analysisType, detailLevel) {
  const contentHash = JSON.stringify(content)
    .split('')
    .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
    .toString(36);
  
  return `${analysisType}_${detailLevel}_${contentHash}`;
}

/**
 * Check if we have a cached analysis
 * @param {Object} content Content to analyze
 * @param {string} analysisType Type of analysis
 * @param {string} detailLevel Detail level
 * @returns {Object|null} Cached result or null
 */
function getCachedAnalysis(content, analysisType, detailLevel) {
  if (!CACHE_CONFIG.enabled) return null;
  
  const cacheKey = generateCacheKey(content, analysisType, detailLevel);
  const cachedResult = tokenUsage.analysisCache[cacheKey];
  
  if (!cachedResult) {
    tokenUsage.session.cacheMisses = (tokenUsage.session.cacheMisses || 0) + 1;
    return null;
  }
  
  // Check if cache entry is still valid
  if (Date.now() - cachedResult.timestamp > CACHE_CONFIG.maxAge) {
    delete tokenUsage.analysisCache[cacheKey];
    tokenUsage.session.cacheMisses = (tokenUsage.session.cacheMisses || 0) + 1;
    return null;
  }
  
  return cachedResult.data;
}

/**
 * Cache an analysis result
 * @param {Object} content Content analyzed
 * @param {string} analysisType Type of analysis
 * @param {string} detailLevel Detail level
 * @param {Object} result Analysis result
 * @param {number} tokensUsed Tokens used
 */
function cacheAnalysisResult(content, analysisType, detailLevel, result, tokensUsed) {
  if (!CACHE_CONFIG.enabled) return;
  
  const cacheKey = generateCacheKey(content, analysisType, detailLevel);
  
  tokenUsage.analysisCache[cacheKey] = {
    data: result,
    timestamp: Date.now(),
    tokensUsed
  };
}

/**
 * Apply token compression techniques
 * @param {Object} content Content to optimize
 * @param {string} detailLevel Detail level
 * @returns {Object} Optimized content
 */
function optimizeContent(content, detailLevel) {
  // Clone to avoid modifying original
  const optimizedContent = { ...content };
  
  // For basic level, reduce the amount of content we send
  if (detailLevel === 'basic') {
    // For user profiles, limit to essential data
    if (optimizedContent.user) {
      const { username, description, public_metrics } = optimizedContent.user;
      optimizedContent.user = { username, description, public_metrics };
    }
    
    // For tweets, limit number and details
    if (optimizedContent.recentTweets && Array.isArray(optimizedContent.recentTweets)) {
      optimizedContent.recentTweets = optimizedContent.recentTweets
        .slice(0, 5)  // Only use 5 most recent
        .map(tweet => ({
          text: tweet.text,
          public_metrics: tweet.public_metrics
        }));
    }
  }
  
  return optimizedContent;
}

/**
 * Leverages Grok AI to analyze social media content
 * @param {Object} content Content to analyze
 * @param {string} analysisType Type of analysis
 * @param {Object} options Analysis options
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeContent(content, analysisType = 'engagement', options = {}) {
  const { detailLevel = 'standard', bypassCache = false } = options;
  
  if (!DETAIL_LEVELS[detailLevel]) {
    throw new Error(`Invalid detail level: ${detailLevel}. Must be one of: ${Object.keys(DETAIL_LEVELS).join(', ')}`);
  }
  
  try {
    // Check cache first if not bypassed
    if (!bypassCache) {
      const cachedResult = getCachedAnalysis(content, analysisType, detailLevel);
      if (cachedResult) {
        // Update cache hit metrics
        await updateTokenUsage(cachedResult.tokenUsage?.thisRequest?.total_tokens || 0, true);
        return {
          ...cachedResult,
          fromCache: true,
          tokenUsage: {
            ...cachedResult.tokenUsage,
            overall: await checkTokenAvailability(0),
            stats: getUsageStats()
          }
        };
      }
    }
    
    // Test API connection first
    const connectionTest = await testGrokConnection();
    if (!connectionTest.success) {
      throw new Error(connectionTest.error);
    }

    // Optimize content based on detail level
    const optimizedContent = optimizeContent(content, detailLevel);
    const estimatedTokens = Math.ceil(JSON.stringify(optimizedContent).length / 4);
    
    const tokenCheck = await checkTokenAvailability(estimatedTokens);
    if (!tokenCheck.hasEnoughTokens) {
      return {
        success: false,
        error: 'Token limit reached. Please try again after reset.',
        tokenInfo: tokenCheck
      };
    }

    let systemPrompt = '';
    let userPrompt = '';
    
    // Select max tokens based on detail level
    const maxTokens = DETAIL_LEVELS[detailLevel].maxTokens;
    
    switch(analysisType) {
      case 'engagement':
        systemPrompt = `You are an expert social media analytics AI specializing in X (Twitter). 
                       Focus on: 1) Optimal posting times 2) Content structure 3) Hashtag strategy 
                       4) Media usage 5) Engagement triggers.
                       Detail level: ${detailLevel}.`;
        userPrompt = `Analyze this X content for engagement optimization. Include specific, actionable recommendations: ${JSON.stringify(optimizedContent)}`;
        break;
      case 'comparison':
        systemPrompt = `You are an expert in social media content analysis. 
                       Analyze: 1) Writing style 2) Content themes 3) Engagement patterns 
                       4) Timing patterns 5) Media usage.
                       Detail level: ${detailLevel}.`;
        userPrompt = `Compare these posts and provide detailed insights on success factors: ${JSON.stringify(optimizedContent)}`;
        break;
      case 'strategy':
        systemPrompt = `You are a social media strategy expert. 
                       Plan for: 1) Content calendar 2) Theme development 3) Audience targeting 
                       4) Growth tactics 5) Engagement strategies.
                       Detail level: ${detailLevel}.`;
        userPrompt = `Develop a comprehensive posting strategy for this X profile: ${JSON.stringify(optimizedContent)}`;
        break;
      case 'growth':
        systemPrompt = `You are a social media growth expert.
                       Focus on: 1) Follower acquisition 2) Visibility tactics 3) Network expansion
                       4) Engagement triggers 5) Retention strategies.
                       Detail level: ${detailLevel}.`;
        userPrompt = `Analyze this profile and provide specific growth recommendations: ${JSON.stringify(optimizedContent)}`;
        break;
      case 'trends':
        systemPrompt = `You are a social media trend analysis expert.
                       Identify: 1) Content patterns 2) Timing patterns 3) Format effectiveness
                       4) Audience response trends 5) Potential viral factors.
                       Detail level: ${detailLevel}.`;
        userPrompt = `Analyze these posts and identify trending patterns: ${JSON.stringify(optimizedContent)}`;
        break;
      default:
        systemPrompt = 'You are an expert social media analytics AI. Provide comprehensive content analysis.';
        userPrompt = `Analyze this social media content with detailed insights: ${JSON.stringify(optimizedContent)}`;
    }

    const response = await fetch(env.grokAi.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.grokAi.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: connectionTest.modelInfo,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Grok API error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    const tokensUsed = data.usage.total_tokens || estimatedTokens;
    await updateTokenUsage(tokensUsed);
    
    // Format and structure the result
    const result = {
      success: true,
      analysis: data.choices[0].message.content,
      analysisType,
      detailLevel,
      modelInfo: connectionTest.modelInfo,
      tokenUsage: {
        thisRequest: data.usage,
        overall: await checkTokenAvailability(0),
        stats: getUsageStats()
      },
      fromCache: false
    };
    
    // Cache the result
    cacheAnalysisResult(content, analysisType, detailLevel, result, tokensUsed);
    
    return result;
  } catch (error) {
    console.error('Grok AI analysis failed:', error);
    return {
      success: false,
      error: error.message,
      details: error.stack
    };
  }
}

/**
 * Batch analyze multiple pieces of content
 * @param {Array} contentItems Array of content items to analyze
 * @param {string} analysisType Type of analysis
 * @param {Object} options Analysis options
 * @returns {Promise<Object>} Batch analysis results
 */
async function batchAnalyze(contentItems, analysisType = 'engagement', options = {}) {
  if (!Array.isArray(contentItems) || contentItems.length === 0) {
    throw new Error('Content items must be a non-empty array');
  }
  
  const results = [];
  const errors = [];
  
  // Process items sequentially to avoid rate limits
  for (let i = 0; i < contentItems.length; i++) {
    try {
      const result = await analyzeContent(contentItems[i], analysisType, options);
      results.push({
        index: i,
        result
      });
      
      // Brief pause between requests
      if (i < contentItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      errors.push({
        index: i,
        error: error.message
      });
    }
  }
  
  return {
    success: errors.length === 0,
    results,
    errors,
    summary: {
      total: contentItems.length,
      successful: results.length,
      failed: errors.length
    }
  };
}

/**
 * Comparative analysis between user content and successful content
 * @param {Object} userContent User's content
 * @param {Object} successfulContent Successful content to compare against
 * @param {Object} options Analysis options
 * @returns {Promise<Object>} Comparison results
 */
async function compareContent(userContent, successfulContent, options = {}) {
  try {
    const comparisonData = {
      userContent,
      successfulContent,
      comparisonMetrics: generateComparisonMetrics(userContent, successfulContent)
    };
    
    const result = await analyzeContent(comparisonData, 'comparison', options);
    
    return {
      ...result,
      metrics: comparisonData.comparisonMetrics
    };
  } catch (error) {
    console.error('Content comparison failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate comparison metrics between user and successful content
 * @param {Object} userContent User's content
 * @param {Object} successfulContent Successful content
 * @returns {Object} Comparison metrics
 */
function generateComparisonMetrics(userContent, successfulContent) {
  // This function extracts metrics for comparison to make analysis easier
  const metrics = {
    textLength: {
      user: calculateAverageTextLength(userContent),
      successful: calculateAverageTextLength(successfulContent)
    },
    mediaUsage: {
      user: calculateMediaUsageRate(userContent),
      successful: calculateMediaUsageRate(successfulContent)
    },
    hashtagUsage: {
      user: calculateAverageHashtags(userContent),
      successful: calculateAverageHashtags(successfulContent)
    },
    postingTime: {
      user: extractPostingTimeDistribution(userContent),
      successful: extractPostingTimeDistribution(successfulContent)
    },
    engagementRate: {
      user: calculateEngagementRate(userContent),
      successful: calculateEngagementRate(successfulContent)
    }
  };
  
  return metrics;
}

/**
 * Calculate average text length of tweets
 * @param {Object} content Content with tweets
 * @returns {number} Average text length
 */
function calculateAverageTextLength(content) {
  if (!content || !content.recentTweets || !Array.isArray(content.recentTweets)) return 0;
  return content.recentTweets.reduce((sum, tweet) => sum + (tweet.text?.length || 0), 0) / content.recentTweets.length;
}

/**
 * Calculate media usage rate in tweets
 * @param {Object} content Content with tweets
 * @returns {number} Media usage rate as percentage
 */
function calculateMediaUsageRate(content) {
  if (!content || !content.recentTweets || !Array.isArray(content.recentTweets)) return 0;
  const postsWithMedia = content.recentTweets.filter(tweet => tweet.hasMedia).length;
  return (postsWithMedia / content.recentTweets.length) * 100;
}

/**
 * Calculate average number of hashtags per tweet
 * @param {Object} content Content with tweets
 * @returns {number} Average hashtags per tweet
 */
function calculateAverageHashtags(content) {
  if (!content || !content.recentTweets || !Array.isArray(content.recentTweets)) return 0;
  
  let totalHashtags = 0;
  content.recentTweets.forEach(tweet => {
    const hashtagMatches = tweet.text?.match(/#\w+/g);
    totalHashtags += hashtagMatches ? hashtagMatches.length : 0;
  });
  
  return totalHashtags / content.recentTweets.length;
}

/**
 * Extract posting time distribution across 24 hours
 * @param {Object} content Content with tweets
 * @returns {Array} 24-hour distribution of posts
 */
function extractPostingTimeDistribution(content) {
  if (!content || !content.recentTweets || !Array.isArray(content.recentTweets)) {
    return Array(24).fill(0);
  }
  
  const hourDistribution = Array(24).fill(0);
  
  content.recentTweets.forEach(tweet => {
    if (tweet.created_at) {
      const hour = new Date(tweet.created_at).getHours();
      hourDistribution[hour]++;
    }
  });
  
  return hourDistribution;
}

/**
 * Calculate engagement rate for content
 * @param {Object} content Content with tweets
 * @returns {number} Engagement rate as percentage
 */
function calculateEngagementRate(content) {
  if (!content || !content.recentTweets || !Array.isArray(content.recentTweets) || content.recentTweets.length === 0) {
    return 0;
  }
  
  let totalEngagement = 0;
  content.recentTweets.forEach(tweet => {
    const metrics = tweet.public_metrics || {};
    totalEngagement += (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
  });
  
  const followerCount = content.user?.public_metrics?.followers_count || 1; // Avoid division by zero
  return (totalEngagement / (content.recentTweets.length * followerCount)) * 100;
}

/**
 * Clear the analysis cache
 * @returns {Promise<void>}
 */
async function clearAnalysisCache() {
  await loadTokenUsage();
  tokenUsage.analysisCache = {};
  return saveTokenUsage();
}

/**
 * Set cache configuration
 * @param {Object} config Cache configuration options
 * @returns {Object} Updated cache configuration
 */
function configureCaching(config) {
  CACHE_CONFIG.enabled = config.enabled !== undefined ? config.enabled : CACHE_CONFIG.enabled;
  CACHE_CONFIG.maxAge = config.maxAge || CACHE_CONFIG.maxAge;
  CACHE_CONFIG.maxSize = config.maxSize || CACHE_CONFIG.maxSize;
  
  return { ...CACHE_CONFIG };
}
// Change export at the bottom
export {
  analyzeContent,
  batchAnalyze,
  compareContent,
  checkTokenAvailability,
  loadTokenUsage,
  getUsageStats,
  testGrokConnection,
  clearAnalysisCache,
  configureCaching,
  DETAIL_LEVELS
};