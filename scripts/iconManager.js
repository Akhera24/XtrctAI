/**
 * Icon state manager with fallback mechanisms and error handling
 */
export const iconManager = {
  /**
   * Set the extension icon state
   * @param {string} state - The icon state to set ('default', 'active', 'error', 'warn')
   * @returns {Promise<void>}
   */
  async setIconState(state) {
    try {
      console.log(`Setting icon state to ${state}`);
      
      // Use different paths depending on the state
      const iconPath = getIconPathForState(state);
      
      // Use the standard approach
      await setIconWithPaths(iconPath);
    } catch (error) {
      console.error('Error setting icon state:', error);
      
      // Try basic fallback
      try {
        // Just use default icon as fallback
        await chrome.action.setIcon({
          path: {
            "16": "/icons/icon16.png",
            "48": "/icons/icon48.png",
            "128": "/icons/icon128.png"
          }
        });
        
        // Also use badge text to indicate state if icon failed
        const badgeText = state === 'error' ? '!' : 
                         state === 'warn' ? '?' : 
                         state === 'active' ? '+' : '';
                         
        const badgeColor = state === 'error' ? '#E53935' : 
                          state === 'warn' ? '#FFB300' : 
                          state === 'active' ? '#43A047' : 
                          '#1976D2';
        
        await chrome.action.setBadgeText({ text: badgeText });
        await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
      } catch (fallbackError) {
        console.error('Even icon fallback failed:', fallbackError);
      }
    }
  },
  
  /**
   * Preload all icons to ensure they are available
   * @returns {Promise<void>}
   */
  async preloadIcons() {
    try {
      console.log('Preloading extension icons...');
      
      // Create an array of all icon paths to preload
      const iconsToPreload = [
        '/icons/icon16.png',
        '/icons/icon48.png',
        '/icons/icon128.png',
        '/icons/icon16-active.png',
        '/icons/icon48-active.png',
        '/icons/icon128-active.png',
        '/icons/icon16-error.png',
        '/icons/icon48-error.png',
        '/icons/icon128-error.png',
        '/icons/icon16-warn.png',
        '/icons/icon48-warn.png',
        '/icons/icon128-warn.png'
      ];
      
      // Preload all icons
      const preloadPromises = iconsToPreload.map(iconPath => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => {
            console.warn(`Failed to preload icon: ${iconPath}`);
            resolve(false);
          };
          img.src = chrome.runtime.getURL(iconPath.startsWith('/') ? iconPath.substring(1) : iconPath);
        });
      });
      
      // Wait for all icons to load
      await Promise.all(preloadPromises);
      console.log('Icon preloading complete');
    } catch (error) {
      console.error('Error preloading icons:', error);
    }
  }
};

/**
 * Get the appropriate icon path for the state
 * @param {string} state - The icon state
 * @returns {Object} Icon paths
 */
function getIconPathForState(state) {
  // Base icon paths
  const basePaths = {
    "16": "/icons/icon16.png",
    "32": "/icons/icon32.png",
    "48": "/icons/icon48.png",
    "128": "/icons/icon128.png"
  };
  
  // Return the appropriate icon paths based on state
  switch (state) {
    case 'active':
      return {
        "16": "/icons/icon16-active.png",
        "32": "/icons/icon32-active.png",
        "48": "/icons/icon48-active.png",
        "128": "/icons/icon128-active.png"
      };
    case 'error':
      return {
        "16": "/icons/icon16-error.png",
        "32": "/icons/icon32-error.png",
        "48": "/icons/icon48-error.png",
        "128": "/icons/icon128-error.png"
      };
    case 'warn':
      return {
        "16": "/icons/icon16-warn.png",
        "32": "/icons/icon32-warn.png",
        "48": "/icons/icon48-warn.png",
        "128": "/icons/icon128-warn.png"
      };
    default:
      return basePaths;
  }
}

