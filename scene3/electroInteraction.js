import * as THREE from "three";
import { TriggerPoint } from "../commonFiles/triggerPoint.js";
import { createEntryEffect } from "../commonFiles/entryEffect.js";
import { hideSceneObjective } from "./objectives.js";
import { setupShapeKeyAnimations } from "../commonFiles/electroShapeKey.js";
import gsap from "gsap";
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
  updatePlayerAnimation
} from "../commonFiles/playerController.js";
import { switchToScene4AfterDelay } from "./scene3.js";
import { startMainFallingSequence } from "./fallingEffect.js";
import { createSkipButton, showSkipButton, hideSkipButton } from "../commonFiles/skipButton.js";

/**
 * @fileoverview Scene 3 Electro interaction controller.
 *
 * This module owns the “Electro redzone” interaction sequence in Scene 3:
 * - Shows Electro + a redzone VFX trigger after Zoe sequence completes
 * - When player enters the redzone, runs a scripted camera + Electro animation + audio beat
 * - Supports skipping the sequence via a global Skip button
 * - Transitions into a walking showcase, then triggers the falling sequence and scene switch
 *
 * Public API:
 * - `initializeElectro(scene, allAssets, camera, controls)`: wire dependencies, create trigger/VFX,
 *   configure Electro animations and sounds.
 * - `showElectroAndRedzone()`: make Electro/trigger visible once Zoe intro completes.
 * - `updateElectro(delta, player)`: per-frame updates (mixer, trigger, camera follow during walking).
 * - `cleanupElectro()`: remove created resources, stop timeouts/tweens, and clean globals.
 *
 * Design notes:
 * - This module uses module-level state to coordinate async timeouts and per-frame updates.
 * - It intentionally disables player and camera controls during the main scripted beat.
 * - A `window.isElectroSequencePlaying` flag is used to prevent other systems from fighting camera control.
 */

// State variables for electro interaction
let hasTriggeredElectro = false;
let entryEffect = null;
let currentScene = null;
let currentCamera = null;

// Skip button state
let skipButtonInitialized = false;

let isSequenceActive = false;
let electroTrigger = null;
let electroSound = null;
let electroCharacter = null;
let electroMixer = null;
let electroActions = null;
let soundEndTimeout = null;
let soundDuration = 15; // Default sound duration in seconds
let shapeKeyControls = null;
let animationSpeedFactor = 0.5; // Control animation speed
let moduleAllAssets = null;
let allAssets = null;
let walkTimeline = null;
let isWalkingActive = false;
let walkingFollowConfig = {
  direction: new THREE.Vector3(-1, 0, 0),
  followOffset: new THREE.Vector3(0, 0.5, 4),
};

// New state variables for visibility control
let isElectroVisible = false;
let isRedzoneVisible = false;

// Red alert + shake state for Electro close-up window
let isRedAlertActive = false;
let redVignette = null;
let shakeIntervalElectro = null;
let preShakeCameraStateElectro = { position: null, target: null };

// Crack reveal state (supports mesh or group)
let crackRoot = null; // mesh or group/parent
let crackMeshes = [];
let crackOriginalMaterials = [];
let crackRevealMaterials = [];
let crackRevealTween = null;
let crackSharedRevealUniform = { value: 0.0 };

/**
 * Start a red “alert vignette” overlay + gentle camera shake.
 * Used during the close-up window before the falling sequence begins.
 */
function startElectroCloseupRedAlertAndShake() {
  if (isRedAlertActive) return;
  isRedAlertActive = true;

  // Create overlay canvas for red alert vignette
  try {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1000';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    redVignette = { canvas, ctx, rafId: null, startTime: performance.now() };

    const loop = () => {
      if (!isRedAlertActive || !redVignette) return;
      const now = performance.now();
      const t = (now - redVignette.startTime) * 0.000004; // speed
      const pulse = (Math.sin(t) * 0.5 + 0.0005); // 0..1
      const intensity = 0.25 + pulse * 0.0000035; // 0.25..0.6

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      );
      gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity * 0.25})`);
      gradient.addColorStop(1, `rgba(255, 0, 0, ${intensity})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      redVignette.rafId = requestAnimationFrame(loop);
    };
    redVignette.rafId = requestAnimationFrame(loop);
  } catch (_) {}

  // Gentle camera shake during the close-up
  try {
    if (currentCamera) {
      preShakeCameraStateElectro.position = currentCamera.position.clone();
      if (currentCamera.userData && currentCamera.userData.controls && currentCamera.userData.controls.target) {
        preShakeCameraStateElectro.target = currentCamera.userData.controls.target.clone();
      } else {
        preShakeCameraStateElectro.target = null;
      }
    }
    const baseShake = 0.02;
    const rotShake = 0.0015;
    if (shakeIntervalElectro) clearInterval(shakeIntervalElectro);
    shakeIntervalElectro = setInterval(() => {
      if (!currentCamera) return;
      const amt = baseShake * (0.8 + Math.random() * 0.4);
      currentCamera.position.x += (Math.random() - 0.5) * amt;
      currentCamera.position.y += (Math.random() - 0.5) * amt;
      currentCamera.position.z += (Math.random() - 0.5) * amt;
      currentCamera.rotation.x += (Math.random() - 0.5) * rotShake;
      currentCamera.rotation.y += (Math.random() - 0.5) * rotShake;
      currentCamera.rotation.z += (Math.random() - 0.5) * rotShake;
    }, 50);
  } catch (_) {}
}

