/**
 * Animate a list of meshes so they "blink" by pulsing opacity over time.
 * Returns a cleanup function that restores original materials and stops the loop.
 *
 * @param {THREE.Object3D[]} objects
 * @returns {() => void|undefined}
 */
export function BlinkMesh(objects) {
  if (!Array.isArray(objects) || objects.length === 0) {
    console.log("Blinking objects array is empty or invalid");
    return;
  }

  // Store original material states for restoration
  const originalMaterials = new Map();

  // Prepare each object
  objects.forEach((object) => {
    if (!object) return;
    object.traverse((child) => {
      if (child.isMesh && child.material) {
        originalMaterials.set(child, child.material);
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 1.0;
      }
    });
  });

  if (originalMaterials.size === 0) {
    console.log("No meshes with materials found in given objects");
    return;
  }

  let time = 0;
  let running = true;
  let animationId;

  function animate() {
    if (!running) return;

    time += 0.02;
    const opacity = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(time));

    // Update opacity for all children of all objects
    objects.forEach((object) => {
      if (!object) return;
      object.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacity;
        }
      });
    });

    animationId = requestAnimationFrame(animate);
  }

  animate();

  // Return cleanup function
  return () => {
    running = false;
    cancelAnimationFrame(animationId);

    // Restore original materials
    originalMaterials.forEach((material, child) => {
      child.material = material;
    });
  };
}
/**
 * Immediately set all mesh materials in the given objects to a specific opacity.
 * Returns a cleanup function to restore their original materials.
 *
 * @param {THREE.Object3D[]} objects
 * @param {number} opacity
 */
export function HideMesh(objects, opacity = 0.0) {
  if (!Array.isArray(objects) || objects.length === 0) {
    console.log("Blinking objects array is empty or invalid");
    return;
  }

  // Store original material states for restoration
  const originalMaterials = new Map();

  // Prepare each object
  objects.forEach((object) => {
    if (!object) return;
    object.traverse((child) => {
      if (child.isMesh && child.material) {
        originalMaterials.set(child, child.material);
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 1.0;
      }
    });
  });

  if (originalMaterials.size === 0) {
    console.log("No meshes with materials found in given objects");
    return;
  }

  function animate() {
    // Update opacity for all children of all objects
    objects.forEach((object) => {
      if (!object) return;
      object.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacity;
        }
      });
    });
  }

  animate();

  // Return cleanup function
  return () => {
    // Restore original materials
    originalMaterials.forEach((material, child) => {
      child.material = material;
    });
  };
}
