/**
 * @fileoverview Scene 5 “Electro” cinematic + interaction sequence controller.
 *
 * Responsibilities:
 * - Own the Electro character instance for Scene 5 (pose, idle, scripted actions).
 * - Temporarily disable player input/camera following during the cinematic.
 * - Drive a deterministic chain of actions:
 *   1) cinematic camera move toward Electro
 *   2) play Electro audio lines and animations (with cross-fades)
 *   3) show video on specific environment meshes (e.g. "display001")
 *   4) trigger switch/button interaction (raycast-verified click)
 *   5) spawn sparks VFX and display picture, then return control to player
 *
 * Public API (used from `scene5.js`):
 * - `initializeElectro(...)`: register dependencies and build action map.
 * - `startElectroSequence()`: begin the scripted flow; idempotent.
 * - `updateElectro(delta)`: per-frame updates (mixer + ThreeMeshUI).
 * - `cleanupElectro()`: dispose/stop anything owned by this module.
 *
 * Implementation notes:
 * - This module keeps module-scope state (scene/camera/player references).
 * - It expects `assetsLoader` to have populated:
 *   - `allAssets.characters.models.electro`
 *   - `allAssets.characters.animations.electro.mixer/actions`
 *   - audio keys like `electrosound`, `electrosound1`, etc.
 * - A number of steps rely on `AudioBufferSourceNode.onended` when available,
 *   with timeouts as fallbacks.
 */
import * as THREE from "three";
import { setupShapeKeyAnimations } from "../commonFiles/electroShapeKey.js";
import {
  togglePlayerControls,
  playerState,
  updatePlayerAnimation,
  switchAction,
  playerControlsEnabled,
  hidePlayerModel,
  switchToFirstPerson,
  setCameraFollowsPlayer,
  setCameraFocusOnPlayer,
} from "../commonFiles/playerController.js";
import gsap from "gsap";
import { playAudio } from "../commonFiles/audiomanager.js";
import { showFPPOverlay } from "./uiManager.js";
import ThreeMeshUI from "three-mesh-ui";

// State variables for Electro interaction
let isElectroSequenceActive = false;
let sceneStartTime = 0;
let electroSoundDuration = 0;
let electroSoundStartTime = 0;
let isElectroSoundPlaying = false;
let shapeKeyControls = null;
let allAssets = null;
let electroComponents = null;

// Local references to HUD video (passed from scene5.js)
let hudVideoPlane = null;
let hudVideoElement = null;

// Camera movement variables
let cameraTimeline = null;
let currentCameraPosition = new THREE.Vector3();
let currentLookAtPosition = new THREE.Vector3();

// Scene references
let scene = null;
let camera = null;
let player = null;
let controls = null;
let renderer = null;

// Electro animations
let electroActions = null;

// Sequence timing constants
const SEQUENCE_START_DELAY = 7000; // 5 seconds after scene loads
const CAMERA_MOVEMENT_DURATION = 2.5; // 2.5 seconds for camera movement

// Lazy-load lil-gui to control the display video plane
let _displayPlaneGUI = null;

// --- Animation utilities & guards ---
let _mixerFinishedHandler = null;

/**
 * Normalize a `THREE.AnimationAction` before playing it.
 *
 * @param {THREE.AnimationAction} action
 * @param {THREE.AnimationActionLoopStyles} loop
 * @param {boolean} clamp
 * @param {number} timeScale
 * @returns {THREE.AnimationAction}
 */
function normalizeAction(
  action,
  loop = THREE.LoopOnce,
  clamp = true,
  timeScale = 1
) {
  if (!action) return action;
  action.enabled = true;
  action.setLoop(loop);
  action.clampWhenFinished = clamp;
  action.timeScale = timeScale;
  return action;
}

/**
 * Cross-fade from one action to another, ensuring the destination action
 * is correctly configured and reset.
 *
 * @param {THREE.AnimationAction|null} fromAction
 * @param {THREE.AnimationAction} toAction
 * @param {number} crossFade
 * @param {THREE.AnimationActionLoopStyles} loop
 * @param {boolean} clamp
 * @param {number} timeScale
 */
function playExclusive(
  fromAction,
  toAction,
  crossFade = 0.25,
  loop = THREE.LoopOnce,
  clamp = true,
  timeScale = 1
) {
  if (!toAction) return;
  normalizeAction(toAction, loop, clamp, timeScale);
  toAction.reset();
  if (fromAction && fromAction !== toAction) {
    try {
      fromAction.crossFadeTo(toAction, crossFade, true);
    } catch (_) {}
  }
  toAction.play();
}

/**
 * Safe helper to fade Electro back to idle.
 *
 * Idle is configured to loop and not clamp, so Electro stays animated.
 * @param {number} crossFade
 */
function goToIdle(crossFade = 0.3) {
  if (!electroActions?.idleAction) return;
  const idle = electroActions.idleAction;
  normalizeAction(idle, THREE.LoopRepeat, false, 1);
  idle.reset();
  idle.fadeIn(crossFade);
  idle.play();
}

/**
 * Lazy-load lil-gui only when needed (debugging only).
 * This keeps bundle weight smaller for normal gameplay.
 *
 * @returns {Promise<any|null>} GUI class or null if unavailable.
 */
function loadLilGui() {
  return new Promise((resolve) => {
    // Try module import first if environment supports it
    const tryDynamicImport = async () => {
      try {
        const mod = await import(
          "three/examples/jsm/libs/lil-gui.module.min.js"
        );
        return mod.GUI;
      } catch (e) {
        return null;
      }
    };
    const onReady = (GUIClass) => {
      if (GUIClass) return resolve(GUIClass);
      // Fallback to UMD from CDN
      const scriptId = "lil-gui-cdn-script";
      if (!document.getElementById(scriptId)) {
        const s = document.createElement("script");
        s.id = scriptId;
        s.src =
          "https://cdn.jsdelivr.net/npm/lil-gui@0.19/dist/lil-gui.umd.min.js";
        s.async = true;
        s.onload = () =>
          resolve(window.lil && window.lil.GUI ? window.lil.GUI : null);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      } else {
        // Already injected
        resolve(window.lil && window.lil.GUI ? window.lil.GUI : null);
      }
    };
    tryDynamicImport().then(onReady);
  });
}

/**
 * Debug helper: attach a GUI to tweak the “display001 video plane” transform.
 * This is only used during development / alignment work.
 *
 * @param {THREE.Object3D} screenPlane
 */
function setupDisplayPlaneGUI(screenPlane) {
  if (!screenPlane) return;
  // Destroy previous GUI if any
  if (_displayPlaneGUI && typeof _displayPlaneGUI.destroy === "function") {
    _displayPlaneGUI.destroy();
    _displayPlaneGUI = null;
  }
  loadLilGui().then((GUIClass) => {
    if (!GUIClass) {
      console.warn(
        "[DEBUG] lil-gui not available; cannot create plane controls"
      );
      return;
    }
    const gui = new GUIClass({ title: "Display001 Video Plane" });
    _displayPlaneGUI = gui;
    const posFolder = gui.addFolder("Position");
    posFolder.add(screenPlane.position, "x", -1000, 1000, 0.001).name("x");
    posFolder.add(screenPlane.position, "y", -2000, 2000, 0.001).name("y");
    posFolder.add(screenPlane.position, "z", -1000, 1000, 0.001).name("z");
    posFolder.open();
    const rotFolder = gui.addFolder("Rotation (rad)");
    rotFolder
      .add(screenPlane.rotation, "x", -Math.PI, Math.PI, 0.01)
      .name("rotX");
    rotFolder
      .add(screenPlane.rotation, "y", -Math.PI, Math.PI, 0.01)
      .name("rotY");
    rotFolder
      .add(screenPlane.rotation, "z", -Math.PI, Math.PI, 0.01)
      .name("rotZ");
    rotFolder.open();
    // Optional: quick visibility toggle
    gui.add(screenPlane, "visible").name("Visible");
  });
}

