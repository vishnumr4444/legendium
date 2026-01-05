/**
 * Hoverboard ring mini‑game for Scene 2.
 *
 * Core ideas:
 *  - Spawns a predefined set of glowing shader‑based rings in the air
 *  - Detects when the hoverboard‑mounted player "flies through" them
 *  - Tracks progress and completion time, and shows a polished HUD
 *  - Exposes helpers to reset, clean up and debug collision volumes.
 *
 * Public API:
 *  - `initializeHoverGame(scene, player)`
 *  - `updateHoverGame(delta)`
 *  - `cleanupHoverGame()`
 *  - `resetHoverGame()`
 *  - `getHoverGameStats()`
 *  - `toggleCollisionDebug()` / `setCollisionDebug(visible)`
 *  - `RING_POSITIONS`, `RING_CONFIG` for external alignment.
 */
import * as THREE from "three";

// Hover Game state variables
let hoverRings = [];
let ringGeometry = null;
let gameActive = false;
let ringsPassed = 0;
let totalRings = 10;
let gameStartTime = null;
let gameEndTime = null;
let sceneRef = null;
let playerRef = null;
let showCollisionDebug = false;
let collisionCircles = [];
// HUD/UI elements for progress indicator
let hoverHUDContainer = null;
let hoverHUDLabel = null;
let hoverHUDCounter = null;
let hoverHUDBar = null;
let hoverHUDBarFill = null;
let hoverHUDGlow = null;
let hoverHUDInitialized = false;
let hoverHUDVisible = false;
let listenersAttached = false;
const _tmpQuat = new THREE.Quaternion();

// Ring configuration
// These values control the gameplay feel and the shader look.
const RING_CONFIG = {
  radius: 4.0,        // Increased size
  thickness: 0.4,     // Increased thickness
  segments: 64,
  glowIntensity: 2.8,
  pulseSpeed: 2.0,
  colors: {
    unpassed: new THREE.Color(0x00ffff), // Cyan
    passed: new THREE.Color(0x00ff00),   // Green
    current: new THREE.Color(0xffaa00)   // Orange
  }
};

// Define 10 specific locations for the rings in the air
const RING_POSITIONS = [
  new THREE.Vector3(0, 8, -200),      // Ring 1 - Near starting area
  new THREE.Vector3(-15, 12, -180),   // Ring 2 - Left side
  new THREE.Vector3(20, 10, -160),    // Ring 3 - Right side
  new THREE.Vector3(-5, 15, -140),    // Ring 4 - Center, higher
  new THREE.Vector3(25, 8, -120),     // Ring 5 - Right side, lower
  new THREE.Vector3(-20, 14, -100),   // Ring 6 - Left side, higher
  new THREE.Vector3(10, 11, -80),     // Ring 7 - Center-right
  new THREE.Vector3(-10, 9, -60),     // Ring 8 - Center-left
  new THREE.Vector3(30, 13, -40),     // Ring 9 - Far right, higher
  new THREE.Vector3(0, 16, -20)       // Ring 10 - Final ring, highest
];

