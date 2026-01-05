/**
 * About: `scene6/stepCameraTargets.js`
 *
 * Optional per-step camera target definitions for Scene 6 lessons.
 * Intended as a data-only module to allow tuning camera targets per lesson/step.
 */

"use strict"; // Enable strict mode for safer JavaScript

import * as THREE from "three";

/**
 * Optional per-step camera targets for each lesson.
 * Currently all targets are identical, but the structure allows future tuning.
 *
 * Structure: { [lessonId: string]: Array<{ target: THREE.Vector3, duration: number }> }
 */
export const lessonStepCameraTargets = {
  lesson1: [
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 0 - same as lesson2
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 1 - same as lesson2
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 2 - same as lesson2
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 3 - same as lesson2
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 4 - same as lesson2
    // ...add more steps as needed
  ],
  lesson2: [
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 0
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 1
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 2
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 3
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 4
    // ...
  ],
  lesson3: [
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 0 - Title
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 1 - Temperature sensor connection
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 2 - JST connector
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 3 - Arduino Nano
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 4 - LED on expansion board
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 5 - LED module connected
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 6 - Move the cube prompt
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 7 - Final/next lesson
  ],
  lesson4: [
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 0 - Title
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 1 - Temperature sensor connection
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 2 - JST connector
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 3 - Arduino Nano
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 4 - LED on expansion board
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 5 - LED module connected
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 6 - Move the cube prompt
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 6 - Battery to Expansion Board
    // Add more if lesson4 has more steps
  ],
  lesson5: [
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 0 - Title
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 1 - Temperature sensor connection
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 2 - JST connector
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 3 - Arduino Nano
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 4 - LED on expansion board
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 5 - LED module connected
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 6 - Move the cube prompt
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 6 - Battery to Expansion Board
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 7 - IR sensor connection
    { target: new THREE.Vector3(0, 2, -3), duration: 1 }, // Step 8 - IR sensor connection
    // Add more if lesson4 has more steps
  ],
  // Add more lessons as needed
};