/**
 * Provide runtime dependencies needed by this module.
 * Kept separate so the module can be initialized from multiple call sites.
 *
 * @param {THREE.Camera} newCamera
 * @param {THREE.Object3D} newPlayer
 * @param {THREE.Scene} newScene
 * @param {any} newControls OrbitControls-like instance
 * @param {THREE.WebGLRenderer} newRenderer
 */
export function setDependencies(
  newCamera,
  newPlayer,
  newScene,
  newControls,
  newRenderer
) {
  camera = newCamera;
  player = newPlayer;
  scene = newScene;
  controls = newControls;
  renderer = newRenderer;
}

/**
 * Initialize Electro for Scene 5.
 *
 * Creates the `electroActions` map, ensures the idle pose is applied immediately
 * (preventing a brief T-pose flash), and wires a global mixer "finished"
 * handler so the character always returns to idle after any one-shot action.
 *
 * @param {THREE.Scene} newScene
 * @param {any} assets All loaded assets (from `assetsLoader`)
 * @param {THREE.Object3D} player
 * @param {THREE.Camera} camera
 * @param {any} controls OrbitControls-like
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Mesh|null} hudVideoPlaneParam Optional: plane mesh for HUD video focus
 * @param {HTMLVideoElement|null} hudVideoElementParam Optional: element backing the HUD plane texture
 * @returns {{ electro: any, electroActions: any, electroMixer: any }|null}
 */
export function initializeElectro(
  newScene,
  assets,
  player,
  camera,
  controls,
  renderer,
  hudVideoPlaneParam = null,
  hudVideoElementParam = null
) {
  setDependencies(camera, player, newScene, controls, renderer);
  allAssets = assets;
  hudVideoPlane = hudVideoPlaneParam;
  hudVideoElement = hudVideoElementParam;

  const electro = allAssets.characters.models.electro;
  if (!electro) {
    console.error("Electro model not found in assets");
    return null;
  }

  // Keep hidden until fully posed
  electro.visible = false;
  newScene.add(electro);
  electro.position.set(-34, 0, 0);
  electro.rotation.set(0, 1.5, 0);

  shapeKeyControls = setupShapeKeyAnimations(electro);

  electroActions = {
    jumpAction: assets.characters.animations.electro.actions.JUMPING,
    idleAction: assets.characters.animations.electro.actions.BREATHING_IDLE,
    runAction: assets.characters.animations.electro.actions.RUNNING,
    sitAction: assets.characters.animations.electro.actions.ENTERING,
    walkAction: assets.characters.animations.electro.actions.WALKING,
    landingAction: assets.characters.animations.electro.actions.LANDING,
    heyAction:
      assets.characters.animations.electro.actions.THOUGHTFUL_HEAD_SHAKE,
    cuteAction: assets.characters.animations.electro.actions.ARM_GESTURE,
    explainAction: assets.characters.animations.electro.actions.TALKING_01,
    disbeliefAction: assets.characters.animations.electro.actions.DISBELIEF,
    legAction: assets.characters.animations.electro.actions.LEG_02,
    pointingAction: assets.characters.animations.electro.actions.POINTING_RIGHT,
    ThumbsupAction:
      assets.characters.animations.electro.actions.THUMSUP_EXPLAIN,
  };

  const mixer = allAssets.characters.animations.electro.mixer;
  electroComponents = { electro, electroActions, electroMixer: mixer };

  // Global mixer finished → always return to idle as a safety net
  if (_mixerFinishedHandler) {
    try {
      mixer.removeEventListener("finished", _mixerFinishedHandler);
    } catch (_) {}
  }
  _mixerFinishedHandler = (e) => {
    const finishedAction = e?.action;
    if (!finishedAction) return;
    // If anything other than idle ends, go back to idle
    if (finishedAction !== electroActions.idleAction) {
      goToIdle(0.25);
    }
  };
  mixer.addEventListener("finished", _mixerFinishedHandler);

  if (electroActions.idleAction) {
    const idle = normalizeAction(
      electroActions.idleAction,
      THREE.LoopRepeat,
      false,
      1
    );
    idle.reset();
    idle.play();

    // Jump to first keyframe immediately
    idle.time = 0;
    mixer.update(0); // apply skeleton pose immediately
  }

  // ✅ Show Electro only after pose applied
  electro.visible = true;

  return electroComponents;
}

/**
 * Start the Electro scripted sequence.
 *
 * Idempotent: calling again while active does nothing.
 * Side effects:
 * - disables player controls and orbit controls
 * - disables camera follow
 * - starts shape key animation loop
 * - triggers cinematic camera movement + subsequent async chain
 */
export function startElectroSequence() {
  if (isElectroSequenceActive) {

    return;
  }

 
  isElectroSequenceActive = true;
  sceneStartTime = performance.now();

  // Ensure shape key animations run for the whole sequence
  try {
    if (
      shapeKeyControls &&
      typeof shapeKeyControls.startAnimation === "function"
    ) {
      shapeKeyControls.startAnimation();
    }
  } catch (e) {
    console.warn("[DEBUG] Could not start shape key animations", e);
  }

  // Disable player controls and camera controls
  togglePlayerControls(false);
  if (controls) {
    controls.enabled = false;
  }
  setCameraFollowsPlayer(false);

  // Start the electro interaction
  startElectroInteraction();
}

/**
 * Internal: begin the interaction now that dependencies exist.
 * Applies a safe idle pose and starts the cinematic camera motion.
 */
function startElectroInteraction() {
  if (!electroComponents?.electro || !player) return;

  const electro = electroComponents.electro;


  if (electroActions.idleAction) {
    const idle = normalizeAction(
      electroActions.idleAction,
      THREE.LoopRepeat,
      false,
      1
    );
    idle.time = 0.1; // skip first 0.1s (avoids T-pose baked at frame 0)
    idle.play();

    // Force apply pose instantly
    electroComponents.electroMixer.update(0);
  }

  // Now do cinematic camera movement
  createCinematicCameraMovement(electro);
}

/**
 * Internal: cinematic camera move toward Electro, then trigger first animation
 * and audio beat.
 *
 * This is the top-level entry for the sequence chain.
 * @param {any} electro Electro object3D
 */
