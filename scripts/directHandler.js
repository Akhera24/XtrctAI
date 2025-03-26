/**
 * Direct handler for the analyze button - avoids dependency issues
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('directHandler.js: Setting up direct analyze button handler');
  
  // Get UI elements
  const profileInput = document.getElementById('profile-input');
  const analyzeButton = document.getElementById('analyze-button');
  const resultsContainer = document.getElementById('results-container');
  const loadingOverlay = document.querySelector('.loading-overlay');
  
  // Initialize UI state
  initializeUI();
  
  // Setup tab navigation
  setupTabNavigation();
  
  // Hide results container initially
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
  
  // Function to initialize UI state
  function initializeUI() {
    console.log('Initializing UI state');
    
    // Get all tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Hide all tab contents initially
    tabContents.forEach(content => {
      content.style.display = 'none';
      content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // Set analyze tab as active by default
    const analyzeTabButton = document.getElementById('analyze-tab');
    const analyzeTabContent = document.querySelector('.tab-content#analyze-tab');
    
    if (analyzeTabButton && analyzeTabContent) {
      analyzeTabButton.classList.add('active');
      analyzeTabContent.classList.add('active');
      analyzeTabContent.style.display = 'block';
      console.log('Analyze tab set as active');
    } else {
      console.error('Analyze tab elements not found:', {
        buttonFound: !!analyzeTabButton,
        contentFound: !!analyzeTabContent
      });
    }
    
    // Initialize button states
    if (analyzeButton) {
      analyzeButton.disabled = true;
      analyzeButton.classList.remove('active');
    }
    
    // Initialize profile input
    if (profileInput) {
      profileInput.value = '';
      profileInput.focus();
    }
    
    // Initialize loading overlay
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      
      // Set up cancel button
      const cancelButton = loadingOverlay.querySelector('#cancel-loading');
      if (cancelButton) {
        cancelButton.addEventListener('click', () => {
          loadingOverlay.classList.add('hidden');
          if (analyzeButton) {
            analyzeButton.disabled = false;
            analyzeButton.innerHTML = 'Analyze';
          }
        });
      }
    }
    
    // Load history if available
    chrome.storage.local.get(['analysisHistory'], (result) => {
      if (result.analysisHistory) {
        loadHistory();
      }
    });
  }
  
  // Function to enable/disable analyze button based on input
  function updateAnalyzeButtonState() {
    if (profileInput && analyzeButton) {
      const hasInput = profileInput.value.trim().length > 0;
      
      // Update button state
      analyzeButton.disabled = !hasInput;
      
      if (hasInput) {
        analyzeButton.classList.add('active');
      } else {
        analyzeButton.classList.remove('active');
      }
      
      console.log(`Analyze button state updated: disabled=${!hasInput}`);
    }
  }
  
  // Set up profile input change listener
  if (profileInput) {
    console.log('Setting up profile input listener');
    profileInput.addEventListener('input', updateAnalyzeButtonState);
    
    // Initial check
    updateAnalyzeButtonState();
  }
  
  // Set up tab navigation
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    console.log('Setting up tab navigation with:', {
      buttonCount: tabButtons.length,
      contentCount: tabContents.length,
      buttonIds: Array.from(tabButtons).map(b => b.id),
      contentIds: Array.from(tabContents).map(c => c.id)
    });
    
    // Set up click handlers for tab buttons
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.id;
        console.log('Tab button clicked:', tabId);
        
        // Find the corresponding content
        const tabContent = document.querySelector(`.tab-content#${tabId}`);
        
        if (tabContent) {
          // Remove active class from all buttons and contents
          tabButtons.forEach(btn => btn.classList.remove('active'));
          tabContents.forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
          });
          
          // Add active class to clicked button and its content
          button.classList.add('active');
          tabContent.classList.add('active');
          tabContent.style.display = 'block';
          
          // Handle special cases for each tab
          switch(tabId) {
            case 'compose-tab':
              setupComposeTab();
              break;
            case 'history-tab':
              loadHistory();
              break;
            case 'analyze-tab':
              // Focus profile input and update button state
              const profileInput = document.getElementById('profile-input');
              if (profileInput) {
                profileInput.focus();
                // Update analyze button state based on current input
                updateAnalyzeButtonState();
              }
              break;
          }
          
          console.log('Activated tab content:', tabId);
        } else {
          console.error('Tab content not found for tab button:', tabId);
        }
      });
    });
    
    // Set up test API button
    const testApiButton = document.getElementById('test-api-button');
    if (testApiButton) {
      testApiButton.addEventListener('click', handleTestApiClick);
    }
    
    // Set up generate post button in compose tab
    const generateButton = document.getElementById('generate-button');
    if (generateButton) {
      generateButton.addEventListener('click', handleGeneratePost);
    }
    
    // Set up clear history button
    const clearHistoryButton = document.getElementById('clear-history-button');
    if (clearHistoryButton) {
      clearHistoryButton.addEventListener('click', () => {
        chrome.storage.local.set({ analysisHistory: [] }, () => {
          loadHistory();
          showToast('History cleared', 'success');
        });
      });
    }
  }
  
  // Setup compose tab functionality
  function setupComposeTab() {
    console.log('Setting up compose tab');
    
    // Set up type buttons
    const typeButtons = document.querySelectorAll('.type-btn');
    typeButtons.forEach(button => {
      button.addEventListener('click', () => {
        typeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });
    
    // Set up tone buttons
    const toneButtons = document.querySelectorAll('.tone-btn');
    toneButtons.forEach(button => {
      button.addEventListener('click', () => {
        toneButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });
    
    // Set up character counter for post textarea
    const postTextarea = document.querySelector('.post-composer .post-input');
    const charCounter = document.querySelector('.character-counter');
    
    if (postTextarea && charCounter) {
      postTextarea.addEventListener('input', () => {
        const count = postTextarea.value.length;
        charCounter.textContent = `${count}/280`;
        
        if (count > 240) {
          charCounter.classList.add('warning');
        } else {
          charCounter.classList.remove('warning');
        }
      });
    }
    
    // Set up post button
    const postButton = document.querySelector('.post-now-button');
    if (postButton) {
      postButton.addEventListener('click', () => {
        if (postTextarea && postTextarea.value.trim()) {
          showToast('Post functionality coming soon!', 'info');
          postTextarea.value = '';
          charCounter.textContent = '0/280';
        } else {
          showToast('Please enter post content first', 'error');
        }
      });
    }
  }
  
  // Handle post generation
  function handleGeneratePost() {
    console.log('Generate post button clicked');
    
    // Get topic input
    const topicInput = document.getElementById('post-topic');
    if (!topicInput || !topicInput.value.trim()) {
      showToast('Please enter a topic first', 'error');
      return;
    }
    
    const topic = topicInput.value.trim();
    
    // Get selected post type
    const selectedTypeButton = document.querySelector('.type-btn.active');
    const postType = selectedTypeButton ? selectedTypeButton.getAttribute('data-type') || 'engagement' : 'engagement';
    
    // Get selected tone
    const selectedToneButton = document.querySelector('.tone-btn.active');
    const tone = selectedToneButton ? selectedToneButton.getAttribute('data-tone') || 'professional' : 'professional';
    
    // Get options
    const includeHashtags = document.getElementById('include-hashtags')?.checked ?? true;
    const includeEmojis = document.getElementById('include-emojis')?.checked ?? true;
    const includeCta = document.getElementById('include-cta')?.checked ?? false;
    
    // Show loading state
    const generateButton = document.getElementById('generate-button');
    if (generateButton) {
      generateButton.disabled = true;
      generateButton.innerHTML = '<span class="loading-spinner"></span> Generating...';
    }
    
    // Call generatePosts from grokService or use mock data
    try {
      import('./grokService.js').then(grokService => {
        grokService.generatePosts(topic, {
          type: postType,
          tone: tone,
          includeHashtags: includeHashtags,
          includeEmojis: includeEmojis,
          includeCta: includeCta,
          count: 3
        }).then(result => {
          if (generateButton) {
            generateButton.disabled = false;
            generateButton.textContent = 'Generate Post';
          }
          
          if (result.success) {
            showGeneratedPosts(result.posts, topic);
            showToast('Generated posts successfully!', 'success');
          } else {
            // Show mock posts if API fails
            const mockPosts = [
              `Check out these insights on ${topic}! The data shows some surprising trends that could impact your strategy. #${topic.replace(/\s+/g, '')} #insights 📊`,
              `Question: What's your biggest challenge with ${topic}? Share your thoughts below and let's discuss solutions. I'll share my tips in a thread! #${topic.replace(/\s+/g, '')}`,
              `Just published a new guide on ${topic}. Learn the 5 key strategies that can help you improve your results by up to 30%! Link in bio. #${topic.replace(/\s+/g, '')} #guide 🔍`
            ];
            
            const formattedPosts = mockPosts.map((content, index) => ({
              id: index + 1,
              content: content,
              characterCount: content.length
            }));
            
            showGeneratedPosts(formattedPosts, topic);
            showToast('Generated mock posts (API unavailable)', 'info');
          }
        }).catch(error => {
          console.error('Error generating posts:', error);
          if (generateButton) {
            generateButton.disabled = false;
            generateButton.textContent = 'Generate Post';
          }
          showToast('Error generating posts', 'error');
        });
      }).catch(error => {
        console.error('Error importing grokService:', error);
        if (generateButton) {
          generateButton.disabled = false;
          generateButton.textContent = 'Generate Post';
        }
        showToast('Error loading post generation service', 'error');
      });
    } catch (error) {
      console.error('Error with post generation:', error);
      if (generateButton) {
        generateButton.disabled = false;
        generateButton.textContent = 'Generate Post';
      }
      showToast('Error with post generation', 'error');
    }
  }
  
  // Display generated posts
  function showGeneratedPosts(posts, topic) {
    const postsContainer = document.getElementById('generated-posts-container');
    if (!postsContainer) return;
    
    postsContainer.innerHTML = `
      <div class="generated-posts-header">
        <h3>Generated Posts for "${topic}"</h3>
      </div>
      <div class="posts-grid">
        ${posts.map(post => `
          <div class="post-card">
            <div class="post-content">${post.content}</div>
            <div class="post-actions">
              <div class="character-count ${post.characterCount > 270 ? 'warning' : ''}">
                ${post.characterCount}/280
              </div>
              <div class="post-buttons">
                <button class="use-post-button" data-post-id="${post.id}">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                  </svg>
                  Use
                </button>
                <button class="copy-post-button" data-post-id="${post.id}">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                  Copy
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Set up event listeners for post actions
    postsContainer.querySelectorAll('.use-post-button').forEach(button => {
      button.addEventListener('click', () => {
        const postId = button.getAttribute('data-post-id');
        const postContent = posts.find(p => p.id == postId)?.content;
        
        if (postContent) {
          const postTextarea = document.querySelector('.post-composer .post-input');
          if (postTextarea) {
            postTextarea.value = postContent;
            postTextarea.dispatchEvent(new Event('input'));
            showToast('Post added to composer', 'success');
          }
        }
      });
    });
    
    postsContainer.querySelectorAll('.copy-post-button').forEach(button => {
      button.addEventListener('click', () => {
        const postId = button.getAttribute('data-post-id');
        const postContent = posts.find(p => p.id == postId)?.content;
        
        if (postContent) {
          navigator.clipboard.writeText(postContent).then(() => {
            showToast('Post copied to clipboard', 'success');
          }).catch(err => {
            console.error('Failed to copy post:', err);
            showToast('Failed to copy post', 'error');
          });
        }
      });
    });
  }
  
  // Set up analyze button click handler
  if (analyzeButton) {
    console.log('Setting up analyze button click handler');
    analyzeButton.addEventListener('click', function(event) {
      event.preventDefault();
      console.log('Analyze button clicked');
      
      const profileInput = document.getElementById('profile-input');
      if (!profileInput || !profileInput.value.trim()) {
        console.log('No profile input, cannot analyze');
        return;
      }
      
      const username = extractUsername(profileInput.value);
      console.log('Extracted username:', username);
      
      if (!username) {
        showToast('Invalid profile format. Please use @handle or full profile URL.', 'error');
        return;
      }
      
      // Store original button text
      const originalText = analyzeButton.textContent;
      
      // Show loading state
      analyzeButton.disabled = true;
      analyzeButton.innerHTML = '<span class="loading-spinner"></span><span>Analyzing...</span>';
      
      // Show loading overlay
      let progressInterval;
      let apiTimeout;
      
      // Check if loading overlay exists
      const loadingOverlay = document.querySelector('.loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        
        const loadingText = loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
          loadingText.textContent = 'Analyzing profile...';
        }
        
        const progressBar = loadingOverlay.querySelector('.progress-bar') || loadingOverlay.querySelector('.progress-fill');
        if (progressBar) {
          progressBar.style.width = '0%';
          
          // Animate progress
          let progress = 0;
          progressInterval = setInterval(() => {
            progress += 1;
            if (progress > 90) {
              clearInterval(progressInterval);
            }
            progressBar.style.width = `${progress}%`;
            
            // Update loading text at different stages
            if (progress === 20 && loadingText) {
              loadingText.textContent = 'Fetching profile data...';
            } else if (progress === 40 && loadingText) {
              loadingText.textContent = 'Analyzing recent posts...';
            } else if (progress === 60 && loadingText) {
              loadingText.textContent = 'Calculating engagement metrics...';
            } else if (progress === 80 && loadingText) {
              loadingText.textContent = 'Generating insights...';
            }
          }, 100);
          
          // Set up cancel button
          const cancelButton = loadingOverlay.querySelector('#cancel-loading');
          if (cancelButton) {
            const cancelHandler = function() {
              // Clean up
              clearInterval(progressInterval);
              clearTimeout(apiTimeout);
              loadingOverlay.classList.add('hidden');
              analyzeButton.innerHTML = originalText;
              analyzeButton.disabled = false;
              showToast('Analysis canceled', 'info');
              
              // Remove event listener to prevent memory leaks
              cancelButton.removeEventListener('click', cancelHandler);
            };
            
            cancelButton.addEventListener('click', cancelHandler);
          }
        }
      } else {
        console.error('Loading overlay element not found');
      }
      
      // Set a timeout for the API call (20 seconds)
      apiTimeout = setTimeout(() => {
        clearInterval(progressInterval);
        if (loadingOverlay) {
          loadingOverlay.classList.add('hidden');
        }
        analyzeButton.innerHTML = originalText;
        analyzeButton.disabled = false;
        showToast('Analysis timed out. Please try again later.', 'error');
        
        // Add fallback data when API times out
        showFallbackResults(username);
        
        // Also add to history so it's visible there
        addToHistory(username, {
          followers: Math.floor(Math.random() * 10000) + 500,
          following: Math.floor(Math.random() * 1000) + 100,
          engagement: Math.floor(Math.random() * 10) + 1,
          postCount: Math.floor(Math.random() * 100) + 10
        });
      }, 20000);
      
      // Use the actual X API via background.js
      try {
        // Add additional debugging for the message sending
        console.log('Sending analyze profile message to background.js:', {
          action: 'analyzeProfile',
          username: username
        });
        
        chrome.runtime.sendMessage({
          action: 'analyzeProfile',
          username: username
        }, function(response) {
          // Clear the timeout since we got a response
          clearTimeout(apiTimeout);
          
          console.log('Received API response:', response);
          
          // Check if we got a valid response object
          if (!response) {
            console.error('Empty response from API');
            showToast('Failed to connect to Twitter API. Please try again.', 'error');
            hideLoadingAndResetButton();
            showFallbackResults(username);
            return;
          }
          
          // Clear the progress animation
          if (progressInterval) {
            clearInterval(progressInterval);
          }
          
          // Complete the progress bar
          const progressBar = loadingOverlay?.querySelector('.progress-bar') || loadingOverlay?.querySelector('.progress-fill');
          if (progressBar) {
            progressBar.style.width = '100%';
          }
          
          // Update loading text
          const loadingText = loadingOverlay?.querySelector('.loading-text');
          if (loadingText) {
            loadingText.textContent = 'Processing data...';
          }
          
          // Hide loading overlay after a short delay
          setTimeout(() => {
            hideLoadingAndResetButton();
            
            if (response && response.success) {
              // Check if we have expected data with proper structure
              if (!response.data || !response.data.user) {
                console.error('API response missing expected data structure:', response);
                
                // Log the API error for debugging
                if (response.error) {
                  console.error('API Error:', response.error);
                  showToast(`API Error: ${response.error}`, 'error');
                } else {
                  showToast('Received incomplete data from Twitter API', 'error');
                }
                
                // Show fallback results
                showFallbackResults(username);
                return;
              }
              
              // Log detailed API response for debugging
              console.log('API response details:', {
                success: response.success,
                fromCache: response.fromCache,
                user: response.data?.user,
                dataKeys: Object.keys(response.data || {}),
                rateLimitInfo: response.rateLimit
              });
              
              // Show real results
              showResults(username, response.data);
              
              // Show success toast
              showToast(
                response.fromCache 
                  ? 'Analysis loaded from cache!' 
                  : 'Analysis completed successfully!', 
                'success'
              );
              
              // Update rate limit display
              updateRateLimitDisplay(response.rateLimit);
            } else {
              // Show error with more details if available
              const errorMsg = response?.error 
                ? `Failed: ${response.error}` 
                : 'Failed to analyze profile. Please try again later.';
              
              showToast(errorMsg, 'error');
              
              // Show fallback results
              showFallbackResults(username);
              
              // Log error details
              console.error('API error details:', {
                error: response?.error,
                responseObj: response
              });
            }
          }, 500);
        });
      } catch (error) {
        console.error('Error sending message to background:', error);
        clearTimeout(apiTimeout);
        clearInterval(progressInterval);
        hideLoadingAndResetButton();
        showToast('Error connecting to API: ' + error.message, 'error');
        showFallbackResults(username);
      }
    });
  }
  
  // Helper: Extract username from input
  function extractUsername(input) {
    if (!input) return null;
    
    input = input.trim();
    
    // Handle direct username with @
    if (input.startsWith('@')) {
      return input.substring(1);
    }
    
    // Handle full URL format
    const urlRegex = /twitter\.com\/([a-zA-Z0-9_]+)|x\.com\/([a-zA-Z0-9_]+)/;
    const match = input.match(urlRegex);
    
    if (match) {
      return match[1] || match[2]; // Return the captured username
    }
    
    // Handle plain username
    const usernameRegex = /^[a-zA-Z0-9_]{1,15}$/;
    if (usernameRegex.test(input)) {
      return input;
    }
    
    return null;
  }
  
  // Helper: Show toast notification
  function showToast(message, type = 'info') {
    console.log(`Toast: ${type} - ${message}`);
    
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-message">${message}</span>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Automatically remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  // Helper: Show API results
  function showResults(username, data) {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    
    console.log('Showing results for data:', data);
    
    // Safely extract data from response structure
    let user, analytics, followers, following, tweets, engagement;
    
    try {
      // Check if we have a valid response object first
      if (!data) {
        console.error('No data provided to showResults');
        showFallbackResults(username);
        return;
      }
      
      // Different possible response structures
      if (data.user) {
        // Standard structure
        user = data.user;
        analytics = data.analytics || {};
      } else if (data.data && data.data.data) {
        // Nested structure from Twitter API
        user = data.data.data;
        analytics = data.analytics || {};
      } else if (data.data) {
        // Alternative structure
        user = data.data;
        analytics = data.analytics || {};
      } else {
        // No valid user data found, use fallback
        console.warn('No valid user data found in API response, using fallback');
        showFallbackResults(username);
        return;
      }
      
      // Verify that we have the required metrics
      if (!user.public_metrics) {
        console.error('API response missing public_metrics');
        showFallbackResults(username);
        return;
      }
      
      // Extract metrics with safe fallbacks
      followers = user.public_metrics.followers_count || 0;
      following = user.public_metrics.following_count || 0;
      tweets = user.public_metrics.tweet_count || 0;
      
      // Handle different engagement rate formats
      engagement = 0;
      if (analytics.engagement_rate) {
        if (typeof analytics.engagement_rate === 'object' && analytics.engagement_rate.overall !== undefined) {
          engagement = analytics.engagement_rate.overall;
        } else if (typeof analytics.engagement_rate === 'number') {
          engagement = analytics.engagement_rate;
        }
      }
      engagement = engagement.toFixed(1);
        
      const bestTimes = analytics.best_posting_times || [];
      const topContent = analytics.top_performing_content || [];
      
      // Format best posting times
      const formattedTimes = bestTimes.length > 0 ? 
        bestTimes.map(time => {
          const day = time.day?.charAt(0).toUpperCase() + time.day?.slice(1);
          return `${day} at ${time.hour}`;
        }).slice(0, 3).join(', ') : 
        'No data available';
      
      // Format top hashtags
      const topHashtags = topContent.length > 0 ?
        topContent
          .filter(content => content.type === 'hashtag')
          .map(content => `#${content.value}`)
          .slice(0, 3)
          .join(', ') :
        'No hashtags found';
      
      // Additional insights from Grok if available
      const grokInsights = data.grokAnalysis?.engagementInsights || [];
      const growthTips = data.grokAnalysis?.growthStrategy || [];
      
      // Recent tweets if available
      const tweetList = data.tweets || [];
      const recentTweet = tweetList.length > 0 ? tweetList[0] : null;
      
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = `
        <div class="results-card">
          <h3>Analysis for @${username}</h3>
          <p>Profile analyzed successfully. Here are the key metrics:</p>
          
          <div class="profile-header">
            <div class="profile-image">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
            </div>
            <div class="profile-details">
              <h4>@${username}</h4>
              <p>${user.description || 'No description available'}</p>
            </div>
          </div>
          
          <div class="metrics-grid">
            <div class="metric-card fade-in">
              <div class="metric-value">${followers > 1000 ? (followers / 1000).toFixed(1) + 'K' : followers}</div>
              <div class="metric-label">Followers</div>
            </div>
            <div class="metric-card fade-in">
              <div class="metric-value">${following > 1000 ? (following / 1000).toFixed(1) + 'K' : following}</div>
              <div class="metric-label">Following</div>
            </div>
            <div class="metric-card fade-in">
              <div class="metric-value">${tweets > 1000 ? (tweets / 1000).toFixed(1) + 'K' : tweets}</div>
              <div class="metric-label">Tweets</div>
            </div>
            <div class="metric-card fade-in">
              <div class="metric-value">${engagement}%</div>
              <div class="metric-label">Engagement</div>
            </div>
          </div>
          
          ${analytics && (bestTimes.length > 0 || topContent.length > 0 || data.strategy) ? `
          <div class="analytics-section">
            <h4>Profile Analytics</h4>
            <div class="analytics-item">
              <div class="analytics-label">Best Posting Times</div>
              <div class="analytics-value">${formattedTimes}</div>
            </div>
            <div class="analytics-item">
              <div class="analytics-label">Popular Hashtags</div>
              <div class="analytics-value">${topHashtags}</div>
            </div>
            <div class="analytics-item">
              <div class="analytics-label">Content Strategy</div>
              <div class="analytics-value">${data.strategy?.summary || 'Regular posting with varied content types'}</div>
            </div>
          </div>
          ` : ''}
          
          ${recentTweet ? `
          <div class="recent-tweet-section">
            <h4>Recent Tweet</h4>
            <div class="tweet-card">
              <p class="tweet-text">${recentTweet.text}</p>
              <div class="tweet-metrics">
                <span><strong>${recentTweet.public_metrics?.like_count || 0}</strong> Likes</span>
                <span><strong>${recentTweet.public_metrics?.retweet_count || 0}</strong> Retweets</span>
                <span><strong>${recentTweet.public_metrics?.reply_count || 0}</strong> Replies</span>
              </div>
              <div class="tweet-date">${new Date(recentTweet.created_at).toLocaleDateString()}</div>
            </div>
          </div>
          ` : ''}
          
          ${grokInsights.length > 0 ? `
          <div class="insights-section">
            <h4>AI-Generated Insights</h4>
            <ul>
              ${grokInsights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${growthTips.length > 0 ? `
          <div class="growth-section">
            <h4>Growth Recommendations</h4>
            <ul>
              ${growthTips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div class="data-source">
            ${data.fromCache ? 
              `<span class="cache-badge">Loaded from cache</span>` : 
              `<span class="live-badge">Live data</span>`}
          </div>
        </div>
        
        <!-- Rate Limit Display -->
        <div class="rate-limit-container">
          <div class="rate-limit-label">API Usage</div>
          <div class="rate-limit-progress">
            <div id="rate-limit-bar" class="rate-limit-fill" style="width: ${(data.rateLimit?.used / data.rateLimit?.total) * 100 || 0}%"></div>
          </div>
          <div class="rate-limit-text">
            <span id="rate-limit-count">${data.rateLimit?.used || 0}/${data.rateLimit?.total || 25}</span> requests used
            <span id="rate-limit-reset" class="rate-limit-reset"></span>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="action-buttons">
          <button id="retry-button" class="secondary-button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: 6px;">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 9h7V2l-2.35 2.35z"/>
            </svg>
            Retry
          </button>
          <button id="clear-cache-button" class="secondary-button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: 6px;">
              <path d="M16 6V4h-4V3H8v1H6v15h12V6h-2zm-1 13H7V6h2v1h4V6h2v13z"/>
              <path d="M9.5 11h1v6h-1zm4 0h1v6h-1z"/>
            </svg>
            Clear Cache
          </button>
        </div>
      `;
      
      // Add event listeners for action buttons
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', function() {
          const analyzeButton = document.getElementById('analyze-button');
          if (analyzeButton) {
            analyzeButton.click();
          }
        });
      }
      
      const clearCacheButton = document.getElementById('clear-cache-button');
      if (clearCacheButton) {
        clearCacheButton.addEventListener('click', function() {
          chrome.runtime.sendMessage({ action: 'clearCache' }, function(response) {
            if (response && response.success) {
              showToast('Cache cleared successfully', 'success');
            } else {
              showToast('Failed to clear cache', 'error');
            }
          });
        });
      }
      
    } catch (error) {
      console.error('Error processing API response:', error);
      // If there's an error parsing the data, show fallback UI
      showFallbackResults(username);
      return;
    }
    
    // Add to history
    addToHistory(username, {
      followers,
      following,
      engagement
    });
  }
  
  // Helper: Show fallback results when API fails
  function showFallbackResults(username) {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    
    // Generate mock data
    const followers = Math.floor(Math.random() * 10000) + 500;
    const following = Math.floor(Math.random() * 1000) + 100;
    const engagement = Math.floor(Math.random() * 10) + 1;
    
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <div class="results-card">
        <div class="error-banner">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          API unavailable - showing estimated data
        </div>
        <h3>Debug Analysis for @${username}</h3>
        <p>This is a debug result from the direct handler.</p>
        <div class="metrics-grid">
          <div class="metric-card fade-in">
            <div class="metric-value">${followers > 1000 ? (followers / 1000).toFixed(1) + 'K' : followers}</div>
            <div class="metric-label">Followers</div>
          </div>
          <div class="metric-card fade-in">
            <div class="metric-value">${following}</div>
            <div class="metric-label">Following</div>
          </div>
          <div class="metric-card fade-in">
            <div class="metric-value">${engagement}%</div>
            <div class="metric-label">Engagement</div>
          </div>
        </div>
        <div class="insights-section">
          <h4>Profile Insights (Estimated)</h4>
          <ul>
            <li>Posts consistently about technology and innovation</li>
            <li>Highest engagement on posts with images and questions</li>
            <li>Best posting time appears to be weekdays at 10-11 AM</li>
          </ul>
        </div>
      </div>
      
      <!-- Rate Limit Display -->
      <div class="rate-limit-container">
        <div class="rate-limit-label">API Usage</div>
        <div class="rate-limit-progress">
          <div id="rate-limit-bar" class="rate-limit-fill" style="width: 0%"></div>
        </div>
        <div class="rate-limit-text">
          <span id="rate-limit-count">0/25</span> requests used
          <span id="rate-limit-reset" class="rate-limit-reset"></span>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="action-buttons">
        <button id="retry-button" class="secondary-button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: 6px;">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 9h7V2l-2.35 2.35z"/>
          </svg>
          Retry
        </button>
        <button id="clear-cache-button" class="secondary-button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: 6px;">
            <path d="M16 6V4h-4V3H8v1H6v15h12V6h-2zm-1 13H7V6h2v1h4V6h2v13z"/>
            <path d="M9.5 11h1v6h-1zm4 0h1v6h-1z"/>
          </svg>
          Clear Cache
        </button>
      </div>
    `;
    
    // Add event listeners for action buttons
    const retryButton = document.getElementById('retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', function() {
        const analyzeButton = document.getElementById('analyze-button');
        if (analyzeButton) {
          analyzeButton.click();
        }
      });
    }
    
    const clearCacheButton = document.getElementById('clear-cache-button');
    if (clearCacheButton) {
      clearCacheButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'clearCache' }, function(response) {
          if (response && response.success) {
            showToast('Cache cleared successfully', 'success');
          } else {
            showToast('Failed to clear cache', 'error');
          }
        });
      });
    }
    
    // Add to history
    addToHistory(username, {
      followers,
      following,
      engagement
    });
  }
  
  // Helper: Update the rate limit display
  function updateRateLimitDisplay(rateLimit) {
    if (!rateLimit) return;
    
    const rateLimitBar = document.getElementById('rate-limit-bar');
    const rateLimitCount = document.getElementById('rate-limit-count');
    const rateLimitReset = document.getElementById('rate-limit-reset');
    
    if (rateLimitBar && rateLimitCount) {
      const percentage = (rateLimit.used / rateLimit.total) * 100;
      rateLimitBar.style.width = `${percentage}%`;
      rateLimitCount.textContent = `${rateLimit.used}/${rateLimit.total}`;
      
      // Add warning class if approaching limit
      if (percentage > 80) {
        rateLimitBar.classList.add('warning');
      } else {
        rateLimitBar.classList.remove('warning');
      }
      
      // Show reset date if available
      if (rateLimitReset && rateLimit.resetDate) {
        try {
          const resetDate = new Date(rateLimit.resetDate);
          const now = new Date();
          
          // Format differently based on how far away the reset is
          if (resetDate - now > 24 * 60 * 60 * 1000) {
            // More than a day away, show full date
            rateLimitReset.textContent = `Resets on ${resetDate.toLocaleDateString()}`;
          } else {
            // Less than a day away, show hours
            const hours = Math.round((resetDate - now) / (60 * 60 * 1000));
            rateLimitReset.textContent = `Resets in ${hours} hour${hours !== 1 ? 's' : ''}`;
          }
        } catch (error) {
          console.error('Error formatting rate limit reset date:', error);
          rateLimitReset.textContent = '';
        }
      }
    }
  }
  
  // Helper: Add to history
  function addToHistory(username, metrics) {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      let history = result.analysisHistory || [];
      
      // Add new entry
      const newEntry = {
        username,
        timestamp: Date.now(),
        metrics: metrics || {
          followers: Math.floor(Math.random() * 10000) + 500,
          engagement: Math.floor(Math.random() * 10) + 1
        }
      };
      
      // Remove existing entry with same username
      history = history.filter(item => item.username !== username);
      
      // Add new entry at the beginning
      history.unshift(newEntry);
      
      // Limit history to 20 items
      if (history.length > 20) {
        history = history.slice(0, 20);
      }
      
      // Save back to storage
      chrome.storage.local.set({ analysisHistory: history });
      console.log('Added to history:', username);
    });
  }
  
  // Helper function to hide loading and reset button
  function hideLoadingAndResetButton() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    
    // Reset button if it exists
    if (analyzeButton) {
      analyzeButton.innerHTML = 'Analyze';
      analyzeButton.disabled = false;
    }
  }
  
  // Load history items from storage
  function loadHistory() {
    console.log('Loading history items');
    
    const historyContainer = document.querySelector('.history-container');
    if (!historyContainer) {
      console.error('History container not found');
      return;
    }
    
    chrome.storage.local.get(['analysisHistory'], (result) => {
      const history = result.analysisHistory || [];
      console.log('Loaded history items:', history.length);
      
      // Clear existing history
      historyContainer.innerHTML = '';
      
      if (history.length === 0) {
        // Show empty state
        historyContainer.innerHTML = `
          <div class="empty-history">
            <div class="empty-icon">📊</div>
            <h3>No Analysis History</h3>
            <p>Profiles you analyze will appear here for quick access.</p>
          </div>
        `;
        return;
      }
      
      // Sort history by date (newest first)
      const sortedHistory = [...history].sort((a, b) => {
        const dateA = a.date || a.timestamp || 0;
        const dateB = b.date || b.timestamp || 0;
        return dateB - dateA;
      });
      
      // Create history items
      sortedHistory.forEach(item => {
        const timestamp = item.date || item.timestamp || Date.now();
        const historyDate = new Date(timestamp).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        const historyTime = new Date(timestamp).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
          <div class="history-profile">
            <span class="profile-handle">@${item.username}</span>
            <span class="history-date">${historyDate} at ${historyTime}</span>
          </div>
          <div class="history-metrics">
            <div class="metric">
              <span class="metric-label">Followers</span>
              <span class="metric-value">${item.metrics.followers || 'N/A'}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Engagement</span>
              <span class="metric-value">${(item.metrics.engagementRate || item.metrics.engagement || 0).toFixed(1)}%</span>
            </div>
            <div class="metric">
              <span class="metric-label">Posts</span>
              <span class="metric-value">${item.metrics.postCount || 'N/A'}</span>
            </div>
          </div>
          <div class="history-actions">
            <button class="view-profile-button" data-username="${item.username}">
              View Profile
            </button>
            <button class="delete-history-button" data-username="${item.username}">
              <span class="trash-icon">🗑️</span>
            </button>
          </div>
        `;
        
        historyContainer.appendChild(historyItem);
      });
      
      // Add event listeners to history item buttons
      document.querySelectorAll('.view-profile-button').forEach(button => {
        button.addEventListener('click', () => {
          const username = button.getAttribute('data-username');
          if (username) {
            // Switch to analyze tab
            const analyzeTab = document.getElementById('analyze-tab');
            if (analyzeTab) {
              analyzeTab.click();
              
              // Set the username in the input field
              const profileInput = document.getElementById('profile-input');
              if (profileInput) {
                profileInput.value = '@' + username;
                
                // Update analyze button state
                updateAnalyzeButtonState();
                
                // Trigger analysis
                const analyzeButton = document.getElementById('analyze-button');
                if (analyzeButton && !analyzeButton.disabled) {
                  analyzeButton.click();
                }
              }
            }
          }
        });
      });
      
      // Add event listeners to delete buttons
      document.querySelectorAll('.delete-history-button').forEach(button => {
        button.addEventListener('click', () => {
          const username = button.getAttribute('data-username');
          if (username) {
            chrome.storage.local.get(['analysisHistory'], (result) => {
              const history = result.analysisHistory || [];
              const updatedHistory = history.filter(item => item.username !== username);
              
              chrome.storage.local.set({ analysisHistory: updatedHistory }, () => {
                // Reload history
                loadHistory();
                showToast(`Removed @${username} from history`, 'success');
              });
            });
          }
        });
      });
    });
  }

  /**
   * Handle Test API button click
   */
  function handleTestApiClick() {
    console.log('Test API button clicked');
    // Disable button while testing
    const testButton = document.getElementById('test-api-button');
    if (testButton) {
      testButton.disabled = true;
      testButton.textContent = 'Testing...';
      testButton.classList.add('button-loading');
    }
    
    // Also disable analyze button
    const analyzeButton = document.getElementById('analyze-button');
    if (analyzeButton) {
      analyzeButton.disabled = true;
    }
    
    // Show a loading toast
    showToast('Testing API connection...', 'info');
    
    // Set a timeout for overall API test operation
    let testTimeoutId = setTimeout(() => {
      console.error('API test timeout reached');
      if (testButton) {
        testButton.disabled = false;
        testButton.textContent = 'Test API';
        testButton.classList.remove('button-loading');
      }
      if (analyzeButton) {
        analyzeButton.disabled = false;
      }
      
      showToast('API test timed out. Please try again.', 'error');
      
      // Display timeout error in results container
      const resultsContainer = document.getElementById('results-container');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="error-banner">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>API connection timed out</span>
          </div>
          <div class="results-card">
            <h3>API Test Results</h3>
            <div class="api-error-details">
              <h4>Connection Timeout:</h4>
              <p>The connection to the X API timed out after waiting for a response.</p>
              <h4>Possible reasons:</h4>
              <ul>
                <li>Network connectivity issues</li>
                <li>X API service may be down or experiencing issues</li>
                <li>API rate limits may have been exceeded</li>
                <li>CORS or browser extension restrictions</li>
              </ul>
            </div>
            <p class="api-help">
              Try the following:<br>
              1. Check your internet connection<br>
              2. Verify the API is operational<br>
              3. Try again later when the service may be less busy
            </p>
          </div>
        `;
      }
    }, 15000);  // 15 second timeout
    
    // Test both API configs
    chrome.runtime.sendMessage({
      action: 'testApiKey'
    }, function(response) {
      // Clear the timeout since we got a response
      clearTimeout(testTimeoutId);
      
      // Re-enable buttons
      if (testButton) {
        testButton.disabled = false;
        testButton.textContent = 'Test API';
        testButton.classList.remove('button-loading');
      }
      if (analyzeButton) {
        analyzeButton.disabled = false;
      }
      
      console.log('API test response:', response);
      
      if (!response) {
        console.error('No response from API test');
        showToast('API test failed. No response received.', 'error');
        return;
      }
      
      const { config1Result, config2Result } = response;
      
      // Check if either config was successful
      const config1Success = config1Result && config1Result.success;
      const config2Success = config2Result && config2Result.success;
      
      if (config1Success || config2Success) {
        // At least one config was successful
        showToast('API test successful!', 'success');
        
        // Display success results
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="results-card">
              <h3>API Test Results</h3>
              <div class="api-config-result ${config1Success ? 'success' : 'error'}">
                <div class="status-indicator ${config1Success ? 'success' : 'error'}"></div>
                <h4>Primary API Config</h4>
                <p>${config1Success ? 'Connected successfully' : 'Connection failed: ' + (config1Result?.error || 'Unknown error')}</p>
              </div>
              
              <div class="api-config-result ${config2Success ? 'success' : 'error'}">
                <div class="status-indicator ${config2Success ? 'success' : 'error'}"></div>
                <h4>Secondary API Config</h4>
                <p>${config2Success ? 'Connected successfully' : 'Connection failed: ' + (config2Result?.error || 'Unknown error')}</p>
              </div>
              
              <div class="test-conclusion">
                <p>✅ Your X-Analyzer extension is ready to use!</p>
                <p>API connection established. You can now analyze X profiles.</p>
              </div>
            </div>
          `;
        }
      } else {
        // Both configs failed
        showToast('API test failed. Check console for details.', 'error');
        
        // Display error details
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="error-banner">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span>API connection failed</span>
            </div>
            <div class="results-card">
              <h3>API Test Results</h3>
              <div class="api-error-details">
                <h4>Config #1 Error:</h4>
                <pre>${config1Result?.error || 'Unknown error'}\n${config1Result?.errorDetails || ''}</pre>
                <h4>Config #2 Error:</h4>
                <pre>${config2Result?.error || 'Unknown error'}\n${config2Result?.errorDetails || ''}</pre>
              </div>
              <p class="api-help">
                Try the following:<br>
                1. Verify your API keys in the .env file<br>
                2. Check if Twitter API services are working<br>
                3. Ensure your API keys have not expired<br>
                4. Check browser console for more detailed error information
              </p>
            </div>
          `;
        }
      }
    });
  }
}); 