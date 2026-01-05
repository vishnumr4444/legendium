import * as THREE from "three";

/**
 * Creates and manages the on–screen objective display UI.
 *
 * This utility builds a floating HUD–style objective banner at the
 * top of the screen and updates its text as the player reaches
 * specific world–space locations.
 *
 * Usage:
 *   const { updateObjectiveText, cleanup } = createObjectiveDisplay();
 *   // Call once per frame with the player's THREE.Vector3 position:
 *   updateObjectiveText(player.position);
 *   // When the flow is complete or the scene is destroyed:
 *   cleanup();
 *
 * @returns {{ updateObjectiveText: (playerPosition: THREE.Vector3) => void, cleanup: () => void }}
 * An object exposing:
 * - updateObjectiveText: call with the player's position to drive objective changes.
 * - cleanup: removes DOM nodes, styles, fonts and audio references.
 */
export function createObjectiveDisplay() {
  /**
   * Popup sound used when objectives appear / change.
   * Keeping a single instance avoids repeatedly creating audio elements.
   */
  const popupSound = new Audio("/notification.wav");
  // Overall UI volume – tweak as needed to balance with in–game SFX / music.
  popupSound.volume = 0.5;

  /**
   * Root container for the objective banner.
   * Positioned at the top of the viewport and animated via CSS transforms.
   */
  const container = document.createElement("div");
  container.id = "objective-container";

  /**
   * Text node displaying the current objective line.
   * Starts with the default "Follow the arrow" instruction.
   */
  const objectiveText = document.createElement("div");
  objectiveText.id = "objective-text";
  objectiveText.textContent = "Follow the arrow";

  // Add text element into the container.
  container.appendChild(objectiveText);

  /**
   * Inline CSS for the HUD styling and animation.
   * Keeping it as a string here ensures the component is self–contained and
   * does not rely on external style sheets.
   */
  const styles = `
        #objective-container {
            position: absolute;
            top: -100px; /* Start off-screen from top */
            align-items: center;
            background: linear-gradient(
                135deg,
                rgba(108, 122, 137, 0.1),
                rgba(108, 122, 137, 0.1)
            );
            padding: 15px 25px;
            border: 1px solid rgba(0, 255, 255, 0.3);
            z-index: 1000;
            min-width: 300px;
            backdrop-filter: blur(5px);
            box-shadow: 
                0 0 20px rgba(0, 150, 255, 0.2),
                inset 0 0 20px rgba(0, 150, 255, 0.1);
            clip-path: polygon(
                0 10px, 10px 0,
                calc(100% - 10px) 0, 100% 10px,
                100% calc(100% - 10px), calc(100% - 10px) 100%,
                10px 100%, 0 calc(100% - 10px)
            );
            transform: translateY(0);
            transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
        }

        #objective-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
                90deg,
                transparent 0%,
                transparent 10%,
                rgba(0, 255, 255, 0.5) 50%,
                transparent 90%,
                transparent 100%
            );
            animation: scanline 2s linear infinite;
            pointer-events: none;
            mask: linear-gradient(
                45deg,
                transparent 0%,
                black 20%,
                black 80%,
                transparent 100%
            );
            -webkit-mask: linear-gradient(
                90deg,
                transparent 0%,
                black 20%,
                black 80%,
                transparent 100%
            );
        }

        #objective-text {
            color: #ffffff;
            font-family: 'Orbitron', sans-serif;
            font-size: 16px;
            font-weight: 500;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            position: relative;
            padding-left: 25px;
            letter-spacing: 1px;
            white-space: nowrap;
        }

        #objective-text::before {
            content: '▶';
            position: absolute;
            left: 0;
            color: #00ffff;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            animation: pulse 2s infinite;
        }

        .next-objective-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1001;
            text-align: center;
            width: 100%;
            pointer-events: none;
        }

        .next-objective {
            display: inline-block;
            background: linear-gradient(
                45deg,
                transparent 0%,
                rgba(0, 0, 0, 0.1) 20%,
                rgba(0, 0, 0, 0.2) 50%,
                rgba(0, 0, 0, 0.2) 80%,
                transparent 100%
            );
            padding: 30px 60px;
            width: 600px;
            color: #ffffff;
            font-family: 'Orbitron', sans-serif;
            font-size: 24px;
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            opacity: 0;
            transform: scale(0);
            position: relative;
            backdrop-filter: blur(5px);
        }

        .next-objective::before,
        .next-objective::after {
            content: '';
            position: absolute;
            top: 50%;
            width: 0;
            height: 2px;
            background: linear-gradient(
                45deg,
                transparent,
                #ffffff 20%,
                transparent
            );
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
            transition: width 0.5s ease;
        }

        .next-objective::before {
            right: 100%;
            margin-right: 15px;
        }

        .next-objective::after {
            left: 100%;
            margin-left: 15px;
        }

        .next-objective.show {
            animation: popIn 0.5s forwards;
        }

        .next-objective.show::before,
        .next-objective.show::after {
            width: 150px;
        }

        /* Animated scanline that sweeps across the banner to give a sci‑fi HUD feel. */
        @keyframes scanline {
            0% { 
                transform: translateX(-100%);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            100% { 
                transform: translateX(100%);
                opacity: 0;
            }
        }

        /* Subtle pulsing for the "▶" indicator next to the text. */
        @keyframes pulse {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
        }

        /* Scale / fade‑in animation for centered "next objective" messages. */
        @keyframes popIn {
            0% { 
                opacity: 0;
                transform: scale(0.8);
            }
            50% { 
                opacity: 1;
                transform: scale(1.1);
            }
            100% { 
                opacity: 1;
                transform: scale(1);
            }
        }
    `;

  // Create a <style> tag and inject the component styles into the document head.
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Load the Orbitron Google Font specifically for this HUD.
  const fontLink = document.createElement("link");
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);

  // Attach the banner container to the document body so it becomes visible.
  document.body.appendChild(container);

  // Initial slide–in animation from the top of the screen.
  setTimeout(() => {
    // Move down to its "resting" position.
    container.style.transform = "translateY(130px)";
  }, 500);

  /**
   * Tracks which objective stage the player is currently on.
   * 0 – initial "Follow the arrow"
   * 1 – ticket collection objective
   * 2 – boarding the spacecraft objective
   */
  let currentObjective = 0;

  /**
   * Helper to update the visible objective text.
   * Kept separate in case we want to add more side effects in the future (like sounds).
   *
   * @param {string} text - The text to show in the objective banner.
   */
  function showNextObjective(text) {
    if (objectiveText) {
      objectiveText.textContent = text;
      // Optionally play a sound effect whenever the objective changes.
      try {
        // play() returns a promise in modern browsers; ignore rejections for autoplay policies.
        popupSound.currentTime = 0;
        popupSound.play().catch(() => {});
      } catch {
        // If audio is not allowed or fails, silently continue.
      }
    }
  }

  /**
   * Evaluates the player's position against predefined objective trigger
   * locations and updates the banner accordingly.
   *
   * This should typically be called once per frame from your game loop.
   *
   * @param {THREE.Vector3} playerPosition - Current player world position.
   */
  function updateObjectiveText(playerPosition) {
    // First objective trigger at roughly the arrow destination (-22, 2, 20).
    const targetPosition = new THREE.Vector3(-22, 2, 20);
    const distance = playerPosition.distanceTo(targetPosition);

    // Second objective trigger near the ticket / boarding area (58, 2, 5).
    const targetPosition2 = new THREE.Vector3(58, 2, 5);
    const distance2 = playerPosition.distanceTo(targetPosition2);

    // Final cleanup trigger near the spacecraft exit / final area (84.1, 2.4, -26.2).
    const finalPosition = new THREE.Vector3(84.1, 2.4, -26.2);
    const finalDistance = playerPosition.distanceTo(finalPosition);

    // First objective: player reached the arrow area.
    if (distance < 5 && currentObjective === 0) {
      currentObjective = 1;

      // Slide the banner upwards (off–screen) before changing the text.
      container.style.transform = "translateY(-100px)";

      setTimeout(() => {
        // Update to the ticket collection objective and slide back into view.
        showNextObjective("Collect the ticket to board spaceship");
        container.style.transform = "translateY(130px)";
      }, 600);
    }
    // Second objective: player reached the ticket / boarding zone.
    else if (distance2 < 5 && currentObjective === 1) {
      currentObjective = 2;

      // Slide out, change text, then slide back in.
      container.style.transform = "translateY(-100px)";

      setTimeout(() => {
        // The on–screen text is shorter; the helper call provides a bit more detail.
        objectiveText.textContent = "Board the spacecraft";
        container.style.transform = "translateY(130px)";
        showNextObjective("Press enter to board the spacecraft");
      }, 600);
    }
    // Final area reached – the HUD is no longer needed, so clean everything up.
    else if (finalDistance < 8) {
      cleanup();
    }
  }

  /**
   * Completely removes the HUD from the DOM and releases external references.
   * Call this when the objective system is no longer required (e.g., on scene change).
   */
  function cleanup() {
    // Remove the HUD container from the page.
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Remove the dynamically–inserted style block.
    if (styleSheet && styleSheet.parentNode) {
      styleSheet.parentNode.removeChild(styleSheet);
    }
    // Remove the font link to avoid duplicates when recreating the HUD.
    if (fontLink && fontLink.parentNode) {
      fontLink.parentNode.removeChild(fontLink);
    }
    // Release the audio source so the browser can reclaim resources.
    popupSound.src = "";
  }

  // Public API of this helper.
  return {
    updateObjectiveText,
    cleanup,
  };
}
