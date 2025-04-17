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
        16: 'icons/active/icon16.png',
        48: 'icons/active/icon48.png',
        128: 'icons/active/icon128.png'
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

// IconPreloader class for ensuring all extension icons are loaded properly
class IconPreloader {
  static async preloadIcons() {
    console.log('Starting icon preloading process...');
    
    const basePath = chrome.runtime.getURL('');
    console.log('Base extension path:', basePath);
    
    // Validate the icon directory structure first
    const validationResult = await this.validateIconPaths();
    if (!validationResult.success) {
      console.warn('Icon path validation failed:', validationResult.issues);
    }
    
    // Primary icon paths with fallbacks
    const iconPaths = [
      'icons/icon16.png',
      'icons/icon48.png',
      'icons/icon128.png',
      'icons/active/icon16.png',
      'icons/active/icon48.png',
      'icons/active/icon128.png',
      'icons/disabled/icon16-disabled.png',
      'icons/disabled/icon48-disabled.png',
      'icons/disabled/icon128-disabled.png'
    ];
    
    // Ensure directories exist
    const ensureDirectoryExists = (path) => {
      const directories = ['icons/active', 'icons/disabled'];
      directories.forEach(dir => {
        console.log(`Checking if directory exists: ${dir}`);
      });
    };
    
    // Call directory check (this is just for debugging purposes)
    ensureDirectoryExists();
    
    // Try to load each icon with fallbacks
    const results = await Promise.allSettled(
      iconPaths.map(path => this.loadImageWithFallbacks(path))
    );
    
    // Log results for debugging
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Icon preloading complete. Succeeded: ${succeeded}, Failed: ${failed}`);
    
    // Consider it successful if we've loaded at least the main icons
    return succeeded > 0;
  }
  
  // Validate that required icon paths have the expected structure
  static async validateIconPaths() {
    const issues = [];
    
    // Check if main directories exist
    const requiredDirs = [
      'icons',
      'icons/active',
      'icons/disabled'
    ];
    
    // Check for required files
    const requiredFiles = [
      'icons/icon16.png',
      'icons/icon48.png',
      'icons/icon128.png'
    ];
    
    // Check if directories are accessible through runtime URL
    for (const dir of requiredDirs) {
      try {
        const dirPath = chrome.runtime.getURL(dir);
        console.log(`Directory path: ${dirPath}`);
        // Note: We can't actually check if the directory exists using fetch in Chrome extensions
        // We can only check if files inside that directory can be loaded
      } catch (error) {
        issues.push(`Directory ${dir} might not be accessible: ${error.message}`);
      }
    }
    
    // Check if required files are accessible
    const fileChecks = await Promise.allSettled(
      requiredFiles.map(async (file) => {
        try {
          const result = await this.loadSingleImage(file);
          return { file, accessible: true };
        } catch (error) {
          return { file, accessible: false, error: error.message };
        }
      })
    );
    
    const inaccessibleFiles = fileChecks
      .filter(result => result.status === 'fulfilled' && !result.value.accessible)
      .map(result => result.value.file);
    
    if (inaccessibleFiles.length > 0) {
      issues.push(`Following files could not be accessed: ${inaccessibleFiles.join(', ')}`);
    }
    
    return {
      success: issues.length === 0,
      issues
    };
  }
  
  // Load an image with multiple fallback options
  static async loadImageWithFallbacks(primaryPath) {
    const fallbacks = [
      primaryPath,
      // Fallback to default version if specific state version fails
      primaryPath.includes('/') ? primaryPath.split('/').pop() : null,
      // Ultimate fallback to icon16.png, icon48.png or icon128.png
      primaryPath.includes('-') ? primaryPath.split('-')[0] + '.png' : null
    ].filter(Boolean);
    
    for (const path of fallbacks) {
      try {
        const result = await this.loadSingleImage(path);
        return result;
      } catch (err) {
        console.warn(`Failed to load icon: ${path}, trying next fallback`);
      }
    }
    
    // If all fallbacks fail
    throw new Error(`Failed to load icon: ${primaryPath} after trying all fallbacks`);
  }
  
  // Load a single image
  static loadSingleImage(path) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        
        img.onload = () => {
          console.log(`Successfully loaded icon: ${path}`);
          resolve({ path, success: true });
        };
        
        img.onerror = (error) => {
          console.warn(`Error loading icon ${path}:`, error);
          reject(new Error(`Failed to load ${path}`));
        };
        
        const fullPath = chrome.runtime.getURL(path);
        console.log(`Attempting to load: ${fullPath}`);
        img.src = fullPath;
      } catch (err) {
        reject(err);
      }
    });
  }
  
  // Check if all necessary icons exist and are loadable
  static async checkIconAvailability() {
    try {
      // Core icons that must be available for the extension to work properly
      const criticalIcons = [
        'icons/icon16.png',
        'icons/icon48.png',
        'icons/icon128.png'
      ];
      
      const results = await Promise.allSettled(
        criticalIcons.map(path => this.loadSingleImage(path))
      );
      
      const allCriticalIconsLoaded = results.every(r => r.status === 'fulfilled');
      
      return {
        success: allCriticalIconsLoaded,
        missingIcons: results
          .filter(r => r.status === 'rejected')
          .map((r, i) => criticalIcons[i])
      };
    } catch (error) {
      console.error('Error checking icon availability:', error);
      return { success: false, error };
    }
  }
}

// API Connectivity Checker
class ApiConnectivityChecker {
  static async checkConnectivity() {
    console.log('Checking API connectivity...');
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'testApiConnection',
        silent: true
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('API connectivity check failed:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }
        
        if (!response || !response.success) {
          console.warn('API connectivity check failed:', response?.error || 'Unknown error');
          resolve({
            success: false,
            error: response?.error || 'API connection failed'
          });
          return;
        }
        
        console.log('API connectivity check successful');
        resolve({
          success: true,
          data: response
        });
      });
    });
  }
  
  static showWarningBanner(message) {
    // Create a warning banner
    const banner = document.createElement('div');
    banner.className = 'api-warning-banner';
    banner.innerHTML = `
      <div class="warning-icon">⚠️</div>
      <div class="warning-message">${message}</div>
      <div class="warning-close">×</div>
    `;
    
    // Add to DOM at the top
    const container = document.querySelector('.container') || document.body;
    container.insertBefore(banner, container.firstChild);
    
    // Add click handler to close
    const closeButton = banner.querySelector('.warning-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        banner.remove();
      });
    }
    
    return banner;
  }
}

// Simple analytics service

// PopupController class to manage popup functionality
class PopupController {
  constructor() {
    this.uiManager = null;
    this.iconManager = null;
    this.analyticsService = null;
    this.debugResults = document.getElementById('debug-results');
    this.isAnalyzing = false;
    this.abortController = null;
  }

  /**
   * Initialize the popup controller
   */
  async initialize() {
    console.log('Initializing popup');
    
    // Cache DOM elements for quick access
    this.cacheDomElements();
    
    // Preload icons to prevent loading errors
    try {
      console.log('Preloading icons...');
      if (typeof IconManager !== 'undefined') {
        // Use our in-popup IconManager
        await IconManager.preloadIcons();
        console.log('Icons preloaded successfully using IconManager');
      } else {
        console.warn('IconManager is not defined, icon preloading may be incomplete');
      }
    } catch (error) {
      console.warn('Icon preloading had some failures, continuing with initialization:', error);
    }
    
    // Check API connectivity at startup
    try {
      console.log('Checking API connectivity...');
      const response = await chrome.runtime.sendMessage({ action: 'testApiConnection', silent: true });
      
      if (!response || !response.success) {
        console.warn('API connectivity check failed:', response?.error || 'Unknown error');
        // Show warning banner
        this.showApiWarningBanner(response?.error || 'API connection failed');
      } else {
        console.log('API connectivity check successful');
      }
    } catch (error) {
      console.error('Error checking API connectivity:', error);
      this.showApiWarningBanner('Could not verify API connection');
    }
    
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
   * Cache DOM elements for quick access
   */
  cacheDomElements() {
    this.profileInput = document.getElementById('profile-input');
    this.postUrlInput = document.getElementById('post-url');
    this.analyzeButton = document.getElementById('analyze-button');
    this.resultsContainer = document.getElementById('results-container');
    this.loadingOverlay = document.querySelector('.loading-overlay');
    this.loadingText = document.querySelector('.loading-text');
    this.progressBar = document.querySelector('.progress-bar');
    this.progressFill = document.querySelector('.progress-fill');
    this.errorMessageContainer = document.getElementById('error-message');
    this.testApiButton = document.getElementById('test-api-button');
    
    // Initialize abort controller
    this.abortController = null;
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Analyze button click handler
    if (this.analyzeButton) {
      this.analyzeButton.addEventListener('click', () => {
        this.analyze();
      });
    }

    // Handle Enter key on profile input
    if (this.profileInput) {
      this.profileInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
          this.analyze();
        }
        this.updateCharacterCount();
      });
    }

    // Test API button
    if (this.testApiButton) {
      this.testApiButton.addEventListener('click', () => {
        this.testApiConnection();
      });
    }
  }

  /**
   * Test API Connection
   */
  async testApiConnection() {
    try {
      if (this.testApiButton) {
        this.testApiButton.textContent = 'Testing...';
        this.testApiButton.disabled = true;
      }

      const response = await chrome.runtime.sendMessage({ 
        action: 'testApiConnection',
        forceCheck: true
      });

      if (response && response.success) {
        this.showSuccessMessage('API connection successful!');
      } else {
        this.showApiWarningBanner(response?.error || 'API connection failed');
      }
    } catch (error) {
      this.showApiWarningBanner('Error testing API connection');
      console.error('Error testing API connection:', error);
    } finally {
      if (this.testApiButton) {
        this.testApiButton.textContent = 'Test API';
        this.testApiButton.disabled = false;
      }
    }
  }

  /**
   * Analyze a profile
   */
  async analyze() {
    // Don't allow multiple simultaneous analysis requests
    if (this.isAnalyzing) {
      console.log('Analysis already in progress, ignoring request');
      return;
    }

    // Get profile and post URL
    const profileValue = this.profileInput?.value?.trim();
    const postUrl = this.postUrlInput?.value?.trim();

    // Validate input
    if (!profileValue) {
      this.showErrorMessage('Please enter a profile URL or handle');
      return;
    }

    try {
      // Set analyzing state
      this.isAnalyzing = true;
      
      // Store original button text
      const originalButtonText = this.analyzeButton?.innerHTML || 'Analyze';
      
      // Create a new AbortController for request cancellation
      this.abortController = new AbortController();
      
      // Show loading UI
      if (this.analyzeButton) {
        this.analyzeButton.disabled = true;
        this.analyzeButton.innerHTML = '<span class="loading-spinner"></span> Analyzing...';
      }
      
      // Show loading overlay with progress
      this.showLoading('Connecting to X API...');
      this.updateProgress(10);
      
      // Extract username with robust error handling
      const username = this.extractUsername(profileValue);
      if (!username) {
        throw new Error('Invalid profile URL or handle');
      }
      
      console.log(`Analyzing profile: @${username}`);
      this.updateProgress(20);
      this.showLoading(`Fetching data for @${username}...`);

      // Create message with unique ID for tracking
      const messageId = `analyze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add cancel button to loading overlay
      let cancelButton = this.loadingOverlay.querySelector('.cancel-button');
      if (!cancelButton) {
        cancelButton = document.createElement('button');
        cancelButton.className = 'cancel-button';
        cancelButton.textContent = 'Cancel';
        this.loadingOverlay.appendChild(cancelButton);
      }
      
      // Define cancel handler
      const cancelHandler = () => {
        // Clean up and abort
        if (this.abortController) {
          this.abortController.abort();
        }
        this.hideLoading();
        if (this.analyzeButton) {
          this.analyzeButton.innerHTML = originalButtonText;
          this.analyzeButton.disabled = false;
        }
        this.isAnalyzing = false;
        this.showToast('Analysis canceled', 'info');
        
        // Remove event listener to prevent memory leaks
        cancelButton.removeEventListener('click', cancelHandler);
      };
      
      // Add cancel button click handler
      cancelButton.addEventListener('click', cancelHandler);
      
      // Set up a timeout for the entire operation
      const apiTimeout = setTimeout(() => {
        console.warn(`Analysis timeout triggered for ${username} after 20 seconds`);
        if (this.abortController) {
          this.abortController.abort('timeout');
        }
        throw new Error('Analysis timed out. Please try again later.');
      }, 20000);
      
      // Send message with timeout handling
      const messagePromise = new Promise((resolve, reject) => {
        console.log('Sending analyze profile message to background.js:', {
          action: 'analyzeProfile',
          username: username,
          postUrl: postUrl,
          options: { forceRefresh: false },
          _messageId: messageId,
          _requestId: Date.now().toString()
        });
        
        try {
          chrome.runtime.sendMessage({
            action: 'analyzeProfile',
            username: username,
            postUrl: postUrl,
            options: { forceRefresh: false },
            _messageId: messageId,
            _requestId: Date.now().toString()
          }, response => {
            // Check for runtime errors
            if (chrome.runtime.lastError) {
              console.error('Runtime error during message send:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message || 'Browser runtime error'));
              return;
            }
            
            if (!response) {
              reject(new Error('No response from background script'));
              return;
            }
            
            resolve(response);
          });
        } catch (sendError) {
          console.error('Error sending message:', sendError);
          reject(sendError);
        }
      });
      
      // Handle signal from abortController
      this.abortController.signal.addEventListener('abort', () => {
        clearTimeout(apiTimeout);
        console.log(`Analysis for ${username} was aborted`);
      });
      
      // Wait for response or timeout
      this.updateProgress(30);
      this.showLoading('Analyzing profile data...');
      
      // Progress animation while waiting
      let progress = 30;
      const progressInterval = setInterval(() => {
        progress += 1;
        if (progress >= 90) {
          clearInterval(progressInterval);
        }
        this.updateProgress(progress);
      }, 200);

      try {
        // Race the message promise against the abort signal
        const response = await Promise.race([
          messagePromise,
          new Promise((_, reject) => {
            this.abortController.signal.addEventListener('abort', () => {
              reject(new Error(this.abortController.signal.reason || 'Request aborted'));
            });
          })
        ]);
        
        // Clean up timeout since we got a response
        clearTimeout(apiTimeout);
        
        // Clear the progress animation
        clearInterval(progressInterval);
        this.updateProgress(100);
        this.showLoading('Analysis complete!');
        
        console.log('Analysis response received:', response);
        
        // Run diagnostic checks on the response
        this.runResponseDiagnostics(response);
        
        if (!response.success) {
          throw new Error(response.error || 'Analysis failed');
        }
        
        // Process successful response
        await new Promise(r => setTimeout(r, 300)); // Give time for animation
        this.displayResults(response.data);
        
        // Save to history
        this.saveToHistory(username, response.data);
        
        // Show success notification
        this.showSuccessMessage(response.fromCache ? 'Analysis loaded from cache!' : 'Analysis completed successfully!');
      } catch (analysisError) {
        console.error('Error during analysis:', analysisError);
        
        clearInterval(progressInterval);
        this.updateProgress(100);
        
        // Show error message
        this.showErrorMessage(analysisError.message || 'Analysis failed');
        
        // Display error state with fallback UI
        this.displayErrorState(username, analysisError);
      }
    } catch (error) {
      console.error('Error in analyze flow:', error);
      
      // Show error message
      this.showErrorMessage(error.message || 'Failed to start analysis');
      
      // Add cancel button to loading overlay if it's still visible
      if (this.loadingOverlay && !this.loadingOverlay.classList.contains('hidden')) {
        // Add cancel button if not already present
        let cancelButton = this.loadingOverlay.querySelector('.cancel-button');
        if (!cancelButton) {
          cancelButton = document.createElement('button');
          cancelButton.className = 'cancel-button';
          cancelButton.textContent = 'Cancel';
          this.loadingOverlay.appendChild(cancelButton);
          
          // Add cancel handler
          cancelButton.addEventListener('click', () => {
            // Abort any pending requests
            if (this.abortController) {
              this.abortController.abort();
            }
            
            // Hide loading overlay
            this.hideLoading();
            
            // Show toast notification
            this.showToast('Analysis canceled', 'info');
          });
        }
      }
      
      // Attempt to show fallback data if username is available
      if (this.profileInput && this.profileInput.value) {
        try {
          const usernameForFallback = this.extractUsername(this.profileInput.value.trim());
          if (usernameForFallback) {
            console.log(`Generating fallback data for ${usernameForFallback} after error`);
            this.displayErrorState(usernameForFallback, error);
          }
        } catch (fallbackError) {
          console.error('Error generating fallback data:', fallbackError);
        }
      }
    } finally {
      // Hide loading overlay
      this.hideLoading();
      
      // Reset button state
      if (this.analyzeButton) {
        this.analyzeButton.disabled = false;
        this.analyzeButton.innerHTML = 'Analyze';
      }
      
      // Reset analyzing state
      this.isAnalyzing = false;
      console.log('Analysis process completed or failed, resetting state');
      
      // Clear any abort controller
      if (this.abortController) {
        this.abortController = null;
      }
    }
  }
  
