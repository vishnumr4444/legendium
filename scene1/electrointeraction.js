import * as THREE from "three";
import { setHologramEffect } from "./scene1.js";
import { setupShapeKeyAnimations } from "../commonFiles/electroShapeKey.js";
import {
 togglePlayerControls,
 playerState,
 updatePlayerAnimation,
} from "../commonFiles/playerController.js";
import { createHologram } from "./ufohologram.js";
import { objectives, showObjective } from "./objectives.js";
import { createSkipButton, showSkipButton, hideSkipButton } from "../commonFiles/skipButton.js"; // IMPORTED SKIP BUTTON UTILITY

// Constants
const AUTO_MOVE_CONFIG = {
 maxDistance: 1,
 speed: 1,
 sequenceDuration: 19000, // 18 seconds
 ufoSequenceDuration: 5,
 ufoVolumeRange: { min: 0.15, max: 0.5 }
};

const ELECTRO_POSITION = {
initial: { x: -78, y: 50, z: 22 },
final: { x: 12, y: 9.8, z: -14 },
rotation: { x: 0, y: Math.PI, z: 0 }
};

const UFO_PATH = {
start: { x: -78, y: 40, z: 10 },
end: { x: 12, y: 24, z: -14 },
 arcAmount: 8,
 scale: 0.1
};

// State management
class ElectroState {
 constructor() {
  this.isAutoMoving = false;
  this.autoMoveDistance = 0;
  this.isElectroSequenceActive = false;
  this.isUFOSequenceActive = false;
  this.isElectroSoundPlaying = false;
  this.ufoStartTime = 0;
  this.sceneStartTime = 0;
  this.electroSoundStartTime = 0;
  this.electroSoundDuration = 0;
  this.autoMoveCallback = null;
  this.electroTimeoutIds = [];
  this.isCleanupInProgress = false;
  this.onSequenceCompleteCallback = null; 
  this.triggerPointReference = null; 
 }

 reset() {
  this.isAutoMoving = false;
  this.autoMoveDistance = 0;
  this.isElectroSequenceActive = false;
  this.isUFOSequenceActive = false;
  this.isElectroSoundPlaying = false;
  this.autoMoveCallback = null;
  this.electroTimeoutIds = [];
  this.isCleanupInProgress = false;
  this.onSequenceCompleteCallback = null;
  this.triggerPointReference = null;
 }

 clearTimeouts() {
  this.electroTimeoutIds.forEach(id => clearTimeout(id));
  this.electroTimeoutIds = [];
 }

 cancelAnimationFrame() {
  // No longer needed
 }
}

// Component references
let state = new ElectroState();

// Export state for external access
export function getElectroState() {
 return state;
}
let shapeKeyControls = null;
let allAssets = null;
let electroComponents = null;
let scene = null;
let camera = null;
let player = null;
let controls = null;
let renderer = null;
let ufo = null;
let hologramEffect = null;
let ufoPath = null;
let electroActions = null;
let ufoSound = null;
let spotlight = null;
let ufoUpdateFrameCounter = 0; 

function disposeHologramEffect() {
 if (!hologramEffect) return;
 try {
  if (hologramEffect.meshes) {
   hologramEffect.meshes.forEach((mesh) => {
    if (!mesh) return;
    if (scene?.children?.includes(mesh)) {
     scene.remove(mesh);
    }
    mesh.traverse?.((child) => {
     if (child.isMesh) {
      child.geometry?.dispose?.();
      if (child.material) {
       if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.());
       } else {
        child.material.dispose?.();
       }
      }
     }
    });
   });
  }
  if (hologramEffect.cylinderMesh && scene) {
   scene.remove(hologramEffect.cylinderMesh);
  }
  if (hologramEffect.ringMeshes) {
   hologramEffect.ringMeshes.forEach((mesh) => scene?.remove(mesh));
  }
 } catch (_) {}
 hologramEffect = null;
 setHologramEffect(null);
}

function resetPlayerState() {
 playerState.velocity.set(0, 0, 0);
 playerState.fwdPressed = false;
 playerState.bkdPressed = false;
 playerState.lftPressed = false;
 playerState.rgtPressed = false;
 playerState.shiftPressed = false;
 updatePlayerAnimation(false, false);
}

