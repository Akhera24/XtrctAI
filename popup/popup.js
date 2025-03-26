// Enhanced popup.js - Main controller for X Profile Analyzer Chrome Extension
// Handles user interactions, API connections, and UI rendering

import { IconManager } from './utils/iconManager.js';
import { AnalyticsService } from './services/analyticsService.js';
import { UIManager } from './utils/uiManager.js';
import { ProfileFormatter } from './utils/profileFormatter.js';

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
  }
  
  /**
   * Cache DOM elements for better performance and reliability
   */
  cacheDomElements() {
    this.domElements = {};
    
    // Define the elements to cache with a fallback mechanism
    const elementsToCatch = [
      { key: 'profileInput', selector: '#profile-input' },
      { key: 'clearInput', selector: '#clear-input' },
      { key: 'analyzeButton', selector: '#analyze-button' },
      { key: 'resultsContainer', selector: '.results-container' },
      { key: 'loadingOverlay', selector: '.loading-overlay' },
      { key: 'rateLimitBar', selector: '#rate-limit-bar' },
      { key: 'rateLimitCount', selector: '#rate-limit-count' },
      { key: 'retryButton', selector: '#retry-button' },
      { key: 'clearCacheButton', selector: '#clear-cache-button' },
      { key: 'postInput', selector: '.post-input' },
      { key: 'characterCounter', selector: '.character-counter' },
      { key: 'postNowButton', selector: '.post-now-button' },
      { key: 'generatePostButton', selector: '#generate-post-btn' }
    ];
    
    // Try to find all elements
    elementsToCatch.forEach(({ key, selector }) => {
      try {
        const element = document.querySelector(selector);
        this.domElements[key] = element;
        console.log(`DOM element '${key}' ${element ? 'found' : 'NOT found'} using selector: ${selector}`);
      } catch (error) {
        console.error(`Error finding element '${key}' with selector '${selector}':`, error);
        this.domElements[key] = null;
      }
    });
    
    // Special handling for tab buttons (array of elements)
    try {
      this.domElements.tabButtons = document.querySelectorAll('.tab-button');
      console.log(`Found ${this.domElements.tabButtons.length} tab buttons`);
    } catch (error) {
      console.error('Error finding tab buttons:', error);
      this.domElements.tabButtons = [];
    }
  }

  /**
   * Initialize the popup controller
   */
  async initialize() {
    try {
      console.log('Initializing X Profile Analyzer popup...');
      
      // Load saved theme
      await this.loadSavedTheme();
      
      // Initialize event listeners
      this.initializeEventListeners();
      
      // Check API connection status
      await this.checkConnectionStatus();
      
      // Load rate limit info
      await this.updateRateLimitDisplay();
      
      // Load analysis history
      await this.loadAnalysisHistory();
      
      // Show appropriate initial UI state
      this.showInitialState();
      
      console.log('Popup initialization complete');
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.uiManager.showToast('Failed to initialize extension. Please try again.', 'error');
    }
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
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      console.log('Theme toggle button found, adding event listener');
      themeToggle.addEventListener('click', () => this.toggleTheme());
    } else {
      console.warn('Theme toggle button not found in DOM');
    }
    
    // Profile input
    if (this.domElements.profileInput) {
      console.log('Profile input found, adding event listeners');
      this.domElements.profileInput.addEventListener('input', (e) => this.handleProfileInputChange(e));
      this.domElements.profileInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !this.isAnalyzing) {
          console.log('Enter key pressed in profile input, triggering analyze');
          this.handleAnalyzeClick();
        }
      });
    } else {
      console.warn('Profile input not found in DOM');
    }
    
    // Clear input button
    if (this.domElements.clearInput) {
      console.log('Clear input button found, adding event listener');
      this.domElements.clearInput.addEventListener('click', () => {
        if (this.domElements.profileInput) {
          this.domElements.profileInput.value = '';
          this.domElements.clearInput.classList.add('hidden');
          this.domElements.analyzeButton.setAttribute('disabled', 'disabled');
        }
      });
    } else {
      console.warn('Clear input button not found in DOM');
    }
    
    // Analyze button
    console.log('Looking for analyze button with id:', 'analyze-button');
    const analyzeButton = document.getElementById('analyze-button');
    console.log('Direct DOM query for analyze button:', analyzeButton);
    
    if (this.domElements.analyzeButton) {
      console.log('Analyze button found in domElements, adding event listener');
      this.domElements.analyzeButton.addEventListener('click', () => {
        console.log('Analyze button clicked via domElements reference');
        this.handleAnalyzeClick();
      });
    } else if (analyzeButton) {
      console.log('Analyze button found via direct DOM query, adding event listener');
      analyzeButton.addEventListener('click', () => {
        console.log('Analyze button clicked via direct DOM query');
        this.handleAnalyzeClick();
      });
      this.domElements.analyzeButton = analyzeButton; // Update reference
    } else {
      console.error('Analyze button not found in DOM');
      // Attempt to find by other selectors
      const possibleButtons = Array.from(document.querySelectorAll('button'));
      console.log('All buttons in DOM:', possibleButtons.map(b => ({
        id: b.id,
        classes: b.className,
        text: b.textContent.trim()
      })));
    }
    
    // Debug - log all buttons and their IDs
    console.log('Button elements:', {
      analyzeButton: document.getElementById('analyze-button'),
      allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
        id: b.id,
        classes: b.className,
        text: b.textContent.trim()
      }))
    });
    
    // Retry button
    if (this.domElements.retryButton) {
      console.log('Retry button found, adding event listener');
      this.domElements.retryButton.addEventListener('click', () => this.handleRetryClick());
    } else {
      console.warn('Retry button not found in DOM');
    }
    
    // Clear cache button
    if (this.domElements.clearCacheButton) {
      console.log('Clear cache button found, adding event listener');
      this.domElements.clearCacheButton.addEventListener('click', () => this.handleClearCacheClick());
    } else {
      console.warn('Clear cache button not found in DOM');
    }
    
    // Tab buttons
    if (this.domElements.tabButtons && this.domElements.tabButtons.length) {
      console.log('Tab buttons found, adding event listeners');
      this.domElements.tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          const tabId = e.currentTarget.dataset.tab;
          if (tabId) {
            this.switchTab(tabId);
          }
        });
      });
    } else {
      console.warn('Tab buttons not found in DOM');
    }
    
    // Post input character counter
    if (this.domElements.postInput && this.domElements.characterCounter) {
      console.log('Post input and character counter found, adding event listener');
      this.domElements.postInput.addEventListener('input', () => this.updateCharacterCount());
    } else {
      console.warn('Post input or character counter not found in DOM');
    }
    
    // Post Now button
    if (this.domElements.postNowButton) {
      console.log('Post Now button found, adding event listener');
      this.domElements.postNowButton.addEventListener('click', () => this.handlePostNow());
    } else {
      console.warn('Post Now button not found in DOM');
    }
    
    // Generate Post button
    if (this.domElements.generatePostButton) {
      console.log('Generate Post button found, adding event listener');
      this.domElements.generatePostButton.addEventListener('click', () => this.handleGeneratePost());
    } else {
      console.warn('Generate Post button not found in DOM');
    }
    
    console.log('Event listeners initialization complete');
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
    console.log('===== ANALYZE BUTTON CLICKED =====');
    
    if (this.isAnalyzing) {
      console.log('Analysis already in progress, ignoring click');
      this.uiManager.showToast('Analysis already in progress', 'info');
      return;
    }
  
    const profileInput = this.domElements.profileInput;
    console.log('Profile input element:', profileInput);
    console.log('Profile input value:', profileInput?.value);
    
    if (!profileInput || !profileInput.value.trim()) {
      console.log('Empty profile input, showing error');
      this.uiManager.showToast('Please enter a profile handle or URL', 'error');
      this.iconManager.addShakeAnimation(profileInput);
      return;
    }
    
    try {
      this.isAnalyzing = true;
      console.log('Setting isAnalyzing to true');
      
      // Log the analysis attempt
      console.log('Starting analysis for:', profileInput.value);
      
      // Update UI to show loading state
      console.log('Updating UI to show loading state');
      this.setAnalyzeButtonLoadingState(true);
      this.uiManager.showLoading('Starting analysis...');
      
      // Validate input
      const username = this.extractUsername(profileInput.value);
      console.log('Extracted username:', username);
      
      if (!username) {
        console.error('Invalid profile format');
        throw new Error('Invalid profile format. Please use @handle or full profile URL.');
      }
      
      // Show progressive loading animation
      console.log('Starting progressive loading animation');
      const loadingPromise = this.showProgressiveLoading();
      
      // Request analysis from background script with timeout
      console.log('Sending analysis request to background script for:', username);
      const analysisPromise = this.requestProfileAnalysis(username);
      
      // Set a timeout for the request
      console.log('Setting up request timeout');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error('Analysis request timed out');
          reject(new Error('Analysis request timed out. Please try again.'));
        }, 20000);
      });
      
      // Wait for loading animation to start
      console.log('Waiting for loading animation to start');
      await loadingPromise;
      
      // Wait for the first promise to resolve (either analysis or timeout)
      console.log('Waiting for analysis response or timeout');
      const response = await Promise.race([analysisPromise, timeoutPromise]);
      
      console.log('Analysis response received:', response);
      
      if (response.success) {
        console.log('Analysis successful');
        // Save current profile data
        this.currentProfile = response.data;
        
        // Update UI with results
        console.log('Updating UI with results');
        this.updateResultsDisplay(response.data);
        
        // Update rate limit display
        console.log('Updating rate limit display');
        this.updateRateLimitDisplay(response.rateLimit);
        
        // Save to history
        console.log('Saving to history');
        this.saveToHistory(username);
        
        // Show success message with info if it's mock data
        if (response.data.isMockData) {
          console.log('Using mock data');
          this.uiManager.showToast('Using sample data for demonstration', 'warning');
        } else {
          console.log('Using real data, from cache:', response.fromCache);
          this.uiManager.showToast(response.fromCache ? 
            'Analysis loaded from cache' : 
            'Analysis completed successfully!', 'success');
        }
      } else {
        console.error('Analysis failed:', response.error);
        throw new Error(response.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      this.uiManager.showError(error.message);
      
      // Enable retry button
      if (this.domElements.retryButton) {
        console.log('Enabling retry button');
        this.domElements.retryButton.disabled = false;
      }
    } finally {
      // Reset UI state
      console.log('Resetting UI state');
      this.isAnalyzing = false;
      this.setAnalyzeButtonLoadingState(false);
      this.uiManager.hideLoading();
      console.log('===== ANALYZE PROCESS COMPLETE =====');
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
    const postInput = this.domElements.postInput;
    const characterCounter = this.domElements.characterCounter;
    
    if (postInput && characterCounter) {
      const maxLength = 280;
      const currentLength = postInput.value.length;
      
      // Update counter
      characterCounter.textContent = `${currentLength}/${maxLength}`;
      
      // Add warning class if over limit
      if (currentLength > maxLength) {
        characterCounter.classList.add('warning');
      } else {
        characterCounter.classList.remove('warning');
      }
    }
  }
  
  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    console.log(`Switching to tab: ${tabName}`);
    
    // Get tab elements
    const allTabButtons = document.querySelectorAll('.tab-button');
    const allTabContents = document.querySelectorAll('.tab-content');
    const selectedTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    const selectedTabContent = document.getElementById(`${tabName}-tab`);
    
    // Check if elements exist
    if (!selectedTabButton || !selectedTabContent) {
      console.error(`Tab elements for "${tabName}" not found`);
      return;
    }
    
    // Remove active class from all tabs
    allTabButtons.forEach(btn => btn.classList.remove('active'));
    allTabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab
    selectedTabButton.classList.add('active');
    selectedTabContent.classList.add('active');
    
    // Ensure the tab content is visible
    selectedTabContent.style.display = 'block';
    
    // Add animation class for smooth transition
    selectedTabContent.classList.add('slide-in');
    setTimeout(() => {
      selectedTabContent.classList.remove('slide-in');
    }, 300);
    
    // Save the current tab to local storage for persistence
    try {
      localStorage.setItem('currentTab', tabName);
    } catch (e) {
      console.warn('Could not save current tab to local storage:', e);
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
    
    // Add pulse animation to home button
    const homeButton = document.querySelector('.home-button');
    if (homeButton) {
      homeButton.classList.add('pulse');
      setTimeout(() => homeButton.classList.remove('pulse'), 500);
    }
    
    // Show toast
    this.uiManager.showToast('View refreshed', 'success');
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
    console.log('requestProfileAnalysis called for:', username);
    
    return new Promise((resolve, reject) => {
      console.log('Sending message to background script with action: analyzeProfile');
      
      chrome.runtime.sendMessage(
        { action: 'analyzeProfile', username },
        (response) => {
          console.log('Background script response received:', response);
          
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            console.error('Chrome runtime error:', error);
            reject(new Error(error.message || 'Failed to communicate with background script'));
          } else if (!response) {
            console.error('No response received from background script');
            reject(new Error('No response received from background script'));
          } else {
            console.log('Analysis response processed successfully');
            resolve(response);
          }
        }
      );
      
      console.log('Message sent to background script, waiting for callback');
    });
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
   * Update the results display with profile data
   */
  updateResultsDisplay(data) {
    if (!this.domElements.resultsContainer) {
      console.error('Results container not found');
      return;
    }
    
    // Show the container
    this.domElements.resultsContainer.style.display = 'block';
    
    const userData = data.user;
    const analytics = data.analytics;
    
    // Format and render results
    this.domElements.resultsContainer.innerHTML = ProfileFormatter.formatProfileResults(userData, analytics, data.strategy);
    
    // Add Grok AI analysis if available
    if (data.grokAnalysis) {
      this.domElements.resultsContainer.innerHTML += ProfileFormatter.formatGrokAnalysis(data.grokAnalysis, data.tokenUsage);
    }
    
    // Add event listeners to action buttons
    const shareButton = this.domElements.resultsContainer.querySelector('.share-results');
    if (shareButton) {
      shareButton.addEventListener('click', this.handleShareClick.bind(this));
    }
    
    const downloadButton = this.domElements.resultsContainer.querySelector('.download-report');
    if (downloadButton) {
      downloadButton.addEventListener('click', () => {
        this.uiManager.showToast('Report downloading functionality coming soon', 'info');
      });
    }
    
    // Add animations to make results appear with a nice effect
    const cards = this.domElements.resultsContainer.querySelectorAll('.metric-card');
    cards.forEach((card, index) => {
      card.style.animationDelay = `${index * 100}ms`;
      card.classList.add('fade-in');
    });
  }
  
  /**
   * Save analyzed profile to history
   */
  saveToHistory(username) {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      let history = result.analysisHistory || [];
      
      // Check if username already exists
      const existingIndex = history.findIndex(item => item.username === username);
      
      if (existingIndex !== -1) {
        // Move to top if exists
        const existing = history.splice(existingIndex, 1)[0];
        existing.timestamp = Date.now();
        history.unshift(existing);
      } else {
        // Add new entry
        history.unshift({
          username: username,
          timestamp: Date.now()
        });
      }
      
      // Limit history to 20 entries
      history = history.slice(0, 20);
      
      chrome.storage.local.set({ analysisHistory: history });
      
      // Update history display if we're on that tab
      if (document.querySelector('.tab-button[data-tab="history"]')?.classList.contains('active')) {
        this.loadAnalysisHistory();
      }
    });
  }
  
  /**
   * Load analysis history from storage
   */
  async loadAnalysisHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['analysisHistory'], (result) => {
        const history = result.analysisHistory || [];
        const historyContainer = document.getElementById('historyItemsContainer');
        
        if (!historyContainer) {
          resolve();
          return;
        }
        
        if (history.length === 0) {
          historyContainer.innerHTML = `
            <div class="empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24">
                <path d="M19.5 7h-15C3.12 7 2 8.12 2 9.5v10C2 20.88 3.12 22 4.5 22h15c1.38 0 2.5-1.12 2.5-2.5v-10C22 8.12 20.88 7 19.5 7zM4.5 9h15c.28 0 .5.22.5.5v1.5H4v-1.5c0-.28.22-.5.5-.5zm15 11h-15c-.28 0-.5-.22-.5-.5v-6.5h16v6.5c0 .28-.22.5-.5.5z" fill="currentColor"></path>
                <path d="M7 5C7 3.9 7.9 3 9 3h6c1.1 0 2 .9 2 2v2H7V5z" fill="currentColor"></path>
              </svg>
              <h3>No History</h3>
              <p>Analyzed profiles will appear here</p>
          </div>
          `;
          resolve();
          return;
        }
        
        historyContainer.innerHTML = history.map((item, index) => `
          <div class="history-item" style="animation-delay: ${index * 50}ms">
            <div class="history-avatar">
              <div class="avatar-placeholder">${item.username.charAt(0).toUpperCase()}</div>
            </div>
            <div class="history-profile">
              <div class="history-username">@${item.username}</div>
              <div class="history-date">${this.formatRelativeTime(item.timestamp)}</div>
            </div>
            <div class="history-actions-menu">
              <button class="history-action-btn analyze-again" data-username="${item.username}" title="Analyze again">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path>
                </svg>
              </button>
              <button class="history-action-btn remove" data-username="${item.username}" title="Remove from history">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
                </svg>
              </button>
            </div>
          </div>
        `).join('');
        
        // Add animation class to history items
        const historyItems = historyContainer.querySelectorAll('.history-item');
        historyItems.forEach(item => {
          item.classList.add('fade-in');
        });
        
        // Add event listeners to history action buttons
        historyContainer.querySelectorAll('.analyze-again').forEach(button => {
          button.addEventListener('click', (e) => {
            const username = e.currentTarget.dataset.username;
            if (username) {
              // Switch to analyze tab
              this.switchTab('analyze');
              
              // Set input value
              if (this.domElements.profileInput) {
                this.domElements.profileInput.value = username;
                this.handleProfileInputChange({ target: this.domElements.profileInput });
              }
              
              // Trigger analysis
              setTimeout(() => this.handleAnalyzeClick(), 300);
            }
          });
        });
        
        historyContainer.querySelectorAll('.remove').forEach(button => {
          button.addEventListener('click', (e) => {
            const username = e.currentTarget.dataset.username;
            if (username) {
              this.removeFromHistory(username, e.currentTarget.closest('.history-item'));
            }
          });
        });
        
        resolve();
      });
    });
  }
  
  /**
   * Remove an item from analysis history
   */
  removeFromHistory(username, historyItem) {
    // Add removing animation
    if (historyItem) {
      historyItem.classList.add('removing');
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        if (historyItem.parentNode) {
          historyItem.parentNode.removeChild(historyItem);
        }
      }, 300);
    }
    
    // Update storage
    chrome.storage.local.get(['analysisHistory'], (result) => {
      let history = result.analysisHistory || [];
      history = history.filter(item => item.username !== username);
      
      chrome.storage.local.set({ analysisHistory: history }, () => {
        // If history is now empty, show empty state
        if (history.length === 0) {
          const historyContainer = document.getElementById('historyItemsContainer');
          if (historyContainer) {
            setTimeout(() => {
              historyContainer.innerHTML = `
                <div class="empty-state">
                  <svg class="empty-icon" viewBox="0 0 24 24">
                    <path d="M19.5 7h-15C3.12 7 2 8.12 2 9.5v10C2 20.88 3.12 22 4.5 22h15c1.38 0 2.5-1.12 2.5-2.5v-10C22 8.12 20.88 7 19.5 7zM4.5 9h15c.28 0 .5.22.5.5v1.5H4v-1.5c0-.28.22-.5.5-.5zm15 11h-15c-.28 0-.5-.22-.5-.5v-6.5h16v6.5c0 .28-.22.5-.5.5z" fill="currentColor"></path>
                    <path d="M7 5C7 3.9 7.9 3 9 3h6c1.1 0 2 .9 2 2v2H7V5z" fill="currentColor"></path>
                  </svg>
                  <h3>No History</h3>
                  <p>Analyzed profiles will appear here</p>
        </div>
      `;
            }, 300);
          }
        }
      });
    });
    
    this.uiManager.showToast('Removed from history', 'success');
  }
  
  /**
   * Format relative timestamp (e.g., "2h ago")
   */
  formatRelativeTime(timestamp) {
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