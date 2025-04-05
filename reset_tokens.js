// Reset API tokens script - Copy to Console tab in Chrome DevTools
async function resetTokens() {
  console.log("Resetting API tokens...");
  
  // Clear existing tokens
  await new Promise(resolve => {
    chrome.storage.local.remove(['bearerToken', 'bearerToken2'], resolve);
  });
  
  console.log("Tokens cleared, getting new tokens from env.js");
  
  // Import the twitter config
  const { twitter } = await import('./env.js');
  
  // Store new tokens
  await new Promise(resolve => {
    chrome.storage.local.set({
      bearerToken: twitter.config1.bearerToken,
      bearerToken2: twitter.config2.bearerToken
    }, resolve);
  });
  
  console.log("New tokens set:");
  
  // Verify new tokens
  const result = await new Promise(resolve => {
    chrome.storage.local.get(['bearerToken', 'bearerToken2'], resolve);
  });
  
  console.log("Token 1:", result.bearerToken ? result.bearerToken.substring(0, 5) + '...' : 'none');
  console.log("Token 2:", result.bearerToken2 ? result.bearerToken2.substring(0, 5) + '...' : 'none');
  
  console.log("Please restart the extension to apply changes.");
}

resetTokens().catch(console.error); 