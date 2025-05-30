/**
 * Direct handler for the analyze button - Improved version
 * Handles event binding and UI interactions for the X Profile Analyzer
 */

// Global references for UI helpers and DOM elements
let showToast, hideLoading, updateProgress, showLoading;
let profileInput, analyzeButton, resultsContainer, loadingOverlay, progressBar;
let directHandlerAnalyzing = false; // Track analysis state locally
let uniqueProgressInterval = null;
let uniqueApiTimeout = null;
let abortController = null; // For aborting API requests
let profileAnalyzer = null; // Global reference to ProfileAnalyzer

// Fallback ProfileAnalyzer implementation
class ProfileAnalyzerFallback {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
    return true;
  }
  
  async analyzeProfile(username, options = {}) {
    console.log('Using fallback ProfileAnalyzer for', username);
    
    // Generate fallback data
    return {
      username: username,
      displayName: username,
      isFallbackData: true,
      warning: 'Using fallback data - API unavailable',
      analytics: {
        metrics: {
          followers: Math.floor(Math.random() * 10000) + 1000,
          following: Math.floor(Math.random() * 1000) + 100,
          tweets: Math.floor(Math.random() * 5000) + 500
        },
        engagement: {
          rate: (Math.random() * 5 + 1).toFixed(1) + '%'
        }
      },
      strategy: {
        recommendations: [
          'Post consistently to increase visibility',
          'Engage with comments to build community',
          'Use visual content for higher engagement',
          'Participate in relevant conversations in your niche',
          'Use trending hashtags when relevant to your content'
        ]
      }
    };
  }
}

// Setup helper functions before DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('directHandler.js: Setting up direct analyze button handler');
  
  // Find and cache important DOM elements
  profileInput = document.getElementById('profile-input');
  analyzeButton = document.getElementById('analyze-button');
  resultsContainer = document.getElementById('results-container');
  loadingOverlay = document.querySelector('.loading-overlay');
  progressBar = document.querySelector('.progress-fill') || document.querySelector('.progress-bar');
  
  // Initialize UI helper references (before using them)
  setupUIHelpers();
  
  // Initialize the profileAnalyzer by getting it from window.ProfileAnalyzer or creating a fallback
  try {
    if (window.ProfileAnalyzer) {
      profileAnalyzer = window.ProfileAnalyzer;
    } else {
      profileAnalyzer = new ProfileAnalyzerFallback();
    }
  } catch (error) {
    console.error('Error initializing profileAnalyzer:', error);
    profileAnalyzer = new ProfileAnalyzerFallback();
  }
  
  // Initialize the UI
  initializeUI();
  
  // Hide results container initially
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
  
  // Set up analyze button click handler
  if (analyzeButton) {
    console.log('Setting up analyze button click handler');
    analyzeButton.addEventListener('click', handleAnalyzeClick);
  } else {
    console.error('Analyze button not found! Trying alternative selectors...');
    const altButtons = document.querySelectorAll('button.analyze-button, button[data-action="analyze"], button:contains("Analyze")');
    if (altButtons.length > 0) {
      console.log(`Found ${altButtons.length} alternative analyze buttons`);
      altButtons.forEach(btn => btn.addEventListener('click', handleAnalyzeClick));
    }
  }
  
  // Set up test API button
  const testApiButton = document.getElementById('test-api-button') || document.querySelector('.test-api-button');
  if (testApiButton) {
    testApiButton.addEventListener('click', handleTestApiClick);
  }
  
  // Setup cancel button handling in loading overlay
  const cancelButton = document.querySelector('.loading-overlay .cancel-button');
  if (cancelButton) {
    cancelButton.addEventListener('click', cancelAnalysis);
  }
});