/**
 * Stop the red alert vignette + shake effect.
 * Note: We do not force restore camera state here because the falling sequence takes over.
 */
function stopElectroCloseupRedAlertAndShake() {
  if (!isRedAlertActive) return;
  isRedAlertActive = false;

  // Stop vignette
  try {
    if (redVignette) {
      if (redVignette.rafId) cancelAnimationFrame(redVignette.rafId);
      if (redVignette.canvas && redVignette.canvas.parentNode) {
        redVignette.canvas.parentNode.removeChild(redVignette.canvas);
      }
      redVignette = null;
    }
  } catch (_) {}

  // Stop shake (do not force-restore camera; falling sequence takes over)
  try {
    if (shakeIntervalElectro) {
      clearInterval(shakeIntervalElectro);
      shakeIntervalElectro = null;
    }
  } catch (_) {}
}

// Stop any Electro animations across known mixers/action maps
function stopAllElectroAnimationsBeforeSequence() {
  try {
    // Stop actions mapped in this module
    if (electroActions) {
      Object.values(electroActions).forEach((action) => {
        try { if (action && action.isRunning && action.isRunning()) action.stop(); } catch (_) {}
      });
    }
    // Stop actions on shared animations object from assets
    const anim = moduleAllAssets?.characters?.animations?.electro;
    if (anim?.actions) {
      Object.values(anim.actions).forEach((action) => {
        try { action.stop(); } catch (_) {}
      });
    }
    if (anim?.mixer && typeof anim.mixer.stopAllAction === 'function') {
      anim.mixer.stopAllAction();
    }
    // Stop any Zoe-created actions stored on the model itself
    if (electroCharacter?.userData?.zoeActions) {
      Object.values(electroCharacter.userData.zoeActions).forEach((action) => {
        try { if (action && action.isRunning && action.isRunning()) action.stop(); } catch (_) {}
      });
    }
  } catch (_) {}
}

// Helper to map Electro actions like scene1
function setupElectroActionsMap(assets) {
  const a = assets?.characters?.animations?.electro?.actions || {};
  return {
    arm_gesture: a['ARM_GESTURE'],
    breathing_idle: a['BREATHING_IDLE'],
    entering_code: a['ENTERING_CODE'],
    head_nod_yes: a['HEAD_NOD_YES'],
    jumping: a['JUMPING'],
    landing: a['LANDING'],
    looking_behind: a['LOOKING_BEHIND'],
    opening_on: a['OPENING_ON '],
    reaching_out: a['REACHING_OUT'],
    running: a['RUNNING'],
    standing_blocking_idle: a['STANDING_BLOCKING_IDLE'],
    talking: a['TALKING'],
    talking_02: a['TALKING_02'],
    thoughtful_head_shake: a['THOUGHTFUL_ HEAD_ SHAKE'],
    walking: a['WALKING'],
    waving: a['WAVING'],
    SAD_TALKING: a['SAD_TALKING'],
    FALLING: a['FALLING']
  };
}

/**
 * Initialize Electro for Scene 3.
 *
 * Responsibilities:
 * - Store references to `scene`, `camera`, and optional `controls`.
 * - Find and prepare crack meshes in the environment for reveal effects.
 * - Add Electro model to the scene and build an action map from loaded animations.
 * - Configure the redzone trigger (Quarks VFX + TriggerPoint callback).
 *
 * @param {THREE.Scene} scene
 * @param {any} allAssets Loaded assets registry from `assetsLoader`
 * @param {THREE.Camera} camera
 * @param {any} controls OrbitControls-like instance (optional)
 * @returns {{electroTrigger:any, electroCharacter:any, electroMixer:any, electroActions:any}}
 */
