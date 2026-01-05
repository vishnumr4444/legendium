import * as THREE from "three";
import { getCurrentScene, getUserInfo } from "./data.js";
import { allAssets } from "./commonFiles/assetsLoader.js";
import { MeshBVH } from "three-mesh-bvh";

/**
 * playerController.js
 * -------------------
 * Responsibilities:
 * - Create and manage the player capsule and 3D model
 * - Handle input (keyboard / mouse / VR) and movement
 * - Manage collisions using BVH shapecast for robust capsule-mesh collision
 * - Drive animations (idle / walk / run / jump / falling / spellcast / defeat)
 * - Provide utility functions for camera follow, pointer lock, and debug helpers
 *
 * Exported values and functions are documented where they are defined.
 */

let walkSound = null;
let runSound = null;
export let selectedPlayerMixer,
  idle,
  walk,
  run,
  jump,
  fallingIdle,
  fallingToLanding,
  spellCast,
  defeatFall,
  arrowShoot;
export let player = null;
let currentAction,
  model = null;
let isVRMode = false;
let movementEnabled = true;
let cameraFollowsPlayer = true;
let cameraFocusOnPlayer = true;
let currentSceneData = null;
const userInfo = getUserInfo();

/**
 * Default key bindings used by the simple animation / input interface.
 * Keys can be single values or arrays for compatibility with different event.code values.
 */
const defaultKeyBindings = {
  forward: ["KeyW", /* "ArrowUp", */ "w"],
  backward: ["KeyS", /* "ArrowDown", */ "s"],
  left: ["KeyA", /* "ArrowLeft", */ "a"],
  right: ["KeyD", /* "ArrowRight", */ "d"],
  sprint: ["ShiftLeft", "ShiftRight", "Shift"],
};

function isBindingActive(code) {
  /**
   * Return whether the provided binding is currently active based on internal playerState.
   * Accepts either `event.code` values or common shorthand keys.
   * This helper is used by the simple animation interface.
   */
  if (!code || typeof code !== "string") return false;
  const normalized = code.toLowerCase();
  switch (normalized) {
    case "keyw":
    case "arrowup":
    case "w":
      return playerState.fwdPressed;
    case "keys":
    case "arrowdown":
    case "s":
      return playerState.bkdPressed;
    case "keya":
    case "arrowleft":
    case "a":
      return playerState.lftPressed;
    case "keyd":
    case "arrowright":
    case "d":
      return playerState.rgtPressed;
    case "shift":
    case "shiftleft":
    case "shiftright":
      return playerState.shiftPressed;
    default:
      return false;
  }
}

let spellCastPredicate = null;
let externalSpellControl = false;
let animationInterface = null;
let playerDefeatState = false;
let additionalColliders = new Map();

export const playerState = {
  velocity: new THREE.Vector3(),
  onGround: false,
  fwdPressed: false,
  bkdPressed: false,
  lftPressed: false,
  rgtPressed: false,
  shiftPressed: false,
  isSitting: false,
  vrInput: null, // Add VR input state
  lastPosition: null,
  lastVelocity: null,
  lastOnGround: false,
  lastRotation: 0,
  // Add coyote time for jumping after leaving ground
  timeSinceLastGrounded: 0,
  coyoteTime: 0.5, // 150ms grace period to jump after leaving ground (increased from 100ms for better slope jumping)
  // Add falling state variables
  isFalling: false,
  fallStartHeight: 0,
  minFallDistance: 1.8, // Minimum distance to fall before triggering falling animation
  isLanding: false,
  landingAnimationPlayed: false,
  lastGroundObject: null // Track the object the player is standing on
  ,

};

const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempBox = new THREE.Box3();
const tempMat = new THREE.Matrix4();
const tempSegment = new THREE.Line3();

let ANIMATION_SPEED_FACTOR = 1; // Default speed factor
export let playerControlsEnabled = true;
const gravity = -9.8;
const jumpForce = 4.5; // Add jump force
let playerSpeed = 4; // Default player speed

const ROTATION_SPEED = Math.PI / 2; // Radians per second
let targetRotation = 0;
let currentRotation = 0; // Add current rotation for smoother interpolation
const ROTATION_SMOOTHING = 8.0; // Higher value = faster smoothing (framerate independent)
let cameraRotation = 0;
let cameraControlsEnabled = true; // New flag to track camera controls state

// Add these at the top with other state variables
let camera = null;
let controls = null;
let scene = null;
let followCameraEnabled = false; // Add this line

// Update the setCameraAndControls function
/**
 * Set the camera, controls and scene references used by the player controller.
 * @param {THREE.Camera} newCamera - Camera instance that will follow the player
 * @param {Object} newControls - Orbit/Trackball controls instance (optional)
 * @param {THREE.Scene} newScene - Scene reference (used for adding debug colliders)
 */
export function setCameraAndControls(newCamera, newControls, newScene) {
  camera = newCamera;
  controls = newControls;
  scene = newScene;
}

// Add functions to enable/disable follow camera
export function enableFollowCamera() {
  followCameraEnabled = true;
}

export function disableFollowCamera() {
  followCameraEnabled = false;
}

export function isFollowCameraEnabled() {
  return followCameraEnabled;
}

/**
 * Initialize the player capsule, model, animations and input handlers.
 * This prepares the player for simulation and starts the internal animation loop.
 *
 * @param {THREE.Scene} scene - Scene to which the player capsule will be added
 * @param {THREE.Camera} camera - Camera used to follow/look at the player
 * @param {Object} controls - Optional controls instance used for camera updates
 * @param {THREE.Mesh} collisionMesh - Mesh used for collision detection (must have BVH)
 * @returns {Object} cleanup + utility methods (cleanUpPlayer, player, model, etc.)
 */