function createCinematicCameraMovement(electro) {
  if (!camera || !electro || !player) return;

  const originalPosition = new THREE.Vector3(-33, 2, 0);
  const originalRotation = camera.rotation.clone();
  const originalTarget = new THREE.Vector3(-33, 2, 0);

  const electroPosition = electro.position.clone();
  const targetPosition = new THREE.Vector3(
    electroPosition.x + 1.2,
    electroPosition.y + 0.8,
    electroPosition.z + 0.1
  );
  const targetLookAt = new THREE.Vector3(
    electroPosition.x - 1,
    electroPosition.y + 0.8,
    electroPosition.z
  );

  gsap.to(camera.position, {
    x: targetPosition.x,
    y: targetPosition.y,
    z: targetPosition.z,
    duration: 3.5,
    ease: "power1.inOut",
    onUpdate: () => {
      camera.lookAt(targetLookAt);
      if (controls) {
        controls.target.copy(targetLookAt);
        controls.update();
      }
    },
    onComplete: () => {
   

      if (electroActions.ThumbsupAction) {
        const from = electroActions.idleAction;
        const to = electroActions.ThumbsupAction;
        normalizeAction(to, THREE.LoopPingPong, false, 1);
        to.reset();
        if (from)
          try {
            from.crossFadeTo(to, 0.2, true);
          } catch (_) {}
        to.play();
      }

      // Small delay to ensure explain starts before sound
      setTimeout(() => {
        if (allAssets.audios.electrosound) {
          const sound = allAssets.audios.electrosound;
          sound.play();

          // ✅ Correctly detect when sound finishes
          if (sound.source) {
            sound.source.onended = () => {
              handleElectroAfterSound(electro);
            };
          } else {
            // fallback in case source not yet created
            setTimeout(
              () => handleElectroAfterSound(electro),
              sound.buffer?.duration * 1000 || 3000
            );
          }
        }
      }, 100); // wait before sound starts, so explain animation plays first
     
    },
  });
}

/**
 * Internal: continuation after `electrosound` completes.
 * Moves Electro, follows with camera, then plays the next sound and proceeds.
 * @param {any} electro
 */
