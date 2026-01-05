/**
 * Electro interaction logic for Scene 2.
 *
 * This module manages:
 *  - Three separate Electro trigger zones (first/second/third encounters)
 *  - Auto‑moving the player into safe positions and locking controls
 *  - Playing Electro’s animation/shape‑key performance plus VO audio
 *  - Providing a robust skip path which still completes objectives, opens gates,
 *    shows the hoverboard and eventually triggers the scene transition to 3.
 *
 * Public API:
 *  - `initializeElectro` — sets up Electro, triggers and animation actions.
 *  - `updateElectro`    — per‑frame update hook called from the Scene 2 loop.
 *  - `setVRMode`        — marks whether Electro logic should respect VR controls.
 */
import * as THREE from "three";
import { TriggerPoint } from "../commonFiles/triggerPoint.js";
import { openGate, switchToElectroFocus, switchToPlayerCamera } from "./scene2.js";
import { setupShapeKeyAnimations } from "../commonFiles/electroShapeKey.js";
import {
  togglePlayerControls,
  playerState,
  updatePlayerAnimation,
  togglePlayerPhysics,
} from "../commonFiles/playerController.js";
import { objectives, hideObjective, showObjective } from "./objectives.js";
import { getVRControls } from "../commonFiles/vrManager.js";
import { playAudio } from "../commonFiles/audiomanager.js";
import { detachPlayerFromHoverboard } from "../commonFiles/hoverboard.js";
import { createSkipButton, showSkipButton, hideSkipButton } from "../commonFiles/skipButton.js";

// Add state variables for Electro movement
let isElectroMoving = false;
let hasTriggeredFirstElectro = false;

// Add state variables for auto movement
let isAutoMoving = false;
let autoMoveDistance = 0;
const maxAutoMoveDistance = 2;
const autoMoveSpeed = 1;

// Add state for electro sequence
let isElectroSequenceActive = false;
let electroSequenceStartTime = 0;
const electroLipsDuration = 14; // Duration for shape key animation
const secondElectroLipsDuration = 20; // Duration for second trigger shape key animation

// Store shape key controls globally
let shapeKeyControls = null;
let isVRMode = false;

// Add these at the top with other state variables
let walkSound = null;
let runSound = null;
let allAssetsRef = null; // Global reference for assets

// Module-level references for Electro components and callbacks (CRITICAL FOR SKIP FUNCTION)
let electroTriggerRef = null;
let secondElectroTriggerRef = null;
let thirdElectroTriggerRef = null;
let showHoverboardCallbackRef = null;
let onThirdElectroSequenceCompleteRef = null;

// Add these safe positions for each trigger zone with their corresponding rotations
const safePositions = {
  first: {
    position: { x: -0.16, y: 1.9, z: -254 },
    rotation: { x: 0, y: Math.PI, z: 0 } // Face towards Electro
  },
  second: {
    position: { x: -2.2, y: 1.9, z: -231 },
    rotation: { x: 0, y: Math.PI, z: 0 } // Face towards Electro
  },
  third: {
    position: { x: -31, y: 4, z: 608 },
    rotation: { x: 0, y: Math.PI, z: 0 } // Face towards Electro
  }
};

// Target positions for Electro model based on which sequence is running (defined by the trigger)
const electroTargetPositions = {
  first: { x: -1, y: 0.6, z: -248, rotationY: Math.PI },  // Initial sequence pos
  second: { x: -3, y: 0.6, z: -225, rotationY: Math.PI }, // Second sequence pos
  third: { x: -31, y: 3, z: 616, rotationY: Math.PI }    // Third sequence pos
};

// Add player reference at the top level
let playerReference = null;
let electroComponents = null;

// Track the active sequence type to select the correct target position
let activeSequenceType = null;

