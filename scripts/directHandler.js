/**
 * Direct handler for the analyze button - Improved version
 * Handles event binding and UI interactions for the X Profile Analyzer
 */

// Global references for UI helpers and DOM elements
let showToast, hideLoading, updateProgress, showLoading;
let profileInput, analyzeButton, resultsContainer, loadingOverlay, progressBar;
let isAnalyzing = false; // Track analysis state
let progressInterval = null;
let apiTimeout = null;

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
  
  // Initialize the UI
  initializeUI();
  
  // Setup tab navigation
  setupTabNavigation();
  
  // Hide results container initially
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
  
  // Set up analyze button click handler
  if (analyzeButton) {
    console.log('Setting up analyze button click handler');
    analyzeButton.addEventListener('click', handleAnalyzeClick);
  }
  
  // Set up test API button
  const testApiButton = document.getElementById('test-api-button');
  if (testApiButton) {
    testApiButton.addEventListener('click', handleTestApiClick);
  }
});

// Setup UI helpers - get them from global window object if available
function setupUIHelpers() {
  // First log what's available to help with debugging
  console.log('Available UI helpers:', {
    xUiHelpersAvailable: !!window.xUiHelpers,
    showToastAvailable: !!window.showToast,
    updateProgressAvailable: !!window.updateProgress,
    hideLoadingAvailable: !!window.hideLoading,
    showLoadingAvailable: !!window.showLoading
  });
  
  // First try to get the helpers from the global xUiHelpers object
  if (window.xUiHelpers) {
    console.log('Using global xUiHelpers object');
    showToast = function(message, type) {
      window.xUiHelpers.showToast.call(window.xUiHelpers, message, type);
    };
    hideLoading = function() {
      window.xUiHelpers.hideLoading.call(window.xUiHelpers);
    };
    updateProgress = function(selector, percent) {
      window.xUiHelpers.updateProgress.call(window.xUiHelpers, selector, percent);
    };
    showLoading = function(message) {
      window.xUiHelpers.showLoading.call(window.xUiHelpers, message);
    };
    return;
  }
  
  // Fallback to individual global functions if available
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
  showToast = function(message, type) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    try {
      // Try to create a simple toast element if possible
      const container = document.querySelector('.toast-container') || 
                        document.createElement('div');
      
      if (!container.parentNode) {
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      
      // Auto remove after 3 seconds
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 3000);
    } catch (e) {
      // Last resort - alert for errors only
      if (type === 'error') alert(message);
    }
  };
  
  hideLoading = function() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    }
  };
  
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
  const analyzeTabButton = document.getElementById('analyze-tab');
  const analyzeTabContent = document.querySelector('.tab-content#analyze-tab');
  
  if (analyzeTabButton && analyzeTabContent) {
    analyzeTabButton.classList.add('active');
    analyzeTabContent.classList.add('active');
    analyzeTabContent.style.display = 'block';
    console.log('Analyze tab set as active');
  } else {
    console.error('Analyze tab elements not found:', {
      buttonFound: !!analyzeTabButton,
      contentFound: !!analyzeTabContent
    });
  }
  
  // Initialize profile input
  if (profileInput) {
    profileInput.value = '';
    profileInput.focus();
    
    // Set up input change handler
    profileInput.addEventListener('input', updateAnalyzeButtonState);
    
    // Handle Enter key press
    profileInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && analyzeButton && !analyzeButton.disabled) {
        e.preventDefault();
        analyzeButton.click();
      }
    });
  }
  
  // Initialize button states
  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.classList.remove('active');
  }
  
  // Initialize loading overlay and progress bar
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
    
    // Ensure progress bar is reset
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.classList.remove('pulse-animation');
    }
    
    // Set up cancel button
    const cancelButton = loadingOverlay.querySelector('.cancel-button');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        clearInterval(progressInterval);
        clearTimeout(apiTimeout);
        
        hideLoading();
        if (analyzeButton) {
          analyzeButton.disabled = false;
          analyzeButton.innerHTML = 'Analyze';
        }
        showToast('Analysis canceled', 'info');
        
        // Reset analyzing state
        isAnalyzing = false;
      });
    }
  }
  
  // Initial button state
  updateAnalyzeButtonState();
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

// Set up tab navigation
function setupTabNavigation() {
  console.log('Setting up tab navigation');
  
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  if (!tabButtons.length || !tabContents.length) {
    console.error('Tab elements not found:', {
      buttonCount: tabButtons.length,
      contentCount: tabContents.length
    });
    return;
  }
  
  // Set up click handlers for each tab button
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const tabId = e.currentTarget.id;
      console.log(`Tab clicked: ${tabId}`);
      
      // Remove active class from all buttons
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      e.currentTarget.classList.add('active');
      
      // Hide all tab contents
      tabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });
      
      // Show the corresponding tab content
      const contentId = tabId;
      const selectedContent = document.querySelector(`.tab-content#${contentId}`);
      if (selectedContent) {
        selectedContent.classList.add('active');
        selectedContent.style.display = 'block';
        
        // Load history if switching to history tab
        if (tabId === 'history-tab') {
          console.log('History tab activated, loading history');
          setTimeout(() => {
            loadHistory();
          }, 100); // Short delay to ensure DOM is ready
        }
      } else {
        console.error(`Tab content not found for ${tabId}`);
      }
    });
  });
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
  isAnalyzing = false; // Reset analyzing state
}

