// Enhanced X Profile Analyzer Background Script
// Fixed version with comprehensive proxy integration and comprehensive rate limiting

console.log('🚀 X Profile Analyzer background script loading...');

// Enhanced Configuration with multiple API credentials for optimal rate limiting
const TWITTER_CONFIG = {
  config1: {
    xApiKey: '***REMOVED_API_KEY***',
    xApiKeySecret: '***REMOVED_API_SECRET***',
    clientId: 'UWJReXE3QkRDa2ZRcWtQTjlfbmY6MTpjaQ',
    clientSecret: '***REMOVED_CLIENT_SECRET***',
    bearerToken: '***REMOVED_BEARER_TOKEN***',
    accessToken: '***REMOVED_ACCESS_TOKEN***',
    accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***',
    baseUrl: 'https://api.twitter.com/2'
  },
  config2: {
    bearerToken: '***REMOVED_BEARER_TOKEN***',
    xApiKey: '***REMOVED_API_KEY***',
    xApiKeySecret: '***REMOVED_API_SECRET***',
    clientId: 'UWJReXE3QkRDa2ZRcWtQTjlfbmY6MTpjaQ',
    clientSecret: '***REMOVED_CLIENT_SECRET***',
    accessToken: '***REMOVED_ACCESS_TOKEN***',
    accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***',
    baseUrl: 'https://api.twitter.com/2'
  },
  config3: {
    xApiKey: '***REMOVED_API_KEY***',
    xApiKeySecret: '***REMOVED_API_SECRET***',
    clientId: 'ZTlOQ3RaaWVzRkdNUEdqM0lQZ286MTpjaQ',
    clientSecret: '***REMOVED_CLIENT_SECRET***',
    bearerToken: '***REMOVED_BEARER_TOKEN***',
    accessToken: '***REMOVED_ACCESS_TOKEN***',
    accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***',
    baseUrl: 'https://api.twitter.com/2'
  },
  config4: {
    xApiKey: '***REMOVED_API_KEY***',
    xApiKeySecret: '***REMOVED_API_SECRET***',
    clientId: 'ZTlOQ3RaaWVzRkdNUEdqM0lQZ286MTpjaQ',
    clientSecret: '***REMOVED_CLIENT_SECRET***',
    bearerToken: '***REMOVED_BEARER_TOKEN***',
    accessToken: '***REMOVED_ACCESS_TOKEN***',
    accessTokenSecret: '***REMOVED_ACCESS_TOKEN_SECRET***',
    baseUrl: 'https://api.twitter.com/2'
  }
};

const PROXY_CONFIG = {
  enabled: true, // Re-enabled for better CORS handling
  host: '143.198.111.238',
  port: '3000',
  protocol: 'http',
  path: '/api/proxy',
  fallbackToDirect: true,
  timeout: 15000,
  retryAttempts: 3,
  retryDelay: 1000
};

const PROXY_URL = `${PROXY_CONFIG.protocol}://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}${PROXY_CONFIG.path}`;

// Enhanced Proxy Integration System for X Profile Analyzer
// This fixes CORS issues and ensures reliable API routing through the proxy server

class ProxyClient {
  constructor() {
    this.proxyUrl = 'https://143.198.111.238:3000/api/proxy';
    this.backupProxyUrl = 'https://x-analyzer-backup.herokuapp.com/api/proxy';
    this.isProxyAvailable = false;
    this.lastProxyCheck = 0;
    this.proxyCheckInterval = 60000; // Check every minute
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.timeout = 15000;
    
    // Initialize proxy status
    this.checkProxyStatus();
  }

