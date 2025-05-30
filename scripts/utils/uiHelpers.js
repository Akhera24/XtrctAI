/**
 * UI Helper utilities for X Profile Analyzer
 * Contains reusable UI functions used across the extension
 */

// Create a single object to hold all UI helper functions
const uiHelpers = {
  // Global toast container reference
  toastContainer: null,

  /**
   * Shows a toast notification message
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'error', 'info', 'warning'
   * @param {number} duration - Duration in ms before auto-dismiss
   */
  showToast: function(message, type = 'info', duration = 3000) {
    console.log(`Toast (${type}): ${message}`);
    
    try {
      // Ensure we have a container
      if (!this.toastContainer) {
        this.toastContainer = document.querySelector('.toast-container');
        if (!this.toastContainer) {
          this.toastContainer = document.createElement('div');
          this.toastContainer.className = 'toast-container';
          document.body.appendChild(this.toastContainer);
          console.log('Created toast container');
        }
      }
      
      // Check if we already have too many toasts, remove oldest if needed
      const existingToasts = this.toastContainer.querySelectorAll('.toast');
      if (existingToasts.length > 5) {
        this.toastContainer.removeChild(existingToasts[0]);
      }
      
      // Create toast element
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
        case 'warning':
          iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2L1 21h22M12 9v6M12 17v2"/></svg>';
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
      
      this.toastContainer.appendChild(toast);
      
      // Add animation class after a small delay (for transition)
      setTimeout(() => toast.classList.add('show'), 10);
      
      // Set up auto-dismiss
      const timeout = setTimeout(() => this.dismissToast(toast), duration);
      
      // Add close button functionality
      const closeButton = toast.querySelector('.toast-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          clearTimeout(timeout);
          this.dismissToast(toast);
        });
      }
      
      // Return the toast element in case it's needed
      return toast;
    } catch (error) {
      console.error('Error showing toast:', error);
      // Fallback to alert in case of errors
      alert(`${type.toUpperCase()}: ${message}`);
    }
  },
  
  /**
   * Dismiss a toast notification
   * @param {HTMLElement} toast - The toast element to dismiss
   */
  dismissToast: function(toast) {
    if (!toast) return;
    
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  },
  
  /**
   * Update the progress bar
   * @param {HTMLElement|string} progressBar - The progress bar element or selector
   * @param {number} percent - Percentage complete (0-100)
   */
  updateProgress: function(progressBar, percent) {
    try {
      // Handle string selector
      if (typeof progressBar === 'string') {
        progressBar = document.querySelector(progressBar);
      }
      
      if (!progressBar) {
        // Try to find any progress bar in the document
        progressBar = document.querySelector('.progress-bar') || document.querySelector('.progress-fill');
        if (!progressBar) return;
      }
      
      progressBar.style.width = `${percent}%`;
      
      // Add pulse animation when complete
      if (percent >= 100) {
        progressBar.classList.add('pulse-animation');
      } else {
        progressBar.classList.remove('pulse-animation');
      }
    } catch (error) {
      console.error('Error updating progress bar:', error);
    }
  },
  
  /**
   * Show the loading overlay with custom message
   * @param {boolean|string} showOrMessage - true/false to show/hide, or message string
   */
  showLoading: function(showOrMessage = true) {
    try {
      const overlay = document.querySelector('.loading-overlay');
      if (!overlay) return;
      
      if (typeof showOrMessage === 'string') {
        // It's a message, show the overlay with this message
        const loadingText = overlay.querySelector('.loading-text');
        if (loadingText) {
          loadingText.textContent = showOrMessage;
        }
        
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('visible'), 10);
      } else if (showOrMessage === true) {
        // Just show the overlay
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('visible'), 10);
      } else {
        // Hide the overlay
        this.hideLoading();
      }
    } catch (error) {
      console.error('Error showing loading overlay:', error);
    }
  },
  
  /**
   * Hide the loading overlay
   */
  hideLoading: function() {
    try {
      const overlay = document.querySelector('.loading-overlay');
      if (!overlay) return;
      
      overlay.classList.remove('visible');
      // Give time for fade-out
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    } catch (error) {
      console.error('Error hiding loading overlay:', error);
    }
  }
};

// Make the helpers available globally
window.xUiHelpers = uiHelpers;

// Also expose individual functions globally for backwards compatibility
window.showToast = uiHelpers.showToast.bind(uiHelpers);
window.dismissToast = uiHelpers.dismissToast.bind(uiHelpers);
window.updateProgress = uiHelpers.updateProgress.bind(uiHelpers);
window.showLoading = uiHelpers.showLoading.bind(uiHelpers);
window.hideLoading = uiHelpers.hideLoading.bind(uiHelpers); 