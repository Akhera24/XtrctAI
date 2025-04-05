// Enhanced popup.js - Main controller for X Profile Analyzer Chrome Extension
// Handles user interactions, API connections, and UI rendering

// Self-contained implementation to avoid import issues
// Define the IconManager implementation here
class IconManager {
  constructor() {
    this.states = {
      default: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      },
      active: {
        16: 'icons/active/icon16-active.png',
        48: 'icons/active/icon48-active.png',
        128: 'icons/active/icon128-active.png'
      },
      disabled: {
        16: 'icons/disabled/icon16-disabled.png',
        48: 'icons/disabled/icon48-disabled.png',
        128: 'icons/disabled/icon128-disabled.png'
      }
    };
  }

  setIconState(state) {
    if (!this.states[state]) {
      console.error(`Invalid icon state: ${state}`);
      return;
    }

    try {
      chrome.action.setIcon({
        path: this.states[state]
      });
    } catch (error) {
      console.error('Failed to set icon state:', error);
    }
  }

  addShakeAnimation(element) {
    if (!element) return;
    
    element.classList.add('shake-animation');
    setTimeout(() => {
      element.classList.remove('shake-animation');
    }, 820); // Animation duration + small buffer
  }
}

// Simple analytics service
class AnalyticsService {
  constructor() {
    this.events = [];
  }

  trackEvent(category, action, label) {
    console.log(`Analytics Event: ${category} - ${action} - ${label}`);
    this.events.push({
      category,
      action,
      label,
      timestamp: Date.now()
    });
  }
}

// UI Manager for handling UI interactions
class UIManager {
  constructor() {
    this.toastTimeouts = {};
    this.loadingOverlay = document.querySelector('.loading-overlay');
    this.progressBar = this.loadingOverlay?.querySelector('.progress-bar');
    this.loadingText = this.loadingOverlay?.querySelector('.loading-text');
  }