// Setup UI helpers - get them from global window object if available
function setupUIHelpers() {
  // First log what's available to help with debugging
  console.log('Available UI helpers:', {
    xProfileAnalyzerAvailable: !!window.XProfileAnalyzer,
    bridgeAvailable: !!window.XProfileAnalyzer?.UI,
    showToastAvailable: !!window.showToast,
    updateProgressAvailable: !!window.updateProgress,
    hideLoadingAvailable: !!window.hideLoading,
    showLoadingAvailable: !!window.showLoading
  });
  
  // Try to get helpers from the XProfileAnalyzer namespace first (bridge.js)
  if (window.XProfileAnalyzer && window.XProfileAnalyzer.UI) {
    console.log('Using XProfileAnalyzer.UI helpers from bridge.js');
    showToast = window.XProfileAnalyzer.UI.showToast;
    hideLoading = window.XProfileAnalyzer.UI.hideLoading;
    updateProgress = window.XProfileAnalyzer.UI.updateProgress;
    showLoading = window.XProfileAnalyzer.UI.showLoading;
    return;
  }
  
  // Fallback to direct global functions if available (also set by bridge.js)
  if (window.showToast && window.hideLoading && window.updateProgress && window.showLoading) {
    console.log('Using global UI helper functions');
    showToast = window.showToast;
    hideLoading = window.hideLoading;
    updateProgress = window.updateProgress;
    showLoading = window.showLoading;
    return;
  }

  // Last resort fallbacks if no UI helpers are available
  console.warn('No UI helpers found, using basic fallbacks');
  
  // Simple toast implementation
  showToast = function(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    try {
      // Try to create a simple toast element if possible
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      
      // Add show class for animation
      setTimeout(() => toast.classList.add('show'), 10);
      
      // Auto remove after 3 seconds
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3000);
    } catch (e) {
      // Last resort - alert for errors only
      if (type === 'error') alert(message);
    }
  };
  
  // Simple loading overlay handling
  hideLoading = function() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    }
  };
  
  // Simple progress update
  updateProgress = function(progressBarOrSelector, percent) {
    // Validate inputs
    if (typeof percent !== 'number') {
      console.error('updateProgress called with invalid percent:', percent);
      return;
    }
    
    let progressElement;
    
    // If the first argument is a string (selector)
    if (typeof progressBarOrSelector === 'string') {
      progressElement = document.querySelector(progressBarOrSelector);
    } 
    // If it's a DOM element
    else if (progressBarOrSelector instanceof Element) {
      progressElement = progressBarOrSelector;
    } 
    // If it's not provided or invalid, try to find it
    else {
      progressElement = document.querySelector('.progress-fill') || 
                     document.querySelector('.progress-bar');
    }
    
    // Update the width if we found an element
    if (progressElement) {
      progressElement.style.width = `${percent}%`;
      
      // Optional: add pulse animation when complete
      if (percent >= 100) {
        progressElement.classList.add('pulse-animation');
      } else {
        progressElement.classList.remove('pulse-animation');
      }
    } else {
      console.warn('Progress bar element not found');
    }
  };
  
  // Simple show loading
  showLoading = function(message) {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      const loadingText = overlay.querySelector('.loading-text');
      if (loadingText && message) {
        loadingText.textContent = message;
      }
      
      overlay.classList.remove('hidden');
      setTimeout(() => overlay.classList.add('visible'), 10);
    }
  };
}

