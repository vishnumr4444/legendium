/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
/**
 * Script Description
 * Zoe interaction and cinematic flow for Scene 3.
 * Created on 2025-12-22 by vishnumr
 */
/*******************************************************************************
 * * OneSource IML | TGI FRIDAY *
 * **************************************************************************
 *
 *
 * Author: vishnumr
 *
 * REVISION HISTORY
 *
 *
 ******************************************************************************/
import * as THREE from "three";
import gsap from "gsap";
import { TriggerPoint } from "../commonFiles/triggerPoint.js";
import {
  togglePlayerControls,
  disableCameraControls,
  enableCameraControls,
  enablePlayerControls,
  hidePlayerModel,
  showPlayerModel,
  setCameraFollowsPlayer,
  setCameraFocusOnPlayer,
  disablePlayerControls,
  updatePlayerAnimation,
  playerState,
} from "../commonFiles/playerController.js";

import { showSceneObjective, hideSceneObjective } from "./objectives.js";
import { showElectroAndRedzone } from "./electroInteraction.js";
import { setupShapeKeyAnimations } from "../commonFiles/electroShapeKey.js";
import {
  createSkipButton,
  showSkipButton,
  hideSkipButton,
} from "../commonFiles/skipButton.js";

// State variables for Zoe's interaction
let hasTriggeredZoe = false;
let zoeCharacter = null;
let zoeMixer = null;
let zoeActions = null;
let zoeTrigger = null;
let zoeSound = null;
let currentCamera = null;
let currentScene = null;
let currentControls = null;
let currentPlayer = null; // Add player reference like scene1
let playerPosition = new THREE.Vector3();
let isSequenceActive = false;
let originalCameraFollowsPlayer = true;
let originalCameraFocusOnPlayer = true;
let originalPlayerControlsEnabled = true;
let zoeSoundDuration = 15;
let electroSoundDuration = 3;
let zoeSound1Duration = 12;
let zoeSound11Duration = 16;
let animationSpeedFactor = 1;
const cameraFocusMoveDuration = 2.5;
const animationCrossFadeDuration = 0.6;

// Skip button state
let skipButtonInitialized = false;
let isSequenceSkipped = false; // Global flag to prevent nested sequences

// Auto-move state variables (similar to scene1)
let isAutoMoving = false;
let autoMoveDistance = 0;
let autoMoveCallback = null;
const AUTO_MOVE_CONFIG = {
  maxDistance: 2, // Increased distance to make movement more visible
  speed: 0.8, // Slower speed for more visible movement
};

// Camera behavior during auto-move
let isAutoMoveCameraAnimating = false;
let autoMoveCameraOriginal = { position: null, target: null };
let autoMoveLookRaf = null;
let autoMoveLookAtTarget = null; // smoothed look target during auto-move
let autoMoveReturnTimer = null;
let _prevControlsDamping = null;

function zoomToElectroThenReturn() {
  if (!currentCamera) return;
  try {
    // Ensure original is captured
    if (!autoMoveCameraOriginal.position) {
      autoMoveCameraOriginal.position = currentCamera.position.clone();
    }
    if (!autoMoveCameraOriginal.target) {
      if (currentControls && currentControls.target) {
        autoMoveCameraOriginal.target = currentControls.target.clone();
      } else {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
          currentCamera.quaternion
        );
        autoMoveCameraOriginal.target = currentCamera.position
          .clone()
          .add(forward);
      }
    }

    // Temporarily disable damping to avoid any perceived lag between look-at and zoom start
    if (currentControls) {
      _prevControlsDamping = {
        enabled: currentControls.enableDamping,
        factor: currentControls.dampingFactor,
      };
      currentControls.enableDamping = false;
      currentControls.dampingFactor = 0;
    }

    // Quick zoom-in to Electro closeup
    const electroCloseupPos = new THREE.Vector3(-8.222, 0.979, -131.244);
    const electroLookAt = new THREE.Vector3(-15, 0.6, -141);

    // Ensure controls immediately target Electro to avoid any gap
    if (currentControls && currentControls.target) {
      currentControls.target.set(
        electroLookAt.x,
        electroLookAt.y,
        electroLookAt.z
      );
      currentControls.update && currentControls.update();
    }

    gsap.to(currentCamera.position, {
      x: electroCloseupPos.x,
      y: electroCloseupPos.y,
      z: electroCloseupPos.z,
      duration: 0.6,
      ease: "power2.inOut",
      onUpdate: () => {
        currentCamera.lookAt(electroLookAt);
      },
      onComplete: () => {
        // Stay for 2.5 seconds, then return
        autoMoveReturnTimer = setTimeout(() => {
          const restoreDuration = 0.8;
          gsap.to(currentCamera.position, {
            x: autoMoveCameraOriginal.position.x,
            y: autoMoveCameraOriginal.position.y,
            z: autoMoveCameraOriginal.position.z,
            duration: restoreDuration,
            ease: "power2.inOut",
            onComplete: () => {
              isAutoMoveCameraAnimating = false;
              // Cleanup
              autoMoveCameraOriginal.position = null;
              autoMoveCameraOriginal.target = null;
              autoMoveLookAtTarget = null;
              autoMoveReturnTimer = null;
              // Restore controls damping
              if (currentControls && _prevControlsDamping) {
                currentControls.enableDamping = _prevControlsDamping.enabled;
                currentControls.dampingFactor = _prevControlsDamping.factor;
              }
              _prevControlsDamping = null;
              // Switch Electro to breathing idle after camera falls back (post-Zoe behavior)
              try {
                if (typeof playElectroBreathingIdleAction === "function")
                  playElectroBreathingIdleAction();
              } catch (_) {}
              // Invoke deferred callback
              if (typeof autoMoveCallback === "function") {
                const cb = autoMoveCallback;
                autoMoveCallback = null;
                cb();
              }
            },
          });
          if (
            currentControls &&
            currentControls.target &&
            autoMoveCameraOriginal.target
          ) {
            gsap.to(currentControls.target, {
              x: autoMoveCameraOriginal.target.x,
              y: autoMoveCameraOriginal.target.y,
              z: autoMoveCameraOriginal.target.z,
              duration: restoreDuration,
              ease: "power2.inOut",
              onUpdate: () => {
                currentControls.update && currentControls.update();
              },
            });
          }
        }, 3800);
      },
    });
    // No additional target tween here to avoid any perceived delay before zoom
  } catch (e) {
    console.warn("Failed during zoom/return sequence:", e);
    isAutoMoveCameraAnimating = false;
    if (typeof autoMoveCallback === "function") {
      const cb = autoMoveCallback;
      autoMoveCallback = null;
      cb();
    }
  }
}

function startAutoMoveCameraSequence() {
  if (!currentCamera) return;
  try {
    isAutoMoveCameraAnimating = true;
    // Do not move camera position; only rotate to look at Electro smoothly with human-like motion.
    const electroLookAt = new THREE.Vector3(-15, 0, -141);

    const startTarget =
      currentControls && currentControls.target
        ? currentControls.target.clone()
        : currentCamera.position
            .clone()
            .add(
              new THREE.Vector3(0, 0, -1).applyQuaternion(
                currentCamera.quaternion
              )
            );

    const durationMs = 2500; // faster smooth look
    const startTime = performance.now();

    const easeInOutCubic = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = easeInOutCubic(t);

      const baseTarget = startTarget.clone().lerp(electroLookAt, eased);

      // Human POV micro adjustments (diminish as we settle on target)
      const jitterScale = 1 - eased;
      const jitterAmp = 0.12 * jitterScale; // small, subtle
      const jitterX = Math.sin(now * 0.0021) * jitterAmp;
      const jitterY = Math.sin(now * 0.0033 + 1.2) * jitterAmp * 0.6;
      const jitterZ = Math.sin(now * 0.0017 + 0.6) * jitterAmp * 0.4;

      const targetWithJitter = baseTarget
        .clone()
        .add(new THREE.Vector3(jitterX, jitterY, jitterZ));

      if (currentControls && currentControls.target) {
        currentControls.target.copy(targetWithJitter);
        currentControls.update && currentControls.update();
      } else {
        currentCamera.lookAt(targetWithJitter);
      }

      if (t < 1 && isAutoMoveCameraAnimating) {
        autoMoveLookRaf = requestAnimationFrame(step);
      } else {
        // Snap to final precise target
        if (currentControls && currentControls.target) {
          currentControls.target.copy(electroLookAt);
          currentControls.update && currentControls.update();
        } else {
          currentCamera.lookAt(electroLookAt);
        }
        autoMoveLookRaf && cancelAnimationFrame(autoMoveLookRaf);
        autoMoveLookRaf = null;
        // Proceed to quick zoom and return sequence
        zoomToElectroThenReturn();
      }
    };

    autoMoveLookRaf && cancelAnimationFrame(autoMoveLookRaf);
    autoMoveLookRaf = requestAnimationFrame(step);
  } catch (e) {
    console.warn("Failed to turn camera towards Electro:", e);
    isAutoMoveCameraAnimating = false;
    if (typeof autoMoveCallback === "function") {
      const cb = autoMoveCallback;
      autoMoveCallback = null;
      cb();
    }
  }
}

// Electro animation helpers for post-Zoe trigger
function stopAllElectroActions() {
  try {
    if (
      zoeElectroCharacter &&
      zoeElectroCharacter.userData &&
      zoeElectroCharacter.userData.zoeActions
    ) {
      Object.values(zoeElectroCharacter.userData.zoeActions).forEach(
        (action) => {
          if (action && action.isRunning && action.isRunning()) {
            action.stop();
          }
        }
      );
    }
  } catch (_) {}
}

function playElectroWavingAction() {
  try {
    if (
      !zoeElectroCharacter ||
      !zoeElectroCharacter.userData ||
      !zoeElectroCharacter.userData.zoeActions
    )
      return;
    const waving = zoeElectroCharacter.userData.zoeActions.waving;
    if (!waving) return;
    zoeElectroCharacter.visible = true;
    stopAllElectroActions();
    waving.reset();
    waving.setLoop(THREE.LoopRepeat);
    waving.clampWhenFinished = false;
    waving.fadeIn(0.3).play();
  } catch (_) {}
}

function playElectroTalking02Action() {
  try {
    if (
      !zoeElectroCharacter ||
      !zoeElectroCharacter.userData ||
      !zoeElectroCharacter.userData.zoeActions
    )
      return;
    const talking02 = zoeElectroCharacter.userData.zoeActions.talking_02;
    if (!talking02) return;
    zoeElectroCharacter.visible = true;
    stopAllElectroActions();
    talking02.reset();
    talking02.setLoop(THREE.LoopRepeat);
    talking02.clampWhenFinished = false;
    talking02.fadeIn(0.3).play();
  } catch (_) {}
}

