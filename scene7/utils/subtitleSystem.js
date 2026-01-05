// Subtitle + Video overlay system for the end of the bot-building flow.
// Handles:
// - Styled, animated subtitles with word-by-word type-in
// - Optional sequences of multiple subtitles
// - Fullscreen video playback followed by redirect back to the website
export class SubtitleSystem {
  constructor() {
    this.subtitleContainer = null;
    this.backgroundElement = null;
    this.currentTimeout = null;
    this.isActive = false;
    this.loadStyles();
  }

  // Inject the subtitle CSS file once; skipped if already present.
  loadStyles() {
    // Check if styles are already loaded
    if (document.getElementById('subtitle-styles')) {
      return;
    }

    const link = document.createElement('link');
    link.id = 'subtitle-styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = './scene7/utils/subtitleStyles.css';
    document.head.appendChild(link);
  }

  // Create backing DOM elements for the subtitle overlay.
  createSubtitleContainer() {
    if (this.subtitleContainer) {
      this.removeSubtitleContainer();
    }

    // Create background element
    this.backgroundElement = document.createElement('div');
    this.backgroundElement.className = 'subtitle-background';
    document.body.appendChild(this.backgroundElement);

    // Create subtitle container
    this.subtitleContainer = document.createElement('div');
    this.subtitleContainer.id = 'subtitle-container';
    this.subtitleContainer.style.cssText = `
      position: fixed;c:\Users\USER\Downloads\robot.glb
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      text-align: center;
      pointer-events: none;
      font-family: 'Courier New', 'Monaco', monospace;
      max-width: 80%;
    `;

    document.body.appendChild(this.subtitleContainer);
  }

  /**
   * Show a single subtitle for a given duration with typewriter animation.
   *
   * @param {string} text
   * @param {number} duration - How long to keep the fully-typed subtitle on screen (ms).
   */
  async showSubtitle(text, duration = 3000) {
    return new Promise((resolve) => {
      if (!this.subtitleContainer) {
        this.createSubtitleContainer();
      }

      this.isActive = true;
      
      // Activate background
      if (this.backgroundElement) {
        this.backgroundElement.classList.add('active');
      }
      
      // Clear any existing content
      this.subtitleContainer.innerHTML = '';
      
      // Create subtitle element
      const subtitle = document.createElement('div');
      subtitle.className = 'subtitle-text';

      this.subtitleContainer.appendChild(subtitle);

      // Animate in
      setTimeout(() => {
        subtitle.classList.add('show');
      }, 200);

      // Type out text word by word
      this.typeText(subtitle, text, 120).then(() => {
        // Wait for reading time
        setTimeout(() => {
          // Animate out
          subtitle.classList.remove('show');
          subtitle.classList.add('hide');
          
          setTimeout(() => {
            if (this.subtitleContainer && this.subtitleContainer.contains(subtitle)) {
              this.subtitleContainer.removeChild(subtitle);
            }
            this.isActive = false;
            resolve();
          }, 800);
        }, duration);
      });
    });
  }

  // Type text word-by-word into the given element with a configurable delay.
  async typeText(element, text, delay = 100) {
    const words = text.split(' ');
    element.textContent = '';
    
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      element.textContent += (i > 0 ? ' ' : '') + words[i];
    }
  }

  // Convenience for playing multiple subtitles back-to-back.
  async showSequence(texts, durations = []) {
    for (let i = 0; i < texts.length; i++) {
      const duration = durations[i] || 3000;
      await this.showSubtitle(texts[i], duration);
    }
  }

  // Remove subtitle DOM elements and background overlay from the page.
  removeSubtitleContainer() {
    if (this.backgroundElement) {
      this.backgroundElement.classList.remove('active');
      setTimeout(() => {
        if (this.backgroundElement && this.backgroundElement.parentElement) {
          document.body.removeChild(this.backgroundElement);
        }
        this.backgroundElement = null;
      }, 800);
    }
    
    if (this.subtitleContainer) {
      document.body.removeChild(this.subtitleContainer);
      this.subtitleContainer = null;
    }
    this.isActive = false;
  }

  // Clear timers, remove containers and styles; call when leaving scene7.
  cleanup() {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }
    this.removeSubtitleContainer();
    
    // Remove CSS styles
    const styleLink = document.getElementById('subtitle-styles');
    if (styleLink) {
      document.head.removeChild(styleLink);
    }
  }
}

// Video Player System used at the end of the scene to play an outro movie.
export class VideoPlayer {
  constructor() {
    this.videoElement = null;
    this.isPlaying = false;
  }

  /**
   * Play a full-screen video and resolve when it finishes or errors.
   * Automatically clears 3D/UI elements and redirects to the index page.
   */
  async playVideo(videoPath, onComplete = null) {
    return new Promise((resolve) => {
      if (this.videoElement) {
        this.removeVideo();
      }

      this.videoElement = document.createElement('video');
      this.videoElement.src = videoPath;
      this.videoElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        object-fit: cover;
        z-index: 20000;
        background: black;
      `;

      this.videoElement.controls = false;
      this.videoElement.autoplay = true;
      this.videoElement.muted = false;

      document.body.appendChild(this.videoElement);

      this.videoElement.onended = () => {
        this.removeVideo();
        
        // Clean up everything and redirect to website
        this.cleanupAndRedirect();
        
        if (onComplete) onComplete();
        resolve();
      };

      this.videoElement.onerror = (error) => {
        console.error('Video playback error:', error);
        this.removeVideo();
        this.cleanupAndRedirect();
        resolve();
      };

      this.isPlaying = true;
    });
  }

  // Tear down remaining DOM/3D artifacts and navigate back to the main site.
  cleanupAndRedirect() {
    // Clean up any remaining subtitle elements
    const subtitleContainer = document.getElementById('subtitle-container');
    if (subtitleContainer) {
      subtitleContainer.remove();
    }
    
    const subtitleBackground = document.querySelector('.subtitle-background');
    if (subtitleBackground) {
      subtitleBackground.remove();
    }

    // Clean up CSS styles
    const styleLink = document.getElementById('subtitle-styles');
    if (styleLink) {
      styleLink.remove();
    }

    // Stop all Three.js rendering immediately
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.style.visibility = 'hidden';
    }

    // Clear the entire body to prevent any rendering
    document.body.style.overflow = 'hidden';
    document.body.style.background = 'black';
    
    // Remove all child elements except the video
    const children = Array.from(document.body.children);
    children.forEach(child => {
      if (child.tagName !== 'VIDEO') {
        child.remove();
      }
    });

    // Redirect to website immediately
    window.location.replace('./index.html');
  }

  // Remove the video element only (no redirect).
  removeVideo() {
    if (this.videoElement) {
      document.body.removeChild(this.videoElement);
      this.videoElement = null;
    }
    this.isPlaying = false;
  }

  cleanup() {
    this.removeVideo();
    // Don't redirect during cleanup, only during video end
  }
}