function setupElectroActions(assets) {
 const actionNames = {
  arm_gesture: 'ARM_GESTURE',
  breathing_idle: 'BREATHING_IDLE',
  entering_code: 'ENTERING_CODE',
  head_nod_yes: 'HEAD_NOD_YES',
  jumping: 'JUMPING',
  landing: 'LANDING',
  looking_behind: 'LOOKING_BEHIND',
  opening_on: 'OPENING_ON ',
  reaching_out: 'REACHING_OUT',
  running: 'RUNNING',
  standing_blocking_idle: 'STANDING_BLOCKING_IDLE',
  talking: 'TALKING',
  talking_02: 'TALKING_02',
  thoughtful_head_shake: 'THOUGHTFUL_ HEAD_ SHAKE',
  walking: 'WALKING',
  waving: 'WAVING'
 };

 const actions = {};
 Object.entries(actionNames).forEach(([key, name]) => {
  actions[key] = assets.characters.animations.electro.actions[name];
 });

 // Configure all actions
 Object.values(actions).forEach(action => {
  if (action) {
   action.setLoop(THREE.LoopOnce);
   action.clampWhenFinished = true;
  }
 });

 // Special configuration for talking animation
 if (actions.talking_02) {
  actions.talking_02.timeScale = 0.5;
 }

 return actions;
}

function createSpotlight() {
 if (spotlight) return spotlight;
 
spotlight = new THREE.SpotLight(0xffffff, 2, 40, Math.PI / 6, 0.3, 1);
spotlight.position.set(12, 15, -14);
spotlight.target.position.set(12, 0, -14);
 scene.add(spotlight);
 scene.add(spotlight.target);
 spotlight.castShadow = true;
 spotlight.shadow.mapSize.width = 1024;
 spotlight.shadow.mapSize.height = 1024;
 spotlight.shadow.bias = -0.002;
 spotlight.shadow.normalBias = 0.02;
 
 return spotlight;
}

// UFO Management
function initializeUFO() {
 if (!scene || !allAssets) {
  console.error("Scene or assets not initialized when trying to create UFO");
  return;
 }

 const ufoModel = allAssets.models.gltf.ufo;
 if (!ufoModel) {
  console.error("UFO model not found in assets");
  return;
 }

 ufo = ufoModel.clone();
 ufo.visible = false;
 ufo.scale.set(UFO_PATH.scale, UFO_PATH.scale, UFO_PATH.scale);
 scene.add(ufo);

 ufoPath = {
  getPoint: (t) => {
   const arcT = Math.sin(Math.PI * t) * UFO_PATH.arcAmount;
   return new THREE.Vector3(
    UFO_PATH.start.x + (UFO_PATH.end.x - UFO_PATH.start.x) * t,
    UFO_PATH.start.y + (UFO_PATH.end.y - UFO_PATH.start.y) * t + arcT * (1 - t),
    UFO_PATH.start.z + (UFO_PATH.end.z - UFO_PATH.start.z) * t
   );
  }
 };
}

function updateUFO() {
 if (!state.isUFOSequenceActive || !ufoPath || !ufo) return;

 const currentTime = performance.now();
 const progress = Math.min((currentTime - state.ufoStartTime) / (AUTO_MOVE_CONFIG.ufoSequenceDuration * 2000), 1);
 const easeProgress = progress < 0.5 
  ? Math.pow(progress, 2) * 2
  : 1 - Math.pow(1 - progress, 2) * 2;

 const position = ufoPath.getPoint(easeProgress);
 ufo.position.copy(position);

 // Update UFO sound volume
 if (ufoSound && ufoSound.isPlaying) {
  const vol = AUTO_MOVE_CONFIG.ufoVolumeRange.min + 
   (AUTO_MOVE_CONFIG.ufoVolumeRange.max - AUTO_MOVE_CONFIG.ufoVolumeRange.min) * easeProgress;
  ufoSound.setVolume(vol);
 }

 if (progress < 1) {
  const nextPoint = ufoPath.getPoint(Math.min(easeProgress + 0.01, 1));
  const direction = new THREE.Vector3().subVectors(nextPoint, position).normalize();
  const angle = Math.atan2(direction.x, direction.z);
  ufo.rotation.y = angle + 2.6 * (1 - easeProgress);
 } else {
  state.isUFOSequenceActive = false;
  if (hologramEffect?.meshes?.[0]) {
   hologramEffect.meshes[0].visible = true;
  }
 }
}