function playElectroBreathingIdleAction() {
  try {
    if (
      !zoeElectroCharacter ||
      !zoeElectroCharacter.userData ||
      !zoeElectroCharacter.userData.zoeActions
    )
      return;
    const breathing = zoeElectroCharacter.userData.zoeActions.breathing_idle;
    if (!breathing) return;
    zoeElectroCharacter.visible = true;
    stopAllElectroActions();
    breathing.reset();
    breathing.setLoop(THREE.LoopRepeat);
    breathing.clampWhenFinished = false;
    breathing.fadeIn(0.3).play();
  } catch (_) {}
}

// Post-Zoe trigger point
let postZoeTrigger = null;

/**
 * Immediately aborts the Zoe sequence and jumps to its logical "end" state.
 *
 * This is used by the on‑screen skip button and performs very defensive
 * cleanup:
 *  - Kills all GSAP tweens and global timelines
 *  - Stops all Zoe / Electro / shake / VO audio currently playing
 *  - Cancels eye‑blinking, camera focus, vignette and shake effects
 *  - Clears timeouts / intervals / RAFs used within this module
 *  - Restores Electro and HUD video to their original states
 *  - Finally calls `endZoeSequence()` to restore controls and objectives.
 */
function skipZoeSequence() {
  if (!isSequenceActive) return;

  console.log("Zoe sequence skipped by user.");

  // Set global skip flag to prevent any nested sequences from continuing
  isSequenceSkipped = true;

  // Stop all GSAP animations - comprehensive cleanup
  try {
    gsap.killTweensOf(currentCamera.position);
    if (currentControls && currentControls.target) {
      gsap.killTweensOf(currentControls.target);
    }
    gsap.killTweensOf(zoeCharacter.position);
    gsap.killTweensOf(zoeElectroCharacter.position);
    gsap.killTweensOf(zoeElectroCharacter.rotation);
    // Kill ALL GSAP tweens and timelines globally
    gsap.killTweensOf([]);
    gsap.globalTimeline.clear();
    // Kill any specific timelines that might exist
    if (window.zoeTimeline) {
      window.zoeTimeline.kill();
      window.zoeTimeline = null;
    }
  } catch (_) {}

  // Stop all sounds - comprehensive cleanup
  try {
    if (zoeSound && zoeSound.isPlaying) zoeSound.stop();
    if (
      allAssets?.audios?.electrosound1 &&
      allAssets.audios.electrosound1.isPlaying
    )
      allAssets.audios.electrosound1.stop();
    if (allAssets?.audios?.zoesound11 && allAssets.audios.zoesound11.isPlaying)
      allAssets.audios.zoesound11.stop();
    if (allAssets?.audios?.zoesound1 && allAssets.audios.zoesound1.isPlaying)
      allAssets.audios.zoesound1.stop();
    if (
      allAssets?.audios?.electrosound2 &&
      allAssets.audios.electrosound2.isPlaying
    )
      allAssets.audios.electrosound2.stop();
    if (shakeSound && shakeSound.isPlaying) shakeSound.stop();
    if (
      allAssets?.audios?.electroLookat &&
      allAssets.audios.electroLookat.isPlaying
    )
      allAssets.audios.electroLookat.stop();
  } catch (_) {}

  // Stop all Zoe animations
  try {
    if (zoeActions) {
      Object.values(zoeActions).forEach((action) => {
        if (action && action.isRunning()) {
          action.stop();
        }
      });
    }
  } catch (_) {}

  // Stop Electro animations
  try {
    if (zoeElectroCharacter && zoeElectroCharacter.userData.zoeActions) {
      Object.values(zoeElectroCharacter.userData.zoeActions).forEach(
        (action) => {
          if (action && action.isRunning()) {
            action.stop();
          }
        }
      );
    }
  } catch (_) {}

  // Stop shape key animations
  try {
    if (zoeShapeKeyControls) zoeShapeKeyControls.stopAnimation();
  } catch (_) {}

  // Stop HUD video plane
  try {
    if (hudVideoPlane && hudVideoPlane.userData.video) {
      hudVideoPlane.userData.video.pause();
      hudVideoPlane.userData.video.currentTime = 0;
      hudVideoPlane.visible = false;
      if (hudVideoPlane.userData._updateInterval) {
        clearInterval(hudVideoPlane.userData._updateInterval);
        hudVideoPlane.userData._updateInterval = null;
      }
    }
  } catch (_) {}

  // Stop eye blinking
  stopEyeBlinking();

  // Stop camera focus
  stopCameraFocusOnZoe();

  // Stop vignette and shake
  stopVignetteAndShake();

  // Stop auto-move if active
  isAutoMoving = false;
  autoMoveDistance = 0;

  // Clear ALL timeouts/intervals/RAF - comprehensive cleanup
  try {
    // Clear all possible timeouts
    for (let i = 1; i < 10000; i++) {
      clearTimeout(i);
    }
    for (let i = 1; i < 10000; i++) {
      clearInterval(i);
    }

    // Clear specific references
    if (autoMoveReturnTimer) {
      clearTimeout(autoMoveReturnTimer);
      autoMoveReturnTimer = null;
    }
    if (autoMoveLookRaf) {
      cancelAnimationFrame(autoMoveLookRaf);
      autoMoveLookRaf = null;
    }
    if (cameraFocusInterval) {
      clearInterval(cameraFocusInterval);
      cameraFocusInterval = null;
    }
  } catch (_) {}

  // Reset Electro to original state immediately
  try {
    if (zoeElectroCharacter && zoeElectroCharacter.userData.originalState) {
      const originalState = zoeElectroCharacter.userData.originalState;
      zoeElectroCharacter.position.copy(originalState.position);
      zoeElectroCharacter.rotation.copy(originalState.rotation);
      zoeElectroCharacter.visible = originalState.visible;
    }
  } catch (_) {}

  // Hide skip button
  hideSkipButton();

  // Execute completion logic
  endZoeSequence();
}

// Vignette and shake effects
let vignetteEffect = null;
let isVignetteActive = false;
let isShaking = false;
let shakeIntensity = 0.3;
let shakeDuration = 0;
let shakeStartTime = 0;
let shakeInterval = null;
let shakeSound = null;
let preShakeCameraState = { position: null, target: null };
let shakeAngleTimeouts = [];
const SHAKE_CAMERA_ANGLES = [
  new THREE.Vector3(42, 3, -55),
  new THREE.Vector3(50, 2, -70),
];

// Eye blinking
let isEyeBlinking = false;
let lastBlinkTime = 0;
let nextBlinkDelay = 0;
let cameraFocusInterval = null;

// Assets and Electro
let allAssets = null;
let zoeElectroCharacter = null;
let zoeElectroMixer = null;
let originalElectroVisible = false;
let hudVideoPlane = null;
let tvScreenMesh = null;
let zoeShapeKeyControls = null;

/**
 * Entry point for Zoe and Electro setup in Scene 3.
 *
 * What this does:
 *  - Stores references to the scene, assets, camera, controls and player
 *  - Places Zoe in the environment and wires up all her animations
 *  - Creates a trigger point the player must walk into to start the sequence
 *  - Prepares Electro’s cloned rig, animations and shape‑key controller
 *  - Prepares the TV screen mesh so it can later play a HUD video
 *
 * @param {THREE.Scene}  scene           - Active scene instance
 * @param {Object}       assets          - Shared asset bundle (models, vfx, audio, video)
 * @param {THREE.Camera} camera          - Main scene camera
 * @param {Object}       batchSystemRef  - Batched particle system used by triggers/VFX
 * @param {Object}       controlsRef     - OrbitControls (or equivalent) controlling the camera
 * @returns {{zoeCharacter:THREE.Object3D, zoeTrigger:Object, zoeMixer:THREE.AnimationMixer, zoeActions:Object}|null}
 */
