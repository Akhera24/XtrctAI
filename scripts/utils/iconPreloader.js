export class IconPreloader {
  static async preloadIcons() {
    const iconPaths = [
      'icons/icon16.png',
      'icons/icon48.png',
      'icons/icon128.png',
      'icons/active/icon16-active.png',
      'icons/active/icon48-active.png',
      'icons/active/icon128-active.png',
      'icons/disabled/icon16-disabled.png',
      'icons/disabled/icon48-disabled.png',
      'icons/disabled/icon128-disabled.png'
    ];

    const preloadPromises = iconPaths.map(path => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = chrome.runtime.getURL(path);
      });
    });

    try {
      await Promise.all(preloadPromises);
      console.log('Icons preloaded successfully');
    } catch (error) {
      console.error('Error preloading icons:', error);
    }
  }
} 