export function initializePlayer(scene, camera, controls, collisionMesh) {
  currentSceneData = getCurrentScene();
  let isAnimating = true;
  playerControlsEnabled = true;

  // Enable follow camera by default
  followCameraEnabled = true;

  // Initialize camera yaw to match player's initial rotation
  if (currentSceneData.currentSceneData.startPosition) {
    const startPos = currentSceneData.currentSceneData.startPosition;
    cameraYaw = startPos.rotation.y || 0;
  } else {
    cameraYaw = 0;
  }

  // Add visibility change handler
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Tab is hidden - store current state
      if (player) {
        playerState.lastPosition = player.position.clone();
        playerState.lastVelocity = playerState.velocity.clone();
        playerState.lastOnGround = playerState.onGround;
        playerState.lastRotation = player.rotation.y;
      }
      // During scripted Electro sequence, keep physics running so AnimationMixer continues updating
      if (!window.isElectroSequencePlaying) {
        togglePlayerPhysics(false);
        togglePlayerControls(false);
      }
    } else {
      // Tab is visible again - restore state and re-enable
      if (player && playerState.lastPosition) {
        // Reset velocity first to prevent unwanted movement
        playerState.velocity.set(0, 0, 0);

        // Restore position and rotation
        player.position.copy(playerState.lastPosition);
        player.rotation.y = playerState.lastRotation;

        // Small delay before re-enabling physics to ensure proper collision detection
        setTimeout(() => {
          playerState.onGround = playerState.lastOnGround;
          if (window.isElectroSequencePlaying) {
            // Ensure physics stays enabled for mixer updates, but keep controls as they were for the sequence
            togglePlayerPhysics(true);
            return;
          }
          // Only re-enable physics and controls if player is not on hoverboard
          if (!window.isPlayerOnHoverboard) {
            togglePlayerPhysics(true);
            togglePlayerControls(true);
          }
        }, 100);
      }
    }
  });

  // Ensure we have valid scene data
  if (!currentSceneData || !currentSceneData.currentSceneData) {
    console.error("Invalid scene data");
    return;
  }

  let gltf = null;

  // Find and load the selected character
  Object.keys(allAssets.selectedPlayer.model).forEach((charName) => {
    const playerSelected = userInfo.selectedCharacter.includes(charName);
    if (playerSelected) {
      gltf = allAssets.selectedPlayer.model[charName];
      console.log("Selected character:", charName);

      selectedPlayerMixer = allAssets.characters.animations[charName].mixer;
      idle = allAssets.characters.animations[charName].actions.idle;
      walk = allAssets.characters.animations[charName].actions.walk;
      run = allAssets.characters.animations[charName].actions.run;
      jump = allAssets.characters.animations[charName].actions.jump;
      fallingIdle = allAssets.characters.animations[charName].actions.fallingIdle;
      fallingToLanding = allAssets.characters.animations[charName].actions.fallingToLanding;
      spellCast = allAssets.characters.animations[charName].actions.spellCast;
      defeatFall = allAssets.characters.animations[charName].actions.defeatFall;
      arrowShoot = allAssets.characters.animations[charName].actions.arrowShoot;
    }
  });

  if (!gltf) {
    console.error("No character model found");
    return;
  }

  // Create player capsule
  player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3),
    new THREE.MeshStandardMaterial({
      opacity: 0,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  player.geometry.translate(0, -0.5, 0);
  player.capsuleInfo = {
    radius: 0.3,
    segment: new THREE.Line3(
      new THREE.Vector3(),
      new THREE.Vector3(0, -1.0, 0.0)
    ),
  };
  player.name = "playerCapsule";

  // Set initial position and rotation from scene data
  if (currentSceneData.currentSceneData.startPosition) {
    const startPos = currentSceneData.currentSceneData.startPosition;
    player.position.set(
      startPos.position.x,
      startPos.position.y,
      startPos.position.z
    );

    // Initialize rotation values from scene data
    const initialRotation = startPos.rotation.y || 0;
    player.rotation.y = initialRotation;
    targetRotation = initialRotation;
    currentRotation = initialRotation;
  } else {
    // Default position if no scene data
    player.position.set(0, 0, 0);
    player.rotation.y = 0;
    targetRotation = 0;
    currentRotation = 0;
  }

  // Add player to scene
  scene.add(player);
  console.log("Player added to scene at position:", player.position);

  // Setup model
  model = gltf;
  model.position.set(0, -1.27, 0);
  model.rotation.y = Math.PI;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.material.fog = false;
      if (userInfo.modeSelected !== "non-vr") {
        child.visible = false;
      }
    }
  });

  // Add model to player
  player.add(model);

  // Set animation speeds
  if (idle) idle.timeScale = ANIMATION_SPEED_FACTOR * 0.4;
  if (walk) walk.timeScale = ANIMATION_SPEED_FACTOR;
  if (run) run.timeScale = ANIMATION_SPEED_FACTOR;
  if (jump) {
    jump.timeScale = ANIMATION_SPEED_FACTOR;
    // Configure jump animation to play once and clamp
    jump.loop = THREE.LoopOnce;
    jump.clampWhenFinished = true;
  }
  if (fallingIdle) {
    fallingIdle.timeScale = ANIMATION_SPEED_FACTOR;
    // Configure falling idle to loop continuously
    fallingIdle.loop = THREE.LoopRepeat;
    fallingIdle.clampWhenFinished = false;
  }
  if (fallingToLanding) {
    fallingToLanding.timeScale = ANIMATION_SPEED_FACTOR;
    // Configure falling to landing animation to play once and clamp
    fallingToLanding.loop = THREE.LoopOnce;
    fallingToLanding.clampWhenFinished = true;
  }
  if (spellCast) {
    spellCast.timeScale = ANIMATION_SPEED_FACTOR;
    // Configure spellCast animation to play once and clamp
    spellCast.loop = THREE.LoopOnce;
    spellCast.clampWhenFinished = true;
  }
  if (defeatFall) {
    defeatFall.timeScale = ANIMATION_SPEED_FACTOR;
    defeatFall.loop = THREE.LoopOnce;
    defeatFall.clampWhenFinished = true;
  }
  if (arrowShoot) arrowShoot.timeScale = ANIMATION_SPEED_FACTOR;
  // Set initial animation
  currentAction =
    idle ||
    (gltf.animations.length > 0
      ? selectedPlayerMixer.clipAction(gltf.animations[0])
      : null);
  if (currentAction) {
    currentAction.play();
  }

  // Add event listener for animation completion
  if (selectedPlayerMixer) {
    selectedPlayerMixer.addEventListener('finished', (event) => {
      // Handle spellCast animation completion
      if (event.action === spellCast) {
        // Reset to appropriate animation after spellCast completes
        const isMoving = playerState.fwdPressed || playerState.bkdPressed || playerState.lftPressed || playerState.rgtPressed;
        const newAction = isMoving ? (playerState.shiftPressed ? run : walk) : idle;
        if (newAction && currentAction !== newAction) {
          switchAction(newAction);
        }
      }

      // Handle defeatFall animation completion
      if (event.action === defeatFall) {
        // Keep the final pose of defeatFall
        // No action needed, animation should remain clamped
      }

      // Handle arrowShoot animation completion
      if (event.action === arrowShoot) {
        // Reset to appropriate animation after arrowShoot completes
        const isMoving = playerState.fwdPressed || playerState.bkdPressed || playerState.lftPressed || playerState.rgtPressed;
        const newAction = isMoving ? (playerState.shiftPressed ? run : walk) : idle;
        if (newAction && currentAction !== newAction) {
          switchAction(newAction);
        }
      }
    });
  }

  // Setup sounds
  if (Object.keys(allAssets.selectedPlayer.audios).length !== 0) {
    walkSound = allAssets.selectedPlayer.audios.walking;
    runSound = allAssets.selectedPlayer.audios.walking;
  }

  // Position camera
  const cameraStartingPosition =
    currentSceneData.currentSceneData.startPosition.cameraPosition;
  const offset = new THREE.Vector3(
    cameraStartingPosition.x,
    cameraStartingPosition.y,
    cameraStartingPosition.z
  );
  camera.position.copy(player.position.clone().add(offset));
  camera.lookAt(player.position);

  // Add event listeners
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousedown", onMouseDown);

  // Add pointer lock listeners after other event listeners
  addPointerLockListeners();

  // Start animation loop
  const clock = new THREE.Clock();
  isAnimating = true;
  let requestAnimationId = null;

  function animate() {
    if (!isAnimating) return;
    const delta = clock.getDelta();
    updatePlayer(delta, camera, controls, collisionMesh);
    requestAnimationId = requestAnimationFrame(animate);
  }

  animate();
  function cleanUpPlayer() {
    cancelAnimationFrame(requestAnimationId);
    if (player) {
      isAnimating = false;
      scene.remove(player);

      // Dispose of geometry and materials
      model.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material) {
            child.material.dispose();
          }
        }
      });

      // Stop and nullify sounds
      if (walkSound) {
        walkSound.stop();
        walkSound.source = null;
        walkSound = null;
      }

      if (runSound) {
        runSound.stop();
        runSound.source = null;
        runSound = null;
      }

      // Remove event listeners
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);

      // Remove pointer lock listeners
      removePointerLockListeners();

      // Reset player state
      playerState.fwdPressed = false;
      playerState.bkdPressed = false;
      playerState.lftPressed = false;
      playerState.rgtPressed = false;
      playerState.shiftPressed = false;
      playerState.isSitting = false;

      // Stop animations
      if (selectedPlayerMixer) {
        selectedPlayerMixer.stopAllAction();
        selectedPlayerMixer.uncacheRoot(selectedPlayerMixer);
        selectedPlayerMixer = null;
      }

      // Nullify animation actions
      idle = null;
      walk = null;
      run = null;
      jump = null;
      fallingIdle = null;
      fallingToLanding = null;
      spellCast = null;
      defeatFall = null;
      arrowShoot = null;
      // Explicitly nullify player and model
      player = null;
      model = null;
      currentSceneData = null;
      spellCastPredicate = null;
      externalSpellControl = false;
      animationInterface = null;
      playerDefeatState = false;
    }
  }

  return {
    cleanUpPlayer,
    player,
    object: player,
    model,
    selectedPlayerMixer,
    faceTowards,
    getAnimationManager: () => getSimpleAnimationInterface(),
    getCameraFollowTargets: () => getCameraFollowTargets(),
    playSpellCastAnimation: () => triggerSpellCastAnimation(),
    setSpellCanCastCheck: (fn) => { spellCastPredicate = typeof fn === "function" ? fn : null; },
    enableExternalCastControl: (enabled) => { externalSpellControl = !!enabled; },
    isPlayerCameraActive: () => followCameraEnabled,
    disablePlayerCamera: () => {
      followCameraEnabled = false;
      removePointerLockListeners();
    },
    enablePlayerCamera: (camera) => {
      followCameraEnabled = true;
      // Snap once immediately if camera provided (next update will smooth)
      if (camera) {
        const { position, lookAt } = getCameraFollowTargets();
        camera.position.copy(position);
        camera.lookAt(lookAt);
      }
      addPointerLockListeners();
    },
    playDefeatAnimation,
    resetDefeatState: resetDefeatStateInternal,
    isDefeated: () => playerDefeatState,
    requestPointerLock: () => {
      // Directly request pointer lock without waiting for click
      if (followCameraEnabled && !pointerLockRequestPending && document.body.requestPointerLock) {
        pointerLockRequestPending = true;
        try {
          const maybePromise = document.body.requestPointerLock();
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.catch(() => { pointerLockRequestPending = false; });
          }
        } catch (e) {
          pointerLockRequestPending = false;
        }
      }
    },
    addCollider,
    updateColliderPosition
  };
}

