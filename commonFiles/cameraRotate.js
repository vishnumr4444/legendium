/**
 * ============================================
 * CAMERA ROTATION MODULE
 * ============================================
 * Provides smooth camera rotation animation around a target point.
 * Used for introductory scenes, cutscenes, and camera reveals.
 * 
 * Features:
 * - Smooth orbital rotation around a target
 * - Returns a Promise for animation completion tracking
 * - Fixed height option for consistent camera position
 * - Configurable rotation speed and radius
 */

import * as THREE from "three";

export function rotateCameraOnce(
  camera,
  target = new THREE.Vector3(0, 0, 0),
  radius = 200,
  rotationStep = 0.08, // Radians per frame (slower)
  fixedHeight = 30 // Set this to the desired camera height
) {
  return new Promise((resolve) => {
    let requestId;
    let totalRotation = 0; // Track total rotation angle

    function updateCameraRotation() {
      totalRotation += rotationStep; // Increment by fixed angle per frame

      // Calculate new camera position using total rotation
      const x = target.x + radius * Math.cos(totalRotation);
      const z = target.z + radius * Math.sin(totalRotation);

      // Update camera position with fixed height
      camera.position.set(x, fixedHeight, z);
      camera.lookAt(target);

      if (totalRotation < Math.PI * 2) {
        // console.log("Camera rotating", { totalRotation });
        requestId = requestAnimationFrame(updateCameraRotation);
      } else {
        // Ensure final position is exactly at 360 degrees
        camera.position.set(
          target.x + radius * Math.cos(Math.PI * 2),
          fixedHeight,
          target.z + radius * Math.sin(Math.PI * 2)
        );
        camera.lookAt(target);
        resolve();
      }
    }

    updateCameraRotation();
  });
}
