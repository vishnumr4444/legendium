import * as THREE from "three";
import gsap from "gsap";
import { rotateCameraOnce } from "./commonFiles/cameraRotate";
import { getUserInfo, getCurrentScene } from "./data.js";
import {
  togglePlayerControls,
  togglePlayerPhysics,
} from "./commonFiles/playerController.js";
import { createLoadingScreenShader } from "./loadingScreenShader.js";

// ---------------------------------------------------------------------------
// Shared loading manager state
// ---------------------------------------------------------------------------

// Three.js loading manager instance used to track asset loading globally.
const loadingManager = new THREE.LoadingManager();
// True while any scene/asset is in the process of loading.
let isLoading = false;
// Camera currently used by the active scene (for rotations & rendering).
let currentCamera = null;
// Renderer used for displaying the loading shader (scene2).
let currentRenderer = null;
// Reference to the shader‑based loading screen (scene2 only).
let shaderLoadingScreen = null;
// Main Three.js scene reference into which loading visuals are rendered.
let scene = null;
// Clock driving the shader animation timing.
let clock = new THREE.Clock();
// Resize handler reference so it can be removed when the shader is hidden.
let resizeHandler = null;
// ID returned by `requestAnimationFrame` for the shader loop.
let animationFrameId = null;
// Track loading progress globally so the shader can reflect it visually.
let currentLoadingProgress = 0;

/**
 * Wires up the shared Three.js `LoadingManager` to the current camera,
 * renderer and main scene, and configures all UI / shader based loading
 * experiences for every scene.
 *
 * This function:
 * - Registers callbacks for `onStart`, `onProgress`, and `onLoad`
 * - Shows / hides the DOM loading UI
 * - Switches to a shader‑driven loading screen for scene2
 * - Coordinates camera rotation and player control toggling while loading
 *
 * @param {THREE.PerspectiveCamera} camera - Active scene camera.
 * @param {THREE.WebGLRenderer} renderer - Renderer used to display loading effects.
 * @param {THREE.Scene} mainScene - Root scene used during loading transitions.
 * @returns {THREE.LoadingManager} Configured loading manager instance.
 */
