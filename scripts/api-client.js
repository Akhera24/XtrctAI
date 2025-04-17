// Enhanced X API client for robust profile fetching with fallbacks
class XApiClient {
  constructor(configs) {
    this.configs = configs || {};
    this.currentConfigIndex = 0;
    this.retryLimit = 3;
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.cache = new Map();
    this.lastErrorTimestamp = 0;
    this.consecutiveErrors = 0;
    this.errorRecoveryTime = 60000; // 1 minute wait after consecutive errors
    this.tokenValidationTime = 0;
    this.isTokenValid = false;
    
    // Add token pool management
    this.tokenPool = this.initializeTokenPool();
    this.rateLimitedTokens = new Map(); // Store rate limited tokens with reset times
    
    // Initialize with a longer backoff time for rate limits
    this.baseBackoffTime = 2000; // 2 seconds base
    this.maxBackoffTime = 30000; // 30 seconds max
  }

  // Initialize token pool from configs
  initializeTokenPool() {
    const pool = [];
    
    // Convert configs object to array if it's not already
    const configArray = Array.isArray(this.configs) ? this.configs : Object.values(this.configs);
    
    configArray.forEach((config, index) => {
      if (config && config.bearerToken) {
        pool.push({
          index,
          config,
          status: 'available',
          lastUsed: 0,
          rateLimitReset: null,
          consecutiveFailures: 0
        });
      }
    });
    
    console.log(`Initialized token pool with ${pool.length} tokens`);
    return pool;
  }
  
  // Get the best available token from the pool
  getBestAvailableToken() {
    const now = Date.now();
    
    // First, check for tokens that are not rate limited
    const availableTokens = this.tokenPool.filter(token => {
      // Not rate limited or rate limit has expired
      return token.status === 'available' || 
             (token.status === 'rate_limited' && token.rateLimitReset && now > token.rateLimitReset);
    });
    
    if (availableTokens.length > 0) {
      // Sort by last used (oldest first) to spread load
      availableTokens.sort((a, b) => a.lastUsed - b.lastUsed);
      
      // Reset status if it was previously rate limited
      if (availableTokens[0].status === 'rate_limited') {
        availableTokens[0].status = 'available';
        availableTokens[0].rateLimitReset = null;
        console.log(`Token #${availableTokens[0].index} rate limit has expired, now available`);
      }
      
      return availableTokens[0];
    }
    
    // If all tokens are rate limited, find the one with the soonest reset
    const rateLimitedTokens = this.tokenPool.filter(token => 
      token.status === 'rate_limited' && token.rateLimitReset
    );
    
    if (rateLimitedTokens.length > 0) {
      // Sort by reset time (soonest first)
      rateLimitedTokens.sort((a, b) => a.rateLimitReset - b.rateLimitReset);
      
      const nextResetMs = Math.max(0, rateLimitedTokens[0].rateLimitReset - now);
      console.log(`All tokens rate limited. Next available in ${Math.ceil(nextResetMs/1000)} seconds`);
      
      // If the next reset is soon (< 5 seconds), wait for it
      if (nextResetMs < 5000) {
        return new Promise(resolve => {
          setTimeout(() => {
            rateLimitedTokens[0].status = 'available';
            rateLimitedTokens[0].rateLimitReset = null;
            console.log(`Token #${rateLimitedTokens[0].index} rate limit has expired, now available`);
            resolve(rateLimitedTokens[0]);
          }, nextResetMs + 100);
        });
      }
      
      // Otherwise, return the token with the soonest reset anyway
      return rateLimitedTokens[0];
    }
    
    // Fallback to any token if none are available
    return this.tokenPool[this.currentConfigIndex];
  }

  // Rotates to the next available API configuration
  rotateConfig() {
    // First try to get a good token from the pool
    const bestToken = this.getBestAvailableToken();
    
    // If it's a promise, we're waiting for a rate limit to expire
    if (bestToken instanceof Promise) {
      return bestToken.then(token => {
        this.currentConfigIndex = token.index;
        console.log(`Rotated to API config #${this.currentConfigIndex + 1} after waiting for rate limit reset`);
        this.isTokenValid = true; // Assume valid since it just came off rate limit timeout
        return this.getCurrentConfig();
      });
    }
    
    // Otherwise use the best token we found
    this.currentConfigIndex = bestToken.index;
    console.log(`Rotated to API config #${this.currentConfigIndex + 1}`);
    this.isTokenValid = bestToken.status === 'available';
    return this.getCurrentConfig();
  }

  // Handle rate limit for the current token
  handleRateLimit(resetTime) {
    const token = this.tokenPool[this.currentConfigIndex];
    if (!token) return;
    
    const resetDate = new Date(resetTime);
    console.log(`Marking token #${this.currentConfigIndex + 1} as rate limited until ${resetDate.toLocaleTimeString()}`);
    
    // Update token status
    token.status = 'rate_limited';
    token.rateLimitReset = resetTime;
    
    // Store in global rate limited tokens map
    this.rateLimitedTokens.set(this.currentConfigIndex, {
      resetTime,
      resetDate
    });
    
    // Also rotate to the next token
    return this.rotateConfig();
  }

