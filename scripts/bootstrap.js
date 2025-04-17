/**
 * Bootstrap script for X Profile Analyzer
 * Ensures proper initialization and connectivity
 */

// Import connection manager (using dynamic import for compatibility)
let connectionManager = null;

// Global state for bootstrap status
const bootstrapState = {
  apiConnected: false,
  iconsLoaded: false,
  recoveryAttempted: false,
  lastError: null,
  lastCheck: 0
};

// Check extension status on startup
document.addEventListener('DOMContentLoaded', () => {
  console.log('X Profile Analyzer bootstrap script loaded');
  
  // Initialize the connection manager
  initializeConnectionManager().then(() => {
    // Validate extension setup
    validateExtensionSetup();
  }).catch(error => {
    console.error('Failed to initialize connection manager:', error);
    // Still try to validate without connection manager
    validateExtensionSetup();
  });
  
  // Listen for bootstrap response
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'bootstrapResponse') {
      console.log('Received bootstrap response:', message);
      handleBootstrapResponse(message);
      sendResponse({ received: true });
    } else if (message.action === 'getBootstrapStatus') {
      // Allow other scripts to check bootstrap status
      sendResponse({
        success: bootstrapState.apiConnected && bootstrapState.iconsLoaded,
        apiConnected: bootstrapState.apiConnected,
        iconsLoaded: bootstrapState.iconsLoaded,
        lastError: bootstrapState.lastError,
        lastCheck: bootstrapState.lastCheck
      });
    }
    return false; // Not using async response
  });
});

// Dynamically import the connection manager
async function initializeConnectionManager() {
  try {
    const module = await import('./connection-manager.js');
    connectionManager = module.default;
    console.log('ConnectionManager imported successfully');
    return connectionManager;
  } catch (error) {
    console.error('Error importing ConnectionManager:', error);
    throw error;
  }
}

// Validate extension setup and connectivity
async function validateExtensionSetup() {
  console.log('Validating extension setup...');
  bootstrapState.lastCheck = Date.now();
  
  try {
    // First prepare fallback icons to ensure UI doesn't break
    await prepareFallbackIcons();
    
    // Test API connectivity
    const testResult = await testApiConnection();
    console.log('API connection test result:', testResult);
    bootstrapState.apiConnected = testResult.success;
    
    // Test icon loading
    const iconResult = await testIconLoading();
    console.log('Icon loading test result:', iconResult);
    bootstrapState.iconsLoaded = iconResult.success;
    
    // Report status to background script
    chrome.runtime.sendMessage({
      action: 'reportBootstrapStatus',
      apiStatus: testResult.success,
      iconStatus: iconResult.success,
      details: {
        api: testResult,
        icons: iconResult
      }
    });
    
    // Update UI if we're on a Twitter/X profile page
    updateUIBasedOnStatus(testResult.success && iconResult.success);
    
    // If API status is false, try recovery
    if (!testResult.success && !bootstrapState.recoveryAttempted) {
      console.log('API test failed, trying recovery methods...');
      bootstrapState.recoveryAttempted = true;
      await tryApiRecovery();
    }
  } catch (error) {
    console.error('Error in bootstrap validation:', error);
    bootstrapState.lastError = error.message;
    
    // Report error to background script
    chrome.runtime.sendMessage({
      action: 'reportBootstrapStatus',
      success: false,
      error: error.message
    });
    
    // Update UI for error state
    updateUIBasedOnStatus(false, error);
  }
}

