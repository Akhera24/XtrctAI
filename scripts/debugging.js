/**
 * Debugging utilities for X Profile Analyzer
 * Helps with diagnosing communication and runtime issues
 */

// Set up global error handler
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.message, event.filename, event.lineno, event.error);
  
  // Create a structured error report
  const errorReport = {
    message: event.message,
    source: event.filename,
    lineNumber: event.lineno,
    columnNumber: event.colno,
    stack: event.error?.stack,
    timestamp: new Date().toISOString()
  };
  
  // Log structured error report
  console.warn('Error report:', errorReport);
  
  // Try to show error in UI if loading overlay is visible
  try {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
      // Show error in loading overlay 
      const loadingText = loadingOverlay.querySelector('.loading-text');
      if (loadingText) {
        loadingText.innerHTML = `Error: ${event.message}<br><small>${event.filename}:${event.lineno}</small>`;
        loadingText.style.color = '#ffcccc';
      }
      
      // Add error class to overlay
      loadingOverlay.classList.add('error');
      
      // Change cancel button to "Close" button
      const cancelButton = loadingOverlay.querySelector('.cancel-button');
      if (cancelButton) {
        cancelButton.textContent = 'Close';
        cancelButton.classList.add('error');
      }
    }
  } catch (uiError) {
    console.error('Error updating UI with error state:', uiError);
  }
  
  // Store error in extension storage
  try {
    chrome.storage.local.get(['errorLog'], function(result) {
      const errorLog = result.errorLog || [];
      errorLog.push(errorReport);
      
      // Keep only the last 10 errors
      if (errorLog.length > 10) {
        errorLog.shift();
      }
      
      chrome.storage.local.set({ errorLog });
    });
  } catch (storageError) {
    console.error('Error storing error in log:', storageError);
  }
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Create error report
  const errorReport = {
    type: 'unhandledRejection',
    message: event.reason?.message || 'Unknown promise rejection',
    stack: event.reason?.stack,
    timestamp: new Date().toISOString()
  };
  
  console.warn('Promise rejection report:', errorReport);
  
  // Try to show in UI
  try {
    if (window.showToast) {
      window.showToast(`Promise error: ${errorReport.message}`, 'error');
    }
  } catch (uiError) {
    console.error('Error showing toast:', uiError);
  }
});

// Check for proper message connection to background script
function checkBackgroundConnection() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        connected: false,
        error: 'Timeout waiting for background response'
      });
    }, 2000);
    
    try {
      chrome.runtime.sendMessage({ action: 'ping' }, function(response) {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          resolve({
            connected: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }
        
        resolve({
          connected: true,
          response: response || 'No data'
        });
      });
    } catch (error) {
      clearTimeout(timeout);
      resolve({
        connected: false,
        error: error.message
      });
    }
  });
}

// Debug information collector
async function collectDebugInfo() {
  const info = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    extensionId: chrome.runtime.id,
    viewType: location.pathname.includes('popup.html') ? 'popup' : 'content',
    domState: {
      bodyChildrenCount: document.body?.children.length,
      hasLoadingOverlay: !!document.querySelector('.loading-overlay'),
      hasToastContainer: !!document.querySelector('.toast-container'),
      hasAnalyzeButton: !!document.getElementById('analyze-button')
    },
    runtimeState: {
      backgroundConnected: false
    },
    storageState: {}
  };
  
  // Check background connection
  try {
    const connectionResult = await checkBackgroundConnection();
    info.runtimeState.backgroundConnected = connectionResult.connected;
    info.runtimeState.backgroundConnectionDetails = connectionResult;
  } catch (error) {
    info.runtimeState.backgroundConnected = false;
    info.runtimeState.connectionError = error.message;
  }
  
  // Check error log
  try {
    chrome.storage.local.get(['errorLog'], function(result) {
      info.storageState.errorLog = result.errorLog || [];
      console.log('Debug information:', info);
    });
  } catch (error) {
    info.storageState.errorLog = `Error accessing: ${error.message}`;
    console.log('Debug information:', info);
  }
  
  return info;
}

// Create log functions that add more context
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Add timestamps to log messages (without checking process.env)
console.log = function(...args) {
  const timestamp = new Date().toISOString();
  originalLog.apply(console, [`[${timestamp}]`, ...args]);
};

console.warn = function(...args) {
  const timestamp = new Date().toISOString();
  originalWarn.apply(console, [`[${timestamp}] ⚠️`, ...args]);
};

console.error = function(...args) {
  const timestamp = new Date().toISOString();
  originalError.apply(console, [`[${timestamp}] 🔴`, ...args]);
};

// Expose debugging tools globally
window.XProfileAnalyzer = window.XProfileAnalyzer || {};
window.XProfileAnalyzer.Debug = {
  collectDebugInfo,
  checkBackgroundConnection,
  errorLog: []
};

// Debug initialization
console.log('Debugging utilities initialized');

// Run initial diagnostic check
setTimeout(() => {
  collectDebugInfo().then(info => {
    if (!info.runtimeState.backgroundConnected) {
      console.warn('⚠️ Background script connection issue detected');
    } else {
      console.log('✅ Background script connection verified');
    }
  });
}, 1000); 