import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { getStartScene, isUserInfoComplete, getUserInfo } from "./data.js";
import { initializeScene2 } from "./scene2/scene2.js";
import { initializeScene1 } from "./scene1/scene1.js";
import { initializeScene3 } from "./scene3/scene3.js";
import { initializeScene4 } from "./scene4/scene4.js";
import { initializeScene5 } from "./scene5/scene5.js";
import { initializeScene6 } from "./scene6/scene6.js";
import { initializeScene7 } from "./scene7/scene7.js";

// ---------------------------------------------------------------------------
// Global renderer / game state
// ---------------------------------------------------------------------------

// Shared WebGLRenderer instance used by all scenes.
let renderer;
// Guard flag to avoid starting the game multiple times concurrently.
let isGameInitializing = false;
// Timeout handle used to debounce resize events.
let resizeTimeout = null;
// Reference to the active camera so window resize events can update it.
let currentCamera = null;
// Optional reference to the current scene's identifier (for debugging / dev tools).
let currentScene = null;

/**
 * Updates the renderer's size and ensures its canvas fills the window.
 *
 * This helper:
 * - Sets the renderer's size and pixel ratio
 * - Styles the canvas to be a full‑window, fixed‑position background
 *
 * @param {THREE.WebGLRenderer} renderer - Renderer whose canvas should be resized and styled.
 */
function updateCanvasSize(renderer) {
  if (!renderer) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Update renderer size and device pixel ratio.
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Ensure canvas visually fills the window and sits behind UI.
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.zIndex = "0";
}

/**
 * Creates (or returns an existing) shared WebGLRenderer for the game.
 *
 * This renderer:
 * - Uses antialiasing for smoother edges
 * - Prefers high‑performance GPU mode
 * - Automatically resizes with the window
 *
 * @returns {THREE.WebGLRenderer} The initialized renderer instance.
 */
export function initializeRenderer() {
  // Reuse the existing renderer if it has already been created.
  if (renderer) return renderer;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });

  // Set up initial canvas size and styling.
  updateCanvasSize(renderer);

  // Attach the canvas to the document.
  document.body.appendChild(renderer.domElement);

  // Immediately register a basic resize handler so the canvas keeps pace
  // with window size changes.
  window.addEventListener("resize", () => {
    if (currentCamera) {
      currentCamera.aspect = window.innerWidth / window.innerHeight;
      currentCamera.updateProjectionMatrix();
    }
    if (renderer) {
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });

  return renderer;
}

/**
 * Debounced resize handler intended to be used by scenes.
 *
 * It:
 * - Updates the renderer's canvas size and style
 * - Recomputes the camera's aspect and projection matrix
 * after the user has stopped resizing for a short delay.
 *
 * @param {THREE.PerspectiveCamera} camera - Active camera to resize (if present).
 * @param {THREE.WebGLRenderer} renderer - Renderer whose canvas should be resized.
 */
export function handleResize(camera, renderer) {
  if (!renderer) return;

  // Clear any existing queued resize.
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }

  // Debounce the resize handling to avoid thrashing layout / WebGL calls.
  resizeTimeout = setTimeout(() => {
    // Update canvas size and styling first.
    updateCanvasSize(renderer);

    // Update camera projection if available.
    if (camera) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      // Keep a global reference so the basic resize handler can update it too.
      currentCamera = camera;
    }
  }, 100);
}

/**
 * Enables WebXR / VR mode on the provided renderer and returns a VR button.
 *
 * The button is created via Three.js's `VRButton` helper and kept hidden by
 * default; you can show it when the user selects VR mode.
 *
 * When clicked, it:
 * - Requests an `immersive-vr` session
 * - Enables optional features like local/ bounded floor and hand tracking
 * - Attaches the granted session to the renderer
 *
 * @param {THREE.WebGLRenderer} renderer - Renderer to enable XR on.
 * @returns {HTMLButtonElement} The VR button element attached to the document body.
 */
export function enableVR(renderer) {
  console.log("Initializing VR mode...");

  // Turn on WebXR support in the renderer.
  renderer.xr.enabled = true;

  // Create the VR enter/exit button using Three.js helper.
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);
  // Hidden by default; can be revealed when appropriate in the UI.
  vrButton.style.display = "none";

  // Handle click to start an immersive VR session.
  vrButton.addEventListener("click", () => {
    console.log("VR button clicked");

    if (navigator.xr) {
      console.log("Requesting VR session...");
      navigator.xr
        .requestSession("immersive-vr", {
          optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
        })
        .then((session) => {
          console.log("VR session granted:", session);
          renderer.xr.setSession(session);
        })
        .catch((error) => {
          console.error("Failed to start VR session:", error);
        });
    } else {
      console.error("WebXR not supported");
    }
  });

  return vrButton;
}

