/**
 * Icon Animation Manager
 * Handles icon animations for the X Profile Analyzer
 */
class IconAnimationManager {
  constructor() {
    this.iconElement = null;
    this.animationInterval = null;
    this.isAnimating = false;
    this.frames = [];
    this.frameIndex = 0;
    this.fps = 12;
  }
  
  setIconElement(element) {
    this.iconElement = element;
    return this;
  }
  
  setFrames(frames) {
    this.frames = frames;
    return this;
  }
  
  setFPS(fps) {
    this.fps = fps;
    return this;
  }
  
  start() {
    if (this.isAnimating) return this;
    
    if (!this.iconElement) {
      console.error('No icon element set for animation');
      return this;
    }
    
    if (!this.frames || this.frames.length === 0) {
      console.error('No animation frames defined');
      return this;
    }
    
    this.isAnimating = true;
    this.frameIndex = 0;
    
    const frameInterval = 1000 / this.fps;
    
    this.animationInterval = setInterval(() => {
      this.nextFrame();
    }, frameInterval);
    
    return this;
  }
  
  stop() {
    if (!this.isAnimating) return this;
    
    clearInterval(this.animationInterval);
    this.isAnimating = false;
    
    return this;
  }
  
  nextFrame() {
    if (!this.isAnimating || !this.iconElement) return;
    
    // Update to next frame
    this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    const frame = this.frames[this.frameIndex];
    
    // Apply frame to icon element
    if (frame) {
      if (typeof frame === 'string') {
        this.iconElement.src = frame;
      } else if (typeof frame === 'object') {
        // Apply object properties to element
        Object.entries(frame).forEach(([prop, value]) => {
          this.iconElement[prop] = value;
        });
      }
    }
  }
  
  createLoadingAnimation() {
    // Generate loading animation frames if needed
    if (this.frames.length === 0) {
      // Simple pulse animation
      const baseColor = '#1DA1F2'; // Twitter blue
      const pulseColors = [
        { fill: baseColor, opacity: 0.4 },
        { fill: baseColor, opacity: 0.6 },
        { fill: baseColor, opacity: 0.8 },
        { fill: baseColor, opacity: 1 },
        { fill: baseColor, opacity: 0.8 },
        { fill: baseColor, opacity: 0.6 },
        { fill: baseColor, opacity: 0.4 }
      ];
      
      this.frames = pulseColors.map(colorInfo => ({ style: { fill: colorInfo.fill, opacity: colorInfo.opacity } }));
    }
    
    return this;
  }
}

// Make it available on the window object
window.IconAnimationManager = IconAnimationManager; 