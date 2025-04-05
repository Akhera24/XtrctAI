// X Profile Analyzer - Background Script

// Import required modules
import { twitter, apiValidation, proxyConfig, proxyUrl } from './env.js';
import { makeAuthenticatedRequest, handleApiError } from './scripts/auth-handler.js';
import { iconManager } from './scripts/iconManager.js';

// Configuration constants
const API_CONFIG = {
  BEARER_TOKEN: twitter.config1.bearerToken,
  API_KEY: twitter.config1.xApiKey,
  API_SECRET: twitter.config1.clientSecret,
  API_BASE_URL: twitter.config1.baseUrl || 'https://api.twitter.com/2'
};

const API_CONFIG2 = {
  BEARER_TOKEN: twitter.config2.bearerToken,
  API_KEY: twitter.config2.xApiKey,
  API_SECRET: twitter.config2.clientSecret,
  API_BASE_URL: twitter.config2.baseUrl || 'https://api.twitter.com/2'
};

const RATE_LIMITS = {
  used: 0,
  remaining: 180,
  reset: Date.now() + 900000, // 15 minutes
  resetTime: new Date(Date.now() + 900000).toISOString()
};

// Initialize the extension state
chrome.runtime.onInstalled.addListener(() => {
  console.log('X Profile Analyzer extension installed');
  initializeExtension();
  
  // Ensure icons are properly loaded after installation
  setTimeout(() => {
    try {
      iconManager.preloadIcons()
        .then(() => iconManager.setIconState('default'))
        .catch(err => console.warn('Icon initialization error:', err));
    } catch (error) {
      console.warn('Error during icon initialization:', error);
    }
  }, 2000);
});

// Also initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension starting up');
  initializeExtension();
  
  // Preload icons on startup
  setTimeout(() => {
    try {
      iconManager.preloadIcons()
        .then(() => iconManager.setIconState('default'))
        .catch(err => console.warn('Icon initialization error:', err));
    } catch (error) {
      console.warn('Error during icon initialization:', error);
    }
  }, 1000);
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
    
    // Register proxy service worker
    try {
      // Check if proxy is enabled
      if (proxyConfig.enabled) {
        console.log('Registering proxy service worker...');
        
        // Store proxy config in storage for service worker access
        await chrome.storage.local.set({ 
          proxyConfig: {
            enabled: proxyConfig.enabled,
            url: proxyUrl,
            timeoutMs: proxyConfig.timeout,
            retryAttempts: proxyConfig.retryAttempts
          }
        });
        
        // Test proxy connection
        await testProxyConnection();
      }
    } catch (proxyError) {
      console.error('Error setting up proxy:', proxyError);
    }
    
    console.log('Initialization complete');
    
    // Initialize icons after configuration is complete
    try {
      await iconManager.preloadIcons();
      await iconManager.setIconState('default');
    } catch (iconError) {
      console.warn('Error initializing icons:', iconError);
    }
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

// Test proxy connection to check if it's working
async function testProxyConnection() {
  try {
    console.log('Testing proxy connection...');
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Connection': 'true'
      },
      body: JSON.stringify({ test: true }),
      mode: 'cors'
    });
    
    if (response.ok) {
      console.log('Proxy connection successful');
      return true;
    } else {
      console.warn('Proxy connection failed with status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Proxy connection error:', error);
    return false;
  }
}

// Store pending responses for async operations
const pendingResponses = new Map();