function handleElectroAfterSound(electro) {



  if (electroActions.ThumbsupAction && electroActions.walkAction) {
    const walk = normalizeAction(
      electroActions.walkAction,
      THREE.LoopRepeat,
      false,
      1
    );
    walk.reset();
    try {
      electroActions.ThumbsupAction.crossFadeTo(walk, 0.15, true);
    } catch (_) {}
    walk.play();
  }


  gsap.to(electro.rotation, {
    y: electro.rotation.y + Math.PI / 2,
    duration: 1,
    ease: "power1.inOut",
  });


  const walkTarget = new THREE.Vector3(-34, 0, -3);
  gsap.to(electro.position, {
    x: walkTarget.x,
    y: walkTarget.y,
    z: walkTarget.z,
    duration: 4,
    ease: "power1.inOut",
    onUpdate: () => {
 
      const followOffset = new THREE.Vector3(0, 1, 2);
      const camPos = electro.position.clone().add(followOffset);

      camera.position.lerp(camPos, 0.1);
      camera.lookAt(electro.position);

      if (controls) {
        controls.target.copy(electro.position);
        controls.update();
      }
    },
    onComplete: () => {
 

      // ✅ Stop walking, return to idle (reset timescale!)
      if (electroActions.walkAction && electroActions.idleAction) {
        try {
          electroActions.walkAction.crossFadeTo(
            electroActions.idleAction,
            0.3,
            true
          );
        } catch (_) {}
        goToIdle(0.3);
      } else {
        goToIdle(0.3);
      }

      // ✅ Start electrosound1 immediately after walking ends
      if (allAssets.audios.electrosound1) {
        const sound1 = allAssets.audios.electrosound1;
        try {
          sound1.stop?.();
        } catch (_) {}
        sound1.play();

        // Switch idle → cuteAction synced with sound (kept as part of original flow)
        if (electroActions.idleAction && electroActions.pointingAction) {
          playExclusive(
            electroActions.idleAction,
            electroActions.pointingAction,
            0.4,
            THREE.LoopOnce,
            true,
            1
          );
          // The global mixer Finished handler will push to idle automatically
        }

        // ✅ After electrosound1 finishes: then play electrosound4 + explain once, then continue
        const onElectroSound1End = () => {


          // Play electrosound4 only AFTER electrosound1, and run explainAction once, then proceed
          if (!onElectroSound1End._sound4Handled) {
            onElectroSound1End._sound4Handled = true;

            // Trigger explainAction once, then go back to idle
            if (electroActions.idleAction && electroActions.legAction) {
              playExclusive(
                electroActions.idleAction,
                electroActions.legAction,
                0.25,
                THREE.LoopOnce,
                true,
                1
              );
              // Global finished handler will go to idle
            }

            const sound4 = allAssets?.audios?.electrosound4;
            if (sound4 && typeof sound4.play === "function") {
              try {
                sound4.stop?.();
              } catch (_) {}
              try {
 
                sound4.play();
                if (sound4.source) {
                  sound4.source.onended = () => {

                    onElectroSound1End();
                  };
                  return; // wait for sound4 to finish
                } else {
                  setTimeout(() => {

                    onElectroSound1End();
                  }, sound4.buffer?.duration * 1000 || 3000);
                  return; // wait for timeout
                }
              } catch (e) {
                console.warn("[DEBUG] electrosound4 play error", e);
              }
            }
            // If no sound4, just proceed immediately
          }


          // Find display mesh in underground model
          const underground = allAssets?.models?.gltf?.underground;
          let displayMesh = null;
          if (underground && underground.traverse) {
            underground.traverse((obj) => {
              if (obj.isMesh && obj.name === "display001" && !displayMesh) {
                displayMesh = obj;
              }
            });
          }

          // Apply screen video texture
          if (displayMesh && allAssets?.videotextures?.screenvideo) {
            const videoElement = document.createElement("video");
            videoElement.src = allAssets.videotextures.screenvideo.path;
            videoElement.loop = false;
            videoElement.muted = false;
            videoElement.playsInline = true;
            videoElement.crossOrigin = "anonymous";
            videoElement.autoplay = true;
            videoElement.preload = "auto";
            videoElement.style.display = "none";
            document.body.appendChild(videoElement);

            const videoTexture = new THREE.VideoTexture(videoElement);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            videoTexture.format = THREE.RGBAFormat;
            if (THREE.SRGBColorSpace) {
              videoTexture.colorSpace = THREE.SRGBColorSpace;
            }

            // Compute local bounding box to derive width/height and orientation
            if (!displayMesh.geometry.boundingBox) {
              displayMesh.geometry.computeBoundingBox();
            }
            const bbox = displayMesh.geometry.boundingBox;
            const sizeLocal = new THREE.Vector3();
            bbox.getSize(sizeLocal);
            const minLocal = bbox.min.clone();
            const maxLocal = bbox.max.clone();

            // Determine which axis is thickness (smallest dimension)
            const dims = [
              { axis: "x", value: Math.abs(sizeLocal.x) },
              { axis: "y", value: Math.abs(sizeLocal.y) },
              { axis: "z", value: Math.abs(sizeLocal.z) },
            ].sort((a, b) => a.value - b.value);
            const thinAxis = dims[0].axis; // plane normal aligns with this axis

            // Choose the two axes that form the screen plane and compute mesh aspect
            let planeMode = 0; // 0: XY, 1: YZ, 2: XZ
            let meshW = 2,
              meshH = 1;
            if (thinAxis === "z") {
              planeMode = 0; // XY
              meshW = Math.max(1e-6, Math.abs(sizeLocal.x));
              meshH = Math.max(1e-6, Math.abs(sizeLocal.y));
            } else if (thinAxis === "x") {
              planeMode = 1; // YZ
              meshW = Math.max(1e-6, Math.abs(sizeLocal.z));
              meshH = Math.max(1e-6, Math.abs(sizeLocal.y));
            } else {
              planeMode = 2; // XZ
              meshW = Math.max(1e-6, Math.abs(sizeLocal.x));
              meshH = Math.max(1e-6, Math.abs(sizeLocal.z));
            }

            const videoAspect = () =>
              (videoElement.videoWidth || 2) /
              Math.max(1, videoElement.videoHeight || 1);
            const meshAspect = meshW / meshH;

            // Create a shader that computes UVs from local position and fits aspect
            const material = new THREE.ShaderMaterial({
              uniforms: {
                map: { value: videoTexture },
                minLocal: { value: minLocal },
                maxLocal: { value: maxLocal },
                videoAspect: { value: 1.0 },
                meshAspect: { value: meshAspect },
                meshAspectOverride: { value: 2.0 },
                rotate90CW: { value: 1 },
                flipY: { value: 1 },
                planeMode: { value: planeMode },
                opacity: { value: 1.0 },
              },
              vertexShader: `
                varying vec3 vPos;
                void main() {
                  vPos = position; // local-space position
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
                uniform sampler2D map;
                uniform vec3 minLocal;
                uniform vec3 maxLocal;
                uniform float videoAspect;
                uniform float meshAspect;
                uniform float meshAspectOverride;
                uniform int rotate90CW;
                uniform int flipY;
                uniform int planeMode; // 0: XY, 1: YZ, 2: XZ
                uniform float opacity;
                varying vec3 vPos;
                
                vec2 computeUV(vec3 p) {
                  vec2 uv;
                  if (planeMode == 0) {
                    // XY
                    uv = vec2((p.x - minLocal.x) / max(1e-6, (maxLocal.x - minLocal.x)),
                               (p.y - minLocal.y) / max(1e-6, (maxLocal.y - minLocal.y)));
                  } else if (planeMode == 1) {
                    // YZ
                    uv = vec2((p.z - minLocal.z) / max(1e-6, (maxLocal.z - minLocal.z)),
                               (p.y - minLocal.y) / max(1e-6, (maxLocal.y - minLocal.y)));
                  } else {
                    // XZ
                    uv = vec2((p.x - minLocal.x) / max(1e-6, (maxLocal.x - minLocal.x)),
                               (p.z - minLocal.z) / max(1e-6, (maxLocal.z - minLocal.z)));
                  }
                  return uv;
                }
                void main() {
                  vec2 uv = computeUV(vPos);
                  // Optional 90° rotation and vertical flip to correct orientation
                  if (rotate90CW == 1) {
                    uv = vec2(uv.y, 1.0 - uv.x);
                  }
                  if (flipY == 1) {
                    uv.y = 1.0 - uv.y;
                  }
                  
                  float usedMeshAspect = meshAspect;
                  if (meshAspectOverride > 0.0) {
                    usedMeshAspect = clamp(meshAspectOverride, 1.5, 2.0);
                  }
                  
                  // Center-fit to preserve aspect ratio (contain)
                  if (usedMeshAspect > videoAspect) {
                    // Pillarbox horizontally
                    float scaleX = videoAspect / usedMeshAspect;
                    uv.x = (uv.x - 0.5) * scaleX + 0.5;
                  } else {
                    // Letterbox vertically
                    float scaleY = usedMeshAspect / videoAspect;
                    uv.y = (uv.y - 0.5) * scaleY + 0.5;
                  }
                  // Clamp outside to black (or transparent)
                  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    return;
                  }
                  vec4 c = texture2D(map, uv);
                  gl_FragColor = vec4(c.rgb, opacity);
                }
              `,
              transparent: true,
              depthTest: false,
              depthWrite: false,
              side: THREE.DoubleSide,
              toneMapped: false,
            });

            // Update videoAspect when metadata is ready
            const updateAspectUniform = () => {
              const vAspect = videoAspect();
              material.uniforms.videoAspect.value = vAspect;
              if (videoTexture) videoTexture.needsUpdate = true;
            };
            videoElement.addEventListener(
              "loadedmetadata",
              updateAspectUniform,
              { once: true }
            );
            if (videoElement.readyState >= 1) {
              updateAspectUniform();
            }

            // Remove any previous helper planes/groups if they exist
            const existingGroup = displayMesh.getObjectByName(
              "display001_video_group"
            );
            if (existingGroup) {
              displayMesh.remove(existingGroup);
              existingGroup.traverse((obj) => {
                if (obj.isMesh) {
                  if (obj.geometry) obj.geometry.dispose();
                  if (obj.material) {
                    if (obj.material.map) obj.material.map.dispose();
                    obj.material.dispose();
                  }
                }
              });
            }

            // Apply material directly to the mesh
            if (!displayMesh.userData) displayMesh.userData = {};
            if (!displayMesh.userData._origMat)
              displayMesh.userData._origMat = displayMesh.material;
            displayMesh.material = material;

            // Start playback
            const ensurePlay = () => {
              videoElement
                .play()
                .then(() => {
                  videoTexture.needsUpdate = true;
                })
                .catch((e) =>
                  console.warn("[DEBUG] screenvideo play error", e)
                );
            };
            if (videoElement.readyState < 2) {
              setTimeout(ensurePlay, 200);
            }
            ensurePlay();

            // After video finishes, clean up and move camera, then play electrosound2
            const handleVideoEnd = () => {
              try {
                // Restore original material
                if (
                  displayMesh &&
                  displayMesh.userData &&
                  displayMesh.userData._origMat
                ) {
                  const shaderMat = displayMesh.material;
                  displayMesh.material = displayMesh.userData._origMat;
                  displayMesh.userData._origMat = null;
                  // Dispose shader material and video texture
                  if (shaderMat && shaderMat.dispose) shaderMat.dispose();
                }
                if (videoTexture) {
                  if (videoTexture.dispose) videoTexture.dispose();
                }
                if (videoElement && videoElement.parentNode) {
                  videoElement.pause();
                  videoElement.src = "";
                  videoElement.load?.();
                  videoElement.parentNode.removeChild(videoElement);
                }
              } catch (e) {
                console.warn("[DEBUG] video cleanup error", e);
              }

              // Smoothly move camera
              const camTargetPos = new THREE.Vector3(-35, 0.5, -2.7);
              const lookAtTarget = new THREE.Vector3(-35, 1.5, -4);
              gsap.to(camera.position, {
                x: camTargetPos.x,
                y: camTargetPos.y,
                z: camTargetPos.z,
                duration: 1.8,
                ease: "power1.inOut",
                onUpdate: () => {
                  camera.lookAt(lookAtTarget);
                  if (controls) {
                    controls.target.copy(lookAtTarget);
                    controls.update();
                  }
                },
                onComplete: () => {
                  camera.lookAt(lookAtTarget);
                  if (controls) {
                    controls.target.copy(lookAtTarget);
                    controls.update();
                  }
                  // Play electrosound2
                  const sound2 = allAssets?.audios?.electrosound2;
                  if (sound2 && typeof sound2.play === "function") {
                    try {
                      sound2.play();
                    } catch (e) {
                      console.warn("[DEBUG] electrosound2 play error", e);
                    }
                  } else {
                    try {
                      playAudio && playAudio("electrosound2");
                    } catch (e) {
                      /* ignore */
                    }
                  }

                  // After electrosound2 ends, start the switch sequence
                  const onElectroSound2End = () => {
  

                    // Find switch001 and MR_V01010 in underground model
                    const underground = allAssets?.models?.gltf?.underground;
                    let switchMesh = null;
                    let mrV01010Mesh = null;
                    let displayMesh2 = null;

                    if (underground && underground.traverse) {
                      underground.traverse((obj) => {
                        if (obj.isMesh) {

                          if (obj.name === "switch001" && !switchMesh)
                            switchMesh = obj;
                          if (obj.name === "MR_V01010" && !mrV01010Mesh)
                            mrV01010Mesh = obj;
                          if (obj.name === "display" && !displayMesh2)
                            displayMesh2 = obj;
                        }
                      });
                    }

                    if (!switchMesh || !mrV01010Mesh || !displayMesh2) {
                      console.warn(
                        "[DEBUG] Required meshes not found for switch sequence"
                      );
                      return;
                    }

                    let switchTextPanel = new ThreeMeshUI.Block({
                      width: 0.45,
                      height: 0.15,
                      padding: 0.04,
                      justifyContent: "center",
                      alignItems: "center",
                      fontFamily: "/fonts/msdf/Roboto-msdf.json",
                      fontTexture: "/fonts/msdf/Roboto-msdf.png",

                      // Professional look
                      backgroundColor: new THREE.Color(0xfffdd9), // dark neutral gray
                      backgroundOpacity: 1.0, // solid
                      borderRadius: 0.03, // soft edges
                      borderWidth: 0.01, // thin border
                      borderColor: new THREE.Color(0x333333), // subtle darker gray border
                      borderOpacity: 0.4, // solid border
                    });

                    switchTextPanel.add(
                      new ThreeMeshUI.Text({
                        content: "Click Red Button",
                        fontSize: 0.045, // smaller text size size
                        fontColor: new THREE.Color(0x000000), // white text
                        fontOpacity: 1.0,
                        textAlign: "center",
                      })
                    );

                    // Position above the switch
                    const switchBbox = new THREE.Box3().setFromObject(
                      switchMesh
                    );
                    const switchCenter = switchBbox.getCenter(
                      new THREE.Vector3()
                    );
                    const switchSize = switchBbox.getSize(new THREE.Vector3());

                    switchTextPanel.position.copy(switchCenter);
                    switchTextPanel.position.y += switchSize.y + 0.01; // Above the switch
                    // switchTextPanel.lookAt(camera.position);

                    scene.add(switchTextPanel);

                    // Store original switch position for animation
                    const switchOrigPos = switchMesh.position.clone();
                    const switchPressedPos = switchOrigPos
                      .clone()
                      .add(new THREE.Vector3(-0.005, 0, 0));
                    let switchClicked = false;

                    // Make switch clickable (one-time only) - UPDATED WITH RAYCAST CHECK
                    const handleSwitchClick = (event) => {
                      if (switchClicked) return;

                      // NEW: Raycast to verify click is ON switchMesh
                      const rect = renderer.domElement.getBoundingClientRect();
                      const mouse = new THREE.Vector2(
                        ((event.clientX - rect.left) / rect.width) * 2 - 1,
                        -((event.clientY - rect.top) / rect.height) * 2 + 1
                      );
                      const switchRaycaster = new THREE.Raycaster();
                      switchRaycaster.setFromCamera(mouse, camera);
                      const switchIntersects = switchRaycaster.intersectObject(switchMesh, true);
                      if (switchIntersects.length === 0) {
                        // Click not on switch → ignore
                        return;
                      }

                      // Valid hit: proceed
                      switchClicked = true;

                      // Remove click listener
                      renderer.domElement.removeEventListener(
                        "click",
                        handleSwitchClick
                      );

                      // Remove the text panel
                      if (switchTextPanel && scene) {
                        scene.remove(switchTextPanel);
                        switchTextPanel = null;
                      }

 

                      // Animate switch press down and up
                      gsap
                        .timeline()
                        .to(switchMesh.position, {
                          x: switchPressedPos.x,
                          duration: 0.15,
                          ease: "power2.out",
                        })
                        .to(switchMesh.position, {
                          x: switchOrigPos.x,
                          duration: 0.2,
                          ease: "power2.out",
                        });

                      // Start sparks and sound immediately on switch click
                      createFireSparks(mrV01010Mesh, () => {
                        // After sparks finish, apply picture on display
                        playMeshPictureOnDisplay(displayMesh2);
                      });
                    };

                    // Add click listener for switch
                    renderer.domElement.addEventListener(
                      "click",
                      handleSwitchClick
                    );

                    // Add visual feedback that switch is clickable
                    const switchOutline = createSwitchOutline(switchMesh);
                    if (switchOutline) {
                      switchMesh.add(switchOutline);
                    }
                  };

                  // Listen for electrosound2 completion
                  if (sound2 && sound2.source) {
                    sound2.source.onended = onElectroSound2End;
                  } else {
                    // Fallback: assume duration and set timeout
                    setTimeout(
                      onElectroSound2End,
                      sound2?.buffer?.duration * 1000 || 5000
                    );
                  }
                },
              });
            };

            // Prefer 'ended', with fallback timer in case metadata or ended fails
            let endTimer = setTimeout(handleVideoEnd, 14000);
            videoElement.addEventListener(
              "ended",
              () => {
                if (endTimer) {
                  clearTimeout(endTimer);
                  endTimer = null;
                }
                handleVideoEnd();
              },
              { once: true }
            );
          } else {
            console.warn(
              "[DEBUG] display001 mesh or screenvideo asset not found"
            );
          }

          // Move camera to the specified point and look at the display mesh
          const targetCamPos = new THREE.Vector3(-34.5, 0.7, -3.3);
          let lookAtTarget = new THREE.Vector3(-35, 0.5, -3.5);
          if (displayMesh) {
            displayMesh.updateWorldMatrix(true, false);
            lookAtTarget = displayMesh.getWorldPosition(new THREE.Vector3());
          }
          gsap.to(camera.position, {
            x: targetCamPos.x,
            y: targetCamPos.y,
            z: targetCamPos.z,
            duration: 1.5,
            ease: "power1.inOut",
            onUpdate: () => {
              camera.lookAt(lookAtTarget);
              if (controls) {
                controls.target.copy(lookAtTarget);
                controls.update();
              }
            },
          });
        };

        if (sound1.source) {
          sound1.source.onended = onElectroSound1End;
        } else {
          setTimeout(
            onElectroSound1End,
            sound1.buffer?.duration * 1000 || 3000
          );
        }
      }

      // ✅ Rotate 180° smoothly in parallel with sound & cute action
      gsap.to(electro.rotation, {
        y: electro.rotation.y + Math.PI / 1.5,
        duration: 1.5,
        ease: "power1.inOut",
      });

      // ✅ Move camera in parallel
      const finalCamPos = new THREE.Vector3(-35, 1, -1.5);
      gsap.to(camera.position, {
        x: finalCamPos.x,
        y: finalCamPos.y,
        z: finalCamPos.z,
        duration: 1.5,
        ease: "power1.inOut",
        onUpdate: () => {
          camera.lookAt(electro.position);
          if (controls) {
            controls.target.copy(electro.position);
            controls.update();
          }
        },
      });
    },
  });
}

