/**
 * ============================================
 * VR MANAGER MODULE
 * ============================================
 * Central manager for VR session lifecycle and updates.
 * Bridges VR controller input to game systems.
 * 
 * Responsibilities:
 * - Initialize VR session with proper button
 * - Store references to game systems
 * - Update VR controls each frame
 * - Handle physics updates in VR mode
 * - Cleanup VR session on exit
 * 
 * Features:
 * - XR session state management
 * - Physics integration for VR movement
 * - Collision handling in VR
 * - Proper resource cleanup
 * - Session start/end event handling
 * 
 * Usage:
 * 1. initializeVR() - Setup VR at scene start
 * 2. updateVR() - Call each frame in render loop
 * 3. cleanupVR() - On scene exit or app close
 */

import * as THREE from 'three';
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { setupVR } from "./vr.js";
import { handleCollisions, playerState } from "./playerController.js";

// Store VR state
let currentRenderer = null;
let currentScene = null;
let currentCamera = null;
let currentPlayer = null;
let currentCollisionMesh = null;
let currentClock = null;
let vrControls = null;
let isVRMode = false;

export function initializeVR(renderer, scene, camera, player, actions, clickableObjects, onButtonClick) {
    // Store references
    currentRenderer = renderer;
    currentScene = scene;
    currentCamera = camera;
    currentPlayer = player;
    currentClock = new THREE.Clock();
    
    // Enable XR
    currentRenderer.xr.enabled = true;
    document.body.appendChild(VRButton.createButton(currentRenderer));

    // Initialize VR controls
    vrControls = setupVR(
        currentRenderer,
        currentScene,
        currentCamera,
        currentPlayer,
        actions,
        clickableObjects,
        onButtonClick
    );

    // Set up VR session handlers
    currentRenderer.xr.addEventListener('sessionstart', () => {
        isVRMode = true;
        if (vrControls) {
            vrControls.enableVR();
        }
    });

    currentRenderer.xr.addEventListener('sessionend', () => {
        isVRMode = false;
        if (vrControls) {
            vrControls.disableVR();
        }
    });

    return vrControls;
}

export function updateVR() {
    if (!isVRMode || !vrControls) return;

    const delta = currentClock.getDelta();

    // Update VR controls
    vrControls.updateVRControls();

    // Update physics and collisions if we have a player and collision mesh
    if (currentPlayer && currentCollisionMesh) {
        currentPlayer.updateMatrixWorld();
        handleCollisions(currentPlayer, currentCollisionMesh, playerState.velocity, delta);

        // Apply velocity after collision
        if (playerState.velocity.length() > 0) {
            currentPlayer.position.x += playerState.velocity.x * delta;
            currentPlayer.position.z += playerState.velocity.z * delta;
            if (!playerState.onGround) {
                currentPlayer.position.y += playerState.velocity.y * delta;
            }
        }
    }
}

export function cleanupVR() {
    if (currentRenderer) {
        const session = currentRenderer.xr.getSession();
        if (session) {
            session.end();
        }
    }

    if (vrControls) {
        vrControls.disableVR();
        vrControls = null;
    }

    // Clear stored references
    currentRenderer = null;
    currentScene = null;
    currentCamera = null;
    currentPlayer = null;
    currentCollisionMesh = null;
    currentClock = null;
    isVRMode = false;
}

export function isVRModeActive() {
    return isVRMode;
}

export function getVRControls() {
    return vrControls;
}

export function enablePlayerMovement(player) {
    if (player) {
        player.userData.movementEnabled = true;
    }
}

export function disablePlayerMovement(player) {
    if (player) {
        player.userData.movementEnabled = false;
    }
}

export function setCollisionMesh(mesh) {
    currentCollisionMesh = mesh;
} 