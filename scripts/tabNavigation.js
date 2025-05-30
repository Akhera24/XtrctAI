/**
 * Tab Navigation Handler for X Profile Analyzer
 * Handles switching between different tabs in the popup UI
 */

// Initialize tab navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check if our new index.js is managing the tabs
  if (window.XProfileAnalyzer && window.XProfileAnalyzer.tabsInitialized) {
    console.log('Tabs already managed by index.js, skipping initialization');
    return;
  }
  
  // Set a flag to indicate we're handling tabs
  window.XProfileAnalyzer = window.XProfileAnalyzer || {};
  window.XProfileAnalyzer.tabsInitialized = true;
  
  setupTabNavigation();
  
  console.log('Tab navigation initialized by tabNavigation.js');
});

/**
 * Sets up tab navigation functionality
 */
function setupTabNavigation() {
  try {
    // Get tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (!tabButtons.length || !tabContents.length) {
      console.error('Tab elements not found');
      return;
    }
    
    console.log(`Found ${tabButtons.length} tab buttons and ${tabContents.length} tab contents`);
    
    // Add click event listeners to tab buttons
    tabButtons.forEach(button => {
      button.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent default action
        
        const tabId = button.getAttribute('data-tab') || button.id;
        console.log(`Tab clicked: ${tabId}`);
        
        // Find the corresponding content element
        let content;
        
        if (tabId) {
          content = document.getElementById(tabId) || 
                    document.querySelector(`.tab-content[data-tab="${tabId}"]`);
        }
        
        if (!content) {
          console.error(`Could not find tab content for ${tabId}`);
          return;
        }
        
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => {
          content.classList.remove('active');
          content.style.display = 'none';
        });
        
        // Activate the clicked tab
        button.classList.add('active');
        content.classList.add('active');
        content.style.display = 'block';
        
        // Load content based on tab type
        if (tabId === 'history-tab' || button.innerText.includes('History')) {
          console.log('Loading history tab content');
          loadHistoryContent();
        } else if (tabId === 'compose-tab' || button.innerText.includes('Compose')) {
          console.log('Loading compose tab content');
          initializeComposeTab();
        }
      });
    });
    
    // Fix any already active tabs that might not be properly displayed
    const activeButton = document.querySelector('.tab-button.active');
    if (activeButton) {
      console.log('Setting up initial active tab:', activeButton.id || activeButton.getAttribute('data-tab'));
      
      const tabId = activeButton.getAttribute('data-tab') || activeButton.id;
      
      const activeContent = document.getElementById(tabId) || 
                           document.querySelector(`.tab-content[data-tab="${tabId}"]`);
      
      if (activeContent) {
        // Force display in case CSS isn't working
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
      }
    } else {
      // If no tab is active, activate the first one
      if (tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons[0].classList.add('active');
        
        const firstTabId = tabButtons[0].getAttribute('data-tab') || tabButtons[0].id;
        const firstContent = document.getElementById(firstTabId) || 
                           document.querySelector(`.tab-content[data-tab="${firstTabId}"]`) ||
                           tabContents[0];
                           
        if (firstContent) {
          firstContent.classList.add('active');
          firstContent.style.display = 'block';
        }
      }
    }
  } catch (error) {
    console.error('Error setting up tab navigation:', error);
  }
}

/**
 * Load history content when history tab is selected
 */
