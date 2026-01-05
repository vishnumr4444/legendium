import getWorldPosititon from "./getWorldPosition";
import { gsap } from "gsap";
import * as THREE from "three";

/**
 * Helper to configure raycaster + side panel for the next build step.
 *
 * - Updates the internal step value used by `RaycasterSetup2`
 * - Updates the side panel UI with the correct mesh, texture, and instruction text
 */
export function setupForNextSetup(
  raycasterSetup,
  stepCounter,
  sidepanelInstance,
  assembeldBotCopy,
  texture,
  meshName,
  instructionText // Add this new parameter for the step's text
) {
  raycasterSetup.updateStep(stepCounter);
  sidepanelInstance.updateElement(
    assembeldBotCopy.get(meshName).mesh,
    texture,
    meshName,
    instructionText
  );
  raycasterSetup.addSidePanelObjects(...sidepanelInstance.elements);
}

/**
 * Compute the distance between the currently dragged component and its target.
 *
 * @returns {{ distance: number, targetPos: THREE.Vector3 }}
 */
export function getDistance(raycasterSetup, target) {
  const dropPos = getWorldPosititon(raycasterSetup.draggedComponent);
  const targetPos = getWorldPosititon(target);
  const distance = dropPos.distanceTo(targetPos);
  return { distance, targetPos };
}

/**
 * Small visual "snap" effect: nudges an object and eases it back to its origin.
 */
export function snappingEffect(object, [x, y, z]) {
  const orginalPosition = object.position.clone();
  object.position.add(new THREE.Vector3(x, y, z));
  gsap.to(object.position, {
    x: orginalPosition.x,
    y: orginalPosition.y,
    z: orginalPosition.z,
  });
}
