import * as THREE from "three";
import gsap from "gsap";
import { getCurrentScene, getUserInfo } from "../data.js";
import { allAssets } from "./assetsLoader.js";
import { MeshBVH } from "three-mesh-bvh";
 
let walkSound = null;
let runSound = null;
export let selectedPlayerMixer,
  actionIdle,
  actionWalk,
  actionRun,
  actionJump,
  actionSitting,
  hoveraction = null,
  actionFalling = null,
  hoverspeed = null;
export let player = null;
let currentAction,
  model = null;
let isVRMode = false;
let movementEnabled = true;
let cameraFollowsPlayer = true;
let cameraFocusOnPlayer = true;
let currentSceneData = null;
const userInfo = getUserInfo();
 
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
};
 
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempBox = new THREE.Box3();
const tempMat = new THREE.Matrix4();
const tempSegment = new THREE.Line3();
 
let ANIMATION_SPEED_FACTOR = 1; // Default speed factor
export let playerControlsEnabled = true;
const gravity = -9.8;
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
 
// Add at the top with other state variables
export let additionalColliders = new Map();
 
export function setCameraAndControls(newCamera, newControls, newScene) {
  camera = newCamera;
  controls = newControls;
  scene = newScene;
}
 
export function initializePlayer(scene, camera, controls, collisionMesh) {
  currentSceneData = getCurrentScene();
  let isAnimating = true;
  playerControlsEnabled = true;
 
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
      actionIdle =
        allAssets.characters.animations[charName].actions.Idle_Armature;
      actionWalk =
        allAssets.characters.animations[charName].actions.Walk_Armature;
      actionRun =
        allAssets.characters.animations[charName].actions.Run_Armature;
      actionJump =
        allAssets.characters.animations[charName].actions.Jump_Armature;
      actionSitting =
        allAssets.characters.animations[charName].actions.Sit_Armature;
      hoveraction =
        allAssets.characters.animations[charName].actions.hoverboard_idle;
      hoverspeed =
        allAssets.characters.animations[charName].actions.hoverboard_speed;
      actionFalling =
        allAssets.characters.animations[charName].actions.zcliff_fall;
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
  if (actionIdle) actionIdle.timeScale = ANIMATION_SPEED_FACTOR * 0.4;
  if (actionWalk) actionWalk.timeScale = ANIMATION_SPEED_FACTOR;
  if (actionRun) actionRun.timeScale = ANIMATION_SPEED_FACTOR;
  if (actionJump) actionJump.timeScale = ANIMATION_SPEED_FACTOR;
  if (actionSitting) actionSitting.timeScale = ANIMATION_SPEED_FACTOR;
  if (hoveraction) hoveraction.timeScale = ANIMATION_SPEED_FACTOR;
  if (actionFalling) actionFalling.timeScale = ANIMATION_SPEED_FACTOR;
  // Set initial animation
  currentAction =
    actionIdle ||
    (gltf.animations.length > 0
      ? selectedPlayerMixer.clipAction(gltf.animations[0])
      : null);
  if (currentAction) {
    currentAction.play();
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
      actionIdle = null;
      actionWalk = null;
      actionRun = null;
      actionJump = null;
      actionSitting = null;
      hoveraction = null;
      actionFalling = null;
      // Explicitly nullify player and model
      player = null;
      model = null;
      currentSceneData = null;
    }
  }
 
  return { cleanUpPlayer, player, model, selectedPlayerMixer };
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
 
function resetPlayerState() {
  // Reset velocity
  playerState.velocity.set(0, 0, 0);
 
  // Reset movement states
  playerState.fwdPressed = false;
  playerState.bkdPressed = false;
  playerState.lftPressed = false;
  playerState.rgtPressed = false;
  playerState.shiftPressed = false;
 
  // Reset animation if available
  if (selectedPlayerMixer) {
    selectedPlayerMixer.stopAllAction();
    if (actionIdle) {
      actionIdle.reset().play();
      currentAction = actionIdle;
    }
  }
}
 
export function togglePlayerControls(enable) {
  playerControlsEnabled = enable; // Stop responding to movement keys
}
 
