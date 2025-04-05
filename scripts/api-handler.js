// api-handler.js - Centralized API request handling with proxy support
import { authHandler } from './auth-handler.js';
import { proxyManager } from './proxy-config.js';

export class APIHandler {
  constructor() {
    this.baseUrl = 'https://api.twitter.com/2';
    this.initialized = false;
    this.initPromise = null;
    this.pendingRequests = new Map();
    this.requestTimeouts = new Map();

    // Higher timeout for API requests
    this.requestTimeout = 20000; // 20 seconds
  }

  async initialize() {
    if (this.initialized) return true;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise(async (resolve) => {
      try {
        // Initialize auth and proxy handlers
        await Promise.all([
          authHandler.initialize(),
          proxyManager.initialize()
        ]);

        this.initialized = true;
        resolve(true);
      } catch (error) {
        console.error('Failed to initialize API handler:', error);
        resolve(false);
      }
    });

    return this.initPromise;
  }

  /**
   * Make an API request with proper error handling and timeout protection
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Store a cancellable request promise
      const requestPromise = new Promise(async (resolve, reject) => {
        // Set a timeout to prevent hanging requests
        const timeoutId = setTimeout(() => {
          reject(new Error('API request timed out'));
          this.pendingRequests.delete(requestId);
        }, this.requestTimeout);
        
        this.requestTimeouts.set(requestId, timeoutId);
        
        try {
          const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
          
          // Check if proxy is available
          const useProxy = proxyManager.shouldUseProxy();
          
          // If proxy is not available or has known issues, use direct connection
          if (!useProxy) {
            console.log('Using direct connection to API (proxy unavailable)');
            const directResponse = await this.makeDirectRequest(url, options);
            
            // Clear timeout and resolve
            clearTimeout(timeoutId);
            this.requestTimeouts.delete(requestId);
            this.pendingRequests.delete(requestId);
            
            resolve({
              success: true,
              data: directResponse,
              source: 'direct'
            });
            return;
          }
          
          // Try with proxy
          try {
            // Add proxy configuration
            const modifiedOptions = proxyManager.modifyRequest(options);
            
            // Make authenticated request with retry and rate limit handling
            const response = await authHandler.makeAuthenticatedRequest(url, modifiedOptions);
            
            // Clear timeout and resolve
            clearTimeout(timeoutId);
            this.requestTimeouts.delete(requestId);
            this.pendingRequests.delete(requestId);
            
            resolve({
              success: true,
              data: response,
              source: 'proxy'
            });
          } catch (proxyError) {
            console.error('Proxy request failed:', proxyError);
            
            // Check if error is related to proxy connection
            if (
              proxyError.message.includes('Refused to connect') || 
              proxyError.message.includes('Failed to fetch') ||
              proxyError.message.includes('NetworkError') ||
              proxyError.message.includes('violated')
            ) {
              console.log('Falling back to direct API connection due to connection error');
              const directResponse = await this.makeDirectRequest(url, options);
              
              // Clear timeout and resolve
              clearTimeout(timeoutId);
              this.requestTimeouts.delete(requestId);
              this.pendingRequests.delete(requestId);
              
              resolve({
                success: true,
                data: directResponse,
                source: 'direct_fallback'
              });
              return;
            }
            
            // Other errors, propagate
            throw proxyError;
          }
        } catch (error) {
          // Clear timeout and reject
          clearTimeout(timeoutId);
          this.requestTimeouts.delete(requestId);
          this.pendingRequests.delete(requestId);
          
          reject(error);
        }
      });
      
      // Store the request
      this.pendingRequests.set(requestId, requestPromise);
      
      // Wait for the request to complete
      return await requestPromise;
    } catch (error) {
      console.error('API request failed:', error);
      
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Make a direct request to the Twitter API without going through the proxy
   * @private
   */
  async makeDirectRequest(url, options = {}) {
    console.log(`Making direct API request to: ${url}`);
    
    // Get bearer token from auth handler
    const bearerToken = await this.getBearerToken();
    if (!bearerToken) {
      throw new Error('No valid bearer token available');
    }
    
    try {
      // Parse URL to extract parameters if this is a GET request
      const urlObj = new URL(url);
      const params = {};
      
      // Extract parameters from URL for GET requests
      if (options.method !== 'POST' && options.method !== 'PUT') {
        for (const [key, value] of urlObj.searchParams.entries()) {
          params[key] = value;
        }
      }
      
      // Merge with options.params if provided
      const mergedParams = { ...params, ...(options.params || {}) };
      
      // For GET requests, add params to URL
      if (!options.method || options.method === 'GET') {
        // Clear existing search params
        urlObj.search = '';
        
        // Add merged params
        Object.entries(mergedParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlObj.searchParams.append(key, value);
          }
        });
        
        // Update URL with new params
        url = urlObj.toString();
      }
      