// Ring shader material
// The fragment shader uses a Fresnel + pulsing effect with state‑dependent colors.
const ringVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv; 
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragmentShader = `
  uniform float time;
  uniform vec3 color;
  uniform float glowIntensity;
  uniform float pulseSpeed;
  uniform float rimExponent;
  uniform float rimBoost;
  uniform int ringState; // 0: unpassed, 1: current, 2: passed
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    // Pulsing effect
    float pulse = sin(time * pulseSpeed) * 0.3 + 0.7;
    
    // State-based effects
    float stateMultiplier = 1.0;
    if (ringState == 1) { // Current ring
      stateMultiplier = 1.9 + sin(time * pulseSpeed * 2.2) * 0.6;
    } else if (ringState == 2) { // Passed ring
      stateMultiplier = 0.6;
    }
    
    // Fresnel effect for glow
    float fresnel = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    fresnel = pow(max(fresnel, 0.0), rimExponent);
    
    // Combine effects
    float alpha = min(1.0, pulse * stateMultiplier + fresnel * rimBoost * stateMultiplier);
    vec3 finalColor = color * glowIntensity * stateMultiplier * (1.0 + fresnel * 0.8);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Create ring shader material
function createRingShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      color: { value: RING_CONFIG.colors.unpassed },
      glowIntensity: { value: RING_CONFIG.glowIntensity },
      pulseSpeed: { value: RING_CONFIG.pulseSpeed },
      rimExponent: { value: 3.0 },
      rimBoost: { value: 1.2 },
      ringState: { value: 0 } // 0: unpassed, 1: current, 2: passed
    },
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

// Create a single ring
function createRing(position, index) {
  const ring = new THREE.Mesh(ringGeometry, createRingShaderMaterial());
  ring.position.copy(position);
  // Fix orientation - rotate to face forward (towards negative Z direction)
  ring.rotation.x = 0; // No rotation on X axis
  ring.rotation.y = 0; // No rotation on Y axis  
  ring.rotation.z = Math.PI / 2; // Rotate 90 degrees on Z axis to make torus face forward
  
  ring.userData = {
    index: index,
    passed: false,
    isCurrent: index === 0,
    originalPosition: position.clone()
  };
  
  // Set initial state
  updateRingState(ring, index === 0 ? 1 : 0);
  
  return ring;
}

// Create collision debug circle (flat)
function createCollisionDebugCircle(position, index) {
  // Create a flat circle geometry for the collision area
  const circleGeometry = new THREE.CircleGeometry(1.0, 32);
  const circleMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    wireframe: false
  });
  
  const circle = new THREE.Mesh(circleGeometry, circleMaterial);
  circle.position.copy(position);
  // Orient the circle to face forward (same as the rings)
  circle.rotation.x = 0;
  circle.rotation.y = 0;
  circle.rotation.z = Math.PI / 2; // Same rotation as rings
  circle.visible = showCollisionDebug;
  
  return circle;
}

// Update ring visual state
function updateRingState(ring, state) {
  if (!ring.material.uniforms) return;
  
  ring.material.uniforms.ringState.value = state;
  
  switch (state) {
    case 0: // Unpassed
      ring.material.uniforms.color.value.copy(RING_CONFIG.colors.unpassed);
      ring.material.uniforms.glowIntensity.value = 2.2;
      ring.material.uniforms.rimExponent.value = 3.2;
      ring.material.uniforms.rimBoost.value = 1.2;
      break;
    case 1: // Current
      ring.material.uniforms.color.value.copy(RING_CONFIG.colors.current);
      ring.material.uniforms.glowIntensity.value = 3.4;
      ring.material.uniforms.rimExponent.value = 3.8;
      ring.material.uniforms.rimBoost.value = 1.5;
      break;
    case 2: // Passed
      ring.material.uniforms.color.value.copy(RING_CONFIG.colors.passed);
      ring.material.uniforms.glowIntensity.value = 1.6;
      ring.material.uniforms.rimExponent.value = 2.6;
      ring.material.uniforms.rimBoost.value = 0.9;
      break;
  }
}

// Initialize the hover game
/**
 * Initializes the hover game for Scene 2.
 *
 * - Creates torus ring geometry and instantiates all rings at `RING_POSITIONS`
 * - Adds optional collision debug circles for tuning
 * - Starts the game timer and attaches hoverboard mount/dismount listeners.
 *
 * @param {THREE.Scene}    scene  - The active scene.
 * @param {THREE.Object3D} player - Player object used for collision checks.
 */
export function initializeHoverGame(scene, player) {
  sceneRef = scene;
  playerRef = player;
  
  // Create proper ring geometry using torus geometry
  ringGeometry = new THREE.TorusGeometry(
    RING_CONFIG.radius, 
    RING_CONFIG.thickness, 
    RING_CONFIG.segments, 
    32
  );
  
  // Create all rings
  hoverRings = [];
  collisionCircles = [];
  RING_POSITIONS.forEach((position, index) => {
    const ring = createRing(position, index);
    scene.add(ring);
    hoverRings.push(ring);
    
    // Create collision debug circle
    const collisionCircle = createCollisionDebugCircle(position, index);
    scene.add(collisionCircle);
    collisionCircles.push(collisionCircle);
  });
  
  console.log(`Hover Game initialized with ${hoverRings.length} rings`);
  
  // Start the game
  startHoverGame();

  // Bridge: react to hoverboard mount/dismount for HUD/game visibility
  attachHoverboardEventListeners();
}

function attachHoverboardEventListeners() {
  if (listenersAttached) return;
  const onMounted = () => {
    if (!hoverHUDInitialized) {
      createHoverHUD();
    }
    updateHoverHUD(ringsPassed, totalRings, false);
    showHoverHUD();
  };
  const onDismounted = () => {
    hideHoverHUD();
  };
  window.addEventListener('hoverboard:mounted', onMounted);
  window.addEventListener('hoverboard:dismounted', onDismounted);
  // Store refs for cleanup
  attachHoverboardEventListeners._mounted = onMounted;
  attachHoverboardEventListeners._dismounted = onDismounted;
  listenersAttached = true;
}

// Start the hover game
function startHoverGame() {
  gameActive = true;
  gameStartTime = performance.now();
  ringsPassed = 0;

  // Reset all rings to unpassed (cyan)
  hoverRings.forEach(ring => updateRingState(ring, 0));

  // Random or first ring as current
  if (hoverRings.length > 0) {
    updateRingState(hoverRings[0], 1); // First ring starts as current
  }

  console.log("Hover Game started! Fly through the rings in any order!");
}


// Update the hover game
/**
 * Per‑frame update for the hover game.
 *
 * - Advances ring shader time uniforms
 * - Lazily creates and shows the HUD once the player mounts the hoverboard
 * - Performs collision tests between the player and each ring while active.
 *
 * @param {number} delta - Frame delta time (seconds).
 */
export function updateHoverGame(delta) {
  if (!gameActive || !hoverRings.length) return;
  
  const time = performance.now() * 0.001;

  // Initialize and show HUD once the player enters the hoverboard
  if (window.isPlayerOnHoverboard && !hoverHUDInitialized) {
    createHoverHUD();
    updateHoverHUD(ringsPassed, totalRings, false);
    showHoverHUD();
  }
  
  // Update ring shader uniforms
  hoverRings.forEach(ring => {
    if (ring.material.uniforms) {
      ring.material.uniforms.time.value = time;
    }
  });
  
  // Check for ring collisions
  if (playerRef && window.isPlayerOnHoverboard) {
    checkRingCollisions();
  }
}

// Check for collisions with rings
function checkRingCollisions() {
  if (!playerRef || !gameActive) return;

  const playerPosition = new THREE.Vector3();
  playerRef.getWorldPosition(playerPosition);
  const innerRadius = RING_CONFIG.radius - RING_CONFIG.thickness * 0.6;

  hoverRings.forEach((ring, index) => {
    if (ring.userData.passed) return;

    const ringPosition = new THREE.Vector3();
    ring.getWorldPosition(ringPosition);
    const ringNormal = new THREE.Vector3(0, 0, 1);
    ring.getWorldQuaternion(_tmpQuat);
    ringNormal.applyQuaternion(_tmpQuat);

    const toPlayer = playerPosition.clone().sub(ringPosition);
    const distanceToPlane = Math.abs(toPlayer.dot(ringNormal));
    const projectedPoint = playerPosition.clone().sub(ringNormal.clone().multiplyScalar(distanceToPlane));
    const distanceFromCenter = projectedPoint.distanceTo(ringPosition);

    const isWithinRing = distanceFromCenter <= innerRadius;
    const isCloseToPlane = distanceToPlane <= 2.5;
    const isPassingThrough = isWithinRing && isCloseToPlane;

    // Debug circles
    if (collisionCircles[index]) {
      collisionCircles[index].scale.setScalar(innerRadius);
      collisionCircles[index].position.copy(ringPosition);
      collisionCircles[index].quaternion.copy(_tmpQuat);
      if (showCollisionDebug) {
        collisionCircles[index].material.color.setHex(isPassingThrough ? 0x00ff00 : 0xff0000);
      }
    }

    if (isPassingThrough) {
      // Mark this ring passed
      ring.userData.passed = true;
      ringsPassed++;
      updateRingState(ring, 2); // Passed = green

      // Pick any other unpassed ring and mark as current
      const nextRing = hoverRings.find(r => !r.userData.passed);
      if (nextRing) {
        updateRingState(nextRing, 1); // Orange = current
      }

      playRingPassSound();
      console.log(`Ring ${index + 1} passed! (${ringsPassed}/${totalRings})`);

      updateHoverHUD(ringsPassed, totalRings, true);

      // Win condition (any 10 rings)
      if (ringsPassed >= totalRings) {
        completeHoverGame();
      }
    }
  });
}


// Play ring pass sound effect
function playRingPassSound() {
  // You can integrate with your audio system here
  // For now, just log
  console.log("Ring pass sound effect");
}

// Complete the hover game
function completeHoverGame() {
  gameActive = false;
  gameEndTime = performance.now();
  const completionTime = (gameEndTime - gameStartTime) / 1000;
  
  console.log(`Hover Game completed in ${completionTime.toFixed(2)} seconds!`);
  // Ensure HUD shows 10/10 and trigger celebration flash
  updateHoverHUD(totalRings, totalRings, true, true);
  // Transform HUD into completion banner then remove
  transformHUDToCompletionAndRemove();
  
  // You can add completion effects here
  showGameCompletionEffect(completionTime);
}

// Show game completion effect
function showGameCompletionEffect(completionTime) {
  // Create a completion message or effect
  console.log(`Congratulations! You completed the hover game in ${completionTime.toFixed(2)} seconds!`);
  
  // You can add visual effects, UI updates, or rewards here
}

// Reset the hover game
/**
 * Soft‑resets ring state and HUD without destroying meshes.
 *
 * Useful when the player wants to try again without leaving Scene 2.
 */
export function resetHoverGame() {
  gameActive = false;
  ringsPassed = 0;
  gameStartTime = null;
  gameEndTime = null;
  
  // Reset all rings
  hoverRings.forEach((ring, index) => {
    ring.userData.passed = false;
    ring.userData.isCurrent = index === 0;
    updateRingState(ring, index === 0 ? 1 : 0);
  });
  
  // Reset HUD visuals; keep visible only if player is still on hoverboard
  if (hoverHUDInitialized) {
    resetHoverHUDLayout();
    updateHoverHUD(0, totalRings, false);
    if (!window.isPlayerOnHoverboard) hideHoverHUD();
  }
  
  console.log("Hover Game reset");
}

// Clean up the hover game
/**
 * Fully removes all hover game resources from the scene and DOM.
 *
 * - Removes rings and collision debug circles from `sceneRef`
 * - Disposes geometries/materials
 * - Clears references and destroys the HUD
 * - Detaches hoverboard event listeners.
 */
export function cleanupHoverGame() {
  gameActive = false;
  
  // Remove all rings from scene
  hoverRings.forEach(ring => {
    if (sceneRef) {
      sceneRef.remove(ring);
    }
    if (ring.material) {
      ring.material.dispose();
    }
  });
  
  // Remove all collision debug circles from scene
  collisionCircles.forEach(circle => {
    if (sceneRef) {
      sceneRef.remove(circle);
    }
    if (circle.material) {
      circle.material.dispose();
    }
    if (circle.geometry) {
      circle.geometry.dispose();
    }
  });
  
  // Dispose geometry
  if (ringGeometry) {
    ringGeometry.dispose();
  }
  
  // Clear arrays
  hoverRings = [];
  collisionCircles = [];
  ringGeometry = null;
  sceneRef = null;
  playerRef = null;
  
  console.log("Hover Game cleaned up");

  // Remove HUD from DOM
  destroyHoverHUD();

  // Detach hoverboard event listeners
  if (listenersAttached) {
    if (attachHoverboardEventListeners._mounted) {
      window.removeEventListener('hoverboard:mounted', attachHoverboardEventListeners._mounted);
    }
    if (attachHoverboardEventListeners._dismounted) {
      window.removeEventListener('hoverboard:dismounted', attachHoverboardEventListeners._dismounted);
    }
    listenersAttached = false;
  }
}

// Get game statistics
/**
 * Returns the current or final state of the hover game.
 *
 * @returns {{active:boolean,ringsPassed:number,totalRings:number,completionTime:number|null}}
 */
export function getHoverGameStats() {
  return {
    active: gameActive,
    ringsPassed: ringsPassed,
    totalRings: totalRings,
    completionTime: gameEndTime ? (gameEndTime - gameStartTime) / 1000 : null
  };
}

// Toggle collision debug visualization
/**
 * Toggles visibility of flat debug circles that show ring collision areas.
 *
 * @returns {boolean} Whether collision debug is now enabled.
 */
export function toggleCollisionDebug() {
  showCollisionDebug = !showCollisionDebug;
  
  collisionCircles.forEach(circle => {
    circle.visible = showCollisionDebug;
  });
  
  console.log(`Collision debug visualization: ${showCollisionDebug ? 'ON' : 'OFF'}`);
  return showCollisionDebug;
}

// Set collision debug visualization
/**
 * Explicitly sets collision debug visibility instead of toggling.
 *
 * @param {boolean} visible - True to show debug circles, false to hide.
 */
export function setCollisionDebug(visible) {
  showCollisionDebug = visible;
  
  collisionCircles.forEach(circle => {
    circle.visible = showCollisionDebug;
  });
  
  console.log(`Collision debug visualization: ${showCollisionDebug ? 'ON' : 'OFF'}`);
}

// Export ring positions for external use
export { RING_POSITIONS, RING_CONFIG };

// =========================
// HUD IMPLEMENTATION
// =========================

function createHoverHUD() {
  if (hoverHUDInitialized) return;
  hoverHUDInitialized = true;

  // Create container
  hoverHUDContainer = document.createElement('div');
  hoverHUDContainer.id = 'hover-hud';
  hoverHUDContainer.style.position = 'fixed';
  hoverHUDContainer.style.top = '16px';
  hoverHUDContainer.style.left = '50%';
  hoverHUDContainer.style.transform = 'translateX(-50%)';
  hoverHUDContainer.style.zIndex = '9999';
  hoverHUDContainer.style.display = 'flex';
  hoverHUDContainer.style.flexDirection = 'column';
  hoverHUDContainer.style.alignItems = 'center';
  hoverHUDContainer.style.pointerEvents = 'none';
  hoverHUDContainer.style.opacity = '0';
  hoverHUDContainer.style.transition = 'opacity 300ms ease';

  // Label + counter row
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'baseline';
  row.style.gap = '10px';

  hoverHUDLabel = document.createElement('div');
  hoverHUDLabel.textContent = 'Rings';
  hoverHUDLabel.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
  hoverHUDLabel.style.fontWeight = '700';
  hoverHUDLabel.style.letterSpacing = '0.08em';
  hoverHUDLabel.style.fontSize = '14px';
  hoverHUDLabel.style.textTransform = 'uppercase';
  hoverHUDLabel.style.color = '#7efcff';
  hoverHUDLabel.style.textShadow = '0 0 8px rgba(126,252,255,0.7)';

  hoverHUDCounter = document.createElement('div');
  hoverHUDCounter.textContent = '0/10';
  hoverHUDCounter.style.fontFamily = hoverHUDLabel.style.fontFamily;
  hoverHUDCounter.style.fontWeight = '800';
  hoverHUDCounter.style.fontSize = '22px';
  hoverHUDCounter.style.color = '#ffffff';
  hoverHUDCounter.style.textShadow = '0 0 12px rgba(255,255,255,0.65), 0 0 24px rgba(0,255,170,0.45)';
  hoverHUDCounter.style.filter = 'drop-shadow(0 0 6px rgba(0,255,170,0.5))';
  hoverHUDCounter.style.transition = 'transform 180ms ease, filter 220ms ease';

  row.appendChild(hoverHUDLabel);
  row.appendChild(hoverHUDCounter);

  // Progress bar container
  hoverHUDBar = document.createElement('div');
  hoverHUDBar.style.position = 'relative';
  hoverHUDBar.style.width = '420px';
  hoverHUDBar.style.maxWidth = '60vw';
  hoverHUDBar.style.height = '12px';
  hoverHUDBar.style.marginTop = '10px';
  hoverHUDBar.style.borderRadius = '999px';
  hoverHUDBar.style.background = 'linear-gradient(180deg, rgba(20,30,40,0.75), rgba(15,20,30,0.75))';
  hoverHUDBar.style.boxShadow = 'inset 0 0 0 1px rgba(126,252,255,0.25), 0 0 16px rgba(0,255,170,0.20)';
  hoverHUDBar.style.overflow = 'hidden';

  // Fill
  hoverHUDBarFill = document.createElement('div');
  hoverHUDBarFill.style.position = 'absolute';
  hoverHUDBarFill.style.left = '0';
  hoverHUDBarFill.style.top = '0';
  hoverHUDBarFill.style.bottom = '0';
  hoverHUDBarFill.style.width = '0%';
  hoverHUDBarFill.style.borderRadius = '999px';
  hoverHUDBarFill.style.background = 'linear-gradient(90deg, #00ffff 0%, #00ff88 50%, #00ff44 100%)';
  hoverHUDBarFill.style.boxShadow = '0 0 18px rgba(0,255,170,0.55), 0 0 36px rgba(0,255,255,0.35)';
  hoverHUDBarFill.style.transition = 'width 400ms cubic-bezier(0.2, 0.8, 0.2, 1)';

  // Gloss/shine overlay
  const gloss = document.createElement('div');
  gloss.style.position = 'absolute';
  gloss.style.left = '0';
  gloss.style.right = '0';
  gloss.style.top = '0';
  gloss.style.height = '50%';
  gloss.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0))';
  gloss.style.pointerEvents = 'none';

  // Soft glow halo behind bar
  hoverHUDGlow = document.createElement('div');
  hoverHUDGlow.style.position = 'absolute';
  hoverHUDGlow.style.left = '50%';
  hoverHUDGlow.style.top = '50%';
  hoverHUDGlow.style.width = '520px';
  hoverHUDGlow.style.height = '40px';
  hoverHUDGlow.style.transform = 'translate(-50%, -50%)';
  hoverHUDGlow.style.borderRadius = '999px';
  hoverHUDGlow.style.background = 'radial-gradient(ellipse at center, rgba(0,255,170,0.25), rgba(0,0,0,0))';
  hoverHUDGlow.style.filter = 'blur(10px)';
  hoverHUDGlow.style.zIndex = '-1';
  hoverHUDGlow.style.opacity = '0.6';
  hoverHUDGlow.style.transition = 'opacity 250ms ease';

  hoverHUDBar.appendChild(hoverHUDBarFill);
  hoverHUDBar.appendChild(gloss);
  hoverHUDContainer.appendChild(row);
  hoverHUDContainer.appendChild(hoverHUDBar);
  hoverHUDContainer.appendChild(hoverHUDGlow);

  document.body.appendChild(hoverHUDContainer);
}

function showHoverHUD() {
  if (!hoverHUDInitialized || hoverHUDVisible) return;
  hoverHUDVisible = true;
  hoverHUDContainer.style.opacity = '1';
}

function hideHoverHUD() {
  if (!hoverHUDInitialized || !hoverHUDVisible) return;
  hoverHUDVisible = false;
  hoverHUDContainer.style.opacity = '0';
}

function destroyHoverHUD() {
  hoverHUDInitialized = false;
  hoverHUDVisible = false;
  if (hoverHUDContainer && hoverHUDContainer.parentElement) {
    hoverHUDContainer.parentElement.removeChild(hoverHUDContainer);
  }
  hoverHUDContainer = null;
  hoverHUDLabel = null;
  hoverHUDCounter = null;
  hoverHUDBar = null;
  hoverHUDBarFill = null;
  hoverHUDGlow = null;
}

function updateHoverHUD(passed, total, animate, celebrate = false) {
  if (!hoverHUDInitialized) return;

  const clampedPassed = Math.max(0, Math.min(passed, total));
  const pct = total > 0 ? (clampedPassed / total) * 100 : 0;
  if (hoverHUDCounter) hoverHUDCounter.textContent = `${clampedPassed}/${total}`;
  if (hoverHUDBarFill) hoverHUDBarFill.style.width = `${pct}%`;

  if (animate) {
    // Counter bump/glow
    if (hoverHUDCounter) {
      hoverHUDCounter.style.transform = 'scale(1.12)';
      hoverHUDCounter.style.filter = 'drop-shadow(0 0 10px rgba(0,255,170,0.85))';
      setTimeout(() => {
        if (!hoverHUDCounter) return;
        hoverHUDCounter.style.transform = 'scale(1)';
        hoverHUDCounter.style.filter = 'drop-shadow(0 0 6px rgba(0,255,170,0.5))';
      }, 180);
    }
    // Glow pulse
    if (hoverHUDGlow) {
      hoverHUDGlow.style.opacity = '0.95';
      setTimeout(() => {
        if (!hoverHUDGlow) return;
        hoverHUDGlow.style.opacity = '0.6';
      }, 220);
    }
  }

  if (celebrate) {
    // Brief celebratory flash across the bar
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.left = '0';
    flash.style.top = '0';
    flash.style.bottom = '0';
    flash.style.width = '100%';
    flash.style.background = 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)';
    flash.style.pointerEvents = 'none';
    flash.style.transform = 'translateX(-100%)';
    flash.style.filter = 'blur(2px)';
    flash.style.mixBlendMode = 'screen';
    flash.style.transition = 'transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    hoverHUDBar.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (flash && flash.parentElement) flash.parentElement.removeChild(flash);
      }, 650);
    });
  }
}

// Transform existing HUD into a completion banner, then fade and remove
function transformHUDToCompletionAndRemove() {
  if (!hoverHUDInitialized || !hoverHUDContainer) return;

  // Hide progress bar and counter
  if (hoverHUDBar) hoverHUDBar.style.display = 'none';
  if (hoverHUDCounter) hoverHUDCounter.style.display = 'none';

  // Convert label to big celebratory text
  if (hoverHUDLabel) {
    hoverHUDLabel.textContent = 'Hurray! Completed';
    hoverHUDLabel.style.fontSize = '24px';
    hoverHUDLabel.style.letterSpacing = '0.1em';
    hoverHUDLabel.style.color = '#7efcff';
    hoverHUDLabel.style.textShadow = '0 0 14px rgba(126,252,255,0.9), 0 0 30px rgba(0,255,170,0.55)';
  }

  // Brief glow pulse via the halo
  if (hoverHUDGlow) {
    hoverHUDGlow.style.opacity = '1';
    setTimeout(() => {
      if (hoverHUDGlow) hoverHUDGlow.style.opacity = '0.6';
    }, 250);
  }

  // Auto remove after short delay
  setTimeout(() => {
    if (!hoverHUDContainer) return;
    hoverHUDContainer.style.opacity = '0';
    setTimeout(() => {
      destroyHoverHUD();
    }, 280);
  }, 1600);
}

// Restore HUD widgets/layout after reset if still on hoverboard
function resetHoverHUDLayout() {
  if (!hoverHUDInitialized) return;
  if (hoverHUDLabel) {
    hoverHUDLabel.textContent = 'Rings';
    hoverHUDLabel.style.fontSize = '14px';
    hoverHUDLabel.style.letterSpacing = '0.08em';
    hoverHUDLabel.style.textShadow = '0 0 8px rgba(126,252,255,0.7)';
  }
  if (hoverHUDCounter) {
    hoverHUDCounter.style.display = '';
  }
  if (hoverHUDBar) {
    hoverHUDBar.style.display = '';
  }
  if (hoverHUDContainer) {
    hoverHUDContainer.style.opacity = '1';
  }
}
