import * as THREE from 'three';
import { BatchedParticleRenderer, QuarksUtil } from 'three.quarks';
import { allAssets } from "../commonFiles/assetsLoader.js";
import { isInventoryVisible } from "./inventory.js";
import { playerControlsEnabled } from "../playerController.js";

let detectionBox = null;
let activeRayLine = null;
let rayTimeoutId = null;
const DEFAULT_RAY_LENGTH = 10; // fixed spell ray length

// Quarks shared renderer and preloaded template
let quarksRenderer = null;
let trailTemplate = null; // preloaded trail effect for travel
let trailTemplateLoaded = false;
let onHitTemplate = null; // preloaded onHit effect for when projectiles hit
let onHitTemplateLoaded = false;
let lastQuarksT = 0;

// Active projectiles list (each has its own group + effect)
const activeProjectiles = [];
const PROJECTILE_SPEED = 10; // units per second (consistent speed)

// Spell cast audio (loaded from allAssets.audios.spellcastsound)
let spellCastAudio = null;

export function addRayDetectionBox(attachTo, position = null, size = new THREE.Vector3(2, 2, 2)) {
    const parent = attachTo; // Scene or any Object3D (e.g., enemy model)
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    detectionBox = new THREE.Mesh(geometry, material);
    detectionBox.name = 'RayDetectionBox';
    // Determine default position: world-space default when added to Scene, local-space default when added to another object
    const defaultWorldPos = new THREE.Vector3(12, 10.2, -15);
    const defaultLocalPos = new THREE.Vector3(0, 0.45, 0); // roughly chest height when attached to a character
    const finalPos = position ? position : (parent && parent.isScene ? defaultWorldPos : defaultLocalPos);
    detectionBox.position.copy(finalPos);
    detectionBox.castShadow = false;
    detectionBox.receiveShadow = false;
    detectionBox.visible = false;
    if (parent && typeof parent.add === 'function') parent.add(detectionBox);
    return detectionBox;
}

