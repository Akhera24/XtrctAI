// domDebugger.js - Utility to help debug DOM element existence issues
window.XAnalyzerDebugger = {
    // Check if elements exist and report what's missing
    checkElements: function(selectors) {
      console.log('[X-Analyzer Debug] Checking for required DOM elements...');
      const missing = [];
      const found = [];
      
      selectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (!element) {
          missing.push(selector);
        } else {
          found.push(selector);
        }
      });
      
      if (missing.length > 0) {
        console.warn('[X-Analyzer Debug] Missing elements:', missing);
      } else {
        console.log('[X-Analyzer Debug] All elements found');
      }
      
      console.log('[X-Analyzer Debug] Found elements:', found);
      return {missing, found};
    },
    
    // Verify event listeners are attached
    verifyListeners: function(selector, events) {
      const element = document.querySelector(selector);
      if (!element) {
        console.error(`[X-Analyzer Debug] Element not found: ${selector}`);
        return false;
      }
      
      console.log(`[X-Analyzer Debug] Element found: ${selector}`);
      console.log(`[X-Analyzer Debug] Events bound to element:`, element);
      return true;
    }
  };