// Clean up any orphaned pending responses periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, { timestamp }] of pendingResponses.entries()) {
    // Remove entries older than 2 minutes
    if (now - timestamp > 120000) {
      console.log(`Removing stale pending response: ${id}`);
      pendingResponses.delete(id);
    }
  }
}, 60000);

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Add a unique ID to each message for tracking
  const messageId = request._messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`Received message [${messageId}]:`, request.action);
  
  // Set up a timeout to prevent hanging message ports
  const timeoutId = setTimeout(() => {
    console.log(`Message handling timed out [${messageId}]`);
    try {
      // Try to send an error response before the port closes
      sendResponse({ 
        success: false, 
        error: 'Operation timed out, please try again',
        _timedOut: true
      });
    } catch (error) {
      console.error(`Error sending timeout response for [${messageId}]:`, error);
    }
  }, 30000); // 30 second timeout
  
  // Handle reconnect attempts
  if (request._isReconnectAttempt) {
    try {
      if (pendingResponses.has(request._messageId)) {
        const storedResponse = pendingResponses.get(request._messageId).response;
        console.log(`Sending stored response for reconnect [${request._messageId}]`, storedResponse);
        sendResponse(storedResponse);
        pendingResponses.delete(request._messageId);
        clearTimeout(timeoutId);
        return false; // No async response needed
      } else {
        console.log(`No stored response for reconnect [${request._messageId}]`);
        sendResponse({ 
          success: false, 
          error: 'No stored response available for this request',
          _reconnectFailed: true
        });
        clearTimeout(timeoutId);
        return false;
      }
    } catch (error) {
      console.error(`Error handling reconnect [${request._messageId}]:`, error);
      clearTimeout(timeoutId);
      return false;
    }
  }
  
  // Create a function to safely store responses for async operations
  const safeRespond = (responseData) => {
    try {
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Skip null responses
      if (responseData === null || responseData === undefined) {
        console.error(`Null response for message [${messageId}]`);
        responseData = { 
          success: false, 
          error: 'Internal error: null response',
          _nullResponse: true
        };
      }
      
      // Add messageId to response for tracking
      const enhancedResponse = {
        ...responseData,
        _messageId: messageId
      };
      
      // Store the response in case we need it for reconnection
      pendingResponses.set(messageId, {
        response: enhancedResponse,
        timestamp: Date.now()
      });
      
      // Send the response
      console.log(`Sending response for [${messageId}]`);
      sendResponse(enhancedResponse);
      
      // Schedule deletion of the stored response
      setTimeout(() => {
        pendingResponses.delete(messageId);
      }, 60000); // Keep responses for 1 minute to handle reconnects
    } catch (error) {
      console.error(`Error sending response for [${messageId}]:`, error);
    }
  };
  
  try {
    // Process the request based on action
    switch (request.action) {
      case 'analyzeProfile':
        handleAnalyzeProfile(request, safeRespond);
        return true; // Keep message channel open for async response
        
      case 'makeAuthenticatedRequest':
        handleAuthenticatedRequest(request, safeRespond);
        return true;
        
      case 'testApiConnection':
        handleApiTest(request, safeRespond);
        return true;
        
      case 'clearCache':
        handleClearCache(safeRespond);
        return true;
        
      case 'getRateLimits':
        handleGetRateLimits(safeRespond);
        return true;
        
      default:
        // Unknown action
        safeRespond({ 
          success: false, 
          error: `Unknown action: ${request.action}` 
        });
        return false;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    clearTimeout(timeoutId);
    
    // Try to send an error response
    try {
      sendResponse({ 
        success: false, 
        error: error.message || 'An unknown error occurred',
        _errorHandling: true
      });
    } catch (responseError) {
      console.error('Failed to send error response:', responseError);
    }
    
    return false;
  }
});

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
    
    // Update extension icon
    try {
      iconManager.setIconState('loading');
    } catch (iconError) {
      console.warn('Unable to update icon state:', iconError);
    }
    
    // Try to get cached data first
    const cachedData = await getCachedData(username);
    if (cachedData) {
      sendResponse({
        success: true,
        data: cachedData,
        fromCache: true
      });
      
      try {
        iconManager.setIconState('active');
      } catch (iconError) {
        console.warn('Unable to update icon state:', iconError);
      }
      
      return;
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
    
    // Get user tweets - fetch more tweets for better analysis
    let userData = response.data;
    let tweets = [];
    let hashtagsUsed = [];
    let mentionsUsed = [];
    let mediaTypes = { photo: 0, video: 0, gif: 0, text: 0, links: 0 };
    
    if (userData && userData.data && userData.data.id) {
      try {
        // Fetch up to 100 recent tweets for better analysis
        const tweetsResponse = await makeAuthenticatedRequest(`users/${userData.data.id}/tweets`, {
          method: 'GET',
          params: {
            'max_results': 100,
            'tweet.fields': 'created_at,public_metrics,entities,context_annotations,attachments,referenced_tweets',
            'expansions': 'attachments.media_keys',
            'media.fields': 'type,url,preview_image_url',
            'exclude': 'retweets'
          }
        });
        
        if (tweetsResponse.success && tweetsResponse.data) {
          tweets = tweetsResponse.data.data || [];
          
          // Extract hashtags, mentions, and media types from tweets
          tweets.forEach(tweet => {
            // Count media types
            if (tweet.attachments && tweet.attachments.media_keys) {
              const hasMedia = true;
              // Look for media type in includes
              if (tweetsResponse.data.includes && tweetsResponse.data.includes.media) {
                tweet.attachments.media_keys.forEach(key => {
                  const media = tweetsResponse.data.includes.media.find(m => m.media_key === key);
                  if (media) {
                    mediaTypes[media.type] = (mediaTypes[media.type] || 0) + 1;
                  }
                });
              }
            } else {
              mediaTypes.text = (mediaTypes.text || 0) + 1;
            }
            
            // Count links
            if (tweet.entities && tweet.entities.urls && tweet.entities.urls.length > 0) {
              mediaTypes.links = (mediaTypes.links || 0) + 1;
            }
            
            // Extract hashtags
            if (tweet.entities && tweet.entities.hashtags) {
              tweet.entities.hashtags.forEach(tag => {
                if (tag.tag) {
                  hashtagsUsed.push(tag.tag.toLowerCase());
                }
              });
            }
            
            // Extract mentions
            if (tweet.entities && tweet.entities.mentions) {
              tweet.entities.mentions.forEach(mention => {
                if (mention.username) {
                  mentionsUsed.push(mention.username.toLowerCase());
                }
              });
            }
          });
        }
      } catch (tweetError) {
        console.error('Error fetching tweets:', tweetError);
        // Continue even if tweets fail
      }
    }
    
    // Ensure public_metrics exists
    if (userData && userData.data && !userData.data.public_metrics) {
      userData.data.public_metrics = {
        followers_count: userData.data.followers_count || 0,
        following_count: userData.data.following_count || 0,
        tweet_count: userData.data.statuses_count || userData.data.tweet_count || 0,
        listed_count: userData.data.listed_count || 0
      };
    }
    
    // Process the data - create a more user-friendly result object
    const user = userData.data;
    
    // Calculate metrics
    const followersCount = user.public_metrics?.followers_count || 0;
    const followingCount = user.public_metrics?.following_count || 0;
    const tweetCount = user.public_metrics?.tweet_count || 0;
    
    const followerRatio = followingCount > 0 
      ? (followersCount / followingCount).toFixed(1) 
      : 'N/A';
    
    // Calculate account age
    const createdDate = new Date(user.created_at);
    const now = new Date();
    const accountAgeMs = now - createdDate;
    const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
    
    // Calculate tweets per day
    const tweetsPerDay = accountAgeDays > 0 
      ? (tweetCount / accountAgeDays).toFixed(2) 
      : tweetCount;
    
    // Get top hashtags by count
    const hashtagCounts = hashtagsUsed.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
    
    // Sort hashtags by frequency
    const topHashtags = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
    
    // Analyze posting times
    const postingTimes = analyzePostingTimes(tweets);
    
    // Detect content themes
    const contentThemes = detectContentThemes(tweets, topHashtags);
    
    // Calculate engagement metrics
    const engagementMetrics = calculateEngagementMetrics(tweets, followersCount);
    
    // Create the profile object with all the extracted and calculated data
    const profile = {
      username: user.username,
      name: user.name,
      bio: user.description,
      location: user.location || '',
      avatar: user.profile_image_url,
      verified: user.verified || false,
      verifiedType: user.verified_type || '',
      metrics: {
        followers: followersCount.toString(),
        following: followingCount.toString(),
        tweets: tweetCount.toString(),
        engagement: engagementMetrics.overallRate + '%'
      },
      url: user.url,
      created_at: user.created_at
    };
    
    // Create the analysis result
    const analysisResult = {
      profile,
      rawUser: user,
      content: {
        themes: contentThemes,
        topHashtags,
        mediaDistribution: mediaTypes
      },
      activity: {
        postingTimes,
        tweetsPerDay,
        followerRatio,
        accountAgeDays
      },
      engagement: engagementMetrics,
      recentTweets: tweets.slice(0, 10).map(simplifyTweet) // Only include first 10 tweets
    };
    
    // Cache the successful response
    await cacheData(username, analysisResult);
    
    // Send response back to popup
    sendResponse({
      success: true,
      data: analysisResult,
      fromCache: false
    });
    
    // Update icon to success state
    try {
      iconManager.setIconState('active');
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
          error: `Using cached data. Fresh data unavailable: ${error.message}`
        });
        return;
      }
    } catch (cacheError) {
      // If cache fails too, continue to error response
    }
    
    // Handle the error with appropriate response
    sendResponse({
      success: false,
      error: error.message || 'Failed to analyze profile'
    });
    
    try {
      iconManager.setIconState('error');
    } catch (iconError) {
      console.warn('Unable to update icon state:', iconError);
    }
  }
}

