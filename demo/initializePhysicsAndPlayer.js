import * as THREE from "three";
import { MeshBVH, StaticGeometryGenerator } from "three-mesh-bvh";
import { initializePlayer } from "./playerController";

/**
 * Initializes physics and player controls for a given 3D model in a Three.js scene.
 *
 * @param {THREE.Object3D} model - The main 3D model to initialize physics for.
 * @param {Object} modelTransformation - Optional transformation settings for positioning and rotating the model.
 * @param {Object} modelTransformation.position - Position of the model (x, y, z).
 * @param {Object} modelTransformation.rotation - Rotation of the model (x, y, z).
 * @param {Array<string>} excludePhysics - List of mesh names to exclude from physics calculations.
 * @param {THREE.Scene} scene - The Three.js scene where the model will be added.
 * @param {THREE.Camera} camera - The camera used in the scene.
 * @param {THREE.Controls} controls - Controls for player movement.
 *
 * @returns {Object} An object containing utility functions:
 * - `playerFunction`: Functions related to player movement and interaction.
 * - `updatePhysics(removeObjectNames)`: Updates the physics collision mesh after removing specified objects.
 * - `cleanUpCollider()`: Cleans up the physics mesh and player data from the scene.
 *
 * @example
 * const { playerFunction, updatePhysics, cleanUpCollider } = initializePhysicsAndPlayer(
 *   model,
 *   { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
 *   ["door", "window"],
 *   scene,
 *   camera,
 *   controls
 * );
 *
 * // To update physics after removing objects
 * updatePhysics(["table", "chair"]);
 *
 * // To clean up physics and player from the scene
 * cleanUpCollider();
 */

export function initializePhysicsAndPlayer(
  model,
  modelTransformation = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  excludePhysics = [],
  scene,
  camera,
  controls
) {
  model.position.set(
    modelTransformation.position.x,
    modelTransformation.position.y,
    modelTransformation.position.z
  );
  model.rotation.set(
    modelTransformation.rotation.x,
    modelTransformation.rotation.y,
    modelTransformation.rotation.z
  );
  let includedMeshes = [];

  model.traverse((child) => {
    if (child.isMesh) {
      let parent = child;
      let shouldExclude = false;

      // ✅ Traverse up to check if any parent is in `excludePhysics`
      while (parent) {
        if (excludePhysics.includes(parent.name)) {
          shouldExclude = true;
          break; // Stop checking further
        }
        parent = parent.parent;
      }

      if (!shouldExclude) {
        includedMeshes.push(child);
      }
    }
  });

  let staticGenerator = new StaticGeometryGenerator(includedMeshes);
  staticGenerator.attributes = ["position"];
  let mergedGeometry = staticGenerator.generate();
  mergedGeometry.boundsTree = new MeshBVH(mergedGeometry);

  let collisionMesh = new THREE.Mesh(
    mergedGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      opacity: 0.6,
      transparent: true,
      visible: false,
    })
  );
  collisionMesh.name = "collision mesh";
  collisionMesh.position.copy(model.position);
  collisionMesh.rotation.copy(model.rotation);
  model.collisionMesh = collisionMesh;
  scene.add(model);
  scene.add(collisionMesh);

  const playerFunction = initializePlayer(
    scene,
    camera,
    controls,
    model.collisionMesh
  );

  // Function to update physics by removing an object
  function updatePhysics(removeObjectNames) {
    let newMeshes = [];

    // Filter out objects that need to be removed
    model.traverse((child) => {
      if (child.isMesh && !removeObjectNames.includes(child.name)) {
        newMeshes.push(child);
      }
    });
    if (newMeshes.length === 0) {
      console.warn("No meshes left for physics after removal!");
      return;
    }

    // Generate new physics geometry
    let newStaticGenerator = new StaticGeometryGenerator(newMeshes);
    newStaticGenerator.attributes = ["position"];
    let newMergedGeometry = newStaticGenerator.generate();

    // Ensure the bounds tree is properly set up
    newMergedGeometry.boundsTree = new MeshBVH(newMergedGeometry);

    // Dispose of the old geometry safely
    if (collisionMesh.geometry) {
      collisionMesh.geometry.boundsTree = null; // Clear the old bounds tree
      collisionMesh.geometry.dispose();
    }

    // Update the existing collision mesh instead of replacing it
    collisionMesh.geometry = newMergedGeometry;

    console.log("Updated collision mesh successfully!");
  }

  function cleanUpCollider() {
    if (model) {
      scene.remove(model);
      model.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    if (collisionMesh) {
      scene.remove(collisionMesh);
      staticGenerator = null;
      mergedGeometry = null;
      if (collisionMesh.geometry) {
        collisionMesh.geometry.dispose();
        collisionMesh.geometry.boundsTree = null;
      }
      if (collisionMesh.material) {
        collisionMesh.material.dispose();
      }
      collisionMesh = null;
    }
    playerFunction.cleanUpPlayer();

    model.collisionMesh = null;
  }

  return { playerFunction, updatePhysics, cleanUpCollider };
}
