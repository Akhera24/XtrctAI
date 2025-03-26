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
            e.preventDefault(); // Prevent default form submission
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
            e.preventDefault(); // Prevent default form submission
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
      const generateButton = document.getElementById('generate-button') || 
                           document.getElementById('generate-post-btn');
      if (generateButton) {
        generateButton.addEventListener('click', (e) => {
          this.createRippleEffect(e);
          this.generatePost();
        });
      } else {
        console.warn('Generate post button not found');
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
    try {
      const button = event.currentTarget;
      
      if (!button) return;
      
      // Remove existing ripples
      const existingRipple = button.querySelector('.ripple');
      if (existingRipple) {
        existingRipple.remove();
      }
      
      // Create ripple element
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      button.appendChild(ripple);
      
      // Calculate position
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      
      // Add active class
      ripple.classList.add('active');
      
      // Remove after animation completes
      setTimeout(() => {
        ripple.remove();
      }, 600);
    } catch (error) {
      console.error('Error creating ripple effect:', error);
    }
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
    console.log('handleAnalyze called');
    if (this.isAnalyzing) {
      this.showToast('Analysis already in progress', 'info');
      return;
    }

    const profileInput = document.getElementById('profile-input');
    const postUrlInput = document.getElementById('post-url');
    const analyzeButton = document.getElementById('analyze-button');
    const resultsContainer = document.getElementById('results-container');
    
    if (!profileInput && !postUrlInput) {
      this.showError('Input elements not found', { critical: true });
      return;
    }
    
    const profileValue = profileInput?.value.trim() || '';
    const postUrlValue = postUrlInput?.value.trim() || '';
    
    if (!profileValue && !postUrlValue) {
      this.shakeElement(profileInput);
      this.showToast('Please enter a profile handle, URL, or post URL', 'error');
      if (profileInput) profileInput.focus();
      return;
    }

    // Add a cancel button to the loading overlay
    this.addCancelButton();

    try {
      this.isAnalyzing = true;
      
      // Update button state
      if (analyzeButton) {
        this.setButtonLoading(analyzeButton, true, 'Analyzing...');
        this.pulseElement(analyzeButton);
      }
      
      // Show the loading overlay
      this.showLoading();
      
      // Set loading timeout
      this.loadingTimeout = setTimeout(() => {
        this.handleLoadingTimeout();
      }, this.maxLoadingTime);

      // Validate input
      if (profileValue && !this.validateProfileInput(profileValue)) {
        this.shakeElement(profileInput);
        throw new Error('Invalid profile format. Please use @handle or full profile URL.');
      }
      
      if (postUrlValue && !this.validatePostUrl(postUrlValue)) {
        this.shakeElement(postUrlInput);
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
          if (resultsContainer) {
            resultsContainer.style.display = 'block';
            this.updateResults(response.data);
            
            // Scroll to results
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          
          this.showToast('Analysis completed successfully!', 'success');
          
          // Save to history
          if (profileValue) {
            this.saveToHistory(profileValue.replace('@', ''));
          } else if (postUrlValue) {
            // Extract username from post URL for history
            const username = this.extractUsernameFromUrl(postUrlValue);
            if (username) this.saveToHistory(username);
          }
          
          // Enable retry button
          const retryButton = document.getElementById('retry-button');
          if (retryButton) {
            retryButton.disabled = false;
            this.pulseElement(retryButton);
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
      if (analyzeButton) {
        this.setButtonLoading(analyzeButton, false);
      }
      
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

  setButtonLoading(button, isLoading, loadingText = null) {
    if (!button) return;
    
    try {
      // Store original text for restoration
      if (isLoading && !button.hasAttribute('data-original-text')) {
        button.setAttribute('data-original-text', button.innerHTML);
      }
      
      if (isLoading) {
        // Set to loading state
        button.classList.add('button-loading');
        button.disabled = true;
        
        // Set loading text if provided
        if (loadingText) {
          // Preserve the loading spinner by using data attribute instead of innerHTML
          button.setAttribute('data-loading-text', loadingText);
        }
      } else {
        // Restore original state
        button.classList.remove('button-loading');
        button.disabled = false;
        
        // Restore original text
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
          button.innerHTML = originalText;
          button.removeAttribute('data-original-text');
        }
        
        // Remove loading text
        button.removeAttribute('data-loading-text');
      }
    } catch (error) {
      console.error('Error setting button loading state:', error);
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
    const signInButton = document.querySelector('.sign-in-button');
    
    try {
      const isSignedIn = localStorage.getItem('isSignedIn') === 'true';
      
      if (isSignedIn) {
        // User is signed in, show sign out confirmation
        this.showConfirmationModal(
          'Sign Out', 
          'Are you sure you want to sign out of your X account?',
          () => {
            // User confirmed sign out
            localStorage.setItem('isSignedIn', 'false');
            localStorage.removeItem('userProfile');
            this.updateSignInState(false);
            this.showToast('Signed out successfully', 'success');
          }
        );
      } else {
        // User is not signed in, show sign in flow
        await this.authenticateWithX();
      }
    } catch (error) {
      console.error('Sign in/out error:', error);
      this.showToast('Failed to process sign in/out request', 'error');
      
      // Restore button state in case of error
      if (signInButton) {
        this.setButtonLoading(signInButton, false);
      }
    }
  }

  async authenticateWithX() {
    const signInButton = document.querySelector('.sign-in-button');
    
    try {
      // Show loading state
      if (signInButton) {
        this.setButtonLoading(signInButton, true, 'Signing in...');
        this.pulseElement(signInButton);
      }
      
      // Simulate authentication process
      this.showToast('Connecting to X...', 'info');
      
      // For demo purposes, simulate a network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real extension, this would call the X OAuth flow
      // For now, we'll use mock data
      const mockUserProfile = {
        name: 'X User',
        username: 'xuser',
        avatarUrl: 'https://via.placeholder.com/32'
      };
      
      // Save to localStorage
      localStorage.setItem('isSignedIn', 'true');
      localStorage.setItem('userProfile', JSON.stringify(mockUserProfile));
      
      // Update UI
      this.updateSignInState(true);
      
      // Show success toast
      this.showToast('Successfully signed in to X', 'success');
      
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      this.showError('Failed to authenticate with X. Please try again.');
      return false;
    } finally {
      // Always restore button state
      if (signInButton) {
        this.setButtonLoading(signInButton, false);
      }
    }
  }

  updateSignInState(isSignedIn) {
    try {
      const signInButton = document.querySelector('.sign-in-button');
      const userProfileElement = document.querySelector('.user-profile');
      
      if (isSignedIn) {
        // Get user data from localStorage
        const userData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        
        // Update user profile element if it exists
        if (userProfileElement) {
          userProfileElement.style.display = 'flex';
          
          // Create profile content
          let profileContent = '';
          if (userData.avatarUrl) {
            profileContent = `<img src="${userData.avatarUrl}" alt="${userData.name}" class="profile-picture">`;
          } else {
            const initial = userData.name ? userData.name.charAt(0).toUpperCase() : 'X';
            profileContent = `<div class="profile-placeholder">${initial}</div>`;
          }
          
          userProfileElement.innerHTML = profileContent;
          
          // Add click handler to user profile for account options
          userProfileElement.onclick = (e) => {
            this.handleSignIn();
          };
        }
        
        // Hide sign in button
        if (signInButton) {
          signInButton.style.display = 'none';
        }
      } else {
        // Hide user profile element
        if (userProfileElement) {
          userProfileElement.style.display = 'none';
          userProfileElement.innerHTML = '';
          userProfileElement.onclick = null;
        }
        
        // Show sign in button
        if (signInButton) {
          signInButton.style.display = 'flex';
        }
      }
    } catch (error) {
      console.error('Error updating sign-in state:', error);
    }
  }

  resetToHome() {
    const homeButton = document.querySelector('.home-button');
    
    try {
      // Show loading animation on button
      if (homeButton) {
        this.setButtonLoading(homeButton, true, 'Resetting...');
        this.pulseElement(homeButton);
      }
      
      // Reset UI state
      
      // 1. Clear any input fields
      const profileInput = document.getElementById('profile-input');
      if (profileInput) {
        profileInput.value = '';
      }
      
      const postTopic = document.getElementById('post-topic');
      if (postTopic) {
        postTopic.value = '';
      }
      
      const postContent = document.getElementById('post-content');
      if (postContent) {
        postContent.value = '';
        
        // Trigger input event to update character count
        const inputEvent = new Event('input', { bubbles: true });
        postContent.dispatchEvent(inputEvent);
      }
      
      // 2. Hide any results containers
      const resultsContainer = document.querySelector('.results-container');
      if (resultsContainer) {
        resultsContainer.style.display = 'none';
      }
      
      // 3. Reset any active tabs to the first tab
      this.switchTab('analyze-tab', 'analyze');
      
      // 4. Clear any loading indicators
      this.cancelLoading();
      
      // 5. Reset form fields to defaults where needed
      const toneOptions = document.querySelectorAll('input[name="tone"]');
      if (toneOptions && toneOptions.length > 0) {
        toneOptions.forEach(option => option.checked = false);
      }
      
      const typeOptions = document.querySelectorAll('input[name="post-type"]');
      if (typeOptions && typeOptions.length > 0) {
        typeOptions.forEach(option => option.checked = false);
      }
      
      // Show success toast
      this.showToast('Reset complete', 'success');
      
      // Check user sign-in state and update UI accordingly
      const isSignedIn = localStorage.getItem('isSignedIn') === 'true';
      this.updateSignInState(isSignedIn);
    } catch (error) {
      console.error('Error resetting to home:', error);
      this.showToast('Failed to reset completely', 'error');
    } finally {
      // Reset button state with slight delay for visual feedback
      setTimeout(() => {
        if (homeButton) {
          this.setButtonLoading(homeButton, false);
        }
      }, 300);
    }
  }

  showLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      // Use a timeout to ensure the fade-in animation works
      setTimeout(() => {
        overlay.classList.add('visible');
      }, 10);
    }
  }

  hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      // Give time for fade-out
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
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
    const { recoverable = false, duration = 5000 } = options;
    
    console.error(message);
    
    // Show error toast
    this.showToast(message, 'error');
    
    // Hide loading if active and error is not recoverable
    if (!recoverable) {
      this.cancelLoading();
    }
  }

  validateProfileInput(input) {
    return /^@\w+$/.test(input) || 
           /^https?:\/\/(www\.)?x\.com\/\w+\/?$/.test(input) ||
           /^https?:\/\/(www\.)?twitter\.com\/\w+\/?$/.test(input);
  }

  async showProgressiveLoading() {
    const stages = [
      { message: 'Connecting to X API...', progress: 15 },
      { message: 'Fetching profile data...', progress: 30 },
      { message: 'Analyzing engagement metrics...', progress: 45 },
      { message: 'Processing content patterns...', progress: 60 },
      { message: 'Calculating influence score...', progress: 75 },
      { message: 'Generating recommendations...', progress: 90 },
      { message: 'Finalizing results...', progress: 98 }
    ];

    for (const stage of stages) {
      this.updateLoadingStatus(stage.message, stage.progress);
      
      // Random delay between 300-700ms to make it feel more natural
      const delay = Math.floor(Math.random() * 400) + 300;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Simulate cancellation handling
      if (!this.isAnalyzing) {
        break;
      }
    }
    
    // Show complete message
    if (this.isAnalyzing) {
      this.updateLoadingStatus('Analysis complete!', 100);
    }
  }

  updateLoadingStatus(message, progress) {
    try {
      const loadingText = document.querySelector('.loading-text');
      const progressFill = document.querySelector('.progress-fill');
      
      if (loadingText) {
        // Fade out, update text, fade in
        loadingText.style.opacity = '0';
        setTimeout(() => {
          loadingText.textContent = message;
          loadingText.style.opacity = '1';
        }, 200);
      }
      
      if (progressFill) {
        // Animate the progress
        progressFill.style.width = `${progress}%`;
        
        // Add pulse animation when complete
        if (progress >= 100) {
          progressFill.classList.add('pulse-animation');
        } else {
          progressFill.classList.remove('pulse-animation');
        }
      }
      
      console.log(`Loading status: ${message} (${progress}%)`);
    } catch (error) {
      console.error('Error updating loading status:', error);
    }
  }

  pulseElement(element) {
    if (!element) return;
    
    try {
      // Add pulse animation class
      element.classList.add('pulse-animation');
      
      // Remove it after animation completes to allow retriggering
      setTimeout(() => {
        element.classList.remove('pulse-animation');
      }, 600); // Animation is 0.5s, we set timeout slightly longer
    } catch (error) {
      console.error('Error pulsing element:', error);
    }
  }

  shakeElement(element) {
    if (!element) return;
    
    try {
      // Add shake animation class
      element.classList.add('shake-animation');
      
      // Remove it after animation completes to allow retriggering
      setTimeout(() => {
        element.classList.remove('shake-animation');
      }, 600); // Animation is 0.5s, we set timeout slightly longer
    } catch (error) {
      console.error('Error shaking element:', error);
    }
  }

  switchTab(tabName) {
    console.log(`Switching to tab: ${tabName}`);
    
    try {
      // Get all tab buttons and content sections
      const tabButtons = document.querySelectorAll('.tab-button');
      const tabContents = document.querySelectorAll('.tab-content');
      
      // Find the target button and content
      const targetButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
      const targetContent = document.getElementById(tabName);
      
      if (!targetButton || !targetContent) {
        console.error(`Tab "${tabName}" not found. Available tabs:`, 
          Array.from(tabButtons).map(btn => btn.getAttribute('data-tab')));
        this.showToast(`Error switching tabs`, 'error');
        return;
      }
      
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to target tab
      targetButton.classList.add('active');
      targetContent.classList.add('active');
      
      // Add animation class
      targetButton.classList.add('tab-clicked');
      targetContent.classList.add('slide-in');
      
      // Remove animation classes after animation completes
      setTimeout(() => {
        targetButton.classList.remove('tab-clicked');
        targetContent.classList.remove('slide-in');
      }, 600);
      
      // Save current tab to localStorage
      localStorage.setItem('currentTab', tabName);
      
      console.log(`Successfully switched to tab: ${tabName}`);
    } catch (error) {
      console.error('Error switching tabs:', error);
      this.showToast('Error switching tabs', 'error');
    }
  }

  generatePost() {
    const generateButton = document.getElementById('generate-button');
    
    if (!generateButton) {
      console.error('Generate button not found');
      return;
    }
    
    try {
      // Check if already loading
      if (generateButton.classList.contains('loading')) {
        return;
      }
      
      // Get the form values
      const topic = document.getElementById('post-topic')?.value?.trim();
      const tone = document.querySelector('input[name="tone"]:checked')?.value;
      const type = document.querySelector('input[name="post-type"]:checked')?.value;
      
      // Validate required fields
      if (!topic) {
        this.shakeElement(document.getElementById('post-topic'));
        this.showToast('Please enter a topic for your post', 'error');
        return;
      }
      
      if (!tone) {
        this.shakeElement(document.querySelector('.tone-options'));
        this.showToast('Please select a tone for your post', 'error');
        return;
      }
      
      if (!type) {
        this.shakeElement(document.querySelector('.post-type-options'));
        this.showToast('Please select a post type', 'error');
        return;
      }
      
      // Set button to loading state
      this.setButtonLoading(generateButton, true, 'Generating...');
      
      // Generate the post
      this.generateSamplePost(topic, tone, type)
        .then(post => {
          // Update the post content area
          const postContent = document.getElementById('post-content');
          if (postContent) {
            postContent.value = post;
            
            // Trigger input event to update character count
            const inputEvent = new Event('input', { bubbles: true });
            postContent.dispatchEvent(inputEvent);
            
            // Focus and select all text in the textarea
            postContent.focus();
            postContent.select();
          }
          
          // Show success toast
          this.showToast('Post generated successfully!', 'success');
        })
        .catch(error => {
          console.error('Error generating post:', error);
          this.showToast('Failed to generate post. Please try again.', 'error');
        })
        .finally(() => {
          // Reset button state
          this.setButtonLoading(generateButton, false);
        });
    } catch (error) {
      console.error('Error in generatePost:', error);
      this.showToast('An unexpected error occurred', 'error');
      this.setButtonLoading(generateButton, false);
    }
  }
  
  async generateSamplePost(topic, tone, type) {
    // Display loading animation while "fetching" from AI service
    const postContent = document.getElementById('post-content');
    if (postContent) {
      postContent.value = 'Generating post...';
    }
    
    // Simulate network delay with AI generation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In a real app, this would call an AI service API
    // For demo purposes, we'll use predefined templates and combinations
    
    // Create intro phrases based on tone
    const introsByTone = {
      professional: [
        "I'm pleased to share insights on",
        "An important update regarding",
        "Let's discuss the implications of",
        "A professional perspective on"
      ],
      casual: [
        "Hey everyone! Just thinking about",
        "So I've been exploring",
        "Wanted to share my thoughts on",
        "Anyone else interested in"
      ],
      enthusiastic: [
        "I'm incredibly excited about",
        "Just discovered something amazing about",
        "Can't contain my enthusiasm for",
        "Absolutely loving the latest developments in"
      ],
      informative: [
        "Here are the key facts about",
        "An analysis of",
        "Important information regarding",
        "What you need to know about"
      ]
    };
    
    // Create hashtags related to the topic
    const getHashtags = (topic) => {
      const words = topic.toLowerCase().split(' ');
      const hashtags = [];
      
      // Create hashtags from individual words and combinations
      words.forEach(word => {
        if (word.length > 3) {
          hashtags.push(`#${word.replace(/[^a-z0-9]/g, '')}`);
        }
      });
      
      // Add some generic hashtags based on the type and tone
      if (type === 'question') hashtags.push('#ThoughtsOnThis', '#YourOpinion');
      if (type === 'announcement') hashtags.push('#Announcement', '#Update');
      if (type === 'discussion') hashtags.push('#LetsTalk', '#Discussion');
      if (tone === 'professional') hashtags.push('#Professional', '#Industry');
      
      // Return a random selection of 2-3 hashtags
      return hashtags
        .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        .sort(() => 0.5 - Math.random()) // Shuffle
        .slice(0, Math.min(3, hashtags.length)) // Take 2-3
        .join(' ');
    };
    
    // Create call-to-actions based on post type
    const ctasByType = {
      discussion: [
        "What are your thoughts on this?",
        "I'd love to hear your perspective.",
        "Let's continue this conversation!",
        "Share your experiences below."
      ],
      question: [
        "Has anyone else experienced this?",
        "What's your take on this matter?",
        "Any insights you can share?",
        "What would you recommend in this situation?"
      ],
      announcement: [
        "Stay tuned for more updates!",
        "More details coming soon.",
        "Let me know if you have any questions.",
        "Looking forward to your feedback."
      ],
      opinion: [
        "These are my personal views. What's your opinion?",
        "I believe this approach makes sense. Your thoughts?",
        "This perspective has worked for me. Does it resonate with you?",
        "That's my take on the situation. Would love to hear yours."
      ]
    };
    
    // Select random components
    const intro = introsByTone[tone][Math.floor(Math.random() * introsByTone[tone].length)];
    const cta = ctasByType[type][Math.floor(Math.random() * ctasByType[type].length)];
    const hashtags = getHashtags(topic);
    
    // Generate content based on type
    let content = '';
    switch (type) {
      case 'discussion':
        content = `${intro} ${topic}. I've noticed several interesting trends emerging in this area that could impact how we approach our strategies going forward. ${cta}`;
        break;
      case 'question':
        content = `${intro} ${topic}? I'm curious about the different perspectives and experiences related to this subject. ${cta}`;
        break;
      case 'announcement':
        content = `${intro} ${topic}! I'm thrilled to share this development that represents a significant milestone. ${cta}`;
        break;
      case 'opinion':
        content = `${intro} ${topic}. Based on my experience, this represents a significant opportunity that shouldn't be overlooked. ${cta}`;
        break;
      default:
        content = `${intro} ${topic}. ${cta}`;
    }
    
    // Add hashtags if we have room (X character limit is 280)
    const postWithHashtags = `${content}\n\n${hashtags}`;
    if (postWithHashtags.length <= 280) {
      return postWithHashtags;
    }
    
    // If too long, return without hashtags
    return content;
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
   try {
     const postContent = document.getElementById('post-content');
     
     if (!postContent) {
       console.error('Post content textarea not found');
       return;
     }
     
     const content = postContent.value.trim();
     
     if (!content) {
       this.shakeElement(postContent);
       this.showToast('Please enter content for your post', 'error');
       return;
     }
     
     // Check character limit
     if (content.length > 280) {
       this.shakeElement(postContent);
       this.showToast(`Post exceeds character limit (${content.length}/280)`, 'error');
       return;
     }
     
     // Show confirmation modal
     this.showConfirmationModal(
       'Post to X',
       'Would you like to post this content to X now?',
       () => {
         // In a real implementation, this would use the X API to post
         // For demo purposes, we'll simulate success
         this.simulatePosting(content);
       }
     );
   } catch (error) {
     console.error('Error in handlePostNow:', error);
     this.showToast('Failed to process post request', 'error');
   }
 }

 simulatePosting(content) {
   const postButton = document.querySelector('.post-now-button');
   
   try {
     // Show loading state
     if (postButton) {
       this.setButtonLoading(postButton, true, 'Posting...');
     }
     
     this.showToast('Connecting to X...', 'info');
     
     // Simulate network delay
     setTimeout(() => {
       try {
         // Show success message
         this.showToast('Posted successfully to X!', 'success');
         
         // Clear post content
         const postContent = document.getElementById('post-content');
         if (postContent) {
           postContent.value = '';
           
           // Trigger input event to update character count
           const inputEvent = new Event('input', { bubbles: true });
           postContent.dispatchEvent(inputEvent);
         }
         
         // Add to history (in a real app, this would store the actual post data)
         this.addToHistory({
           type: 'post',
           content: content,
           timestamp: new Date().toISOString()
         });
         
         // Reset button state
         if (postButton) {
           this.setButtonLoading(postButton, false);
         }
       } catch (innerError) {
         console.error('Error in post simulation completion:', innerError);
         this.showToast('Failed to complete posting', 'error');
         
         if (postButton) {
           this.setButtonLoading(postButton, false);
         }
       }
     }, 2000);
   } catch (error) {
     console.error('Error simulating post:', error);
     this.showToast('Failed to process post', 'error');
     
     if (postButton) {
       this.setButtonLoading(postButton, false);
     }
   }
 }

 addToHistory(item) {
   try {
     // Get existing history from localStorage
     const history = JSON.parse(localStorage.getItem('history') || '[]');
     
     // Add new item at the beginning
     history.unshift(item);
     
     // Limit history to 10 items
     const limitedHistory = history.slice(0, 10);
     
     // Save back to localStorage
     localStorage.setItem('history', JSON.stringify(limitedHistory));
     
     // If we're on the history tab, refresh it
     const historyTab = document.querySelector('.tab-content[data-tab="history"]');
     if (historyTab && historyTab.classList.contains('active')) {
       this.updateHistoryTab();
     }
   } catch (error) {
     console.error('Error adding to history:', error);
   }
 }

 updateHistoryTab() {
   try {
     const historyContainer = document.querySelector('.history-list');
     
     if (!historyContainer) {
       console.warn('History container not found');
       return;
     }
     
     // Get history from localStorage
     const history = JSON.parse(localStorage.getItem('history') || '[]');
     
     // Clear container
     historyContainer.innerHTML = '';
     
     if (history.length === 0) {
       // Show empty state
       historyContainer.innerHTML = `
         <div class="empty-state">
           <div class="empty-icon">📝</div>
           <p>No history yet</p>
           <p class="empty-description">Your analyses and posts will appear here</p>
         </div>
       `;
       return;
     }
     
     // Add each history item
     history.forEach((item, index) => {
       const historyItem = document.createElement('div');
       historyItem.className = 'history-item';
       historyItem.setAttribute('data-index', index);
       
       // Format based on type
       if (item.type === 'post') {
         historyItem.innerHTML = `
           <div class="history-content">
             <div class="history-title">
               <span class="history-type-badge post">Post</span>
               <span class="history-date">${this.formatDate(new Date(item.timestamp))}</span>
             </div>
             <div class="history-details">
               <p>${item.content}</p>
             </div>
           </div>
           <div class="history-actions">
             <button class="history-action reuse-post" data-action="reuse" data-index="${index}">
               <svg viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M4 2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4v4l-4-4H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v12h8.1l1.9 1.9V16h4V4H4z"/>
               </svg>
               Reuse
             </button>
             <button class="history-action remove-history" data-action="remove" data-index="${index}">
               <svg viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
               </svg>
               Remove
             </button>
           </div>
         `;
       } else {
         // Analysis item
         historyItem.innerHTML = `
           <div class="history-content">
             <div class="history-title">
               <span class="history-type-badge analysis">Analysis</span>
               <span class="history-date">${this.formatDate(new Date(item.timestamp))}</span>
             </div>
             <div class="history-details">
               <p>${item.username ? `@${item.username}` : 'Profile analysis'}</p>
             </div>
           </div>
           <div class="history-actions">
             <button class="history-action" data-action="view" data-index="${index}">
               <svg viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M12 9a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5 5 5 0 0 1 5-5 5 5 0 0 1 5 5 5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/>
               </svg>
               View
             </button>
             <button class="history-action remove-history" data-action="remove" data-index="${index}">
               <svg viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
               </svg>
               Remove
             </button>
           </div>
         `;
       }
       
       // Add with animation
       setTimeout(() => {
         historyContainer.appendChild(historyItem);
         setTimeout(() => {
           historyItem.classList.add('visible');
         }, 50);
       }, index * 50);
     });
     
     // Add event listeners
     setTimeout(() => {
       // View action
       document.querySelectorAll('.history-action[data-action="view"]').forEach(button => {
         button.addEventListener('click', (e) => {
           this.createRippleEffect(e);
           const index = parseInt(button.getAttribute('data-index'), 10);
           this.viewHistoryItem(index);
         });
       });
       
       // Reuse action
       document.querySelectorAll('.history-action[data-action="reuse"]').forEach(button => {
         button.addEventListener('click', (e) => {
           this.createRippleEffect(e);
           const index = parseInt(button.getAttribute('data-index'), 10);
           this.reuseHistoryItem(index);
         });
       });
       
       // Remove action
       document.querySelectorAll('.history-action[data-action="remove"]').forEach(button => {
         button.addEventListener('click', (e) => {
           this.createRippleEffect(e);
           const index = parseInt(button.getAttribute('data-index'), 10);
           this.removeHistoryItem(index);
         });
       });
     }, history.length * 50 + 100);
   } catch (error) {
     console.error('Error updating history tab:', error);
   }
 }

 formatDate(date) {
   try {
     const now = new Date();
     const diff = Math.floor((now - date) / 1000); // seconds difference
     
     if (diff < 60) {
       return 'Just now';
     } else if (diff < 3600) {
       const minutes = Math.floor(diff / 60);
       return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
     } else if (diff < 86400) {
       const hours = Math.floor(diff / 3600);
       return `${hours} hour${hours > 1 ? 's' : ''} ago`;
     } else if (diff < 604800) {
       const days = Math.floor(diff / 86400);
       return `${days} day${days > 1 ? 's' : ''} ago`;
     } else {
       return date.toLocaleDateString();
     }
   } catch (error) {
     console.error('Error formatting date:', error);
     return 'Unknown date';
   }
 }

 viewHistoryItem(index) {
   try {
     const history = JSON.parse(localStorage.getItem('history') || '[]');
     const item = history[index];
     
     if (!item) {
       this.showToast('History item not found', 'error');
       return;
     }
     
     if (item.type === 'analysis') {
       // Switch to analyze tab
       this.switchTab('analyze-tab', 'analyze');
       
       // Fill profile input if available
       if (item.username) {
         const profileInput = document.getElementById('profile-input');
         if (profileInput) {
           profileInput.value = `@${item.username}`;
           
           // Trigger analysis
           setTimeout(() => {
             this.handleAnalyze();
           }, 300);
         }
       }
     }
     
     this.showToast('History item loaded', 'success');
   } catch (error) {
     console.error('Error viewing history item:', error);
     this.showToast('Failed to load history item', 'error');
   }
 }

 reuseHistoryItem(index) {
   try {
     const history = JSON.parse(localStorage.getItem('history') || '[]');
     const item = history[index];
     
     if (!item) {
       this.showToast('History item not found', 'error');
       return;
     }
     
     if (item.type === 'post') {
       // Switch to compose tab
       this.switchTab('compose-tab', 'compose');
       
       // Fill post content
       const postContent = document.getElementById('post-content');
       if (postContent && item.content) {
         postContent.value = item.content;
         
         // Trigger input event to update character count
         const inputEvent = new Event('input', { bubbles: true });
         postContent.dispatchEvent(inputEvent);
         
         // Focus and select
         postContent.focus();
         postContent.select();
       }
       
       this.showToast('Post content loaded', 'success');
     }
   } catch (error) {
     console.error('Error reusing history item:', error);
     this.showToast('Failed to load post content', 'error');
   }
 }

 removeHistoryItem(index) {
   try {
     // Show confirmation
     this.showConfirmationModal(
       'Remove Item',
       'Are you sure you want to remove this item from your history?',
       () => {
         try {
           // Get history
           const history = JSON.parse(localStorage.getItem('history') || '[]');
           
           // Remove item
           history.splice(index, 1);
           
           // Save back to localStorage
           localStorage.setItem('history', JSON.stringify(history));
           
           // Update history tab
           this.updateHistoryTab();
           
           this.showToast('Item removed from history', 'success');
         } catch (error) {
           console.error('Error removing history item:', error);
           this.showToast('Failed to remove item', 'error');
         }
       }
     );
   } catch (error) {
     console.error('Error initiating history item removal:', error);
     this.showToast('Failed to process removal request', 'error');
   }
 }

 // Add a cancel button to the loading overlay
 addCancelButton() {
   const cancelButton = document.getElementById('cancel-analysis-button');
   if (cancelButton) {
     cancelButton.addEventListener('click', () => {
       this.cancelLoading();
     });
   }
 }

 // Remove the cancel button
 removeCancelButton() {
   const cancelButton = document.getElementById('cancel-analysis-button');
   if (cancelButton) {
     // Clone to remove event listeners
     const newCancelButton = cancelButton.cloneNode(true);
     if (cancelButton.parentNode) {
       cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
     }
   }
 }

 showConfirmationModal(title, message, confirmCallback) {
   return new Promise((resolve) => {
     try {
       // Create modal element
       const modal = document.createElement('div');
       modal.className = 'modal confirmation-modal';
       modal.innerHTML = `
         <div class="modal-content">
           <div class="modal-header">
             <h3>${title}</h3>
             <button class="close-modal" aria-label="Close">×</button>
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
       
       // Add to body
       document.body.appendChild(modal);
       
       // Add fade-in effect
       setTimeout(() => modal.classList.add('visible'), 10);
       
       // Define event handlers
       const handleClose = () => {
         modal.classList.remove('visible');
         setTimeout(() => {
           modal.remove();
           resolve(false);
         }, 300);
       };
       
       const handleConfirm = () => {
         modal.classList.remove('visible');
         setTimeout(() => {
           modal.remove();
           if (confirmCallback) {
             confirmCallback();
           }
           resolve(true);
         }, 300);
       };
       
       // Add event listeners
       modal.querySelector('.close-modal')?.addEventListener('click', handleClose);
       modal.querySelector('.cancel-button')?.addEventListener('click', handleClose);
       modal.querySelector('.confirm-button')?.addEventListener('click', handleConfirm);
       
       // Close on click outside modal content
       modal.addEventListener('click', (e) => {
         if (e.target === modal) {
           handleClose();
         }
       });
       
       // Close on Escape key
       document.addEventListener('keydown', function escHandler(e) {
         if (e.key === 'Escape') {
           document.removeEventListener('keydown', escHandler);
           handleClose();
         }
       });
     } catch (error) {
       console.error('Error showing confirmation modal:', error);
       resolve(false);
     }
   });
 }

 cancelLoading() {
   try {
     console.log('Cancelling loading process...');
     
     // Stop any active loading processes
     if (this.loadingAbortController) {
       this.loadingAbortController.abort();
       this.loadingAbortController = null;
     }
     
     // Clear any loading timeouts
     if (this.loadingTimeout) {
       clearTimeout(this.loadingTimeout);
       this.loadingTimeout = null;
     }
     
     // Hide loading overlay
     const loadingOverlay = document.querySelector('.loading-overlay');
     if (loadingOverlay) {
       loadingOverlay.classList.add('hidden');
     }
     
     // Reset analyze button state
     const analyzeButton = document.getElementById('analyze-button');
     if (analyzeButton) {
       this.setButtonLoading(analyzeButton, false);
     }
     
     // Reset any other loading buttons
     document.querySelectorAll('.button-loading').forEach(button => {
       this.setButtonLoading(button, false);
     });
     
     // Show toast notification
     this.showToast('Operation cancelled', 'info');
     
     // Reset internal state
     this.isLoading = false;
     this.loadingProgress = 0;
   } catch (error) {
     console.error('Error cancelling loading:', error);
   }
 }
}

// Make available globally
window.InteractionManager = InteractionManager;