// Function to initialize UI state
function initializeUI() {
  console.log('Initializing UI state');
  
  // Attempt to find and initialize form elements if they exist
  try {
    // Get all tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Hide all tab contents initially
    tabContents.forEach(content => {
      content.style.display = 'none';
      content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // Set analyze tab as active by default
    const analyzeTabButton = document.querySelector('.tab-button[data-tab="analyze"]') || 
                           document.getElementById('analyze-tab');
    const analyzeTabContent = document.querySelector('.tab-content#analyze-tab') ||
                            document.querySelector('.tab-content[data-tab="analyze"]');
    
    if (analyzeTabButton && analyzeTabContent) {
      analyzeTabButton.classList.add('active');
      analyzeTabContent.classList.add('active');
      analyzeTabContent.style.display = 'block';
      console.log('Analyze tab set as active');
    } else {
      console.warn('Analyze tab elements not found, using fallback');
      // Just show the first tab as fallback
      if (tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons[0].classList.add('active');
        tabContents[0].classList.add('active');
        tabContents[0].style.display = 'block';
      }
    }
  } catch (error) {
    console.warn('Error setting up tabs:', error);
    // Non-critical error, continue with initialization
  }
  
  // Initialize profile input
  if (profileInput) {
    // Don't clear the input if it already has a value
    if (!profileInput.value) {
      profileInput.focus();
    }
    
    // Set up input change handler
    profileInput.addEventListener('input', updateAnalyzeButtonState);
    
    // Handle Enter key press
    profileInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && analyzeButton && !analyzeButton.disabled) {
        e.preventDefault();
        analyzeButton.click();
      }
    });
  } else {
    console.error('Profile input not found!');
  }
  
  // Initialize button states
  if (analyzeButton) {
    updateAnalyzeButtonState();
  }
  
  // Initialize loading overlay and progress bar
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
    
    // Ensure progress bar is reset
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.classList.remove('pulse-animation');
    }
  } else {
    console.warn('Loading overlay not found!');
  }
}

// Function to enable/disable analyze button based on input
function updateAnalyzeButtonState() {
  if (profileInput && analyzeButton) {
    const hasInput = profileInput.value.trim().length > 0;
    
    // Update button state
    analyzeButton.disabled = !hasInput;
    
    if (hasInput) {
      analyzeButton.classList.add('active');
    } else {
      analyzeButton.classList.remove('active');
    }
    
    console.log(`Analyze button state updated: disabled=${!hasInput}`);
  }
}

// Helper function to update loading status
function updateLoadingStatus(message, progress) {
  // Make sure both parameters are provided and valid
  if (typeof progress === 'number') {
    // Pass both the selector and percentage to updateProgress
    updateProgress('.progress-fill', progress);
  } else {
    console.warn('Invalid progress value in updateLoadingStatus:', progress);
  }
  
  // Update loading message if provided
  if (message) {
    showLoading(message);
  }
}

// Show an error and hide loading
function showError(message) {
  console.error('Error:', message);
  showToast(message, 'error');
  hideLoading();
  directHandlerAnalyzing = false; // Reset analyzing state
  
  // Reset button if it exists
  if (analyzeButton) {
    analyzeButton.disabled = false;
    analyzeButton.textContent = 'Analyze';
  }
}

// Helper function to hide loading and reset button
function hideLoadingAndResetButton() {
  directHandlerAnalyzing = false; // Reset analyzing state
  
  // Use the hideLoading function
  if (typeof hideLoading === 'function') {
    hideLoading();
  } else {
    // Fallback if hideLoading function is not available
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.classList.remove('visible');
    }
  }
  
  // Reset button if it exists
  if (analyzeButton) {
    analyzeButton.innerHTML = 'Analyze';
    analyzeButton.disabled = false;
  }
  
  // Clear any abort controller
  if (abortController) {
    abortController = null;
  }
  
  // Clear any intervals or timeouts
  if (uniqueProgressInterval) {
    clearInterval(uniqueProgressInterval);
    uniqueProgressInterval = null;
  }
  
  if (uniqueApiTimeout) {
    clearTimeout(uniqueApiTimeout);
    uniqueApiTimeout = null;
  }
}

// Extract username from input with improved error handling
function extractUsername(input) {
  if (!input || typeof input !== 'string') return null;
  
  input = input.trim();
  
  // Handle direct username with @
  if (input.startsWith('@')) {
    return input.substring(1);
  }
  
  // Handle full URL format
  const urlRegex = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)(?:\/|$)/i;
  const match = input.match(urlRegex);
  
  if (match && match[1]) {
    return match[1]; // Return the captured username
  }
  
  // Handle plain username (letters, numbers, underscores only)
  const usernameRegex = /^[a-zA-Z0-9_]{1,15}$/;
  if (usernameRegex.test(input)) {
    return input;
  }
  
  return null;
}