export function initializeLoadingManager(camera, renderer, mainScene) {
  currentCamera = camera;
  currentRenderer = renderer;
  scene = mainScene;
 
  // Cached references to the DOM‑based loading UI elements.
  let loadingBar = document.getElementById("new-loading-bar");
  let loadingScreen = document.getElementById("new-loading-screen");

  /**
   * Displays the standard DOM‑based loading screen and sets up
   * a scene‑specific background image.
   */
  function showLoadingScreen() {
    if (!isLoading) {
      isLoading = true;
      const { currentScene } = getCurrentScene();

      // Set scene-specific loading image.
      const loadingImage = document.getElementById("new-loading-image");
      if (loadingImage && currentScene) {
        const sceneNumber = currentScene.replace("scene", "");
        loadingImage.src = `/loadingimages/scene${sceneNumber}.png`;
      }

      // Show regular loading screen for all scenes initially.
      if (loadingScreen) {
        loadingScreen.style.display = "flex";
        gsap.to("#new-loading-screen", { duration: 0.5, opacity: 1 });
      }
    }
  }

  /**
   * Switches the loading experience for scene2 from the regular DOM
   * overlay to a full‑screen shader effect driven by `loadingScreenShader`.
   */
  function switchToShaderForScene2() {
    // Hide regular loading screen.
    if (loadingScreen) {
      gsap.to("#new-loading-screen", { duration: 0.5, opacity: 0, onComplete: () => {
        loadingScreen.style.display = "none";
      }});
    }
   
    // Create shader-based loading screen for scene2.
    shaderLoadingScreen = createLoadingScreenShader();
    // Set initial dissolve value to 0 (fully visible).
    shaderLoadingScreen.material.uniforms.dissolve.value = 0.0;
    // Set the brightness to current loading progress.
    shaderLoadingScreen.material.uniforms.brightness.value = currentLoadingProgress / 100;
    // Enable transparency so dissolve/alpha blending works.
    shaderLoadingScreen.material.transparent = true;
    shaderLoadingScreen.material.depthWrite = false;
    scene.add(shaderLoadingScreen.plane);
   
    // Start animation loop for the shader‑based loading screen.
    /**
     * Local render loop used only while the shader loading screen is active.
     * It advances the shader time and re-renders the scene every frame.
     */
    function animate() {
      if (!shaderLoadingScreen) return;
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      shaderLoadingScreen.update(delta);
      currentRenderer.render(scene, currentCamera);
    }
    clock.start(); // Start the clock
    animate();
   
    // Handle window resize to keep the shader effect proportional.
    resizeHandler = () => {
      if (shaderLoadingScreen && currentRenderer) {
        shaderLoadingScreen.handleResize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', resizeHandler);
  }
 
  /**
   * Hides whichever loading experience is in use.
   *
   * - For scene2: fades out the shader by animating its dissolve uniform,
   *   then cleans up the shader mesh, material, and listeners.
   * - For other scenes: fades out the DOM loading overlay and dispatches
   *   a scene‑specific `loadingScreenHidden-*` event.
   */
  function hideLoadingScreen() {
    const { currentScene } = getCurrentScene();
   
    if (currentScene === "scene2") {
      // Animate dissolve effect before removing shader.
      if (shaderLoadingScreen) {
        const dissolveDuration = 1.0; // Duration of dissolve effect in seconds.
        const startTime = performance.now();
       
        function animateDissolve() {
          const elapsed = (performance.now() - startTime) / 1000;
          const progress = Math.min(elapsed / dissolveDuration, 1);
         
          // Update dissolve uniform - now goes from 0 to 1 to dissolve away.
          shaderLoadingScreen.material.uniforms.dissolve.value = progress;
         
          // Ensure we're rendering the scene during dissolve.
          if (currentRenderer && scene && currentCamera) {
            // Render scene first
            currentRenderer.render(scene, currentCamera);
          }
         
          if (progress < 1) {
            requestAnimationFrame(animateDissolve);
          } else {
            // Clean up after dissolve animation completes.
            if (resizeHandler) {
              window.removeEventListener('resize', resizeHandler);
              resizeHandler = null;
            }
            if (animationFrameId) {
              cancelAnimationFrame(animationFrameId);
              animationFrameId = null;
            }
            clock.stop(); // Stop the clock
            scene.remove(shaderLoadingScreen.plane);
            shaderLoadingScreen.material.dispose();
            shaderLoadingScreen = null;
            isLoading = false;
            window.dispatchEvent(new CustomEvent(`loadingScreenHidden-${currentScene}`));
          }
        }
       
        animateDissolve();
      }
    } else {
      // Hide regular loading screen with a fade‑out animation.
      if (loadingScreen) {
        gsap.to("#new-loading-screen", {
          duration: 0.5,
          opacity: 0,
          onComplete: () => {
            loadingScreen.style.display = "none";
            isLoading = false;
            window.dispatchEvent(new CustomEvent(`loadingScreenHidden-${currentScene}`));
          },
        });
      }
    }
  }
 
  // -------------------------------------------------------------------------
  // Three.js loading manager callbacks
  // -------------------------------------------------------------------------

  // When loading starts, display the appropriate loading UI.
  loadingManager.onStart = function () {
    showLoadingScreen();
  };
 
  // Update visual loading progress as assets are being loaded.
  loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const progress = (itemsLoaded / itemsTotal) * 100;
    currentLoadingProgress = progress; // Store progress globally.

    const { currentScene } = getCurrentScene();
   
    if (currentScene === "scene2") {
      // Update shader uniforms for progress (if shader is active).
      if (shaderLoadingScreen) {
        shaderLoadingScreen.material.uniforms.brightness.value = progress / 100;
      }
      // Also update regular loading bar for scene2 until shader takes over.
      if (loadingBar) {
        loadingBar.style.width = progress + "%";
      }
      const loadingProgress = document.querySelector(".new-loading-progress");
      if (loadingProgress) {
        loadingProgress.textContent = Math.round(progress) + "%";
      }
    } else {
      // Update regular loading bar for other scenes.
      if (loadingBar) {
        loadingBar.style.width = progress + "%";
      }
      const loadingProgress = document.querySelector(".new-loading-progress");
      if (loadingProgress) {
        loadingProgress.textContent = Math.round(progress) + "%";
      }
    }
  };
 
  /**
   * Called once all assets tracked by the loading manager have finished
   * loading. Responsible for:
   * - Coordinating camera rotation (cinematic intro)
   * - Temporarily disabling player controls / physics
   * - Switching to shader loading for scene2
   * - Delayed hiding of the loading screen for specific scenes
   */
  loadingManager.onLoad = async function () {
    const userInfo = getUserInfo();
    const { currentScene } = getCurrentScene();
    if (currentScene === "scene7") {
      // Do not rotate camera here; wait for scene7 to signal readiness.
      const handleCameraReady = () => {
        window.removeEventListener("cameraReady-scene7", handleCameraReady);
        // Allow brief frame to render with final camera before hiding.
        requestAnimationFrame(() => {
          hideLoadingScreen();
        });
      };
      window.addEventListener("cameraReady-scene7", handleCameraReady, { once: true });
      return;
    }

    // NON‑VR MODE ------------------------------------------------------------
    if (userInfo.modeSelected === "non-vr") {
      togglePlayerControls(false);
      togglePlayerPhysics(false);
     
      // For scene2, switch to shader before camera rotation starts.
      if (currentScene === "scene2") {
        switchToShaderForScene2();
      }
      
      await rotateCameraOnce(currentCamera);
      setTimeout(() => {
        togglePlayerControls(true);
        togglePlayerPhysics(true);
        // Ensure scene is fully rendered before starting dissolve.
        if (currentScene === "scene2" && shaderLoadingScreen) {
          // Force a render to ensure scene is ready.
          currentRenderer.render(scene, currentCamera);
          // Small delay to ensure render is complete.
          setTimeout(() => {
            hideLoadingScreen();
          }, 2000);
        }  else if (currentScene === "scene3") {
          // Add extra delay for scene3 to ensure collision systems are ready.
          setTimeout(() => {
            hideLoadingScreen();
          }, 2000); // 2 second delay for scene3
        }
        else {
          hideLoadingScreen();
        }
      }, 100);
    } else {
      // VR MODE --------------------------------------------------------------
      togglePlayerControls(false);
      togglePlayerPhysics(false);
     
      // For scene2, switch to shader before camera rotation starts.
      if (currentScene === "scene2") {
        switchToShaderForScene2();
      }
     
      await rotateCameraOnce(currentCamera);
      setTimeout(() => {
        togglePlayerControls(true);
        togglePlayerPhysics(true);
        // Ensure scene is fully rendered before starting dissolve.
        if (currentScene === "scene2" && shaderLoadingScreen) {
          // Force a render to ensure scene is ready
          currentRenderer.render(scene, currentCamera);
          // Small delay to ensure render is complete
          setTimeout(() => {
            hideLoadingScreen();
          }, 100);
        } else {
          hideLoadingScreen();
        }
      }, 100);
    }
  };
 
  return loadingManager;
}

// Re-export the shared loading manager instance for direct access if needed.
export { loadingManager };