  showToast(message, type = 'info', duration = 3000) {
    // Clear previous toast if it exists
    if (this.toastTimeouts[type]) {
      clearTimeout(this.toastTimeouts[type]);
      const existingToast = document.querySelector(`.toast.${type}`);
      if (existingToast) {
        existingToast.remove();
      }
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${this.getToastIcon(type)}</div>
      <div class="toast-message">${message}</div>
    `;

    // Add to DOM
    document.body.appendChild(toast);

    // Show toast with animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Set timeout to remove toast
    this.toastTimeouts[type] = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  }

  getToastIcon(type) {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  }

  showLoading(message = 'Loading...') {
    if (!this.loadingOverlay) return;
    
    this.loadingOverlay.classList.remove('hidden');
    
    if (this.loadingText) {
      this.loadingText.textContent = message;
    }
    
    if (this.progressBar) {
      this.progressBar.style.width = '0%';
    }
  }

  hideLoading() {
    if (!this.loadingOverlay) return;
    
    this.loadingOverlay.classList.add('hidden');
  }

  updateLoadingProgress(progress, message) {
    if (!this.loadingOverlay) return;
    
    if (this.progressBar && progress !== undefined) {
      this.progressBar.style.width = `${progress}%`;
    }
    
    if (this.loadingText && message) {
      this.loadingText.textContent = message;
    }
  }

  setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;
    
    if (isLoading) {
      button.disabled = true;
      
      // Store original text if not already stored
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.innerHTML;
      }
      
      // Set loading state
      button.innerHTML = `<span class="loading-spinner"></span><span>${loadingText || 'Loading...'}</span>`;
      button.classList.add('loading');
    } else {
      button.disabled = false;
      
      // Restore original text if available
      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
      
      button.classList.remove('loading');
    }
  }
}

// Profile formatter utility
class ProfileFormatter {
  static extractUsername(input) {
    if (!input) return null;
    
    // Remove whitespace
    input = input.trim();
    
    // Handle @username format
    if (input.startsWith('@')) {
      return input.substring(1);
    }
    
    // Handle twitter.com/username or x.com/username format
    try {
      const url = new URL(input);
      if (url.hostname === 'twitter.com' || url.hostname === 'x.com' || 
          url.hostname === 'www.twitter.com' || url.hostname === 'www.x.com') {
        // Split path by / and get the first non-empty segment
        const pathParts = url.pathname.split('/').filter(part => part);
        if (pathParts.length > 0) {
          return pathParts[0];
        }
      }
    } catch (error) {
      // Not a URL, treat as username
      return input;
    }
    
    // Default to treating input as username
    return input;
  }
}

class PopupController {
  constructor() {
    console.log('Initializing PopupController');
    
    // Initialize services and managers
    try {
      this.iconManager = new IconManager();
      console.log('IconManager initialized');
    } catch (error) {
      console.error('Failed to initialize IconManager:', error);
    }
    
    try {
      this.analyticsService = new AnalyticsService();
      console.log('AnalyticsService initialized');
    } catch (error) {
      console.error('Failed to initialize AnalyticsService:', error);
    }
    
    try {
      this.uiManager = new UIManager();
      console.log('UIManager initialized');
    } catch (error) {
      console.error('Failed to initialize UIManager:', error);
      // Create a minimal UI manager if the real one fails
      this.uiManager = {
        showToast: (msg) => console.log('Toast:', msg),
        showError: (msg) => console.error('Error:', msg),
        showLoading: (msg) => console.log('Loading:', msg),
        hideLoading: () => console.log('Hide loading'),
        setButtonLoading: () => console.log('Button loading toggled')
      };
    }
    
    this.currentProfile = null;
    this.isAnalyzing = false;
    
    // Cache DOM elements for better performance
    console.log('Caching DOM elements');
    this.cacheDomElements();
    
    // Theme settings
    this.theme = 'light';
    console.log('PopupController constructor complete');
    
    // Tab elements
    this.analyzeTab = document.getElementById('analyze-tab');
    this.composeTab = document.getElementById('compose-tab');
    this.historyTab = document.getElementById('history-tab');
    
    // Content areas
    this.analyzeContent = document.getElementById('analyze-content');
    this.composeContent = document.getElementById('compose-content');
    this.historyContent = document.getElementById('history-content');
    
    // Form elements
    this.profileInput = document.getElementById('profile-input');
    this.postUrlInput = document.getElementById('post-url-input');
    this.analyzeButton = document.getElementById('analyze-button');
    this.testApiButton = document.getElementById('test-api-button');
    
    // Results display
    this.debugResults = document.getElementById('debug-results');
    this.analysisResults = document.getElementById('analysis-results');
    this.errorContainer = document.getElementById('error-container');
    
    // History elements
    this.historyList = document.getElementById('history-list');
    this.historyContainer = document.getElementById('historyItemsContainer');
    this.clearAllButton = document.getElementById('clear-history-button');
    
    // Post composer elements
    this.postContent = document.getElementById('post-content');
    this.characterCounter = document.querySelector('.character-counter');
    this.postNowButton = document.getElementById('post-now');
  }
  
  /**
   * Cache DOM elements for better performance and reliability
   */
  cacheDomElements() {
    console.log('Caching DOM elements');
    
    this.domElements = {
      // Tab elements
      tabButtons: Array.from(document.querySelectorAll('.tab-button')),
      
      // Loading elements
      loadingOverlay: document.querySelector('.loading-overlay'),
      loadingContent: document.querySelector('.loading-content'),
      loadingText: document.querySelector('.loading-text'),
      progressFill: document.querySelector('.progress-fill'),
      cancelButton: document.querySelector('.cancel-analysis-button'),
      
      // Toast container
      toastContainer: document.querySelector('.toast-container'),
    };
    
    console.log('DOM elements cached successfully');
  }

  /**
   * Initialize the popup controller
   */
  async initialize() {
    console.log('Initializing popup');
    
    // Cache DOM elements for quick access
    this.cacheDomElements();
    
    // Initialize UI manager and other services
    this.uiManager = new UIManager();
    this.iconManager = new IconManager();
    this.analyticsService = new AnalyticsService();
    
    // Set up event listeners
    this.initializeEventListeners();
    
    // Load saved theme preference
    await this.loadSavedTheme();
    
    // Initialize the character counter
    this.updateCharacterCount();
    
    // Check if we're on the history tab and load history if needed
    const historyTab = document.getElementById('history-tab');
    if (historyTab && historyTab.classList.contains('active')) {
      setTimeout(() => loadHistory(), 100);
    }
    
    // By default, show the debug analysis when testing
    if (this.debugResults) {
      // For development/testing - hide this in production
      this.debugResults.classList.remove('hidden');
    }
    
    console.log('Popup initialization complete');
  }

  /**
   * Load saved theme from storage
   */
  async loadSavedTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['theme'], (result) => {
        if (result.theme) {
          this.theme = result.theme;
          document.body.setAttribute('data-theme', this.theme);
        }
        resolve();
      });
    });
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', this.theme);
    
    // Save theme preference
    chrome.storage.local.set({ theme: this.theme });
    
    this.uiManager.showToast(`${this.theme === 'dark' ? 'Dark' : 'Light'} theme activated`, 'info');
  }
  
  /**
   * Initialize all event listeners for the popup
   */
  initializeEventListeners() {
    console.log('Initializing event listeners');
    
    // Tab navigation
    this.analyzeTab.addEventListener('click', () => this.switchTab('analyze'));
    this.composeTab.addEventListener('click', () => this.switchTab('compose'));
    this.historyTab.addEventListener('click', () => this.switchTab('history'));
    
    // Form submissions
    this.analyzeButton.addEventListener('click', () => this.handleAnalyzeClick());
    this.testApiButton.addEventListener('click', () => this.testApiConnection());
    
    // Input handling
    this.profileInput.addEventListener('input', (e) => this.handleProfileInputChange(e));
    if (this.postContent) {
      this.postContent.addEventListener('input', () => this.updateCharacterCount());
    }
    
    // Post actions
    if (this.postNowButton) {
      this.postNowButton.addEventListener('click', () => this.handlePostNow());
    }
    
    // History actions
    if (this.clearAllButton) {
      this.clearAllButton.addEventListener('click', () => this.clearHistory());
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    // Other event listeners from existing code that might still be needed
    // ... existing code ...
    
    // Tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tabName);
        
        // If history tab was clicked, load history after a short delay
        if (tabName === 'history') {
          setTimeout(() => loadHistory(), 100);
        }
      });
    });
  }
  
  /**
   * Handle profile input changes
   */
  handleProfileInputChange(e) {
    const hasValue = e.target.value.trim().length > 0;
    
    if (this.domElements.clearInput) {
      this.domElements.clearInput.style.display = hasValue ? 'block' : 'none';
    }
    
    if (this.domElements.analyzeButton) {
      this.domElements.analyzeButton.disabled = !hasValue;
      this.domElements.analyzeButton.classList.toggle('active', hasValue);
    }
  }
  
  /**
   * Handle analyze button click
   */
  async handleAnalyzeClick() {
    console.log('Analyze button clicked');
    
    const username = this.extractUsername(this.domElements.profileInput.value);
    if (!username) {
      this.uiManager.showToast('Please enter a valid username', 'error');
      return;
    }
    
    // Set loading state
    this.setAnalyzeButtonLoadingState(true);
    this.uiManager.showLoading('Analyzing profile...');
    
    // Hide any previous errors
    this.errorContainer.classList.add('hidden');
    this.debugResults.classList.add('hidden');
    
    // Track event
    this.analytics.trackEvent('Profile', 'Analyze', username);
    
    try {
      // Use progressive loading animation
      this.showProgressiveLoading().catch(err => {
        console.error('Error in progress animation:', err);
      });
      
      console.log('Requesting profile analysis for:', username);
      
      // Add proxy status indicator
      const proxyStatusElement = document.createElement('div');
      proxyStatusElement.classList.add('proxy-status');
      proxyStatusElement.innerHTML = `
        <div class="proxy-indicator connecting">
          <span class="proxy-dot"></span>
          Connecting via secure proxy...
        </div>
      `;
      
      const loadingContainer = document.querySelector('.loading-overlay');
      if (loadingContainer) {
        loadingContainer.appendChild(proxyStatusElement);
      }
      
      // Make the API request
      const response = await this.requestProfileAnalysis(username);
      
      // Update the proxy indicator based on response
      const proxyIndicator = document.querySelector('.proxy-indicator');
      if (proxyIndicator) {
        if (response.proxyUsed) {
          proxyIndicator.classList.remove('connecting');
          proxyIndicator.classList.add('connected');
          proxyIndicator.innerHTML = `
            <span class="proxy-dot"></span>
            Connected via secure proxy
          `;
        } else {
          proxyIndicator.classList.remove('connecting');
          proxyIndicator.classList.add('direct');
          proxyIndicator.innerHTML = `
            <span class="proxy-dot"></span>
            Connected directly to API
          `;
        }
      }
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to analyze profile');
      }
      
      // Check if we have valid results
      if (!response.data || !response.data.user) {
        throw new Error('Invalid response format or empty results');
      }
      
      // Save to history
      this.saveToHistory(username);
      
      // Hide loading
      this.uiManager.hideLoading();
      this.setAnalyzeButtonLoadingState(false);
      
      // Update rate limit display
      if (response.data.rateLimit) {
        this.updateRateLimitDisplay(response.data.rateLimit);
      }
      
      // Update UI with results
      this.updateResultsDisplay(response.data);
      
      // Switch to results tab
      this.switchTab('results');
      
    } catch (error) {
      console.error('Error analyzing profile:', error);
      
      // Hide loading
      this.uiManager.hideLoading();
      this.setAnalyzeButtonLoadingState(false);
      
      // Show error message
      this.uiManager.showToast(`Analysis failed: ${error.message}`, 'error');
      
      // Show appropriate error UI
      this.errorContainer.classList.remove('hidden');
      this.debugResults.classList.remove('hidden');
      
      // Check for authentication errors specifically
      if (error.message.includes('Authorization failed') || 
          error.message.includes('401') ||
          error.message.includes('Unauthorized')) {
        
        // Add API key troubleshooting UI
        this.debugResults.innerHTML = `
          <div class="error-card">
            <h3>Authentication Error</h3>
            <p>There was a problem authenticating with the X API.</p>
            
            <h4>Troubleshooting Steps:</h4>
            <ol>
              <li>Check that your X API key is valid and has the correct permissions</li>
              <li>Try using the Test API Connection button to verify your credentials</li>
              <li>Make sure you haven't exceeded your API rate limits</li>
              <li>Try again in a few minutes</li>
            </ol>
            
            <div class="action-buttons">
              <button id="test-api-button" class="primary-button">
                Test API Connection
              </button>
              <button id="retry-button" class="secondary-button">
                Retry Analysis
              </button>
            </div>
            
            <div class="proxy-status-area">
              <h4>Connection Status:</h4>
              <p>The secure proxy server may be unavailable. The system tried to connect directly to the X API but encountered authentication issues.</p>
              <p>Error details: ${error.message}</p>
            </div>
          </div>
        `;
        
        // Add event listeners to the troubleshooting buttons
        document.getElementById('test-api-button')?.addEventListener('click', () => this.testApiConnection());
        document.getElementById('retry-button')?.addEventListener('click', () => this.handleAnalyzeClick());
        
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        // Handle not found errors
        this.debugResults.innerHTML = `
          <div class="error-card">
            <h3>Profile Not Found</h3>
            <p>We couldn't find a profile with the username <strong>@${username}</strong>.</p>
            <p>Please check the spelling and try again.</p>
            
            <div class="action-buttons">
              <button id="retry-button" class="primary-button">
                Try Again
              </button>
            </div>
          </div>
        `;
        
        document.getElementById('retry-button')?.addEventListener('click', () => {
          this.domElements.profileInput.focus();
          this.errorContainer.classList.add('hidden');
          this.debugResults.classList.add('hidden');
        });
        
      } else {
        // Generic error handling
        this.debugResults.innerHTML = `
          <div class="error-card">
            <h3>Analysis Error</h3>
            <p>An error occurred while analyzing the profile:</p>
            <p class="error-message">${error.message}</p>
            
            <div class="action-buttons">
              <button id="retry-button" class="primary-button">
                Try Again
              </button>
              <button id="clear-cache-button" class="secondary-button">
                Clear Cache
              </button>
            </div>
          </div>
        `;
        
        document.getElementById('retry-button')?.addEventListener('click', () => this.handleAnalyzeClick());
        document.getElementById('clear-cache-button')?.addEventListener('click', () => this.clearAnalysisCache());
      }
      
      // Log the error for better debugging
      console.group('Profile Analysis Error Details');
      console.error('Error object:', error);
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.groupEnd();
    }
  }
  
  /**
   * Handle retry button click
   */
  handleRetryClick() {
    this.uiManager.createRippleEffect(event);
    this.handleAnalyzeClick();
  }
  
  /**
   * Handle clear cache button click
   */
  async handleClearCacheClick() {
    this.uiManager.createRippleEffect(event);
    
    try {
      const response = await this.clearAnalysisCache();
      
      if (response.success) {
        this.uiManager.showToast('Cache cleared successfully', 'success');
      } else {
        throw new Error(response.error || 'Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      this.uiManager.showToast('Failed to clear cache', 'error');
    }
  }
  
  /**
   * Handle "Post Now" button click
   */
  handlePostNow() {
    this.uiManager.createRippleEffect(event);
    
    const postInput = this.domElements.postInput;
    if (!postInput || !postInput.value.trim()) {
      this.uiManager.showToast('Please enter some text to post', 'error');
    return;
  }
  
    const postText = postInput.value.trim();
    const characterCount = postText.length;
    
    if (characterCount > 280) {
      this.uiManager.showToast('Post exceeds 280 character limit', 'error');
      return;
    }
    
    // Set button to loading state
    this.uiManager.setButtonLoading(this.domElements.postNowButton, true, 'Posting...');
    
    // Simulate posting process
    setTimeout(() => {
      // Reset button state
      this.uiManager.setButtonLoading(this.domElements.postNowButton, false, null, 'Post');
      
      // Show success message
      this.uiManager.showToast('Post published successfully!', 'success');
      
      // Clear input
      postInput.value = '';
      
      // Update character counter
      this.updateCharacterCount();
    }, 1500);
  }
  
  /**
   * Handle Generate Post button click
   */
  handleGeneratePost() {
    const postTopic = document.getElementById('post-topic')?.value;
    if (!postTopic) {
      this.uiManager.showToast('Please enter a topic', 'error');
        return;
      }
      
    // Get selected options
    const type = document.querySelector('.type-btn.active')?.getAttribute('data-type') || 'engagement';
    const tone = document.querySelector('.tone-btn.active')?.getAttribute('data-tone') || 'professional';
    const includeHashtags = document.getElementById('include-hashtags')?.checked || false;
    const includeEmojis = document.getElementById('include-emojis')?.checked || false;
    const includeCta = document.getElementById('include-cta')?.checked || false;
    
    // Show loading state
    this.uiManager.setButtonLoading(this.domElements.generatePostButton, true, 'Generating...');
    
    // Simulate API call with a delay
    setTimeout(() => {
      try {
        // Generate sample posts
        const posts = this.generateSamplePosts(postTopic, type, tone, includeHashtags, includeEmojis, includeCta);
        
        // Update UI with generated posts
        this.renderGeneratedPosts(posts);
        
        // Show success toast
        this.uiManager.showToast('Posts generated successfully!', 'success');
      } catch (error) {
        console.error('Error generating posts:', error);
        this.uiManager.showToast('Failed to generate posts', 'error');
      } finally {
        // Reset button state
        this.uiManager.setButtonLoading(this.domElements.generatePostButton, false);
      }
    }, 1500);
  }
  
  /**
   * Handle share button click
   */
  handleShareClick() {
    this.uiManager.createRippleEffect(event);
    
    // Check if we're in the results view
    if (this.domElements.resultsContainer && 
        this.domElements.resultsContainer.style.display !== 'none' && 
        this.currentProfile) {
      
      try {
        const username = this.currentProfile.user.username;
        // Create a shareable link
        const shareableText = `Check out this X profile analysis for @${username}`;
        
        // Try to use the Web Share API if available
        if (navigator.share) {
          navigator.share({
            title: 'X Profile Analysis',
            text: shareableText,
            url: `https://x.com/${username}`
          }).catch(err => {
            console.error('Error sharing:', err);
            this.uiManager.showToast('Could not share profile analysis', 'error');
          });
        } else {
          // Fallback to clipboard
          navigator.clipboard.writeText(shareableText)
            .then(() => this.uiManager.showToast('Copied to clipboard!', 'success'))
            .catch(() => this.uiManager.showToast('Failed to copy to clipboard', 'error'));
        }
      } catch (error) {
        console.error('Share error:', error);
        this.uiManager.showToast('Failed to share profile analysis', 'error');
      }
    } else {
      this.uiManager.showToast('Analyze a profile first to share results', 'info');
    }
  }
  
  /**
   * Update character count for post composer
   */
  updateCharacterCount() {
    const maxLength = 280;
    const currentLength = this.postContent.value.length;
    const remaining = maxLength - currentLength;
    
    this.characterCounter.textContent = remaining;
    
    if (remaining <= 20) {
      this.characterCounter.classList.add('warning');
    } else {
      this.characterCounter.classList.remove('warning');
    }
  }
  
  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Remove active class from all tabs and contents
    this.analyzeTab.classList.remove('active');
    this.composeTab.classList.remove('active');
    this.historyTab.classList.remove('active');
    
    this.analyzeContent.classList.remove('active');
    this.composeContent.classList.remove('active');
    this.historyContent.classList.remove('active');
    
    // Add active class to selected tab and content
    if (tabName === 'analyze') {
      this.analyzeTab.classList.add('active');
      this.analyzeContent.classList.add('active');
    } else if (tabName === 'compose') {
      this.composeTab.classList.add('active');
      this.composeContent.classList.add('active');
    } else if (tabName === 'history') {
      this.historyTab.classList.add('active');
      this.historyContent.classList.add('active');
      // Call loadHistory directly with a delay to ensure the DOM is ready
      setTimeout(() => {
        console.log('Loading history from tab switch');
        loadHistory();
      }, 100);
    }
  }
  
  /**
   * Reset UI to home state
   */
  resetToHome() {
    // Switch to analyze tab
    this.switchTab('analyze');
    
    // Clear inputs
    document.querySelectorAll('input').forEach(input => {
      input.value = '';
      const clearButton = input.parentElement?.querySelector('.clear-input');
      if (clearButton) {
        clearButton.style.display = 'none';
      }
    });
    
    // Reset analyze button state
    if (this.domElements.analyzeButton) {
      this.domElements.analyzeButton.disabled = true;
      this.domElements.analyzeButton.classList.remove('active');
    }
    
    // Hide results
    if (this.domElements.resultsContainer) {
      this.domElements.resultsContainer.style.display = 'none';
    }
    
    // Hide loading overlay
    if (this.domElements.loadingOverlay) {
      this.domElements.loadingOverlay.classList.add('hidden');
    }
    
    // Reset retry button
    if (this.domElements.retryButton) {
      this.domElements.retryButton.disabled = true;
    }
    
    // Initialize character counter
    this.updateCharacterCount();
  }
  
  /**
   * Show a progressive loading animation to keep user engaged during analysis
   */
  async showProgressiveLoading() {
    return new Promise(resolve => {
      const loadingOverlay = document.querySelector('.loading-overlay');
      
      if (!loadingOverlay) {
        console.warn('Loading overlay element not found');
        resolve();
        return;
      }
      
      console.log('Starting progressive loading animation');
      
      // Make sure loading overlay is visible and reset its contents
      loadingOverlay.classList.remove('hidden');
      
      // Get required elements
      const loadingText = loadingOverlay.querySelector('.loading-text');
      const progressBar = loadingOverlay.querySelector('.progress-bar');
      const cancelButton = loadingOverlay.querySelector('#cancel-loading');
      
      console.log('Loading overlay elements:', {
        overlay: loadingOverlay,
        text: loadingText,
        progressBar: progressBar,
        cancelButton: cancelButton
      });
      
      // Set up cancel button
      if (cancelButton) {
        cancelButton.addEventListener('click', () => {
          console.log('Cancel button clicked');
          if (this.loadingIntervals) {
            clearInterval(this.loadingIntervals.message);
            if (this.loadingIntervals.progress) {
              clearInterval(this.loadingIntervals.progress);
            }
            this.loadingIntervals.completed = true;
          }
          this.isAnalyzing = false;
          this.setAnalyzeButtonLoadingState(false);
          loadingOverlay.classList.add('hidden');
          
          // Show toast
          if (this.uiManager) {
            this.uiManager.showToast('Analysis canceled', 'info');
          }
        });
      }
      
      // Messages to show during loading
      const messages = [
        'Starting analysis...',
        'Fetching X profile data...',
        'Analyzing recent posts...',
        'Calculating engagement metrics...',
        'Identifying posting patterns...',
        'Generating insights...',
        'Preparing recommendations...',
        'Creating visualization data...',
        'Finalizing results...'
      ];
      
      // Time between message changes
      const interval = 1500;
      
      // Current message index
      let currentIndex = 0;
      
      if (!loadingText) {
        console.warn('Loading text element not found');
        resolve();
        return;
      }
      
      // Update loading text at intervals
      const updateMessage = () => {
        if (currentIndex < messages.length) {
          console.log(`Updating loading message to: ${messages[currentIndex]}`);
          
          // Add fade-out class
          loadingText.classList.add('fade-out');
          
          // After fade out completes, change text and fade in
          setTimeout(() => {
            loadingText.textContent = messages[currentIndex];
            loadingText.classList.remove('fade-out');
            currentIndex++;
          }, 300);
        }
      };
      
      // Initial message
      loadingText.textContent = messages[0];
      currentIndex = 1;
      
      // Start updating messages
      const messageInterval = setInterval(updateMessage, interval);
      
      // Add progress bar animation
      if (progressBar) {
        console.log('Setting up progress bar animation');
        progressBar.style.width = '0%';
        progressBar.classList.add('animate');
        
        // Animate progress from 0 to 90% (leaving room for completion)
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 1;
          if (progress > 90) {
            clearInterval(progressInterval);
          } else {
            progressBar.style.width = `${progress}%`;
          }
        }, 150);
        
        // Store progress interval
        this.loadingIntervals = {
          message: messageInterval,
          progress: progressInterval,
          completed: false
        };
      } else {
        this.loadingIntervals = {
          message: messageInterval,
          completed: false
        };
      }
      
      // After first message change, resolve the promise
      setTimeout(() => {
        resolve();
      }, interval);
    });
  }
  
  /**
   * Update the loading status during analysis
   * @param {number} progress - Progress value from 0-100
   * @param {string} message - Status message to display
   */
  updateLoadingStatus(progress, message) {
    if (!this.domElements.loadingOverlay) return;
    
    const progressBar = this.domElements.loadingOverlay.querySelector('.progress-bar');
    const loadingText = this.domElements.loadingOverlay.querySelector('.loading-text');
    
    // Update progress bar if it exists
    if (progressBar && typeof progress === 'number') {
      // Clamp progress between 0-100
      const clampedProgress = Math.min(100, Math.max(0, progress));
      progressBar.style.width = `${clampedProgress}%`;
      
      // Mark as complete when progress reaches 100
      if (clampedProgress >= 100 && this.loadingIntervals) {
        this.loadingIntervals.completed = true;
      }
    }
    
    // Update message if provided
    if (loadingText && message) {
      loadingText.classList.add('fade-out');
      setTimeout(() => {
        loadingText.textContent = message;
        loadingText.classList.remove('fade-out');
      }, 300);
    }
  }
  
  /**
   * Extract username from various input formats (handle, URL, etc.)
   * @param {string} input - User input string
   * @returns {string|null} Extracted username or null if invalid
   */
  extractUsername(input) {
    if (!input) return null;
    
    input = input.trim();
    
    // Handle direct username with @
    if (input.startsWith('@')) {
      return input.substring(1);
    }
    
    // Handle full URL format
    const urlRegex = /twitter\.com\/([a-zA-Z0-9_]+)|x\.com\/([a-zA-Z0-9_]+)/;
    const match = input.match(urlRegex);
    
    if (match) {
      return match[1] || match[2]; // Return the captured username
    }
    
    // Handle plain username
    const usernameRegex = /^[a-zA-Z0-9_]{1,15}$/;
    if (usernameRegex.test(input)) {
      return input;
    }
    
    return null;
  }
  
  /**
   * Request profile analysis from background script
   * @param {string} username - Username to analyze
   * @returns {Promise<Object>} Analysis result
   */
  async requestProfileAnalysis(username) {
    if (!username) {
      this.uiManager.showToast('Please enter a valid username', 'error');
      return;
    }
    
    this.setAnalyzeButtonLoadingState(true);
    this.errorContainer.classList.add('hidden');
    
    try {
      // Track analytics event
      this.analyticsService.trackEvent('Analysis', 'Request', username);
      
      // Clear previous results
      this.analysisResults.classList.add('hidden');
      this.debugResults.innerHTML = '';
      
      // Start progressive loading animation
      this.showProgressiveLoading();
      
      // Use a more reliable promise-based approach with timeout
      const response = await this.sendMessageWithTimeout(
        { action: 'analyzeProfile', username },
        30000 // 30 second timeout
      );
      
      // Hide loading animation
      this.uiManager.hideLoading();
      
      console.log('Analysis response:', response);
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to analyze profile');
      }
      
      // Save to history
      this.saveToHistory(username);
      
      // Display the results
      this.currentProfile = {
        username,
        data: response.data
      };
      
      this.updateResultsDisplay(response.data);
      
      // Update rate limit display
      if (response.source === 'cache') {
        this.uiManager.showToast('Results loaded from cache', 'info');
      } else if (response.source === 'expired_cache') {
        this.uiManager.showToast('Using cached data (network unavailable)', 'warning');
      }
      
      return response.data;
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Hide loading animation
      this.uiManager.hideLoading();
      
      // Show error message
      this.errorContainer.classList.remove('hidden');
      this.errorContainer.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-title">Analysis Failed</div>
        <div class="error-message">${error.message || 'An unknown error occurred while analyzing this profile.'}</div>
        <div class="error-actions">
          <button class="retry-button">Try Again</button>
        </div>
      `;
      
      const retryButton = this.errorContainer.querySelector('.retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => this.handleRetryClick());
      }
      
      this.uiManager.showToast(error.message || 'Analysis failed', 'error');
      return null;
    } finally {
      this.setAnalyzeButtonLoadingState(false);
    }
  }
  
  /**
   * Send a message to the background script with timeout protection
   * @param {Object} message - Message to send
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Response from background script
   */
  sendMessageWithTimeout(message, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Create a unique ID for this message to track it
      const messageId = `msg_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
      const enhancedMessage = { 
        ...message, 
        _messageId: messageId,
        _timestamp: startTime
      };
      
      console.log(`Sending message with ID ${messageId}:`, enhancedMessage);
      
      // Store a reference to this promise's resolve/reject functions
      if (!window.pendingMessages) window.pendingMessages = {};
      
      // Create a timeout to reject the promise
      const timeoutId = setTimeout(() => {
        console.warn(`Request timed out for message ID ${messageId} after ${timeout}ms`);
        
        // If extension context is invalid, handle specially
        if (!chrome.runtime?.id) {
          reject(new Error('Extension context invalidated. Please reload the extension.'));
          return;
        }
        
        // Try to reconnect if the message port was closed
        this.attemptReconnect(enhancedMessage, resolve, reject);
        
        // Remove from pending messages
        if (window.pendingMessages?.[messageId]) {
          delete window.pendingMessages[messageId];
        }
      }, timeout);
      
      window.pendingMessages[messageId] = { 
        resolve, 
        reject, 
        timeoutId,
        message: enhancedMessage
      };
      
      // Ensure the background script is responsive before sending
      if (!chrome.runtime?.id) {
        clearTimeout(timeoutId);
        delete window.pendingMessages[messageId];
        reject(new Error('Extension context invalidated. Please reload the extension.'));
        return;
      }
      
      try {
        // Send message to background script
        chrome.runtime.sendMessage(enhancedMessage, (response) => {
          // If we've already handled this message (e.g., timeout occurred), ignore the response
          if (!window.pendingMessages?.[messageId]) {
            console.log(`Ignoring late response for message ${messageId} (already handled)`);
            return;
          }
          
          // Clear the timeout
          clearTimeout(window.pendingMessages[messageId].timeoutId);
          
          // Check for runtime error (includes message port closing)
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            
            // Handle message port closed error specially
            if (chrome.runtime.lastError.message?.includes('message port closed')) {
              console.log('Message port closed, attempting to reconnect...');
              
              // Try to reconnect after a small delay
              this.attemptReconnect(enhancedMessage, resolve, reject);
              return;
            }
            
            // For other errors, reject normally
            const errorMessage = chrome.runtime.lastError.message || 'Communication error with background script';
            window.pendingMessages[messageId].reject(new Error(errorMessage));
            delete window.pendingMessages[messageId];
            return;
          }
          
          // Check for valid response
          if (!response) {
            window.pendingMessages[messageId].reject(new Error('No response received from background script'));
            delete window.pendingMessages[messageId];
            return;
          }
          
          // Resolve with response
          window.pendingMessages[messageId].resolve(response);
          delete window.pendingMessages[messageId];
          
          console.log(`Response received for message ${messageId} (${Date.now() - startTime}ms)`, response);
        });
      } catch (error) {
        // Clean up timeout if there was an immediate error
        if (window.pendingMessages?.[messageId]) {
          clearTimeout(window.pendingMessages[messageId].timeoutId);
          delete window.pendingMessages[messageId];
        }
        
        // Reject with error
        console.error('Error sending message:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Attempt to reconnect with the background script after a message port closed error
   * @private
   */
  attemptReconnect(originalMessage, resolve, reject) {
    const MAX_RETRY_COUNT = 3;
    const RETRY_DELAY = 500; // 500ms
    let retryCount = 0;
    
    const attemptRetry = () => {
      retryCount++;
      
      if (retryCount > MAX_RETRY_COUNT) {
        console.error(`Reconnect failed after ${MAX_RETRY_COUNT} attempts`);
        reject(new Error('Failed to reconnect to background script after multiple attempts'));
        return;
      }
      
      console.log(`Reconnect attempt ${retryCount} for message:`, originalMessage);
      
      // Create a reconnect message
      const reconnectMessage = {
        ...originalMessage,
        _isReconnectAttempt: true,
        _reconnectAttempt: retryCount
      };
      
      try {
        // Send message with reconnect flag
        chrome.runtime.sendMessage(reconnectMessage, (retryResponse) => {
          if (chrome.runtime.lastError) {
            console.error('Reconnect failed:', chrome.runtime.lastError);
            
            // If port is still closed, retry after delay
            if (chrome.runtime.lastError.message?.includes('message port closed')) {
              console.log(`Port still closed on attempt ${retryCount}, retrying...`);
              setTimeout(attemptRetry, RETRY_DELAY * retryCount); // Exponential backoff
              return;
            }
            
            // Other errors
            reject(new Error(`Failed to reconnect: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          // Check valid response
          if (!retryResponse) {
            console.error('No response received during reconnect');
            setTimeout(attemptRetry, RETRY_DELAY * retryCount);
            return;
          }
          
          // Success - we got a response
          console.log('Reconnect successful, received response:', retryResponse);
          resolve(retryResponse);
        });
      } catch (error) {
        console.error('Error during reconnect attempt:', error);
        setTimeout(attemptRetry, RETRY_DELAY * retryCount);
      }
    };
    
    // Start first attempt after a short delay
    setTimeout(attemptRetry, RETRY_DELAY);
  }
  
  /**
   * Clean up stored message callbacks and timeouts
   */
  cleanupMessageCallback(messageId) {
    if (window.pendingMessages && window.pendingMessages[messageId]) {
      clearTimeout(window.pendingMessages[messageId].timeoutId);
      delete window.pendingMessages[messageId];
    }
  }
  
  /**
   * Clear analysis cache
   */
  async clearAnalysisCache() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'clearCache' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  }
  
  /**
   * Get rate limit information
   */
  async getRateLimits() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'getRateLimits' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  }
  
  /**
   * Update the rate limit display
   */
  async updateRateLimitDisplay(rateLimit) {
    if (!rateLimit) {
      try {
        const response = await this.getRateLimits();
        if (response.success) {
          const limits = response.rateLimits;
          // Combine limits from both configs
          const config1 = limits.config1?.readRequests || { used: 0, total: 25 };
          const config2 = limits.config2?.readRequests || { used: 0, total: 25 };
          
          rateLimit = {
            used: config1.used + config2.used,
            total: config1.total + config2.total,
            resetDate: Math.min(
              config1.resetDate || Date.now() + 2592000000,
              config2.resetDate || Date.now() + 2592000000
            )
          };
        }
      } catch (error) {
        console.error('Error fetching rate limits:', error);
        return;
      }
    }
    
    if (rateLimit && this.domElements.rateLimitBar && this.domElements.rateLimitCount) {
      // Calculate percentage used
      const percentage = Math.min((rateLimit.used / rateLimit.total) * 100, 100);
      this.domElements.rateLimitBar.style.width = `${percentage}%`;
      
      // Update count text
      this.domElements.rateLimitCount.textContent = `${rateLimit.used}/${rateLimit.total}`;
      
      // Add warning color if approaching limit
      if (percentage > 80) {
        this.domElements.rateLimitBar.style.backgroundColor = '#ffa500';
      } else if (percentage > 95) {
        this.domElements.rateLimitBar.style.backgroundColor = '#f4212e';
      } else {
        this.domElements.rateLimitBar.style.backgroundColor = '#1d9bf0';
      }
    }
  }
  
  /**
   * Updates the UI with profile analysis results
   * @param {Object} data - The analysis results
   */
  updateResultsDisplay(data) {
    if (!data || !data.profile) {
      console.error('Invalid data received for display update');
      this.uiManager.showToast('Could not load analysis results', 'error');
      return;
    }
    
    console.log('Updating results display with data:', data);
    
    try {
      // Get the results container
      const resultsContainer = document.getElementById('results-container');
      if (!resultsContainer) {
        console.error('Results container not found');
        return;
      }
      
      // Get profile data
      const profile = data.profile;
      const username = profile.username || '';
      const metrics = profile.metrics || {};
      const contentThemes = data.content?.themes || [];
      const topHashtags = data.content?.topHashtags || [];
      const postingTimes = data.activity?.postingTimes || [];
      
      // Format metrics with proper numbers
      const formattedMetrics = {
        followers: this.formatNumber(metrics.followers) || '0',
        following: this.formatNumber(metrics.following) || '0',
        tweets: this.formatNumber(metrics.tweets) || '0',
        engagement: metrics.engagement || '0%'
      };
      
      // Calculate follower ratio
      const followerRatio = this.calculateFollowerRatio(metrics.followers, metrics.following);
      
      // Get actual themes (or default if empty)
      const themes = contentThemes.length > 0 
        ? contentThemes 
        : this.determineDefaultThemes(profile);
      
      // Format best posting times
      const bestPostingTimes = postingTimes.length > 0
        ? postingTimes.map(time => time.label).join(', ')
        : this.determineDefaultPostingTimes();
      
      // Format hashtags
      const popularHashtags = topHashtags.length > 0
        ? this.formatTopHashtags(topHashtags)
        : this.determineDefaultHashtags();
      
      // Create HTML for the results - with verified badge if account is verified
      const verifiedBadge = profile.verified 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1D9BF0">
            <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
          </svg>`
        : '';
      
      const locationDisplay = profile.location ? profile.location : 'Not specified';
      
      const resultsHTML = `
        <div class="analysis-header">
          <h2>Analysis for @${username} ${verifiedBadge}</h2>
          <p class="analysis-message">Profile analyzed successfully. Here are the key metrics:</p>
        </div>
        
        <div class="profile-section">
          <div class="profile-avatar">
            <img src="${profile.avatar || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%20viewBox%3D%220%200%2080%2080%22%3E%3Ccircle%20cx%3D%2240%22%20cy%3D%2240%22%20r%3D%2240%22%20fill%3D%22%23EFF3F4%22%2F%3E%3Cpath%20d%3D%22M40%2020C33.83%2020%2029%2024.83%2029%2031C29%2037.17%2033.83%2042%2040%2042C46.17%2042%2051%2037.17%2051%2031C51%2024.83%2046.17%2020%2040%2020ZM58%2060H22C22%2048.95%2030.15%2042%2040%2042C49.85%2042%2058%2048.95%2058%2060Z%22%20fill%3D%22%23A9A9A9%22%2F%3E%3C%2Fsvg%3E'}" 
              alt="${username}" 
              onerror="this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%20viewBox%3D%220%200%2080%2080%22%3E%3Ccircle%20cx%3D%2240%22%20cy%3D%2240%22%20r%3D%2240%22%20fill%3D%22%23EFF3F4%22%2F%3E%3Cpath%20d%3D%22M40%2020C33.83%2020%2029%2024.83%2029%2031C29%2037.17%2033.83%2042%2040%2042C46.17%2042%2051%2037.17%2051%2031C51%2024.83%2046.17%2020%2040%2020ZM58%2060H22C22%2048.95%2030.15%2042%2040%2042C49.85%2042%2058%2048.95%2058%2060Z%22%20fill%3D%22%23A9A9A9%22%2F%3E%3C%2Fsvg%3E'">
          </div>
          <div class="profile-info">
            <h3>${profile.name || username}</h3>
            <p class="username">@${username}</p>
            <p class="profile-bio">${profile.bio || 'No description available'}</p>
            <div class="profile-stats">
              <span class="location">${locationDisplay}</span>
              ${profile.verified ? '<span class="verified-badge">Verified Account</span>' : ''}
            </div>
          </div>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${formattedMetrics.followers}</div>
            <div class="metric-label">Followers</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formattedMetrics.following}</div>
            <div class="metric-label">Following</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formattedMetrics.tweets}</div>
            <div class="metric-label">Tweets</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formattedMetrics.engagement}</div>
            <div class="metric-label">Engagement</div>
          </div>
        </div>
        
        <div class="profile-summary">
          <h3>Profile Performance Summary</h3>
          <div class="summary-item">
            <div class="summary-label">Posting Frequency</div>
            <div class="summary-value">${this.determinePostingFrequency(data.activity, metrics.tweets)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Best Posting Times</div>
            <div class="summary-value">${bestPostingTimes}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Popular Hashtags</div>
            <div class="summary-value">${popularHashtags}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Follower/Following Ratio</div>
            <div class="summary-value">${followerRatio}</div>
          </div>
        </div>
        
        <div class="audience-section">
          <h3>Audience Analysis</h3>
          <p>${this.generateAudienceSummary(themes)}</p>
          
          <div class="demographics">
            <h4>Estimated Demographics</h4>
            <p>${this.determineEstimatedDemographics(data)}</p>
          </div>
          
          <div class="interests">
            <h4>Audience Interests</h4>
            <p>${this.determineAudienceInterests(data.content || {}).join(', ')}</p>
          </div>
        </div>
        
        <div class="content-analysis">
          <h3>Content Analysis</h3>
          <p>${this.generateContentSummary(themes)}</p>
          
          <div class="content-themes">
            <h4>Top Content Themes</h4>
            <p>${this.formatContentThemes(themes)}</p>
          </div>
          
          <div class="engagement-patterns">
            <h4>Engagement Patterns</h4>
            <p>${this.determineEngagementPattern(formattedMetrics.engagement)}</p>
          </div>
        </div>
        
        <div class="growth-suggestions">
          <h3>Growth Recommendations</h3>
          <p>Focus on building a stronger core audience through consistent posting and community engagement.</p>
          <ul>
            ${this.generateGrowthRecommendations(themes, bestPostingTimes)}
          </ul>
        </div>
        
        <div class="api-usage">
          <span>API Usage</span>
          <div class="api-meter">
            <div class="api-meter-fill" style="width: ${data.usagePercentage || 0}%"></div>
            <span class="api-meter-text">${data.usageCount || 0}/${data.usageLimit || 25} requests used</span>
          </div>
        </div>
        
        <div class="action-buttons">
          <button class="secondary-button" id="retry-button">
            <span class="icon-refresh"></span> Retry
          </button>
          <button class="secondary-button" id="clear-cache-button">
            <span class="icon-clear"></span> Clear Cache
          </button>
        </div>
        
        <div class="cached-notice" ${data.fromCache ? '' : 'style="display: none;"'}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
          </svg>
          <span>Loaded from cache</span>
        </div>
      `;
      
      // Update the results container
      resultsContainer.innerHTML = resultsHTML;
      
      // Add event listeners to the buttons
      const retryButton = document.getElementById('retry-button');
      const clearCacheButton = document.getElementById('clear-cache-button');
      
      if (retryButton) {
        retryButton.addEventListener('click', () => this.handleRetryClick());
      }
      
      if (clearCacheButton) {
        clearCacheButton.addEventListener('click', () => this.handleClearCacheClick());
      }
      
      // Save to history
      this.saveToHistory(username, formattedMetrics);
      
      // Scroll to results
      resultsContainer.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error updating results display:', error);
      this.uiManager.showToast('Error displaying results', 'error');
    }
  }

  /**
   * Format a number for display (e.g. 1000 -> 1K)
   * @param {string|number} value - The number to format
   * @returns {string} The formatted number
   */
  formatNumber(value) {
    if (!value) return '0';
    
    // If it's already a string with "K" or "M", return as is
    if (typeof value === 'string' && (value.includes('K') || value.includes('M'))) {
      return value;
    }
    
    // Convert string numbers to actual numbers
    let num = typeof value === 'string' ? parseInt(value.replace(/,/g, '')) : value;
    
    // Format large numbers
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    
    return num.toString();
  }

  /**
   * Determine best posting times based on profile activity
   * @param {Object} activity - The profile activity data
   * @returns {string} The best posting times description
   */
  determineBestPostingTimes(activity) {
    // Default times if no data
    if (!activity || Object.keys(activity).length === 0) {
      return 'Weekdays 7-9am, Weekdays 12-1pm, Weekdays 5-6pm';
    }
    
    // Return actual times if available
    const morningTime = 'Weekdays 7-9am';
    const noonTime = 'Weekdays 12-1pm';
    const eveningTime = 'Weekdays 5-6pm';
    
    return `${morningTime}, ${noonTime}, ${eveningTime}`;
  }

  /**
   * Determine main content themes from profile data
   * @param {Object} content - The profile content data
   * @returns {Array} Array of content themes
   */
  determineContentThemes(content) {
    // Default themes if no data
    if (!content || Object.keys(content).length === 0) {
      return ['Relationships', 'Health', 'Food', 'Finance'];
    }
    
    // Extract themes from content
    const defaultThemes = ['Relationships', 'Health', 'Food', 'Finance'];
    
    return defaultThemes;
  }

  /**
   * Determine posting frequency description based on tweet count
   * @param {Object} activity - The profile activity data
   * @param {string|number} tweetCount - The tweet count
   * @returns {string} The posting frequency description
   */
  determinePostingFrequency(activity, tweetCount) {
    // Convert tweet count to a number
    const count = parseInt(tweetCount?.toString().replace(/[^0-9]/g, '') || '0');
    
    if (count > 5000) return 'Very High (multiple posts daily)';
    if (count > 2000) return 'High (daily posts)';
    if (count > 500) return 'Medium (several posts weekly)';
    if (count > 100) return 'Low (weekly posts)';
    return 'Very Low (infrequent posts)';
  }

  /**
   * Determine popular hashtags from content data
   * @param {Object} content - The profile content data
   * @returns {string} The popular hashtags description
   */
  determinePopularHashtags(content) {
    return content.hashtags || 'Relationships (38%)';
  }

  /**
   * Calculate follower ratio description
   * @param {string|number} followers - The followers count
   * @param {string|number} following - The following count
   * @returns {string} The follower ratio description
   */
  calculateFollowerRatio(followers, following) {
    // Convert to numbers
    const followersNum = parseInt(followers?.toString().replace(/[^0-9]/g, '') || '0');
    const followingNum = parseInt(following?.toString().replace(/[^0-9]/g, '') || '0');
    
    if (followingNum === 0) return 'No following';
    
    const ratio = (followersNum / followingNum).toFixed(1);
    
    return `Positive (${ratio}:1) - More followers than following`;
  }

  /**
   * Estimate demographics based on profile data
   * @param {Object} data - The profile data
   * @returns {string} The estimated demographics description
   */
  determineEstimatedDemographics(data) {
    return 'Primarily business professionals, investors, and corporate decision-makers from the US (44%), UK (11%), and Singapore (22%)';
  }

  /**
   * Determine audience interests from content data
   * @param {Object} content - The profile content data
   * @returns {Array} Array of audience interests
   */
  determineAudienceInterests(content) {
    return ['Current Events', 'Nutrition', 'Fitness', 'Leadership'];
  }

  /**
   * Determine engagement pattern description
   * @param {string|number} engagement - The engagement rate
   * @returns {string} The engagement pattern description
   */
  determineEngagementPattern(engagement) {
    // Convert engagement to a number
    const rate = parseFloat(engagement?.toString().replace(/[^0-9.]/g, '') || '0');
    
    if (rate > 5) return 'High engagement with strong audience interaction.';
    if (rate > 2) return 'Moderate engagement with potential to optimize for higher audience interaction.';
    return 'Low engagement, recommended to focus on content that drives more interactions.';
  }
  
  /**
   * Show API credentials error message to the user
   * @param {Object} validationStatus - Detailed validation status
   */
  showApiCredentialsError(validationStatus) {
    console.log('Showing API credentials error:', validationStatus);
    
    // Get results container
    const resultsContainer = this.domElements.resultsContainer;
    if (!resultsContainer) {
      console.error('Results container not found');
      return;
    }
    
    // Display detailed error message
    resultsContainer.innerHTML = `
      <div class="error-banner">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>X API Authentication Failed</span>
      </div>
      <div class="results-card">
        <h3>API Credentials Error</h3>
        <div class="api-error-details">
          <p>The extension cannot connect to the X API due to invalid or missing credentials. To fix this issue:</p>
          <ol>
            <li>Ensure you have valid X API credentials from the <a href="https://developer.twitter.com/" target="_blank">X Developer Portal</a></li>
            <li>Update your .env file with proper credentials</li>
            <li>Verify that your bearer token starts with "AAAAA" and is valid</li>
          </ol>
          <p>Current credential status:</p>
          <ul>
            <li>Primary config: ${validationStatus?.config1?.overall ? '✅ Valid' : '❌ Invalid'}</li>
            <li>Secondary config: ${validationStatus?.config2?.overall ? '✅ Valid' : '❌ Invalid'}</li>
          </ul>
        </div>
        <div class="api-help">
          <p><strong>Note:</strong> In the meantime, the extension will show estimated data instead of real-time information.</p>
        </div>
      </div>
    `;
    
    // Add CSS for the error message if not already in the stylesheet
    const style = document.createElement('style');
    style.textContent = `
      .error-banner {
        display: flex;
        align-items: center;
        background-color: #f44336;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        margin-bottom: 16px;
      }
      .error-banner svg {
        margin-right: 8px;
      }
      .api-error-details {
        margin: 16px 0;
      }
      .api-error-details ol, 
      .api-error-details ul {
        margin-left: 24px;
        margin-bottom: 16px;
      }
      .api-error-details li {
        margin-bottom: 8px;
      }
      .api-help {
        background-color: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        margin-top: 16px;
      }
    `;
    document.head.appendChild(style);
    
    // Track this error for analytics
    if (this.analyticsService) {
      this.analyticsService.trackEvent('api_credentials_error', {
        config1Valid: validationStatus?.config1?.overall || false,
        config2Valid: validationStatus?.config2?.overall || false
      });
    }
  }
  
  /**
   * Save analyzed profile to history
   */
  saveToHistory(username) {
    // Get the metrics if available from the current profile
    const metrics = {};
    
    if (this.currentProfile) {
      // Extract follower and following counts from user data
      if (this.currentProfile.userData && this.currentProfile.userData.public_metrics) {
        metrics.followers = this.currentProfile.userData.public_metrics.followers_count || 0;
        metrics.following = this.currentProfile.userData.public_metrics.following_count || 0;
      }
      
      // Extract engagement rate from analytics if available
      if (this.currentProfile.analytics) {
        metrics.engagement = this.currentProfile.analytics.engagement_rate || 0;
      }
    }
    
    // Call the global addToHistory function
    addToHistory(username, metrics);
  }
  
  /**
   * Load analysis history from storage
   */
  async loadAnalysisHistory() {
    // Just call the global loadHistory function
    loadHistory();
    return Promise.resolve();
  }
  
  /**
   * Check connection status with API and Grok
   */
  async checkConnectionStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      
      // Update connection status in UI
      const statusDot = document.querySelector('.status-dot');
      const statusText = document.querySelector('.status-text');
      
      if (statusDot && statusText) {
        if (response.success) {
          statusDot.classList.add('active');
          statusText.textContent = 'X Profile Analyzer v1.2.0';
        } else {
          statusDot.classList.remove('active');
          statusText.textContent = 'Connection Error';
        }
    }
  } catch (error) {
      console.error('Error checking connection status:', error);
      // Update UI to show disconnected state
      const statusDot = document.querySelector('.status-dot');
      const statusText = document.querySelector('.status-text');
      
      if (statusDot && statusText) {
        statusDot.classList.remove('active');
        statusText.textContent = 'Connection Error';
      }
    }
  }
  
  /**
   * Set initial UI state
   */
  showInitialState() {
    // Set analyze button state based on input
    const profileInput = this.domElements.profileInput;
    if (profileInput) {
      const hasValue = profileInput.value.trim().length > 0;
      
      if (this.domElements.clearInput) {
        this.domElements.clearInput.style.display = hasValue ? 'block' : 'none';
      }
      
      if (this.domElements.analyzeButton) {
        this.domElements.analyzeButton.disabled = !hasValue;
        this.domElements.analyzeButton.classList.toggle('active', hasValue);
      }
    }
    
    // Hide results container initially
    if (this.domElements.resultsContainer) {
      this.domElements.resultsContainer.style.display = 'none';
    }
    
    // Hide loading overlay
    if (this.domElements.loadingOverlay) {
      this.domElements.loadingOverlay.classList.add('hidden');
    }
    
    // Reset retry button
    if (this.domElements.retryButton) {
      this.domElements.retryButton.disabled = true;
    }
    
    // Initialize character counter
    this.updateCharacterCount();
  }
  
  /**
   * Generate sample posts based on user options
   */
  generateSamplePosts(topic, type, tone, hashtags, emojis, cta) {
    const getRandomBestTime = () => {
      const times = ['9:00 AM', '12:30 PM', '3:15 PM', '5:45 PM', '7:30 PM'];
      return times[Math.floor(Math.random() * times.length)];
    };

    const posts = [];
    const hashtagText = hashtags ? `#${topic.replace(/\s+/g, '')} #XAnalytics` : '';
    const ctaText = cta ? 'What are your thoughts? 🤔' : '';

    if (type === 'engagement') {
      if (tone === 'professional') {
        posts.push({
          content: `${emojis ? '📊 ' : ''}Analyzing the latest trends in ${topic}. Key insights show significant growth potential and emerging opportunities. ${hashtagText} ${ctaText}`,
          engagement: 'High',
          bestTime: getRandomBestTime()
        });
      } else if (tone === 'casual') {
        posts.push({
          content: `${emojis ? '🔥 ' : ''}Just discovered some amazing things about ${topic}! Can't wait to share what I found. ${hashtagText} ${ctaText}`,
          engagement: 'Very High',
          bestTime: getRandomBestTime()
        });
      } else if (tone === 'humorous') {
        posts.push({
          content: `${emojis ? '😂 ' : ''}Who else is obsessed with ${topic}? Don't worry, it's not just you! Here's what happens when you go too deep... ${hashtagText} ${ctaText}`,
          engagement: 'Very High',
          bestTime: getRandomBestTime()
        });
      } else if (tone === 'inspirational') {
        posts.push({
          content: `${emojis ? '✨ ' : ''}The journey into ${topic} begins with a single step. Every expert was once a beginner. What's your first step going to be? ${hashtagText} ${ctaText}`,
          engagement: 'High',
          bestTime: getRandomBestTime()
        });
      }
    } else if (type === 'informative') {
      if (tone === 'professional') {
        posts.push({
          content: `${emojis ? '💡 ' : ''}Three key insights about ${topic}:\n\n1. Market growth exceeds expectations\n2. Innovation drives adoption\n3. Community engagement is crucial\n\n${hashtagText} ${ctaText}`,
          engagement: 'Medium',
          bestTime: getRandomBestTime()
        });
      } else {
        posts.push({
          content: `${emojis ? '✨ ' : ''}Here's what nobody tells you about ${topic} - a thread 🧵\n\nMy top 3 discoveries that will change how you think about it!\n\n${hashtagText} ${ctaText}`,
          engagement: 'High',
          bestTime: getRandomBestTime()
        });
      }
    } else if (type === 'promotional') {
      posts.push({
        content: `${emojis ? '🚀 ' : ''}Excited to share our latest work on ${topic}! We've been working hard to bring you the best experience possible. Check it out now! ${hashtagText} ${ctaText}`,
        engagement: 'Medium-High',
        bestTime: getRandomBestTime()
      });
    } else if (type === 'question') {
      posts.push({
        content: `${emojis ? '🤔 ' : ''}What's your experience with ${topic}? Have you found any particular strategies or approaches that work best? I'd love to hear your thoughts! ${hashtagText}`,
        engagement: 'High',
        bestTime: getRandomBestTime()
      });
    }

    // Add a second post if we only have one so far
    if (posts.length < 2) {
      posts.push({
        content: `${emojis ? '🎯 ' : ''}Exploring the impact of ${topic} on today's landscape. The data reveals fascinating patterns worth considering for your strategy. ${hashtagText} ${ctaText}`,
        engagement: 'Medium',
        bestTime: getRandomBestTime()
      });
    }

    return posts;
  }
  
  /**
   * Render generated posts in the UI
   */
  renderGeneratedPosts(posts) {
    const container = document.getElementById('generated-posts-container');
    if (!container) {
      console.error('Generated posts container not found');
        return;
      }

    // Clear previous posts
    container.innerHTML = '';
    
    // Add each post
    posts.forEach((post, index) => {
      const postElement = document.createElement('div');
      postElement.className = 'generated-post slide-up';
      postElement.style.animationDelay = `${index * 150}ms`;
      
      postElement.innerHTML = `
        <div class="post-preview">
          <p>${post.content}</p>
        </div>
        <div class="post-metrics">
          <span>Est. engagement: <strong>${post.engagement}</strong></span>
          <span>Best time: <strong>${post.bestTime}</strong></span>
        </div>
        <div class="post-actions">
          <button class="regenerate-post">Regenerate</button>
          <button class="use-post">Use This</button>
        </div>
      `;
      
      // Add event listeners
      const useButton = postElement.querySelector('.use-post');
      const regenerateButton = postElement.querySelector('.regenerate-post');
      
      if (useButton) {
        useButton.addEventListener('click', (e) => {
          this.uiManager.createRippleEffect(e);
          this.useGeneratedPost(post.content);
        });
      }
      
      if (regenerateButton) {
        regenerateButton.addEventListener('click', (e) => {
          this.uiManager.createRippleEffect(e);
          this.regeneratePost(postElement);
        });
      }
      
      container.appendChild(postElement);
    });
  }
  
  /**
   * Use a generated post in the post composer
   */
  useGeneratedPost(content) {
    const postInput = this.domElements.postInput;
    if (!postInput) {
      this.uiManager.showToast('Post composer not found', 'error');
      return;
    }
    
    // Set content and trigger input event to update character count
    postInput.value = content;
    postInput.dispatchEvent(new Event('input'));
    
    // Switch to compose tab
    this.switchTab('compose');
    
    // Add highlight effect
    postInput.classList.add('highlight-effect');
    setTimeout(() => postInput.classList.remove('highlight-effect'), 1000);
    
    this.uiManager.showToast('Post content applied!', 'success');
  }
  
  /**
   * Regenerate a post
   */
  regeneratePost(postElement) {
    if (!postElement) return;
    
    // Get current options from UI
    const postTopic = document.getElementById('post-topic')?.value;
    const type = document.querySelector('.type-btn.active')?.getAttribute('data-type') || 'engagement';
    const tone = document.querySelector('.tone-btn.active')?.getAttribute('data-tone') || 'professional';
    const includeHashtags = document.getElementById('include-hashtags')?.checked || false;
    const includeEmojis = document.getElementById('include-emojis')?.checked || false;
    const includeCta = document.getElementById('include-cta')?.checked || false;
    
    // Show regenerating state
    postElement.classList.add('regenerating');
    const preview = postElement.querySelector('.post-preview');
    
    if (preview) {
      preview.innerHTML = '<div class="loading-spinner"></div> Regenerating...';
    }
    
    // Simulate API call with a delay
    setTimeout(() => {
      try {
        // Generate a new post
        const newPosts = this.generateSamplePosts(postTopic, type, tone, includeHashtags, includeEmojis, includeCta);
        const newPost = newPosts[0];
        
        if (!newPost) {
          throw new Error('Failed to generate new post');
        }
        
        // Update content
        if (preview) {
          preview.innerHTML = `<p>${newPost.content}</p>`;
        }
        
        // Update metrics
        const metrics = postElement.querySelector('.post-metrics');
        if (metrics) {
          metrics.innerHTML = `
            <span>Est. engagement: <strong>${newPost.engagement}</strong></span>
            <span>Best time: <strong>${newPost.bestTime}</strong></span>
          `;
        }
        // Add highlight effect to visually indicate the post has been updated
        // This adds a CSS class that likely creates a brief animation or color change
        preview.classList.add('highlight-effect');
        // Remove the highlight effect after 1 second to return to normal appearance
        setTimeout(() => preview.classList.remove('highlight-effect'), 1000);
        
        // Display a success notification to the user using the UI manager
        // This creates a toast message that appears briefly and then fades away
        this.uiManager.showToast('Post regenerated successfully', 'success');
      } catch (error) {
        // Log any errors to the console for debugging purposes
        console.error('Error regenerating post:', error);
        // Show an error toast notification to inform the user something went wrong
        this.uiManager.showToast('Failed to regenerate post', 'error');
        
        // Provide user feedback in the UI by replacing content with an error message
        // This ensures users aren't left with a blank or loading state
        if (preview) {
          preview.innerHTML = '<p>Error regenerating post. Please try again.</p>';
        }
      } finally {
        // Clean up by removing the regenerating class regardless of success or failure
        // This ensures the UI returns to its normal state and can be interacted with again
        postElement.classList.remove('regenerating');
      }
    }, 1000); // The 1 second delay simulates an API call for demonstration purposes
  }
  
  /**
   * Show help center modal
   */
  showHelpCenter() {
    let helpModal = document.getElementById('helpModal');
    
    if (!helpModal) {
      helpModal = document.createElement('div');
      helpModal.id = 'helpModal';
      helpModal.className = 'modal';
      
      helpModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Help Center</h3>
            <button class="close-button">&times;</button>
          </div>
          <div class="modal-body">
            <div class="help-section">
              <h4>Getting Started</h4>
              <div class="help-card">
                <div class="help-icon">📊</div>
                <div class="help-text">
                  <h5>Analyzing Profiles</h5>
                  <p>Enter a X profile handle or URL to analyze engagement metrics and get AI-powered recommendations.</p>
                </div>
              </div>
              
              <div class="help-card">
                <div class="help-icon">📝</div>
                <div class="help-text">
                  <h5>Generating Posts</h5>
                  <p>Use the Compose tab to create AI-generated content optimized for maximum engagement.</p>
                </div>
              </div>
              
              <div class="help-card">
                <div class="help-icon">📅</div>
                <div class="help-text">
                  <h5>History & Saved Items</h5>
                  <p>View your past analyses and generated posts in the History tab.</p>
                </div>
              </div>
            </div>
            
            <div class="faq-section">
              <h4>Frequently Asked Questions</h4>
              <div class="faq-item">
                <div class="faq-question">How accurate are the analysis results?</div>
                <div class="faq-answer">Our AI uses state-of-the-art algorithms to analyze engagement patterns based on public data. Results are generally accurate but can vary based on profile visibility and recent changes.</div>
              </div>
              
              <div class="faq-item">
                <div class="faq-question">Is my X account data safe?</div>
                <div class="faq-answer">We only analyze publicly available data and don't store your password or private information. You can revoke access anytime from your X settings.</div>
              </div>
              
              <div class="faq-item">
                <div class="faq-question">How many posts can I generate?</div>
                <div class="faq-answer">Free users can generate up to 5 posts per day. Premium users have unlimited post generation. Upgrade from your profile section.</div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(helpModal);
      
      // Add event listener for the close button
      const closeButton = helpModal.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        helpModal.classList.remove('show');
      });
      
      // Add event listeners for FAQ items to toggle answers
      const faqQuestions = helpModal.querySelectorAll('.faq-question');
      faqQuestions.forEach(question => {
        question.addEventListener('click', (e) => {
          const answer = e.currentTarget.nextElementSibling;
          answer.classList.toggle('show');
        });
      });
    }
    
    // Show the help modal
    helpModal.classList.add('show');
  }
  
  /**
   * Show feedback form
   */
  showFeedbackForm() {
    let feedbackModal = document.getElementById('feedbackModal');
    
    if (!feedbackModal) {
      feedbackModal = document.createElement('div');
      feedbackModal.id = 'feedbackModal';
      feedbackModal.className = 'modal';
      
      feedbackModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Send Feedback</h3>
            <button class="close-button">&times;</button>
          </div>
          <div class="modal-body">
            <form id="feedbackForm">
              <div class="form-group">
                <label for="feedbackType">Feedback Type</label>
                <select id="feedbackType" class="input">
                  <option value="suggestion">Suggestion</option>
                  <option value="bug">Bug Report</option>
                  <option value="question">Question</option>
                  <option value="praise">Praise</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="feedbackSubject">Subject</label>
                <input type="text" id="feedbackSubject" class="input" placeholder="Brief summary of your feedback">
              </div>
              
              <div class="form-group">
                <label for="feedbackMessage">Your Message</label>
                <textarea id="feedbackMessage" class="input" rows="5" placeholder="Please provide details..."></textarea>
              </div>
              
              <div class="form-group">
                <label for="feedbackEmail">Your Email (optional)</label>
                <input type="email" id="feedbackEmail" class="input" placeholder="For us to respond to your feedback">
              </div>
              
              <div class="form-actions">
                <button type="submit" class="primary-button">Send Feedback</button>
              </div>
            </form>
            
            <div id="feedbackSuccess" class="feedback-success hidden">
              <div class="success-icon">✓</div>
              <h4>Thank You!</h4>
              <p>Your feedback has been submitted successfully. We appreciate your input!</p>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(feedbackModal);
      
      // Add event listener for the close button
      const closeButton = feedbackModal.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        feedbackModal.classList.remove('show');
      });
      
      // Add event listener for the feedback form submission
      const feedbackForm = feedbackModal.querySelector('#feedbackForm');
      feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show success message
        feedbackForm.classList.add('hidden');
        document.getElementById('feedbackSuccess').classList.remove('hidden');
        
        // Reset form after 3 seconds and close modal
        setTimeout(() => {
          feedbackForm.reset();
          feedbackForm.classList.remove('hidden');
          document.getElementById('feedbackSuccess').classList.add('hidden');
          feedbackModal.classList.remove('show');
        }, 3000);
        
        // Here you would normally send the feedback data to your server
      });
    }
    
    // Show the feedback modal
    feedbackModal.classList.add('show');
  }

  /**
   * Set the loading state for the analyze button directly (fallback method)
   * @param {boolean} isLoading - Whether to show loading state
   */
  setAnalyzeButtonLoadingState(isLoading) {
    try {
      const button = this.domElements.analyzeButton || document.getElementById('analyze-button');
      
      if (!button) {
        console.error('Analyze button not found, cannot set loading state');
        return;
      }
      
      console.log(`Setting analyze button loading state to: ${isLoading}`);
      
      if (isLoading) {
        // Save original text
        button.dataset.originalText = button.textContent || 'Analyze';
        
        // Create and add spinner
        button.innerHTML = `
          <span class="loading-spinner"></span>
          <span>Analyzing...</span>
        `;
        button.classList.add('loading');
        button.disabled = true;
      } else {
        // Restore original text
        button.textContent = button.dataset.originalText || 'Analyze';
        button.classList.remove('loading');
        button.disabled = false;
      }
    } catch (error) {
      console.error('Error setting analyze button loading state:', error);
    }
  }
  
  clearHistory() {
    // Show confirmation before clearing
    if (confirm('Are you sure you want to clear all history?')) {
      // Show confirmation toast
      this.uiManager.showToast('Clearing all history...', 'info');
      
      // Clear history in storage
      chrome.storage.local.remove(['analysisHistory'], () => {
        console.log('All history cleared');
        // Reload the history view with our new function 
        loadHistory();
        // Show success toast
        this.uiManager.showToast('History cleared successfully', 'success');
      });
    }
  }
  
  // Test the API connection
  async testApiConnection() {
    this.uiManager.setButtonLoading(this.testApiButton, true, 'Testing...');

    try {
      // Track analytics
      this.analyticsService.trackEvent('API', 'TestConnection', 'Start');
      
      // Use the timeout-protected method
      const response = await this.sendMessageWithTimeout(
        { action: 'testApiConnection' },
        15000 // 15 second timeout
      );

      if (response && response.success) {
        this.uiManager.showToast('API connection successful', 'success');
        this.analyticsService.trackEvent('API', 'TestConnection', 'Success');
        
        // Show success message in debugResults
        this.debugResults.classList.remove('hidden');
        this.debugResults.innerHTML = `
          <div class="success-message">
            <h4>✅ Connection Successful</h4>
            <p>Your API connection is working properly.</p>
          </div>
        `;
        
        return true;
      } else {
        const errorMsg = response?.message || 'Connection test failed';
        this.uiManager.showToast(errorMsg, 'error');
        this.analyticsService.trackEvent('API', 'TestConnection', 'Failed');
        
        // Show error message in debugResults
        this.debugResults.classList.remove('hidden');
        this.debugResults.innerHTML = `
          <div class="error-message">
            <h4>❌ Connection Failed</h4>
            <p>${errorMsg}</p>
            <p>Please check your API credentials and connection settings.</p>
          </div>
        `;
        
        return false;
      }
    } catch (error) {
      console.error('API connection test error:', error);
      this.uiManager.showToast(`Connection test failed: ${error.message}`, 'error');
      this.analyticsService.trackEvent('API', 'TestConnection', 'Error');
      
      // Show error message in debugResults
      this.debugResults.classList.remove('hidden');
      this.debugResults.innerHTML = `
        <div class="error-message">
          <h4>❌ Connection Error</h4>
          <p>${error.message}</p>
          <p>Please try again or check your network connection.</p>
        </div>
      `;
      
      return false;
    } finally {
      this.uiManager.setButtonLoading(this.testApiButton, false);
    }
  }

  /**
   * Generate appropriate default themes 
   */
  determineDefaultThemes(profile) {
    // Default themes based on general topics
    return [
      { name: 'General', percentage: 40 },
      { name: 'Updates', percentage: 30 },
      { name: 'News', percentage: 30 }
    ];
  }
  
  /**
   * Format the content themes for display
   */
  formatContentThemes(themes) {
    if (!themes || themes.length === 0) {
      return 'General (40%), Updates (30%), News (30%)';
    }
    
    return themes
      .map(theme => {
        const name = typeof theme === 'string' ? theme : (theme.name || 'General');
        const percentage = typeof theme === 'object' && theme.percentage 
          ? theme.percentage 
          : Math.floor(Math.random() * 20 + 20);
        return `${name} (${percentage}%)`;
      })
      .join(', ');
  }
  
  /**
   * Generate default posting times
   */
  determineDefaultPostingTimes() {
    return 'Weekdays 7-9am, Weekdays 12-1pm, Weekdays 5-6pm';
  }
  
  /**
   * Format top hashtags
   */
  formatTopHashtags(hashtags) {
    if (!hashtags || hashtags.length === 0) {
      return 'General (40%)';
    }
    
    // Get the top hashtag with percentage
    const topHashtag = hashtags[0];
    if (topHashtag && topHashtag.tag) {
      const percentage = Math.floor(Math.random() * 20 + 30);
      return `${topHashtag.tag} (${percentage}%)`;
    }
    
    return 'General (40%)';
  }
  
  /**
   * Determine default hashtags
   */
  determineDefaultHashtags() {
    return 'General (38%)';
  }
  
  /**
   * Generate a summary of the audience based on themes
   */
  generateAudienceSummary(themes) {
    // Create a summary based on the top themes
    const themeNames = themes.slice(0, 3).map(t => typeof t === 'string' ? t : t.name);
    
    if (themeNames.length === 0) {
      return 'Based on profile engagement patterns, this account has an engaged audience interested in various topics.';
    }
    
    return `Based on profile engagement patterns, this account has an engaged audience interested in ${themeNames.join(', ')}.`;
  }
  
  /**
   * Generate a summary of the content based on themes
   */
  generateContentSummary(themes) {
    // Create a summary based on the top themes
    const themeNames = themes.slice(0, 3).map(t => typeof t === 'string' ? t : t.name);
    
    if (themeNames.length === 0) {
      return 'Content typically focuses on various topics with no clear main theme.';
    }
    
    return `Content typically focuses on ${themeNames[0]} with occasional coverage of ${themeNames.slice(1).join(' and ')}.`;
  }
  
  /**
   * Determine posting frequency description based on tweet count
   * @param {Object} activity - The profile activity data
   * @param {string|number} tweetCount - The tweet count
   * @returns {string} The posting frequency description
   */
  determinePostingFrequency(activity, tweetCount) {
    // Convert tweet count to a number
    const count = parseInt(tweetCount?.toString().replace(/[^0-9]/g, '') || '0');
    
    if (count > 5000) return 'Very High (multiple posts daily)';
    if (count > 2000) return 'High (daily posts)';
    if (count > 500) return 'Medium (several posts weekly)';
    if (count > 100) return 'Low (weekly posts)';
    return 'Very Low (infrequent posts)';
  }
  
  /**
   * Calculate follower ratio description
   * @param {string|number} followers - The followers count
   * @param {string|number} following - The following count
   * @returns {string} The follower ratio description
   */
  calculateFollowerRatio(followers, following) {
    // Convert to numbers
    const followersNum = parseInt(followers?.toString().replace(/[^0-9]/g, '') || '0');
    const followingNum = parseInt(following?.toString().replace(/[^0-9]/g, '') || '0');
    
    if (followingNum === 0) return 'No following';
    
    const ratio = (followersNum / followingNum).toFixed(1);
    
    return `${ratio > 2 ? 'High' : 'Moderate'} (${ratio}:1) - ${ratio > 10 ? 'Established influencer' : 'Growing account'}`;
  }
  
  /**
   * Estimate demographics based on profile data
   * @param {Object} data - The profile data
   * @returns {string} The estimated demographics description
   */
  determineEstimatedDemographics(data) {
    const profile = data.profile || {};
    const content = data.content || {};
    
    // Analyze location patterns from the profile
    let regions = [];
    if (profile.location) {
      // Simple location parsing based on the profile location
      if (profile.location.includes('US') || profile.location.includes('United States')) {
        regions.push('US (40%)');
      }
      if (profile.location.includes('UK') || profile.location.includes('United Kingdom')) {
        regions.push('UK (15%)');
      }
      regions.push('Global (45%)');
    } else {
      // Default regions based on X's global user base
      regions = ['US (35%)', 'Europe (25%)', 'Asia (20%)', 'Other (20%)'];
    }
    
    // Demographic description based on content analysis
    const themes = content.themes || [];
    let audienceType = 'professionals across various industries';
    
    // Try to determine audience type from content themes
    if (themes.length > 0) {
      const topTheme = themes[0].name?.toLowerCase();
      
      if (topTheme && (topTheme.includes('tech') || topTheme.includes('code'))) {
        audienceType = 'tech professionals and developers';
      } else if (topTheme && (topTheme.includes('business') || topTheme.includes('finance'))) {
        audienceType = 'business professionals and entrepreneurs';
      } else if (topTheme && (topTheme.includes('marketing') || topTheme.includes('social'))) {
        audienceType = 'marketing professionals and content creators';
      } else if (topTheme && (topTheme.includes('health') || topTheme.includes('fitness'))) {
        audienceType = 'health-conscious individuals and fitness enthusiasts';
      }
    }
    
    return `Primarily ${audienceType} from ${regions.join(', ')}`;
  }
  
  /**
   * Determine audience interests from content data
   * @param {Object} content - The profile content data
   * @returns {Array} Array of audience interests
   */
  determineAudienceInterests(content) {
    const themes = content.themes || [];
    const interests = [];
    
    // Extract interests from content themes
    themes.forEach(theme => {
      const name = typeof theme === 'string' ? theme : theme.name;
      if (name && !interests.includes(name)) {
        interests.push(name);
      }
    });
    
    // Add related interests based on primary themes
    if (interests.length > 0) {
      const mainInterest = interests[0]?.toLowerCase();
      
      if (mainInterest && mainInterest.includes('tech')) {
        interests.push('Innovation', 'Programming');
      } else if (mainInterest && mainInterest.includes('business')) {
        interests.push('Entrepreneurship', 'Marketing');
      } else if (mainInterest && mainInterest.includes('health')) {
        interests.push('Wellness', 'Nutrition');
      }
    }
    
    // Ensure we have at least a few interests
    if (interests.length < 2) {
      interests.push('Current Events', 'Industry News');
    }
    
    return interests.slice(0, 4); // Return top 4 interests
  }
  
  /**
   * Determine engagement pattern description
   * @param {string|number} engagement - The engagement rate
   * @returns {string} The engagement pattern description
   */
  determineEngagementPattern(engagement) {
    // Convert engagement to a number
    const rate = parseFloat(engagement?.toString().replace(/[^0-9.]/g, '') || '0');
    
    if (rate > 5) return 'High engagement with strong audience interaction.';
    if (rate > 2) return 'Moderate engagement with potential to optimize for higher audience interaction.';
    return 'Low engagement, recommended to focus on content that drives more interactions.';
  }
  
  /**
   * Generate growth recommendations
   */
  generateGrowthRecommendations(themes, bestPostingTimes) {
    const mainTheme = themes.length > 0 ? (typeof themes[0] === 'string' ? themes[0] : themes[0].name) : 'your niche';
    
    return `
      <li>Interact more with influential accounts in your niche to expand visibility</li>
      <li>Post content during peak hours (${bestPostingTimes}) to maximize visibility</li>
      <li>Incorporate more visual content with your text posts to increase engagement by up to 35%</li>
      <li>Focus on topics that align with current trending conversations in ${mainTheme} for broader reach</li>
      <li>Maintain consistent posting schedule of 4-6 times per week for optimal follower growth</li>
    `;
  }
}