// Try to recover API connectivity
async function tryApiRecovery() {
  try {
    console.log('Attempting API recovery...');
    
    // Try to rotate to a different API config
    const recoveryResult = await chrome.runtime.sendMessage({
      action: 'rotateApiConfig',
      forceRotate: true
    });
    
    if (recoveryResult && recoveryResult.success) {
      console.log('Successfully rotated API config, retesting connection...');
      
      // Wait a moment to ensure config is fully applied
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Test the connection again
      const retestResult = await testApiConnection();
      
      if (retestResult.success) {
        console.log('API recovery successful!');
        bootstrapState.apiConnected = true;
        bootstrapState.lastError = null;
        
        // Update UI state
        updateUIBasedOnStatus(true);
        
        // Report updated status
        chrome.runtime.sendMessage({
          action: 'reportBootstrapStatus',
          apiStatus: true,
          iconStatus: true,
          details: {
            api: retestResult,
            recovery: true
          }
        });
        
        return true;
      }
    }
    
    // If we reach here, recovery failed
    console.warn('API recovery failed, falling back to limited functionality');
    bootstrapState.lastError = 'API recovery failed';
    
    // Try to verify if it's a temporary outage by using the fallback URL
    const fallbackTestResult = await testApiFallback();
    if (fallbackTestResult.success) {
      console.log('Fallback API connection successful, using that instead');
      bootstrapState.apiConnected = true;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in API recovery:', error);
    bootstrapState.lastError = `API recovery error: ${error.message}`;
    return false;
  }
}

// Test a fallback API endpoint
async function testApiFallback() {
  try {
    // Use a public Twitter API that doesn't require auth as fallback
    const response = await fetch('https://cdn.syndication.twimg.com/ping', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    return {
      success: response.ok,
      message: response.ok ? 'Fallback API connection successful' : 'Fallback API connection failed',
      statusCode: response.status
    };
  } catch (error) {
    console.error('Error testing fallback API:', error);
    return {
      success: false,
      message: 'Fallback API connection error',
      error: error.message
    };
  }
}

// Prepare fallback icons to ensure UI doesn't break
async function prepareFallbackIcons() {
  try {
    console.log('Preparing fallback icons...');
    
    // Try to import icon manager
    try {
      const { iconManager } = await import('./iconManager.js');
      
      // Check if icons directory exists
      const missingIcons = await checkIconDirectories();
      
      if (missingIcons.length > 0) {
        console.warn(`These icon directories are missing: ${missingIcons.join(', ')}`);
        
        // Try to generate fallback icons
        await iconManager.generateFallbackIcons();
        console.log('Successfully prepared fallback icons');
      } else {
        console.log('All icon directories present');
      }
    } catch (e) {
      console.warn('Could not use iconManager, creating basic fallbacks');
      
      // Create very simple badge-based indicators
      const badge = {
        text: 'X',
        color: '#1DA1F2'
      };
      
      try {
        await chrome.action.setBadgeText({ text: badge.text });
        await chrome.action.setBadgeBackgroundColor({ color: badge.color });
        console.log('Set basic badge indicator');
      } catch (badgeErr) {
        console.error('Failed to set badge indicator:', badgeErr);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error preparing fallback icons:', error);
    return false;
  }
}

// Check which icon directories are missing
async function checkIconDirectories() {
  const requiredDirs = ['icons', 'icons/active', 'icons/disabled', 'icons/error', 'icons/loading'];
  const missingDirs = [];
  
  for (const dir of requiredDirs) {
    try {
      // Test by loading a test image
      const testFile = dir === 'icons' ? 'icon16.png' : 'test.png';
      const testPath = `${dir}/${testFile}`;
      
      const testResult = await testImageLoad(testPath);
      if (!testResult) {
        missingDirs.push(dir);
      }
    } catch (e) {
      missingDirs.push(dir);
    }
  }
  
  return missingDirs;
}

// Test loading an image
async function testImageLoad(path) {
  return new Promise(resolve => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(false), 1000);
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    
    try {
      img.src = chrome.runtime.getURL(path);
    } catch (e) {
      clearTimeout(timeout);
      resolve(false);
    }
  });
}

// Handle bootstrap response from background
function handleBootstrapResponse(response) {
  if (response.success) {
    console.log('Bootstrap successfully completed');
    bootstrapState.apiConnected = true;
    bootstrapState.iconsLoaded = true;
    bootstrapState.lastError = null;
    
    // Update UI to show success
    updateUIBasedOnStatus(true);
  } else {
    console.error('Bootstrap failed:', response.error);
    bootstrapState.lastError = response.error;
    
    // Update UI to show failure
    updateUIBasedOnStatus(false, new Error(response.error));
  }
}

// Update the extension UI based on bootstrap status
function updateUIBasedOnStatus(isSuccessful, error = null) {
  // Only apply if on a Twitter/X profile page
  const isProfilePage = window.location.href.match(/https:\/\/(www\.)?(twitter|x)\.com\/[^\/]+$/);
  
  if (!isProfilePage) {
    console.log('Not on a profile page, skipping UI update');
    return;
  }
  
  if (isSuccessful) {
    // Add success class to body
    document.body.classList.remove('x-analyzer-error');
    document.body.classList.add('x-analyzer-ready');
    
    // Show the extension button if it exists
    const button = document.querySelector('.x-analyzer-btn');
    if (button) {
      button.classList.remove('hidden');
      button.setAttribute('title', 'Analyze profile with X Analyzer');
    }
  } else {
    // Add error class to body
    document.body.classList.remove('x-analyzer-ready');
    document.body.classList.add('x-analyzer-error');
    
    // Show error state on button if it exists
    const button = document.querySelector('.x-analyzer-btn');
    if (button) {
      button.classList.remove('hidden');
      button.classList.add('error');
      button.setAttribute('title', error ? `Error: ${error.message}` : 'Connection error');
    }
    
    // Show an error banner if we have specific error information
    if (error && error.message) {
      showApiErrorBanner(error.message);
    }
  }
}

// Show API error banner
function showApiErrorBanner(message) {
  try {
    // Create a banner element
    const banner = document.createElement('div');
    banner.className = 'x-analyzer-api-error';
    banner.innerHTML = `
      <div class="error-icon">⚠️</div>
      <div class="error-message">X Analyzer: ${message}</div>
      <div class="error-close">×</div>
    `;
    
    // Style the banner
    Object.assign(banner.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: '9999',
      backgroundColor: '#FEE',
      border: '1px solid #E88',
      borderRadius: '4px',
      padding: '8px 12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'center',
      fontSize: '14px',
      maxWidth: '400px'
    });
    
    // Style the error icon
    const errorIcon = banner.querySelector('.error-icon');
    Object.assign(errorIcon.style, {
      marginRight: '8px',
      fontSize: '18px'
    });
    
    // Style the error message
    const errorMessage = banner.querySelector('.error-message');
    Object.assign(errorMessage.style, {
      flexGrow: '1',
      fontWeight: 'bold'
    });
    
    // Style the close button
    const closeButton = banner.querySelector('.error-close');
    Object.assign(closeButton.style, {
      marginLeft: '8px',
      cursor: 'pointer',
      fontSize: '20px',
      color: '#888'
    });
    
    // Add close functionality
    closeButton.addEventListener('click', () => {
      banner.remove();
    });
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (document.body.contains(banner)) {
        banner.remove();
      }
    }, 10000);
    
    // Add to the page
    document.body.appendChild(banner);
  } catch (e) {
    console.error('Error showing API error banner:', e);
  }
}

