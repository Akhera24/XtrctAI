// Tab management and navigation functionality
export class TabManager {
  constructor() {
    this.currentTab = 'analyze'; // Default tab
    this.previousState = null;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.dataset.tab);
      });
    });

    // Home button functionality (X logo in top left)
    const homeButton = document.querySelector('.logo-container x-icon');
    if (homeButton) {
      homeButton.addEventListener('click', () => this.goHome());
    }

    // Profile button functionality (X logo in top right)
    const profileButton = document.querySelector('.settings-button x-icon');
    if (profileButton) {
      profileButton.addEventListener('click', () => this.showProfileSection());
    }

    // Help button functionality
    const helpButton = document.querySelector('.footer-actions [title="Help"]');
    if (helpButton) {
      helpButton.addEventListener('click', () => this.showHelpCenter());
    }

    // Feedback button functionality
    const feedbackButton = document.querySelector('.footer-actions [title="Feedback"]');
    if (feedbackButton) {
      feedbackButton.addEventListener('click', () => this.showFeedbackForm());
    }

    // Share button functionality
    const shareButton = document.querySelector('.footer-actions [title="Share"]');
    if (shareButton) {
      shareButton.addEventListener('click', () => this.shareExtension());
    }
    
    // API Settings button functionality - add to settings menu or wherever appropriate
    const apiSettingsButton = document.querySelector('.footer-actions [title="API Settings"]');
    if (apiSettingsButton) {
      apiSettingsButton.addEventListener('click', () => this.showApiSettings());
    }
  }

  // Switch to a specific tab
  switchTab(tabName) {
    // Store previous state for potential return
    this.previousState = {
      tab: this.currentTab,
      scrollPosition: window.scrollY
    };
    
    // Update current tab
    this.currentTab = tabName;
    
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    document.querySelector(`.tab-button[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}Tab`)?.classList.add('active');
    
    // Animate the transition
    this.animateTabTransition(tabName);
    
    // Scroll to top
    window.scrollTo(0, 0);
  }

  // Home button functionality - return to analyze tab and reset state
  goHome() {
    // Save any current input values or state if needed
    
    // Switch to analyze tab
    this.switchTab('analyze');
    
    // Reset input fields
    document.querySelectorAll('input').forEach(input => {
      input.value = '';
      // Also reset the clear buttons opacity
      const clearButton = input.parentElement?.querySelector('.clear-input');
      if (clearButton) clearButton.style.opacity = '0';
    });
    
    // Hide results and reset UI
    const resultsPreview = document.getElementById('resultsPreview');
    if (resultsPreview) resultsPreview.classList.add('hidden');
    
    // Enable analyze button
    const analyzeButton = document.getElementById('analyzeButton');
    if (analyzeButton) analyzeButton.disabled = false;
    
    // Update status text
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Ready';
    
    // Show starting animation
    this.showHomeAnimation();
  }

  // Show profile/sign-in section
  showProfileSection() {
    // Create profile modal if it doesn't exist
    let profileModal = document.getElementById('profileModal');
    
    if (!profileModal) {
      profileModal = document.createElement('div');
      profileModal.id = 'profileModal';
      profileModal.className = 'modal';
      
      profileModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Profile / Sign In</h3>
            <button class="close-button">&times;</button>
          </div>
          <div class="modal-body">
            <div class="sign-in-section">
              <h4>Sign in with X</h4>
              <button class="x-signin-button">
                <x-icon id="signinIcon" state="default" size="20"></x-icon>
                <span>Connect X Account</span>
              </button>
              <p class="auth-info">Connect your X account to save analyses and generated posts.</p>
            </div>
            
            <div class="profile-history hidden" id="profileHistory">
              <h4>Your Recent Activity</h4>
              <div class="history-tabs">
                <button class="history-tab-button active" data-histtab="analyses">Analyses</button>
                <button class="history-tab-button" data-histtab="posts">Generated Posts</button>
              </div>
              
              <div class="history-tab-content active" id="analysesHistoryTab">
                <div class="empty-state">
                  <p>Sign in to view your analysis history</p>
                </div>
              </div>
              
              <div class="history-tab-content" id="postsHistoryTab">
                <div class="empty-state">
                  <p>Sign in to view your generated posts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(profileModal);
      
      // Add event listeners for the modal
      const closeButton = profileModal.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        profileModal.classList.remove('show');
      });
      
      const signInButton = profileModal.querySelector('.x-signin-button');
      signInButton.addEventListener('click', () => {
        this.initiateXSignIn();
      });
      
      // History tabs within profile modal
      const historyTabButtons = profileModal.querySelectorAll('.history-tab-button');
      historyTabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          // Remove active class from all history tabs and contents
          profileModal.querySelectorAll('.history-tab-button').forEach(btn => {
            btn.classList.remove('active');
          });
          
          profileModal.querySelectorAll('.history-tab-content').forEach(content => {
            content.classList.remove('active');
          });
          
          // Add active class to selected history tab and content
          e.currentTarget.classList.add('active');
          const tabName = e.currentTarget.dataset.histtab;
          profileModal.querySelector(`#${tabName}HistoryTab`).classList.add('active');
        });
      });
    }
    
    // Show the profile modal
    profileModal.classList.add('show');
  }

  // Show help center
  showHelpCenter() {
    let helpModal = document.getElementById('helpModal');
    
    if (!helpModal) {
      helpModal = document.createElement('div');
      helpModal.id = 'helpModal';
      helpModal.className = 'modal';
      
      helpModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Help Center</h3>
            <button class="close-button">&times;</button>
          </div>
          <div class="modal-body">
            <div class="help-section">
              <h4>Getting Started</h4>
              <div class="help-card">
                <div class="help-icon">📊</div>
                <div class="help-text">
                  <h5>Analyzing Profiles</h5>
                  <p>Enter a X profile handle or URL to analyze engagement metrics and get AI-powered recommendations.</p>
                </div>
              </div>
              
              <div class="help-card">
                <div class="help-icon">📝</div>
                <div class="help-text">
                  <h5>Generating Posts</h5>
                  <p>Use the Posts tab to create AI-generated content optimized for maximum engagement.</p>
                </div>
              </div>
              
              <div class="help-card">
                <div class="help-icon">📅</div>
                <div class="help-text">
                  <h5>History & Saved Items</h5>
                  <p>View your past analyses and generated posts in the History tab or your Profile.</p>
                </div>
              </div>
            </div>
            
            <div class="faq-section">
              <h4>Frequently Asked Questions</h4>
              <div class="faq-item">
                <div class="faq-question">How accurate are the analysis results?</div>
                <div class="faq-answer">Our AI uses state-of-the-art algorithms to analyze engagement patterns based on public data. Results are generally accurate but can vary based on profile visibility and recent changes.</div>
              </div>
              
              <div class="faq-item">
                <div class="faq-question">Is my X account data safe?</div>
                <div class="faq-answer">We only analyze publicly available data and don't store your password or private information. You can revoke access anytime from your X settings.</div>
              </div>
              
              <div class="faq-item">
                <div class="faq-question">How many posts can I generate?</div>
                <div class="faq-answer">Free users can generate up to 5 posts per day. Premium users have unlimited post generation. Upgrade from your profile section.</div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(helpModal);
      
      // Add event listener for the close button
      const closeButton = helpModal.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        helpModal.classList.remove('show');
      });
      
      // Add event listeners for FAQ items to toggle answers
      const faqQuestions = helpModal.querySelectorAll('.faq-question');
      faqQuestions.forEach(question => {
        question.addEventListener('click', (e) => {
          const answer = e.currentTarget.nextElementSibling;
          answer.classList.toggle('show');
        });
      });
    }
    
    // Show the help modal
    helpModal.classList.add('show');
  }

  // Show feedback form
  showFeedbackForm() {
    let feedbackModal = document.getElementById('feedbackModal');
    
    if (!feedbackModal) {
      feedbackModal = document.createElement('div');
      feedbackModal.id = 'feedbackModal';
      feedbackModal.className = 'modal';
      
      feedbackModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Send Feedback</h3>
            <button class="close-button">&times;</button>
          </div>
          <div class="modal-body">
            <form id="feedbackForm">
              <div class="form-group">
                <label for="feedbackType">Feedback Type</label>
                <select id="feedbackType">
                  <option value="suggestion">Suggestion</option>
                  <option value="bug">Bug Report</option>
                  <option value="question">Question</option>
                  <option value="praise">Praise</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="feedbackSubject">Subject</label>
                <input type="text" id="feedbackSubject" placeholder="Brief summary of your feedback">
              </div>
              
              <div class="form-group">
                <label for="feedbackMessage">Your Message</label>
                <textarea id="feedbackMessage" rows="5" placeholder="Please provide details..."></textarea>
              </div>
              
              <div class="form-group">
                <label for="feedbackEmail">Your Email (optional)</label>
                <input type="email" id="feedbackEmail" placeholder="For us to respond to your feedback">
              </div>
              
              <div class="form-actions">
                <button type="submit" class="primary-button">Send Feedback</button>
              </div>
            </form>
            
            <div id="feedbackSuccess" class="feedback-success hidden">
              <div class="success-icon">✓</div>
              <h4>Thank You!</h4>
              <p>Your feedback has been submitted successfully. We appreciate your input!</p>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(feedbackModal);
      
      // Add event listener for the close button
      const closeButton = feedbackModal.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        feedbackModal.classList.remove('show');
      });
      
      // Add event listener for the feedback form submission
      const feedbackForm = feedbackModal.querySelector('#feedbackForm');
      feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show success message
        feedbackForm.classList.add('hidden');
        document.getElementById('feedbackSuccess').classList.remove('hidden');
        
        // Reset form after 3 seconds and close modal
        setTimeout(() => {
          feedbackForm.reset();
          feedbackForm.classList.remove('hidden');
          document.getElementById('feedbackSuccess').classList.add('hidden');
          feedbackModal.classList.remove('show');
        }, 3000);
        
        // Here you would normally send the feedback data to your server
      });
    }
    
    // Show the feedback modal
    feedbackModal.classList.add('show');
  }

  // Share extension
  shareExtension() {
    // Create share modal with options for Twitter, Facebook, LinkedIn, etc.
    this.showToast('Share modal would open here', 'info');
    
    // For future implementation
    // Could include share links or copy URL functionality
  }

  // Sign in with X
  initiateXSignIn() {
    // This would connect to X's OAuth service
    // For now, let's just show a success message and update the UI
    
    const signInSection = document.querySelector('.sign-in-section');
    if (signInSection) {
      signInSection.innerHTML = `
        <div class="auth-success">
          <div class="success-icon">✓</div>
          <h4>Successfully Signed In</h4>
          <div class="user-profile">
            <div class="profile-avatar">
              <!-- Default avatar -->
              <div class="avatar-placeholder">U</div>
            </div>
            <div class="profile-info">
              <div class="profile-name">User Name</div>
              <div class="profile-handle">@username</div>
            </div>
          </div>
          <button class="disconnect-button">Disconnect Account</button>
        </div>
      `;
      
      // Show profile history section
      document.getElementById('profileHistory').classList.remove('hidden');
      
      // Add event listener for disconnect button
      const disconnectButton = signInSection.querySelector('.disconnect-button');
      disconnectButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.disconnectXAccount();
      });
    }
  }

  // Disconnect X account
  disconnectXAccount() {
    const signInSection = document.querySelector('.sign-in-section');
    if (signInSection) {
      signInSection.innerHTML = `
        <h4>Sign in with X</h4>
        <button class="x-signin-button">
          <x-icon id="signinIcon" state="default" size="20"></x-icon>
          <span>Connect X Account</span>
        </button>
        <p class="auth-info">Connect your X account to save analyses and generated posts.</p>
      `;
      
      // Hide profile history section
      document.getElementById('profileHistory').classList.add('hidden');
      
      // Add event listener for sign in button
      const signInButton = signInSection.querySelector('.x-signin-button');
      signInButton.addEventListener('click', () => {
        this.initiateXSignIn();
      });
    }
  }

  // Animate tab transition
  animateTabTransition(tabName) {
    const tabContent = document.getElementById(`${tabName}Tab`);
    if (tabContent) {
      tabContent.classList.add('slide-in');
      setTimeout(() => {
        tabContent.classList.remove('slide-in');
      }, 300);
    }
  }

  // Show home animation
  showHomeAnimation() {
    const analyzeTab = document.getElementById('analyzeTab');
    if (analyzeTab) {
      analyzeTab.classList.add('pulse');
      setTimeout(() => {
        analyzeTab.classList.remove('pulse');
      }, 500);
    }
  }

  // Show API Settings Modal
  showApiSettings() {
    // Create API settings modal if it doesn't exist
    let apiSettingsModal = document.getElementById('apiSettingsModal');
    
    if (!apiSettingsModal) {
      apiSettingsModal = document.createElement('div');
      apiSettingsModal.id = 'apiSettingsModal';
      apiSettingsModal.className = 'modal api-settings-modal';
      
      apiSettingsModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>API Settings</h3>
            <button class="close-modal">&times;</button>
          </div>
          <div class="modal-body">
            <p>Configure your X API credentials to enable analysis functionality.</p>
            
            <form class="api-credentials-form" id="apiCredentialsForm">
              <div class="api-input-group">
                <label for="apiKey">API Key</label>
                <input type="text" id="apiKey" placeholder="Enter your API Key" />
              </div>
              
              <div class="api-input-group">
                <label for="apiKeySecret">API Key Secret</label>
                <input type="password" id="apiKeySecret" placeholder="Enter your API Key Secret" />
              </div>
              
              <div class="api-input-group">
                <label for="bearerToken">Bearer Token</label>
                <input type="password" id="bearerToken" placeholder="Enter your Bearer Token" />
              </div>
              
              <div class="api-test-results hidden" id="apiTestResults">
                <!-- Test results will be displayed here -->
              </div>
              
              <div class="api-settings-buttons">
                <button type="button" class="test-api-button" id="testApiButton">Test Connection</button>
                <button type="button" class="save-api-button" id="saveApiButton">Save Settings</button>
              </div>
            </form>
            
            <a href="https://developer.twitter.com/en/docs/twitter-api" target="_blank" class="api-help-link">
              How to get API credentials?
            </a>
          </div>
        </div>
      `;
      
      document.body.appendChild(apiSettingsModal);
      
      // Add event listeners for the modal
      const closeButton = apiSettingsModal.querySelector('.close-modal');
      closeButton.addEventListener('click', () => {
        apiSettingsModal.classList.remove('visible');
      });
      
      // Load existing API settings
      this.loadApiSettings();
      
      // Add event listeners for buttons
      const testApiButton = apiSettingsModal.querySelector('#testApiButton');
      testApiButton.addEventListener('click', () => {
        this.testApiConnection();
      });
      
      const saveApiButton = apiSettingsModal.querySelector('#saveApiButton');
      saveApiButton.addEventListener('click', () => {
        this.saveApiSettings();
      });
    }
    
    // Show the API settings modal
    apiSettingsModal.classList.add('visible');
    
    // Add ESC key listener to close modal
    const escapeListener = (e) => {
      if (e.key === 'Escape') {
        apiSettingsModal.classList.remove('visible');
        document.removeEventListener('keydown', escapeListener);
      }
    };
    document.addEventListener('keydown', escapeListener);
  }
  
  // Load existing API settings from storage
  loadApiSettings() {
    chrome.storage.local.get(['apiKey', 'apiKeySecret', 'bearerToken'], (result) => {
      const apiKeyInput = document.getElementById('apiKey');
      const apiKeySecretInput = document.getElementById('apiKeySecret');
      const bearerTokenInput = document.getElementById('bearerToken');
      
      if (apiKeyInput && result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
      
      if (apiKeySecretInput && result.apiKeySecret) {
        apiKeySecretInput.value = result.apiKeySecret;
      }
      
      if (bearerTokenInput && result.bearerToken) {
        bearerTokenInput.value = result.bearerToken;
      }
      
      // Update API status indicator
      this.updateApiStatusIndicator(!!result.bearerToken);
    });
  }
  
  // Test API connection
  testApiConnection() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiKeySecret = document.getElementById('apiKeySecret').value.trim();
    const bearerToken = document.getElementById('bearerToken').value.trim();
    
    const testApiButton = document.getElementById('testApiButton');
    const apiTestResults = document.getElementById('apiTestResults');
    
    if (!bearerToken) {
      this.showTestResult('error', 'Bearer Token is required for API access');
      return;
    }
    
    // Show loading state
    testApiButton.textContent = 'Testing...';
    testApiButton.disabled = true;
    apiTestResults.classList.remove('hidden');
    apiTestResults.innerHTML = '<p>Testing API connection...</p>';
    
    // Send test request to the background script
    chrome.runtime.sendMessage({
      action: 'testApiConnection',
      bearerToken: bearerToken
    }, (response) => {
      testApiButton.textContent = 'Test Connection';
      testApiButton.disabled = false;
      
      if (response && response.success) {
        this.showTestResult('success', 'API connection successful! Your credentials are valid.');
      } else {
        const errorMessage = response.error || 'Unable to connect to the API. Please check your credentials.';
        this.showTestResult('error', errorMessage);
      }
    });
  }
  
  // Show API test result
  showTestResult(status, message) {
    const apiTestResults = document.getElementById('apiTestResults');
    apiTestResults.classList.remove('hidden');
    
    let statusIcon = '';
    if (status === 'success') {
      statusIcon = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"></path></svg>';
    } else {
      statusIcon = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"></path></svg>';
    }
    
    apiTestResults.innerHTML = `
      <div class="api-test-status ${status}">
        ${statusIcon}
        <h4>${status === 'success' ? 'Success!' : 'Error'}</h4>
      </div>
      <p>${message}</p>
    `;
  }
  
  // Save API settings
  saveApiSettings() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiKeySecret = document.getElementById('apiKeySecret').value.trim();
    const bearerToken = document.getElementById('bearerToken').value.trim();
    
    const saveApiButton = document.getElementById('saveApiButton');
    
    // Validate fields
    if (!bearerToken) {
      this.showTestResult('error', 'Bearer Token is required for API access');
      return;
    }
    
    // Show loading state
    saveApiButton.textContent = 'Saving...';
    saveApiButton.disabled = true;
    
    // Save to chrome storage
    chrome.storage.local.set({
      apiKey: apiKey,
      apiKeySecret: apiKeySecret,
      bearerToken: bearerToken
    }, () => {
      saveApiButton.textContent = 'Save Settings';
      saveApiButton.disabled = false;
      
      // Update API status indicator
      this.updateApiStatusIndicator(true);
      
      // Show success message
      this.showToast('API settings saved successfully', 'success');
      
      // Close the modal after a short delay
      setTimeout(() => {
        const apiSettingsModal = document.getElementById('apiSettingsModal');
        if (apiSettingsModal) {
          apiSettingsModal.classList.remove('visible');
        }
      }, 1500);
    });
  }
  
  // Update API status indicator in footer
  updateApiStatusIndicator(isConnected) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (statusDot && statusText) {
      if (isConnected) {
        statusDot.classList.add('active');
        statusText.textContent = 'API Connected';
      } else {
        statusDot.classList.remove('active');
        statusText.textContent = 'API Not Configured';
      }
    }
  }

  // Show notification
  showToast(message, type = 'info') {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-message">${message}</span>
      </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the TabManager when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.tabManager = new TabManager();
}); 