export function handleCollisions(player, collisionMesh, velocity, delta) {
  if (
    !collisionMesh ||
    !collisionMesh.geometry ||
    !collisionMesh.geometry.boundsTree
  )
    return;
 
  // Original collision system code remains exactly the same
  const capsuleInfo = player.capsuleInfo;
  let hasAnyCollision = false;
  let finalDeltaVector = new THREE.Vector3();
  let finalCollisionNormal = new THREE.Vector3();
 
  // Handle additional colliders first
  additionalColliders.forEach((collider) => {
    if (collider.enabled && collider.collisionMesh) {
      const additionalCollisionMesh = collider.collisionMesh;
      if (!additionalCollisionMesh.geometry?.boundsTree) return;
 
      const tempBox2 = new THREE.Box3();
      const tempMat2 = new THREE.Matrix4();
      const tempSegment2 = new THREE.Line3();
      const tempVector3 = new THREE.Vector3();
      const tempVector4 = new THREE.Vector3();
 
      tempBox2.makeEmpty();
      tempMat2.copy(additionalCollisionMesh.matrixWorld).invert();
      tempSegment2.copy(capsuleInfo.segment);
 
      tempSegment2.start
        .applyMatrix4(player.matrixWorld)
        .applyMatrix4(tempMat2);
      tempSegment2.end.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat2);
 
      tempBox2.expandByPoint(tempSegment2.start);
      tempBox2.expandByPoint(tempSegment2.end);
      tempBox2.min.addScalar(-capsuleInfo.radius);
      tempBox2.max.addScalar(capsuleInfo.radius);
 
      let additionalCollisionNormal = new THREE.Vector3();
      let additionalCollisionPoint = new THREE.Vector3();
      let hasAdditionalCollision = false;
 
      additionalCollisionMesh.geometry.boundsTree.shapecast({
        intersectsBounds: (box) => box.intersectsBox(tempBox2),
        intersectsTriangle: (tri) => {
          const triPoint = tempVector3;
          const capsulePoint = tempVector4;
 
          const distance = tri.closestPointToSegment(
            tempSegment2,
            triPoint,
            capsulePoint
          );
          if (distance < capsuleInfo.radius) {
            const depth = capsuleInfo.radius - distance;
            const direction = capsulePoint.sub(triPoint).normalize();
 
            additionalCollisionNormal.copy(direction);
            additionalCollisionPoint.copy(capsulePoint);
            hasAdditionalCollision = true;
 
            tempSegment2.start.addScaledVector(direction, depth);
            tempSegment2.end.addScaledVector(direction, depth);
          }
        },
      });
 
      if (hasAdditionalCollision) {
        hasAnyCollision = true;
        const newPosition2 = tempVector3;
        newPosition2
          .copy(tempSegment2.start)
          .applyMatrix4(additionalCollisionMesh.matrixWorld);
 
        const deltaVector2 = tempVector4;
        deltaVector2.subVectors(newPosition2, player.position);
 
        // Prevent downward pushing for additional colliders
        if (deltaVector2.y < 0) {
          deltaVector2.y = 0;
        }
 
        // Accumulate collision response
        finalDeltaVector.add(deltaVector2);
        finalCollisionNormal.add(additionalCollisionNormal);
 
        // Handle velocity response
        const normalVelocity = additionalCollisionNormal
          .clone()
          .multiplyScalar(velocity.dot(additionalCollisionNormal));
        const tangentVelocity = velocity.clone().sub(normalVelocity);
 
        // Apply friction
        tangentVelocity.multiplyScalar(0.999);
 
        // Recombine velocities
        velocity.copy(normalVelocity).add(tangentVelocity);
 
        // Additional damping
        velocity.multiplyScalar(0.999);
 
        // Stop very small velocities
        if (velocity.length() < 0.01) {
          velocity.set(0, 0, 0);
        }
 
        // Prevent downward velocity after collision
        if (velocity.y < 0) {
          velocity.y = 0;
        }
      }
    }
  });
 
  // Then handle main collision mesh
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
    hasAnyCollision = true;
    const newPosition = tempVector;
    newPosition.copy(tempSegment.start).applyMatrix4(collisionMesh.matrixWorld);
 
    const deltaVector = tempVector2;
    deltaVector.subVectors(newPosition, player.position);
 
    // Accumulate collision response
    finalDeltaVector.add(deltaVector);
    finalCollisionNormal.add(collisionNormal);
 
    // Update ground state
    playerState.onGround = deltaVector.y > Math.abs(delta * velocity.y * 0.25);
 
    // Apply collision response
    const normalVelocity = collisionNormal
      .clone()
      .multiplyScalar(velocity.dot(collisionNormal));
    const tangentVelocity = velocity.clone().sub(normalVelocity);
 
    // Apply friction
    const friction = 0.999;
    tangentVelocity.multiplyScalar(friction);
 
    // Combine velocities
    velocity.copy(normalVelocity).add(tangentVelocity);
    velocity.multiplyScalar(0.999);
 
    // Stop if velocity is very small
    if (velocity.length() < 0.01) {
      velocity.set(0, 0, 0);
    }
  } else {
    // If no collision detected, player is not on ground
    playerState.onGround = false;
  }
 
  // Apply final position correction if there were any collisions
  if (hasAnyCollision) {
    // Normalize the accumulated collision normal
    if (finalCollisionNormal.length() > 0) {
      finalCollisionNormal.normalize();
    }
 
    // Apply the accumulated position correction
    const offset = Math.max(0.0, finalDeltaVector.length() - 1e-5);
    if (offset > 0) {
      finalDeltaVector.normalize().multiplyScalar(offset);
      player.position.add(finalDeltaVector);
 
      // Debug: Log collision response
      // if (additionalColliders.size > 0) {
      //   console.log(`Collision resolved: offset=${offset.toFixed(3)}, colliders=${additionalColliders.size}`);
      // }
    }
  }
 
  // Handle gravity with improved falling behavior
  if (!playerState.onGround) {
    velocity.y += gravity * delta;
  } else {
    // Reset vertical velocity when on ground
    velocity.y = 0;
  }
}
 
