/**
 * Grok AI service for X Profile Analyzer
 * Provides API access for profile analysis and post generation
 */

// Cache for analysis results
const analysisCache = new Map();

// Configuration
let config = {
  cacheEnabled: true,
  maxAge: 86400000, // 24 hours in milliseconds
  detailLevel: 'standard',
  apiKey: '',
  baseUrl: 'https://api.grok.ai/v1/completions'
};

/**
 * Configure the service
 * @param {Object} options - Configuration options
 */
export function configure(options) {
  if (options.enabled !== undefined) {
    config.cacheEnabled = options.enabled;
  }
  
  if (options.maxAge !== undefined) {
    config.maxAge = options.maxAge;
  }
  
  if (options.apiKey) {
    config.apiKey = options.apiKey;
  }
  
  if (options.baseUrl) {
    config.baseUrl = options.baseUrl;
  }
  
  console.log('Grok service configured');
  return { success: true, config: { ...config } };
}

/**
 * Configure caching behavior for the service
 * @param {Object} options - Caching options
 * @param {boolean} options.enabled - Whether caching is enabled
 * @param {number} options.maxAge - Maximum age of cached items in milliseconds
 */
export function configureCaching(options = {}) {
  console.log('Configuring caching:', options);
  
  if (options.enabled !== undefined) {
    config.cacheEnabled = options.enabled;
  }
  
  if (options.maxAge !== undefined && options.maxAge > 0) {
    config.maxAge = options.maxAge;
  }
  
  return {
    success: true,
    config: { ...config }
  };
}

/**
 * Clear the analysis cache
 * @returns {Promise<boolean>} Success status
 */
export async function clearAnalysisCache() {
  analysisCache.clear();
  console.log('Analysis cache cleared');
  return true;
}

/**
 * Test the API connection
 * @returns {Promise<Object>} Connection status
 */
