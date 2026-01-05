/**
 * ============================================
 * PATH FOLLOWER MODULE
 * ============================================
 * Makes a model follow a path smoothly with animation.
 * Used for:
 * - Scripted movement sequences
 * - NPC walking/flying paths
 * - Cinematic camera movements
 * - Guided tours through scenes
 * 
 * Features:
 * - Catmull-Rom curve interpolation for smooth paths
 * - Animation state management (walk → idle transition)
 * - Camera follow option
 * - Trigger point support during path execution
 * - Path reversal capability
 * - Promise-based completion tracking
 * - Optional callbacks at specific path points
 * 
 * Animation Transitions:
 * - Walking: Active movement along path
 * - Idle: After path completion
 * - Optional trigger at specified point
 */

import * as THREE from "three";
import { reversePathPoints } from "./reversePathPoints";

export function pathFollower(
  pathFile,
  model1,
  mixer,
  camera = null, // Camera can be null
  movementSpeed,
  walkAction,
  idleAction,
  reversePoints = false,
  options = {} // Default to empty object
) {
  let model = model1;
  let curve = new THREE.CatmullRomCurve3(pathFile.points); // Convert points to a curve

  let walkAlongThePathFlag = true;
  let currentIndex = 0;
  let moveSpeed = movementSpeed;
  const clock = new THREE.Clock();
  let hasEnded = false; // Flag to track if the path has ended
  let walkAnimationStartingFlag = false;

  // Extract optional parameters safely
  const { triggerPointNumber, onCompleteFunction } = options || {};
  const shouldTriggerEvent =
    typeof triggerPointNumber === "number" &&
    typeof onCompleteFunction === "function";

  // Promise to resolve when the path ends
  let resolvePathEnd;
  const pathEndPromise = new Promise((resolve) => {
    resolvePathEnd = resolve;
  });

  if (reversePoints) {
    reversePathPoints(pathFile.points);
  }

  const numberOfPoints = pathFile.points.length; // Get total number of points
  const segmentLength = 1 / (numberOfPoints - 1); // Dynamically calculate segment length
  let pointTrackerFlag = true; // Ensure trigger runs only once

  function animatePath() {
    const delta = clock.getDelta();

    if (walkAlongThePathFlag && curve) {
      mixer.update(delta * 0.2);

      let targetIndex = currentIndex + moveSpeed * delta;

      if (targetIndex >= 1) {
        targetIndex = 1;
        walkAlongThePathFlag = false;
        hasEnded = true;
        resolvePathEnd();
        transitionToIdle(delta);
      }

      const currentPoint = curve.getPointAt(currentIndex);
      const nextPoint = curve.getPointAt(targetIndex);

      model.position.copy(currentPoint);

      const direction = new THREE.Vector3()
        .subVectors(nextPoint, currentPoint)
        .normalize();
      const rotationQuaternion = new THREE.Quaternion();
      rotationQuaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        direction
      );
      model.quaternion.copy(rotationQuaternion);
      model.rotateY(Math.PI);

      // Camera follow logic
      if (camera) {
        const cameraOffset = new THREE.Vector3(0, 0, 3);
        const offsetPosition = cameraOffset.applyQuaternion(model.quaternion);
        const desiredCameraPosition = model.position
          .clone()
          .add(offsetPosition);
        camera.position.lerp(desiredCameraPosition, 0.1);
        camera.lookAt(model.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
      }

      // Only execute this logic if the optional parameters are provided
      if (shouldTriggerEvent) {
        const pointIndex = Math.floor(currentIndex / segmentLength);
        if (pointIndex >= triggerPointNumber && pointTrackerFlag) {
          console.log("hii");
          onCompleteFunction();
          pointTrackerFlag = false; // Ensure it runs only once
        }
      }

      currentIndex = targetIndex;
    }
  }

  function transitionToIdle(delta) {
    // Stop walking and transition to idle
    mixer.stopAllAction();
    idleAction.reset().play();
    mixer.update(delta);
  }

  function startAnimation() {
    if (!walkAnimationStartingFlag) {
      walkAnimationStartingFlag = true;
      mixer.stopAllAction();
      walkAction.reset().play(); // Start walking animation
    }

    function internalAnimate() {
      animatePath();
      if (walkAlongThePathFlag) {
        requestAnimationFrame(internalAnimate);
      }
    }
    requestAnimationFrame(internalAnimate);
  }

  return {
    startAnimation,
    isPathEnded: () => hasEnded, // Expose the path status
    pathEndPromise, // Return the promise
  };
}
