/**
 * ============================================
 * WIRE CREATION & ANIMATION MODULE
 * ============================================
 * Creates animated wire/cable effects in 3D space.
 * Used for:
 * - Visual effects showing energy flows
 * - Circuit visualizations
 * - Connection lines between objects
 * 
 * Features:
 * - Particle-based wire visualization
 * - Animated progression along bezier curve paths
 * - Optional glow/emissive effects
 * - Customizable colors, widths, and speeds
 * - Completion callback for animation timing
 */

import * as THREE from "three";
 
let particleMaterial;
 
export function WireConfig(
  scene,
  points,
  particleCount,
  lineWidth,
  colorOfWire,
  onComplete,
  isEmissiveGlowType,
  glowIntensity,
  speed = 0.02 // Default speed matches your updated value
) {
  // Cap particleCount to prevent excessive memory usage
  const maxParticleCount = 100000; // Reasonable limit for most GPUs
  particleCount = Math.min(particleCount, maxParticleCount);
  console.log(`Using particleCount: ${particleCount}`);
 
  let color = new THREE.Color(colorOfWire).multiplyScalar(glowIntensity);
 
  let particleGeometry = new THREE.BufferGeometry();
  let positions = new Float32Array(particleCount * 3).fill(9999);
 
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
 
  if (isEmissiveGlowType) {
    let glowTexture = new THREE.TextureLoader().load("/public/glowTexture.jpg");
 
    particleMaterial = new THREE.PointsMaterial({
      map: glowTexture,
      size: lineWidth * 5,
      color: color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  } else {
    particleMaterial = new THREE.PointsMaterial({
      color: colorOfWire,
      size: lineWidth,
      depthWrite: false,
      transparent: true,
    });
  }
  let particles = new THREE.Points(particleGeometry, particleMaterial);
 
  let glowGeometry = new THREE.SphereGeometry(0, 16, 16);
  let glowMaterial = new THREE.MeshBasicMaterial({
    color: colorOfWire,
    opacity: 0.0,
    transparent: true,
    visible: true,
  });
  let glowParticle = new THREE.Mesh(glowGeometry, glowMaterial);
 
  let particleIndex = 0; // Track the current particle index
  let currentSegmentIndex = 0; // Track the current segment in the path
  let segmentProgress = 0; // Progress along the current segment (0 to 1)
  let animateFlag = true;
 
  function animateWireFrame() {
    if (!animateFlag) return;
 
    if (currentSegmentIndex < points.length - 1) {
      let start = points[currentSegmentIndex];
      let end = points[currentSegmentIndex + 1];
 
      // Linear interpolation between start and end points
      let positionOnSegment = new THREE.Vector3()
        .lerpVectors(start, end, segmentProgress)
        .add(new THREE.Vector3(0, 0, 0)); // Slight Z-offset
 
      // Set the current particle's position in the geometry
      if (particleIndex < particleCount) {
        particleGeometry.attributes.position.setXYZ(
          particleIndex,
          positionOnSegment.x,
          positionOnSegment.y,
          positionOnSegment.z
        );
        particleIndex++;
        particleGeometry.attributes.position.needsUpdate = true; // Mark for update
      }
 
      // Move the glowParticle along with the segment
      glowParticle.position.copy(positionOnSegment);
 
      // Advance along the segment
      segmentProgress += speed; // Use configurable speed
      if (segmentProgress >= 1) {
        segmentProgress = 0; // Reset progress for the next segment
        currentSegmentIndex++; // Move to the next segment
      }
    } else {
      // Animation is complete, call onComplete
      if (onComplete) {
        onComplete();
      }
      return; // Stop animation
    }
 
    requestAnimationFrame(animateWireFrame);
  }
 
  // Public API to control the animation
  return {
    particles: particles,
    start: () => {
      animateFlag = true;
      scene.add(particles);
      scene.add(glowParticle);
      animateWireFrame();
    },
    stop: () => {
      animateFlag = false;
    },
    reset: () => {
      particleIndex = 0;
      currentSegmentIndex = 0;
      segmentProgress = 0;
    },
    dispose: () => {
      scene.remove(particles);
      scene.remove(glowParticle);
      particleGeometry.dispose();
      particleMaterial.dispose();
      if (particleMaterial.map) particleMaterial.map.dispose(); // Dispose of glow texture
      glowGeometry.dispose();
      glowMaterial.dispose();
    },
  };
}
 