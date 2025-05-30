// fallback-generator.js - Generate fallback data when the Twitter API is unavailable
// This module provides placeholder data that can be displayed while the API is rate-limited

/**
 * Generate a complete fallback profile for a user
 * @param {string} username - Twitter username
 * @returns {Object} Fallback profile data
 */
export function generateFallbackProfile(username) {
  // Clean username format
  const cleanUsername = username.replace(/^@/, '').trim();
  
  // Create a deterministic but "random-looking" seed based on username
  const seed = createSeed(cleanUsername);
  
  // Generate user data
  const userData = generateFallbackUserData(cleanUsername, seed);
  
  // Generate tweet data
  const tweetsData = generateFallbackTweets(cleanUsername, seed, 10);
  
  // Generate analytics from fallback data
  const analytics = generateFallbackAnalytics(userData, tweetsData, seed);
  
  // Generate recommendations
  const recommendations = generateFallbackRecommendations(userData, analytics, seed);
  
  return {
    success: true,
    user: userData,
    tweets: tweetsData,
    analytics: analytics,
    recommendations: recommendations,
    isEstimated: true,
    fromFallback: true,
    timestamp: Date.now(),
    fallbackReason: 'API unavailable or rate limited',
    expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes from now
  };
}

/**
 * Create a deterministic seed from a username
 * @param {string} username - Twitter username
 * @returns {number} - Numeric seed
 */