export function resetPlayer() {
  if (!player) {
    console.error("Cannot reset player: player is null");
    return;
  }
 
  playerState.velocity.set(0, 0, 0);
 
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
  if (actionIdle) {
    switchAction(actionIdle);
  }
}
 
function movePlayer(x, y, z, speed, delta) {
  tempVector.set(x, y, z).applyQuaternion(player.quaternion);
  player.position.addScaledVector(tempVector, speed * delta);
}
 
export function updatePlayerAnimation(isMoving, isRunning) {
  if (!selectedPlayerMixer || !currentAction) return;
  if (playerState.isSitting && actionSitting) return;
  if (currentAction === actionJump && actionJump) return;
 
  const newAction = isMoving
    ? isRunning && actionRun
      ? actionRun
      : actionWalk
    : actionIdle;
 
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
  // Directly set camera position without smooth rotation
  const cameraOffset = new THREE.Vector3(0, 0.25, 2);
  cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
 
  // Update camera position directly
  camera.position.copy(player.position).add(cameraOffset);
 
  // Look directly at player
  const lookTarget = player.position.clone().add(new THREE.Vector3(0, 0.25, 0));
  camera.lookAt(lookTarget);
 
  if (controls && cameraControlsEnabled) {
    controls.target.copy(lookTarget);
    controls.update();
  }
}
 
export function smoothRotatePlayer(direction, delta) {
  // Update target rotation with delta-time based rotation speed
  targetRotation += direction * ROTATION_SPEED * delta;
}
 
export function switchAction(newAction) {
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
 
function onKeyDown(event) {
  if (!playerControlsEnabled) {
    console.log("Player controls disabled");
    return;
  }
  if (!movementEnabled) {
    console.log("Movement disabled");
    return;
  }
 
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      playerState.fwdPressed = true;
      break;
    case "ArrowDown":
    case "KeyS":
      playerState.bkdPressed = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      if (!playerState.lftPressed) {
        playerState.lftPressed = true;
      }
      break;
    case "ArrowRight":
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
    case "Space":
      if (playerState.onGround && movementEnabled) {
        console.log("Jump initiated");
        playerState.velocity.y = 10.0;
        if (actionJump) {
          switchAction(actionJump);
          setTimeout(() => {
            if (currentAction === actionJump) {
              switchAction(actionIdle);
            }
          }, 2000);
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
    case "ArrowUp":
    case "KeyW":
      playerState.fwdPressed = false;
      break;
    case "ArrowDown":
    case "KeyS":
      playerState.bkdPressed = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      playerState.lftPressed = false;
      break;
    case "ArrowRight":
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
  if (model) {
    model.visible = false;
  }
}
 
export function showPlayerModel() {
  if (model) {
    model.visible = true;
  }
}
 
export function setMovementEnabled(enabled) {
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
  cameraFollowsPlayer = follows;
}
 
export function setCameraFocusOnPlayer(focus) {
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
 
export function updatePlayer(delta, camera, controls, collisionMesh) {
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
 
    // Gravity and movement updates
    if (onGround) {
      velocity.y = dt * gravity;
    } else {
      velocity.y += dt * gravity;
    }
 
    velocity.y = Math.max(velocity.y, -20);
    player.position.addScaledVector(velocity, dt);
 
    let speed = playerSpeed * (shiftPressed ? 2 : 1);
    let isMoving = fwdPressed || bkdPressed || lftPressed || rgtPressed;
 
    updatePlayerMovement(dt, speed);
    updatePlayerAnimation(isMoving, shiftPressed);
 
    player.updateMatrixWorld();
 
    // Collision handling
    if (
      playerPhysicsEnabled &&
      collisionMesh &&
      collisionMesh.geometry &&
      collisionMesh.geometry.boundsTree
    ) {
      handleCollisions(player, collisionMesh, velocity, dt);
    }
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
    if (actionIdle) {
      actionIdle.reset().play();
      currentAction = actionIdle;
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
  if (selectedPlayerMixer && actionIdle && currentAction !== actionIdle) {
    actionIdle.reset().play();
    currentAction = actionIdle;
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
      visible: false,
    })
  );
 
  // Create BVH for collision detection
  const geometry = collisionMesh.geometry.clone();
  geometry.boundsTree = new MeshBVH(geometry);
 
  // Update the collision mesh with the new geometry
  collisionMesh.geometry = geometry;
 
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
 
 
 