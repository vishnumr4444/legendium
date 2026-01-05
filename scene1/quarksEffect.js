import * as THREE from 'three';
// Remove direct QuarksLoader import since we'll use the asset loader
import { BatchedParticleRenderer, QuarksUtil } from 'three.quarks';
import { allAssets } from "../commonFiles/assetsLoader.js";

// Loads the quarks effect from nuke.json and exposes update/dispose like other helpers
export function createQuarksEffect({ scene, url = './nuke.json', position = new THREE.Vector3(0, 6, -12), scale = new THREE.Vector3(1, 1, 1) }) {
    // Batched renderer for Quarks particle systems
    const quarksRenderer = new BatchedParticleRenderer();
    scene.add(quarksRenderer);

    // Remove loader since we'll access pre-loaded assets
    let vfx = null;
    let isLoaded = false;
    let lastT = 0;
    let pendingPlay = false;

    // Container to position the effect
    const group = new THREE.Group();
    group.position.copy(position);
    group.scale.copy(scale);
    scene.add(group);

    // Resolve URL compatible with bundlers; fallback to provided string
    // Modified to access pre-loaded JSON files from allAssets
    let assetName = 'nuke'; // Default to nuke
    if (url.includes('nuke')) {
        assetName = 'nuke';
    } else if (url.includes('appear')) {
        assetName = 'appear';
    } else if (url.includes('disappear')) {
        assetName = 'disappear';
    } else if (url.includes('onHit')) {
        assetName = 'onHit';
    } else if (url.includes('fireBullet')) {
        assetName = 'fireBullet';
    }

    // Access pre-loaded JSON file from allAssets instead of loading directly
    if (allAssets.vfxs[assetName]) {
        vfx = allAssets.vfxs[assetName].clone ? allAssets.vfxs[assetName].clone(true) : allAssets.vfxs[assetName];
        vfx.position.set(0, 0, 0);
        vfx.scale.set(1, 1, 1);
        vfx.visible = true;

        if (vfx.registerBatchedRenderer) vfx.registerBatchedRenderer(quarksRenderer);
        QuarksUtil.addToBatchRenderer(vfx, quarksRenderer);

        if (QuarksUtil.runOnAllParticleEmitters) {
            QuarksUtil.runOnAllParticleEmitters(vfx, (ps) => {
                ps.system.looping = false;
                // Do NOT auto-destroy so we can replay on key press
                ps.system.autoDestroy = false;
            });
        }

        group.add(vfx);

        // Ensure no initial play: force stop/reset so the effect is idle until triggered
        if (typeof QuarksUtil.stop === 'function') {
            QuarksUtil.stop(vfx);
        }
        if (typeof QuarksUtil.reset === 'function') {
            QuarksUtil.reset(vfx);
        }

        isLoaded = true;
        if (pendingPlay) {
            pendingPlay = false;
            play();
        }
    } else {
        console.error(`Quarks effect ${assetName} not found in allAssets. Make sure it's defined in assetsEntry.js`);
    }

    const update = (elapsedSeconds) => {
        if (!isLoaded) return;
        const dt = Math.max(0, elapsedSeconds - lastT);
        lastT = elapsedSeconds;
        quarksRenderer.update(dt);
    };

    const play = () => {
        if (!isLoaded) {
            pendingPlay = true;
            return;
        }
        if (!vfx) return;
        if (typeof QuarksUtil.stop === 'function') {
            QuarksUtil.stop(vfx);
        }
        if (typeof QuarksUtil.reset === 'function') {
            QuarksUtil.reset(vfx);
        }
        // Some versions expose replay; otherwise play
        if (typeof QuarksUtil.replay === 'function') {
            QuarksUtil.replay(vfx);
        } else {
            QuarksUtil.play(vfx);
        }
        if (typeof vfx.updateDuration === 'function') vfx.updateDuration();
        const durationSec = typeof vfx.getDuration === 'function' ? vfx.getDuration() : 2;
        setTimeout(() => {
            QuarksUtil.endEmit(vfx);
        }, Math.max(0, Math.floor(durationSec * 1000)));
    };

    const dispose = () => {
        if (vfx) {
            QuarksUtil.removeFromBatchRenderer(vfx, quarksRenderer);
        }
        quarksRenderer.parent?.remove(quarksRenderer);
        group.parent?.remove(group);
    };

    return { group, update, play, dispose };
}