export function initializeElectro(scene, allAssets, camera, controls) {
  currentCamera = camera;
  currentScene = scene;
  moduleAllAssets = allAssets; // Store allAssets reference
  // Attach controls reference to camera for consistent access
  if (controls) {
    currentCamera.userData = currentCamera.userData || {};
    currentCamera.userData.controls = controls;
  }

  // Prepare crack mesh/group reveal (find and hide initially)
  try {
    const interior = moduleAllAssets?.models?.gltf?.interior;
    if (interior) {
      crackRoot = null;
      interior.traverse((child) => {
        if (!crackRoot && typeof child.name === 'string') {
          const name = child.name.toLowerCase();
          if (name === 'crack' || name.includes('crack')) {
            crackRoot = child; // can be Group or Mesh
          }
        }
      });
      if (crackRoot) {
        crackMeshes.length = 0;
        crackOriginalMaterials.length = 0;
        crackRevealMaterials.length = 0;
        const collect = (node) => {
          if (node.isMesh) {
            crackMeshes.push(node);
          }
          if (node.children && node.children.length) {
            node.children.forEach(collect);
          }
        };
        collect(crackRoot);
        // Build materials per mesh, share the reveal uniform across all to sync reveal
        crackMeshes.forEach((m) => {
          crackOriginalMaterials.push(m.material);
          const baseMat = Array.isArray(m.material) ? m.material[0] : m.material;
          const baseMap = baseMat && baseMat.map ? baseMat.map : null;
          const mat = new THREE.ShaderMaterial({
            uniforms: {
              map: { value: baseMap },
              reveal: crackSharedRevealUniform,
              softness: { value: 0.2 },
              tint: { value: new THREE.Color(1, 1, 1) }
            },
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform sampler2D map;
              uniform float reveal; // sliding boundary (start >1, animate to <0)
              uniform float softness; // edge softness (in UV units 0..1)
              uniform vec3 tint;
              varying vec2 vUv;
              void main() {
                vec4 tex = texture2D(map, vUv);
                float edge = smoothstep(0.0, 1.0, (vUv.x - reveal) / max(softness, 1e-5));
                vec4 color = vec4(tex.rgb * tint, tex.a * edge);
                if (color.a < 0.001) discard;
                gl_FragColor = color;
              }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
          });
          crackRevealMaterials.push(mat);
          m.visible = false; // hide initially
        });
      }
    }
  } catch (_) {}

  // Initialize Electro character with optimized settings
  if (allAssets.characters.models.electro) {
    electroCharacter = allAssets.characters.models.electro;
    scene.add(electroCharacter);
    
    // Position electro at the new location (-15, 10, -141)
    electroCharacter.position.set(-15, 10, -141);
    electroCharacter.rotation.set(0, Math.PI/6, 0);
    
    // Make electro visible initially
    electroCharacter.visible = true;
    isElectroVisible = true;

    // Optimize model performance
    electroCharacter.traverse((child) => {
      if (child.isMesh) {
        // Optimize geometry
        if (child.geometry) {
          child.geometry.computeBoundingSphere();
          child.geometry.computeBoundingBox();
        }
        // Optimize material
        if (child.material) {
          child.material.needsUpdate = false;
          child.material.fog = false;
          child.material.flatShading = true;
        }
      }
    });

    // Setup shape key animations with optimized settings
    shapeKeyControls = setupShapeKeyAnimations(electroCharacter);

    // Get animations/mixer
    electroMixer = allAssets.characters.animations.electro.mixer;
    if (electroMixer) {
      electroMixer.timeScale = 1.0;
    }

    // Map actions like scene1's electrointeraction
    const fullActions = setupElectroActionsMap(allAssets);

    // Backward-compatible aliases used by scene3 sequence logic
    electroActions = {
      ...fullActions,
      idleAction: fullActions.breathing_idle || fullActions.standing_blocking_idle,
      walkAction: fullActions.walking || fullActions.running,
      talkAction: fullActions.talking_02 || fullActions.talking
    };
    
    // Configure core actions similarly to scene1
    Object.values(fullActions).forEach((action) => {
      if (action) {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      }
    });
    if (fullActions.talking_02) {
      fullActions.talking_02.timeScale = 0.5;
    }
  }

  // Optimize sound handling
  electroSound = allAssets.audios.electroAudio4;
  if (electroSound) {
    if (electroSound.buffer?.duration) {
      soundDuration = electroSound.buffer.duration;
    } else if (electroSound.duration) {
      soundDuration = electroSound.duration;
    }
    // Optimize sound properties
    electroSound.setVolume(0.8);
    electroSound.setLoop(false);
    electroSound.setPlaybackRate(1.0);
  }

  // Create optimized entry effect with better positioning at redzone location
  entryEffect = createEntryEffect(scene, new THREE.Vector3(-13, -1, -134), 1.5);

  // Create optimized trigger point with better collision detection at new position
  if (allAssets.vfxs.redzone) {
    electroTrigger = TriggerPoint(
      allAssets.vfxs.redzone,
      { x: -15, y: -0.95, z: -142 }, // New redzone position
      scene,
      { x: 2.5, y: 2.5, z: 2.5 }, // Adjusted size for better collision
      () => {
        if (hasTriggeredElectro || isSequenceActive || !isElectroVisible) return;
        hasTriggeredElectro = true;
        
        // Hide the "Find the redzone" objective when entering redzone
        hideSceneObjective();
        
        // Ensure no previous Electro actions are running before starting the sequence
        stopAllElectroAnimationsBeforeSequence();
        
        startElectroSequence();
      }
    );
    
    // Make redzone visible initially
    if (electroTrigger && typeof electroTrigger.setVFXVisible === 'function') {
      electroTrigger.setVFXVisible(true);
      isRedzoneVisible = true;
    }
  }

  return {
    electroTrigger,
    electroCharacter,
    electroMixer,
    electroActions,
  };
}

/**
 * Show Electro and the redzone trigger.
 *
 * Called after the Zoe intro completes so the player can discover and enter the redzone.
 */
export function showElectroAndRedzone() {
  console.log("Showing electro and redzone after Zoe sequence completion");
  
  if (electroCharacter) {
    electroCharacter.visible = true;
    isElectroVisible = true;
    console.log("Electro character is now visible");
  }
  
  if (electroTrigger && typeof electroTrigger.setVFXVisible === 'function') {
    electroTrigger.setVFXVisible(true);
    isRedzoneVisible = true;
    console.log("Redzone is now visible");
  }
  
  // Show the objective to find the redzone
  // This will be handled by the objectives system when Zoe sequence ends
}

