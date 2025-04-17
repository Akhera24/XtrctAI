/**
 * Manages extension icon states and transitions with improved error handling
 */
class IconManager {
  constructor() {
    // Use simple image paths instead of data URLs
    this.states = {
      default: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      },
      active: {
        16: 'icons/icon16.png',  // Fallback to default if active not available
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      },
      disabled: {
        16: 'icons/icon16.png',  // Fallback to default if disabled not available
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      },
      error: {
        16: 'icons/icon16.png',  // Fallback to default if error not available
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      },
      warn: {
        16: 'icons/icon16.png',  // Fallback to default if warn not available
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      }
    };
    
    // Initialize icon state tracking
    this.currentState = 'default';
    this.loadingInterval = null;
    
    // Pre-load icons to ensure availability
    this.preloadIcons();
  }

  /**
   * Preload all icons to cache
   */
  async preloadIcons() {
    try {
      console.log('Preloading extension icons...');
      
      // Don't use Image class in service workers
      if (typeof self !== 'undefined' && typeof window === 'undefined') {
        // Service worker environment - skip Image-based preloading
        console.log('Running in service worker, skipping Image-based preloading');
        return;
      }
      
      // Use Image objects for browser context
      const preloadPromises = Object.values(this.states).flatMap(sizes => 
        Object.values(sizes).map(path => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => {
              console.warn(`Failed to preload icon: ${path}`);
              resolve(false);
            };
            img.src = chrome.runtime.getURL(path);
          });
        })
      );
      
      // Wait for all icons to load
      await Promise.allSettled(preloadPromises);
      console.log('Icon preloading complete');
    } catch (error) {
      console.error('Error preloading icons:', error);
    }
  }

  /**
   * Safely set icon state with robust error handling
   * @param {string} state - 'default' | 'active' | 'disabled' | 'error' | 'warn'
   */
  async setIconState(state) {
    try {
      if (!this.states[state]) {
        console.warn(`Invalid icon state: ${state}, falling back to default`);
        state = 'default';
      }
      
      this.currentState = state;

      // Get paths for all icon sizes
      const path = this.states[state];
      
      // Use badge as a visual indicator of state (better than icon which may fail)
      let badgeText = '';
      let badgeColor = '#1976D2';  // Default blue
      
      switch (state) {
        case 'error':
          badgeText = '!';
          badgeColor = '#E53935';  // Red
          break;
        case 'warn':
          badgeText = '?';
          badgeColor = '#FFB300';  // Amber
          break;
        case 'active':
          badgeText = '+';
          badgeColor = '#43A047';  // Green
          break;
        case 'disabled':
          badgeText = '-';
          badgeColor = '#9E9E9E';  // Grey
          break;
      }
      
      // Set badge text and color for visual indication even if icon fails
      await chrome.action.setBadgeText({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
      
      // Handle potential errors when setting the icon
      return new Promise((resolve) => {
        chrome.action.setIcon({ path }, () => {
          if (chrome.runtime.lastError) {
            console.warn('Error setting icon:', chrome.runtime.lastError.message);
            // We still resolve as success since we have the badge as backup
          }
          resolve();
        });
      });
    } catch (error) {
      console.error('Error in setIconState:', error);
      // Badge should still work even if icon fails
    }
  }

  /**
   * Show loading state with animation
   */
  showLoading() {
    try {
      // Clear any existing interval first
      this.stopLoading();
      
      let frame = 0;
      const frames = ['active', 'default'];
      
      this.loadingInterval = setInterval(() => {
        try {
          this.setIconState(frames[frame % frames.length]);
          frame++;
        } catch (error) {
          console.error('Error in loading animation:', error);
          this.stopLoading();
        }
      }, 600);
    } catch (error) {
      console.error('Error starting loading animation:', error);
    }
  }

  /**
   * Stop loading animation
   */
  stopLoading() {
    try {
      if (this.loadingInterval) {
        clearInterval(this.loadingInterval);
        this.loadingInterval = null;
      }
      
      this.setIconState('default');
    } catch (error) {
      console.error('Error stopping loading animation:', error);
    }
  }

  /**
   * Show temporary success state
   */
  showSuccess() {
    try {
      this.setIconState('active');
      setTimeout(() => {
        this.setIconState('default');
      }, 1500);
    } catch (error) {
      console.error('Error showing success state:', error);
    }
  }

  /**
   * Show temporary error state
   */
  showError() {
    try {
      this.setIconState('error');
      setTimeout(() => {
        this.setIconState('default');
      }, 1500);
    } catch (error) {
      console.error('Error showing error state:', error);
    }
  }

  /**
   * Ensure that all extension icons are properly loaded
   * @returns {Promise<boolean>} True if icons were loaded successfully
   */
  async ensureIconsLoaded() {
    try {
      // Don't use Image class in service workers
      if (typeof self !== 'undefined' && typeof window === 'undefined') {
        console.log('Running in service worker, skipping Image-based icon verification');
        return true;
      }
      
      // Try to load at least the default icon
      const defaultIcon = this.states.default[16];
      
      return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          console.log('Verified default icon is available');
          resolve(true);
        };
        
        img.onerror = () => {
          console.warn('Default icon could not be loaded, but we will continue');
          resolve(false);  // Still resolve, we'll use badge as fallback
        };
        
        img.src = chrome.runtime.getURL(defaultIcon);
        
        // Add timeout to avoid hanging
        setTimeout(() => {
          resolve(false);
        }, 2000);
      });
    } catch (error) {
      console.error('Error checking icons:', error);
      return false;
    }
  }

  /**
   * Generate fallback icons programmatically - NOOP since we don't use SVG anymore
   * @returns {Promise<void>}
   */
  async generateFallbackIcons() {
    console.log('Using simple icon paths instead of generated icons');
    return Promise.resolve();
  }
}

// Export as a module
export const iconManager = new IconManager(); 