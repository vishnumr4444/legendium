/**
 * @file dragUtils.js
 * @description
 * This module provides utilities for interacting with 3D objects in a Three.js scene
 * using DragControls. It includes functions for initializing draggable objects,
 * handling snapping logic, raycasting for selection, and general drag behavior.
 *
 * The module is designed for circuits or component-based setups, allowing objects
 * like batteries, LEDs, resistors, etc., to be dragged, snapped to correct positions,
 * and checked for placement completion.
 *
 * It exports helper functions, DragControls initialization, and variables for
 * tracking currently draggable objects.
 */

import * as THREE from "three";
import { DragControls } from "three/examples/jsm/controls/DragControls.js";

/**
 * Array of objects currently available for dragging.
 * @type {THREE.Object3D[]}
 */
export let filterObjects = [];

/**
 * Instance of DragControls used for managing object dragging.
 * @type {DragControls|null}
 */
export let draggingControl = null;

/**
 * Disposes of any active DragControls to clean up event listeners and memory.
 */
export function cleanupDragControls() {
  if (draggingControl) {
    draggingControl.dispose();
    draggingControl = null;
  }
}

/**
 * Updates a pointer vector from a DOM event to be used in raycasting.
 *
 * @param {MouseEvent} event - The mouse event.
 * @param {THREE.Camera} cam - The camera used for raycasting.
 * @param {THREE.Vector2} pointer - The normalized device coordinates vector.
 * @param {THREE.Raycaster} raycaster - The Three.js raycaster instance.
 */
export function updatePointer(event, cam, pointer, raycaster) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, cam);
}

/**
 * Traverses up the object hierarchy to find the top-level parent under the scene.
 *
 * @param {THREE.Object3D} obj - The starting object.
 * @param {THREE.Scene} scene - The root scene to stop traversal at.
 * @returns {THREE.Object3D} The top-level object within the scene.
 */
export function getTopLevelObject(obj, scene) {
  while (obj.parent && obj.parent !== scene) obj = obj.parent;
  return obj;
}

/**
 * Determines the closest snapping position for a dragged object.
 *
 * @param {THREE.Object3D} object - The object being dragged.
 * @param {THREE.Vector3[]} finalPositions - Array of valid snap positions.
 * @param {number} snapThreshold - Maximum distance to allow snapping.
 * @param {Map<THREE.Vector3, THREE.Object3D>} occupiedPositions - Positions currently occupied.
 * @returns {THREE.Vector3|null} The closest snap position, or null if none available.
 */
export function objSnapping(
  object,
  finalPositions,
  snapThreshold,
  occupiedPositions
) {
  let closest = null;
  let minDist = Infinity;

  finalPositions.forEach((pos) => {
    const dist = object.position.distanceTo(pos);
    if (dist < minDist && dist < snapThreshold && !occupiedPositions.has(pos)) {
      minDist = dist;
      closest = pos;
    }
  });

  return closest;
}

/**
 * Initializes DragControls for specified scene objects, sets up drag behavior,
 * snapping logic, and placement completion checks.
 *
 * @param {Object} params - Parameters object.
 * @param {THREE.Scene} params.scene - The Three.js scene containing objects.
 * @param {THREE.Camera} params.circuitCam - Camera used for dragging interactions.
 * @param {THREE.WebGLRenderer} params.renderer - Renderer used to attach DragControls.
 * @param {THREE.Vector3[]} params.finalPositions - Array of target positions for snapping.
 * @param {number} params.snapThreshold - Maximum snapping distance.
 * @param {Map<THREE.Vector3, THREE.Object3D>} params.occupiedPositions - Currently occupied snap positions.
 * @param {Function} params.allObjectsPlaced - Callback to verify if all objects are correctly placed.
 * @param {Object.<string, {plane: THREE.Object3D, correctPosition: THREE.Vector3}>} params.objectToPlaneMap
 *        - Mapping of object names to their placeholder plane and correct snap position.
 */
export function updateFilterObjects({
  scene,
  circuitCam,
  renderer,
  finalPositions,
  snapThreshold,
  occupiedPositions,
  allObjectsPlaced,
  objectToPlaneMap,
}) {
  filterObjects = ["battery9v", "led", "capacitor", "resistor100", "dcMotor"]
    .map((name) => scene.getObjectByName(name))
    .filter(Boolean);

  if (filterObjects.length === 0) {
    console.warn("No valid objects found for DragControls.");
    return;
  }

  if (draggingControl) draggingControl.dispose();

  draggingControl = new DragControls(
    filterObjects,
    circuitCam,
    renderer.domElement
  );
  draggingControl.transformGroup = true;

  // Lock axis + preserve rotation during drag
  draggingControl.addEventListener("drag", (e) => {
    const object = e.object;
    object.position.y = -0.95;
    if (object.userData.initialRotation) {
      object.rotation.copy(object.userData.initialRotation);
    }
  });

  // Free occupied slot when dragging starts
  draggingControl.addEventListener("dragstart", (e) => {
    const object = e.object;

    for (let [pos, obj] of occupiedPositions) {
      if (obj === object) {
        occupiedPositions.delete(pos);

        // If this object was correctly placed before → unhide its plane again
        const entry = objectToPlaneMap[object.name];
        if (entry) {
          entry.plane.visible = true;
          scene.add(entry.plane); // make sure it's back in the scene
        }

        break;
      }
    }
  });

  // Snap into position + remove plane if correctly placed
  draggingControl.addEventListener("dragend", (e) => {
    const object = e.object;
    const snapTo = objSnapping(
      object,
      finalPositions,
      snapThreshold,
      occupiedPositions
    );

    if (snapTo) {
      object.position.copy(snapTo);
      occupiedPositions.set(snapTo, object);

      const entry = objectToPlaneMap[object.name];
      if (entry) {
        const { plane, correctPosition } = entry;

        if (snapTo.distanceTo(correctPosition) < 0.01) {
          console.log(`${object.name} placed correctly.`);
          plane.visible = false; // just hide instead of removing
        }
      }
    }

    if (object.userData.initialRotation) {
      object.rotation.copy(object.userData.initialRotation);
    }

    allObjectsPlaced();
  });
}

/**
 * Handles raycasting-based selection of draggable objects on mouse events.
 *
 * @param {MouseEvent} event - The DOM mouse event.
 * @param {THREE.Camera} circuitCam - Camera used for raycasting.
 * @param {THREE.Vector2} pointer - Pointer vector for raycasting.
 * @param {THREE.Raycaster} raycaster - Raycaster instance.
 * @param {THREE.Object3D[]} filterObjects - Objects eligible for dragging.
 * @param {THREE.Scene} scene - The root scene to identify top-level objects.
 */
export function dragObjects(
  event,
  circuitCam,
  pointer,
  raycaster,
  filterObjects,
  scene
) {
  updatePointer(event, circuitCam, pointer, raycaster);
  if (!filterObjects.length) return;

  const intersections = raycaster.intersectObjects(filterObjects, true);
  if (intersections.length > 0) {
    const object = getTopLevelObject(intersections[0].object, scene);
    console.log(object.name);
  }
}