// Helper function to hide loading and reset button
function hideLoadingAndResetButton() {
  isAnalyzing = false; // Reset analyzing state
  
  // Use the hideLoading function
  hideLoading();
  
  // Reset button if it exists
  if (analyzeButton) {
    analyzeButton.innerHTML = 'Analyze';
    analyzeButton.disabled = false;
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

// Main function to handle analyze button click
function handleAnalyzeClick() {
  console.log('Analyze button clicked');
  
  // Prevent multiple simultaneous requests
  if (isAnalyzing) {
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
  isAnalyzing = true;
  
  // Show loading state
  analyzeButton.disabled = true;
  analyzeButton.innerHTML = '<span class="loading-spinner"></span><span>Analyzing...</span>';
  
  // Show loading overlay with initial message
  showLoading('Analyzing profile...');
  
  // Explicitly reset progress bar width
  if (progressBar) {
    progressBar.style.width = '0%';
    progressBar.classList.remove('pulse-animation');
  }
  
  // Start progress animation
  let progress = 0;
  progressInterval = setInterval(() => {
    progress += 1;
    if (progress > 90) {
      clearInterval(progressInterval);
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
  apiTimeout = setTimeout(() => {
    clearInterval(progressInterval);
    hideLoadingAndResetButton();
    showToast('Analysis timed out. Please try again later.', 'error');
    
    // Show fallback results
    showFallbackResults(username);
  }, 20000);
  
  // Send message to background script
  try {
    chrome.runtime.sendMessage({
      action: 'analyzeProfile',
      username: username
    }, function(response) {
      // Clear timeouts since we got a response
      clearTimeout(apiTimeout);
      clearInterval(progressInterval);
      
      // Complete the progress
      updateProgress('.progress-fill', 100);
      showLoading('Processing results...');
      
      // Slight delay for visual feedback
      setTimeout(() => {
        hideLoadingAndResetButton();
        
        // Handle response
        if (response && response.success) {
          // Show results
          showResults(username, response.data);
          showToast(`Profile analysis for @${username} complete!`, 'success');
        } else {
          // Show error and fallback results
          const errorMsg = response?.error || 'Unknown error occurred';
          showToast(`Analysis error: ${errorMsg}`, 'error');
          showFallbackResults(username);
        }
      }, 500);
    });
  } catch (error) {
    clearInterval(progressInterval);
    clearTimeout(apiTimeout);
    hideLoadingAndResetButton();
    showToast(`Error: ${error.message || 'Unknown error'}`, 'error');
    showFallbackResults(username);
  }
}

// Placeholder for test API handler
function handleTestApiClick() {
  console.log('Test API button clicked');
  showToast('Testing API connectivity...', 'info');
  
  // Disable button while testing
  const testButton = document.getElementById('test-api-button');
  if (testButton) {
    testButton.disabled = true;
    testButton.textContent = 'Testing...';
  }
  
  // Send test message to background script
  chrome.runtime.sendMessage({
    action: 'testApiConnection',
    forceCheck: true
  }, function(response) {
    // Re-enable button
    if (testButton) {
      testButton.disabled = false;
      testButton.textContent = 'Test API';
    }
    
    // Process response
    if (response && (response.success || (response.config1Result && response.config1Result.success))) {
      showToast('API connection successful!', 'success');
    } else {
      showToast('API connection failed. Check console for details.', 'error');
      console.error('API test failed:', response);
    }
  });
}

// Simple implementation of showResults
function showResults(username, data) {
  console.log('Showing results for:', username, data);
  
  // Basic implementation
  if (resultsContainer) {
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <div class="results-card">
        <h3>Analysis for @${username}</h3>
        <p>Profile analyzed successfully. Displaying results...</p>
      </div>
    `;
  }
}

// Simple implementation of showFallbackResults
function showFallbackResults(username) {
  console.log('Showing fallback results for:', username);
  
  // Basic implementation
  if (resultsContainer) {
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <div class="results-card">
        <div class="error-banner">API unavailable - showing estimated data</div>
        <h3>Analysis for @${username}</h3>
        <p>Unable to retrieve data from API. Showing placeholder results.</p>
      </div>
    `;
  }
}

// Placeholder for loadHistory function
function loadHistory() {
  console.log('Loading history items (placeholder)');
}

// Optional: Helper functions for showing results
function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  
  return num.toString();
}

// For adding to history (placeholder implementation)
function addToHistory(username, metrics) {
  console.log('Added to history:', username, metrics);
}

// Clear browser cache for the extension
function handleClearCache() {
  console.log('Clearing cache...');
  
  chrome.runtime.sendMessage({
    action: 'clearCache'
  }, function(response) {
    if (response && response.success) {
      showToast('Cache cleared successfully!', 'success');
    } else {
      showToast('Failed to clear cache', 'error');
    }
  });
}

// Clear analysis history
function clearHistory() {
  console.log('Clearing history...');
  
  chrome.storage.local.remove(['analysisHistory'], function() {
    if (chrome.runtime.lastError) {
      showToast('Error clearing history: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showToast('History cleared successfully', 'success');
      
      // Refresh history tab if it's active
      const historyTab = document.querySelector('#history-tab');
      if (historyTab && historyTab.classList.contains('active')) {
        const historyContainer = document.querySelector('.history-container');
        if (historyContainer) {
          historyContainer.innerHTML = '<p class="no-history">No history available</p>';
        }
      }
    }
  });
} 