// Function to cancel the current analysis
function cancelAnalysis() {
  console.log('Cancelling analysis...');
  
  // Abort any in-progress API request
  if (abortController) {
    try {
      abortController.abort();
    } catch (error) {
      console.warn('Error aborting API request:', error);
      // Non-critical error, continue with cancellation
    }
  }
  
  // Clear any loading progress animation
  if (uniqueProgressInterval) {
    clearInterval(uniqueProgressInterval);
    uniqueProgressInterval = null;
  }
  
  // Clear any timeout
  if (uniqueApiTimeout) {
    clearTimeout(uniqueApiTimeout);
    uniqueApiTimeout = null;
  }
  
  // Reset UI
  hideLoadingAndResetButton();
  showToast('Analysis cancelled', 'info');
}

// Main function to handle analyze button click
async function handleAnalyzeClick() {
  console.log('Analyze button clicked');
  
  // Prevent multiple simultaneous requests
  if (directHandlerAnalyzing) {
    console.log('Already analyzing, ignoring click');
    showToast('Analysis in progress, please wait', 'info');
    return;
  }
  
  // Check for profile input
  if (!profileInput || !profileInput.value.trim()) {
    console.log('No profile input, cannot analyze');
    showToast('Please enter a profile handle or URL', 'error');
    return;
  }
  
  const username = extractUsername(profileInput.value);
  console.log('Extracted username:', username);
  
  if (!username) {
    showToast('Invalid profile format. Please use @handle or full profile URL.', 'error');
    return;
  }
  
  // Set analyzing state
  directHandlerAnalyzing = true;
  
  // Show loading state
  analyzeButton.disabled = true;
  analyzeButton.innerHTML = '<span class="loading-spinner"></span><span>Analyzing...</span>';
  
  // Show loading overlay with initial message
  showLoading('Analyzing profile...');
  
  // Explicitly reset progress bar width
  if (progressBar) {
    progressBar.style.width = '0%';
    progressBar.classList.remove('pulse-animation');
    progressBar.classList.remove('complete');
  }
  
  // Start progress animation
  let progress = 0;
  uniqueProgressInterval = setInterval(() => {
    progress += 1;
    if (progress > 90) {
      clearInterval(uniqueProgressInterval);
    }
    
    // Use updateProgress with both selector and percentage
    updateProgress('.progress-fill', progress);
    
    // Update loading text at different stages
    if (progress === 20) {
      showLoading('Fetching profile data...');
    } else if (progress === 40) {
      showLoading('Analyzing recent posts...');
    } else if (progress === 60) {
      showLoading('Calculating engagement metrics...');
    } else if (progress === 80) {
      showLoading('Generating insights...');
    }
  }, 100);
  
  // Set a timeout for the API call (20 seconds)
  uniqueApiTimeout = setTimeout(() => {
    if (directHandlerAnalyzing) {
      clearInterval(uniqueProgressInterval);
      console.warn('Analysis timed out!');
      
      // Don't reset UI yet - wait for the fallback to show
      showLoading('API request timed out, showing fallback data...');
      updateProgress('.progress-fill', 90);
      
      // Show fallback results after timeout
      showFallbackResults(username, null, 'Request timed out');
      
      // Reset button and state
      hideLoadingAndResetButton();
    }
  }, 20000);
  
  try {
    // Initialize the analyzer if needed
    if (!profileAnalyzer.initialized) {
      await profileAnalyzer.initialize();
    }
    
    // Use the ProfileAnalyzer to get profile data
    const profileData = await profileAnalyzer.analyzeProfile(username, {
      forceRefresh: true, // Always get fresh data
      tweetCount: 50 // Get up to 50 tweets for better analysis
    });
    
    // Clear timeouts and intervals since we got a response
    clearTimeout(uniqueApiTimeout);
    clearInterval(uniqueProgressInterval);
    
    // Complete the progress
    updateProgress('.progress-fill', 100);
    
    // Show results
    showResults(username, profileData);
    
    // Add to history if we have valid data
    if (!profileData.isFallbackData) {
      addToHistory(username, profileData);
    }
    
  } catch (error) {
    console.error('Error analyzing profile:', error);
    
    // Clear any pending timers
    clearInterval(uniqueProgressInterval);
    clearTimeout(uniqueApiTimeout);
    
    // Show error state
    showError(`Failed to analyze profile: ${error.message}`);
    
    // Try to show fallback results
    showFallbackResults(username, null, error.message);
  } finally {
    // Reset UI state
    hideLoadingAndResetButton();
  }
}

