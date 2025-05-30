/**
 * Icon State Manager for X Profile Analyzer
 * Manages icon states and provides paths for different states and sizes
 */

// Define standard icon states
const IconStates = {
  DEFAULT: 'default',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  ERROR: 'error'
};

// Define standard icon sizes
const IconSizes = {
  SMALL: 16,
  MEDIUM: 48,
  LARGE: 128
};

// Define standard icon colors
const IconColors = {
  DEFAULT: '#000000',
  ACTIVE: '#1DA1F2',
  DISABLED: '#657786',
  ERROR: '#E53935',
  HOVER: 'rgba(29, 161, 242, 0.1)'
};

/**
 * Get the icon path for a specific state and size
 */
function getIconPath(state, size) {
  // Default icon path
  let path = `icons/icon${size}.png`;
  
  // Special state icon paths
  if (state !== IconStates.DEFAULT) {
    path = `icons/${state}/icon${size}-${state}.png`;
  }
  
  return path;
}

/**
 * Load all icons for a specific state
 */
function preloadIconState(state) {
  const paths = [
    getIconPath(state, IconSizes.SMALL),
    getIconPath(state, IconSizes.MEDIUM),
    getIconPath(state, IconSizes.LARGE)
  ];
  
  // Load each icon
  const loadPromises = paths.map(path => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = reject;
      
      // Use chrome.runtime.getURL for extension context
      try {
        img.src = chrome.runtime.getURL(path);
      } catch (e) {
        img.src = path;
      }
    });
  });
  
  return Promise.allSettled(loadPromises);
}

// Make available globally
window.IconStates = IconStates;
window.IconSizes = IconSizes;
window.IconColors = IconColors;
window.getIconPath = getIconPath;
window.preloadIconState = preloadIconState; 