/**
 * Set icon using standard paths method
 * @param {Object} iconPath - Icon paths
 */
async function setIconWithPaths(iconPath) {
  try {
    await chrome.action.setIcon({ path: iconPath });
  } catch (error) {
    console.warn('Error setting icon with paths, falling back to default:', error);
    // Try with fully qualified URLs
    const fullPaths = {};
    for (const [size, path] of Object.entries(iconPath)) {
      fullPaths[size] = chrome.runtime.getURL(path.startsWith('/') ? path.substring(1) : path);
    }
    try {
      await chrome.action.setIcon({ path: fullPaths });
    } catch (e) {
      console.error('Failed to set icon with full paths:', e);
      // Don't try to use data URLs as fallback, as they're causing errors
    }
  }
}

/**
 * Set icon using data URLs (for service worker environments)
 * @param {string} state - The icon state
 */
async function setIconWithDataUrl(state) {
  try {
    // Generate different colored icon based on state
    const color = state === 'error' ? '#E53935' : 
                 state === 'warn' ? '#FFB300' : 
                 state === 'active' ? '#43A047' : 
                 '#1976D2';
    
    // Generate small and large SVG icons
    const svgIcon16 = generateSvgIcon(16, color, state);
    const svgIcon48 = generateSvgIcon(48, color, state);
    
    // Convert SVGs to data URLs
    const dataUrl16 = svgToDataUrl(svgIcon16);
    const dataUrl48 = svgToDataUrl(svgIcon48);
    
    // Set the icon
    await chrome.action.setIcon({
      path: {
        "16": dataUrl16,
        "48": dataUrl48
      }
    });
    
    // Also set badge for additional state indication
    const badgeText = state === 'error' ? '!' : 
                     state === 'warn' ? '?' : 
                     state === 'active' ? '+' : '';
    
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch (error) {
    console.error('Error setting icon with data URL:', error);
    throw error; // Let the main function handle fallback
  }
}

/**
 * Generate an SVG icon
 * @param {number} size - Icon size
 * @param {string} color - Icon color
 * @param {string} state - Icon state
 * @returns {string} SVG string
 */
function generateSvgIcon(size, color, state) {
  // Define the SVG content based on state
  let svgContent;
  
  if (state === 'error') {
    // Error icon
    svgContent = `<path d="M${size/2} ${size/4}L${size*3/4} ${size/2}L${size/2} ${size*3/4}L${size/4} ${size/2}Z" fill="${color}"/>`;
  } else if (state === 'warn') {
    // Warning icon
    svgContent = `<circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="${color}"/>`;
  } else if (state === 'active') {
    // Active icon - checkmark
    svgContent = `<path d="M${size/4} ${size/2}L${size*2/5} ${size*2/3}L${size*3/4} ${size/3}" stroke="${color}" stroke-width="${size/8}" fill="none"/>`;
  } else {
    // Default icon - X logo
    svgContent = `
      <path d="M${size*0.2} ${size*0.2}L${size*0.8} ${size*0.8}M${size*0.2} ${size*0.8}L${size*0.8} ${size*0.2}" 
      stroke="${color}" stroke-width="${size/10}" stroke-linecap="round"/>`;
  }
  
  // Create the full SVG
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${svgContent}
  </svg>`;
}

/**
 * Convert SVG to data URL
 * @param {string} svg - SVG string
 * @returns {string} Data URL
 */
function svgToDataUrl(svg) {
  const encodedSvg = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
    
  return `data:image/svg+xml;charset=UTF-8,${encodedSvg}`;
}

// Initialize with default state, but don't throw if it fails
try {
  iconManager.setIconState('default')
    .catch(err => console.warn('Failed to set initial icon state:', err));
  
  // Also preload icons on script load
  iconManager.preloadIcons()
    .catch(err => console.warn('Failed to preload icons:', err));
} catch (e) {
  console.warn('Error during icon manager initialization:', e);
} 