// Helper: Create a simplified tweet object for caching
function simplifyTweet(tweet) {
  return {
    id: tweet.id,
    text: tweet.text,
    created_at: tweet.created_at,
    public_metrics: tweet.public_metrics || {},
    hasMedia: !!(tweet.attachments && tweet.attachments.media_keys && tweet.attachments.media_keys.length > 0)
  };
}

// Helper: Analyze when the user posts most frequently
function analyzePostingTimes(tweets) {
  // Default times if no tweets available
  if (!tweets || tweets.length === 0) {
    return [
      { period: 'morning', label: 'Weekdays 7-9am' },
      { period: 'noon', label: 'Weekdays 12-1pm' },
      { period: 'evening', label: 'Weekdays 5-6pm' }
    ];
  }
  
  // Initialize counters for different time periods
  const hourCounts = Array(24).fill(0);
  const dayOfWeekCounts = Array(7).fill(0);
  
  // Count tweets by hour and day of week
  tweets.forEach(tweet => {
    if (tweet.created_at) {
      const date = new Date(tweet.created_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      
      hourCounts[hour]++;
      dayOfWeekCounts[dayOfWeek]++;
    }
  });
  
  // Find peak hours (top 3)
  const topHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  // Find peak days
  const topDays = dayOfWeekCounts
    .map((count, day) => ({ day, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  // Format the results
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Convert hour to time period
  function hourToTimePeriod(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }
  
  // Format hour to display time
  function formatHour(hour) {
    const ampm = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
  }
  
  // Create formatted times
  const bestTimes = topHours.map(({ hour }) => {
    const nextHour = (hour + 1) % 24;
    const period = hourToTimePeriod(hour);
    
    return {
      period,
      hour,
      label: `${formatHour(hour)}-${formatHour(nextHour)}`
    };
  });
  
  // Format day recommendations
  const bestDays = topDays.map(({ day }) => days[day]);
  
  // Combine into recommendations
  return bestTimes.map((time, index) => ({
    ...time,
    label: `${bestDays[index % bestDays.length]} ${time.label}`
  }));
}

// Helper: Detect main content themes from tweets
function detectContentThemes(tweets, topHashtags) {
  // Default themes if no data
  if (!tweets || tweets.length === 0) {
    return [
      { name: 'General', percentage: 40 },
      { name: 'Updates', percentage: 30 },
      { name: 'News', percentage: 30 }
    ];
  }
  
  // Keywords for different content categories
  const categories = {
    'Technology': ['tech', 'technology', 'coding', 'software', 'programming', 'developer', 'app', 'ai', 'data', 'tech', 'web'],
    'Business': ['business', 'startup', 'entrepreneur', 'marketing', 'sales', 'investment', 'finance', 'economy', 'market'],
    'News': ['news', 'breaking', 'latest', 'update', 'today', 'report', 'headlines', 'story', 'just in'],
    'Entertainment': ['movie', 'film', 'tv', 'show', 'music', 'artist', 'entertainment', 'actor', 'actress', 'celebrity'],
    'Sports': ['sports', 'game', 'team', 'player', 'match', 'score', 'win', 'tournament', 'championship', 'league'],
    'Fashion': ['fashion', 'style', 'trend', 'outfit', 'clothing', 'wear', 'design', 'luxury', 'collection'],
    'Food': ['food', 'recipe', 'restaurant', 'cooking', 'dinner', 'lunch', 'breakfast', 'meal', 'eating', 'chef'],
    'Fitness': ['fitness', 'workout', 'exercise', 'gym', 'training', 'health', 'healthy', 'diet', 'body', 'weight'],
    'Travel': ['travel', 'trip', 'vacation', 'destination', 'tour', 'explore', 'adventure', 'journey', 'flight', 'hotel'],
    'Politics': ['politics', 'government', 'election', 'policy', 'campaign', 'vote', 'political', 'president', 'democracy'],
    'Education': ['education', 'school', 'university', 'college', 'student', 'learning', 'teach', 'academic', 'study'],
    'Relationships': ['relationship', 'dating', 'love', 'partner', 'marriage', 'romance', 'couple', 'family', 'friend'],
    'Sneakers': ['sneaker', 'shoes', 'kicks', 'footwear', 'nike', 'adidas', 'jordan', 'yeezy', 'air', 'trainer'],
    'Personal Growth': ['growth', 'mindset', 'motivation', 'inspiration', 'success', 'goal', 'purpose', 'self', 'improve']
  };
  
  // Count category matches in tweets
  const categoryCounts = {};
  for (const category in categories) {
    categoryCounts[category] = 0;
  }
  
  // Add additional categories from hashtags
  topHashtags.forEach(({tag}) => {
    let matched = false;
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => tag.toLowerCase().includes(kw))) {
        categoryCounts[category]++;
        matched = true;
        break;
      }
    }
    
    // If no match found, create a new category based on the hashtag
    if (!matched && tag) {
      const tagCategory = tag.charAt(0).toUpperCase() + tag.slice(1);
      if (!categoryCounts[tagCategory]) {
        categoryCounts[tagCategory] = 0;
      }
      categoryCounts[tagCategory]++;
    }
  });
  
  // Analyze tweet content for categories
  tweets.forEach(tweet => {
    const text = tweet.text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        categoryCounts[category]++;
      }
    }
  });
  
  // Calculate percentages
  const totalCounts = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0) || 1;
  
  // Convert to array of objects with percentages
  let themes = Object.entries(categoryCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalCounts) * 100)
    }))
    .filter(theme => theme.count > 0) // Remove empty categories
    .sort((a, b) => b.count - a.count); // Sort by count
  
  // If no meaningful categories detected, provide defaults
  if (themes.length === 0 || themes[0].count === 0) {
    themes = [
      { name: 'General', percentage: 40 },
      { name: 'Updates', percentage: 30 },
      { name: 'News', percentage: 30 }
    ];
  }
  
  // Ensure total is 100%
  let totalPercentage = themes.reduce((sum, theme) => sum + theme.percentage, 0);
  
  // Normalize if not exactly 100%
  if (totalPercentage !== 100 && themes.length > 0) {
    // Adjust first theme to make total 100%
    const diff = 100 - totalPercentage;
    themes[0].percentage += diff;
  }
  
  return themes.slice(0, 5); // Return top 5 themes
}

