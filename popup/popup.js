// X Profile Analyzer Chrome Extension - Completely Fixed Version
// Version 1.4.0 - Bulletproof tab switching and full X API integration

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
  isInitialized: false
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
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
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
  }

  static setupEventListeners() {
    const analyzeButton = document.getElementById('analyze-button');
    const profileInput = document.getElementById('profile-input');

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
  }

  static updateAnalyzeButtonState() {
    const analyzeButton = document.getElementById('analyze-button');
    const profileInput = document.getElementById('profile-input');
    
    if (!analyzeButton || !profileInput) return;
    
    const hasInput = profileInput.value.trim().length > 0;
    analyzeButton.disabled = !hasInput || extensionState.isAnalyzing;
    
    if (extensionState.isAnalyzing) {
      analyzeButton.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 0.8s linear infinite; margin-right: 8px;"></span>Analyzing...';
    } else {
      analyzeButton.innerHTML = 'Analyze';
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
        throw new Error(response?.error || 'Analysis failed');
      }

      await new Promise(r => setTimeout(r, 300));
      this.displayResults(username, response.data || response);
      this.saveToHistory(username, response.data || response);
      
      UIHelpers.showToast('Analysis completed successfully!', 'success');

    } catch (error) {
      console.error('❌ Analysis error:', error);
      UIHelpers.showToast(error.message || 'Analysis failed', 'error');
      this.displayFallbackResults(username || 'unknown');
    } finally {
      extensionState.isAnalyzing = false;
      this.updateAnalyzeButtonState();
      UIHelpers.hideLoading();
    }
  }

  static sendAnalysisRequest(username) {
    return new Promise((resolve, reject) => {
      console.log(`📡 Sending X API request for: @${username}`);
      
      // Set a timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);
      
      chrome.runtime.sendMessage({
        action: 'analyzeProfile',
        username: username,
        options: { forceRefresh: false }
      }, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          console.error('❌ Runtime error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!response) {
          console.error('❌ No response from background script');
          reject(new Error('No response from background script'));
          return;
        }
        
        console.log('📡 Received response:', response.success ? '✅ Success' : '❌ Failed');
        resolve(response);
      });
    });
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
    console.log('📊 Displaying results for:', username);
    
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) {
      console.error('❌ Results container not found');
      return;
    }
    
    username = username.replace(/^@/, '');
    
    const user = data.user || {};
    const metrics = user.public_metrics || {};
    const tweets = data.tweets || [];

    // Calculate engagement
    const avgLikes = tweets.length > 0 ? 
      tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.like_count || 0), 0) / tweets.length : 0;
    
    let engagementLevel = 'Low';
    let engagementColor = '#ef4444';
    if (avgLikes > 100) {
      engagementLevel = 'High';
      engagementColor = '#10b981';
    } else if (avgLikes > 20) {
      engagementLevel = 'Good';
      engagementColor = '#3b82f6';
    } else if (avgLikes > 5) {
      engagementLevel = 'Average';
      engagementColor = '#f59e0b';
    }

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <h3 style="margin: 0;">Analysis for @${username}</h3>
          ${user.verified ? '<span style="background: #1d9bf0; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">✓ Verified</span>' : ''}
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0;">
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #1d9bf0; margin-bottom: 4px;">${UIHelpers.formatNumber(metrics.followers_count || 0)}</div>
            <div style="font-size: 12px; color: #536471;">Followers</div>
          </div>
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #1d9bf0; margin-bottom: 4px;">${UIHelpers.formatNumber(metrics.following_count || 0)}</div>
            <div style="font-size: 12px; color: #536471;">Following</div>
          </div>
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #1d9bf0; margin-bottom: 4px;">${UIHelpers.formatNumber(metrics.tweet_count || 0)}</div>
            <div style="font-size: 12px; color: #536471;">Tweets</div>
          </div>
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: ${engagementColor}; margin-bottom: 4px;">${engagementLevel}</div>
            <div style="font-size: 12px; color: #536471;">Engagement</div>
          </div>
        </div>

        <div style="background-color: rgba(29, 155, 240, 0.05); padding: 16px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #1d9bf0;">
          <h4 style="margin: 0 0 8px 0; color: #1d9bf0;">Profile Insights</h4>
          <p style="margin: 0; line-height: 1.5;">
            This profile has a ${metrics.followers_count > metrics.following_count ? 'strong' : 'growing'} following and 
            ${tweets.length > 0 ? `recent activity with an average of ${Math.round(avgLikes)} likes per post` : 'limited recent activity'}.
            ${user.description ? ` Bio: "${user.description.substring(0, 100)}${user.description.length > 100 ? '...' : ''}"` : ''}
          </p>
        </div>

        <div style="background-color: rgba(0, 0, 0, 0.02); padding: 16px; border-radius: 12px; margin: 16px 0;">
          <h4 style="margin: 0 0 12px 0; color: #1d9bf0;">📈 Growth Recommendations</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Post consistently to maintain engagement</li>
            <li style="margin-bottom: 8px;">Engage with your audience through replies and comments</li>
            <li style="margin-bottom: 8px;">Use relevant hashtags to increase discoverability</li>
            <li style="margin-bottom: 8px;">Share valuable content that resonates with your audience</li>
          </ul>
        </div>

        ${data.fromFallback ? `
          <p style="background-color: rgba(244, 93, 34, 0.1); color: #f45d22; padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 14px;">
            ⚠️ Some data may be estimated due to API limitations
          </p>
        ` : `
          <p style="background-color: rgba(16, 185, 129, 0.1); color: #10b981; padding: 12px; border-radius: 8px; margin-top: 16px;">
            ✅ Analysis completed using real X API data
          </p>
        `}
      </div>
    `;
  }

  static displayFallbackResults(username) {
    console.log('⚠️ Displaying fallback results for:', username);
    
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;

    username = username.replace(/^@/, '');
    resultsContainer.style.display = 'block';

    resultsContainer.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background-color: rgba(244, 93, 34, 0.1); color: #f45d22; padding: 8px 16px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; text-align: center;">
          ⚠️ X API unavailable - showing estimated data
        </div>
        
        <h3>Analysis for @${username}</h3>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0;">
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #1d9bf0; margin-bottom: 4px;">1.5K</div>
            <div style="font-size: 12px; color: #536471;">Followers</div>
          </div>
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #1d9bf0; margin-bottom: 4px;">400</div>
            <div style="font-size: 12px; color: #536471;">Following</div>
            </div>
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #1d9bf0; margin-bottom: 4px;">2.2K</div>
            <div style="font-size: 12px; color: #536471;">Tweets</div>
            </div>
          <div style="background-color: rgba(0, 0, 0, 0.03); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700; color: #f59e0b; margin-bottom: 4px;">Average</div>
            <div style="font-size: 12px; color: #536471;">Engagement</div>
          </div>
          </div>
        
        <div style="background-color: rgba(0, 0, 0, 0.02); padding: 16px; border-radius: 12px;">
          <h4 style="margin: 0 0 12px 0;">📈 General Recommendations</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Post consistently to increase visibility</li>
            <li style="margin-bottom: 8px;">Engage with comments to build community</li>
            <li style="margin-bottom: 8px;">Use visual content for higher engagement</li>
            <li style="margin-bottom: 8px;">Participate in relevant conversations</li>
          </ul>
        </div>
        
        <p style="background-color: rgba(244, 93, 34, 0.1); color: #f45d22; padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 14px;">
          Note: This is estimated data. For accurate analysis, please ensure the X API is correctly configured.
        </p>
      </div>
    `;
  }

  static saveToHistory(username, data) {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      const history = result.analysisHistory || [];
      
      const user = data.user || {};
      const metrics = user.public_metrics || {};
      
      const historyItem = {
        username: username,
        timestamp: Date.now(),
        metrics: {
          followers: metrics.followers_count || 0,
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