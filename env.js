// env.js - Environment configuration for X-Analyzer
// This module exports configuration objects for Twitter and X API integration
// ⚠️ IMPORTANT: Replace the placeholder tokens below with your real X API credentials

console.log('🔧 Loading X Profile Analyzer Environment Configuration...');

// ⚠️ SETUP REQUIRED: Get your real X API credentials from https://developer.twitter.com/
// Updated with real X API credentials
const DEFAULT_CONFIG = {
  twitter: {
    config1: {
      xApiKey: '***REMOVED_API_KEY***', // Your X API Key
      xApiKeySecret: '***REMOVED_API_SECRET***', // Your X API Key Secret
      clientId: 'UWJReXE3QkRDa2ZRcWtQTjlfbmY6MTpjaQ', // Your Client ID
      clientSecret: '***REMOVED_CLIENT_SECRET***', // Your Client Secret
      bearerToken: '***REMOVED_BEARER_TOKEN***', // Your actual X API Bearer Token
      accessToken: '***REMOVED_ACCESS_TOKEN***', // Your Access Token
      accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***', // Your Access Token Secret
      baseUrl: 'https://api.twitter.com/2'
    },
    config2: {
      bearerToken: '***REMOVED_BEARER_TOKEN***', // Backup Bearer Token
      xApiKey: '***REMOVED_API_KEY***', // Backup API Key
      xApiKeySecret: '***REMOVED_API_SECRET***', // Backup API Key Secret
      clientId: 'UWJReXE3QkRDa2ZRcWtQTjlfbmY6MTpjaQ', // Backup Client ID
      clientSecret: '***REMOVED_CLIENT_SECRET***', // Backup Client Secret
      accessToken: '***REMOVED_ACCESS_TOKEN***', // Backup Access Token
      accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***', // Backup Access Token Secret
      baseUrl: 'https://api.twitter.com/2'
    }
  },
  grokAi: {
    // Optional: Grok AI integration (if available)
    apiKey: '', // Your Grok AI API key
    baseUrl: 'https://api.grok.com/v1'
  },
  proxy: {
    enabled: false, // Temporarily disabled until proxy server credentials are updated
    host: '143.198.111.238', // DigitalOcean proxy server
    port: '3000',
    protocol: 'http',
    path: '/api/proxy',
    auth: {
      username: '', // Contact admin for proxy credentials
      password: ''
    },
    fallbackToDirect: true,
    timeout: 15000,
    retryAttempts: 3,
    retryDelay: 1000
  }
};

// Environment variable access helper
function getEnvVar(name, defaultValue) {
  try {
    // Check if we're in a browser extension environment
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // We'll handle this via storage instead of environment variables
      return defaultValue;
    }
    
    // For Node.js/server environments
    if (typeof process !== 'undefined' && process.env && process.env[name] !== undefined) {
      return process.env[name];
    }
    
    // For webpack DefinePlugin
    if (typeof __ENV__ !== 'undefined' && __ENV__ && __ENV__[name] !== undefined) {
      return __ENV__[name];
    }
  } catch (e) {
    console.warn(`Error accessing environment variable ${name}: ${e.message}`);
  }
  
  return defaultValue;
}

// Main configuration object
export const twitter = {
  config1: {
    xApiKey: getEnvVar('TWITTER_API_KEY', DEFAULT_CONFIG.twitter.config1.xApiKey),
    xApiKeySecret: getEnvVar('TWITTER_API_KEY_SECRET', DEFAULT_CONFIG.twitter.config1.xApiKeySecret),
    clientId: getEnvVar('TWITTER_CLIENT_ID', DEFAULT_CONFIG.twitter.config1.clientId),
    clientSecret: getEnvVar('TWITTER_CLIENT_SECRET', DEFAULT_CONFIG.twitter.config1.clientSecret),
    bearerToken: getEnvVar('TWITTER_BEARER_TOKEN', DEFAULT_CONFIG.twitter.config1.bearerToken),
    accessToken: getEnvVar('TWITTER_ACCESS_TOKEN', DEFAULT_CONFIG.twitter.config1.accessToken),
    accessTokenSecret: getEnvVar('TWITTER_ACCESS_TOKEN_SECRET', DEFAULT_CONFIG.twitter.config1.accessTokenSecret),
    baseUrl: getEnvVar('TWITTER_API_BASE_URL', DEFAULT_CONFIG.twitter.config1.baseUrl)
  },
  config2: {
    xApiKey: getEnvVar('TWITTER_API_2_KEY', DEFAULT_CONFIG.twitter.config2.xApiKey),
    xApiKeySecret: getEnvVar('TWITTER_API_2_KEY_SECRET', DEFAULT_CONFIG.twitter.config2.xApiKeySecret),
    clientId: getEnvVar('TWITTER_CLIENT_2_ID', DEFAULT_CONFIG.twitter.config2.clientId),
    clientSecret: getEnvVar('TWITTER_CLIENT_2_SECRET', DEFAULT_CONFIG.twitter.config2.clientSecret),
    bearerToken: getEnvVar('TWITTER_BEARER_2_TOKEN', DEFAULT_CONFIG.twitter.config2.bearerToken),
    accessToken: getEnvVar('TWITTER_ACCESS_2_TOKEN', DEFAULT_CONFIG.twitter.config2.accessToken),
    accessTokenSecret: getEnvVar('TWITTER_ACCESS_2_TOKEN_SECRET', DEFAULT_CONFIG.twitter.config2.accessTokenSecret),
    baseUrl: getEnvVar('TWITTER_API_2_BASE_URL', DEFAULT_CONFIG.twitter.config2.baseUrl)
  }
};

