/**
 * ============================================
 * NPC (NON-PLAYER CHARACTER) MODULE
 * ============================================
 * Creates and manages individual NPC instances with:
 * - Path following for autonomous movement
 * - Animation system integration
 * - Model attachment and display
 * - Physics-based collision capsule
 * - Efficient memory management with shared resources
 * 
 * Features:
 * - Shared geometry/material for multiple NPCs (memory efficient)
 * - Path interpolation for smooth movement
 * - Animation mixer support
 * - Position and rotation tracking
 * - Automatic cleanup and disposal
 * - Speed configuration per NPC
 * 
 * Usage:
 * Each NPC is a complete object with update(), setModel(), setPathPoints() methods
 */

import * as THREE from 'three';

// Shared resources to reduce allocations
const SHARED = {
    capsuleGeometry: null,
    capsuleMaterial: null
};

function getSharedCapsuleGeometry() {
    if (!SHARED.capsuleGeometry) {
        SHARED.capsuleGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    }
    return SHARED.capsuleGeometry;
}

function getSharedCapsuleMaterial() {
    if (!SHARED.capsuleMaterial) {
        SHARED.capsuleMaterial = new THREE.MeshStandardMaterial({ visible: false });
    }
    // Note: material is shared; avoid per-NPC material changes
    return SHARED.capsuleMaterial;
}

function createNPC(scene, initialPosition) {
    const position = initialPosition.clone();
    const mesh = new THREE.Mesh(getSharedCapsuleGeometry(), getSharedCapsuleMaterial());
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // Prevent disappearing due to incorrect bounds
    scene.add(mesh);

    let speed = 2;
    let pathPoints = [];
    let isMoving = false;
    let mixer = null;
    let action = null;
    let model = null;

    // temp vectors to avoid allocations in update loop
    const tmpDirection = new THREE.Vector3();
    const tmpTarget = new THREE.Vector3();

    let currentPathIndex = 0;

    const setModel = (modelObject) => {
        if (!modelObject) return;
        model = modelObject;
        model.position.set(0, 0, 0);
        model.visible = true;
        model.traverse((child) => {
            if (child.isObject3D) {
                child.frustumCulled = false;
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            }
        });
        mesh.add(model);
    };

    const setAnimationMixer = (newMixer, newAction) => {
        mixer = newMixer || null;
        action = newAction || null;
        if (action) action.play();
    };

    const setPathPoints = (points) => {
        pathPoints = points.map(p => new THREE.Vector3(p.x, Math.max(p.y, 0.6), p.z));
        if (pathPoints.length > 0) mesh.position.copy(pathPoints[0]);
        currentPathIndex = 0;
        isMoving = true;
    };

    const update = (deltaTime) => {
        if (mixer) mixer.update(deltaTime);
        if (!isMoving || pathPoints.length === 0) return;

        // Ensure model stays visible
        if (model && !model.visible) model.visible = true;

        const targetPoint = pathPoints[currentPathIndex];
        tmpTarget.copy(targetPoint);
        tmpDirection.copy(tmpTarget).sub(mesh.position);
        const distanceToTarget = tmpDirection.length();
        if (distanceToTarget > 0.0001) tmpDirection.divideScalar(distanceToTarget);

        const moveDelta = speed * deltaTime;

        if (moveDelta >= distanceToTarget) {
            // Snap to target and advance index without overshooting
            mesh.position.copy(targetPoint);
            currentPathIndex = (currentPathIndex + 1) % pathPoints.length;
            if (currentPathIndex === 0 && pathPoints.length > 1) {
                pathPoints.reverse();
            }
        } else {
            mesh.position.x += tmpDirection.x * moveDelta;
            mesh.position.y += tmpDirection.y * moveDelta;
            mesh.position.z += tmpDirection.z * moveDelta;
        }

        if (tmpDirection.lengthSq() > 1e-6) {
            const angle = Math.atan2(tmpDirection.x, tmpDirection.z);
            mesh.rotation.y = angle;
        }
    };

    const cleanup = () => {
        try { if (action) action.stop(); } catch (_) {}
        try { if (mixer) mixer.stopAllAction(); } catch (_) {}

        if (model) {
            try {
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach((m) => {
                                    if (m.map) { try { m.map.dispose(); } catch(_) {} }
                                    try { m.dispose(); } catch(_) {}
                                });
                            } else {
                                if (child.material.map) { try { child.material.map.dispose(); } catch(_) {} }
                                try { child.material.dispose(); } catch(_) {}
                            }
                        }
                    }
                });
                if (model.parent) model.parent.remove(model);
            } catch (_) {}
            model = null;
        }

        if (mesh && mesh.parent) {
            // Do not dispose shared geometry/material here
            mesh.parent.remove(mesh);
        }

        mixer = null;
        action = null;
        isMoving = false;
        pathPoints = [];
    };

    return {
        mesh,
        get speed() { return speed; },
        set speed(v) { speed = v; },
        setModel,
        setAnimationMixer,
        setPathPoints,
        update,
        cleanup
    };
}

/**
 * Initialize NPCs with customizable paths
 * @param {THREE.Scene} scene
 * @param {number} npcCount
 * @param {Object} options
 * @param {Array} options.pathData
 * @returns {Object}
 */
export function initializeNPCs(scene, npcCount = 3, options = {}) {
    const npcs = [];
    const { pathData = [] } = options;

    for (let i = 0; i < npcCount; i++) {
        const defaultPosition = new THREE.Vector3(
            Math.random() * 10 - 5,
            0,
            Math.random() * 10 - 5
        );
        const npc = createNPC(scene, defaultPosition);

        if (pathData[i]) {
            npc.setPathPoints(pathData[i]);
        } else {
            const radius = 3 + i;
            const points = [];
            const segments = 8;
            for (let j = 0; j < segments; j++) {
                const angle = (j / segments) * Math.PI * 2;
                points.push({ x: Math.cos(angle) * radius, y: 0.6, z: Math.sin(angle) * radius });
            }
            npc.setPathPoints(points);
        }

        npcs.push(npc);
    }

    return {
        npcs,
        getNPC: (index) => npcs[index],
        setPath: (index, pathPoints) => {
            const npc = npcs[index];
            if (npc) { npc.setPathPoints(pathPoints); return true; }
            return false;
        },
        attachModel: (index, modelObject) => {
            const npc = npcs[index];
            if (npc && modelObject) { npc.setModel(modelObject); return true; }
            return false;
        },
        setAnimation: (index, mixer, action) => {
            const npc = npcs[index];
            if (npc) { npc.setAnimationMixer(mixer, action); return true; }
            return false;
        },
        update: (deltaTime) => { for (let i = 0; i < npcs.length; i++) npcs[i].update(deltaTime); },
        playAnimation: (index) => {
            const npc = npcs[index];
            if (npc) { try { npc.setAnimationMixer(npc.mixer, npc.action); return true; } catch(_) {} }
            return false;
        },
        stopAnimation: (index) => {
            const npc = npcs[index];
            if (npc) { try { if (npc.action) npc.action.stop(); return true; } catch(_) {} }
            return false;
        },
        cleanup: () => { for (let i = 0; i < npcs.length; i++) npcs[i].cleanup(); }
    };
}