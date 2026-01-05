/**
 * About: `scene6/scene6.js`
 *
 * Main Scene 6 orchestrator.
 * Initializes the 3D lab scene, loads assets, wires UI + lessons, and runs the render/update loop.
 */

"use strict"; // Enable strict mode to catch common errors and enforce safer JavaScript

// Main Scene 6 orchestrator: initializes the 3D lab, lessons, physics, audio,
// and wires together UI, raycasting, shader effects, and Firebase progress.

// Core Three.js library for 3D rendering
import * as THREE from "three";
// OrbitControls lets the user orbit/pan/zoom the camera with mouse/touch
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// Global app data helpers: track current scene and read user info
import { setCurrentScene, getUserInfo } from "../data.js";
// FPS / performance stats overlay from Three.js examples
import Stats from "three/examples/jsm/libs/stats.module.js";
// Debug GUI for tweaking scene parameters
import { createGUI, destroyGUI } from "../commonFiles/guiManager.js";
// VR helpers for initializing / updating / cleaning up WebXR
import { initializeVR, updateVR, cleanupVR } from "../commonFiles/vrManager.js";
// Scene‑level audio manager and play helper
import {
  initializeAudioManager,
  cleanupAudioManager,
  playAudio,
} from "../commonFiles/audiomanager.js";

// Asset loader and registry used to fetch all GLTFs / HDRIs, etc.
import {
  allAssets,
  checkExistingAssets,
  loadAllAsset,
} from "../commonFiles/assetsLoader.js";
// Entry describing which assets belong to scene6
import { assetsEntry as currentEntry } from "./assetsEntry.js";
// Sets up physics world and (hidden) player controller
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer.js";
// Player / collision helpers (some used indirectly via other modules)
import {
  handleCollisions,
  player,
  playerState,
  setCameraAndControls,
 
} from "../commonFiles/playerController.js";
// Helper class for creating JST‑XH female connector pins + wires
import { JstXhFemalePin } from "./JstXhFemalePin.js";
// Raycaster setups for 3D interaction
import { RaycasterSetup1, RaycasterSetup2 } from "./raycasterSetup.js";
// UI + step system imports for instruction flow and buttons
import {
  nextStep,
  prevStep,
  getCurrentStepText,
  getCurrentStep,
  getTotalSteps,
  resetSteps,
  codePlane,
  forwardArrow,
  updateCodePlaneWithInstruction,
  beginBlinkButton,
  setCodePlaneToInstructions,
  setForwardArrowEnabled,
  setLesson,
  showNextLessonButton,
  hideNextLessonButton,
  setOnNextLesson,
  instructionsLabel,
  showInstructionsLabel,
  hideInstructionsLabel,
  isCurrentStepTitle,
  isStepTitle,
  updateNextButtonState,
  removeAllLesson2Models,
  removeAllLesson3Models,
  runCodeButton,
  runCodeButtonL345,
  isLastStep,
  nextLessonButton,
  // Flags for optionally disabling / enabling camera animation
  disableCameraAnimation,
  enableCameraAnimation,
  // Scene6‑specific DOM / pointer event handlers
  setupScene6EventListeners,
  cleanupScene6EventListeners,
} from "./ui.js";
// Celebration VFX/audio when the entire scene is completed
import { celebrateSceneCompletion } from "../commonFiles/sceneCompletionCelebration.js";
// Toggling between player controls and orbit camera
import {
  togglePlayerControls,
  enableCameraControls,
} from "../commonFiles/playerController.js";
// 3D UI library for instruction panels, buttons, etc.
import ThreeMeshUI from "three-mesh-ui";
// GSAP animation library (camera moves, button pulses, etc.)
import { gsap } from "gsap";
// Camera animation / step‑target imports were removed – all lessons now share behavior
import { modelTransforms } from "./modelTransforms.js";
// Specific MeshUI button used in one of the lessons
import { makeSomeNoiseButton } from "./ui.js";
// Lesson‑specific logic (motor driver)
import { KpMotorLesson, updateFunction } from "./MotorLesson.js";
// Lesson‑specific logic (IR sensor)
import { KpIRLesson, updateFunction as irUpdate } from "./IRLesson.js"
// Learning panel UI helpers (open/close, content, etc.)
import { createLearningPanel, showLearningPanel, hideLearningPanel, toggleLearningPanel, updateLearningPanelContent } from "./learning.js";
import { setLearningLesson, nextLearningItem, prevLearningItem, learningPanel } from "./learning.js";

// Utility for cleaning up lesson‑tagged models from the scene
import LessonCleaner from "./utils/lessonCleaner.js"

// Firebase auth + Firestore client
import { auth, db } from "../WebFiles/firebase.js";
import { doc, updateDoc } from "firebase/firestore";
// Tracks that the user has visited a given scene
import { markSceneVisited } from "../data.js";

// Mark a given scene as "completed" in the user's Firestore document
async function markSceneCompleted(sceneKey) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { [`scenesCompleted.${sceneKey}`]: true });
  } catch (e) {
    console.error("Failed to mark scene completed", e);
  }
}

// Import the new shader manager that handles pin highlight / feedback
import { 
  applyStepShader, 
  handleDragStart, 
  handleDragEnd, 
  handleSnap, 
  updateShader, 
  cleanupShader,
  testShaderManager
} from "./shaderManager.js";
// Simple glowing material wrapper used on some highlight targets
import FakeGlowMaterial from "./FakeGlowMaterial.js";
// Cleanup helper for lesson1's RGB circuit
import { cleanupKpRgbLesson } from "./RgbLesson.js";
// Centralized proxy‑based state for scene6 (replaces many window.* globals)
import { scene6State, cleanupScene6State } from "./scene6State.js";

// Exported reference to the Three.js scene so other modules can access it
export let scene = null;
// Main camera, renderer, and controls used throughout this scene
let  camera, renderer, controls;
// requestAnimationFrame id used so we can cancel the render loop on cleanup
let animationFrameId = null;
// Stats.js instance for FPS overlay
let stats;

// True when the camera is driven by OrbitControls instead of the player
let isOrbitMode = false;

// Flag so we only apply the "snap camera to connection" adjustment once
let snapCameraAdjusted = false;

// Track lesson4 "run code" / animation state flags
let lesson4RunCodeClicked = false;
let lesson4CodeAnimationCompleted = false;
let lesson4S7Played = false;

// Single‑instance audio handle so we never have overlapping narration in scene6
let _scene6CurrentAudio = null;

/**
 * Play a named audio clip in scene6 while ensuring only one narration
 * is active at a time. Any currently playing clip is stopped first.
 *
 * @param {string} audioName - Key used by the audio manager (e.g. "lesson1_s1").
 * @param {THREE.Vector3|null} position - Optional 3D position for spatial audio.
 * @param {number|null} radius - Optional audible radius.
 * @returns {*|null} Audio instance returned by the audio manager, if any.
 */
function playScene6Audio(audioName, position = null, radius = null) {
  try {
    // If some previous clip is playing, attempt to stop / reset it first
    if (_scene6CurrentAudio) {
      try {
        if (typeof _scene6CurrentAudio.stop === "function") {
          _scene6CurrentAudio.stop();
        } else if (typeof _scene6CurrentAudio.pause === "function") {
          _scene6CurrentAudio.pause();
          if ("currentTime" in _scene6CurrentAudio) {
            _scene6CurrentAudio.currentTime = 0;
          }
        }
      } catch (e) {}
    }
    // Ask the shared audio manager to play the requested clip
    const instance = playAudio(audioName, position, radius);
    // Track the new instance so we can stop it next time
    _scene6CurrentAudio = instance || null;
    // Clear tracking when this instance ends
    if (instance) {
      try {
        if (typeof instance.addEventListener === "function") {
          instance.addEventListener(
            "ended",
            () => {
              // Only clear if this is still the active clip
              if (_scene6CurrentAudio === instance) _scene6CurrentAudio = null;
            },
            { once: true }
          );
        } else if ("onEnded" in instance) {
          const prevOnEnded = instance.onEnded;
          instance.onEnded = (...args) => {
            try { if (typeof prevOnEnded === "function") prevOnEnded.apply(instance, args); } catch (e) {}
            // Same: only clear if we haven't started another clip
            if (_scene6CurrentAudio === instance) _scene6CurrentAudio = null;
          };
        }
      } catch (e) {}
    }
    return instance;
  } catch (e) {
    // If our wrapper fails, at least still try to play the sound
    return playAudio(audioName, position, radius);
  }
}

/**
 * Helper to guard lesson‑specific setup.
 * Returns true only when the current lesson id is one of the supported scene6 lessons.
 *
 * @returns {boolean} True if the current lesson is one of lesson1–lesson5.
 */
function isAllowedLesson() {
  if (typeof scene6State.getCurrentLesson === "function") {
    const lesson = scene6State.getCurrentLesson();
    return (
      lesson === "lesson1" ||
      lesson === "lesson2" ||
      lesson === "lesson3" ||
      lesson === "lesson4" ||
      lesson === "lesson5"
    );
  }
  return false;
}

/**
 * Entry point for Scene 6.
 * - Configures renderer + camera
 * - Loads all assets
 * - Sets up physics / player and lesson hooks
 * - Initializes audio + base lighting
 *
 * @param {THREE.WebGLRenderer} existingRenderer - Shared renderer provided by the host app.
 * @param {boolean} isVRMode - Flag indicating whether VR mode is enabled for this scene.
 * @returns {Promise<void>} A promise that resolves when the scene has finished initializing.
 */
