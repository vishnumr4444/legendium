/**
 * ============================================
 * SCENE COMPLETION CELEBRATION MODULE
 * ============================================
 * Displays dramatic celebration effects when player completes a scene.
 * 
 * Effects:
 * - Full-screen overlay with gradient background
 * - Animated particle fireworks
 * - Twinkling star background
 * - Glass-morphism celebration card
 * - Scene-specific headlines and messages
 * - Progress tracker
 * - Auto-redirect to next scene
 * 
 * Features:
 * - GPU-accelerated particle effects
 * - Smooth fade-in animations
 * - Configurable timing for redirect
 * - Scene-specific messaging
 * - Cleanup and resource disposal
 * - Performance-optimized backdrop filters
 * 
 * Customization:
 * - DEFAULT_HEADLINES: Scene completion titles
 * - DEFAULT_SUBTEXT: Scene completion messages
 * - Timing and animation durations
 */

let celebrationContainer = null;
let redirectTimer = null;
let cleanupTimer = null;
let fireworksInterval = null;
let stylesInjected = false;

const DEFAULT_HEADLINES = {
  scene1: "Mystical Forest Cleared!",
  scene2: "Futuristic City Secured!",
  scene3: "Robotics University Stabilized!",
  scene4: "Underground Lab Explored!",
  scene5: "Robotic Assembly Mastered!",
  scene6: "Component Lesson Learned!",
  scene7: "Component Assembly Completed!"
};

const DEFAULT_SUBTEXT = {
  scene1: "You've unlocked access to the Futuristic City.",
  scene2: "Next stop: The Robotics University.",
  scene3: "Prepare for the depths of the Underground Lab.",
  scene4: "The Robotic Assembly line awaits your command.",
  scene5: "Dive into the Component Lesson for deeper knowledge.",
  scene6: "Final challenge: Component Assembly. You've got this!",
  scene7: "Mission accomplished! All scenes mastered. Returning to HQ."
};

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const styleTag = document.createElement("style");
  styleTag.id = "scene-celebration-styles";
  styleTag.textContent = `
    /* Overlay - smooth fade-in with dark gradient */
    .scene-celebration-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      background: linear-gradient(to bottom, #0f172a 0%, #1e293b 100%);
      opacity: 0;
      transition: opacity 1.2s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .scene-celebration-overlay.active {
      opacity: 1;
    }

    /* Stars background - optimized */
    .scene-stars-container {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
    }

    .twinkle-star {
      position: absolute;
      background: white;
      border-radius: 50%;
      animation: twinkle 5s infinite alternate ease-in-out;
      will-change: opacity; /* GPU hint for better performance */
    }

    @keyframes twinkle {
      0% { opacity: 0.3; }
      100% { opacity: 0.9; }
    }

    /* Fireworks container */
    .scene-fireworks-container {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
    }

    .firework-particle {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background-color: var(--color);
      mix-blend-mode: screen;
      box-shadow: 0 0 6px 1px var(--color);
      animation: firework-physics 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      opacity: 0;
      will-change: transform, opacity; /* GPU acceleration */
    }

    @keyframes firework-physics {
      0% { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) scale(0.3); opacity: 0; }
    }

    /* Glass Card - lighter blur for better performance */
    .scene-celebration-card {
      position: relative;
      z-index: 10;
      max-width: 520px;
      width: 100%;
      padding: 48px 40px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(12px); /* Reduced blur intensity */
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); /* Lighter shadow */
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .scene-celebration-overlay.active .scene-celebration-card {
      opacity: 1;
      transform: translateY(0);
      transition-delay: 0.5s;
    }

    /* Card content styles */
    .scene-celebration-content { position: relative; z-index: 2; }
    .scene-celebration-title {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 3rem;
      margin-bottom: 16px;
      font-weight: 800;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: #ffffff;
      text-shadow: 0 0 20px rgba(14, 165, 233, 0.4);
    }
    .scene-celebration-message {
      font-family: system-ui, sans-serif;
      font-size: 1.15rem;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 32px;
    }
    .scene-celebration-next {
      font-size: 0.9rem;
      color: #7dd3fc;
      margin-top: 24px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 600;
    }
    .scene-celebration-progress {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 99px;
      margin: 20px 0 36px 0;
      position: relative;
      overflow: hidden;
    }
    .scene-celebration-progress span {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      box-shadow: 0 0 15px #38bdf8;
      animation: progress-slide 6s linear forwards;
    }
    .scene-celebration-button {
      border: none;
      padding: 18px 54px;
      border-radius: 100px;
      background: white;
      color: #0f172a;
      font-size: 1.1rem;
      font-weight: 800;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: all 0.3s ease;
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
    }
    .scene-celebration-button:hover {
      transform: scale(1.05);
      box-shadow: 0 0 40px rgba(255, 255, 255, 0.3);
    }
    @keyframes progress-slide {
      from { width: 0%; }
      to { width: 100%; }
    }
  `;
  document.head.appendChild(styleTag);
}