// Add function to move player to safe position
/**
 * Safely repositions the player into a non‑glitched pose for a given trigger.
 *
 * This prevents the player from getting stuck in geometry when Electro
 * sequences begin (especially important when coming from hoverboard motion).
 *
 * @param {THREE.Object3D} player - Player object to move.
 * @param {'first'|'second'|'third'} triggerType - Which trigger zone was entered.
 */
function movePlayerToSafePosition(player, triggerType) {
  if (!player) return;
  
  const safePos = safePositions[triggerType];
  if (!safePos) return;
  
  // Move player to safe position
  player.position.set(
    safePos.position.x,
    safePos.position.y,
    safePos.position.z
  );
  
  // Set player rotation
  player.rotation.set(
    safePos.rotation.x,
    safePos.rotation.y,
    safePos.rotation.z
  );
  
  // Reset player velocity
  if (playerState) {
    playerState.velocity.set(0, 0, 0);
  }
}

/**
 * Enables or disables VR‑specific handling for Electro sequences.
 *
 * In VR mode:
 *  - Keyboard controls remain disabled and VR controls are toggled via `getVRControls`.
 *
 * @param {boolean} mode - True if the scene is running in VR.
 */
export function setVRMode(mode) {
  isVRMode = mode;
}

/**
 * Performs a short auto‑move step forward for the player during Electro sequences.
 *
 * - Moves along the player's current forward vector
 * - Updates `playerState` and animation flags so the proper walk cycle plays
 * - Stops itself after `maxAutoMoveDistance` is reached and returns control.
 *
 * @param {number}       delta         - Frame delta time (seconds).
 * @param {THREE.Object3D} player      - Player object to move.
 * @param {Object}       playerActions - Player animation actions (currently unused hook).
 */
export function autoPlayerMovement(delta, player, playerActions) {
  if (!isAutoMoving) return;

  // Calculate movement based on current player rotation
  const moveDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
    player.quaternion
  );
  const moveAmount = autoMoveSpeed * delta;

  // Move player
  player.position.addScaledVector(moveDirection, moveAmount);
  autoMoveDistance += moveAmount;

  // Check if we've moved the required distance
  if (autoMoveDistance >= maxAutoMoveDistance) {
    isAutoMoving = false;
    autoMoveDistance = 0;

    // Reset player state
    playerState.velocity.set(0, 0, 0);
    playerState.fwdPressed = false;
    playerState.bkdPressed = false;
    playerState.lftPressed = false;
    playerState.rgtPressed = false;
    playerState.shiftPressed = false;

    // Update animation state
    updatePlayerAnimation(false, false);
  } else {
    // Update animation state while moving
    updatePlayerAnimation(true, false);
  }
}

/**
 * Executes the completion logic when the current Electro sequence
 * ends naturally or is skipped.
 *
 * Core responsibilities:
 *  - Stops shape‑key animation and talking, returns Electro to idle
 *  - Opens the gate and hides Electro off‑screen for the next trigger
 *  - Updates Scene 2 objectives and exposes the hoverboard after sequence 2
 *  - Restores controls (VR vs non‑VR handled separately)
 *  - For sequence 3, invokes the scene‑transition callback back in `scene2.js`.
 */