let playerPhysicsEnabled = true; // Global flag to track physics state

// Add visibility change handler
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Tab is hidden - store current state
    if (player) {
      playerState.lastPosition = player.position.clone();
      playerState.lastVelocity = playerState.velocity.clone();
      playerState.lastOnGround = playerState.onGround;
      playerState.lastRotation = player.rotation.y;
    }
    // Do NOT disable physics during Electro sequence so walk animation keeps advancing
    if (!window.isElectroSequencePlaying) {
      togglePlayerPhysics(false);
      togglePlayerControls(false);
    }
  } else {
    // Tab is visible again - restore state and re-enable
    if (player && playerState.lastPosition) {
      // Reset velocity first to prevent unwanted movement
      playerState.velocity.set(0, 0, 0);

      // Restore position and rotation
      player.position.copy(playerState.lastPosition);
      player.rotation.y = playerState.lastRotation;

      // Small delay before re-enabling physics to ensure proper collision detection
      setTimeout(() => {
        playerState.onGround = playerState.lastOnGround;
        if (window.isElectroSequencePlaying) {
          // Ensure physics is enabled for animation mixer updates; keep controls as per sequence
          togglePlayerPhysics(true);
          return;
        }
        // Only re-enable physics and controls if player is not on hoverboard
        if (!window.isPlayerOnHoverboard) {
          togglePlayerPhysics(true);
          togglePlayerControls(true);
        }
      }, 100);
    }
  }
});

export function togglePlayerPhysics(enable) {
  playerPhysicsEnabled = enable;

  if (!enable) {
    // Stop player's velocity when physics is disabled
    playerState.velocity.set(0, 0, 0);
  }
}

function playDefeatAnimation() {
  if (!defeatFall || playerDefeatState) return;
  playerDefeatState = true;
  togglePlayerControls(false);
  switchAction(defeatFall);
}

function resetDefeatStateInternal() {
  playerDefeatState = false;
  togglePlayerControls(true);

  // Reset movement flags to prevent auto-walking after respawn
  playerState.fwdPressed = false;
  playerState.bkdPressed = false;
  playerState.lftPressed = false;
  playerState.rgtPressed = false;
  playerState.shiftPressed = false;

  // Reset velocity
  playerState.velocity.set(0, 0, 0);

  if (idle) {
    switchAction(idle);
  }
}

function resetPlayerState() {
  // Reset velocity
  playerState.velocity.set(0, 0, 0);
  playerDefeatState = false;

  // Reset coyote time variables
  playerState.timeSinceLastGrounded = 0;

  // Reset movement states
  playerState.fwdPressed = false;
  playerState.bkdPressed = false;
  playerState.lftPressed = false;
  playerState.rgtPressed = false;
  playerState.shiftPressed = false;

  // Reset falling states
  playerState.isFalling = false;
  playerState.isLanding = false;
  playerState.landingAnimationPlayed = false;
  playerState.lastGroundObject = null;

  // Reset animation if available
  if (selectedPlayerMixer) {
    selectedPlayerMixer.stopAllAction();
    if (idle) {
      idle.reset().play();
      currentAction = idle;
    }
  }
}

export function togglePlayerControls(enable) {
  playerControlsEnabled = enable; // Stop responding to movement keys
}

/**
 * Perform capsule vs mesh collision detection using BVH shapecast.
 * Returns an object with hasCollision, delta (correction vector), normal and point
 * if a collision is found. This function expects `collisionMesh.geometry.boundsTree`
 * to be present (created via MeshBVH).
 *
 * @param {THREE.Mesh} player - Capsule mesh with `capsuleInfo` describing radius and segment
 * @param {THREE.Mesh} collisionMesh - Mesh to test collisions against (with BVH)
 * @returns {{hasCollision: boolean, delta?: THREE.Vector3, normal?: THREE.Vector3, point?: THREE.Vector3}}
 */
export function calculateCollision(player, collisionMesh) {
  if (
    !collisionMesh ||
    !collisionMesh.geometry ||
    !collisionMesh.geometry.boundsTree
  )
    return { hasCollision: false };

  const capsuleInfo = player.capsuleInfo;
  const tempBox = new THREE.Box3();
  const tempMat = new THREE.Matrix4();
  const tempSegment = new THREE.Line3();
  const tempVector = new THREE.Vector3();
  const tempVector2 = new THREE.Vector3();

  tempBox.makeEmpty();
  tempMat.copy(collisionMesh.matrixWorld).invert();
  tempSegment.copy(capsuleInfo.segment);

  tempSegment.start.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);
  tempSegment.end.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);

  tempBox.expandByPoint(tempSegment.start);
  tempBox.expandByPoint(tempSegment.end);

  tempBox.min.addScalar(-capsuleInfo.radius);
  tempBox.max.addScalar(capsuleInfo.radius);

  let collisionNormal = new THREE.Vector3();
  let collisionPoint = new THREE.Vector3();
  let hasCollision = false;

  collisionMesh.geometry.boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(tempBox),
    intersectsTriangle: (tri) => {
      const triPoint = tempVector;
      const capsulePoint = tempVector2;

      const distance = tri.closestPointToSegment(
        tempSegment,
        triPoint,
        capsulePoint
      );
      if (distance < capsuleInfo.radius) {
        const depth = capsuleInfo.radius - distance;
        const direction = capsulePoint.sub(triPoint).normalize();

        collisionNormal.copy(direction);
        collisionPoint.copy(capsulePoint);
        hasCollision = true;

        tempSegment.start.addScaledVector(direction, depth);
        tempSegment.end.addScaledVector(direction, depth);
      }
    },
  });

  if (hasCollision) {
    const newPosition = tempVector;
    newPosition.copy(tempSegment.start).applyMatrix4(collisionMesh.matrixWorld);

    const deltaVector = tempVector2;
    deltaVector.subVectors(newPosition, player.position);

    return {
      hasCollision: true,
      delta: deltaVector.clone(),
      normal: collisionNormal.clone(),
      point: collisionPoint.clone()
    };
  }

  return { hasCollision: false };
}

/**
 * High-level collision handling: queries calculateCollision and applies position correction
 * and velocity response. Also updates `playerState.onGround` based on collision normals.
 *
 * @param {THREE.Mesh} player - The capsule mesh representing the player
 * @param {THREE.Mesh} collisionMesh - The collision mesh with a BVH
 * @param {THREE.Vector3} velocity - Player velocity vector (modified in-place)
 * @param {number} delta - Time step in seconds
 */
export function handleCollisions(player, collisionMesh, velocity, delta) {
  const result = calculateCollision(player, collisionMesh);

  if (result.hasCollision) {
    const { delta: deltaVector, normal: collisionNormal } = result;

    // Apply position correction
    const offset = Math.max(0.0, deltaVector.length() - 1e-5);
    if (offset > 0) {
      deltaVector.normalize().multiplyScalar(offset);
      player.position.add(deltaVector);
    }

    // Update ground state
    if (collisionNormal.y > 0.3 && velocity.y < 2.0) {
      playerState.onGround = true;
    }

    // Apply velocity response
    applyVelocityResponse(velocity, collisionNormal);
  }
}

function applyVelocityResponse(velocity, collisionNormal) {
  // Apply collision response with anti-slide improvements
  // This function modifies the provided velocity vector in place, applying
  // normal projection, tangential friction and damping to reduce sliding.
  const normalVelocity = collisionNormal
    .clone()
    .multiplyScalar(velocity.dot(collisionNormal));

  // Only apply tangent velocity if we're not trying to stop sliding
  let tangentVelocity = velocity.clone().sub(normalVelocity);

  // Apply friction to horizontal movement
  const horizontalSpeed = Math.sqrt(tangentVelocity.x * tangentVelocity.x + tangentVelocity.z * tangentVelocity.z);
  if (horizontalSpeed > 0.01) {
    const friction = 0.999;
    tangentVelocity.x *= friction;
    tangentVelocity.z *= friction;
  } else {
    // Stop very small horizontal velocities to prevent sliding
    tangentVelocity.x = 0;
    tangentVelocity.z = 0;
  }

  // Combine velocities
  velocity.copy(normalVelocity).add(tangentVelocity);

  // Apply damping
  velocity.multiplyScalar(0.999);

  // Stop if velocity is very small
  if (velocity.length() < 0.01) {
    velocity.set(0, 0, 0);
  }
}

