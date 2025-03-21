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
    let shareModal = document.getElementById('shareModal');
    
    if (!shareModal) {
      shareModal = document.createElement('div');
      shareModal.id = 'shareModal';
      shareModal.className = 'modal';
      
      shareModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Share X Analyzer</h3>
            <button class="close-button">&times;</button>
          </div>
          <div class="modal-body">
            <p>Share this Chrome extension with others:</p>
            
            <div class="share-link-container">
              <input type="text" readonly value="https://chrome.google.com/webstore/detail/x-analyzer/extension-id" id="shareLink">
              <button id="copyLinkButton" class="copy-button" title="Copy to clipboard">
                <span class="copy-icon">📋</span>
              </button>
            </div>
            
            <div class="social-share-buttons">
              <button class="social-share-button twitter">
                <span class="social-icon">𝕏</span>
                Share on X
              </button>
              <button class="social-share-button linkedin">
                <span class="social-icon">in</span>
                Share on LinkedIn
              </button>
              <button class="social-share-button email">
                <span class="social-icon">✉️</span>
                Share via Email
              </button>
            </div>
            
            <div class="qr-code-container">
              <p>Or scan this QR code:</p>
              <div class="qr-code-placeholder">
                <!-- QR code would be dynamically generated or a static image -->
                <div class="qr-code-image">QR</div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(shareModal);
      
      // Add event listener for the close button
      const closeButton = shareModal.querySelector('.close-button');
      closeButton.addEventListener('click', () => {
        shareModal.classList.remove('show');
      });
      
      // Add event listener for the copy link button
      const copyLinkButton = shareModal.querySelector('#copyLinkButton');
      copyLinkButton.addEventListener('click', () => {
        const shareLink = document.getElementById('shareLink');
        shareLink.select();
        document.execCommand('copy');
        
        // Show copied message
        copyLinkButton.innerHTML = '<span class="copy-icon">✓</span>';
        copyLinkButton.classList.add('copied');
        
        // Reset after 2 seconds
        setTimeout(() => {
          copyLinkButton.innerHTML = '<span class="copy-icon">📋</span>';
          copyLinkButton.classList.remove('copied');
        }, 2000);
      });
      
      // Add event listeners for social share buttons
      const twitterButton = shareModal.querySelector('.social-share-button.twitter');
      twitterButton.addEventListener('click', () => {
        const shareText = encodeURIComponent('Check out this amazing X Analyzer Chrome extension!');
        const shareUrl = encodeURIComponent('https://chrome.google.com/webstore/detail/x-analyzer/extension-id');
        window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, '_blank');
      });
      
      const linkedinButton = shareModal.querySelector('.social-share-button.linkedin');
      linkedinButton.addEventListener('click', () => {
        const shareUrl = encodeURIComponent('https://chrome.google.com/webstore/detail/x-analyzer/extension-id');
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, '_blank');
      });
      
      const emailButton = shareModal.querySelector('.social-share-button.email');
      emailButton.addEventListener('click', () => {
        const subject = encodeURIComponent('Check out this X Analyzer Chrome extension');
        const body = encodeURIComponent('I found this useful Chrome extension for analyzing X profiles: https://chrome.google.com/webstore/detail/x-analyzer/extension-id');
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      });
    }
    
    // Show the share modal
    shareModal.classList.add('show');
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
}

// Initialize the TabManager when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.tabManager = new TabManager();
}); 