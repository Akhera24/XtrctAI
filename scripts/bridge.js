/**
 * Bridge script for X Profile Analyzer
 * Facilitates communication between components and provides global helper functions
 */

// Create a global namespace for the extension
window.XProfileAnalyzer = window.XProfileAnalyzer || {};

// UI helper functions
window.XProfileAnalyzer.UI = {
  // Toast notifications
  showToast: function(message, type = 'info') {
    console.log(`[TOAST] ${message} (${type})`);
    
    // Try to find existing toast container or create one
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
        <button class="toast-close">&times;</button>
      </div>
    `;
    
    // Add close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 300);
      });
    }
    
    // Add to container
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => {
          if (toast.parentNode) container.removeChild(toast);
        }, 300);
      }
    }, 5000);
  },
  
  // Loading overlay
  showLoading: function(message) {
    console.log(`[LOADING] ${message}`);
    
    // Find or create loading overlay
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">${message || 'Loading...'}</p>
          <div class="progress-container">
            <div class="progress-track">
              <div class="progress-fill" style="width: 0%"></div>
            </div>
          </div>
          <button class="cancel-button">Cancel</button>
        </div>
      `;
      document.body.appendChild(overlay);
      
      // Add cancel button functionality
      const cancelBtn = overlay.querySelector('.cancel-button');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          // Trigger a custom event that handlers can listen for
          const event = new CustomEvent('analysis-cancelled');
          document.dispatchEvent(event);
          
          // Hide the overlay
          window.XProfileAnalyzer.UI.hideLoading();
        });
      }
    } else {
      // Update existing overlay
      const loadingText = overlay.querySelector('.loading-text');
      if (loadingText && message) {
        loadingText.textContent = message;
      }
    }
    
    // Show the overlay
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('visible'), 10);
  },
  
  // Hide loading
  hideLoading: function() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.classList.add('hidden'), 300);
    }
  },
  
  // Update progress bar
  updateProgress: function(selector, percent) {
    if (typeof percent !== 'number') {
      console.error('updateProgress requires a number');
      return;
    }
    
    // Clamp value between 0-100
    percent = Math.max(0, Math.min(100, percent));
    
    // Find progress element
    let progressElement;
    if (typeof selector === 'string') {
      progressElement = document.querySelector(selector);
    } else if (selector instanceof Element) {
      progressElement = selector;
    } else {
      progressElement = document.querySelector('.progress-fill');
    }
    
    // Update width
    if (progressElement) {
      progressElement.style.width = `${percent}%`;
      
      // Add animation when complete
      if (percent >= 100) {
        progressElement.classList.add('complete');
      } else {
        progressElement.classList.remove('complete');
      }
    }
  }
};

// Events system
window.XProfileAnalyzer.Events = {
  listeners: {},
  
  on: function(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },
  
  off: function(event, callback) {
    if (!this.listeners[event]) return;
    if (!callback) {
      delete this.listeners[event];
      return;
    }
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  },
  
  emit: function(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
};

// API utilities
window.XProfileAnalyzer.API = {
  testConnection: function() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'testApiConnection',
        forceCheck: true
      }, function(response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response || !response.success) {
          reject(new Error(response?.error || 'Unknown API test error'));
        } else {
          resolve(response);
        }
      });
    });
  },
  
  analyzeProfile: function(username) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'analyzeProfile',
        username: username
      }, function(response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response || !response.success) {
          reject(new Error(response?.error || 'Unknown analysis error'));
        } else {
          resolve(response);
        }
      });
    });
  }
};

// Export direct references for convenience
window.showToast = window.XProfileAnalyzer.UI.showToast;
window.showLoading = window.XProfileAnalyzer.UI.showLoading;
window.hideLoading = window.XProfileAnalyzer.UI.hideLoading;
window.updateProgress = window.XProfileAnalyzer.UI.updateProgress;

// Self-initialize
console.log('Bridge script initialized');

// Make sure we're actually adding styles for our UI elements
(function() {
  // Add CSS styles if not already present
  if (!document.querySelector('#x-profile-analyzer-styles')) {
    const style = document.createElement('style');
    style.id = 'x-profile-analyzer-styles';
    style.textContent = `
      /* Toast notifications */
      .toast-container {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .toast {
        background-color: #f8f9fa;
        color: #212529;
        border-left: 4px solid #1d9bf0;
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        width: 280px;
        max-width: 100%;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
      }
      
      .toast.show {
        opacity: 1;
        transform: translateY(0);
      }
      
      .toast.error {
        border-left-color: #e0245e;
      }
      
      .toast.success {
        border-left-color: #17bf63;
      }
      
      .toast.warning {
        border-left-color: #f45d22;
      }
      
      .toast-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .toast-message {
        flex: 1;
      }
      
      .toast-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        margin-left: 8px;
        padding: 0;
        color: #536471;
      }
      
      /* Loading overlay */
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9998;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .loading-overlay.visible {
        opacity: 1;
      }
      
      .loading-overlay.hidden {
        display: none;
      }
      
      .loading-content {
        background-color: #1d9bf0;
        color: white;
        border-radius: 8px;
        padding: 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 80%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .loading-spinner {
        display: inline-block;
        width: 36px;
        height: 36px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s linear infinite;
        margin-bottom: 16px;
      }
      
      .loading-text {
        font-size: 16px;
        margin-bottom: 16px;
      }
      
      .progress-container {
        width: 100%;
        margin-bottom: 16px;
      }
      
      .progress-track {
        height: 6px;
        background-color: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
        overflow: hidden;
      }
      
      .progress-fill {
        height: 100%;
        background-color: white;
        border-radius: 3px;
        width: 0%;
        transition: width 0.3s ease;
      }
      
      .progress-fill.complete {
        animation: pulse 1.5s infinite;
      }
      
      .cancel-button {
        background-color: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        border-radius: 16px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }
      
      .cancel-button:hover {
        background-color: rgba(255, 255, 255, 0.3);
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.6; }
        100% { opacity: 1; }
      }
      
      /* Dark theme support */
      [data-theme="dark"] .loading-overlay {
        background-color: rgba(0, 0, 0, 0.8);
      }
      
      [data-theme="dark"] .toast {
        background-color: #15202b;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
    `;
    document.head.appendChild(style);
  }
})(); 