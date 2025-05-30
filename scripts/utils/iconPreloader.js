/**
 * Icon Preloader for X Profile Analyzer
 * Helps load icons asynchronously to improve UI responsiveness
 */

class IconPreloader {
  constructor(options = {}) {
    this.iconPaths = options.iconPaths || [];
    this.preloadedIcons = new Map();
    this.loadPromises = [];
    this.initialized = false;
  }

  // Add icon path to preload queue
  addIconPath(path) {
    if (!this.iconPaths.includes(path)) {
      this.iconPaths.push(path);
    }
    return this;
  }

  // Add multiple icon paths
  addIconPaths(paths = []) {
    for (const path of paths) {
      this.addIconPath(path);
    }
    return this;
  }

  // Preload a single icon
  async preloadIcon(path) {
    if (this.preloadedIcons.has(path)) {
      return this.preloadedIcons.get(path);
    }
    
    return new Promise((resolve) => {
      try {
        const img = new Image();
        
        img.onload = () => {
          this.preloadedIcons.set(path, img);
          resolve({ path, success: true, image: img });
        };
        
        img.onerror = () => {
          console.warn(`Failed to preload icon: ${path}`);
          resolve({ path, success: false });
        };
        
        // Get correct path for extension resources
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          img.src = chrome.runtime.getURL(path);
        } else {
          img.src = path;
        }
      } catch (e) {
        console.error('Error preloading icon:', e);
        resolve({ path, success: false, error: e });
      }
    });
  }

  // Preload all icons
  async preloadAllIcons() {
    const loadPromises = this.iconPaths.map(path => this.preloadIcon(path));
    const results = await Promise.allSettled(loadPromises);
    
    // Count successful loads
    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;
    
    this.initialized = true;
    
    return {
      total: this.iconPaths.length,
      success: successCount,
      failed: this.iconPaths.length - successCount
    };
  }

  // Get a preloaded icon
  getIcon(path) {
    return this.preloadedIcons.get(path);
  }

  // Clear all preloaded icons from memory
  clearIcons() {
    this.preloadedIcons.clear();
    return this;
  }
}

// Create global instance
window.IconPreloader = IconPreloader; 