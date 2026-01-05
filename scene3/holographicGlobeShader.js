/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
/**
 * Script Description
 * Holographic glow shader (Scene 3).
 * Created on 2025-12-22 by vishnumr
 */
/*******************************************************************************
 * * OneSource IML | TGI FRIDAY *
 * **************************************************************************
 *
 *
 * Author: vishnumr
 *
 * REVISION HISTORY
 *
 *
 ******************************************************************************/
import * as THREE from "three";

/**
 * @fileoverview Holographic glow shader (Scene 3).
 *
 * This shader produces an edge/silhouette glow that looks “holographic”.
 * It is typically applied to a slightly scaled-up duplicate mesh and rendered with:
 * - `side: THREE.BackSide` to outline the silhouette
 * - additive blending for a neon glow
 * - `transparent: true` for smooth fade at edges
 *
 * Uniforms:
 * - `time`: caller-updated animation time
 * - `glowColor`: base neon color
 * - `glowIntensity`: brightness multiplier
 * - `glowPower`: edge sharpness/rolloff
 * - `glowSpeed`: pulse animation speed
 *
 * Usage:
 * - Create a `THREE.ShaderMaterial` using this vertex/fragment shader.
 * - In your render loop: `material.uniforms.time.value += delta`.
 */
export const holographicGlobeShader = {
  uniforms: {
    /** Animation clock. Increment each frame to animate the pulse. */
    time: { value: 0 },
    /** Glow tint color. */
    glowColor: { value: new THREE.Color(0x00ffff) },
    /** Overall glow brightness. */
    glowIntensity: { value: 1.0 },
    /** Edge intensity falloff exponent; higher = tighter edge. */
    glowPower: { value: 2.0 },
    /** Pulse speed multiplier. */
    glowSpeed: { value: 1.0 },
  },

  vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vGlow;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            // Calculate glow based on view angle
            vGlow = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,

  fragmentShader: `
        uniform float time;
        uniform vec3 glowColor;
        uniform float glowIntensity;
        uniform float glowPower;
        uniform float glowSpeed;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vGlow;
        
        void main() {
            // Calculate pulsing glow
            float pulse = sin(time * glowSpeed) * 0.5 + 0.5;
            float glow = pow(vGlow, glowPower) * glowIntensity * (0.5 + pulse * 0.5);
            
            // Only add glow to edges
            vec3 finalColor = glowColor * glow;
            
            gl_FragColor = vec4(finalColor, glow);
        }
    `,
};
