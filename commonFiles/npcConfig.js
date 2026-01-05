/**
 * ============================================
 * NPC CONFIGURATION MODULE
 * ============================================
 * Handles NPC setup and configuration for different scenes.
 * Applies model assignments, animation setups, and path configurations.
 * 
 * Functions:
 * - applyNPCConfigurations(): Generic configuration applicator
 * - setupNPCsForScene3(): Scene 3 specific NPC setup
 * 
 * Configuration Format:
 * {
 *   npcIndex: Number - Index of the NPC in the system
 *   pathName: String or Object - Path to follow (supports offset positioning)
 *   modelName: String - Model asset name
 *   modelAction: String - Animation action to play
 *   speed: Number - Movement speed (optional)
 * }
 * 
 * Features:
 * - Per-path offset support for variance
 * - Per-NPC speed customization
 * - Animation clipping from loaded assets
 * - Flexible path offset configuration
 */

import * as THREE from 'three';

/**
 * Apply NPC configurations: assign paths, attach models, and set up per-instance animation mixers.
 * - Supports per-path offsets with `{ pathName, offsetX?, offsetY?, offsetZ? }`.
 * - Supports per-NPC speed via `{ speed }`.
 */
export function applyNPCConfigurations(allAssets, npcSystem, configurations = []) {
  if (!npcSystem || !allAssets || !configurations || configurations.length === 0) return;

  const gltfModels = allAssets.models.gltf;
  const modelAnimations = allAssets.models.animations;
  const jsonFiles = allAssets.jsonFiles;

  for (let i = 0; i < configurations.length; i++) {
    const { npcIndex, pathName, modelName, modelAction, speed } = configurations[i];

    // Optional per-NPC speed
    if (typeof speed === 'number') {
      const npc = npcSystem.getNPC && npcSystem.getNPC(npcIndex);
      if (npc) npc.speed = speed;
    }

    // Normalize path configuration
    const pathCfg = typeof pathName === 'string'
      ? { pathName, offsetX: 0, offsetY: 0, offsetZ: 0 }
      : (pathName || {});

    // Assign path
    const jf = pathCfg.pathName ? jsonFiles[pathCfg.pathName] : null;
    if (jf && jf.points) {
      const ox = pathCfg.offsetX || 0;
      const oy = pathCfg.offsetY || 0;
      const oz = pathCfg.offsetZ || 0;
      if (ox || oy || oz) {
        const pts = new Array(jf.points.length);
        for (let p = 0; p < jf.points.length; p++) {
          const s = jf.points[p];
          pts[p] = { x: s.x + ox, y: s.y + oy, z: s.z + oz };
        }
        npcSystem.setPath(npcIndex, pts);
      } else {
        npcSystem.setPath(npcIndex, jf.points);
      }
    }

    // Attach model and play animation
    if (modelName && gltfModels[modelName]) {
      const source = gltfModels[modelName];
      const instance = source.clone(true);
      instance.position.set(0, 0, 0);
      instance.scale.set(1, 1, 1);
      npcSystem.attachModel(npcIndex, instance);

      const anim = modelAnimations[modelName];
      if (anim && anim.actions) {
        const wanted = anim.actions[modelAction] || Object.values(anim.actions)[0];
        const clip = wanted && (wanted._clip || (wanted.getClip && wanted.getClip()));
        if (clip) {
          const mixer = new THREE.AnimationMixer(instance);
          npcSystem.setAnimation(npcIndex, mixer, mixer.clipAction(clip));
        }
      }
    }
  }
}

/**
 * Scene-3 specific NPC setup using flyingBot for 0–9, with 5–9 offset (-3, 0, -3).
 */
export function setupNPCsForScene3(allAssets, npcSystem) {
  if (!npcSystem || !allAssets) return;

  const configs = [
    { npcIndex: 0, pathName: 'path1', modelName: 'flyingBot', modelAction: 'Scene',speed:0.6 },
    { npcIndex: 1, pathName: 'path2', modelName: 'flyingBot', modelAction: 'Scene',speed:0.6 },
    { npcIndex: 2, pathName: 'path3', modelName: 'flyingBot', modelAction: 'Scene',speed:0.6 },
    { npcIndex: 3, pathName: 'path4', modelName: 'flyingBot', modelAction: 'Scene',speed:0.6 },
    { npcIndex: 4, pathName: 'path5', modelName: 'flyingBot', modelAction: 'Scene',speed:0.6 },

    { npcIndex: 5, pathName: { pathName: 'path1', offsetX: -3, offsetY: 0, offsetZ: -3 }, modelName: 'flyingBot', modelAction: 'Scene' },
    { npcIndex: 6, pathName: { pathName: 'path2', offsetX: -3, offsetY: 0, offsetZ: -3 }, modelName: 'flyingBot', modelAction: 'Scene' },
    { npcIndex: 7, pathName: { pathName: 'path3', offsetX: -3, offsetY: 0, offsetZ: -3 }, modelName: 'flyingBot', modelAction: 'Scene' },
    { npcIndex: 8, pathName: { pathName: 'path4', offsetX: -3, offsetY: 0, offsetZ: -3 }, modelName: 'flyingBot', modelAction: 'Scene' },
    { npcIndex: 9, pathName: { pathName: 'path5', offsetX: -3, offsetY: 0, offsetZ: -3 }, modelName: 'flyingBot', modelAction: 'Scene' }
  ];

  applyNPCConfigurations(allAssets, npcSystem, configs);
} 