function completeCurrentElectroSequence(electro, electroActions) {
  if (!isElectroSequenceActive || !allAssetsRef) return;

  isElectroSequenceActive = false;
  hideSkipButton(); // Hide skip button

  // Stop currently playing audio
  try {
    const audioKey = 'electro' + activeSequenceType + 'trigger';
    if (allAssetsRef.audios?.[audioKey]?.isPlaying) {
      allAssetsRef.audios[audioKey].stop();
    }
  } catch (e) {
    console.warn("Could not stop current electro trigger audio:", e);
  }
  
  if (shapeKeyControls) {
    shapeKeyControls.stopAnimation();
  }
  
  // Stop talking animation and play idle
  if (electroActions.talking && electroActions.talking.isRunning()) {
    electroActions.talking.fadeOut(0.5).stop();
  }
  electroActions.breathing_idle.reset().play();
  
  // Open gate and remove collision
  openGate();
  
  // Make Electro invisible and reset to off-screen for next trigger
  electro.visible = false;
  electro.position.set(0, 30, 0);
  electro.rotation.set(0, Math.PI, 0);
  
  // Determine which sequence just finished using the stored type
  const currentSequenceType = activeSequenceType;
  activeSequenceType = null; // Clear active state

  // Sequence 1 Completion
  if (currentSequenceType === 'first') {
    if (electroTriggerRef) electroTriggerRef.removeParticleEffects();
    // Show objectives with new text after first sequence
    showObjective(2, objectives);
    // Update current objective number for scene2.js
    if (typeof window.setCurrentObjectiveNumber === 'function') {
      window.setCurrentObjectiveNumber(2);
    }
  } 
  // Sequence 2 Completion
  else if (currentSequenceType === 'second') {
    if (secondElectroTriggerRef) secondElectroTriggerRef.removeParticleEffects();
    showObjective(3, objectives);
    // Update current objective number for scene2.js
    if (typeof window.setCurrentObjectiveNumber === 'function') {
      window.setCurrentObjectiveNumber(3);
    }
    
    // Show hoverboard after second sequence completes
    if (showHoverboardCallbackRef) {
      showHoverboardCallbackRef();
    }
  } 
  // Sequence 3 Completion
  else if (currentSequenceType === 'third') {
    if (thirdElectroTriggerRef) thirdElectroTriggerRef.removeParticleEffects();
  }

  // Re-enable controls properly based on VR mode
  if (isVRMode) {
    // For VR mode, only enable VR controls
    const vrControls = getVRControls();
    if (vrControls) {
      vrControls.enableVRControls();
    }
    togglePlayerControls(false); // Keep keyboard controls disabled
  } else {
    // For non-VR mode, switch back to player camera and enable keyboard controls
    switchToPlayerCamera();
    togglePlayerControls(true);
    
    // Notify scene2.js to switch scenes after camera switch for third sequence
    if (currentSequenceType === 'third') {
      if (onThirdElectroSequenceCompleteRef) {
        onThirdElectroSequenceCompleteRef();
      }
    }
  }
}

/**
 * Immediately aborts the current Electro sequence and jumps to
 * `completeCurrentElectroSequence`.
 *
 * This:
 *  - Cancels auto‑movement and walking/running sounds
 *  - Resets playerState flags and forces idle animation
 *  - Re‑enables physics/controls to avoid the player being locked
 *  - Delegates all objective/gate/scene‑transition logic to the
 *    shared completion helper.
 */
function skipElectroSequence() {
  if (!isElectroSequenceActive || !electroComponents) return;

  console.log("Electro sequence skipped by user.");

  // Manually stop auto-move if it was still going
  isAutoMoving = false;
  
  // Stop any sounds that might be active
  if (walkSound && walkSound.isPlaying) walkSound.stop();
  if (runSound && runSound.isPlaying) runSound.stop();
  // Reset player movement state so the player doesn't keep running after skip
  try {
    if (playerReference) {
      if (playerState) {
        playerState.velocity.set(0, 0, 0);
        playerState.fwdPressed = false;
        playerState.bkdPressed = false;
        playerState.lftPressed = false;
        playerState.rgtPressed = false;
        playerState.shiftPressed = false;
      }
      // Ensure physics and controls are enabled back so player regains control
      try { togglePlayerPhysics(true); } catch (e) { }
      try { togglePlayerControls(true); } catch (e) { }
      // Force animation to idle
      try { updatePlayerAnimation(false, false); } catch (e) { }
    }
  } catch (e) {
    console.warn('Failed to reset player state on skip:', e);
  }

  // Immediately execute the completion logic
  completeCurrentElectroSequence(
    electroComponents.electro, 
    electroComponents.electroActions
  );
}

