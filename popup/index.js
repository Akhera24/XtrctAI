// popup/index.js - Main initialization script for the popup
// Avoids module import/export syntax for better compatibility

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('X Profile Analyzer popup initialized');
  
  // Initialize UI helpers
  initializeUIHelpers();
  
  // Initialize DOM cache for performance
  initializeDOMCache();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load and display any cached data
  loadCachedData();
  
  // Check API connection status
  checkAPIStatus();
});

// Global references
const UI = {
  profileInput: null,
  analyzeButton: null,
  testApiButton: null,
  resultsContainer: null,
  loadingOverlay: null,
  progressBar: null,
  cancelButton: null,
  statusIcon: null
};

// Initialize DOM cache for performance
function initializeDOMCache() {
  UI.profileInput = document.getElementById('profile-input');
  UI.analyzeButton = document.getElementById('analyze-button');
  UI.testApiButton = document.getElementById('test-api-button');
  UI.resultsContainer = document.getElementById('results-container');
  UI.loadingOverlay = document.querySelector('.loading-overlay');
  UI.progressBar = document.querySelector('.progress-fill');
  UI.cancelButton = document.querySelector('.cancel-button');
  UI.statusIcon = document.querySelector('.status-dot');
  
  // Log what was found for debugging
  console.log('DOM Cache Initialized:', {
    profileInput: !!UI.profileInput,
    analyzeButton: !!UI.analyzeButton,
    testApiButton: !!UI.testApiButton,
    resultsContainer: !!UI.resultsContainer,
    loadingOverlay: !!UI.loadingOverlay,
    progressBar: !!UI.progressBar,
    cancelButton: !!UI.cancelButton,
    statusIcon: !!UI.statusIcon
  });
}

// Initialize UI helper functions
function initializeUIHelpers() {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  // Define global showToast function
  window.showToast = function(message, type = 'info') {
    console.log(`Toast (${type}): ${message}`);
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-message">${message}</span>
        <button class="toast-close">×</button>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Add animation class after a small delay
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto dismiss
    const timeout = setTimeout(() => dismissToast(toast), 3000);
    
    // Add close button functionality
    const closeButton = toast.querySelector('.toast-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        clearTimeout(timeout);
        dismissToast(toast);
      });
    }
  };
  
  // Define dismiss toast helper
  function dismissToast(toast) {
    if (!toast) return;
    
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
  
  // Define global showLoading function
  window.showLoading = function(message) {
    if (!UI.loadingOverlay) return;
    
    const loadingText = UI.loadingOverlay.querySelector('.loading-text');
    if (loadingText && message) {
      loadingText.textContent = message;
    }
    
    UI.loadingOverlay.classList.remove('hidden');
    setTimeout(() => UI.loadingOverlay.classList.add('visible'), 10);
  };
  
  // Define global hideLoading function
  window.hideLoading = function() {
    if (!UI.loadingOverlay) return;
    
    UI.loadingOverlay.classList.remove('visible');
    setTimeout(() => {
      UI.loadingOverlay.classList.add('hidden');
    }, 300);
  };
  
  // Define global updateProgress function
  window.updateProgress = function(selector, percent) {
    if (!UI.progressBar) return;
    
    // Ensure percent is a number and clamp it between 0-100
    percent = Math.max(0, Math.min(100, Number(percent) || 0));
    
    UI.progressBar.style.width = `${percent}%`;
    
    // Add pulse animation when complete
    if (percent >= 100) {
      UI.progressBar.classList.add('pulse-animation');
    } else {
      UI.progressBar.classList.remove('pulse-animation');
    }
  };
}

// Set up event listeners
function setupEventListeners() {
  // Set a flag to indicate tabs are being managed here
  window.XProfileAnalyzer = window.XProfileAnalyzer || {};
  window.XProfileAnalyzer.tabsInitialized = true;
  
  // Analyze button
  if (UI.analyzeButton) {
    UI.analyzeButton.addEventListener('click', handleAnalyzeClick);
    
    // Also update button state based on input
    if (UI.profileInput) {
      UI.profileInput.addEventListener('input', updateAnalyzeButtonState);
      
      // Handle enter key
      UI.profileInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !UI.analyzeButton.disabled) {
          e.preventDefault();
          UI.analyzeButton.click();
        }
      });
      
      // Initial button state
      updateAnalyzeButtonState();
    }
  } else {
    console.error('Analyze button not found!');
  }
  
  // Test API button
  if (UI.testApiButton) {
    UI.testApiButton.addEventListener('click', handleTestApiClick);
  }
  
  // Cancel button
  if (UI.cancelButton) {
    UI.cancelButton.addEventListener('click', cancelAnalysis);
  }
  
  // Set up tab navigation 
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      handleTabClick(this);
    });
  });
}