// Helper function to create realistic fire sparks effect from MR_V01010 mesh
function createFireSparks(targetMesh, onComplete) {
  // Determine center: use mesh world position if available, else default
  let center = new THREE.Vector3(-36, 1, -5);
  try {
    if (targetMesh && typeof targetMesh.getWorldPosition === "function") {
      center = targetMesh.getWorldPosition(new THREE.Vector3());
    }
  } catch (_) {}

  // Play spark sound if available
  try {
    allAssets?.audios?.spark?.stop?.();
  } catch (_) {}
  try {
    allAssets?.audios?.spark?.play?.();
  } catch (_) {}

  // Use the stable points-based emitter with a tighter radius for less spread
  return createFountainSparksAt(center, 0.8, onComplete);
}

// Helper: create fountain-style minute sparks at a fixed position and radius
function createFountainSparksAt(center, radius = 2, onComplete) {
  if (!scene || !(center && typeof center.x === "number")) {
    onComplete?.();
    return;
  }

  // Config (tuned for immediate, visible burst)
  const MAX_PARTICLES = 200;
  const BURST_COUNT = 80; // initial burst count
  const LIFETIME_MIN_MS = 60;
  const LIFETIME_MAX_MS = 1400;
  const DURATION_MS = 2000; // total effect time
  const GRAVITY = new THREE.Vector3(0, -0.055, 0);
  const DRAG = 0.992;

  // Create a small circular sprite texture for points
  const spriteSize = 64;
  const canvas = document.createElement("canvas");
  canvas.width = spriteSize;
  canvas.height = spriteSize;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(
    spriteSize * 0.5,
    spriteSize * 0.5,
    0,
    spriteSize * 0.5,
    spriteSize * 0.5,
    spriteSize * 0.5
  );
  grad.addColorStop(0.0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,200,100,0.85)");
  grad.addColorStop(0.8, "rgba(255,120,20,0.3)");
  grad.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(spriteSize * 0.5, spriteSize * 0.5, spriteSize * 0.5, 0, Math.PI * 2);
  ctx.fill();
  const spriteTex = new THREE.CanvasTexture(canvas);
  spriteTex.minFilter = THREE.LinearFilter;
  spriteTex.magFilter = THREE.LinearFilter;
  if (THREE.SRGBColorSpace) spriteTex.colorSpace = THREE.SRGBColorSpace;

  // Geometry buffers
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const velocities = new Array(MAX_PARTICLES);
  const bornAt = new Uint32Array(MAX_PARTICLES);
  const lifetimes = new Uint16Array(MAX_PARTICLES);
  const active = new Uint8Array(MAX_PARTICLES);

  for (let i = 0; i < MAX_PARTICLES; i++) {
    positions[i * 3 + 0] = 1e9;
    positions[i * 3 + 1] = 1e9;
    positions[i * 3 + 2] = 1e9;
    colors[i * 3 + 0] = 1.0;
    colors[i * 3 + 1] = 0.6;
    colors[i * 3 + 2] = 0.2;
    velocities[i] = new THREE.Vector3();
    bornAt[i] = 0;
    lifetimes[i] = 0;
    active[i] = 0;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.06, // bigger for visibility
    map: spriteTex,
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    alphaTest: 0.15,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false; // ensure visible even if bounding box miscomputed
  scene.add(points);

  // Random point within horizontal disk
  const rndInRadius = () => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius; // uniform disk
    const x = center.x + Math.cos(angle) * r;
    const z = center.z + Math.sin(angle) * r;
    const y = center.y + Math.random() * 0.1; // slight jitter
    return new THREE.Vector3(x, y, z);
  };

  const findSlot = () => {
    for (let i = 0; i < MAX_PARTICLES; i++) if (active[i] === 0) return i;
    return -1;
  };

  // Initial burst for immediate visibility
  const now0 = performance.now();
  for (let n = 0; n < BURST_COUNT; n++) {
    const idx = findSlot();
    if (idx < 0) break;
    const pos = rndInRadius();
    const vx = (Math.random() - 0.5) * 0.8;
    const vy = -(0.6 + Math.random() * 1.4);
    const vz = (Math.random() - 0.5) * 0.8;
    const life =
      LIFETIME_MIN_MS +
      Math.floor(Math.random() * (LIFETIME_MAX_MS - LIFETIME_MIN_MS + 1));
    positions[idx * 3 + 0] = pos.x;
    positions[idx * 3 + 1] = pos.y;
    positions[idx * 3 + 2] = pos.z;
    colors[idx * 3 + 0] = 1.0;
    colors[idx * 3 + 1] = 0.7;
    colors[idx * 3 + 2] = 0.25;
    velocities[idx].set(vx, vy, vz);
    bornAt[idx] = now0;
    lifetimes[idx] = life;
    active[idx] = 1;
  }
  geom.attributes.position.needsUpdate = true;
  geom.attributes.color.needsUpdate = true;

  let completed = false;
  const started = performance.now();

  function update() {
    if (completed) return;
    const now = performance.now();
    let anyActive = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (active[i] === 0) continue;
      anyActive = true;
      const age = now - bornAt[i];
      const life = lifetimes[i];
      if (age >= life) {
        active[i] = 0;
        positions[i * 3 + 0] = 1e9;
        positions[i * 3 + 1] = 1e9;
        positions[i * 3 + 2] = 1e9;
        continue;
      }
      const v = velocities[i];
      v.addScaledVector(GRAVITY, 0.016);
      v.multiplyScalar(DRAG);
      positions[i * 3 + 0] += v.x * 0.016;
      positions[i * 3 + 1] += v.y * 0.016;
      positions[i * 3 + 2] += v.z * 0.016;
      const t = age / life;
      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = 0.7 - 0.45 * t;
      colors[i * 3 + 2] = 0.25 - 0.2 * t;
    }

    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;

    if (now - started <= DURATION_MS + 100 || anyActive) {
      requestAnimationFrame(update);
    } else {
      finish();
    }
  }

  function finish() {
    if (completed) return;
    completed = true;
    scene.remove(points);
    geom.dispose();
    mat.dispose();
    spriteTex.dispose?.();
    onComplete?.();
  }

  requestAnimationFrame(update);
}