      // Create fetch options
      const fetchOptions = {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'X-Analyzer-Extension/1.0'
        },
        // Use cors mode to handle direct API requests
        mode: 'cors',
        credentials: 'omit'
      };
      
      // Add body for non-GET requests
      if ((options.method === 'POST' || options.method === 'PUT') && options.params) {
        fetchOptions.body = JSON.stringify(options.params);
      }
      
      // Add timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      fetchOptions.signal = controller.signal;
      
      try {
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        // Handle error responses
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: errorText };
          }
          
          throw new Error(errorData.error || errorData.message || `HTTP error ${response.status}`);
        }
        
        // Parse JSON response
        const data = await response.json();
        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('API request timed out');
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Direct API request failed:', error);
      throw error;
    }
  }
  
  /**
   * Get a valid bearer token for direct API requests
   * @private
   */
  async getBearerToken() {
    try {
      // Try to get from auth handler first
      if (authHandler.tokenRotation?.configs) {
        for (const config of authHandler.tokenRotation.configs) {
          if (config && config.bearerToken) {
            return config.bearerToken;
          }
        }
      }
      
      // Fallback to env.js
      const envModule = await import('../env.js');
      if (envModule.twitter) {
        if (envModule.twitter.config1?.bearerToken) {
          return envModule.twitter.config1.bearerToken;
        }
        
        if (envModule.twitter.config2?.bearerToken) {
          return envModule.twitter.config2.bearerToken;
        }
      }
      
      throw new Error('No valid bearer token found');
    } catch (error) {
      console.error('Error getting bearer token:', error);
      return null;
    }
  }

  /**
   * Get user data by username
   */
  async getUserByUsername(username) {
    return this.makeRequest(`users/by/username/${username}`, {
      method: 'GET',
      params: {
        'user.fields': 'created_at,description,entities,id,location,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type'
      }
    });
  }

  /**
   * Get user tweets
   */
  async getUserTweets(userId, options = {}) {
    return this.makeRequest(`users/${userId}/tweets`, {
      method: 'GET',
      params: {
        'max_results': options.maxResults || 10,
        'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
        'exclude': 'retweets,replies'
      }
    });
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const result = await this.makeRequest(`users/me`, {
        method: 'GET'
      });
      
      if (result.success) {
        return {
          success: true,
          message: 'API connection successful',
          data: result.data
        };
      } else {
        return {
          success: false,
          message: result.error || 'Connection test failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `API connection failed: ${error.message}`
      };
    }
  }

  /**
   * Abort all pending requests
   */
  abortAllRequests() {
    // Clear all timeouts
    for (const [requestId, timeoutId] of this.requestTimeouts.entries()) {
      clearTimeout(timeoutId);
    }
    
    // Clear maps
    this.requestTimeouts.clear();
    this.pendingRequests.clear();
  }

  formatError(error) {
    // Check for API error code
    if (error.code) {
      // Return user-friendly error message based on error code
      switch (error.code) {
        case 'AUTH_ERROR':
          return 'Authentication failed. Please check your API credentials.';
        case 'RATE_LIMIT_EXCEEDED':
          return 'Rate limit exceeded. Please try again in a few minutes.';
        case 'NETWORK_ERROR':
          return 'Network connection error. Please check your internet connection.';
        case 'TIMEOUT':
          return 'Request timed out. The server took too long to respond.';
        case 'MAX_RETRIES':
          return 'Request failed after multiple attempts. Please try again later.';
        case 'HTTP_ERROR':
          return `Server responded with an error (${error.status}).`;
        case 'CSP_ERROR':
          return 'Connection blocked by browser security. Falling back to direct API.';
        default:
          return `Error: ${error.message}`;
      }
    }
    
    // Format error messages for user display
    if (error.message.includes('RATE_LIMIT_EXCEEDED') || 
        error.message.includes('rate limit') || 
        error.message.includes('429')) {
      return 'Rate limit exceeded. Please try again in a few minutes.';
    }
    
    if (error.message.includes('401') || 
        error.message.includes('unauthorized') || 
        error.message.includes('authentication')) {
      return 'Authentication failed. Please check your API credentials.';
    }
    
    if (error.message.includes('403') || 
        error.message.includes('forbidden')) {
      return 'Access forbidden. Please verify your API permissions.';
    }

    if (error.message.includes('port closed') || 
        error.message.includes('message port closed')) {
      return 'Communication error. Please refresh the extension and try again.';
    }
    
    if (error.message.includes('timeout') || 
        error.message.includes('timed out')) {
      return 'Request timed out. The server took too long to respond.';
    }
    
    if (error.message.includes('network') || 
        error.message.includes('failed to fetch')) {
      return 'Network error. Please check your internet connection.';
    }
    
    if (error.message.includes('Content Security Policy') || 
        error.message.includes('Refused to connect')) {
      return 'Browser security blocked the connection. Using direct API connection.';
    }
    
    return `An error occurred: ${error.message}. Please try again.`;
  }
}

// Export a singleton instance
export const apiHandler = new APIHandler();

// Initialize the API handler
apiHandler.initialize().then(initialized => {
  console.log(`API handler initialization ${initialized ? 'successful' : 'failed'}`);
}); 