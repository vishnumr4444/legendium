import { loadCharacterModel, initCharacterScene, cleanupCharacterScene } from "./modelViewer.js";
import { initializeRenderer, disposeRenderer, startGame } from "./main.js";
import { updateUserInfo, getUserInfo, setStartScene } from "./data.js";

// Note: loadCharacterModel and initCharacterScene are currently not used
// directly in this file, but kept imported for potential future extensions
// (such as showing a live 3D character preview on the selection screen).

/**
 * Shows the mode selection overlay (VR vs Web) and wires up button handlers.
 *
 * Once a mode is selected, the user is automatically transitioned to the
 * character selection screen.
 */
function showModeSelection() {
  const elements = {
    modeSelection: document.getElementById("mode-selection"),
    characterSelection: document.getElementById("character-selection"),
    vrModeButton: document.getElementById("vr-mode-button"),
    nonVRModeButton: document.getElementById("non-vr-mode-button"),
  };

  // Show mode selection UI, hide character selection until mode is chosen.
  elements.modeSelection.style.display = "flex";
  elements.characterSelection.style.display = "none";

  let selectedMode = null;

  /**
   * Internal helper to visually select a mode button and persist mode choice.
   *
   * @param {HTMLButtonElement} button - The button that was clicked.
   * @param {boolean} isVR - True for VR mode, false for non‑VR.
   */
  const selectMode = (button, isVR) => {
    if (selectedMode) selectedMode.classList.remove("selected");
    button.classList.add("selected");
    selectedMode = button;
    // Update only the mode in user info (character selection happens later).
    updateUserInfo(null, isVR ? "vr" : "non-vr");
    
    // Directly navigate to character selection after a short delay to allow
    // for subtle UI transitions/animations if desired.
    setTimeout(() => {
      showCharacterSelection();
    }, 300);
  };

  // Attach event handlers for VR and non‑VR mode buttons.
  elements.vrModeButton.addEventListener("click", () =>
    selectMode(elements.vrModeButton, true)
  );
  elements.nonVRModeButton.addEventListener("click", () =>
    selectMode(elements.nonVRModeButton, false)
  );
}

/**
 * Displays the character selection overlay and allows the user to pick an
 * avatar before starting the experience. Also wires up keyboard shortcuts.
 */
function showCharacterSelection() {
  const elements = {
    modeSelection: document.getElementById("mode-selection"),
    characterSelection: document.getElementById("character-selection"),
    cards: document.querySelectorAll(".character-card"),
    startButton: document.getElementById("start-experience-btn"),
  };

  // Hide mode selection UI and show character selection.
  elements.modeSelection.style.display = "none";
  elements.characterSelection.style.display = "flex";

  // Character data mapping (name/role metadata keyed by asset path).
  const characterData = {
    "characters/EMLY 4.glb": {
      name: "EMILY",
      role: "EXPLORER"
    },
    "characters/gopuv5-opt2.glb": {
      name: "JOHN",
      role: "TECHNICIAN"
    }
  };

  // Automatically select the first character card as a default choice.
  const defaultCharacterCard = elements.cards[0];
  defaultCharacterCard.classList.add("active");
  const defaultCharacter = defaultCharacterCard.getAttribute("data-character");
  const { modeSelected } = getUserInfo();
  updateUserInfo(defaultCharacter, modeSelected);

  // Enable start button since we already have a default character.
  elements.startButton.classList.add("active");

  // Attach click handlers to each character card to update selection.
  elements.cards.forEach((card) => {
    card.addEventListener("click", () => {
      elements.cards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const character = card.getAttribute("data-character");
      const { modeSelected } = getUserInfo();
      updateUserInfo(character, modeSelected);
    });
  });

  // Start button functionality: only triggers experience if active.
  elements.startButton.addEventListener("click", () => {
    if (elements.startButton.classList.contains("active")) {
      startExperience();
    }
  });

  // Add keyboard navigation: Enter starts experience, Escape returns to mode selection.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      startExperience();
    } else if (e.key === "Escape") {
      showModeSelection();
    }
  });
}

/**
 * Starts the experience after character selection:
 * - Hides the character selection UI
 * - Shows the loading screen overlay
 * - Applies any preselected scene from localStorage
 * - Simulates a loading bar then triggers the main startGame() entry
 */
function startExperience() {
  const characterSelection = document.getElementById("character-selection");
  const loadingScreen = document.getElementById("new-loading-screen");
  
  characterSelection.style.display = "none";
  loadingScreen.style.display = "flex";
  
  // Check if there's a specific scene to load from localStorage.
  const loadScene = localStorage.getItem('loadScene');
  if (loadScene) {
    console.log(`Loading specific scene: ${loadScene}`);
    setStartScene(loadScene);

  }
  // Set initial loading image based on selected scene (if any).
const loadingImage = document.getElementById("new-loading-image");
if (loadingImage && loadScene) {
  const sceneNumber = loadScene.replace("scene", "");
  loadingImage.src = `/loadingimages/scene${sceneNumber}.png`;
}
  // Simulate loading progress until the main scene has been started.
  let progress = 0;
  const progressElement = document.querySelector(".new-loading-progress");
  
  const loadingInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress >= 100) {
      progress = 100;
      clearInterval(loadingInterval);
      setTimeout(() => {
        startGame();
      }, 500);
    }
    if (progressElement) {
      progressElement.textContent = Math.floor(progress) + "%";
    }
  }, 200);
}

/**
 * Public entry point used by the HTML shell to begin the mode/character
 * selection flow. Optionally accepts a mode (e.g. "non-vr") to preselect
 * and directly show characters, but currently always starts at mode screen.
 */
export function startCharacterSelection() {
  showModeSelection();
}

/**
 * Cleans up any Three.js resources used by the character preview /
 * renderer. Call this when navigating away from the experience entirely.
 */
export function cleanup() {
  cleanupCharacterScene();
  disposeRenderer();
}