function loadHistoryContent() {
  try {
    // Find the history container
    const historyContainer = document.getElementById('history-content') || 
                            document.querySelector('.history-content') ||
                            document.getElementById('historyItemsContainer');
                            
    if (!historyContainer) {
      console.error('History container not found');
      return;
    }
    
    console.log('Loading history from storage');
    
    // Load history from storage - try both keys for compatibility
    chrome.storage.local.get(['profileHistory', 'analysisHistory'], function(result) {
      const history = result.profileHistory || result.analysisHistory || [];
      
      // Update UI based on history
      if (history.length === 0) {
        // Show empty state
        historyContainer.innerHTML = `
          <div class="empty-state">
            <h3>No Analysis History</h3>
            <p>Profiles you analyze will appear here</p>
          </div>
        `;
      } else {
        // Render history items
        historyContainer.innerHTML = '';
        
        history.forEach(item => {
          const date = new Date(item.timestamp);
          const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          
          // Format metrics
          const followers = formatNumber(item.followers || item.metrics?.followers || 0);
          const following = formatNumber(item.following || 0);
          const engagement = item.engagement || item.metrics?.engagement || '0%';
          
          const historyItem = document.createElement('div');
          historyItem.className = 'history-item';
          historyItem.innerHTML = `
            <div class="history-item-header">
              <div class="username">@${item.username}</div>
              <div class="timestamp">${formattedDate}</div>
            </div>
            <div class="history-item-metrics">
              <div class="metric">
                <span class="label">Followers:</span>
                <span class="value">${followers}</span>
              </div>
              <div class="metric">
                <span class="label">Following:</span>
                <span class="value">${following}</span>
              </div>
              <div class="metric">
                <span class="label">Engagement:</span>
                <span class="value">${engagement}</span>
              </div>
            </div>
            <div class="history-item-actions">
              <button class="history-action-btn analyze-again" data-username="${item.username}">
                Analyze Again
              </button>
            </div>
          `;
          
          historyContainer.appendChild(historyItem);
          
          // Add click handler to "Analyze Again" buttons
          const analyzeAgainBtn = historyItem.querySelector('.analyze-again');
          if (analyzeAgainBtn) {
            analyzeAgainBtn.addEventListener('click', function() {
              const username = this.getAttribute('data-username');
              console.log(`Analyze again clicked for: ${username}`);
              
              // Switch to analyze tab
              const analyzeTab = document.querySelector('.tab-button[data-tab="analyze-tab"]') || 
                               document.getElementById('analyze-tab') ||
                               document.querySelector('.tab-button');
                               
              if (analyzeTab) {
                analyzeTab.click();
              }
              
              // Fill input field
              const profileInput = document.getElementById('profile-input');
              if (profileInput) {
                profileInput.value = username;
                
                // Trigger button state update if needed
                if (window.updateAnalyzeButtonState) {
                  window.updateAnalyzeButtonState();
                }
              }
              
              // Trigger analyze click after short delay to allow UI to update
              setTimeout(() => {
                const analyzeButton = document.getElementById('analyze-button');
                if (analyzeButton) {
                  analyzeButton.click();
                }
              }, 100);
            });
          }
        });
      }
    });
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

/**
 * Initialize the compose tab features
 */
function initializeComposeTab() {
  // Set up character counter
  const postTextarea = document.querySelector('.post-input');
  const charCounter = document.querySelector('.character-counter');
  
  if (postTextarea && charCounter) {
    // One-time setup
    if (!postTextarea._hasCounterSetup) {
      postTextarea.addEventListener('input', function() {
        const currentLength = this.value.length;
        const maxLength = this.getAttribute('maxlength') || 280;
        
        // Update counter
        charCounter.textContent = `${currentLength}/${maxLength}`;
        
        // Add warning class if approaching limit
        if (currentLength > maxLength * 0.9) {
          charCounter.classList.add('warning');
        } else {
          charCounter.classList.remove('warning');
        }
      });
      
      postTextarea._hasCounterSetup = true;
    }
  }
  
  // Set up type selector buttons
  const typeButtons = document.querySelectorAll('.type-btn');
  typeButtons.forEach(btn => {
    // One-time setup
    if (!btn._hasTypeSetup) {
      btn.addEventListener('click', function() {
        typeButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
      btn._hasTypeSetup = true;
    }
  });
  
  // Set up tone selector buttons
  const toneButtons = document.querySelectorAll('.tone-btn');
  toneButtons.forEach(btn => {
    // One-time setup
    if (!btn._hasToneSetup) {
      btn.addEventListener('click', function() {
        toneButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
      btn._hasToneSetup = true;
    }
  });
  
  // Set up generate button
  const generateButton = document.getElementById('generate-button');
  if (generateButton && !generateButton._hasGenerateSetup) {
    generateButton.addEventListener('click', function() {
      const topicInput = document.getElementById('post-topic');
      if (!topicInput || !topicInput.value.trim()) {
        if (window.showToast) {
          window.showToast('Please enter a topic for your post', 'error');
        } else {
          alert('Please enter a topic for your post');
        }
        return;
      }
      
      const type = document.querySelector('.type-btn.active')?.getAttribute('data-type') || 'engagement';
      const tone = document.querySelector('.tone-btn.active')?.getAttribute('data-tone') || 'professional';
      
      // Show a placeholder/fallback for now
      if (window.showToast) {
        window.showToast('Post generation is not available in this version', 'info');
      } else {
        alert('Post generation is not available in this version');
      }
    });
    generateButton._hasGenerateSetup = true;
  }
}

/**
 * Format number for display
 */
function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  
  return num.toString();
}

// Expose functions for testing and external use
window.tabNavigation = {
  setupTabNavigation,
  loadHistoryContent,
  initializeComposeTab
}; 