/**
 * Initializes Electro for Scene 2 and sets up all trigger zones.
 *
 * High‑level behaviour:
 *  - Adds Electro model to the scene and preps shape‑key animations
 *  - Creates three `TriggerPoint`s:
 *      1) Bluezone intro (objective 1 → 2),
 *      2) Hoverboard introduction (objective 2 → 3 + shows hoverboard),
 *      3) University‑entrance trigger (hands over to scene‑transition logic).
 *  - Binds the global skip button to `skipElectroSequence`.
 *
 * @param {THREE.Scene}     scene                  - Active scene instance.
 * @param {Object}          allAssets              - Loaded assets (characters, vfx, audio).
 * @param {THREE.Object3D}  player                 - Player object used for safe repositioning.
 * @param {Function}        showHoverboardCallback - Called when the second sequence completes.
 * @returns {{
 *   electro: THREE.Object3D,
 *   electroTrigger: Object,
 *   secondElectroTrigger: Object,
 *   thirdElectroTrigger: Object,
 *   electroMixer: THREE.AnimationMixer,
 *   electroActions: Object
 * }}
 */
export function initializeElectro(scene, allAssets, player, showHoverboardCallback) {
  // Store player reference
  playerReference = player;
  allAssetsRef = allAssets; // Store reference to allAssets

  // Initialize the skip button UI element and bind the skip function
  createSkipButton(skipElectroSequence);

  // Add electro
  const electro = allAssets.characters.models.electro;
  scene.add(electro);
  // Set initial position off-screen/out of main view area
  electro.position.set(0, 30, 0); 
  electro.rotation.set(0, Math.PI, 0);
  electro.visible = true; // Set to true initially to pre-render off-screen and avoid loading lag

  // Setup shape key animations
  shapeKeyControls = setupShapeKeyAnimations(electro);

  // Add first trigger point at Electro's position
  electroTriggerRef = TriggerPoint(
    allAssets.vfxs.entryvfx,
    { x: 0, y: 0.6, z: -252 },
    scene,
    { x: 1.5, y: 1.5, z: 1.5 },
    () => {
      // Only trigger once
      if (hasTriggeredFirstElectro) return;
      hasTriggeredFirstElectro = true;
      
      activeSequenceType = 'first'; // Set active sequence type
      hideObjective();
      movePlayerToSafePosition(playerReference, 'first');
      
      // Set Electro to target position instantly and ensure visible
      const targetPos = electroTargetPositions[activeSequenceType];
      electro.position.set(targetPos.x, targetPos.y, targetPos.z);
      electro.rotation.set(0, targetPos.rotationY, 0);
      electro.visible = true;
      
      isAutoMoving = true;
      autoMoveDistance = 0;
      togglePlayerControls(false);
      
      const vrControls = getVRControls();
      if (vrControls) {
        vrControls.disableVRControls();
      }

      setTimeout(() => {
        playAudio('electrofirsttrigger');
      }, 1000);
      
      if (!isVRMode) {
        try {
          switchToElectroFocus(electro); // Focus on target position
        } catch (error) {
          console.error('Failed to switch to Electro focus:', error);
        }
      }

      // Stop any playing sounds if they exist
      if (allAssets.audios?.walk) {
        walkSound = allAssets.audios.walk;
        if (walkSound.isPlaying) walkSound.stop();
      }
      if (allAssets.audios?.run) {
        runSound = allAssets.audios.run;
        if (runSound.isPlaying) runSound.stop();
      }
    }
  );

  // Add second trigger point
  secondElectroTriggerRef = TriggerPoint(
    allAssets.vfxs.entryvfx,
    { x: -2.2, y: 0.6, z: -230 },
    scene,
    { x: 1, y: 1, z: 1 },
    () => {
      activeSequenceType = 'second'; // Set active sequence type
      hideObjective();
      movePlayerToSafePosition(playerReference, 'second');
      
      // Set Electro to target position instantly and ensure visible
      const targetPos = electroTargetPositions[activeSequenceType];
      electro.position.set(targetPos.x, targetPos.y, targetPos.z);
      electro.rotation.set(0, targetPos.rotationY, 0);
      electro.visible = true;
      
      isAutoMoving = true;
      autoMoveDistance = 0;
      togglePlayerControls(false);
      
      const vrControls = getVRControls();
      if (vrControls) {
        vrControls.disableVRControls();
      }

      setTimeout(() => {
        playAudio('electrosecondtrigger');
      }, 1000);

      if (!isVRMode) {
        try {
          switchToElectroFocus(electro);
        } catch (error) {
          console.error('Failed to switch to Electro focus (second trigger):', error);
        }
      }

      // Stop any playing sounds if they exist
      if (allAssets.audios?.walk) {
        walkSound = allAssets.audios.walk;
        if (walkSound.isPlaying) walkSound.stop();
      }
      if (allAssets.audios?.run) {
        runSound = allAssets.audios.run;
        if (runSound.isPlaying) runSound.stop();
      }
    }
  );

  // Add third trigger point for scene switching
  thirdElectroTriggerRef = TriggerPoint(
    null, // No VFX for third trigger
    { x: -24, y: 3, z: 680 },
    scene,
    { x: 10, y: 10, z: 10 },
    () => {
      // If player is on hoverboard, detach them first
      if (window.isPlayerOnHoverboard) {
        detachPlayerFromHoverboard();
      }
      activeSequenceType = 'third'; // Set active sequence type
      hideObjective();

      movePlayerToSafePosition(playerReference, 'third');
      
      // Set Electro to target position instantly and ensure visible
      const targetPos = electroTargetPositions[activeSequenceType];
      electro.position.set(targetPos.x, targetPos.y, targetPos.z);
      electro.rotation.set(0, targetPos.rotationY, 0);
      electro.visible = true;
      
      isAutoMoving = true;
      autoMoveDistance = 0;

      setTimeout(() => {
        playAudio('electrothirdtrigger');
      }, 1000);

      togglePlayerControls(false);
      const vrControls = getVRControls();
      if (vrControls) {
        vrControls.disableVRControls();
      }

      if (!isVRMode) {
        try {
          switchToElectroFocus(electro);
        } catch (error) {
          console.error('Failed to switch to Electro focus (third trigger):', error);
        }
      }

      // Stop any playing sounds if they exist
      if (allAssets.audios?.walk) {
        walkSound = allAssets.audios.walk;
        if (walkSound.isPlaying) walkSound.stop();
      }
      if (allAssets.audios?.run) {
        runSound = allAssets.audios.run;
        if (runSound.isPlaying) runSound.stop();
      }
    }
  );

  // Play idle animation for Electro
  const electroMixer = allAssets.characters.animations.electro.mixer;

  // Setup comprehensive Electro animation actions based on scene1 pattern
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

  const electroActions = {};
  Object.entries(actionNames).forEach(([key, name]) => {
    electroActions[key] = allAssets.characters.animations.electro.actions[name];
  });

  // Configure all actions
  Object.values(electroActions).forEach(action => {
    if (action) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
  });

  // Special configuration for talking animation
  if (electroActions.talking) {
    electroActions.talking.timeScale = 0.5;
  }
  
  electroComponents = {
    electro,
    electroTrigger: electroTriggerRef,
    secondElectroTrigger: secondElectroTriggerRef,
    thirdElectroTrigger: thirdElectroTriggerRef,
    electroMixer,
    electroActions
  };

  return electroComponents;
}