// Helper: Calculate engagement metrics
function calculateEngagementMetrics(tweets, followerCount) {
  // Default metrics
  const defaultMetrics = {
    overallRate: '1.5',
    likeRate: '1.2',
    retweetRate: '0.2',
    replyRate: '0.1',
    topPerforming: []
  };
  
  if (!tweets || tweets.length === 0 || !followerCount) {
    return defaultMetrics;
  }
  
  // Calculate engagement rates
  let totalLikes = 0;
  let totalRetweets = 0;
  let totalReplies = 0;
  
  // Enhanced metrics for each tweet
  const tweetsWithMetrics = tweets.map(tweet => {
    const metrics = tweet.public_metrics || {};
    const likes = metrics.like_count || 0;
    const retweets = metrics.retweet_count || 0;
    const replies = metrics.reply_count || 0;
    const quotes = metrics.quote_count || 0;
    
    totalLikes += likes;
    totalRetweets += retweets;
    totalReplies += replies;
    
    // Calculate engagement score
    const engagementScore = likes + (retweets * 2) + (replies * 3) + (quotes * 2);
    
    return {
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      likes,
      retweets,
      replies,
      quotes,
      engagementScore
    };
  });
  
  // Calculate average engagement metrics
  const tweetCount = tweets.length || 1;
  const avgLikes = totalLikes / tweetCount;
  const avgRetweets = totalRetweets / tweetCount;
  const avgReplies = totalReplies / tweetCount;
  
  // Calculate engagement rates as percentage of followers
  const followerCountNum = parseInt(followerCount) || 1;
  const likeRate = (avgLikes / followerCountNum) * 100;
  const retweetRate = (avgRetweets / followerCountNum) * 100;
  const replyRate = (avgReplies / followerCountNum) * 100;
  const overallRate = likeRate + retweetRate + replyRate;
  
  // Get top performing tweets
  const topPerforming = tweetsWithMetrics
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 3)
    .map(t => ({
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      engagementScore: t.engagementScore,
      likes: t.likes,
      retweets: t.retweets,
      replies: t.replies
    }));
  
  return {
    overallRate: overallRate.toFixed(1),
    likeRate: likeRate.toFixed(1),
    retweetRate: retweetRate.toFixed(1),
    replyRate: replyRate.toFixed(1),
    topPerforming
  };
}