// Hologram Animation
function animateHologram(delta) {
 if (!hologramEffect) return;

 const time = performance.now() * 0.001;

 // Update all time uniforms
 if (hologramEffect.timeUniformMeshes) {
  for (const mesh of hologramEffect.timeUniformMeshes) {
   mesh.material.uniforms.time.value = time;
  }
 }

 // Animate cylinder
 if (hologramEffect.cylinderMesh) {
  const pulseScale = 1 + Math.sin(time * 2) * 0.1;
  hologramEffect.cylinderMesh.scale.set(pulseScale, 1, pulseScale);
  hologramEffect.cylinderMesh.position.y = -2 + Math.sin(time * 1.5) * 0.2;
 }

 // Animate ring meshes
 if (hologramEffect.ringMeshes) {
  for (const mesh of hologramEffect.ringMeshes) {
   mesh.rotation.z += delta * 0.5;
  }
 }
}

// Auto Movement
export function triggerAutoMoveAndDisableControls(player, callback) {
 state.isAutoMoving = true;
 state.autoMoveDistance = 0;
 state.autoMoveCallback = callback;
 togglePlayerControls(false);
 
 if (controls) controls.enabled = false;
 resetPlayerState();
}

export function autoPlayerMovement(delta) {
 if (!state.isAutoMoving || !player) return;
 
 const moveDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
 const moveAmount = AUTO_MOVE_CONFIG.speed * delta;
 player.position.addScaledVector(moveDirection, moveAmount);
 state.autoMoveDistance += moveAmount;
 
 if (state.autoMoveDistance >= AUTO_MOVE_CONFIG.maxDistance) {
  state.isAutoMoving = false;
  state.autoMoveDistance = 0;
  resetPlayerState();
  
  if (typeof state.autoMoveCallback === 'function') {
   state.autoMoveCallback();
   state.autoMoveCallback = null;
  }
 } else {
  updatePlayerAnimation(true, false);
 }
}

// Electro Initialization
export function setDependencies(newCamera, newPlayer, newScene, newControls, newRenderer) {
 camera = newCamera;
 player = newPlayer;
 scene = newScene;
 controls = newControls;
 renderer = newRenderer;
}

export function initializeElectro(sceneArg, assets, playerArg, cameraArg, controlsArg, rendererArg) {
 setDependencies(cameraArg, playerArg, sceneArg, controlsArg, rendererArg);
 allAssets = assets;
 
 initializeUFO();
 // Initialize the skip button UI element
 createSkipButton(skipElectroSequence); 
 
 const electro = allAssets.characters.models.electro;
 if (!electro) {
  console.error("Electro model not found in assets");
  return null;
 }

 scene.add(electro);
 electro.position.set(ELECTRO_POSITION.initial.x, ELECTRO_POSITION.initial.y, ELECTRO_POSITION.initial.z);
 electro.rotation.set(0, Math.PI, 0);
 electro.visible = true;

 shapeKeyControls = setupShapeKeyAnimations(electro);
 electroActions = setupElectroActions(assets);
 
 // Ensure mixer timeScale is normal
 if (allAssets.characters.animations.electro.mixer) {
  allAssets.characters.animations.electro.mixer.timeScale = 1.0;
 }

 electroComponents = {
  electro,
  electroActions,
  electroMixer: allAssets.characters.animations.electro.mixer
 };

//  createSpotlight();
 
 return electroComponents;
}

// Sequence Management
export function startElectroSequence() {
 if (state.isElectroSequenceActive) {
  console.log("Electro sequence already active, ignoring trigger");
  return;
 }
 
 console.log("Starting electro sequence");
 state.isElectroSequenceActive = true;
 state.sceneStartTime = performance.now();
 startUFOSequence();
}

function startUFOSequence() {
 state.isUFOSequenceActive = true;
 state.ufoStartTime = performance.now();
 ufo.visible = true;
 
 if (allAssets.audios.ufosound) {
  ufoSound = allAssets.audios.ufosound;
  ufoSound.setVolume(AUTO_MOVE_CONFIG.ufoVolumeRange.min);
  ufoSound.play();
 }
 
 if (renderer) {
  hologramEffect = createHologram(scene, camera, renderer);
  setHologramEffect(hologramEffect);
  const hologramMesh = hologramEffect.meshes[0];
  hologramMesh.position.set(12, 23.5, -14);
  hologramMesh.visible = false;
  scene.add(hologramMesh);
 }
 
 updateUFO();
}

