import { Vector3 } from "three";

/**
 * Convenience helper to read an object's world-space position into a new `Vector3`.
 *
 * @param {THREE.Object3D} object
 * @returns {THREE.Vector3}
 */
export default function getWorldPosititon(object) {
  const worldPosition = new Vector3();
  object.getWorldPosition(worldPosition);
  return worldPosition;
}
