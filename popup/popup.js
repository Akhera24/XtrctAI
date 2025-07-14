// X Profile Analyzer Chrome Extension - Rate Limiting Enhanced Version
// Version 1.5.0 - Enhanced with intelligent rate limiting and caching

console.log('🚀 Loading X Profile Analyzer...');

// Global state management
const extensionState = {
  isAnalyzing: false,
  apiTimeout: null,
  tabInitialized: {},
  currentTab: 'analyze',
  abortController: null,
  elements: {},
  tabListeners: new Map(),
  isInitialized: false,
  rateLimitStatus: null
};

// UI Helper utilities
const UIHelpers = {
  formatNumber(num) {
    if (num === null || num === undefined) return '0';
    num = Number(num);
    if (isNaN(num)) return '0';
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  },

  formatTime(ms) {
    if (ms <= 0) return '0s';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  },

  showToast(message, type = 'info', duration = 3000) {
    try {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 16px; right: 16px; z-index: 9999;';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.style.cssText = `
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateX(100%);
        transition: transform 0.3s ease; max-width: 300px; word-wrap: break-word;
      `;
      toast.textContent = message;

      container.appendChild(toast);
      
      // Animate in
      setTimeout(() => {
        toast.style.transform = 'translateX(0)';
      }, 10);

      // Auto dismiss
      setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, duration);
    } catch (error) {
      console.warn('Toast error:', error);
    }
  },

  showLoading(message = 'Loading...') {
    const overlay = document.querySelector('.loading-overlay');
    const text = document.querySelector('.loading-text');
    
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('visible'), 10);
    }
    
    if (text) {
      text.textContent = message;
    }
  },

  hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
      }, 300);
    }
  },

  updateProgress(percent) {
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
      percent = Math.max(0, Math.min(100, Number(percent) || 0));
      progressFill.style.width = `${percent}%`;
    }
  },

  updateRateLimitStatus(status) {
    const statusElement = document.getElementById('rate-limit-status');
    if (!statusElement || !status) return;

    // Calculate totals from new comprehensive rate limit structure
    let totalRemaining = 0;
    let totalUsed = 0;
    let totalLimit = 0;
    let nextReset = null;
    
    // Use summary data if available
    if (status.summary) {
      totalRemaining = status.summary.totalRemaining;
      totalUsed = status.summary.totalUsed;
      totalLimit = status.summary.totalLimit;
    } else {
      // Sum up individual configs
      Object.values(status).forEach(configStatus => {
        if (typeof configStatus === 'object' && configStatus.remaining !== undefined) {
          totalRemaining += configStatus.remaining;
          totalUsed += configStatus.used;
          totalLimit += configStatus.total;
          
          if (!nextReset || configStatus.resetIn < nextReset) {
            nextReset = configStatus.resetIn;
          }
        }
      });
    }
    
    const percentUsed = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;
    
    let statusColor = '#10b981'; // Green
    let statusText = 'Good';
    
    if (percentUsed >= 90) {
      statusColor = '#ef4444'; // Red
      statusText = 'Critical';
    } else if (percentUsed >= 70) {
      statusColor = '#f59e0b'; // Yellow
      statusText = 'Warning';
    }

    statusElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(${statusColor === '#ef4444' ? '239,68,68' : statusColor === '#f59e0b' ? '245,158,11' : '16,185,129'}, 0.1); border-radius: 8px; border-left: 3px solid ${statusColor};">
        <div style="font-size: 12px;">
          <span style="font-weight: 600; color: ${statusColor};">Rate Limit: ${statusText}</span><br>
          <span style="color: #536471;">${totalRemaining}/${totalLimit} requests left</span>
          ${status.summary?.activeConfig ? `<br><span style="color: #536471; font-size: 10px;">Using: ${status.summary.activeConfig}</span>` : ''}
        </div>
        <div style="font-size: 11px; color: #536471; text-align: right;">
          ${nextReset && nextReset > 0 ? `Reset: ${this.formatTime(nextReset)}` : 'Ready'}<br>
          <span style="color: #10b981;">🌐 Proxy Integration Active</span>
        </div>
      </div>
    `;
  }
};

// Tab Navigation Manager
class TabManager {
  static init() {
    console.log('🔧 Initializing Tab Manager...');
    this.setupEventListeners();
    this.showTab('analyze');
  }

  static setupEventListeners() {
    // Clear any existing listeners
    extensionState.tabListeners.forEach((listener, button) => {
      button.removeEventListener('click', listener);
    });
    extensionState.tabListeners.clear();

    // Get all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    console.log(`📋 Found ${tabButtons.length} tab buttons:`, Array.from(tabButtons).map(b => b.id));

    tabButtons.forEach(button => {
      const listener = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Extract tab name from button ID
        let tabName = button.id.replace('-btn', '').replace('-tab', '');
        console.log(`🔄 Tab clicked: ${button.id} → ${tabName}`);
        
        this.showTab(tabName);
      };
      
      button.addEventListener('click', listener);
      extensionState.tabListeners.set(button, listener);
    });
  }

  static showTab(tabName) {
    try {
      console.log(`📂 Showing tab: ${tabName}`);
      
      // Hide all tab contents first
      const allContents = document.querySelectorAll('.tab-content');
      allContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });

      // Remove active state from all buttons
      const allButtons = document.querySelectorAll('.tab-button');
      allButtons.forEach(btn => {
        btn.classList.remove('active');
      });

      // Show target content
      const targetContent = document.getElementById(`${tabName}-content`);
      const targetButton = document.getElementById(`${tabName}-tab-btn`);

      if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'block';
        console.log(`✅ Activated content: ${targetContent.id}`);
      } else {
        console.error(`❌ Content not found: ${tabName}-content`);
        this.createEmergencyContent(tabName);
        return;
      }

      if (targetButton) {
        targetButton.classList.add('active');
        console.log(`✅ Activated button: ${targetButton.id}`);
      }

      // Initialize tab-specific functionality
      this.initializeTab(tabName);
      extensionState.currentTab = tabName;

    } catch (error) {
      console.error('❌ Tab switching error:', error);
      this.createEmergencyContent(tabName);
    }
  }

  static initializeTab(tabName) {
    switch (tabName) {
      case 'analyze':
        // Already initialized by default
        console.log('🔍 Analyze tab ready');
        break;
      case 'compose':
        this.initializeComposeTab();
        break;
      case 'history':
        this.loadHistoryContent();
        break;
      default:
        console.warn(`⚠️ Unknown tab: ${tabName}`);
    }
  }

  static initializeComposeTab() {
    console.log('✏️ Initializing compose tab...');
    
    try {
      const postTextarea = document.querySelector('#compose-content .post-input');
      const charCounter = document.querySelector('#compose-content .character-counter');
      
      if (postTextarea && charCounter) {
        // Remove any existing listeners
        const newTextarea = postTextarea.cloneNode(true);
        postTextarea.parentNode.replaceChild(newTextarea, postTextarea);
        
        newTextarea.addEventListener('input', () => {
          const currentLength = newTextarea.value.length;
          const maxLength = newTextarea.getAttribute('maxlength') || 280;
          charCounter.textContent = `${currentLength}/${maxLength}`;
          
          if (currentLength > maxLength * 0.9) {
            charCounter.style.color = '#ef4444';
            charCounter.style.fontWeight = 'bold';
      } else {
            charCounter.style.color = '#536471';
            charCounter.style.fontWeight = 'normal';
          }
        });
        
        // Initialize counter
        charCounter.textContent = '0/280';
        console.log('✅ Compose tab character counter initialized');
      }

      // Initialize buttons
      const typeButtons = document.querySelectorAll('#compose-content .type-btn');
      const toneButtons = document.querySelectorAll('#compose-content .tone-btn');
      
      typeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
          typeButtons.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
        });
      });

      toneButtons.forEach(btn => {
        btn.addEventListener('click', function() {
          toneButtons.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
        });
      });

      console.log('✅ Compose tab fully initialized');
    } catch (error) {
      console.error('❌ Error initializing compose tab:', error);
    }
  }

  static loadHistoryContent() {
    console.log('📚 Loading history content...');
    
    try {
      const historyContainer = document.getElementById('historyItemsContainer');
      if (!historyContainer) {
        console.error('❌ History container not found');
        return;
      }

      chrome.storage.local.get(['analysisHistory'], (result) => {
        try {
          const history = result.analysisHistory || [];
          
          if (history.length === 0) {
            historyContainer.innerHTML = `
              <div class="empty-state" style="text-align: center; padding: 40px 20px; color: #536471;">
                <h3 style="margin-bottom: 8px;">No History</h3>
                <p style="margin: 0;">Analyzed profiles will appear here</p>
                <p style="margin-top: 16px; font-size: 14px;">Use the Analyze tab to start analyzing X profiles</p>
              </div>
            `;
            return;
          }

          historyContainer.innerHTML = '';
          
          history.forEach(item => {
            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.style.cssText = `
              background-color: rgba(0, 0, 0, 0.02);
              border-radius: 12px; padding: 16px; margin-bottom: 16px;
              transition: all 0.2s ease; cursor: pointer;
            `;
            
            historyItem.innerHTML = `
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <div style="font-weight: 600;">@${item.username}</div>
                <div style="font-size: 12px; color: #536471;">${formattedDate}</div>
        </div>
              <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="display: flex; gap: 8px;">
                  <span style="color: #536471;">Followers:</span>
                  <span style="font-weight: 600; color: #1d9bf0;">${UIHelpers.formatNumber(item.metrics?.followers || 0)}</span>
        </div>
                <div style="display: flex; gap: 8px;">
                  <span style="color: #536471;">Engagement:</span>
                  <span style="font-weight: 600; color: #1d9bf0;">${item.metrics?.engagement || '0%'}</span>
        </div>
        </div>
              <div style="display: flex; justify-content: flex-end;">
                <button class="analyze-again-btn" data-username="${item.username}" style="
                  background-color: rgba(29, 155, 240, 0.1); color: #1d9bf0; border: none;
                  padding: 8px 16px; border-radius: 16px; font-weight: 600; cursor: pointer;
                  transition: background-color 0.2s;
                ">Analyze Again</button>
      </div>
    `;
    
            historyContainer.appendChild(historyItem);
            
            // Add click handler for "Analyze Again" button
            const analyzeBtn = historyItem.querySelector('.analyze-again-btn');
            if (analyzeBtn) {
              analyzeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = analyzeBtn.getAttribute('data-username');
                TabManager.showTab('analyze');
                
      setTimeout(() => {
                  const profileInput = document.getElementById('profile-input');
                  if (profileInput) {
                    profileInput.value = username;
                    ProfileAnalyzer.updateAnalyzeButtonState();
                  }
                }, 100);
              });
            }
          });
          
          console.log('✅ History content loaded successfully');
    } catch (error) {
          console.error('❌ Error loading history:', error);
          historyContainer.innerHTML = '<div class="empty-state"><h3>Error</h3><p>Could not load history</p></div>';
        }
      });
    } catch (error) {
      console.error('❌ Error in loadHistoryContent:', error);
    }
  }

  static createEmergencyContent(tabName) {
    console.log(`🚨 Creating emergency content for: ${tabName}`);
    
    const container = document.querySelector('.popup-container');
    if (!container) return;

    let content = '';
    switch (tabName) {
      case 'compose':
        content = `
          <div class="tab-content active" id="compose-content">
            <div style="padding: 20px;">
              <h3>Compose Post</h3>
              <textarea placeholder="What's happening?" maxlength="280" style="width: 100%; height: 120px; padding: 12px; border: 1px solid #cfd9de; border-radius: 8px; resize: vertical;"></textarea>
              <div style="text-align: right; font-size: 14px; color: #536471; margin-top: 4px;">0/280</div>
              <button style="background: #1d9bf0; color: white; border: none; padding: 8px 16px; border-radius: 16px; margin-top: 12px; cursor: pointer;">Post</button>
            </div>
      </div>
    `;
        break;
      case 'history':
        content = `
          <div class="tab-content active" id="history-content">
            <div style="padding: 20px; text-align: center;">
              <h3>Recent Analyses</h3>
              <p style="color: #536471;">No history available</p>
        </div>
      </div>
    `;
        break;
      default:
        return;
    }

    // Remove any existing content for this tab
    const existingContent = document.getElementById(`${tabName}-content`);
    if (existingContent) {
      existingContent.remove();
    }

    container.insertAdjacentHTML('beforeend', content);
  }
}