// Function to test API connection
async function handleTestApiClick() {
  console.log('Test API button clicked');
  
  // Get test button
  const testButton = document.getElementById('test-api-button') || 
                    document.querySelector('.test-api-button') ||
                    document.querySelector('button[data-action="test-api"]');
  
  if (!testButton) {
    console.error('Test API button not found!');
    showToast('Test button not found', 'error');
    return;
  }
  
  // Show loading state
  const originalText = testButton.textContent;
  testButton.disabled = true;
  testButton.textContent = 'Testing...';
  
  try {
    // Send test message to background script
    const response = await new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({
          action: 'testApiConnection',
          forceCheck: true
        }, function(response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
      
      // Add a timeout to avoid hanging
      setTimeout(() => reject(new Error('Request timed out')), 10000);
    });
    
    // Reset button state
    testButton.disabled = false;
    testButton.textContent = originalText;
    
    // Process response
    if (response && (response.success || 
                    (response.config1Result && response.config1Result.success) ||
                    (response.results && response.results.some(r => r.success)))) {
      showToast('API connection successful!', 'success');
      
      // Add additional info if available
      if (response.config1Result && response.config1Result.rateLimit) {
        const rl = response.config1Result.rateLimit;
        console.log(`Rate limit info - Remaining: ${rl.remaining}, Reset: ${rl.resetTime}`);
      }
    } else {
      showToast('API connection failed. Check console for details.', 'error');
      console.error('API test failed:', response);
    }
  } catch (error) {
    console.error('Error testing API:', error);
    
    // Reset button state
    testButton.disabled = false;
    testButton.textContent = originalText;
    
    // Show error
    showToast(`API test error: ${error.message}`, 'error');
  }
}

// Function to display results
function showResults(username, data) {
  console.log('Showing results for', username, data);
  
  if (!resultsContainer) {
    console.error('Results container not found');
    return;
  }
  
  resultsContainer.style.display = 'block';
  
  // Format metrics in a readable way
  const followers = formatNumber(data.analytics?.metrics?.followers || data.user?.public_metrics?.followers_count || 0);
  const following = formatNumber(data.analytics?.metrics?.following || data.user?.public_metrics?.following_count || 0);
  const tweets = formatNumber(data.analytics?.metrics?.tweets || data.user?.public_metrics?.tweet_count || 0);
  const engagement = data.analytics?.engagement?.rate || '0.00%';
  
  // Build recommendations list
  const recommendations = data.strategy?.recommendations || [];
  const recommendationsList = recommendations.map(rec => `<li>${rec}</li>`).join('');
  
  // Warning banner for fallback data
  const warningBanner = data.isFallbackData || data.warning
    ? `<div class="warning-banner">${data.warning || 'Using estimated data - API access limited'}</div>`
    : '';
  
  // Construct results HTML
  const resultsHTML = `
    <div class="results-card">
      ${warningBanner}
      <h3>Analysis for @${username}</h3>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${followers}</div>
          <div class="metric-label">Followers</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${following}</div>
          <div class="metric-label">Following</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${tweets}</div>
          <div class="metric-label">Tweets</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${engagement}</div>
          <div class="metric-label">Engagement</div>
        </div>
      </div>
      
      <h4>Recommended Strategies</h4>
      <ul class="strategy-list">
        ${recommendationsList}
      </ul>
      
      <div class="footer">
        <span class="timestamp">Analyzed ${new Date().toLocaleString()}</span>
        <span class="version">X Profile Analyzer v1.2.0</span>
      </div>
    </div>
  `;
  
  resultsContainer.innerHTML = resultsHTML;
}

