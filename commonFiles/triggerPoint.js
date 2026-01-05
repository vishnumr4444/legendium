/**
 * ============================================
 * TRIGGER POINT MODULE
 * ============================================
 * Creates interactive zones that detect player entry and execute callbacks.
 * Uses three.quarks for optional particle effects.
 * 
 * Features:
 * - Cylindrical collision zone detection
 * - Optional particle effect display
 * - One-time or repeatable triggers
 * - Configurable cooldown between activations
 * - Audio feedback on trigger
 * - Efficient distance-based detection
 * - Visual debugging capability
 * 
 * Trigger Modes:
 * - One-shot: Triggers once, then disabled
 * - Repeatable: Triggers again after exiting and re-entering
 * - Cooldown: Prevents rapid repeated triggers
 * 
 * Audio:
 * - Automatic trigger.mp3 playback
 * - Automatic volume management
 * - Safe error handling for audio failures
 */

import { BatchedRenderer, QuarksUtil } from "three.quarks";
import {
  Box3,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import * as THREE from "three";

/**
* @function TriggerPoint
* @description
* Creates a trigger zone in a Three.js scene that can optionally display a particle effect and execute a callback
* when the player enters the zone. The trigger supports both one-time and repeatable behaviors with optional cooldowns,
* and ensures that the callback only fires once per physical entry (prevents re-triggering while standing inside the zone).
*
* Internally:
* - Uses `three.quarks` for visual effects.
* - Uses a vertical cylinder as the collision boundary.
* - Manages internal state to prevent multiple callbacks during continuous presence in the zone.
*
* @param {Object|null} vfxJson - A particle effect from `three.quarks` to display in the zone (or `null` for none).
* @param {Object} position - Position of the trigger zone `{ x, y, z }`.
* @param {THREE.Scene} scene - The Three.js scene to which the trigger zone and effects are added.
* @param {Object|null} scale - Optional: Scale of the zone `{ x, y, z }`. Defaults to `{ x: 1, y: 1, z: 1 }` if null.
* @param {Function} onEnterEffect - Callback invoked when the player enters the trigger zone.
* @param {boolean} [repeatable=false] - Optional: If `true`, allows re-triggering after player exits and re-enters. Defaults to `false`.
* @param {number} [cooldownDuration=2000] - Optional: Cooldown time (ms) between activations if `repeatable` is true.
*        If set to `0`, triggers only once per physical entry (no rapid repeated calls while inside).
*
* @returns {Object} An object containing:
*  - `batchSystem`: Reference to the `BatchedRenderer` managing the particle system.
*  - `updateQuarksScene(deltaTime, player)`: Call this in the animation loop to evaluate trigger conditions.
*  - `removeParticleEffects()`: Cleans up the particle system and removes all Three.js resources associated with the effect and trigger.
*  - `setVFXVisible(visible)`: Allows external control over whether the particle effect is shown or hidden.
*
* @example
* import { TriggerPoint } from "./TriggerPoint";
*
* const trigger = TriggerPoint(
*   vfxEffect,
*   { x: 0, y: 2, z: 0 },
*   scene,
*   { x: 2, y: 2, z: 2 },
*   () => {
*     console.log("Player entered the trigger zone!");
*   },
*   true,         // repeatable trigger
*   3000          // optional: 3-second cooldown between triggers
* );
*
* function animate(deltaTime) {
*   trigger.updateQuarksScene(deltaTime, playerMesh);
* }
*
* // Hide or remove effect
* trigger.setVFXVisible(false);
* trigger.removeParticleEffects();
*/

export function TriggerPoint(
  vfxJson,
  position,
  scene,
  scale = null,
  onEnterEffect,
  repeatable = false,
  cooldownDuration = 2000
) {
  // Local one-shot audio for entering this trigger instance
  let hasPlayedEnterAudio = false;
  let enterAudio = null;
  try {
    enterAudio = new Audio('audios/triggerpoint.mp3');
    enterAudio.loop = false;
    enterAudio.preload = 'auto';
    enterAudio.crossOrigin = 'anonymous';
    // very low volume default; can be adjusted as needed
    enterAudio.volume = 1.0;
  } catch (_) {}
  let batchSystemRef = null;
  if (vfxJson) {
    batchSystemRef = new BatchedRenderer();
    scene.add(batchSystemRef);
  }

  // Create cylinder with proper dimensions
  const cylinderRadius = scale ? scale.x : 1;
  const cylinderHeight = scale ? scale.y : 1;
  let cylinderMesh = new Mesh(
    new CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 32),
    new MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  scene.add(cylinderMesh);
  cylinderMesh.position.set(position.x, position.y, position.z);

  // Apply scale to cylinder mesh if provided
  if (scale) {
    cylinderMesh.scale.set(scale.x, scale.y, scale.z);
  }

  let effect1 = null;
  if (vfxJson) {
    effect1 = vfxJson.clone();
    // Remove/hide ground ring if present (keep only vertical/overhead ring)
    if (effect1 && effect1.children && effect1.children.length > 1) {
      // Heuristic: keep the child whose rotation.x is close to Math.PI/2 or -Math.PI/2 (vertical/overhead), remove others
      effect1.children = effect1.children.filter((child) => {
        return (
          child.rotation &&
          Math.abs(Math.abs(child.rotation.x) - Math.PI / 2) < 0.01
        );
      });
      // If using three.js r150+, also remove from scene graph
      if (effect1 && effect1.children.length > 1) {
        for (let i = effect1.children.length - 1; i >= 0; i--) {
          if (
            !effect1.children[i].rotation ||
            Math.abs(Math.abs(effect1.children[i].rotation.x) - Math.PI / 2) >=
              0.01
          ) {
            effect1.remove(effect1.children[i]);
          }
        }
      }
    }
    if (effect1) {
      QuarksUtil.addToBatchRenderer(effect1, batchSystemRef);
      scene.add(effect1);

      // Match VFX scale with cylinder scale
      if (scale) {
        effect1.scale.set(scale.x, scale.y, scale.z);
      } else {
        effect1.scale.set(1, 1, 1);
      }
      effect1.position.set(position.x, position.y, position.z);
    }
  }

  if (effect1 && effect1.material) {
    effect1.material.depthWrite = false;
    effect1.material.depthTest = false;
    effect1.material.transparent = true;
    effect1.material.blending = THREE.AdditiveBlending;
  }

  // Make cylinder completely invisible and non-interfering
  cylinderMesh.material.visible = false;
  cylinderMesh.material.transparent = true;
  cylinderMesh.material.opacity = 0;
  cylinderMesh.material.depthWrite = false;
  cylinderMesh.material.depthTest = false;

  let isTriggered = false;
  let cooldownActive = false;
  let hasEntered = false;
  const tempVector = new Vector3();

  function updateQuarksScene(deltaTime, player) {
    if (batchSystemRef && effect1) {
      batchSystemRef.update(deltaTime);
    }
    if (!cylinderMesh || !player) return;

    tempVector.setFromMatrixPosition(player.matrixWorld);

    const horizontalDistance = Math.sqrt(
      Math.pow(tempVector.x - cylinderMesh.position.x, 2) +
        Math.pow(tempVector.z - cylinderMesh.position.z, 2)
    );

    const effectiveRadius = cylinderRadius * cylinderMesh.scale.x;

    const playerHeight = 1.6;
    const playerBottom = tempVector.y - playerHeight;
    const playerTop = tempVector.y;
    const triggerBottom =
      cylinderMesh.position.y - (cylinderHeight * cylinderMesh.scale.y) / 2;
    const triggerTop =
      cylinderMesh.position.y + (cylinderHeight * cylinderMesh.scale.y) / 2;

    const heightOverlap =
      playerBottom <= triggerTop && playerTop >= triggerBottom;

    const isInsideZone = horizontalDistance <= effectiveRadius && heightOverlap;

    if (isInsideZone) {
      if (!hasEntered) {
        hasEntered = true;

        if ((!isTriggered || repeatable) && !cooldownActive) {
          if (!repeatable) isTriggered = true;
          cooldownActive = true;

          // Play one-shot enter audio once per trigger instance
          try {
            if (!hasPlayedEnterAudio && enterAudio) {
              hasPlayedEnterAudio = true;
              // play() returns a promise in modern browsers
              const p = enterAudio.play();
              if (p && typeof p.catch === 'function') {
                p.catch(() => {});
              }
            }
          } catch (_) {}

          if (onEnterEffect) onEnterEffect();

          console.log("Player entered the trigger zone!");

          setTimeout(() => {
            cooldownActive = false;
            console.log("Trigger re-armed after cooldown.");
          }, cooldownDuration);
        }
      }
    } else {
      hasEntered = false; // reset when player leaves

      if (repeatable) {
        isTriggered = false; // Re-arm if repeatable
      }
    }
  }

  function removeParticleEffects() {
    if (effect1) {
      // Stop emission and dispose emitters
      if (effect1.emitters) {
        effect1.emitters.forEach((emitter) => {
          if (emitter.stopEmit) {
            emitter.stopEmit();
          }
          // Allow particles to fade out naturally
          setTimeout(() => {
            if (emitter.dispose) {
              emitter.dispose();
            }
          }, 2000); // Wait 2 seconds for particles to fade
        });
      }

      // Remove from scene
      if (scene) {
        scene.remove(effect1);
      }

      // Dispose of geometries and materials
      if (effect1.geometry) {
        effect1.geometry.dispose();
      }
      if (effect1.material) {
        effect1.material.dispose();
      }

      // Clear the reference
      effect1 = null;
    }

    // Clear the batch renderer
    if (batchSystemRef) {
      // Dispose of any remaining geometries/materials in the batch renderer
      if (batchSystemRef.geometry) {
        batchSystemRef.geometry.dispose();
      }
      if (batchSystemRef.material) {
        batchSystemRef.material.dispose();
      }

      // Remove batch renderer from scene
      if (scene) {
        scene.remove(batchSystemRef);
      }
      batchSystemRef = null;
    }

    // Add null check for cylinderMesh
    if (cylinderMesh) {
      if (cylinderMesh.material) {
        cylinderMesh.material.dispose();
      }
      if (cylinderMesh.geometry) {
        cylinderMesh.geometry.dispose();
      }
      cylinderMesh = null;
    }
  }

  function setVFXVisible(visible) {
    if (!scene || !batchSystemRef || !effect1) return;
    if (visible) {
      if (!scene.children.includes(batchSystemRef)) {
        scene.add(batchSystemRef);
      }
      if (effect1 && effect1.emitters) {
        effect1.emitters.forEach((emitter) => {
          if (emitter.startEmit) emitter.startEmit();
        });
      }
    } else {
      scene.remove(batchSystemRef);
      if (effect1 && effect1.emitters) {
        effect1.emitters.forEach((emitter) => {
          if (emitter.stopEmit) emitter.stopEmit();
        });
      }
    }
  }

  return {
    batchSystem: batchSystemRef,
    updateQuarksScene,
    removeParticleEffects,
    setVFXVisible,
  };
}
 