  // Validate token with a test request
  async validateToken(config) {
    const now = Date.now();
    // Validate at most once every 5 minutes
    if (now - this.tokenValidationTime < 5 * 60 * 1000 && this.isTokenValid) {
      return true;
    }

    try {
      // Check if this token is in the rate limited map
      const tokenIndex = this.tokenPool.findIndex(t => t.config === config);
      if (tokenIndex >= 0) {
        const rateLimitInfo = this.rateLimitedTokens.get(tokenIndex);
        if (rateLimitInfo && now < rateLimitInfo.resetTime) {
          console.log(`Token #${tokenIndex + 1} is rate limited. Skipping validation.`);
          return false;
        }
      }
      
      // Use a lightweight endpoint to test the token
      const baseUrl = config.baseUrl || config.API_BASE_URL || 'https://api.twitter.com/2';
      const testUrl = `${baseUrl}/users/by/username/twitter?user.fields=id,username`;
      
      // Create headers with the bearer token
      const bearerToken = config.bearerToken || config.BEARER_TOKEN;
      if (!bearerToken) {
        console.error('No bearer token available for validation');
        return false;
      }
      
      const headers = {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'X-Analyzer-Extension/1.0',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      };
      
      console.log('Validating API token...');
      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit'
      });
      
      this.tokenValidationTime = now;
      this.isTokenValid = response.ok;
      
      // If we got a rate limit error during validation, handle it
      if (response.status === 429) {
        const resetTime = parseInt(response.headers.get('x-rate-limit-reset') || '0') * 1000;
        await this.handleRateLimit(resetTime);
        return false;
      }
      
      // Update token status in pool
      const token = this.tokenPool.find(t => t.config === config);
      if (token) {
        token.status = response.ok ? 'available' : 'invalid';
        token.lastUsed = now;
      }
      