export function startElectroAppearanceSequence(onComplete, triggerPoint = null) {
 if (!electroComponents?.electro) return;

 // Store callback and trigger point reference for skipping
 state.onSequenceCompleteCallback = onComplete;
 state.triggerPointReference = triggerPoint;

 const electro = electroComponents.electro;
 electro.position.set(ELECTRO_POSITION.final.x, ELECTRO_POSITION.final.y, ELECTRO_POSITION.final.z);
 electro.rotation.set(ELECTRO_POSITION.rotation.x, ELECTRO_POSITION.rotation.y, ELECTRO_POSITION.rotation.z);

 // Hide electro before starting animation to avoid T-pose flash
 electro.visible = false;

 // Start landing animation immediately
 if (electroActions.landing) {
  electroActions.landing.reset();
  electroActions.landing.setLoop(THREE.LoopOnce);
  electroActions.landing.clampWhenFinished = true;
  electroActions.landing.play();

  // Force the mixer to update so the pose is set before showing
  if (electroComponents.electroMixer) {
   electroComponents.electroMixer.update(0.01); // Small delta to apply pose
  }

  // Now show electro
  electro.visible = true;

  // After landing, start talking animation
  const landingDuration = electroActions.landing.getClip().duration * 1000;
  state.electroTimeoutIds.push(setTimeout(() => {
   if (electroActions.talking_02) {
    electroActions.talking_02.reset();
    electroActions.talking_02.setLoop(THREE.LoopRepeat);
    electroActions.talking_02.clampWhenFinished = false;
    electroActions.talking_02.fadeIn(0.5).play();
   }
  }, landingDuration));
 }

 // Play electro sound
 if (allAssets.audios.electrosound) {
  const sound = allAssets.audios.electrosound;
  sound.play();
  state.isElectroSoundPlaying = true;
  state.electroSoundStartTime = performance.now();
  state.electroSoundDuration = sound.buffer?.duration || 0;
 }

 if (shapeKeyControls) {
  shapeKeyControls.startAnimation();
 }

 // SHOW THE SKIP BUTTON HERE (using imported function)
 showSkipButton();

 // After the sequence duration, run the completion steps
 state.electroTimeoutIds.push(setTimeout(completeElectroSequence, AUTO_MOVE_CONFIG.sequenceDuration));
}

/**
 * Executes the completion logic when the sequence ends naturally or is skipped.
 */
function completeElectroSequence() {
  if (!state.isElectroSequenceActive) return; // Prevent double execution

  // Hide the skip button (using imported function)
  hideSkipButton();
  
  // Stop all sounds
  if (allAssets.audios.electrosound?.isPlaying) {
   allAssets.audios.electrosound.stop();
  }
  if (ufoSound?.isPlaying) {
   ufoSound.stop();
  }

  // Stop all electro animations
  if (electroComponents?.electroMixer) {
   electroComponents.electroMixer.stopAllAction();
  }
  // Stop shape key animation
  if (shapeKeyControls && typeof shapeKeyControls.stopAnimation === 'function') {
   shapeKeyControls.stopAnimation();
  }

  // Re-enable controls
  togglePlayerControls(true);
  if (controls) controls.enabled = true;
  
  // Show next objective (2)
  if (typeof showObjective === 'function') showObjective(2, objectives);
  
  // Hide VFX if triggerPoint is provided
  const triggerPoint = state.triggerPointReference;
  if (triggerPoint && typeof triggerPoint.setVFXVisible === 'function') {
   triggerPoint.setVFXVisible(false);
  }
 
  disposeHologramEffect();
  
  // Call the onComplete callback (which in scene1.js triggers the camera transition)
  const onComplete = state.onSequenceCompleteCallback;
  if (typeof onComplete === 'function') onComplete();
  
  // Move electro to (-78, 0, 22)
  if (electroComponents?.electro) {
  electroComponents.electro.position.set(-78, 0, 22);
  }

  // Reset sequence state
  state.isElectroSequenceActive = false;
  state.isUFOSequenceActive = false;
  state.isElectroSoundPlaying = false;
  state.clearTimeouts();
  state.onSequenceCompleteCallback = null;
  state.triggerPointReference = null;
}

/**
 * Immediately stops the sequence and triggers completion/cleanup.
 */
function skipElectroSequence() {
 if (!state.isElectroSequenceActive) return;

 console.log("Electro sequence skipped by user.");
 
 // Clear any pending timeout for natural completion
 state.clearTimeouts();
 
 // Immediately execute the completion logic
 completeElectroSequence();
}

function hideElectroObjects() {
 // Hide Electro
 if (electroComponents?.electro) {
  electroComponents.electro.visible = false;
 }
 // Hide UFO
 if (ufo) {
  ufo.visible = false;
 }
 // Hide Hologram
 if (hologramEffect?.meshes?.[0]) {
  hologramEffect.meshes[0].visible = false;
 }
 // Hide Spotlight
 if (spotlight) {
  spotlight.visible = false;
  if (spotlight.target) spotlight.target.visible = false;
 }
}