// Handle tab navigation
function handleTabClick(tabButton) {
  // First, get all tab buttons and content divs
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Remove active class from all buttons and contents
  tabButtons.forEach(btn => btn.classList.remove('active'));
  tabContents.forEach(content => {
    content.classList.remove('active');
    // Instead of hiding, we'll just make it inactive
    // This preserves content without removing from DOM
    // content.style.display = 'none';
  });
  
  // Add active class to clicked button
  tabButton.classList.add('active');
  
  // Get tab id
  const tabId = tabButton.id;
  
  // Find matching content and make it active
  const contentId = tabId.split('-')[0] + '-tab';
  const tabContent = document.getElementById(contentId);
  
  if (tabContent) {
    tabContent.classList.add('active');
    tabContent.style.display = 'block';
    
    // Load content based on tab, but only if needed
    if (tabId === 'history-tab' && !tabContent.getAttribute('data-loaded')) {
      loadHistoryContent();
      tabContent.setAttribute('data-loaded', 'true');
    } else if (tabId === 'compose-tab' && !tabContent.getAttribute('data-loaded')) {
      initializeComposeTab();
      tabContent.setAttribute('data-loaded', 'true');
    }
  }
}

// Update analyze button state based on input
function updateAnalyzeButtonState() {
  if (!UI.profileInput || !UI.analyzeButton) return;
  
  const hasInput = UI.profileInput.value.trim().length > 0;
  
  // Update button state
  UI.analyzeButton.disabled = !hasInput;
  
  if (hasInput) {
    UI.analyzeButton.classList.add('active');
  } else {
    UI.analyzeButton.classList.remove('active');
  }
}

// Handle analyze button click
let isAnalyzing = false;
let indexProgressInterval = null;
let apiTimeout = null;

function handleAnalyzeClick() {
  if (isAnalyzing) {
    window.showToast('Analysis already in progress', 'info');
    return;
  }
  
  if (!UI.profileInput || !UI.profileInput.value.trim()) {
    window.showToast('Please enter a profile handle or URL', 'error');
    return;
  }
  
  // Extract username from input
  const inputValue = UI.profileInput.value.trim();
  let username = extractUsername(inputValue);
  
  if (!username) {
    window.showToast('Invalid username format. Please use @handle or a valid profile URL', 'error');
    return;
  }
  
  // Set analyzing state
  isAnalyzing = true;
  
  // Update UI
  if (UI.analyzeButton) {
    UI.analyzeButton.disabled = true;
    UI.analyzeButton.innerHTML = '<span class="loading-spinner"></span><span>Analyzing...</span>';
  }
  
  // Show loading
  window.showLoading('Analyzing profile...');
  
  // Start progress animation
  let progress = 0;
  indexProgressInterval = setInterval(() => {
    progress += 1;
    if (progress > 90) {
      clearInterval(indexProgressInterval);
    }
    
    window.updateProgress('.progress-fill', progress);
    
    // Update loading text at different stages
    if (progress === 20) {
      window.showLoading('Fetching profile data...');
    } else if (progress === 40) {
      window.showLoading('Analyzing recent posts...');
    } else if (progress === 60) {
      window.showLoading('Calculating engagement metrics...');
    } else if (progress === 80) {
      window.showLoading('Generating insights...');
    }
  }, 100);
  
  // Set a timeout for the API call (20 seconds)
  apiTimeout = setTimeout(() => {
    if (isAnalyzing) {
      clearInterval(indexProgressInterval);
      window.showLoading('API request timed out, showing fallback data...');
      window.updateProgress('.progress-fill', 95);
      
      // Use fallback data
      setTimeout(() => {
        resetLoadingState();
        window.showToast('Analysis timed out. Showing estimated data.', 'warning');
        showFallbackResults(username);
      }, 1000);
    }
  }, 20000);
  
  // Make the API request
  analyzeProfile(username);
}