// Handle authenticated request
async function handleAuthenticatedRequest(request, sendResponse) {
  try {
    const response = await makeAuthenticatedRequest(request.url, {
      method: request.method || 'GET',
      params: request.params,
      headers: request.headers,
      body: request.body
    });
    sendResponse(response);
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message || 'API request failed'
    });
  }
}

// Handle API connection test
async function handleApiTest(request, sendResponse) {
  try {
    console.log('Testing API connection');
    
    // First check if proxy is enabled and test it
    let proxyStatus = false;
    if (proxyConfig.enabled) {
      proxyStatus = await testProxyConnection();
    }
    
    // Test direct Twitter API connection
    const directApiResponse = await makeAuthenticatedRequest('users/me', {
      method: 'GET',
      useProxy: false
    });
    
    // Collect the results
    sendResponse({
      success: true,
      directApi: {
        status: directApiResponse.success,
        data: directApiResponse.data
      },
      proxy: {
        enabled: proxyConfig.enabled,
        status: proxyStatus
      },
      apiValidation: apiValidation
    });
  } catch (error) {
    console.error('API test error:', error);
    handleApiError(error, null, sendResponse);
  }
}

// Handle cache clearing
function handleClearCache(sendResponse) {
  chrome.storage.local.remove(['userCache'], () => {
    sendResponse({ success: true });
  });
}

