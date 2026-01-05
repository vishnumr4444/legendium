import * as THREE from 'three';
import { BatchedParticleRenderer, QuarksUtil } from 'three.quarks';
import { allAssets } from "../commonFiles/assetsLoader.js";

export function createEnemy(scene, position = new THREE.Vector3(0, 0, 0)) {
    let enemyModel = null;
    let isAnimating = false;
    let animationStartTime = 0;
    let isVisible = false; // Track if enemy is currently visible
    const animationDuration = 1.5; // 1.5 seconds for the animation
    const initialScale = 0.01; // Single scale value for consistency
    const finalScale = 1.5;

    // Particle effects
    let appearEffect = null;
    let disappearEffect = null;
    let quarksRenderer = null;
    let effectDuration = 0;
    let effectStartTime = 0;
    let isEffectPlaying = false;
    // Enemy spell projectile (spellBall)
    let spellBallTemplate = null;
    let spellBallTemplateLoaded = false;
    let enemyTrailTemplate = null;
    let enemyTrailTemplateLoaded = false;
    // On-hit effect
    let onHitTemplate = null;
    let onHitTemplateLoaded = false;
    // Point system reference (for enemy health bar visibility)
    let pointSystemRef = null;
    const enemyProjectiles = [];
    const ENEMY_PROJECTILE_SPEED = 15; // Increased from 12 m/s for faster projectiles
    const ENEMY_PROJECTILE_ARC_HEIGHT = 0.5; // Reduced from 0.8 for flatter, more direct shots
    let lastCastAtSec = 0;
    let castCooldownSec = 1.2; // Reduced from 1.8 for more frequent attacks

    // Hitscan improvements
    const LEAD_PREDICTION_ENABLED = true; // predict player movement
    const BASE_ACCURACY = 0.95; // Increased from 0.85 to 95% base accuracy at close range
    const ACCURACY_FALLOFF_START = 3; // Reduced from 5 - accuracy starts degrading closer
    const ACCURACY_FALLOFF_END = 12; // Reduced from 15 - max range where accuracy is worst
    const MIN_ACCURACY = 0.65; // Increased from 0.45 - minimum 65% accuracy at max range

    // Trigger area system
    let triggerArea = null; // static trigger at spawn/guard center
    let dynamicTriggerArea = null; // follows enemy model
    let dynamicTriggerLocked = false; // when player enters, lock the dynamic area in place
    let dynamicTriggerLockCenter = null; // center where dynamic trigger locked
    let triggerRadius = 8; // radius of the trigger area
    let isPlayerInTrigger = false;
    let player = null; // reference to player object
    let rayLine = null; // ray from enemy to player
    let rayTimeoutId = null;
    const rayOriginYOffset = 0.9; // vertical offset for ray origin from enemy
    const rayOriginXOffset = -0.45; // horizontal X offset for ray origin from enemy
    const rayOriginZOffset = 0.6; // forward/back Z offset for ray origin from enemy
    let lastRayEnd = null; // store last aimed endpoint so casts match the ray

    // Bobbing (always on)
    const baseY = position.y;
    const bobAmplitude = 0.1;   // meters
    const bobSpeedHz = 0.5;      // cycles per second
    let lastUpdateTime = performance.now() * 0.001;
    let isDefeated = false; // once true, enemy never reappears

    // Combat blink (disappear/appear while player is inside trigger)
    let combatBlinkActive = false;
    let nextBlinkAtSec = 0; // epoch seconds when next toggle should occur

    // Random wandering (inside trigger area)
    const originalWanderCenter = position.clone();
    let wanderCenter = originalWanderCenter.clone();
    let wanderRadius = Math.max(0.1, triggerRadius * 0.9);
    const wanderSpeed = 1.0; // m/s
    let wanderTarget = null; // THREE.Vector3
    let wanderRetargetAt = 0; // epoch seconds
    let shouldAutoSpawn = false;

    // Load the enemy model - modified to use asset loader
    // Remove the direct GLTFLoader usage
    // Instead, access the pre-loaded enemy model from allAssets
    function initializeEnemy() {
        // Check if enemy model is available in allAssets
        if (allAssets.models.gltf.enemy) {
            enemyModel = allAssets.models.gltf.enemy.clone();

            // Set up the model properties
            enemyModel.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Initial state - invisible and scaled down
            enemyModel.visible = false;
            enemyModel.scale.set(initialScale, initialScale, initialScale);
            enemyModel.position.copy(position);
            enemyModel.rotation.set(0, 0, 0);

            scene.add(enemyModel);

            // Initialize particle effects after model loads
            initializeParticleEffects();

            // Initialize trigger area after model loads
            initializeTriggerArea();

            // Set flag to auto-spawn when point system is available
            shouldAutoSpawn = true;
        } else {
            console.error("Enemy model not found in allAssets. Make sure it's defined in assetsEntry.js");
        }
    }

    // Call initializeEnemy instead of direct loading
    initializeEnemy();

    // Store whether we should auto-spawn when point system is set


    // Initialize particle effects - modified to use pre-loaded JSON files
    function initializeParticleEffects() {
        // Create batched renderer for Quarks particle systems
        quarksRenderer = new BatchedParticleRenderer();
        scene.add(quarksRenderer);

        // Access pre-loaded JSON files from allAssets instead of loading directly
        if (allAssets.vfxs.appear) {
            appearEffect = allAssets.vfxs.appear.clone ? allAssets.vfxs.appear.clone(true) : allAssets.vfxs.appear;
            appearEffect.position.copy(position);
            appearEffect.visible = false;

            if (appearEffect.registerBatchedRenderer) {
                appearEffect.registerBatchedRenderer(quarksRenderer);
            }
            QuarksUtil.addToBatchRenderer(appearEffect, quarksRenderer);

            // Configure appear effect
            if (QuarksUtil.runOnAllParticleEmitters) {
                QuarksUtil.runOnAllParticleEmitters(appearEffect, (ps) => {
                    ps.system.looping = false;
                    ps.system.autoDestroy = false;
                });
            }

            scene.add(appearEffect);
        }

        if (allAssets.vfxs.disappear) {
            disappearEffect = allAssets.vfxs.disappear.clone ? allAssets.vfxs.disappear.clone(true) : allAssets.vfxs.disappear;
            disappearEffect.position.copy(position);
            disappearEffect.visible = false;

            if (disappearEffect.registerBatchedRenderer) {
                disappearEffect.registerBatchedRenderer(quarksRenderer);
            }
            QuarksUtil.addToBatchRenderer(disappearEffect, quarksRenderer);

            // Configure disappear effect
            if (QuarksUtil.runOnAllParticleEmitters) {
                QuarksUtil.runOnAllParticleEmitters(disappearEffect, (ps) => {
                    ps.system.looping = false;
                    // Ensure previous particles are cleaned up; we will reset before replaying
                    ps.system.autoDestroy = true;
                });
            }

            scene.add(disappearEffect);
        }

        // Load enemy spellBall projectile template
        if (allAssets.vfxs.fireBullet) {
            spellBallTemplate = allAssets.vfxs.fireBullet.clone ? allAssets.vfxs.fireBullet.clone(true) : allAssets.vfxs.fireBullet;
            spellBallTemplate.position.set(0, 0, 0);
            spellBallTemplate.rotation.set(0, Math.PI, 0);
            spellBallTemplate.visible = true;
            spellBallTemplateLoaded = true;
        }

        // Load trail template (reusing fireBullet but configured for trails)
        if (allAssets.vfxs.fireBullet) {
            enemyTrailTemplate = allAssets.vfxs.fireBullet.clone ? allAssets.vfxs.fireBullet.clone(true) : allAssets.vfxs.fireBullet;
            enemyTrailTemplate.position.set(0, 0, 0);
            enemyTrailTemplate.rotation.set(0, Math.PI, 0);
            enemyTrailTemplate.visible = true;
            enemyTrailTemplateLoaded = true;
        }

        // Load on-hit effect (reused for enemy projectiles hitting the player)
        if (allAssets.vfxs.onHitEnemy) {
            onHitTemplate = allAssets.vfxs.onHitEnemy.clone ? allAssets.vfxs.onHitEnemy.clone(true) : allAssets.vfxs.onHitEnemy;
            onHitTemplate.position.set(0, 0, 0);
            try { onHitTemplate.scale.set(0.02, 0.06, 0.02); } catch (_) { }
            onHitTemplate.visible = true;
            onHitTemplateLoaded = true;
        }
    }

    // Initialize trigger area
    function initializeTriggerArea() {
        // Static trigger centered at initial spawn/guard center
        const geometryStatic = new THREE.SphereGeometry(triggerRadius, 16, 16);
        const materialStatic = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        triggerArea = new THREE.Mesh(geometryStatic, materialStatic);
        triggerArea.position.copy(wanderCenter);
        triggerArea.visible = false; // Always visible for debugging
        scene.add(triggerArea);

        // Dynamic trigger follows the enemy model (different color for clarity)
        const geometryDynamic = new THREE.SphereGeometry(triggerRadius, 16, 16);
        const materialDynamic = new THREE.MeshBasicMaterial({
            color: 0x9933ff,
            wireframe: true,
            transparent: true,
            opacity: 0.24
        });
        dynamicTriggerArea = new THREE.Mesh(geometryDynamic, materialDynamic);
        dynamicTriggerArea.position.copy(position);
        dynamicTriggerArea.visible = false;
        scene.add(dynamicTriggerArea);
    }

    // Function to set player reference
    function setPlayer(playerRef) {
        player = playerRef;
    }

    // Function to set point system reference
    function setPointSystem(ps) {
        // Keep player damage plumbing working as before
        if (player) {
            player.pointSystem = ps;
        }
        // Also retain a local reference for enemy UI control
        pointSystemRef = ps;
        // Auto-spawn if we're not defeated and should auto-spawn
        if (shouldAutoSpawn && !isDefeated) {
            appear();
        }
    }

    // Function to check if player is in trigger area (either static or dynamic center)
    function checkPlayerInTrigger() {
        if (!player || !enemyModel || !enemyModel.visible) return false;

        const playerPosition = player.object ? player.object.position : null;
        if (!playerPosition) return false;
        // Horizontal distances to static center and dynamic (enemy) center
        const staticCenter = new THREE.Vector3(originalWanderCenter.x, 0, originalWanderCenter.z);
        const dynSource = dynamicTriggerLocked && dynamicTriggerArea ? dynamicTriggerArea.position : enemyModel.position;
        const dynamicCenter = new THREE.Vector3(dynSource.x, 0, dynSource.z);
        const playerFlat = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
        const distStatic = staticCenter.distanceTo(playerFlat);
        const distDynamic = dynamicCenter.distanceTo(playerFlat);
        return (distStatic <= triggerRadius) || (distDynamic <= triggerRadius);
    }

    function isPlayerInsideDynamicTrigger() {
        if (!player || !enemyModel || !enemyModel.visible) return false;
        const playerPosition = player.object ? player.object.position : null;
        if (!playerPosition) return false;
        const dynSource = dynamicTriggerLocked && dynamicTriggerArea ? dynamicTriggerArea.position : enemyModel.position;
        const dynamicCenter = new THREE.Vector3(dynSource.x, 0, dynSource.z);
        const playerFlat = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
        const distDynamic = dynamicCenter.distanceTo(playerFlat);
        return distDynamic <= triggerRadius;
    }

    // Function to create ray from enemy to player
    function createRayToPlayer() {
        if (!player || !enemyModel || !enemyModel.visible) return;

        const playerPosition = player.object ? player.object.position : null;
        if (!playerPosition) return;

        // Cleanup previous ray
        if (rayLine && rayLine.parent) {
            rayLine.parent.remove(rayLine);
        }
        if (rayTimeoutId) {
            clearTimeout(rayTimeoutId);
            rayTimeoutId = null;
        }

        // Create ray line from enemy to player (use current model position + Y offset to reflect bobbing)
        const enemyRayOrigin = enemyModel.position.clone();
        // Apply offsets in enemy local space so they follow rotation
        const yaw = enemyModel.rotation.y;
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        enemyRayOrigin.addScaledVector(right, rayOriginXOffset);
        enemyRayOrigin.addScaledVector(forward, rayOriginZOffset);
        enemyRayOrigin.y += rayOriginYOffset;

        // Calculate predicted target point with lead
        const aimedPlayer = calculatePredictedAimPoint(enemyRayOrigin, playerPosition);

        const points = [enemyRayOrigin, aimedPlayer.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        // Color changes based on charge time (orange = charging, red = about to fire)
        const nowSec = performance.now() * 0.001;
        const timeSinceLast = nowSec - lastCastAtSec;
        const chargeProgress = Math.min(1, timeSinceLast / castCooldownSec);
        const color = chargeProgress > 0.7 ? 0xff0000 : 0xff6600; // Changed threshold from 0.85 to 0.7 for quicker visual feedback
        const material = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 3,
            transparent: true,
            opacity: 0.6 + chargeProgress * 0.4 // pulse brighter as it charges
        });
        rayLine = new THREE.Line(geometry, material);
        rayLine.visible = false;
        // scene.add(rayLine);
        lastRayEnd = aimedPlayer.clone();

        // Auto-remove ray after a shorter duration for more responsive updates
        rayTimeoutId = setTimeout(() => {
            if (rayLine && rayLine.parent) {
                rayLine.parent.remove(rayLine);
            }
            rayLine = null;
            lastRayEnd = null;
        }, 50); // Reduced from 100ms to 50ms for more frequent updates
    }

    function calculatePredictedAimPoint(enemyOrigin, playerPosition) {
        const aimedPlayer = playerPosition.clone();
        aimedPlayer.y += 0.8; // aim at upper torso/chest height

        if (!LEAD_PREDICTION_ENABLED || !player) return aimedPlayer;

        // Estimate player velocity from animation manager state
        const animMgr = player.getAnimationManager ? player.getAnimationManager() : null;
        if (!animMgr) return aimedPlayer;

        // Get player facing direction from model rotation
        const playerObj = player.object;
        if (!playerObj) return aimedPlayer;

        const playerYaw = playerObj.rotation.y;
        const playerForward = new THREE.Vector3(Math.sin(playerYaw), 0, Math.cos(playerYaw));

        // More accurate speed estimation based on actual player velocity
        let estimatedSpeed = 0;
        if (playerObj.userData && playerObj.userData.velocity) {
            // Use actual velocity if available
            estimatedSpeed = playerObj.userData.velocity.length();
        } else {
            // Fallback to animation-based estimation
            if (animMgr.isSprinting) {
                estimatedSpeed = 6.0; // sprint speed
            } else if (animMgr.isKeyPressed && animMgr.keyBindings) {
                // Check if any movement keys are pressed
                const moving = animMgr.isKeyPressed(animMgr.keyBindings.forward) ||
                    animMgr.isKeyPressed(animMgr.keyBindings.backward) ||
                    animMgr.isKeyPressed(animMgr.keyBindings.left) ||
                    animMgr.isKeyPressed(animMgr.keyBindings.right);
                if (moving) estimatedSpeed = 4.0; // walk speed
            }
        }

        // Calculate lead based on projectile travel time
        const distance = enemyOrigin.distanceTo(playerPosition);
        const travelTime = distance / ENEMY_PROJECTILE_SPEED;

        // Predict where player will be with more accurate timing
        const leadOffset = playerForward.multiplyScalar(estimatedSpeed * travelTime * 1.1); // Slightly over-predict for more challenging gameplay
        aimedPlayer.add(leadOffset);

        // Apply accuracy variation based on distance with more challenging spread
        const accuracy = calculateAccuracy(distance);
        if (accuracy < 1.0) {
            // Add random spread based on accuracy (lower accuracy = more spread)
            const spreadAmount = (1.0 - accuracy) * 1.2; // Reduced maximum spread for better gameplay
            const randomX = (Math.random() - 0.5) * spreadAmount;
            const randomZ = (Math.random() - 0.5) * spreadAmount;
            const randomY = (Math.random() - 0.5) * spreadAmount * 0.3; // less vertical spread
            aimedPlayer.x += randomX;
            aimedPlayer.y += randomY;
            aimedPlayer.z += randomZ;
        }

        return aimedPlayer;
    }

    function calculateAccuracy(distance) {
        if (distance <= ACCURACY_FALLOFF_START) {
            return BASE_ACCURACY;
        }
        if (distance >= ACCURACY_FALLOFF_END) {
            return MIN_ACCURACY;
        }
        // Exponential decay for more challenging accuracy drop-off
        const t = (distance - ACCURACY_FALLOFF_START) / (ACCURACY_FALLOFF_END - ACCURACY_FALLOFF_START);
        // Steeper curve: accuracy drops off more quickly
        const curve = t * t; // Quadratic drop-off instead of linear
        return BASE_ACCURACY - (BASE_ACCURACY - MIN_ACCURACY) * curve;
    }

    // Function to smoothly turn enemy to face the player (yaw-only)
    function facePlayerSmoothly(dt, maxTurnRateRadPerSec = Math.PI * 2.0) {
        if (!enemyModel || !player || !player.object) return;

        const enemyPos = enemyModel.position;
        const playerPos = player.object.position;
        // Compute flat direction on XZ plane
        const dir = new THREE.Vector3().subVectors(playerPos, enemyPos);
        dir.y = 0;
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();

        // Desired yaw and current yaw
        const desiredYaw = Math.atan2(dir.x, dir.z);
        const currentYaw = enemyModel.rotation.y;

        // Smallest signed angle difference
        const angleDiff = Math.atan2(Math.sin(desiredYaw - currentYaw), Math.cos(desiredYaw - currentYaw));
        const maxStep = maxTurnRateRadPerSec * (isFinite(dt) ? Math.max(0, dt) : 0);
        const step = Math.max(-maxStep, Math.min(maxStep, angleDiff));

        enemyModel.rotation.y = currentYaw + step;
    }

    function getEnemyCastOrigin() {
        if (!enemyModel) return null;
        const origin = enemyModel.position.clone();
        // Apply same offsets used for ray, in enemy local space
        const yaw = enemyModel.rotation.y;
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        origin.addScaledVector(right, rayOriginXOffset);
        origin.addScaledVector(forward, rayOriginZOffset);
        origin.y += rayOriginYOffset;
        return origin;
    }

    function spawnEnemyProjectileArc(start, end) {
        if (!quarksRenderer) {
            quarksRenderer = new BatchedParticleRenderer();
            scene.add(quarksRenderer);
        }
        if (!spellBallTemplateLoaded || !spellBallTemplate) {
            // Defer until template loads
            setTimeout(() => spawnEnemyProjectileArc(start, end), 25);
            return;
        }

        // Container group at start; effect sits at (0,0,0) in group
        const group = new THREE.Group();
        group.position.copy(start);
        scene.add(group);

        const effect = spellBallTemplate.clone(true);
        effect.position.set(0, 0, 0);
        effect.visible = true;
        // Make the core small
        try { effect.scale.set(1, 1, 1); } catch (_) { }
        if (effect.registerBatchedRenderer) effect.registerBatchedRenderer(quarksRenderer);
        QuarksUtil.addToBatchRenderer(effect, quarksRenderer);
        if (QuarksUtil.runOnAllParticleEmitters) {
            QuarksUtil.runOnAllParticleEmitters(effect, (ps) => {
                ps.system.looping = true;
                ps.system.autoDestroy = false;
            });
        }
        if (typeof QuarksUtil.stop === 'function') QuarksUtil.stop(effect);
        if (typeof QuarksUtil.reset === 'function') QuarksUtil.reset(effect);
        if (typeof QuarksUtil.replay === 'function') {
            QuarksUtil.replay(effect);
        } else {
            QuarksUtil.play(effect);
        }
        if (typeof effect.updateDuration === 'function') effect.updateDuration();
        group.add(effect);

        // Add a smooth trail that follows the projectile
        if (enemyTrailTemplateLoaded && enemyTrailTemplate) {
            const trail = enemyTrailTemplate.clone(true);
            trail.position.set(0, 0, 0);
            trail.visible = true;
            try { trail.scale.set(0.35, 0.35, 0.35); } catch (_) { }
            if (trail.registerBatchedRenderer) trail.registerBatchedRenderer(quarksRenderer);
            QuarksUtil.addToBatchRenderer(trail, quarksRenderer);
            if (QuarksUtil.runOnAllParticleEmitters) {
                QuarksUtil.runOnAllParticleEmitters(trail, (ps) => {
                    ps.system.looping = true;
                    ps.system.autoDestroy = false;
                });
            }
            if (typeof QuarksUtil.stop === 'function') QuarksUtil.stop(trail);
            if (typeof QuarksUtil.reset === 'function') QuarksUtil.reset(trail);
            if (typeof QuarksUtil.replay === 'function') {
                QuarksUtil.replay(trail);
            } else {
                QuarksUtil.play(trail);
            }
            if (typeof trail.updateDuration === 'function') trail.updateDuration();
            group.add(trail);
        }

        // Arc via quadratic Bezier with elevated control point
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const distance = start.distanceTo(end);
        // Reduced arc height for more direct shots
        const scaledHeight = Math.min(ENEMY_PROJECTILE_ARC_HEIGHT + distance * 0.03, 2.0); // Reduced multiplier
        const minHeight = 0.2 + distance * 0.02; // Lower minimum height
        mid.y += Math.max(minHeight, scaledHeight * 0.5); // Reduced multiplier

        // Reduced minimum travel time for faster projectiles
        const minTravelMs = 300; // Reduced from 450
        const travelTimeMs = Math.max(minTravelMs, (distance / ENEMY_PROJECTILE_SPEED) * 1000);
        const startTime = performance.now();

        enemyProjectiles.push({ group, effect, start, end, ctrl: mid, startTime, travelTimeMs, done: false, hasHit: false });
    }

    function relocateWithinTriggerArea() {
        if (!enemyModel) return;
        // Choose center based on dynamic lock; fallback to original center
        const center = (dynamicTriggerLocked && dynamicTriggerLockCenter) ? dynamicTriggerLockCenter : originalWanderCenter;
        const r = triggerRadius * 0.95; // small margin from edge
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * r; // uniform in circle
        const x = center.x + Math.cos(theta) * radius;
        const z = center.z + Math.sin(theta) * radius;
        // Keep current Y (bobbing applies each frame)
        enemyModel.position.set(x, enemyModel.position.y, z);
        // Reset wander center when locked so patrol stays around the new spot
        if (dynamicTriggerLocked) {
            wanderCenter.set(center.x, wanderCenter.y, center.z);
        } else {
            // When not locked, keep original center
            wanderCenter.copy(originalWanderCenter);
        }
        // Also move dynamic trigger if it's following the enemy (not locked)
        if (dynamicTriggerArea && !dynamicTriggerLocked) {
            dynamicTriggerArea.position.set(x, dynamicTriggerArea.position.y, z);
        }
    }

    function spawnOnHitEffect(hitPoint) {
        if (!quarksRenderer) {
            quarksRenderer = new BatchedParticleRenderer();
            scene.add(quarksRenderer);
        }
        if (!onHitTemplateLoaded || !onHitTemplate) {
            setTimeout(() => spawnOnHitEffect(hitPoint), 20);
            return;
        }
        const hitGroup = new THREE.Group();
        hitGroup.position.copy(hitPoint);
        scene.add(hitGroup);

        const hitEffect = onHitTemplate.clone(true);
        hitEffect.position.set(0, 0, 0);
        hitEffect.visible = true;
        if (hitEffect.registerBatchedRenderer) hitEffect.registerBatchedRenderer(quarksRenderer);
        QuarksUtil.addToBatchRenderer(hitEffect, quarksRenderer);
        if (QuarksUtil.runOnAllParticleEmitters) {
            QuarksUtil.runOnAllParticleEmitters(hitEffect, (ps) => {
                ps.system.looping = false;
                ps.system.autoDestroy = true;
            });
        }
        hitGroup.add(hitEffect);
        try { if (typeof QuarksUtil.stop === 'function') QuarksUtil.stop(hitEffect); } catch (_) { }
        try { if (typeof QuarksUtil.reset === 'function') QuarksUtil.reset(hitEffect); } catch (_) { }
        try {
            if (typeof QuarksUtil.replay === 'function') {
                QuarksUtil.replay(hitEffect);
            } else {
                QuarksUtil.play(hitEffect);
            }
        } catch (_) { }
        try { if (typeof hitEffect.updateDuration === 'function') hitEffect.updateDuration(); } catch (_) { }

        // Cleanup after a short duration
        setTimeout(() => {
            try { if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') QuarksUtil.removeFromBatchRenderer(hitEffect, quarksRenderer); } catch (_) { }
            if (hitGroup.parent) hitGroup.parent.remove(hitGroup);
        }, 2000);
    }

    function castAt(point) {
        if (!enemyModel) return false;
        const start = getEnemyCastOrigin();
        if (!start || !point) return false;
        spawnEnemyProjectileArc(start, point.clone());
        return true;
    }

    function castAtPlayer() {
        if (!player || !player.object) return false;
        // Use the last aimed point from the ray if available to ensure projectile reaches the shown ray
        const fallback = player.object.position.clone();
        fallback.y -= 0.2; // match ray aim offset
        const target = lastRayEnd ? lastRayEnd.clone() : fallback;
        return castAt(target);
    }

    function pickNewWanderTarget(minRetargetSec = 1.5, maxRetargetSec = 3.5) {
        // Uniform in circle using sqrt(rnd)
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * wanderRadius;
        const x = wanderCenter.x + Math.cos(theta) * radius;
        const z = wanderCenter.z + Math.sin(theta) * radius;
        wanderTarget = new THREE.Vector3(x, enemyModel ? enemyModel.position.y : baseY, z);
        const nowSec = performance.now() * 0.001;
        wanderRetargetAt = nowSec + (minRetargetSec + Math.random() * (maxRetargetSec - minRetargetSec));
    }

    function updateWander(dt) {
        if (!enemyModel || !isVisible) return;
        const nowSec = performance.now() * 0.001;
        if (!wanderTarget || nowSec >= wanderRetargetAt) {
            pickNewWanderTarget();
        }
        // Move on XZ towards target
        const pos = enemyModel.position;
        const to = new THREE.Vector3(wanderTarget.x - pos.x, 0, wanderTarget.z - pos.z);
        const dist = Math.max(0, to.length());
        if (dist < 0.15) {
            pickNewWanderTarget();
            return;
        }
        to.normalize();
        const step = Math.min(dist, wanderSpeed * (isFinite(dt) ? Math.max(0, dt) : 0));
        pos.x += to.x * step;
        pos.z += to.z * step;

        // Keep within radius
        const fromCenter = new THREE.Vector3(pos.x - wanderCenter.x, 0, pos.z - wanderCenter.z);
        const d = fromCenter.length();
        if (d > wanderRadius) {
            fromCenter.multiplyScalar((wanderRadius - 1e-3) / d);
            pos.x = wanderCenter.x + fromCenter.x;
            pos.z = wanderCenter.z + fromCenter.z;
            pickNewWanderTarget();
        }
    }

    // Function to make enemy appear with animation
    function appear() {
        if (!enemyModel || isAnimating || isVisible || isDefeated) return;

        isAnimating = true;
        animationStartTime = performance.now();
        isVisible = true;
        enemyModel.visible = true;
        // Reset auto-spawn flag since we've appeared
        shouldAutoSpawn = false;
        // Show enemy health bar when appearing
        try {
            if (pointSystemRef && pointSystemRef.enemyHealthBar) {
                pointSystemRef.enemyHealthBar.setVisible(true);
            }
        } catch (_) { }

        // Trigger appear particle effect
        if (appearEffect) {
            // Position the effect at the enemy's current position
            appearEffect.position.copy(enemyModel.position);
            appearEffect.visible = true;
            if (typeof QuarksUtil.stop === 'function') {
                QuarksUtil.stop(appearEffect);
            }
            if (typeof QuarksUtil.reset === 'function') {
                QuarksUtil.reset(appearEffect);
            }
            if (typeof QuarksUtil.replay === 'function') {
                QuarksUtil.replay(appearEffect);
            } else {
                QuarksUtil.play(appearEffect);
            }
            if (typeof appearEffect.updateDuration === 'function') {
                appearEffect.updateDuration();
            }

            // Set effect timing
            effectStartTime = performance.now();
            effectDuration = typeof appearEffect.getDuration === 'function' ? appearEffect.getDuration() * 1000 : 2000; // Default 2 seconds
            isEffectPlaying = true;
        }
    }

    // Function to make enemy disappear with animation
    function disappear() {
        if (!enemyModel || isAnimating || !isVisible || isDefeated) return;

        isAnimating = true;
        animationStartTime = performance.now();
        isVisible = false;
        enemyModel.visible = true; // Keep visible during animation
        // Hide enemy health bar during disappear animation window (it will be fully hidden at end)
        try {
            if (pointSystemRef && pointSystemRef.enemyHealthBar) {
                pointSystemRef.enemyHealthBar.setVisible(false);
            }
        } catch (_) { }

        // Trigger disappear particle effect
        if (disappearEffect) {
            // Immediately end and clear any previous emission so no ghost remains at old position
            try { if (typeof QuarksUtil.endEmit === 'function') QuarksUtil.endEmit(disappearEffect); } catch (_) { }
            try { if (typeof QuarksUtil.stop === 'function') QuarksUtil.stop(disappearEffect); } catch (_) { }
            try { if (typeof QuarksUtil.reset === 'function') QuarksUtil.reset(disappearEffect); } catch (_) { }
            disappearEffect.visible = false;

            // Position the effect at the enemy's current position only
            disappearEffect.position.copy(enemyModel.position);
            disappearEffect.visible = true;
            if (typeof QuarksUtil.replay === 'function') {
                QuarksUtil.replay(disappearEffect);
            } else {
                QuarksUtil.play(disappearEffect);
            }
            if (typeof disappearEffect.updateDuration === 'function') {
                disappearEffect.updateDuration();
            }

            // Set effect timing
            effectStartTime = performance.now();
            effectDuration = typeof disappearEffect.getDuration === 'function' ? disappearEffect.getDuration() * 1000 : 2000; // Default 2 seconds
            isEffectPlaying = true;
        }
    }

    // Update function to handle animation and trigger area
    function update() {
        if (!enemyModel) return;
        if (isDefeated) {
            // stop all behavior once defeated
            lastUpdateTime = performance.now() * 0.001;
            return;
        }

        // Time step
        const nowSec = performance.now() * 0.001;
        const dt = Math.max(0, nowSec - lastUpdateTime);
        lastUpdateTime = nowSec;

        // Always-on bobbing effect (visual only)
        {
            const bob = Math.sin(nowSec * Math.PI * 2 * bobSpeedHz) * bobAmplitude;
            enemyModel.position.y = baseY + bob;
        }

        // Keep dynamic trigger following enemy unless locked
        if (dynamicTriggerArea && enemyModel) {
            if (!dynamicTriggerLocked) {
                dynamicTriggerArea.position.copy(enemyModel.position);
            }
        }

        // Handle animation if animating
        if (isAnimating) {
            const currentTime = performance.now();
            const elapsed = (currentTime - animationStartTime) / 1000; // Convert to seconds
            const progress = Math.min(elapsed / animationDuration, 1);

            if (progress < 1) {
                // Easing function for smooth animation
                const easeOut = 1 - Math.pow(1 - progress, 3);

                if (isVisible) {
                    // Appearing animation - scale up and rotate
                    const scale = initialScale + ((finalScale - initialScale) * easeOut);
                    enemyModel.scale.set(scale, scale, scale);
                    const rotation = easeOut * Math.PI * 2;
                    enemyModel.rotation.y = rotation;
                } else {
                    // Disappearing animation - scale down and rotate back
                    const scale = finalScale - ((finalScale - initialScale) * easeOut);
                    enemyModel.scale.set(scale, scale, scale);
                    const rotation = (1 - easeOut) * Math.PI * 2;
                    enemyModel.rotation.y = rotation;
                }
            } else {
                // Animation complete - set final state
                if (isVisible) {
                    // Final state when appearing
                    enemyModel.scale.set(finalScale, finalScale, finalScale);
                    enemyModel.rotation.y = 0;
                    // Don't hide appear effect yet - let it play out
                } else {
                    // Final state when disappearing
                    enemyModel.scale.set(initialScale, initialScale, initialScale);
                    enemyModel.rotation.y = 0;
                    enemyModel.visible = false;
                    // Ensure health bar hidden when fully disappeared
                    try {
                        if (pointSystemRef && pointSystemRef.enemyHealthBar) {
                            pointSystemRef.enemyHealthBar.setVisible(false);
                        }
                    } catch (_) { }
                    // Don't hide disappear effect yet - let it play out
                }
                isAnimating = false;
            }
        }

        // Random wandering (independent of trigger state; enemy patrols the area)
        updateWander(dt);

        // Handle trigger area logic
        if (isVisible && !isAnimating) {
            const wasInTrigger = isPlayerInTrigger;
            isPlayerInTrigger = checkPlayerInTrigger();
            const wasInDynamic = dynamicTriggerLocked; // proxy to detect transitions
            const nowInDynamic = isPlayerInsideDynamicTrigger();

            // Player entered trigger area
            if (isPlayerInTrigger && !wasInTrigger) {
                console.log('Player entered enemy trigger area!');
                // Change trigger area color to indicate activation
                if (triggerArea) {
                    triggerArea.material.color.set(0x00ff00); // Green when player is inside
                }
                if (dynamicTriggerArea) {
                    dynamicTriggerArea.material.color.set(0x00ff00);
                }

                // Start combat blinking behavior
                combatBlinkActive = true;
                // Schedule first blink a short time after combat starts
                nextBlinkAtSec = nowSec + (1.5 + Math.random() * 1.5);
            }

            // Player left trigger area
            if (!isPlayerInTrigger && wasInTrigger) {
                console.log('Player left enemy trigger area!');
                // Change trigger area color back to red
                if (triggerArea) {
                    triggerArea.material.color.set(0xff0000); // Red when player is outside
                }
                if (dynamicTriggerArea) {
                    dynamicTriggerArea.material.color.set(0x9933ff);
                }
                // Remove ray line when player leaves
                if (rayLine && rayLine.parent) {
                    rayLine.parent.remove(rayLine);
                    rayLine = null;
                }
                if (rayTimeoutId) {
                    clearTimeout(rayTimeoutId);
                    rayTimeoutId = null;
                }
                lastRayEnd = null;

                // Stop combat blinking when player leaves; ensure enemy is visible again
                combatBlinkActive = false;
                nextBlinkAtSec = 0;
                if (enemyModel && !isAnimating && !isVisible) {
                    appear();
                }
            }

            // Dynamic trigger lock/unlock behavior
            if (!wasInDynamic && nowInDynamic) {
                // Player just entered dynamic area: lock it in place and make enemy patrol inside
                dynamicTriggerLocked = true;
                dynamicTriggerLockCenter = dynamicTriggerArea ? dynamicTriggerArea.position.clone() : enemyModel.position.clone();
                wanderCenter.copy(dynamicTriggerLockCenter);
                wanderRadius = Math.max(0.1, triggerRadius * 0.9);
            }
            if (wasInDynamic && !nowInDynamic) {
                // Player just left dynamic area: unlock and resume following enemy, reset patrol center
                dynamicTriggerLocked = false;
                dynamicTriggerLockCenter = null;
                wanderCenter.copy(originalWanderCenter);
                wanderRadius = Math.max(0.1, triggerRadius * 0.9);
            }

            // Create/update ray when player is in trigger area, and face the player
            if (isPlayerInTrigger) {
                createRayToPlayer();
                facePlayerSmoothly(dt);

                // Attempt autocast with cooldown and visual telegraph
                const nowSec2 = nowSec;
                const timeSinceLast = nowSec2 - lastCastAtSec;
                const readyToFire = timeSinceLast >= castCooldownSec;

                // Visual telegraph: ray becomes more visible as it charges
                if (rayLine && rayLine.material) {
                    const chargeProgress = Math.min(1, timeSinceLast / castCooldownSec);
                    rayLine.visible = chargeProgress > 0.3; // show ray when 30% charged

                    // Pulse effect when almost ready
                    if (chargeProgress > 0.85) {
                        const pulse = Math.sin(nowSec2 * 15) * 0.5 + 0.5;
                        rayLine.material.opacity = 0.7 + pulse * 0.3;
                    }
                }

                if (readyToFire) {
                    if (castAtPlayer()) {
                        lastCastAtSec = nowSec2;
                        // Flash ray bright on fire
                        if (rayLine && rayLine.material) {
                            rayLine.material.opacity = 1.0;
                            rayLine.material.color.set(0xffff00); // bright yellow flash
                            setTimeout(() => {
                                if (rayLine && rayLine.material) {
                                    rayLine.material.color.set(0xff0000);
                                }
                            }, 50);
                        }
                    }
                }
            }
        }

        // Handle combat blink toggling (independent of casting; only during combat)
        if (combatBlinkActive && !isAnimating) {
            const now = nowSec;
            if (now >= nextBlinkAtSec) {
                if (isVisible) {
                    // Vanish for a short, random duration
                    disappear();
                    // Off duration: harder when player lingers (short vanish)
                    nextBlinkAtSec = now + (0.9 + Math.random() * 1.2);
                } else {
                    // Reappear and stay on for a bit longer before next vanish
                    // Teleport to a random spot within the trigger area before appearing
                    relocateWithinTriggerArea();
                    appear();
                    nextBlinkAtSec = now + (2.0 + Math.random() * 2.0);
                }
            }
        }

        // Update enemy projectiles along arc
        if (enemyProjectiles.length > 0) {
            const nowMs = performance.now();
            for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
                const p = enemyProjectiles[i];
                const t = Math.min(1, (nowMs - p.startTime) / p.travelTimeMs);
                // Ease-in-out to slow near the end, preventing fast drop
                const ease = (x) => x * x * (3 - 2 * x);
                const u = ease(t);
                // Quadratic Bezier interpolation with eased parameter
                const a = (1 - u) * (1 - u);
                const b = 2 * (1 - u) * u;
                const c = u * u;
                const pos = new THREE.Vector3(
                    a * p.start.x + b * p.ctrl.x + c * p.end.x,
                    a * p.start.y + b * p.ctrl.y + c * p.end.y,
                    a * p.start.z + b * p.ctrl.z + c * p.end.z
                );
                // Approximate velocity for facing
                const tAhead = Math.min(1, t + 0.02);
                const u2 = ease(tAhead);
                const a2 = (1 - u2) * (1 - u2);
                const b2 = 2 * (1 - u2) * u2;
                const c2 = u2 * u2;
                const posAhead = new THREE.Vector3(
                    a2 * p.start.x + b2 * p.ctrl.x + c2 * p.end.x,
                    a2 * p.start.y + b2 * p.ctrl.y + c2 * p.end.y,
                    a2 * p.start.z + b2 * p.ctrl.z + c2 * p.end.z
                );
                const vel = new THREE.Vector3().subVectors(posAhead, pos);

                p.group.position.copy(pos);
                if (vel.lengthSq() > 1e-6) {
                    const yaw = Math.atan2(vel.x, vel.z);
                    const pitch = Math.atan2(vel.y, Math.sqrt(vel.x * vel.x + vel.z * vel.z));
                    p.group.rotation.set(pitch, yaw, 0);
                }

                // Collision check with player's capsule (improved hit detection)
                if (!p.hasHit && player && player.object) {
                    // Player capsule approximation: cylinder with radius 0.4, height ~2
                    const playerBase = player.object.position.clone();
                    const playerTop = playerBase.clone();
                    playerTop.y += 1.6; // approximate player height

                    // Check collision with capsule (segment + radius)
                    const hitRadius = 0.3; // Reduced from 0.5 for more precise hits
                    const capsuleLine = new THREE.Line3(playerBase, playerTop);
                    const closestPoint = new THREE.Vector3();
                    capsuleLine.closestPointToPoint(pos, true, closestPoint);

                    const distToPlayer = pos.distanceTo(closestPoint);

                    // Additional check: if player is moving, predict their position slightly
                    let predictedHit = false;
                    if (player.getAnimationManager && player.getAnimationManager().isSprinting) {
                        // If player is sprinting, check a bit ahead of their position
                        const animMgr = player.getAnimationManager();
                        if (animMgr.isKeyPressed && animMgr.keyBindings) {
                            const isMoving = animMgr.isKeyPressed(animMgr.keyBindings.forward) ||
                                animMgr.isKeyPressed(animMgr.keyBindings.backward) ||
                                animMgr.isKeyPressed(animMgr.keyBindings.left) ||
                                animMgr.isKeyPressed(animMgr.keyBindings.right);

                            if (isMoving) {
                                // Predict where player will be in 0.1 seconds
                                const predictionTime = 0.1;
                                const playerVelocity = new THREE.Vector3();
                                if (player.object.userData && player.object.userData.velocity) {
                                    playerVelocity.copy(player.object.userData.velocity);
                                } else {
                                    // Estimate velocity based on movement state
                                    const speed = animMgr.isSprinting ? 6.0 : 4.0;
                                    const yaw = player.object.rotation.y;
                                    playerVelocity.set(Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed);
                                }

                                const predictedPos = player.object.position.clone().add(playerVelocity.multiplyScalar(predictionTime));
                                const predictedTop = predictedPos.clone();
                                predictedTop.y += 1.6;

                                const predictedCapsule = new THREE.Line3(predictedPos, predictedTop);
                                const predictedClosest = new THREE.Vector3();
                                predictedCapsule.closestPointToPoint(pos, true, predictedClosest);

                                const predictedDist = pos.distanceTo(predictedClosest);
                                if (predictedDist <= hitRadius * 1.2) { // Slightly larger radius for prediction
                                    predictedHit = true;
                                }
                            }
                        }
                    }

                    if (distToPlayer <= hitRadius || predictedHit) {
                        p.hasHit = true;
                        try {
                            console.log('Enemy projectile hit player!', {
                                x: pos.x.toFixed(2),
                                y: pos.y.toFixed(2),
                                z: pos.z.toFixed(2),
                                distance: distToPlayer.toFixed(2)
                            });
                        } catch (_) { }

                        // Calculate damage with distance falloff for fairness
                        const shotDistance = p.start.distanceTo(p.end);
                        const baseDamage = 25; // Increased from 20 for more challenging gameplay
                        const damageFalloff = shotDistance > 10 ? 0.7 : 1.0; // 30% reduction at long range (increased falloff)
                        const finalDamage = Math.max(15, Math.round(baseDamage * damageFalloff)); // Minimum 15 damage

                        // Damage player through point system if available
                        if (player.pointSystem && typeof player.pointSystem.damagePlayer === 'function') {
                            player.pointSystem.damagePlayer(finalDamage);
                        }

                        // Spawn hit effect at center/torso of player for consistent visual feedback
                        // Use player center height (torso) regardless of actual hit location
                        const impactPoint = player.object.position.clone();
                        impactPoint.y += 0.2; // center/torso height for consistent hit effect
                        spawnOnHitEffect(impactPoint);

                        // End emission and cleanup
                        try { if (typeof QuarksUtil?.endEmit === 'function') QuarksUtil.endEmit(p.effect); } catch (_) { }
                        try { if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') QuarksUtil.removeFromBatchRenderer(p.effect, quarksRenderer); } catch (_) { }
                        if (p.group.parent) p.group.parent.remove(p.group);
                        enemyProjectiles.splice(i, 1);
                        continue;
                    }
                }

                if (t >= 1) {
                    // End emission and cleanup
                    try { if (typeof QuarksUtil?.endEmit === 'function') QuarksUtil.endEmit(p.effect); } catch (_) { }
                    try { if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') QuarksUtil.removeFromBatchRenderer(p.effect, quarksRenderer); } catch (_) { }
                    if (p.group.parent) p.group.parent.remove(p.group);
                    enemyProjectiles.splice(i, 1);
                }
            }
        }
    }

    // Update particle effects
    function updateParticles(elapsedSeconds) {
        if (quarksRenderer) {
            quarksRenderer.update(elapsedSeconds);
        }

        // Handle effect timing
        if (isEffectPlaying) {
            const currentTime = performance.now();
            const elapsed = currentTime - effectStartTime;

            if (elapsed >= effectDuration) {
                // Effect duration complete - hide the effects
                if (appearEffect && appearEffect.visible) {
                    appearEffect.visible = false;
                }
                if (disappearEffect && disappearEffect.visible) {
                    disappearEffect.visible = false;
                }
                isEffectPlaying = false;
            }
        }
    }

    // Function to reset enemy (make it disappear)
    function reset() {
        if (!enemyModel) return;

        enemyModel.visible = false;
        enemyModel.scale.set(initialScale, initialScale, initialScale);
        enemyModel.rotation.set(0, 0, 0);
        isAnimating = false;
        isVisible = false;
        isDefeated = false;
        combatBlinkActive = false;
        nextBlinkAtSec = 0;
        isPlayerInTrigger = false;
        dynamicTriggerLocked = false;
        dynamicTriggerLockCenter = null;
        wanderCenter.copy(originalWanderCenter);
        // Reset auto-spawn flag
        shouldAutoSpawn = true;
        // Hide health bar when resetting enemy
        try {
            if (pointSystemRef && pointSystemRef.enemyHealthBar) {
                pointSystemRef.enemyHealthBar.setVisible(false);
            }
        } catch (_) { }

        // Reset trigger area color
        if (triggerArea) {
            triggerArea.material.color.set(0xff0000);
        }
        if (dynamicTriggerArea) {
            dynamicTriggerArea.material.color.set(0x9933ff);
        }

        // Clean up ray line
        if (rayLine && rayLine.parent) {
            rayLine.parent.remove(rayLine);
            rayLine = null;
        }
        if (rayTimeoutId) {
            clearTimeout(rayTimeoutId);
            rayTimeoutId = null;
        }

        // Cleanup enemy projectiles
        for (const p of enemyProjectiles) {
            try { if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') QuarksUtil.removeFromBatchRenderer(p.effect, quarksRenderer); } catch (_) { }
            if (p.group && p.group.parent) p.group.parent.remove(p.group);
        }
        enemyProjectiles.length = 0;
    }

    function markDefeated() {
        isDefeated = true;
        combatBlinkActive = false;
        nextBlinkAtSec = 0;
        if (enemyModel) enemyModel.visible = false;
        // Reset auto-spawn flag
        shouldAutoSpawn = false;
        try {
            if (pointSystemRef && pointSystemRef.enemyHealthBar) {
                pointSystemRef.enemyHealthBar.setVisible(false);
            }
        } catch (_) { }

        // Remove any active enemy projectiles immediately
        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            const p = enemyProjectiles[i];
            try { if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') QuarksUtil.removeFromBatchRenderer(p.effect, quarksRenderer); } catch (_) { }
            if (p.group && p.group.parent) p.group.parent.remove(p.group);
            enemyProjectiles.splice(i, 1);
        }

        // Remove any aim ray visuals
        if (rayLine && rayLine.parent) {
            rayLine.parent.remove(rayLine);
            rayLine = null;
        }
        if (rayTimeoutId) {
            clearTimeout(rayTimeoutId);
        }
    }

    // Function to check if enemy is currently animating
    function isCurrentlyAnimating() {
        return isAnimating;
    }

    // Dispose function to clean up particle effects and trigger area
    function dispose() {
        if (appearEffect) {
            QuarksUtil.removeFromBatchRenderer(appearEffect, quarksRenderer);
            appearEffect.parent?.remove(appearEffect);
        }
        if (disappearEffect) {
            QuarksUtil.removeFromBatchRenderer(disappearEffect, quarksRenderer);
            disappearEffect.parent?.remove(disappearEffect);
        }
        if (quarksRenderer) {
            quarksRenderer.parent?.remove(quarksRenderer);
        }

        // Clean up trigger areas
        if (triggerArea && triggerArea.parent) {
            triggerArea.parent.remove(triggerArea);
        }
        if (dynamicTriggerArea && dynamicTriggerArea.parent) {
            dynamicTriggerArea.parent.remove(dynamicTriggerArea);
        }

        // Clean up ray line
        if (rayLine && rayLine.parent) {
            rayLine.parent.remove(rayLine);
        }
        if (rayTimeoutId) {
            clearTimeout(rayTimeoutId);
        }

        // Clean up enemy projectiles
        for (const p of enemyProjectiles) {
            try { if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') QuarksUtil.removeFromBatchRenderer(p.effect, quarksRenderer); } catch (_) { }
            if (p.group && p.group.parent) p.group.parent.remove(p.group);
        }
        enemyProjectiles.length = 0;
    }

    return {
        appear,
        disappear,
        update,
        updateParticles,
        reset,
        dispose,
        isCurrentlyAnimating,
        getModel: () => enemyModel,
        setPlayer,
        setPointSystem,
        markDefeated,
        castAt,
        castAtPlayer,
        setCastCooldown: (sec) => { castCooldownSec = Math.max(0.1, sec || castCooldownSec); },
        getTriggerArea: () => triggerArea,
        getDynamicTriggerArea: () => dynamicTriggerArea,
        isPlayerInTrigger: () => isPlayerInTrigger,
        getTriggerRadius: () => triggerRadius,
        setTriggerRadius: (radius) => {
            triggerRadius = radius;
            // Rebuild geometries to reflect new radius (rarely called; acceptable cost)
            if (triggerArea) {
                const parent = triggerArea.parent;
                const vis = triggerArea.visible;
                parent && parent.remove(triggerArea);
                triggerArea.geometry.dispose?.();
                const g = new THREE.SphereGeometry(triggerRadius, 16, 16);
                triggerArea.geometry = g;
                parent && parent.add(triggerArea);
                triggerArea.visible = vis;
            }
            if (dynamicTriggerArea) {
                const parent = dynamicTriggerArea.parent;
                const vis = dynamicTriggerArea.visible;
                parent && parent.remove(dynamicTriggerArea);
                dynamicTriggerArea.geometry.dispose?.();
                const g = new THREE.SphereGeometry(triggerRadius, 16, 16);
                dynamicTriggerArea.geometry = g;
                parent && parent.add(dynamicTriggerArea);
                dynamicTriggerArea.visible = vis;
            }
            // Keep wander radius in sync (slightly smaller)
            wanderRadius = Math.max(0.1, triggerRadius * 0.9);
        }
    };
}