  // Test proxy connectivity
  async checkProxyStatus() {
    const now = Date.now();
    
    // Don't check too frequently
    if (now - this.lastProxyCheck < this.proxyCheckInterval) {
      return this.isProxyAvailable;
    }

    this.lastProxyCheck = now;
    
    try {
      console.log('🔍 Checking proxy server connectivity...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.proxyUrl.replace('/api/proxy', '/health')}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'X-Profile-Analyzer/2.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this.isProxyAvailable = true;
        console.log('✅ Proxy server is available');
        return true;
      } else {
        throw new Error(`Proxy returned ${response.status}`);
      }
    } catch (error) {
      console.warn('⚠️ Primary proxy unavailable, trying backup...', error.message);
      
      // Try backup proxy
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${this.backupProxyUrl.replace('/api/proxy', '/health')}`, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          this.proxyUrl = this.backupProxyUrl;
          this.isProxyAvailable = true;
          console.log('✅ Backup proxy server is available');
          return true;
        }
      } catch (backupError) {
        console.error('❌ Both proxy servers unavailable:', backupError.message);
      }
      
      this.isProxyAvailable = false;
      return false;
    }
  }

  // Make a request through the proxy with retry logic
  async makeProxyRequest(endpoint, params = {}, method = 'GET', retryCount = 0) {
    // Check proxy availability first
    if (!this.isProxyAvailable) {
      await this.checkProxyStatus();
      
      if (!this.isProxyAvailable) {
        throw new Error('Proxy server is not available');
      }
    }

    const requestData = {
      endpoint: endpoint.replace(/^\//, ''), // Remove leading slash
      method: method.toUpperCase(),
      params: params || {},
      timestamp: Date.now()
    };

    console.log(`🌐 Making proxy request to: ${endpoint}`);
    console.log(`📋 Request data:`, requestData);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'X-Profile-Analyzer/2.0',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`📡 Proxy response status: ${response.status} ${response.statusText}`);

      // Handle different response statuses
      if (response.status === 429) {
        // Rate limit hit
        const retryAfter = response.headers.get('Retry-After') || 60;
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        // Server errors - try backup proxy or retry
        if (retryCount < this.maxRetries) {
          console.log(`🔄 Server error ${response.status}, retrying... (${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
          return this.makeProxyRequest(endpoint, params, method, retryCount + 1);
        }
        throw new Error(`Proxy server error: ${response.status}`);
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      // Parse successful response
      const data = await response.json();
      console.log('✅ Proxy request successful');
      
      return {
        data: data,
        headers: response.headers,
        status: response.status,
        ok: response.ok
      };

  } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - proxy server took too long to respond');
      }

      // Handle network errors
      if (error.message.includes('fetch')) {
        this.isProxyAvailable = false;
        
        if (retryCount < this.maxRetries) {
          console.log(`🔄 Network error, retrying... (${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
          return this.makeProxyRequest(endpoint, params, method, retryCount + 1);
        }
      }

      throw error;
    }
  }

  // Get proxy status for UI display
  getProxyStatus() {
    return {
      available: this.isProxyAvailable,
      url: this.proxyUrl,
      lastChecked: this.lastProxyCheck,
      nextCheck: this.lastProxyCheck + this.proxyCheckInterval
    };
  }
}

// Enhanced X API Client with Proxy Integration
class XAPIClient {
  constructor() {
    this.proxyClient = new ProxyClient();
    this.rateLimitTracker = null; // Will be set when rateLimitTracker is available
    this.directAPI = {
      baseUrl: 'https://api.twitter.com/2'
    };
    console.log('🔧 XAPIClient initialized with enhanced 4-config support');
  }

  // Set rate limit tracker reference
  setRateLimitTracker(tracker) {
    this.rateLimitTracker = tracker;
  }

  // Make an API request (tries proxy first, then direct)
  async makeAPIRequest(endpoint, params = {}) {
    console.log(`🚀 Starting API request for: ${endpoint}`);
    
    let lastError = null;
    
    // First, try proxy if available
    if (this.proxyClient.isProxyAvailable) {
      try {
        console.log('🔄 Attempting proxy request...');
        const result = await this.proxyClient.makeProxyRequest(endpoint, params);
        
        // Record successful request for rate limiting
        if (this.rateLimitTracker) {
          this.rateLimitTracker.recordRequest('proxy', result.headers);
        }
        
        return {
          ...result,
          source: 'proxy',
          success: true
        };
      } catch (proxyError) {
        console.warn('⚠️ Proxy request failed:', proxyError.message);
        lastError = proxyError;
        
        // Mark proxy as unavailable if it's a connection issue
        if (proxyError.message.includes('fetch') || proxyError.message.includes('timeout')) {
          this.proxyClient.isProxyAvailable = false;
        }
      }
    }

    // If proxy failed or unavailable, try direct API with best available config
    console.log('🔄 Attempting direct API request...');
    
    try {
      const bestConfigKey = this.rateLimitTracker ? 
        this.rateLimitTracker.getBestConfig(TWITTER_CONFIG) : 
        'config1';
        
      if (!bestConfigKey) {
        throw new Error('All API configurations have exceeded rate limits. Please wait for reset.');
      }

      // Get the actual config data
      const configData = TWITTER_CONFIG[bestConfigKey];
      if (!configData) {
        throw new Error(`Configuration ${bestConfigKey} not found`);
      }

      console.log(`🎯 Using ${bestConfigKey} for direct API request`);
      const result = await this.makeDirectAPIRequest(endpoint, params, { config: configData, configKey: bestConfigKey });
      
      // Record successful request
      if (this.rateLimitTracker) {
        this.rateLimitTracker.recordRequest(bestConfigKey, result.headers);
      }
      
      return {
        ...result,
        source: `direct-${bestConfigKey}`,
        configUsed: bestConfigKey,
        success: true
      };
    } catch (directError) {
      console.error('❌ Direct API request failed:', directError.message);
      
      // Handle rate limiting for the specific config that failed
      if (directError.message.includes('rate limit') || directError.message.includes('429')) {
        const configKey = this.rateLimitTracker?.getBestConfig(TWITTER_CONFIG) || 'config1';
        if (this.rateLimitTracker) {
          this.rateLimitTracker.handleRateLimitHit(configKey);
        }
      }
      
      // If both proxy and direct failed, throw the most relevant error
      const finalError = directError.message.includes('rate limit') ? directError : lastError || directError;
      throw finalError;
    }
  }

  // Make direct API request
  async makeDirectAPIRequest(endpoint, params, configData) {
    const baseUrl = this.directAPI.baseUrl;
    const url = new URL(`${baseUrl}/${endpoint.replace(/^\//, '')}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const headers = {
      'Authorization': `Bearer ${configData.config.bearerToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'X-Profile-Analyzer/2.0'
    };

    console.log(`🌐 Direct API request: ${url.toString().replace(configData.config.bearerToken, '[TOKEN]')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`📡 Direct API response: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a few minutes and try again.');
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.errors && errorData.errors.length > 0) {
            errorMessage = errorData.errors[0].message || errorMessage;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      return {
        data: data,
        headers: response.headers,
        status: response.status,
        ok: response.ok
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  // Get connection status for UI
  getConnectionStatus() {
    const proxyStatus = this.proxyClient.getProxyStatus();
    const rateLimitStatus = this.rateLimitTracker ? this.rateLimitTracker.getRateLimitStatus() : {};
    
    // Check if we have valid tokens across all configurations
    const hasValidTokens = Object.values(TWITTER_CONFIG).some(config => 
      config.bearerToken && 
      config.bearerToken.length > 80 && 
      config.bearerToken.startsWith('AAAA')
    );
    
    return {
      proxy: proxyStatus,
      rateLimits: rateLimitStatus,
      hasValidTokens,
      totalConfigs: Object.keys(TWITTER_CONFIG).length,
      availableConfigs: this.rateLimitTracker ? 
        Object.keys(TWITTER_CONFIG).filter(key => this.rateLimitTracker.canMakeRequest(key)).length : 
        0
    };
  }
}

// Enhanced Rate Limit Tracking System for X Profile Analyzer
class RateLimitTracker {
  constructor() {
    this.rateLimits = new Map();
    this.requestQueue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minInterval = 1000; // Minimum 1 second between requests
    
    // Initialize rate limit storage
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      const stored = await chrome.storage.local.get(['rateLimitData']);
      if (stored.rateLimitData) {
        // Restore rate limit data
        Object.entries(stored.rateLimitData).forEach(([key, value]) => {
          this.rateLimits.set(key, value);
        });
        console.log('✅ Rate limit data restored from storage');
      } else {
        // Initialize default rate limits
        this.initializeDefaultLimits();
      }
    } catch (error) {
      console.error('❌ Failed to initialize rate limit storage:', error);
      this.initializeDefaultLimits();
    }
  }

  initializeDefaultLimits() {
    const defaultLimits = {
      'config1': {
        used: 0,
        total: 300,
        resetTime: Date.now() + (15 * 60 * 1000), // 15 minutes from now
        window: 15 * 60 * 1000, // 15 minutes in ms
        lastReset: Date.now()
      },
      'config2': {
        used: 0,
        total: 300,
        resetTime: Date.now() + (15 * 60 * 1000),
        window: 15 * 60 * 1000,
        lastReset: Date.now()
      },
      'config3': {
        used: 0,
        total: 300,
        resetTime: Date.now() + (15 * 60 * 1000),
        window: 15 * 60 * 1000,
        lastReset: Date.now()
      },
      'config4': {
        used: 0,
        total: 300,
        resetTime: Date.now() + (15 * 60 * 1000),
        window: 15 * 60 * 1000,
        lastReset: Date.now()
      },
      'proxy': {
        used: 0,
        total: 1000, // Higher limit for proxy requests
        resetTime: Date.now() + (15 * 60 * 1000),
        window: 15 * 60 * 1000,
        lastReset: Date.now()
      }
    };

    Object.entries(defaultLimits).forEach(([key, value]) => {
      this.rateLimits.set(key, value);
    });

    this.saveToStorage();
    console.log('✅ Default rate limits initialized with 4 API configurations + proxy support (1,200 + 1,000 total requests per 15-minute window)');
  }

  async saveToStorage() {
    try {
      const rateLimitData = {};
      this.rateLimits.forEach((value, key) => {
        rateLimitData[key] = value;
      });
      
      await chrome.storage.local.set({ rateLimitData });
      console.log('💾 Rate limit data saved to storage');
    } catch (error) {
      console.error('❌ Failed to save rate limit data:', error);
    }
  }

  // Check if a config can make a request
  canMakeRequest(configKey) {
    const limit = this.rateLimits.get(configKey);
    if (!limit) {
      console.warn(`⚠️ No rate limit data for ${configKey}`);
      return false;
    }

    const now = Date.now();
    
    // Check if we need to reset the window
    if (now >= limit.resetTime) {
      this.resetRateLimit(configKey);
      return true;
    }

    // Check if we have requests remaining
    const remaining = limit.total - limit.used;
    console.log(`📊 ${configKey}: ${remaining}/${limit.total} requests remaining`);
    
    return remaining > 0;
  }

  // Reset rate limit for a config
  resetRateLimit(configKey) {
    const limit = this.rateLimits.get(configKey);
    if (limit) {
      limit.used = 0;
      limit.resetTime = Date.now() + limit.window;
      limit.lastReset = Date.now();
      
      console.log(`🔄 Rate limit reset for ${configKey}`);
      this.saveToStorage();
    }
  }

  // Record a request being made
  recordRequest(configKey, responseHeaders = null) {
    const limit = this.rateLimits.get(configKey);
    if (!limit) {
      console.warn(`⚠️ Cannot record request for unknown config: ${configKey}`);
      return;
    }

    // Increment usage
    limit.used++;
    this.lastRequestTime = Date.now();

    // Update from response headers if available
    if (responseHeaders) {
      const remaining = responseHeaders.get('x-rate-limit-remaining');
      const reset = responseHeaders.get('x-rate-limit-reset');
      
      if (remaining !== null) {
        const usedFromHeaders = limit.total - parseInt(remaining, 10);
        if (!isNaN(usedFromHeaders) && usedFromHeaders >= 0) {
          limit.used = usedFromHeaders;
          console.log(`📡 Updated ${configKey} usage from headers: ${limit.used}/${limit.total}`);
        }
      }
      
      if (reset !== null) {
        const resetTime = parseInt(reset, 10) * 1000; // Convert to milliseconds
        if (!isNaN(resetTime) && resetTime > Date.now()) {
          limit.resetTime = resetTime;
          console.log(`⏰ Updated ${configKey} reset time from headers: ${new Date(resetTime).toISOString()}`);
        }
      }
    }

    console.log(`📈 Request recorded for ${configKey}: ${limit.used}/${limit.total} used`);
    this.saveToStorage();
  }

  // Get the best available config from TWITTER_CONFIG object
  getBestConfig(twitterConfigObj) {
    const availableConfigs = [];

    // Handle both object and array inputs for backwards compatibility
    const configs = Array.isArray(twitterConfigObj) ? twitterConfigObj : Object.values(twitterConfigObj);
    const configKeys = Array.isArray(twitterConfigObj) ? 
      configs.map((_, i) => `config${i + 1}`) : 
      Object.keys(twitterConfigObj);

    configKeys.forEach((configKey, index) => {
      if (this.canMakeRequest(configKey)) {
        const limit = this.rateLimits.get(configKey);
        const remaining = limit.total - limit.used;
        availableConfigs.push({
          config: configs[index],
          configKey,
          remaining,
          index
        });
      }
    });

    if (availableConfigs.length === 0) {
      console.warn('⚠️ No API configurations available - all rate limits exceeded');
      return null; // No configs available
    }

    // Sort by remaining requests (descending)
    availableConfigs.sort((a, b) => b.remaining - a.remaining);
    
    const best = availableConfigs[0];
    console.log(`🎯 Selected ${best.configKey} with ${best.remaining} requests remaining out of ${availableConfigs.length} available configs`);
    
    return best.configKey; // Return just the config key for consistency
  }

  // Get rate limit status for UI display
  getRateLimitStatus() {
    const status = {};
    
    this.rateLimits.forEach((limit, configKey) => {
      const now = Date.now();
      const remaining = limit.total - limit.used;
      const timeToReset = Math.max(0, limit.resetTime - now);
      
      status[configKey] = {
        used: limit.used,
        total: limit.total,
        remaining,
        resetIn: timeToReset,
        resetAt: new Date(limit.resetTime).toISOString(),
        percentage: Math.round((limit.used / limit.total) * 100)
      };
    });

    return status;
  }

  // Queue a request to ensure proper spacing
  async queueRequest(requestFunction, configKey) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        execute: requestFunction,
        configKey,
        resolve,
        reject,
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  // Process the request queue with proper timing
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Ensure minimum interval between requests
      if (timeSinceLastRequest < this.minInterval) {
        const delay = this.minInterval - timeSinceLastRequest;
        console.log(`⏱️ Waiting ${delay}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        // Check if config is still available
        if (!this.canMakeRequest(request.configKey)) {
          throw new Error(`Rate limit exceeded for ${request.configKey}`);
        }

        const result = await request.execute();
        this.recordRequest(request.configKey, result?.headers);
        request.resolve(result);
    } catch (error) {
        console.error(`❌ Request failed for ${request.configKey}:`, error);
        request.reject(error);
      }
    }

    this.processing = false;
  }

  // Handle rate limit hit
  handleRateLimitHit(configKey, resetTime = null) {
    const limit = this.rateLimits.get(configKey);
    if (limit) {
      limit.used = limit.total; // Mark as fully used
      
      if (resetTime) {
        limit.resetTime = resetTime;
      } else {
        // Default to 15 minutes if no reset time provided
        limit.resetTime = Date.now() + (15 * 60 * 1000);
      }
      
      console.log(`🚫 Rate limit hit for ${configKey}. Reset at: ${new Date(limit.resetTime).toISOString()}`);
      this.saveToStorage();
    }
  }

  // Clear all rate limit data (for testing/reset)
  clearAllLimits() {
    this.rateLimits.clear();
    chrome.storage.local.remove(['rateLimitData']);
    this.initializeDefaultLimits();
    console.log('🗑️ All rate limit data cleared');
  }
}

// Initialize the rate limit tracker and API client
const rateLimitTracker = new RateLimitTracker();
const xApiClient = new XAPIClient();

// Set up the connection between tracker and API client
xApiClient.setRateLimitTracker(rateLimitTracker);

// Make global instances available
if (typeof window !== 'undefined') {
  window.rateLimitTracker = rateLimitTracker;
  window.xApiClient = xApiClient;
}

// Enhanced API configuration validation for all 4 configs
function validateApiConfig() {
  const isValidBearerToken = (token) => {
    return !!token && typeof token === 'string' && token.startsWith('AAAA') && token.length > 80;
  };

  const config1Valid = isValidBearerToken(TWITTER_CONFIG.config1.bearerToken);
  const config2Valid = isValidBearerToken(TWITTER_CONFIG.config2.bearerToken);
  const config3Valid = isValidBearerToken(TWITTER_CONFIG.config3.bearerToken);
  const config4Valid = isValidBearerToken(TWITTER_CONFIG.config4.bearerToken);

  return {
    config1: { overall: config1Valid, bearerToken: config1Valid },
    config2: { overall: config2Valid, bearerToken: config2Valid },
    config3: { overall: config3Valid, bearerToken: config3Valid },
    config4: { overall: config4Valid, bearerToken: config4Valid },
    anyValid: config1Valid || config2Valid || config3Valid || config4Valid,
    hasValidBearerToken: config1Valid || config2Valid || config3Valid || config4Valid,
    validConfigs: [config1Valid, config2Valid, config3Valid, config4Valid].filter(Boolean).length,
    needsSetup: !config1Valid && !config2Valid && !config3Valid && !config4Valid
  };
}

const API_VALIDATION = validateApiConfig();

// Global state management
let extensionInitialized = false;
let apiClient = null;
let analysisCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Enhanced API Configuration with proxy support
const API_CONFIG = {
  PRIMARY: {
    API_BASE_URL: 'https://api.twitter.com/2',
    BEARER_TOKEN: TWITTER_CONFIG.config1.bearerToken,
    API_KEY: TWITTER_CONFIG.config1.xApiKey,
    API_KEY_SECRET: TWITTER_CONFIG.config1.xApiKeySecret,
    USER_FIELDS: 'created_at,description,entities,id,location,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type,withheld',
    TWEET_FIELDS: 'created_at,public_metrics,entities,context_annotations,author_id,conversation_id,referenced_tweets,reply_settings,source,lang',
    MAX_RESULTS: 50
  },
  FALLBACK: {
    API_BASE_URL: 'https://api.twitter.com/2',
    BEARER_TOKEN: TWITTER_CONFIG.config2.bearerToken,
    API_KEY: TWITTER_CONFIG.config2.xApiKey,
    API_KEY_SECRET: TWITTER_CONFIG.config2.xApiKeySecret,
    USER_FIELDS: 'created_at,description,entities,id,location,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type,withheld',
    TWEET_FIELDS: 'created_at,public_metrics,entities,context_annotations,author_id,conversation_id,referenced_tweets,reply_settings,source,lang',
    MAX_RESULTS: 50
  }
};

// Available configurations array for rate limit tracker
const AVAILABLE_CONFIGS = [API_CONFIG.PRIMARY, API_CONFIG.FALLBACK];

// Initialize extension
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🔧 Extension installed/updated:', details.reason);
  initializeExtension();
});

async function initializeExtension() {
  if (extensionInitialized) {
    console.log('⚠️ Extension already initialized, skipping...');
    return;
  }

  try {
    console.log('🔧 Initializing X Profile Analyzer extension...');
    
    // Clear existing context menus first to avoid duplicates
    try {
      await chrome.contextMenus.removeAll();
      console.log('🗑️ Cleared existing context menus');
    } catch (error) {
      console.warn('⚠️ Could not clear context menus:', error.message);
    }
    
    // Create context menu
    try {
      chrome.contextMenus.create({
        id: 'analyzeProfile',
        title: 'Analyze X Profile',
        contexts: ['page', 'link'],
        documentUrlPatterns: ['https://twitter.com/*', 'https://x.com/*']
      });
      console.log('✅ Context menu created');
    } catch (contextError) {
      if (!contextError.message.includes('duplicate')) {
        console.warn('⚠️ Context menu creation warning:', contextError.message);
      }
    }
    
    // Initialize API client
    apiClient = new XProfileAPI();
    await apiClient.initialize();
    
    // Clear old cache
    analysisCache.clear();
    
    extensionInitialized = true;
    console.log('✅ X Profile Analyzer extension initialization complete!');
    
  } catch (error) {
    console.error('❌ Error during extension initialization:', error);
    // Continue with limited functionality
    extensionInitialized = true;
  }
}

// Enhanced XProfileAPI class using new proxy integration system
class XProfileAPI {
  constructor() {
    this.initialized = false;
    console.log('🔌 XProfileAPI instance created with proxy integration');
  }

  async initialize() {
    try {
      console.log('🔧 Initializing XProfileAPI with enhanced proxy support...');
      
      // Check if xApiClient is available
      if (!xApiClient) {
        throw new Error('XAPIClient not available');
      }
      
      // Check proxy status and connection
      const connectionStatus = xApiClient.getConnectionStatus();
      console.log('🔍 Connection status:', connectionStatus);
      
      this.initialized = true;
      console.log('✅ XProfileAPI initialized with proxy integration');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize XProfileAPI:', error);
      this.initialized = false;
      throw error;
    }
  }

  // Get user by username using the new proxy system
  async getUserByUsername(username) {
    try {
      console.log(`👤 Fetching user data for: ${username}`);
      
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided');
      }

      const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
      if (!cleanUsername) {
        throw new Error('Username cannot be empty');
      }

      // Use the new XAPIClient for the request
      const endpoint = `users/by/username/${cleanUsername}`;
    const params = {
        'user.fields': 'created_at,description,entities,id,location,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type,withheld'
      };
      
      const response = await xApiClient.makeAPIRequest(endpoint, params);
      const data = response.data;

      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];
        console.error('❌ X API returned error:', error);
        
        if (error.detail && error.detail.includes('User has been suspended')) {
          throw new Error(`The account @${cleanUsername} has been suspended by X.`);
        } else if (error.detail && error.detail.includes('Not Found Error')) {
          throw new Error(`The account @${cleanUsername} was not found.`);
        } else if (error.title === 'Authorization Error') {
          throw new Error('API authorization failed. Please check your credentials.');
        } else {
          throw new Error(`X API Error: ${error.detail || error.title || 'Unknown error'}`);
        }
      }

      if (!data || !data.data) {
        throw new Error(`No user data found for username: ${cleanUsername}`);
      }

      console.log(`✅ Successfully fetched user data for: ${username} via ${response.source}`);
      return data.data;

    } catch (error) {
      console.error(`❌ Error in getUserByUsername for ${username}:`, error);
      throw error;
    }
  }

  // Enhanced user tweets fetching with comprehensive rate limiting and error handling
  async getUserTweets(userId, maxResults = 20) {
    try {
      console.log(`📝 Fetching tweets for user ID: ${userId} (max: ${maxResults})`);
      
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Validate that we have API access
      if (!this.rateLimitTracker || !this.xApiClient) {
        throw new Error('API client not properly initialized');
      }

      // Check if we can make a request with current rate limits
      const bestConfig = this.rateLimitTracker.getBestConfig(TWITTER_CONFIG);
      if (!bestConfig) {
        throw new Error('All API configurations have exceeded rate limits. Please wait for reset.');
      }

      console.log(`🔄 Using configuration: ${bestConfig} for tweets request`);

      // Use the enhanced XAPIClient for the request
      const endpoint = `users/${userId}/tweets`;
      const params = {
        'max_results': Math.min(maxResults, 100), // Increased limit for better analysis
        'tweet.fields': 'created_at,public_metrics,entities,context_annotations,author_id,conversation_id,referenced_tweets,reply_settings,source,lang,possibly_sensitive',
        'user.fields': 'name,username,verified,public_metrics',
        'exclude': 'retweets' // Keep replies for better analysis
      };
      
      console.log(`📡 Making tweets API request via ${bestConfig}...`);
      const response = await this.xApiClient.makeAPIRequest(endpoint, params);
      
      // Enhanced response validation
      if (!response) {
        throw new Error('No response received from API');
      }

      const data = response.data || response;

      // Handle API errors
      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];
        console.error('❌ X API returned error for tweets:', error);
        
        if (error.title === 'Authorization Error' || error.code === 401) {
          throw new Error(`API authorization failed while fetching tweets: ${error.detail || error.title}`);
        } else if (error.title === 'Too Many Requests' || error.code === 429) {
          throw new Error(`Rate limit exceeded while fetching tweets: ${error.detail || error.title}`);
        } else if (error.code === 404) {
          console.log(`⚠️ User ${userId} not found or tweets are protected`);
          return [];
        } else {
          throw new Error(`X API Error: ${error.detail || error.title || 'Unknown error'}`);
        }
      }

      // Handle successful but empty responses
      if (!data || !data.data || !Array.isArray(data.data)) {
        console.log(`⚠️ No tweets found for user ID: ${userId} - user may have no tweets or protected account`);
        return [];
      }

      // Filter out potentially sensitive content for analysis
      const filteredTweets = data.data.filter(tweet => 
        tweet && 
        tweet.text && 
        !tweet.possibly_sensitive &&
        tweet.text.length > 10 // Ensure meaningful content
      );

      console.log(`✅ Successfully fetched ${filteredTweets.length}/${data.data.length} tweets for user ID: ${userId} via ${bestConfig}`);
      
      // Record successful request for rate limiting
      this.rateLimitTracker.recordRequest(bestConfig, response.headers);
      
      return filteredTweets;

    } catch (error) {
      console.error(`❌ Error in getUserTweets for ${userId}:`, error);
      
      // Handle specific error types
      if (error.message.includes('rate limit') || error.message.includes('Too Many Requests')) {
        // Log rate limit hit but don't throw - let the caller handle it
        console.log('⏳ Rate limit encountered, will retry with different config or later');
        throw new Error(`Rate limit exceeded. Please wait a few minutes and try again.`);
      } else if (error.message.includes('authorization') || error.message.includes('Authorization Error')) {
        // Critical auth error - propagate it
        throw new Error(`Authentication failed. Please check your API credentials.`);
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        // User not found or protected - return empty array
        console.log(`👤 User ${userId} not found or has protected tweets`);
        return [];
      }
      
      // For other errors, log and return empty array to prevent complete failure
      console.log('🔄 Returning empty tweets array due to error, analysis will continue with available data');
      return [];
    }
  }

  // Get comprehensive rate limit status including proxy info
  getRateLimitStatus() {
    const trackerStatus = rateLimitTracker.getRateLimitStatus();
    const connectionStatus = xApiClient.getConnectionStatus();
    
    // Calculate total remaining requests across all configs
    let totalRemaining = 0;
    let totalUsed = 0;
    let totalLimit = 0;
    
    Object.values(trackerStatus).forEach(status => {
      totalRemaining += status.remaining;
      totalUsed += status.used;
      totalLimit += status.total;
    });

    return {
      ...trackerStatus,
      summary: {
        totalRemaining,
        totalUsed,
        totalLimit,
        percentage: Math.round((totalUsed / totalLimit) * 100),
        proxyAvailable: connectionStatus.proxy.available,
        proxyUrl: connectionStatus.proxy.url,
        hasValidTokens: connectionStatus.hasValidTokens
      }
    };
  }
}

