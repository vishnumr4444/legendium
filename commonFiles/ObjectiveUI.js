
/**
 * ============================================
 * OBJECTIVE UI MODULE
 * ============================================
 * Displays objective hints and quest information to the player.
 * Uses lottie-web for animated robot character display.
 * 
 * Features:
 * - Chat bubble UI for objective display
 * - Animated robot character (lottie animation)
 * - Sound effect on objective display
 * - Smooth fade-in animation
 * - Customizable main and sub-text
 * - Dynamic positioning (bottom-right corner)
 * - Professional glassmorphism design
 * 
 * Components:
 * - Robot animation container
 * - Chat bubble with text
 * - Sound effect playback
 * - CSS animation system
 * 
 * Usage:
 * Call showObjective() to display objective, hideObjective() to hide
 */

import lottieWeb from "lottie-web";

let botContainer = null;
let bubbleContainer = null;
let styleInjected = false;
let currentObjectiveNumber = null;
let objectiveAudio = null;
let lottieAnim = null;

function injectBotStyles() {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.textContent = `
    #bot-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2000;
      display: flex;
      align-items: flex-end;
      gap: 12px;
      pointer-events: none;
      flex-direction: row-reverse; 
    }

    #bot-lottie {
      width: 90px;
      height: 90px;
      flex-shrink: 0;
    }

    #bubble-container {
      max-width: 320px;
      background: #fff;
      color: #000;
      border: 0.1px solid #ffffff;
      border-radius: 10px;
      padding: 14px 18px;
      font-family: 'Orbitron', 'Arial', sans-serif;
      font-size: 16px;
      line-height: 1.4;
      box-shadow: 0 4px 16px rgba(255, 255, 255, 0.12);
      opacity: 0;
      transform: translateY(20px);
      animation: bubble-in 0.6s cubic-bezier(.6,1.5,.5,1) forwards;
      position: relative;
      pointer-events: auto;
    }

    /* Tail pointing from robot (right) to bubble (left) */
    #bubble-container::after {
      content: "";
      position: absolute;
      top: 50%;
      right: -12px;
      width: 0;
      height: 0;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 12px solid #fff;
      filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.2));
      transform: translateY(-50%);
    }

    @keyframes bubble-in {
      0% { opacity: 0; transform: translateY(20px) scale(0.9); }
      80% { opacity: 1; transform: translateY(-4px) scale(1.02); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .bubble-main {
      font-weight: 700;
      margin-bottom: 6px;
      color: #0078ff;
    }

    .bubble-sub {
      font-weight: 400;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

function initBot(lottieJsonPath = "/animations/robot.json") {
  injectBotStyles();

  if (!botContainer) {
    botContainer = document.createElement("div");
    botContainer.id = "bot-container";

    const lottieDiv = document.createElement("div");
    lottieDiv.id = "bot-lottie";
    botContainer.appendChild(lottieDiv);

    document.body.appendChild(botContainer);

    // Load lottie robot
    lottieAnim = lottieWeb.loadAnimation({
      container: lottieDiv,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: lottieJsonPath
    });
  }
}

/**
 * Show an objective as a chatbot bubble
 */
export function showObjective(objectiveNumber, objectives, lottieJsonPath = "/animations/robot.json") {
  initBot(lottieJsonPath);

  const obj = objectives[objectiveNumber] || { main: "Objective", sub: "" };
  const previousObjectiveNumber = currentObjectiveNumber;
  currentObjectiveNumber = objectiveNumber;

  // Play sound once when a new objective appears
  if (previousObjectiveNumber !== currentObjectiveNumber) {
    try {
      if (!objectiveAudio) {
        objectiveAudio = new Audio('/audios/objectives.mp3');
        objectiveAudio.preload = 'auto';
      }
      objectiveAudio.pause();
      objectiveAudio.currentTime = 0;
      objectiveAudio.loop = false;
      Promise.resolve(objectiveAudio.play()).catch(() => {});
    } catch (e) {}
  }

  // Remove old bubble if exists
  if (bubbleContainer) {
    bubbleContainer.remove();
  }

  bubbleContainer = document.createElement("div");
  bubbleContainer.id = "bubble-container";
  bubbleContainer.innerHTML = `
    <div class="bubble-main">${obj.main}</div>
    ${obj.sub ? `<div class="bubble-sub">${obj.sub}</div>` : ""}
  `;

  botContainer.appendChild(bubbleContainer);
}

export function hideObjective() {
  if (bubbleContainer) {
    bubbleContainer.style.opacity = "0";
    bubbleContainer.style.transform = "translateY(20px)";
    setTimeout(() => {
      if (bubbleContainer && bubbleContainer.parentNode) {
        bubbleContainer.parentNode.removeChild(bubbleContainer);
        bubbleContainer = null;
        currentObjectiveNumber = null;
      }
    }, 400);
  }
}

export function cleanupObjectives() {
  if (botContainer && botContainer.parentNode) {
    botContainer.parentNode.removeChild(botContainer);
    botContainer = null;
    bubbleContainer = null;
    currentObjectiveNumber = null;
  }
}

export function showObjectivesText(text) {
  const customObjective = { main: text, sub: "" };
  showObjective("custom", { custom: customObjective });
}

export function hideObjectives() {
  hideObjective();
}


export function createCameraPlane() {
  return {
    plane: null,
    updatePosition: () => {},
    toggleVisibility: () => {},
    cleanup: () => {}
  };
}