export function initializeZoe(
  scene,
  assets,
  camera,
  batchSystemRef,
  controlsRef
) {
  currentCamera = camera;
  currentScene = scene;
  allAssets = assets; // Store allAssets reference
  currentControls = controlsRef; // Store controls reference

  // Find and store player reference
  currentPlayer =
    scene.getObjectByName("playerCapsule") || scene.getObjectByName("player");

  // Ensure TV mesh starts hidden
  try {
    const interiorModel = allAssets?.models?.gltf?.interior;
    if (interiorModel) {
      tvScreenMesh = interiorModel.getObjectByName("tv");
      if (!tvScreenMesh) {
        interiorModel.traverse((child) => {
          if (
            !tvScreenMesh &&
            child.isMesh &&
            typeof child.name === "string" &&
            child.name.toLowerCase().includes("tv")
          ) {
            tvScreenMesh = child;
          }
        });
      }
      if (tvScreenMesh) {
        tvScreenMesh.visible = false;
      }
    }
  } catch (e) {
    console.warn("Could not initialize TV mesh visibility:", e);
  }

  // console.log("Initializing Zoe with camera:", camera);

  // Add Zoe character and preload - Optimize loading
  zoeCharacter = assets.characters.models.zoe;
  scene.add(zoeCharacter);
  zoeCharacter.scale.set(1.3, 1.3, 1.3);
  zoeCharacter.position.set(84, -4.45, -60); // Walking start position
  zoeCharacter.rotation.set(0, -Math.PI / 2, 0); // Zoe faces forward (positive Z direction)
  zoeCharacter.visible = true; // Ensure Zoe is visible

  // Setup Zoe animations
  zoeMixer = assets.characters.animations.zoe.mixer;
  const animations = assets.characters.animations.zoe.actions;

  zoeActions = {
    idleAction: animations.Idle_Armature_Armature,
    walkAction: animations.Walk_Armature_Armature,
    talkAction: animations.wexplain,
    wcircleAction: animations.wcircle_action,
    eyesAction: animations.eyesAction,
    recordAction: animations.record_action,
  };

  // Do not start any Zoe animation automatically on initialization

  // Verify animations are loaded
  if (
    !zoeActions.idleAction ||
    !zoeActions.walkAction ||
    !zoeActions.talkAction ||
    !zoeActions.wcircleAction
  ) {
    console.error(
      "Zoe animations not found. Available animations:",
      Object.keys(animations)
    );
    console.error("Missing animations:", {
      idleAction: !!zoeActions.idleAction,
      walkAction: !!zoeActions.walkAction,
      talkAction: !!zoeActions.talkAction,
      wcircleAction: !!zoeActions.wcircleAction,
    });
    return null;
  }

  console.log("Zoe animations loaded successfully:", {
    idleAction: zoeActions.idleAction.name || "unnamed",
    walkAction: zoeActions.walkAction.name || "unnamed",
    talkAction: zoeActions.talkAction.name || "unnamed",
    wcircleAction: zoeActions.wcircleAction.name || "unnamed",
  });

  // Set animation speeds
  Object.entries(zoeActions).forEach(([key, action]) => {
    if (action) {
      if (key === "eyesAction") {
        action.timeScale = 1.0; // increased from 0.6 for faster eye blinks
      } else if (key === "recordAction") {
        action.timeScale = 0.5; // increased from 0.3 for faster lip/record shape keys
      } else {
        action.timeScale = animationSpeedFactor;
      }
    }
  });
  // Make walking a bit slower without affecting other animations
  if (zoeActions.walkAction) {
    zoeActions.walkAction.timeScale = 0.7;
  }

  // Preload Zoe's sound
  zoeSound = assets.audios.zoesound;

  // Get sound durations
  if (assets.audios) {
    zoeSoundDuration = assets.audios.zoesound?.duration || 15;
    electroSoundDuration = assets.audios.electrosound1?.duration || 3;
    zoeSound1Duration = assets.audios.zoesound1?.duration || 12;
  }

  // Add trigger point at the VFX location
  zoeTrigger = TriggerPoint(
    assets.vfxs.vfx,
    { x: 75, y: -5.5, z: -60 },
    scene,
    { x: 2, y: 2, z: 2 }, // Increased trigger area
    () => {
      if (hasTriggeredZoe || isSequenceActive) return;
      hasTriggeredZoe = true;

      console.log(
        "Player has reached Zoe's location! Player position:",
        playerPosition
      );

      // Hide current objective during Zoe interaction
      try {
        hideSceneObjective();
      } catch (_) {}

      // Start Zoe's sequence
      startZoeSequence();
    }
  );

  // Scale the VFX effect in the trigger
  if (zoeTrigger && zoeTrigger.effect1) {
    zoeTrigger.effect1.scale.set(0.2, 0.2, 0.2);
    if (zoeTrigger.effect1.emitters) {
      zoeTrigger.effect1.emitters.forEach((emitter) => {
        if (emitter.scale) {
          emitter.scale.multiplyScalar(0.2);
        }
        if (emitter.velocity) {
          emitter.velocity.multiplyScalar(0.2);
        }
        if (emitter.size) {
          emitter.size.multiplyScalar(0.2);
        }
      });
    }
  }

  // Preload animations and start idle so Zoe is idling before the trigger
  setTimeout(() => {
    if (zoeCharacter) {
      Object.values(zoeActions).forEach((action) => {
        if (action) {
          action.reset();
          action.paused = true;
        }
      });
      // Start Zoe idle so she idles before the trigger happens
      try {
        startZoeIdle();
      } catch (e) {
        if (zoeActions.idleAction && !zoeActions.idleAction.isRunning()) {
          zoeActions.idleAction.reset();
          zoeActions.idleAction.setLoop(THREE.LoopRepeat);
          zoeActions.idleAction.clampWhenFinished = false;
          zoeActions.idleAction.paused = false;
          zoeActions.idleAction.fadeIn(0.3).play();
        }
      }
    }
  }, 100);

  // Preload shake sound
  shakeSound = assets.audios.shakesound;
  if (shakeSound) {
    // Set up positional audio
    shakeSound.setVolume(0.3); // Start with lower volume
    shakeSound.setLoop(true); // Loop the shake sound
    shakeSound.setRefDistance(20); // Adjust based on your scene scale
    shakeSound.setRolloffFactor(2); // Adjust rolloff for distance
  }

  // Store reference to original Electro model
  if (assets.characters && assets.characters.models.electro) {
    zoeElectroCharacter = assets.characters.models.electro;

    // Store original visibility state
    originalElectroVisible = zoeElectroCharacter.visible;

    // Create new mixer for animations
    if (assets.characters.animations.electro) {
      zoeElectroMixer = new THREE.AnimationMixer(zoeElectroCharacter);
      zoeElectroCharacter.userData.zoeActions = {};

      // Create new animations with proper action names like in scene 1
      const actionNames = {
        arm_gesture: "ARM_GESTURE",
        breathing_idle: "BREATHING_IDLE",
        entering_code: "ENTERING_CODE",
        head_nod_yes: "HEAD_NOD_YES",
        jumping: "JUMPING",
        landing: "LANDING",
        looking_behind: "LOOKING_BEHIND",
        opening_on: "OPENING_ON ",
        reaching_out: "REACHING_OUT",
        running: "RUNNING",
        standing_blocking_idle: "STANDING_BLOCKING_IDLE",
        talking: "TALKING",
        talking_02: "TALKING_02",
        thoughtful_head_shake: "THOUGHTFUL_ HEAD_ SHAKE",
        walking: "WALKING",
        waving: "WAVING",
        SAD_TALKING: "SAD_TALKING",
        FALLING: "FALLING",
      };

      Object.entries(actionNames).forEach(([key, name]) => {
        const originalAction =
          assets.characters.animations.electro.actions[name];
        if (originalAction) {
          const newAction = zoeElectroMixer.clipAction(
            originalAction.getClip()
          );
          newAction.setEffectiveTimeScale(animationSpeedFactor);
          newAction.setLoop(THREE.LoopOnce);
          newAction.clampWhenFinished = true;
          zoeElectroCharacter.userData.zoeActions[key] = newAction;
        }
      });

      // Special configuration for talking_02 animation like in scene 1
      if (zoeElectroCharacter.userData.zoeActions.talking_02) {
        zoeElectroCharacter.userData.zoeActions.talking_02.timeScale = 1;
      }
    }

    // Prepare shape key animation controller for Electro shown during Zoe sequence
    try {
      zoeShapeKeyControls = setupShapeKeyAnimations(zoeElectroCharacter);
    } catch (_) {
      zoeShapeKeyControls = null;
    }
  }

  return {
    zoeCharacter,
    zoeTrigger,
    zoeMixer,
    zoeActions,
  };
}

/**
 * High‑level orchestrator for the full Zoe cinematic sequence.
 *
 * Rough flow:
 *  1. Disable player and camera controls and hide the player model.
 *  2. Move camera into a fixed shot on Zoe and play walk → talk animations.
 *  3. Play Zoe’s first VO, then cut to Electro for his response.
 *  4. Cut back to Zoe for additional dialogue and a HUD TV insert.
 *  5. Transition into Electro’s sad talking + breathing idle and finally
 *     return control to the player with updated objectives and a new trigger.
 *
 * Many sub‑helpers (eye blinking, camera focus, vignette, shake, HUD TV, etc.)
 * are coordinated from here.
 */