// Extract username from input
function extractUsername(input) {
  if (!input) return null;
  
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

// Analyze profile using the API
function analyzeProfile(username) {
  chrome.runtime.sendMessage({
    action: 'analyzeProfile',
    username: username
  }, function(response) {
    // Clear intervals
    resetLoadingState();
    
    // Error handling
    if (chrome.runtime.lastError) {
      window.showToast(`Error: ${chrome.runtime.lastError.message}`, 'error');
      showFallbackResults(username);
      return;
    }
    
    if (!response) {
      window.showToast('No response from API', 'error');
      showFallbackResults(username);
      return;
    }
    
    // Complete progress
    window.updateProgress('.progress-fill', 100);
    
    // Handle response
    if (response.success) {
      // Show results
      showResults(username, response.data);
      window.showToast(`Analysis for @${username} complete!`, 'success');
    } else {
      // Show error and fallback
      const errorMsg = response.error || 'Unknown error';
      window.showToast(`Analysis error: ${errorMsg}`, 'warning');
      showFallbackResults(username, response.data);
    }
  });
}

// Reset the loading state
function resetLoadingState() {
  clearInterval(indexProgressInterval);
  clearTimeout(apiTimeout);
  isAnalyzing = false;
  
  hideLoading();
  
  if (UI.analyzeButton) {
    UI.analyzeButton.disabled = false;
    UI.analyzeButton.innerHTML = 'Analyze';
  }
}

// Cancel analysis
function cancelAnalysis() {
  // Clear intervals
  clearInterval(indexProgressInterval);
  clearTimeout(apiTimeout);
  isAnalyzing = false;
  
  // Hide loading
  hideLoading();
  
  // Reset button
  if (UI.analyzeButton) {
    UI.analyzeButton.disabled = false;
    UI.analyzeButton.innerHTML = 'Analyze';
  }
  
  window.showToast('Analysis cancelled', 'info');
}

// Show results
function showResults(username, data) {
  if (!UI.resultsContainer) return;
  
  // Determine if using estimated data
  const isEstimated = data.fromFallback || data.isEstimated;
  
  // Get user data
  const user = data.user || {};
  const metrics = user.public_metrics || {};
  
  // Get strategy and analytics data
  const strategy = data.strategy || {};
  const analytics = data.analytics || {};
  
  // Create HTML for results
  UI.resultsContainer.style.display = 'block';
  UI.resultsContainer.innerHTML = `
    <div class="results-card">
      ${isEstimated ? '<div class="api-warning-banner">API unavailable - showing estimated data</div>' : ''}
      
      <h3>Analysis for @${username}</h3>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${formatNumber(metrics.followers_count || 0)}</div>
          <div class="metric-label">Followers</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatNumber(metrics.following_count || 0)}</div>
          <div class="metric-label">Following</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatNumber(metrics.tweet_count || 0)}</div>
          <div class="metric-label">Tweets</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${analytics.engagement_rate || '0%'}</div>
          <div class="metric-label">Engagement</div>
        </div>
      </div>
      
      <div class="strategy-section">
        <h4>Recommended Strategies</h4>
        <ul class="strategy-recommendations">
          ${(strategy.recommendations || []).map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
      
      ${isEstimated ? 
        '<p class="fallback-notice">Note: This is estimated data based on typical profiles. For accurate analysis, please ensure the API is correctly configured.</p>' : 
        ''}
    </div>
  `;
  
  // Add to history
  addToHistory(username, {
    followers: metrics.followers_count,
    engagement: analytics.engagement_rate
  });
}

// Show fallback results
function showFallbackResults(username, data = null) {
  if (!UI.resultsContainer) return;
  
  // Prepare the fallback HTML
  UI.resultsContainer.style.display = 'block';
  
  // If we have some data, try to show it
  if (data && data.user) {
    showResults(username, {
      ...data,
      fromFallback: true,
      isEstimated: true
    });
  } else {
    // Show pure placeholder
    UI.resultsContainer.innerHTML = `
      <div class="results-card">
        <div class="api-warning-banner">API unavailable - showing estimated data</div>
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

// Format number for display
function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  
  return num.toString();
}

// Add to history for quick access
function addToHistory(username, metrics = {}) {
  try {
    chrome.storage.local.get(['analysisHistory'], function(result) {
      let history = result.analysisHistory || [];
      
      // Add new entry
      history.unshift({
        username,
        timestamp: Date.now(),
        metrics
      });
      
      // Limit size
      if (history.length > 20) {
        history = history.slice(0, 20);
      }
      
      // Save back
      chrome.storage.local.set({ analysisHistory: history });
    });
  } catch (error) {
    console.error('Error saving to history:', error);
  }
}

// Load history content
function loadHistoryContent() {
  const historyContainer = document.getElementById('historyItemsContainer');
  if (!historyContainer) return;
  
  chrome.storage.local.get(['analysisHistory'], function(result) {
    const history = result.analysisHistory || [];
    
    if (history.length === 0) {
      historyContainer.innerHTML = '<div class="empty-state">No analysis history found</div>';
      return;
    }
    
    historyContainer.innerHTML = '';
    
    history.forEach(item => {
      const date = new Date(item.timestamp);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div class="history-item-header">
          <div class="username">@${item.username}</div>
          <div class="timestamp">${formattedDate}</div>
        </div>
        <div class="history-item-metrics">
          <div class="metric">
            <span class="label">Followers:</span>
            <span class="value">${formatNumber(item.metrics?.followers || 0)}</span>
          </div>
          <div class="metric">
            <span class="label">Engagement:</span>
            <span class="value">${item.metrics?.engagement || '0%'}</span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="history-action-btn analyze-again" data-username="${item.username}">
            Analyze Again
          </button>
        </div>
      `;
      
      historyContainer.appendChild(historyItem);
      
      // Add click handler
      const analyzeAgainBtn = historyItem.querySelector('.analyze-again');
      if (analyzeAgainBtn) {
        analyzeAgainBtn.addEventListener('click', function() {
          const username = this.getAttribute('data-username');
          
          // Switch to analyze tab
          const analyzeTab = document.getElementById('analyze-tab');
          if (analyzeTab) {
            handleTabClick(analyzeTab);
          }
          
          // Fill input and trigger analysis
          if (UI.profileInput) {
            UI.profileInput.value = username;
            updateAnalyzeButtonState();
            
            // Trigger analysis after a short delay
            setTimeout(() => {
              if (UI.analyzeButton) {
                UI.analyzeButton.click();
              }
            }, 100);
          }
        });
      }
    });
  });
}