// Enhanced Analysis Engine
class AnalysisEngine {
  static analyzeProfile(userData, tweets = [], followers = []) {
    console.log('🔍 Starting comprehensive profile analysis...');
    
    const user = userData.data || userData;
    const tweetData = tweets.data || tweets;
    const followerData = followers.data || followers;

    const metrics = {
      followers: user.public_metrics?.followers_count || 0,
      following: user.public_metrics?.following_count || 0,
      tweets: user.public_metrics?.tweet_count || 0,
      listed: user.public_metrics?.listed_count || 0
    };

    const accountAge = this.calculateAccountAge(user.created_at);
    const healthScore = this.calculateHealthScore(user, metrics);
    const profileCompleteness = this.calculateProfileCompleteness(user);
    const contentAnalysis = this.analyzeContent(tweetData);
    const engagementAnalysis = this.analyzeEngagement(tweetData, metrics.followers);
    const audienceAnalysis = this.analyzeAudience(followerData, user);
    const recommendations = this.generateRecommendations(user, metrics, contentAnalysis, engagementAnalysis);

    const analysis = {
      username: user.username,
      displayName: user.name,
      profileImage: user.profile_image_url,
      bio: user.description,
      location: user.location,
      verified: user.verified || false,
      accountAge: accountAge,
      metrics: metrics,
      healthScore: healthScore,
      profileCompleteness: profileCompleteness,
      contentAnalysis: contentAnalysis,
      engagementAnalysis: engagementAnalysis,
      audienceAnalysis: audienceAnalysis,
      recommendations: recommendations,
      analysisDate: new Date().toISOString(),
      dataSource: 'X API v2 (Live)',
      tweetsAnalyzed: tweetData.length,
      followersAnalyzed: followerData.length,
      isRealData: true
    };

    console.log('✅ Profile analysis completed');
    return analysis;
  }