// function playHudVideo() {
//   if (!hudVideoElement) {
//     console.warn("[DEBUG] No HUD video element available");
//     return;
//   }
//   // Ensure muted to bypass autoplay block
//   hudVideoElement.muted = true;
//   console.log("[DEBUG] HUD video muted for autoplay");

//   const attemptPlay = () => {
//     if (hudVideoElement.readyState >= 3) { // HAVE_FUTURE_DATA or better
//       console.log("[DEBUG] HUD video readyState OK, attempting play");
//       hudVideoElement.play()
//         .then(() => {
//           console.log("[DEBUG] HUD video started playing successfully");
//         })
//         .catch((e) => {
//           console.error("[DEBUG] HUD video play failed:", e);
//           // Retry once after short delay
//           setTimeout(attemptPlay, 500);
//         });
//     } else {
//       console.log("[DEBUG] HUD video not ready (readyState:", hudVideoElement.readyState, "), retrying in 200ms");
//       setTimeout(attemptPlay, 200);
//     }
//   };
//   attemptPlay();
// }

// Function to return to player after the entire sequence
// Function to return to player after the entire sequence
// Function to return to player after the entire sequence
function returnToPlayer() {
    if (!camera || !player) return;
  
    // --- START FIX ---
    // This function holds the cleanup logic.
    // We will only call this at the VERY end of all asynchronous chains.
    const finalCleanup = () => {

      isElectroSequenceActive = false;
      isElectroSoundPlaying = false;
      electroComponents = null;
      shapeKeyControls = null;
    };
    // --- END FIX ---
  
    // Remove electro from scene after electrosound finished
    if (electroComponents?.electro && scene) {
      scene.remove(electroComponents.electro);

    }
  
    // --- HUD VIDEO FOCUS SEQUENCE ---
    // Use local hudVideoPlane and hudVideoElement (passed from scene5.js)
    if (hudVideoPlane && camera) {
      // Animate camera to HUD video plane directly from current position
      const hudTarget = hudVideoPlane.position.clone();
      const hudCamPos = hudTarget.clone().add(new THREE.Vector3(0, 0, 2));
      // Use player's current position for return
      const playerCamPos = player.position.clone();
      const playerLookAt = player.position.clone();
      // Show HUD video plane and play video ONCE
      hudVideoPlane.visible = true;
      if (hudVideoElement) {
        hudVideoElement.loop = false;
        hudVideoElement.currentTime = 0;
      }
  
      gsap.to(camera.position, {
        x: hudCamPos.x,
        y: hudCamPos.y,
        z: hudCamPos.z,
        duration: 0.5,
        ease: "power1.inOut",
        onUpdate: () => {
          camera.lookAt(hudTarget);
          if (controls) {
            controls.target.copy(hudTarget);
            controls.update();
          }
          camera.updateProjectionMatrix();
        },
        onComplete: () => {
          camera.lookAt(hudTarget);
          if (controls) {
            controls.target.copy(hudTarget);
            controls.update();
          }
          camera.updateProjectionMatrix();

          // Play HUD video ONCE
          if (hudVideoElement) {
            hudVideoElement
              .play()
              .then(() => {

              })
              .catch((e) => console.warn("[DEBUG] hudvideo1 play error", e));
            
            // Note: playHudVideo() was called here in your original code, it might be needed
            // playHudVideo(); 
  
            // When HUD video ends, continue the sequence
            hudVideoElement.onended = () => {
      
              // --- Move to Byte Assembly Panel ---
              const bytePanelPos = new THREE.Vector3(-39, 1.6, -3.21);
              const bytePanelLookAt = new THREE.Vector3(-39, 1.15, -6.0);
              gsap.to(camera.position, {
                x: bytePanelPos.x,
                y: bytePanelPos.y,
                z: bytePanelPos.z,
                duration: 3.5,
                ease: "power1.inOut",
                onUpdate: () => {
                  camera.lookAt(bytePanelLookAt);
                  if (controls) {
                    controls.target.copy(bytePanelLookAt);
                    controls.update();
                  }
                  camera.updateProjectionMatrix();
                },
                onComplete: () => {
                  camera.lookAt(bytePanelLookAt);
                  if (controls) {
                    controls.target.copy(bytePanelLookAt);
                    controls.update();
                  }
                  camera.updateProjectionMatrix();
                  // Play bytepanelsound
                  playAudio("bytepanelsound");
                  // Listen for audioComplete-bytepanelsound event
                  const onBytePanelSoundComplete = () => {
                    window.removeEventListener(
                      "audioComplete-bytepanelsound",
                      onBytePanelSoundComplete
                    );

                    // --- Move to Component Intro Panel ---
                    const compPanelPos = new THREE.Vector3(-33, 1.0, 3.5);
                    const compPanelLookAt = new THREE.Vector3(-33, 1.9, 7.5);
                    gsap.to(camera.position, {
                      x: compPanelPos.x,
                      y: compPanelPos.y,
                      z: compPanelPos.z,
                      duration: 3.5,
                      ease: "power1.inOut",
                      onUpdate: () => {
                        camera.lookAt(compPanelLookAt);
                        if (controls) {
                          controls.target.copy(compPanelLookAt);
                          controls.update();
                        }
                        camera.updateProjectionMatrix();
                      },
                      onComplete: () => {
                        camera.lookAt(compPanelLookAt);
                        if (controls) {
                          controls.target.copy(compPanelLookAt);
                          controls.update();
                        }
                        camera.updateProjectionMatrix();
                        // Play componentsound

                        playAudio("componentsound");
                        // Listen for audioComplete-componentsound event
                        const onComponentSoundComplete = () => {
                          window.removeEventListener(
                            "audioComplete-componentsound",
                            onComponentSoundComplete
                          );
                          showFPPOverlay();
                          // --- Return to player ---
                          gsap.to(camera.position, {
                            x: playerCamPos.x,
                            y: playerCamPos.y + 0.2,
                            z: playerCamPos.z + 0.5,
                            duration: 3.5,
                            ease: "power1.inOut",
                            onUpdate: () => {
                              camera.lookAt(playerLookAt);
                              if (controls) {
                                controls.target.copy(playerLookAt);
                                controls.update();
                              }
                              camera.updateProjectionMatrix();
                            },
                            onComplete: () => {
                              camera.lookAt(playerLookAt);
                              if (controls) {
                                controls.target.copy(playerLookAt);
                                controls.update();
                              }
                              camera.updateProjectionMatrix();
                              // Switch to FPP using the new function
                              if (typeof switchToFirstPerson === "function") {
                                switchToFirstPerson(camera, controls);
                              }
                              // Re-enable controls and player controls
                              if (controls) {
                                controls.enabled = true;
                              }
                              setCameraFollowsPlayer(true);
                              
                              // --- START FIX ---
                              // This is the line that caused the crash.
                              // We add optional chaining (?.) as a safeguard.
                              if (electroComponents?.electroMixer) {
                                electroComponents.electroMixer.stopAllAction();
                              }
                              // --- END FIX ---
  
                              togglePlayerControls(true);

                              // Hide HUD video plane
                              hudVideoPlane.visible = false;
    
                              // --- START FIX ---
                              // This is the final step, so we call the cleanup function here.
                              finalCleanup();
                              // --- END FIX ---
                            },
                        });
                        };
                        window.addEventListener(
                          "audioComplete-componentsound",
                          onComponentSoundComplete
                        );
                      },
                    });
                  };
                  window.addEventListener(
                    "audioComplete-bytepanelsound",
                    onBytePanelSoundComplete
                  );
              },
              });
            };
          }
        },
      });
    } else {
      // If no HUD video, just re-enable controls
      if (controls) {
        controls.enabled = true;
      }
    
      // --- START FIX ---
      // Use optional chaining (?.) safeguard
      if (electroComponents?.electroMixer) {
      	 electroComponents.electroMixer.stopAllAction();
      }
    	// --- END FIX ---
    
    	 togglePlayerControls(true);

    
    	 // --- START FIX ---
    	 // This is the final step in *this* path, so we call cleanup here.
    	 finalCleanup();
    	 // --- END FIX ---
    }
    // --- END HUD VIDEO FOCUS SEQUENCE ---
    
    // --- START FIX ---
    // The cleanup logic is GONE from here. It is now inside the
    // 'finalCleanup' function, which is called at the end of the
    // asynchronous callbacks above.
    // ---
    // // Reset sequence state
    // isElectroSequenceActive = false;
    // isElectroSoundPlaying = false;
    // electroComponents = null;
    // shapeKeyControls = null;
    // --- END FIX ---
  }