function phasedCleanupAllObjects(onComplete, triggerPoint) {
 // Each phase will clean up one object per frame
 const cleanupPhases = [];

 // Stop sounds
 cleanupPhases.push(() => {
  if (ufoSound?.isPlaying) {
   ufoSound.stop();
   ufoSound = null;
  }
 });

 // Remove and dispose hologram
 cleanupPhases.push(() => {
  if (hologramEffect?.meshes?.[0]) {
   const hologramMesh = hologramEffect.meshes[0];
   hologramMesh.traverse((child) => {
    if (child.isMesh) {
     if (child.geometry) child.geometry.dispose();
     if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
      else child.material.dispose();
     }
    }
   });
   scene.remove(hologramMesh);
   hologramEffect = null;
  }
 });

 // Remove and dispose UFO
 cleanupPhases.push(() => {
  if (ufo) {
   ufo.traverse((child) => {
    if (child.isMesh) {
     if (child.geometry) child.geometry.dispose();
     if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
      else child.material.dispose();
     }
    }
   });
   scene.remove(ufo);
   ufo = null;
  }
 });

 // Remove and dispose spotlight
 cleanupPhases.push(() => {
  if (spotlight) {
   scene.remove(spotlight);
   scene.remove(spotlight.target);
   spotlight = null;
  }
 });

 // Remove and dispose Electro
 cleanupPhases.push(() => {
  if (electroComponents?.electro) {
   const electro = electroComponents.electro;
   // Stop all animations
   if (electroComponents.electroMixer) {
    electroComponents.electroMixer.stopAllAction();
   }
   electro.traverse((child) => {
    if (child.isMesh) {
     if (child.geometry) child.geometry.dispose();
     if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
      else child.material.dispose();
     }
    }
   });
   scene.remove(electro);
   electroComponents.electro = null;
  }
 });

 // Final phase: trigger point, controls, objective, callback
 cleanupPhases.push(() => {
  // Remove trigger point
  if (triggerPoint?.removeParticleEffects) {
   triggerPoint.removeParticleEffects();
  }
  // Re-enable controls
  togglePlayerControls(true);
  if (controls) controls.enabled = true;
  // Show objective
  showObjective(2, objectives);
  // Call completion callback
  if (typeof onComplete === 'function') {
   onComplete();
  }
 });

 // Run each phase in a separate animation frame
 function runPhase(index) {
  if (index < cleanupPhases.length) {
   cleanupPhases[index]();
   requestAnimationFrame(() => runPhase(index + 1));
  } else {
   // Reset state at the end
   state.isElectroSequenceActive = false;
   state.isElectroSoundPlaying = false;
   state.isCleanupInProgress = false;
  }
 }
 runPhase(0);
}

function startOptimizedCleanup(onComplete, triggerPoint) {
 if (state.isCleanupInProgress) return;
 state.isCleanupInProgress = true;


hideElectroObjects();
 togglePlayerControls(true);
 if (controls) controls.enabled = true;
  hideSkipButton(); // Ensure button is hidden on optimized cleanup

 // 2. Start phased cleanup in the next frame
 requestAnimationFrame(() => {
 phasedCleanupAllObjects(onComplete, triggerPoint);
 });
}

// Legacy cleanup function (kept for compatibility)
function cleanupElectroSequence(showObjectiveAfter = false) {

 if (showObjectiveAfter) {
 showObjective(2, objectives);
 }
 hideSkipButton();
}

// Main Update Function
export function updateElectro(delta) {
 if (!state.isElectroSequenceActive && !state.isAutoMoving) return;
 
 // Update electro mixer
 if (electroComponents?.electroMixer) {
 electroComponents.electroMixer.update(delta);
 }
 
 // Update UFO sequence
 if (state.isUFOSequenceActive) {
 updateUFO();
 }
 
 // Update hologram animation
 if (hologramEffect) {
 animateHologram(delta);
 }
 
 // Update auto movement
 if (state.isAutoMoving && player) {
 autoPlayerMovement(delta);
 }
}

// Cleanup
export function cleanupElectro() {
 state.cancelAnimationFrame();
 state.clearTimeouts();
 state.reset();
 hideSkipButton(); // Always hide skip button on general cleanup
 
 // Use optimized cleanup for final cleanup
 if (state.isElectroSequenceActive) {
 startOptimizedCleanup(() => {}, null);
 } else {
 cleanupElectroSequence(false);
 }
}