  static calculateAccountAge(createdAt) {
    if (!createdAt) return { days: 0, years: 0, description: 'Unknown' };
    
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffYears = (diffDays / 365).toFixed(1);
    
    return {
      days: diffDays,
      years: parseFloat(diffYears),
      description: `${diffYears} years (${diffDays.toLocaleString()} days)`
    };
  }

  static calculateHealthScore(user, metrics) {
    let score = 0;

    // Profile completeness (30 points)
    if (user.name) score += 5;
    if (user.description) score += 10;
    if (user.location) score += 5;
    if (user.profile_image_url && !user.profile_image_url.includes('default')) score += 10;

    // Activity level (25 points)
    const tweetsPerDay = metrics.tweets / Math.max(this.calculateAccountAge(user.created_at).days, 1);
    if (tweetsPerDay > 1) score += 25;
    else if (tweetsPerDay > 0.5) score += 20;
    else if (tweetsPerDay > 0.1) score += 15;
    else score += 5;

    // Follower-to-following ratio (20 points)
    const ratio = metrics.following > 0 ? metrics.followers / metrics.following : metrics.followers;
    if (ratio > 10) score += 20;
    else if (ratio > 2) score += 15;
    else if (ratio > 0.5) score += 10;
    else score += 5;

    // Verification and credibility (15 points)
    if (user.verified) score += 15;
    else if (metrics.listed > 10) score += 10;
    else if (metrics.listed > 0) score += 5;

    // Follower count tier (10 points)
    if (metrics.followers > 10000) score += 10;
    else if (metrics.followers > 1000) score += 8;
    else if (metrics.followers > 100) score += 6;
    else if (metrics.followers > 10) score += 4;
    else score += 2;

    return {
      score: Math.min(score, 100),
      percentage: Math.round((Math.min(score, 100) / 100) * 100),
      tier: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Average' : 'Needs Improvement'
    };
  }