function createFirework(container, x, y) {
  const particleCount = 35; // Reduced from 60
  const colors = ["#f472b6", "#38bdf8", "#facc15", "#4ade80", "#a78bfa", "#ffffff"];

  // Central flash (lighter)
  const center = document.createElement("div");
  center.style.position = "absolute";
  center.style.left = `${x - 3}px`;
  center.style.top = `${y - 3}px`;
  center.style.width = "6px";
  center.style.height = "6px";
  center.style.background = "white";
  center.style.borderRadius = "50%";
  center.style.boxShadow = "0 0 30px 8px white";
  center.style.opacity = "1";
  center.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  container.appendChild(center);
  setTimeout(() => center.remove(), 300);

  // Particles
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "firework-particle";
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = Math.random() * Math.PI * 2;
    const velocity = 70 + Math.random() * 180; // Slightly reduced spread
    
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity + (Math.random() * 120);
    
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty("--color", color);
    particle.style.setProperty("--tx", `${tx}px`);
    particle.style.setProperty("--ty", `${ty}px`);
    
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 2200); // Shorter lifetime
  }
}

function startFireworks(container) {
  // Fewer initial bursts
  setTimeout(() => {
    createFirework(container, window.innerWidth / 2, window.innerHeight * 0.3);
  }, 300);

  setTimeout(() => {
    createFirework(container, window.innerWidth * 0.3, window.innerHeight * 0.4);
    createFirework(container, window.innerWidth * 0.7, window.innerHeight * 0.4);
  }, 800);

  // Less frequent ongoing fireworks
  fireworksInterval = setInterval(() => {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * (window.innerHeight * 0.5);
    createFirework(container, x, y);
  }, 1400); // Increased from 800ms
}

function formatSceneLabel(sceneKey) {
  if (!sceneKey) return "";
  const suffix = sceneKey.replace("scene", "");
  return `Scene ${suffix}`;
}

function persistLocalProgress(completedSceneKey, nextSceneKey) {
  try {
    const completedScenes = JSON.parse(localStorage.getItem("completedScenes") || "{}");
    const visitedScenes = JSON.parse(localStorage.getItem("visitedScenes") || "{}");
    if (completedSceneKey) {
      completedScenes[completedSceneKey] = true;
      visitedScenes[completedSceneKey] = true;
    }
    if (nextSceneKey) {
      visitedScenes[nextSceneKey] = true;
      localStorage.setItem("loadScene", nextSceneKey);
      localStorage.setItem("pendingSceneHighlight", nextSceneKey);
    } else {
      localStorage.removeItem("loadScene");
      localStorage.removeItem("pendingSceneHighlight");
    }
    localStorage.setItem("completedScenes", JSON.stringify(completedScenes));
    localStorage.setItem("visitedScenes", JSON.stringify(visitedScenes));
  } catch (error) {
    console.warn("Unable to persist local scene progress", error);
  }
}