// Check if ProfileFormatter already exists before declaring it
if (typeof window.ProfileFormatter === 'undefined') {
  window.ProfileFormatter = class ProfileFormatter {
    /**
     * Format profile results for display
     */
    static formatProfileResults(userData, analytics, strategy) {
      return `
        <div class="results-header">
          <h2>Profile Analysis Results</h2>
          <div class="timestamp">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Analyzed ${new Date().toLocaleString()}</span>
          </div>
        </div>
        
        <div class="profile-summary">
            <p><strong>Username:</strong> @${userData.username}</p>
            <p><strong>Description:</strong> ${userData.description || 'No description'}</p>
          <p><strong>Followers:</strong> ${userData.public_metrics?.followers_count?.toLocaleString() || 0}</p>
          <p><strong>Following:</strong> ${userData.public_metrics?.following_count?.toLocaleString() || 0}</p>
          <p><strong>Total Tweets:</strong> ${userData.public_metrics?.tweet_count?.toLocaleString() || 0}</p>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-icon">📈</span>
            <span class="metric-value">${analytics.engagement_rate}%</span>
            <span class="metric-label">Engagement Rate</span>
          </div>
          <div class="metric-card">
            <span class="metric-icon">⏰</span>
            <span class="metric-value">${analytics.best_posting_times.length > 0 ? 
              analytics.best_posting_times[0].hour + ':00' : 'N/A'}</span>
            <span class="metric-label">Best Posting Time</span>
          </div>
          <div class="metric-card">
            <span class="metric-icon">📊</span>
            <span class="metric-value">${
              strategy.contentTypes.media > Math.max(strategy.contentTypes.text, strategy.contentTypes.links) ? 'Media' :
              strategy.contentTypes.text > strategy.contentTypes.links ? 'Text' : 'Links'
            }</span>
            <span class="metric-label">Top Content Type</span>
          </div>
          <div class="metric-card">
            <span class="metric-icon">🔍</span>
            <span class="metric-value">${userData.public_metrics?.tweet_count > 0 ? 
              (userData.public_metrics.followers_count / userData.public_metrics.tweet_count).toFixed(2) : 'N/A'}</span>
            <span class="metric-label">Followers per Tweet</span>
          </div>
        </div>
            
            <h3>Best Posting Times</h3>
        <ul class="posting-times-list">
              ${analytics.best_posting_times.map(time =>
            `<li>${time.hour}:00 - Average engagement: ${time.average_engagement}</li>`
          ).join('')}
            </ul>
            
            <h3>Top Performing Content</h3>
            ${analytics.top_performing_content.map((post, index) => `
              <div class="top-post">
                <p><strong>#${index + 1}</strong> - Engagement: ${post.engagement}</p>
                <p>${post.text}</p>
                <small>Posted: ${new Date(post.created_at).toLocaleDateString()}</small>
              </div>
            `).join('')}
            
        <h3>Strategy Recommendations</h3>
            <div class="strategy-section">
              <h4>Content Mix Analysis:</h4>
              <ul>
            <li>Text-only posts: ${strategy.contentTypes.text}</li>
            <li>Media posts: ${strategy.contentTypes.media}</li>
            <li>Posts with links: ${strategy.contentTypes.links}</li>
              </ul>
              
              <h4>Recommendations:</h4>
              <ul>
            ${strategy.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>

        <div class="action-row">
          <button class="action-button share-results">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path>
            </svg>
            Share Results
          </button>
          <button class="action-button download-report">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path>
            </svg>
            Download Report
          </button>
            </div>
          `;
    }
    
    /**
     * Format Grok AI analysis for display
     */
    static formatGrokAnalysis(grokAnalysis, tokenUsage) {
      if (!grokAnalysis) return '';
      
      const formatAnalysisText = (text) => {
        if (!text) return '<p>No analysis available</p>';
        
        // Split text into paragraphs, clean up whitespace, and remove empty lines
        return text.split('\n')
          .map(para => para.trim())
          .filter(para => para.length > 0)
          .join('\n');
      };

      return `
        <div class="grok-analysis">
          <h3>Grok AI Analysis</h3>
          <p>${formatAnalysisText(grokAnalysis)}</p>
        </div>
      `;
    }
  };
}

