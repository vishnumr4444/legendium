import * as THREE from 'three';
// Removed direct GLTFLoader import since we'll use the asset system

// Platform types
const PLATFORM_TYPES = {
    STATIC: 'static',
    HORIZONTAL: 'horizontal',
    VERTICAL: 'vertical',
    TEMPORARY: 'temporary'
};

// Scale for stonePath instanced meshes
const STONE_PATH_SCALE = new THREE.Vector3(0.8, 1, 0.8);

export function createFloatingIslandSystem(scene, player, allAssets) {
    let island = null;
    let platforms = [];
    let platformColliders = []; // To store references to platform colliders
    let stonePathInstancedMesh = null; // GPU instanced mesh for stonePath models
    let platformInstanceMatrices = []; // Store instance matrices for updates

    console.log('Initializing floating island system');

    // Create platform geometry (thin but wide/long)
    const platformGeometry = new THREE.BoxGeometry(3, 0.2, 1.5);
    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        metalness: 0.3,
        roughness: 0.7
    });

    // Create platforms to reach the island
    createPlatforms();

    function createPlatforms() {
        // Platform positions and types
        const platformConfigs = [
            // Starting platforms (static)
            { position: new THREE.Vector3(-11, 10, 12), type: PLATFORM_TYPES.STATIC },
            { position: new THREE.Vector3(-13, 11, 14), type: PLATFORM_TYPES.STATIC },
            { position: new THREE.Vector3(-12, 12, 16), type: PLATFORM_TYPES.STATIC },

            // Moving platforms
            { position: new THREE.Vector3(-13, 13, 18), type: PLATFORM_TYPES.HORIZONTAL },
            { position: new THREE.Vector3(-13, 14, 20), type: PLATFORM_TYPES.VERTICAL },
            { position: new THREE.Vector3(-13, 15, 22), type: PLATFORM_TYPES.HORIZONTAL },

            // Temporary platforms
            { position: new THREE.Vector3(-13, 16, 24), type: PLATFORM_TYPES.TEMPORARY },
            { position: new THREE.Vector3(-13, 17, 26), type: PLATFORM_TYPES.TEMPORARY },

            // Final platforms leading to island
            { position: new THREE.Vector3(-13, 18, 28), type: PLATFORM_TYPES.STATIC },
            { position: new THREE.Vector3(-13, 19, 30), type: PLATFORM_TYPES.HORIZONTAL }
        ];

        // Initialize stonePath GPU instancing if model is available
        if (allAssets?.models?.gltf?.stonePath) {
            setupStonePathInstancing(platformConfigs);
        } else {
            console.warn('stonePath model not found in assets, skipping GPU instancing');
        }

        platformConfigs.forEach((config, index) => {
            // Create a parent group for the platform
            // This group will be positioned and moved, ensuring the origin is at the platform's center
            const platformGroup = new THREE.Group();
            platformGroup.position.copy(config.position);

            // Create the platform mesh as a child of the group
            const platform = new THREE.Mesh(platformGeometry, platformMaterial.clone());
            // Color-code different platform types
            switch (config.type) {
                case PLATFORM_TYPES.HORIZONTAL:
                    platform.material.color.set(0xff7f00); // Orange for horizontal
                    break;
                case PLATFORM_TYPES.VERTICAL:
                    platform.material.color.set(0x00ff00); // Green for vertical
                    break;
                case PLATFORM_TYPES.TEMPORARY:
                    platform.material.color.set(0xff0000); // Red for temporary
                    platform.material.emissive.set(0x440000);
                    platform.material.emissiveIntensity = 0.5;
                    break;
                default:
                    platform.material.color.set(0x8B4513); // Brown for static
            }

            // Store userData on the group (parent)
            platformGroup.userData = {
                type: config.type,
                originalPosition: config.position.clone(),
                isActive: true,
                toggleInterval: 2000, // 2 seconds for temporary platforms
                platformMesh: platform // Reference to the actual mesh for material changes
            };

            // Make the platform mesh invisible (we'll use the stonePath model instead)
            platform.visible = false;

            // Add the mesh to the group
            platformGroup.add(platform);

            // Add the group to the scene
            scene.add(platformGroup);
            platforms.push(platformGroup);

            // Add collider for the platform (using the mesh, not the group)
            platformColliders.push({
                mesh: platform,
                collider: null
            });
        });

        console.log('Created', platforms.length, 'platforms');
    }

    function setupStonePathInstancing(platformConfigs) {
        try {
            const stonePathModel = allAssets.models.gltf.stonePath;

            // Clone the model to get its geometry and materials
            let combinedGeometry = null;
            let modelMaterial = null;

            stonePathModel.traverse((child) => {
                if (child.isMesh) {
                    if (!combinedGeometry) {
                        // Use the first mesh's geometry as the base
                        combinedGeometry = child.geometry.clone();
                        modelMaterial = child.material;
                    }
                }
            });

            if (!combinedGeometry) {
                console.warn('No mesh geometry found in stonePath model');
                return;
            }

            // Create InstancedMesh - one instance per platform
            const instanceCount = platformConfigs.length;
            stonePathInstancedMesh = new THREE.InstancedMesh(
                combinedGeometry,
                modelMaterial,
                instanceCount
            );
            stonePathInstancedMesh.castShadow = true;
            stonePathInstancedMesh.receiveShadow = true;

            // Set up instance matrices for each platform
            platformInstanceMatrices = new Array(instanceCount);
            const matrix = new THREE.Matrix4();

            platformConfigs.forEach((config, index) => {
                matrix.identity();
                // Position each instance at the platform location
                matrix.setPosition(config.position.x, config.position.y, config.position.z);
                // Apply scale to fit on platform
                matrix.scale(STONE_PATH_SCALE);

                stonePathInstancedMesh.setMatrixAt(index, matrix);
                platformInstanceMatrices[index] = matrix.clone();
            });

            // Update the instance buffer
            stonePathInstancedMesh.instanceMatrix.needsUpdate = true;

            // Add to scene
            scene.add(stonePathInstancedMesh);
            console.log('GPU instanced stonePath mesh created with', instanceCount, 'instances');
        } catch (error) {
            console.error('Error setting up stonePath GPU instancing:', error);
        }
    }

    function updatePlatforms(deltaTime, elapsedTime) {
        platforms.forEach((platformGroup, index) => {
            const oldPosition = platformGroup.position.clone();

            switch (platformGroup.userData.type) {
                case PLATFORM_TYPES.HORIZONTAL:
                    // Move left and right
                    platformGroup.position.x = platformGroup.userData.originalPosition.x + Math.sin(elapsedTime * 2) * 3;
                    break;

                case PLATFORM_TYPES.VERTICAL:
                    // Move up and down
                    platformGroup.position.y = platformGroup.userData.originalPosition.y + Math.sin(elapsedTime * 1.5) * 2;
                    break;

                case PLATFORM_TYPES.TEMPORARY:
                    // Temporary platforms are static
                    break;
            }

            // Calculate velocity
            if (deltaTime > 0) {
                const velocity = new THREE.Vector3()
                    .subVectors(platformGroup.position, oldPosition)
                    .divideScalar(deltaTime);

                if (!platformGroup.userData.velocity) {
                    platformGroup.userData.velocity = new THREE.Vector3();
                }
                platformGroup.userData.velocity.copy(velocity);
            }

            // Update instanced mesh if available
            if (stonePathInstancedMesh && platformInstanceMatrices[index]) {
                const matrix = platformInstanceMatrices[index];
                matrix.identity();
                matrix.setPosition(
                    platformGroup.position.x,
                    platformGroup.position.y,
                    platformGroup.position.z
                );
                matrix.scale(STONE_PATH_SCALE);
                stonePathInstancedMesh.setMatrixAt(index, matrix);
            }

            // Update collider position if it exists
            if (platformColliders[index] && platformColliders[index].collider) {
                // Update the collider position to match the platform
                // This would typically be done through the playerController's updateColliderPosition function
                // For now, we'll just note that it needs to be updated
            }
        });

        // Update instanced mesh buffer if any instance was modified
        if (stonePathInstancedMesh) {
            stonePathInstancedMesh.instanceMatrix.needsUpdate = true;
        }
    }

    // Function to initialize platform colliders
    function initializeColliders(addColliderFunction, updateColliderPositionFunction) {
        platformColliders.forEach((platformCollider, index) => {
            const platformGroup = platforms[index];
            if (platformGroup) {
                // Add collider for the platform mesh using the playerController's addCollider function
                platformCollider.collider = addColliderFunction(`platform_${index}`, platformCollider.mesh);
                if (platformCollider.collider) {
                    platformCollider.collider.visible = false;
                }
            }
        });
    }

    // Function to update collider positions
    function updateColliderPositions(updateColliderPositionFunction) {
        platformColliders.forEach((platformCollider, index) => {
            const platformGroup = platforms[index];
            if (platformGroup && platformCollider.collider) {
                // Update the collider position to match the platform group's world position
                // Get world position of the platform mesh
                const worldPosition = new THREE.Vector3();
                platformCollider.mesh.getWorldPosition(worldPosition);

                // Platforms don't rotate (only the mesh inside the group rotates), so we pass null for rotation
                updateColliderPositionFunction(`platform_${index}`, worldPosition, null);

                // Update collider velocity from platform group
                if (platformGroup.userData.velocity) {
                    if (!platformCollider.collider.userData.velocity) {
                        platformCollider.collider.userData.velocity = new THREE.Vector3();
                    }
                    platformCollider.collider.userData.velocity.copy(platformGroup.userData.velocity);
                }
            }
        });
    }

    // Function to cleanup GPU instanced mesh and platform resources
    function cleanup() {
        // Dispose of the instanced mesh geometry and materials
        if (stonePathInstancedMesh) {
            try {
                if (stonePathInstancedMesh.geometry) {
                    stonePathInstancedMesh.geometry.dispose();
                }
                if (stonePathInstancedMesh.material) {
                    if (Array.isArray(stonePathInstancedMesh.material)) {
                        stonePathInstancedMesh.material.forEach(mat => mat.dispose());
                    } else {
                        stonePathInstancedMesh.material.dispose();
                    }
                }
                scene.remove(stonePathInstancedMesh);
                stonePathInstancedMesh = null;
            } catch (error) {
                console.error('Error disposing instanced mesh:', error);
            }
        }

        // Clear platform references
        platformInstanceMatrices = [];
        platforms = [];
        platformColliders = [];
    }

    return {
        update: updatePlatforms,
        getIsland: () => island,
        getPlatforms: () => platforms,
        initializeColliders: initializeColliders,
        updateColliderPositions: updateColliderPositions,
        cleanup: cleanup,
        getStonePathInstancedMesh: () => stonePathInstancedMesh
    };
}