/**
 * Per‑frame update hook for Electro, called from Scene 2’s main render loop.
 *
 * Responsibilities:
 *  - Advances the Electro animation mixer
 *  - Updates all three trigger volumes via `updateQuarksScene`
 *  - Drives auto‑move while active and ensures the sequence starts once
 *    auto‑move is in progress
 *  - Times the talking/shape‑key performance and calls the completion helper
 *    when the configured duration elapses.
 *
 * @param {number}             delta
 * @param {THREE.AnimationMixer} electroMixer
 * @param {Object}             electroActions
 * @param {Object}             electroTrigger
 * @param {Object}             secondElectroTrigger
 * @param {Object}             thirdElectroTrigger
 * @param {THREE.Object3D}     player
 * @param {THREE.Vector3}      playerPosition
 * @param {THREE.Object3D}     electro
 * @param {Function}           onThirdElectroSequenceComplete
 * @param {Object}             playerActions
 * @param {Function}           showHoverboardCallback
 */
export function updateElectro(
  delta,
  electroMixer,
  electroActions,
  electroTrigger, // Passed here but using ref
  secondElectroTrigger, // Passed here but using ref
  thirdElectroTrigger, // Passed here but using ref
  player,
  playerPosition,
  electro,
  onThirdElectroSequenceComplete,
  playerActions,
  showHoverboardCallback
) {
  // Store callbacks on the first call
  if (!showHoverboardCallbackRef) {
    showHoverboardCallbackRef = showHoverboardCallback;
    onThirdElectroSequenceCompleteRef = onThirdElectroSequenceComplete;
  }

  if (electroMixer) electroMixer.update(delta);
  if (electroTriggerRef) electroTriggerRef.updateQuarksScene(delta, player);
  if (secondElectroTriggerRef) secondElectroTriggerRef.updateQuarksScene(delta, player);
  if (thirdElectroTriggerRef) thirdElectroTriggerRef.updateQuarksScene(delta, player);

  // Update auto movement if active
  if (isAutoMoving && player) {
    autoPlayerMovement(delta, player, playerActions);
  }

  // Start electro sequence immediately when auto movement starts
  if (isAutoMoving && !isElectroSequenceActive) {
    startElectroSequence(electro, electroActions);
  }

  // Update electro sequence if active
  if (isElectroSequenceActive) {
    const elapsed = (performance.now() - electroSequenceStartTime) / 1000;
    
    // Use the current activeSequenceType to determine the duration
    let currentDuration = electroLipsDuration; 
    if (activeSequenceType === 'second') {
      currentDuration = secondElectroLipsDuration;
    } else if (activeSequenceType === 'third') {
      currentDuration = electroLipsDuration; // Default duration for third
    }

    if (elapsed >= currentDuration) {
      // Sequence complete -> execute completion logic
      completeCurrentElectroSequence(electro, electroActions);
    }
  }
}