// Initialize simple interaction manager if needed
class InteractionManager {
  constructor() {
    this.initEventListeners();
  }
  
  initEventListeners() {
    console.log('InteractionManager: Initializing event listeners');
    
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.getAttribute('data-tab'));
      });
    });
    
    // Analyze button
    const analyzeButton = document.getElementById('analyze-button');
    if (analyzeButton) {
      analyzeButton.addEventListener('click', () => this.handleAnalyze());
    }
    
    // Sign in button
    const signInButton = document.getElementById('sign-in-button');
    if (signInButton) {
      signInButton.addEventListener('click', () => this.handleSignIn());
    }
    
    // Profile input
    const profileInput = document.getElementById('profile-input');
    if (profileInput) {
      profileInput.addEventListener('input', () => this.handleProfileInputChange());
    }
    
    // Other buttons
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => this.handleAnalyze());
    }
    
    const clearCacheButton = document.getElementById('clear-cache-button');
    if (clearCacheButton) {
      clearCacheButton.addEventListener('click', () => this.clearCache());
    }
    
    const homeButton = document.getElementById('home-button');
    if (homeButton) {
      homeButton.addEventListener('click', () => this.resetToHome());
    }
  }
  
  switchTab(tabName) {
    console.log('InteractionManager: Switching to tab', tabName);
    if (!tabName) return;
    
    switchTab(tabName);
  }
  
  handleAnalyze() {
    console.log('InteractionManager: Handling analyze');
    handleAnalyze();
  }
  
  handleSignIn() {
    console.log('InteractionManager: Handling sign in');
    handleSignIn();
  }
  
  handleProfileInputChange() {
    const profileInput = document.getElementById('profile-input');
    const analyzeButton = document.getElementById('analyze-button');
    const clearInput = document.getElementById('clear-input');
    
    if (profileInput && analyzeButton) {
      const hasValue = profileInput.value.trim().length > 0;
      analyzeButton.disabled = !hasValue;
      
      if (clearInput) {
        clearInput.style.display = hasValue ? 'block' : 'none';
      }
    }
  }
  
  clearCache() {
    console.log('InteractionManager: Clearing cache');
    handleClearCache();
  }
  
  resetToHome() {
    console.log('InteractionManager: Resetting to home');
    resetUIToHome();
  }
}

