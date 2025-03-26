/**
 * Debug tools for X Profile Analyzer
 * Provides utilities for diagnosing DOM issues and event handlers
 */

// DOM Element Debugger to help diagnose missing elements
const XDebugger = {
  init: function() {
    console.log('[X-Analyzer Debug] Initializing debug tools...');
    // Run checks automatically when module is initialized
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[X-Analyzer Debug] Debug tools loaded, running diagnostics...');
      setTimeout(() => {
        this.runAllChecks();
      }, 500);
    });
    
    return this;
  },
  
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
    
    return {missing, found};
  },
  
  // Enhanced debugging for tab relationships
  checkTabRelationships: function() {
    console.log('[X-Analyzer Debug] Checking tab relationships...');
    const tabButtons = document.querySelectorAll('.tab-button');
    const issues = [];
    
    tabButtons.forEach(button => {
      const tabId = button.id;
      const tabContent = document.getElementById(tabId);
      
      if (!tabContent) {
        issues.push(`Tab content with ID "${tabId}" not found for tab button "${tabId}"`);
      } else {
        console.log(`[X-Analyzer Debug] Tab relationship verified: Button "${tabId}" -> Content #${tabId}`);
      }
    });
    
    if (issues.length > 0) {
      console.error('[X-Analyzer Debug] Tab relationship issues found:', issues);
    } else {
      console.log('[X-Analyzer Debug] All tab relationships verified');
    }
    
    return issues;
  },
  
  // Check for event handler conflicts
  monitorEventHandlers: function() {
    const elements = [
      {selector: '#analyze-button', name: 'Analyze Button'},
      {selector: '.tab-button', name: 'Tab Buttons'},
      {selector: '#clear-cache-button', name: 'Clear Cache Button'},
      {selector: '.post-now-button', name: 'Post Button'},
      {selector: '.home-button', name: 'Home Button'}
    ];
    
    elements.forEach(item => {
      const elems = document.querySelectorAll(item.selector);
      console.log(`[X-Analyzer Debug] Found ${elems.length} ${item.name} elements`);
    });
  },
  
  // Check loading overlay
  checkLoadingOverlay: function() {
    const overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
      console.error('[X-Analyzer Debug] Loading overlay not found!');
      return false;
    }
    
    const progressBar = overlay.querySelector('.progress-bar');
    const loadingText = overlay.querySelector('.loading-text');
    const cancelButton = overlay.querySelector('#cancel-loading');
    
    const missing = [];
    if (!progressBar) missing.push('progress-bar');
    if (!loadingText) missing.push('loading-text');
    if (!cancelButton) missing.push('cancel-loading button');
    
    if (missing.length > 0) {
      console.error('[X-Analyzer Debug] Loading overlay is missing components:', missing);
      return false;
    }
    
    console.log('[X-Analyzer Debug] Loading overlay appears to be properly set up');
    return true;
  },
  
  // Run all checks
  runAllChecks: function() {
    console.log('[X-Analyzer Debug] Running all diagnostic checks...');
    
    // Essential elements
    const essentialSelectors = [
      '#analyze-button',
      '#profile-input',
      '#results-container',
      '.loading-overlay',
      '.tab-button',
      '.tab-content',
      '.toast-container'
    ];
    
    this.checkElements(essentialSelectors);
    this.checkTabRelationships();
    this.monitorEventHandlers();
    this.checkLoadingOverlay();
    
    console.log('[X-Analyzer Debug] All diagnostic checks completed');
  },
  
  // Monitor network calls
  monitorNetworkCalls: function() {
    console.log('[X-Analyzer Debug] Setting up network call monitoring...');
    // Implementation would go here
  },
  
  // Test analyze flow
  testAnalyzeFlow: function(username) {
    console.log(`[X-Analyzer Debug] Testing analyze flow for username: ${username}`);
    // Implementation would go here
  },
  
  // Inspect storage
  inspectStorage: function() {
    console.log('[X-Analyzer Debug] Inspecting storage...');
    // Implementation would go here
  },
  
  // Logging utility
  log: function(category, message) {
    console.log(`[X-Analyzer Debug][${category}] ${message}`);
  }
};

// Export the debugger
export default XDebugger;