export async function initializeScene6(existingRenderer, isVRMode) {
  // Tell the global app state that scene6 is now active
  setCurrentScene("scene6");
  // Record that the user has visited this scene at least once
  await markSceneVisited("scene6");
  // Currently unused, but available for per‑user behavior if needed
  const userInfo = getUserInfo();
  // Create and attach FPS stats overlay
  stats = new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);
  // Create a GUI for debug controls and collapse it by default
  const gui = createGUI();
  gui.close();
  // Main perspective camera used for the entire scene
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Expose camera via shared scene6 state for other modules
  scene6State.camera = camera;
  // Use the renderer provided by the host app
  renderer = existingRenderer;
  // Enable soft shadow mapping and physically based lighting
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputEncoding = THREE.sRGBEncoding;
  // Ensure the renderer's canvas is attached to the DOM once
  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }
  // Load all GLTF models / HDRIs / textures defined for scene6
  await loadAllAsset(currentEntry, camera, renderer);
  console.log("[Scene6] Loaded model keys:", Object.keys(allAssets.models.gltf));
  console.log("[Scene6] Battery present:", !!allAssets.models.gltf.battery);
  // Create the Three.js scene that will hold all objects for scene6
  scene = new THREE.Scene();
  // If an HDR environment is available, use it for both lighting and background
  if (allAssets.hdris.sky6) {
    scene.environment = allAssets.hdris.sky6;
    scene.background = allAssets.hdris.sky6;
  }
  // Camera must be part of the scene graph to render correctly
  scene.add(camera);



  // Store the scene reference in the shared state object
  scene6State.currentScene = scene;

  // Setup scene6 event listeners
  setupScene6EventListeners();
  
  // Setup scene6 lesson hook and initialize lesson1
  setupScene6LessonHook();

  // Initialize positional audio system for this scene
  initializeAudioManager(camera, scene);
  let sceneInitialization = null;
  // Root GLTF that contains the room / table / fixed geometry
  const mainModel = allAssets.models.gltf.mainModel;
  if (mainModel) {
    // Log all meshes found for easier debugging of model structure
    mainModel.traverse((child) => {
      if (child.isMesh) {
        console.log("Mesh found in mainModel:", child.name);
      }
    });
   
    // Specifically look for the "screen" mesh so we could attach a texture if desired
    
    // NOTE: previous code attached a canvas texture here; that logic has been removed
    sceneInitialization = initializePhysicsAndPlayer(
      mainModel,
      {
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      [],
      scene,
      camera,
      controls,
      renderer
    );
    // Hide the player avatar model (we don't want a visible character in this scene)
    if (sceneInitialization?.playerFunction?.model) {
      sceneInitialization.playerFunction.model.visible = false;
    }
  }
  window.addEventListener("loadingScreenHidden-scene6", () => {
    console.log("Loading screen hidden - Scene6 is ready!");
   // camera.position.set(0, 2.5, -2);
    // Play narrator intro once the scene is fully ready
    try {
      playScene6Audio("narrator_intro");
    } catch (e) {
      console.warn("Failed to start narrator_intro:", e);
    }
  });
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
// KpMotorLesson(scene,camera)
  if (isAllowedLesson()) {
    const nanoModel = allAssets.models.gltf.nano1;
    if (nanoModel) {
      nanoModel.position.copy(modelTransforms.nano1.position);
      nanoModel.scale.copy(modelTransforms.nano1.scale);
      nanoModel.rotation.copy(modelTransforms.nano1.rotation);
      scene.add(nanoModel);
      scene6State.nanoModel = nanoModel; // Expose for RaycasterSetup
    }
    const expansionBoardModel = allAssets.models.gltf.expansionBoard;
    if (expansionBoardModel) {
      expansionBoardModel.position.copy(
        modelTransforms.expansionBoard.position
      );
      expansionBoardModel.scale.copy(modelTransforms.expansionBoard.scale);
      expansionBoardModel.rotation.copy(
        modelTransforms.expansionBoard.rotation
      );
      scene.add(expansionBoardModel);
      scene6State.expansionBoardModel = expansionBoardModel;
    }
    const rgbLEDModel = allAssets.models.gltf.rgbLEDModule;
    if (rgbLEDModel) {
      rgbLEDModel.position.copy(modelTransforms.rgbLED.position); // Adjust position as needed
      rgbLEDModel.scale.copy(modelTransforms.rgbLED.scale); // Adjust scale as needed
      rgbLEDModel.rotation.copy(modelTransforms.rgbLED.rotation);
      scene.add(rgbLEDModel);
      scene6State.rgbLEDModel = rgbLEDModel; // Store for later use
      
      // Create function to apply blink shader (will be called from code editor)
      scene6State.applyRGBLEDBlinkShader = function() {
        try {
          let blinkShaderApplied = false;
          const childNames = [];
          rgbLEDModel.traverse((child) => {
            if (child.isMesh) {
              console.log("RGB LED child name:", child.name);
              childNames.push(child.name || "<no-name>");
              if (blinkShaderApplied) return; // already applied once, skip others
              
              // Apply to the "rgbled" child specifically
              const targetName = "rgbled";
              const nameMatchesExact = typeof child.name === "string" && child.name === targetName;
              if (nameMatchesExact) {
                // Create a blinking red material
                const blinkMaterial = new THREE.MeshStandardMaterial({
                  color: 0xff0000, // Red color
                  emissive: 0xff0000, // Red emissive for glow effect
                  emissiveIntensity: 0.5,
                  transparent: true,
                  opacity: 1.0,
                  metalness: 0.1,
                  roughness: 0.3,
                });
                
                // Store original material for restoration
                child.userData.originalMaterial = child.material;
                child.material = blinkMaterial;
                
                // Create blink animation
                let blinkTime = 0;
                const blinkSpeed = 2.0; // Blinks per second
                
                // Add blink update function to the child
                child.userData.blinkUpdate = (deltaTime) => {
                  // Check if blinking is active
                  if (child.userData.blinkActive === false) {
                    return; // Don't update if blinking is stopped
                  }
                  
                  const currentSpeed = child.userData.blinkSpeed || blinkSpeed;
                  blinkTime += deltaTime * currentSpeed;
                  const blinkValue = Math.sin(blinkTime * Math.PI * 2) * 0.5 + 0.5; // 0 to 1
                  
                  // Update emissive intensity for blinking effect
                  blinkMaterial.emissiveIntensity = blinkValue * 0.8;
                  
                  // Update opacity for fade effect
                  blinkMaterial.opacity = 0.3 + blinkValue * 0.7;
                  
                  // Update color intensity
                  const intensity = 0.3 + blinkValue * 0.7;
                  blinkMaterial.color.setRGB(intensity, 0, 0);
                  blinkMaterial.emissive.setRGB(intensity * 0.5, 0, 0);
                };
                
                // Initialize blink state
                child.userData.blinkActive = true;
                child.userData.blinkSpeed = blinkSpeed;
                
                // Store reference for animation updates
                scene6State.rgbLEDBlinkMaterial = blinkMaterial;
                scene6State.rgbLEDBlinkMesh = child;
                // Also set on window for backward compatibility
                window.rgbLEDBlinkMaterial = blinkMaterial;
                window.rgbLEDBlinkMesh = child;
                
                blinkShaderApplied = true;
                console.log("Blink shader applied to RGB LED child:", child.name);
              }
            }
          });
          
          if (!blinkShaderApplied) {
            console.warn("RGB LED child 'rgbled' not found. Available child names:", childNames);
          } else {
            console.log("RGB LED blink shader successfully applied");
          }
        } catch (e) {
          console.error("Failed to apply blink shader to RGB LED:", e);
        }
      };
      
      // Also expose on window for backward compatibility
      window.applyRGBLEDBlinkShader = scene6State.applyRGBLEDBlinkShader;
      
      console.log("RGB LED blink shader function created. Call scene6State.applyRGBLEDBlinkShader() or window.applyRGBLEDBlinkShader() to apply it.");
      
    }

    const names = [];
    scene6State.rgbLEDModel?.traverse(c => { if (c.isMesh) names.push(c.name); });
    console.log(names);
    // Load and add the buzzer model
    const buzzerModel = allAssets.models.gltf.buzzer;
    if (buzzerModel) {
      buzzerModel.position.copy(modelTransforms.buzzer.position);
      buzzerModel.scale.copy(modelTransforms.buzzer.scale);
      buzzerModel.rotation.copy(modelTransforms.buzzer.rotation);
      scene.add(buzzerModel);
      scene6State.buzzerModel = buzzerModel;
      buzzerModel.visible = false; // Hide buzzer by default
    }

    // Load and add the temperature sensor model (lesson3)
    const tempSensorModel = allAssets.models.gltf.tempSensor;
    if (tempSensorModel) {
      tempSensorModel.position.copy(modelTransforms.tempSensor.position);
      tempSensorModel.scale.copy(modelTransforms.tempSensor.scale);
      tempSensorModel.rotation.copy(modelTransforms.tempSensor.rotation);
      scene.add(tempSensorModel);
      scene6State.tempSensorModel = tempSensorModel;
      tempSensorModel.visible = false; // Hide temperature sensor by default
    }

    const batteryModel = allAssets.models.gltf.battery;
    console.log("[Scene6] batteryModel fetched:", !!batteryModel);
    if (batteryModel) {
      try {
        batteryModel.position.set(0.8, 1.7, -3.4);
        batteryModel.scale.copy(modelTransforms.battery.scale);
       
        scene.add(batteryModel);
        scene6State.batteryModel = batteryModel;
        batteryModel.visible = true;
        console.log("[Scene6] batteryModel added to scene.");
      } catch (e) {
        console.error("[Scene6] Error adding batteryModel:", e);
      }
    } else {
      console.warn("[Scene6] batteryModel not found in allAssets.models.gltf");
    }

    const jstPinBattery = new JstXhFemalePin(
      {
        pinCount: 2,
        twoSide: false,
        position: new THREE.Vector3(0.8, 1.7, -3.2),
        wireConfigs: [
          {
            startPosition: new THREE.Vector3(0.8, 1.7, -3.3), // Pin 1 (2.54mm pitch)
            color: 0xff0000, // Red
          },
          {
            startPosition: new THREE.Vector3(0.76, 1.7, -3.3), // Pin 2
            color: 0x00ff00, // Green
          }
        ],
        
      },
      scene
    );
    jstPinBattery.group.visible = true;
    scene6State.jstPinBattery = jstPinBattery;
    scene6State.jstPinBatterySide1 = jstPinBattery.pinGLTF1;
   if(jstPinBattery.pinGLTF1){
    jstPinBattery.pinGLTF1.rotation.y = -Math.PI / 2;
    jstPinBattery.updatePosition(new THREE.Vector3(0.8, 1.7, -3.2), jstPinBattery.pinGLTF1);
   }
    
    // Create lesson3 JST pin (for temperature sensor)
    const jstPin3 = new JstXhFemalePin(
      {
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          {
            startPosition: new THREE.Vector3(-0.5, 1.8, -3),
          },
          {
            startPosition: new THREE.Vector3(0, 1.7, -3.05),
          },
        ],
        colors: ["black", "brown", "red"],
      },
      scene
    );
    jstPin3.group.visible = false; // Hide by default
    scene6State.jstPin3 = jstPin3;
    scene6State.jstPin3Side1 = jstPin3.pinGLTF1;
    scene6State.jstPin3Side2 = jstPin3.pinGLTF2;

    if (jstPin3.pinGLTF1 && jstPin3.pinGLTF2) {
      jstPin3.pinGLTF1.rotation.z = Math.PI * 3;
      jstPin3.pinGLTF1.rotation.y = -Math.PI * 3;
      jstPin3.updatePosition(
        new THREE.Vector3(-0.5, 1.8, -3),
        jstPin3.pinGLTF1
      );
      jstPin3.pinGLTF2.rotation.y = -Math.PI * 3;
      jstPin3.pinGLTF2.rotation.z = Math.PI * 3;
      jstPin3.updatePosition(
        new THREE.Vector3(0, 1.8, -3.05),
        jstPin3.pinGLTF2
      );
    }
    const jstPin2 = new JstXhFemalePin(
      {
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          {
            startPosition: new THREE.Vector3(-0.5, 1.8, -3),
          },
          {
            startPosition: new THREE.Vector3(0, 1.7, -3.05),
          },
        ],
        colors: ["black", "brown", "red"],
      },
      scene
    );
    jstPin2.group.visible = false; // Hide by default
    scene6State.jstPin2 = jstPin2;
    scene6State.jstPin2Side1 = jstPin2.pinGLTF1;
    scene6State.jstPin2Side2 = jstPin2.pinGLTF2;
    // State is now managed in scene6State only

    if (jstPin2.pinGLTF1 && jstPin2.pinGLTF2) {
      scene6State.secondPin4Female = jstPin2.pinGLTF1; // Set initially to pinGLTF1
      jstPin2.pinGLTF1.rotation.z = Math.PI * 3;
      jstPin2.pinGLTF1.rotation.y = -Math.PI * 3;
      jstPin2.updatePosition(
        new THREE.Vector3(-0.5, 1.8, -3),
        jstPin2.pinGLTF1
      );
      // Update secondPin4Female to pinGLTF2 (this is the final value used)
      scene6State.secondPin4Female = jstPin2.pinGLTF2; // Update to pinGLTF2
      jstPin2.pinGLTF2.rotation.y = -Math.PI * 3;
      jstPin2.pinGLTF2.rotation.z = Math.PI * 3;
      jstPin2.updatePosition(
        new THREE.Vector3(0, 1.8, -3.05),
        jstPin2.pinGLTF2
      );
    }
    
    // Refresh the raycaster pin models reference to include the newly created lesson2 JST pins
    if (scene6State.raycasterSetup && typeof scene6State.raycasterSetup.refreshPinModelsRef === 'function') {
      scene6State.raycasterSetup.refreshPinModelsRef();
      console.log("[Scene6] Refreshed raycaster pin models reference after creating lesson2 JST pins");
    }
    
    const jstPin = new JstXhFemalePin(
      {
        pinCount: 4,
        twoSide: true,
        jstPinConfig: [
          {
            startPosition: new THREE.Vector3(0.5, 1.8, -3),
          },
          {
            startPosition: new THREE.Vector3(0, 1.8, -3),
          },
        ],
      },
      scene
    );
    scene6State.jstPin = jstPin;
    
    // Ensure the JST pin starts at the correct position for shader application
    if (jstPin.pinGLTF1) {
      jstPin.updatePosition(new THREE.Vector3(0.5, 1.8, -3), jstPin.pinGLTF1);
    }
    
    // Expose the second pin4Female for snapping
    if (jstPin.pinGLTF2) {
      scene6State.secondPin4Female = jstPin.pinGLTF2;
      jstPin.pinGLTF2.rotation.z = -Math.PI * 2;
      jstPin.updatePosition(new THREE.Vector3(0, 1.8, -3), jstPin.pinGLTF2);
    }
  }

  // Fallback: ensure battery is added even if lesson gate prevented the above block
  if (!scene6State.batteryModel && allAssets.models.gltf.battery) {
    try {
      const batteryModelFallback = allAssets.models.gltf.battery;
      batteryModelFallback.position.set(-0.5, 1.8, -3.1);
      scene.add(batteryModelFallback);
      scene6State.batteryModel = batteryModelFallback;
      batteryModelFallback.visible = true;
      console.log("[Scene6] batteryModel added via fallback.");
    } catch (e) {
      console.error("[Scene6] Error adding batteryModel (fallback):", e);
    }
  }

  // Create the instruction UI group
  let codeEditorGroup = null;
  codeEditorGroup = new THREE.Group();
  scene.add(codeEditorGroup);
  scene.add(codePlane);
  codePlane.position.set(0.2, 2.5, -4.01);
  codeEditorGroup.add(codePlane);

  // Add instructions label to scene and group
  scene.add(instructionsLabel);
  codeEditorGroup.add(instructionsLabel);

  scene6State.codeEditorGroup = codeEditorGroup;

  // Set initial instruction text
  if (typeof setCodePlaneToInstructions === "function") {
    setCodePlaneToInstructions();
  }

  scene.add(forwardArrow);
  codeEditorGroup.add(forwardArrow);

  scene.add(runCodeButton);
  scene.add(runCodeButtonL345);
  scene6State.runCodeButton = runCodeButton;
  scene6State.runCodeButtonL345 = runCodeButtonL345;
  // Ensure the Next Lesson button is part of the scene/UI group so it can be shown when requested
  scene.add(nextLessonButton);
  codeEditorGroup.add(nextLessonButton);
  // Expose next lesson controls so other modules can trigger them
  scene6State.showNextLessonButton = showNextLessonButton;
  scene6State.hideNextLessonButton = hideNextLessonButton;
  scene6State.nextLessonButton = nextLessonButton;
  // Also expose on window for backward compatibility
  scene6State.showNextLessonButton = showNextLessonButton;
  scene6State.hideNextLessonButton = hideNextLessonButton;
  scene6State.nextLessonButton = nextLessonButton;
  scene6State.codeEditorGroup = codeEditorGroup;
  // const { emptyPanel, rgbPinContainer, buttons, buttonGroup, handleButtonClick, continueButton } = createCodeEditorPanel(scene, gui, camera);
  // Add raycast handler for Run Code button to animate camera and trigger blink effect
  if (!scene6State._runCodeRaycastHandler) {
    scene6State._runCodeRaycastHandler = (event) => {
      if (!camera) return;
      
      // Check which button is visible (runCodeButton or runCodeButtonL345)
      const activeButton = (runCodeButtonL345 && runCodeButtonL345.visible) ? runCodeButtonL345 : 
                          (runCodeButton && runCodeButton.visible) ? runCodeButton : null;
      
      if (!activeButton) return;
      
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([activeButton], true);
      if (intersects.length > 0) {
        // Show code editor only when Start Coding is clicked
        try {
          if (typeof scene6State.showCodeEditorPanels === 'function') scene6State.showCodeEditorPanels();
          else {
            if (emptyPanel) emptyPanel.visible = true;
            if (rgbPinContainer) rgbPinContainer.visible = true;
            
          }
        } catch (e) {}
        // Handle lesson1 Start Coding button click
        if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson1') {
          console.log('[Lesson1] Start Coding button clicked!');
          
          // Hide the Start Coding button after click
          try {
            runCodeButton.userData.clickable = false;
            runCodeButton.visible = false;
            if (runCodeButton.parent) {
              runCodeButton.parent.remove(runCodeButton);
            }
            console.log('[Lesson1] Start Coding button hidden');
          } catch (e) {
            console.warn('[Lesson1] Error hiding Start Coding button:', e);
          }
          
          createLearningPanel(scene);
          showLearningPanel();
          // Ensure we set the correct lesson after transition
          setTimeout(() => {
            try { setLearningLesson(typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : 'lesson1'); } catch (e) {}
          }, 100);
          // Hide instruction panel when learning panel opens
          try {
            if (scene6State.codePlane) scene6State.codePlane.visible = false;
            if (typeof hideInstructionsLabel === 'function') hideInstructionsLabel();
          } catch (e) {}
          try {
            if (typeof setForwardArrowEnabled === 'function') setForwardArrowEnabled(true);
            if (typeof forwardArrow !== 'undefined' && forwardArrow) forwardArrow.visible = false;
          } catch (e) {}
          
          // Desired camera move and look target for lesson1
          // const targetPos  = new THREE.Vector3(
          //   scene6State.lesson1CameraGUI?.targetPos?.x ?? 6,
          //   scene6State.lesson1CameraGUI?.targetPos?.y ?? 2.0,
          //   scene6State.lesson1CameraGUI?.targetPos?.z ?? 4
          // );
          // const targetLook = new THREE.Vector3(
          //   scene6State.lesson1CameraGUI?.targetLook?.x ?? 6,
          //   scene6State.lesson1CameraGUI?.targetLook?.y ?? 2.25,
          //   scene6State.lesson1CameraGUI?.targetLook?.z ?? 4
          // );

          // Animate camera position while looking at targetLook
          // gsap.to(camera.position, {
          //   x: targetPos.x,
          //   y: targetPos.y,
          //   z: targetPos.z,
          //   duration: window.lesson1CameraGUI?.duration ?? 2,
          //   ease: "power2.inOut",
          //   onUpdate: () => {
          //     camera.lookAt(targetLook);
          //   },
          //   onComplete: () => {
          //     camera.lookAt(targetLook);

          //     // Hide the Start Coding button after click
          //     try {
          //       runCodeButton.userData.clickable = false;
          //       runCodeButton.visible = false;
          //       if (runCodeButton.parent) {
          //         runCodeButton.parent.remove(runCodeButton);
          //       }
          //     } catch (e) {}

          //     // Show the Next button to proceed to the final step
          //     if (window.setForwardArrowEnabled) { 
          //       window.setForwardArrowEnabled(true);
          //     }
          //     if (window.forwardArrow) {
          //       window.forwardArrow.visible = true;
          //     }

          //     console.log('[Lesson1] Camera move complete');
          //   }
          // });

          return; // Exit early for lesson1
        }
        
        // Handle lesson3 Start Coding button click WITHOUT camera animation
        if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson3') {
          console.log('[Lesson3] Start Coding button clicked! (no camera animation)');

          // Show learning panel for lesson3
          try {
            createLearningPanel(scene);
            showLearningPanel();
            try { setLearningLesson(typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : 'lesson3'); } catch (e) {}
            // Hide instruction panel when learning panel opens
            try {
              if (scene6State.codePlane) scene6State.codePlane.visible = false;
              if (typeof hideInstructionsLabel === 'function') hideInstructionsLabel();
            } catch (e) {}
          } catch (e) { console.warn('[Lesson3] Error preparing learning panel:', e); }

          // Hide the Start Coding button after click (handle both buttons)
          try {
            const buttonToHide = (runCodeButtonL345 && runCodeButtonL345.visible) ? runCodeButtonL345 : runCodeButton;
            if (buttonToHide) {
              buttonToHide.userData.clickable = false;
              buttonToHide.visible = false;
              if (buttonToHide.parent) {
                buttonToHide.parent.remove(buttonToHide);
              }
            }
          } catch (e) {}

          // Hide the instruction steps panel (code editor group and forward arrow)
          try { if (scene6State.codeEditorGroup) scene6State.codeEditorGroup.visible = false; } catch (e) {}
          if (scene6State.setForwardArrowEnabled) {
            scene6State.setForwardArrowEnabled(false);
          }
          if (scene6State.forwardArrow) {
            scene6State.forwardArrow.visible = false;
          }

          return; // Exit early for lesson3 (skip camera animation)
        }
        
        // Handle lesson2 Start Learning button click (similar to lesson1)
        if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson2') {
          console.log('[Lesson2] Start Learning button clicked!');

          // Hide the Start Learning button after click - make it invisible
          try {
            runCodeButton.userData.clickable = false;
            runCodeButton.visible = false;
            // Also hide all children to ensure complete invisibility
            runCodeButton.traverse((child) => {
              if (child.isMesh) {
                child.visible = false;
                child.userData.clickable = false;
              }
            });
            if (runCodeButton.parent) {
              runCodeButton.parent.remove(runCodeButton);
            }
            console.log('[Lesson2] Start Learning button hidden and made invisible');
          } catch (e) {
            console.warn('[Lesson2] Error hiding Start Learning button:', e);
          }

          // Ensure Next Lesson button is hidden for lesson2
          try {
            if (typeof hideNextLessonButton === "function") {
              hideNextLessonButton();
            } else if (typeof window.hideNextLessonButton === "function") {
              window.hideNextLessonButton();
            }
            if (nextLessonButton) {
              nextLessonButton.visible = false;
              nextLessonButton.userData.clickable = false;
            }
            console.log('[Lesson2] Next Lesson button hidden');
          } catch (e) {
            console.warn('[Lesson2] Error hiding Next Lesson button:', e);
          }

          // Show learning panel for lesson2
          try {
            createLearningPanel(scene);
            showLearningPanel();
            // Ensure we set the correct lesson after transition
            setTimeout(() => {
              try { setLearningLesson(typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : 'lesson2'); } catch (e) {}
            }, 100);
            // Hide instruction panel when learning panel opens
            try {
              if (scene6State.codePlane) scene6State.codePlane.visible = false;
              if (typeof hideInstructionsLabel === 'function') hideInstructionsLabel();
            } catch (e) {}
          } catch (e) { console.warn('[Lesson2] Error preparing learning panel:', e); }

          // Hide the instruction steps panel (code editor group and forward arrow)
          try { if (scene6State.codeEditorGroup) scene6State.codeEditorGroup.visible = false; } catch (e) {}
          if (scene6State.setForwardArrowEnabled) {
            scene6State.setForwardArrowEnabled(false);
          }
          if (scene6State.forwardArrow) {
            scene6State.forwardArrow.visible = false;
          }

          return; // Exit early for lesson2 (skip camera animation)
        }
        
        // Handle lesson4 Start Coding button click WITHOUT camera animation
        if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson4') {
          console.log('[Lesson4] Start Coding button clicked! (no camera animation)');
          
          // Set flag to track that lesson4 run code button was clicked
          lesson4RunCodeClicked = true;
          // Also set the scene6State flag for learning system
          scene6State.lesson4RunCodeClicked = true;
          console.log('[Lesson4] Run code button clicked, lesson4RunCodeClicked set to:', scene6State.lesson4RunCodeClicked);

          // Show learning panel for lesson4
          try {
            createLearningPanel(scene);
            showLearningPanel();
            const lessonToSet = typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : 'lesson4';
            console.log('[Lesson4] Setting learning lesson to:', lessonToSet);
            try { setLearningLesson(lessonToSet); } catch (e) { console.error('[Lesson4] Error setting learning lesson:', e); }
            // Hide instruction panel when learning panel opens
            try {
              if (scene6State.codePlane) scene6State.codePlane.visible = false;
              if (typeof hideInstructionsLabel === 'function') hideInstructionsLabel();
            } catch (e) {}
          } catch (e) { console.warn('[Lesson4] Error preparing learning panel:', e); }

          // Hide the Start Coding button after click (handle both buttons)
          try {
            const buttonToHide = (runCodeButtonL345 && runCodeButtonL345.visible) ? runCodeButtonL345 : runCodeButton;
            if (buttonToHide) {
              buttonToHide.userData.clickable = false;
              buttonToHide.visible = false;
              if (buttonToHide.parent) {
                buttonToHide.parent.remove(buttonToHide);
              }
            }
          } catch (e) {}

          // Hide the instruction steps panel (code editor group and forward arrow)
          try { if (scene6State.codeEditorGroup) scene6State.codeEditorGroup.visible = false; } catch (e) {}
          if (scene6State.setForwardArrowEnabled) {
            scene6State.setForwardArrowEnabled(false);
          }
          if (scene6State.forwardArrow) {
            scene6State.forwardArrow.visible = false;
          }

          // Ensure OrbitControls are enabled for interaction in lesson4
          try { if (togglePlayerControls) togglePlayerControls(false); } catch (e) {}
          try { if (enableCameraControls) enableCameraControls(); } catch (e) {}
          try { isOrbitMode = true; } catch (e) {}

          return; // Exit early for lesson4 (skip camera animation)
        }
        
        // Handle lesson5 Start Coding button click WITHOUT camera animation (like lessons 2/3)
        if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson5') {
          console.log('[Lesson5] Start Coding button clicked! (no camera animation)');

          // Show learning panel for lesson5
          try {
            createLearningPanel(scene);
            showLearningPanel();
            try { setLearningLesson(typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : 'lesson5'); } catch (e) {}
            // Hide instruction panel when learning panel opens
            try {
              if (scene6State.codePlane) scene6State.codePlane.visible = false;
              if (typeof hideInstructionsLabel === 'function') hideInstructionsLabel();
            } catch (e) {}
          } catch (e) { console.warn('[Lesson5] Error preparing learning panel:', e); }

          // Hide the Start Coding button after click (handle both buttons)
          try {
            const buttonToHide = (runCodeButtonL345 && runCodeButtonL345.visible) ? runCodeButtonL345 : runCodeButton;
            if (buttonToHide) {
              buttonToHide.userData.clickable = false;
              buttonToHide.visible = false;
              if (buttonToHide.parent) {
                buttonToHide.parent.remove(buttonToHide);
              }
            }
          } catch (e) {}

          // Hide the instruction steps panel (code editor group and forward arrow)
          try { if (scene6State.codeEditorGroup) scene6State.codeEditorGroup.visible = false; } catch (e) {}
          if (scene6State.setForwardArrowEnabled) {
            scene6State.setForwardArrowEnabled(false);
          }
          if (scene6State.forwardArrow) {
            scene6State.forwardArrow.visible = false;
          }

          return; // Exit early for lesson5 (skip camera animation)
        }
        
        // Original logic for other lessons - also disable controls and animate camera position + look
        if (controls) {
          controls.enabled = false;
          // Remove all OrbitControls limits for post-animation use
          controls.minDistance = 0;
          controls.maxDistance = Infinity;
          controls.minAzimuthAngle = -Infinity;
          controls.maxAzimuthAngle = Infinity;
          controls.minPolarAngle = 0;
          controls.maxPolarAngle = Math.PI;
          controls.enablePan = true;
          controls.enableZoom = true;
          console.log('[StartCoding] Orbit controls disabled and limits cleared');
        }

        (function(){
          const targetLook = new THREE.Vector3(-2.5, 2.25, -2.3);
          const targetPos = new THREE.Vector3(-1.2, 2.0, -1.0);
          gsap.to(camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 2,
            ease: "power2.inOut",
            onUpdate: () => {
              // Camera lookAt removed - all lessons now have consistent camera behavior
            },
            onComplete: () => {
              // Camera lookAt removed - all lessons now have consistent camera behavior
            }
          });
        })();
        
        // Remove/hide the Start Coding button after click
        try {
          runCodeButton.userData.clickable = false;
          runCodeButton.visible = false;
          if (runCodeButton.parent) {
            runCodeButton.parent.remove(runCodeButton);
          }
        } catch (e) {}
        
        // Note: Shader effects are now handled by the shader manager
        // The shader manager will automatically handle any special effects needed
      }
    };
    window.addEventListener("pointerdown", scene6State._runCodeRaycastHandler);
  }
  // Expose forwardArrow globally for snap logic
  scene6State.forwardArrow = forwardArrow;
  scene6State.setForwardArrowEnabled = setForwardArrowEnabled;
  scene6State.getCurrentStep = getCurrentStep;
  //window.continueButton = continueButton;
  // Update Next button state based on current step (instead of always enabling)
  updateNextButtonState();

  // Position the MeshUI Next/Prev buttons below the instruction MeshUI
  const buttonY = 2.1;
  const buttonZ = -4.01;
  const buttonOffsetX = 0.7;
  forwardArrow.position.set(0.2 + buttonOffsetX, buttonY, buttonZ); // Right side below
  // backwardArrow.position.set(0.2 - buttonOffsetX, buttonY, buttonZ); // Removed backwardArrow

  // Add click handlers for codePlane (Begin the Blink button)
  if (!scene6State._codeEditorRaycastHandler) {
    let blinkStarted = false;
    scene6State._codeEditorRaycastHandler = (event) => {
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Get all objects in the codeEditorGroup
      const codeEditorObjects = [];
      codeEditorGroup.traverse((child) => {
        // Accept MeshUI blocks and meshes for raycasting
        if (child.isMesh || child.isUI) {
          codeEditorObjects.push(child);
        }
      });
      // Add codePlane itself if not already in the group
      if (!codeEditorObjects.includes(codePlane)) {
        codeEditorObjects.push(codePlane);
      }
      // Add arrows if not already in the group
      if (!codeEditorObjects.includes(forwardArrow)) {
        codeEditorObjects.push(forwardArrow);
      }
      // Add instructions label if not already in the group
      if (!codeEditorObjects.includes(instructionsLabel)) {
        codeEditorObjects.push(instructionsLabel);
      }

      const intersects = raycaster.intersectObjects(codeEditorObjects, true);
      if (intersects.length > 0) {
        let clicked = null;
        for (const intersect of intersects) {
          // Always resolve to the parentButton for MeshUI blocks
          const button =
            intersect.object.userData && intersect.object.userData.parentButton
              ? intersect.object.userData.parentButton
              : intersect.object;
          if (button === forwardArrow) {
            clicked = forwardArrow;
            break;
          }

          if (button === codePlane) {
            clicked = codePlane;
            // Don't break; keep looking for arrows first!
          }
        }
        if (clicked === forwardArrow && event.type === "pointerdown") {
          // Prevent Next button click if not enabled
          if (!forwardArrow.userData.clickable) return;
          // Prevent camera animation if code editor is open
          if (scene6State.cameraAnimationDisabled) return;

          // Advance learning panel content if visible and consume the click
          try {
            if (learningPanel && learningPanel.visible && typeof nextLearningItem === 'function') {
              nextLearningItem();
              return;
            }
          } catch (e) {}

          // Handle forward arrow click specifically
          if (
            typeof setForwardArrowEnabled === "function" &&
            getCurrentStep() < getTotalSteps() - 1
          ) {
            setForwardArrowEnabled(false);
          }

          // Handle first click (initial setup)
          if (getCurrentStep() === 0 && !blinkStarted) {
            blinkStarted = true;
            if (togglePlayerControls) {
              togglePlayerControls(false);
            }
            if (enableCameraControls) {
              enableCameraControls();
            }
            isOrbitMode = true;
            
            // DON'T enable orbit controls yet - wait for text reveal to complete
            // if (window.orbitControls) {
            //   window.orbitControls.enabled = true;
            // }

            // Skip camera positioning/aiming – OrbitControls will manage view

            // 4. Typewriter effect for first step text
            const fullText = getCurrentStepText();
            const words = fullText.split(" ");
            let currentWord = 0;
            const revealSpeed = 450; // ms per word
            // Play lesson1 step 1 narration when reveal starts
            try {
              const isLesson1 = typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson1';
              if (isLesson1 && getCurrentStep() === 0) {
                playScene6Audio("lesson1_s1");
              }
            } catch (e) {
              console.warn("Failed to play lesson1 step 1 audio:", e);
            }
            // Clear the codePlane text before starting the typewriter effect
            updateCodePlaneWithInstruction("");
            // Disable Next button during typewriter effect for first step
            if (
              typeof setForwardArrowEnabled === "function" &&
              getCurrentStep() === 0
            ) {
              setForwardArrowEnabled(false);
            }
            function revealText() {
              currentWord++;
              const partial = words.slice(0, currentWord).join(" ");
              updateCodePlaneWithInstruction(partial);
              if (currentWord < words.length) {
                setTimeout(revealText, revealSpeed);
              } else {
                // DON'T enable orbit controls after step 0 text reveal - wait until step 1
                // if (window.orbitControls) {
                //   window.orbitControls.enabled = true;
                //   console.log('OrbitControls enabled after text reveal completes');
                // }
                
                // Show the Begin the Blink button below the instruction
                codeEditorGroup.add(beginBlinkButton);
                beginBlinkButton.visible = true;
                // Animate the button to blink (pulse opacity)
                if (beginBlinkButton.material) {
                  // For MeshUI, the material is on the children
                  beginBlinkButton.traverse((child) => {
                    if (child.material) {
                      gsap.to(child.material, {
                        opacity: 0.4,
                        duration: 0.6,
                        yoyo: true,
                        repeat: -1,
                        ease: "power1.inOut",
                        repeatRefresh: true,
                        onRepeat: function () {
                          // Optionally, you can randomize or alternate color here
                        },
                      });
                    }
                  });
                }
                // Set up a handler for clicking the button
                scene6State._beginBlinkRaycastHandler = (event) => {
                  const mouse = new THREE.Vector2(
                    (event.clientX / window.innerWidth) * 2 - 1,
                    -(event.clientY / window.innerHeight) * 2 + 1
                  );
                  const raycaster = new THREE.Raycaster();
                  raycaster.setFromCamera(mouse, camera);
                  const intersects = raycaster.intersectObjects(
                    [beginBlinkButton],
                    true
                  );
                  if (intersects.length > 0) {
                    console.log('Begin Blink button clicked! Applying shader...');
                    
                    // Apply shader to JST pin using the new shader manager
                    const currentLesson = typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson() : "lesson1";
                    const currentStep = typeof getCurrentStep === "function" ? getCurrentStep() : 0;
                    console.log('Applying shader for lesson:', currentLesson, 'step:', currentStep);
                    applyStepShader(currentLesson, currentStep);
                    
                    // Skip camera animation – OrbitControls will manage view
                    // Hide the button and remove the handler
                    beginBlinkButton.visible = false;
                    codeEditorGroup.remove(beginBlinkButton);
                    window.removeEventListener(
                      "pointerdown",
                      scene6State._beginBlinkRaycastHandler
                    );
                    scene6State._beginBlinkRaycastHandler = null;
                    // When the button is clicked and hidden, stop the animation and restore opacity
                    beginBlinkButton.traverse((child) => {
                      if (child.material) {
                        gsap.killTweensOf(child.material);
                        child.material.opacity = 0.85; // Restore default opacity
                      }
                    });
                  }
                };
                  window.addEventListener(
                    "pointerdown",
                    scene6State._beginBlinkRaycastHandler
                  );
              }
            }
            revealText();
            return; // Exit early for first click
          }

          // If on last step, show learning panel with quiz button for lesson2, or Next Lesson button for other lessons
          const currentStep = getCurrentStep();
          const totalSteps = getTotalSteps();
          const isLastStep = currentStep === totalSteps - 1;
          const currentLesson = typeof scene6State.getCurrentLesson === "function" 
            ? scene6State.getCurrentLesson() 
            : (typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson() : "lesson1");
          
          if (isLastStep && currentLesson === 'lesson2') {
            // For lesson2, show Start Learning button (like lesson1 shows Start Coding button)
            console.log(`[Lesson2] Last step - showing Start Learning button`);
            if (forwardArrow) {
              forwardArrow.visible = false;
            }
            // Show Start Learning button (runCodeButton)
            if (runCodeButton) {
              if (scene && !scene.children.includes(runCodeButton)) scene.add(runCodeButton);
              runCodeButton.userData.clickable = true;
              runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
              runCodeButton.visible = true;
              if (typeof runCodeButton.update === 'function') runCodeButton.update();
              console.log("[Lesson2] Start Learning button shown");
            }
            return;
          } else if (isLastStep && getCurrentStepText && getCurrentStepText().length > 0) {
            // For other lessons (not lesson2), show Next Lesson button
            // lesson2 should never show Next Lesson button - it shows Start Learning button instead
            if (currentLesson !== 'lesson2') {
              console.log(`[Next Lesson Button] Showing Next Lesson button for ${currentLesson} at step ${currentStep} (last step)`);
              if (typeof showNextLessonButton === "function") {
                showNextLessonButton();
              } else {
                console.warn("[Next Lesson Button] showNextLessonButton function not available");
              }
              // Optionally hide forward arrow when Next Lesson is visible
              if (forwardArrow) {
                forwardArrow.visible = false;
              }
            } else {
              console.log(`[Next Lesson Button] Skipping Next Lesson button for lesson2 - Start Learning button is used instead`);
            }
            return;
          } else if (isLastStep) {
            console.log(`[Next Lesson Button] On last step but step text is empty. Step: ${currentStep}, Lesson: ${currentLesson}`);
            // Don't show Next Lesson button for lesson2 even if step text is empty
            if (currentLesson === 'lesson2') {
              console.log(`[Next Lesson Button] Skipping Next Lesson button for lesson2 - Start Learning button is used instead`);
            }
          }
          // In lesson4, ensure lesson3 JST pin stays hidden when advancing steps
          try {
            if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson4') {
              if (scene6State.jstPin3 && scene6State.jstPin3.group) scene6State.jstPin3.group.visible = false;
            }
          } catch (e) {}
          // Remove manual visibility setting - updateCodePlaneWithInstruction handles this now
          nextStep();
          // Prepare button visibility will be handled after reveal completes
          
          // Ensure Make Some Noise stays hidden at the start of lesson2 step 1 reveal
          try {
            const isLesson2 = typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson2';
            const stepNow = typeof getCurrentStep === 'function' ? getCurrentStep() : -1;
            if (isLesson2 && stepNow === 1) {
              if (scene && !scene.children.includes(makeSomeNoiseButton)) {
                scene.add(makeSomeNoiseButton);
              }
              makeSomeNoiseButton.visible = false;
            }
          } catch (e) {}
          
          // Start typewriter effect for the new step immediately
          const fullText = getCurrentStepText();
          const words = fullText.split(" ");
          let currentWord = 0;
          const revealSpeed = 250;
          // Play lesson1 step narration when reveal starts (steps 2-4)
          try {
            const isLesson1 = typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson1';
            if (isLesson1 && getCurrentStep() === 1) {
              playScene6Audio("lesson1_s2");
            } else if (isLesson1 && getCurrentStep() === 2) {
              playScene6Audio("lesson1_s3");
            } else if (isLesson1 && getCurrentStep() === 3) {
              playScene6Audio("lesson1_s4");
            }
          } catch (e) {
            console.warn("Failed to play lesson1 step 2 audio:", e);
          }
          function revealTextStep() {
            currentWord++;
            const partial = words.slice(0, currentWord).join(" ");
            updateCodePlaneWithInstruction(partial);
            if (currentWord < words.length) {
              setTimeout(revealTextStep, revealSpeed);
            } else {
              // Handle lesson4 specially - allow camera animation but skip shader application
              try {
                const currentLessonName = typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : 'lesson1';
                if (currentLessonName === 'lesson4') {
                  // For lesson4, allow camera animation but skip shader application
                  // Camera animation removed - all lessons now have consistent camera behavior
                  const stepIndex = getCurrentStep();
                  // Show content immediately without camera animation
                  setTimeout(() => {
                    showContentAfterCameraAnimation(currentLessonName, stepIndex);
                  }, 1000);
                  return; // Skip the rest of the camera animation logic for lesson4
                }
              } catch (e) {}
              // Animate camera for this step, except for lesson2, step 1 and last step
              const stepIndex = getCurrentStep();
              const isLesson2Step1 =
                typeof scene6State.getCurrentLesson === "function" &&
                scene6State.getCurrentLesson() === "lesson2" &&
                stepIndex === 1;
              //const isLastStepOfLesson = typeof isLastStep === "function" ? isLastStep() : (stepIndex === (typeof getTotalSteps === "function" ? getTotalSteps() : 0) - 1);
              
              // After the reveal completes, show the Make Some Noise button only for lesson2 step 1
              // if (isLesson2Step1) {
              //   if (!scene.children.includes(makeSomeNoiseButton)) {
              //     scene.add(makeSomeNoiseButton);
              //   }
              //   makeSomeNoiseButton.visible = false;
              // }

              const currentLesson = typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson() : "lesson1";
              // If not step 0, apply shader after reveal (no camera animation)
              const shouldApplyShader = stepIndex !== 0;

              // Apply shader immediately without camera animation
              if (shouldApplyShader) {
                applyStepShader(currentLesson, stepIndex);
              }
              
              // Skip camera lookAt for steps – OrbitControls will manage view
              
              // Enable orbit controls after step reveal (only for step 1 and onwards)
              if (scene6State.orbitControls && stepIndex >= 1) {
                scene6State.orbitControls.enabled = true;
                console.log('OrbitControls enabled after step', stepIndex, 'reveal');
              }
              
              // Show content after a delay to ensure typewriter effect completes
              setTimeout(() => {
                showContentAfterCameraAnimation(currentLesson, stepIndex);
              }, 1000);
            }
          }
          revealTextStep();
        }
        // REMOVED: No more codePlane click handler
        // All interactions now go through the forward arrow button
      }
    };
    window.addEventListener("pointerdown", scene6State._codeEditorRaycastHandler);
  }

  // Instantiate RaycasterSetup1 for lesson1, lesson2, lesson3, and lesson4
  if (
    typeof scene6State.getCurrentLesson === "function" &&
    (scene6State.getCurrentLesson() === "lesson1" ||
      scene6State.getCurrentLesson() === "lesson2" ||
      scene6State.getCurrentLesson() === "lesson3" ||
      scene6State.getCurrentLesson() === "lesson4")
  ) {
    // Replace RaycasterSetup instantiation with callback for snap events
    const raycasterSetup = new RaycasterSetup1(
      scene,
      camera,
      controls,
      (snapType) => {
        if (snapType === "secondPin4Female") {
          // Keep orbit controls enabled for interaction
          if (scene6State.orbitControls && getCurrentStep() >= 1) {
            // Don't disable controls - keep them enabled
            scene6State.orbitControls.enabled = true;
            console.log('OrbitControls kept enabled for secondPin4Female snap');
          }
          if (scene6State.setForwardArrowEnabled) {
            scene6State.setForwardArrowEnabled(true);
          }
          
          // Handle RGB LED rotation after JST pin snap
          if (scene6State.rgbLEDModel) {
            console.log("RGB LED rotation triggered by JST pin snap");
          }
        }
        
        if (snapType === "jstPinBattery") {
          // Keep orbit controls enabled for interaction
          if (scene6State.orbitControls && getCurrentStep() >= 1) {
            // Don't disable controls - keep them enabled
            scene6State.orbitControls.enabled = true;
            console.log('OrbitControls kept enabled for jstPinBattery snap');
          }
          
          // Handle lesson-specific logic without camera animation
          if (scene6State.getCurrentLesson && scene6State.getCurrentLesson() === 'lesson2') {
            const currentStep = typeof getCurrentStep === 'function' ? getCurrentStep() : -1;
            const totalSteps = typeof getTotalSteps === 'function' ? getTotalSteps() : 0;
            const isLastStep = currentStep === totalSteps - 1;
            
            if (isLastStep) {
              // On last step, show Start Learning button (like lesson1 shows Start Coding button)
              console.log('[jstPinBattery Snap] Last step of lesson2 - showing Start Learning button');
              if (scene6State.setForwardArrowEnabled) scene6State.setForwardArrowEnabled(false);
              if (scene6State.forwardArrow) scene6State.forwardArrow.visible = false;
              
              // Show Start Learning button (runCodeButton)
              if (runCodeButton) {
                if (scene && !scene.children.includes(runCodeButton)) scene.add(runCodeButton);
                runCodeButton.userData.clickable = true;
                runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
                runCodeButton.visible = true;
                if (typeof runCodeButton.update === 'function') runCodeButton.update();
                console.log('[jstPinBattery Snap] Start Learning button shown for lesson2');
              }
              
              // lesson2_s8 audio removed - no longer playing
            } else {
              // Not last step, show Start Coding button (for other steps if needed)
              if (scene6State.setForwardArrowEnabled) scene6State.setForwardArrowEnabled(false);
              if (scene6State.forwardArrow) scene6State.forwardArrow.visible = false;
              
              // Show Start Coding button
              if (runCodeButton) {
                if (scene && !scene.children.includes(runCodeButton)) scene.add(runCodeButton);
                runCodeButton.userData.clickable = true;
                runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
                runCodeButton.visible = true;
                if (typeof runCodeButton.update === 'function') runCodeButton.update();
              }
            }
          } else if (scene6State.getCurrentLesson && scene6State.getCurrentLesson() === 'lesson3') {
            // Similar logic for lesson3 without camera animation
            if (runCodeButton) {
              if (scene && !scene.children.includes(runCodeButton)) scene.add(runCodeButton);
              runCodeButton.userData.clickable = true;
              runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
              runCodeButton.visible = true;
              if (typeof runCodeButton.update === 'function') runCodeButton.update();
            }
            if (scene6State.setForwardArrowEnabled) scene6State.setForwardArrowEnabled(false);
            if (scene6State.forwardArrow) scene6State.forwardArrow.visible = false;
          } else {
            if (scene6State.setForwardArrowEnabled) scene6State.setForwardArrowEnabled(true);
          }
        }

        if (snapType === "jstPin3Side1" && !scene6State.cameraAnimationDisabled) {
          setTimeout(() => {
            // Enable Next button after jstPin3Side1 connection (step 2)
            if (scene6State.setForwardArrowEnabled && typeof getCurrentStep === 'function' && getCurrentStep() === 2) {
              scene6State.setForwardArrowEnabled(true);
              console.log("[Lesson3] Enabled Next button after jstPin3Side1 connection");
            }
          });
        }
        if (snapType === "jstPin3Side2" && !scene6State.cameraAnimationDisabled) {
          setTimeout(() => {
            // Enable Next button after jstPin3Side2 connection (step 3)
            if (scene6State.setForwardArrowEnabled && typeof getCurrentStep === 'function' && getCurrentStep() === 3) {
              scene6State.setForwardArrowEnabled(true);
              console.log("[Lesson3] Enabled Next button after jstPin3Side2 connection");
            }
          });
        }
        
        // Add handlers for LED module connections in lesson3
        if (snapType === "ledExpansionBoard" && !scene6State.cameraAnimationDisabled) {
          setTimeout(() => {
            // Enable Next button after LED expansion board connection (step 4)
            if (scene6State.setForwardArrowEnabled && typeof getCurrentStep === 'function' && getCurrentStep() === 4) {
              scene6State.setForwardArrowEnabled(true);
              console.log("[Lesson3] Enabled Next button after LED expansion board connection");
            }
          });
        }
        
        if (snapType === "ledModule" && !scene6State.cameraAnimationDisabled) {
          setTimeout(() => {
            // Enable Next button after LED module connection (step 5)
            if (scene6State.setForwardArrowEnabled && typeof getCurrentStep === 'function' && getCurrentStep() === 5) {
              scene6State.setForwardArrowEnabled(true);
              console.log("[Lesson3] Enabled Next button after LED module connection");
            }
          });
        }
        
        // Add handler for battery connection in lesson3 (step 6)
        if (snapType === "jstPinBattery" && !scene6State.cameraAnimationDisabled) {
          setTimeout(() => {
            // Enable Next button after battery connection in lesson3 (step 6)
            if (scene6State.setForwardArrowEnabled && typeof getCurrentStep === 'function' && getCurrentStep() === 6 && typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson3') {
              scene6State.setForwardArrowEnabled(true);
              console.log("[Lesson3] Enabled Next button after battery connection");
            }
            
            // Show Start Coding button for lesson3 after battery connection
            if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson3' && typeof getCurrentStep === 'function' && getCurrentStep() === 6) {
              try {
                if (runCodeButton) {
                  if (scene && !scene.children.includes(runCodeButton)) scene.add(runCodeButton);
                  runCodeButton.userData.clickable = true;
                  runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
                  runCodeButton.visible = true;
                  if (typeof runCodeButton.update === 'function') runCodeButton.update();
                  console.log("[Lesson3] Showed Start Coding button after battery connection");
                }
                // Hide Next button when Start Coding is shown in lesson3
                if (scene6State.setForwardArrowEnabled) scene6State.setForwardArrowEnabled(false);
                if (scene6State.forwardArrow) scene6State.forwardArrow.visible = false;
              } catch (e) {
                console.warn("[Lesson3] Error showing Start Coding button:", e);
              }
            }
          });
        }
      },
      {
        // Pass models and UI callbacks to raycaster
        nanoModel: scene6State.nanoModel,
        jstPinBatterySide1: scene6State.jstPinBatterySide1,
        rgbLEDModel: scene6State.rgbLEDModel,
        tempSensorModel: scene6State.tempSensorModel,
        jstPin2Side1: scene6State.jstPin2Side1,
        jstPin2Side2: scene6State.jstPin2Side2,
        jstPin3Side1: scene6State.jstPin3Side1,
        jstPin3Side2: scene6State.jstPin3Side2,
        secondPin4Female: scene6State.secondPin4Female,
        setForwardArrowEnabled: scene6State.setForwardArrowEnabled,
        getCurrentStep: scene6State.getCurrentStep,
        getCurrentLesson: scene6State.getCurrentLesson,
      }
    );
    
    // Expose raycasterSetup for animation updates
    scene6State.raycasterSetup = raycasterSetup;
    
    // Update raycaster models when they change
    if (raycasterSetup.updateModels) {
      // Update models after all models are created
      raycasterSetup.updateModels({
        nanoModel: scene6State.nanoModel,
        jstPinBatterySide1: scene6State.jstPinBatterySide1,
        rgbLEDModel: scene6State.rgbLEDModel,
        tempSensorModel: scene6State.tempSensorModel,
        jstPin2Side1: scene6State.jstPin2Side1,
        jstPin2Side2: scene6State.jstPin2Side2,
        jstPin3Side1: scene6State.jstPin3Side1,
        jstPin3Side2: scene6State.jstPin3Side2,
        secondPin4Female: scene6State.secondPin4Female,
        setForwardArrowEnabled: scene6State.setForwardArrowEnabled,
        getCurrentStep: scene6State.getCurrentStep,
        getCurrentLesson: scene6State.getCurrentLesson,
      });
    }
  }
  renderer.render(scene, camera);
  const clock = new THREE.Clock();
  function animate() {
    if (userInfo.modeSelected === "vr") {
      renderer.setAnimationLoop(render);
    } else {
      function loop() {
        if (!camera) {
          cancelAnimationFrame(animationFrameId);
          return;
        }
        animationFrameId = requestAnimationFrame(loop);
        render();
      }
      loop();
    }
  }
  function render() {
    if (!camera) return;
    stats.begin();
    const delta = clock.getDelta();
    
    // Update OrbitControls unless a camera lock is active
    if (controls && scene6State.orbitControls) {
      scene6State.orbitControls.update();
    }
    
    if (userInfo.modeSelected === "vr") {
      updateVR();
    }
         // Camera auto-follow and lookAt — follow player when not in orbit mode and no camera lock is active
     if (!isOrbitMode && sceneInitialization?.playerFunction?.player) {
       const player = sceneInitialization.playerFunction.player;
       player.updateMatrixWorld();
       if (mainModel.collisionMesh) {
         handleCollisions(
           player,
           mainModel.collisionMesh,
           playerState.velocity,
           delta
         );
       }
       if (playerState.velocity.length() > 0) {
         player.position.x += playerState.velocity.x * delta;
         player.position.z += playerState.velocity.z * delta;
         if (!playerState.onGround) {
           player.position.y += playerState.velocity.y * delta;
         }
       }
       const headHeight = 0.05;
       camera.position.set(
         player.position.x,
         player.position.y + headHeight,
         player.position.z
       );
       const lookDistance = 10;
       const lookDirection = new THREE.Vector3(0, 0, -1);
       lookDirection.applyAxisAngle(
         new THREE.Vector3(0, 1, 0),
         player.rotation.y
       );
       const lookTarget = new THREE.Vector3()
         .copy(camera.position)
         .add(lookDirection.multiplyScalar(lookDistance));
       // Camera lookAt removed - all lessons now have consistent camera behavior
     }
    // Camera look lock logic removed - all lessons now have consistent camera behavior
    // --- SNAP CAMERA POLLING FIX ---
    if (
      getCurrentStep &&
      getCurrentStep() === 0 &&
      typeof jstPin !== "undefined" &&
      jstPin &&
      jstPin.pinGLTF1
    ) {
      const EXPANSION_BOARD_SNAP_POINT = new THREE.Vector3(-0.03, 1.77, -3.26);
      const SNAP_THRESHOLD = 0.01;
      const pinPos = jstPin.pinGLTF1.position;
      const distance = pinPos.distanceTo(EXPANSION_BOARD_SNAP_POINT);
      if (distance < SNAP_THRESHOLD && !snapCameraAdjusted) {
        isOrbitMode = true;
        snapCameraAdjusted = true;
        // Skip camera orientation animation – OrbitControls will manage view
      }
      if (distance >= SNAP_THRESHOLD) {
        snapCameraAdjusted = false;
      }
    }
    //For Kp lessons - only run updateFunction for lesson4 when run code button clicked and animation completed
    const currentLesson = typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : 'unknown';
    if (currentLesson === "lesson4") {
      // Check if both conditions are met: run code button clicked AND code animation completed
      const runCodeClicked = lesson4RunCodeClicked || scene6State.lesson4RunCodeClicked;
      const animationCompleted = lesson4CodeAnimationCompleted || (typeof window !== 'undefined' && window.lesson4CodeAnimationCompleted);
      
      // Debug logging
      if (runCodeClicked || animationCompleted) {
        console.log('[Lesson4] Debug - currentLesson:', currentLesson, 'runCodeClicked:', runCodeClicked, 'animationCompleted:', animationCompleted);
      }
      
      if (runCodeClicked && animationCompleted) {
        // Note: audio for lesson4 should play as s8 after code animation; handled in learning.js
        console.log('[Lesson4] Both conditions met, running updateFunction');
        updateFunction(delta);
      }
    }
    if (scene6State.getCurrentLesson && scene6State.getCurrentLesson() === "lesson5") {
      irUpdate(delta)
    }
    // --- END SNAP CAMERA POLLING FIX ---
    
    // Update shader manager
    updateShader(delta);
    
    // Update RGB LED blink animation
    if (scene6State.rgbLEDBlinkMesh && scene6State.rgbLEDBlinkMesh.userData.blinkUpdate) {
      try {
        scene6State.rgbLEDBlinkMesh.userData.blinkUpdate(delta);
      } catch (e) {
        console.warn('Error updating RGB LED blink animation:', e);
      }
    }
    
    // Update raycaster setup (for drag indicator shader)
    if (scene6State.raycasterSetup && typeof scene6State.raycasterSetup.update === 'function') {
      scene6State.raycasterSetup.update(delta);
    }
    
    // Safety check: ensure ThreeMeshUI is available before calling update
    try {
      if (typeof ThreeMeshUI !== 'undefined' && typeof ThreeMeshUI.update === 'function') {
        ThreeMeshUI.update();
      } else {
        console.warn('ThreeMeshUI.update is not available');
      }
    } catch (error) {
      console.warn('Error during ThreeMeshUI.update:', error);
    }
    
    renderer.render(scene, camera);
    stats.end();
  }
  animate();
  const resizeHandler = () => {
    const aspect = window.innerWidth / window.innerHeight;
    if (camera && renderer) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };
  window.addEventListener("resize", resizeHandler);
  if (isVRMode) {
    initializeVR(renderer, scene, camera, null, null, [], () => {});
  }
  // Set up event listener for lesson2_s8 audio completion to show Next Lesson button
  if (!scene6State._lesson2S8AudioHandler) {
    scene6State._lesson2S8AudioHandler = () => {
      try {
        const currentLesson = typeof scene6State.getCurrentLesson === "function" 
          ? scene6State.getCurrentLesson() 
          : (typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson() : null);
        
        if (currentLesson === "lesson2") {
          console.log("[Scene6] lesson2_s8 audio completed - showing Start Learning button");
          
          // Hide forward arrow
          if (typeof setForwardArrowEnabled === "function") {
            setForwardArrowEnabled(false);
          } else if (typeof scene6State.setForwardArrowEnabled === "function") {
            scene6State.setForwardArrowEnabled(false);
          }
          if (forwardArrow) forwardArrow.visible = false;
          
          // Show Start Learning button (runCodeButton) - user will click it to see learning content
          if (runCodeButton) {
            if (scene && !scene.children.includes(runCodeButton)) scene.add(runCodeButton);
            runCodeButton.userData.clickable = true;
            runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
            runCodeButton.visible = true;
            if (typeof runCodeButton.update === 'function') runCodeButton.update();
            console.log("[Scene6] Start Learning button shown for lesson2");
          }
        }
      } catch (e) {
        console.warn("[Scene6] Error in lesson2_s8 audio handler:", e);
      }
    };
    window.addEventListener("audioComplete-lesson2_s8", scene6State._lesson2S8AudioHandler);
    console.log("[Scene6] Set up event listener for audioComplete-lesson2_s8");
  }

  // After initializing the scene, set the lesson for the UI
  setLesson("lesson1"); // Always start with lesson1

  // Global function to log all lesson3 models (can be called from console)
  window.logLesson3Models = function() {
    console.log("=== LESSON3 MODELS OVERVIEW (Called from console) ===");
    console.log("Current lesson:", typeof window.getCurrentLesson === "function" ? window.getCurrentLesson() : "unknown");
    console.log("All available GLTF models:", Object.keys(allAssets.models.gltf));
    
    // Log lesson3 specific models
    console.log("--- LESSON3 SPECIFIC MODELS ---");
    console.log("tempSensorModel:", {
      exists: !!scene6State.tempSensorModel,
      name: scene6State.tempSensorModel ? scene6State.tempSensorModel.name : "N/A",
      inScene: scene6State.tempSensorModel && scene ? scene.children.includes(scene6State.tempSensorModel) : false,
      visible: scene6State.tempSensorModel ? scene6State.tempSensorModel.visible : false,
      position: scene6State.tempSensorModel ? scene6State.tempSensorModel.position : "N/A",
      scale: scene6State.tempSensorModel ? scene6State.tempSensorModel.scale : "N/A"
    });
    
    console.log("jstPin3 (lesson3 JST pin):", {
      exists: !!scene6State.jstPin3,
      inScene: scene6State.jstPin3 && scene6State.jstPin3.group && scene ? scene.children.includes(scene6State.jstPin3.group) : false,
      visible: scene6State.jstPin3 && scene6State.jstPin3.group ? scene6State.jstPin3.group.visible : false,
      pin1Exists: !!scene6State.jstPin3Side1,
      pin2Exists: !!scene6State.jstPin3Side2
    });
    
    // Log common models that are also used in lesson3
    console.log("--- COMMON MODELS USED IN LESSON3 ---");
    console.log("nanoModel (Arduino):", {
      exists: !!scene6State.nanoModel,
      name: scene6State.nanoModel ? scene6State.nanoModel.name : "N/A",
      inScene: scene6State.nanoModel && scene ? scene.children.includes(scene6State.nanoModel) : false,
      visible: scene6State.nanoModel ? scene6State.nanoModel.visible : false,
      position: scene6State.nanoModel ? scene6State.nanoModel.position : "N/A"
    });
    
    console.log("expansionBoardModel:", {
      exists: !!scene6State.expansionBoardModel,
      name: scene6State.expansionBoardModel ? scene6State.expansionBoardModel.name : "N/A",
      inScene: scene6State.expansionBoardModel && scene ? scene.children.includes(scene6State.expansionBoardModel) : false,
      visible: scene6State.expansionBoardModel ? scene6State.expansionBoardModel.visible : false,
      position: scene6State.expansionBoardModel ? scene6State.expansionBoardModel.position : "N/A"
    });
    
    console.log("batteryModel:", {
      exists: !!scene6State.batteryModel,
      name: scene6State.batteryModel ? scene6State.batteryModel.name : "N/A",
      inScene: scene6State.batteryModel && scene ? scene.children.includes(scene6State.batteryModel) : false,
      visible: scene6State.batteryModel ? scene6State.batteryModel.visible : false,
      position: scene6State.batteryModel ? scene6State.batteryModel.position : "N/A"
    });
    
    console.log("jstPinBattery:", {
      exists: !!scene6State.jstPinBattery,
      inScene: scene6State.jstPinBattery && scene6State.jstPinBattery.group && scene ? scene.children.includes(scene6State.jstPinBattery.group) : false,
      visible: scene6State.jstPinBattery && scene6State.jstPinBattery.group ? scene6State.jstPinBattery.group.visible : false
    });
    
    // Log lesson2 models that should be hidden in lesson3
    console.log("--- LESSON2 MODELS (SHOULD BE HIDDEN IN LESSON3) ---");
    console.log("buzzerModel:", {
      exists: !!scene6State.buzzerModel,
      name: scene6State.buzzerModel ? scene6State.buzzerModel.name : "N/A",
      inScene: scene6State.buzzerModel && scene ? scene.children.includes(scene6State.buzzerModel) : false,
      visible: scene6State.buzzerModel ? scene6State.buzzerModel.visible : false
    });
    
    console.log("jstPin2 (lesson2 JST pin):", {
      exists: !!scene6State.jstPin2,
      inScene: scene6State.jstPin2 && scene6State.jstPin2.group && scene ? scene.children.includes(scene6State.jstPin2.group) : false,
      visible: scene6State.jstPin2 && scene6State.jstPin2.group ? scene6State.jstPin2.group.visible : false
    });
    
    // Log lesson1 models that should be hidden in lesson3
    console.log("--- LESSON1 MODELS (SHOULD BE HIDDEN IN LESSON3) ---");
    console.log("rgbLEDModel:", {
      exists: !!scene6State.rgbLEDModel,
      name: scene6State.rgbLEDModel ? scene6State.rgbLEDModel.name : "N/A",
      inScene: scene6State.rgbLEDModel && scene ? scene.children.includes(scene6State.rgbLEDModel) : false,
      visible: scene6State.rgbLEDModel ? scene6State.rgbLEDModel.visible : false
    });
    
    console.log("jstPin (lesson1 JST pin):", {
      exists: !!scene6State.jstPin,
      inScene: scene6State.jstPin && scene6State.jstPin.group && scene ? scene.children.includes(scene6State.jstPin.group) : false,
      visible: scene6State.jstPin && scene6State.jstPin.group ? scene6State.jstPin.group.visible : false
    });
    
    // Log all scene children to see what's actually in the scene
    console.log("--- ALL SCENE CHILDREN ---");
    if (scene && scene.children) {
      scene.children.forEach((child, index) => {
        console.log(`Scene child ${index}:`, {
          name: child.name || "unnamed",
          type: child.type,
          visible: child.visible,
          isGroup: child.isGroup,
          childrenCount: child.children ? child.children.length : 0
        });
      });
    }
    
    console.log("=== END LESSON3 MODELS OVERVIEW ===");
  };
  
  console.log("Global function 'logLesson3Models()' is now available. Call it from the console to see all lesson3 models!");
  
  // Add global function to manually fix model visibility
  window.fixModelVisibility = function(lessonName) {
    console.log(`[DEBUG] Manually fixing model visibility for: ${lessonName}`);
    if (lessonName) {
      cleanupLessonModels('unknown', lessonName);
      updateLessonVisibility(lessonName);
    } else {
      const currentLesson = typeof window.getCurrentLesson === "function" ? window.getCurrentLesson() : "lesson1";
      console.log(`[DEBUG] No lesson specified, using current lesson: ${currentLesson}`);
      cleanupLessonModels('unknown', currentLesson);
      updateLessonVisibility(currentLesson);
    }
    console.log(`[DEBUG] Model visibility fix completed for: ${lessonName || 'current lesson'}`);
  };
  
  console.log("Global function 'fixModelVisibility(lessonName)' is now available. Call it from the console to fix model visibility!");
  
  // Add global function to check current model visibility state
  // window.checkModelVisibility = function() {
  //   console.log("=== CURRENT MODEL VISIBILITY STATE ===");
  //   console.log("rgbLEDModel (lesson1):", {
  //     exists: !!scene6State.rgbLEDModel,
  //     visible: scene6State.rgbLEDModel ? scene6State.rgbLEDModel.visible : 'N/A',
  //     inScene: scene6State.rgbLEDModel && scene ? scene.children.includes(scene6State.rgbLEDModel) : false
  //   });
  //   console.log("jstPin (lesson1):", {
  //     exists: !!scene6State.jstPin,
  //     visible: scene6State.jstPin && scene6State.jstPin.group ? scene6State.jstPin.group.visible : 'N/A',
  //     inScene: scene6State.jstPin && scene6State.jstPin.group && scene ? scene.children.includes(scene6State.jstPin.group) : false
  //   });
  //   console.log("buzzerModel (lesson2):", {
  //     exists: !!scene6State.buzzerModel,
  //     visible: scene6State.buzzerModel ? scene6State.buzzerModel.visible : 'N/A',
  //     inScene: scene6State.buzzerModel && scene ? scene.children.includes(scene6State.buzzerModel) : false
  //   });
  //   console.log("jstPin2 (lesson2):", {
  //     exists: !!scene6State.jstPin2,
  //     visible: scene6State.jstPin2 && scene6State.jstPin2.group ? scene6State.jstPin2.group.visible : 'N/A',
  //     inScene: scene6State.jstPin2 && scene6State.jstPin2.group && scene ? scene.children.includes(scene6State.jstPin2.group) : false
  //   });
  //   console.log("tempSensorModel (lesson3):", {
  //     exists: !!scene6State.tempSensorModel,
  //     visible: scene6State.tempSensorModel ? scene6State.tempSensorModel.visible : 'N/A',
  //     inScene: scene6State.tempSensorModel && scene ? scene.children.includes(scene6State.tempSensorModel) : false
  //   });
  //   console.log("jstPin3 (lesson3):", {
  //     exists: !!scene6State.jstPin3,
  //     visible: scene6State.jstPin3 && scene6State.jstPin3.group ? scene6State.jstPin3.group.visible : 'N/A',
  //     inScene: scene6State.jstPin3 && scene6State.jstPin3.group && scene ? scene.children.includes(scene6State.jstPin3.group) : false
  //   });
  //   console.log("makeSomeNoiseButton (lesson2):", {
  //     exists: !!window.makeSomeNoiseButton,
  //     visible: window.makeSomeNoiseButton ? window.makeSomeNoiseButton.visible : 'N/A',
  //     inScene: window.makeSomeNoiseButton && scene ? scene.children.includes(window.makeSomeNoiseButton) : false
  //   });
  //   console.log("Current lesson:", typeof window.getCurrentLesson === "function" ? window.getCurrentLesson() : "unknown");
  //   console.log("=====================================");
  // };
  
  // console.log("Global function 'checkModelVisibility()' is now available. Call it from the console to check current model visibility!");
  
  // Add global function to manually refresh raycaster pin models reference
  window.refreshRaycasterPinModels = function() {
    if (scene6State.raycasterSetup && typeof scene6State.raycasterSetup.refreshPinModelsRef === 'function') {
      scene6State.raycasterSetup.refreshPinModelsRef();
      console.log("[DEBUG] Manually refreshed raycaster pin models reference");
    } else {
      console.warn("[DEBUG] RaycasterSetup not available or refreshPinModelsRef method not found");
    }
  };
  
  console.log("Global function 'refreshRaycasterPinModels()' is now available. Call it from the console to refresh pin models!");
  
  // Add global function to manually enable Next button for debugging
  window.enableNextButton = function() {
    if (window.setForwardArrowEnabled) {
      window.setForwardArrowEnabled(true);
      console.log("[DEBUG] Manually enabled Next button");
    }
    if (window.forwardArrow) {
      window.forwardArrow.visible = true;
      console.log("[DEBUG] Made forward arrow visible");
    }
  };
  
  console.log("Global function 'enableNextButton()' is now available. Call it from the console to enable the Next button!");
  
  // Add global function to manually show Start Coding button for debugging
  window.showStartCodingButton = function() {
    if (window.runCodeButton) {
      if (scene && !scene.children.includes(runCodeButton)) scene.add(runCodeButton);
      runCodeButton.userData.clickable = true;
      runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
      runCodeButton.visible = true;
      if (typeof runCodeButton.update === 'function') runCodeButton.update();
      console.log("[DEBUG] Manually showed Start Coding button");
    } else {
      console.warn("[DEBUG] Start Coding button not available");
    }
  };
  
  console.log("Global function 'showStartCodingButton()' is now available. Call it from the console to show the Start Coding button!");
  
  // Global function to control RGB LED blink effect
  window.controlRGBLEDBlink = function(action, speed = 2.0) {
    // Use scene6State first, fallback to window for backward compatibility
    const rgbLEDBlinkMesh = scene6State.rgbLEDBlinkMesh || window.rgbLEDBlinkMesh;
    const rgbLEDBlinkMaterial = scene6State.rgbLEDBlinkMaterial || window.rgbLEDBlinkMaterial;
    
    if (rgbLEDBlinkMesh && rgbLEDBlinkMesh.userData.blinkUpdate) {
      switch (action) {
        case 'start':
          rgbLEDBlinkMesh.userData.blinkSpeed = speed;
          rgbLEDBlinkMesh.userData.blinkActive = true;
          console.log('RGB LED blink started with speed:', speed);
          break;
        case 'stop':
          rgbLEDBlinkMesh.userData.blinkActive = false;
          // Reset to solid red
          if (rgbLEDBlinkMaterial) {
            rgbLEDBlinkMaterial.emissiveIntensity = 0.5;
            rgbLEDBlinkMaterial.opacity = 1.0;
            rgbLEDBlinkMaterial.color.setRGB(1, 0, 0);
            rgbLEDBlinkMaterial.emissive.setRGB(0.5, 0, 0);
          }
          console.log('RGB LED blink stopped');
          break;
        case 'speed':
          rgbLEDBlinkMesh.userData.blinkSpeed = speed;
          console.log('RGB LED blink speed changed to:', speed);
          break;
        default:
          console.log('Available actions: start, stop, speed');
      }
    } else {
      console.warn('RGB LED blink mesh not found');
    }
  };
  
  // Also expose on scene6State for consistency
  scene6State.controlRGBLEDBlink = window.controlRGBLEDBlink;
  
  console.log("Global function 'controlRGBLEDBlink(action, speed)' is now available. Actions: 'start', 'stop', 'speed'");
  
  // Note: Initial shader is now applied only when "Begin the Blink" button is clicked
  // applyStepShader("lesson1", 0); // Removed - shader will be applied on button click
  
  // Test the shader manager to verify it's working (removed to prevent automatic shader application)
  // setTimeout(() => {
  //   console.log('Testing shader manager after scene initialization...');
  //   testShaderManager();
  // }, 2000);



  // --- Reset nano model on Next Lesson ---
  window.setOnNextLesson = setOnNextLesson;
  window.setOnNextLesson(() => {
    console.log("[NextLesson] Handler called - starting lesson transition");
    // Clean up shader manager when moving to next lesson
    cleanupShader();
    
    if (scene6State.disableNanoSnap !== undefined) {
      scene6State.disableNanoSnap = true;
    }
    scene6State.disableNanoSnap = true;
    
    // Get current lesson to determine if we're transitioning TO lesson2
    const currentLesson = typeof scene6State.getCurrentLesson === "function" 
      ? scene6State.getCurrentLesson() 
      : "lesson1";
    console.log("[NextLesson] Current lesson:", currentLesson);
    
    // Only apply lesson2 transforms when transitioning TO lesson2
    if (currentLesson === "lesson1") {
      const nanoModel = scene6State.nanoModel;
      const expansionBoardModel = scene6State.expansionBoardModel;
      
      if (nanoModel) {
        nanoModel.position.copy(modelTransforms.nano1.position);
        nanoModel.rotation.copy(modelTransforms.nano1.lesson2rotation);
        nanoModel.scale.copy(modelTransforms.nano1.scale);
      }
      if (expansionBoardModel) {
        expansionBoardModel.position.copy(modelTransforms.expansionBoard.position);
        expansionBoardModel.rotation.copy(modelTransforms.expansionBoard.lesson2rotation);
        expansionBoardModel.scale.copy(modelTransforms.expansionBoard.scale);
      }
    }

    // Switch to next lesson based on current lesson
    let nextLesson;
    
    switch (currentLesson) {
      case "lesson1":
        nextLesson = "lesson2";
        break;
      case "lesson2":
        nextLesson = "lesson3";
        break;
      case "lesson3":
        nextLesson = "lesson4";
        break;
      case "lesson4":
        nextLesson = "lesson5";
        break;
      case "lesson5":
        // Transition to scene7 when "Lets Build" button is clicked
        console.log("Lesson5 completed - transitioning to scene7");
        
            // Show celebration overlay instead of immediate transition
            try { markSceneCompleted("scene6"); } catch (e) {}
            celebrateSceneCompletion({
              completedSceneKey: "scene6",
              nextSceneKey: "scene7",
              headline: "Component Lesson Learned!",
              subtext: "Final challenge: Component Assembly. Returning to scene select...",
              onCleanup: () => {
                try { cleanupScene6(); } catch (e) {}
              },
            });
            return; // Exit early to prevent further lesson switching
        break;
      default:
        nextLesson = "lesson2"; // fallback
    }
    
    console.log(`Moving from ${currentLesson} to ${nextLesson}`);
    

    
    // Helper function to log current JST pin states
    const logJstPinStates = () => {
      const currentScene = scene6State.currentScene || scene || window.currentScene;
      console.log("=== Current JST Pin States ===");
      console.log("jstPin (lesson1):", {
        exists: !!scene6State.jstPin,
        inScene: scene6State.jstPin && currentScene && scene6State.jstPin.group ? currentScene.children.includes(scene6State.jstPin.group) : false,
        visible: scene6State.jstPin && scene6State.jstPin.group ? scene6State.jstPin.group.visible : false
      });
      console.log("jstPin2 (lesson2):", {
        exists: !!scene6State.jstPin2,
        inScene: scene6State.jstPin2 && currentScene && scene6State.jstPin2.group ? currentScene.children.includes(scene6State.jstPin2.group) : false,
        visible: scene6State.jstPin2 && scene6State.jstPin2.group ? scene6State.jstPin2.group.visible : false
      });
      console.log("jstPin3 (lesson3):", {
        exists: !!scene6State.jstPin3,
        inScene: scene6State.jstPin3 && currentScene && scene6State.jstPin3.group ? currentScene.children.includes(scene6State.jstPin3.group) : false,
        visible: scene6State.jstPin3 && scene6State.jstPin3.group ? scene6State.jstPin3.group.visible : false
      });
      console.log("jstPinBattery:", {
        exists: !!scene6State.jstPinBattery,
        inScene: scene6State.jstPinBattery && currentScene && scene6State.jstPinBattery.group ? currentScene.children.includes(scene6State.jstPinBattery.group) : false,
        visible: scene6State.jstPinBattery && scene6State.jstPinBattery.group ? scene6State.jstPinBattery.group.visible : false
      });
      console.log("================================");
    };
    
    // Log current state before cleanup
    logJstPinStates();
    
    // Perform lesson-specific cleanup based on what we're leaving behind
    if (currentLesson === "lesson1" && nextLesson === "lesson2") {
      // Moving from lesson1 to lesson2 - remove lesson1 specific components
      console.log("Cleaning up lesson1 components for lesson2 transition");
      try {
        if (scene6State.currentScene && scene6State.rgbLEDModel) {
          scene6State.currentScene.remove(scene6State.rgbLEDModel);
          console.log("Removed rgbLEDModel from scene");
        }
        // Remove full jstPin group and dispose wires (lesson1 specific)
        if (scene6State.jstPin) {
          if (scene6State.jstPin.group && scene6State.currentScene) {
            scene6State.currentScene.remove(scene6State.jstPin.group);
            console.log("Removed jstPin group from scene");
          }
          if (scene6State.jstPin.wires && Array.isArray(scene6State.jstPin.wires)) {
            scene6State.jstPin.wires.forEach((wireObj) => {
              try { if (typeof wireObj.dispose === 'function') wireObj.dispose(); } catch (e) {}
            });
            console.log("Disposed jstPin wires");
          }
          // Clear references to avoid accidental reuse
          scene6State.jstPin = null;
          scene6State.secondPin4Female = null;
          console.log("Cleared jstPin references");
        }
      } catch (e) {
        console.warn("Error cleaning up lesson1 components:", e);
      }
    } else if (currentLesson === "lesson2" && nextLesson === "lesson3") {
      // Moving from lesson2 to lesson3 - remove lesson2 specific components
      console.log("Cleaning up lesson2 components for lesson3 transition");
      try {
        const buzzerModel = scene6State.buzzerModel;
        const jstPin2 = scene6State.jstPin2;
        const jstPin = scene6State.jstPin;
        const rgbLEDModel = scene6State.rgbLEDModel;
        const currentScene = scene6State.currentScene || scene;
        
        // Remove buzzer
        if (buzzerModel && currentScene) {
          if (currentScene.children.includes(buzzerModel)) {
            currentScene.remove(buzzerModel);
            console.log("Removed buzzerModel from scene");
          } else {
            console.log("buzzerModel not in scene, trying to hide it");
            buzzerModel.visible = false;
          }
        }
        
        // Remove jstPin2 - comprehensive cleanup
        if (jstPin2) {
          console.log("Removing jstPin2 - comprehensive cleanup");
          
          // Remove from JstXhFemalePin registry if possible
          try {
            if (typeof JstXhFemalePin !== "undefined" && JstXhFemalePin.allModels && Array.isArray(JstXhFemalePin.allModels)) {
              const index = JstXhFemalePin.allModels.findIndex(entry => entry.instance === jstPin2 || entry.id === jstPin2.id);
              if (index !== -1) {
                JstXhFemalePin.allModels.splice(index, 1);
                console.log("Removed jstPin2 from JstXhFemalePin.allModels registry");
              }
            }
          } catch (e) {
            console.warn("Error removing jstPin2 from registry:", e);
          }
          
          // Remove group from scene
          if (jstPin2.group && currentScene) {
            if (currentScene.children.includes(jstPin2.group)) {
              currentScene.remove(jstPin2.group);
              console.log("Removed jstPin2.group from scene");
            } else {
              console.log("jstPin2.group not in scene, trying to hide it");
              jstPin2.group.visible = false;
            }
          }
          
          // Dispose wires if they exist
          if (jstPin2.wires && Array.isArray(jstPin2.wires)) {
            jstPin2.wires.forEach((wireObj) => {
              try {
                if (typeof wireObj.dispose === 'function') {
                  wireObj.dispose();
                } else if (wireObj.geometry) {
                  wireObj.geometry.dispose();
                }
                if (wireObj.material) {
                  if (Array.isArray(wireObj.material)) {
                    wireObj.material.forEach(mat => mat.dispose());
                  } else {
                    wireObj.material.dispose();
                  }
                }
              } catch (e) {
                console.warn("Error disposing jstPin2 wire:", e);
              }
            });
            console.log("Disposed jstPin2 wires");
          }
          
          // Remove individual pin models if they exist
          if (jstPin2.pinGLTF1 && currentScene) {
            if (currentScene.children.includes(jstPin2.pinGLTF1)) {
              currentScene.remove(jstPin2.pinGLTF1);
              console.log("Removed jstPin2.pinGLTF1 from scene");
            }
            jstPin2.pinGLTF1.visible = false;
          }
          if (jstPin2.pinGLTF2 && currentScene) {
            if (currentScene.children.includes(jstPin2.pinGLTF2)) {
              currentScene.remove(jstPin2.pinGLTF2);
              console.log("Removed jstPin2.pinGLTF2 from scene");
            }
            jstPin2.pinGLTF2.visible = false;
          }
        }
        
        // Aggressive scene traversal to find and remove any remaining jstPin2 objects
        if (currentScene) {
          const objectsToRemove = [];
          currentScene.traverse((child) => {
            // Check if this is the lesson2 jstPin2 by checking if it's a twoSide pin with 3 pins
            // and if it's not the lesson3 jstPin2 (which will be created later)
            if (child.userData && child.userData.lesson2) {
              objectsToRemove.push(child);
            } else if (child.name && child.name.includes("jstPin") && child !== jstPin3?.group && child !== jstPin?.group) {
              // Check if this might be jstPin2 by looking at parent or siblings
              if (child.parent && child.parent !== jstPin3?.group && child.parent !== jstPin?.group) {
                // Check if parent has lesson2 marker or if it's the old jstPin2 group
                if (child.parent.userData && child.parent.userData.lesson2) {
                  objectsToRemove.push(child);
                  objectsToRemove.push(child.parent);
                }
              }
            }
          });
          
          objectsToRemove.forEach((obj) => {
            try {
              obj.visible = false;
              if (obj.parent) {
                obj.parent.remove(obj);
                console.log(`[Aggressive Cleanup] Removed jstPin2-related object: ${obj.name || 'unnamed'}`);
              }
            } catch (e) {
              console.warn(`[Aggressive Cleanup] Error removing object:`, e);
            }
          });
          
          if (objectsToRemove.length > 0) {
            console.log(`[Aggressive Cleanup] Removed ${objectsToRemove.length} jstPin2-related objects from scene`);
          }
        }
        
        // Also remove lesson1 JST pin if it's still visible (should have been removed in lesson1->lesson2 transition)
        if (jstPin && jstPin.group && currentScene) {
          if (currentScene.children.includes(jstPin.group)) {
            currentScene.remove(jstPin.group);
            console.log("Removed lesson1 jstPin group from scene (cleanup)");
          }
          // Dispose wires if they exist
          if (jstPin.wires && Array.isArray(jstPin.wires)) {
            jstPin.wires.forEach((wireObj) => {
              try { if (typeof wireObj.dispose === 'function') wireObj.dispose(); } catch (e) {}
            });
            console.log("Disposed lesson1 jstPin wires");
          }
          // Clear references
          scene6State.jstPin = null;
          scene6State.secondPin4Female = null;
        }
        
        // Additional cleanup: ensure all lesson1 and lesson2 models are hidden
        if (rgbLEDModel) {
          rgbLEDModel.visible = false;
          if (currentScene && currentScene.children.includes(rgbLEDModel)) {
            currentScene.remove(rgbLEDModel);
            console.log("Removed rgbLEDModel from scene");
          }
        }
        if (makeSomeNoiseButton) {
          makeSomeNoiseButton.visible = false;
          console.log("Hidden makeSomeNoiseButton (lesson2) for lesson3 transition");
        }
        
        // Ensure jstPin2 is hidden before clearing references
        const jstPin2ToHide = scene6State.jstPin2;
        if (jstPin2ToHide && jstPin2ToHide.group) {
          jstPin2ToHide.group.visible = false;
          console.log("Explicitly hid jstPin2.group before clearing references");
        }
        if (jstPin2ToHide && jstPin2ToHide.pinGLTF1) {
          jstPin2ToHide.pinGLTF1.visible = false;
        }
        if (jstPin2ToHide && jstPin2ToHide.pinGLTF2) {
          jstPin2ToHide.pinGLTF2.visible = false;
        }
        
        // Clear all references - both scene6State and window
        scene6State.buzzerModel = null;
        scene6State.jstPin2 = null;
        scene6State.jstPin2Side1 = null;
        scene6State.jstPin2Side2 = null;
        // State is now managed in scene6State only
        console.log("Cleared all lesson2 component references (scene6State and window)");
      } catch (e) {
        console.error("Error cleaning up lesson2 components:", e);
      }
    } else if (currentLesson === "lesson3" && nextLesson === "lesson4") {
      console.log("Transitioning from lesson3 to lesson4, scene state:", !!scene, "scene type:", typeof scene);
      // Ensure RGB/LDR lesson artifacts (like ldrTestingCube) are removed BEFORE changing lesson
      try { 
        console.log("About to call cleanupKpRgbLesson with scene:", !!scene);
        cleanupKpRgbLesson(scene); 
      } catch (e) { 
        console.warn("Error in cleanupKpRgbLesson during lesson3→lesson4:", e);
        console.error("Full error details:", e);
      }
      setLesson("lesson4");
      // Moving from lesson3 to lesson4 - clean via LessonCleaner
      console.log("Cleaning up lesson3 components for lesson4 transition (via LessonCleaner)");
      try {
        const cleaner = new LessonCleaner(scene);
        // Keep only core base models before motor lesson sets up
        cleaner.nonRemovableObjects = [
          "nano",
          "expansionBoard",
          "battery"
        ];
        cleaner.removeObjects();

        // Clear any stale globals that LessonCleaner won't nullify
        window.jstPin = null;
        window.jstPin2 = null;
        window.jstPin3 = null;
        window.tempSensorModel = null;
        console.log("Lesson3 components cleaned via LessonCleaner");
      } catch (e) {
        console.warn("Error cleaning via LessonCleaner:", e);
      }
    } else if (currentLesson === "lesson4" && nextLesson === "lesson5") {
      setLesson("lesson5");
      // Reset lesson4 flags when transitioning away
      lesson4RunCodeClicked = false;
      lesson4CodeAnimationCompleted = false;
      if (typeof window !== 'undefined') {
        window.lesson4RunCodeClicked = false;
        window.lesson4CodeAnimationCompleted = false;
      }
      // Moving from lesson4 to lesson5 - clean via LessonCleaner
      console.log("Cleaning up lesson4 components for lesson5 transition (via LessonCleaner)");
      try {
        const cleaner = new LessonCleaner(scene);
        // Keep only core base models before IR lesson sets up
        cleaner.nonRemovableObjects = [
          "nano",
          "expansionBoard",
          "battery"
        ];
        cleaner.removeObjects();

        // Clear any stale globals that LessonCleaner won't nullify
        window.jstPin = null;
        window.jstPin2 = null;
        window.jstPin3 = null;
        window.tempSensorModel = null;
        console.log("Lesson4 components cleaned via LessonCleaner");
        
        // Ensure original battery and JST pin are hidden for lesson5
        if (window.batteryModel) {
          window.batteryModel.visible = false;
          console.log("[DEBUG] Hidden original batteryModel for lesson5 transition");
        }
        if (window.jstPinBattery && window.jstPinBattery.group) {
          window.jstPinBattery.group.visible = false;
          console.log("[DEBUG] Hidden original jstPinBattery for lesson5 transition");
        }
      } catch (e) {
        console.warn("Error cleaning via LessonCleaner:", e);
      }
    }
    
    // Log state after cleanup
    console.log("=== JST Pin States After Cleanup ===");
    logJstPinStates();
    
    // Reset battery JST pin to original position (common for all transitions)
    if (window.jstPinBattery && window.jstPinBattery.pinGLTF1) {
      window.jstPinBattery.pinGLTF1.rotation.y = -Math.PI / 2;
      if (typeof window.jstPinBattery.updatePosition === 'function') {
        window.jstPinBattery.updatePosition(new THREE.Vector3(0.8, 1.7, -3.2), window.jstPinBattery.pinGLTF1);
      } else if (window.jstPinBattery.pinGLTF1.position) {
        window.jstPinBattery.pinGLTF1.position.set(0.8, 1.7, -3.2);
      }
    }

    setTimeout(() => {
      window.disableNanoSnap = false;
    }, 500);

    // Log the current state before switching
    console.log('Current lesson state before switch:', {
      currentLesson,
      nextLesson,
      getCurrentLesson: typeof window.getCurrentLesson === "function" ? window.getCurrentLesson() : "not available",
      scene: !!scene,
      runCodeButton: !!runCodeButton
    });
    
    // Switch to the determined next lesson and update UI/components visibility
    console.log("[NextLesson] Calling setLesson with:", nextLesson);
    try {
      setLesson(nextLesson);
      console.log("[NextLesson] setLesson completed successfully");
    } catch (e) {
      console.error("[NextLesson] Error in setLesson:", e);
    }
    
    // Call comprehensive cleanup function to ensure all models are properly managed
    cleanupLessonModels(currentLesson, nextLesson);
    
    // Also call the existing updateLessonVisibility for additional safety
    updateLessonVisibility(nextLesson);
    
    // Update learning panel with correct lesson data after transition
    setTimeout(() => {
      try {
        if (learningPanel && learningPanel.visible) {
          setLearningLesson(nextLesson);
          console.log(`[Lesson Transition] Updated learning panel to show ${nextLesson} content`);
        }
      } catch (e) {
        console.warn('Failed to update learning panel after lesson transition:', e);
      }
    }, 200);
    
    // Log the state after switching
    console.log('Lesson state after switch:', {
      newCurrentLesson: typeof window.getCurrentLesson === "function" ? window.getCurrentLesson() : "not available",
      nextLesson
    });

    // Update the code editor to show the new lesson content
    try {
      if (typeof window.setCodeEditorLesson === 'function') {
        window.setCodeEditorLesson(nextLesson);
        console.log(`Code editor updated to show ${nextLesson}`);
      }
    } catch (e) {
      console.warn('Failed to update code editor lesson:', e);
    }

    // Make sure Start Coding button exists in the scene for the next lesson flow
    try {
      if (runCodeButton && scene && !scene.children.includes(runCodeButton)) {
        scene.add(runCodeButton);
      }
      if (runCodeButton) {
        runCodeButton.userData.clickable = true;
        runCodeButton.traverse((child) => { if (child.isMesh) child.userData.clickable = true; });
        runCodeButton.visible = false; // will show after power connection
        if (typeof runCodeButton.update === 'function') runCodeButton.update();
      }
    } catch (e) {}

    // Update instruction panel to the next lesson step 0 content
    try {
      if (typeof updateCodePlaneWithInstruction === 'function' && typeof getCurrentStepText === 'function') {
        const text = getCurrentStepText();
        updateCodePlaneWithInstruction(text || "");
      }
    } catch (e) {}

    // Handle lesson-specific setup based on the next lesson
    if (nextLesson === "lesson1") {
      // Handle lesson1 specific setup
      console.log("Setting up lesson1 specific components");
      
      try {
        const buzzerModel = scene6State.buzzerModel;
        const jstPin2 = scene6State.jstPin2;
        const tempSensorModel = scene6State.tempSensorModel;
        const jstPin3 = scene6State.jstPin3;
        const rgbLEDModel = scene6State.rgbLEDModel;
        const jstPin = scene6State.jstPin;
        
        // Double-check: ensure all lesson2 and lesson3 models are hidden
        if (buzzerModel) {
          buzzerModel.visible = false;
          console.log("Double-check: Hidden buzzerModel for lesson1");
        }
        if (jstPin2 && jstPin2.group) {
          jstPin2.group.visible = false;
          console.log("Double-check: Hidden jstPin2 (lesson2) for lesson1");
        }
        if (tempSensorModel) {
          tempSensorModel.visible = false;
          console.log("Double-check: Hidden tempSensorModel for lesson1");
        }
        if (jstPin3 && jstPin3.group) {
          jstPin3.group.visible = false;
          console.log("Double-check: Hidden jstPin3 group for lesson1");
        }
        if (makeSomeNoiseButton) {
          makeSomeNoiseButton.visible = false;
          console.log("Double-check: Hidden makeSomeNoiseButton for lesson1");
        }
        
        // Ensure lesson1 components are visible
        if (rgbLEDModel) {
          rgbLEDModel.visible = true;
          // Ensure it's in the scene
          if (scene && !scene.children.includes(rgbLEDModel)) {
            scene.add(rgbLEDModel);
          }
          console.log("Made rgbLEDModel visible for lesson1");
        }
        if (jstPin && jstPin.group) {
          if (!scene.children.includes(jstPin.group)) {
            scene.add(jstPin.group);
          }
          jstPin.group.visible = true;
          console.log("Made jstPin (lesson1) visible for lesson1");
        }
        
        console.log("Lesson1 components setup completed with comprehensive cleanup");
      } catch (e) {
        console.warn("Error setting up lesson1 components:", e);
      }
    } else if (nextLesson === "lesson2") {
      // Ensure orbit controls are enabled for lesson2
      if (scene6State.orbitControls) {
        scene6State.orbitControls.enabled = true;
        console.log("OrbitControls enabled for lesson2");
      } else if (controls) {
        controls.enabled = true;
        console.log("OrbitControls enabled for lesson2 (using fallback controls reference)");
      }
      
      // Enable snapping for lesson2 (jstPin2 needs to snap)
      scene6State.disableNanoSnap = false;
      console.log("[Scene6] Enabled snapping for lesson2 (disableNanoSnap set to false)");
      
      // Update nano and expansion board positions/rotations for lesson2
      try {
        const nanoModel = scene6State.nanoModel;
        const expansionBoardModel = scene6State.expansionBoardModel;
        
        if (nanoModel) {
          nanoModel.position.copy(modelTransforms.nano1.position);
          nanoModel.rotation.copy(modelTransforms.nano1.lesson2rotation);
          nanoModel.scale.copy(modelTransforms.nano1.scale);
          console.log("Updated nanoModel position and rotation for lesson2");
        }
        if (expansionBoardModel) {
          expansionBoardModel.position.copy(modelTransforms.expansionBoard.position);
          expansionBoardModel.rotation.copy(modelTransforms.expansionBoard.lesson2rotation);
          expansionBoardModel.scale.copy(modelTransforms.expansionBoard.scale);
          console.log("Updated expansionBoardModel position and rotation for lesson2");
        }
      } catch (e) {
        console.warn("Error updating nano/expansion board for lesson2:", e);
      }
      
      // Reposition battery and its JST pin for lesson2
      try {
        const batteryModel = scene6State.batteryModel;
        const jstPinBattery = scene6State.jstPinBattery;
        const lesson2BatteryPos = new THREE.Vector3(-0.5, 1.8, -3.14);
        const lesson2BatteryJstPos = new THREE.Vector3(-0.5, 1.8, -3.4);
        
        if (batteryModel) {
          batteryModel.position.copy(lesson2BatteryPos);
          batteryModel.visible = true;
        }
        if (jstPinBattery && jstPinBattery.pinGLTF1) {
          jstPinBattery.pinGLTF1.rotation.y = -Math.PI / 2;
          // Update wire start positions for lesson2
          if (jstPinBattery.config && Array.isArray(jstPinBattery.config.wireConfigs)) {
            // Red wire (index 0)
            jstPinBattery.config.wireConfigs[0].startPosition =
              lesson2BatteryJstPos.clone().add(new THREE.Vector3(0.04, 0, 0.2));

            // Green wire (index 1) — your current value
            jstPinBattery.config.wireConfigs[1].startPosition =
              lesson2BatteryJstPos.clone().add(new THREE.Vector3(0, 0, 0.2));

          }
          // Move the JST body and recompute wires
          if (typeof jstPinBattery.updatePosition === 'function') {
            jstPinBattery.updatePosition(lesson2BatteryJstPos, jstPinBattery.pinGLTF1);
          } else if (jstPinBattery.pinGLTF1.position) {
            jstPinBattery.pinGLTF1.position.copy(lesson2BatteryJstPos);
          }
          // Ensure existing wires adopt the updated start positions
          if (Array.isArray(jstPinBattery.wires)) {
            jstPinBattery.wires.forEach((wire, i) => {
              try {
                if (jstPinBattery.config.wireConfigs[i]?.startPosition) {
                  wire.wireConfig.startPosition.copy(jstPinBattery.config.wireConfigs[i].startPosition);
                }
                // keep current end position; geometry will be rebuilt
                wire.updateWire(wire.wireConfig.endPosition);
              } catch (e) {}
            });
          }
        }
      } catch (e) {}

      // Ensure lesson2 visuals are shown/hidden properly
      try {
        const rgbLEDModel = scene6State.rgbLEDModel;
        const jstPin = scene6State.jstPin;
        const tempSensorModel = scene6State.tempSensorModel;
        const jstPin3 = scene6State.jstPin3;
        const buzzerModel = scene6State.buzzerModel;
        const jstPin2 = scene6State.jstPin2;
        
        // Double-check: ensure all lesson1 and lesson3 models are hidden
        if (rgbLEDModel) {
          rgbLEDModel.visible = false;
          console.log("Double-check: Hidden rgbLEDModel for lesson2");
        }
        if (jstPin && jstPin.group) {
          jstPin.group.visible = false;
          console.log("Double-check: Hidden jstPin (lesson1) for lesson2");
        }
        if (tempSensorModel) {
          tempSensorModel.visible = false;
          console.log("Double-check: Hidden tempSensorModel for lesson2");
        }
        if (jstPin3 && jstPin3.group) {
          jstPin3.group.visible = false;
          console.log("Double-check: Hidden jstPin3 group for lesson2");
        }
        
        if (buzzerModel) {
          buzzerModel.visible = true;
          // Ensure it's in the scene
          if (scene && !scene.children.includes(buzzerModel)) {
            scene.add(buzzerModel);
          }
          console.log("Made buzzerModel visible for lesson2");
        }
        if (jstPin2 && jstPin2.group && scene) {
          if (!scene.children.includes(jstPin2.group)) {
            scene.add(jstPin2.group);
          }
          jstPin2.group.visible = true;
          console.log("Made jstPin2 group visible for lesson2");
        }
        if (typeof updateNextButtonState === 'function') {
          updateNextButtonState();
          console.log("Updated next button state for lesson2");
        }
        
        // Refresh raycaster pin models reference to ensure lesson2 JST pins are draggable
        if (scene6State.raycasterSetup && typeof scene6State.raycasterSetup.refreshPinModelsRef === 'function') {
          scene6State.raycasterSetup.refreshPinModelsRef();
          console.log("[Scene6] Refreshed raycaster pin models reference for lesson2");
        }
        
        // Update raycaster with jstPin2 references
        if (scene6State.raycasterSetup && typeof scene6State.raycasterSetup.updateModels === 'function' && jstPin2) {
          scene6State.raycasterSetup.updateModels({
            jstPin2: jstPin2,
            jstPin2Side1: jstPin2.pinGLTF1,
            jstPin2Side2: jstPin2.pinGLTF2,
            nanoModel: scene6State.nanoModel,
            expansionBoardModel: scene6State.expansionBoardModel,
            jstPinBatterySide1: scene6State.jstPinBattery ? scene6State.jstPinBattery.pinGLTF1 : null,
            rgbLEDModel: scene6State.rgbLEDModel,
            tempSensorModel: scene6State.tempSensorModel,
            setForwardArrowEnabled: scene6State.setForwardArrowEnabled,
            getCurrentStep: scene6State.getCurrentStep,
            getCurrentLesson: scene6State.getCurrentLesson
          });
          console.log("[Scene6] Updated raycaster with jstPin2 references for lesson2");
        }
      } catch (e) {
        console.warn("Error setting up lesson2 visuals:", e);
      }
    } else if (nextLesson === "lesson3") {
      // Handle lesson3 specific setup
      console.log("Setting up lesson3 specific components");
      
      // Explicitly ensure jstPin2 from lesson2 is hidden and removed
      const jstPin2ToRemove = scene6State.jstPin2 || window.jstPin2;
      if (jstPin2ToRemove) {
        console.log("[Lesson3 Setup] Ensuring jstPin2 from lesson2 is hidden and removed");
        if (jstPin2ToRemove.group) {
          jstPin2ToRemove.group.visible = false;
          const currentScene = scene6State.currentScene || scene || window.currentScene;
          if (currentScene && currentScene.children.includes(jstPin2ToRemove.group)) {
            currentScene.remove(jstPin2ToRemove.group);
            console.log("[Lesson3 Setup] Removed jstPin2.group from scene");
          }
        }
        if (jstPin2ToRemove.pinGLTF1) {
          jstPin2ToRemove.pinGLTF1.visible = false;
          const currentScene = scene6State.currentScene || scene || window.currentScene;
          if (currentScene && currentScene.children.includes(jstPin2ToRemove.pinGLTF1)) {
            currentScene.remove(jstPin2ToRemove.pinGLTF1);
            console.log("[Lesson3 Setup] Removed jstPin2.pinGLTF1 from scene");
          }
        }
        if (jstPin2ToRemove.pinGLTF2) {
          jstPin2ToRemove.pinGLTF2.visible = false;
          const currentScene = scene6State.currentScene || scene || window.currentScene;
          if (currentScene && currentScene.children.includes(jstPin2ToRemove.pinGLTF2)) {
            currentScene.remove(jstPin2ToRemove.pinGLTF2);
            console.log("[Lesson3 Setup] Removed jstPin2.pinGLTF2 from scene");
          }
        }
      }
      
      // Comprehensive logging of all lesson3 models
      console.log("=== LESSON3 MODELS OVERVIEW ===");
      console.log("All available GLTF models:", Object.keys(allAssets.models.gltf));
      
      // Log lesson3 specific models
      console.log("--- LESSON3 SPECIFIC MODELS ---");
      console.log("tempSensorModel:", {
        exists: !!window.tempSensorModel,
        name: window.tempSensorModel ? window.tempSensorModel.name : "N/A",
        inScene: window.tempSensorModel && scene ? scene.children.includes(window.tempSensorModel) : false,
        visible: window.tempSensorModel ? window.tempSensorModel.visible : false,
        position: window.tempSensorModel ? window.tempSensorModel.position : "N/A",
        scale: window.tempSensorModel ? window.tempSensorModel.scale : "N/A"
      });
      
      console.log("jstPin3 (lesson3 JST pin):", {
        exists: !!window.jstPin3,
        inScene: window.jstPin3 && window.jstPin3.group && scene ? scene.children.includes(window.jstPin3.group) : false,
        visible: window.jstPin3 && window.jstPin3.group ? window.jstPin3.group.visible : false,
        pin1Exists: !!window.jstPin3Side1,
        pin2Exists: !!window.jstPin3Side2
      });
      
      // Log common models that are also used in lesson3
      console.log("--- COMMON MODELS USED IN LESSON3 ---");
      console.log("nanoModel (Arduino):", {
        exists: !!window.nanoModel,
        name: window.nanoModel ? window.nanoModel.name : "N/A",
        inScene: window.nanoModel && scene ? scene.children.includes(window.nanoModel) : false,
        visible: window.nanoModel ? window.nanoModel.visible : false,
        position: window.nanoModel ? window.nanoModel.position : "N/A"
      });
      
      console.log("expansionBoardModel:", {
        exists: !!window.expansionBoardModel,
        name: window.expansionBoardModel ? window.expansionBoardModel.name : "N/A",
        inScene: window.expansionBoardModel && scene ? scene.children.includes(window.expansionBoardModel) : false,
        visible: window.expansionBoardModel ? window.expansionBoardModel.visible : false,
        position: window.expansionBoardModel ? window.expansionBoardModel.position : "N/A"
      });
      
      console.log("batteryModel:", {
        exists: !!window.batteryModel,
        name: window.batteryModel ? window.batteryModel.name : "N/A",
        inScene: window.batteryModel && scene ? scene.children.includes(window.batteryModel) : false,
        visible: window.batteryModel ? window.batteryModel.visible : false,
        position: window.batteryModel ? window.batteryModel.position : "N/A"
      });
      
      console.log("jstPinBattery:", {
        exists: !!window.jstPinBattery,
        inScene: window.jstPinBattery && window.jstPinBattery.group && scene ? scene.children.includes(window.jstPinBattery.group) : false,
        visible: window.jstPinBattery && window.jstPinBattery.group ? window.jstPinBattery.group.visible : false
      });
      
      // Log lesson2 models that should be hidden in lesson3
      console.log("--- LESSON2 MODELS (SHOULD BE HIDDEN IN LESSON3) ---");
      console.log("buzzerModel:", {
        exists: !!window.buzzerModel,
        name: window.buzzerModel ? window.buzzerModel.name : "N/A",
        inScene: window.buzzerModel && scene ? scene.children.includes(window.buzzerModel) : false,
        visible: window.buzzerModel ? window.buzzerModel.visible : false
      });
      
      console.log("jstPin2 (lesson2 JST pin):", {
        exists: !!window.jstPin2,
        inScene: window.jstPin2 && window.jstPin2.group && scene ? scene.children.includes(window.jstPin2.group) : false,
        visible: window.jstPin2 && window.jstPin2.group ? window.jstPin2.group.visible : false
      });
      
      // Log lesson1 models that should be hidden in lesson3
      console.log("--- LESSON1 MODELS (SHOULD BE HIDDEN IN LESSON3) ---");
      console.log("rgbLEDModel:", {
        exists: !!window.rgbLEDModel,
        name: window.rgbLEDModel ? window.rgbLEDModel.name : "N/A",
        inScene: window.rgbLEDModel && scene ? scene.children.includes(window.rgbLEDModel) : false,
        visible: window.rgbLEDModel ? window.rgbLEDModel.visible : false
      });
      
      console.log("jstPin (lesson1 JST pin):", {
        exists: !!window.jstPin,
        inScene: window.jstPin && window.jstPin.group && scene ? scene.children.includes(window.jstPin.group) : false,
        visible: window.jstPin && window.jstPin.group ? window.jstPin.group.visible : false
      });
      
      // Log all scene children to see what's actually in the scene
      console.log("--- ALL SCENE CHILDREN ---");
      if (scene && scene.children) {
        scene.children.forEach((child, index) => {
          console.log(`Scene child ${index}:`, {
            name: child.name || "unnamed",
            type: child.type,
            visible: child.visible,
            isGroup: child.isGroup,
            childrenCount: child.children ? child.children.length : 0
          });
        });
      }
      
      console.log("=== END LESSON3 MODELS OVERVIEW ===");
      
      try {
        // Ensure lesson3 components are visible and in the scene
        if (window.tempSensorModel) {
          if (!scene.children.includes(window.tempSensorModel)) {
            scene.add(window.tempSensorModel);
          }
          window.tempSensorModel.visible = true;
          console.log("Made tempSensorModel visible for lesson3");
        }
        if (window.jstPin3 && window.jstPin3.group) {
          if (!scene.children.includes(window.jstPin3.group)) {
            scene.add(window.jstPin3.group);
          }
          window.jstPin3.group.visible = false;
          console.log(`[DEBUG] jstPin3 (lesson3) added to scene but kept hidden`);
        }
        
        // Double-check: ensure all lesson1 and lesson2 models are hidden
        if (window.rgbLEDModel) {
          window.rgbLEDModel.visible = false;
          console.log("Double-check: Hidden rgbLEDModel for lesson3");
        }
        if (window.jstPin && window.jstPin.group) {
          window.jstPin.group.visible = false;
          console.log("Double-check: Hidden jstPin (lesson1) for lesson3");
        }
        if (window.buzzerModel) {
          window.buzzerModel.visible = false;
          console.log("Double-check: Hidden buzzerModel for lesson3");
        }
        if (window.jstPin2 && window.jstPin2.group) {
          window.jstPin2.group.visible = false;
          console.log("Double-check: Hidden jstPin2 (lesson2) for lesson3");
        }
        if (window.makeSomeNoiseButton) {
          window.makeSomeNoiseButton.visible = false;
          console.log("Double-check: Hidden makeSomeNoiseButton for lesson3");
        }
        
        // Hide battery and its JST pin in lesson3
        if (window.batteryModel) {
          window.batteryModel.visible = false;
          console.log("Battery hidden for lesson3");
        }
        if (window.jstPinBattery && window.jstPinBattery.group) {
          window.jstPinBattery.group.visible = false;
          console.log("jstPinBattery hidden for lesson3");
        }
        
        console.log("Lesson3 components setup completed with comprehensive cleanup");
      } catch (e) {
        console.warn("Error setting up lesson3 components:", e);
      }
    } else if (nextLesson === "lesson4") {
      // Handle lesson4 specific setup
      console.log("Setting up lesson4 specific components");
      
      // Reset lesson4 flags when entering lesson4
      lesson4RunCodeClicked = false;
      lesson4CodeAnimationCompleted = false;
      try { if (typeof window !== 'undefined') { window._lesson4_s7Played = false; window._lesson4_s7Attempted = false; window._lesson4_s8Played = false; } } catch (e) {}
      if (typeof window !== 'undefined') {
        window.lesson4RunCodeClicked = false;
        window.lesson4CodeAnimationCompleted = false;
      }
      
      KpMotorLesson(scene, camera);
    } else if (nextLesson === "lesson5") {
      // Handle lesson5 specific setup
      console.log("Setting up lesson5 specific components");
      
      // Ensure original battery and JST pin are hidden for lesson5
      if (window.batteryModel) {
        window.batteryModel.visible = false;
        console.log("[DEBUG] Hidden original batteryModel for lesson5");
      }
      if (window.jstPinBattery && window.jstPinBattery.group) {
        window.jstPinBattery.group.visible = false;
        console.log("[DEBUG] Hidden original jstPinBattery for lesson5");
      }
      
      KpIRLesson(scene, camera);
    }

    // Log final state after lesson setup
    console.log("=== Final JST Pin States After Lesson Setup ===");
    logJstPinStates();

    // Hide the Next Lesson button after transition
    if (typeof hideNextLessonButton === 'function') hideNextLessonButton();

    updateMakeSomeNoiseButtonVisibility();
  });

  // Initialize OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 0.5;
  controls.maxDistance = 1.15;
  controls.maxPolarAngle = Math.PI / 2;
  controls.minAzimuthAngle = -Math.PI / 6; // Left limit (60 degrees)
  controls.maxAzimuthAngle = Math.PI / 6;  // Right limit (60 degrees)
  controls.target.set(0, 2, -3);
  controls.update();
  
  // Make controls available in scene6State
  scene6State.orbitControls = controls;
  
  // Lesson1 camera targets removed - now behaves like lesson2
  
  // Set camera and controls for player controller
  setCameraAndControls(camera, controls, scene);

  return {
    scene,
    camera,
    renderer,
    controls,
  };
}
export function cleanupScene6() {
  if (stats) {
    stats.dom.remove();
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Clean up event listeners
  if (scene6State._codeEditorRaycastHandler) {
    window.removeEventListener("pointerdown", scene6State._codeEditorRaycastHandler);
    window.removeEventListener("pointermove", scene6State._codeEditorRaycastHandler);
    scene6State._codeEditorRaycastHandler = null;
  }
  if (scene6State._scene6RaycastHandler) {
    window.removeEventListener("pointerdown", scene6State._scene6RaycastHandler);
    scene6State._scene6RaycastHandler = null;
  }
  if (typeof handleKeyNavigation !== 'undefined' && handleKeyNavigation) {
    window.removeEventListener("keydown", handleKeyNavigation);
  }

  destroyGUI();
  cleanupAudioManager();
  cleanupVR();
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
  if (controls) {
    // controls.dispose();
  }
  scene = null;
  camera = null;
  controls = null;
  if (typeof skybox !== 'undefined') {
    skybox = null;
  }

  // Clean up scene6State
  cleanupScene6State();
  
  // Clean up scene6 event listeners
  cleanupScene6EventListeners();
  
  // Clean up scene6 lesson hook
  cleanupScene6LessonHook();
}

/**
 * Shows additional content in the instruction panel after camera animation completes
 * @param {string} lesson - The current lesson name
 * @param {number} stepIndex - The current step index
 */
function showContentAfterCameraAnimation(lesson, stepIndex) {
  // For lesson2, we don't show Next Lesson button - we show Start Learning button instead
  // This function is kept for other lessons but lesson2 is handled elsewhere
  return;
}

function updateLessonVisibility(lessonName) {
  console.log(`[DEBUG] updateLessonVisibility called for lesson: ${lessonName}`);
  
  const buzzerModel = scene6State.buzzerModel;
  const jstPin2 = scene6State.jstPin2;
  const tempSensorModel = scene6State.tempSensorModel;
  const jstPin3 = scene6State.jstPin3;
  const batteryModel = scene6State.batteryModel;
  const jstPinBattery = scene6State.jstPinBattery;
  const nanoModel = scene6State.nanoModel;
  const expansionBoardModel = scene6State.expansionBoardModel;
  const runCodeButton = scene6State.runCodeButton;
  
  // Lesson1 models visibility control
  if (scene6State.rgbLEDModel) {
    scene6State.rgbLEDModel.visible = lessonName === "lesson1";
    console.log(`[DEBUG] rgbLEDModel visibility set to: ${lessonName === "lesson1"}`);
  }
  if (scene6State.jstPin && scene6State.jstPin.group) {
    if (lessonName === "lesson1") {
      if (scene && !scene.children.includes(scene6State.jstPin.group)) {
        scene.add(scene6State.jstPin.group);
      }
      scene6State.jstPin.group.visible = true;
      console.log(`[DEBUG] jstPin (lesson1) made visible and added to scene`);
    } else {
      scene6State.jstPin.group.visible = false;
      console.log(`[DEBUG] jstPin (lesson1) hidden`);
    }
  }

  // Lesson2 models visibility control
  if (buzzerModel) {
    buzzerModel.visible = lessonName === "lesson2";
    console.log(`[DEBUG] buzzerModel visibility set to: ${lessonName === "lesson2"}`);
  }
  // Check both scene6State and window for jstPin2 (in case reference was cleared)
  const jstPin2ToCheck = jstPin2 || scene6State.jstPin2 || window.jstPin2;
  if (jstPin2ToCheck && jstPin2ToCheck.group) {
    if (lessonName === "lesson2") {
      if (scene && !scene.children.includes(jstPin2ToCheck.group)) {
        scene.add(jstPin2ToCheck.group);
      }
      jstPin2ToCheck.group.visible = true;
      console.log(`[DEBUG] jstPin2 (lesson2) made visible and added to scene`);
    } else {
      jstPin2ToCheck.group.visible = false;
      // Also hide individual pins
      if (jstPin2ToCheck.pinGLTF1) jstPin2ToCheck.pinGLTF1.visible = false;
      if (jstPin2ToCheck.pinGLTF2) jstPin2ToCheck.pinGLTF2.visible = false;
      console.log(`[DEBUG] jstPin2 (lesson2) hidden for ${lessonName}`);
    }
  } else if (lessonName !== "lesson2") {
    // If jstPin2 doesn't exist but we're not in lesson2, try to find and hide it via scene traversal
    if (scene) {
      scene.traverse((child) => {
        if (child.name && child.name.includes("jstPin") && child.userData && child.userData.lesson2) {
          child.visible = false;
          console.log(`[DEBUG] Found and hid lesson2 jstPin via scene traversal: ${child.name}`);
        }
      });
    }
  }
  if (makeSomeNoiseButton) {
    if (lessonName === "lesson2") {
      if (scene && !scene.children.includes(makeSomeNoiseButton)) {
        scene.add(makeSomeNoiseButton);
      }
      makeSomeNoiseButton.visible = false; // will be shown after step 1 reveal completes
      console.log(`[DEBUG] makeSomeNoiseButton prepared (hidden) for lesson2; will show after reveal`);
    } else {
      makeSomeNoiseButton.visible = false;
      console.log(`[DEBUG] makeSomeNoiseButton hidden for non-lesson2`);
    }
  }

  // Lesson3 models visibility control
  if (tempSensorModel) {
    tempSensorModel.visible = lessonName === "lesson3";
    console.log(`[DEBUG] tempSensorModel visibility set to: ${lessonName === "lesson3"}`);
  }
  if (jstPin3 && jstPin3.group) {
    if (lessonName === "lesson3") {
      if (scene && !scene.children.includes(jstPin3.group)) {
        scene.add(jstPin3.group);
      }
      jstPin3.group.visible = true;
      console.log(`[DEBUG] jstPin3 (lesson3) made visible and added to scene`);
    } else {
      jstPin3.group.visible = false;
      console.log(`[DEBUG] jstPin3 (lesson3) hidden`);
    }
  }
  
  // Start Coding button visibility control for lesson3
  if (runCodeButton) {
    if (lessonName === "lesson3") {
      // For lesson3, the Start Coding button will be shown after battery connection
      // Don't show it initially, it will appear when needed
      runCodeButton.visible = false;
      console.log(`[DEBUG] Start Coding button hidden initially for lesson3 (will show after battery connection)`);
    } else if (lessonName === "lesson2") {
      // For lesson2, show Start Coding button after power connection
      runCodeButton.visible = false;
      console.log(`[DEBUG] Start Coding button hidden initially for lesson2 (will show after power connection)`);
    } else {
      // For other lessons, hide the Start Coding button
      runCodeButton.visible = false;
      console.log(`[DEBUG] Start Coding button hidden for lesson: ${lessonName}`);
    }
  }

  // Common models visibility rules
  // Battery should NOT carry over into lesson3 and lesson5
  if (batteryModel) {
    const batteryVisible = lessonName !== "lesson3" && lessonName !== "lesson5";
    batteryModel.visible = batteryVisible;
    console.log(`[DEBUG] batteryModel visibility set to: ${batteryVisible} (hidden in lesson3/lesson5)`);
  }
  if (jstPinBattery && jstPinBattery.group) {
    // Hide battery JST in lesson3, lesson4, and lesson5
    const keepVisible = lessonName !== "lesson3" && lessonName !== "lesson4" && lessonName !== "lesson5";
    jstPinBattery.group.visible = keepVisible;
    console.log(
      `[DEBUG] jstPinBattery visibility set to: ${keepVisible} (hidden in lesson3/lesson4/lesson5)`
    );
  }
  if (nanoModel) {
    nanoModel.visible = true;
    console.log(`[DEBUG] nanoModel kept visible for all lessons`);
  }
  if (expansionBoardModel) {
    expansionBoardModel.visible = true;
    console.log(`[DEBUG] expansionBoardModel kept visible for all lessons`);
  }


  // Log final visibility state for debugging
  console.log(`[DEBUG] === Final Model Visibility State for ${lessonName} ===`);
  console.log(`[DEBUG] rgbLEDModel (lesson1): ${scene6State.rgbLEDModel ? scene6State.rgbLEDModel.visible : 'N/A'}`);
  console.log(`[DEBUG] jstPin (lesson1): ${scene6State.jstPin && scene6State.jstPin.group ? scene6State.jstPin.group.visible : 'N/A'}`);
  console.log(`[DEBUG] buzzerModel (lesson2): ${buzzerModel ? buzzerModel.visible : 'N/A'}`);
  console.log(`[DEBUG] jstPin2 (lesson2): ${jstPin2 && jstPin2.group ? jstPin2.group.visible : 'N/A'}`);
  console.log(`[DEBUG] tempSensorModel (lesson3): ${tempSensorModel ? tempSensorModel.visible : 'N/A'}`);
  console.log(`[DEBUG] jstPin3 (lesson3): ${jstPin3 && jstPin3.group ? jstPin3.group.visible : 'N/A'}`);
  console.log(`[DEBUG] ==========================================`);
}
// --- HOOK INTO LESSON CHANGES FOR FUTURE EXTENSION ---
// This will be set up in initializeScene6, not at module load time
let scene6LessonHookSetUp = false;

function setupScene6LessonHook() {
  if (scene6LessonHookSetUp) return;
  
  if (typeof window.setLesson === "function") {
    const originalSetLesson = window.setLesson;
    window.setLesson = function (lessonName) {
      originalSetLesson(lessonName);
      updateLessonVisibility(lessonName); // Use new extensible function
      // Call setupLessonModels if needed for new lessons
      setupLessonModels(scene, lessonName);
    };
  }
  
  // --- INITIAL LESSON SETUP (EXTEND FOR MORE LESSONS) ---
  setLesson("lesson1"); // Always start with lesson1
  updateLessonVisibility("lesson1");
  
  scene6LessonHookSetUp = true;
}

function cleanupScene6LessonHook() {
  // Note: We don't restore the original setLesson here as it might be used elsewhere
  // The hook will be set up again when scene6 is re-initialized
  scene6LessonHookSetUp = false;
}

function updateMakeSomeNoiseButtonVisibility() {
  // Prepare the button in the scene but keep it hidden by default.
  if (!scene.children.includes(makeSomeNoiseButton)) {
    scene.add(makeSomeNoiseButton);
  }
  makeSomeNoiseButton.visible = false;
}

// Add raycast handler for makeSomeNoiseButton
if (!scene6State._makeSomeNoiseRaycastHandler) {
  scene6State._makeSomeNoiseRaycastHandler = (event) => {
    if (!makeSomeNoiseButton.visible) return;
    if (!camera) return; // Prevent error if camera is undefined
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([makeSomeNoiseButton], true);
    if (intersects.length > 0) {
      try {
        // Start blinking jstPin2.pinGLTF1 for lesson2 when button is clicked
        if (typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson2') {
          applyStepShader('lesson2', 1);
        }
      } catch (e) {
        console.warn('[Lesson2] Failed to apply shader on Make Some Noise click:', e);
      }
      // Animate the camera to a target (customize as needed)
      const lookTarget = new THREE.Vector3(0, 2, -3); // Change this to your desired target
      const startQuat = camera.quaternion.clone();
      // Camera lookAt removed - all lessons now have consistent camera behavior
      const endQuat = camera.quaternion.clone();
      camera.quaternion.copy(startQuat);
      const dummy = { t: 0 };
      gsap.to(dummy, {
        t: 1,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
          camera.quaternion.copy(startQuat).slerp(endQuat, dummy.t);
        },
        onComplete: () => {
          camera.quaternion.copy(endQuat);
          // Camera lookAt removed - all lessons now have consistent camera behavior
        },
      });
      // Optionally, hide the button after click
      makeSomeNoiseButton.visible = false;
    }
  };
  window.addEventListener("pointerdown", scene6State._makeSomeNoiseRaycastHandler);
}

