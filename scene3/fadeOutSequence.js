

/**
 * @fileoverview Scene 3 fade-out overlay + falling rocks transition.
 *
 * This module is a lightweight “screen transition” helper:
 * - Attaches a full-screen plane to the active camera and fades it to black.
 * - Spawns a set of falling rocks in the scene to sell the collapse transition.
 *
 * Typical usage pattern:
 * - `initializeFadeOut(scene, camera)` once after scene/camera are created.
 * - `startFadeOut(scene)` when you want to begin the fade + rocks effect.
 * - `updateFadeOut(delta)` every frame while fading/active.
 * - `cleanupFadeOut(scene)` when switching scenes (remove rocks, detach references).
 *
 * Notes:
 * - The fade plane is parented to the camera; it will render in camera space.
 * - Rocks are created as scene objects; they should be removed/disposed on cleanup.
 */
import * as THREE from "three";

let fadeOutMaterial = null;
let fadeOutPlane = null;
let fadeOutOpacity = 0;
let fallingRocks = [];
let isFadeOutActive = false;
let fadeOutStartTime = 0;
let currentScene = null;

/**
 * Create and attach the fade overlay plane to the camera.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 */
export function initializeFadeOut(scene, camera) {
    if (!scene || !camera) {
        console.error("Scene or camera not provided to initializeFadeOut");
        return;
    }
    
    currentScene = scene;
    
    // Create fade out plane
    const planeGeometry = new THREE.PlaneGeometry(2, 2);
    fadeOutMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0
    });
    fadeOutPlane = new THREE.Mesh(planeGeometry, fadeOutMaterial);
    fadeOutPlane.renderOrder = 9999; // Render on top of everything
    camera.add(fadeOutPlane);
}

/**
 * Start the fade-out sequence and spawn falling rocks.
 *
 * @param {THREE.Scene} scene
 */
export function startFadeOut(scene) {
    if (isFadeOutActive) return;
    
    if (!scene) {
        console.error("Scene not provided to startFadeOut");
        return;
    }
    
    currentScene = scene;
    isFadeOutActive = true;
    fadeOutStartTime = performance.now();
    
    // Create initial falling rocks
    createFallingRocks();
}

/**
 * Internal: spawn a batch of rock meshes above the scene.
 *
 * Rocks are stored in `fallingRocks` and advanced each frame in `updateFadeOut`.
 */
function createFallingRocks() {
    if (!currentScene) {
        console.error("No scene available for creating falling rocks");
        return;
    }
    
    const rockCount = 50;
    const rockGeometry = new THREE.DodecahedronGeometry(0.2, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2
    });

    for (let i = 0; i < rockCount; i++) {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        
        // Position rocks above the scene
        rock.position.set(
            (Math.random() - 0.5) * 20,
            Math.random() * 20 + 10,
            (Math.random() - 0.5) * 20
        );
        
        // Add random rotation and velocity
        rock.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            -Math.random() * 0.2,
            (Math.random() - 0.5) * 0.1
        );
        
        rock.userData.rotationSpeed = new THREE.Vector3(
            Math.random() * 0.02,
            Math.random() * 0.02,
            Math.random() * 0.02
        );
        
        currentScene.add(rock);
        fallingRocks.push(rock);
    }
}

/**
 * Per-frame update for fade out and rock animation.
 *
 * - Fades to black over ~2 seconds.
 * - Advances rock positions/rotations and culls rocks that fall below -10.
 *
 * @param {number} delta Seconds since last frame (currently unused; retained for API symmetry)
 */
export function updateFadeOut(delta) {
    if (!isFadeOutActive || !currentScene) return;
    
    const elapsedTime = (performance.now() - fadeOutStartTime) / 1000;
    
    // Update fade out opacity
    fadeOutOpacity = Math.min(1, elapsedTime / 2); // Fade to black over 2 seconds
    if (fadeOutMaterial) {
        fadeOutMaterial.opacity = fadeOutOpacity;
    }
    
    // Update falling rocks
    for (let i = fallingRocks.length - 1; i >= 0; i--) {
        const rock = fallingRocks[i];
        
        // Update position
        rock.position.add(rock.userData.velocity);
        
        // Update rotation
        rock.rotation.x += rock.userData.rotationSpeed.x;
        rock.rotation.y += rock.userData.rotationSpeed.y;
        rock.rotation.z += rock.userData.rotationSpeed.z;
        
        // Remove rocks that fall below the scene
        if (rock.position.y < -10) {
            currentScene.remove(rock);
            fallingRocks.splice(i, 1);
        }
    }
    
    // Create new rocks if needed
    if (fallingRocks.length < 50 && Math.random() < 0.1) {
        createFallingRocks();
    }
}

/**
 * Cleanup the fade-out state and remove spawned rocks.
 *
 * Note: This currently does not dispose rock geometries/materials explicitly because
 * they are shared across many meshes. If you want stricter cleanup, refactor to
 * cache/dispose the shared geometry/material once.
 *
 * @param {THREE.Scene} scene
 */
export function cleanupFadeOut(scene) {
    isFadeOutActive = false;
    fadeOutOpacity = 0;
    
    if (fadeOutMaterial) {
        fadeOutMaterial.opacity = 0;
    }
    
    // Remove all falling rocks
    if (currentScene) {
        fallingRocks.forEach(rock => {
            currentScene.remove(rock);
        });
    }
    fallingRocks = [];
    currentScene = null;
} 