/**
 * Starts Electro's talking/waving + shape‑key performance for
 * whichever sequence is currently active.
 *
 * - Plays a short waving loop with a long cross‑fade into talking
 * - Starts the mouth/face shape‑key animation
 * - Shows the global skip button so the player can fast‑forward.
 */
function startElectroSequence(electro, electroActions) {
  isElectroSequenceActive = true;
  electroSequenceStartTime = performance.now();
  
  // SHOW THE SKIP BUTTON HERE
  showSkipButton();
  
  // Start both animations immediately for seamless transition
  electroActions.waving.reset();
  electroActions.waving.setLoop(THREE.LoopRepeat);
  electroActions.waving.repetitions = 2; // Play 2 times
  electroActions.waving.timeScale = 0.5; // Half speed
  electroActions.waving.clampWhenFinished = false;
  electroActions.waving.play(); // Start immediately without fade-in
  
  // Start talking animation immediately with very long fade in
  if (electroActions.talking) {
    electroActions.talking.reset();
    electroActions.talking.setLoop(THREE.LoopRepeat);
    electroActions.talking.clampWhenFinished = false;
    electroActions.talking.fadeIn(2.5).play(); // Very long fade in for seamless transition
  }
  
  // Fade out waving animation after longer overlap
  setTimeout(() => {
    electroActions.waving.fadeOut(2.0).stop();
  }, 2000); // Start fading out waving after 2 seconds of overlap
  
  // Start shape key animation
  if (shapeKeyControls) {
    shapeKeyControls.startAnimation();
  }
}