export function resetPlayer() {
  if (!player) {
    console.error("Cannot reset player: player is null");
    return;
  }

  playerState.velocity.set(0, 0, 0);
  // Reset coyote time variables
  playerState.timeSinceLastGrounded = 0;

  // Get current scene data
  const currentScene = getCurrentScene();
  if (
    currentScene &&
    currentScene.currentSceneData &&
    currentScene.currentSceneData.startPosition
  ) {
    // Reset to scene start position
    player.position.set(
      currentScene.currentSceneData.startPosition.position.x,
      currentScene.currentSceneData.startPosition.position.y,
      currentScene.currentSceneData.startPosition.position.z
    );
    player.rotation.y = currentScene.currentSceneData.startPosition.rotation.y;
    console.log("Player reset to start position:", player.position);
  } else {
    // Fallback to default position
    player.position.set(0, 8, 0);
    player.rotation.y = Math.PI;
    console.log("Player reset to default position:", player.position);
  }

  // Reset animation to idle
  if (idle) {
    switchAction(idle);
  }
}

function movePlayer(x, y, z, speed, delta) {
  tempVector.set(x, y, z).applyQuaternion(player.quaternion);
  player.position.addScaledVector(tempVector, speed * delta);
}

export function updatePlayerAnimation(isMoving, isRunning) {
  /**
   * Update the player animation based on movement state. Prevents interrupting
   * higher-priority animations such as jump, falling and spellCast.
   *
   * @param {boolean} isMoving - whether a movement key is pressed
   * @param {boolean} isRunning - whether sprint is active
   */
  if (!selectedPlayerMixer || !currentAction) return;
  if (playerState.isSitting && idle) return;

  // Don't interrupt jump animation while it's playing
  if (currentAction === jump && jump && jump.isRunning()) {
    return;
  }

  // Don't interrupt falling animations
  if (currentAction === fallingIdle && fallingIdle && fallingIdle.isRunning()) {
    return;
  }

  // Don't interrupt landing animation
  if (currentAction === fallingToLanding && fallingToLanding && fallingToLanding.isRunning()) {
    return;
  }

  // Don't interrupt spellCast animation while it's playing
  if (currentAction === spellCast && spellCast && spellCast.isRunning()) {
    return;
  }

  // Don't switch animations while landing
  if (playerState.isLanding) {
    return;
  }

  const newAction = isMoving
    ? isRunning && run
      ? run
      : walk
    : idle;

  if (newAction && currentAction !== newAction) {
    switchAction(newAction);
  }

  // Handle sounds
  if (walkSound && runSound) {
    if (isMoving) {
      const targetSound = isRunning ? runSound : walkSound;
      const otherSound = isRunning ? walkSound : runSound;

      if (!targetSound.isPlaying) {
        otherSound.stop();
        targetSound.play();
      }
    } else {
      walkSound.stop();
      runSound.stop();
    }
  }
}

function updateCameraPosition(camera, controls) {
  // Move and orient the camera according to the current player/camera mode.
  // Handles first-person and third-person (follow) cases and updates
  // provided controls' target where applicable.
  if (!player || !camera || window.isElectroSequencePlaying) return;

  if (isFirstPerson) {
    // FPP: Camera at head, look forward
    const headPos = player.position.clone().add(new THREE.Vector3(0, 0.56, 0));
    camera.position.copy(headPos);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      player.quaternion
    );
    camera.lookAt(headPos.clone().add(forward));
    if (controls && cameraControlsEnabled) {
      controls.target.copy(headPos.clone().add(forward));
      controls.update();
    }
    return;
  }

  // Unified camera positioning logic (works for both pointer lock and non-pointer lock)
  const { position, lookAt } = getCameraFollowTargets();
  camera.position.copy(position);
  camera.lookAt(lookAt);

  if (controls && cameraControlsEnabled) {
    controls.target.copy(lookAt);
    controls.update();
  }
}

function faceTowards(worldTarget) {
  /**
   * Immediately face the player model towards the provided world target.
   * Rotational changes are snapped (not smoothed) to the calculated yaw.
   * @param {THREE.Vector3} worldTarget - target point in world coordinates
   */
  if (!player || !worldTarget) return;
  const dir = new THREE.Vector3().subVectors(worldTarget, player.position);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) return;
  const yaw = Math.atan2(dir.x, dir.z);
  targetRotation = yaw;
  currentRotation = yaw;
  player.rotation.y = yaw;
}

export function smoothRotatePlayer(direction, delta) {
  // Update target rotation with delta-time based rotation speed
  // `direction` should be -1 (turn right) or 1 (turn left)
  targetRotation += direction * ROTATION_SPEED * delta;
}

export function switchAction(newAction) {
  /**
   * Fade out the current action and fade in the provided animation action.
   * Keeps a short crossfade duration to make transitions look smooth.
   * @param {THREE.AnimationAction} newAction
   */
  if (!newAction) return; // Don't switch if the new action doesn't exist

  if (currentAction && newAction && currentAction !== newAction) {
    const duration = 0.2;
    currentAction.fadeOut(duration);
    newAction.reset();
    newAction.fadeIn(duration);
    newAction.play();

    currentAction = newAction;
  }
}

function canTriggerSpellCast() {
  // Check whether a spell cast is currently allowed (not defeated, and predicate allows)
  if (playerDefeatState) return false;
  if (typeof spellCastPredicate === "function") {
    try {
      if (!spellCastPredicate()) {
        return false;
      }
    } catch (_) {
      // ignore predicate errors
    }
  }
  return true;
}

function triggerSpellCastAnimation() {
  /**
   * Try to play the spellCast animation. Returns true if animation was triggered.
   * External control can be enabled to prevent mouse-based casting.
   */
  if (!spellCast || !canTriggerSpellCast()) {
    return false;
  }
  switchAction(spellCast);
  return true;
}

function onMouseDown(event) {
  // Left-click triggers a spell cast (unless external control is enabled)
  if (!playerControlsEnabled || !movementEnabled) return;
  if (event.button !== 0) return;
  if (externalSpellControl) return;
  if (triggerSpellCastAnimation()) {
    try {
      event.preventDefault();
    } catch (_) { }
  }
}

function onKeyDown(event) {
  // Keyboard input handler - updates `playerState` flags and supports utility keys
  if (!playerControlsEnabled) {
    console.log("Player controls disabled");
    return;
  }
  if (!movementEnabled) {
    console.log("Movement disabled");
    return;
  }

  switch (event.code) {
    // case "ArrowUp":
    case "KeyW":
      playerState.fwdPressed = true;
      break;
    // case "ArrowDown":
    case "KeyS":
      playerState.bkdPressed = true;
      break;
    // case "ArrowLeft":
    case "KeyA":
      if (!playerState.lftPressed) {
        playerState.lftPressed = true;
      }
      break;
    // case "ArrowRight":
    case "KeyD":
      if (!playerState.rgtPressed) {
        playerState.rgtPressed = true;
      }
      break;
    case "ShiftLeft":
      playerState.shiftPressed = true;
      break;
    case "KeyR":
      console.log("Resetting player position");
      resetPlayer();
      break;
    case "KeyP":
      logPlayerPosition();
      break;
    case "KeyL": // Add key binding for pointer lock toggle
      console.log("Toggling pointer lock");
      if (pointerLockActive) {
        exitPointerLock();
      } else {
        requestPointerLock();
      }
      break;
    case "KeyC": // Add key binding for follow camera toggle
      console.log("Toggling follow camera");
      toggleFollowCamera();
      break;
    case "Space":
      // Handle jump with coyote time - allow jumping shortly after leaving ground
      if (playerState.onGround || playerState.timeSinceLastGrounded <= playerState.coyoteTime) {
        playerState.velocity.y = jumpForce;
        playerState.onGround = false;
        playerState.timeSinceLastGrounded = playerState.coyoteTime + 1; // Prevent double jump
        // Reset falling state when jumping
        playerState.isFalling = false;
        playerState.isLanding = false;
        playerState.fallStartHeight = player.position.y; // Reset fall start height
        // Play jump animation if available
        if (jump) {
          switchAction(jump);
        }
      }
      break;
  }
}

function onKeyUp(event) {
  if (!playerControlsEnabled || isVRMode) {
    return;
  }

  switch (event.code) {
    // case "ArrowUp":
    case "KeyW":
      playerState.fwdPressed = false;
      break;
    // case "ArrowDown":
    case "KeyS":
      playerState.bkdPressed = false;
      break;
    // case "ArrowLeft":
    case "KeyA":
      playerState.lftPressed = false;
      break;
    // case "ArrowRight":
    case "KeyD":
      playerState.rgtPressed = false;
      break;
    case "ShiftLeft":
      playerState.shiftPressed = false;
      break;
  }
}

