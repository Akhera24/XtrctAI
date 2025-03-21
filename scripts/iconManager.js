/**
 * Manages extension icon states and transitions
 */
class IconManager {
  constructor() {
    this.states = {
      default: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      },
      active: {
        16: 'icons/active/icon16-active.png',
        48: 'icons/active/icon48-active.png',
        128: 'icons/active/icon128-active.png'
      },
      disabled: {
        16: 'icons/disabled/icon16-disabled.png',
        48: 'icons/disabled/icon48-disabled.png',
        128: 'icons/disabled/icon128-disabled.png'
      }
    };
  }

  /**
   * Set icon state
   * @param {string} state - 'default' | 'active' | 'disabled'
   */
  setIconState(state) {
    if (!this.states[state]) {
      console.error(`Invalid icon state: ${state}`);
      return;
    }

    chrome.action.setIcon({
      path: this.states[state]
    });
  }

  /**
   * Show loading state with animation
   */
  showLoading() {
    let frame = 0;
    const frames = ['active', 'default'];
    
    this.loadingInterval = setInterval(() => {
      this.setIconState(frames[frame % frames.length]);
      frame++;
    }, 600);

    this.updatePopupIcon('active');
    document.querySelector('#statusIcon')?.classList.add('x-logo-pulse');
  }

  /**
   * Stop loading animation
   */
  stopLoading() {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.setIconState('default');
    }

    this.updatePopupIcon('default');
    document.querySelector('#statusIcon')?.classList.remove('x-logo-pulse');
  }

  /**
   * Show temporary success state
   */
  showSuccess() {
    this.setIconState('active');
    setTimeout(() => {
      this.setIconState('default');
    }, 1500);
  }

  /**
   * Show temporary error state
   */
  showError() {
    this.setIconState('disabled');
    setTimeout(() => {
      this.setIconState('default');
    }, 1500);
  }

  updatePopupIcon(state) {
    const popupIcon = document.querySelector('#statusIcon');
    if (popupIcon) {
      popupIcon.setAttribute('state', state);
    }
  }
}

export const iconManager = new IconManager(); 