// Show fallback results when API fails
function showFallbackResults(username, data = null, warning = null) {
  console.log('Showing fallback results for:', username);
  
  if (!resultsContainer) {
    console.error('Results container not found!');
    return;
  }
  
  // Prepare the fallback HTML with warning
  resultsContainer.style.display = 'block';
  
  // If we have some data, try to show it, otherwise show pure placeholder
  if (data && data.user) {
    // Call regular show results with a warning flag
    showResults(username, {
      ...data,
      fromFallback: true,
      isEstimated: true
    });
    
    // Add warning banner at the top if one was provided
    if (warning) {
      const warningEl = document.createElement('div');
      warningEl.className = 'api-warning-banner';
      warningEl.textContent = warning;
      resultsContainer.prepend(warningEl);
    }
  } else {
    // Show pure placeholder
    resultsContainer.innerHTML = `
      <div class="results-card">
        <div class="error-banner">API unavailable - showing estimated data</div>
        <h3>Analysis for @${username}</h3>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">~1.5K</div>
            <div class="metric-label">Followers</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">~400</div>
            <div class="metric-label">Following</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">~2.2K</div>
            <div class="metric-label">Tweets</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">1.2%</div>
            <div class="metric-label">Engagement</div>
          </div>
        </div>
        
        <div class="strategy-section">
          <h4>Recommended Strategies</h4>
          <ul class="strategy-recommendations">
            <li>Post consistently to increase visibility</li>
            <li>Engage with comments to build community</li>
            <li>Use visual content for higher engagement</li>
            <li>Participate in relevant conversations in your niche</li>
          </ul>
        </div>
        
        <p class="fallback-notice">Note: This is estimated data based on typical profiles. For accurate analysis, please ensure the API is correctly configured.</p>
      </div>
    `;
  }
}

// Format number for display (e.g. 1200 -> 1.2K)
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

// Add to history for quick access later
function addToHistory(username, data) {
  try {
    // Get existing history from storage
    chrome.storage.local.get(['profileHistory'], function(result) {
      const history = result.profileHistory || [];
      
      // Create a summarized entry for history
      const historyEntry = {
        username,
        displayName: data.displayName || username,
        followers: data.analytics?.metrics?.followers || data.user?.public_metrics?.followers_count || 0,
        following: data.analytics?.metrics?.following || data.user?.public_metrics?.following_count || 0,
        tweets: data.analytics?.metrics?.tweets || data.user?.public_metrics?.tweet_count || 0,
        engagement: data.analytics?.engagement?.rate || '0.00%',
        timestamp: Date.now(),
        profileImage: data.profileImageUrl || data.user?.profile_image_url || ''
      };
      
      // Add to beginning of array (newest first)
      history.unshift(historyEntry);
      
      // Limit history to 20 items
      const limitedHistory = history.slice(0, 20);
      
      // Save back to storage
      chrome.storage.local.set({ profileHistory: limitedHistory }, function() {
        console.log('Profile added to history:', username);
      });
    });
  } catch (error) {
    console.error('Error adding to history:', error);
  }
}

// Export key functions for testing/debugging
window.directHandler = {
  handleAnalyzeClick,
  showResults,
  showFallbackResults,
  cancelAnalysis,
  extractUsername
}; 