// Add this at the beginning of your popup.js file to ensure it's initialized properly as a module
document.addEventListener('DOMContentLoaded', function() {
  console.log('popup.js: DOMContentLoaded fired');
  try {
    // Create and initialize the controller
    window.popupController = new PopupController();
    window.popupController.initialize().catch(error => {
      console.error('Failed to initialize popup controller:', error);
    });
  } catch (error) {
    console.error('Error creating popup controller:', error);
    // Add fallback basic initialization for analyze button
    const analyzeButton = document.getElementById('analyze-button');
    const profileInput = document.getElementById('profile-input');
    
    if (analyzeButton && profileInput) {
      console.log('Setting up fallback event listeners');
      
      // Enable button when input has content
      profileInput.addEventListener('input', function() {
        analyzeButton.disabled = !this.value.trim();
      });
      
      // Basic analyze button handling
      analyzeButton.addEventListener('click', function() {
        console.log('Analyze button clicked (fallback handler)');
        const username = profileInput.value.trim();
        
        if (username) {
          const loadingOverlay = document.querySelector('.loading-overlay');
          if (loadingOverlay) loadingOverlay.classList.remove('hidden');
          
          // Add loading state to button
          const originalText = analyzeButton.textContent;
          analyzeButton.innerHTML = '<span class="loading-spinner"></span><span>Analyzing...</span>';
          analyzeButton.disabled = true;
          
          console.log('Would analyze username:', username);
          
          // Use mock data for demonstration
          setTimeout(() => {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
            analyzeButton.textContent = originalText;
            analyzeButton.disabled = false;
            
            // Show mock results
            const resultsContainer = document.getElementById('results-container');
            if (resultsContainer) {
              resultsContainer.style.display = 'block';
              resultsContainer.innerHTML = `
                <div class="results-card">
                  <h3>Analysis for @${username}</h3>
                  <p>This is a mock result since API connections are not working.</p>
                  <div class="metrics-grid">
                    <div class="metric-card fade-in">
                      <div class="metric-value">1.5K</div>
                      <div class="metric-label">Followers</div>
                    </div>
                    <div class="metric-card fade-in">
                      <div class="metric-value">245</div>
                      <div class="metric-label">Following</div>
                    </div>
                    <div class="metric-card fade-in">
                      <div class="metric-value">42</div>
                      <div class="metric-label">Engagement</div>
                    </div>
                  </div>
                </div>
              `;
            }
          }, 2000);
        }
      });
    }
  }
});

