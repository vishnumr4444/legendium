import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---------------------------------------------------------------------------
// Module‑level state
// ---------------------------------------------------------------------------

// Core Three.js objects used for the standalone character preview.
let characterScene, characterCamera, characterRenderer, characterModel;
// OrbitControls instance for rotating the character.
let characterControls;
// Clock used to advance any model animations at a stable rate.
const characterClock = new THREE.Clock();
// Prevents concurrent model loads when a request is already in flight.
let isLoadingModel = false;
// ResizeObserver instance used to track container size changes.
let resizeObserver = null;

/**
 * Initializes a self‑contained Three.js scene that renders a single
 * animated character model into the provided DOM container.
 *
 * This function:
 * - Creates a scene, camera and renderer
 * - Sets up lighting and orbit controls
 * - Attaches a resize observer to keep the preview responsive
 * - Starts the internal animation loop
 *
 * @param {HTMLElement} container - The DOM element that will host the character canvas.
 */
export function initCharacterScene(container) {
  // Create a new scene for the character preview.
  characterScene = new THREE.Scene();

  // Perspective camera tuned for a close‑up character view.
  characterCamera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  characterCamera.position.set(0, 0, 2);
  characterCamera.lookAt(0, 0, 0);

  // Transparent WebGL renderer so this preview can be overlaid on UI.
  characterRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: false,
  });
  characterRenderer.setSize(container.clientWidth, container.clientHeight);
  // Clear with transparent black (alpha = 0).
  characterRenderer.setClearColor(0x000000, 0);
  container.appendChild(characterRenderer.domElement);

  // -------------------------------------------------------------------------
  // Responsive behavior
  // -------------------------------------------------------------------------

  // Ensure that only one ResizeObserver is active at a time.
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  // React to size changes of the container, updating camera and renderer.
  resizeObserver = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Update camera aspect and projection to avoid stretching.
    characterCamera.aspect = width / height;
    characterCamera.updateProjectionMatrix();

    // Resize renderer to match the container.
    characterRenderer.setSize(width, height);

    // Improve sharpness on high‑DPI / Retina displays.
    characterRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // If a model is already loaded, reposition camera relative to its bounds.
    if (characterModel) {
      const box = new THREE.Box3().setFromObject(characterModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = characterCamera.fov * (Math.PI / 180);

      // Distance where the model comfortably fits in view.
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      characterCamera.position.set(0, -0.4, cameraZ * 1.2);
      characterCamera.lookAt(0, -0.4, 0);
    }
  });
  resizeObserver.observe(container);

  // -------------------------------------------------------------------------
  // Lighting
  // -------------------------------------------------------------------------

  // Soft, even ambient light so the model is always visible.
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  characterScene.add(ambientLight);

  // Strong directional light to add depth and highlights to the character.
  const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
  directionalLight.position.set(2, 2, 5);
  characterScene.add(directionalLight);

  // -------------------------------------------------------------------------
  // Camera controls
  // -------------------------------------------------------------------------

  // OrbitControls allow the user to rotate around the character.
  characterControls = new OrbitControls(characterCamera, characterRenderer.domElement);
  characterControls.enableRotate = true;
  characterControls.enablePan = false;
  characterControls.enableZoom = false; // Keep camera distance fixed for consistent framing.
  // Lock rotation to the horizontal ring around the character (no tilting up/down).
  characterControls.minPolarAngle = Math.PI / 2;
  characterControls.maxPolarAngle = Math.PI / 2;
  // Slowly auto‑rotate the character for a more dynamic preview.
  characterControls.autoRotate = true;
  characterControls.autoRotateSpeed = 5;

  // Start the animation / render loop.
  animateCharacter();
}

/**
 * Cleans up all resources created by `initCharacterScene`.
 *
 * Call this when the preview is no longer needed (for example,
 * when unmounting a component or navigating away) to prevent
 * memory leaks and stray animation loops.
 */
export function cleanupCharacterScene() {
  // Stop listening for resize events.
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Dispose of the renderer's internal WebGL resources.
  if (characterRenderer) {
    characterRenderer.dispose();
  }

  // Dispose of controls to remove event listeners from the DOM.
  if (characterControls) {
    characterControls.dispose();
  }

  // Null out references so garbage collection can reclaim memory.
  characterScene = null;
  characterCamera = null;
  characterRenderer = null;
  characterModel = null;
  characterControls = null;
}

/**
 * Loads a GLTF/GLB character model and adds it to the character scene.
 *
 * This function:
 * - Prevents overlapping loads while a previous one is in progress
 * - Removes any previously loaded model
 * - Centers and slightly offsets the new model
 * - Adjusts the camera based on model size
 * - Starts the first animation clip (usually idle)
 *
 * @param {string} characterPath - Relative path to the character model file (without leading slash).
 */
export function loadCharacterModel(characterPath) {
  // Ignore additional requests while a model is still loading.
  if (isLoadingModel) return;
  isLoadingModel = true;

  // Remove the current model from the scene, if any.
  if (characterModel) {
    characterScene.remove(characterModel);
  }

  const loader = new GLTFLoader();

  // Load the GLTF model from the provided path.
  loader.load(
    `/${characterPath}`,
    (gltf) => {
      // Store the root scene of the loaded GLTF as our character.
      characterModel = gltf.scene;
      characterModel.scale.set(0.9, 0.9, 0.9);
      characterModel.position.set(0, 0, 0);
      characterScene.add(characterModel);

      // Enable casting/receiving shadows on all mesh children.
      characterModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      // Center the model around the origin so rotation looks natural.
      const box = new THREE.Box3().setFromObject(characterModel);
      const center = box.getCenter(new THREE.Vector3());
      characterModel.position.sub(center);
      // Slightly lower the model so feet sit closer to the "ground".
      characterModel.position.y -= 0.1;

      // Compute optimal camera distance based on model size.
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = characterCamera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

      characterCamera.position.set(0, -0.4, cameraZ * 1.2);
      characterCamera.lookAt(0, -0.4, 0);
      characterCamera.updateProjectionMatrix();

      // Set up animation mixer and play the first animation clip (e.g., idle).
      const mixer = new THREE.AnimationMixer(characterModel);
      const idleAction = mixer.clipAction(gltf.animations[0]);
      idleAction.play();
      // Attach mixer to the model so the animation loop can access it.
      characterModel.mixer = mixer;

      isLoadingModel = false;
    },
    undefined,
    (error) => {
      // Log any loading errors and allow another attempt.
      console.error('An error occurred while loading the model:', error);
      isLoadingModel = false;
    }
  );
}

/**
 * Internal animation loop for the character preview scene.
 *
 * This:
 * - Advances any active character animations
 * - Updates orbit controls (including auto‑rotation)
 * - Renders the scene each frame
 *
 * It is started by `initCharacterScene` and re‑schedules itself
 * via `requestAnimationFrame`.
 *
 * @private
 */
function animateCharacter() {
  // Queue the next frame.
  requestAnimationFrame(animateCharacter);

  // Time elapsed since the last frame.
  const delta = characterClock.getDelta();

  // Step the animation mixer forward, if a model and mixer exist.
  if (characterModel && characterModel.mixer) {
    characterModel.mixer.update(delta);
  }

  // Update orbit controls (applies auto‑rotation).
  if (characterControls) {
    characterControls.update();
  }

  // Render the scene using the current camera.
  if (characterRenderer && characterScene && characterCamera) {
    characterRenderer.render(characterScene, characterCamera);
  }
}