export async function testConnection() {
  if (!config.apiKey) {
  return {
      success: false,
      error: 'API key not configured'
    };
  }
  
  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 5
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      model: data.model || 'grok-2'
    };
  } catch (error) {
    console.error('API connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze profile data to provide insights
 * @param {Object} profileData - Profile data to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeProfile(profileData, options = {}) {
  try {
    const username = profileData.user?.username || 'unknown_user';
    const cacheKey = `profile_${username}_${options.detailLevel || 'standard'}`;
    
    // Check cache if enabled
    if (config.cacheEnabled && analysisCache.has(cacheKey)) {
      const cachedResult = analysisCache.get(cacheKey);
      const now = Date.now();
      
      if (now - cachedResult.timestamp < config.maxAge) {
        console.log(`Using cached analysis for ${username}`);
        return {
          ...cachedResult.data,
          fromCache: true
        };
      }
    }
    
    // Make actual API call if API key is configured
    if (config.apiKey) {
      const connectionTest = await testConnection();
    if (!connectionTest.success) {
      throw new Error(connectionTest.error);
    }

      // Prepare prompts
      const systemPrompt = `You are an expert social media analytics AI specializing in X (Twitter). 
                           Analyze the user profile thoroughly and provide actionable insights.
                           Focus on content strategy, engagement tactics, growth opportunities, and audience targeting.
                           Format your response clearly with sections for key metrics, engagement analysis, content strategy, and recommendations.`;
      
      const userPrompt = `Analyze this X (Twitter) profile data and provide detailed insights and recommendations:
                         ${JSON.stringify(profileData)}`;
      
      const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          model: connectionTest.model || 'grok-2',
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
          max_tokens: 1000,
          temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    
      // Extract insights from the response
      const analysisText = data.choices[0].message.content;
      const insights = extractInsights(analysisText);
      const recommendations = extractRecommendations(analysisText);
      
    const result = {
      success: true,
        engagementInsights: insights,
        growthStrategy: recommendations,
        fullAnalysis: analysisText,
        tokenUsage: data.usage
    };
    
    // Cache the result
      if (config.cacheEnabled) {
        analysisCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }
    
    return result;
    } else {
      // Return mock data if API is not configured
      return generateMockAnalysis(profileData, options);
    }
  } catch (error) {
    console.error('Profile analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate social media posts based on topic and options
 * @param {string} topic - Topic for the posts
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated posts
 */
export async function generatePosts(topic, options = {}) {
  try {
    const cacheKey = `posts_${topic}_${options.tone || 'professional'}_${options.type || 'general'}`;
    
    // Check cache if enabled
    if (config.cacheEnabled && analysisCache.has(cacheKey)) {
      const cachedResult = analysisCache.get(cacheKey);
      const now = Date.now();
      
      if (now - cachedResult.timestamp < config.maxAge) {
        console.log(`Using cached posts for ${topic}`);
        return {
          ...cachedResult.data,
          fromCache: true
        };
      }
    }
    
    // Make actual API call if API key is configured
    if (config.apiKey) {
      const connectionTest = await testConnection();
      if (!connectionTest.success) {
        throw new Error(connectionTest.error);
      }
      
      // Fetch top posts for research if option is enabled
      let topPostsResearch = "";
      if (options.useTopPosts !== false) {
        try {
          topPostsResearch = await fetchTopPostsForTopic(topic);
        } catch (error) {
          console.warn('Could not fetch top posts for research:', error);
        }
      }
      
      // Prepare prompts based on options
      const postType = options.type || 'engagement';
      const tone = options.tone || 'professional';
      const includeHashtags = options.includeHashtags !== false;
      const includeEmojis = options.includeEmojis !== false;
      const includeCitations = options.includeCitations !== false;
      const postCount = options.count || 3;
      const maxLength = options.maxLength || 280;
      const factCheck = options.factCheck !== false;
      
      const systemPrompt = `You are an expert social media post writer for X (Twitter).
                           Create ${postCount} unique and engaging posts about "${topic}" with a ${tone} tone.
                           Each post should be concise and under ${maxLength} characters.
                           Posts should be in ${postType} format.
                           ${includeHashtags ? 'Include relevant hashtags.' : 'Do not include hashtags.'}
                           ${includeEmojis ? 'Include appropriate emojis.' : 'Do not include emojis.'}
                           ${includeCitations ? 'Include sources/citations where appropriate.' : ''}
                           ${factCheck ? 'Ensure all factual claims are accurate and can be verified.' : ''}
                           Each post should be unique in approach and content.
                           Format each post with a number followed by the content.`;
      
      const userPrompt = `Create ${postCount} unique X (Twitter) posts about "${topic}" with a ${tone} tone.
                         ${topPostsResearch ? 'Here is research on top-performing posts on this topic to enhance your output:\n' + topPostsResearch : ''}
                         Make each post different in style and approach.
                         Ensure content is engaging, shareable, and follows platform best practices.`;
      
      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: connectionTest.model || 'grok-2',
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
          max_tokens: 1000,
          temperature: 0.8
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract posts from the response
      const generatedText = data.choices[0].message.content;
      const posts = extractPosts(generatedText, postCount);
      
      const result = {
        success: true,
        posts: posts.map((post, index) => ({
          id: index + 1,
          content: post,
          type: postType,
          tone: tone,
          charCount: post.length
        })),
        tokenUsage: data.usage
      };
      
      // Cache the result
      if (config.cacheEnabled) {
        analysisCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }
      
      return result;
    } else {
      // Return mock data if API is not configured
      return generateMockPosts(topic, options);
    }
  } catch (error) {
    console.error('Post generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch top-performing posts about a topic for research
 * @param {string} topic - The topic to research
 * @returns {Promise<string>} Research text about top posts
 */
async function fetchTopPostsForTopic(topic) {
  try {
    // Simple mock implementation - in a real environment this would call an API
    return `Top posts about "${topic}" typically include factual information, questions to engage the audience, and 
            trending hashtags. The most successful posts are those with compelling statistics or surprising facts.
            They often have a clear call to action and use visual elements where possible.`;
  } catch (error) {
    console.error('Error fetching top posts:', error);
    return '';
  }
}

/**
 * Extract insights from analysis text
 * @param {string} text - Full analysis text
 * @returns {Array} Extracted insights
 */
function extractInsights(text) {
  const insightMarkers = [
    /insights?:?\s*([\s\S]+?)(?=\n\n|recommendations|strategy|$)/i,
    /analysis:?\s*([\s\S]+?)(?=\n\n|recommendations|strategy|$)/i,
    /engagement:?\s*([\s\S]+?)(?=\n\n|recommendations|strategy|$)/i
  ];
  
  let insightSection = '';
  
  // Try to find an insights section
  for (const marker of insightMarkers) {
    const match = text.match(marker);
    if (match && match[1]) {
      insightSection = match[1].trim();
      break;
    }
  }
  
  // If no section found, use the first third of the text
  if (!insightSection) {
    const lines = text.split('\n');
    insightSection = lines.slice(0, Math.floor(lines.length / 3)).join('\n');
  }
  
  // Extract bullet points or numbered items
  const bulletRegex = /[-•*]\s+([^•*\n]+)/g;
  const numberedRegex = /\d+\.\s+([^\n]+)/g;
  
  let insights = [];
  let match;
  
  while ((match = bulletRegex.exec(insightSection)) !== null) {
    insights.push(match[1].trim());
  }
  
  while ((match = numberedRegex.exec(insightSection)) !== null) {
    insights.push(match[1].trim());
  }
  
  // If no bullet points found, use sentences
  if (insights.length === 0) {
    const sentences = insightSection.match(/[^.!?]+[.!?]+/g) || [];
    insights = sentences.map(s => s.trim()).filter(s => s.length > 15 && s.length < 150);
  }
  
  // Limit to 5 insights maximum
  return insights.slice(0, 5);
}

/**
 * Extract recommendations from analysis text
 * @param {string} text - Full analysis text
 * @returns {Array} Extracted recommendations
 */
function extractRecommendations(text) {
  const recMarkers = [
    /recommendations?:?\s*([\s\S]+?)(?=\n\n|conclusion|$)/i,
    /strategy:?\s*([\s\S]+?)(?=\n\n|conclusion|$)/i,
    /suggestions?:?\s*([\s\S]+?)(?=\n\n|conclusion|$)/i,
    /action items:?\s*([\s\S]+?)(?=\n\n|conclusion|$)/i
  ];
  
  let recSection = '';
  
  // Try to find a recommendations section
  for (const marker of recMarkers) {
    const match = text.match(marker);
    if (match && match[1]) {
      recSection = match[1].trim();
      break;
    }
  }
  
  // If no section found, use the last third of the text
  if (!recSection) {
    const lines = text.split('\n');
    recSection = lines.slice(Math.floor(lines.length * 2 / 3)).join('\n');
  }
  
  // Extract bullet points or numbered items
  const bulletRegex = /[-•*]\s+([^•*\n]+)/g;
  const numberedRegex = /\d+\.\s+([^\n]+)/g;
  
  let recommendations = [];
  let match;
  
  while ((match = bulletRegex.exec(recSection)) !== null) {
    recommendations.push(match[1].trim());
  }
  
  while ((match = numberedRegex.exec(recSection)) !== null) {
    recommendations.push(match[1].trim());
  }
  
  // If no bullet points found, use sentences
  if (recommendations.length === 0) {
    const sentences = recSection.match(/[^.!?]+[.!?]+/g) || [];
    recommendations = sentences.map(s => s.trim()).filter(s => s.length > 15 && s.length < 150);
  }
  
  // Limit to 5 recommendations maximum
  return recommendations.slice(0, 5);
}

/**
 * Extract posts from generation text
 * @param {string} text - Full generation text
 * @param {number} expectedCount - Expected number of posts
 * @returns {Array} Extracted posts
 */
function extractPosts(text, expectedCount) {
  const postMarkers = [
    /Post \d+:?\s*([\s\S]+?)(?=Post \d+:|$)/gi,
    /Tweet \d+:?\s*([\s\S]+?)(?=Tweet \d+:|$)/gi,
    /\d+[.):]\s*([\s\S]+?)(?=\d+[.):]\s*|$)/g,
    /[""]([^""]+)[""]/g
  ];
  
  let posts = [];
  
  // Try different extraction methods
  for (const marker of postMarkers) {
    let match;
    const matches = [];
    
    while ((match = marker.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 0) {
        matches.push(match[1].trim());
      }
    }
    
    if (matches.length > 0) {
      posts = matches;
      break;
    }
  }
  
  // If no posts found through markers, try splitting by newlines
  if (posts.length === 0) {
    const lines = text.split('\n\n').filter(line => line.trim().length > 0);
    posts = lines.filter(line => line.length < 280);
  }
  
  // Convert posts to structured format
  return posts.slice(0, expectedCount).map((post, index) => {
    // Check if post exceeds character limit
    const isOverLimit = post.length > 280;
    
    return {
      id: index + 1,
      content: isOverLimit ? post.substring(0, 277) + '...' : post,
      characterCount: isOverLimit ? 280 : post.length,
      isOverLimit: isOverLimit
    };
  });
}

/**
 * Generate mock analysis data for testing
 * @private
 */
function generateMockAnalysis(profileData, options) {
  const username = profileData.user?.username || 'user';
  const tweetCount = profileData.tweets?.length || 0;
  
  return {
    success: true,
    engagementInsights: [
      `Posts with images receive 40% more engagement`,
      `Tweets posted between 9-11am get the highest engagement`,
      `Longer tweets (>150 characters) perform better than short ones`,
      `Questions in tweets generate 30% more replies`
    ],
    growthStrategy: [
      `Increase posting frequency from ${tweetCount} to 5-7 tweets per week`,
      `Engage more with industry thought leaders`,
      `Use more visual content (images, videos, infographics)`,
      `Create thread-style content for complex topics`
    ],
    fullAnalysis: `Profile Analysis for @${username}\n\nEngagement Insights:\n- Posts with images receive 40% more engagement\n- Tweets posted between 9-11am get the highest engagement\n- Longer tweets (>150 characters) perform better than short ones\n- Questions in tweets generate 30% more replies\n\nGrowth Strategy:\n- Increase posting frequency from ${tweetCount} to 5-7 tweets per week\n- Engage more with industry thought leaders\n- Use more visual content (images, videos, infographics)\n- Create thread-style content for complex topics`,
    tokenUsage: {
      promptTokens: 250,
      completionTokens: 350,
      totalTokens: 600
    }
  };
}

/**
 * Generate mock posts for testing
 * @private
 */
function generateMockPosts(topic, options) {
  const postType = options.type || 'engagement';
  const tone = options.tone || 'professional';
  const includeHashtags = options.includeHashtags !== false;
  const includeEmojis = options.includeEmojis !== false;
  const count = options.count || 3;
  
  const postTemplates = [
    `Just published a new guide on ${topic}! Learn how to improve your results by up to 30% with these proven strategies. Check it out! ${includeHashtags ? '#' + topic.replace(/\s+/g, '') + ' #tips' : ''} ${includeEmojis ? '📈 ✨' : ''}`,
    
    `Question for my network: What's your biggest challenge with ${topic}? I'm gathering insights for an upcoming project and would love to hear your thoughts! ${includeHashtags ? '#' + topic.replace(/\s+/g, '') + ' #feedback' : ''} ${includeEmojis ? '🤔 💭' : ''}`,
    
    `5 things I wish I knew before starting with ${topic}:\n1. Start small\n2. Consistency beats perfection\n3. Learn from failures\n4. Build a community\n5. Stay adaptable\n${includeHashtags ? '#' + topic.replace(/\s+/g, '') + ' #lessons' : ''} ${includeEmojis ? '🔑 💡' : ''}`,
    
    `Excited to share that our latest ${topic} project has launched! We've been working on this for months and can't wait to hear what you think. ${includeHashtags ? '#' + topic.replace(/\s+/g, '') + ' #launch' : ''} ${includeEmojis ? '🚀 🎉' : ''}`,
    
    `Did you know: 73% of professionals say that ${topic} is their top priority this year. Are you among them? ${includeHashtags ? '#' + topic.replace(/\s+/g, '') + ' #trends' : ''} ${includeEmojis ? '📊 👀' : ''}`
  ];
  
  // Select appropriate templates based on post type
  let selectedTemplates = [];
  
  switch(postType) {
    case 'engagement':
      selectedTemplates = [0, 1, 4];
      break;
    case 'informative':
      selectedTemplates = [0, 2, 4];
      break;
    case 'promotional':
      selectedTemplates = [0, 3, 4];
      break;
    case 'question':
      selectedTemplates = [1, 2, 4];
      break;
    default:
      selectedTemplates = [0, 1, 2];
  }
  
  // Generate the requested number of posts
  const posts = [];
  for (let i = 0; i < count; i++) {
    const templateIndex = selectedTemplates[i % selectedTemplates.length];
    const postContent = postTemplates[templateIndex];
    
    posts.push({
      id: i + 1,
      content: postContent,
      characterCount: postContent.length,
      isOverLimit: postContent.length > 280
    });
  }
  
  return {
    success: true,
    posts: posts,
    topic: topic,
    options: {
      type: postType,
      tone: tone,
      includeHashtags,
      includeEmojis
    },
    tokenUsage: {
      promptTokens: 150,
      completionTokens: 250,
      totalTokens: 400
    }
  };
}

/**
 * Check token availability and usage
 * @returns {Promise<Object>} Token availability info
 */
export async function checkTokenAvailability() {
  // For mock implementation, return constant data
  // In a real implementation, this would check with the API
  return {
    available: true,
    used: 1250,
    remaining: 98750,
    limit: 100000,
    resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime(),
    usageStats: {
      usageHistory: [
        { date: '2023-07-01', tokens: 120 },
        { date: '2023-07-02', tokens: 350 },
        { date: '2023-07-03', tokens: 180 }
      ],
      cacheSavings: 450
    }
  };
}

// Initialize from storage when module loads
chrome.storage.local.get(['grokApiConfig'], (result) => {
  if (result.grokApiConfig) {
    configure(result.grokApiConfig);
  }
});

/**
 * Alias for analyzeProfile - used to maintain compatibility with background.js imports
 */
export const analyzeContent = analyzeProfile;

/**
 * Alias for analyzeProfile - used to maintain compatibility with background.js imports
 */
export const compareContent = analyzeProfile;