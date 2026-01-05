/**
 * ============================================
 * PHYSICS AND PLAYER INITIALIZATION MODULE
 * ============================================
 * Sets up 3D physics collision system and player controller.
 * 
 * Responsibilities:
 * - Initialize BVH (Bounding Volume Hierarchy) collision mesh for scene
 * - Create collision detection system from scene geometry
 * - Initialize player controller with physics
 * - Handle player-environment collisions
 * - Support for selective physics (exclude certain objects)
 * - Tab visibility handling for physics pause/resume
 * 
 * Features:
 * - Automatic physics mesh generation from scene
 * - Optimized collision detection with BVH
 * - Support for excluding objects from physics
 * - Collision mesh debugging option
 * - Dynamic physics updates for scene changes
 * - Automatic bounds tree rebuild on tab return
 */

import * as THREE from "three";
import { MeshBVH, StaticGeometryGenerator } from "three-mesh-bvh";
import { initializePlayer as defaultInitializePlayer } from "./playerController";

export function initializePhysicsAndPlayer(
  model,
  modelTransformation = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  excludePhysics = [],
  scene,
  camera,
  controls,
  renderer,
  options = {}
) {
  const { playerControllerModule } = options || {};
  const initializePlayerFn =
    playerControllerModule?.initializePlayer || defaultInitializePlayer;

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
      // wireframe: true,
      // opacity: 0.6,
      // transparent: true,
      visible: false,
    })
  );
  collisionMesh.name = "collisionmesh";
  collisionMesh.position.copy(model.position);
  collisionMesh.rotation.copy(model.rotation);
  model.collisionMesh = collisionMesh;
  scene.add(model);
  scene.add(collisionMesh);

  // Add visibility change handler to maintain collision mesh
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && collisionMesh && collisionMesh.geometry) {
      // Ensure collision mesh is properly positioned
      collisionMesh.position.copy(model.position);
      collisionMesh.rotation.copy(model.rotation);

      // Rebuild bounds tree when tab becomes visible
      if (!collisionMesh.geometry.boundsTree) {
        try {
          collisionMesh.geometry.boundsTree = new MeshBVH(
            collisionMesh.geometry
          );
          console.log("Collision mesh bounds tree rebuilt successfully");
        } catch (error) {
          console.error("Failed to rebuild collision mesh bounds tree:", error);
          // Attempt to regenerate the geometry if bounds tree creation fails
          let newStaticGenerator = new StaticGeometryGenerator(includedMeshes);
          newStaticGenerator.attributes = ["position"];
          let newMergedGeometry = newStaticGenerator.generate();
          newMergedGeometry.boundsTree = new MeshBVH(newMergedGeometry);

          if (collisionMesh.geometry) {
            collisionMesh.geometry.dispose();
          }
          collisionMesh.geometry = newMergedGeometry;
        }
      }
    }
  });

  const playerFunction = initializePlayerFn(
    scene,
    camera,
    controls,
    model.collisionMesh,
    renderer
  );

  // Function to update physics by removing an object
  function updatePhysics(removeObjectNames, baseModel = null) {
    let newMeshes = [];

    model.traverse((child) => {
      if (child.isMesh && !removeObjectNames.includes(child.name)) {
        newMeshes.push(child);
      }
    });

    if (newMeshes.length === 0) {
      console.warn("No meshes left for physics after removal!");
      return;
    }

    // Generate merged geometry
    let newStaticGenerator = new StaticGeometryGenerator(newMeshes);
    newStaticGenerator.attributes = ["position"];
    let newMergedGeometry = newStaticGenerator.generate();

    newMergedGeometry.boundsTree = new MeshBVH(newMergedGeometry);

    // Dispose old geometry
    if (collisionMesh.geometry) {
      collisionMesh.geometry.boundsTree = null;
      collisionMesh.geometry.dispose();
    }

    // Update collision mesh geometry
    collisionMesh.geometry = newMergedGeometry;

    //Align collision mesh with given baseModel
    if (baseModel) {
      baseModel.updateMatrixWorld(true);
      let worldMatrix = baseModel.matrixWorld;

      let position = new THREE.Vector3();
      let quaternion = new THREE.Quaternion();
      let scale = new THREE.Vector3();
      worldMatrix.decompose(position, quaternion, scale);

      collisionMesh.position.copy(position);
      collisionMesh.quaternion.copy(quaternion);
      collisionMesh.scale.copy(scale);
      collisionMesh.updateMatrixWorld(true);
    } else {
      // Optional: reset transform if no baseModel is passed
      collisionMesh.position.set(0, 0, 0);
      collisionMesh.quaternion.identity();
      collisionMesh.scale.set(1, 1, 1);
      collisionMesh.updateMatrixWorld(true);
    }

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
