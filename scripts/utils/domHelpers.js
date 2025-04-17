/**
 * DOM Helper utilities for X Profile Analyzer
 * Contains reusable DOM interaction functions used across the extension
 */

/**
 * Cache common DOM elements for quick access
 * This helps prevent looking up elements multiple times
 */
const domCache = {
  // Keep track of whether elements have been initialized
  initialized: false,
  
  // UI Elements
  loadingOverlay: null,
  analyzeButton: null,
  profileInput: null,
  postUrlInput: null,
  resultsContainer: null,
  progressBar: null,
  progressFill: null,
  loadingText: null,
  
  // Initialize the cache by querying all elements once
  init() {
    if (this.initialized) return;
    
    this.loadingOverlay = document.querySelector('.loading-overlay');
    this.analyzeButton = document.getElementById('analyze-button');
    this.profileInput = document.getElementById('profile-input');
    this.postUrlInput = document.querySelector('.post-input');
    this.resultsContainer = document.getElementById('results-container');
    this.progressBar = document.querySelector('.progress-bar');
    this.progressFill = document.querySelector('.progress-fill');
    this.loadingText = document.querySelector('.loading-text');
    
    this.initialized = true;
    
    console.log('DOM helpers initialized, cached elements:', 
      Object.keys(this).filter(key => this[key] instanceof Element)
    );
    
    return this;
  },
  
  // Get an element with fallback to query if not cached
  get(key, fallbackSelector = null) {
    if (!this.initialized) this.init();
    
    if (this[key]) return this[key];
    
    // Try to find by fallback selector if provided
    if (fallbackSelector) {
      this[key] = document.querySelector(fallbackSelector);
      return this[key];
    }
    
    return null;
  }
};

/**
 * Show or hide the loading overlay with optional message
 * @param {boolean|string} showOrMessage - true/false to show/hide, or message string
 */
function toggleLoadingOverlay(showOrMessage = true) {
  const overlay = domCache.get('loadingOverlay', '.loading-overlay');
  if (!overlay) return;
  
  if (typeof showOrMessage === 'string') {
    // Update loading message
    const loadingText = domCache.get('loadingText', '.loading-text');
    if (loadingText) {
      loadingText.textContent = showOrMessage;
    }
    
    // Show the overlay
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('visible'), 10);
  } else if (showOrMessage === true) {
    // Just show the overlay
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('visible'), 10);
  } else {
    // Hide the overlay
    overlay.classList.remove('visible');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  }
}

/**
 * Extract username from profile URL or handle
 * @param {string} input - Profile URL or handle
 * @returns {string|null} - Extracted username or null if invalid
 */
function extractUsername(input) {
  if (!input) return null;
  
  // Handle direct username input (with or without @)
  if (input.startsWith('@')) {
    return input.substring(1);
  }
  
  // Check if it's a URL
  if (input.includes('twitter.com/') || input.includes('x.com/')) {
    try {
      // Try to parse as URL
      const url = new URL(input);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        return pathParts[0]; // First path component after domain
      }
    } catch (e) {
      // Not a valid URL, try regex extraction
      const match = input.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  
  // Assume it's a direct handle if nothing else matched
  // Validate username format (letters, numbers, underscore)
  if (/^[A-Za-z0-9_]+$/.test(input)) {
    return input;
  }
  
  return null;
}

/**
 * Format number for display (e.g. 1200 -> 1.2K)
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  
  return num.toString();
}

/**
 * Add global references to make helpers available to window scope
 */
// Make DOM cache available globally
window.domCache = domCache;
window.loadingOverlay = domCache.loadingOverlay;
window.analyzeButton = domCache.analyzeButton;
window.profileInput = domCache.profileInput;
window.extractUsername = extractUsername;
window.formatNumber = formatNumber;
window.toggleLoadingOverlay = toggleLoadingOverlay;

// Initialize DOM cache when the page is ready
document.addEventListener('DOMContentLoaded', () => {
  domCache.init();
  
  // Update global references after initialization
  window.loadingOverlay = domCache.loadingOverlay;
  window.analyzeButton = domCache.analyzeButton;
  window.profileInput = domCache.profileInput;
});

// Export for ES modules
export {
  domCache,
  extractUsername,
  formatNumber,
  toggleLoadingOverlay
}; 