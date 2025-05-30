// twitter-api.js - Utility functions for Twitter API operations
import { makeAuthenticatedRequest, handleApiError, authHandler } from './auth-handler.js';

/**
 * Fetch a user profile by username
 * @param {string} username - Twitter username (with or without @)
 * @returns {Promise<Object>} - User profile data
 */
export async function fetchUserProfile(username) {
  try {
    // Remove @ if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    // Validate username format
    if (!isValidUsername(cleanUsername)) {
      throw new Error(`Invalid username format: ${username}`);
    }
    
    // Fetch user data with all needed fields
    const userData = await makeAuthenticatedRequest(`users/by/username/${cleanUsername}`, {
      params: {
        'user.fields': 'description,created_at,profile_image_url,public_metrics,verified,location,url'
      }
    });
    
    return userData;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return handleApiError(error);
  }
}

/**
 * Fetch user tweets
 * @param {string} userId - Twitter user ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Tweets data
 */
export async function fetchUserTweets(userId, options = {}) {
  try {
    const maxResults = options.maxResults || 10;
    const params = {
      'max_results': maxResults,
      'tweet.fields': 'created_at,public_metrics,entities,attachments',
      'expansions': 'attachments.media_keys',
      'media.fields': 'type,url',
    };
    
    // Add pagination token if provided
    if (options.paginationToken) {
      params.pagination_token = options.paginationToken;
    }
    
    const tweetsData = await makeAuthenticatedRequest(`users/${userId}/tweets`, { params });
    return tweetsData;
  } catch (error) {
    console.error('Error fetching user tweets:', error);
    return handleApiError(error);
  }
}

/**
 * Generate profile analytics based on user data and tweets
 * @param {Object} userData - User profile data
 * @param {Object} tweetsData - User tweets data
 * @returns {Object} - Analytics data
 */
export function generateProfileAnalytics(userData, tweetsData) {
  // Initialize analytics object
  const analytics = {
    engagement: calculateEngagement(tweetsData),
    postingTimes: calculatePostingTimes(tweetsData),
    contentTypes: analyzeContentTypes(tweetsData),
    accountGrowth: estimateAccountGrowth(userData),
    accountAge: calculateAccountAge(userData),
    topPerformingTweets: findTopPerformingTweets(tweetsData)
  };
  
  return analytics;
}

/**
 * Generate strategic recommendations based on profile data
 * @param {Object} userData - User profile data
 * @param {Object} analytics - Analytics data
 * @returns {Object} - Strategic recommendations
 */
export function generateRecommendations(userData, analytics) {
  // Default recommendations
  const recommendations = {
    postingStrategy: {
      frequency: recommendPostingFrequency(analytics),
      times: recommendPostingTimes(analytics),
      contentMix: recommendContentMix(analytics)
    },
    engagementTips: generateEngagementTips(userData, analytics),
    growthStrategy: generateGrowthStrategy(userData, analytics)
  };
  
  return recommendations;
}

// Helper functions

/**
 * Validate Twitter username format
 */
function isValidUsername(username) {
  // Twitter usernames can only contain alphanumeric characters and underscores
  // Must be between 1 and 15 characters long
  return /^[A-Za-z0-9_]{1,15}$/.test(username);
}

/**
 * Calculate engagement metrics for tweets
 */