  static calculateProfileCompleteness(user) {
    const fields = [
      { field: 'name', weight: 15, present: !!user.name },
      { field: 'description', weight: 25, present: !!user.description },
      { field: 'location', weight: 15, present: !!user.location },
      { field: 'url', weight: 10, present: !!user.url },
      { field: 'profile_image', weight: 20, present: user.profile_image_url && !user.profile_image_url.includes('default') },
      { field: 'verified', weight: 15, present: !!user.verified }
    ];

    const completedWeight = fields.filter(f => f.present).reduce((sum, f) => sum + f.weight, 0);
    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    
    return {
      percentage: Math.round((completedWeight / totalWeight) * 100),
      completedFields: fields.filter(f => f.present).map(f => f.field),
      missingFields: fields.filter(f => !f.present).map(f => f.field)
    };
  }

  static analyzeContent(tweets) {
    if (!tweets || tweets.length === 0) {
      return {
        totalTweets: 0,
        themes: [],
        avgLength: 0,
        postingPattern: 'No recent activity'
      };
    }

    const themes = this.detectContentThemes(tweets);
    const avgLength = tweets.reduce((sum, tweet) => sum + (tweet.text?.length || 0), 0) / tweets.length;
    const postingPattern = this.analyzePostingPattern(tweets);

    return {
      totalTweets: tweets.length,
      themes: themes,
      avgLength: Math.round(avgLength),
      postingPattern: postingPattern
    };
  }