function createSeed(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a pseudorandom number between min and max using a seed
 * @param {number} seed - Seed value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Pseudorandom number
 */
function seededRandom(seed, min, max) {
  // Simple LCG (Linear Congruential Generator)
  const a = 1664525;
  const c = 1013904223;
  const m = 2**32;
  
  // Generate next seed
  const nextSeed = (a * seed + c) % m;
  
  // Scale to range
  const result = min + (nextSeed / m) * (max - min);
  
  return {
    value: result,
    nextSeed: nextSeed
  };
}

/**
 * Generate fallback user data
 * @param {string} username - Twitter username
 * @param {number} seed - Random seed
 * @returns {Object} - User data
 */
function generateFallbackUserData(username, seed) {
  // Generate consistent but "random-looking" values based on username
  let currentSeed = seed;
  
  // Generate follower count (100 to 10,000)
  const followerResult = seededRandom(currentSeed, 100, 10000);
  const followers_count = Math.floor(followerResult.value);
  currentSeed = followerResult.nextSeed;
  
  // Generate following count (50 to 2,000)
  const followingResult = seededRandom(currentSeed, 50, 2000);
  const following_count = Math.floor(followingResult.value);
  currentSeed = followingResult.nextSeed;
  
  // Generate tweet count (50 to 5,000)
  const tweetResult = seededRandom(currentSeed, 50, 5000);
  const tweet_count = Math.floor(tweetResult.value);
  currentSeed = tweetResult.nextSeed;
  
  // Generate listed count (1 to 200)
  const listedResult = seededRandom(currentSeed, 1, 200);
  const listed_count = Math.floor(listedResult.value);
  currentSeed = listedResult.nextSeed;
  
  // Generate verified status
  const verifiedResult = seededRandom(currentSeed, 0, 1);
  const verified = verifiedResult.value > 0.9; // 10% chance of being verified
  currentSeed = verifiedResult.nextSeed;
  
  // Generate created date (between 1 and 10 years ago)
  const yearResult = seededRandom(currentSeed, 1, 10);
  const yearsAgo = Math.floor(yearResult.value);
  currentSeed = yearResult.nextSeed;
  
  const createdDate = new Date();
  createdDate.setFullYear(createdDate.getFullYear() - yearsAgo);
  
  // Generate fake bio
  const bioTemplates = [
    `${username} sharing thoughts on tech, life, and more.`,
    `Professional by day, ${username} by night. Opinions are my own.`,
    `${username} | Writer | Creator | Explorer`,
    `Just your average tweeter with above-average tweets. @${username}`,
    `Passionate about making a difference. Follow for insights from ${username}.`
  ];
  
  const bioResult = seededRandom(currentSeed, 0, bioTemplates.length - 0.01);
  const bio = bioTemplates[Math.floor(bioResult.value)];
  currentSeed = bioResult.nextSeed;
  
  // Build user object
  return {
    id: `12345${seed.toString().substring(0, 8)}`,
    name: username.charAt(0).toUpperCase() + username.slice(1),
    username: username,
    created_at: createdDate.toISOString(),
    description: bio,
    verified: verified,
    profile_image_url: `https://unavatar.io/twitter/${username}`,
    public_metrics: {
      followers_count: followers_count,
      following_count: following_count,
      tweet_count: tweet_count,
      listed_count: listed_count
    }
  };
}

/**
 * Generate fallback tweets
 * @param {string} username - Twitter username
 * @param {number} seed - Random seed
 * @param {number} count - Number of tweets
 * @returns {Array} - Array of tweets
 */
function generateFallbackTweets(username, seed, count) {
  const tweets = [];
  let currentSeed = seed;
  
  // Tweet templates
  const tweetTemplates = [
    `Just had a great idea about #innovation. Can't wait to share more!`,
    `Working on something exciting today. Stay tuned!`,
    `Nothing beats a productive day. #motivated`,
    `Thanks for all the support on my latest project. You all are amazing!`,
    `Just released a new update. Check it out and let me know what you think!`,
    `The key to success is persistence. #nevergiveup`,
    `Sometimes you need to take a step back to move forward. #perspective`,
    `Learning something new every day. #growth`,
    `Just hit a major milestone! Celebrating today. #achievement`,
    `Collaboration is the key to innovation. #teamwork`
  ];
  
  // Create tweets with decreasing dates
  for (let i = 0; i < count; i++) {
    // Select a template
    const templateResult = seededRandom(currentSeed, 0, tweetTemplates.length - 0.01);
    const tweetText = tweetTemplates[Math.floor(templateResult.value)];
    currentSeed = templateResult.nextSeed;
    
    // Generate metrics
    const likesResult = seededRandom(currentSeed, 5, 500);
    const likes = Math.floor(likesResult.value);
    currentSeed = likesResult.nextSeed;
    
    const retweetsResult = seededRandom(currentSeed, 0, likes * 0.5);
    const retweets = Math.floor(retweetsResult.value);
    currentSeed = retweetsResult.nextSeed;
    
    const repliesResult = seededRandom(currentSeed, 0, likes * 0.3);
    const replies = Math.floor(repliesResult.value);
    currentSeed = repliesResult.nextSeed;
    
    // Generate date (1-30 days ago, with more recent tweets first)
    const daysAgoResult = seededRandom(currentSeed, i, i + 3);
    const daysAgo = Math.floor(daysAgoResult.value);
    currentSeed = daysAgoResult.nextSeed;
    
    const tweetDate = new Date();
    tweetDate.setDate(tweetDate.getDate() - daysAgo);
    
    // Create tweet object
    tweets.push({
      id: `tweet_${seed}_${i}`,
      text: tweetText,
      created_at: tweetDate.toISOString(),
      public_metrics: {
        like_count: likes,
        retweet_count: retweets,
        reply_count: replies,
        quote_count: Math.floor(retweets * 0.2)
      }
    });
  }
  
  return tweets;
}

/**
 * Generate fallback analytics
 * @param {Object} userData - User data
 * @param {Array} tweetsData - Tweet data
 * @param {number} seed - Random seed
 * @returns {Object} - Analytics data
 */
function generateFallbackAnalytics(userData, tweetsData, seed) {
  let currentSeed = seed;
  
  // Calculate engagement from tweets
  let totalLikes = 0;
  let totalRetweets = 0;
  let totalReplies = 0;
  
  tweetsData.forEach(tweet => {
    totalLikes += tweet.public_metrics.like_count;
    totalRetweets += tweet.public_metrics.retweet_count;
    totalReplies += tweet.public_metrics.reply_count;
  });
  
  const tweetCount = tweetsData.length;
  const averageLikes = totalLikes / tweetCount;
  const averageRetweets = totalRetweets / tweetCount;
  const averageReplies = totalReplies / tweetCount;
  const averageTotal = averageLikes + averageRetweets + averageReplies;
  
  // Calculate engagement rate
  const followers = userData.public_metrics.followers_count;
  const engagementRate = followers > 0 ? (averageTotal / followers) * 100 : 0;
  
  // Generate content type percentages
  const textResult = seededRandom(currentSeed, 20, 60);
  const textPercent = textResult.value;
  currentSeed = textResult.nextSeed;
  
  const imagesResult = seededRandom(currentSeed, 20, 40);
  const imagesPercent = imagesResult.value;
  currentSeed = imagesResult.nextSeed;
  
  const videosResult = seededRandom(currentSeed, 5, 20);
  const videosPercent = videosResult.value;
  currentSeed = videosResult.nextSeed;
  
  const linksPercent = 100 - textPercent - imagesPercent - videosPercent;
  
  // Calculate account age
  const createdAt = new Date(userData.created_at);
  const now = new Date();
  const ageMs = now - createdAt;
  const ageInDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Calculate growth stats
  const followersPerDay = userData.public_metrics.followers_count / ageInDays;
  
  return {
    engagement: {
      average: {
        likes: averageLikes,
        retweets: averageRetweets,
        replies: averageReplies,
        total: averageTotal
      },
      rate: engagementRate
    },
    contentTypes: {
      text: textPercent,
      images: imagesPercent,
      videos: videosPercent,
      links: linksPercent
    },
    postingTimes: generatePostingTimes(seed),
    accountGrowth: {
      followersPerDay: Math.round(followersPerDay * 100) / 100,
      projectedGrowth: Math.round(followersPerDay * 30)
    },
    accountAge: {
      createdAt: userData.created_at,
      ageInDays: Math.floor(ageInDays),
      ageInYears: Math.round(ageInDays / 365 * 10) / 10
    },
    topPerformingTweets: tweetsData.slice(0, 3).map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      public_metrics: tweet.public_metrics,
      totalEngagement: tweet.public_metrics.like_count + 
                      tweet.public_metrics.retweet_count + 
                      tweet.public_metrics.reply_count
    }))
  };
}