// Initialize compose tab
function initializeComposeTab() {
  // Set up character counter for compose textarea
  const postTextarea = document.querySelector('.post-input');
  const charCounter = document.querySelector('.character-counter');
  
  if (postTextarea && charCounter) {
    // Set up input handler
    postTextarea.addEventListener('input', function() {
      const currentLength = this.value.length;
      const maxLength = this.getAttribute('maxlength') || 280;
      
      // Update counter
      charCounter.textContent = `${currentLength}/${maxLength}`;
      
      // Add warning class if approaching limit
      if (currentLength > maxLength * 0.9) {
        charCounter.classList.add('warning');
      } else {
        charCounter.classList.remove('warning');
      }
    });
  }
  
  // Set up post type buttons
  const typeButtons = document.querySelectorAll('.type-btn');
  typeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      typeButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
  
  // Set up tone buttons
  const toneButtons = document.querySelectorAll('.tone-btn');
  toneButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      toneButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });
  
  // Set up generate button
  const generateButton = document.getElementById('generate-button');
  if (generateButton) {
    generateButton.addEventListener('click', function() {
      const topicInput = document.getElementById('post-topic');
      if (!topicInput || !topicInput.value.trim()) {
        window.showToast('Please enter a topic for your post', 'error');
        return;
      }
      
      // Show message since generation not implemented
      window.showToast('Post generation is not available in this version', 'info');
    });
  }
}

// Load cached data
function loadCachedData() {
  // Check if we have a previously analyzed profile
  chrome.storage.local.get(['lastAnalyzedProfile'], function(result) {
    if (result.lastAnalyzedProfile) {
      const { username, data, timestamp } = result.lastAnalyzedProfile;
      
      // Check if the data is still fresh (within 24 hours)
      const now = Date.now();
      const age = now - timestamp;
      const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
      
      if (age < MAX_AGE) {
        // Show the cached results
        showResults(username, data);
      }
    }
  });
}

// Check API connection status
function checkAPIStatus() {
  // Send request to test API
  chrome.runtime.sendMessage({
    action: 'testApiConnection'
  }, function(response) {
    // Update status indicator
    if (UI.statusIcon) {
      if (response && response.success) {
        UI.statusIcon.classList.remove('error');
        UI.statusIcon.classList.add('active');
      } else {
        UI.statusIcon.classList.remove('active');
        UI.statusIcon.classList.add('error');
      }
    }
  });
}

// Handle Test API button click
function handleTestApiClick() {
  if (!UI.testApiButton) return;
  
  // Show loading state on button
  const originalText = UI.testApiButton.textContent;
  UI.testApiButton.disabled = true;
  UI.testApiButton.textContent = 'Testing...';
  
  // Send test API request
  chrome.runtime.sendMessage({
    action: 'testApiConnection',
    forceCheck: true
  }, function(response) {
    // Reset button state
    UI.testApiButton.disabled = false;
    UI.testApiButton.textContent = originalText;
    
    // Error handling
    if (chrome.runtime.lastError) {
      window.showToast(`API test error: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }
    
    if (!response) {
      window.showToast('No response from API test', 'error');
      return;
    }
    
    // Handle response
    if (response.success) {
      window.showToast('API connection successful!', 'success');
      
      // Update status indicator
      if (UI.statusIcon) {
        UI.statusIcon.classList.remove('error');
        UI.statusIcon.classList.add('active');
      }
    } else {
      const errorMsg = response.error || 'Unknown error';
      window.showToast(`API test failed: ${errorMsg}`, 'error');
      
      // Update status indicator
      if (UI.statusIcon) {
        UI.statusIcon.classList.remove('active');
        UI.statusIcon.classList.add('error');
      }
    }
  });
} 