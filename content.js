// X Profile Analyzer - Content Script

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentProfile') {
    // Extract profile info from the current page
    const username = extractUsernameFromPage();
    if (username) {
      sendResponse({ success: true, username: username });
    } else {
      sendResponse({ success: false, error: 'Could not detect a profile on this page' });
    }
    return true;
  }
  
  if (request.action === 'extractProfileData') {
    // Extract detailed profile data
    const profileData = extractProfileData();
    sendResponse({ success: true, data: profileData });
    return true;
  }
});

// Extract username from the current page URL or DOM
function extractUsernameFromPage() {
  // Try to get from URL first
  const urlPattern = /https:\/\/(www\.)?(twitter|x)\.com\/([^\/]+)(\/|$)/;
  const match = window.location.href.match(urlPattern);
  
  if (match && match[3] && !['home', 'explore', 'notifications', 'messages'].includes(match[3])) {
    return match[3];
  }
  
  // Try to extract from page elements if URL method fails
  const usernameElement = document.querySelector('[data-testid="User-Name"] [data-testid="UserName"]');
  if (usernameElement) {
    const usernameText = usernameElement.textContent;
    if (usernameText.startsWith('@')) {
      return usernameText.substring(1); // Remove @ symbol
    }
    return usernameText;
  }
  
  return null;
}

// Extract detailed profile data from the page
function extractProfileData() {
  // Basic profile info
  const name = document.querySelector('[data-testid="UserName"]')?.textContent?.trim() || '';
  const bio = document.querySelector('[data-testid="UserDescription"]')?.textContent?.trim() || '';
  
  // Metrics
  const followingCount = extractMetricValue('[data-testid="following"]');
  const followersCount = extractMetricValue('[data-testid="followers"]');
  
  // Recent posts (if available)
  const recentPosts = [];
  const postElements = document.querySelectorAll('[data-testid="tweet"]');
  
  postElements.forEach((post, index) => {
    if (index < 5) { // Limit to 5 recent posts
      const content = post.querySelector('[data-testid="tweetText"]')?.textContent || '';
      const likes = post.querySelector('[data-testid="like"]')?.textContent || '0';
      const reposts = post.querySelector('[data-testid="retweet"]')?.textContent || '0';
      const replies = post.querySelector('[data-testid="reply"]')?.textContent || '0';
      
      recentPosts.push({
        content,
        engagement: {
          likes,
          reposts,
          replies
        }
      });
    }
  });
  
  return {
    username: extractUsernameFromPage(),
    name,
    bio,
    metrics: {
      following: followingCount,
      followers: followersCount
    },
    recentPosts
  };
}

// Helper to extract metric values from elements
function extractMetricValue(selector) {
  const element = document.querySelector(selector);
  if (!element) return '0';
  
  const text = element.textContent.trim();
  return text;
}

// Notify extension when the page is ready for analysis
window.addEventListener('load', () => {
  const username = extractUsernameFromPage();
  if (username) {
    chrome.runtime.sendMessage({
      action: 'pageReady',
      isProfile: true,
      username: username
    });
  }
}); 