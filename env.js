// env.js - Environment configuration for X-Analyzer
// This module exports configuration objects for Twitter and Grok AI APIs
// Environment variables are automatically injected by dotenv-webpack during build

// Twitter API configurations
// We maintain two separate configs for redundancy and rate limit management
export const twitter = {
    // Primary Twitter API configuration
    config1: {
      xApiKey: process.env.TWITTER_API_1_X_API_KEY, // API key for authentication
      clientId: process.env.TWITTER_API_1_CLIENT_ID, // OAuth 2.0 client ID
      clientSecret: process.env.TWITTER_API_1_CLIENT_SECRET, // OAuth 2.0 client secret
      bearerToken: process.env.TWITTER_API_1_BEARER_TOKEN, // App-only authentication token
      accessToken: process.env.TWITTER_API_1_ACCESS_TOKEN, // User context authentication token
      accessTokenSecret: process.env.TWITTER_API_1_ACCESS_TOKEN_SECRET, // User context token secret
      baseUrl: process.env.TWITTER_API_1_BASE_URL // Twitter API v2 base endpoint
    },
    // Secondary/backup Twitter API configuration
    config2: {
      xApiKey: process.env.TWITTER_API_2_X_API_KEY,
      xApiKeySecret: process.env.TWITTER_API_2_X_API_KEY_SECRET, // Additional secret for API key
      clientId: process.env.TWITTER_API_2_CLIENT_ID,
      clientSecret: process.env.TWITTER_API_2_CLIENT_SECRET,
      bearerToken: process.env.TWITTER_API_2_BEARER_TOKEN,
      accessToken: process.env.TWITTER_API_2_ACCESS_TOKEN,
      accessTokenSecret: process.env.TWITTER_API_2_ACCESS_TOKEN_SECRET,
      baseUrl: process.env.TWITTER_API_2_BASE_URL
    }
  };
  
// Grok AI API configuration
// Used for AI-powered content analysis and recommendations
export const grokAi = {
    apiKey: process.env.GROK_AI_API_KEY, // Authentication key for Grok AI API
    baseUrl: process.env.GROK_AI_BASE_URL // Grok AI API endpoint
  };