// Function to handle the talking sequence with head nod, head shake, talking, arm gesture, and breathing idle
function startTalkingLoop() {
  if (!electroActions || !electroActions.talking) return;
  
  let isInTalkingLoop = true;
  let talkingDuration = 3000; // 3 seconds of talking
  let headShakeDuration = 1500; // 1.5 seconds of head shake
  let headNodDuration = 2000; // 2 seconds of head nod
  let armGestureDuration = 2000; // 2 seconds of arm gesture
  
  function continueTalkingLoop() {
    if (!isInTalkingLoop || !isSequenceActive) return;
    
    // Play talking animation
    console.log("Playing TALKING animation");
    electroActions.talking.enabled = true;
    electroActions.talking.reset();
    electroActions.talking.setEffectiveTimeScale(animationSpeedFactor);
    electroActions.talking.setEffectiveWeight(1);
    electroActions.talking.fadeIn(0.5).play();
    
    // After talking, play thoughtful head shake
    setTimeout(() => {
      if (!isInTalkingLoop || !isSequenceActive) return;
      
      console.log("Playing THOUGHTFUL_HEAD_SHAKE animation");
      electroActions.talking.fadeOut(0.5);
      
      if (electroActions.thoughtful_head_shake) {
        electroActions.thoughtful_head_shake.enabled = true;
        electroActions.thoughtful_head_shake.reset();
        electroActions.thoughtful_head_shake.setEffectiveTimeScale(animationSpeedFactor);
        electroActions.thoughtful_head_shake.setEffectiveWeight(1);
        electroActions.thoughtful_head_shake.fadeIn(0.5).play();
        
        // After head shake, play head nod yes
        setTimeout(() => {
          if (!isInTalkingLoop || !isSequenceActive) return;
          
          console.log("Playing HEAD_NOD_YES animation");
          electroActions.thoughtful_head_shake.fadeOut(0.5);
          
          if (electroActions.head_nod_yes) {
            electroActions.head_nod_yes.enabled = true;
            electroActions.head_nod_yes.reset();
            electroActions.head_nod_yes.setEffectiveTimeScale(animationSpeedFactor);
            electroActions.head_nod_yes.setEffectiveWeight(1);
            electroActions.head_nod_yes.fadeIn(0.5).play();
            
            // After head nod, play talking
            setTimeout(() => {
              if (!isInTalkingLoop || !isSequenceActive) return;
              
              console.log("Playing TALKING animation again");
              electroActions.head_nod_yes.fadeOut(0.5);
              
              if (electroActions.talking) {
                electroActions.talking.enabled = true;
                electroActions.talking.reset();
                electroActions.talking.setEffectiveTimeScale(animationSpeedFactor);
                electroActions.talking.setEffectiveWeight(1);
                electroActions.talking.fadeIn(0.5).play();
                
                // After talking, play arm gesture
                setTimeout(() => {
                  if (!isInTalkingLoop || !isSequenceActive) return;
                  
                  console.log("Playing ARM_GESTURE animation");
                  electroActions.talking.fadeOut(0.5);
                  
                  if (electroActions.arm_gesture) {
                    electroActions.arm_gesture.enabled = true;
                    electroActions.arm_gesture.reset();
                    electroActions.arm_gesture.setEffectiveTimeScale(animationSpeedFactor);
                    electroActions.arm_gesture.setEffectiveWeight(1);
                    electroActions.arm_gesture.fadeIn(0.5).play();
                    
                    // After arm gesture, play breathing idle loop if there's time
                    setTimeout(() => {
                      if (!isInTalkingLoop || !isSequenceActive) return;
                      
                      console.log("Transitioning to BREATHING_IDLE loop");
                      electroActions.arm_gesture.fadeOut(0.5);
                      
                      if (electroActions.breathing_idle) {
                        electroActions.breathing_idle.enabled = true;
                        electroActions.breathing_idle.reset();
                        electroActions.breathing_idle.setEffectiveTimeScale(animationSpeedFactor);
                        electroActions.breathing_idle.setEffectiveWeight(1);
                        electroActions.breathing_idle.setLoop(THREE.LoopRepeat);
                        electroActions.breathing_idle.fadeIn(0.5).play();
                        
                        console.log("BREATHING_IDLE animation started, will loop until sound ends");
                      } else {
                        console.warn("breathing_idle action not found, falling back to idleAction");
                        if (electroActions.idleAction) {
                          electroActions.idleAction.enabled = true;
                          electroActions.idleAction.reset();
                          electroActions.idleAction.setEffectiveTimeScale(animationSpeedFactor);
                          electroActions.idleAction.setEffectiveWeight(1);
                          electroActions.idleAction.setLoop(THREE.LoopRepeat);
                          electroActions.idleAction.fadeIn(0.5).play();
                        }
                      }
                    }, armGestureDuration);
                  } else {
                    console.warn("arm_gesture action not found, transitioning to breathing idle");
                    if (electroActions.breathing_idle) {
                      electroActions.breathing_idle.enabled = true;
                      electroActions.breathing_idle.reset();
                      electroActions.breathing_idle.setEffectiveTimeScale(animationSpeedFactor);
                      electroActions.breathing_idle.setEffectiveWeight(1);
                      electroActions.breathing_idle.setLoop(THREE.LoopRepeat);
                      electroActions.breathing_idle.fadeIn(0.5).play();
                    }
                  }
                }, talkingDuration);
              } else {
                console.warn("talking action not found, transitioning to arm gesture");
                if (electroActions.arm_gesture) {
                  electroActions.arm_gesture.enabled = true;
                  electroActions.arm_gesture.reset();
                  electroActions.arm_gesture.setEffectiveTimeScale(animationSpeedFactor);
                  electroActions.arm_gesture.setEffectiveWeight(1);
                  electroActions.arm_gesture.fadeIn(0.5).play();
                }
              }
            }, headNodDuration);
          } else {
            console.warn("head_nod_yes action not found, transitioning to talking");
            if (electroActions.talking) {
              electroActions.talking.enabled = true;
              electroActions.talking.reset();
              electroActions.talking.setEffectiveTimeScale(animationSpeedFactor);
              electroActions.talking.setEffectiveWeight(1);
              electroActions.talking.fadeIn(0.5).play();
            }
          }
        }, headShakeDuration);
      } else {
        console.warn("thoughtful_head_shake action not found, transitioning to jumping");
        if (electroActions.jumping) {
          electroActions.jumping.enabled = true;
          electroActions.jumping.reset();
          electroActions.jumping.setEffectiveTimeScale(animationSpeedFactor);
          electroActions.jumping.setEffectiveWeight(1);
          electroActions.jumping.fadeIn(0.5).play();
        }
      }
    }, talkingDuration);
  }
  
  // Start the sequence
  continueTalkingLoop();
  
  // Store the loop control function for cleanup
  window.stopTalkingLoop = () => {
    isInTalkingLoop = false;
  };
}

