// X API Proxy Service
// This module provides a secure way to communicate with the X (Twitter) API
// by implementing a server-side proxy approach

import { makeAuthenticatedRequest, handleApiError } from './auth-handler.js';
import { ProxyManager } from './proxy-config.js';
import { proxyUrl } from '../env.js';

// Configuration constants
const PROXY_SERVER_URL = 'http://143.198.111.238'; // Your proxy server URL
const FALLBACK_TO_DIRECT = true; // Whether to fallback to direct API calls if proxy is unavailable

/**
 * Makes an API request through the secure proxy server
 * @param {string} endpoint - The API endpoint to call
 * @param {Object} params - Optional query parameters
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @returns {Promise<Object>} - The API response data
 */
export async function proxyRequest(endpoint, params = {}, method = 'GET') {
  console.log(`Making proxy request to: ${endpoint}`);
  
  try {
    // Use the auth handler to make the request with token rotation and retries
    return await makeAuthenticatedRequest(endpoint, {
      method,
      params,
      useProxy: true
    });
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Create the proxy server URL with authentication if available
 * @returns {string} The proxy server URL
 */
export function getProxyServerUrl() {
  return ProxyManager.getBaseProxyUrl();
}

/**
 * Test the proxy connection with a simple endpoint
 * @returns {Promise<Object>} The test response
 */
export async function testProxyConnection() {
  return await ProxyManager.testConnection();
} 