// Helper function to create switch outline
function createSwitchOutline(switchMesh) {
  if (!switchMesh || !switchMesh.geometry) return null;

  const outlineGeometry = switchMesh.geometry.clone();
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6,
    side: THREE.BackSide,
  });

  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outline.scale.multiplyScalar(1.05);
  outline.renderOrder = 998;

  return outline;
}

// Helper function to set a mesh picture on display mesh (persistent)
function playMeshPictureOnDisplay(displayMesh) {
  if (!displayMesh || !allAssets?.textures?.meshpicture) {
    console.warn("[DEBUG] meshpicture or display mesh not found");
    return;
  }



  // Load texture
  const tex = allAssets.textures.meshpicture;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;

  // Store original material
  if (!displayMesh.userData) displayMesh.userData = {};
  if (!displayMesh.userData._origMat2)
    displayMesh.userData._origMat2 = displayMesh.material;

  // Get the actual mesh dimensions in world space
  const bbox = new THREE.Box3().setFromObject(displayMesh);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());

  // Determine the actual display dimensions (width and height)
  let displayWidth, displayHeight;

  // Find the two largest dimensions for width and height
  const dimensions = [size.x, size.y, size.z].sort((a, b) => b - a);
  displayWidth = dimensions[0];
  displayHeight = dimensions[1];

  // Get texture dimensions
  const textureWidth = tex.image ? tex.image.width : 1;
  const textureHeight = tex.image ? tex.image.height : 1;
  const textureAspect = textureWidth / textureHeight;
  const displayAspect = displayWidth / displayHeight;

  // Create a perfect fit material that maintains aspect ratio
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });

  // Create a new plane geometry that perfectly fits the display mesh
  const planeGeometry = new THREE.PlaneGeometry(displayWidth, displayHeight);

  // Create the display plane
  const displayPlane = new THREE.Mesh(planeGeometry, material);

  // Position it exactly where the display mesh is
  displayPlane.position.copy(center);

  // Make it face the camera
  // displayPlane.lookAt(camera.position);

  // Add it to the scene
  if (scene) {
    scene.add(displayPlane);

    // Store reference for cleanup
    if (!displayMesh.userData) displayMesh.userData = {};
    displayMesh.userData._displayPlane = displayPlane;
  }

  // Hide the original display mesh
  displayMesh.visible = false;

  // Move camera smoothly to the specified location while looking at the display mesh
  if (camera) {
    const targetCamPos = new THREE.Vector3(-31.5, 1.5, -4);
    const lookAtTarget = center.clone(); // Look at the display mesh center

    gsap.to(camera.position, {
      x: targetCamPos.x,
      y: targetCamPos.y,
      z: targetCamPos.z,
      duration: 2.5,
      ease: "power1.inOut",
      onUpdate: () => {
        camera.lookAt(lookAtTarget);
        if (controls) {
          controls.target.copy(lookAtTarget);
          controls.update();
        }
      },
      onComplete: () => {
        // After camera reaches the target, play electrosound3
        if (allAssets?.audios?.electrosound3) {
          const sound3 = allAssets.audios.electrosound3;
          try {
            sound3.play();
 

            // Listen for when electrosound3 finishes to start the return sequence
            if (sound3.source) {
              sound3.source.onended = () => {

                returnToPlayer();
              };
            } else {
              // Fallback: assume duration and set timeout
              setTimeout(() => {

                returnToPlayer();
              }, sound3.buffer?.duration * 1000 || 5000);
            }
          } catch (e) {
            console.warn("[DEBUG] electrosound3 play error", e);
          }
        } else {
          console.warn("[DEBUG] electrosound3 audio not found");
        }
      },
    });
  }
}

