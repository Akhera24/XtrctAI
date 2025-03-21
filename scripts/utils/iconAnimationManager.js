export class IconAnimationManager {
  constructor(iconElement) {
    this.icon = iconElement;
    this.animations = new Map();
  }

  addAnimation(name, keyframes, options) {
    this.animations.set(name, { keyframes, options });
  }

  play(animationName) {
    const animation = this.animations.get(animationName);
    if (!animation) return;

    this.icon.animate(animation.keyframes, animation.options);
  }

  setupDefaultAnimations() {
    this.addAnimation('pulse', [
      { transform: 'scale(1)' },
      { transform: 'scale(1.05)' },
      { transform: 'scale(1)' }
    ], {
      duration: 2000,
      iterations: Infinity
    });

    this.addAnimation('rotate', [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(360deg)' }
    ], {
      duration: 1000,
      iterations: 1
    });
  }
} 