import { IconStates, IconColors } from './utils/iconStateManager.js';
import { IconAnimationManager } from './utils/iconAnimationManager.js';
import { IconPreloader } from './utils/iconPreloader.js';

class PopupManager {
  constructor() {
    this.statusIcon = document.getElementById('statusIcon');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.iconAnimator = new IconAnimationManager(this.statusIcon);
    this.isAnalyzing = false;
  }

  async initialize() {
    try {
      // Preload icons
      await IconPreloader.preloadIcons();
      
      this.iconAnimator.setupDefaultAnimations();
      this.setupEventListeners();
      this.updateUIState('default');
      
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.updateUIState('disabled');
    }
  }

  setupEventListeners() {
    document.getElementById('analyzeButton')?.addEventListener('click', () => {
      this.handleAnalyzeClick();
    });

    // Add error recovery
    this.statusIcon.addEventListener('click', () => {
      if (this.statusIcon.getAttribute('state') === 'disabled') {
        this.retryConnection();
      }
    });
  }

  async handleAnalyzeClick() {
    if (this.isAnalyzing) return;
    
    try {
      this.isAnalyzing = true;
      this.updateUIState('loading');
      
      // Your analysis code here
      await this.performAnalysis();
      
      this.updateUIState('active');
    } catch (error) {
      console.error('Analysis failed:', error);
      this.updateUIState('disabled');
    } finally {
      this.isAnalyzing = false;
    }
  }

  updateUIState(state) {
    this.statusIcon.setAttribute('state', state);
    this.statusIcon.setAttribute('animated', state === 'loading');
    this.connectionStatus.classList.toggle('active', state === 'active');
    
    // Update button state if exists
    const analyzeButton = document.getElementById('analyzeButton');
    if (analyzeButton) {
      analyzeButton.disabled = state === 'disabled' || state === 'loading';
    }
  }

  async retryConnection() {
    this.updateUIState('loading');
    try {
      await IconPreloader.preloadIcons();
      this.updateUIState('default');
    } catch (error) {
      this.updateUIState('disabled');
    }
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupManager();
  popup.initialize();
}); 