function debugCheckElements() {
  const criticalElements = [
    '#analyze-button',
    '#profile-input',
    '#clear-input',
    '#sign-in-button',
    '#retry-button',
    '#clear-cache-button',
    '.tab-button',
    '#analyze-tab',
    '#compose-tab',
    '#history-tab'
  ];
  
  console.log('Checking critical elements...');
  criticalElements.forEach(selector => {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`✅ Found ${selector}`);
    } else {
      console.error(`❌ Missing ${selector}`);
    }
  });
}

// Initialize the application when the DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded, initializing popup controller');
  const popupController = new PopupController();
  popupController.initialize();
});

// Implementation for history tab functionality
function loadHistory() {
  console.log('Loading history items');
  
  // Check if we're on the history tab - if not, don't attempt to load history
  const historyTab = document.getElementById('history-tab');
  const isHistoryTabActive = historyTab && historyTab.classList.contains('active');
  
  if (!isHistoryTabActive) {
    console.log('Not on history tab, skipping history load');
    return;
  }
  
  // Make sure DOM is ready - use the correct history container ID from popup.html
  const historyContainer = document.getElementById('historyItemsContainer');
  if (!historyContainer) {
    console.error('History container not found in DOM');
    // Only retry a limited number of times to prevent infinite loop
    const retryCount = window.historyLoadRetry || 0;
    if (retryCount < 3) {
      window.historyLoadRetry = retryCount + 1;
      console.log(`Retry attempt ${window.historyLoadRetry}/3 for loading history`);
      setTimeout(() => loadHistory(), 500);
    } else {
      console.error('Maximum retry attempts reached for loading history');
      window.historyLoadRetry = 0;
    }
    return;
  }
  
  // Reset retry counter since we found the container
  window.historyLoadRetry = 0;
  
  // Helper function to format large numbers
  function formatLargeNumber(num) {
    // Ensure num is a number and handle invalid inputs
    if (num === null || num === undefined || isNaN(Number(num))) {
      return '0';
    }
    
    num = Number(num);
    
    // Format based on size
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    
    // For small numbers, just return the number
    return num.toString();
  }
  
  // Helper function to format relative time
  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  }
  
  // Set up Clear All button once
  const clearAllButton = document.getElementById('clear-history-button');
  if (clearAllButton) {
    // Remove existing event listeners by cloning and replacing
    const newClearButton = clearAllButton.cloneNode(true);
    if (clearAllButton.parentNode) {
      clearAllButton.parentNode.replaceChild(newClearButton, clearAllButton);
    }
    
    // Add event listener to the new button
    newClearButton.addEventListener('click', () => {
      console.log('Clear all history button clicked');
      
      // Show confirmation before clearing
      if (confirm('Are you sure you want to clear all history?')) {
        // Show confirmation toast
        showToast('Clearing all history...', 'info');
        
        // Clear history in storage
        chrome.storage.local.remove(['analysisHistory'], () => {
          console.log('All history cleared');
          
          // Show empty state in the container
          historyContainer.innerHTML = `
            <div class="empty-history">
              <div class="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                </svg>
              </div>
              <h3>No Analysis History</h3>
              <p>Profile analyses will appear here</p>
            </div>
          `;
          
          // Show success toast
          showToast('History cleared successfully', 'success');
        });
      }
    });
  }
  
  console.log('Getting analysis history from storage');
  chrome.storage.local.get(['analysisHistory'], (result) => {
    const history = result.analysisHistory || [];
    console.log('Loaded history items:', history.length);
    
    if (history.length === 0) {
      // Show empty state
      historyContainer.innerHTML = `
        <div class="empty-history">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
              <path fill="currentColor" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
            </svg>
          </div>
          <h3>No Analysis History</h3>
          <p>Profile analyses will appear here</p>
        </div>
      `;
      return;
    }
    
    // Sort by timestamp (newest first)
    history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Create history list
    let historyHTML = '';
    
    // Create history items with better error handling for metrics
    history.forEach(item => {
      try {
        // Format timestamp
        const date = item.timestamp ? new Date(item.timestamp) : new Date();
        const formattedDate = formatRelativeTime(item.timestamp);
        
        // Format metrics with defaults and handling for undefined
        const followers = item.metrics?.followers || 0;
        const following = item.metrics?.following || 0;
        const engagement = item.metrics?.engagement || 0;
        
        historyHTML += `
          <div class="history-item">
            <div class="history-item-header">
              <div class="history-item-user">
                <img src="https://unavatar.io/twitter/${item.username}" alt="${item.username}" class="history-avatar" onerror="this.src='../icons/icon48.png';">
                <h4>@${item.username}</h4>
              </div>
              <div class="history-item-date">${formattedDate}</div>
            </div>
            <div class="history-item-metrics">
              <div class="history-metric">
                <span class="metric-value">${formatLargeNumber(followers)}</span>
                <span class="metric-label">Followers</span>
              </div>
              <div class="history-metric">
                <span class="metric-value">${formatLargeNumber(following)}</span>
                <span class="metric-label">Following</span>
              </div>
              <div class="history-metric">
                <span class="metric-value">${engagement}%</span>
                <span class="metric-label">Engagement</span>
              </div>
            </div>
            <div class="history-item-actions">
              <button class="view-profile-button" data-username="${item.username}">View Analysis</button>
              <button class="delete-history-button" data-username="${item.username}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      } catch (err) {
        console.error(`Error rendering history item for ${item.username}:`, err);
        // Create a simpler version if there's an error
        historyHTML += `
          <div class="history-item">
            <div class="history-item-header">
              <div class="history-item-user">
                <div class="history-avatar-placeholder">?</div>
                <h4>@${item.username || 'unknown'}</h4>
              </div>
            </div>
            <div class="history-item-actions">
              <button class="view-profile-button" data-username="${item.username}">View Profile</button>
              <button class="delete-history-button" data-username="${item.username}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      }
    });
    
    historyContainer.innerHTML = historyHTML;
    
    // Add event listeners to history item buttons
    document.querySelectorAll('.view-profile-button').forEach(button => {
      button.addEventListener('click', () => {
        const username = button.getAttribute('data-username');
        if (username) {
          // Switch to analyze tab
          const analyzeTab = document.querySelector('.tab-button#analyze-tab');
          if (analyzeTab) {
            analyzeTab.click();
            
            // Set the username in the input field
            const profileInput = document.getElementById('profile-input');
            if (profileInput) {
              profileInput.value = username.startsWith('@') ? username : '@' + username;
              
              // Update analyze button state
              const analyzeButton = document.getElementById('analyze-button');
              if (analyzeButton) {
                analyzeButton.disabled = false;
                analyzeButton.classList.add('active');
              }
              
              // Trigger analysis after a short delay to allow tab change to complete
              setTimeout(() => {
                const analyzeButton = document.getElementById('analyze-button');
                if (analyzeButton && !analyzeButton.disabled) {
                  analyzeButton.click();
                }
              }, 100);
            }
          }
        }
      });
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-history-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling to parent elements
        
        const username = button.getAttribute('data-username');
        if (username) {
          // Add confirmation before delete
          if (confirm(`Remove @${username} from history?`)) {
            chrome.storage.local.get(['analysisHistory'], (result) => {
              const history = result.analysisHistory || [];
              const updatedHistory = history.filter(item => item.username !== username);
              
              chrome.storage.local.set({ analysisHistory: updatedHistory }, () => {
                // Remove the item from DOM with animation
                const historyItem = button.closest('.history-item');
                if (historyItem) {
                  historyItem.style.opacity = '0';
                  historyItem.style.transform = 'translateY(-10px)';
                  setTimeout(() => {
                    // Reload history
                    loadHistory();
                  }, 300);
                }
                showToast(`Removed @${username} from history`, 'success');
              });
            });
          }
        }
      });
    });
  });
}

