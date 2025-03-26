// env.js - Environment configuration for X-Analyzer
// This module exports configuration objects for Twitter and Grok AI APIs
// Environment variables are automatically injected by dotenv-webpack during build

// Hardcoded fallback values for when environment variables are not available
const fallbacks = {
  twitter: {
    config1: {
      xApiKey: '***REMOVED_XAI_KEY***',
      clientId: 'YXExZVdNYV94WVZ1Z1RMUk5CT3o6MTpjaQ',
      clientSecret: '***REMOVED_CLIENT_SECRET***',
      // Standard format for X/Twitter API v2 Bearer Token (must start with AAAAAAAAAA)
      bearerToken: '***REMOVED_BEARER_TOKEN***',
      accessToken: '***REMOVED_ACCESS_TOKEN***',
      accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***',
      baseUrl: 'https://api.twitter.com/2'
    },
    config2: {
      xApiKey: '***REMOVED_API_KEY***',
      xApiKeySecret: '***REMOVED_API_SECRET***',
      clientId: 'NkQ4LUtHV213R1FUN1cycDNlSFI6MTpjaQ',
      clientSecret: '***REMOVED_CLIENT_SECRET***',
      // Alternative bearer token format - clean version without URL encoding
      bearerToken: '***REMOVED_BEARER_TOKEN***',
      accessToken: '***REMOVED_ACCESS_TOKEN***',
      accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***',
      baseUrl: 'https://api.twitter.com/2'
    }
  },
  grokAi: {
    apiKey: '***REMOVED_XAI_KEY***',
    baseUrl: 'https://api.grok.com/v1'
  }
};

// Twitter API configurations
// We maintain two separate configs for redundancy and rate limit management
export const twitter = {
    // Primary Twitter API configuration
    config1: {
      xApiKey: process.env.TWITTER_API_1_X_API_KEY || fallbacks.twitter.config1.xApiKey,
      clientId: process.env.TWITTER_API_1_CLIENT_ID || fallbacks.twitter.config1.clientId,
      clientSecret: process.env.TWITTER_API_1_CLIENT_SECRET || fallbacks.twitter.config1.clientSecret,
      bearerToken: process.env.TWITTER_API_1_BEARER_TOKEN || fallbacks.twitter.config1.bearerToken,
      accessToken: process.env.TWITTER_API_1_ACCESS_TOKEN || fallbacks.twitter.config1.accessToken,
      accessTokenSecret: process.env.TWITTER_API_1_ACCESS_TOKEN_SECRET || fallbacks.twitter.config1.accessTokenSecret,
      baseUrl: process.env.TWITTER_API_1_BASE_URL || fallbacks.twitter.config1.baseUrl
    },
    // Secondary/backup Twitter API configuration
    config2: {
      xApiKey: process.env.TWITTER_API_2_X_API_KEY || fallbacks.twitter.config2.xApiKey,
      xApiKeySecret: process.env.TWITTER_API_2_X_API_KEY_SECRET || fallbacks.twitter.config2.xApiKeySecret,
      clientId: process.env.TWITTER_API_2_CLIENT_ID || fallbacks.twitter.config2.clientId,
      clientSecret: process.env.TWITTER_API_2_CLIENT_SECRET || fallbacks.twitter.config2.clientSecret,
      bearerToken: process.env.TWITTER_API_2_BEARER_TOKEN || fallbacks.twitter.config2.bearerToken,
      accessToken: process.env.TWITTER_API_2_ACCESS_TOKEN || fallbacks.twitter.config2.accessToken,
      accessTokenSecret: process.env.TWITTER_API_2_ACCESS_TOKEN_SECRET || fallbacks.twitter.config2.accessTokenSecret,
      baseUrl: process.env.TWITTER_API_2_BASE_URL || fallbacks.twitter.config2.baseUrl
    }
  };
  
// Grok AI API configuration
// Used for AI-powered content analysis and recommendations
export const grokAi = {
    apiKey: process.env.GROK_AI_API_KEY || fallbacks.grokAi.apiKey,
    baseUrl: process.env.GROK_AI_BASE_URL || fallbacks.grokAi.baseUrl
  };

// Log configuration status to help with debugging
console.log('Environment loaded status:', {
  twitterConfig1Bearer: twitter.config1.bearerToken ? 'Available' : 'Missing',
  twitterConfig2Bearer: twitter.config2.bearerToken ? 'Available' : 'Missing',
  grokApiKey: grokAi.apiKey ? 'Available' : 'Missing',
});