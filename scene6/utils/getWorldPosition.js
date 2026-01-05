// Utility to compute the world-space position of an object.
// Wraps Three.js getWorldPosition into a small reusable helper for lessons.
import { Vector3 } from "three";

export default function getWorldPosititon(object) {
  const worldPosition = new Vector3();
  object.getWorldPosition(worldPosition);
  return worldPosition;
}