function startZoeSequence() {
  if (isSequenceActive) return;
  isSequenceActive = true;

  // Reset skip flag at start
  isSequenceSkipped = false;

  console.log("Starting Zoe sequence");

  // Initialize skip button if not already done
  if (!skipButtonInitialized) {
    createSkipButton(skipZoeSequence);
    skipButtonInitialized = true;
  }

  // Show skip button
  showSkipButton();

  // Create vignette effect
  createVignetteEffect();

  // Completely disable player controls and camera controls
  disablePlayerControls();
  togglePlayerControls(false);
  disableCameraControls();

  // Directly disable OrbitControls
  if (currentControls) {
    currentControls.enabled = false;
  }

  // Disable camera following player
  setCameraFollowsPlayer(false);
  setCameraFocusOnPlayer(false);

  // Hide player model during the sequence
  hidePlayerModel();

  // Focus camera on Zoe
  if (zoeCharacter && currentCamera) {
    // Store original camera position and target for restoration
    currentCamera.userData.originalPosition = currentCamera.position.clone();

    // Store original controls target if available
    if (currentControls && currentControls.target) {
      currentCamera.userData.originalControlsTarget =
        currentControls.target.clone();
    }

    // Set camera to specific position and look at Zoe
    const targetCameraPosition = new THREE.Vector3(79, -2.7, -60); // Fixed camera position
    const zoeLookAtPosition = new THREE.Vector3(82, -2.7, -60); // Fixed look-at position

    // Small delay to ensure Zoe is positioned
    setTimeout(() => {
      // Smoothly move camera to fixed position
      gsap.to(currentCamera.position, {
        x: targetCameraPosition.x,
        y: targetCameraPosition.y,
        z: targetCameraPosition.z,
        duration: cameraFocusMoveDuration,
        ease: "power2.inOut",
        onUpdate: () => {
          // Make camera look at the fixed Zoe position
          currentCamera.lookAt(zoeLookAtPosition);
        },
      });

      // Update controls target to the fixed Zoe position
      if (currentControls && currentControls.target) {
        gsap.to(currentControls.target, {
          x: zoeLookAtPosition.x,
          y: zoeLookAtPosition.y,
          z: zoeLookAtPosition.z,
          duration: cameraFocusMoveDuration,
          ease: "power2.inOut",
        });
      }
    }, 100); // Small delay to ensure Zoe is ready
  }

  // Prepare Zoe
  console.log("Preparing Zoe");

  // Stop non-idle animations first, then reset them; keep idle running for a smooth crossfade
  Object.entries(zoeActions).forEach(([name, action]) => {
    if (!action) return;
    if (name !== "idleAction") {
      if (action.isRunning()) {
        action.stop();
        console.log("Stopped running animation:", action.name || "unnamed");
      }
      action.reset();
      action.paused = true;
    }
  });

  setTimeout(() => {
    // Crossfade from idle to walk to avoid any T-pose between them
    if (zoeActions.walkAction) {
      zoeActions.walkAction.reset();
      zoeActions.walkAction.setLoop(THREE.LoopOnce);
      zoeActions.walkAction.clampWhenFinished = true;
      zoeActions.walkAction.enabled = true;
      const fromIdle =
        zoeActions.idleAction && zoeActions.idleAction.isRunning()
          ? zoeActions.idleAction
          : null;
      if (fromIdle) {
        zoeActions.walkAction
          .crossFadeFrom(fromIdle, animationCrossFadeDuration, false)
          .play();
      } else {
        zoeActions.walkAction.fadeIn(0.2).play();
      }
      console.log("Started walking animation with crossfade from idle");
      setTimeout(() => {
        if (zoeActions.walkAction.isRunning()) {
          console.log("Walk animation successfully started");
        } else {
          console.warn("Walk animation failed to start");
        }
        // After walk takes over, stop idle if still running
        if (zoeActions.idleAction && zoeActions.idleAction.isRunning()) {
          zoeActions.idleAction.stop();
        }
      }, animationCrossFadeDuration * 1000 + 50);
    }

    const pathPoints = [
      new THREE.Vector3(84, -4.45, -60),
      new THREE.Vector3(81.5, -4.45, -60),
    ];

    const startPosition = pathPoints[0].clone();
    const endPosition = pathPoints[1].clone();
    const walkDuration = 2.8;
    const startTime = Date.now();

    function updateZoePosition() {
      if (!isSequenceActive || !zoeCharacter.visible) return;

      const elapsedTime = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsedTime / walkDuration, 1);

      zoeCharacter.position.lerpVectors(startPosition, endPosition, progress);

      // Keep Zoe's initial rotation (0, 0, 0) - no rotation changes during interaction

      if (progress < 1) {
        requestAnimationFrame(updateZoePosition);
      } else {
        // Remove VFX as soon as Zoe arrives
        if (zoeTrigger) {
          zoeTrigger.removeParticleEffects();
        }

        // Smoothly blend from walking to talking
        if (zoeActions.talkAction && zoeActions.walkAction) {
          // Stop idle animation if it's still running
          if (zoeActions.idleAction && zoeActions.idleAction.isRunning()) {
            zoeActions.idleAction.stop();
            console.log(
              "Stopped idle animation during walk-to-talk transition"
            );
          }

          zoeActions.talkAction.reset();
          zoeActions.talkAction.enabled = true;
          zoeActions.talkAction
            .crossFadeFrom(
              zoeActions.walkAction,
              animationCrossFadeDuration,
              false
            )
            .play();
          // Stop walk after the crossfade completes
          setTimeout(() => {
            if (zoeActions.walkAction && zoeActions.walkAction.isRunning()) {
              zoeActions.walkAction.stop();
              console.log("Stopped walk animation after crossfade");
            }
          }, animationCrossFadeDuration * 1000 + 50);
        } else if (zoeActions.talkAction) {
          // Stop idle animation if it's still running
          if (zoeActions.idleAction && zoeActions.idleAction.isRunning()) {
            zoeActions.idleAction.stop();
            console.log("Stopped idle animation before talk");
          }

          zoeActions.talkAction.reset();
          zoeActions.talkAction.fadeIn(0.3).play();
        }

        // Play eyes and record actions simultaneously with talk action
        ["eyesAction", "recordAction"].forEach((actionKey) => {
          if (zoeActions[actionKey]) {
            zoeActions[actionKey].paused = false;
            zoeActions[actionKey].play();
          }
        });

        // Start random eye blinking
        startEyeBlinking();

        // Start continuous camera focus on Zoe
        startCameraFocusOnZoe();

        // Play Zoe's first sound
        if (zoeSound) {
          console.log("Playing Zoe's first sound");
          zoeSound.play();

          // Wait for Zoe's first sound to finish before moving to Electro
          setTimeout(() => {
            if (isSequenceSkipped) return; // Skip if sequence was skipped
            console.log("Zoe's first sound finished, moving to Electro");

            // Show and position Electro
            if (zoeElectroCharacter) {
              // Store original position and rotation
              const originalPosition = zoeElectroCharacter.position.clone();
              const originalRotation = zoeElectroCharacter.rotation.clone();

              // Make Electro visible and position it
              zoeElectroCharacter.visible = true;
              zoeElectroCharacter.position.set(81, -4.45, -63);
              zoeElectroCharacter.rotation.set(0, -Math.PI / 2, 0);

              // Start Electro shape key animation during his appearance in Zoe sequence
              try {
                if (zoeShapeKeyControls) zoeShapeKeyControls.startAnimation();
              } catch (_) {}

              // Play Electro's talk animation using talking action like in scene 1
              if (
                zoeElectroCharacter.userData.zoeActions &&
                zoeElectroCharacter.userData.zoeActions.talking
              ) {
                zoeElectroCharacter.userData.zoeActions.talking.reset();
                zoeElectroCharacter.userData.zoeActions.talking.setLoop(
                  THREE.LoopRepeat
                );
                zoeElectroCharacter.userData.zoeActions.talking.clampWhenFinished = false;
                zoeElectroCharacter.userData.zoeActions.talking
                  .fadeIn(0.5)
                  .play();
              }

              // Store original state for restoration
              zoeElectroCharacter.userData.originalState = {
                position: originalPosition,
                rotation: originalRotation,
                visible: originalElectroVisible,
              };
            }

            // Set global flag for Electro sequence
            window.isElectroSequencePlaying = true;

            // Camera cut shot to Electro
            if (currentCamera) {
              // Instant camera cut to Electro position
              currentCamera.position.set(80, -3.8, -63);
              currentCamera.lookAt(new THREE.Vector3(81, -3.6, -63));

              // Update controls target to Electro position
              if (currentControls && currentControls.target) {
                currentControls.target.set(81, -4, -63);
              }
            }

            // Play Electro's sound
            if (
              allAssets &&
              allAssets.audios &&
              allAssets.audios.electrosound1
            ) {
              console.log("Playing Electro's sound");
              const electroSound = allAssets.audios.electrosound1;

              // Pause Zoe's current actions
              ["talkAction", "eyesAction", "recordAction"].forEach(
                (actionKey) => {
                  if (
                    zoeActions[actionKey] &&
                    zoeActions[actionKey].isRunning()
                  ) {
                    zoeActions[actionKey].paused = true;
                  }
                }
              );

              // Stop eye blinking during Electro's part
              stopEyeBlinking();

              electroSound.play();

              // Wait for Electro's sound to finish before returning to Zoe
              setTimeout(() => {
                if (isSequenceSkipped) return; // Skip if sequence was skipped
                console.log("Electro's sound finished, returning to Zoe");

                // Restore Electro's original state
                if (
                  zoeElectroCharacter &&
                  zoeElectroCharacter.userData.originalState
                ) {
                  const originalState =
                    zoeElectroCharacter.userData.originalState;
                  zoeElectroCharacter.position.copy(originalState.position);
                  zoeElectroCharacter.rotation.copy(originalState.rotation);
                  zoeElectroCharacter.visible = originalState.visible;

                  // Stop shape key animation when Electro hides/returns to original
                  try {
                    if (zoeShapeKeyControls)
                      zoeShapeKeyControls.stopAnimation();
                  } catch (_) {}

                  // Stop any playing animations
                  if (zoeElectroCharacter.userData.zoeActions) {
                    Object.values(
                      zoeElectroCharacter.userData.zoeActions
                    ).forEach((action) => {
                      if (action.isRunning()) {
                        action.stop();
                      }
                    });
                  }
                }

                // Camera cut shot back to Zoe
                if (currentCamera) {
                  // Instant camera cut back to Zoe position
                  currentCamera.position.set(79.5, -2.5, -60);
                  currentCamera.lookAt(new THREE.Vector3(82, -2.5, -60));

                  // Update controls target back to Zoe position
                  if (currentControls && currentControls.target) {
                    currentControls.target.set(82, -2.5, -60);
                  }
                }

                // Resume Zoe's actions
                ["talkAction", "eyesAction", "recordAction"].forEach(
                  (actionKey) => {
                    if (zoeActions[actionKey]) {
                      zoeActions[actionKey].paused = false;
                    }
                  }
                );

                // Resume eye blinking
                startEyeBlinking();

                // Play Zoe's sound11
                if (
                  allAssets &&
                  allAssets.audios &&
                  allAssets.audios.zoesound11
                ) {
                  console.log("Playing Zoe's sound11");
                  const zoeSound11 = allAssets.audios.zoesound11;
                  zoeSound11.play();

                  const middlePoint = (zoeSound11Duration * 1000) / 2;
                  setTimeout(() => {
                    if (isSequenceSkipped) return; // Skip if sequence was skipped
                    console.log("Playing wcircle_action animation");
                    if (zoeActions.wcircleAction) {
                      // Stop current animations
                      ["talkAction", "eyesAction", "recordAction"].forEach(
                        (actionKey) => {
                          if (
                            zoeActions[actionKey] &&
                            zoeActions[actionKey].isRunning()
                          ) {
                            zoeActions[actionKey].paused = true;
                          }
                        }
                      );

                      // Stop eye blinking during wcircle
                      stopEyeBlinking();

                      // Create and show HUD video
                      if (!hudVideoPlane) {
                        console.log("Creating HUD video TV material");
                        hudVideoPlane = createHUDVideoPlane();
                        // Do NOT add to scene; it's an existing mesh in the interior
                      }

                      if (hudVideoPlane) {
                        hudVideoPlane.userData.loadPromise
                          .then(() => {
                            const video = hudVideoPlane.userData.video;
                            hudVideoPlane.visible = true;
                            video.currentTime = 0;
                            video.play().catch((e) => {
                              console.warn("TV video play failed:", e);
                            });

                            video.addEventListener("ended", () => {
                              if (hudVideoPlane) {
                                hudVideoPlane.visible = false;
                                video.currentTime = 0;
                                video.pause();
                              }
                            });

                            video.loop = false;
                          })
                          .catch(() => {
                            if (hudVideoPlane) {
                              try {
                                if (
                                  hudVideoPlane.userData &&
                                  hudVideoPlane.userData.originalMaterial
                                ) {
                                  hudVideoPlane.material =
                                    hudVideoPlane.userData.originalMaterial;
                                }
                                hudVideoPlane.visible = false;
                              } catch (_) {}
                            }
                          });
                      }

                      // Play wcircle_action once
                      zoeActions.wcircleAction.reset();
                      zoeActions.wcircleAction.setLoop(THREE.LoopOnce);
                      zoeActions.wcircleAction.clampWhenFinished = true;
                      zoeActions.wcircleAction.fadeIn(0.5).play();

                      // After 4 seconds, switch back to talk action
                      setTimeout(() => {
                        if (isSequenceSkipped) return; // Skip if sequence was skipped
                        if (zoeActions.wcircleAction.isRunning()) {
                          zoeActions.wcircleAction.paused = true;
                        }

                        // Resume actions
                        ["talkAction", "eyesAction", "recordAction"].forEach(
                          (actionKey) => {
                            if (zoeActions[actionKey]) {
                              zoeActions[actionKey].paused = false;
                            }
                          }
                        );

                        startEyeBlinking();
                      }, 4000);
                    }
                  }, middlePoint);

                  // After zoesound11 finishes, play zoesound1
                  setTimeout(() => {
                    if (isSequenceSkipped) return; // Skip if sequence was skipped
                    if (allAssets?.audios?.zoesound1) {
                      const zoeSound1 = allAssets.audios.zoesound1;
                      zoeSound1.play();
                      startVignetteAndShake();

                      // End sequence after Zoe's second sound
                      setTimeout(() => {
                        if (isSequenceSkipped) return; // Skip if sequence was skipped
                        if (allAssets?.audios?.electrosound2) {
                          const electroSound2 = allAssets.audios.electrosound2;

                          // Make Zoe disappear
                          if (zoeCharacter) {
                            zoeCharacter.visible = false;
                          }

                          // Show and position Electro
                          if (zoeElectroCharacter) {
                            zoeElectroCharacter.visible = true;
                            zoeElectroCharacter.position.set(81, -4.45, -63);
                            zoeElectroCharacter.rotation.set(
                              0,
                              -Math.PI / 2,
                              0
                            );

                            if (
                              zoeElectroCharacter.userData.zoeActions &&
                              zoeElectroCharacter.userData.zoeActions
                                .SAD_TALKING
                            ) {
                              zoeElectroCharacter.userData.zoeActions.SAD_TALKING.reset();
                              zoeElectroCharacter.userData.zoeActions.SAD_TALKING.setLoop(
                                THREE.LoopOnce
                              );
                              // Clamp to last frame to avoid T-pose if timing drifts
                              zoeElectroCharacter.userData.zoeActions.SAD_TALKING.clampWhenFinished = true;
                              zoeElectroCharacter.userData.zoeActions.SAD_TALKING.fadeIn(
                                0.5
                              ).play();

                              // After SAD_TALKING completes, cross-fade to breathing_idle in loop (match electroInteraction style)
                              // Compute when to start the crossfade slightly before the end of SAD_TALKING, with mixer 'finished' fallback
                              (function () {
                                const actions =
                                  zoeElectroCharacter.userData.zoeActions;
                                const fromAction = actions.SAD_TALKING;
                                const toAction = actions.breathing_idle;
                                if (!toAction) return;

                                const crossFadeDuration = 0.5; // seconds
                                const clip = fromAction.getClip();
                                const effectiveScale =
                                  typeof fromAction.getEffectiveTimeScale ===
                                  "function"
                                    ? Math.max(
                                        0.0001,
                                        fromAction.getEffectiveTimeScale()
                                      )
                                    : 1.0;
                                const totalDurationSec =
                                  (clip?.duration || 0) / effectiveScale;
                                const startDelayMs = Math.max(
                                  0,
                                  (totalDurationSec - crossFadeDuration) * 1000
                                );

                                // Prepare target action similar to electroInteraction style
                                toAction.enabled = true;
                                toAction.reset();
                                toAction.setLoop(THREE.LoopRepeat);
                                toAction.clampWhenFinished = false;
                                if (
                                  typeof toAction.setEffectiveTimeScale ===
                                  "function"
                                ) {
                                  toAction.setEffectiveTimeScale(
                                    animationSpeedFactor
                                  );
                                }
                                if (
                                  typeof toAction.setEffectiveWeight ===
                                  "function"
                                ) {
                                  toAction.setEffectiveWeight(1);
                                }

                                let started = false;
                                const startBreathing = () => {
                                  if (started) return;
                                  started = true;
                                  if (
                                    typeof toAction.crossFadeFrom === "function"
                                  ) {
                                    toAction
                                      .crossFadeFrom(
                                        fromAction,
                                        crossFadeDuration,
                                        false
                                      )
                                      .play();
                                  } else {
                                    try {
                                      fromAction &&
                                        fromAction.fadeOut &&
                                        fromAction.fadeOut(crossFadeDuration);
                                    } catch (_) {}
                                    toAction.fadeIn(crossFadeDuration).play();
                                  }
                                };

                                const timerId = setTimeout(
                                  startBreathing,
                                  startDelayMs
                                );

                                // Fallback: if action finishes early or timers are delayed (tab inactive), listen on mixer
                                try {
                                  if (
                                    zoeElectroMixer &&
                                    typeof zoeElectroMixer.addEventListener ===
                                      "function"
                                  ) {
                                    const onFinished = (e) => {
                                      try {
                                        if (e && e.action === fromAction) {
                                          clearTimeout(timerId);
                                          startBreathing();
                                          zoeElectroMixer.removeEventListener(
                                            "finished",
                                            onFinished
                                          );
                                        }
                                      } catch (_) {}
                                    };
                                    zoeElectroMixer.addEventListener(
                                      "finished",
                                      onFinished
                                    );
                                  }
                                } catch (_) {}
                              })();
                            }

                            // Ensure shape keys are active during second Electro appearance
                            try {
                              if (zoeShapeKeyControls)
                                zoeShapeKeyControls.startAnimation();
                            } catch (_) {}
                          }

                          // Camera cut shot to Electro for second appearance
                          if (currentCamera) {
                            // Instant camera cut to Electro position
                            currentCamera.position.set(80, -3.8, -63);
                            currentCamera.lookAt(
                              new THREE.Vector3(81, -3.6, -63)
                            );

                            // Update controls target to Electro position
                            if (currentControls && currentControls.target) {
                              currentControls.target.set(81, -4, -63);
                            }
                          }

                          // Set global flag for Electro sequence
                          window.isElectroSequencePlaying = true;

                          electroSound2.play();

                          // After electroSound2 finishes, return to player
                          setTimeout(() => {
                            if (isSequenceSkipped) return; // Skip if sequence was skipped
                            console.log(
                              "Electro's second sound finished, returning to player"
                            );

                            // Restore Electro's original state
                            if (
                              zoeElectroCharacter &&
                              zoeElectroCharacter.userData.originalState
                            ) {
                              const originalState =
                                zoeElectroCharacter.userData.originalState;
                              zoeElectroCharacter.position.copy(
                                originalState.position
                              );
                              zoeElectroCharacter.rotation.copy(
                                originalState.rotation
                              );
                              zoeElectroCharacter.visible =
                                originalState.visible;

                              // Stop shape key animation when returning to player focus
                              try {
                                if (zoeShapeKeyControls)
                                  zoeShapeKeyControls.stopAnimation();
                              } catch (_) {}

                              if (zoeElectroCharacter.userData.zoeActions) {
                                Object.values(
                                  zoeElectroCharacter.userData.zoeActions
                                ).forEach((action) => {
                                  if (action.isRunning()) {
                                    action.stop();
                                  }
                                });
                              }
                            }

                            // End the sequence
                            window.isElectroSequencePlaying = false;
                            endZoeSequence();
                          }, 9500);
                        } else {
                          endZoeSequence();
                        }
                      }, zoeSound1Duration * 1000);
                    }
                  }, zoeSound11Duration * 1000);
                }
              }, electroSoundDuration * 1000);
            }
          }, zoeSoundDuration * 1000);
        }
      }
    }

    updateZoePosition();
  }, 300);
}

