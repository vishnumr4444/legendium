import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import { createMatchingPuzzle } from './matchingPuzzle.js';

/**
 * Creates a MeshUI button in front of the portal with unlock functionality
 * @param {THREE.Scene} scene - The scene to add UI to
 * @param {THREE.Vector3} portalPosition - Position of the portal
 * @param {Function} onUnlock - Callback when portal is unlocked
 * @returns {Object} API for managing portal unlock UI
 */
export function createPortalUnlockUI(scene, portalPosition, onUnlock) {
    let uiContainer = null;
    let buttonBlock = null;
    let buttonTextObj = null;
    let promptText = null;
    let promptTextObj = null;
    let statusText = null;
    let statusTextObj = null;
    let isUnlocked = false;
    let isPuzzleSolved = false;
    let collectedCount = 0;
    let matchingPuzzle = null;
    const REQUIRED_COLLECTIBLES = 8;

    // Calculate position in front of portal (offset by -3 units in X direction since portal faces +X)
    const uiPosition = new THREE.Vector3(
        portalPosition.x,
        portalPosition.y - 1,
        portalPosition.z
    );

    // Create container for all UI elements
    uiContainer = new THREE.Group();
    uiContainer.position.copy(uiPosition);
    uiContainer.rotation.y = -Math.PI / 2; // Face the player approaching from -X
    scene.add(uiContainer);

    // Create "Press (E) to unlock" text above button
    promptText = new ThreeMeshUI.Block({
        width: 2.5,
        height: 0.4,
        padding: 0.1,
        backgroundColor: new THREE.Color(0x000000),
        backgroundOpacity: 0.7,
        borderRadius: 0.1,
        justifyContent: 'center',
        alignContent: 'center',
        fontFamily: '/fonts/msdf/Roboto-msdf.json',
        fontTexture: '/fonts/msdf/Roboto-msdf.png',
    });

    promptTextObj = new ThreeMeshUI.Text({
        content: 'Press (E) to unlock',
        fontSize: 0.15,
        fontColor: new THREE.Color(0xffff00),
    });

    promptText.add(promptTextObj);
    promptText.position.set(0, 1.2, 0);
    promptText.visible = false; // Hidden by default
    uiContainer.add(promptText);

    // Create "Unlock Portal" button
    buttonBlock = new ThreeMeshUI.Block({
        width: 2,
        height: 0.6,
        padding: 0.15,
        backgroundColor: new THREE.Color(0x1a1a2e),
        backgroundOpacity: 0.9,
        borderRadius: 0.15,
        borderWidth: 0.02,
        borderColor: new THREE.Color(0x00ffff),
        justifyContent: 'center',
        alignContent: 'center',
        fontFamily: '/fonts/msdf/Roboto-msdf.json',
        fontTexture: '/fonts/msdf/Roboto-msdf.png',
    });

    buttonTextObj = new ThreeMeshUI.Text({
        content: 'Solve Puzzle',
        fontSize: 0.2,
        fontColor: new THREE.Color(0x00ffff),
    });

    buttonBlock.add(buttonTextObj);
    buttonBlock.position.set(0, 0.5, 0);
    uiContainer.add(buttonBlock);

    // Create status text below button
    statusText = new ThreeMeshUI.Block({
        width: 2.5,
        height: 0.5,
        padding: 0.1,
        backgroundColor: new THREE.Color(0x000000),
        backgroundOpacity: 0.6,
        borderRadius: 0.1,
        justifyContent: 'center',
        alignContent: 'center',
        fontFamily: '/fonts/msdf/Roboto-msdf.json',
        fontTexture: '/fonts/msdf/Roboto-msdf.png',
    });

    statusTextObj = new ThreeMeshUI.Text({
        content: `Collectibles: 0/${REQUIRED_COLLECTIBLES}`,
        fontSize: 0.12,
        fontColor: new THREE.Color(0xff6b6b),
    });

    statusText.add(statusTextObj);
    statusText.position.set(0, -0.2, 0);
    uiContainer.add(statusText);

    // Update function to be called each frame
    function update() {
        if (buttonBlock) {
            ThreeMeshUI.update();
        }
    }

    // Update collected count
    function updateCollectedCount(count) {
        collectedCount = count;

        if (statusTextObj) {
            statusTextObj.set({
                content: `Collectibles: ${collectedCount}/${REQUIRED_COLLECTIBLES}`
            });

            // Change color based on progress
            if (collectedCount >= REQUIRED_COLLECTIBLES) {
                statusTextObj.set({
                    fontColor: new THREE.Color(0x00ff00)
                });
            } else {
                statusTextObj.set({
                    fontColor: new THREE.Color(0xff6b6b)
                });
            }
        }
    }

    // Check if player is near and handle interaction
    function checkPlayerInteraction(playerPosition, keyPressed = false) {
        if (!uiContainer || isUnlocked) return false;

        const distance = playerPosition.distanceTo(uiPosition);
        const INTERACTION_DISTANCE = 4;

        // Show/hide prompt based on distance
        if (distance <= INTERACTION_DISTANCE) {
            if (promptText) promptText.visible = true;

            // Handle E key press
            if (keyPressed) {
                if (collectedCount >= REQUIRED_COLLECTIBLES) {
                    if (!isPuzzleSolved) {
                        // Show puzzle
                        console.log('Opening matching puzzle...');
                        if (!matchingPuzzle) {
                            matchingPuzzle = createMatchingPuzzle(scene, () => {
                                // Puzzle completed callback
                                isPuzzleSolved = true;
                                console.log('Puzzle solved! Portal can now be unlocked.');

                                // Update button text to "Unlock Portal"
                                if (buttonTextObj) {
                                    buttonTextObj.set({
                                        content: 'Unlock Portal',
                                    });
                                }

                                // Update status text
                                if (statusTextObj) {
                                    statusTextObj.set({
                                        content: 'Puzzle solved! Press (E) to unlock',
                                        fontColor: new THREE.Color(0x00ff00),
                                    });
                                }
                            });
                        }
                        matchingPuzzle.show();
                        return false;
                    } else {
                        // Puzzle solved, unlock portal
                        isUnlocked = true;
                        console.log('Portal unlocked! All collectibles collected and puzzle solved.');

                        // Update button appearance
                        if (buttonBlock) {
                            buttonBlock.set({
                                backgroundColor: new THREE.Color(0x00ff00),
                                borderColor: new THREE.Color(0x00ff00),
                            });
                            if (buttonTextObj) {
                                buttonTextObj.set({
                                    content: 'Portal Unlocked!',
                                    fontColor: new THREE.Color(0x000000),
                                });
                            }
                        }

                        // Hide prompt
                        if (promptText) promptText.visible = false;

                        // Update status
                        if (statusTextObj) {
                            statusTextObj.set({
                                content: 'Ready to proceed!',
                                fontColor: new THREE.Color(0x00ff00),
                            });
                        }

                        // Call unlock callback
                        if (typeof onUnlock === 'function') {
                            onUnlock();
                        }

                        return true;
                    }
                } else {
                    // Not enough collectibles
                    console.log(`Cannot unlock portal. Need ${REQUIRED_COLLECTIBLES - collectedCount} more collectibles.`);

                    // Flash the status text
                    if (statusTextObj) {
                        const originalColor = new THREE.Color(0xff6b6b);
                        statusTextObj.set({
                            content: `Need ${REQUIRED_COLLECTIBLES - collectedCount} more collectibles!`,
                            fontColor: new THREE.Color(0xff0000),
                        });

                        setTimeout(() => {
                            if (statusTextObj) {
                                statusTextObj.set({
                                    content: `Collectibles: ${collectedCount}/${REQUIRED_COLLECTIBLES}`,
                                    fontColor: originalColor,
                                });
                            }
                        }, 2000);
                    }

                    return false;
                }
            }
        } else {
            if (promptText) promptText.visible = false;
        }

        return false;
    }

    // Cleanup
    function dispose() {
        if (matchingPuzzle) {
            matchingPuzzle.hide();
            matchingPuzzle = null;
        }
        if (uiContainer) {
            scene.remove(uiContainer);
            uiContainer = null;
        }
        buttonBlock = null;
        promptText = null;
        statusText = null;
    }

    // Get unlock status
    function getUnlockStatus() {
        return isUnlocked;
    }

    return {
        update,
        updateCollectedCount,
        checkPlayerInteraction,
        dispose,
        getUnlockStatus,
    };
}
