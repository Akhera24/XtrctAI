/**
 * Connection Manager for X Profile Analyzer
 * Handles API connectivity testing and status monitoring
 */

class ConnectionManager {
  constructor() {
    this.status = {
      api: false,
      proxy: false,
      lastCheck: null,
      errors: []
    };
    
    this.initialize();
  }
  
  async initialize() {
    console.log('Initializing ConnectionManager...');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Run initial connectivity check
    await this.checkConnectivity();
    
    // Schedule periodic connectivity checks
    setInterval(() => this.checkConnectivity(), 15 * 60 * 1000); // Every 15 minutes
  }
  
  setupEventListeners() {
    // Listen for connectivity status updates from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'connectivityStatus') {
        this.updateStatus(message.status);
        sendResponse({ received: true });
      }
      
      return false; // No async response needed
    });
  }
  
  async checkConnectivity() {
    console.log('Checking API connectivity...');
    
    try {
      // Send message to background script to check API
      const result = await this.sendMessageToBackground({
        action: 'testApiConnection',
        silent: true // Don't show UI notifications
      });
      
      // Update status
      this.updateStatus({
        api: result.success,
        proxy: result.proxy?.status || false,
        lastCheck: Date.now(),
        errors: result.success ? [] : [result.error || 'Unknown error']
      });
      
      return result.success;
    } catch (error) {
      console.error('Error checking connectivity:', error);
      
      this.updateStatus({
        api: false,
        lastCheck: Date.now(),
        errors: [error.message || 'Failed to check connectivity']
      });
      
      return false;
    }
  }
  
  updateStatus(newStatus) {
    // Update status with new information
    this.status = {
      ...this.status,
      ...newStatus
    };
    
    // Log status change
    console.log('Connection status updated:', this.status);
    
    // Dispatch event for UI components to update
    window.dispatchEvent(
      new CustomEvent('api-connectivity-change', { detail: this.status })
    );
  }
  
  // Helper to communicate with background script
  sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          resolve(response || {});
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Get current status
  getStatus() {
    return { ...this.status };
  }
  
  // Check if connectivity is working
  isConnected() {
    return this.status.api;
  }
}

// Create singleton instance
const connectionManager = new ConnectionManager();

// Export the singleton
export default connectionManager; 