// Separate function to handle sequence ending
/**
 * Common end‑of‑sequence logic shared by the normal path and skip path.
 *
 * Responsibilities:
 *  - Updates the objective to "find the redzone"
 *  - Restores camera position / controls back to the pre‑Zoe state
 *  - Re‑enables player & camera controls and shows the player model
 *  - Removes Zoe and her trigger from the scene
 *  - Spawns a new "post‑Zoe" trigger that continues the story with Electro
 */
function endZoeSequence() {
  // Update objective to find redzone
  showSceneObjective(2);

  console.log("Ending Zoe sequence");

  // Reset skip flag
  isSequenceSkipped = false;

  // Hide skip button
  hideSkipButton();

  // Stop vignette and shake effects
  stopVignetteAndShake();

  // Stop camera focus on Zoe
  stopCameraFocusOnZoe();

  // Restore camera to original position if it was stored
  if (currentCamera && currentCamera.userData.originalPosition) {
    // Kill any lingering tweens to avoid delayed camera reattachment
    try {
      gsap.killTweensOf(currentCamera.position);
    } catch (_) {}
    if (currentControls && currentControls.target) {
      try {
        gsap.killTweensOf(currentControls.target);
      } catch (_) {}
    }

    // Snap camera and controls target back immediately (no tween)
    currentCamera.position.copy(currentCamera.userData.originalPosition);

    if (
      currentControls &&
      currentControls.target &&
      currentCamera.userData.originalControlsTarget
    ) {
      currentControls.target.copy(
        currentCamera.userData.originalControlsTarget
      );
      currentControls.update && currentControls.update();
    }

    // Clear stored camera data
    delete currentCamera.userData.originalPosition;
    delete currentCamera.userData.originalControlsTarget;
  } else {
    // If no stored position, smoothly move camera back to a reasonable position near the player
    if (currentCamera) {
      const playerPosition = new THREE.Vector3(0, 0, 0); // Default player position
      const cameraOffset = new THREE.Vector3(0, 2, -3); // Offset behind and above player
      const targetPosition = playerPosition.clone().add(cameraOffset);

      gsap.to(currentCamera.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: cameraFocusMoveDuration,
        ease: "power2.inOut",
      });

      // Reset controls target to player position
      if (currentControls && currentControls.target) {
        gsap.to(currentControls.target, {
          x: playerPosition.x,
          y: playerPosition.y,
          z: playerPosition.z,
          duration: cameraFocusMoveDuration,
          ease: "power2.inOut",
        });
      }
    }
  }

  // Re-enable player controls and camera controls
  enablePlayerControls();
  togglePlayerControls(true); // Explicitly enable player controls

  // Re-enable camera following player
  setCameraFollowsPlayer(true);
  setCameraFocusOnPlayer(true);

  // Immediately align camera target to player to avoid any follow lag
  try {
    const playerRef =
      currentScene.getObjectByName("playerCapsule") ||
      currentScene.getObjectByName("player");
    if (playerRef && currentControls && currentControls.target) {
      currentControls.target.copy(playerRef.position);
      currentControls.update && currentControls.update();
    }
  } catch (_) {}

  // Show player model again
  showPlayerModel();

  // Remove Zoe and trigger
  currentScene.remove(zoeCharacter);

  // Stop any playing animations before removing
  if (zoeActions) {
    Object.values(zoeActions).forEach((action) => {
      if (action && action.isRunning()) {
        action.stop();
      }
    });
  }

  // Re-enable camera controls
  enableCameraControls();

  // Directly re-enable OrbitControls
  if (currentControls) {
    currentControls.enabled = true;
    // Ensure the controls target is up-to-date immediately
    try {
      currentControls.update && currentControls.update();
    } catch (_) {}
  }

  console.log("Cleaned up Zoe and trigger");

  // Reset sequence state
  isSequenceActive = false;
  hasTriggeredZoe = false;

  // In endZoeSequence or after camera returns to player, set:
  window.isElectroSequencePlaying = false;
  showElectroAndRedzone();

  // Create post-Zoe trigger point
  createPostZoeTrigger();
}

// Function to create post-Zoe trigger point
/**
 * Creates a trigger zone that becomes active after the Zoe cinematic ends.
 *
 * When the player enters this region:
 *  - Camera follow is disabled and a short Electro callout plays
 *  - The player is gently auto‑moved into position facing Electro
 *  - A new objective is shown to guide the player further along the path
 */