/**
 * Generate posting time analysis
 * @param {number} seed - Random seed
 * @returns {Object} - Posting time data
 */
function generatePostingTimes(seed) {
  let currentSeed = seed;
  
  // Generate day percentages
  const dayPercentages = {};
  let totalDayPercentage = 0;
  
  for (let i = 0; i < 6; i++) {
    const result = seededRandom(currentSeed, 5, 20);
    dayPercentages[i] = result.value;
    totalDayPercentage += result.value;
    currentSeed = result.nextSeed;
  }
  
  // Make sure they add up to 100%
  dayPercentages[6] = 100 - totalDayPercentage;
  
  // Generate hour percentages
  const hourPercentages = {};
  let totalHourPercentage = 0;
  
  // Business hours get higher percentages
  for (let i = 0; i < 24; i++) {
    if (i >= 9 && i <= 17) {
      // Business hours
      const result = seededRandom(currentSeed, 5, 10);
      hourPercentages[i] = result.value;
      currentSeed = result.nextSeed;
    } else {
      // Non-business hours
      const result = seededRandom(currentSeed, 0, 5);
      hourPercentages[i] = result.value;
      currentSeed = result.nextSeed;
    }
    totalHourPercentage += hourPercentages[i];
  }
  
  // Normalize to 100%
  for (let i = 0; i < 24; i++) {
    hourPercentages[i] = (hourPercentages[i] / totalHourPercentage) * 100;
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
 * Generate fallback recommendations
 * @param {Object} userData - User data
 * @param {Object} analytics - Analytics data
 * @param {number} seed - Random seed
 * @returns {Object} - Recommendations
 */
function generateFallbackRecommendations(userData, analytics, seed) {
  // Get follower count for personalized recommendations
  const followers = userData.public_metrics.followers_count;
  
  // Frequency recommendation based on follower count
  let frequency;
  if (followers < 1000) {
    frequency = 'Post 1-2 times per day to build your audience steadily';
  } else if (followers < 10000) {
    frequency = 'Post 2-4 times per day for optimal growth';
  } else {
    frequency = 'Post 3-5 times per day to maintain engagement';
  }
  
  // Format best times
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const bestDays = analytics.postingTimes.bestDays.map(d => dayNames[d.day]).join(', ');
  
  const formatHour = (hour) => {
    const amPm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12} ${amPm}`;
  };
  
  const bestHours = analytics.postingTimes.bestHours.map(h => formatHour(h.hour)).join(', ');
  const times = `Your content performs best on ${bestDays} around ${bestHours} UTC`;
  
  // Content mix recommendation
  let contentMix;
  if (analytics.contentTypes.images < 20) {
    contentMix = 'Add more images to your content mix for better engagement';
  } else if (analytics.contentTypes.videos < 10) {
    contentMix = 'Incorporate more video content to boost engagement';
  } else if (analytics.contentTypes.text > 70) {
    contentMix = 'Diversify your content with more media to improve engagement';
  } else {
    contentMix = 'Your content mix is balanced. Continue experimenting with what works best';
  }
  
  // Generate engagement tips
  const engagementTips = [
    'Post consistently to maintain audience interest',
    'Use relevant hashtags to reach new audiences',
    'Ask questions in your tweets to encourage replies',
    'Respond to comments to build community engagement',
    'Include more visual content for higher engagement'
  ];
  
  // Generate growth strategy based on account size
  let growthStrategy;
  if (followers < 1000) {
    growthStrategy = [
      'Focus on finding your niche and building a consistent posting schedule',
      'Engage with larger accounts in your field to gain visibility',
      'Regularly analyze your analytics to refine your content strategy'
    ];
  } else if (followers < 10000) {
    growthStrategy = [
      'Begin collaborating with peers in your industry for cross-promotion',
      'Analyze your top-performing content and create more of what works',
      'Regularly analyze your analytics to refine your content strategy'
    ];
  } else {
    growthStrategy = [
      'Develop branded hashtags to encourage community engagement',
      'Consider creating Twitter Spaces to directly engage with your audience',
      'Regularly analyze your analytics to refine your content strategy'
    ];
  }
  
  return {
    postingStrategy: {
      frequency,
      times,
      contentMix
    },
    engagementTips,
    growthStrategy
  };
}

export default {
  generateFallbackProfile
};
 