function calculateEngagement(tweetsData) {
  if (!tweetsData || !tweetsData.data || tweetsData.data.length === 0) {
    return {
      average: {
        likes: 0,
        retweets: 0,
        replies: 0,
        total: 0
      },
      rate: 0
    };
  }
  
  const tweets = tweetsData.data;
  let totalLikes = 0;
  let totalRetweets = 0;
  let totalReplies = 0;
  
  tweets.forEach(tweet => {
    if (tweet.public_metrics) {
      totalLikes += tweet.public_metrics.like_count || 0;
      totalRetweets += tweet.public_metrics.retweet_count || 0;
      totalReplies += tweet.public_metrics.reply_count || 0;
    }
  });
  
  const tweetCount = tweets.length;
  const averageLikes = totalLikes / tweetCount;
  const averageRetweets = totalRetweets / tweetCount;
  const averageReplies = totalReplies / tweetCount;
  const averageTotal = averageLikes + averageRetweets + averageReplies;
  
  // Calculate engagement rate if we have follower count
  let engagementRate = 0;
  if (tweetsData.includes && tweetsData.includes.users && tweetsData.includes.users[0]) {
    const followers = tweetsData.includes.users[0].public_metrics?.followers_count || 0;
    if (followers > 0) {
      engagementRate = (averageTotal / followers) * 100;
    }
  }
  
  return {
    average: {
      likes: averageLikes,
      retweets: averageRetweets,
      replies: averageReplies,
      total: averageTotal
    },
    rate: engagementRate
  };
}

/**
 * Analyze when the user typically posts
 */
function calculatePostingTimes(tweetsData) {
  if (!tweetsData || !tweetsData.data || tweetsData.data.length === 0) {
    return {
      dayOfWeek: {},
      hourOfDay: {}
    };
  }
  
  const dayCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const hourCount = {};
  for (let i = 0; i < 24; i++) {
    hourCount[i] = 0;
  }
  
  tweetsData.data.forEach(tweet => {
    if (tweet.created_at) {
      const date = new Date(tweet.created_at);
      const day = date.getUTCDay();
      const hour = date.getUTCHours();
      
      dayCount[day]++;
      hourCount[hour]++;
    }
  });
  
  // Convert to percentages
  const totalTweets = tweetsData.data.length;
  const dayPercentages = {};
  const hourPercentages = {};
  
  for (let i = 0; i < 7; i++) {
    dayPercentages[i] = (dayCount[i] / totalTweets) * 100;
  }
  
  for (let i = 0; i < 24; i++) {
    hourPercentages[i] = (hourCount[i] / totalTweets) * 100;
  }
  
  // Find best days and hours
  const bestDays = Object.entries(dayPercentages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day, percentage]) => ({ 
      day: parseInt(day), 
      percentage 
    }));
    
  const bestHours = Object.entries(hourPercentages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, percentage]) => ({ 
      hour: parseInt(hour), 
      percentage 
    }));
  
  return {
    dayOfWeek: dayPercentages,
    hourOfDay: hourPercentages,
    bestDays,
    bestHours
  };
}

/**
 * Analyze types of content the user posts
 */
function analyzeContentTypes(tweetsData) {
  if (!tweetsData || !tweetsData.data || tweetsData.data.length === 0) {
    return {
      text: 0,
      images: 0,
      videos: 0,
      links: 0
    };
  }
  
  const types = {
    text: 0,
    images: 0,
    videos: 0,
    links: 0,
    retweets: 0,
    replies: 0
  };
  
  tweetsData.data.forEach(tweet => {
    // Check if it's a retweet
    if (tweet.text.startsWith('RT @')) {
      types.retweets++;
      return;
    }
    
    // Check if it's a reply
    if (tweet.in_reply_to_user_id) {
      types.replies++;
    } else {
      // Check for media attachments
      if (tweet.attachments && tweet.attachments.media_keys) {
        const mediaKeys = tweet.attachments.media_keys;
        
        if (mediaKeys.length > 0) {
          let hasVideo = false;
          let hasImage = false;
          
          // Check media types if we have includes data
          if (tweetsData.includes && tweetsData.includes.media) {
            mediaKeys.forEach(key => {
              const media = tweetsData.includes.media.find(m => m.media_key === key);
              if (media) {
                if (media.type === 'video' || media.type === 'animated_gif') {
                  hasVideo = true;
                } else if (media.type === 'photo') {
                  hasImage = true;
                }
              }
            });
          } else {
            // If we don't have media type info, count as images
            hasImage = true;
          }
          
          if (hasVideo) types.videos++;
          if (hasImage) types.images++;
        }
      } else {
        // If no media, check for links in entities
        if (tweet.entities && tweet.entities.urls && tweet.entities.urls.length > 0) {
          types.links++;
        } else {
          types.text++;
        }
      }
    }
  });
  
  // Convert to percentages
  const totalTweets = tweetsData.data.length;
  const percentages = {};
  
  Object.entries(types).forEach(([type, count]) => {
    percentages[type] = (count / totalTweets) * 100;
  });
  
  return percentages;
}