function createPostZoeTrigger() {
  if (!currentScene || !allAssets) {
    console.error(
      "Scene or assets not available for creating post-Zoe trigger"
    );
    return;
  }

  // Create trigger point at position (40.7, -0.95, -60)
  postZoeTrigger = TriggerPoint(
    allAssets.vfxs.vfx, // Use the same VFX as Zoe's trigger
    { x: 39, y: -0.85, z: -61 }, //'39.852', '0.979', '-61.119
    currentScene,
    { x: 2.5, y: 2.5, z: 2.5 }, // Trigger size
    () => {
      console.log("Player entered post-Zoe trigger zone");
      setCameraFollowsPlayer(false);

      // Remove the trigger area immediately after activation so it cannot trigger again
      if (postZoeTrigger) {
        try {
          if (typeof postZoeTrigger.removeParticleEffects === "function") {
            postZoeTrigger.removeParticleEffects();
          }
        } catch (e) {
          console.warn("Failed to remove post-Zoe trigger:", e);
        } finally {
          postZoeTrigger = null;
        }
      }

      // Hide objective during the trigger flow
      try {
        hideSceneObjective();
      } catch (_) {}

      // Start Electro talking_02 from the moment of trigger until camera zoom-in completes
      try {
        if (typeof playElectroTalking02Action === "function")
          playElectroTalking02Action();
      } catch (_) {}
      // Play Electro look-at audio on post-Zoe trigger after a small delay
      setTimeout(() => {
        try {
          const lookat = allAssets?.audios?.electroLookat;
          if (lookat) {
            if (typeof lookat.stop === "function") lookat.stop();
            if (typeof lookat.setLoop === "function") lookat.setLoop(false);
            if (typeof lookat.setVolume === "function") lookat.setVolume(0.9);
            lookat.play();
          }
        } catch (e) {
          console.warn(
            "Could not play electroLookat audio on post-Zoe trigger:",
            e
          );
        }
      }, 1200);

      // Move player to safe position before auto-move
      if (currentPlayer) {
        currentPlayer.position.set(42, currentPlayer.position.y, -61); //43.719', '0.972', '-60.068
        currentPlayer.rotation.set(0, Math.PI / 2, 0);
        if (playerState) {
          playerState.velocity.set(0, 0, 0);
        }
      }

      // Snap Electro to ground position (-15, 0, -141)
      if (zoeElectroCharacter) {
        zoeElectroCharacter.position.set(-15, 0, -141);
        console.log("Electro snapped to ground position (-15, 0, -141)");
      }

      // Start auto-move sequence
      triggerAutoMoveAndDisableControls(currentPlayer, () => {
        console.log("Auto-move completed after Zoe sequence");
        // Re-enable controls after auto-move
        enablePlayerControls();
        togglePlayerControls(true);
        setCameraFollowsPlayer(true);
        if (currentControls) currentControls.enabled = true;
        // Show objective 3 upon completion of post-Zoe trigger flow
        try {
          showSceneObjective(3);
        } catch (_) {}
      });
    }
  );

  // Make trigger visible
  if (postZoeTrigger && typeof postZoeTrigger.setVFXVisible === "function") {
    postZoeTrigger.setVFXVisible(true);
  }

  console.log("Created post-Zoe trigger point at (40.7, -0.95, -60)");
}

/**
 * Per‑frame update hook for Zoe and related systems.
 *
 * Called from the main Scene 3 `render` loop.
 *  - Advances Zoe and Electro mixers
 *  - Updates Zoe’s trigger and (if present) the post‑Zoe trigger
 *  - Drives auto‑move and the POV‑style camera behaviour while auto‑move is active
 *
 * @param {number} delta - Frame delta time (seconds)
 * @param {THREE.Object3D} player - Player capsule / mesh
 */
export function updateZoe(delta, player) {
  if (!player) {
    console.warn("No player object provided to updateZoe");
    return;
  }

  // Update currentPlayer reference if it's not set
  if (!currentPlayer) {
    currentPlayer = player;
  }

  // Update player position
  playerPosition.setFromMatrixPosition(player.matrixWorld);

  if (zoeMixer) {
    zoeMixer.update(delta);
  }

  // Update cloned Electro model's animations
  if (zoeElectroMixer) {
    zoeElectroMixer.update(delta);
  }

  if (zoeTrigger) {
    zoeTrigger.updateQuarksScene(delta, player);
  }

  // Update post-Zoe trigger if it exists
  if (
    postZoeTrigger &&
    typeof postZoeTrigger.updateQuarksScene === "function"
  ) {
    postZoeTrigger.updateQuarksScene(delta, player);
  }

  // Update auto-move if active
  if (isAutoMoving) {
    autoPlayerMovement(delta);

    // If no dedicated camera animation is running, place camera in front of the player and snap position to POV (no gradual move)
    if (!isAutoMoveCameraAnimating && currentPlayer && currentCamera) {
      const forward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(currentPlayer.quaternion)
        .normalize();
      const camOffsetFront = 0.6;
      const camOffsetUp = 0.0;
      const desiredCamPosition = currentPlayer.position
        .clone()
        .add(forward.clone().multiplyScalar(camOffsetFront))
        .add(new THREE.Vector3(0, camOffsetUp, 0));
      // Snap instantly to desired POV position to avoid moving through the player
      currentCamera.position.copy(desiredCamPosition);

      // Smooth, human-like look towards a point slightly ahead of the player
      const lookAhead = currentPlayer.position
        .clone()
        .add(forward.clone().multiplyScalar(3.0));
      if (!autoMoveLookAtTarget) autoMoveLookAtTarget = lookAhead.clone();
      // Ease target towards lookAhead
      autoMoveLookAtTarget.lerp(lookAhead, 0.12);
      // Subtle hand-held jitter while walking
      const now = performance.now();
      const jitterAmp = 0.06; // very subtle
      const jitter = new THREE.Vector3(
        Math.sin(now * 0.0031) * jitterAmp,
        Math.sin(now * 0.0042 + 0.8) * jitterAmp * 0.5,
        Math.sin(now * 0.0023 + 1.7) * jitterAmp * 0.4
      );
      const targetWithJitter = autoMoveLookAtTarget.clone().add(jitter);

      if (currentControls && currentControls.target) {
        currentControls.target.copy(targetWithJitter);
        currentControls.update();
      } else {
        currentCamera.lookAt(targetWithJitter);
      }
    }
  }

  // Debug: Check animation states (only log occasionally to avoid spam)
  if (Math.random() < 0.01) {
    // 1% chance to log
    const runningAnimations = [];
    if (zoeActions) {
      Object.entries(zoeActions).forEach(([name, action]) => {
        if (action && action.isRunning()) {
          runningAnimations.push(name);
        }
      });
    }
    if (runningAnimations.length > 1) {
      console.log("Multiple animations running:", runningAnimations);
    }
  }
}

/**
 * Full teardown for all Zoe‑related state.
 *
 * This is called from `cleanupScene3` when leaving the scene and:
 *  - Resets the skip flag and hides the skip button
 *  - Stops eye‑blinking and all Zoe animations
 *  - Restores the cloned Electro model to its original transform/visibility
 *  - Cleans up the HUD TV video, post‑Zoe trigger and auto‑move state
 */
export function cleanupZoe() {
  // Reset skip flag
  isSequenceSkipped = false;

  // Hide skip button during cleanup
  hideSkipButton();

  // Stop eye blinking
  stopEyeBlinking();

  // Stop all Zoe animations including idle
  if (zoeActions) {
    Object.values(zoeActions).forEach((action) => {
      if (action && action.isRunning()) {
        action.stop();
      }
    });
  }

  // Restore Electro's original state
  if (zoeElectroCharacter && zoeElectroCharacter.userData.originalState) {
    const originalState = zoeElectroCharacter.userData.originalState;
    zoeElectroCharacter.position.copy(originalState.position);
    zoeElectroCharacter.rotation.copy(originalState.rotation);
    zoeElectroCharacter.visible = originalState.visible;

    // Stop any playing animations
    if (zoeElectroCharacter.userData.zoeActions) {
      Object.values(zoeElectroCharacter.userData.zoeActions).forEach(
        (action) => {
          if (action.isRunning()) {
            action.stop();
          }
        }
      );
    }
  }

  // Clean up mixer
  if (zoeElectroMixer) {
    zoeElectroMixer.stopAllAction();
    zoeElectroMixer = null;
  }

  // Clean up HUD video
  if (hudVideoPlane) {
    // If this is the TV mesh, restore original state instead of removing from scene
    const isTvMesh = tvScreenMesh && hudVideoPlane === tvScreenMesh;
    if (hudVideoPlane.userData.video) {
      try {
        hudVideoPlane.userData.video.pause();
        hudVideoPlane.userData.video.currentTime = 0;
      } catch (_) {}
    }
    if (typeof hudVideoPlane.userData._detachVideoListeners === "function") {
      try {
        hudVideoPlane.userData._detachVideoListeners();
      } catch (_) {}
    }
    if (
      hudVideoPlane.userData.videoTexture &&
      hudVideoPlane.userData.videoTexture.dispose
    ) {
      try {
        hudVideoPlane.userData.videoTexture.dispose();
      } catch (_) {}
    }
    if (isTvMesh) {
      // Restore original material if stored
      if (hudVideoPlane.userData.originalMaterial) {
        // Dispose video material if created
        if (
          hudVideoPlane.userData.videoMaterial &&
          hudVideoPlane.userData.videoMaterial.dispose
        ) {
          hudVideoPlane.userData.videoMaterial.dispose();
        }
        hudVideoPlane.material = hudVideoPlane.userData.originalMaterial;
      }
      // Hide the TV mesh
      hudVideoPlane.visible = false;
    } else {
      if (currentScene) {
        currentScene.remove(hudVideoPlane);
      }
      if (hudVideoPlane.geometry) {
        hudVideoPlane.geometry.dispose();
      }
      if (hudVideoPlane.material) {
        hudVideoPlane.material.dispose();
      }
    }
    hudVideoPlane = null;
  }

  // Reset controls reference
  currentControls = null;

  // Stop camera focus interval
  stopCameraFocusOnZoe();

  // Clean up post-Zoe trigger
  if (postZoeTrigger) {
    if (typeof postZoeTrigger.removeParticleEffects === "function") {
      postZoeTrigger.removeParticleEffects();
    }
    postZoeTrigger = null;
  }

  // Reset auto-move state
  isAutoMoving = false;
  autoMoveDistance = 0;
  autoMoveCallback = null;

  // Reset player reference
  currentPlayer = null;
}

// Function to set animation speed for Zoe
/**
 * Adjusts Zoe and Electro animation playback speed at runtime.
 *
 * @param {number} speedFactor - Multiplier applied to most animation time scales.
 */
export function setZoeAnimationSpeed(speedFactor) {
  animationSpeedFactor = speedFactor;

  if (zoeActions) {
    Object.entries(zoeActions).forEach(([key, action]) => {
      if (action && key !== "eyesAction" && key !== "recordAction") {
        action.timeScale = animationSpeedFactor;
      }
    });
  }
}