// Make function globally accessible
window.showElectroAndRedzone = showElectroAndRedzone;

/**
 * Immediately stops the Electro sequence and triggers completion/cleanup.
 */
function skipElectroSequence() {
  if (!isSequenceActive) return;

  console.log("Electro sequence skipped by user.");

  // Stop the talking loop if it's running
  if (window.stopTalkingLoop) {
    window.stopTalkingLoop();
  }

  // Stop any GSAP animations
  try {
    gsap.killTweensOf(currentCamera.position);
    if (currentCamera.userData?.controls?.target) {
      gsap.killTweensOf(currentCamera.userData.controls.target);
    }
  } catch (_) {}

  // Stop sound
  if (electroSound) {
    electroSound.stop();
  }

  // Stop shape key animation
  if (shapeKeyControls) {
    shapeKeyControls.stopAnimation();
  }

  // Stop red alert and shake
  stopElectroCloseupRedAlertAndShake();

  // Hide skip button
  hideSkipButton();

  // Execute completion logic
  endElectroSequence();
}



function startElectroSequence() {
  if (isSequenceActive || !isElectroVisible) return;
  isSequenceActive = true;
  // Prevent player controller from overriding camera during scripted sequence
  window.isElectroSequencePlaying = true;

  // Initialize skip button if not already done
  if (!skipButtonInitialized) {
    createSkipButton(skipElectroSequence);
    skipButtonInitialized = true;
  }
  
  // Show skip button
  showSkipButton();

  // Disable controls first
  disablePlayerControls();
  togglePlayerControls(false);
  disableCameraControls();
  setCameraFollowsPlayer(false);
  setCameraFocusOnPlayer(false);
  hidePlayerModel();

  // Use the new electro position for camera focus
  const electroPosition = new THREE.Vector3(-15, 0, -141);
  const cameraPosition = new THREE.Vector3(-15, 1, -138); // Camera positioned to see electro

  // Smooth camera transition to electro
  if (currentCamera.userData?.controls) {
    currentCamera.userData.controls.enabled = false;
  }

  // Single GSAP animation for camera movement
  gsap.to(currentCamera.position, {
    x: cameraPosition.x,
    y: cameraPosition.y,
    z: cameraPosition.z,
    duration: 1.5,
    ease: "power2.inOut",
    onComplete: () => {
      if (currentCamera.userData?.controls) {
        currentCamera.userData.controls.target.set(-15, 1, -135); // Look at electro
        currentCamera.userData.controls.update();
      }
    },
  });

  // Optimize entry effect trigger at redzone location
  if (entryEffect) {
    entryEffect.trigger();
  }

  // Optimize character appearance and animation
  if (electroCharacter) {
    // Electro is already at the correct position (-15, 0, -141)

    if (shapeKeyControls) {
      shapeKeyControls.startAnimation();
    }

    // Simplified animation sequence: arm_gesture → talking
    if (electroActions) {
      // Stop any currently playing actions
      Object.values(electroActions).forEach(action => {
        if (action && action.isRunning()) {
          action.stop();
        }
      });

      // SEQUENCE 1: ARM_GESTURE (2 seconds)
      if (electroActions.arm_gesture) {
        console.log("Starting ARM_GESTURE animation");
        electroActions.arm_gesture.enabled = true;
        electroActions.arm_gesture.reset();
        electroActions.arm_gesture.setEffectiveTimeScale(animationSpeedFactor);
        electroActions.arm_gesture.setEffectiveWeight(1);
        electroActions.arm_gesture.fadeIn(0.5).play();

        // SEQUENCE 2: TALKING → THOUGHTFUL_HEAD_SHAKE → TALKING (loop until audio ends)
        setTimeout(() => {
          console.log("Transitioning to TALKING animation");
          electroActions.arm_gesture.fadeOut(0.5);
          
          if (electroActions.talking) {
            electroActions.talking.enabled = true;
            electroActions.talking.reset();
            electroActions.talking.setEffectiveTimeScale(animationSpeedFactor);
            electroActions.talking.setEffectiveWeight(1);
            electroActions.talking.fadeIn(0.5).play();

            // Start the talking loop sequence
            startTalkingLoop();
          } else {
            console.warn("talking action not found, falling back to talking_02");
            if (electroActions.talking_02) {
              electroActions.talking_02.enabled = true;
              electroActions.talking_02.reset();
              electroActions.talking_02.setEffectiveTimeScale(animationSpeedFactor);
              electroActions.talking_02.setEffectiveWeight(1);
              electroActions.talking_02.fadeIn(0.5).play();
            }
          }
        }, 2000); // Wait 2 seconds for arm gesture
      } else {
        console.warn("arm_gesture action not found, starting with talking");
        if (electroActions.talking) {
          electroActions.talking.enabled = true;
          electroActions.talking.reset();
          electroActions.talking.setEffectiveTimeScale(animationSpeedFactor);
          electroActions.talking.setEffectiveWeight(1);
          electroActions.talking.fadeIn(0.5).play();
        }
      }
    }

    // Optimize sound playback
    if (electroSound) {
      electroSound.play();

      if (soundEndTimeout) {
        clearTimeout(soundEndTimeout);
      }

      soundEndTimeout = setTimeout(() => {
        endElectroSequence();
      }, soundDuration * 1000 + 500);

      electroSound.onEnded = () => {
        if (soundEndTimeout) {
          clearTimeout(soundEndTimeout);
        }
        endElectroSequence();
      };
    }
  }
}

