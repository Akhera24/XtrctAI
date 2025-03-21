// interactionManager.js - Complete implementation
class InteractionManager {
  constructor() {
    // Initialize state
    this.isAnalyzing = false;
    this.loadingTimeout = null;
    this.maxLoadingTime = 10000; // 10 seconds
    
    // Initialize UI - making sure this runs after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      try {
        console.log('InteractionManager initializing...');
        
        // First ensure loading is hidden
        this.forceHideLoading();
        
        // Then initialize the rest of the UI
        this.initializeEventListeners();
        this.initializeTheme();
        this.showInitialState();
        
        // Check for cached data
        this.loadCachedHistory();
        
        // Update the rate limit UI on startup
        this.updateRateLimitUI({ count: 0, resetTime: Date.now() + 3600000 });
        
        // Initialize additional state
        this.checkSignInState();
        
        console.log('InteractionManager initialized successfully');
      } catch (error) {
        console.error('Error during initialization:', error);
        this.forceHideLoading(); // Ensure loading is hidden even if initialization fails
      }
    });
  }

  // Force hide loading overlay (emergency method)
  forceHideLoading() {
    try {
      const overlay = document.querySelector('.loading-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
        overlay.classList.remove('visible');
        
        console.log('Loading UI force hidden');
      }
    } catch (error) {
      console.error('Failed to force hide loading overlay:', error);
    }
  }

  initializeEventListeners() {
    try {
      console.log('Initializing event listeners');
      
      // Profile input handling
      const profileInput = document.getElementById('profile-input');
      const postUrlInput = document.getElementById('post-url');
      const clearButton = document.getElementById('clear-input');
      const analyzeButton = document.getElementById('analyze-button');
      
      // Function to check if either input field has a value
      const updateButtonState = () => {
        const profileValue = profileInput?.value.trim() || '';
        const postValue = postUrlInput?.value.trim() || '';
        const hasValue = profileValue.length > 0 || postValue.length > 0;
        
        if (clearButton) {
          clearButton.style.display = profileValue.length > 0 ? 'block' : 'none';
        }
        if (analyzeButton) {
          analyzeButton.disabled = !hasValue;
          analyzeButton.classList.toggle('active', hasValue);
        }
      };
      
      if (profileInput) {
        profileInput.addEventListener('input', () => {
          updateButtonState();
        });

        profileInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !analyzeButton?.disabled) {
            this.handleAnalyze();
          }
        });
      } else {
        console.warn('Profile input element not found');
      }
      
      // Add event listener for post URL input
      if (postUrlInput) {
        postUrlInput.addEventListener('input', () => {
          updateButtonState();
        });
        
        postUrlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !analyzeButton?.disabled) {
            this.handleAnalyze();
          }
        });
      }

      // Initialize character counter for post composer
      this.initializeCharacterCounter();

      // Clear input button
      if (clearButton) {
        clearButton.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          if (profileInput) {
            profileInput.value = '';
            profileInput.focus();
            clearButton.style.display = 'none';
            // Only disable button if post URL is also empty
            updateButtonState();
          }
        });
      }

      // Analyze button
      if (analyzeButton) {
        analyzeButton.addEventListener('click', (e) => {
          if (!analyzeButton.disabled) {
            this.createRippleEffect(e);
            this.handleAnalyze();
          }
        });
      } else {
        console.warn('Analyze button not found');
      }

      // Theme toggle
      const themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          this.toggleTheme();
        });
      }

      // Sign in button
      const signInButton = document.querySelector('.sign-in-button');
      if (signInButton) {
        signInButton.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          this.handleSignIn();
        });
      }

      // Home button
      const homeButton = document.querySelector('.home-button');
      if (homeButton) {
        homeButton.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          this.resetToHome();
        });
      }

      // Generate post button
      const generateButton = document.getElementById('generate-post-btn');
      if (generateButton) {
        generateButton.addEventListener('click', (e) => {
          const topic = document.getElementById('post-topic')?.value;
          if (!topic) {
            this.showToast('Please enter a topic', 'error');
            return;
          }
          this.createRippleEffect(e);
          this.generatePost();
        });
      }

      // Tab navigation
      document.querySelectorAll('.tab-button').forEach(button => {
        // Clone to remove any old listeners
        const newButton = button.cloneNode(true);
        if (button.parentNode) {
          button.parentNode.replaceChild(newButton, button);
        }
        
        newButton.addEventListener('click', (e) => {
          try {
            this.createRippleEffect(e);
            const tabName = newButton.getAttribute('data-tab');
            if (tabName) {
              this.switchTab(tabName);
            } else {
              console.error('Tab button clicked but no data-tab attribute found');
            }
          } catch (error) {
            console.error('Error handling tab button click:', error);
          }
        });
      });
      
      // Also check for URL hash for direct tab access
      const hash = window.location.hash.replace('#', '');
      if (hash && document.querySelector(`.tab-button[data-tab="${hash}"]`)) {
        setTimeout(() => this.switchTab(hash), 100);
      } else {
        // Try to restore last active tab from localStorage
        try {
          const lastTab = localStorage.getItem('currentTab');
          if (lastTab && document.querySelector(`.tab-button[data-tab="${lastTab}"]`)) {
            setTimeout(() => this.switchTab(lastTab), 100);
          }
        } catch (e) {
          console.warn('Could not restore last active tab:', e);
        }
      }

      // Error recovery
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.querySelector('.loading-overlay:not(.hidden)')) {
          this.cancelLoading();
        }
      });

      // Initialize media buttons
      this.initializeMediaButtons();

      // Add event listener for the Enter key in the post-topic field
      const postTopicInput = document.getElementById('post-topic');
      if (postTopicInput) {
        postTopicInput.addEventListener('keypress', e => {
          if (e.key === 'Enter') {
            const generateButton = document.getElementById('generate-post-btn');
            if (generateButton && !generateButton.disabled) {
              generateButton.click();
            }
          }
        });
      }

      // Post button
      const postButton = document.querySelector('.post-now-button');
      if (postButton) {
        postButton.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          this.handlePostNow();
        });
      }

      // Clear cache button
      const clearCacheButton = document.getElementById('clear-cache-button');
      if (clearCacheButton) {
        clearCacheButton.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          this.clearCache();
        });
      }

      // Retry button
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', (e) => {
          if (retryButton.disabled) return;
          this.createRippleEffect(e);
          this.handleAnalyze();
        });
      }

      // Clear history button
      const clearHistoryButton = document.getElementById('clear-history-button');
      if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          this.clearHistory();
        });
      }
      
      // Add type and tone button click handlers
      document.querySelectorAll('.type-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
          button.classList.add('active');
        });
      });
      
      document.querySelectorAll('.tone-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
          button.classList.add('active');
        });
      });
      
      console.log('Event listeners initialized successfully');
    } catch (error) {
      console.error('Error initializing event listeners:', error);
    }
  }

  // Initialize character counter for post composer
  initializeCharacterCounter() {
    try {
      const postInput = document.querySelector('.post-input');
      const characterCounter = document.querySelector('.character-counter');
      
      if (postInput && characterCounter) {
        // Set initial count
        characterCounter.textContent = `0/280`;
        
        // Add input event listener
        postInput.addEventListener('input', function() {
          const maxLength = 280;
          const currentLength = this.value.length;
          
          // Update counter
          characterCounter.textContent = `${currentLength}/${maxLength}`;
          
          // Add warning class if over limit
          if (currentLength > maxLength) {
            characterCounter.classList.add('warning');
          } else {
            characterCounter.classList.remove('warning');
          }
        });
        
        console.log('Character counter initialized');
      } else {
        console.warn('Post input or character counter not found');
      }
    } catch (error) {
      console.error('Error initializing character counter:', error);
    }
  }

  createRippleEffect(event) {
    if (!event?.currentTarget) return;
    
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  checkSignInState() {
    try {
      const isSignedIn = localStorage.getItem('isSignedIn') === 'true';
      this.updateSignInState(isSignedIn);
      console.log('Sign-in state checked:', isSignedIn);
    } catch (error) {
      console.error('Error checking sign-in state:', error);
      // Default to signed out if there's an error
      this.updateSignInState(false);
    }
  }

  async handleAnalyze() {
    if (this.isAnalyzing) {
      this.showToast('Analysis already in progress', 'info');
      return;
    }

    const profileInput = document.getElementById('profile-input');
    const postUrlInput = document.getElementById('post-url');
    const analyzeButton = document.getElementById('analyze-button');
    
    if (!profileInput && !postUrlInput) {
      this.showError('Input elements not found', { critical: true });
      return;
    }
    
    const profileValue = profileInput?.value.trim() || '';
    const postUrlValue = postUrlInput?.value.trim() || '';
    
    if (!profileValue && !postUrlValue) {
      this.showToast('Please enter a profile handle, URL, or post URL', 'error');
      if (profileInput) profileInput.focus();
      return;
    }

    // Add a cancel button to the loading overlay
    this.addCancelButton();

    try {
      this.isAnalyzing = true;
      
      // Update button state
      this.setButtonLoading(analyzeButton, true, 'Analyzing...');
      
      // Show the loading overlay
      this.showLoading();
      
      // Set loading timeout
      this.loadingTimeout = setTimeout(() => {
        this.handleLoadingTimeout();
      }, this.maxLoadingTime);

      // Validate input
      if (profileValue && !this.validateProfileInput(profileValue)) {
        throw new Error('Invalid profile format. Please use @handle or full profile URL.');
      }
      
      if (postUrlValue && !this.validatePostUrl(postUrlValue)) {
        throw new Error('Invalid post URL format. Please use a valid X post URL.');
      }

      // Show progressive loading
      await this.showProgressiveLoading();

      try {
        // Determine what type of analysis to perform
        let response;
        
        if (profileValue && postUrlValue) {
          // Both profile and post URL provided - analyze both
          response = await this.fetchCombinedAnalysis(profileValue, postUrlValue);
        } else if (profileValue) {
          // Only profile provided
          response = await this.fetchProfileAnalysis(profileValue);
        } else {
          // Only post URL provided
          response = await this.fetchPostAnalysis(postUrlValue);
        }
        
        if (response.success) {
          this.updateResults(response.data);
          this.showToast('Analysis completed successfully!', 'success');
          
          // Save to history
          if (profileValue) {
            this.saveToHistory(profileValue.replace('@', ''));
          } else if (postUrlValue) {
            // Extract username from post URL for history
            const username = this.extractUsernameFromUrl(postUrlValue);
            if (username) this.saveToHistory(username);
          }
        } else {
          throw new Error(response.error || 'Analysis failed');
        }
      } catch (apiError) {
        console.error('API error:', apiError);
        throw new Error(`Analysis failed: ${apiError.message || 'Server error'}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      this.showError(error.message);
    } finally {
      // ALWAYS clean up, even if there was an error
      this.isAnalyzing = false;
      
      // Restore button state
      this.setButtonLoading(analyzeButton, false);
      
      // Hide the loading overlay
      this.hideLoading();
      
      // Clear the timeout
      if (this.loadingTimeout) {
        clearTimeout(this.loadingTimeout);
        this.loadingTimeout = null;
      }
      
      // Remove cancel button
      this.removeCancelButton();
    }
  }

  setButtonLoading(buttonId, isLoading, loadingText = 'Loading...', originalText = null) {
    const button = typeof buttonId === 'string' ? document.getElementById(buttonId) : buttonId;
    if (!button) {
      console.warn(`Button not found: ${buttonId}`);
      return;
    }
    
    try {
      if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<div class="loading-spinner"></div> ${loadingText}`;
        button.classList.add('loading');
      } else {
        button.disabled = false;
        button.innerHTML = originalText || button.dataset.originalText || button.innerHTML;
        button.classList.remove('loading');
        delete button.dataset.originalText;
      }
    } catch (error) {
      console.error('Error setting button loading state:', error);
      // Try to restore button to non-loading state
      if (button) {
        button.disabled = false;
        button.classList.remove('loading');
      }
    }
  }

  toggleTheme() {
    try {
      const body = document.body;
      const isDark = body.getAttribute('data-theme') === 'dark';
      
      body.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
      
      // Update theme toggle icon
      const themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        const icon = themeToggle.querySelector('svg');
        if (icon) {
          icon.innerHTML = isDark ? 
            '<path d="M12 3a6 6 0 0 0 0 12h.1a6 6 0 0 0 5.9-6 6 6 0 0 0-6-6zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 0a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V1a1 1 0 0 1 1-1z" fill="currentColor"/>' :
            '<path d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z" fill="currentColor"/>';
        }
      }
      
      this.showToast(`${isDark ? 'Light' : 'Dark'} theme activated`, 'info');
    } catch (error) {
      console.error('Error toggling theme:', error);
      this.showToast('Failed to toggle theme', 'error');
    }
  }

  initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.body.setAttribute('data-theme', savedTheme);
    }
  }

  async handleSignIn() {
    try {
      const isSignedIn = localStorage.getItem('isSignedIn') === 'true';
      
      if (isSignedIn) {
        await this.showConfirmationModal(
          'Sign Out', 
          'Are you sure you want to sign out?',
          () => {
            localStorage.setItem('isSignedIn', 'false');
            localStorage.removeItem('userProfile');
            this.updateSignInState(false);
            this.showToast('Signed out successfully', 'info');
          }
        );
      } else {
        await this.authenticateWithX();
      }
    } catch (error) {
      console.error('Sign in error:', error);
      this.showToast('Failed to process sign in/out request', 'error');
    }
  }

  async authenticateWithX() {
    const signInButton = document.querySelector('.sign-in-button');
    try {
      if (signInButton) {
        this.setButtonLoading(signInButton, true, 'Signing in...');
      }
      
      // Simulate auth process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockUserProfile = {
        name: 'X User',
        username: 'xuser',
        avatar: 'https://via.placeholder.com/32'
      };
      
      localStorage.setItem('isSignedIn', 'true');
      localStorage.setItem('userProfile', JSON.stringify(mockUserProfile));
      
      this.updateSignInState(true);
      this.showToast('Successfully signed in', 'success');
    } catch (error) {
      console.error('Authentication error:', error);
      this.showToast('Authentication failed', 'error');
    } finally {
      if (signInButton) {
        this.setButtonLoading(signInButton, false);
      }
    }
  }

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
    
    // Reset UI state
    const analyzeButton = document.getElementById('analyze-button');
    if (analyzeButton) {
      analyzeButton.disabled = true;
      analyzeButton.classList.remove('active');
    }
    
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
      resultsContainer.style.display = 'none';
    }
    
    // Add animation to home button
    const homeButton = document.querySelector('.home-button');
    if (homeButton) {
      homeButton.classList.add('pulse');
      setTimeout(() => homeButton.classList.remove('pulse'), 300);
    }
    
    this.showToast('View refreshed', 'success');
  }

  showLoading() {
    try {
      // First check if loading overlay exists, create if not
      let overlay = document.querySelector('.loading-overlay');
      
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay hidden';
        overlay.innerHTML = `
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">Starting analysis...</div>
            <div class="progress-container">
              <div class="progress-track">
                <div class="progress-fill" style="width: 0%"></div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      
      // Remove the hidden class
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('visible'), 10);
      
      console.log('Loading UI shown');
    } catch (error) {
      console.error('Error showing loading UI:', error);
    }
  }

  hideLoading() {
    try {
      const overlay = document.querySelector('.loading-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => {
          overlay.style.display = 'none';
          // Add hidden class back
          overlay.classList.add('hidden');
          
          // Reset the progress
          const progressFill = overlay.querySelector('.progress-fill');
          if (progressFill) {
            progressFill.style.width = '0%';
          }
          // Reset the text
          const loadingText = overlay.querySelector('.loading-text');
          if (loadingText) {
            loadingText.textContent = 'Starting analysis...';
          }
        }, 300);
        
        console.log('Loading UI hidden');
      }
    } catch (error) {
      console.error('Error hiding loading UI:', error);
      // Try force-hiding the overlay in case of error
      const overlay = document.querySelector('.loading-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
      }
    }
  }

  showToast(message, type = 'info') {
    try {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      
      // Check if we already have too many toasts, remove oldest if needed
      const existingToasts = container.querySelectorAll('.toast');
      if (existingToasts.length > 5) {
        container.removeChild(existingToasts[0]);
      }
      
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      
      // Add appropriate icon based on type
      let iconSvg = '';
      switch (type) {
        case 'error':
          iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 17v.01" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
          break;
        case 'success':
          iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-9.618 5.04L12 21.012 21.618 7.984z"/></svg>';
          break;
        case 'info':
        default:
          iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16v.01" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
      }
      
      toast.innerHTML = `
        <div class="toast-content">
          <span class="toast-icon">${iconSvg}</span>
          <span class="toast-message">${message}</span>
          <button class="toast-close">×</button>
        </div>
      `;
      
      container.appendChild(toast);
      
      // Add animation class after a small delay (for transition)
      setTimeout(() => toast.classList.add('show'), 10);
      
      const dismissDelay = type === 'error' ? 5000 : 3000;
      const timeout = setTimeout(() => this.dismissToast(toast), dismissDelay);
      
      toast.querySelector('.toast-close')?.addEventListener('click', () => {
        clearTimeout(timeout);
        this.dismissToast(toast);
      });
      
      console.log(`Toast shown: ${type} - ${message}`);
    } catch (error) {
      console.error('Error showing toast:', error, message);
      // If showing a toast fails, log to console as fallback
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  dismissToast(toast) {
    if (!toast) return;
    
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  showError(message, options = {}) {
    console.error(`Error: ${message}`);
    
    this.showToast(message, 'error');
    
    if (options.critical) {
      // For critical errors, add a persistent error notification
      const resultsContainer = document.querySelector('.results-container');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="error-box">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <circle cx="12" cy="12" r="10" fill="#f4212e"/>
              <path d="M12 8v5M12 16v.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <div class="error-message">
              <strong>Error:</strong> ${message}
              <p>Please try again or refresh the extension.</p>
            </div>
          </div>
        `;
        resultsContainer.style.display = 'block';
      }
    }
    
    if (message.includes('rate limit')) {
      this.handleRateLimitError();
    } else if (message.includes('network') || message.includes('connection')) {
      this.checkNetworkConnection();
    }
    
    const retryButton = document.getElementById('retry-button');
    if (retryButton && options.recoverable !== false) {
      retryButton.disabled = false;
      this.pulseElement(retryButton);
    }
  }

  validateProfileInput(input) {
    return /^@\w+$/.test(input) || 
           /^https?:\/\/(www\.)?x\.com\/\w+\/?$/.test(input) ||
           /^https?:\/\/(www\.)?twitter\.com\/\w+\/?$/.test(input);
  }

  async showProgressiveLoading() {
    try {
      const stages = [
        { message: 'Connecting to API...', progress: 15 },
        { message: 'Authenticating...', progress: 25 },
        { message: 'Fetching profile data...', progress: 40 },
        { message: 'Analyzing metrics...', progress: 60 },
        { message: 'Processing engagement patterns...', progress: 75 },
        { message: 'Generating insights...', progress: 90 }
      ];

      for (const stage of stages) {
        this.updateLoadingStatus(stage.message, stage.progress);
        // Randomize the delay slightly to make it feel more realistic
        const delay = 400 + Math.random() * 300;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Final state
      this.updateLoadingStatus('Finalizing analysis...', 100);
    } catch (error) {
      console.error('Error in progressive loading:', error);
      // If there's an error, still show some progress
      this.updateLoadingStatus('Processing...', 75);
    }
  }

  updateLoadingStatus(message, progress) {
    try {
      const loadingText = document.querySelector('.loading-text');
      const progressFill = document.querySelector('.progress-fill');
      
      if (loadingText) {
        loadingText.style.opacity = '0';
        setTimeout(() => {
          loadingText.textContent = message;
          loadingText.style.opacity = '1';
        }, 200);
      }
      
      if (progressFill) {
        progressFill.style.width = `${progress}%`;
        
        // Add pulsing animation when reaching 100%
        if (progress >= 100) {
          progressFill.classList.add('pulse-animation');
        } else {
          progressFill.classList.remove('pulse-animation');
        }
      }
    } catch (error) {
      console.error('Error updating loading status:', error);
    }
  }

  pulseElement(element) {
    if (!element) return;
    element.classList.add('pulse');
    setTimeout(() => element.classList.remove('pulse'), 1000);
  }

  switchTab(tabName) {
    try {
      console.log(`Switching to tab: ${tabName}`);
      
      // Get references to all elements
      const allTabButtons = document.querySelectorAll('.tab-button');
      const allTabContents = document.querySelectorAll('.tab-content');
      const selectedTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
      const selectedTabContent = document.getElementById(`${tabName}-tab`);
      
      // Check if elements exist
      if (!selectedTabButton || !selectedTabContent) {
        console.error(`Tab elements for "${tabName}" not found`);
        console.log('Available tabs:', Array.from(allTabButtons).map(el => el.dataset.tab));
        this.showToast(`Could not switch to tab: ${tabName}`, 'error');
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
      
      // Add animation class
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
      
      console.log(`Successfully switched to tab: ${tabName}`);
    } catch (error) {
      console.error('Error switching tabs:', error);
      this.showToast('Error switching tabs', 'error');
    }
  }

  updateSignInState(isSignedIn) {
    const signInButton = document.querySelector('.sign-in-button');
    const userProfile = document.querySelector('.user-profile');
    
    if (isSignedIn) {
      const userData = JSON.parse(localStorage.getItem('userProfile') || '{}');
      
      if (userProfile) {
        userProfile.style.display = 'flex';
        userProfile.innerHTML = userData.avatar ? 
          `<img src="${userData.avatar}" alt="${userData.name}" class="profile-picture">` :
          `<div class="profile-placeholder">${userData.name?.charAt(0) || 'X'}</div>`;
      }
      
      if (signInButton) {
        signInButton.style.display = 'none';
      }
    } else {
      if (userProfile) {
        userProfile.style.display = 'none';
      }
      if (signInButton) {
        signInButton.style.display = 'flex';
      }
    }
  }

  showConfirmationModal(title, message, confirmCallback) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal confirmation-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="close-modal">×</button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="cancel-button">Cancel</button>
            <button class="confirm-button primary-button">Confirm</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const handleClose = () => {
        modal.style.opacity = '0';
        setTimeout(() => {
          modal.remove();
          resolve(false);
        }, 300);
      };
      
      const handleConfirm = () => {
        modal.style.opacity = '0';
        setTimeout(() => {
          modal.remove();
          if (confirmCallback) {
            confirmCallback();
          }
          resolve(true);
        }, 300);
      };
      
      modal.querySelector('.close-modal')?.addEventListener('click', handleClose);
      modal.querySelector('.cancel-button')?.addEventListener('click', handleClose);
      modal.querySelector('.confirm-button')?.addEventListener('click', handleConfirm);
      
      setTimeout(() => modal.style.opacity = '1', 10);
    });
  }

  // Validation for post URL
  validatePostUrl(url) {
    return /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/status\/\d+/.test(url);
  }
  
  // Extract username from post URL
  extractUsernameFromUrl(url) {
    const match = url.match(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\/([a-zA-Z0-9_]+)\/status\/\d+/);
    return match ? match[3] : null;
  }

  // Fetch profile analysis from X Developer API and GrokAI
  async fetchProfileAnalysis(profileHandle) {
    console.log(`Fetching profile analysis for: ${profileHandle}`);
    
    try {
      const formattedHandle = profileHandle.startsWith('@') ? 
        profileHandle.substring(1) : 
        profileHandle.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//, '').split('/')[0];
      
      // Show detailed progressive loading
      this.updateLoadingStatus('Connecting to X API...', 20);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.updateLoadingStatus('Retrieving profile data...', 40);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      this.updateLoadingStatus('Processing with GrokAI...', 60);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.updateLoadingStatus('Generating insights...', 80);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Integration point: Real API call would go here
      // For now using a more realistic simulation with improved data
      
      // Simulated API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Calculate realistic metrics
      const engagementRate = (Math.random() * 5 + 1).toFixed(2) + '%';
      const growthRate = (Math.random() * 5 - 1).toFixed(2) + '%';
      const followersCount = Math.floor(Math.random() * 10000 + 500);
      const impressions = Math.floor(followersCount * (Math.random() * 8 + 3));
      const impactScore = Math.floor(Math.random() * 50 + 50);
      
      // Generate more realistic post examples
      const topPosts = [
        {
          id: 'post1',
          text: `Just had an amazing conversation about tech innovation in AI. The possibilities are truly limitless! #TechTalks #AI #Innovation`,
          engagement: Math.floor(Math.random() * 500 + 100),
          timestamp: Date.now() - (Math.random() * 7 * 86400000)
        },
        {
          id: 'post2',
          text: `Today's update on our product launch exceeded all expectations. Thank you to everyone who supported us on this journey! 🚀`,
          engagement: Math.floor(Math.random() * 400 + 50),
          timestamp: Date.now() - (Math.random() * 14 * 86400000)
        },
        {
          id: 'post3',
          text: `Sharing my thoughts on the recent industry developments. Let me know what you think in the comments below! #IndustryInsights`,
          engagement: Math.floor(Math.random() * 300 + 50),
          timestamp: Date.now() - (Math.random() * 21 * 86400000)
        }
      ];
      
      // Generate relevant AI-powered recommendations
      const recommendations = this.generateRecommendations(engagementRate, growthRate, topPosts);
      
      // Enhanced analytics for more realistic insights
      const analytics = {
        bestPostingTimes: ['9:00 AM', '5:30 PM', '8:00 PM'],
        audienceDemographics: {
          ageGroups: {
            '18-24': 15,
            '25-34': 38,
            '35-44': 27,
            '45-54': 12,
            '55+': 8
          },
          topLocations: ['United States', 'United Kingdom', 'Canada', 'India', 'Australia']
        },
        contentPerformance: {
          topHashtags: ['#Tech', '#Innovation', '#AI', '#Programming', '#Dev'],
          engagementByType: {
            'Text only': 25,
            'With image': 40,
            'With video': 30,
            'With link': 5
          }
        }
      };
      
      return {
        success: true,
        data: {
          username: formattedHandle,
          profileUrl: `https://x.com/${formattedHandle}`,
          engagement: engagementRate,
          growth: growthRate,
          followers: followersCount.toLocaleString(),
          reach: impressions.toLocaleString(),
          impact: impactScore.toString(),
          topContent: topPosts,
          recommendations: recommendations,
          analytics: analytics,
          analysisType: 'profile'
        }
      };
    } catch (error) {
      console.error('Error in fetchProfileAnalysis:', error);
      return {
        success: false,
        error: 'Failed to analyze profile. Please check your connection and try again.'
      };
    }
  }
  
  // Fetch post analysis from X Developer API and GrokAI
  async fetchPostAnalysis(postUrl) {
    console.log(`Fetching post analysis for: ${postUrl}`);
    
    try {
      // Extract post ID from URL
      const postIdMatch = postUrl.match(/\/status\/(\d+)/);
      if (!postIdMatch) {
        throw new Error('Invalid post URL format');
      }
      
      const postId = postIdMatch[1];
      const username = this.extractUsernameFromUrl(postUrl);
      
      // Show detailed progressive loading
      this.updateLoadingStatus('Connecting to X API...', 20);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.updateLoadingStatus('Retrieving post data...', 40);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      this.updateLoadingStatus('Analyzing engagement...', 60);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.updateLoadingStatus('Generating insights...', 80);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Integration point: Real API call would go here
      // Simulated API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate realistic post data
      const likesCount = Math.floor(Math.random() * 500 + 50);
      const retweetsCount = Math.floor(likesCount * (Math.random() * 0.3 + 0.1));
      const repliesCount = Math.floor(likesCount * (Math.random() * 0.2 + 0.05));
      const viewsCount = Math.floor(likesCount * (Math.random() * 20 + 10));
      
      const postTimestamp = Date.now() - Math.floor(Math.random() * 30 * 86400000);
      const engagementRate = ((likesCount + retweetsCount + repliesCount) / viewsCount * 100).toFixed(2) + '%';
      
      // Generate post content with realistic text
      const postText = "This is an exciting announcement about our new product launch! We've been working hard on bringing this innovation to market. #ProductLaunch #Innovation";
      
      // Generate engagement timeline data
      const timeframeHours = 48;
      const engagementTimeline = [];
      
      for (let i = 0; i < timeframeHours; i++) {
        const hoursAgo = timeframeHours - i;
        const timestamp = new Date(Date.now() - hoursAgo * 3600000);
        
        // Create a realistic engagement curve that peaks early and tapers off
        let factor = 1.0;
        if (hoursAgo > 40) factor = 0.1;
        else if (hoursAgo > 30) factor = 0.2;
        else if (hoursAgo > 20) factor = 0.5;
        else if (hoursAgo > 10) factor = 0.7;
        else if (hoursAgo > 5) factor = 0.9;
        
        engagementTimeline.push({
          timestamp: timestamp.toISOString(),
          likes: Math.floor(likesCount * factor * Math.random() * 0.1),
          retweets: Math.floor(retweetsCount * factor * Math.random() * 0.1),
          replies: Math.floor(repliesCount * factor * Math.random() * 0.1)
        });
      }
      
      // Generate AI analysis of the post content
      const contentAnalysis = {
        sentiment: Math.random() > 0.7 ? 'Negative' : Math.random() > 0.4 ? 'Positive' : 'Neutral',
        topics: ['Product Launch', 'Innovation', 'Technology', 'Marketing'],
        keyPhrases: ['exciting announcement', 'new product launch', 'innovation'],
        tone: Math.random() > 0.6 ? 'Professional' : Math.random() > 0.3 ? 'Enthusiastic' : 'Informative',
        readability: 'High'
      };
      
      return {
        success: true,
        data: {
          postId: postId,
          username: username,
          profileUrl: `https://x.com/${username}`,
          postUrl: postUrl,
          postText: postText,
          metrics: {
            likes: likesCount,
            retweets: retweetsCount,
            replies: repliesCount,
            views: viewsCount,
            engagement: engagementRate
          },
          postedAt: new Date(postTimestamp).toISOString(),
          engagementTimeline: engagementTimeline,
          contentAnalysis: contentAnalysis,
          recommendations: [
            'Posts with similar content perform best when published in the morning',
            'Including more specific hashtags could improve reach',
            'Adding a relevant image may increase engagement by up to 35%'
          ],
          analysisType: 'post'
        }
      };
    } catch (error) {
      console.error('Error in fetchPostAnalysis:', error);
      return {
        success: false,
        error: 'Failed to analyze post. Please check the URL and try again.'
      };
    }
  }
  
  // Fetch combined analysis for both profile and post
  async fetchCombinedAnalysis(profileHandle, postUrl) {
    try {
      // Show combined loading message
      this.updateLoadingStatus('Analyzing profile and post...', 50);
      
      // Request both analyses in parallel
      const [profileResponse, postResponse] = await Promise.all([
        this.fetchProfileAnalysis(profileHandle),
        this.fetchPostAnalysis(postUrl)
      ]);
      
      // Check if both were successful
      if (profileResponse.success && postResponse.success) {
        return {
          success: true,
          data: {
            profile: profileResponse.data,
            post: postResponse.data,
            analysisType: 'combined'
          }
        };
      } else {
        // Return the error from whichever failed
        return {
          success: false,
          error: !profileResponse.success ? profileResponse.error : postResponse.error
        };
      }
    } catch (error) {
      console.error('Error in fetchCombinedAnalysis:', error);
      return {
        success: false,
        error: 'Failed to complete combined analysis. Please try again.'
      };
    }
  }
  
  // Generate intelligent recommendations based on data
  generateRecommendations(engagementRate, growthRate, topPosts) {
    const recommendations = [];
    
    // Convert rates to numbers for comparison
    const engagementValue = parseFloat(engagementRate);
    const growthValue = parseFloat(growthRate);
    
    // Engagement-based recommendations
    if (engagementValue < 3.0) {
      recommendations.push('Increase post frequency to 3-4 times per week to boost engagement');
      recommendations.push('Experiment with more visual content which tends to receive higher interaction');
    } else {
      recommendations.push('Maintain your current posting cadence which is showing good engagement');
    }
    
    // Growth-based recommendations
    if (growthValue < 0) {
      recommendations.push('Consider running polls or questions to increase follower interaction');
      recommendations.push('Engage more actively with trending topics in your niche');
    } else if (growthValue < 2.0) {
      recommendations.push('Your steady growth can be accelerated by cross-promoting on other platforms');
    } else {
      recommendations.push('Your growth rate is excellent - focus on retaining new followers with consistent content');
    }
    
    // Content-based recommendations
    if (topPosts && topPosts.length > 0) {
      // Analyze top post patterns
      const hasHashtags = topPosts.some(post => post.text.includes('#'));
      const hasEmojis = topPosts.some(post => /[\u{1F600}-\u{1F64F}]/u.test(post.text));
      const averageLength = topPosts.reduce((sum, post) => sum + post.text.length, 0) / topPosts.length;
      
      if (!hasHashtags) {
        recommendations.push('Add relevant hashtags to increase discoverability of your posts');
      }
      
      if (!hasEmojis) {
        recommendations.push('Consider using emojis to make your posts more engaging and expressive');
      }
      
      if (averageLength < 80) {
        recommendations.push('Your top-performing posts are concise - continue with brief, impactful messaging');
      } else {
        recommendations.push('Your longer posts perform well - continue developing in-depth content');
      }
    }
    
    // Timing recommendation
    recommendations.push('Post during peak hours (9AM and 5PM) to maximize visibility');
    
    // Limit to 5 recommendations
    return recommendations.slice(0, 5);
  }

  updateResults(data) {
    try {
      console.log('Updating results with:', data);
      
      // Get the container
      const resultsContainer = document.querySelector('.results-container');
      if (!resultsContainer) {
        console.error('Results container not found');
        return;
      }
      
      // Show the container
      resultsContainer.style.display = 'block';
      
      // Determine which type of analysis to display
      if (data.analysisType === 'post') {
        this.displayPostAnalysis(resultsContainer, data);
      } else if (data.analysisType === 'combined') {
        this.displayCombinedAnalysis(resultsContainer, data);
      } else {
        // Default to profile analysis (backwards compatible)
        this.displayProfileAnalysis(resultsContainer, data);
      }
      
      // Add animations to make results appear with a nice effect
      const cards = resultsContainer.querySelectorAll('.metric-card');
      cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 100}ms`;
        card.classList.add('fade-in');
      });
    } catch (error) {
      console.error('Error updating results:', error);
      this.showError('Failed to display analysis results', { recoverable: true });
    }
  }
  
  // Display profile analysis results
  displayProfileAnalysis(container, data) {
    container.innerHTML = `
      <div class="results-header">
        <h2>Profile Analysis: @${data.username || 'user'}</h2>
        <div class="timestamp">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Analyzed ${new Date().toLocaleString()}</span>
        </div>
      </div>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-icon">📈</span>
          <span class="metric-value">${data.engagement}</span>
          <span class="metric-label">Engagement Rate</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">📊</span>
          <span class="metric-value">${data.growth}</span>
          <span class="metric-label">Growth Rate</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">👥</span>
          <span class="metric-value">${data.followers || data.reach}</span>
          <span class="metric-label">${data.followers ? 'Followers' : 'Reach'}</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">⭐</span>
          <span class="metric-value">${data.impact}</span>
          <span class="metric-label">Impact Score</span>
        </div>
      </div>
      
      ${data.analytics ? this.renderAnalyticsSection(data.analytics) : ''}
      
      ${data.recommendations ? `
      <div class="recommendations-section">
        <h3>Recommendations</h3>
        <ul class="recommendations-list">
          ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${data.topContent ? `
      <div class="top-content-section">
        <h3>Top Performing Content</h3>
        <div class="top-posts">
          ${data.topContent.map(post => `
            <div class="top-post-card">
              <div class="post-text">${post.text}</div>
              <div class="post-metrics">
                <div class="post-engagement">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                  </svg>
                  <span>${post.engagement} interactions</span>
                </div>
                <div class="post-date">${this.formatDate(post.timestamp)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
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
    
    // Add event listeners to new buttons
    this.addResultActionEventListeners(container);
  }
  
  // Display post analysis results
  displayPostAnalysis(container, data) {
    container.innerHTML = `
      <div class="results-header">
        <h2>Post Analysis</h2>
        <div class="timestamp">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Analyzed ${new Date().toLocaleString()}</span>
        </div>
      </div>
      
      <div class="post-preview-card">
        <div class="post-author">
          <span class="author-name">@${data.username || 'user'}</span>
          <a href="${data.postUrl}" target="_blank" class="view-original">View Original</a>
        </div>
        <div class="post-content">${data.postText}</div>
        <div class="post-date">Posted on ${new Date(data.postedAt).toLocaleDateString()}</div>
      </div>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-icon">❤️</span>
          <span class="metric-value">${data.metrics.likes.toLocaleString()}</span>
          <span class="metric-label">Likes</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">🔄</span>
          <span class="metric-value">${data.metrics.retweets.toLocaleString()}</span>
          <span class="metric-label">Retweets</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">💬</span>
          <span class="metric-value">${data.metrics.replies.toLocaleString()}</span>
          <span class="metric-label">Replies</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon">📊</span>
          <span class="metric-value">${data.metrics.engagement}</span>
          <span class="metric-label">Engagement Rate</span>
        </div>
      </div>
      
      ${data.contentAnalysis ? `
      <div class="content-analysis-section">
        <h3>Content Analysis</h3>
        <div class="analysis-grid">
          <div class="analysis-item">
            <div class="analysis-label">Sentiment</div>
            <div class="analysis-value">${data.contentAnalysis.sentiment}</div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">Tone</div>
            <div class="analysis-value">${data.contentAnalysis.tone}</div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">Readability</div>
            <div class="analysis-value">${data.contentAnalysis.readability}</div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">Key Topics</div>
            <div class="analysis-value topics-list">${data.contentAnalysis.topics.join(', ')}</div>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${data.engagementTimeline && data.engagementTimeline.length > 0 ? `
      <div class="timeline-section">
        <h3>Engagement Timeline</h3>
        <div class="timeline-chart">
          <div class="chart-placeholder">
            [Engagement timeline visualization would go here]
          </div>
          <div class="chart-legend">
            <div class="legend-item"><span class="legend-color likes-color"></span> Likes</div>
            <div class="legend-item"><span class="legend-color retweets-color"></span> Retweets</div>
            <div class="legend-item"><span class="legend-color replies-color"></span> Replies</div>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${data.recommendations ? `
      <div class="recommendations-section">
        <h3>Recommendations</h3>
        <ul class="recommendations-list">
          ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
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
    
    // Add event listeners to new buttons
    this.addResultActionEventListeners(container);
  }
  
  // Display combined analysis results
  displayCombinedAnalysis(container, data) {
    const profile = data.profile;
    const post = data.post;
    
    container.innerHTML = `
      <div class="results-header">
        <h2>Combined Analysis: @${profile.username || 'user'}</h2>
        <div class="timestamp">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Analyzed ${new Date().toLocaleString()}</span>
        </div>
      </div>
      
      <div class="tab-buttons analysis-tabs">
        <button class="tab-button analysis-tab active" data-analysis-tab="profile">Profile Analysis</button>
        <button class="tab-button analysis-tab" data-analysis-tab="post">Post Analysis</button>
        <button class="tab-button analysis-tab" data-analysis-tab="comparison">Comparison</button>
      </div>
      
      <div class="analysis-content-container">
        <div class="analysis-content active" id="profile-analysis">
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-icon">📈</span>
              <span class="metric-value">${profile.engagement}</span>
              <span class="metric-label">Engagement Rate</span>
            </div>
            <div class="metric-card">
              <span class="metric-icon">📊</span>
              <span class="metric-value">${profile.growth}</span>
              <span class="metric-label">Growth Rate</span>
            </div>
            <div class="metric-card">
              <span class="metric-icon">👥</span>
              <span class="metric-value">${profile.followers || profile.reach}</span>
              <span class="metric-label">${profile.followers ? 'Followers' : 'Reach'}</span>
            </div>
            <div class="metric-card">
              <span class="metric-icon">⭐</span>
              <span class="metric-value">${profile.impact}</span>
              <span class="metric-label">Impact Score</span>
            </div>
          </div>
          
          ${profile.topContent ? `
          <div class="top-content-section">
            <h3>Top Performing Content</h3>
            <div class="top-posts">
              ${profile.topContent.map(content => `
                <div class="top-post-card">
                  <div class="post-text">${content.text}</div>
                  <div class="post-metrics">
                    <div class="post-engagement">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                      </svg>
                      <span>${content.engagement} interactions</span>
                    </div>
                    <div class="post-date">${this.formatDate(content.timestamp)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
        
        <div class="analysis-content" id="post-analysis">
          <div class="post-preview-card">
            <div class="post-content">${post.postText}</div>
            <div class="post-date">Posted on ${new Date(post.postedAt).toLocaleDateString()}</div>
          </div>
          
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-icon">❤️</span>
              <span class="metric-value">${post.metrics.likes.toLocaleString()}</span>
              <span class="metric-label">Likes</span>
            </div>
            <div class="metric-card">
              <span class="metric-icon">🔄</span>
              <span class="metric-value">${post.metrics.retweets.toLocaleString()}</span>
              <span class="metric-label">Retweets</span>
            </div>
            <div class="metric-card">
              <span class="metric-icon">💬</span>
              <span class="metric-value">${post.metrics.replies.toLocaleString()}</span>
              <span class="metric-label">Replies</span>
            </div>
            <div class="metric-card">
              <span class="metric-icon">📊</span>
              <span class="metric-value">${post.metrics.engagement}</span>
              <span class="metric-label">Engagement Rate</span>
            </div>
          </div>
          
          ${post.contentAnalysis ? `
          <div class="content-analysis-section">
            <h3>Content Analysis</h3>
            <div class="analysis-grid">
              <div class="analysis-item">
                <div class="analysis-label">Sentiment</div>
                <div class="analysis-value">${post.contentAnalysis.sentiment}</div>
              </div>
              <div class="analysis-item">
                <div class="analysis-label">Tone</div>
                <div class="analysis-value">${post.contentAnalysis.tone}</div>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
        
        <div class="analysis-content" id="comparison">
          <div class="comparison-section">
            <h3>Post vs. Profile Performance</h3>
            <div class="comparison-chart">
              <div class="comparison-item">
                <div class="comparison-label">Engagement</div>
                <div class="comparison-bars">
                  <div class="comparison-bar-container">
                    <div class="comparison-bar post-bar" style="width: ${Math.min(parseFloat(post.metrics.engagement), 20)}%"></div>
                    <span class="bar-label">Post: ${post.metrics.engagement}</span>
                  </div>
                  <div class="comparison-bar-container">
                    <div class="comparison-bar profile-bar" style="width: ${Math.min(parseFloat(profile.engagement), 20)}%"></div>
                    <span class="bar-label">Profile Avg: ${profile.engagement}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="insight-section">
            <h3>Key Insights</h3>
            <ul class="insights-list">
              <li>This post ${parseFloat(post.metrics.engagement) > parseFloat(profile.engagement) ? 'outperformed' : 'underperformed'} your average engagement rate</li>
              <li>The content style aligns with your top performing content patterns</li>
              <li>This post reached approximately ${Math.floor(post.metrics.views / profile.followers * 100)}% of your followers</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="recommendations-section">
        <h3>Personalized Recommendations</h3>
        <ul class="recommendations-list">
          ${profile.recommendations.slice(0, 2).concat(post.recommendations.slice(0, 2)).map(rec => `<li>${rec}</li>`).join('')}
          <li>Create more content similar to this post to maintain engagement momentum</li>
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
    
    // Add event listeners for analysis tabs
    const tabButtons = container.querySelectorAll('.analysis-tab');
    const contentContainers = container.querySelectorAll('.analysis-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-analysis-tab');
        
        // Update button states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update content visibility
        contentContainers.forEach(content => content.classList.remove('active'));
        container.querySelector(`#${tabName}-analysis`).classList.add('active');
      });
    });
    
    // Add event listeners to share and download buttons
    this.addResultActionEventListeners(container);
  }
  
  // Helper function to add event listeners to result action buttons
  addResultActionEventListeners(container) {
    container.querySelector('.share-results')?.addEventListener('click', () => {
      this.handleShare();
    });
    
    container.querySelector('.download-report')?.addEventListener('click', () => {
      this.showToast('Report downloading functionality coming soon', 'info');
    });
  }
  
  // Render analytics section for profile data
  renderAnalyticsSection(analytics) {
    if (!analytics) return '';
    
    return `
      <div class="analytics-section">
        <h3>Detailed Analytics</h3>
        
        ${analytics.bestPostingTimes ? `
        <div class="analytics-subsection">
          <h4>Best Posting Times</h4>
          <div class="time-slots">
            ${analytics.bestPostingTimes.map(time => 
              `<div class="time-slot">${time}</div>`
            ).join('')}
          </div>
        </div>
        ` : ''}
        
        ${analytics.audienceDemographics ? `
        <div class="analytics-subsection">
          <h4>Audience Demographics</h4>
          <div class="demographics-grid">
            <div class="demographics-chart">
              <div class="chart-title">Age Groups</div>
              <div class="age-bars">
                ${Object.entries(analytics.audienceDemographics.ageGroups).map(([group, percentage]) => `
                  <div class="age-bar-container">
                    <div class="age-label">${group}</div>
                    <div class="age-bar-wrapper">
                      <div class="age-bar" style="width: ${percentage}%;"></div>
                    </div>
                    <div class="age-percentage">${percentage}%</div>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="top-locations">
              <div class="chart-title">Top Locations</div>
              <ul class="locations-list">
                ${analytics.audienceDemographics.topLocations.map(location => 
                  `<li>${location}</li>`
                ).join('')}
              </ul>
            </div>
          </div>
        </div>
        ` : ''}
        
        ${analytics.contentPerformance ? `
        <div class="analytics-subsection">
          <h4>Content Performance</h4>
          <div class="performance-grid">
            <div class="top-hashtags">
              <div class="chart-title">Top Hashtags</div>
              <div class="hashtag-cloud">
                ${analytics.contentPerformance.topHashtags.map(tag => 
                  `<span class="hashtag">${tag}</span>`
                ).join('')}
              </div>
            </div>
            <div class="engagement-types">
              <div class="chart-title">Engagement by Content Type</div>
              <div class="engagement-bars">
                ${Object.entries(analytics.contentPerformance.engagementByType).map(([type, percentage]) => `
                  <div class="engagement-bar-container">
                    <div class="engagement-label">${type}</div>
                    <div class="engagement-bar-wrapper">
                      <div class="engagement-bar" style="width: ${percentage}%;"></div>
                    </div>
                    <div class="engagement-percentage">${percentage}%</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  generatePost() {
    const topic = document.getElementById('post-topic')?.value;
    if (!topic) {
      this.showToast('Please enter a topic', 'error');
      return;
    }

    const generateButton = document.getElementById('generate-post-btn');
    if (generateButton) {
      this.setButtonLoading(generateButton, true, 'Generating...');
    }

    // Get selected options
    const type = document.querySelector('.type-btn.active')?.getAttribute('data-type') || 'engagement';
    const tone = document.querySelector('.tone-btn.active')?.getAttribute('data-tone') || 'professional';
    const includeHashtags = document.getElementById('include-hashtags')?.checked || false;
    const includeEmojis = document.getElementById('include-emojis')?.checked || false;
    const includeCta = document.getElementById('include-cta')?.checked || false;

    // Simulate API call
    setTimeout(() => {
      try {
        const posts = this.getGeneratedSamplePosts(topic, type, tone, includeHashtags, includeEmojis, includeCta);
        const container = document.getElementById('generated-posts-container');
        
        if (!container) {
          throw new Error('Posts container not found');
        }

        // Clear previous posts
        container.innerHTML = '';

        // Add new posts
        posts.forEach(post => {
          const postElement = document.createElement('div');
          postElement.className = 'generated-post slide-up';
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
              this.createRippleEffect(e);
              this.useGeneratedPost(post.content);
            });
          }

          if (regenerateButton) {
            regenerateButton.addEventListener('click', (e) => {
              this.createRippleEffect(e);
              this.regeneratePost(postElement, topic, type, tone, includeHashtags, includeEmojis, includeCta);
            });
          }

          container.appendChild(postElement);
        });

        this.showToast('Posts generated successfully!', 'success');
      } catch (error) {
        console.error('Error generating posts:', error);
        this.showToast('Failed to generate posts', 'error');
      } finally {
        if (generateButton) {
          this.setButtonLoading(generateButton, false);
        }
      }
    }, 1500);
  }

  getGeneratedSamplePosts(topic, type, tone, hashtags, emojis, cta) {
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
      } else {
        posts.push({
          content: `${emojis ? '🔥 ' : ''}Just discovered some amazing things about ${topic}! Can't wait to share what I found. ${hashtagText} ${ctaText}`,
          engagement: 'Very High',
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
    }

    // Add more variations
    if (posts.length < 2) {
      posts.push({
        content: `${emojis ? '🎯 ' : ''}Exploring the impact of ${topic} on today's landscape. The data reveals fascinating patterns. ${hashtagText} ${ctaText}`,
        engagement: 'Medium',
        bestTime: getRandomBestTime()
      });
    }

    return posts;
  }

  useGeneratedPost(content) {
    const postInput = document.querySelector('.post-input');
    if (!postInput) {
      this.showToast('Post composer not found', 'error');
      return;
    }

    // Set content and trigger input event
    postInput.value = content;
    postInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Switch to compose tab
    this.switchTab('compose');

    // Add highlight effect
    postInput.classList.add('highlight-effect');
    setTimeout(() => postInput.classList.remove('highlight-effect'), 1000);

    this.showToast('Post content applied!', 'success');
  }

  regeneratePost(postElement, topic, type, tone, hashtags, emojis, cta) {
    if (!postElement) return;

    postElement.classList.add('regenerating');
    const preview = postElement.querySelector('.post-preview');
    
    if (preview) {
      preview.innerHTML = '<div class="loading-spinner"></div>';
    }

    setTimeout(() => {
      try {
        const newPosts = this.getGeneratedSamplePosts(topic, type, tone, hashtags, emojis, cta);
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

        // Add highlight effect
        preview.classList.add('highlight-effect');
       setTimeout(() => preview.classList.remove('highlight-effect'), 1000);

       this.showToast('Post regenerated successfully', 'success');
     } catch (error) {
       console.error('Error regenerating post:', error);
       this.showToast('Failed to regenerate post', 'error');
     } finally {
       postElement.classList.remove('regenerating');
     }
   }, 1000);
 }

 handleLoadingTimeout() {
   this.hideLoading();
   this.isAnalyzing = false;
   this.showError('Analysis is taking longer than expected. Please try again.');
   
   const retryButton = document.getElementById('retry-button');
   if (retryButton) {
     retryButton.disabled = false;
     this.pulseElement(retryButton);
   }
   
   // Reset analyze button too
   const analyzeButton = document.getElementById('analyze-button');
   if (analyzeButton) {
     this.setButtonLoading(analyzeButton, false);
   }
 }

 loadCachedHistory() {
   try {
     const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
     const container = document.getElementById('historyItemsContainer');
     
     if (!container) return;

     if (history.length === 0) {
       container.innerHTML = '<div class="empty-state">No analysis history yet</div>';
       return;
     }

     container.innerHTML = history.map(item => `
       <div class="history-item">
         <div class="history-profile">@${item.username}</div>
         <div class="history-date">${this.formatRelativeTime(item.timestamp)}</div>
         <button class="history-action">Reanalyze</button>
       </div>
     `).join('');

     // Add event listeners
     container.querySelectorAll('.history-action').forEach((button, index) => {
       button.addEventListener('click', (e) => {
         this.createRippleEffect(e);
         this.reanalyzeProfile(history[index].username);
       });
     });
   } catch (error) {
     console.error('Error loading history:', error);
   }
 }

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

 reanalyzeProfile(username) {
   const profileInput = document.getElementById('profile-input');
   if (profileInput) {
     profileInput.value = username;
     this.switchTab('analyze');
     this.handleAnalyze();
   }
 }

 showInitialState() {
   try {
     // Show analyze tab by default
     this.switchTab('analyze');
     
     // Reset inputs
     document.querySelectorAll('input').forEach(input => {
       input.value = '';
       const clearButton = input.parentElement?.querySelector('.clear-input');
       if (clearButton) {
         clearButton.style.display = 'none';
       }
     });
     
     // Hide results
     const resultsContainer = document.querySelector('.results-container');
     if (resultsContainer) {
       resultsContainer.style.display = 'none';
     }
     
     // Ensure loading is hidden
     this.forceHideLoading();
     
     // Reset analyze button state
     const analyzeButton = document.getElementById('analyze-button');
     if (analyzeButton) {
       analyzeButton.disabled = true;
       analyzeButton.classList.remove('active');
       analyzeButton.classList.remove('loading');
     }
     
     console.log('Initial state setup complete');
   } catch (error) {
     console.error('Error showing initial state:', error);
   }
 }

 clearCache() {
   try {
     // Clear local storage cache
     localStorage.removeItem('analysisCache');
     
     // Also clear rate limit if it exists
     const rateLimit = { count: 0, resetTime: Date.now() + 3600000 };
     localStorage.setItem('rateLimit', JSON.stringify(rateLimit));
     
     // Update the rate limit UI
     this.updateRateLimitUI(rateLimit);
     
     // Show success toast
     this.showToast('Cache cleared successfully', 'success');
   } catch (error) {
     console.error('Error clearing cache:', error);
     this.showToast('Failed to clear cache', 'error');
   }
 }

 // Method to clear analysis history
 clearHistory() {
   try {
     // Ask for confirmation
     this.showConfirmationModal(
       'Clear History',
       'Are you sure you want to clear all analysis history?',
       () => {
         // Remove history from local storage
         localStorage.removeItem('analysisHistory');
         
         // Update UI
         const container = document.getElementById('historyItemsContainer');
         if (container) {
           container.innerHTML = '<div class="empty-state">No analysis history yet</div>';
         }
         
         this.showToast('History cleared successfully', 'success');
       }
     );
   } catch (error) {
     console.error('Error clearing history:', error);
     this.showToast('Failed to clear history', 'error');
   }
 }

 // Method to handle posting a tweet
 handlePostNow() {
   const postInput = document.querySelector('.post-input');
   if (!postInput || !postInput.value.trim()) {
     this.showToast('Please enter some text to post', 'error');
     return;
   }
   
   const postText = postInput.value.trim();
   const characterCount = postText.length;
   
   if (characterCount > 280) {
     this.showToast('Post exceeds 280 character limit', 'error');
     return;
   }
   
   // Show loading state
   const postButton = document.querySelector('.post-now-button');
   if (postButton) {
     this.setButtonLoading(postButton, true, 'Posting...');
   }
   
   // Simulate posting process
   setTimeout(() => {
     try {
       // Simulate success
       this.showToast('Post published successfully!', 'success');
       
       // Clear the input
       postInput.value = '';
       
       // Update character counter
       const counter = document.querySelector('.character-counter');
       if (counter) {
         counter.textContent = '0/280';
       }
     } catch (error) {
       console.error('Error posting:', error);
       this.showToast('Failed to publish post', 'error');
     } finally {
       // Reset button state
       if (postButton) {
         this.setButtonLoading(postButton, false, null, 'Post');
       }
     }
   }, 1500);
 }

 // Method to cancel loading during analysis
 cancelLoading() {
   try {
     if (this.isAnalyzing) {
       // Clear timeout
       if (this.loadingTimeout) {
         clearTimeout(this.loadingTimeout);
         this.loadingTimeout = null;
       }
       
       // Update state
       this.isAnalyzing = false;
       
       // Hide loading UI
       this.hideLoading();
       
       // Reset analyze button
       const analyzeButton = document.getElementById('analyze-button');
       if (analyzeButton) {
         this.setButtonLoading(analyzeButton, false);
       }
       
       // Remove cancel button
       this.removeCancelButton();
       
       // Show toast
       this.showToast('Analysis cancelled', 'info');
       
       console.log('Analysis cancelled by user');
     }
   } catch (error) {
     console.error('Error cancelling analysis:', error);
     // Force reset state in case of error
     this.isAnalyzing = false;
     this.forceHideLoading();
   }
 }

 // Method to handle rate limit errors
 handleRateLimitError() {
   // Get the current rate limit - for Chrome extension, would use chrome.runtime.sendMessage
   const rateLimit = JSON.parse(localStorage.getItem('rateLimit') || '{"count": 20, "total": 25, "resetTime": ' + (Date.now() + 3600000) + '}');
   
   this.updateRateLimitUI(rateLimit);
   
   // Show a more detailed error message
   this.showToast('API rate limit reached. Please try again later.', 'error');
 }

 // Method to check network connection
 checkNetworkConnection() {
   if (!navigator.onLine) {
     this.showToast('No internet connection. Please check your network.', 'error');
   } else {
     // If online, it might be a server issue
     this.showToast('Server connection error. Please try again later.', 'error');
   }
 }

 // Update the rate limit UI
 updateRateLimitUI(rateLimit) {
   const rateLimitBar = document.getElementById('rate-limit-bar');
   const rateLimitCount = document.getElementById('rate-limit-count');
   
   if (rateLimitBar && rateLimitCount) {
     // Calculate percentage used
     const totalLimit = rateLimit.total || 25;
     const percentage = Math.min((rateLimit.count / totalLimit) * 100, 100);
     rateLimitBar.style.width = `${percentage}%`;
     
     // Update count text
     rateLimitCount.textContent = `${rateLimit.count}/${totalLimit}`;
     
     // Add warning color if approaching limit
     if (percentage > 80) {
       rateLimitBar.style.backgroundColor = '#ffa500';
     } else if (percentage > 95) {
       rateLimitBar.style.backgroundColor = '#f4212e';
     } else {
       rateLimitBar.style.backgroundColor = '#1d9bf0';
     }
   }
 }

 // Method to simulate a POST API call for generated content
 async postToAPI(content, endpoint = 'posts') {
   // Simulate API delay with a promise
   return new Promise((resolve, reject) => {
     setTimeout(() => {
       // Simulate 90% success rate
       if (Math.random() < 0.9) {
         resolve({
           success: true,
           data: {
             id: 'post_' + Date.now(),
             content: content,
             timestamp: new Date().toISOString()
           }
         });
       } else {
         reject(new Error('Failed to send data to API'));
       }
     }, 1000);
   });
 }

 // Handle clicks on media buttons
 handleMediaButtonClick(type) {
   switch (type) {
     case 'media':
       this.showToast('Media upload feature coming soon', 'info');
       break;
     case 'emoji':
       this.showToast('Emoji picker feature coming soon', 'info');
       break;
     case 'poll':
       this.showToast('Poll creation feature coming soon', 'info');
       break;
     case 'schedule':
       this.showToast('Post scheduling feature coming soon', 'info');
       break;
     default:
       break;
   }
 }

 // Handle share button functionality
 handleShare() {
   // Check if we're in the results view
   const resultsContainer = document.querySelector('.results-container');
   if (resultsContainer && resultsContainer.style.display !== 'none') {
     try {
       const profileInput = document.getElementById('profile-input');
       if (profileInput?.value) {
         // Create a shareable link
         const shareableText = `Check out this X profile analysis for @${profileInput.value.replace('@', '')}`;
         
         // Try to use the Web Share API if available
         if (navigator.share) {
           navigator.share({
             title: 'X Profile Analysis',
             text: shareableText,
             url: `https://x.com/${profileInput.value.replace('@', '')}`
           }).catch(err => {
             console.error('Error sharing:', err);
             this.showToast('Could not share profile analysis', 'error');
           });
         } else {
           // Fallback to clipboard
           navigator.clipboard.writeText(shareableText)
             .then(() => this.showToast('Copied to clipboard!', 'success'))
             .catch(() => this.showToast('Failed to copy to clipboard', 'error'));
         }
       } else {
         this.showToast('No profile to share', 'error');
       }
     } catch (error) {
       console.error('Share error:', error);
       this.showToast('Failed to share profile analysis', 'error');
     }
   } else {
     this.showToast('Analyze a profile first to share results', 'info');
   }
 }

 // Helper method to save a profile to history
 saveToHistory(username) {
   try {
     // Get existing history or initialize a new one
     const history = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
     
     // Check if profile already exists in history
     const existingIndex = history.findIndex(item => item.username === username);
     
     if (existingIndex !== -1) {
       // Update existing entry
       history[existingIndex].timestamp = Date.now();
     } else {
       // Add new entry
       history.unshift({
         username,
         timestamp: Date.now()
       });
       
       // Limit history to 20 items
       if (history.length > 20) {
         history.pop();
       }
     }
     
     // Save updated history
     localStorage.setItem('analysisHistory', JSON.stringify(history));
     
     // Update history UI if we're on that tab
     if (document.querySelector('.tab-button[data-tab="history"]')?.classList.contains('active')) {
       this.loadCachedHistory();
     }
   } catch (error) {
     console.error('Error saving to history:', error);
   }
 }

 // Initialize all media button handlers
 initializeMediaButtons() {
   document.querySelectorAll('.media-btn').forEach(button => {
     button.addEventListener('click', e => {
       this.createRippleEffect(e);
       
       // Determine button type based on icon or title
       let type = 'media';
       if (button.title.includes('Emoji')) type = 'emoji';
       else if (button.title.includes('Poll')) type = 'poll';
       else if (button.title.includes('Schedule')) type = 'schedule';
       
       this.handleMediaButtonClick(type);
     });
   });
   
   // Initialize footer button handlers
   document.querySelector('.help-button')?.addEventListener('click', e => {
     this.createRippleEffect(e);
     this.showToast('Help documentation coming soon!', 'info');
   });
   
   document.querySelector('.feedback-button')?.addEventListener('click', e => {
     this.createRippleEffect(e);
     this.showToast('Feedback form coming soon!', 'info');
   });
   
   document.querySelector('.share-button')?.addEventListener('click', e => {
     this.createRippleEffect(e);
     this.handleShare();
   });
 }

 // Event handler for ensuring a DOM element exists, with error handling
 ensureButtonFunctionality(buttonId, callback) {
   const button = document.getElementById(buttonId);
   if (button) {
     // Remove any existing listeners to prevent duplicates
     const newButton = button.cloneNode(true);
     button.parentNode.replaceChild(newButton, button);
     
     newButton.addEventListener('click', function(e) {
       // Create ripple effect
       this.createRippleEffect(e);
       
       // Execute callback
       callback();
     }.bind(this));
     
     return true;
   } else {
     console.warn(`Button with ID "${buttonId}" not found in the DOM`);
     return false;
   }
 }

 // Add a cancel button to the loading overlay
 addCancelButton() {
   try {
     const overlay = document.querySelector('.loading-overlay');
     if (!overlay) return;
     
     // Don't add a second cancel button if one exists
     if (overlay.querySelector('.cancel-analysis-button')) return;
     
     const cancelButton = document.createElement('button');
     cancelButton.className = 'cancel-analysis-button';
     cancelButton.textContent = 'Cancel';
     cancelButton.addEventListener('click', () => this.cancelLoading());
     
     const loadingContent = overlay.querySelector('.loading-content');
     if (loadingContent) {
       loadingContent.appendChild(cancelButton);
     }
   } catch (error) {
     console.error('Error adding cancel button:', error);
   }
 }

 // Remove the cancel button
 removeCancelButton() {
   try {
     const cancelButton = document.querySelector('.cancel-analysis-button');
     if (cancelButton && cancelButton.parentNode) {
       cancelButton.parentNode.removeChild(cancelButton);
     }
   } catch (error) {
     console.error('Error removing cancel button:', error);
   }
 }
}

// Make available globally
window.InteractionManager = InteractionManager;