// Handle rate limit info request
function handleGetRateLimits(sendResponse) {
  chrome.storage.local.get(['rateLimits'], (result) => {
    sendResponse({
      success: true,
      rateLimits: result.rateLimits || RATE_LIMITS
    });
  });
}

// Cache helpers
async function getCachedData(username, ignoreExpiry = false) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userCache'], (result) => {
      const cache = result.userCache || {};
      const userData = cache[username];
      
      if (!userData) {
        resolve(null);
        return;
      }
      
      if (ignoreExpiry || userData.timestamp > Date.now() - (24 * 60 * 60 * 1000)) {
        resolve(userData.data);
      } else {
        resolve(null);
      }
    });
  });
}

async function cacheData(username, data) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userCache'], (result) => {
      const cache = result.userCache || {};
      cache[username] = {
        data: data,
        timestamp: Date.now()
      };
      chrome.storage.local.set({ userCache: cache }, resolve);
    });
  });
}

// Listen for tab updates to enable/disable extension icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isProfileUrl = tab.url.match(/https:\/\/(www\.)?(twitter|x)\.com\/[^\/]+$/);
    
    try {
      chrome.action.setIcon({
        tabId: tabId,
        path: isProfileUrl ? {
          16: 'icons/icon16.png',
          48: 'icons/icon48.png',
          128: 'icons/icon128.png'
        } : {
          16: 'icons/disabled/icon16-disabled.png',
          48: 'icons/disabled/icon48-disabled.png',
          128: 'icons/disabled/icon128-disabled.png'
        }
      });
    } catch (iconError) {
      console.warn('Error setting icon:', iconError);
    }
  }
}); 