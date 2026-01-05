import * as THREE from 'three';
import { createShaderBall } from './shader.js';

/**
 * Collectible drop + pickup system for Scene 1.
 *
 * This module spawns and manages small collectible items that the player can pick up:
 * - `lifeToken`: restores health (handled by caller via callback)
 * - `spellOrb`: restores spell energy (handled by caller via callback)
 * - `treasure`: a larger "shader ball" collectible that represents an educational item
 *
 * The system is intentionally split into two phases:
 * - `update(deltaTime, elapsedTime)`: advances physics (gravity, collisions), rotation and bobbing.
 * - `checkCollection(playerPosition, collectionRadius, onCollect)`: detects pickups and triggers
 *   a collection animation + cleanup.
 *
 * Collision strategy:
 * - If `options.colliders` is provided, the code uses a downward `THREE.Raycaster` probe to find
 *   the surface Y and snap the collectible to it.
 * - If no colliders are provided, a simple `groundY` fallback is used.
 *
 * Collection rules:
 * - Items must be `onGround === true` before they can be collected.
 * - Items cannot be collected for `COLLECTION_DELAY_MS` after spawn to avoid instant pickup
 *   while they are still popping out / bouncing.
 *
 * @param {THREE.Scene} scene - The scene to add collectibles to
 * @param {THREE.Vector3} origin - The position where collectibles spawn from
 * @param {THREE.WebGLRenderer} renderer - The WebGL renderer for shader ball reflections
 * @param {Object} controls - OrbitControls for reflection updates (optional)
 * @param {Object} options - Configuration options
 * @param {THREE.Object3D[]} [options.colliders] - Meshes to use for collision checks
 * @returns {Object} API for managing collectibles
 */
