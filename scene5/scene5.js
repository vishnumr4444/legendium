import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  allAssets,
  checkExistingAssets,
  loadAllAsset,
} from "../commonFiles/assetsLoader.js";
import { assetsEntry as currentEntry } from "./assetsEntry.js";
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer.js";
import { setCurrentScene, getUserInfo } from "../data.js";
import { initializeVR, updateVR, cleanupVR, enablePlayerMovement, disablePlayerMovement, setCollisionMesh } from "../commonFiles/vrManager.js";
import {
  handleCollisions,
  playerState,
  handleHoverboardCollisions,
  togglePlayerControls,
  togglePlayerPhysics,
  hidePlayerModel,
} from "../commonFiles/playerController.js";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";
import { playAudio, initializeAudioManager ,cleanupAudioManager} from "../commonFiles/audiomanager.js";
import { initializeElectro, updateElectro, cleanupElectro, startElectroSequence } from "./electrointeraction.js";
import gsap from "gsap";
import { initializeScene6 } from "../scene6/scene6.js";
import { assetsEntry as nextEntry } from "../scene6/assetsEntry.js";
import { auth, db } from "../WebFiles/firebase.js";
import { doc, updateDoc } from "firebase/firestore";
import { markSceneVisited } from "../data.js";
import { celebrateSceneCompletion } from "../commonFiles/sceneCompletionCelebration.js";

// New imports
import { 
  initComponentModels, 
  setupComponents, 
  updateComponents, 
  animateComponentToOriginal, 
  handleComponentClick, 
  addGlassPlaneBehindUno, 
  removeGlassPlane,
  getGlassPlane,
  componentModels,
  focusedComponentKey,
  COMPONENT_KEYS,
  setFocusedComponentKey,
  getFocusedComponentKey,
  setupMeshHoverInteraction,
  setupSceneClickInteraction
} from "./componentManager.js";
import { 
  createCloseButton, 
  showMeshUIPanel, 
  hideMeshUIPanel, 
  showFPPOverlay,
  getMeshUIPanel,
  createComponentIntroPanel,
  createByteAssemblyPanel,
  createStartBuildButton,
  setupStartBuildButtonHandlers,
  updateUI
} from "./uiManager.js";

// Keep references to dynamic handlers so we can remove them on cleanup
let hudVideoElement = null;
let loadingHiddenHandler = null;
let underground
let skybox,composer;
let scene, renderer, controls;
let rendererBg, rendererUno;
let unoCanvas, bgCanvas;
// Billboard video plane reference
let hudVideoPlane = null;
// Add resizeHandler at module scope
let resizeHandler = null;
// Add sceneInitialization as a global variable
let sceneInitialization;
let collisionMesh;
let animationFrameId = null;
let camera = null;
// Add at the top with other state variables
let isSceneTransitioning = false;

let backgroundAudio; // Add background music variable
// At the top, add a constant for animation duration
const COMPONENT_ANIMATION_DURATION = 2.0; // seconds
// Module-level flags to replace window. usages
let isComponentIntroSequencePlaying = false;
let isElectroSequencePlaying = false;
let vrClickableObjects = [];
let scene5Video = null;
let scene5VideoTexture = null;
let scene5Material = null;
let scene5Clock = null;
let startBuildButtonCleanup = null;
let meshHoverCleanup = null;
let sceneClickCleanup = null;
let scene5HandleSwitchClick = null;
let debugVRClickableObjects = null;

// Define handleKeyPress at the top level
function handleKeyPress(event) {
  if (event.key.toLowerCase() === "y" && !isSceneTransitioning) {
    transitionToScene6();
  }
}
// Unified transition flow to scene6 (VR-aware), mirroring scene4 behavior
function transitionToScene6() {
  if (isSceneTransitioning) return;
  isSceneTransitioning = true;
  const session = renderer?.xr?.getSession ? renderer.xr.getSession() : null;
  const proceed = (isVR) => {
    try { markSceneCompleted("scene5"); } catch (_) {}
    window.removeEventListener("keydown", handleKeyPress);
    celebrateSceneCompletion({
      completedSceneKey: "scene5",
      nextSceneKey: "scene6",
      headline: "Robotic Assembly Mastered!",
      subtext: "Dive into the Component Lesson for deeper knowledge. Returning to scene select...",
      onCleanup: () => {
        if (sceneInitialization) {
          try { sceneInitialization.cleanUpCollider(); } catch (e) {}
        }
        try { cleanupScene5(); } catch (e) {}
      }
    });
  };
  if (session && typeof session.end === 'function') {
    session.end()
      .then(() => proceed(true))
      .catch((error) => {
        console.error("Error ending VR session:", error);
        proceed(true); // proceed assuming VR if ending failed
      });
  } else {
    proceed(false);
  }
}