// Add new functions for vignette and shake effects
function createVignetteEffect() {
  // Create a canvas element for the vignette
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1000";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  vignetteEffect = {
    canvas,
    ctx,
    update: function (intensity) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create gradient for vignette
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2
      );

      // Add red color with intensity
      gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity * 0.5})`);
      gradient.addColorStop(1, `rgba(255, 0, 0, ${intensity})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    cleanup: function () {
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    },
  };
}

function startVignetteAndShake() {
  isVignetteActive = true;
  isShaking = true;
  shakeStartTime = performance.now();
  shakeDuration = zoeSoundDuration * 500; // Half of sound duration in milliseconds

  // Cut to wide-angle camera shot immediately
  try {
    if (currentCamera) {
      try {
        gsap.killTweensOf(currentCamera.position);
      } catch (_) {}
      if (currentControls && currentControls.target) {
        try {
          gsap.killTweensOf(currentControls.target);
        } catch (_) {}
      }
      preShakeCameraState.position = currentCamera.position.clone();
      preShakeCameraState.target =
        currentControls && currentControls.target
          ? currentControls.target.clone()
          : null;
      const widePos =
        SHAKE_CAMERA_ANGLES && SHAKE_CAMERA_ANGLES[0]
          ? SHAKE_CAMERA_ANGLES[0]
          : new THREE.Vector3(42, 3, -55);
      const lookAtZoe =
        zoeCharacter && zoeCharacter.position
          ? zoeCharacter.position.clone()
          : new THREE.Vector3(82, -2.5, -60);
      currentCamera.position.set(widePos.x, widePos.y, widePos.z);
      if (currentControls && currentControls.target) {
        currentControls.target.copy(lookAtZoe);
        currentControls.update && currentControls.update();
      } else {
        currentCamera.lookAt(lookAtZoe);
      }
      // Schedule an additional cut to another angle midway through the shake
      if (SHAKE_CAMERA_ANGLES && SHAKE_CAMERA_ANGLES.length > 1) {
        const cutDelay = Math.max(300, Math.floor(shakeDuration * 0.5));
        const tId = setTimeout(() => {
          if (!isVignetteActive || !currentCamera) return;
          const nextPos = SHAKE_CAMERA_ANGLES[1];
          const lookZoe =
            zoeCharacter && zoeCharacter.position
              ? zoeCharacter.position.clone()
              : new THREE.Vector3(82, -2.5, -60);
          try {
            gsap.killTweensOf(currentCamera.position);
          } catch (_) {}
          if (currentControls && currentControls.target) {
            try {
              gsap.killTweensOf(currentControls.target);
            } catch (_) {}
          }
          currentCamera.position.set(nextPos.x, nextPos.y, nextPos.z);
          if (currentControls && currentControls.target) {
            currentControls.target.copy(lookZoe);
            currentControls.update && currentControls.update();
          } else {
            currentCamera.lookAt(lookZoe);
          }
        }, cutDelay);
        shakeAngleTimeouts.push(tId);
      }
    }
  } catch (_) {}

  // Start shake sound
  if (shakeSound) {
    // Position the sound source at a distance from the camera
    const soundPosition = new THREE.Vector3(
      currentCamera.position.x + 20,
      currentCamera.position.y,
      currentCamera.position.z + 20
    );
    shakeSound.position.copy(soundPosition);

    // Fade in the shake sound
    shakeSound.setVolume(0);
    shakeSound.play();

    // Fade in shake sound
    const fadeInDuration = 100;
    const startTime = performance.now();

    function fadeInShakeSound() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / fadeInDuration, 1);
      shakeSound.setVolume(0.8 * progress);

      if (progress < 1) {
        requestAnimationFrame(fadeInShakeSound);
      }
    }

    fadeInShakeSound();
  }

  // Start camera shake effect
  startCameraShake();

  // Start animation loop for vignette
  function updateVignette() {
    if (!isVignetteActive) return;

    const currentTime = performance.now();
    const elapsed = currentTime - shakeStartTime;
    const progress = Math.min(elapsed / shakeDuration, 1);

    // Update vignette intensity with blinking effect
    if (vignetteEffect) {
      const blinkIntensity = Math.sin(progress * Math.PI * 8) * 0.5 + 0.5; // Blinking effect
      vignetteEffect.update(blinkIntensity * 0.3); // Adjust intensity as needed
    }

    if (progress < 1) {
      requestAnimationFrame(updateVignette);
    } else {
      stopVignetteAndShake();
    }
  }

  updateVignette();
}

function startCameraShake() {
  if (!currentCamera) return;

  let currentShakeIntensity = shakeIntensity; // Start with a stronger shake
  const maxShakeIntensity = 0.5; // Increased maximum intensity
  const shakeIncreaseStep = 0.002; // Faster ramp-up

  shakeInterval = setInterval(() => {
    if (currentCamera) {
      // Random camera shake with varying intensity
      const shakeAmount = Math.random() * currentShakeIntensity;

      // Apply shake to camera position with more realistic movement
      currentCamera.position.x += (Math.random() - 0.5) * shakeAmount;
      currentCamera.position.y += (Math.random() - 0.5) * shakeAmount;
      currentCamera.position.z += (Math.random() - 0.5) * shakeAmount;

      // Apply shake to camera rotation with more realistic movement
      currentCamera.rotation.x += (Math.random() - 0.5) * shakeAmount * 0.003;
      currentCamera.rotation.y += (Math.random() - 0.5) * shakeAmount * 0.003;
      currentCamera.rotation.z += (Math.random() - 0.5) * shakeAmount * 0.003;

      // Gradually increase shake intensity up to a maximum
      if (currentShakeIntensity < maxShakeIntensity) {
        currentShakeIntensity = Math.min(
          currentShakeIntensity + shakeIncreaseStep,
          maxShakeIntensity
        );
      }
    }
  }, 50); // Update every 50ms for smooth effect
}

function stopVignetteAndShake() {
  isVignetteActive = false;
  isShaking = false;

  // Fade out shake sound
  if (shakeSound) {
    const fadeOutDuration = 1000;
    const startTime = performance.now();
    const startVolume = shakeSound.getVolume();

    function fadeOutShakeSound() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / fadeOutDuration, 1);
      shakeSound.setVolume(startVolume * (1 - progress));

      if (progress < 1) {
        requestAnimationFrame(fadeOutShakeSound);
      } else {
        shakeSound.stop();
      }
    }

    fadeOutShakeSound();
  }

  // Clear shake interval
  if (shakeInterval) {
    clearInterval(shakeInterval);
    shakeInterval = null;
  }

  if (vignetteEffect) {
    vignetteEffect.cleanup();
    vignetteEffect = null;
  }

  // Cut back to pre-shake camera view immediately
  try {
    if (currentCamera && preShakeCameraState.position) {
      try {
        gsap.killTweensOf(currentCamera.position);
      } catch (_) {}
      if (currentControls && currentControls.target) {
        try {
          gsap.killTweensOf(currentControls.target);
        } catch (_) {}
      }
      currentCamera.position.copy(preShakeCameraState.position);
      if (preShakeCameraState.target) {
        if (currentControls && currentControls.target) {
          currentControls.target.copy(preShakeCameraState.target);
          currentControls.update && currentControls.update();
        } else {
          currentCamera.lookAt(preShakeCameraState.target);
        }
      }
    }
  } catch (_) {
  } finally {
    preShakeCameraState.position = null;
    preShakeCameraState.target = null;
    // Clear any scheduled angle cuts
    if (shakeAngleTimeouts && shakeAngleTimeouts.length) {
      shakeAngleTimeouts.forEach((id) => {
        try {
          clearTimeout(id);
        } catch (_) {}
      });
      shakeAngleTimeouts.length = 0;
    }
  }
}