function drawRayLine(scene, origin, direction, length = DEFAULT_RAY_LENGTH, color = 0x00ff00, durationMs = 250) {
    // Cleanup previous line
    if (activeRayLine && activeRayLine.parent) {
        activeRayLine.parent.remove(activeRayLine);
    }
    if (rayTimeoutId) {
        clearTimeout(rayTimeoutId);
        rayTimeoutId = null;
    }

    const endPoint = new THREE.Vector3().copy(origin).add(new THREE.Vector3().copy(direction).normalize().multiplyScalar(length));
    const points = [origin.clone(), endPoint.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    activeRayLine = new THREE.Line(geometry, material);
    activeRayLine.visible = false;
    scene.add(activeRayLine);

    rayTimeoutId = setTimeout(() => {
        if (activeRayLine && activeRayLine.parent) {
            activeRayLine.parent.remove(activeRayLine);
        }
        activeRayLine = null;
    }, durationMs);
}

export function setupPlayerSpells({ scene, player, target = null, camera = null, pointSystem = null, onHit = () => console.log('hit'), onMiss = null }) {
    const raycaster = new THREE.Raycaster();
    // Crosshair DOM overlay
    let crosshair = null;

    // Provide predicate so player controller knows when spell animation is allowed
    const applySpellCastPredicate = () => {
        if (player?.setSpellCanCastCheck) {
            player.setSpellCanCastCheck(() => {
                try {
                    return pointSystem ? pointSystem.canCastSpell() : true;
                } catch (_) {
                    return true;
                }
            });
        }
    };
    applySpellCastPredicate();

    // Lazy-init shared renderer and preload template
    function ensureTrailTemplate() {
        if (!quarksRenderer) {
            quarksRenderer = new BatchedParticleRenderer();
            scene.add(quarksRenderer);
        }

        // Cache spell cast audio once assets are available
        if (!spellCastAudio && allAssets?.audios) {
            try {
                spellCastAudio = allAssets.audios.spellcastsound || null;
            } catch (_) { /* noop */ }
        }

        // Load trail effect (for travel - using appear.json for sparkly trail)
        if (!trailTemplate && !trailTemplateLoaded) {
            // Access pre-loaded appear.json from allAssets instead of loading directly
            if (allAssets.vfxs.appear) {
                trailTemplate = allAssets.vfxs.appear.clone ? allAssets.vfxs.appear.clone(true) : allAssets.vfxs.appear;
                trailTemplate.position.set(0, 0, 0);
                trailTemplate.scale.set(0.5, 0.5, 0.5); // smaller scale for trail
                trailTemplate.visible = true;
                trailTemplateLoaded = true;
            }
        }

        // Load onHit effect (for when projectiles hit targets)
        if (!onHitTemplate && !onHitTemplateLoaded) {
            // Access pre-loaded onHit.json from allAssets instead of loading directly
            if (allAssets.vfxs.onHit) {
                onHitTemplate = allAssets.vfxs.onHit.clone ? allAssets.vfxs.onHit.clone(true) : allAssets.vfxs.onHit;
                onHitTemplate.position.set(0, 0, 0);
                onHitTemplate.scale.set(0.1, 0.5, 0.1); // full scale for hit effect
                onHitTemplate.visible = true;
                onHitTemplateLoaded = true;
            }
        }
    }

    function spawnOnHitEffect(hitPoint) {
        ensureTrailTemplate();
        // If onHit template not ready yet, defer slightly until it loads
        if (!onHitTemplateLoaded || !onHitTemplate) {
            setTimeout(() => spawnOnHitEffect(hitPoint), 10);
            return;
        }

        // Create a container for this hit effect
        const hitGroup = new THREE.Group();
        hitGroup.position.copy(hitPoint);
        scene.add(hitGroup);

        // Clone the onHit effect instance for this hit
        const hitEffect = onHitTemplate.clone(true);
        hitEffect.position.set(0, 0, 0);
        hitEffect.visible = true;
        if (hitEffect.registerBatchedRenderer) hitEffect.registerBatchedRenderer(quarksRenderer);
        QuarksUtil.addToBatchRenderer(hitEffect, quarksRenderer);

        if (QuarksUtil.runOnAllParticleEmitters) {
            QuarksUtil.runOnAllParticleEmitters(hitEffect, (ps) => {
                ps.system.looping = false; // Hit effects should not loop
                ps.system.autoDestroy = true; // Auto-destroy when finished
            });
        }

        hitGroup.add(hitEffect);
        if (typeof QuarksUtil.stop === 'function') QuarksUtil.stop(hitEffect);
        if (typeof QuarksUtil.reset === 'function') QuarksUtil.reset(hitEffect);
        if (typeof QuarksUtil.replay === 'function') {
            QuarksUtil.replay(hitEffect);
        } else {
            QuarksUtil.play(hitEffect);
        }
        if (typeof hitEffect.updateDuration === 'function') hitEffect.updateDuration();

        // Auto-cleanup after effect duration (estimate 2 seconds for hit effects)
        setTimeout(() => {
            try {
                if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') {
                    QuarksUtil.removeFromBatchRenderer(hitEffect, quarksRenderer);
                }
            } catch (_) { /* noop */ }
            if (hitGroup.parent) hitGroup.parent.remove(hitGroup);
        }, 2000);
    }

    function spawnProjectile(origin, end, hitPoint = null) {
        ensureTrailTemplate();
        // If trail template not ready yet, defer slightly until it loads
        if (!trailTemplateLoaded || !trailTemplate) {
            setTimeout(() => spawnProjectile(origin, end, hitPoint), 10);
            return;
        }

        // Create a container for this projectile
        const group = new THREE.Group();
        group.position.copy(origin);
        scene.add(group);

        // Clone the trail effect instance for this projectile (sparkly trail during travel)
        const trailEffect = trailTemplate.clone(true);
        trailEffect.position.set(0, 0, 0);
        trailEffect.visible = true;
        if (trailEffect.registerBatchedRenderer) trailEffect.registerBatchedRenderer(quarksRenderer);
        QuarksUtil.addToBatchRenderer(trailEffect, quarksRenderer);

        if (QuarksUtil.runOnAllParticleEmitters) {
            QuarksUtil.runOnAllParticleEmitters(trailEffect, (ps) => {
                ps.system.looping = true; // Keep trail looping during travel
                ps.system.autoDestroy = false;
            });
        }

        group.add(trailEffect);
        if (typeof QuarksUtil.stop === 'function') QuarksUtil.stop(trailEffect);
        if (typeof QuarksUtil.reset === 'function') QuarksUtil.reset(trailEffect);
        if (typeof QuarksUtil.replay === 'function') {
            QuarksUtil.replay(trailEffect);
        } else {
            QuarksUtil.play(trailEffect);
        }
        if (typeof trailEffect.updateDuration === 'function') trailEffect.updateDuration();

        // Calculate travel time based on distance and speed
        const distance = origin.distanceTo(end);
        const travelTimeMs = (distance / PROJECTILE_SPEED) * 1000; // Convert to milliseconds

        const startTime = performance.now();
        activeProjectiles.push({
            group,
            effect: trailEffect,
            origin: origin.clone(),
            end: end.clone(),
            startTime,
            travelTimeMs, // Store the calculated travel time for this projectile
            hitPoint: hitPoint, // Store the hit point for when projectile reaches it
            hasHit: false // Track if we've already triggered the hit
        });
    }


    function getPlayerOriginAndDirection() {
        const mesh = player?.object;
        if (!mesh) return null;

        // Get world transforms so we always work with the up-to-date pose
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        mesh.getWorldPosition(worldPosition);
        mesh.getWorldQuaternion(worldQuaternion);

        // Derive the forward direction directly from the world quaternion so it accounts for
        // all rotation and stays consistent while the player moves.
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuaternion);
        direction.y = 0; // Ignore any vertical tilt for the projectile direction
        if (direction.lengthSq() < 1e-6) {
            direction.set(0, 0, -1);
        } else {
            direction.normalize();
        }

        // Build the origin from the player's current world position.
        const origin = worldPosition.clone();
        origin.y -= 0.4; // raise to chest height
        origin.addScaledVector(direction, 1.0); // push forward along the facing direction

        return { origin, direction };
    }

    function castSpellRay() {
        ensureTrailTemplate();
        const mesh = player?.object;
        if (!mesh || !camera) return;

        // Don't cast spells if inventory is visible
        if (isInventoryVisible()) {
            return;
        }
        
        // Don't cast spells if player controls are disabled
        if (!playerControlsEnabled) {
            return;
        }

        // Check spell energy before casting
        try {
            if (pointSystem && typeof pointSystem.canCastSpell === 'function' && !pointSystem.canCastSpell()) {
                // Optional: brief UI feedback by flashing detection box red if present
                if (detectionBox && detectionBox.material && detectionBox.material.color) {
                    detectionBox.material.color.set(0x3366ff);
                    setTimeout(() => { try { detectionBox.material.color.set(0xff0000); } catch (_) { } }, 120);
                }
                if (typeof pointSystem.flashSpellBarWarning === 'function') {
                    pointSystem.flashSpellBarWarning();
                }
                return; // not enough energy
            }
        } catch (_) { }

        // Ray from camera center (crosshair)
        const ndc = new THREE.Vector2(0, 0);
        raycaster.setFromCamera(ndc, camera);

        // Determine aim point: hit target mesh if provided, else far point
        const rayLen = DEFAULT_RAY_LENGTH;
        const targetMesh = target || detectionBox;
        let aimPoint = new THREE.Vector3().copy(raycaster.ray.origin).add(raycaster.ray.direction.clone().multiplyScalar(rayLen));
        if (targetMesh) {
            const hit = raycaster.intersectObject(targetMesh, true);
            if (hit && hit.length > 0) {
                aimPoint.copy(hit[0].point);
            }
        }

        // Player origin (near chest) using helper
        const od = getPlayerOriginAndDirection();
        if (!od) return;
        const origin = od.origin;

        // Direction from player to aim point
        const direction = new THREE.Vector3().subVectors(aimPoint, origin).normalize();

        // Visualize ray straight from player toward aim point
        drawRayLine(scene, origin, direction, rayLen, 0x00ff00, 300);

                // Auto-rotate player to face aim direction
        if (typeof player.faceTowards === 'function') {
            const facePoint = new THREE.Vector3().copy(origin).add(direction.clone().multiplyScalar(-5));
            player.faceTowards(facePoint);
        }

        // End point is capped at ray length along direction or aim point if closer
        let endPoint = new THREE.Vector3().copy(origin).add(direction.clone().multiplyScalar(rayLen));
        const toAim = new THREE.Vector3().subVectors(aimPoint, origin);
        if (toAim.length() < rayLen + 1e-3) endPoint.copy(aimPoint);

        // Raycast against target to record hitPoint for effects/callbacks
        let hitPoint = null;
        if (targetMesh) {
            // Use the same camera ray to decide if target was within line of sight
            const hit = raycaster.intersectObject(targetMesh, true);
            if (hit && hit.length > 0) hitPoint = hit[0].point.clone();
        }

        // Don't cast spells if player is defeated (check before energy consumption and animation)
        if (player && typeof player.isDefeated === 'function' && player.isDefeated()) {
            return;
        }

        // Deduct energy (authoritative) and play animation only if consumption succeeded
        let consumed = false;
        try { consumed = !!(pointSystem && pointSystem.consumeSpellEnergy && pointSystem.consumeSpellEnergy()); } catch (_) { consumed = false; }
        if (!consumed) return;
        try { player && player.getAnimationManager && player.getAnimationManager().playSpellCastAnimation && player.getAnimationManager().playSpellCastAnimation(); } catch (_) { }

        // Play spell cast audio when spell successfully fires
        try {
            if (spellCastAudio) {
                if (spellCastAudio.isPlaying && spellCastAudio.stop) {
                    spellCastAudio.stop();
                }
                if (spellCastAudio.play) {
                    spellCastAudio.play();
                }
            }
        } catch (_) { /* noop */ }

        spawnProjectile(origin, endPoint, hitPoint);
    }

    // Cast spell on left mouse down
    const onMouseDown = (e) => {
        if (e.button === 0) {
            // Don't cast spells if inventory is visible
            if (isInventoryVisible()) {
                return;
            }
            
            // Don't cast spells if player controls are disabled
            if (!playerControlsEnabled) {
                return;
            }
            
            // If the bow is currently loading (RMB held), suppress spell casting
            try {
                const am = player && player.getAnimationManager ? player.getAnimationManager() : null;
                if (am && am.isBowLoading) {
                    e.preventDefault();
                    return; // let player controller handle bow fire
                }
            } catch (_) { }
            e.preventDefault();
            castSpellRay();
        }
    };

    window.addEventListener('mousedown', onMouseDown);

    // Create simple crosshair in the center of the screen
    try {
        crosshair = document.createElement('div');
        crosshair.style.position = 'fixed';
        crosshair.style.left = '50%';
        crosshair.style.top = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.width = '8px';
        crosshair.style.height = '8px';
        crosshair.style.border = '2px solid rgba(255,255,255,0.85)';
        crosshair.style.borderRadius = '50%';
        crosshair.style.boxSizing = 'border-box';
        crosshair.style.pointerEvents = 'none';
        crosshair.style.zIndex = '9999';
        document.body.appendChild(crosshair);
    } catch (_) { /* noop for non-DOM envs */ }

    return {
        castSpellRay,
        getDetectionBox: () => detectionBox,
        update: (elapsedSeconds) => {
            if (quarksRenderer) {
                const dt = Math.max(0, elapsedSeconds - lastQuarksT);
                lastQuarksT = elapsedSeconds;
                quarksRenderer.update(dt);
            }
            if (activeProjectiles.length > 0) {
                const now = performance.now();
                for (let i = activeProjectiles.length - 1; i >= 0; i--) {
                    const p = activeProjectiles[i];
                    const t = Math.min(1, (now - p.startTime) / p.travelTimeMs);
                    const pos = new THREE.Vector3().lerpVectors(p.origin, p.end, t);
                    p.group.position.copy(pos);
                    const dir = new THREE.Vector3().subVectors(p.end, p.origin).normalize();
                    const yaw = Math.atan2(dir.x, dir.z);
                    p.group.rotation.set(0, yaw, 0);

                    // Check if projectile has reached the end and trigger appropriate callback
                    if (!p.hasHit && t >= 1) {
                        p.hasHit = true;

                        if (p.hitPoint) {
                            // Hit: projectile reached a target
                            try {
                                console.log('Player spell hit target!', { x: p.hitPoint.x.toFixed(2), y: p.hitPoint.y.toFixed(2), z: p.hitPoint.z.toFixed(2) });
                                onHit && onHit({ point: p.hitPoint });
                            } catch (_) { /* noop */ }

                            // Spawn onHit effect at the hit point
                            spawnOnHitEffect(p.hitPoint);

                            // Change detection box color to indicate hit
                            if (detectionBox) {
                                detectionBox.material.color.set(0x00ff00);
                            }
                        } else {
                            // Miss: projectile reached max range without hitting anything
                            try {
                                onMiss && onMiss();
                            } catch (_) { /* noop */ }

                            // Change detection box color to indicate miss
                            if (detectionBox) {
                                detectionBox.material.color.set(0xff0000);
                            }
                        }
                    }

                    if (t >= 1) {
                        if (typeof QuarksUtil?.endEmit === 'function' && p.effect) {
                            QuarksUtil.endEmit(p.effect);
                        }
                        // Cleanup (guard for library versions without remove helper)
                        try {
                            if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') {
                                QuarksUtil.removeFromBatchRenderer(p.effect, quarksRenderer);
                            }
                        } catch (_) { /* noop */ }
                        if (p.group.parent) p.group.parent.remove(p.group);
                        activeProjectiles.splice(i, 1);
                    }
                }
            }
        },
        dispose: () => {
            window.removeEventListener('mousedown', onMouseDown);
            if (activeRayLine && activeRayLine.parent) activeRayLine.parent.remove(activeRayLine);
            activeRayLine = null;
            if (crosshair && crosshair.parentElement) crosshair.parentElement.removeChild(crosshair);
            crosshair = null;
            // Cleanup all active projectiles
            for (const p of activeProjectiles) {
                try {
                    if (typeof QuarksUtil?.removeFromBatchRenderer === 'function') {
                        QuarksUtil.removeFromBatchRenderer(p.effect, quarksRenderer);
                    }
                } catch (_) { /* noop */ }
                if (p.group && p.group.parent) p.group.parent.remove(p.group);
            }
            activeProjectiles.length = 0;
            if (quarksRenderer && quarksRenderer.parent) quarksRenderer.parent.remove(quarksRenderer);
            quarksRenderer = null;
            quarksLoader = null;
            trailTemplate = null;
            trailTemplateLoaded = false;
            onHitTemplate = null;
            onHitTemplateLoaded = false;
            if (player?.setSpellCanCastCheck) {
                player.setSpellCanCastCheck(null);
            }
        }
    };
}