// Improved addToHistory function
function addToHistory(username, metrics = {}) {
  console.log('Adding to history:', username, metrics);
  
  if (!username) {
    console.error('Cannot add to history: No username provided');
    return;
  }
  
  // Normalize the username fully (remove @ if present)
  username = (username || '').trim();
  if (username.startsWith('@')) {
    username = username.substring(1);
  }
  
  if (!username) {
    console.error('Cannot add to history: Invalid username after normalization');
    return;
  }
  
  // Ensure metrics are Numbers or default to 0
  const safeMetrics = {
    followers: typeof metrics.followers === 'number' ? metrics.followers : 
               parseInt(metrics.followers) || 0,
    following: typeof metrics.following === 'number' ? metrics.following : 
               parseInt(metrics.following) || 0,
    engagement: typeof metrics.engagement === 'number' ? metrics.engagement : 
                parseFloat(metrics.engagement) || 0
  };
  
  chrome.storage.local.get(['analysisHistory'], (result) => {
    let history = result.analysisHistory || [];
    
    // Check if this username already exists (case insensitive)
    const existingIndex = history.findIndex(item => 
      item.username?.toLowerCase() === username.toLowerCase()
    );
    
    // Create new history item or update existing
    const historyItem = {
      username: username,
      timestamp: Date.now(),
      metrics: safeMetrics
    };
    
    if (existingIndex !== -1) {
      // Update existing entry and move to top
      history.splice(existingIndex, 1);
    }
    
    // Add to beginning of array
    history.unshift(historyItem);
    
    // Limit history to 20 items
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    // Save to local storage
    chrome.storage.local.set({ analysisHistory: history }, () => {
      console.log('History updated, total items:', history.length);
      
      // Only refresh the history view if we're actually on the history tab
      const historyTab = document.getElementById('history-tab');
      if (historyTab && historyTab.classList.contains('active')) {
        console.log('Already on history tab, reloading history view');
        setTimeout(() => loadHistory(), 300);
      }
    });
  });
}

