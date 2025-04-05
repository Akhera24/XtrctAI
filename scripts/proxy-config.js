// proxy-config.js - Central configuration for proxy settings
import { proxyConfig, proxyUrl } from '../env.js';

/**
 * Proxy Configuration Module
 * Provides utilities for proxy management and connection
 */
export const ProxyManager = {
  /**
   * Check if the proxy is enabled
   * @returns {boolean} Whether proxy is enabled
   */
  isEnabled() {
    return proxyConfig.enabled;
  },
  
  /**
   * Get the proxy URL
   * @returns {string} Proxy URL
   */
  getProxyUrl() {
    return proxyUrl;
  },
  
  /**
   * Get proxy authentication header
   * @returns {Object|null} Authentication header or null if not available
   */
  getAuthHeader() {
    if (proxyConfig.auth?.username && proxyConfig.auth?.password) {
      const authString = `${proxyConfig.auth.username}:${proxyConfig.auth.password}`;
      return {
        'Authorization': `Basic ${btoa(authString)}`
      };
    }
    return null;
  },
  
  /**
   * Configure fetch options with proxy settings
   * @param {Object} options - Original fetch options
   * @returns {Object} Enhanced fetch options with proxy configuration
   */
  configureFetchOptions(options = {}) {
    const enhancedOptions = { ...options };
    
    // Set headers
    enhancedOptions.headers = enhancedOptions.headers || {};
    
    // Add auth headers if available
    const authHeader = this.getAuthHeader();
    if (authHeader) {
      enhancedOptions.headers = {
        ...enhancedOptions.headers,
        ...authHeader
      };
    }
    
    // Add proxy-specific headers
    enhancedOptions.headers['X-Proxy-Enabled'] = 'true';
    
    return enhancedOptions;
  },
  
  /**
   * Test the proxy connection
   * @returns {Promise<boolean>} Whether the proxy is accessible
   */
  async testConnection() {
    try {
      const options = this.configureFetchOptions({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Connection': 'true'
        },
        body: JSON.stringify({ test: true }),
        mode: 'cors',
        credentials: 'omit'
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      options.signal = controller.signal;
      
      const response = await fetch(proxyUrl, options);
        clearTimeout(timeoutId);
        
      return response.ok;
    } catch (error) {
      console.error('Proxy connection test failed:', error);
      return false;
    }
  }
};

// Export the proxy configuration directly
export const config = {
  enabled: proxyConfig.enabled,
  url: proxyUrl,
  timeout: proxyConfig.timeout,
  retryAttempts: proxyConfig.retryAttempts,
  retryDelay: proxyConfig.retryDelay,
  fallbackToDirect: proxyConfig.fallbackToDirect
}; 