/**
 * ============================================
 * VR RAYCASTER MODULE
 * ============================================
 * Implements raycast-based selection for VR controllers.
 * Allows players to click/select objects in VR space.
 * 
 * Features:
 * - Dual controller raycasting
 * - Visual ray lines for debugging
 * - Clickable object detection
 * - Component model support
 * - Mesh UI panel support
 * - Event-based interaction callbacks
 * - Recursive parent search for onClick handlers
 * 
 * Raycasting System:
 * - Each controller projects a ray forward
 * - Rays detect intersections with clickable objects
 * - Callback execution on selection
 * - Supports component meshes and UI panels
 * 
 * Debugging:
 * - Visible red lines showing ray direction
 * - Console logging for intersections
 * - Parent traversal logging
 */

import * as THREE from 'three';

let raycaster, tempMatrix;
let controller1, controller2;
let rayLine1, rayLine2;
let isInitialized = false;

export function setupVRRaycaster(scene, renderer, clickableObjects, onButtonClick) {
    raycaster = new THREE.Raycaster();
    tempMatrix = new THREE.Matrix4();

    // Create visible rays for debugging
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -5)  // Extend the ray to 5 units long
    ]);
    const material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 5  // Increase line width for better visibility
    });

    rayLine1 = new THREE.Line(geometry, material);
    rayLine2 = new THREE.Line(geometry, material);

    // Initialize controllers and add event listeners
    function initializeControllers() {
        try {
            controller1 = renderer.xr.getController(0);
            controller2 = renderer.xr.getController(1);

            if (controller1 && controller2) {
                controller1.addEventListener('select', onSelect);
                controller2.addEventListener('select', onSelect);

                scene.add(controller1);
                scene.add(controller2);

                controller1.add(rayLine1);
                controller2.add(rayLine2);
                
                isInitialized = true;
                console.log('VR Controllers initialized successfully');
            } else {
                console.warn('VR Controllers not available yet');
                requestAnimationFrame(initializeControllers);
            }
        } catch (error) {
            console.error('Error initializing VR controllers:', error);
            requestAnimationFrame(initializeControllers);
        }
    }

    // Try to initialize controllers immediately
    initializeControllers();

    function onSelect(event) {
        const controller = event.target;

        if (!controller || !controller.matrixWorld) return;

        tempMatrix.identity().extractRotation(controller.matrixWorld);

        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        try {
            // Create a comprehensive list of objects to check
            let objectsToCheck = [...clickableObjects];
            
            // Also check for global VR clickable objects (for mesh UI panels)
            if (window.vrClickableObjects && Array.isArray(window.vrClickableObjects)) {
                objectsToCheck = [...objectsToCheck, ...window.vrClickableObjects];
            }
            
            // For component models, also check their child meshes
            objectsToCheck.forEach(obj => {
                if (obj.userData && obj.userData.componentKey) {
                    // This is a component model, add all its child meshes
                    obj.traverse(child => {
                        if (child.isMesh) {
                            objectsToCheck.push(child);
                        }
                    });
                }
            });

            const intersects = raycaster.intersectObjects(objectsToCheck, true);
            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                console.log('VR Intersection detected:', clickedObject.name);
                
                // Find the parent object that has the onClick handler
                let targetObject = clickedObject;
                while (targetObject && !targetObject.userData?.onClick) {
                    targetObject = targetObject.parent;
                }
                
                if (targetObject && targetObject.userData && targetObject.userData.onClick) {
                    targetObject.userData.onClick();
                } else if (onButtonClick) {
                    onButtonClick(clickedObject);
                }
            } else {
                console.log('No VR intersection detected');
            }
        } catch (error) {
            console.error('Error in VR onSelect:', error);
        }
    }
}

export function updateVRRaycaster(clickableObjects) {
    if (!isInitialized || !controller1 || !controller2) return;

    // Ensure clickableObjects is an array and contains valid objects
    if (!Array.isArray(clickableObjects) || clickableObjects.length === 0) {
        return;
    }

    // Filter out invalid objects and ensure they have layers
    const validObjects = clickableObjects.filter(obj => {
        if (!obj || !obj.layers) {
            return false;
        }
        // Ensure object has a valid layer mask
        if (!obj.layers.mask) {
            obj.layers.mask = 1; // Set default layer mask if missing
        }
        return true;
    });

    if (validObjects.length === 0) {
        return;
    }

    // Also check for global VR clickable objects (for mesh UI panels)
    let allObjectsToCheck = [...validObjects];
    if (window.vrClickableObjects && Array.isArray(window.vrClickableObjects)) {
        allObjectsToCheck = [...allObjectsToCheck, ...window.vrClickableObjects];
    }

    [controller1, controller2].forEach(controller => {
        try {
            if (!controller || !controller.matrixWorld) return;

            tempMatrix.identity().extractRotation(controller.matrixWorld);

            raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

            // Set raycaster layers to match objects
            raycaster.layers.mask = 1; // Use default layer

            // Create a comprehensive list of objects to check
            let objectsToCheck = [...allObjectsToCheck];
            
            // For component models, also check their child meshes
            allObjectsToCheck.forEach(obj => {
                if (obj.userData && obj.userData.componentKey) {
                    // This is a component model, add all its child meshes
                    obj.traverse(child => {
                        if (child.isMesh) {
                            objectsToCheck.push(child);
                        }
                    });
                }
            });

            const intersects = raycaster.intersectObjects(objectsToCheck, true);

            if (intersects.length > 0) {
                if (controller.children && controller.children.length > 0) {
                    const rayLine = controller.children[0];
                    if (rayLine && rayLine.material) {
                        rayLine.material.color.setHex(0x00ff00);
                        // Add a subtle glow effect for better visibility
                        rayLine.material.opacity = 0.8;
                    }
                }
                console.log('VR Ray intersecting with:', intersects[0].object.name);
            } else {
                if (controller.children && controller.children.length > 0) {
                    const rayLine = controller.children[0];
                    if (rayLine && rayLine.material) {
                        rayLine.material.color.setHex(0xff0000);
                        rayLine.material.opacity = 0.5;
                    }
                }
            }
        } catch (error) {
            console.error('Error updating VR raycaster:', error);
        }
    });
}