  static detectContentThemes(tweets) {
    const themeKeywords = {
      'Technology': ['tech', 'ai', 'software', 'coding', 'development', 'programming'],
      'Business': ['business', 'startup', 'entrepreneur', 'marketing', 'sales'],
      'Personal Development': ['growth', 'learning', 'motivation', 'success', 'goals'],
      'News & Politics': ['news', 'politics', 'government', 'policy', 'election'],
      'Entertainment': ['movie', 'music', 'game', 'fun', 'entertainment'],
      'Sports': ['sport', 'football', 'basketball', 'soccer', 'game', 'team']
    };

    const themeScores = {};
    const tweetTexts = tweets.map(t => t.text?.toLowerCase() || '').join(' ');

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      const matches = keywords.filter(keyword => tweetTexts.includes(keyword)).length;
      if (matches > 0) {
        themeScores[theme] = matches;
      }
    });

    return Object.entries(themeScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([theme, score]) => ({ theme, relevance: Math.min(score * 10, 100) }));
  }

  static analyzePostingPattern(tweets) {
    if (tweets.length === 0) return 'No activity';

    const dates = tweets.map(t => new Date(t.created_at)).sort((a, b) => b - a);
    const daysDiff = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24);
    const tweetsPerDay = tweets.length / Math.max(daysDiff, 1);

    if (tweetsPerDay >= 5) return 'Very Active (5+ tweets/day)';
    if (tweetsPerDay >= 2) return 'Active (2-5 tweets/day)';
    if (tweetsPerDay >= 1) return 'Regular (1-2 tweets/day)';
    if (tweetsPerDay >= 0.3) return 'Moderate (2-3 tweets/week)';
    return 'Infrequent (less than weekly)';
  }

  static analyzeEngagement(tweets, followerCount) {
    if (!tweets || tweets.length === 0) {
      return {
        avgLikes: 0,
        avgRetweets: 0,
        avgReplies: 0,
        engagementRate: 0
      };
    }

    const totalLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0);
    const totalReplies = tweets.reduce((sum, t) => sum + (t.public_metrics?.reply_count || 0), 0);

    const avgLikes = Math.round(totalLikes / tweets.length);
    const avgRetweets = Math.round(totalRetweets / tweets.length);
    const avgReplies = Math.round(totalReplies / tweets.length);

    const totalEngagements = totalLikes + totalRetweets + totalReplies;
    const engagementRate = followerCount > 0 ? 
      ((totalEngagements / tweets.length) / followerCount) * 100 : 0;

    return {
      avgLikes,
      avgRetweets,
      avgReplies,
      engagementRate: Math.round(engagementRate * 100) / 100
    };
  }

  static analyzeAudience(followers, user) {
    if (!followers || followers.length === 0) {
      return {
        sampleSize: 0,
        avgFollowers: 0,
        verifiedCount: 0,
        audienceType: 'Unknown'
      };
    }

    const avgFollowers = Math.round(
      followers.reduce((sum, f) => sum + (f.public_metrics?.followers_count || 0), 0) / followers.length
    );

    const verifiedCount = followers.filter(f => f.verified).length;
    
    let audienceType = 'General';
    if (avgFollowers > 10000) audienceType = 'Influencer Network';
    else if (verifiedCount > followers.length * 0.1) audienceType = 'High-Value Audience';
    else if (avgFollowers > 1000) audienceType = 'Engaged Community';

    return {
      sampleSize: followers.length,
      avgFollowers,
      verifiedCount,
      verifiedPercentage: Math.round((verifiedCount / followers.length) * 100),
      audienceType
    };
  }

  static generateRecommendations(user, metrics, contentAnalysis, engagementAnalysis) {
    const recommendations = [];

    if (!user.description) {
      recommendations.push({
        type: 'Profile',
        priority: 'High',
        title: 'Add Bio Description',
        description: 'Complete your profile with a compelling bio to increase follower conversion'
      });
    }

    if (!user.location) {
      recommendations.push({
        type: 'Profile',
        priority: 'Medium',
        title: 'Add Location',
        description: 'Adding your location helps with local discovery and networking'
      });
    }

    if (contentAnalysis.avgLength < 50) {
      recommendations.push({
        type: 'Content',
        priority: 'Medium',
        title: 'Increase Tweet Length',
        description: 'Longer tweets tend to generate more engagement. Aim for 100-200 characters.'
      });
    }

    if (engagementAnalysis.engagementRate < 2) {
      recommendations.push({
        type: 'Engagement',
        priority: 'High',
        title: 'Improve Engagement Rate',
        description: 'Focus on creating content that encourages likes, retweets, and replies'
      });
    }

    const followerRatio = metrics.following > 0 ? metrics.followers / metrics.following : metrics.followers;
    if (followerRatio < 0.5 && metrics.followers < 1000) {
      recommendations.push({
        type: 'Growth',
        priority: 'Medium',
        title: 'Curate Following List',
        description: 'Consider unfollowing inactive accounts to improve your follower-to-following ratio'
      });
    }

    return recommendations;
  }
}

