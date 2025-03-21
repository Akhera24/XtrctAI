// X Profile Analyzer - Background Script

// Initialize the extension state
chrome.runtime.onInstalled.addListener(() => {
  console.log('X Profile Analyzer extension installed');
  
  // Set default theme
  chrome.storage.local.get(['theme'], (result) => {
    if (!result.theme) {
      chrome.storage.local.set({ theme: 'light' });
    }
  });
  
  // Initialize counters and settings
  chrome.storage.local.set({
    analysisCount: 0,
    lastAnalysisDate: null,
    rateLimit: { count: 0, resetTime: Date.now() + 3600000 }
  });
  
  // Create context menu to open in floating mode
  chrome.contextMenus.create({
    id: "open-floating",
    title: "Open in floating window",
    contexts: ["action"]
  });
});

// Context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-floating") {
    openFloatingWindow();
  }
});

// Open a floating window
function openFloatingWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup/popup.html?floating=true"),
    type: "popup",
    width: 360,
    height: 600
  });
}

// Track floating windows to prevent duplicates
let floatingWindows = [];

// Track window state changes
chrome.windows.onRemoved.addListener((windowId) => {
  // Remove from tracked windows if it was one of our floating windows
  const index = floatingWindows.indexOf(windowId);
  if (index !== -1) {
    floatingWindows.splice(index, 1);
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request.action);
  
  if (request.action === 'analyzeProfile') {
    console.log('Analysis requested for:', request.username);
    
    // Track analysis count
    chrome.storage.local.get(['analysisCount', 'rateLimit'], (result) => {
      const newCount = (result.analysisCount || 0) + 1;
      const rateLimit = result.rateLimit || { count: 0, resetTime: Date.now() + 3600000 };
      
      // Check if we need to reset the rate limit counter
      const now = Date.now();
      if (now > rateLimit.resetTime) {
        rateLimit.count = 1;
        rateLimit.resetTime = now + 3600000; // Reset in 1 hour
      } else {
        rateLimit.count += 1;
      }
      
      chrome.storage.local.set({
        analysisCount: newCount,
        lastAnalysisDate: now,
        rateLimit: rateLimit
      });
      
      // Add to history
      addToHistory(request.username);
      
      sendResponse({ success: true, rateLimit: rateLimit });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'getRateLimit') {
    chrome.storage.local.get(['rateLimit'], (result) => {
      const rateLimit = result.rateLimit || { count: 0, resetTime: Date.now() + 3600000 };
      sendResponse({ rateLimit: rateLimit });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'clearCache') {
    chrome.storage.local.remove(['analysisCache'], () => {
      sendResponse({ success: true });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'openFloatingWindow') {
    openFloatingWindow();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'signIn') {
    // This would normally handle authentication
    // For demo we just return success
    sendResponse({ success: true, user: { username: 'demo_user' } });
    return true;
  }
  
  if (request.action === 'getHistory') {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      sendResponse({ success: true, history: result.analysisHistory || [] });
    });
    return true;
  }
});

// Add analyzed profile to history
function addToHistory(username) {
  chrome.storage.local.get(['analysisHistory'], (result) => {
    let history = result.analysisHistory || [];
    
    // Check if username already exists
    const existingIndex = history.findIndex(item => item.username === username);
    
    if (existingIndex !== -1) {
      // Move to top if exists
      const existing = history.splice(existingIndex, 1)[0];
      existing.timestamp = Date.now();
      history.unshift(existing);
    } else {
      // Add new entry
      history.unshift({
        username: username,
        timestamp: Date.now()
      });
    }
    
    // Limit history to 20 entries
    history = history.slice(0, 20);
    
    chrome.storage.local.set({ analysisHistory: history });
  });
}

// Listen for X tab URLs to enable the page action
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.match(/https:\/\/(www\.)?(twitter|x)\.com\/[^\/]+$/)) {
      // This is a profile URL, enable the popup
      chrome.action.enable(tabId);
    }
  }
}); 