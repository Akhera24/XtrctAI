// Debug script to test functionality directly
import XDebugger from './debugTools.js';

document.addEventListener('DOMContentLoaded', function() {
  console.log('DEBUG: DOMContentLoaded event fired');
  
  // Initialize the advanced debugger
  try {
    window.XDebugger = XDebugger.init();
    XDebugger.log('ui', 'Debugger initialized successfully');
    
    // Check critical elements
    XDebugger.checkElements([
      '#analyze-button',
      '#profile-input',
      '.loading-overlay',
      '#results-container',
      '.progress-bar',
      '.loading-text'
    ]);
    
    // Initialize network monitoring
    XDebugger.monitorNetworkCalls();
    
    // Expose test functions to the console
    window.testAnalyzeFlow = (username) => XDebugger.testAnalyzeFlow(username);
    window.inspectStorage = () => XDebugger.inspectStorage();
    XDebugger.log('ui', 'Debug functions exposed to console: testAnalyzeFlow(), inspectStorage()');
  } catch (error) {
    console.error('Failed to initialize advanced debugger:', error);
  }
  
  // Find the analyze button using multiple selectors to ensure we catch it
  const analyzeButton = document.getElementById('analyze-button') || 
                        document.querySelector('[data-action="analyze"]') ||
                        document.querySelector('button.analyze-button');
  
  console.log('DEBUG: Analyze button found:', analyzeButton);
  
  if (analyzeButton) {
    console.log('DEBUG: Adding direct click handler to analyze button');
    
    // Add a direct click event listener that's separate from any controller
    analyzeButton.addEventListener('click', function(event) {
      console.log('DEBUG: Analyze button clicked directly!');
      
      // Show visual feedback
      const originalText = analyzeButton.textContent;
      analyzeButton.innerHTML = '<span class="loading-spinner"></span><span>Debug Analyzing...</span>';
      analyzeButton.classList.add('loading');
      
      // Get input value
      const profileInput = document.getElementById('profile-input') || 
                          document.querySelector('input[placeholder*="profile"]');
      
      console.log('DEBUG: Profile input found:', profileInput);
      console.log('DEBUG: Profile input value:', profileInput ? profileInput.value : 'N/A');
      
      // Show testing overlay
      const loadingOverlay = document.querySelector('.loading-overlay');
      if (loadingOverlay) {
        console.log('DEBUG: Showing loading overlay');
        loadingOverlay.classList.remove('hidden');
        
        const loadingText = loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
          loadingText.textContent = 'DEBUG MODE: Testing loading functionality...';
        }
        
        const progressBar = loadingOverlay.querySelector('.progress-bar');
        if (progressBar) {
          progressBar.classList.add('animate');
        }
        
        // Automatically hide the loading overlay after 5 seconds
        setTimeout(function() {
          loadingOverlay.classList.add('hidden');
          analyzeButton.textContent = originalText;
          analyzeButton.classList.remove('loading');
          
          // Show mock results
          const resultsContainer = document.getElementById('results-container');
          if (resultsContainer) {
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = `
              <div class="results-card">
                <h3>Debug Analysis for @${profileInput ? profileInput.value : 'sample'}</h3>
                <p>This is a debug result from the direct handler.</p>
                <div class="metrics-grid">
                  <div class="metric-card fade-in">
                    <div class="metric-value">1.5K</div>
                    <div class="metric-label">Followers</div>
                  </div>
                  <div class="metric-card fade-in">
                    <div class="metric-value">245</div>
                    <div class="metric-label">Following</div>
                  </div>
                  <div class="metric-card fade-in">
                    <div class="metric-value">42</div>
                    <div class="metric-label">Engagement</div>
                  </div>
                </div>
              </div>
            `;
          }
        }, 2000);
      }
    });
  }
  
  // Log all clickable elements for debugging
  console.log('DEBUG: All buttons:', Array.from(document.querySelectorAll('button')).map(b => ({
    id: b.id,
    class: b.className,
    text: b.textContent.trim()
  })));
}); 