export function cleanupSceneCompletionCelebration() {
  if (redirectTimer) clearTimeout(redirectTimer);
  if (cleanupTimer) clearTimeout(cleanupTimer);
  if (fireworksInterval) clearInterval(fireworksInterval);
  redirectTimer = cleanupTimer = fireworksInterval = null;
  if (celebrationContainer) {
    celebrationContainer.remove();
    celebrationContainer = null;
  }
}

export function celebrateSceneCompletion({
  completedSceneKey,
  nextSceneKey,
  headline,
  subtext,
  redirectDelay = 6000,
  cleanupDelay = 1800,
  redirectUrl = "/scene-select.html",
  onCleanup,
  beforeRedirect,
} = {}) {
  if (typeof window === "undefined" || celebrationContainer) return;

  injectStyles();
  persistLocalProgress(completedSceneKey, nextSceneKey);

  celebrationContainer = document.createElement("div");
  celebrationContainer.className = "scene-celebration-overlay";

  // Stars layer - significantly reduced count for performance
  const starsLayer = document.createElement("div");
  starsLayer.className = "scene-stars-container";
  for (let i = 0; i < 60; i++) { // Reduced from 200 to 60
    const star = document.createElement("div");
    star.className = "twinkle-star";
    const size = Math.random() * 2 + 0.8; // Slightly larger for visibility
    star.style.width = star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}vw`;
    star.style.top = `${Math.random() * 100}vh`;
    star.style.animationDuration = `${4 + Math.random() * 6}s`;
    star.style.animationDelay = `${Math.random() * 6}s`;
    starsLayer.appendChild(star);
  }

  // Fireworks layer
  const fireworksLayer = document.createElement("div");
  fireworksLayer.className = "scene-fireworks-container";

  // Glass card
  const card = document.createElement("div");
  card.className = "scene-celebration-card";

  const content = document.createElement("div");
  content.className = "scene-celebration-content";

  const titleEl = document.createElement("div");
  titleEl.className = "scene-celebration-title";
  titleEl.textContent = headline || DEFAULT_HEADLINES[completedSceneKey] || "Level Complete!";

  const messageEl = document.createElement("p");
  messageEl.className = "scene-celebration-message";
  messageEl.textContent = subtext || DEFAULT_SUBTEXT[completedSceneKey] || "Fantastic work, explorer!";

  const nextEl = document.createElement("div");
  nextEl.className = "scene-celebration-next";
  nextEl.textContent = nextSceneKey
    ? `${formatSceneLabel(nextSceneKey)} auto-selects when we return.`
    : "Returning to scene select shortly.";

  const progress = document.createElement("div");
  progress.className = "scene-celebration-progress";
  const progressFill = document.createElement("span");
  progress.appendChild(progressFill);

  const button = document.createElement("button");
  button.className = "scene-celebration-button";
  button.textContent = "Continue";
  button.addEventListener("click", () => {
    if (redirectTimer) clearTimeout(redirectTimer);
    if (typeof beforeRedirect === "function") beforeRedirect();
    window.location.href = redirectUrl;
  });

  content.appendChild(titleEl);
  content.appendChild(messageEl);
  content.appendChild(nextEl);
  content.appendChild(progress);
  content.appendChild(button);
  card.appendChild(content);

  // Assemble
  celebrationContainer.appendChild(starsLayer);
  celebrationContainer.appendChild(fireworksLayer);
  celebrationContainer.appendChild(card);
  document.body.appendChild(celebrationContainer);

  // Activate
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      celebrationContainer.classList.add("active");
      setTimeout(() => startFireworks(fireworksLayer), 700);
    });
  });

  if (typeof onCleanup === "function") {
    cleanupTimer = setTimeout(() => {
      onCleanup();
      cleanupTimer = null;
    }, cleanupDelay);
  }

  redirectTimer = setTimeout(() => {
    if (typeof beforeRedirect === "function") beforeRedirect();
    window.location.href = redirectUrl;
  }, redirectDelay);
}