/**
 * Disposes of the shared renderer and removes its canvas from the DOM.
 *
 * Call this when the game is being completely torn down or re‑initialized
 * to free GPU resources.
 */
export function disposeRenderer() {
  if (renderer) {
    renderer.dispose();
    document.body.removeChild(renderer.domElement);
    renderer = null;
  }
}

/**
 * Entry point to start the game once user info and mode have been selected.
 *
 * This function:
 * - Prevents multiple simultaneous initializations
 * - Validates that user information is complete
 * - Determines which scene to start from `data.js`
 * - Initializes the shared renderer
 * - Shows the main canvas and hides selection UIs
 * - Delegates scene setup to the appropriate `initializeSceneX` function
 */
export function startGame() {
  // Avoid running this logic if a previous call is already in progress.
  if (isGameInitializing) return;
  isGameInitializing = true;

  // Ensure the user has completed all required info before starting.
  if (!isUserInfoComplete()) {
    console.warn("Cannot start game: User info not complete");
    isGameInitializing = false;
    return;
  }

  const startScene = getStartScene();
  const renderer = initializeRenderer();
  const userInfo = getUserInfo();
  const isVRMode = userInfo.modeSelected === "vr";

  console.log("Starting game:", {
    startScene,
    isVRMode,
    userInfo,
  });

  // Make the main Three.js canvas visible.
  const canvas = document.getElementById("scene");
  if (canvas) {
    canvas.style.display = "block";
  }

  // Hide the mode and character selection screens if they are present.
  const modeSelection = document.getElementById("mode-selection");
  const characterSelection = document.getElementById("character-selection");
  if (modeSelection) modeSelection.style.display = "none";
  if (characterSelection) characterSelection.style.display = "none";

  // Route to the appropriate scene initializer based on the configured start scene.
  switch (startScene) {
    case "scene1":
      console.log("Initializing scene1 with VR mode:", isVRMode);
      initializeScene1(renderer, isVRMode);
      window.currentScene = "scene1";
      currentScene = "scene1";
      break;
    case "scene2":
      console.log("Initializing scene2 with VR mode:", isVRMode);
      initializeScene2(renderer, isVRMode);
      window.currentScene = "scene2";
      currentScene = "scene2";
      break;
    case "scene3":
      console.log("Initializing scene3 with VR mode:", isVRMode);
      initializeScene3(renderer, isVRMode);
      window.currentScene = "scene3";
      currentScene = "scene3";
      break;
    case "scene4":
      console.log("Initializing scene4 with VR mode:", isVRMode);
      initializeScene4(renderer, isVRMode);
      window.currentScene = "scene4";
      currentScene = "scene4";
      break;
    case "scene5":
      console.log("Initializing scene5 with VR mode:", isVRMode);
      initializeScene5(renderer, isVRMode);
      window.currentScene = "scene5";
      currentScene = "scene5";
      break;
    case "scene6":
      console.log("Initializing scene6 with VR mode:", isVRMode);
      initializeScene6(renderer, isVRMode);
      window.currentScene = "scene6";
      currentScene = "scene6";
      break;
    case "scene7":
      console.log("Initializing scene7 with VR mode:", isVRMode);
      initializeScene7(renderer, isVRMode);
      window.currentScene = "scene7";
      currentScene = "scene7";
      break;
    default:
      console.warn("Invalid scene specified:", startScene);
      console.log("Defaulting to scene1 with VR mode:", isVRMode);
      initializeScene1(renderer, isVRMode);
      window.currentScene = "scene1";
      currentScene = "scene1";
  }

  isGameInitializing = false;
}

// ---------------------------------------------------------------------------
// Initial bootstrapping
// ---------------------------------------------------------------------------

// Instead of initializing a scene immediately, wait until the DOM is ready
// and show the mode selection UI. `startGame` is called later once the user
// has chosen mode and character.
document.addEventListener("DOMContentLoaded", () => {
  // Show the mode selection screen first (if present in the DOM).
  const selectionScreen = document.getElementById("mode-selection");
  if (selectionScreen) {
    selectionScreen.style.display = "flex";
  }
});