// Add this function to create the HUD video plane
function createHUDVideoPlane() {
  if (!allAssets || !allAssets.videotextures) {
    console.error("Video textures not found in assets");
    return null;
  }

  const hudVideoAsset = allAssets.videotextures.hudvideo;
  if (!hudVideoAsset) {
    console.error("HUD video texture not found in assets");
    return null;
  }

  // Create video element with proper attributes
  const video = document.createElement("video");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("muted", "");
  video.setAttribute("crossorigin", "anonymous");
  video.setAttribute("preload", "auto");
  video.setAttribute("autoplay", "");
  video.setAttribute("loop", "");

  // Set source with proper error handling
  const source = document.createElement("source");
  source.src = hudVideoAsset.path;
  source.type = "video/mp4";
  video.appendChild(source);

  // Set video properties
  video.muted = true;
  video.loop = false;
  video.autoplay = true;

  // Create a promise to handle video loading
  const videoLoadPromise = new Promise((resolve, reject) => {
    const handleCanPlay = () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadeddata", handleLoadedData);
      resolve();
    };

    const handleLoadedData = () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadeddata", handleLoadedData);
      resolve();
    };

    const handleError = (e) => {
      console.error("Error loading HUD video:", e);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadeddata", handleLoadedData);
      reject(e);
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);

    // Start loading the video
    video.load();
  });

  // Create video texture with proper settings
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.format = THREE.RGBFormat;
  videoTexture.encoding = THREE.sRGBEncoding;
  videoTexture.generateMipmaps = false;

  // Find the TV mesh inside the interior model
  const interiorModel = allAssets?.models?.gltf?.interior;
  if (!interiorModel) {
    console.error("Interior model not found for TV video setup");
    return null;
  }

  // Prefer exact name 'tv'; fall back to first mesh whose name includes 'tv'
  let tvMesh = interiorModel.getObjectByName("tv");
  if (!tvMesh) {
    interiorModel.traverse((child) => {
      if (
        !tvMesh &&
        child.isMesh &&
        typeof child.name === "string" &&
        child.name.toLowerCase().includes("tv")
      ) {
        tvMesh = child;
      }
    });
  }

  if (!tvMesh || !tvMesh.isMesh) {
    console.error("TV mesh not found in interior model");
    return null;
  }

  // Prefer a child mesh that likely represents the screen
  let targetMesh = tvMesh;
  tvMesh.traverse?.((child) => {
    if (child.isMesh && typeof child.name === "string") {
      const lower = child.name.toLowerCase();
      if (lower.includes("screen") || lower.includes("glass")) {
        targetMesh = child;
      }
    }
  });

  // Compute mesh aspect ratio using bounding box (use the two largest dimensions)
  let meshAspect = 1.0;
  try {
    targetMesh.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    targetMesh.geometry.boundingBox.getSize(size);
    const dims = [
      Math.max(size.x, 1e-6),
      Math.max(size.y, 1e-6),
      Math.max(size.z, 1e-6),
    ].sort((a, b) => b - a);
    meshAspect = dims[0] / dims[1];
  } catch (_) {}

  // Create shader material that preserves video aspect (letterbox/pillarbox) on the mesh
  const material = new THREE.ShaderMaterial({
    uniforms: {
      videoTexture: { value: videoTexture },
      meshAspect: { value: meshAspect },
      videoAspect: { value: 16.0 / 9.0 },
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
      uniform float meshAspect;
      uniform float videoAspect;
      varying vec2 vUv;
      
      void main() {
        vec2 uv = vUv;
        
        // Rotate UV coordinates 90 degrees clockwise and fix orientation
        // This transforms (x,y) to (y,x) to correct rotation without flipping
        float tempX = uv.x;
        uv.x = uv.y;
        uv.y = tempX;
        
        // No scaling needed - keep video's natural aspect ratio
        // Allow video to extend beyond mesh boundaries naturally
        
        vec4 videoColor = texture2D(videoTexture, uv);
        gl_FragColor = videoColor;
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Store original material to restore later and attach video data
  if (!targetMesh.userData.originalMaterial) {
    targetMesh.userData.originalMaterial = targetMesh.material;
  }
  targetMesh.material = material;
  tvMesh.userData.targetMesh = targetMesh;
  tvMesh.visible = false; // Initially hidden
  targetMesh.visible = false;
  tvMesh.frustumCulled = false;
  targetMesh.frustumCulled = false;
  tvMesh.renderOrder = 20;
  targetMesh.renderOrder = 21;

  // Update meshAspect if video has a different aspect than 16:9
  const updateAspectUniform = () => {
    if (material && material.uniforms && material.uniforms.videoAspect) {
      const w = video.videoWidth || 16;
      const h = video.videoHeight || 9;
      if (h > 0) material.uniforms.videoAspect.value = w / h;
    }
  };
  video.addEventListener("loadedmetadata", updateAspectUniform);
  video.addEventListener("loadeddata", updateAspectUniform);

  // Store video reference and load promise for control/cleanup
  tvMesh.userData.video = video;
  tvMesh.userData.loadPromise = videoLoadPromise;
  tvMesh.userData.videoTexture = videoTexture;
  tvMesh.userData.videoMaterial = material;

  // Start loading the video immediately
  video.load();

  // Keep texture updating while playing
  const onPlay = () => {
    tvMesh.visible = true;
    if (tvMesh.userData.targetMesh) tvMesh.userData.targetMesh.visible = true;
    if (!tvMesh.userData._updateInterval) {
      tvMesh.userData._updateInterval = setInterval(() => {
        if (videoTexture) {
          videoTexture.needsUpdate = true;
        }
      }, 33); // ~30fps
    }
  };
  const onPauseOrEnded = () => {
    tvMesh.visible = false;
    if (tvMesh.userData.targetMesh) tvMesh.userData.targetMesh.visible = false;
    if (tvMesh.userData._updateInterval) {
      clearInterval(tvMesh.userData._updateInterval);
      tvMesh.userData._updateInterval = null;
    }
    // Reset aspect uniforms (in case a different sized video plays next time)
    if (material && material.uniforms && material.uniforms.videoAspect) {
      const w = video.videoWidth || 16;
      const h = video.videoHeight || 9;
      if (h > 0) material.uniforms.videoAspect.value = w / h;
    }
  };
  video.addEventListener("play", onPlay);
  video.addEventListener("pause", onPauseOrEnded);
  video.addEventListener("ended", onPauseOrEnded);

  // Ensure listeners are cleaned up if needed
  tvMesh.userData._detachVideoListeners = () => {
    video.removeEventListener("play", onPlay);
    video.removeEventListener("pause", onPauseOrEnded);
    video.removeEventListener("ended", onPauseOrEnded);
    if (tvMesh.userData._updateInterval) {
      clearInterval(tvMesh.userData._updateInterval);
      tvMesh.userData._updateInterval = null;
    }
  };

  return tvMesh;
}

// Function to handle random eye blinking
function startEyeBlinking() {
  if (isEyeBlinking || !zoeActions.eyesAction) return;

  isEyeBlinking = true;
  lastBlinkTime = performance.now();

  function scheduleNextBlink() {
    if (!isEyeBlinking) return;

    // Random delay between 2-6 seconds for natural blinking
    const minDelay = 5000; // 2 seconds
    const maxDelay = 9000; // 6 seconds
    nextBlinkDelay = Math.random() * (maxDelay - minDelay) + minDelay;

    setTimeout(() => {
      if (!isEyeBlinking) return;

      // Perform the blink
      performEyeBlink();

      // Schedule next blink
      scheduleNextBlink();
    }, nextBlinkDelay);
  }

  function performEyeBlink() {
    if (!zoeActions.eyesAction || !isEyeBlinking) return;

    // Reset and play the eyes action
    zoeActions.eyesAction.reset();
    zoeActions.eyesAction.setLoop(THREE.LoopOnce);
    zoeActions.eyesAction.clampWhenFinished = true;
    zoeActions.eyesAction.fadeIn(0.1).play();

    lastBlinkTime = performance.now();
  }

  // Start the blinking cycle
  scheduleNextBlink();
}

function stopEyeBlinking() {
  isEyeBlinking = false;
  if (zoeActions.eyesAction && zoeActions.eyesAction.isRunning()) {
    zoeActions.eyesAction.stop();
  }
}

// Function to continuously focus camera on Zoe
function startCameraFocusOnZoe() {
  if (cameraFocusInterval) return;

  cameraFocusInterval = setInterval(() => {
    if (currentCamera && isSequenceActive) {
      // Check if Electro sequence is playing to determine camera focus
      if (window.isElectroSequencePlaying) {
        // Focus on Electro position
        const electroLookAtPosition = new THREE.Vector3(-15, 0, -141);
        currentCamera.lookAt(electroLookAtPosition);
      } else {
        // Focus on Zoe position
        const zoeLookAtPosition = new THREE.Vector3(82, -2.5, -60);
        currentCamera.lookAt(zoeLookAtPosition);
      }
    } else {
      stopCameraFocusOnZoe();
    }
  }, 100); // Update every 100ms for smooth following
}

// Function to stop camera focus on Zoe
function stopCameraFocusOnZoe() {
  if (cameraFocusInterval) {
    clearInterval(cameraFocusInterval);
    cameraFocusInterval = null;
  }
}

// Function to start Zoe's idle animation
/**
 * Starts Zoe's idle animation in a loop.
 *
 * This is typically called after initialization so Zoe is idling
 * before the player reaches her trigger region.
 */
export function startZoeIdle() {
  if (
    zoeActions &&
    zoeActions.idleAction &&
    zoeCharacter &&
    zoeCharacter.visible
  ) {
    // Stop any other animations first
    Object.values(zoeActions).forEach((action) => {
      if (action && action !== zoeActions.idleAction && action.isRunning()) {
        action.stop();
      }
    });

    // Start idle animation
    zoeActions.idleAction.reset();
    zoeActions.idleAction.setLoop(THREE.LoopRepeat);
    zoeActions.idleAction.clampWhenFinished = false;
    zoeActions.idleAction.paused = false;
    zoeActions.idleAction.fadeIn(0.3).play();
    console.log("Started Zoe idle animation");
  }
}

// Function to stop all Zoe animations
/**
 * Stops all currently running Zoe animations.
 *
 * Useful when debugging or when an external system wants to
 * forcefully reset Zoe’s animation state.
 */
export function stopAllZoeAnimations() {
  if (zoeActions) {
    Object.values(zoeActions).forEach((action) => {
      if (action && action.isRunning()) {
        action.stop();
        console.log("Stopped animation:", action.name || "unnamed");
      }
    });
  }
}

// Function to stop specific Zoe animation
/**
 * Stops a specific Zoe animation by key from `zoeActions`.
 *
 * @param {string} animationName - Key in `zoeActions` (e.g. "idleAction").
 */
export function stopZoeAnimation(animationName) {
  if (zoeActions && zoeActions[animationName]) {
    const action = zoeActions[animationName];
    if (action && action.isRunning()) {
      action.stop();
      console.log("Stopped animation:", animationName);
    }
  }
}

// Auto-move functions (similar to scene1)
function resetPlayerState() {
  if (playerState) {
    playerState.velocity.set(0, 0, 0);
    playerState.fwdPressed = false;
    playerState.bkdPressed = false;
    playerState.lftPressed = false;
    playerState.rgtPressed = false;
    playerState.shiftPressed = false;
    updatePlayerAnimation(false, false);
  }
}

/**
 * Begins an "auto‑move" forward step for the player and disables controls.
 *
 * This is mainly used after the post‑Zoe trigger to gently walk the player
 * a short distance while the camera behaves like a human POV.
 *
 * @param {THREE.Object3D} player   - Player object to move
 * @param {Function}       callback - Invoked once auto‑move has completed
 */
export function triggerAutoMoveAndDisableControls(player, callback) {
  console.log("Triggering auto-move with player:", player);
  isAutoMoving = true;
  autoMoveDistance = 0;
  autoMoveCallback = callback;
  togglePlayerControls(false);

  if (currentControls) currentControls.enabled = false;
  resetPlayerState();
  console.log("Auto-move triggered successfully");
}

/**
 * Per‑frame helper that advances the current auto‑move.
 *
 * - Walks the player forward using their facing direction
 * - Notifies `updatePlayerAnimation` so the proper walk cycle plays
 * - When the configured distance is reached, stops auto‑move and
 *   triggers the camera auto‑move sequence towards Electro.
 *
 * @param {number} delta - Frame delta time (seconds)
 */
export function autoPlayerMovement(delta) {
  if (!isAutoMoving || !currentPlayer) return;

  const moveDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
    currentPlayer.quaternion
  );
  const moveAmount = AUTO_MOVE_CONFIG.speed * delta;
  currentPlayer.position.addScaledVector(moveDirection, moveAmount);
  autoMoveDistance += moveAmount;

  // Debug: Log movement progress
  if (Math.random() < 0.1) {
    // 10% chance to log
    console.log("Auto-move progress:", {
      distance: autoMoveDistance,
      maxDistance: AUTO_MOVE_CONFIG.maxDistance,
      speed: AUTO_MOVE_CONFIG.speed,
      delta: delta,
    });
  }

  if (autoMoveDistance >= AUTO_MOVE_CONFIG.maxDistance) {
    console.log("Auto-move completed, distance traveled:", autoMoveDistance);
    isAutoMoving = false;
    autoMoveDistance = 0;
    resetPlayerState();
    // After player stops, continue the same smooth target motion toward Electro without a cut
    startAutoMoveCameraSequence();
  } else {
    console.log(
      "Calling updatePlayerAnimation(true, false) for walking animation"
    );
    updatePlayerAnimation(true, false);
  }
}