// Rate limiting helper functions
function resetRateLimitIfNeeded() {
  const now = Date.now();
  if (now - rateLimitStatus.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitStatus.requests = 0;
    rateLimitStatus.lastReset = now;
    rateLimitStatus.resetTime = now + RATE_LIMIT_WINDOW;
    console.log('🔄 Rate limit window reset');
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request.action);

  // Handle async responses
  if (request.action === 'analyze') {
    handleAnalyzeProfile(request, sendResponse);
    return true; // Keep message channel open for async response
  } else if (request.action === 'testApi') {
    handleTestApi(request, sendResponse);
    return true;
  } else if (request.action === 'getRateLimitStatus') {
    handleGetRateLimitStatus(request, sendResponse);
    return true;
  } else if (request.action === 'clearRateLimits') {
    handleClearRateLimits(request, sendResponse);
    return true;
  }

  return false;
});

// Enhanced analyze profile handler with comprehensive rate limiting
async function handleAnalyzeProfile(request, sendResponse) {
  try {
    const { username, postUrl } = request;
    console.log(`🔍 Starting analysis for: ${username}`);

    if (!username) {
      throw new Error('Username is required for analysis');
    }

    // Check cache first
      const cacheKey = `profile_${username.toLowerCase()}`;
      const cached = analysisCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('📦 Returning cached analysis');
        sendResponse({
          success: true,
        data: cached.data,
        cached: true,
        rateLimitStatus: apiClient ? apiClient.getRateLimitStatus() : null
        });
        return;
    }

    // Initialize API client if needed
    if (!apiClient) {
      apiClient = new XProfileAPI();
      await apiClient.initialize();
    }

    console.log('📡 Fetching fresh profile data...');
    
    // Fetch user data
    const userData = await apiClient.getUserByUsername(username);
    
    if (!userData) {
      throw new Error(`No user data found for @${username}`);
    }

    console.log('📝 Fetching user tweets...');
    
    // Fetch recent tweets (non-blocking, return empty array on error)
    let tweets = [];
    try {
      tweets = await apiClient.getUserTweets(userData.id, 20);
    } catch (tweetError) {
      console.warn('⚠️ Could not fetch tweets:', tweetError.message);
      tweets = [];
    }

    // Generate comprehensive analysis
    const analysis = await generateProfileAnalysis(userData, tweets);

    // Cache the result
    analysisCache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now()
    });

    // Get current rate limit status
    const rateLimitStatus = apiClient.getRateLimitStatus();

    console.log('✅ Analysis completed successfully');
    
    sendResponse({
      success: true,
      data: analysis,
      cached: false,
      rateLimitStatus,
      source: 'X API v2 (Live)'
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    
    // Get rate limit status even on error
    let rateLimitStatus = null;
    try {
      rateLimitStatus = apiClient ? apiClient.getRateLimitStatus() : null;
    } catch (statusError) {
      console.warn('⚠️ Could not get rate limit status:', statusError.message);
    }
    
    sendResponse({
      success: false,
      error: error.message,
      rateLimitStatus,
      requiresAction: error.message.includes('Rate limit') ? 'wait' : 'retry'
    });
  }
}

// Test API handler with rate limit integration
async function handleTestApi(request, sendResponse) {
  try {
    console.log('🔬 Testing API connectivity...');
    
    if (!apiClient) {
      apiClient = new XProfileAPI();
      await apiClient.initialize();
    }

    // Test with Elon Musk profile (known to exist and be public)
    const testResponse = await apiClient.getUserByUsername('elonmusk');
    
    const rateLimitStatus = apiClient.getRateLimitStatus();
    
    sendResponse({
      success: true,
      message: '✅ API connection successful',
      data: {
        testUser: testResponse.username,
        followers: testResponse.public_metrics?.followers_count || 0,
        verified: testResponse.verified || false
      },
      rateLimitStatus,
      source: 'X API v2 (Live)',
      proxyStatus: {
        enabled: true,
        available: rateLimitStatus.summary?.proxyAvailable || false,
        url: rateLimitStatus.summary?.proxyUrl || 'Unknown'
      }
    });

  } catch (error) {
    console.error('❌ API test failed:', error);
    
    let rateLimitStatus = null;
    try {
      rateLimitStatus = apiClient ? apiClient.getRateLimitStatus() : null;
    } catch (statusError) {
      console.warn('⚠️ Could not get rate limit status:', statusError.message);
    }
    
    sendResponse({
      success: false,
      error: error.message,
      rateLimitStatus,
      diagnostic: {
        apiInitialized: !!apiClient,
        configValid: API_VALIDATION.anyValid,
        proxyEnabled: PROXY_CONFIG.enabled,
        proxyAvailable: rateLimitStatus?.summary?.proxyAvailable || false
      }
    });
  }
}