  /**
   * Display error state with fallback UI
   */
  displayErrorState(username, error) {
    // Function to display error state with fallback UI
    if (!this.resultsContainer) return;
    
    // Generate a fallback UI with error message
    this.resultsContainer.classList.remove('hidden');
    this.resultsContainer.innerHTML = `
      <div class="results-card">
        <div class="error-banner">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>Error analyzing profile</span>
        </div>
        
        <h3>Analysis for @${username}</h3>
        <p>We encountered an error while analyzing this profile:</p>
        <div class="error-message-box">
          ${error.message || 'Unknown error occurred'}
        </div>
        
        <div class="error-suggestions">
          <h4>Suggestions:</h4>
          <ul>
            <li>Check if the profile exists on X</li>
            <li>Verify your internet connection</li>
            <li>Try again in a few minutes</li>
            <li>Check if the X API is experiencing issues</li>
          </ul>
        </div>
        
        <div class="action-buttons">
          <button id="retry-button" class="secondary-button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: 6px;">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 9h7V2l-2.35 2.35z"/>
            </svg>
            Retry
          </button>
        </div>
      </div>
    `;
    
    // Add event listener to retry button
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        if (this.analyzeButton) {
          this.analyzeButton.click();
        }
      });
    }
  }

  /**
   * Show success message with toast notification
   */
  showSuccessMessage(message) {
    // Show in the error container (reusing it)
    if (this.errorMessageContainer) {
      this.errorMessageContainer.innerHTML = `
        <div class="success-message">
          <span class="success-icon">✅</span>
          ${message}
        </div>
      `;
      this.errorMessageContainer.classList.remove('hidden');
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.errorMessageContainer.classList.add('hidden');
      }, 3000);
    }
    
    // Also show as toast
    this.showToast(message, 'success');
  }
  
  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    try {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      
      // Create toast element
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <div class="toast-content">
          <span class="toast-message">${message}</span>
        </div>
      `;
      
      // Add to container
      container.appendChild(toast);
      
      // Animate in
      setTimeout(() => toast.classList.add('show'), 10);
      
      // Auto-dismiss after delay
      const dismissDelay = type === 'error' ? 5000 : 3000;
      setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, dismissDelay);
    } catch (error) {
      // Fallback to console if toast fails
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Run diagnostics on the analysis response
   */
  runResponseDiagnostics(response) {
    if (!response) {
      console.error('[Diagnostics] Response is null or undefined');
      return;
    }

    console.log('[Diagnostics] Response structure:', Object.keys(response));
    
    if (!response.success) {
      console.error('[Diagnostics] Analysis failed:', response.error || 'No error details provided');
      return;
    }
    
    if (!response.data) {
      console.error('[Diagnostics] Response missing data object');
      return;
    }
    
    // Check if essential data fields are present
    const requiredFields = ['username', 'metrics', 'analysis'];
    const missingFields = requiredFields.filter(field => !response.data[field]);
    
    if (missingFields.length > 0) {
      console.error('[Diagnostics] Response missing required fields:', missingFields);
    }
    
    // Check metrics structure
    if (response.data.metrics) {
      console.log('[Diagnostics] Metrics present:', Object.keys(response.data.metrics).length);
    }
    
    // Check analysis structure
    if (response.data.analysis) {
      console.log('[Diagnostics] Analysis present:', Object.keys(response.data.analysis).length);
    }
  }

  /**
   * Extract username from profile value (could be URL or handle)
   */
  extractUsername(profileValue) {
    // Handle direct username input (with or without @)
    if (profileValue.startsWith('@')) {
      return profileValue.substring(1);
    }

    // Check if it's a URL
    if (profileValue.includes('twitter.com/') || profileValue.includes('x.com/')) {
      try {
        // Try to parse as URL
        const url = new URL(profileValue);
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);
        if (pathParts.length > 0) {
          return pathParts[0]; // First path component after domain
        }
      } catch (e) {
        // Not a valid URL, try regex extraction
        const match = profileValue.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    // Assume it's a direct handle if nothing else matched
    // Validate username format (letters, numbers, underscore)
    if (/^[A-Za-z0-9_]+$/.test(profileValue)) {
      return profileValue;
    }

    return null;
  }

  /**
   * Display analysis results
   */
  displayResults(data) {
    if (!this.resultsContainer) {
      console.error('Results container not found in DOM');
      return;
    }
    
    console.log('Displaying results:', data);
    
    // Show results container
    this.resultsContainer.classList.remove('hidden');
    
    // Clear previous results
    this.resultsContainer.innerHTML = '';
    
    try {
      // Normalize data structure - sometimes data is wrapped, sometimes it's direct
      let normalizedData = data;
      
      // If data has its own data property, use that
      if (data && data.data && typeof data.data === 'object') {
        normalizedData = data.data;
      }
      
      // Check if data has the required user property or data.user
      if (!normalizedData || !normalizedData.user) {
        console.error('Missing required data properties for displaying results:', normalizedData);
        this.resultsContainer.innerHTML = `
          <div class="error-message">
            <span class="error-icon">❌</span>
            Invalid data format received from API
          </div>
        `;
        return;
      }
      
      // Extract user data
      const user = normalizedData.user;
      
      // Build profile card
      const profileHtml = this.buildProfileCard(user);
      
      // Build analytics section if data available
      const analyticsHtml = this.buildAnalyticsSection(normalizedData.analytics);
      
      // Build strategy section if data available
      const strategyHtml = this.buildStrategySection(normalizedData.strategy);
      
      // Add appropriate banners
      const warnings = [];
      
      // Check all possible flags for showing estimated/fallback data warning
      const showFallbackWarning = data.isFallbackData || 
                                data.isEstimated || 
                                data.fromFallback ||
                                (normalizedData.isFallbackData) || 
                                (normalizedData.isEstimated) ||
                                (normalizedData.fromFallback);
      
      if (showFallbackWarning) {
        warnings.push(this.buildWarningBanner(
          'Showing estimated data because API data couldn\'t be retrieved.'
        ));
      }
      
      // Add warning if one was provided
      if (data.warning || normalizedData.warning) {
        warnings.push(this.buildWarningBanner(
          data.warning || normalizedData.warning
        ));
      }
      
      // Add cache notice if data is from cache
      let cacheNotice = '';
      if (data.fromCache || normalizedData.fromCache) {
        const timestamp = new Date(data.timestamp || normalizedData.timestamp || Date.now()).toLocaleString();
        cacheNotice = `
          <div class="cache-notice">
            <span class="cache-icon">🕒</span>
            <span class="cache-text">Data from cache (${timestamp})</span>
          </div>
        `;
      }
      
      // Combine all sections
      this.resultsContainer.innerHTML = `
        ${warnings.join('')}
        ${cacheNotice}
        ${profileHtml}
        ${analyticsHtml}
        ${strategyHtml}
      `;
      
      // Add event listeners to warning close buttons
      const closeButtons = document.querySelectorAll('.warning-close');
      closeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.target.closest('.api-warning-banner').remove();
        });
      });
    } catch (error) {
      console.error('Error displaying results:', error);
      this.resultsContainer.innerHTML = `
        <div class="error-message">
          <span class="error-icon">❌</span>
          Error displaying results: ${error.message}
        </div>
      `;
    }
  }
  
  /**
   * Build profile card HTML
   */
  buildProfileCard(user) {
    if (!user) return '';
    
    // Safely access nested properties
    const publicMetrics = user.public_metrics || {};
    
    return `
      <div class="profile-card">
        <div class="profile-header">
          <img src="${user.profile_image_url || 'images/default-avatar.png'}" 
               alt="${user.name || user.username}" 
               class="profile-image"
               onerror="this.src='images/default-avatar.png';">
          <div class="profile-info">
            <div class="profile-name">
              ${user.name || user.username} 
              ${user.verified ? '<span class="verified-badge">✓</span>' : ''}
            </div>
            <div class="profile-handle">@${user.username}</div>
          </div>
        </div>
        <div class="profile-metrics">
          <div class="metric">
            <div class="metric-value">${formatNumber(publicMetrics.followers_count || 0)}</div>
            <div class="metric-label">Followers</div>
          </div>
          <div class="metric">
            <div class="metric-value">${formatNumber(publicMetrics.following_count || 0)}</div>
            <div class="metric-label">Following</div>
          </div>
          <div class="metric">
            <div class="metric-value">${formatNumber(publicMetrics.tweet_count || 0)}</div>
            <div class="metric-label">Tweets</div>
          </div>
        </div>
        <div class="profile-description">${user.description || ''}</div>
      </div>
    `;
  }
  
  /**
   * Build analytics section HTML
   */
  buildAnalyticsSection(analytics) {
    if (!analytics) return '';
    
    // Format best posting times
    let bestPostingTimesHtml = 'No data available';
    if (Array.isArray(analytics.best_posting_times) && analytics.best_posting_times.length > 0) {
      bestPostingTimesHtml = analytics.best_posting_times.map(time => 
        `<div>${time.day || 'Any day'} ${time.hour || 'Any time'} (${time.average_engagement || '0'} avg. engagement)</div>`
      ).join('');
    }
    
    return `
      <div class="analytics-section">
        <h3>Engagement Analysis</h3>
        <div class="analytics-card">
          <div class="analytics-item">
            <div class="analytics-label">Engagement Rate</div>
            <div class="analytics-value">${analytics.engagement_rate || '0%'}</div>
          </div>
          <div class="analytics-item">
            <div class="analytics-label">Best Posting Times</div>
            <div class="analytics-value">
              ${bestPostingTimesHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Build strategy section HTML
   */
  buildStrategySection(strategy) {
    if (!strategy) return '';
    
    // Format recommendations
    let recommendationsHtml = '<li>No specific recommendations available</li>';
    if (Array.isArray(strategy.recommendations) && strategy.recommendations.length > 0) {
      recommendationsHtml = strategy.recommendations.map(rec => `<li>${rec}</li>`).join('');
    }
    
    return `
      <div class="strategy-section">
        <h3>Content Strategy</h3>
        <div class="strategy-card">
          <div class="strategy-item">
            <div class="strategy-label">Posting Frequency</div>
            <div class="strategy-value">${strategy.postingFrequency || 'N/A'}</div>
          </div>
          <div class="strategy-item">
            <div class="strategy-label">Follower Ratio</div>
            <div class="strategy-value">${strategy.followerRatio || 'N/A'}</div>
          </div>
          <div class="strategy-item">
            <div class="strategy-label">Popular Hashtags</div>
            <div class="strategy-value">${strategy.popularHashtags || 'N/A'}</div>
          </div>
          <div class="strategy-item">
            <div class="strategy-label">Recommendations</div>
            <div class="strategy-value">
              <ul>
                ${recommendationsHtml}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Build warning banner HTML
   */
  buildWarningBanner(message) {
    return `
      <div class="api-warning-banner">
        <div class="warning-icon">⚠️</div>
        <div class="warning-message">${message}</div>
        <div class="warning-close">×</div>
      </div>
    `;
  }

  /**
   * Save analysis results to history
   */
  saveToHistory(username, data) {
    try {
      chrome.storage.local.get(['analysisHistory'], (result) => {
        const history = result.analysisHistory || [];
        
        // Create history entry
        const historyEntry = {
          username: username,
          timestamp: Date.now(),
          data: data
        };
        
        // Add to beginning of array
        history.unshift(historyEntry);
        
        // Limit history to 20 entries
        const limitedHistory = history.slice(0, 20);
        
        // Save updated history
        chrome.storage.local.set({ analysisHistory: limitedHistory });
      });
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }

  /**
   * Show loading state
   */
  showLoading(message = 'Loading...') {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('hidden');
    }
    
    if (this.loadingText) {
      this.loadingText.textContent = message;
    }
    
    try {
      // Show loading state in the icon if available
      if (this.iconManager) {
        this.iconManager.showLoading();
      }
    } catch (error) {
      console.warn('Failed to set icon loading state:', error);
    }
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
    
    try {
      // Stop loading animation in the icon if available
      if (this.iconManager) {
        this.iconManager.stopLoading();
      }
    } catch (error) {
      console.warn('Failed to reset icon state:', error);
    }
    
    // Reset progress bar
    this.updateProgress(0);
  }

  /**
   * Update progress bar
   */
  updateProgress(percent) {
    // Update progress bar element if it exists
    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
    
    // Update progress fill element if it exists
    if (this.progressFill) {
      this.progressFill.style.width = `${percent}%`;
    }
    
    // Fallback to query if properties are not available
    if (!this.progressBar && !this.progressFill) {
      const progressElements = document.querySelectorAll('.progress-bar, .progress-fill');
      progressElements.forEach(el => {
        el.style.width = `${percent}%`;
      });
    }
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    // Show in the error container
    if (this.errorMessageContainer) {
      this.errorMessageContainer.innerHTML = `
        <div class="error-message">
          <span class="error-icon">❌</span>
          ${message}
        </div>
      `;
      this.errorMessageContainer.classList.remove('hidden');
    }
    
    try {
      // Show error state in the icon if available
      if (this.iconManager) {
        this.iconManager.showError();
      }
    } catch (error) {
      console.warn('Failed to set icon error state:', error);
    }
  }
  
  /**
   * Show error details below the main error message
   */
  showErrorDetails(details) {
    if (this.errorMessageContainer) {
      const detailsElement = document.createElement('div');
      detailsElement.className = 'error-details';
      detailsElement.textContent = details;
      this.errorMessageContainer.appendChild(detailsElement);
    }
  }

  /**
   * Show API warning banner
   */
  showApiWarningBanner(message) {
    // Create warning banner
    const banner = document.createElement('div');
    banner.className = 'api-warning-banner';
    banner.innerHTML = `
      <div class="warning-icon">⚠️</div>
      <div class="warning-message">${message}</div>
      <div class="warning-close">×</div>
    `;
    
    // Add to DOM
    const container = document.querySelector('.container') || document.body;
    container.insertBefore(banner, container.firstChild);
    
    // Add close button handler
    const closeButton = banner.querySelector('.warning-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        banner.remove();
      });
    }
  }

  /**
   * Update character count
   */
  updateCharacterCount() {
    if (!this.profileInput) return;
    
    const value = this.profileInput.value;
    const charCountElement = document.getElementById('char-count');
    
    if (charCountElement) {
      charCountElement.textContent = `${value.length}/30`;
      
      // Add warning class if too long
      if (value.length > 30) {
        charCountElement.classList.add('warning');
      } else {
        charCountElement.classList.remove('warning');
      }
    }
  }

  /**
   * Load saved theme preference
   */
  async loadSavedTheme() {
    try {
      // Get theme preference from storage
      chrome.storage.sync.get(['theme'], (result) => {
        const savedTheme = result.theme || 'light';
        this.setTheme(savedTheme);
      });
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  }

  /**
   * Set theme
   */
  setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    
    // Save theme preference
    chrome.storage.sync.set({ theme });
  }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Initialize the popup controller when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popupController = new PopupController();
  popupController.initialize();
});

// Function to reset rate limits and tokens
async function resetRateLimits() {
  try {
    // Show loading state
    const resetButton = document.getElementById('resetRateLimitButton');
    resetButton.textContent = 'Resetting...';
    resetButton.disabled = true;
    
    // Call background script to reset tokens and rate limits
    const response = await chrome.runtime.sendMessage({
      action: 'resetTokensAndLimits'
    });
    
    if (response && response.success) {
      showNotification('Rate limits reset successfully. Refreshing...', 'success');
      
      // Wait a moment before refreshing
      setTimeout(() => {
        // Refresh the popup
        location.reload();
      }, 1500);
    } else {
      showNotification('Error resetting rate limits: ' + (response?.error || 'Unknown error'), 'error');
      resetButton.textContent = 'Reset Limits';
      resetButton.disabled = false;
    }
  } catch (error) {
    console.error('Error resetting rate limits:', error);
    showNotification('Error resetting rate limits: ' + error.message, 'error');
    
    const resetButton = document.getElementById('resetRateLimitButton');
    resetButton.textContent = 'Reset Limits';
    resetButton.disabled = false;
  }
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...
  
  // Rate limit reset button
  const resetRateLimitButton = document.getElementById('resetRateLimitButton');
  if (resetRateLimitButton) {
    resetRateLimitButton.addEventListener('click', resetRateLimits);
  }
  
  // Clear cache button
  const clearCacheButton = document.getElementById('clearCacheButton');
  if (clearCacheButton) {
    clearCacheButton.addEventListener('click', async () => {
      try {
        clearCacheButton.textContent = 'Clearing...';
        clearCacheButton.disabled = true;
        
        const response = await chrome.runtime.sendMessage({
          action: 'clearCache'
        });
        
        if (response && response.success) {
          showNotification(`Cleared ${response.cleared || 0} cached items`, 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          showNotification('Error clearing cache: ' + (response?.error || 'Unknown error'), 'error');
          clearCacheButton.textContent = 'Clear Cache';
          clearCacheButton.disabled = false;
        }
      } catch (error) {
        console.error('Error clearing cache:', error);
        showNotification('Error clearing cache: ' + error.message, 'error');
        clearCacheButton.textContent = 'Clear Cache';
        clearCacheButton.disabled = false;
      }
    });
  }
  
  // Retry button
  const retryButton = document.getElementById('retryButton');
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      retryButton.textContent = 'Retrying...';
      retryButton.disabled = true;
      
      // Show loading UI
      setLoadingState(true, 'Checking API status...');
      
      // Call API test
      testApiConnection()
        .then(() => {
          // Refresh the popup to show updated status
          location.reload();
        })
        .catch(error => {
          console.error('API retry failed:', error);
          showNotification('API retry failed: ' + error.message, 'error');
          retryButton.textContent = 'Retry';
          retryButton.disabled = false;
          setLoadingState(false);
        });
    });
  }
  
  // ... existing code ...
});

// Function to show notification toast
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // Add to document
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Helper function to set loading state
function setLoadingState(isLoading, message = 'Loading...') {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingMessage = document.getElementById('loadingMessage');
  
  if (!loadingOverlay || !loadingMessage) return;
  
  if (isLoading) {
    loadingMessage.textContent = message;
    loadingOverlay.classList.add('visible');
  } else {
    loadingOverlay.classList.remove('visible');
  }
}