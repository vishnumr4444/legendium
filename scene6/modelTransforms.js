/**
 * About: `scene6/modelTransforms.js`
 *
 * Central table of default transforms (position/rotation/scale) for key Scene 6 models.
 * Keeps placement consistent across lessons and utilities.
 */

"use strict"; // Enable strict mode for safer JavaScript

import * as THREE from "three";

/**
 * Centralized default transforms (position/rotation/scale) for key Scene 6 models.
 * This keeps all model placement logic in one place so lessons can reuse it consistently.
 */
export const modelTransforms = {
  nano1: {
    position: new THREE.Vector3(0.7, 1.7, -3.7),
    rotation: new THREE.Euler(0, -Math.PI / 2, 0), // Default rotation
    scale: new THREE.Vector3(10, 10, 10),
    lesson2rotation: new THREE.Euler(0, Math.PI / 2, 0),
  },
  expansionBoard: {
    position: new THREE.Vector3(0, 1.77, -3.41),
    rotation: new THREE.Euler(0, -Math.PI / 2, 0), // Default rotation
    scale: new THREE.Vector3(10, 10, 10),
    lesson2rotation: new THREE.Euler(0, Math.PI / 2, 0),
  },
  rgbLED: {
    position: new THREE.Vector3(-0.58, 1.78, -3.3),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    scale: new THREE.Vector3(10, 10, 10),
  },
  pin4Female1: {
    position: new THREE.Vector3(0.5, 2, -3),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(10, 10, 10)
    // scale: not used for pin4Female1
  },
  pin4Female2: {
    position: new THREE.Vector3(0, 1.8, -3),
    rotation: new THREE.Euler(0, 0, -Math.PI * 2),
    // scale: not used for pin4Female2
  },
  buzzer: {
    position: new THREE.Vector3(0.45, 1.8, -3.06),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    scale: new THREE.Vector3(10, 10, 10),
  },
  pin3Female11: {
    position: new THREE.Vector3(0, 1.8, -3),
    rotation: new THREE.Euler(0, Math.PI * 3, Math.PI * 3),
    scale: new THREE.Vector3(10, 10, 10),
  },
  pin3Female12: {
    position: new THREE.Vector3(0.5, 1.7, -3.05),
    rotation: new THREE.Euler(0, -Math.PI * 3, Math.PI * 3),
    scale: new THREE.Vector3(10, 10, 10),
  },
  tempSensor: {
    position: new THREE.Vector3(0.45, 1.8, -3.06),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    scale: new THREE.Vector3(10, 10, 10),
  },
  battery: {
    position: new THREE.Vector3(0.8, 1.5, -3.3),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.7, 0.7, 0.7),
  },
  pin3Female2: {
    position: new THREE.Vector3(0, 1.8, -3),
    rotation: new THREE.Euler(0, Math.PI * 3, Math.PI * 3),
    scale: new THREE.Vector3(10, 10, 10),
  },
}
