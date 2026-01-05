import * as THREE from "three";

/**
 * @function applyDistanceFade
 * @description Dynamically adjusts the opacity of a 3D object's material based on the player's distance from it.
 * This creates a smooth fade-in/out effect where the object becomes fully visible when the player is within
 * `minDistance`, and fully transparent when beyond `maxDistance`.
 *
 * @param {THREE.Object3D} object - The object whose material opacity will be modified.
 * @param {THREE.Object3D} player - The reference object (typically the player or camera) to measure distance from.
 * @param {number} minDistance - The distance at which the object is fully opaque (opacity = 1.0).
 * @param {number} maxDistance - The distance beyond which the object is fully transparent (opacity = 0.0).
 *
 * @example
 * import { applyDistanceFade } from './FadeUtil.js';
 *
 * function render() {
 *   applyDistanceFade(lockPlane, player, 1.2, 3.5);
 *   renderer.render(scene, camera);
 * }
 */


export function applyDistanceFade(object, player, minDistance, maxDistance) {
  let distance = player.position.distanceTo(object.position);
  let opacity = 1.0 - (distance - minDistance) / (maxDistance - minDistance);
  object.material.opacity = THREE.MathUtils.clamp(opacity, 0.0, 1.0);
}