// Update the updateVRInput function
export function updateVRInput(vrControllerInput) {
  /**
   * Update the controller input when running in VR mode. Passing `null` disables VR mode.
   * The function will toggle the player 3D model's visibility to avoid rendering conflicts
   * when in VR.
   * @param {Object|null} vrControllerInput - VR input state object or null
   */
  const wasVRMode = isVRMode;
  isVRMode = !!vrControllerInput;

  // Log VR mode transition
  if (wasVRMode !== isVRMode) {
    console.log("VR Mode Changed:", isVRMode);

    // Toggle player model visibility
    if (model) {
      model.visible = !isVRMode;
    }
  }

  if (vrControllerInput) {
    console.log("Received VR Input:", vrControllerInput);
  }

  playerState.vrInput = vrControllerInput;
}

export function hidePlayerModel() {
  // Utility to hide the 3D character model (useful for first-person or debugging)
  if (model) {
    model.visible = false;
  }
}

export function showPlayerModel() {
  // Utility to ensure the 3D character model is visible
  if (model) {
    model.visible = true;
  }
}

export function setMovementEnabled(enabled) {
  /**
   * Enable or disable movement input. When disabled all movement flags are cleared.
   * @param {boolean} enabled
   */
  movementEnabled = enabled;
  if (!enabled) {
    // Reset all movement states when disabled
    playerState.fwdPressed = false;
    playerState.bkdPressed = false;
    playerState.lftPressed = false;
    playerState.rgtPressed = false;
    playerState.shiftPressed = false;
  }
}

export function setCameraFollowsPlayer(follows) {
  // Toggle whether the camera follows the player each frame
  cameraFollowsPlayer = follows;
}

export function setCameraFocusOnPlayer(focus) {
  // Toggle whether camera should look at the player object. If disabled we
  // optionally clear the controls target to avoid forced looking at the player.
  cameraFocusOnPlayer = focus;
  if (!focus) {
    // If focus is disabled, ensure the camera doesn't look at the player
    if (window.camera && window.camera.userData.controls) {
      window.camera.userData.controls.target.copy(new THREE.Vector3(0, 0, 0));
      window.camera.userData.controls.update();
    }
  }
}

function updatePlayerMovement(delta, speed) {
  const { fwdPressed, bkdPressed, lftPressed, rgtPressed } = playerState;

  // When pointer lock is active, use camera yaw for movement direction
  if (pointerLockActive) {
    // Use a fixed time step for consistent movement speed
    const fixedDelta = Math.min(delta, 0.05); // Cap delta to prevent large movements
    const moveSpeed = speed * 0.8;
    let moved = false;

    // Calculate movement direction based on camera yaw
    const sinY = Math.sin(cameraYaw);
    const cosY = Math.cos(cameraYaw);

    // Create movement vector
    let moveX = 0;
    let moveZ = 0;

    // Forward/backward movement (only when fwd/bkd keys are pressed)
    if (fwdPressed) {
      moveX -= sinY;
      moveZ -= cosY;
    }
    if (bkdPressed) {
      moveX += sinY;
      moveZ += cosY;
    }

    // Strafe left/right movement (only when lft/rgt keys are pressed)
    // Corrected strafing directions
    if (rgtPressed) {
      // Right strafing: perpendicular to forward direction
      moveX += cosY;
      moveZ -= sinY;  // Fixed: correct right strafing
    }
    if (lftPressed) {
      // Left strafing: perpendicular to forward direction
      moveX -= cosY;
      moveZ += sinY;  // Fixed: correct left strafing
    }

    // Normalize and apply movement
    const moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLength > 0.01) {
      moved = true;
      const normalizedMoveX = moveX / moveLength;
      const normalizedMoveZ = moveZ / moveLength;

      player.position.x += normalizedMoveX * moveSpeed * fixedDelta;
      player.position.z += normalizedMoveZ * moveSpeed * fixedDelta;
    }

    // Rotate player to face movement direction with improved responsiveness
    if (moved && (fwdPressed || bkdPressed || lftPressed || rgtPressed)) {
      // Calculate target yaw based on movement direction
      let targetYaw;

      // Determine primary movement direction
      if (fwdPressed && !bkdPressed) {
        if (!lftPressed && !rgtPressed) {
          // Pure forward
          targetYaw = cameraYaw;
        } else if (rgtPressed && !lftPressed) {
          // Forward + right (diagonal)
          targetYaw = cameraYaw - Math.PI / 4;  // Fixed: correct diagonal direction
        } else if (lftPressed && !rgtPressed) {
          // Forward + left (diagonal)
          targetYaw = cameraYaw + Math.PI / 4;  // Fixed: correct diagonal direction
        }
      } else if (bkdPressed && !fwdPressed) {
        if (!lftPressed && !rgtPressed) {
          // Pure backward
          targetYaw = cameraYaw + Math.PI;
        } else if (rgtPressed && !lftPressed) {
          // Backward + right (diagonal)
          targetYaw = cameraYaw - Math.PI * 3 / 4;  // Fixed: correct diagonal direction
        } else if (lftPressed && !rgtPressed) {
          // Backward + left (diagonal)
          targetYaw = cameraYaw + Math.PI * 3 / 4;  // Fixed: correct diagonal direction
        }
      } else if (rgtPressed && !lftPressed && !fwdPressed && !bkdPressed) {
        // Pure right strafe - player should face the direction they're moving
        targetYaw = cameraYaw - Math.PI / 2;  // Fixed: correct right strafing direction
      } else if (lftPressed && !rgtPressed && !fwdPressed && !bkdPressed) {
        // Pure left strafe - player should face the direction they're moving
        targetYaw = cameraYaw + Math.PI / 2;  // Fixed: correct left strafing direction
      }

      if (targetYaw !== undefined) {
        // Smoothly rotate player to face movement direction with faster rotation
        const diff = targetYaw - player.rotation.y;
        // Normalize angle to be between -PI and PI
        const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));

        // Increase rotation speed for more responsive turning
        const ROTATION_SPEED_FAST = ROTATION_SPEED * 2.5; // Increase rotation speed further
        const maxRotation = ROTATION_SPEED_FAST * fixedDelta;
        const rotation = Math.max(-maxRotation, Math.min(maxRotation, normalizedDiff));
        player.rotation.y += rotation;
      }
    }
    // If no movement keys are pressed but we're in pointer lock mode, don't auto-align player with camera
    // This allows free look around the player when stationary
    else if (!moved && pointerLockActive) {
      // Keep player rotation unchanged to allow free look
      // Player will only rotate when movement keys are pressed
    }
  } else {
    // Original movement code when pointer lock is not active
    const moveSpeed = speed * 0.8;

    // Allow rotation and movement simultaneously
    if (lftPressed) {
      smoothRotatePlayer(1, delta);
      movePlayer(0, 0, -1, moveSpeed, delta);
    } else if (rgtPressed) {
      smoothRotatePlayer(-1, delta);
      movePlayer(0, 0, -1, moveSpeed, delta);
    } else if (fwdPressed) {
      movePlayer(0, 0, -1, moveSpeed, delta);
    } else if (bkdPressed) {
      movePlayer(0, 0, 1, moveSpeed, delta);
    }

    // Smoothly interpolate current rotation to target rotation (framerate independent)
    const smoothingFactor = ROTATION_SMOOTHING * delta;
    currentRotation += (targetRotation - currentRotation) * smoothingFactor;

    // Apply the smoothed rotation to the player
    player.rotation.y = currentRotation;
  }
}

