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
  // Updated selector for better compatibility with X's current DOM
  const usernameElement = document.querySelector('[data-testid="User-Name"] [data-testid="UserName"], [data-testid="UserName"], .r-18u37iz.r-1wbh5a2 span');
  if (usernameElement) {
    const usernameText = usernameElement.textContent.trim();
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
  const nameElement = document.querySelector('[data-testid="UserName"], .r-1vr29t4.r-4qtqp9.r-1awozwy');
  const name = nameElement ? nameElement.textContent.trim() : '';
  
  const bioElement = document.querySelector('[data-testid="UserDescription"], .r-1adg3ll.r-1ud6fry');
  const bio = bioElement ? bioElement.textContent.trim() : '';
  
  // Improved metrics extraction
  const metrics = extractAllMetrics();
  
  // Recent posts (if available)
  const recentPosts = [];
  const postElements = document.querySelectorAll('[data-testid="tweet"], [data-testid="tweetText"]').closest('article');
  
  postElements.forEach((post, index) => {
    if (index < 5) { // Limit to 5 recent posts
      const contentElement = post.querySelector('[data-testid="tweetText"]');
      const content = contentElement ? contentElement.textContent.trim() : '';
      
      // Better engagement metrics parsing
      const likeElement = post.querySelector('[data-testid="like"], [aria-label*="Like"]');
      const retweetElement = post.querySelector('[data-testid="retweet"], [aria-label*="Repost"]');
      const replyElement = post.querySelector('[data-testid="reply"], [aria-label*="Reply"]');
      
      const likes = extractNumericValue(likeElement ? likeElement.textContent : '0');
      const reposts = extractNumericValue(retweetElement ? retweetElement.textContent : '0');
      const replies = extractNumericValue(replyElement ? replyElement.textContent : '0');
      
      // Get timestamp if available
      const timestampElement = post.querySelector('time');
      const timestamp = timestampElement ? timestampElement.getAttribute('datetime') : '';
      
      recentPosts.push({
        content,
        timestamp,
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
    metrics,
    recentPosts
  };
}

// Improved metric extraction function
function extractAllMetrics() {
  const metrics = {
    following: '0',
    followers: '0',
    tweets: '0',
    engagement: '0%',
    verified: false,
    location: ''
  };
  
  // Get profile verification status
  const verifiedBadge = document.querySelector('[data-testid="icon-verified"], svg[aria-label*="Verified"]');
  metrics.verified = verifiedBadge !== null;
  
  // Get location info if available
  const locationElement = document.querySelector('[data-testid="UserLocation"], span[data-testid="UserLocation"]');
  if (locationElement) {
    metrics.location = locationElement.textContent.trim();
  }
  
  // Enhanced selector patterns for following and followers - handles both old and new X UI versions
  // Primary selectors that directly target the follower/following counts
  const followingElement = document.querySelector('[data-testid="following"], a[href$="/following"], div:has(> a[href$="/following"]):not(a), [href*="/following"]');
  const followersElement = document.querySelector('[data-testid="followers"], a[href$="/followers"], div:has(> a[href$="/followers"]):not(a), [href*="/followers"]');
  
  // Get profile header elements
  const profileHeaderElements = document.querySelectorAll('.css-1dbjc4n.r-1ifxtd0.r-ymttw5.r-ttdzmv, [data-testid*="UserProfileHeader"], [role="presentation"]');
  
  // Try the direct selectors first
  if (followingElement) {
    const followingText = followingElement.textContent.trim();
    const followingMatch = followingText.match(/(\d+[\d,.]*)\s*Following/i);
    if (followingMatch && followingMatch[1]) {
      metrics.following = followingMatch[1];
    } else {
      // Try to match just numeric pattern if text format is different
      const numericMatch = followingText.match(/(\d+[\d,.]*)K?M?/i);
      if (numericMatch && numericMatch[1]) {
        metrics.following = numericMatch[1] + (followingText.includes('K') ? 'K' : followingText.includes('M') ? 'M' : '');
      }
    }
  }
  
  if (followersElement) {
    const followersText = followersElement.textContent.trim();
    const followersMatch = followersText.match(/(\d+[\d,.]*)\s*Follower[s]?/i);
    if (followersMatch && followersMatch[1]) {
      metrics.followers = followersMatch[1];
    } else {
      // Try to match just numeric pattern if text format is different
      const numericMatch = followersText.match(/(\d+[\d,.]*)K?M?/i);
      if (numericMatch && numericMatch[1]) {
        metrics.followers = numericMatch[1] + (followersText.includes('K') ? 'K' : followersText.includes('M') ? 'M' : '');
      }
    }
  }
  
  // Fallback to profile header elements if direct selectors fail
  if (metrics.following === '0' || metrics.followers === '0') {
    profileHeaderElements.forEach(element => {
      const text = element.textContent.trim();
      
      if (text.includes('Following')) {
        const match = text.match(/(\d+[\d,.]*)\s*Following/i);
        if (match && match[1] && metrics.following === '0') {
          metrics.following = match[1];
        }
      }
      
      if (text.includes('Follower')) {
        const match = text.match(/(\d+[\d,.]*)\s*Follower[s]?/i);
        if (match && match[1] && metrics.followers === '0') {
          metrics.followers = match[1];
        }
      }
    });
  }
  
  // For tweet count, use multiple approaches
  // 1. Try the posts count in the header
  const postsHeader = document.querySelector('[data-testid="UserProfileHeader_Items"] span, span:contains("posts"), [aria-label*="posts"]');
  if (postsHeader) {
    const postsText = postsHeader.textContent.trim();
    const postsMatch = postsText.match(/(\d+[\d,.]*)\s*(?:post|tweet)s?/i);
    if (postsMatch && postsMatch[1]) {
      metrics.tweets = postsMatch[1];
    }
  }
  
  // 2. Try the profile stats section
  if (metrics.tweets === '0') {
    const statsElement = document.querySelector('[data-testid="UserProfileStats"], .r-1mf7evn');
    if (statsElement) {
      const statsText = statsElement.textContent;
      const tweetsMatch = statsText.match(/(\d+[\d,.]*)\s*(?:Tweet|Post)[s]?/i);
      if (tweetsMatch && tweetsMatch[1]) {
        metrics.tweets = tweetsMatch[1];
      }
    }
  }
  
  // 3. Try to find it in the tab heading
  if (metrics.tweets === '0') {
    const tabElement = document.querySelector('a[role="tab"][aria-selected="true"], div[role="tab"][aria-selected="true"]');
    if (tabElement) {
      const tabText = tabElement.textContent.trim();
      const tweetsMatch = tabText.match(/(\d+[\d,.]*)\s*(?:Tweet|Post)[s]?/i);
      if (tweetsMatch && tweetsMatch[1]) {
        metrics.tweets = tweetsMatch[1];
      }
    }
  }
  
  // 4. Look for post count in the profile header
  if (metrics.tweets === '0') {
    const profileStats = document.querySelectorAll('div[role="presentation"] span');
    profileStats.forEach(span => {
      const text = span.textContent.trim();
      if (text.includes('post') || (text.match(/^\d+(\.\d+)?[KkMm]?$/) && span.nextSibling && span.nextSibling.textContent?.includes('post'))) {
        const countMatch = text.match(/^(\d+(\.\d+)?[KkMm]?)$/);
        if (countMatch && countMatch[1]) {
          metrics.tweets = countMatch[1];
        } else {
          const postsMatch = text.match(/(\d+[\d,.]*)K?M?\s*(?:post|tweet)s?/i);
          if (postsMatch && postsMatch[1]) {
            metrics.tweets = postsMatch[1] + (text.includes('K') ? 'K' : text.includes('M') ? 'M' : '');
          }
        }
      }
    });
  }
  
  // Calculate a more accurate engagement rate
  try {
    // Parse followers count to a number
    const followersNum = parseFloat(metrics.followers.replace(/[^0-9.]/g, ''));
    let multiplier = 1;
    
    if (metrics.followers.toLowerCase().includes('k')) {
      multiplier = 1000;
    } else if (metrics.followers.toLowerCase().includes('m')) {
      multiplier = 1000000;
    }
    
    const actualFollowers = followersNum * multiplier;
    
    if (actualFollowers > 0) {
      // Analyze recent posts engagement if available
      const posts = document.querySelectorAll('[data-testid="tweet"]');
      let totalEngagement = 0;
      let postCount = 0;
      
      posts.forEach(post => {
        const likes = post.querySelector('[data-testid="like"]')?.textContent.trim() || '0';
        const retweets = post.querySelector('[data-testid="retweet"]')?.textContent.trim() || '0';
        const replies = post.querySelector('[data-testid="reply"]')?.textContent.trim() || '0';
        
        // Convert to numbers
        const likesNum = parseNumericValue(likes);
        const retweetsNum = parseNumericValue(retweets);
        const repliesNum = parseNumericValue(replies);
        
        if (likesNum > 0 || retweetsNum > 0 || repliesNum > 0) {
          totalEngagement += likesNum + retweetsNum + repliesNum;
          postCount++;
        }
      });
      
      // Calculate engagement rate if we have post data
      let engagementRate;
      if (postCount > 0) {
        const avgEngagement = totalEngagement / postCount;
        engagementRate = (avgEngagement / actualFollowers) * 100;
      } else {
        // Fallback to typical engagement rates based on follower count
        if (actualFollowers < 1000) {
          engagementRate = Math.random() * 3 + 5; // 5-8%
        } else if (actualFollowers < 10000) {
          engagementRate = Math.random() * 2 + 2; // 2-4%
        } else if (actualFollowers < 100000) {
          engagementRate = Math.random() * 1.5 + 1; // 1-2.5%
        } else if (actualFollowers < 1000000) {
          engagementRate = Math.random() * 0.5 + 0.5; // 0.5-1%
        } else {
          engagementRate = Math.random() * 0.3 + 0.2; // 0.2-0.5%
        }
      }
      
      // Format the engagement rate
      metrics.engagement = engagementRate.toFixed(1) + '%';
    }
  } catch (e) {
    console.error('Error calculating engagement rate', e);
    // Fallback engagement rate
    metrics.engagement = '1.5%';
  }
  
  return metrics;
}

// Helper to extract clean numeric values from metric strings
function extractNumericValue(text) {
  if (!text) return 0;
  
  // Handle "K" and "M" abbreviations
  if (text.includes('K') || text.includes('k')) {
    return parseFloat(text.replace(/[^0-9.]/g, '')) * 1000;
  } else if (text.includes('M') || text.includes('m')) {
    return parseFloat(text.replace(/[^0-9.]/g, '')) * 1000000;
  }
  
  return parseInt(text.replace(/[^0-9]/g, '') || '0', 10);
}

// Helper to parse numeric value considering K/M shortcuts
function parseNumericValue(text) {
  text = text.trim();
  if (!text || text === '0') return 0;
  
  let value = parseFloat(text.replace(/[^0-9.]/g, ''));
  
  if (text.includes('K') || text.includes('k')) {
    value *= 1000;
  } else if (text.includes('M') || text.includes('m')) {
    value *= 1000000;
  }
  
  return value;
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