// Get rate limit status handler
async function handleGetRateLimitStatus(request, sendResponse) {
  try {
    let rateLimitStatus = null;
    
    if (apiClient) {
      rateLimitStatus = apiClient.getRateLimitStatus();
    } else {
      // Return tracker status even without API client
      rateLimitStatus = rateLimitTracker.getRateLimitStatus();
    }
    
    sendResponse({
      success: true,
      rateLimitStatus
    });
    
  } catch (error) {
    console.error('❌ Failed to get rate limit status:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Clear rate limits handler (for testing/reset)
async function handleClearRateLimits(request, sendResponse) {
  try {
    console.log('🗑️ Clearing all rate limit data...');
    
    rateLimitTracker.clearAllLimits();
    
    // Clear analysis cache as well
    analysisCache.clear();
    
    sendResponse({
      success: true,
      message: '✅ Rate limits cleared successfully'
    });
    
  } catch (error) {
    console.error('❌ Failed to clear rate limits:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeProfile') {
    console.log('🖱️ Context menu clicked');
    
    let username = '';
    
    // Extract username from URL or selected text
    if (info.pageUrl) {
      const urlMatch = info.pageUrl.match(/(?:twitter\.com|x\.com)\/([^\/\s]+)/);
      if (urlMatch && urlMatch[1]) {
        username = urlMatch[1];
      }
    }
    
    if (info.selectionText) {
      const selectionMatch = info.selectionText.match(/@?([a-zA-Z0-9_]+)/);
      if (selectionMatch && selectionMatch[1]) {
        username = selectionMatch[1];
      }
    }
    
    if (username) {
      console.log(`🔍 Analyzing profile from context menu: ${username}`);
      chrome.action.openPopup();
      
      // Store the username for the popup to use
      chrome.storage.local.set({ contextMenuUsername: username });
    } else {
      console.warn('⚠️ Could not extract username from context');
    }
  }
});

// Enhanced profile analysis with comprehensive insights
async function generateProfileAnalysis(userData, tweets) {
  console.log('🧠 Generating comprehensive profile analysis...');
  
  const metrics = userData.public_metrics || {};
  const accountAge = userData.created_at ? 
    Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Analyze engagement patterns from tweets
  let avgEngagement = 0;
  let totalEngagement = 0;
  let tweetAnalysis = {
    totalTweets: tweets.length,
    avgLikes: 0,
    avgRetweets: 0,
    avgReplies: 0,
    mostEngagedTweet: null,
    recentActivity: 'Unknown'
  };
  
  if (tweets && tweets.length > 0) {
    tweets.forEach(tweet => {
      if (tweet.public_metrics) {
        const engagement = tweet.public_metrics.like_count + 
                         tweet.public_metrics.retweet_count + 
                         tweet.public_metrics.reply_count;
        totalEngagement += engagement;
        
        if (!tweetAnalysis.mostEngagedTweet || engagement > 
            (tweetAnalysis.mostEngagedTweet.public_metrics?.like_count || 0) +
            (tweetAnalysis.mostEngagedTweet.public_metrics?.retweet_count || 0) +
            (tweetAnalysis.mostEngagedTweet.public_metrics?.reply_count || 0)) {
          tweetAnalysis.mostEngagedTweet = tweet;
    }
  }
});

    avgEngagement = tweets.length > 0 ? totalEngagement / tweets.length : 0;
    tweetAnalysis.avgLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0) / tweets.length;
    tweetAnalysis.avgRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0) / tweets.length;
    tweetAnalysis.avgReplies = tweets.reduce((sum, t) => sum + (t.public_metrics?.reply_count || 0), 0) / tweets.length;
    
    // Determine activity level
    const latestTweet = tweets[0];
    if (latestTweet && latestTweet.created_at) {
      const daysSinceLastTweet = Math.floor((Date.now() - new Date(latestTweet.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastTweet === 0) tweetAnalysis.recentActivity = 'Very Active (Today)';
      else if (daysSinceLastTweet <= 3) tweetAnalysis.recentActivity = 'Active (This Week)';
      else if (daysSinceLastTweet <= 7) tweetAnalysis.recentActivity = 'Moderate (Past Week)';
      else if (daysSinceLastTweet <= 30) tweetAnalysis.recentActivity = 'Low (Past Month)';
      else tweetAnalysis.recentActivity = 'Inactive (Over a Month)';
    }
  }
  
  // Calculate influence score
  const followerRatio = metrics.following_count > 0 ? metrics.followers_count / metrics.following_count : 0;
  const engagementRate = metrics.followers_count > 0 ? (avgEngagement / metrics.followers_count) * 100 : 0;
  const influenceScore = Math.min(100, Math.round(
    (Math.log10(metrics.followers_count + 1) * 10) +
    (followerRatio > 10 ? 20 : followerRatio > 5 ? 15 : followerRatio > 2 ? 10 : 5) +
    (engagementRate * 2) +
    (userData.verified ? 15 : 0) +
    (accountAge > 365 ? 10 : accountAge > 180 ? 5 : 0)
  ));
  
  // Generate insights
  const insights = [];
  
  if (userData.verified) {
    insights.push('✓ Verified account with authentic credibility');
  }
  
  if (metrics.followers_count > 1000000) {
    insights.push('🌟 Mega-influencer with massive reach');
  } else if (metrics.followers_count > 100000) {
    insights.push('📈 Major influencer with significant impact');
  } else if (metrics.followers_count > 10000) {
    insights.push('💪 Established presence with strong following');
  }
  
  if (followerRatio > 10) {
    insights.push('👑 High-value account with excellent follower ratio');
  } else if (followerRatio < 0.1) {
    insights.push('👥 Follows many accounts, likely for networking');
  }
  
  if (engagementRate > 5) {
    insights.push('🔥 Exceptional engagement rate');
  } else if (engagementRate > 2) {
    insights.push('💬 Good audience engagement');
  } else if (engagementRate < 0.5) {
    insights.push('📊 Low engagement relative to follower count');
  }
  
  if (accountAge > 365 * 5) {
    insights.push('🏛️ Veteran user with long-standing presence');
  } else if (accountAge < 30) {
    insights.push('🆕 New account, building presence');
  }
  
  return {
    profile: {
      username: userData.username,
      displayName: userData.name,
      bio: userData.description || 'No bio available',
      location: userData.location || 'Location not specified',
      profileImageUrl: userData.profile_image_url,
      verified: userData.verified || false,
      protected: userData.protected || false,
      accountAge: accountAge,
      joinDate: userData.created_at
    },
    metrics: {
      followers: metrics.followers_count || 0,
      following: metrics.following_count || 0,
      tweets: metrics.tweet_count || 0,
      listed: metrics.listed_count || 0,
      followerRatio: Math.round(followerRatio * 100) / 100,
      engagementRate: Math.round(engagementRate * 100) / 100
    },
    analysis: {
      influenceScore,
      category: influenceScore > 80 ? 'Elite Influencer' : 
                influenceScore > 60 ? 'Major Influencer' :
                influenceScore > 40 ? 'Established User' :
                influenceScore > 20 ? 'Active User' : 'Casual User',
      insights,
      tweetAnalysis,
      lastAnalyzed: new Date().toISOString(),
      source: 'X API v2 (Live)'
    }
  };
}

// Helper function to manage additional API credentials
function getAdditionalCredentialsInstructions() {
  return {
    title: "Rate Limit Management Guide",
    currentStatus: {
      configs: 2,
      totalRequests: 600,
      windowDuration: "15 minutes"
    },
    recommendations: {
      addMoreCredentials: {
        benefit: "Double your rate limits to 1,200 requests per 15 minutes",
        steps: [
          "1. Create additional X Developer accounts",
          "2. Apply for API access on each account",
          "3. Generate Bearer Tokens for each account",
          "4. Add tokens to TWITTER_CONFIG in background.js",
          "5. Update XAPIClient directAPI.configs array",
          "6. Update RateLimitTracker initializeDefaultLimits()"
        ]
      },
      proxyAdvantages: {
        benefit: "Proxy server provides higher rate limits and better reliability",
        features: [
          "Higher rate limits (1000+ requests per window)",
          "Better CORS handling",
          "Automatic request routing",
          "Fallback to direct API when needed",
          "Enhanced error handling and retry logic"
        ]
      }
    },
    implementation: {
      code: `// Add to TWITTER_CONFIG
config3: {
  bearerToken: 'YOUR_NEW_BEARER_TOKEN_3',
  xApiKey: 'YOUR_API_KEY_3',
  // ... other config fields
},
config4: {
  bearerToken: 'YOUR_NEW_BEARER_TOKEN_4',
  xApiKey: 'YOUR_API_KEY_4', 
  // ... other config fields
},

// Add to XAPIClient directAPI.configs
{
  bearerToken: TWITTER_CONFIG.config3.bearerToken
},
{
  bearerToken: TWITTER_CONFIG.config4.bearerToken
},

// Update RateLimitTracker initializeDefaultLimits()
'config3': {
  used: 0,
  total: 300,
  resetTime: Date.now() + (15 * 60 * 1000),
  window: 15 * 60 * 1000,
  lastReset: Date.now()
},
'config4': {
  used: 0,
  total: 300,
  resetTime: Date.now() + (15 * 60 * 1000),
  window: 15 * 60 * 1000,
  lastReset: Date.now()
}`
    }
  };
}

// Expose helper function globally for debugging and management
if (typeof window !== 'undefined') {
  window.getAdditionalCredentialsInstructions = getAdditionalCredentialsInstructions;
}

console.log('✅ Background script loaded successfully with enhanced proxy integration and rate limiting!'); 