/**
 * ============================================
 * VR (VIRTUAL REALITY) CONTROLLER MODULE
 * ============================================
 * Complete VR input handling and controller setup.
 * Manages VR input devices and player interaction in VR mode.
 * 
 * Features:
 * - Dual controller support (left and right hands)
 * - Raycasting for VR object interaction
 * - Movement controls mapped to VR controllers
 * - Animation system integration
 * - Player rotation in VR
 * - Clickable object interaction
 * - Movement state management
 * - Ray visualization for debugging
 * 
 * VR Input Mapping:
 * - Thumbstick: Player movement
 * - Button press: Interaction/selection
 * - Controller position: Raycast origin
 * 
 * Movement States:
 * - Idle: No movement
 * - Walk: Standard speed movement
 * - Run/Sprint: Enhanced speed
 * - Rotation: Turn in place
 */

import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { setupVRRaycaster, updateVRRaycaster } from './vrRaycaster.js';
import { togglePlayerControls,playerState } from './playerController.js';

export function setupVR(renderer, scene, camera, player, actions, clickableObjects, onButtonClick) {
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    let rayLine1, rayLine2; // Separate ray lines for each controller

    // Adjust this value to match the offset of the player model within the capsule
    const playerModelOffset = new THREE.Vector3(0, 1.45, 0);

    // Store actions locally
    const { actionIdle, actionWalk, actionRun, currentAction } = actions || {
        actionIdle: null,
        actionWalk: null,
        actionRun: null,
        currentAction: null
    };

    let isRotating = false;
    let controller1, controller2;
    let controllerGrip1, controllerGrip2;
    let vrGroup;
    let isVRInitialized = false;
    let vrControlsEnabled = true;

    const clock = new THREE.Clock();

    let currentMovementState = 'idle'; // New variable to track movement state

    let intersectedObjects = new Set(); // Use a Set instead of an array for efficiency

    let vrOverlay;

    let vrControls;
    let vrCamera;
    let vrScene;
    let vrPlayer;
    let vrBackgroundMusic;
    let vrAnimations;
    let vrClickableObjects;
    let vrOnClick;

    function setupControllers() {
        try {
            const controllerModelFactory = new XRControllerModelFactory();

            controller1 = renderer.xr.getController(0);
            if (controller1) {
                scene.add(controller1);
                controllerGrip1 = renderer.xr.getControllerGrip(0);
                controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
                scene.add(controllerGrip1);
            }

            controller2 = renderer.xr.getController(1);
            if (controller2) {
                scene.add(controller2);
                controllerGrip2 = renderer.xr.getControllerGrip(1);
                controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
                scene.add(controllerGrip2);
            }

            setupVRRaycaster(scene, renderer, clickableObjects, onButtonClick);
            isVRInitialized = true;
            console.log('VR setup completed successfully');
        } catch (error) {
            console.error('Error setting up VR controllers:', error);
        }
    }

    function rotatePlayer(rotateLeft, rotateRight) {
        const rotationStep = Math.PI / 86; // Smaller rotation step for smoother rotation


        if (rotateLeft || rotateRight) {
            const rotation = rotationStep * (rotateLeft ? 1 : -1);
            if (renderer.xr.isPresenting) {
                vrGroup.rotation.y += rotation;
                player.rotation.y = vrGroup.rotation.y;
            } else {
                player.rotation.y += rotation;
            }
            isRotating = true;
        } else {
            isRotating = false;
        }
    }

    function movePlayer(forward, backward, sprint) {
        const walkSpeed = 2.4;
        const sprintSpeed = 4.8;
        const speed = sprint ? sprintSpeed : walkSpeed;
        const direction = new THREE.Vector3();
        const delta = Math.min(clock.getDelta(), 0.1);

        camera.getWorldDirection(direction);
        direction.y = 0; // Keep movement on horizontal plane
        direction.normalize();

        // Zero out horizontal velocity when not moving
        if (!forward && !backward) {
            playerState.velocity.x = 0;
            playerState.velocity.z = 0;
            
            if (actionIdle && currentMovementState !== 'idle') {
                switchAction(actionIdle);
                currentMovementState = 'idle';
            }
        } else {
            const movement = direction.multiplyScalar(speed * (forward ? 1 : -1) * delta);
            
            // Apply movement to velocity
            playerState.velocity.x = movement.x;
            playerState.velocity.z = movement.z;
            
            // Apply movement to player position
            player.position.x += movement.x;
            player.position.z += movement.z;
            
            // Update animations
            if (sprint && actionRun) {
                if (currentMovementState !== 'sprint') {
                    switchAction(actionRun);
                    currentMovementState = 'sprint';
                }
            } else if (actionWalk) {
                if (currentMovementState !== 'walk') {
                    switchAction(actionWalk);
                    currentMovementState = 'walk';
                }
            }
        }

        // Apply gravity if not on ground
        if (!playerState.onGround) {
            playerState.velocity.y += -9.8 * delta;
            player.position.y += playerState.velocity.y * delta;
        } else {
            playerState.velocity.y = 0;
        }
    }

    function switchAction(newAction) {
        if (newAction && newAction !== actions.currentAction) {
            if (actions.currentAction) {
                actions.currentAction.fadeOut(0.2);
            }
            newAction.reset().fadeIn(0.2).play();
            actions.currentAction = newAction;
        }
    }

    function playAudio(soundType) {
        if (window.playAudio) {
            window.playAudio(window[soundType + 'Sound']);
        }
    }

    function stopAudio(soundType) {
        if (window.stopAudio) {
            window.stopAudio(window[soundType + 'Sound']);
        }
    }

    function updateVRControls() {
        if (!isVRInitialized || !vrControlsEnabled) return;

        console.log('Updating VR controls');

        const session = renderer.xr.getSession();
        if (!session) return;

        try {
            let forward = false;
            let backward = false;
            let rotateLeft = false;
            let rotateRight = false;
            let sprint = false;

            let leftJoystickY = 0;
            let rightJoystickY = 0;

            session.inputSources.forEach((inputSource) => {
                if (inputSource.gamepad) {
                    const gamepad = inputSource.gamepad;
                    const axes = gamepad.axes;

                    if (axes.length >= 4) {
                        if (inputSource.handedness === 'right') {
                            rightJoystickY = axes[3];
                            if (rightJoystickY < -0.5) forward = true;
                            if (rightJoystickY > 0.5) backward = true;
                            
                        } else if (inputSource.handedness === 'left') {
                            leftJoystickY = axes[3];
                            if (axes[2] < -0.5) rotateLeft = true;
                            if (axes[2] > 0.5) rotateRight = true;
                        }
                    }
                }
            });

            if ((forward && leftJoystickY < -0.5 && rightJoystickY < -0.5) ||
                (backward && leftJoystickY > 0.5 && rightJoystickY > 0.5)) {
                sprint = true;
            }

            if (!playerState.onGround) {
                playerState.velocity.y += -9.8 * 0.01;
            }

            movePlayer(forward, backward, sprint);
            rotatePlayer(rotateLeft, rotateRight);
            updateVRRaycaster(clickableObjects);

            if (vrOverlay) {
                vrOverlay.update();
            }
        } catch (error) {
            console.error('Error updating VR controls:', error);
        }
    }

    function enableVRControls() {
        vrControlsEnabled = true;
        if (controller1) controller1.visible = true;
        if (controller2) controller2.visible = true;
        if (controllerGrip1) controllerGrip1.visible = true;
        if (controllerGrip2) controllerGrip2.visible = true;
    }

    function disableVRControls() {
        vrControlsEnabled = false;
        if (controller1) controller1.visible = false;
        if (controller2) controller2.visible = false;
        if (controllerGrip1) controllerGrip1.visible = false;
        if (controllerGrip2) controllerGrip2.visible = false;
        
        // Reset player state
        playerState.velocity.set(0, 0, 0);
        playerState.fwdPressed = false;
        playerState.bkdPressed = false;
        playerState.lftPressed = false;
        playerState.rgtPressed = false;
        playerState.shiftPressed = false;
    }

    function enableVR() {
        try {
            setupControllers();

            vrGroup = new THREE.Group();
            vrGroup.position.set(0, -1.45, 0);
            
            if (camera) vrGroup.add(camera);
            if (controller1) vrGroup.add(controller1);
            if (controller2) vrGroup.add(controller2);
            if (controllerGrip1) vrGroup.add(controllerGrip1);
            if (controllerGrip2) vrGroup.add(controllerGrip2);

            player.add(vrGroup);
            camera.position.copy(playerModelOffset);
            togglePlayerControls(false);

            player.traverse((child) => {
                if (child.isMesh) {
                    child.visible = false;
                }
            });

            player.visible = true;
            if (player.material) {
                player.material.visible = false;
            }

            if (controller1) controller1.visible = true;
            if (controller2) controller2.visible = true;
            if (controllerGrip1) controllerGrip1.visible = true;
            if (controllerGrip2) controllerGrip2.visible = true;

            clock.start();
        } catch (error) {
            console.error('Error enabling VR:', error);
        }
    }

    function disableVR() {
        try {
            if (vrGroup) {
                player.remove(vrGroup);
                vrGroup.remove(camera);
                if (controller1) vrGroup.remove(controller1);
                if (controller2) vrGroup.remove(controller2);
                if (controllerGrip1) vrGroup.remove(controllerGrip1);
                if (controllerGrip2) vrGroup.remove(controllerGrip2);
                scene.add(camera);
            }

            if (controller1) scene.remove(controller1);
            if (controller2) scene.remove(controller2);
            if (controllerGrip1) scene.remove(controllerGrip1);
            if (controllerGrip2) scene.remove(controllerGrip2);

            togglePlayerControls(true);

            player.traverse((child) => {
                if (child.isMesh) {
                    child.visible = true;
                }
            });

            player.visible = true;
            if (player.material) {
                player.material.visible = true;
            }

            camera.position.set(0, 0, 0);
            vrGroup = null;

            if (vrOverlay) {
                vrOverlay.remove();
                vrOverlay = null;
            }

            isVRInitialized = false;
        } catch (error) {
            console.error('Error disabling VR:', error);
        }
    }

    return {
        updateVRControls,
        enableVR,
        disableVR,
        enableVRControls,
        disableVRControls
    };
}