/**
 * Comprehensive cleanup function to ensure all lesson models are properly managed
 * @param {string} currentLesson - The lesson we're leaving
 * @param {string} nextLesson - The lesson we're entering
 */
function cleanupLessonModels(currentLesson, nextLesson) {
  console.log(`[DEBUG] cleanupLessonModels called: ${currentLesson} -> ${nextLesson}`);
  
  const rgbLEDModel = scene6State.rgbLEDModel;
  const jstPin = scene6State.jstPin;
  const buzzerModel = scene6State.buzzerModel;
  const jstPin2 = scene6State.jstPin2;
  const tempSensorModel = scene6State.tempSensorModel;
  const jstPin3 = scene6State.jstPin3;
  const batteryModel = scene6State.batteryModel;
  const jstPinBattery = scene6State.jstPinBattery;
  
  // Always hide all lesson-specific models first
  const allLessonModels = [
    { model: rgbLEDModel, name: 'rgbLEDModel', lesson: 'lesson1' },
    { model: jstPin?.group, name: 'jstPin (lesson1)', lesson: 'lesson1' },
    { model: buzzerModel, name: 'buzzerModel', lesson: 'lesson2' },
    { model: jstPin2?.group, name: 'jstPin2 (lesson2)', lesson: 'lesson2' },
    { model: tempSensorModel, name: 'tempSensorModel', lesson: 'lesson3' },
    { model: jstPin3?.group, name: 'jstPin3 (lesson3)', lesson: 'lesson3' },
    { model: makeSomeNoiseButton, name: 'makeSomeNoiseButton', lesson: 'lesson2' },
  ];
  
  // Hide all lesson models first
  allLessonModels.forEach(({ model, name, lesson }) => {
    if (model) {
      model.visible = false;
      console.log(`[DEBUG] Hidden ${name} (${lesson}) during transition`);
    }
  });
  
  // Now show only the models for the next lesson
  if (nextLesson === 'lesson1') {
    if (rgbLEDModel) rgbLEDModel.visible = true;
    if (jstPin?.group) {
      jstPin.group.visible = true;
      // Ensure it's in the scene
      if (scene && !scene.children.includes(jstPin.group)) {
        scene.add(jstPin.group);
      }
    }
    console.log('[DEBUG] Made lesson1 models visible');
  } else if (nextLesson === 'lesson2') {
    if (buzzerModel) {
      buzzerModel.visible = true;
      // Ensure it's in the scene
      if (scene && !scene.children.includes(buzzerModel)) {
        scene.add(buzzerModel);
      }
    }
    if (jstPin2?.group) {
      jstPin2.group.visible = true;
      // Ensure it's in the scene
      if (scene && !scene.children.includes(jstPin2.group)) {
        scene.add(jstPin2.group);
      }
    }
    if (makeSomeNoiseButton) makeSomeNoiseButton.visible = false; // show only after reveal completes
    console.log('[DEBUG] Made lesson2 models visible (Make Some Noise button stays hidden until reveal ends)');
  } else if (nextLesson === 'lesson3') {
    if (tempSensorModel) {
      tempSensorModel.visible = true;
      // Ensure it's in the scene
      if (scene && !scene.children.includes(tempSensorModel)) {
        scene.add(tempSensorModel);
      }
    }
    // Explicitly ensure jstPin2 from lesson2 is hidden for lesson3
    const jstPin2ForLesson3 = jstPin2 || scene6State.jstPin2 || window.jstPin2;
    if (jstPin2ForLesson3) {
      if (jstPin2ForLesson3.group) {
        jstPin2ForLesson3.group.visible = false;
        console.log('[DEBUG] Explicitly hid jstPin2.group for lesson3');
      }
      if (jstPin2ForLesson3.pinGLTF1) {
        jstPin2ForLesson3.pinGLTF1.visible = false;
      }
      if (jstPin2ForLesson3.pinGLTF2) {
        jstPin2ForLesson3.pinGLTF2.visible = false;
      }
    }
    // Also try to find and hide any jstPin2 via scene traversal as a fallback
    if (scene) {
      scene.traverse((child) => {
        // Check if this is jstPin2 by looking for lesson2-specific properties
        if (child.userData && (child.userData.lesson2 || (child.name && child.name.includes("jstPin") && child !== jstPin3?.group && child !== jstPin?.group))) {
          child.visible = false;
          console.log(`[DEBUG] Found and hid potential jstPin2 via scene traversal: ${child.name || 'unnamed'}`);
        }
      });
    }
    // Note: jstPin3 group is kept hidden for lesson3 as requested
    console.log('[DEBUG] Made lesson3 models visible (jstPin3 kept hidden, jstPin2 explicitly hidden)');
  } else if (nextLesson === 'lesson4') {
    // Lesson4 uses the original battery model, so don't hide it
    console.log('[DEBUG] Lesson4 will use the original battery model (handled by KpMotorLesson)');
  } else if (nextLesson === 'lesson5') {
    // Ensure original battery and JST pin are hidden for lesson5
    if (batteryModel) batteryModel.visible = false;
    if (jstPinBattery?.group) jstPinBattery.group.visible = false;
    console.log('[DEBUG] Hidden original battery and JST pin for lesson5 (lesson5 uses its own battery setup)');
  }
  
  console.log(`[DEBUG] cleanupLessonModels completed for ${nextLesson}`);
}