export function updatePlayer(delta, camera, controls, collisionMesh) {
  /**
   * Main update function for the player. This performs substepped physics,
   * animation mixer updates, collision handling and camera updates.
   *
   * @param {number} delta - time step (seconds)
   * @param {THREE.Camera} camera - active camera
   * @param {Object} controls - optional controls object
   * @param {THREE.Mesh} collisionMesh - mesh used for collisions (BVH required)
   */
  if (!player) {
    console.warn("Player object is null, skipping update");
    return;
  }

  if (!playerPhysicsEnabled) return;

  // Freeze threshold: Skip simulation if delta is too large to prevent tunneling
  // Freeze only on insane lag (always substep drops)
  const FREEZE_THRESHOLD = 1.0; // 1s
  if (delta > FREEZE_THRESHOLD) {
    if (selectedPlayerMixer) {
      selectedPlayerMixer.update(delta);
    }
    return;
  }

  // 240Hz substeps: ultra-small steps, no tunnel on lag
  const MAX_SUBSTEP = 1 / 240;
  let remaining = delta; // Full delta via substeps (no clamp)
  const {
    velocity,
    onGround,
    fwdPressed,
    bkdPressed,
    lftPressed,
    rgtPressed,
    shiftPressed,
  } = playerState;

  const stepOnce = (dt) => {
    // Update animation mixer for this substep
    if (selectedPlayerMixer) {
      selectedPlayerMixer.update(dt);
    }

    if (!playerControlsEnabled) return;

    // Zero out horizontal velocity when not moving
    if (!fwdPressed && !bkdPressed && !lftPressed && !rgtPressed) {
      velocity.x = 0;
      velocity.z = 0;
    }

    // Apply gravity - always apply gravity regardless of onGround state
    velocity.y += dt * gravity;

    // Limit fall speed
    velocity.y = Math.max(velocity.y, -20);
    player.position.addScaledVector(velocity, dt);

    let speed = playerSpeed * (shiftPressed ? 2 : 1);
    let isMoving = fwdPressed || bkdPressed || lftPressed || rgtPressed;

    updatePlayerMovement(dt, speed);
    updatePlayerAnimation(isMoving, shiftPressed);

    player.updateMatrixWorld();

    // Apply moving platform velocity if we were on ground
    if (playerState.onGround && playerState.lastGroundObject && playerState.lastGroundObject.userData && playerState.lastGroundObject.userData.velocity) {
      player.position.addScaledVector(playerState.lastGroundObject.userData.velocity, dt);
      player.updateMatrixWorld();
    }

    // Store previous ground state
    const wasOnGround = playerState.onGround;

    // Reset ground state before collision detection
    playerState.onGround = false;
    let currentGroundObject = null;

    // Collision handling
    // Collision handling
    let accumulatedDelta = new THREE.Vector3();
    let accumulatedNormal = new THREE.Vector3();
    let maxGroundDot = -Infinity;
    let hasAnyCollision = false;

    const processCollision = (mesh) => {
      if (mesh && mesh.geometry && mesh.geometry.boundsTree) {
        const result = calculateCollision(player, mesh);
        if (result.hasCollision) {
          hasAnyCollision = true;
          accumulatedDelta.add(result.delta);
          accumulatedNormal.add(result.normal);
          maxGroundDot = Math.max(maxGroundDot, result.normal.y);

          if (result.normal.y > 0.3) {
            currentGroundObject = mesh;
          }
        }
      }
    };

    if (playerPhysicsEnabled) {
      processCollision(collisionMesh);
      additionalColliders.forEach((colliderEntry) => {
        if (
          colliderEntry.enabled &&
          colliderEntry.collisionMesh &&
          colliderEntry.collisionMesh.geometry &&
          colliderEntry.collisionMesh.geometry.boundsTree
        ) {
          processCollision(colliderEntry.collisionMesh);
        }
      });
    }

    if (hasAnyCollision) {
      // Apply position correction
      const offset = Math.max(0.0, accumulatedDelta.length() - 1e-5);
      if (offset > 0) {
        accumulatedDelta.normalize().multiplyScalar(offset);
        player.position.add(accumulatedDelta);
      }

      // Normalize accumulated normal for velocity response
      if (accumulatedNormal.length() > 0) {
        accumulatedNormal.normalize();
      }

      // Update ground state
      if (maxGroundDot > 0.3 && velocity.y < 2.0) {
        playerState.onGround = true;
      }

      // Apply velocity response
      applyVelocityResponse(velocity, accumulatedNormal);

      // Prevent downward push if grounded
      if (playerState.onGround && maxGroundDot > 0.3 && velocity.y < 0) {
        velocity.y = 0;
      }
    }

    // Update coyote time counter
    if (playerState.onGround) {
      playerState.timeSinceLastGrounded = 0;
    } else {
      playerState.timeSinceLastGrounded += dt;
    }

    // Handle falling animations
    handleFallingAnimations(wasOnGround, dt);

    // Switch back to idle/walk/run animation after jump if player is on ground
    // But only if the jump animation has completed
    if (playerState.onGround && currentAction === jump) {
      // Check if jump animation has completed (since it's set to clampWhenFinished)
      if (!jump.isRunning()) {
        const isMoving = playerState.fwdPressed || playerState.bkdPressed || playerState.lftPressed || playerState.rgtPressed;
        const newAction = isMoving ? (playerState.shiftPressed ? run : walk) : idle;
        if (newAction) {
          switchAction(newAction);
        }
      }
    }

    // Switch back to idle/walk/run animation after spellCast if player is on ground
    // But only if the spellCast animation has completed
    if (playerState.onGround && currentAction === spellCast) {
      // Check if spellCast animation has completed (since it's set to clampWhenFinished)
      if (!spellCast.isRunning()) {
        const isMoving = playerState.fwdPressed || playerState.bkdPressed || playerState.lftPressed || playerState.rgtPressed;
        const newAction = isMoving ? (playerState.shiftPressed ? run : walk) : idle;
        if (newAction) {
          switchAction(newAction);
        }
      }
    }

    // If player just landed, reset vertical velocity
    if (!wasOnGround && playerState.onGround && velocity.y < 0) {
      velocity.y = 0;
    }

    // Update last ground object
    playerState.lastGroundObject = currentGroundObject;
  };

  // Substepping loop
  while (remaining > 1e-6) {
    const dt = Math.min(MAX_SUBSTEP, remaining);
    stepOnce(dt);
    remaining -= dt;
  }

  // Update camera position after all substeps
  if (camera && controls && cameraFollowsPlayer) {
    updateCameraPosition(camera, controls);
  }

  // Reset player if they fall off the map
  if (player.position.y < -25) {
    resetPlayer();
  }
}

// Add function to handle falling animations
function handleFallingAnimations(wasOnGround, deltaTime) {
  /**
   * Handle falling detection and transitions between falling, landing and idle states.
   * Records the start height, triggers falling animation when a minimal distance
   * is traversed and plays landing animation on impact.
   *
   * @param {boolean} wasOnGround - player's grounded state at start of step
   * @param {number} deltaTime - timestep in seconds
   */
  // Check if we just started falling
  if (wasOnGround && !playerState.onGround) {
    // Start falling - record the starting height
    playerState.fallStartHeight = player.position.y;
    playerState.isFalling = false; // Will be set to true after min distance
    playerState.isLanding = false;
    playerState.landingAnimationPlayed = false;
  }

  // While falling, check if we've fallen enough to trigger falling animation
  if (!playerState.onGround && !playerState.isLanding) {
    const fallDistance = playerState.fallStartHeight - player.position.y;

    // If we've fallen more than the minimum distance and we're not already falling
    if (fallDistance >= playerState.minFallDistance && !playerState.isFalling) {
      playerState.isFalling = true;

      // Play falling idle animation if available
      if (fallingIdle && currentAction !== fallingIdle) {
        switchAction(fallingIdle);
      }
    }
  }

  // Check if we just landed (transition from not on ground to on ground)
  if (!wasOnGround && playerState.onGround && playerState.isFalling) {
    playerState.isFalling = false;
    playerState.isLanding = true;
    // Reset fall start height when landing to prevent incorrect falling detection after jump
    playerState.fallStartHeight = player.position.y;

    // Log when player lands after falling
    console.log("Player landed on ground after falling");

    // Play landing animation if available and we haven't played it yet
    if (fallingToLanding && !playerState.landingAnimationPlayed) {
      playerState.landingAnimationPlayed = true;
      switchAction(fallingToLanding);

      // After landing animation completes, switch back to appropriate animation
      setTimeout(() => {
        playerState.isLanding = false;
        playerState.landingAnimationPlayed = false;

        // Determine the correct animation to play after landing
        const isMoving = playerState.fwdPressed || playerState.bkdPressed || playerState.lftPressed || playerState.rgtPressed;
        const newAction = isMoving ? (playerState.shiftPressed ? run : walk) : idle;

        if (newAction && currentAction !== newAction) {
          switchAction(newAction);
        }
      }, fallingToLanding.getClip().duration * 1000); // Convert seconds to milliseconds
    }
  }

  // If we're on the ground but not moving and not in a special animation state, play idle
  // Only do this if we're not currently playing a special animation
  if (playerState.onGround && !playerState.isFalling && !playerState.isLanding) {
    // Check if we're currently playing a special animation that should continue
    const isPlayingSpecialAnimation = (currentAction === jump && jump && jump.isRunning()) ||
      (currentAction === fallingToLanding && fallingToLanding && fallingToLanding.isRunning()) ||
      (currentAction === spellCast && spellCast && spellCast.isRunning());

    if (!isPlayingSpecialAnimation) {
      const isMoving = playerState.fwdPressed || playerState.bkdPressed || playerState.lftPressed || playerState.rgtPressed;
      if (!isMoving && currentAction !== idle) {
        switchAction(idle);
      } else if (isMoving && currentAction !== walk && currentAction !== run) {
        // If moving, switch to walk or run
        const newAction = playerState.shiftPressed ? run : walk;
        switchAction(newAction);
      }
    }
  }
}