/**
 * Estimate account growth based on followers and account age
 */
function estimateAccountGrowth(userData) {
  if (!userData || !userData.data) {
    return {
      followersPerDay: 0,
      projectedGrowth: 0
    };
  }
  
  const user = userData.data;
  
  // Calculate account age in days
  const createdAt = user.created_at ? new Date(user.created_at) : null;
  if (!createdAt) {
    return {
      followersPerDay: 0,
      projectedGrowth: 0
    };
  }
  
  const now = new Date();
  const accountAgeMs = now - createdAt;
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
  
  // Get follower count
  const followers = user.public_metrics ? user.public_metrics.followers_count : 0;
  
  // Calculate average followers gained per day
  const followersPerDay = followers / accountAgeDays;
  
  // Project growth for next 30 days
  const projectedGrowth = followersPerDay * 30;
  
  return {
    followersPerDay: Math.round(followersPerDay * 100) / 100,
    projectedGrowth: Math.round(projectedGrowth)
  };
}

/**
 * Calculate account age
 */
function calculateAccountAge(userData) {
  if (!userData || !userData.data || !userData.data.created_at) {
    return {
      createdAt: null,
      ageInDays: 0,
      ageInYears: 0
    };
  }
  
  const createdAt = new Date(userData.data.created_at);
  const now = new Date();
  const ageMs = now - createdAt;
  const ageInDays = ageMs / (1000 * 60 * 60 * 24);
  const ageInYears = ageInDays / 365;
  
  return {
    createdAt: userData.data.created_at,
    ageInDays: Math.floor(ageInDays),
    ageInYears: Math.round(ageInYears * 10) / 10
  };
}

/**
 * Find top performing tweets
 */
function findTopPerformingTweets(tweetsData) {
  if (!tweetsData || !tweetsData.data || tweetsData.data.length === 0) {
    return [];
  }
  
  // Calculate total engagement for each tweet
  const tweetsWithEngagement = tweetsData.data.map(tweet => {
    let totalEngagement = 0;
    
    if (tweet.public_metrics) {
      totalEngagement = 
        (tweet.public_metrics.like_count || 0) +
        (tweet.public_metrics.retweet_count || 0) +
        (tweet.public_metrics.reply_count || 0);
    }
    
    return {
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      public_metrics: tweet.public_metrics,
      totalEngagement
    };
  });
  
  // Sort by total engagement and return top 3
  return tweetsWithEngagement
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 3);
}

/**
 * Recommend posting frequency
 */
function recommendPostingFrequency(analytics) {
  // Simple algorithm that can be enhanced with more data
  const followersCount = analytics.accountGrowth?.followersCount || 0;
  
  if (followersCount < 1000) {
    return 'Post 1-2 times per day to build your audience steadily';
  } else if (followersCount < 10000) {
    return 'Post 2-4 times per day for optimal growth';
  } else {
    return 'Post 3-5 times per day to maintain engagement';
  }
}

/**
 * Recommend best posting times
 */
function recommendPostingTimes(analytics) {
  if (!analytics.postingTimes || !analytics.postingTimes.bestHours) {
    return 'Experiment with different posting times to find your audience';
  }
  
  // Convert hour numbers to readable times
  const formatHour = (hour) => {
    const amPm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
    return `${hour12} ${amPm}`;
  };
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const bestDays = analytics.postingTimes.bestDays.map(d => dayNames[d.day]).join(', ');
  const bestHours = analytics.postingTimes.bestHours.map(h => formatHour(h.hour)).join(', ');
  
  return `Your content performs best on ${bestDays} around ${bestHours} UTC`;
}