// Test API connection
async function testApiConnection() {
  try {
    // Add a timeout to the API test
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API connection test timed out')), 5000);
    });
    
    // Create the actual test
    const connectionTest = async () => {
      // Use connection manager if available
      if (connectionManager) {
        const isConnected = await connectionManager.checkConnectivity();
        return {
          success: isConnected,
          message: isConnected ? 'API connection successful' : 'API connection failed',
          details: connectionManager.getStatus()
        };
      }
      
      // Fallback to direct message
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'testApiConnection',
          silent: true
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              message: chrome.runtime.lastError.message,
              error: chrome.runtime.lastError.message
            });
            return;
          }
          
          resolve({
            success: response && response.success,
            message: response?.success ? 'API connection successful' : (response?.error || 'Connection failed'),
            details: response
          });
        });
      });
    };
    
    // Race the API test against timeout
    return await Promise.race([connectionTest(), timeoutPromise]);
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Failed to test API connection',
      error
    };
  }
}

// Test icon loading
async function testIconLoading() {
  try {
    // Test critical icon paths
    const iconPaths = [
      'icons/icon16.png',
      'icons/icon48.png',
      'icons/active/icon16.png',
      'icons/disabled/icon16-disabled.png'
    ];
    
    // Try to load each icon with a timeout
    const results = await Promise.all(
      iconPaths.map(path => loadImageWithTimeout(path, 2000))
    );
    
    const success = results.some(r => r.success);
    
    return {
      success,
      loaded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    };
  } catch (error) {
    console.error('Error testing icon loading:', error);
    return {
      success: false,
      error: error.message || 'Icon loading test failed'
    };
  }
}

// Helper to load an image with timeout
function loadImageWithTimeout(path, timeoutMs = 2000) {
  return new Promise((resolve) => {
    // Set a timeout to avoid hanging
    const timeout = setTimeout(() => {
      console.warn(`Timeout loading icon: ${path}`);
      resolve({ path, success: false, error: 'Timeout' });
    }, timeoutMs);
    
    try {
      const img = new Image();
      
      img.onload = () => {
        clearTimeout(timeout);
        console.log(`Successfully loaded icon: ${path}`);
        resolve({ path, success: true });
      };
      
      img.onerror = (error) => {
        clearTimeout(timeout);
        console.warn(`Error loading icon ${path}:`, error);
        resolve({ path, success: false, error: 'Failed to load' });
      };
      
      const fullPath = chrome.runtime.getURL(path);
      console.log(`Attempting to load: ${fullPath}`);
      img.src = fullPath;
    } catch (err) {
      clearTimeout(timeout);
      console.error(`Exception loading icon ${path}:`, err);
      resolve({ path, success: false, error: err.message });
    }
  });
} 