/**
 * End the main Electro beat and proceed into the “walk together” then “fall” chain.
 * This is invoked when the audio ends, when a fallback timeout triggers, or on skip.
 */
function endElectroSequence() {
  // Stop the talking loop if it's running
  if (window.stopTalkingLoop) {
    window.stopTalkingLoop();
  }
  
  // Hide skip button
  hideSkipButton();
  
  if (electroTrigger) {
    electroTrigger.removeParticleEffects();
  }

  if (shapeKeyControls) {
    shapeKeyControls.stopAnimation();
  }

  // Don't hide electro character yet
  if (electroCharacter) {
    // Position Electro next to player
    const player = currentScene.getObjectByName("playerCapsule") || 
                   currentScene.getObjectByName("player");
    if (player) {
      electroCharacter.visible = true;
      electroCharacter.position.set(
        player.position.x - 2,
        player.position.y-1,
        player.position.z
      );
      electroCharacter.rotation.set(0, Math.PI / 2, 0); // Face towards player
    }
  }

  if (electroSound) {
    electroSound.stop();
  }

  if (soundEndTimeout) {
    clearTimeout(soundEndTimeout);
    soundEndTimeout = null;
  }

  isSequenceActive = false;
  hasTriggeredElectro = false;

  // Ensure player is visible before starting shattering effect
  if (currentScene) {
    currentScene.traverse((object) => {
      if (object.name === "playerCapsule" || 
          (object.parent && object.parent.name === "playerCapsule") ||
          object.name === "player" ||
          (object.parent && object.parent.name === "player")) {
        object.visible = true;
        if (object.isLight) {
          object.intensity = 1;
        }
      }
    });
  }

  // Crack effects are now handled by the falling sequence

  // Start a short walking sequence together before the fall, then proceed
  startWalkingSequenceThenFall();
}

/**
 * Per-frame update for Electro.
 *
 * Responsibilities:
 * - Advance Electro mixer animations.
 * - Update the redzone trigger's particle simulation and collision checks.
 * - During the walking sequence, keep the camera following and keep player walk animation alive.
 *
 * @param {number} delta Frame delta in seconds
 * @param {THREE.Object3D} player Player object used for trigger checks and camera follow
 */
export function updateElectro(delta, player) {
  if (!player) return;

  if (electroMixer) {
    electroMixer.update(delta);
  }

  if (electroTrigger) {
    electroTrigger.updateQuarksScene(delta, player);
  }

  // During walking sequence, robust camera follow and ensure animations persist (handles tab switches)
  if (isWalkingActive && currentCamera && player) {
    const dir = walkingFollowConfig.direction || new THREE.Vector3(-1, 0, 0);
    const off = walkingFollowConfig.followOffset || new THREE.Vector3(0, 0.5, 4);
    const behind = dir.clone().multiplyScalar(-off.z);
    const up = new THREE.Vector3(0, off.y, 0);
    const side = new THREE.Vector3();
    side.crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize().multiplyScalar(off.x);
    const desiredCamPos = player.position.clone().add(behind).add(up).add(side);
    currentCamera.position.lerp(desiredCamPos, 0.2);
    if (currentCamera.userData?.controls) {
      currentCamera.userData.controls.target.copy(player.position);
      currentCamera.userData.controls.update();
    } else {
      currentCamera.lookAt(player.position);
    }
    try { updatePlayerAnimation(true, false); } catch (_) {}
    return;
  }

  // Face-camera behavior disabled during walking sequence
  if (!isWalkingActive && isSequenceActive && electroCharacter?.visible && isElectroVisible) {
    // Use the new electro position for camera focus
    const fixedLookAtPosition = new THREE.Vector3(-15, 1, -141);

    if (currentCamera) {
      currentCamera.lookAt(fixedLookAtPosition);

      if (currentCamera.userData?.controls) {
        currentCamera.userData.controls.target.copy(fixedLookAtPosition);
        currentCamera.userData.controls.update();
      }
    }

    if (electroCharacter) {
      const directionToCamera = new THREE.Vector3();
      directionToCamera
        .subVectors(currentCamera.position, electroCharacter.position)
        .normalize();
      const angle = Math.atan2(directionToCamera.x, directionToCamera.z);
      electroCharacter.rotation.y = angle;
    }
  }
}

/**
 * Cleanup Electro resources and reset state.
 *
 * Called during scene shutdown to avoid “zombie” timeouts, tweens, and globals.
 */