// Profile Analyzer
class ProfileAnalyzer {
  static init() {
    console.log('🔍 Initializing Profile Analyzer...');
    this.setupEventListeners();
    this.updateAnalyzeButtonState();
    this.updateRateLimitDisplay();
  }

  static setupEventListeners() {
    const analyzeButton = document.getElementById('analyze-button');
    const profileInput = document.getElementById('profile-input');
    const testApiButton = document.getElementById('test-api-button');

    if (analyzeButton) {
      analyzeButton.addEventListener('click', () => this.handleAnalyze());
    }

    if (profileInput) {
      profileInput.addEventListener('input', () => this.updateAnalyzeButtonState());
      profileInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !analyzeButton?.disabled) {
          e.preventDefault();
          this.handleAnalyze();
        }
      });
    }

    if (testApiButton) {
      testApiButton.addEventListener('click', () => this.testApiConnection());
    }

    // Clear history button
    const clearHistoryBtn = document.getElementById('clear-history-button');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        chrome.storage.local.set({ analysisHistory: [] }, () => {
          UIHelpers.showToast('History cleared', 'success');
          TabManager.loadHistoryContent();
        });
      });
    }

    // Update rate limit status every 30 seconds
    setInterval(() => this.updateRateLimitDisplay(), 30000);
  }

  static updateRateLimitDisplay() {
    chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (response) => {
      if (response && !chrome.runtime.lastError && response.success) {
        extensionState.rateLimitStatus = response.rateLimitStatus;
        UIHelpers.updateRateLimitStatus(response.rateLimitStatus);
      }
    });
  }

  static updateAnalyzeButtonState() {
    const analyzeButton = document.getElementById('analyze-button');
    const profileInput = document.getElementById('profile-input');
    
    if (!analyzeButton || !profileInput) return;
    
    const hasInput = profileInput.value.trim().length > 0;
    const canAnalyze = hasInput && !extensionState.isAnalyzing;
    
    // Check rate limit status
    if (extensionState.rateLimitStatus && extensionState.rateLimitStatus.requests >= extensionState.rateLimitStatus.maxRequests) {
      analyzeButton.disabled = true;
      analyzeButton.innerHTML = '⏳ Rate Limited';
      analyzeButton.title = `Rate limit reached. Try again in ${UIHelpers.formatTime(extensionState.rateLimitStatus.resetTime)}`;
      return;
    }
    
    analyzeButton.disabled = !canAnalyze;
    
    if (extensionState.isAnalyzing) {
      analyzeButton.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 0.8s linear infinite; margin-right: 8px;"></span>Analyzing...';
    } else {
      analyzeButton.innerHTML = 'Analyze';
      analyzeButton.title = '';
    }
  }

  static async handleAnalyze() {
    if (extensionState.isAnalyzing) {
      console.log('⏳ Analysis already in progress');
      return;
    }

    const profileInput = document.getElementById('profile-input');
    const profileValue = profileInput?.value?.trim();
    
    if (!profileValue) {
      UIHelpers.showToast('Please enter a profile URL or handle', 'error');
      return;
    }

    try {
      extensionState.isAnalyzing = true;
      this.updateAnalyzeButtonState();
      
      UIHelpers.showLoading('Connecting to X API...');
      UIHelpers.updateProgress(10);

      const username = this.extractUsername(profileValue);
      if (!username) {
        throw new Error('Invalid profile URL or handle');
      }

      console.log(`🔍 Analyzing profile: @${username}`);
      UIHelpers.updateProgress(30);
      UIHelpers.showLoading(`Analyzing @${username}...`);

      // Simulate progress
      let progress = 30;
      const progressInterval = setInterval(() => {
        progress += 3;
        if (progress >= 85) {
          clearInterval(progressInterval);
        }
        UIHelpers.updateProgress(progress);
      }, 200);

      // Send analysis request to background script
      const response = await this.sendAnalysisRequest(username);
      
      clearInterval(progressInterval);
      UIHelpers.updateProgress(100);

      if (!response || !response.success) {
        // Handle specific error types
        if (response?.error?.includes('Rate limit')) {
          throw new Error('⏳ Rate limit reached. Please wait a few minutes before trying again.');
        } else if (response?.error?.includes('wait') && response?.error?.includes('minute')) {
          throw new Error(response.error);
        } else {
          throw new Error(response?.error || 'Analysis failed');
        }
      }

      await new Promise(r => setTimeout(r, 300));
      this.displayResults(username, response.data || response);
      this.saveToHistory(username, response.data || response);
      
      UIHelpers.showToast('Analysis completed successfully!', 'success');

      // Update rate limit status after successful request
      this.updateRateLimitDisplay();

    } catch (error) {
      console.error('❌ Analysis error:', error);
      
      // Show specific error messages for rate limiting
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        UIHelpers.showToast('Rate limit reached! Try again in a few minutes.', 'warning', 5000);
        setTimeout(() => this.updateRateLimitDisplay(), 1000);
      } else if (error.message.includes('wait') && error.message.includes('minute')) {
        UIHelpers.showToast(error.message, 'warning', 5000);
      } else {
        UIHelpers.showToast(error.message || 'Analysis failed', 'error');
      }
      
      this.displayFallbackResults(username || 'unknown');
    } finally {
      extensionState.isAnalyzing = false;
      this.updateAnalyzeButtonState();
      UIHelpers.hideLoading();
    }
  }

  static sendAnalysisRequest(username) {
    return new Promise((resolve, reject) => {
      console.log(`📡 Sending analysis request for: @${username}`);
      
      // Clear any existing timeout
      if (extensionState.apiTimeout) {
        clearTimeout(extensionState.apiTimeout);
      }

      // Set a more generous timeout for API requests
      const timeoutId = setTimeout(() => {
        console.error('❌ Request timeout after 60 seconds');
        reject(new Error('Request timeout - please try again. This might be due to rate limiting.'));
      }, 60000); // 60 seconds timeout
      
      // Store timeout ID for cleanup
      extensionState.apiTimeout = timeoutId;
      
      try {
      chrome.runtime.sendMessage({
          action: 'analyze',
          username: username
      }, (response) => {
        clearTimeout(timeoutId);
          extensionState.apiTimeout = null;
        
          // Check for Chrome runtime errors
        if (chrome.runtime.lastError) {
            console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(`Extension error: ${chrome.runtime.lastError.message}`));
          return;
        }
        
          // Check if we got a response
        if (!response) {
          console.error('❌ No response from background script');
            reject(new Error('No response from background script. The extension may need to be reloaded.'));
          return;
        }
        
        console.log('📡 Received response:', response.success ? '✅ Success' : '❌ Failed');
          
          // Handle successful response
          if (response.success && response.data) {
        resolve(response);
          } else {
            // Handle error response but still resolve with data if available
            if (response.data) {
              console.warn('⚠️ API request failed but fallback data available:', response.error);
              resolve({
                success: false,
                data: response.data,
                error: response.error,
                isFallback: true
              });
            } else {
              reject(new Error(response.error || 'Analysis failed without data'));
            }
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Error sending message:', error);
        reject(error);
      }
    });
  }

  static async testApiConnection() {
    try {
      console.log('🔗 Testing API connection...');
      
      // Show loading state
      const testButton = document.getElementById('test-api-button');
      if (testButton) {
        testButton.disabled = true;
        testButton.textContent = 'Testing...';
      }

      // Test connection with timeout
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Connection test timeout'));
        }, 30000); // 30 second timeout
        
        chrome.runtime.sendMessage({
          action: 'testApi'
        }, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          resolve(response);
        });
      });
      
      // Handle response
      if (response && response.success) {
        const testUser = response.data?.testUser || 'Unknown';
        const followers = response.data?.followers || 0;
        const usingProxy = response.data?.usingProxy ? 'Yes' : 'No';
        
        UIHelpers.showToast(
          `✅ API Connection Successful!\nTest User: @${testUser}\nFollowers: ${UIHelpers.formatNumber(followers)}\nProxy: ${usingProxy}`,
          'success',
          5000
        );
        
        console.log('✅ API connection test passed:', response.data);
      } else {
        const errorMsg = response?.error || 'Unknown connection error';
        UIHelpers.showToast(`❌ API Connection Failed: ${errorMsg}`, 'error', 5000);
        console.error('❌ API connection test failed:', errorMsg);
      }
      
    } catch (error) {
      console.error('❌ Connection test error:', error);
      UIHelpers.showToast(`❌ Connection Test Error: ${error.message}`, 'error', 5000);
    } finally {
      // Reset button state
      const testButton = document.getElementById('test-api-button');
      if (testButton) {
        testButton.disabled = false;
        testButton.textContent = 'Test API';
      }
    }
  }

  static extractUsername(input) {
    if (input.startsWith('@')) {
      return input.substring(1);
    }

    if (input.includes('twitter.com/') || input.includes('x.com/')) {
      try {
        const url = new URL(input);
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);
        if (pathParts.length > 0) {
          return pathParts[0];
        }
      } catch (e) {
        const match = input.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }

    if (/^[A-Za-z0-9_]+$/.test(input)) {
      return input;
    }

    return null;
  }

  static displayResults(username, data) {
    try {
    console.log('📊 Displaying results for:', username);
    
      // Get results container - using the correct ID from HTML
      const resultsDiv = document.getElementById('results-container');
      if (!resultsDiv) {
      console.error('❌ Results container not found');
      return;
    }
    
      // Clear previous results
      resultsDiv.innerHTML = '';
      resultsDiv.style.display = 'block';

      // Show warning for fallback data
      if (data.isFallbackData || data.dataSource?.includes('Fallback')) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning-banner';
        warningDiv.style.cssText = `
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: 1px solid #f59e0b;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        `;
        
        warningDiv.innerHTML = `
          <div style="font-size: 24px;">⚠️</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">Using Estimated Data</div>
            <div style="font-size: 14px; color: #b45309; line-height: 1.4;">
              ${data.warning || 'Real-time data unavailable. Results are estimated and may not reflect actual metrics.'}
            </div>
          </div>
        `;
        
        resultsDiv.appendChild(warningDiv);
      }

      // Profile header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'profile-header';
      headerDiv.style.cssText = `
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px;
        color: white;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      `;

      const avatarDiv = document.createElement('div');
      const profileImage = data.profile?.profileImageUrl || data.profileImage;
      avatarDiv.style.cssText = `
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: ${profileImage ? `url(${profileImage})` : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'};
        background-size: cover;
        background-position: center;
        border: 3px solid rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        color: white;
      `;

      if (!profileImage) {
        avatarDiv.textContent = (data.profile?.displayName || data.displayName || data.profile?.username || data.username || 'U')[0].toUpperCase();
      }

      const profileInfoDiv = document.createElement('div');
      profileInfoDiv.style.cssText = 'flex: 1;';
      profileInfoDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 24px; font-weight: 700;">${data.profile?.displayName || data.displayName || data.profile?.username || data.username}</h2>
          ${(data.profile?.verified || data.verified) ? '<span style="color: #1da1f2; font-size: 20px;">✓</span>' : ''}
        </div>
        <div style="opacity: 0.9; font-size: 16px; margin-bottom: 8px;">@${data.profile?.username || data.username}</div>
        ${(data.profile?.bio || data.bio) ? `<div style="opacity: 0.8; font-size: 14px; line-height: 1.4; max-width: 400px;">${data.profile.bio || data.bio}</div>` : ''}
        ${(data.profile?.location || data.location) ? `<div style="opacity: 0.7; font-size: 12px; margin-top: 4px;">📍 ${data.profile.location || data.location}</div>` : ''}
      `;

      headerDiv.appendChild(avatarDiv);
      headerDiv.appendChild(profileInfoDiv);
      resultsDiv.appendChild(headerDiv);

      // Metrics cards
      const metricsDiv = document.createElement('div');
      metricsDiv.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      `;

      const metrics = [
        { label: 'Followers', value: data.metrics?.followers || data.profile?.followers || 0, color: '#1da1f2', icon: '👥' },
        { label: 'Following', value: data.metrics?.following || data.profile?.following || 0, color: '#17bf63', icon: '➡️' },
        { label: 'Tweets', value: data.metrics?.tweets || data.profile?.tweets || 0, color: '#f45d22', icon: '📝' },
        { label: 'Listed', value: data.metrics?.listed || data.profile?.listed || 0, color: '#794bc4', icon: '📋' }
      ];

      metrics.forEach(metric => {
        const metricCard = document.createElement('div');
        metricCard.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border: 1px solid #e1e8ed;
          transition: transform 0.2s ease;
        `;
        
        metricCard.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 8px;">${metric.icon}</div>
          <div style="font-size: 24px; font-weight: 700; color: ${metric.color}; margin-bottom: 4px;">
            ${UIHelpers.formatNumber(metric.value)}
          </div>
          <div style="font-size: 14px; color: #536471; font-weight: 500;">${metric.label}</div>
        `;
        
        metricsDiv.appendChild(metricCard);
      });

      resultsDiv.appendChild(metricsDiv);

      // Influence Score (replaces Health Score)
      if (data.analysis?.influenceScore !== undefined) {
        const scoreDiv = document.createElement('div');
        scoreDiv.style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          padding: 20px;
          color: white;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        `;

        const score = data.analysis.influenceScore || 0;
        const category = data.analysis.category || 'Unknown';
        
        scoreDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Influence Score</h3>
            <div style="font-size: 24px; font-weight: 700;">${score}/100</div>
          </div>
          <div style="background: rgba(255,255,255,0.2); border-radius: 8px; height: 8px; margin-bottom: 12px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #10b981, #34d399); height: 100%; width: ${score}%; transition: width 1s ease;"></div>
          </div>
          <div style="font-size: 14px; opacity: 0.9;">Category: <strong>${category}</strong></div>
        `;

        resultsDiv.appendChild(scoreDiv);
      }

      // Insights section
      if (data.analysis?.insights && data.analysis.insights.length > 0) {
        const insightsDiv = document.createElement('div');
        insightsDiv.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border: 1px solid #e1e8ed;
        `;

        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e1e8ed;
        `;
        headerDiv.innerHTML = `
          <span style="font-size: 18px;">💡</span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0f1419;">Key Insights</h3>
        `;

        const insightsContainer = document.createElement('div');
        insightsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        data.analysis.insights.forEach(insight => {
          const insightDiv = document.createElement('div');
          insightDiv.style.cssText = `
            padding: 12px;
            background: #f7f9fa;
            border-radius: 8px;
            border-left: 4px solid #1d9bf0;
            font-size: 14px;
            color: #0f1419;
            line-height: 1.4;
          `;
          insightDiv.textContent = insight;
          insightsContainer.appendChild(insightDiv);
        });

        insightsDiv.appendChild(headerDiv);
        insightsDiv.appendChild(insightsContainer);
        resultsDiv.appendChild(insightsDiv);
      }

      // Analysis sections
      const sectionsDiv = document.createElement('div');
      sectionsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

      // Tweet Analysis
      if (data.analysis?.tweetAnalysis) {
        const tweetDiv = this.createAnalysisSection('Tweet Analysis', '📝', data.analysis.tweetAnalysis, [
          { label: 'Total Tweets', value: data.analysis.tweetAnalysis.totalTweets || 0 },
          { label: 'Avg Likes', value: UIHelpers.formatNumber(Math.round(data.analysis.tweetAnalysis.avgLikes || 0)) },
          { label: 'Avg Retweets', value: UIHelpers.formatNumber(Math.round(data.analysis.tweetAnalysis.avgRetweets || 0)) },
          { label: 'Activity Level', value: data.analysis.tweetAnalysis.recentActivity || 'Unknown' }
        ]);
        sectionsDiv.appendChild(tweetDiv);
      }

      // Engagement Analysis (fallback to old structure)
      if (data.engagementAnalysis) {
        const engagementDiv = this.createAnalysisSection('Engagement Analysis', '💬', data.engagementAnalysis, [
          { label: 'Avg Likes', value: UIHelpers.formatNumber(data.engagementAnalysis.avgLikes || 0) },
          { label: 'Avg Retweets', value: UIHelpers.formatNumber(data.engagementAnalysis.avgRetweets || 0) },
          { label: 'Avg Replies', value: UIHelpers.formatNumber(data.engagementAnalysis.avgReplies || 0) },
          { label: 'Engagement Rate', value: `${data.engagementAnalysis.engagementRate || 0}%` }
        ]);
        sectionsDiv.appendChild(engagementDiv);
      }

      // Recommendations
      if (data.recommendations && data.recommendations.length > 0) {
        const recommendationsDiv = this.createRecommendationsSection(data.recommendations);
        sectionsDiv.appendChild(recommendationsDiv);
      }

      resultsDiv.appendChild(sectionsDiv);

      // Analysis metadata
      const metadataDiv = document.createElement('div');
      metadataDiv.style.cssText = `
        background: #f7f9fa;
        border-radius: 12px;
        padding: 16px;
        margin-top: 24px;
        font-size: 12px;
        color: #536471;
        border: 1px solid #e1e8ed;
      `;

      const analysisDate = data.analysis?.lastAnalyzed ? new Date(data.analysis.lastAnalyzed).toLocaleString() : 
                           data.analysisDate ? new Date(data.analysisDate).toLocaleString() : 'Unknown';
      const dataSource = data.analysis?.source || data.dataSource || 'Unknown';
      const tweetsAnalyzed = data.analysis?.tweetAnalysis?.totalTweets || data.tweetsAnalyzed || 0;
      const accountAge = data.profile?.accountAge ? `${data.profile.accountAge} days` : 'Unknown';

      metadataDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div><strong>Analysis Date:</strong> ${analysisDate}</div>
          <div><strong>Data Source:</strong> ${dataSource}</div>
          <div><strong>Tweets Analyzed:</strong> ${tweetsAnalyzed}</div>
          <div><strong>Account Age:</strong> ${accountAge}</div>
        </div>
      `;

      resultsDiv.appendChild(metadataDiv);

      // Save to history
      this.saveToHistory(username, data);

      console.log('✅ Results displayed successfully');

    } catch (error) {
      console.error('❌ Error displaying results:', error);
      UIHelpers.showToast('Error displaying results', 'error');
    }
  }

  static createAnalysisSection(title, icon, data, metrics) {
    const sectionDiv = document.createElement('div');
    sectionDiv.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border: 1px solid #e1e8ed;
    `;

    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e1e8ed;
    `;
    headerDiv.innerHTML = `
      <span style="font-size: 18px;">${icon}</span>
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0f1419;">${title}</h3>
    `;

    const metricsDiv = document.createElement('div');
    metricsDiv.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    `;

    metrics.forEach(metric => {
      const metricDiv = document.createElement('div');
      metricDiv.style.cssText = `
        text-align: center;
        padding: 12px;
        background: #f7f9fa;
        border-radius: 8px;
        border: 1px solid #e1e8ed;
      `;
      metricDiv.innerHTML = `
        <div style="font-size: 18px; font-weight: 700; color: #0f1419; margin-bottom: 4px;">
          ${metric.value}
            </div>
        <div style="font-size: 12px; color: #536471; font-weight: 500;">
          ${metric.label}
      </div>
    `;
      metricsDiv.appendChild(metricDiv);
    });

    sectionDiv.appendChild(headerDiv);
    sectionDiv.appendChild(metricsDiv);

    // Add themes if available
    if (data.themes && data.themes.length > 0) {
      const themesDiv = document.createElement('div');
      themesDiv.style.cssText = 'margin-top: 16px;';
      
      const themesHeader = document.createElement('div');
      themesHeader.style.cssText = 'font-size: 14px; font-weight: 600; color: #0f1419; margin-bottom: 8px;';
      themesHeader.textContent = 'Content Themes:';
      
      const themesContainer = document.createElement('div');
      themesContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';
      
      data.themes.forEach(theme => {
        const themeTag = document.createElement('span');
        themeTag.style.cssText = `
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        `;
        themeTag.textContent = `${theme.theme} (${theme.relevance}%)`;
        themesContainer.appendChild(themeTag);
      });
      
      themesDiv.appendChild(themesHeader);
      themesDiv.appendChild(themesContainer);
      sectionDiv.appendChild(themesDiv);
    }

    return sectionDiv;
  }

  static createRecommendationsSection(recommendations) {
    const sectionDiv = document.createElement('div');
    sectionDiv.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border: 1px solid #e1e8ed;
    `;

    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e1e8ed;
    `;
    headerDiv.innerHTML = `
      <span style="font-size: 18px;">💡</span>
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0f1419;">Growth Recommendations</h3>
    `;

    const recommendationsContainer = document.createElement('div');
    recommendationsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    recommendations.forEach(rec => {
      const recDiv = document.createElement('div');
      recDiv.style.cssText = `
        padding: 16px;
        background: #f7f9fa;
        border-radius: 8px;
        border-left: 4px solid ${rec.priority === 'High' ? '#f45d22' : rec.priority === 'Medium' ? '#f59e0b' : '#10b981'};
      `;

      recDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div style="font-weight: 600; color: #0f1419; font-size: 14px;">${rec.title}</div>
          <span style="
            background: ${rec.priority === 'High' ? '#f45d22' : rec.priority === 'Medium' ? '#f59e0b' : '#10b981'};
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
          ">${rec.priority}</span>
          </div>
        <div style="font-size: 13px; color: #536471; line-height: 1.4;">
          ${rec.description}
          </div>
        <div style="font-size: 11px; color: #657786; margin-top: 4px; text-transform: uppercase; font-weight: 500;">
          ${rec.type}
          </div>
      `;

      recommendationsContainer.appendChild(recDiv);
    });

    sectionDiv.appendChild(headerDiv);
    sectionDiv.appendChild(recommendationsContainer);

    return sectionDiv;
  }

  static saveToHistory(username, data) {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      const history = result.analysisHistory || [];
      
      const userData = data.data || data.user || data;
      const metrics = userData.metrics || userData.public_metrics || {};
      
      const historyItem = {
        username: username,
        timestamp: Date.now(),
        metrics: {
          followers: metrics.followers || metrics.followers_count || 0,
          engagement: data.analytics?.engagement_rate || '1.2%'
        }
      };
      
      history.unshift(historyItem);
      if (history.length > 50) {
        history.pop();
      }
      
      chrome.storage.local.set({ analysisHistory: history });
    });
  }
}

// Main initialization
function initializeExtension() {
  console.log('🚀 Initializing X Profile Analyzer Extension...');
  
  if (extensionState.isInitialized) {
    console.log('✅ Extension already initialized');
      return;
    }
    
  try {
    // Add required CSS for animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .tab-content { display: none; }
      .tab-content.active { display: block !important; }
      .tab-button.active { background-color: rgba(29, 155, 240, 0.1); color: #1d9bf0; }
    `;
    document.head.appendChild(style);

    // Initialize components
    TabManager.init();
    ProfileAnalyzer.init();
    
    extensionState.isInitialized = true;
    console.log('✅ Extension initialized successfully!');
    
    UIHelpers.showToast('X Profile Analyzer loaded successfully!', 'success', 2000);
    
  } catch (error) {
    console.error('❌ Extension initialization failed:', error);
    UIHelpers.showToast('Extension initialization failed. Please refresh.', 'error');
  }
}

// Wait for DOM and initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Fallback initialization
setTimeout(() => {
  if (!extensionState.isInitialized) {
    console.warn('🔄 Fallback initialization triggered');
    initializeExtension();
  }
}, 1000);

// Expose for debugging
window.XProfileAnalyzer = {
  TabManager,
  ProfileAnalyzer,
  UIHelpers,
  extensionState
};

console.log('📦 X Profile Analyzer script loaded successfully!'); 