export const grokAi = {
  apiKey: getEnvVar('GROK_AI_API_KEY', DEFAULT_CONFIG.grokAi.apiKey),
  baseUrl: getEnvVar('GROK_AI_BASE_URL', DEFAULT_CONFIG.grokAi.baseUrl)
};

export const proxyConfig = {
  enabled: getEnvVar('PROXY_ENABLED', 'true') === 'true',
  host: getEnvVar('PROXY_HOST', DEFAULT_CONFIG.proxy.host),
  port: getEnvVar('PROXY_PORT', DEFAULT_CONFIG.proxy.port),
  protocol: getEnvVar('PROXY_PROTOCOL', DEFAULT_CONFIG.proxy.protocol),
  path: getEnvVar('PROXY_PATH', DEFAULT_CONFIG.proxy.path),
  auth: {
    username: getEnvVar('PROXY_USERNAME', DEFAULT_CONFIG.proxy.auth.username),
    password: getEnvVar('PROXY_PASSWORD', DEFAULT_CONFIG.proxy.auth.password)
  },
  fallbackToDirect: getEnvVar('PROXY_FALLBACK_DIRECT', 'true') === 'true',
  timeout: parseInt(getEnvVar('PROXY_TIMEOUT', DEFAULT_CONFIG.proxy.timeout)),
  retryAttempts: parseInt(getEnvVar('PROXY_RETRY_ATTEMPTS', DEFAULT_CONFIG.proxy.retryAttempts)),
  retryDelay: parseInt(getEnvVar('PROXY_RETRY_DELAY', DEFAULT_CONFIG.proxy.retryDelay))
};

// Construct full proxy URL
export const proxyUrl = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}${proxyConfig.path}`;

// Token validation functions
const isValidBearerToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  
  // Real X API bearer tokens start with 'AAAA' and are long
  // They should not be URL encoded in our config
  const cleanToken = token.trim();
  return cleanToken.startsWith('AAAA') && cleanToken.length > 80 && !cleanToken.includes('%');
};

const isValidApiKey = (key) => {
  return !!key && typeof key === 'string' && key.trim().length >= 10;
};

// Enhanced validation function
export function validateApiKeys() {
  const config1Valid = {
    bearerToken: isValidBearerToken(twitter.config1.bearerToken),
    apiKey: isValidApiKey(twitter.config1.xApiKey),
    clientId: isValidApiKey(twitter.config1.clientId),
    clientSecret: isValidApiKey(twitter.config1.clientSecret),
    overall: false
  };
  
  config1Valid.overall = config1Valid.bearerToken || (config1Valid.apiKey && config1Valid.clientSecret);
  
  const config2Valid = {
    bearerToken: isValidBearerToken(twitter.config2.bearerToken),
    apiKey: isValidApiKey(twitter.config2.xApiKey),
    clientId: isValidApiKey(twitter.config2.clientId),
    clientSecret: isValidApiKey(twitter.config2.clientSecret),
    overall: false
  };
  
  config2Valid.overall = config2Valid.bearerToken || (config2Valid.apiKey && config2Valid.clientSecret);
  
  return {
    config1: config1Valid,
    config2: config2Valid,
    anyValid: config1Valid.overall || config2Valid.overall,
    hasValidBearerToken: config1Valid.bearerToken || config2Valid.bearerToken,
    needsSetup: !config1Valid.overall && !config2Valid.overall
  };
}

// Configuration status and setup guidance
const validation = validateApiKeys();

if (validation.needsSetup) {
  console.warn(`
🚨 X API SETUP REQUIRED 🚨

Your X Profile Analyzer needs real API credentials to fetch live data.

📋 SETUP INSTRUCTIONS:
1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new app or use an existing one
3. Get your Bearer Token from the "Keys and tokens" section
4. Update the tokens in env.js file:
   - Replace bearerToken with your real token
   - Optionally add API Key and Client credentials

🔧 CURRENT STATUS:
- Config 1 Bearer Token: ${validation.config1.bearerToken ? '✅ Valid' : '❌ Missing/Invalid'}
- Config 2 Bearer Token: ${validation.config2.bearerToken ? '✅ Valid' : '❌ Missing/Invalid'}
- Proxy Server: ${proxyConfig.enabled ? '✅ Enabled' : '❌ Disabled'}

⚠️ Without valid credentials, the extension will show estimated/fallback data only.
  `);
} else {
  console.log('✅ X API credentials configured successfully');
}

// Enhanced logging
console.log('🔧 Environment Configuration Status:', {
  twitterConfig1: {
    hasApiKey: !!twitter.config1.xApiKey,
    hasBearerToken: validation.config1.bearerToken,
    hasClientCredentials: !!(twitter.config1.clientId && twitter.config1.clientSecret),
    valid: validation.config1.overall
  },
  twitterConfig2: {
    hasApiKey: !!twitter.config2.xApiKey,
    hasBearerToken: validation.config2.bearerToken,
    hasClientCredentials: !!(twitter.config2.clientId && twitter.config2.clientSecret),
    valid: validation.config2.overall
  },
  grokAi: {
    hasApiKey: !!grokAi.apiKey
  },
  proxy: {
    enabled: proxyConfig.enabled,
    url: proxyUrl,
    hasAuth: !!(proxyConfig.auth.username && proxyConfig.auth.password)
  },
  setupRequired: validation.needsSetup
});

// Export validation results
export { validation as apiValidation };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.XAnalyzerEnv = {
    twitter,
    grokAi,
    proxyConfig,
    proxyUrl,
    apiValidation: validation,
    validateApiKeys
  };
}