export function cleanupElectro() {
  // Clean up global functions
  if (window.showElectroAndRedzone) {
    delete window.showElectroAndRedzone;
  }
  if (walkTimeline) {
    walkTimeline.kill();
    walkTimeline = null;
  }
  
  // Hide skip button during cleanup
  hideSkipButton();
  // Ensure red alert/shake is stopped if active
  try { stopElectroCloseupRedAlertAndShake(); } catch (_) {}
  // Cleanup crack reveal
  try {
    if (crackRevealTween) { crackRevealTween.kill(); crackRevealTween = null; }
    if (crackMeshes && crackMeshes.length) {
      for (let i = 0; i < crackMeshes.length; i++) {
        try {
          crackMeshes[i].visible = false;
          if (crackOriginalMaterials && crackOriginalMaterials[i]) {
            crackMeshes[i].material = crackOriginalMaterials[i];
          }
          if (crackRevealMaterials && crackRevealMaterials[i]) {
            try { crackRevealMaterials[i].dispose && crackRevealMaterials[i].dispose(); } catch (_) {}
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  // Re-enable player controller camera behavior after sequence ends
  window.isElectroSequencePlaying = false;
  
  // redzoneEffect cleanup removed - was never used

  if (electroCharacter && currentScene) {
    // Optimize model cleanup
    electroCharacter.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    currentScene.remove(electroCharacter);
    electroCharacter = null;
  }

  if (electroSound) {
    electroSound.stop();
    electroSound = null;
  }

  if (soundEndTimeout) {
    clearTimeout(soundEndTimeout);
    soundEndTimeout = null;
  }
}


// Internal helper: walk player and electro forward with camera following, then trigger falling sequence
function startWalkingSequenceThenFall() {
  const player = currentScene.getObjectByName("playerCapsule") || currentScene.getObjectByName("player");
  if (!player || !electroCharacter || !currentCamera) {
    proceedToFallingSequence();
    return;
  }

  // Ensure visibility and controls state suitable for walking showcase
  showPlayerModel();
  enableCameraControls();
  setCameraFollowsPlayer(false);
  setCameraFocusOnPlayer(false);

  // Orient both player and electro before starting walk
  try {
    // Reset player orientation, then face world -X for the walk
    player.rotation.set(0, Math.PI / 2, 0);
  } catch (_) {}
  try {
    const lookTargetElectro = electroCharacter.position.clone().add(new THREE.Vector3(-1, 0, 0));
    electroCharacter.lookAt(lookTargetElectro);
  } catch (_) {}

  // Start Electro walking animation if available
  if (electroActions && electroActions.walkAction) {
    try {
      electroActions.walkAction.enabled = true;
      electroActions.walkAction.reset();
      electroActions.walkAction.setLoop(THREE.LoopRepeat);
      electroActions.walkAction.setEffectiveTimeScale(animationSpeedFactor * 0.8);
      electroActions.walkAction.setEffectiveWeight(1);
      electroActions.walkAction.fadeIn(0.3).play();
    } catch (_) {}
  } else if (electroActions && electroActions.walking) {
    try {
      electroActions.walking.enabled = true;
      electroActions.walking.reset();
      electroActions.walking.setLoop(THREE.LoopRepeat);
      electroActions.walking.setEffectiveTimeScale(animationSpeedFactor * 0.8);
      electroActions.walking.setEffectiveWeight(1);
      electroActions.walking.fadeIn(0.3).play();
    } catch (_) {}
  }

  // Trigger player's walking animation during scripted movement
  try {
    updatePlayerAnimation(true, false);
    // Ensure player's mixer keeps updating even if playerControlsEnabled is false during sequence
    if (window.THREE && window.THREE.AnimationMixer) {
      // no-op; mixer is already updated in player controller; we reaffirm per-frame below
    }
  } catch (_) {}

  // Compute movement along world -X direction
  const walkDir = new THREE.Vector3(-1, 0, 0);
  // Persist follow settings to survive tab switches
  walkingFollowConfig.direction.copy(walkDir);
  walkingFollowConfig.followOffset.set(0, 0.3, 2.5);
  const walkDistance = 14; // increased distance
  const movement = walkDir.clone().multiplyScalar(walkDistance);

  const playerStart = player.position.clone();
  const electroStart = electroCharacter.position.clone().add(new THREE.Vector3(0, 0, 1.5)); // small z offset between them
  const playerEnd = playerStart.clone().add(movement);
  const electroEnd = electroStart.clone().add(movement);

  // Camera follow params
  const desiredFollowOffset = new THREE.Vector3(0, 0.3, 2.5); // lowered camera height
  isWalkingActive = true;

  // Kill existing timeline if any
  if (walkTimeline) {
    walkTimeline.kill();
    walkTimeline = null;
  }

  walkTimeline = gsap.timeline({
    onComplete: () => {
      isWalkingActive = false;
      // Fade out walking anim
      try {
        if (electroActions?.walkAction) electroActions.walkAction.fadeOut(0.2);
        if (electroActions?.walking) electroActions.walking.fadeOut(0.2);
      } catch (_) {}
      try { updatePlayerAnimation(false, false); } catch (_) {}
      proceedToFallingSequence();
    },
    onStop: () => {
      isWalkingActive = false;
      try { updatePlayerAnimation(false, false); } catch (_) {}
    }
  });

  // Animate positions
  walkTimeline.to(player.position, {
    x: playerEnd.x,
    y: playerEnd.y,
    z: playerEnd.z,
    duration: 4.5,
    ease: "power1.inOut",
    onUpdate: () => {
      // Keep Electro locked to player's actual movement delta to preserve constant offset
      const playerDelta = player.position.clone().sub(playerStart);
      electroCharacter.position.copy(electroStart.clone().add(playerDelta));

      // Camera follow: place camera slightly behind and above the player
      const behind = walkDir.clone().multiplyScalar(-desiredFollowOffset.z);
      const up = new THREE.Vector3(0, desiredFollowOffset.y, 0);
      const side = new THREE.Vector3();
      side.crossVectors(new THREE.Vector3(0, 1, 0), walkDir).normalize().multiplyScalar(desiredFollowOffset.x);
      const desiredCamPos = player.position.clone().add(behind).add(up).add(side);
      currentCamera.position.lerp(desiredCamPos, 0.15);
      if (currentCamera.userData?.controls) {
        currentCamera.userData.controls.target.copy(player.position);
        currentCamera.userData.controls.update();
      } else {
        currentCamera.lookAt(player.position);
      }
      // Reaffirm player's walking animation continuously during scripted movement
      try { updatePlayerAnimation(true, false); } catch (_) {}
    }
  }, 0);
}

function proceedToFallingSequence() {
  // Play the fallsound before starting the sequence (keeps previous behavior)
  const fallSound = moduleAllAssets.audios.fallsound;
  if (fallSound) {
    fallSound.play();
  }

  const player = currentScene.getObjectByName("playerCapsule") || currentScene.getObjectByName("player");
  if (player && currentCamera) {
    // Position camera for a closeup relative to Electro (fallback to player)
    const focusObject = electroCharacter || player;
    console.log("Camera close-up to Electro after walking sequence", {
      focusName: focusObject.name || "unknown",
      focusPosition: focusObject.position.clone(),
      previousCameraPosition: currentCamera.position.clone()
    });
    // Start red alert overlay + shake during closeup window
    try { startElectroCloseupRedAlertAndShake(); } catch (_) {}
    const closeupOffset = new THREE.Vector3(-0.8, 0.8, -1); // slight diagonal, near
    const headLookOffset = new THREE.Vector3(0, 0.8, 0); // look towards head height
    currentCamera.position.copy(focusObject.position).add(closeupOffset);
    if (currentCamera.userData?.controls) {
      currentCamera.userData.controls.target.copy(focusObject.position.clone().add(headLookOffset));
      currentCamera.userData.controls.update();
    } else {
      currentCamera.lookAt(focusObject.position.clone().add(headLookOffset));
    }

    // Give a little more time on Electro close-up before panning to ground
    setTimeout(() => {
      // Smoothly pan camera look to the ground near the focus object
      try {
        const groundLookAt = focusObject.position.clone().add(new THREE.Vector3(0, -1.2, 0));
        if (currentCamera.userData?.controls && currentCamera.userData.controls.target) {
          const target = currentCamera.userData.controls.target;
          gsap.to(target, {
            x: groundLookAt.x,
            y: groundLookAt.y,
            z: groundLookAt.z,
            duration: 0.9,
            ease: "power2.inOut",
            onUpdate: () => { currentCamera.userData.controls.update(); }
          });
        } else {
          const temp = { t: 0 };
          gsap.to(temp, {
            t: 1,
            duration: 0.9,
            ease: "power2.inOut",
            onUpdate: () => { currentCamera.lookAt(groundLookAt); }
          });
        }
      } catch (_) {}

      // Reveal the crack mesh/group from left-to-right
      try {
        if (crackMeshes && crackMeshes.length && crackRevealMaterials && crackRevealMaterials.length) {
          // Start off-screen to the right and slide across to the left
          crackSharedRevealUniform.value = 1.2;
          for (let i = 0; i < crackMeshes.length; i++) {
            try {
              crackMeshes[i].material = crackRevealMaterials[i];
              crackMeshes[i].visible = true;
            } catch (_) {}
          }
          if (crackRevealTween) { try { crackRevealTween.kill(); } catch (_) {} crackRevealTween = null; }
          crackRevealTween = gsap.to(crackSharedRevealUniform, {
            value: -0.2,
            duration: 2.0,
            ease: "linear"
          });
        }
      } catch (_) {}
    }, 2000);
  }

  // After a short delay to let cracks show, start falling
  setTimeout(() => {
    // Stop red alert overlay + shake right before the falling starts
    try { stopElectroCloseupRedAlertAndShake(); } catch (_) {}
    if (electroCharacter) {
      electroCharacter.visible = false;
    }
    // Hide/remove crack visuals when falling starts
    try {
      if (crackRevealTween) { crackRevealTween.kill(); crackRevealTween = null; }
      if (crackMeshes && crackMeshes.length) {
        for (let i = 0; i < crackMeshes.length; i++) {
          try { crackMeshes[i].visible = false; } catch (_) {}
        }
      }
    } catch (_) {}
    const playerRef = currentScene.getObjectByName("playerCapsule") || currentScene.getObjectByName("player");
    startMainFallingSequence(currentScene, currentCamera, playerRef, electroCharacter);

    window.dispatchEvent(new CustomEvent("electroSequenceComplete", { detail: { timestamp: Date.now() } }));
    switchToScene4AfterDelay(8500);
    // Allow player controller to resume camera management after scripted sequence hands off
    window.isElectroSequencePlaying = false;
  }, 4000);
}