/**
 * Recommend content mix
 */
function recommendContentMix(analytics) {
  if (!analytics.contentTypes) {
    return 'Experiment with a mix of text, images, videos, and links';
  }
  
  // Find current top content type
  const contentTypes = analytics.contentTypes;
  let topType = 'text';
  let topPercentage = 0;
  
  Object.entries(contentTypes).forEach(([type, percentage]) => {
    if (type !== 'retweets' && type !== 'replies' && percentage > topPercentage) {
      topType = type;
      topPercentage = percentage;
    }
  });
  
  // Make recommendations based on content mix analysis
  if (contentTypes.images < 20) {
    return 'Add more images to your content mix for better engagement';
  } else if (contentTypes.videos < 10) {
    return 'Incorporate more video content to boost engagement';
  } else if (contentTypes.text > 70) {
    return 'Diversify your content with more media to improve engagement';
  } else {
    return 'Your content mix is balanced. Continue experimenting with what works best';
  }
}

/**
 * Generate engagement tips
 */
function generateEngagementTips(userData, analytics) {
  const tips = [];
  
  // Based on profile completeness
  const user = userData?.data;
  if (user) {
    if (!user.profile_image_url || user.profile_image_url.includes('default_profile_images')) {
      tips.push('Add a profile picture to increase credibility');
    }
    if (!user.description || user.description.length < 10) {
      tips.push('Complete your profile bio to attract more followers');
    }
    if (!user.location) {
      tips.push('Adding your location helps connect with local followers');
    }
  }
  
  // Based on engagement analysis
  if (analytics.engagement && analytics.engagement.rate < 1) {
    tips.push('Ask questions in your tweets to encourage replies');
    tips.push('Respond to comments to build community engagement');
  }
  
  // Based on content types
  if (analytics.contentTypes) {
    if (analytics.contentTypes.replies < 20) {
      tips.push('Engage more with others by replying to relevant tweets');
    }
    if (analytics.contentTypes.images < 30) {
      tips.push('Include more visual content for higher engagement');
    }
  }
  
  // Add general tips if needed
  if (tips.length < 3) {
    tips.push('Post consistently to maintain audience interest');
    tips.push('Use relevant hashtags to reach new audiences');
    tips.push('Share content that adds value to your followers');
  }
  
  return tips.slice(0, 5); // Return top 5 tips
}

/**
 * Generate growth strategy
 */
function generateGrowthStrategy(userData, analytics) {
  const strategies = [];
  
  // Based on account size
  const followers = userData?.data?.public_metrics?.followers_count || 0;
  
  if (followers < 1000) {
    strategies.push('Focus on finding your niche and building a consistent posting schedule');
    strategies.push('Engage with larger accounts in your field to gain visibility');
  } else if (followers < 10000) {
    strategies.push('Begin collaborating with peers in your industry for cross-promotion');
    strategies.push('Analyze your top-performing content and create more of what works');
  } else {
    strategies.push('Develop branded hashtags to encourage community engagement');
    strategies.push('Consider creating Twitter Spaces to directly engage with your audience');
  }
  
  // Based on engagement rate
  if (analytics.engagement && analytics.engagement.rate < 1) {
    strategies.push('Improve content quality to boost engagement before focusing on follower growth');
  }
  
  // Based on account age
  if (analytics.accountAge && analytics.accountAge.ageInDays < 90) {
    strategies.push('Focus on establishing your unique voice and brand consistency');
  }
  
  // Add general strategy
  strategies.push('Regularly analyze your analytics to refine your content strategy');
  
  return strategies.slice(0, 3); // Return top 3 strategies
}

// Export everything for comprehensive usage
export default {
  fetchUserProfile,
  fetchUserTweets,
  generateProfileAnalytics,
  generateRecommendations,
  authHandler
}; 