export function updateElectro(delta) {
  if (!isElectroSequenceActive) return;

  // Update electro mixer
  if (electroComponents?.electroMixer) {
    electroComponents.electroMixer.update(delta);
  }

  // Update ThreeMeshUI
  if (typeof ThreeMeshUI !== "undefined") {
    ThreeMeshUI.update();
  }

  // Ensure player controls remain disabled during sequence
  if (playerControlsEnabled) {
    togglePlayerControls(false);
  }

  // Shape key controls are self-updating, no need to call update
}

/**
 * Query whether the Electro sequence is currently active.
 * Useful for gating player input or other scene systems.
 */
export function getElectroSequenceActive() {
  return isElectroSequenceActive;
}

/**
 * Stop/cleanup Electro-owned resources and reset state.
 *
 * Safe to call multiple times.
 * Called from Scene 5 cleanup.
 */
export function cleanupElectro() {
  // Stop all animations
  if (electroComponents?.electroMixer) {
    electroComponents.electroMixer.stopAllAction();
  }

  // Stop shape key animations
  if (shapeKeyControls) {
    shapeKeyControls.stopAnimation();
  }

  // Destroy display plane GUI if present
  if (_displayPlaneGUI && typeof _displayPlaneGUI.destroy === "function") {
    _displayPlaneGUI.destroy();
    _displayPlaneGUI = null;
  }

  // Remove electro from scene
  if (electroComponents?.electro) {
    scene.remove(electroComponents.electro);
  }

  // Clean up any display planes
  if (scene) {
    scene.traverse((obj) => {
      if (obj.userData && obj.userData._displayPlane) {
        scene.remove(obj.userData._displayPlane);
        if (obj.userData._displayPlane.geometry) {
          obj.userData._displayPlane.geometry.dispose();
        }
        if (obj.userData._displayPlane.material) {
          if (obj.userData._displayPlane.material.map) {
            obj.userData._displayPlane.material.map.dispose();
          }
          obj.userData._displayPlane.material.dispose();
        }
        obj.userData._displayPlane = null;
        obj.visible = true; // Restore original mesh visibility
      }
    });
  }

  // Reset state variables
  isElectroSequenceActive = false;
  isElectroSoundPlaying = false;
  electroComponents = null;
  shapeKeyControls = null;
}

// Compatibility wrapper: play spark sound and trigger current sparks emitter at a position
function createFireSparksAt(center, radius = 2, onComplete) {
  try {
    allAssets?.audios?.spark?.stop?.();
  } catch (_) {}
  try {
    allAssets?.audios?.spark?.play?.();
  } catch (_) {}
  return createFountainSparksAt(center, radius, onComplete);
}

// Optional global for external callers
try {
  window.createFireSparksAt = createFireSparksAt;
} catch (_) {}