// Reset API tokens script - Copy to Console tab in Chrome DevTools
async function resetTokens() {
  console.log("Resetting API tokens and clearing rate limit status...");
  
  // List of storage keys to reset
  const storageKeysToReset = [
    'bearerToken', 
    'bearerToken2', 
    'rateLimits', 
    'rateLimitExceeded',
    'x_token_status',
    'x_rate_limit_status',
    'apiValidation'
  ];
  
  // Clear existing tokens and rate limit status
  await new Promise(resolve => {
    chrome.storage.local.remove(storageKeysToReset, resolve);
  });
  
  console.log("Tokens cleared, getting new tokens from env.js");
  
  try {
    // Import the twitter config
    const { twitter } = await import('./env.js');
    
    // Validate tokens before storing
    const bearerToken1 = twitter.config1.bearerToken;
    const bearerToken2 = twitter.config2.bearerToken;
    
    const isValidToken = (token) => token && typeof token === 'string' && 
                                   token.trim().length > 50 && 
                                   token.trim().startsWith('AAAAA');
    
    // Log token validation status                             
    console.log("Token 1 validation:", isValidToken(bearerToken1) ? "Valid" : "Invalid");
    console.log("Token 2 validation:", isValidToken(bearerToken2) ? "Valid" : "Invalid");
    
    if (!isValidToken(bearerToken1) && !isValidToken(bearerToken2)) {
      console.error("Error: No valid tokens found in env.js");
      return;
    }
    
    // Create a new token status object with a clean state
    const tokenStatus = {
      timestamp: Date.now(),
      tokens: [
        {
          key: 'primary',
          token: bearerToken1,
          status: 'pending',
          lastChecked: null,
          lastUsed: null,
          rateLimitInfo: {
            reset: null,
            remaining: null,
            limit: null
          }
        },
        {
          key: 'secondary',
          token: bearerToken2,
          status: 'pending',
          lastChecked: null,
          lastUsed: null,
          rateLimitInfo: {
            reset: null,
            remaining: null,
            limit: null
          }
        }
      ]
    };
    
    // Store new tokens with clean status
    await new Promise(resolve => {
      chrome.storage.local.set({
        bearerToken: bearerToken1,
        bearerToken2: bearerToken2,
        x_token_status: tokenStatus,
        apiValidation: {
          timestamp: Date.now(),
          valid: true,
          message: "Tokens reset successfully"
        }
      }, resolve);
    });
    
    console.log("New tokens set with clean rate limit status:");
    
    // Verify new tokens
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['bearerToken', 'bearerToken2', 'x_token_status'], resolve);
    });
    
    console.log("Token 1:", result.bearerToken ? result.bearerToken.substring(0, 5) + '...' : 'none');
    console.log("Token 2:", result.bearerToken2 ? result.bearerToken2.substring(0, 5) + '...' : 'none');
    
    // Clear all profile caches (optional - comment out if you want to preserve cache)
    const allStorage = await new Promise(resolve => chrome.storage.local.get(null, resolve));
    const cacheKeys = Object.keys(allStorage).filter(key => key.startsWith('x_profile_'));
    
    if (cacheKeys.length > 0) {
      console.log(`Clearing ${cacheKeys.length} profile caches to ensure fresh data`);
      await new Promise(resolve => chrome.storage.local.remove(cacheKeys, resolve));
    }
    
    console.log("Token reset complete. Please refresh the extension or restart Chrome to apply changes.");
    
    // Try to notify extension about the reset
    try {
      chrome.runtime.sendMessage({
        type: "tokens_reset",
        data: {
          timestamp: Date.now(),
          success: true
        }
      });
    } catch (e) {
      // Ignore errors if extension isn't ready
      console.log("Extension not ready to receive message. This is normal.");
    }
    
  } catch (error) {
    console.error("Error resetting tokens:", error);
  }
}

// Function to clear all cache and reset API state
async function fullReset() {
  try {
    console.log("Performing full extension reset...");
    
    // Get all storage keys
    const allStorage = await new Promise(resolve => chrome.storage.local.get(null, resolve));
    const allKeys = Object.keys(allStorage);
    
    // Keep settings but remove all data
    const keysToKeep = ['theme']; // Add any other settings to preserve
    const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));
    
    // Remove everything
    await new Promise(resolve => chrome.storage.local.remove(keysToRemove, resolve));
    
    console.log(`Removed ${keysToRemove.length} items from storage`);
    console.log("Extension data has been completely reset.");
    console.log("Please run resetTokens() to set up tokens, then restart Chrome.");
    
  } catch (error) {
    console.error("Error during full reset:", error);
  }
}

// This is the main function to use for most cases
resetTokens().catch(console.error);

// Uncomment the line below for a full reset (warning: removes ALL extension data)
// fullReset().catch(console.error); 