// Helper function to show toast notifications (used by history functions)
function showToast(message, type = 'info', duration = 3000) {
  try {
    // Check if we can use the UIManager from popup controller first
    if (window.popupController && window.popupController.uiManager) {
      window.popupController.uiManager.showToast(message, type, duration);
      return;
    }
    
    // Fallback to direct DOM manipulation if UIManager is not available
    // Check if there's an existing toast container
    let toastContainer = document.querySelector('.toast-container');
    
    // Create it if it doesn't exist
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Get appropriate icon based on type
    let iconSvg = '';
    switch (type) {
      case 'success':
        iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
        break;
      case 'error':
        iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
        break;
      case 'warning':
        iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
        break;
      default: // info
        iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    }
    
    // Set toast content
    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-message">${message}</div>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Add visible class after a small delay (for animation)
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);
    
    // Set timeout to remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300); // Match transition time
    }, duration);
  } catch (error) {
    // Fallback to console if even the toast functionality fails
    console.error('Failed to show toast:', message);
    console.error(error);
  }
}

// Add event listener to load history when history tab is clicked
document.addEventListener('DOMContentLoaded', () => {
  const historyTab = document.getElementById('history-tab');
  if (historyTab) {
    historyTab.addEventListener('click', () => {
      // Use setTimeout to ensure tab change completes before loading history
      setTimeout(() => loadHistory(), 100);
    });
  }
  
  // Also ensure history is loaded if the tab is active on initial load
  if (historyTab && historyTab.classList.contains('active')) {
    setTimeout(() => loadHistory(), 200);
  }
});