// Add these functions to handle Electro sequence
export function disablePlayerControls() {
  playerControlsEnabled = false;

  // Reset all movement states
  playerState.fwdPressed = false;
  playerState.bkdPressed = false;
  playerState.lftPressed = false;
  playerState.rgtPressed = false;
  playerState.shiftPressed = false;

  // Stop player animations
  if (selectedPlayerMixer) {
    selectedPlayerMixer.stopAllAction();
    walkSound.stop();
    runSound.stop();
    // Play idle animation
    if (idle) {
      idle.reset().play();
      currentAction = idle;
    }
  }
}

export function disableCameraControls() {
  cameraControlsEnabled = false;
}

export function enablePlayerControls() {
  playerControlsEnabled = true;
}

export function enableCameraControls() {
  cameraControlsEnabled = true;
}

// Add this function to handle Electro sequence completion
export function handleElectroSequenceComplete(camera, controls) {
  // Re-enable player controls
  enablePlayerControls();

  // Re-enable camera controls
  enableCameraControls();

  // Reset camera rotation to match player
  if (player) {
    cameraRotation = player.rotation.y;
  }

  // Force camera to update position immediately
  if (camera && controls) {
    updateCameraPosition(camera, controls);
  }

  // Ensure player is visible and animations are playing
  if (model) {
    model.visible = true;
  }

  // Play idle animation if not already playing
  if (selectedPlayerMixer && idle && currentAction !== idle) {
    idle.reset().play();
    currentAction = idle;
  }
}

export function handleHoverboardCollisions(
  hoverboard,
  collisionMesh,
  velocity,
  delta
) {
  if (!collisionMesh?.geometry?.boundsTree || !hoverboard || !hoverboard.capsuleInfo) return;

  // Use the capsuleInfo attached to the hoverboardCollisionMesh
  const capsuleInfo = hoverboard.capsuleInfo;
  if (!capsuleInfo || !capsuleInfo.segment) return;

  const tempBox = new THREE.Box3();
  const tempMat = new THREE.Matrix4();
  const tempSegment = new THREE.Line3();

  // Transform segment to collision mesh space
  tempMat.copy(collisionMesh.matrixWorld).invert();
  tempSegment.copy(capsuleInfo.segment);
  tempSegment.start.applyMatrix4(hoverboard.matrixWorld).applyMatrix4(tempMat);
  tempSegment.end.applyMatrix4(hoverboard.matrixWorld).applyMatrix4(tempMat);

  tempBox.expandByPoint(tempSegment.start);
  tempBox.expandByPoint(tempSegment.end);
  tempBox.min.addScalar(-capsuleInfo.radius);
  tempBox.max.addScalar(capsuleInfo.radius);

  let collisionNormal = new THREE.Vector3();
  let collisionPoint = new THREE.Vector3();
  let hasCollision = false;
  let minDistance = Infinity;

  // Use shapecast & closestPointToSegment for correct capsule collision
  collisionMesh.geometry.boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(tempBox),
    intersectsTriangle: (tri) => {
      const triPoint = new THREE.Vector3();
      const capsulePoint = new THREE.Vector3();

      const distance = tri.closestPointToSegment(
        tempSegment,
        triPoint,
        capsulePoint
      );
      if (distance < capsuleInfo.radius && distance < minDistance) {
        minDistance = distance;
        const direction = capsulePoint.sub(triPoint).normalize();
        collisionNormal.copy(direction);
        collisionPoint.copy(capsulePoint);
        hasCollision = true;
      }
    }
  });

  if (hasCollision) {
    // Transform collision normal back to world space
    collisionNormal
      .applyMatrix4(collisionMesh.matrixWorld)
      .sub(collisionMesh.position)
      .normalize();

    // Project velocity onto collision normal
    const normalVelocity = collisionNormal
      .clone()
      .multiplyScalar(velocity.dot(collisionNormal));
    const tangentVelocity = velocity.clone().sub(normalVelocity);

    // Apply bounce and friction (tunable)
    const damping = 0.95;
    const friction = 0.95;

    // Remove normal velocity completely and apply friction/damping to tangent
    normalVelocity.multiplyScalar(0);
    tangentVelocity.multiplyScalar(friction);
    velocity.copy(tangentVelocity);
    velocity.multiplyScalar(damping);

    // Position correction to prevent penetration
    const penetrationDepth = capsuleInfo.radius - minDistance;
    if (penetrationDepth > 0) {
      hoverboard.position.add(collisionNormal.clone().multiplyScalar(penetrationDepth));
    }

    // Prevent continual "slip": if very slow, stop
    if (velocity.length() < 0.01) {
      velocity.set(0, 0, 0);
    }
    // Add upward velocity for hover effect if appropriate (optional)
    // velocity.y = Math.max(velocity.y, 0.1);
  }
}


export function addCollider(name, object) {
  /**
   * Create and register a wireframe collision mesh for the provided object.
   * The returned mesh is equipped with a pre-built BVH to accelerate collision queries.
   *
   * @param {string} name - unique key for the collider (used for update/remove)
   * @param {THREE.Object3D} object - object whose geometry should be used to build the collider
   * @returns {THREE.Mesh|undefined} collisionMesh if successfully created
   */
  if (!object || !object.geometry) {
    console.error("Invalid collider object");
    return;
  }

  // Create a collision mesh for the object
  const collisionMesh = new THREE.Mesh(
    object.geometry,
    new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      opacity: 0.6,
      transparent: true,
      visible: true, // Make colliders visible by default for debugging
    })
  );

  // Create BVH for collision detection
  const geometry = collisionMesh.geometry.clone();
  geometry.boundsTree = new MeshBVH(geometry);

  // Update the collision mesh with the new geometry
  collisionMesh.geometry = geometry;

  // Tag the collision mesh with its name for later reference
  if (!collisionMesh.userData) collisionMesh.userData = {};
  collisionMesh.userData.name = name;
  // Ensure a velocity vector exists on userData so callers can write into it
  if (!collisionMesh.userData.velocity) collisionMesh.userData.velocity = new THREE.Vector3();

  // Copy position, rotation, and scale from the original object
  collisionMesh.position.copy(object.position);
  collisionMesh.rotation.copy(object.rotation);
  collisionMesh.scale.copy(object.scale);
  collisionMesh.updateMatrixWorld(true);

  // Add the collision mesh to the scene if scene is available
  if (scene) {
    scene.add(collisionMesh);
    console.log(`Added collider wireframe for ${name} to scene`);
  } else {
    console.warn(`Scene not available, collider wireframe for ${name} not added to scene`);
  }

  // Store the original object and collision mesh
  additionalColliders.set(name, {
    object: object,
    collisionMesh: collisionMesh,
    enabled: true,
  });

  return collisionMesh;
}

export function removeCollider(name) {
  const collider = additionalColliders.get(name);
  if (collider) {
    if (collider.collisionMesh) {
      // Remove from scene if it was added
      if (scene && collider.collisionMesh.parent === scene) {
        scene.remove(collider.collisionMesh);
      }
      collider.collisionMesh.geometry.dispose();
      collider.collisionMesh.material.dispose();
    }
    additionalColliders.delete(name);
  }
}

export function toggleColliderVisibility(name, visible) {
  const collider = additionalColliders.get(name);
  if (collider) {
    collider.object.visible = visible;
    // Also toggle the collision mesh visibility
    if (collider.collisionMesh) {
      collider.collisionMesh.visible = visible;
    }
  }
}

export function toggleColliderPhysics(name, enabled) {
  const collider = additionalColliders.get(name);
  if (collider) {
    collider.enabled = enabled;
  }
}

export function updateColliderPosition(name, position, rotation) {
  const collider = additionalColliders.get(name);
  if (collider && collider.collisionMesh) {
    collider.collisionMesh.position.copy(position);
    if (rotation) {
      collider.collisionMesh.rotation.copy(rotation);
    }
    collider.collisionMesh.updateMatrixWorld(true);
  }
}

export function debugColliderPositions() {
  console.log("=== Collider Debug Info ===");
  additionalColliders.forEach((collider, name) => {
    if (collider.collisionMesh) {
      console.log(`${name}:`, {
        position: collider.collisionMesh.position.toArray(),
        rotation: collider.collisionMesh.rotation.toArray(),
        enabled: collider.collisionMesh.enabled,
        visible: collider.collisionMesh.visible,
      });
    }
  });
  console.log("==========================");
}

// Simple function to log player position
export function logPlayerPosition() {
  if (player) {
    console.log(
      "Player position:",
      player.position.toArray().map((p) => p.toFixed(3))
    );
  } else {
    console.log("Player not initialized");
  }
}

export function toggleColliderDebugVisibility(visible) {
  additionalColliders.forEach((collider) => {
    if (collider.collisionMesh) {
      collider.collisionMesh.visible = visible;
    }
    // Also toggle the original object visibility
    if (collider.object) {
      collider.object.visible = visible;
    }
  });
}
let isFirstPerson = false;