export async function initializeScene5(existingRenderer, isVRMode) {
  setCurrentScene("scene5");
  await markSceneVisited("scene5");
  const userInfo = getUserInfo();
  
  // Cancel any existing animation frame
  animationFrameId = null;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  // Declare these at the top of the function
  let video, videoTexture, material;
 
  // Store references for cleanup
  scene5Video = video;
  scene5VideoTexture = videoTexture;
  scene5Material = material;
  // Setup main camera with proper aspect ratio
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  // camera.position.set(-32, 1, 0); // Moved to loadingScreenHidden-scene5
  // Use existing renderer for background
  renderer = existingRenderer;
  // Ensure renderer is properly configured
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.CineonToneMapping;
  renderer.toneMappingExposure = 0.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Make sure renderer is in the document
  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }

  // Initialize loading manager with both camera and renderer
  await loadAllAsset(currentEntry, camera, renderer);
  // Remove the camera.position.set and lookAt from here
  scene = new THREE.Scene();
  // Add camera to scene so its children (like the plane) render
  scene.add(camera);
  // Initialize audio manager with camera and scene
  initializeAudioManager(camera, scene);
  
  // HUD Video Plane Setup
if (allAssets && allAssets.videotextures && allAssets.videotextures.hudvideo2) {
  video = document.createElement('video');
  try {
    video.src = allAssets.videotextures.hudvideo2.path;
    video.loop = true;
    video.muted = false;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.autoplay = false;
    video.preload = 'metadata';  // Changed from 'auto' to 'metadata' to reduce cache load
    video.style.display = 'none';
    document.body.appendChild(video);
    video.load();  // Force reload the video source
    video.addEventListener('loadeddata', () => {

    });

    video.addEventListener('error', (e) => {

      // Fallback: Try absolute dev server path if relative fails, using current origin
      const assetPath = allAssets.videotextures.hudvideo2.path;
      if (assetPath && !assetPath.startsWith('http')) {
        video.src = window.location.origin + assetPath;
        video.load();
      }
    });

    videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
    videoTexture.generateMipmaps = false;
    const geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        videoTexture: { value: videoTexture },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D videoTexture;
        uniform float time;
        varying vec2 vUv;
        void main() {
          vec4 videoColor = texture2D(videoTexture, vUv);
          float intensity = (videoColor.r + videoColor.g + videoColor.b) / 3.0;
          vec3 enhancedColor = videoColor.rgb * 0.5;
          enhancedColor = clamp(enhancedColor, 0.0, 0.5);
          float alpha = smoothstep(0.15 - 0.05, 0.15 + 0.05, intensity);
          gl_FragColor = vec4(enhancedColor, alpha * videoColor.a);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    // Only one HUD video plane
    hudVideoPlane = new THREE.Mesh(geometry, material);
    hudVideoPlane.position.set(-30, 1.5, -5.5);
    hudVideoPlane.rotation.set(0, 0, 0);
    hudVideoPlane.renderOrder = 10;
    hudVideoPlane.visible = false;
    scene.add(hudVideoPlane);
    // Expose for electrointeraction.js
    hudVideoElement = video;
    // Remove HUD video plane and element when video ends
    const hudEndedHandler = () => {
      if (hudVideoPlane && scene) {
        scene.remove(hudVideoPlane);
        hudVideoPlane.geometry.dispose();
        if (hudVideoPlane.material.map) hudVideoPlane.material.map.dispose();
        hudVideoPlane.material.dispose();
        hudVideoPlane = null;
      }
      if (hudVideoElement && hudVideoElement.parentNode) {
        hudVideoElement.parentNode.removeChild(hudVideoElement);
      }
      hudVideoPlane = null;
      hudVideoElement = null;
      video.removeEventListener('ended', hudEndedHandler);
    };
    video.addEventListener('ended', hudEndedHandler);
  } catch (err) {
    console.error('Failed to initialize HUD video:', err);
  }
}
  // 1. Play electrosound and wait for it to finish
  loadingHiddenHandler = () => {
 
   
    // Start background music
    if (allAssets.audios.background) {
      backgroundAudio = allAssets.audios.background;
      backgroundAudio.play();
    }
  };
  window.addEventListener('loadingScreenHidden-scene5', loadingHiddenHandler);
  const params = {
    height: 100,
    radius: 1200,
    enabled: true,
  };
  skybox = new GroundedSkybox(
    allAssets.hdris.sky,
    params.height,
    params.radius
  );
  skybox.position.y = 0;
  scene.add(skybox);
  scene.environment = allAssets.hdris.sky;
  scene.environmentIntensity = 0.6;
  // Force an immediate render to ensure proper sizing
  renderer.render(scene, camera);
  controls = new OrbitControls(camera, renderer.domElement);
  // controls.enabled = false;
  // controls.minDistance = 1;
  controls.dampingFactor = 0.25;
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2;
  controls.enablePan = false;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.5;
  // Add the event listener after scene initialization is complete
  window.addEventListener("keydown", handleKeyPress);
  sceneInitialization = initializePhysicsAndPlayer(
    allAssets.models.gltf.underground,
    {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    },
    [],
    scene,
    camera,
    controls,
    renderer
  );
 
  // Hide the player model from the beginning
  hidePlayerModel();
  underground = allAssets.models.gltf.underground;
  // Add lights
  // --- Bunker Lighting Setup ---
  // Dim, yellowish ambient light for old bunker feel
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.58); // warm, dim
  scene.add(ambientLight);

  
  scene5Clock = new THREE.Clock();
 
  // Initialize Component Models
  initComponentModels();
  setupComponents(scene, allAssets, renderer);

  // Initialize Electro interaction (do not auto-start sequence)
  initializeElectro(scene, allAssets, sceneInitialization.playerFunction.player, camera, controls, renderer, hudVideoPlane, hudVideoElement);
  
  // --- Create UI Panels ---
  const componentIntroPanel = createComponentIntroPanel(scene);
  const byteAssemblyPanel = createByteAssemblyPanel(scene);

  if (startBuildButtonCleanup) startBuildButtonCleanup();
  
  // --- Create Start Build Button ---
  const { startBuildButton, startBuildButtonShadow } = createStartBuildButton(
    scene, 
    byteAssemblyPanel, 
    () => isComponentIntroSequencePlaying, 
    cleanupScene5, 
    transitionToScene6
  );

  if (!camera || (!camera.isPerspectiveCamera && !camera.isOrthographicCamera)) return;

  // --- Setup Button Handlers ---
  startBuildButtonCleanup = setupStartBuildButtonHandlers(
    renderer, 
    camera, 
    startBuildButton, 
    startBuildButtonShadow,
    scene,
    () => isComponentIntroSequencePlaying, 
    getFocusedComponentKey
  );
  
  // --- Setup Mesh Hover Interaction ---
  meshHoverCleanup = setupMeshHoverInteraction(
    renderer, 
    camera, 
    componentModels, 
    getFocusedComponentKey
  );

  // Create close button
  const closeButton = createCloseButton(
    scene, 
    (key) => animateComponentToOriginal(key, scene, controls, isElectroSequencePlaying), 
    getFocusedComponentKey, 
    () => hideMeshUIPanel(scene, vrClickableObjects), 
    removeGlassPlane,
    () => isComponentIntroSequencePlaying
  );

  // --- Setup Scene Click Interaction (Models/Meshes) ---
  sceneClickCleanup = setupSceneClickInteraction(
    renderer, 
    camera, 
    scene, 
    controls, 
    () => isComponentIntroSequencePlaying, 
    () => isElectroSequencePlaying, 
    vrClickableObjects,
    startBuildButton
  );
  
  // Initialize VR if in VR mode - after button creation
  if (isVRMode) {
    // Create clickable objects array for VR interaction
    const clickableObjects = [];
   
    // Add component models to clickable objects
    COMPONENT_KEYS.forEach(key => {
      const model = allAssets.models.gltf[key];
      if (model) {
        // Add the entire model as clickable
        model.userData = {
          ...model.userData,
          componentKey: key,
          onClick: () => {

            if (isComponentIntroSequencePlaying) {

              return;
            }
            handleComponentClick(key, scene, camera, controls, isComponentIntroSequencePlaying, isElectroSequencePlaying);
          }
        };
        clickableObjects.push(model);
        // Also add individual meshes for detailed interaction when focused
        model.traverse(child => {
          if (child.isMesh) {
            child.userData = {
              ...child.userData,
              componentKey: key,
              parentModel: model,
              onClick: () => {
                console.log(`VR Controller clicked on ${key} mesh: ${child.name}`);
                if (isComponentIntroSequencePlaying) {
                  console.log('Electro sequence is playing, ignoring VR mesh click');
                  return;
                }
                const focusedKey = getFocusedComponentKey();
                if (focusedKey === key) {
                  // If component is focused, show mesh UI panel
                  showMeshUIPanel(child, focusedKey, scene, camera, componentModels, vrClickableObjects);
                } else {
                  // If component is not focused, focus it first
                  handleComponentClick(key, scene, camera, controls, isComponentIntroSequencePlaying, isElectroSequencePlaying);
                }
              }
            };
            clickableObjects.push(child);
          }
        });
      }
    });
    // Add start build button to clickable objects
    if (startBuildButton) {
      startBuildButton.userData = {
        ...startBuildButton.userData,
        isStartBuildButton: true,
        onClick: () => {
          console.log('VR Controller clicked on Start Build button');
          if (isComponentIntroSequencePlaying) {

            return;
          }
          if (startBuildButton && startBuildButton.currentState === 'hovered') {
            startBuildButton.setState('selected');
          }
        }
      };
      clickableObjects.push(startBuildButton);
    }
    // Store clickable objects locally for VR updates
    vrClickableObjects = clickableObjects;
    initializeVR(
      renderer,
      scene,
      camera,
      sceneInitialization.playerFunction.player,
      // backgroundMusic,
      sceneInitialization.playerFunction.actions,
      clickableObjects,
      (clickedObject) => {
        // Handle VR button click
        if (clickedObject && clickedObject.userData) {
          if (clickedObject.userData.onClick) {
            clickedObject.userData.onClick();
          }
        }
      }
    );
    // Store reference to collision mesh
    collisionMesh = allAssets.models.gltf.underground.collisionMesh;
    // Set collision mesh for VR
    setCollisionMesh(collisionMesh);
    // Enable player movement
    enablePlayerMovement(sceneInitialization.playerFunction.player);

  // Add local function for VR debugging
  debugVRClickableObjects = () => {
    console.log('Current VR clickable objects:', vrClickableObjects);
    if (vrClickableObjects) {
      vrClickableObjects.forEach((obj, index) => {
        console.log(`Object ${index}:`, obj.name, obj.userData);
      });
    }
  };
}
// Attach hover listener after models/VR setup
// renderer.domElement.addEventListener('pointermove', hoverPointerMoveHandler); // Now handled by setupMeshHoverInteraction
  // Billboard the panel in the render loop
  const originalRender = render;
  render = function() {
    // if (componentIntroPanel && camera) {
    // componentIntroPanel.lookAt(camera.position);
    // }
    if (typeof originalRender === 'function') originalRender();
  };

  function animate() {
    if (userInfo.modeSelected === "vr") {
      renderer.setAnimationLoop(render);
    } else {
      function loop() {
        if (!scene || !camera || !renderer) return;
        if (!camera.isPerspectiveCamera && !camera.isOrthographicCamera) return;
        if (isSceneTransitioning) return; // stop render if transitioning
        animationFrameId = requestAnimationFrame(loop);
        render();
      }
      loop();
    }
  }

  function render() {
    if (!scene || !camera || !renderer) return;
    if (!camera.isPerspectiveCamera && !camera.isOrthographicCamera) return;
      // Billboard the hud video plane
  // if (hudVideoPlane && camera) {
  // // Make the plane always face the camera
  // hudVideoPlane.lookAt(camera.position);
  // }
    // stats.begin();
    const delta = scene5Clock.getDelta();
    // Update UI
    updateUI();
    if (userInfo.modeSelected === "vr") {
      updateVR();
    } else {
      // Update controls only in non-VR mode
      if (controls) {
        controls.update();
      }
    }
    if (sceneInitialization?.playerFunction?.player) {
      const player = sceneInitialization.playerFunction.player;
      player.updateMatrixWorld();
      // Don't update player movement during electro sequence
      if (!isElectroSequencePlaying) {
        // Handle collisions with the environment
        if (collisionMesh) {
          handleCollisions(player, collisionMesh, playerState.velocity, delta);
        }
        // Apply any remaining velocity after collision
        if (playerState.velocity.length() > 0) {
          player.position.x += playerState.velocity.x * delta;
          player.position.z += playerState.velocity.z * delta;
          if (!playerState.onGround) {
            player.position.y += playerState.velocity.y * delta;
          }
        }
      }
    }
    // Update holographic outline time uniform
    // if (unoOutline && unoOutline.material) {
    // unoOutline.material.uniforms.time.value += delta;
    // }
    // Update Electro interaction
    updateElectro(delta);
    
    // Update animation for all component models
    updateComponents(scene, camera, isElectroSequencePlaying);

    // Update uno orbit controls when near camera
    // if (unoIsNearCamera && unoOrbitControls && unoOrbitControls.enabled) {
    // unoOrbitControls.update();
    // }
    // In the render() function, before renderer.render(scene, camera):
    // ThreeMeshUI.update(); // Will add import back
    
    // In the render() function, remove all code that sets obj.visible = false or restores _prevVisible for UNO-only rendering.
    // Only render the full scene with renderer.render(scene, camera), and keep the glassPlane logic.
    // The only conditional logic should be for adding/removing the glassPlane mesh.
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    
    const glassPlane = getGlassPlane();
    const focusedKey = getFocusedComponentKey();

    if (!glassPlane && focusedKey && componentModels[focusedKey].isNearCamera) {
      requestAnimationFrame(() => addGlassPlaneBehindUno(camera));
    }
    if (glassPlane && !focusedKey) {
      removeGlassPlane();
    }
    // In the render() function, if unoIsNearCamera, always update glassPlane position/orientation:
    if (focusedKey && componentModels[focusedKey].isNearCamera && glassPlane && componentModels[focusedKey].targetPosition && camera) {
      const camDir = camera.getWorldDirection(new THREE.Vector3());
      glassPlane.position.copy(componentModels[focusedKey].targetPosition.clone().sub(camDir.clone().multiplyScalar(1.2)));
      glassPlane.lookAt(camera.position);
    }
    if (hudVideoPlane && hudVideoPlane.material && hudVideoElement) {
      if (hudVideoElement.readyState > 0) {  // Ensure video is loaded
        hudVideoPlane.material.uniforms.videoTexture.value.needsUpdate = true;
      }
    }
    // if (typeof ThreeMeshUI !== 'undefined') {
    //   try {
    //     ThreeMeshUI.update();
    //   } catch (e) {

    //   }
    // }

    
    // if (hoveredOutlineMesh && hoveredOutlineMesh.material) {
    // // Blink the outline using a sine wave
    // const t = performance.now() * 0.008;
    // hoveredOutlineMesh.material.opacity = 0.7 + 0.3 * Math.sin(t * 4.0);
    // hoveredOutlineMesh.material.needsUpdate = true;
    // }
    // stats.end();
  }
  animate();
  // Define resizeHandler to handle all camera updates
  resizeHandler = () => {
    const aspect = window.innerWidth / window.innerHeight;
    if (camera && renderer) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };
  window.addEventListener("resize", resizeHandler);
  // After unoModel and unoMeshes are set up, force show the panel for debugging:
  setTimeout(() => {
    // if (unoMeshes && unoMeshes.length > 0) {
    // showMeshUIPanel(unoMeshes[0]);
    // console.log('[DEBUG] Forced meshUIPanel show for', unoMeshes[0].name);
    // }
  }, 2000); // Wait 2 seconds for scene to settle
  // Listen for loading screen hidden event to set camera and start electro sequence
  window.addEventListener('loadingScreenHidden-scene5', () => {
    // Set camera to correct initial position for scene5
    camera.position.set(-32, 1, 0);
    camera.lookAt(new THREE.Vector3(-32, 1, -5));
   
    // Ensure player model stays hidden at start
    hidePlayerModel();
   
    // Show FPP overlay from the beginning
    showFPPOverlay();
   
    // Start electro sequence after camera is set
    setTimeout(() => {
      if (typeof startElectroSequence === 'function') {
        startElectroSequence();
      }
    }, 100); // Small delay to ensure camera is set
  });
  return {
    scene,
    camera,
    renderer,
    controls,
    sceneInitialization,
  };
}
// Add cleanup function
export function cleanupScene5() {


  // --- 1. STOP ALL USER INTERACTION ---
  
  // Clone the canvas to remove ALL event listeners (pointermove, pointerdown, etc.)
  // This is the most reliable way to prevent "zombie" listeners from firing.
  if (renderer && renderer.domElement && renderer.domElement.parentNode) {
    try {
      // This instantly kills all listeners on the canvas
      renderer.domElement.replaceWith(renderer.domElement.cloneNode(true));
    } catch (e) {
      console.warn("Failed to clone renderer element to remove listeners:", e);
    }
  }
  
  // Remove global window listeners
  window.removeEventListener("keydown", handleKeyPress);
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  if (loadingHiddenHandler) {
    window.removeEventListener('loadingScreenHidden-scene5', loadingHiddenHandler);
    loadingHiddenHandler = null;
  }
  
  // Nullify handler references
  scene5HandleSwitchClick = null;
  // meshPointerDownHandler = null; // Removed
  // hoverPointerMoveHandler = null; // Removed

  // --- 2. STOP ANIMATION AND SOUND ---
  isSceneTransitioning = false; // Set state
  
  // Stop rendering loop
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (renderer) {
    renderer.setAnimationLoop(null);
  }

  // Stop GSAP
  try {
    if (typeof gsap !== 'undefined') {
      if (gsap.globalTimeline && typeof gsap.globalTimeline.clear === 'function') {
        gsap.globalTimeline.clear();
      }
      if (typeof gsap.killTweensOf === 'function' && camera) {
        // Best-effort: kill common tween targets
        gsap.killTweensOf(camera);
        gsap.killTweensOf(camera.position);
        gsap.killTweensOf(camera.rotation);
      }
    }
  } catch (_) {}

  // Stop audio
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
    backgroundAudio = null;
  }
  cleanupAudioManager();

  // --- 3. CLEAN UP SCENE-SPECIFIC MODULES ---
  if (sceneInitialization?.playerFunction?.player) {
    disablePlayerMovement(sceneInitialization.playerFunction.player);
  }
  cleanupVR();
  cleanupElectro(); // This should handle electro-specific cleanup

  // --- 4. DISPOSE OF THREE.JS ASSETS ---
  
  // Clear VR clickable objects array
  if (vrClickableObjects) {
    vrClickableObjects.length = 0;
    vrClickableObjects = null;
  }

  // Clean up HUD video
  if (hudVideoPlane) {
    if (scene) scene.remove(hudVideoPlane);
    if (hudVideoPlane.geometry) hudVideoPlane.geometry.dispose();
    if (hudVideoPlane.material) {
      if (hudVideoPlane.material.map) hudVideoPlane.material.map.dispose();
      hudVideoPlane.material.dispose();
    }
    hudVideoPlane = null;
  }
  if (hudVideoElement) {
    // Remove listeners from video element to prevent "zombie" events
    hudVideoElement.onended = null;
    hudVideoElement.onerror = null;
    hudVideoElement.onloadeddata = null;
    try { hudVideoElement.pause(); } catch (e) {}
    if (hudVideoElement.parentNode) {
      hudVideoElement.parentNode.removeChild(hudVideoElement);
    }
    hudVideoElement = null;
  }
  
  // Clean up component models and their resources
  COMPONENT_KEYS.forEach(key => {
    // Check if componentModels[key] exists before accessing properties
    const comp = componentModels[key];
    if (comp) {
      if (comp.orbitControls) {
        comp.orbitControls.dispose();
      }
      if (comp.outline) {
        if (comp.outline.geometry) comp.outline.geometry.dispose();
        if (comp.outline.material) comp.outline.material.dispose();
      }
      if (comp.hoveredOutlineMesh) {
        if (comp.hoveredOutlineMesh.geometry) comp.hoveredOutlineMesh.geometry.dispose();
        if (comp.hoveredOutlineMesh.material) comp.hoveredOutlineMesh.material.dispose();
      }
      if (comp.model && scene) {
        scene.remove(comp.model);
        comp.model.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        });
      }
    }
  });
  
  // Reset component models object
  // componentModels = {}; // Clear the object (Handled by componentManager logic if we add a cleanup there, but for now we just cleared the scene objects)
  setFocusedComponentKey(null);

  // Clean up UI panels
  const meshUIPanel = getMeshUIPanel();
  if (meshUIPanel) {
    if (scene) scene.remove(meshUIPanel);
    // meshUIPanel = null; // Handled in uiManager if we add cleanup
  }
  const componentIntroPanel = scene?.children.find(child => child.userData?.isComponentIntroPanel);
  if (componentIntroPanel) {
    if(scene) scene.remove(componentIntroPanel);
  }
  const byteAssemblyPanel = scene?.children.find(child => child.userData?.isByteAssemblyPanel);
  if (byteAssemblyPanel) {
    if(scene) scene.remove(byteAssemblyPanel);
  }

  // Clean up glass plane
  const glassPlane = getGlassPlane();
  if (glassPlane) {
    if (scene) scene.remove(glassPlane);
    if (glassPlane.geometry) glassPlane.geometry.dispose();
    if (glassPlane.material) glassPlane.material.dispose();
    // glassPlane = null; // Handled in componentManager
  }

  // Clean up focus light
  // removeFocusLight(); // Handled in componentManager, but we need to call it if it was exported. 
  // Actually removeFocusLight is in componentManager and it uses local focusLight variable.
  // We should probably export a cleanup function from componentManager.

  // Clean up scene initialization
  if (sceneInitialization) {
    sceneInitialization.cleanUpCollider();
    sceneInitialization = null;
  }

  // Clean up skybox
  if (skybox) {
    if (scene) scene.remove(skybox);
    if (skybox.material) {
      if (skybox.material.map) skybox.material.map.dispose();
      skybox.material.dispose();
    }
    if (skybox.geometry) {
      skybox.geometry.dispose();
    }
    skybox = null;
  }

  // Clean up scene (last)
  if (scene) {
    while (scene.children.length > 0) {
      const obj = scene.children[0];
      if (obj) scene.remove(obj);
    }
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });
  }

  // --- 5. NULLIFY MODULE-LEVEL VARIABLES ---
  
  // Clean up controls
  if (controls) {
    controls.dispose();
  }

  // Clean up DOM elements
  const closeButton = document.getElementById('closeUnoButton');
  if (closeButton) {
    closeButton.remove();
  }
  const fppOverlay = document.getElementById('fpp-overlay-container');
  if (fppOverlay) {
    fppOverlay.remove();
  }

  // Clean up button listeners
  if (startBuildButtonCleanup) {
    startBuildButtonCleanup();
    startBuildButtonCleanup = null;
  }
  if (meshHoverCleanup) {
    meshHoverCleanup();
    meshHoverCleanup = null;
  }
  if (sceneClickCleanup) {
    sceneClickCleanup();
    sceneClickCleanup = null;
  }

  // Nullify all references
  underground = null;
  collisionMesh = null;
  scene = null;
  camera = null; // This now happens *after* listeners are gone
  controls = null;
  skybox = null;
  sceneInitialization = null;
  // meshUIPanel = null;
  // glassPlane = null;
  backgroundAudio = null;

  // Clean up video and material references
  if (scene5Video) {
    try { scene5Video.pause(); } catch (e) {}
    if (scene5Video.parentNode) {
      scene5Video.parentNode.removeChild(scene5Video);
    }
    scene5Video = null;
  }
  if (scene5VideoTexture) {
    scene5VideoTexture.dispose();
    scene5VideoTexture = null;
  }
  if (scene5Material) {
    scene5Material.dispose();
    scene5Material = null;
  }
  if (scene5Clock) {
    scene5Clock = null;
  }

  // Reset module-level state variables
  isComponentIntroSequencePlaying = false;
  isElectroSequencePlaying = false;
  

}

// Store references to panels and skybox for isolation
let panelsToHide = [];
let tempLights = [];

async function markSceneCompleted(sceneKey) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { [`scenesCompleted.${sceneKey}`]: true });
  } catch (e) {
    console.error("Failed to mark scene completed", e);
  }
}