      return response.ok;
    } catch (error) {
      console.error('Token validation failed:', error);
      this.isTokenValid = false;
      
      // Update token status in pool
      const token = this.tokenPool.find(t => t.config === config);
      if (token) {
        token.status = 'error';
        token.consecutiveFailures++;
      }
      
      return false;
    }
  }

  // Main method to fetch profile data with robust error handling and fallbacks
  async fetchProfileData(username, options = {}) {
    const requestId = options.requestId || `fetch_${Date.now()}`;
    console.log(`[${requestId}] Fetching profile data for: ${username}`);
    
    // Validate the username before proceeding
    if (!this.isValidUsername(username)) {
      console.warn(`[${requestId}] Invalid username format: ${username}`);
      return {
        success: false,
        error: 'Invalid username format',
        message: 'The provided username contains invalid characters or formatting'
      };
    }
    
    // Strip @ symbol if present
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    
    // Check for excessive consecutive errors and implement cooldown
    const now = Date.now();
    if (this.consecutiveErrors >= 5 && (now - this.lastErrorTimestamp) < this.errorRecoveryTime) {
      console.warn(`[${requestId}] Too many consecutive errors. Waiting until ${new Date(this.lastErrorTimestamp + this.errorRecoveryTime).toLocaleTimeString()}`);
      return {
        success: false,
        error: 'API rate limit exceeded',
        message: 'Too many API errors. Please try again in a few minutes.',
        cooldownRemaining: (this.lastErrorTimestamp + this.errorRecoveryTime) - now
      };
    }
    
    // Check cache first if not forced refresh
    if (!options.forceRefresh) {
      try {
        const cachedData = this.getFromCache(username);
        if (cachedData) {
          console.log(`[${requestId}] Using cached data for ${username}`);
          // Reset error counter on successful cache hit
          this.consecutiveErrors = 0;
          return { 
            success: true,
            ...cachedData, 
            fromCache: true 
          };
        }
      } catch (cacheError) {
        console.warn(`[${requestId}] Cache retrieval error:`, cacheError);
        // Continue to API call on cache error
      }
    }
    
    // Before trying API requests, attempt to refresh tokens
    // This can help if all tokens are invalid or expired
    try {
      console.log(`[${requestId}] Refreshing and validating tokens`);
      const validTokens = await this.refreshAndValidateTokens();
      if (!validTokens) {
        console.error(`[${requestId}] No valid tokens available, falling back to cache or generated data`);
        
        // Try to get expired cache data as fallback
        try {
          const expiredCache = this.getFromCache(username, true);
          if (expiredCache) {
            console.log(`[${requestId}] Using expired cache for ${username} as all tokens are invalid`);
            return {
              success: true,
              ...expiredCache,
              fromCache: true,
              cacheExpired: true,
              warning: 'Using expired cached data as no valid API tokens available'
            };
          }
        } catch (expiredCacheError) {
          console.warn(`[${requestId}] Failed to get expired cache:`, expiredCacheError);
        }
        
        // If no cache either, return generated fallback data
        return this.generateFallbackData(username, new Error('No valid API tokens available'));
      }
    } catch (tokenError) {
      console.error(`[${requestId}] Error refreshing tokens:`, tokenError);
      // Continue anyway, we might still be able to use an existing config
    }
    
    // Setup for retry mechanism
    let retries = 0;
    let lastError = null;
    
    // Try multiple configurations with retries
    while (retries < this.retryLimit * this.configs.length) {
      const config = this.getCurrentConfig();
      
      try {
        console.log(`[${requestId}] Attempting to fetch ${username} with config #${this.currentConfigIndex + 1}, retry ${retries + 1}`);
        
        // Validate token before making the request
        const isValid = await this.validateToken(config);
        if (!isValid) {
          console.warn(`[${requestId}] Token validation failed, rotating config...`);
          this.rotateConfig();
          retries++;
          continue;
        }
        
        // First get the user ID using our safe fetch method
        console.log(`[${requestId}] Fetching user data for ${username}`);
        const userLookupPath = `users/by/username/${username}?user.fields=public_metrics,description,profile_image_url,verified`;
        const userData = await this.safeApiFetch(userLookupPath, config);
        
        if (!userData || !userData.data) {
          console.warn(`[${requestId}] User data missing for ${username}`);
          throw new Error('User not found or API returned invalid data');
        }
        
        // Now fetch tweets for the user
        console.log(`[${requestId}] Fetching tweets for ${username}`);
        const userId = userData.data.id;
        const tweetsPath = `users/${userId}/tweets?max_results=10&tweet.fields=public_metrics,created_at,entities&expansions=attachments.media_keys`;
        
        const tweetsData = await this.safeApiFetch(tweetsPath, config);
        
        // Calculate analytics from the tweet data
        console.log(`[${requestId}] Generating analytics for ${username}`);
        const analytics = this.calculateAnalytics(tweetsData.data || []);
        
        // Generate content strategy recommendations
        console.log(`[${requestId}] Generating strategy recommendations for ${username}`);
        const strategy = this.analyzePostingStrategy(userData.data, tweetsData.data || []);
        
        // Prepare the combined result
        const result = {
          success: true,
          data: {
            user: userData.data,
            tweets: tweetsData.data || [],
            analytics: analytics,
            strategy: strategy
          },
          timestamp: Date.now(),
          fromCache: false
        };
        
        // Cache the successful result
        try {
          console.log(`[${requestId}] Caching result for ${username}`);
          this.addToCache(username, result);
        } catch (cacheError) {
          console.warn(`[${requestId}] Failed to cache result:`, cacheError);
          // Non-critical error, continue
        }
        
        // Reset error counters on success
        this.consecutiveErrors = 0;
        
        console.log(`[${requestId}] Successfully fetched data for ${username}`);
        return result;
      } catch (error) {
        console.error(`[${requestId}] Error fetching data for ${username} with config #${this.currentConfigIndex + 1}:`, error);
        
        // Check if this is a rate limit error
        if (error.message && (
            error.message.includes('rate limit') || 
            error.message.includes('429') || 
            error.message.includes('Too Many Requests')
        )) {
          console.warn(`[${requestId}] Rate limit hit on config #${this.currentConfigIndex + 1}, rotating to next config`);
          // Store the rate limit info if available
          if (error.rateLimitReset) {
            console.log(`[${requestId}] Rate limit resets at: ${new Date(error.rateLimitReset).toLocaleTimeString()}`);
          }
        }
        
        lastError = error;
        retries++;
        
        // Increment consecutive error counter and update timestamp
        this.consecutiveErrors++;
        this.lastErrorTimestamp = Date.now();
        
        // If this config failed, try the next one
        this.rotateConfig();
        
        // Exponential backoff before retry
        const backoffTime = Math.min(1000 * Math.pow(2, retries - 1), 8000);
        console.log(`[${requestId}] Backing off for ${backoffTime}ms before retry #${retries}`);
        await new Promise(r => setTimeout(r, backoffTime));
      }
    }
    
    // All attempts failed, try to return fallback data
    console.warn(`[${requestId}] All API attempts failed for ${username}, returning fallback data`);
    
    // Check if we have expired cache data as a fallback
    try {
      const expiredCache = this.getFromCache(username, true);
      if (expiredCache) {
        console.log(`[${requestId}] Using expired cache for ${username} as fallback`);
        return {
          success: true,
          ...expiredCache,
          fromCache: true,
          cacheExpired: true,
          warning: 'Using expired cached data as API requests failed'
        };
      }
    } catch (expiredCacheError) {
      console.warn(`[${requestId}] Failed to get expired cache as fallback:`, expiredCacheError);
    }
    
    // If no cache either, return generated fallback data
    console.log(`[${requestId}] Generating fallback data as last resort`);
    return this.generateFallbackData(username, lastError);
  }

  // Helper to make authenticated API requests with better error handling
  async makeAuthenticatedRequestWithRetry(url, config, retryCount = 0) {
    try {
      // Wrap the request in a function to pass to retryWithBackoff
      const requestFn = async () => {
        try {
          return await this.makeAuthenticatedRequest(url, config);
        } catch (error) {
          // Handle 401 unauthorized errors - definitely an expired token
          if (error.message && (error.message.includes('401') || error.message.includes('unauthorized'))) {
            console.warn(`Authorization error detected. Rotating API config immediately.`);
            this.isTokenValid = false;
            
            // Update token status in pool
            const tokenIndex = this.tokenPool.findIndex(t => t.config === config);
            if (tokenIndex >= 0) {
              const token = this.tokenPool[tokenIndex];
              token.status = 'invalid';
              token.consecutiveFailures++;
            }
            
            await this.rotateConfig();
            
            // For auth errors, don't retry with backoff, just try next config
            const newConfig = this.getCurrentConfig();
            return await this.makeAuthenticatedRequest(url, newConfig);
          }
          
          // For rate limit errors, properly mark them for the backoff handler
          if (error.message && (
              error.message.includes('rate limit') || 
              error.message.includes('429') || 
              error.message.includes('Too Many Requests')
          )) {
            error.isRateLimit = true;
            
            // Handle rate limit if we have reset info
            if (error.rateLimitReset) {
              await this.handleRateLimit(error.rateLimitReset);
            }
          }
          
          throw error;
        }
      };
      
      // Use the enhanced retryWithBackoff function with our request
      return await this.retryWithBackoff(requestFn, this.retryLimit, this.baseBackoffTime);
    } catch (error) {
      console.error(`All retry attempts failed for ${url}:`, error);
      throw error;
    }
  }
  
  // Safely fetch API data with error handling and retries
  async safeApiFetch(urlPath, config = null) {
    // Use provided config or current config
    const apiConfig = config || this.getCurrentConfig();
    
    // Ensure we have a base URL
    const baseUrl = apiConfig.baseUrl || apiConfig.API_BASE_URL || 'https://api.twitter.com/2';
    
    // Build full URL
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${baseUrl}/${urlPath.startsWith('/') ? urlPath.substring(1) : urlPath}`;
    
    // Process URL to ensure valid parameters
    const urlObj = new URL(fullUrl);
    const endpoint = urlObj.pathname;
    
    // Add appropriate fields based on endpoint type if not already present
    if (endpoint.includes('/users/by/username/')) {
      if (!urlObj.searchParams.has('user.fields') && !urlPath.includes('user.fields=')) {
        urlObj.searchParams.append('user.fields', 'description,profile_image_url,verified,public_metrics');
      }
    } else if (endpoint.includes('/tweets')) {
      if (!urlObj.searchParams.has('tweet.fields') && !urlPath.includes('tweet.fields=')) {
        urlObj.searchParams.append('tweet.fields', 'created_at,public_metrics');
      }
    }
    
    // Use the processed URL
    const processedUrl = urlObj.toString();
    
    try {
      // First try with direct API call
      try {
        return await this.makeAuthenticatedRequestWithRetry(processedUrl, apiConfig);
      } catch (directError) {
        console.warn('Direct API call failed, trying proxy:', directError);
        
        // Try proxy if direct call fails
        try {
          // Dynamically import the proxy client
          const { proxyClient } = await import('./proxy-client.js');
          
          // Check if proxy is available
          if (await proxyClient.isAvailable()) {
            console.log('Using proxy for request:', processedUrl);
            
            // Use the proxy client's authenticated request method
            return await proxyClient.makeAuthenticatedRequest(processedUrl, apiConfig);
          } else {
            console.warn('Proxy server is not available');
            throw new Error('Proxy server is not available');
          }
        } catch (proxyError) {
          console.error('Proxy request also failed:', proxyError);
          
          // Add context for better debugging
          directError.context = {
            ...directError.context,
            proxyAttempted: true,
            proxyError: proxyError.message
          };
          
          // Throw the original error
          throw directError;
        }
      }
    } catch (error) {
      console.error(`All API request attempts failed for ${processedUrl}:`, error);
      
      // Add error context for better debugging
      error.context = {
        ...(error.context || {}),
        url: processedUrl,
        configIndex: this.currentConfigIndex,
        timestamp: Date.now()
      };
      
      throw error;
    }
  }

  // Helper to make authenticated API requests
  async makeAuthenticatedRequest(url, config) {
    // Determine the bearer token to use
    const bearerToken = config.bearerToken || config.BEARER_TOKEN;
    
    if (!bearerToken) {
      console.error('No bearer token available for API request');
      throw new Error('Authentication configuration is missing or invalid');
    }
    
    const headers = {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'X-Analyzer-Extension/1.0',
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache'
    };
    
    const options = {
      method: 'GET',
      headers: headers,
      redirect: 'follow',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit'
    };
    
    // Process URL to ensure valid parameters
    const urlObj = new URL(url);
    
    // Add appropriate fields based on endpoint type
    const endpoint = urlObj.pathname;
    if (endpoint.includes('/users/by/username/')) {
      // For user lookup endpoints, add valid fields if not already present
      if (!urlObj.searchParams.has('user.fields')) {
        urlObj.searchParams.append('user.fields', 'description,profile_image_url,verified,public_metrics');
      }
    } else if (endpoint.includes('/tweets')) {
      // For tweet endpoints, add tweet fields if not present
      if (!urlObj.searchParams.has('tweet.fields')) {
        urlObj.searchParams.append('tweet.fields', 'created_at,public_metrics');
      }
    }
    
    const finalUrl = urlObj.toString();
    console.log(`Making request to: ${finalUrl}`);
    
    try {
      const response = await fetch(finalUrl, options);
      
      // Process rate limits from headers for monitoring
      this.processRateLimits(response);
      
      if (!response.ok) {
        let errorMessage = `HTTP error ${response.status}`;
        let rateLimitReset = null;
        
        // Handle rate limit errors specifically
        if (response.status === 429) {
          rateLimitReset = parseInt(response.headers.get('x-rate-limit-reset') || '0') * 1000;
          const resetDate = new Date(rateLimitReset);
          errorMessage = `Rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`;
        }
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.errors?.[0]?.message || errorMessage;
          
          // Handle special error cases
          if (errorData.errors?.[0]?.value) {
            // Handle username format errors
            if (errorMessage.includes('username')) {
              errorMessage = `The username "${errorData.errors[0].value}" does not match the required format`;
            }
          }
        } catch (e) {
          // If we can't parse the error JSON, use the status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        
        // Mark token as invalid for 401 errors
        if (response.status === 401) {
          this.isTokenValid = false;
        }
        
        // Create the error
        const error = new Error(errorMessage);
        
        // Add rate limit info if applicable
        if (rateLimitReset) {
          error.rateLimitReset = rateLimitReset;
          error.isRateLimit = true;
        }
        
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${error.message}`);
      throw error;
    }
  }
  
  // Process rate limits from response headers
  processRateLimits(response) {
    try {
      const remaining = response.headers.get('x-rate-limit-remaining');
      const reset = response.headers.get('x-rate-limit-reset');
      const limit = response.headers.get('x-rate-limit-limit');
      
      if (remaining || reset || limit) {
        console.log(`API Rate Limits - Remaining: ${remaining}, Reset: ${reset}, Limit: ${limit}`);
        
        // Store the latest rate limit info
        this.rateLimits = {
          remaining: parseInt(remaining) || 0,
          reset: (parseInt(reset) || Math.floor(Date.now() / 1000) + 900) * 1000, // Convert to ms, default 15 min
          limit: parseInt(limit) || 300,
          timestamp: Date.now()
        };
        
        // Update token in pool
        const token = this.tokenPool[this.currentConfigIndex];
        if (token) {
          // Mark token's last used time
          token.lastUsed = Date.now();
          
          // If we're close to the rate limit, pre-emptively mark as limited
          if (parseInt(remaining) <= 5 && reset) {
            const resetTime = parseInt(reset) * 1000;
            console.log(`Token #${this.currentConfigIndex + 1} is close to rate limit (${remaining} remaining). Preparing for rotation.`);
            
            // Don't mark as rate limited yet, but prepare for it
            token.rateLimitReset = resetTime;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to process rate limits:', e);
    }
  }

  // Attempt to refresh and validate all available tokens
  async refreshAndValidateTokens() {
    console.log('Refreshing and validating tokens...');
    
    // Reset token pool statuses
    this.tokenPool.forEach(token => {
      // Only reset if not rate limited
      if (token.status !== 'rate_limited') {
        token.status = 'unknown';
      }
    });
    
    // Try each token in sequence
    const validationResults = await Promise.allSettled(
      this.tokenPool.map(async (token, index) => {
        try {
          // Skip tokens that are known to be rate limited
          if (token.status === 'rate_limited' && token.rateLimitReset && Date.now() < token.rateLimitReset) {
            console.log(`Skipping validation for rate limited token #${index + 1}`);
            return { index, valid: false, status: 'rate_limited' };
          }
          
          const configValid = await this.validateToken(token.config);
          console.log(`Token #${index + 1} validation result: ${configValid ? 'valid' : 'invalid'}`);
          
          return { index, valid: configValid, status: configValid ? 'available' : 'invalid' };
        } catch (error) {
          console.warn(`Failed to validate token #${index + 1}:`, error);
          return { index, valid: false, status: 'error', error };
        }
      })
    );
    
    // Process validation results
    const validTokens = validationResults
      .filter(result => result.status === 'fulfilled' && result.value.valid)
      .map(result => result.value.index);
    
    if (validTokens.length > 0) {
      // Set current index to the first valid token
      this.currentConfigIndex = validTokens[0];
      this.isTokenValid = true;
      console.log(`Found ${validTokens.length} valid tokens. Using token #${this.currentConfigIndex + 1}`);
      return true;
    }
    
    // If we reach here, no valid tokens
    console.error('No valid tokens available');
    return false;
  }

  // Validate Twitter username format
  isValidUsername(username) {
    if (!username) return false;
    
    // Remove @ if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    // Twitter usernames must be between 1-15 characters and only contain letters, numbers, and underscores
    const usernameRegex = /^[a-zA-Z0-9_]{1,15}$/;
    return usernameRegex.test(cleanUsername);
  }

  // Caching methods
  getFromCache(username, includeExpired = false) {
    const cacheKey = username.toLowerCase();
    
    if (!this.cache.has(cacheKey)) return null;
    
    const cachedItem = this.cache.get(cacheKey);
    const now = Date.now();
    
    // Check if cache is valid or if we're allowing expired items
    if (includeExpired || (now - cachedItem.timestamp < this.cacheExpiry)) {
      return cachedItem;
    }
    
    return null;
  }

  addToCache(username, data) {
    const cacheKey = username.toLowerCase();
    this.cache.set(cacheKey, {
      ...data,
      timestamp: Date.now()
    });
    
    // Update storage for persistence
    try {
      chrome.storage.local.get(['profileCache'], (result) => {
        const profileCache = result.profileCache || {};
        profileCache[cacheKey] = {
          ...data,
          timestamp: Date.now()
        };
        
        chrome.storage.local.set({ profileCache });
      });
    } catch (error) {
      console.warn('Could not update cache in storage:', error);
    }
  }

  // Analytics calculation methods
  calculateAnalytics(tweets) {
    return {
      engagement_rate: this.calculateEngagementRate(tweets),
      best_posting_times: this.calculateBestPostingTimes(tweets),
      top_performing_content: this.getTopPerformingContent(tweets)
    };
  }

  calculateEngagementRate(tweets) {
    if (!tweets || tweets.length === 0) return "0.00";
    
    let totalEngagement = 0;
    let totalPossibleEngagement = 0;
    
    tweets.forEach(tweet => {
      const metrics = tweet.public_metrics || {};
      totalEngagement += (metrics.like_count || 0) + 
                        (metrics.retweet_count || 0) + 
                        (metrics.reply_count || 0);
      totalPossibleEngagement += 1;
    });
    
    return ((totalEngagement / (totalPossibleEngagement * 100)) * 100).toFixed(1);
  }

  calculateBestPostingTimes(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    const hourlyEngagement = {};
    const dayMapping = {
      0: 'Sunday',
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday'
    };
    
    tweets.forEach(tweet => {
      if (!tweet.created_at) return;
      
      const tweetDate = new Date(tweet.created_at);
      const day = dayMapping[tweetDate.getDay()];
      const hour = tweetDate.getHours();
      const timeKey = `${day} ${hour}-${hour+1}`;
      
      const metrics = tweet.public_metrics || {};
      const engagement = (metrics.like_count || 0) + 
                        (metrics.retweet_count || 0) + 
                        (metrics.reply_count || 0);
      
      if (!hourlyEngagement[timeKey]) {
        hourlyEngagement[timeKey] = { total: 0, count: 0, day, hour };
      }
      
      hourlyEngagement[timeKey].total += engagement;
      hourlyEngagement[timeKey].count += 1;
    });
    
    // Transform to array and calculate averages
    return Object.values(hourlyEngagement)
      .map(data => ({
        day: data.day,
        hour: `${data.hour}:00-${data.hour+1}:00`,
        average_engagement: (data.total / data.count).toFixed(1)
      }))
      .sort((a, b) => parseFloat(b.average_engagement) - parseFloat(a.average_engagement))
      .slice(0, 3);
  }

  getTopPerformingContent(tweets) {
    if (!tweets || tweets.length === 0) return [];
    
    const tweetsWithEngagement = tweets.map(tweet => {
      const metrics = tweet.public_metrics || {};
      const engagement = (metrics.like_count || 0) + 
                        (metrics.retweet_count || 0) + 
                        (metrics.reply_count || 0);
      
      let text = tweet.text;
      
      // If the tweet is too long, truncate it
      if (text.length > 100) {
        text = text.substring(0, 97) + '...';
      }
      
      return {
        text,
        engagement,
        created_at: tweet.created_at
      };
    });
    
    return tweetsWithEngagement
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 3);
  }

  analyzePostingStrategy(userData, tweets) {
    // Count different content types
    const contentTypes = {
      text: 0,
      media: 0,
      links: 0
    };

    tweets.forEach(tweet => {
      if (tweet.entities?.urls?.length > 0) contentTypes.links++;
      if (tweet.attachments?.media_keys?.length > 0) contentTypes.media++;
      else contentTypes.text++;
    });

    // Generate posting frequency description
    let postingFrequency = 'Low';
    const totalTweets = userData.public_metrics?.tweet_count || 0;
    const accountAge = this.calculateAccountAgeInDays(userData.created_at);
    
    // Calculate average tweets per day to determine posting frequency
    const tweetsPerDay = accountAge > 0 ? totalTweets / accountAge : 0;
    
    if (tweetsPerDay > 3) postingFrequency = 'Very High (multiple posts daily)';
    else if (tweetsPerDay > 1) postingFrequency = 'High (daily)';
    else if (tweetsPerDay > 0.5) postingFrequency = 'Medium (several times weekly)';
    else if (tweetsPerDay > 0.1) postingFrequency = 'Low (weekly)';
    else postingFrequency = 'Very Low (occasional)';

    // Calculate follower/following ratio and determine influence level
    const followers = userData.public_metrics?.followers_count || 0;
    const following = userData.public_metrics?.following_count || 0;
    
    let followerRatio = 'Low';
    let ratioDescription = '';
    
    if (following > 0) {
      const ratio = followers / following;
      ratioDescription = ratio.toFixed(1);
      
      if (ratio > 10) {
        followerRatio = `High (${ratioDescription}:1) - Established influencer`;
      } else if (ratio > 2) {
        followerRatio = `Good (${ratioDescription}:1) - Growing influence`;
      } else if (ratio > 1) {
        followerRatio = `Balanced (${ratioDescription}:1) - Healthy engagement`;
      } else {
        followerRatio = `Low (${ratioDescription}:1) - Building audience`;
      }
    }

    // Extract popular hashtags
    const hashtagCounts = {};
    tweets.forEach(tweet => {
      const hashtags = tweet.entities?.hashtags || [];
      hashtags.forEach(tag => {
        const tagText = tag.tag.toLowerCase();
        hashtagCounts[tagText] = (hashtagCounts[tagText] || 0) + 1;
      });
    });
    
    const sortedHashtags = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag, count]) => {
        const percentage = tweets.length > 0 ? Math.round((count / tweets.length) * 100) : 0;
        return `${tag} (${percentage}%)`;
      });
    
    const popularHashtags = sortedHashtags.length > 0 ? sortedHashtags.join(', ') : 'None detected';

    // Generate recommendations based on analysis
    const recommendations = this.generateRecommendations(userData, contentTypes, tweetsPerDay, followers);

    return {
      contentTypes,
      postingFrequency,
      followerRatio,
      popularHashtags,
      recommendations,
      summary: 'Analysis based on recent activity and profile metrics'
    };
  }

  calculateAccountAgeInDays(createdAt) {
    if (!createdAt) return 0;
    
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays || 1; // Ensure we don't divide by zero
  }

  generateRecommendations(userData, contentTypes, tweetsPerDay, followers) {
    const recommendations = [];
    
    // Posting frequency recommendations
    if (tweetsPerDay < 0.5) {
      recommendations.push('Increase posting frequency to at least 3-5 times per week');
    } else if (tweetsPerDay > 5) {
      recommendations.push('Consider quality over quantity - focus on high-value content');
    }
    
    // Content type recommendations
    const totalContent = contentTypes.text + contentTypes.media + contentTypes.links;
    
    if (totalContent > 0) {
      const mediaPercentage = (contentTypes.media / totalContent) * 100;
      
      if (mediaPercentage < 30) {
        recommendations.push('Include more visual content (images, videos) for higher engagement');
      }
      
      if (contentTypes.links > contentTypes.text && contentTypes.links > contentTypes.media) {
        recommendations.push('Balance link sharing with original content to build audience trust');
      }
    }
    
    // Follower growth recommendations
    if (followers < 1000) {
      recommendations.push('Engage with conversations in your niche to increase visibility');
      recommendations.push('Use 1-2 relevant hashtags per post to reach new audiences');
    } else if (followers < 10000) {
      recommendations.push('Focus on creating shareable content to expand your reach');
      recommendations.push('Develop a consistent brand voice in your posts');
    } else {
      recommendations.push('Leverage your audience for partnerships and collaborations');
      recommendations.push('Maintain consistent posting schedule to retain audience engagement');
    }
    
    return recommendations;
  }

  // Generate fallback data when API calls fail
  generateFallbackData(username, error) {
    console.log(`Generating fallback data for ${username} due to: ${error?.message}`);
    
    // Create user object with estimated metrics
    const followers = Math.floor(Math.random() * 5000) + 500;
    const following = Math.floor(Math.random() * 2000) + 200;
    const tweetCount = Math.floor(Math.random() * 15000) + 1000;
    const joinDate = new Date(Date.now() - (Math.random() * 5 * 365 * 24 * 60 * 60 * 1000)).toISOString();
    
    const user = {
      id: `generated_${Math.floor(Math.random() * 1000000000)}`,
      username: username,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      created_at: joinDate,
      description: "Profile information unavailable. Showing estimated data.",
      profile_image_url: `https://unavailable.twitter.com/profile_images/${username}`,
      public_metrics: {
        followers_count: followers,
        following_count: following,
        tweet_count: tweetCount,
        listed_count: Math.floor(followers * 0.02),
        like_count: Math.floor(tweetCount * 0.3)
      },
      verified: false
    };
    
    // Generate mock analytics data
    const analytics = {
      engagement_rate: (Math.random() * 5 + 0.1).toFixed(1) + '%',
      avg_likes: Math.floor(followers * 0.01 * (Math.random() + 0.5)),
      avg_retweets: Math.floor(followers * 0.003 * (Math.random() + 0.5)),
      avg_replies: Math.floor(followers * 0.002 * (Math.random() + 0.5)),
      best_posting_times: [
        { day: 'Weekdays', hour: '9:00-11:00', average_engagement: (Math.random() * 20 + 10).toFixed(1) },
        { day: 'Weekdays', hour: '13:00-15:00', average_engagement: (Math.random() * 15 + 5).toFixed(1) },
        { day: 'Weekends', hour: '11:00-13:00', average_engagement: (Math.random() * 10 + 5).toFixed(1) }
      ],
      top_performing_content: []
    };
    
    // Generate strategy recommendations
    const strategy = {
      contentTypes: {
        text: Math.floor(Math.random() * 30) + 10,
        media: Math.floor(Math.random() * 40) + 20,
        links: Math.floor(Math.random() * 20) + 5
      },
      postingFrequency: followers > 5000 ? 'High (daily)' : 'Medium (several times weekly)',
      followerRatio: `${(followers / following).toFixed(1)}:1`,
      popularHashtags: 'Data unavailable',
      recommendations: [
        'Post consistently to increase visibility',
        'Engage with comments to build community',
        'Use visual content for higher engagement',
        'Participate in relevant conversations in your niche'
      ],
      summary: 'Estimated analysis - API data unavailable'
    };
    
    return {
      success: true,
      data: {
        user: user,
        tweets: [],
        analytics: analytics,
        strategy: strategy
      },
      isFallbackData: true,
      isEstimated: true,
      fromFallback: true,
      warning: error?.message || 'API data unavailable',
      timestamp: Date.now()
    };
  }

  // Gets the currently active API configuration
  getCurrentConfig() {
    return this.configs[this.currentConfigIndex];
  }

  // Enhanced retryWithBackoff function with better rate limit handling
  async retryWithBackoff(requestFn, maxRetries = 3, initialDelayMs = 2000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${maxRetries}...`);
        }
        
        // Get the best available token before each attempt
        if (attempt > 0) {
          await this.rotateConfig();
        }
        
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // If this isn't a rate limit error or we've used all retries, throw
        if (!error.isRateLimit || attempt >= maxRetries) {
          throw error;
        }
        
        // Calculate backoff time with exponential increase and some jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
        const delayMs = Math.min(
          initialDelayMs * Math.pow(2, attempt) * jitter,
          this.maxBackoffTime
        );
        
        console.log(`Rate limit hit. Backing off for ${Math.round(delayMs / 1000)} seconds...`);
        
        // If we have a reset time in the error, use that instead if it's sooner
        if (error.rateLimitReset) {
          const resetTimeMs = error.rateLimitReset;
          const timeUntilReset = resetTimeMs - Date.now();
          
          if (timeUntilReset > 0 && timeUntilReset < delayMs) {
            console.log(`Using rate limit reset time instead: ${Math.round(timeUntilReset / 1000)} seconds`);
            await new Promise(resolve => setTimeout(resolve, timeUntilReset + 1000)); // Add 1 second buffer
            continue;
          }
        }
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // We should never reach here due to the throw in the loop, but just in case
    throw lastError;
  }
}

// Export this enhanced client for use in background.js
export default XApiClient; 

/**
 * Implements exponential backoff for API requests that hit rate limits
 * @param {Function} requestFn - The function to retry (should return a promise)
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelayMs - Initial delay in milliseconds
 * @returns {Promise<any>} - The result of the request or throws the last error
 */
async function retryWithBackoff(requestFn, maxRetries = 3, initialDelayMs = 2000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries}...`);
      }
      
      // Get the best available token before each attempt
      if (attempt > 0) {
        await this.rotateConfig();
      }
      
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // If this isn't a rate limit error or we've used all retries, throw
      if (!error.isRateLimit || attempt >= maxRetries) {
        throw error;
      }
      
      // Calculate backoff time with exponential increase and some jitter
      const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
      const delayMs = Math.min(
        initialDelayMs * Math.pow(2, attempt) * jitter,
        this.maxBackoffTime
      );
      
      console.log(`Rate limit hit. Backing off for ${Math.round(delayMs / 1000)} seconds...`);
      
      // If we have a reset time in the error, use that instead if it's sooner
      if (error.rateLimitReset) {
        const resetTimeMs = error.rateLimitReset;
        const timeUntilReset = resetTimeMs - Date.now();
        
        if (timeUntilReset > 0 && timeUntilReset < delayMs) {
          console.log(`Using rate limit reset time instead: ${Math.round(timeUntilReset / 1000)} seconds`);
          await new Promise(resolve => setTimeout(resolve, timeUntilReset + 1000)); // Add 1 second buffer
          continue;
        }
      }
      
      // Wait for the calculated delay
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // We should never reach here due to the throw in the loop, but just in case
  throw lastError;
} 

// Export the retry function for use elsewhere
export { retryWithBackoff }; 