export function createCollectibleDrop(scene, origin, renderer, controls = null, options = {}) {
    // -----------------------------
    // Tunable spawn/physics options
    // -----------------------------
    const count = options.count ?? 8; // total number of small collectibles (life tokens + spell orbs)
    const spellOrbRatio = options.spellOrbRatio ?? 0.4; // fraction of small collectibles that become spell orbs
    const radius = options.radius ?? 0.15; // radius for small collectibles
    const treasureRadius = options.treasureRadius ?? 0.5; // radius for the special shader-ball treasure
    const lifeColor = options.lifeColor ?? 0xffd700; // golden yellow for life tokens
    const spellColor = options.spellColor ?? 0x00aaff; // cyan blue for spell orbs
    const spreadAngle = options.spreadAngle ?? Math.PI * 2; // full 360 degrees
    const minSpeed = options.minSpeed ?? 3; // minimum initial velocity
    const maxSpeed = options.maxSpeed ?? 6; // maximum initial velocity
    const upwardBias = options.upwardBias ?? 5; // how much upward force
    const gravity = options.gravity ?? -15; // gravity acceleration
    const bounceRestitution = options.bounceRestitution ?? 0.4; // bounce dampening (currently not used; legacy knob)
    const groundY = options.groundY ?? 0; // fallback ground level if no collision
    const glowIntensity = options.glowIntensity ?? 1.2; // emissive glow for collectibles
    // New option to make treasures stationary
    const isStationary = options.isStationary ?? false;
    const colliderMeshes = Array.isArray(options.colliders)
        ? options.colliders.filter((obj) => obj && obj.isObject3D)
        : [];
    const hasMeshColliders = colliderMeshes.length > 0;
    const colliderRaycaster = hasMeshColliders ? new THREE.Raycaster() : null;
    const downVector = new THREE.Vector3(0, -1, 0);
    const colliderOrigin = new THREE.Vector3();
    const colliderSkinWidth = options.colliderSkinWidth ?? 0.05;
    const colliderProbeDistance = options.colliderProbeDistance ?? 8;

    const collectibles = [];
    let isActive = true;

    // Spawn collectibles (mix of life tokens and spell orbs) only if count > 0
    if (count > 0) {
        const spellOrbCount = Math.floor(count * spellOrbRatio);
        const lifeTokenCount = count - spellOrbCount;

        // Create an array to shuffle types for random distribution
        const types = [];
        for (let i = 0; i < lifeTokenCount; i++) types.push('lifeToken');
        for (let i = 0; i < spellOrbCount; i++) types.push('spellOrb');
        // Shuffle array
        for (let i = types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [types[i], types[j]] = [types[j], types[i]];
        }

        for (let i = 0; i < count; i++) {
            // Random angle for spread pattern
            const angle = (spreadAngle / count) * i + (Math.random() - 0.5) * 0.3;
            const horizontalSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);

            // Initial velocity with parabolic trajectory
            const velocity = new THREE.Vector3(
                Math.cos(angle) * horizontalSpeed,
                upwardBias + Math.random() * 2, // random upward variation
                Math.sin(angle) * horizontalSpeed
            );

            // Determine type and color
            const type = types[i];
            const isSpellOrb = type === 'spellOrb';
            const orbColor = isSpellOrb ? spellColor : lifeColor;

            // Create glowing sphere
            const geometry = new THREE.SphereGeometry(radius, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: orbColor,
                emissive: orbColor,
                emissiveIntensity: isSpellOrb ? glowIntensity * 1.3 : glowIntensity, // Spell orbs glow brighter
                metalness: isSpellOrb ? 0.8 : 0.7,
                roughness: isSpellOrb ? 0.1 : 0.2 // Spell orbs are shinier
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.copy(origin);
            sphere.castShadow = true;
            sphere.receiveShadow = true;
            sphere.userData.isCollectible = true;
            sphere.userData.collectibleType = type;

            scene.add(sphere);

            // Store collectible data
            collectibles.push({
                mesh: sphere,
                velocity: velocity,
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8
                ),
                onGround: false,
                collected: false,
                type: type,
                spawnTime: performance.now() // Track spawn time
            });
        }
    }

    // ---------------------------------------------------------
    // Treasure spawn: one shader-ball "educational" collectible.
    // ---------------------------------------------------------
    // We always create one treasure even when `count === 0` so the caller can
    // use this helper for "stationary treasures" (e.g. placed on the island).
    const treasureAngle = Math.random() * Math.PI * 2;
    const treasureSpeed = maxSpeed * 1.2; // Goes further
    let treasureVelocity = new THREE.Vector3(
        Math.cos(treasureAngle) * treasureSpeed,
        upwardBias * 1.5, // Goes higher
        Math.sin(treasureAngle) * treasureSpeed
    );

    // If stationary, set velocity to zero
    if (isStationary) {
        treasureVelocity = new THREE.Vector3(0, 0, 0);
    }

    const shaderBall = createShaderBall({
        scene,
        renderer,
        controls: null, // Disable reflections for performance
        position: origin.clone(),
        radius: treasureRadius,
        widthSegments: 24, // Higher quality for the special treasure
        heightSegments: 24
    });

    const treasureSphere = shaderBall.mesh;
    treasureSphere.castShadow = true;
    treasureSphere.receiveShadow = true;
    treasureSphere.userData.isCollectible = true;
    treasureSphere.userData.collectibleType = 'treasure';
    // Add treasure type identification
    if (options.treasureType) {
        treasureSphere.userData.treasureType = options.treasureType;
    }

    // Store treasure data
    const treasureType = treasureSphere.userData.treasureType || options.treasureType || 'led';

    const treasureData = {
        mesh: treasureSphere,
        shaderBall: shaderBall,
        velocity: treasureVelocity,
        rotationSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ),
        onGround: isStationary, // If stationary, mark as on ground immediately
        collected: false,
        type: 'treasure',
        treasureType,
        spawnTime: performance.now() // Track spawn time
    };

    // If stationary, set slower rotation
    if (isStationary) {
        treasureData.rotationSpeed.set(0, 0.5, 0); // Slow Y rotation
        treasureData.isStationary = true; // Mark as stationary
    }

    collectibles.push(treasureData);

    // NEW: Create a second treasure (switch) when creating treasures from enemy defeat
    // Only create the second treasure if this is a regular enemy drop (not stationary treasures)
    if (!isStationary && count > 0) {
        const switchAngle = Math.random() * Math.PI * 2;
        const switchSpeed = maxSpeed * 1.3; // Goes even further
        const switchVelocity = new THREE.Vector3(
            Math.cos(switchAngle) * switchSpeed,
            upwardBias * 1.6, // Goes even higher
            Math.sin(switchAngle) * switchSpeed
        );

        const switchShaderBall = createShaderBall({
            scene,
            renderer,
            controls: null, // Disable reflections for performance
            position: origin.clone(),
            radius: treasureRadius,
            widthSegments: 24, // Higher quality for the special treasure
            heightSegments: 24
        });

        const switchTreasureSphere = switchShaderBall.mesh;
        switchTreasureSphere.castShadow = true;
        switchTreasureSphere.receiveShadow = true;
        switchTreasureSphere.userData.isCollectible = true;
        switchTreasureSphere.userData.collectibleType = 'treasure';
        switchTreasureSphere.userData.treasureType = 'switch'; // Mark as switch treasure

        // Store switch treasure data
        const switchTreasureData = {
            mesh: switchTreasureSphere,
            shaderBall: switchShaderBall,
            velocity: switchVelocity,
            rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ),
            onGround: false,
            collected: false,
            type: 'treasure',
            treasureType: 'switch',
            spawnTime: performance.now() // Track spawn time
        };

        collectibles.push(switchTreasureData);
    }

    /**
     * Advances physics + visuals for all spawned collectibles.
     *
     * @param {number} deltaTime - Frame delta in seconds.
     * @param {number} [elapsedTime=0] - Total elapsed time in seconds (used for shader animation).
     */
    function update(deltaTime, elapsedTime = 0) {
        if (!isActive) return;

        const now = performance.now();

        for (let i = collectibles.length - 1; i >= 0; i--) {
            const item = collectibles[i];

            if (item.collected) continue;
            const isStationaryItem = !!item.isStationary;

            // Update shader ball animation for treasure only
            if (item.type === 'treasure' && item.shaderBall && item.shaderBall.uniforms && item.shaderBall.uniforms.iTime) {
                item.shaderBall.uniforms.iTime.value = elapsedTime;
            }

            if (!isStationaryItem) {
                // Apply gravity
                item.velocity.y += gravity * deltaTime;

                // Update position
                item.mesh.position.addScaledVector(item.velocity, deltaTime);

                // Collide with garden geometry if available
                let collidedWithMesh = false;
                if (colliderRaycaster && !item.onGround) {
                    const itemRadius = item.type === 'treasure' ? treasureRadius : radius;
                    colliderOrigin.copy(item.mesh.position);
                    colliderOrigin.y += itemRadius + colliderSkinWidth;
                    colliderRaycaster.set(colliderOrigin, downVector);
                    colliderRaycaster.far = itemRadius + colliderProbeDistance;
                    const intersections = colliderRaycaster.intersectObjects(colliderMeshes, true);
                    if (intersections.length) {
                        const surfaceY = intersections[0].point.y + itemRadius;
                        if (item.mesh.position.y <= surfaceY) {
                            item.mesh.position.y = surfaceY;
                            item.velocity.set(0, 0, 0);
                            item.onGround = true;
                            collidedWithMesh = true;
                        }
                    }
                }

                // Simple ground detection - when item falls below groundY, stop it
                if (!collidedWithMesh && item.mesh.position.y <= groundY + (item.type === 'treasure' ? treasureRadius : radius)) {
                    item.mesh.position.y = groundY + (item.type === 'treasure' ? treasureRadius : radius);
                    item.velocity.set(0, 0, 0);
                    item.onGround = true;
                }
            } else if (item.originalY === undefined) {
                item.originalY = item.mesh.position.y;
            }

            // Rotation for visual interest
            item.mesh.rotation.x += item.rotationSpeed.x * deltaTime;
            item.mesh.rotation.y += item.rotationSpeed.y * deltaTime;
            item.mesh.rotation.z += item.rotationSpeed.z * deltaTime;

            // Extra pulsing glow for spell orbs
            if (item.type === 'spellOrb' && item.mesh.material) {
                const pulse = Math.sin(now * 0.005) * 0.3 + 1.0;
                item.mesh.material.emissiveIntensity = 1.3 * pulse;
            }

            // Gentle bobbing when on ground
            if (item.onGround || isStationaryItem) {
                const hoverAmount = Math.sin(now * 0.003 + i) * 0.02;
                // Keep the original Y position as base and just add hover effect
                if (item.originalY === undefined) {
                    item.originalY = item.mesh.position.y;
                }
                item.mesh.position.y = item.originalY + hoverAmount;
            }
        }
    }

    /**
     * Checks player proximity and triggers collection when in range.
     *
     * Notes:
     * - Only items that have landed (`onGround`) and have lived at least
     *   `COLLECTION_DELAY_MS` are eligible.
     * - When collected, we play a short scale+fade animation, then dispose
     *   the underlying mesh/shader resources.
     *
     * @param {THREE.Vector3} playerPosition - Player world position.
     * @param {number} [collectionRadius=1.0] - Base pickup radius (treasure expands this).
     * @param {(item:Object)=>void} [onCollect=null] - Callback invoked with the collected item descriptor.
     */
    function checkCollection(playerPosition, collectionRadius = 1.0, onCollect = null) {
        const now = performance.now();
        const COLLECTION_DELAY_MS = 1000; // 1 second delay before collection is allowed

        for (const item of collectibles) {
            if (item.collected) continue;

            // PERFORMANCE-FRIENDLY CHECK:
            // 1. Must be on ground (calculated in update loop, so O(1) here)
            // 2. Must have passed delay time (simple subtraction)
            if (!item.onGround) continue;
            if (now - item.spawnTime < COLLECTION_DELAY_MS) continue;

            // Scale collection radius based on collectible size (treasure is bigger)
            const effectiveRadius = item.type === 'treasure'
                ? collectionRadius + treasureRadius * 0.8 // Larger collection area for treasure
                : collectionRadius;

            const distance = item.mesh.position.distanceTo(playerPosition);
            if (distance <= effectiveRadius) {
                item.collected = true;

                // Trigger collection callback with type info
                if (typeof onCollect === 'function') {
                    onCollect(item);
                }

                // Animate collection (scale up and fade out)
                const startTime = performance.now();
                const animateDuration = 400;

                const animateCollection = () => {
                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(1, elapsed / animateDuration);
                    const easeOut = 1 - Math.pow(1 - progress, 3);

                    const scale = 1 + easeOut * 1.5;
                    item.mesh.scale.set(scale, scale, scale);

                    // Fade out material
                    if (item.shaderBall && item.shaderBall.uniforms) {
                        // Reduce opacity via shader if possible, or hide mesh
                        item.mesh.material.opacity = 1 - easeOut;
                    } else if (item.mesh.material) {
                        item.mesh.material.opacity = 1 - easeOut;
                        item.mesh.material.transparent = true;
                    }

                    if (progress < 1) {
                        requestAnimationFrame(animateCollection);
                    } else {
                        // Remove from scene and dispose
                        if (item.type === 'treasure' && item.shaderBall && typeof item.shaderBall.dispose === 'function') {
                            item.shaderBall.dispose();
                        } else if (item.type === 'lifeToken' || item.type === 'spellOrb') {
                            item.mesh.geometry.dispose();
                            item.mesh.material.dispose();
                        }
                        if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
                    }
                };

                animateCollection();
            }
        }
    }

    /**
     * Disposes all remaining collectibles and removes them from the scene.
     *
     * Call this when leaving Scene 1 or resetting systems.
     */
    function dispose() {
        isActive = false;
        for (const item of collectibles) {
            if (item.type === 'treasure' && item.shaderBall && typeof item.shaderBall.dispose === 'function') {
                item.shaderBall.dispose();
            } else if (item.type === 'lifeToken' || item.type === 'spellOrb') {
                item.mesh.geometry.dispose();
                item.mesh.material.dispose();
            }
            if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
        }
        collectibles.length = 0;
    }

    return {
        update,
        checkCollection,
        dispose,
        getCollectibles: () => collectibles,
        getActiveCount: () => collectibles.filter(c => !c.collected).length
    };
}
