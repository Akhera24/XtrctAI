/**
 * ProxyClient - A robust client for handling X API proxy requests
 * 
 * This client provides a reliable way to make requests to the Twitter/X API
 * through a proxy server, with built-in error handling, availability checking,
 * and automatic retries.
 */

class ProxyClient {
  constructor(proxyUrl) {
    this.proxyUrl = proxyUrl;
    this.available = null; // null means not yet checked
    this.lastChecked = 0;
    this.checkInterval = 5 * 60 * 1000; // 5 minutes
    this.timeout = 5000; // 5 seconds timeout for availability check
    this.retryLimit = 3;
  }
  
  /**
   * Check if the proxy server is available
   * @returns {Promise<boolean>} Whether the proxy is accessible
   */
  async isAvailable() {
    const now = Date.now();
    
    // Return cached result if we checked recently
    if (now - this.lastChecked < this.checkInterval && this.available !== null) {
      return this.available;
    }
    
    try {
      console.log(`Checking proxy availability at ${this.proxyUrl}`);
      
      // Use fetch with timeout for checking availability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.warn(`Proxy availability check timeout after ${this.timeout}ms`);
      }, this.timeout);
      
      const response = await fetch(this.proxyUrl, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'X-Proxy-Check': 'true'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Update status based on response
      this.available = response.ok;
      this.lastChecked = now;
      
      console.log(`Proxy availability check result: ${this.available ? 'Available' : 'Unavailable'}`);
      return this.available;
    } catch (error) {
      console.warn('Proxy availability check failed:', error);
      
      // Check for specific CORS/network errors
      const isCorsError = error.message.includes('CORS') || 
                          error.message.includes('blocked') ||
                          error.message.includes('policy');
                          
      const isNetworkError = error.message.includes('network') ||
                             error.message.includes('fetch') ||
                             error.name === 'AbortError' ||
                             error.name === 'TypeError';
      
      // Update status based on error type
      this.available = false;
      this.lastChecked = now;
      
      // Log more detailed error information
      console.warn('Proxy error details:', {
        isCorsError,
        isNetworkError,
        name: error.name,
        message: error.message
      });
      
      return false;
    }
  }
  
  /**
   * Make a request through the proxy
   * @param {string} endpoint - The API endpoint to call
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Fetch response
   */
  async makeRequest(endpoint, options = {}) {
    // Check availability first
    if (!await this.isAvailable()) {
      throw new Error('Proxy server is not available');
    }
    
    let lastError;
    
    // Try multiple times with backoff
    for (let attempt = 0; attempt < this.retryLimit; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt + 1}/${this.retryLimit} for proxy request`);
          // Add exponential backoff delay
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
        
        console.log(`Making proxy request to: ${endpoint}`);
        
        // Full URL for the proxy request
        const url = endpoint.startsWith('http') 
          ? `${this.proxyUrl}?url=${encodeURIComponent(endpoint)}`
          : `${this.proxyUrl}/${endpoint.replace(/^\//, '')}`;
        
        // Create controller for timeout
        const controller = new AbortController();
        const timeoutMs = options.timeout || 15000;
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.warn(`Proxy request timeout after ${timeoutMs}ms`);
        }, timeoutMs);
        
        // Remove the timeout option since it's not standard and we're handling it manually
        const fetchOptions = { ...options };
        delete fetchOptions.timeout;
        
        // Make the request
        const response = await fetch(url, {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            'X-Proxy-Target': 'twitter-api',
            'X-Original-URL': endpoint,
            'X-Retry-Count': attempt.toString()
          },
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle rate limits with proper retry
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
          console.log(`Rate limited, retrying after ${retryAfter} seconds`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        // Check for transient errors that are worth retrying
        const isTransient = error.name === 'AbortError' || 
                           error.message.includes('network') ||
                           error.message.includes('timeout') ||
                           error.message.includes('failed');
        
        if (!isTransient) {
          console.error('Non-transient proxy error, will not retry:', error);
          break;
        }
        
        console.warn(`Transient proxy error (attempt ${attempt + 1}/${this.retryLimit}):`, error);
      }
    }
    
    throw new Error(`Proxy request failed after ${this.retryLimit} attempts: ${lastError.message}`);
  }
  
  /**
   * Make an authenticated API request through the proxy
   * @param {string} endpoint - API endpoint
   * @param {Object} config - API config with bearer token
   * @returns {Promise<Object>} - Parsed JSON response
   */
  async makeAuthenticatedRequest(endpoint, config) {
    try {
      // Get bearer token from config
      const bearerToken = config.bearerToken || config.BEARER_TOKEN;
      
      if (!bearerToken) {
        throw new Error('No bearer token available for proxy request');
      }
      
      // Prepare headers
      const headers = {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'X-Analyzer-Extension/1.0',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      };
      
      // Make the request
      const response = await this.makeRequest(endpoint, { 
        method: 'GET',
        headers,
        timeout: 15000
      });
      
      // Handle errors
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
        } catch (e) {
          // If we can't parse the error JSON, use the status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
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
      
      // Return successful response
      return await response.json();
    } catch (error) {
      console.error(`Proxy authenticated request failed: ${error.message}`);
      throw error;
    }
  }
}

// Export a singleton instance with the DigitalOcean proxy URL
export const proxyClient = new ProxyClient('https://143.198.111.238:3000/api/proxy');

// Also export the class for custom instances
export default ProxyClient; 