export function switchToFirstPerson(camera, controls) {
  if (!player || !camera) return;
  isFirstPerson = true;
  // Hide the player model
  if (model) model.visible = false;
  // Set camera to player's head position
  const headPos = player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  camera.position.copy(headPos);
  // Look forward in the direction the player is facing
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
    player.quaternion
  );
  camera.lookAt(headPos.clone().add(forward));
  // Update controls' target if available
  if (controls) {
    controls.target.copy(headPos.clone().add(forward));
    controls.update();
  }
}

export function exitFirstPerson(camera, controls) {
  isFirstPerson = false;
  if (model) model.visible = true;
  // Optionally, reset camera position here if needed
}

// Unified camera offset variables
const cameraOffsetLocal = new THREE.Vector3(1, 0.25, 2); // Default offset
const cameraLookOffsetLocal = new THREE.Vector3(0.8, 0.25, 0); // Default look offset

function getCameraFollowTargets() {
  if (!player) return { position: new THREE.Vector3(), lookAt: new THREE.Vector3() };

  // Use camera yaw when pointer lock is active, otherwise use player rotation
  const yaw = pointerLockActive ? cameraYaw : player.rotation.y;
  // Use camera pitch when pointer lock is active, otherwise use 0
  const pitch = pointerLockActive ? cameraPitch : 0;

  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);

  // Apply yaw rotation to camera offset
  const offsetWorld = new THREE.Vector3(
    cameraOffsetLocal.x * cosY + cameraOffsetLocal.z * sinY,
    cameraOffsetLocal.y,
    -cameraOffsetLocal.x * sinY + cameraOffsetLocal.z * cosY
  );

  const lookOffsetWorld = new THREE.Vector3(
    cameraLookOffsetLocal.x * cosY + cameraLookOffsetLocal.z * sinY,
    cameraLookOffsetLocal.y,
    -cameraLookOffsetLocal.x * sinY + cameraLookOffsetLocal.z * cosY
  );

  // Apply pitch rotation around the camera's local right axis
  const rightAxis = new THREE.Vector3(cosY, 0, -sinY).normalize();
  const qPitch = new THREE.Quaternion().setFromAxisAngle(rightAxis, pitch);
  const pitchedOffset = offsetWorld.clone().applyQuaternion(qPitch);
  const pitchedLookOffset = lookOffsetWorld.clone().applyQuaternion(qPitch);

  const position = new THREE.Vector3().addVectors(player.position, pitchedOffset);
  const lookAt = new THREE.Vector3().addVectors(player.position, pitchedLookOffset);

  return { position, lookAt };
}

// Add pointer lock state variables after other state variables
let pointerLockActive = false;
let pointerLockRequestPending = false;
let cameraYaw = 0; // independent camera yaw for free-look
let cameraPitch = 0; // vertical look angle (radians)
const cameraPitchMin = THREE.MathUtils.degToRad(-22.5);
const cameraPitchMax = THREE.MathUtils.degToRad(35);
let mouseSensitivity = 0.002; // Increased sensitivity for more responsive turning

// Add pointer lock event handlers after other helper functions
// Pointer Lock controls for camera-follow mode
const onPointerLockChange = () => {
  pointerLockActive = (document.pointerLockElement === document.body);
  pointerLockRequestPending = false;
  if (!pointerLockActive) {
    // no-op; cleanup handled by unlock handler
  }
};

const onPointerLockError = () => {
  pointerLockRequestPending = false;
};

const onMouseMove = (event) => {
  if (!pointerLockActive) return;
  const deltaYaw = -event.movementX * mouseSensitivity;
  const deltaPitch = -event.movementY * mouseSensitivity; // Fixed inversion: negated movementY so up moves look up
  cameraYaw += deltaYaw; // free-look yaw
  cameraPitch = Math.max(cameraPitchMin, Math.min(cameraPitchMax, cameraPitch + deltaPitch)); // clamp pitch
};

const onClickRequestPointerLock = () => {
  if (document.pointerLockElement) return;
  if (pointerLockRequestPending) return;
  if (!document.body.requestPointerLock) return;
  pointerLockRequestPending = true;
  try {
    const maybePromise = document.body.requestPointerLock();
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.catch(() => { pointerLockRequestPending = false; });
    }
  } catch (e) {
    pointerLockRequestPending = false;
  }
};

function addPointerLockListeners() {
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('click', onClickRequestPointerLock);
}

function removePointerLockListeners() {
  document.removeEventListener('pointerlockchange', onPointerLockChange);
  document.removeEventListener('pointerlockerror', onPointerLockError);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('click', onClickRequestPointerLock);
  if (document.exitPointerLock && document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
  pointerLockActive = false;
  pointerLockRequestPending = false;
}

export function requestPointerLock() {
  /**
   * Request pointer lock on the page body. The implementation guards against
   * multiple concurrent requests and handles promise-based `requestPointerLock`
   * implementations that may reject.
   */
  if (!pointerLockRequestPending && document.body.requestPointerLock) {
    pointerLockRequestPending = true;
    try {
      const maybePromise = document.body.requestPointerLock();
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => { pointerLockRequestPending = false; });
      }
    } catch (e) {
      pointerLockRequestPending = false;
    }
  }
}

export function exitPointerLock() {
  // Exit pointer lock (if active) and reset local state flags
  if (document.exitPointerLock && document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
  pointerLockActive = false;
  pointerLockRequestPending = false;
}

export function isPointerLockActive() {
  // Return whether the document currently has pointer lock on the body
  return pointerLockActive;
}

export function getCameraYaw() {
  // Return current free-look yaw value (radians)
  return cameraYaw;
}

export function getCameraPitch() {
  // Return current camera pitch (radians, clamped)
  return cameraPitch;
}

export function setCameraYaw(yaw) {
  // Set free-look camera yaw directly (radians)
  cameraYaw = yaw;
}

export function setCameraPitch(pitch) {
  // Set camera pitch with clamping to avoid flipping over
  cameraPitch = Math.max(cameraPitchMin, Math.min(cameraPitchMax, pitch));
}

export function setMouseSensitivity(sensitivity) {
  mouseSensitivity = sensitivity;
}

export function getMouseSensitivity() {
  return mouseSensitivity;
}

export function toggleFollowCamera() {
  // Toggle follow camera on/off. If turning off, ensure pointer lock is released.
  followCameraEnabled = !followCameraEnabled;
  console.log("Follow camera enabled:", followCameraEnabled);

  // If disabling follow camera, exit pointer lock
  if (!followCameraEnabled && pointerLockActive) {
    exitPointerLock();
  }

  return followCameraEnabled;
}

function getSimpleAnimationInterface() {
  if (!animationInterface) {
    animationInterface = {
      playSpellCastAnimation: () => triggerSpellCastAnimation(),
      setSpellCanCastCheck: (fn) => {
        spellCastPredicate = typeof fn === "function" ? fn : null;
      },
      enableExternalCastControl: (enabled) => {
        externalSpellControl = !!enabled;
      },
      get isBowLoading() {
        return false;
      },
      get keyBindings() {
        return defaultKeyBindings;
      },
      isKeyPressed: (binding) => {
        if (!binding) return false;
        const list = Array.isArray(binding) ? binding : [binding];
        return list.some((code) => isBindingActive(code));
      },
      get isSprinting() {
        return playerState.shiftPressed;
      },
    };
  }
  return animationInterface;
}

/**
 * Returns a lightweight interface for driving simple animation actions from UI code.
 * Useful for external systems to ask "is key X pressed?" or to trigger spell casts
 * without needing to know internal state details.
 */

// Add a function to manually trigger pointer lock for testing
export function enablePointerLock() {
  // Request pointer lock
  requestPointerLock();

  // If that doesn't work immediately, try clicking
  if (!pointerLockActive) {
    document.body.click();
  }
}

// Function to stop current animation and switch to idle
export function stopCurrentAnimation() {
  if (!idle || !selectedPlayerMixer) return;
  
  // Stop all animations
  selectedPlayerMixer.stopAllAction();
  
  // Play idle animation
  currentAction = idle;
  idle.reset();
  idle.play();
}

// Function to stop all player sounds
export function stopPlayerSounds() {
  if (walkSound && walkSound.isPlaying) {
    walkSound.stop();
  }
  if (runSound && runSound.isPlaying) {
    runSound.stop();
  }
}

/**
 * Convenience helpers:
 * - `enablePointerLock` tries to request pointer lock and as a fallback triggers
 *   a click event (useful for testing on browsers that require user interaction).
 * - `stopCurrentAnimation` immediately cancels all actions and plays idle.
 * - `stopPlayerSounds` halts any walking/running sound effects.
 */
