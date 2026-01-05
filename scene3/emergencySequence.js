import * as THREE from "three";
import gsap from "gsap";
import { initializeFallingEffect, updateFallingEffect, cleanupFallingEffect } from './fallingEffect.js';
import { allAssets } from "../commonFiles/assetsLoader.js";

/**
 * @fileoverview Scene 3 emergency / collapse sequence controller.
 *
 * This module drives a dramatic “emergency” beat that is triggered after the
 * Electro sequence completes (listening to the `electroSequenceComplete` event).
 *
 * High-level phases:
 * - **Initialize** (`initializeEmergency`): capture original scene state, set up
 *   overlays (fade plane, vignette), create particle systems, and wire event listeners.
 * - **Start** (`startEmergencySequence` internal): turn off lights, start shake,
 *   spawn debris/particles, and begin the collapse/falling presentation.
 * - **Update** (`updateEmergency`): per-frame simulation for particles/debris and
 *   “falling” camera motion, eventually fading out to a dedicated falling effect.
 * - **Cleanup** (`cleanupEmergency`): dispose resources and restore state.
 *
 * Integration notes:
 * - This module expects access to the active `camera` (to attach overlay meshes).
 * - It depends on `fallingEffect.js` for the final fade-to-falling transition.
 * - It uses module-level state to coordinate intervals and long-running effects.
 *
 * ⚠️ Cleanup: `initializeEmergency` registers a window event listener for
 * `electroSequenceComplete`. If your scene is recreated frequently, consider
 * refactoring to store/remove that listener to prevent duplicates.
 */

// --- Module state (kept here so async callbacks can access current references) ---
let isEmergencyActive = false;
let emergencyAudio = null;
let originalLightIntensity = 1;
let originalAmbientIntensity = 1;
let originalSceneBackground = null;
let originalSceneEnvironment = null;
let originalInteriorPosition = null;
let originalInteriorRotation = null;
let originalCameraPosition = null;
let originalCameraRotation = null;
let originalControlsTarget = null;
let originalControlsEnabled = true;
let originalPlayerControlsEnabled = true;
let fallingPieces = [];
let fallingParticles = [];
let debrisGravity = 0.007;
let isFalling = false;
let playerVelocity = new THREE.Vector3();
let cameraOffset = new THREE.Vector3(0, 1.5, -3);
let emergencyTriggered = false;
let emergencyTriggerDistance = 2;
let emergencyTriggerPosition = new THREE.Vector3(-55, 2.5, -135);
let emergencyBlinkInterval = null;
let emergencyShakeInterval = null;
let emergencyCollapseInterval = null;
let playerLight = null;
let vignetteEffect = null;
let triggerMesh = null;
let particleSystem = null;
let cometSystem = null;
let fallingDebrisSystem = null;
let particleShaderMaterial = null;
let cometShaderMaterial = null;
let debrisShaderMaterial = null;
let isNearTriggerMesh = false;
let debugInfo = { distance: 0, triggered: false };
let spaceParticles = [];
let rockPieces = [];
let emergencyStartTime = 0;
let fallingRocks = [];
let isFadeOutActive = false;
let currentScene = null;
let originalObjects = [];
let playerSpotLight = null;
let fallingBlocks = [];
let fallCharacter = null;
let fallMixer = null;
let fallAnimation = null;
let fallCharacterLight = null;
let currentCamera = null;

//define fadeout material
let fadeOutMaterial = null;
let fadeOutPlane = null;

/**
 * Initialize the emergency system for Scene 3.
 *
 * This function does *not* necessarily start the emergency immediately; instead,
 * it prepares required objects and listens for `electroSequenceComplete`.
 *
 * Responsibilities:
 * - Capture original scene/camera/lighting state for restoration.
 * - Attach a full-screen fade plane to the camera (used during fade-out).
 * - Create player-local lighting to maintain visibility after lights go out.
 * - Create vignette overlay + particle systems.
 * - Wire an `electroSequenceComplete` listener which triggers the emergency beat.
 *
 * @param {THREE.Scene} scene
 * @param {any} allAssets Registry from `assetsLoader` (must contain `audios.emergency`)
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D} interiorModel Environment model (optional)
 * @param {THREE.Object3D} player Player object (optional)
 * @returns {{checkEmergencyTrigger: Function, cleanupEmergency: Function}}
 */
export function initializeEmergency(scene, allAssets, camera, interiorModel, player) {
  console.log("Initializing emergency sequence");
  currentScene = scene;
  currentCamera = camera;
  
  // Store original values
  if (scene.background) originalSceneBackground = scene.background.clone();
  if (scene.environment) {
    originalSceneEnvironment = scene.environment.clone();
    if (scene.environment.intensity !== undefined) {
      originalEnvMapIntensity = scene.environment.intensity;
    }
  }
  
  // Store original objects for later restoration
  scene.traverse((object) => {
    if (object.isMesh || object.isLight) {
      originalObjects.push({
        object: object,
        visible: object.visible,
        intensity: object.isLight ? object.intensity : null
      });
    }
  });
  
  // Create trigger sphere with warning effect
  // const triggerGeometry = new THREE.SphereGeometry(1, 32, 32);
  // const triggerMaterial = new THREE.MeshStandardMaterial({
  //   color: 0xff0000,
  //   emissive: 0xff0000,
  //   emissiveIntensity: 0.5,
  //   transparent: true,
  //   opacity: 0.3
  // });
  
  // triggerMesh = new THREE.Mesh(triggerGeometry, triggerMaterial);
  // triggerMesh.position.set(-55, 2.5, -135);
  // scene.add(triggerMesh);
  // console.log("Created trigger sphere at:", triggerMesh.position);

  // Create fade out plane
  const planeGeometry = new THREE.PlaneGeometry(2, 2);
  fadeOutMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0
  });
  fadeOutPlane = new THREE.Mesh(planeGeometry, fadeOutMaterial);
  fadeOutPlane.renderOrder = 9999;
  camera.add(fadeOutPlane);
  
  if (interiorModel) {
    originalInteriorPosition = interiorModel.position.clone();
    originalInteriorRotation = interiorModel.rotation.clone();
  }
  
  if (camera) {
    originalCameraPosition = camera.position.clone();
    originalCameraRotation = camera.rotation.clone();
    
    if (camera.userData && camera.userData.controls) {
      originalControlsTarget = camera.userData.controls.target.clone();
      originalControlsEnabled = camera.userData.controls.enabled;
    }
  }
  
  // Get emergency audio
  if (allAssets.audios.emergency) {
    emergencyAudio = allAssets.audios.emergency;
    emergencyAudio.setLoop(true);
  }
  
  // Store original light intensities
  scene.traverse((object) => {
    if (object.isDirectionalLight) {
      originalLightIntensity = object.intensity;
    }
    if (object.isAmbientLight) {
      originalAmbientIntensity = object.intensity;
    }
  });
  
  // Create a light for the player
  playerLight = new THREE.PointLight(0xffffff, 1, 10);
  playerLight.position.set(0, 1, 0);
  if (player) {
    player.add(playerLight);
  }
  
  // Create spotlight for player
  playerSpotLight = new THREE.SpotLight(0xffffff, 2);
  playerSpotLight.angle = Math.PI / 4;
  playerSpotLight.penumbra = 0.5;
  playerSpotLight.decay = 2;
  playerSpotLight.distance = 10;
  if (player) {
    player.add(playerSpotLight);
  }
  
  // Create vignette effect
  createVignetteEffect(scene, camera);
  
  // Create particle systems
  createParticleSystems(scene);
  
  // Create fall character
  if (allAssets.characters.models.fallcharacter) {
    fallCharacter = allAssets.characters.models.fallcharacter.clone();
    scene.add(fallCharacter);
    fallCharacter.visible = false;
    fallCharacter.position.set(0, 2, 0);
    
    // Add light to fall character
    fallCharacterLight = new THREE.SpotLight(0xffffff, 2);
    fallCharacterLight.angle = Math.PI / 4;
    fallCharacterLight.penumbra = 0.5;
    fallCharacterLight.decay = 2;
    fallCharacterLight.distance = 10;
    fallCharacter.add(fallCharacterLight);
    
    // Get fall animation
    if (allAssets.characters.animations.fallcharacter) {
      fallMixer = allAssets.characters.animations.fallcharacter.mixer;
      const animations = allAssets.characters.animations.fallcharacter.actions;
      if (animations.Fall_Armature) {
        fallAnimation = animations.Fall_Armature;
        fallAnimation.setEffectiveTimeScale(1.0);
      }
    }
  }
  
  // Listen for electro sequence completion event
  window.addEventListener('electroSequenceComplete', (event) => {
    console.log("Received electroSequenceComplete event", event.detail);
    
    // Find the Icosphere first
    const icosphere = scene.getObjectByName('Icosphere');
    if (!icosphere) {
      console.error("Icosphere not found in scene!");
      return;
    }
    
    console.log("Found Icosphere at position:", icosphere.position);
    
    // Set emergency trigger position to player's current position
    if (player) {
      const playerPosition = new THREE.Vector3();
      playerPosition.setFromMatrixPosition(player.matrixWorld);
      emergencyTriggerPosition.copy(playerPosition);
      console.log("Set emergency trigger position to player position:", emergencyTriggerPosition);
    }
    
    // Trigger emergency sequence
    startEmergencySequence(camera, interiorModel, scene, player);
    emergencyTriggered = true;
  });
  
  return {
    checkEmergencyTrigger,
    cleanupEmergency
  };
}

/**
 * Create a vignette overlay that darkens screen edges.
 *
 * Implementation:
 * - A shader plane is added as a child of the camera.
 * - A separate DOM overlay is also injected for an extra “full-screen” vignette feel.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 */
function createVignetteEffect(scene, camera) {
  console.log("Creating vignette effect");
  
  // Create a vignette effect using a plane with a radial gradient
  const vignetteGeometry = new THREE.PlaneGeometry(2, 2);
  const vignetteMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0x000000) },
      opacity: { value: 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float dist = length(vUv - vec2(0.5));
        float vignette = smoothstep(0.5, 0.2, dist);
        gl_FragColor = vec4(color, vignette * opacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  
  vignetteEffect = new THREE.Mesh(vignetteGeometry, vignetteMaterial);
  vignetteEffect.renderOrder = 9999; // Render on top of everything
  
  // Add to camera
  if (camera) {
    camera.add(vignetteEffect);
    console.log("Added vignette effect to camera");
  }
  
  // Also add to canvas for full-screen effect
  const canvas = document.querySelector('canvas');
  if (canvas) {
    const canvasVignette = document.createElement('div');
    canvasVignette.style.position = 'absolute';
    canvasVignette.style.top = '0';
    canvasVignette.style.left = '0';
    canvasVignette.style.width = '100%';
    canvasVignette.style.height = '100%';
    canvasVignette.style.pointerEvents = 'none';
    canvasVignette.style.background = 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.7) 100%)';
    canvasVignette.style.opacity = '0';
    canvasVignette.style.transition = 'opacity 1s';
    canvasVignette.id = 'canvas-vignette';
    document.body.appendChild(canvasVignette);
    console.log("Added canvas vignette effect");
  }
}

/**
 * Create particle systems used during the emergency sequence:
 * - ambient particles
 * - comets (larger streak-like particles)
 * - debris particles
 *
 * These are created once and toggled visible during the emergency start.
 *
 * @param {THREE.Scene} scene
 */
function createParticleSystems(scene) {
  // Create particle shader material
  particleShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0xffffff) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float alpha = 1.0 - length(vUv - vec2(0.5));
        alpha = smoothstep(0.0, 0.5, alpha);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  });

  // Create comet shader material
  cometShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0xff0000) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float alpha = 1.0 - length(vUv - vec2(0.5));
        alpha = smoothstep(0.0, 0.5, alpha);
        gl_FragColor = vec4(color, alpha * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false
  });

  // Create debris shader material
  debrisShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0x888888) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float alpha = 1.0 - length(vUv - vec2(0.5));
        alpha = smoothstep(0.0, 0.5, alpha);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  });

  // Create particle system
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 1000;
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = Math.random() * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    
    velocities[i * 3] = (Math.random() - 0.5) * 0.1;
    velocities[i * 3 + 1] = -Math.random() * 0.2;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    
    sizes[i] = Math.random() * 0.1;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  particleSystem = new THREE.Points(particleGeometry, particleShaderMaterial);
  scene.add(particleSystem);

  // Create comet system
  const cometGeometry = new THREE.BufferGeometry();
  const cometCount = 2;
  const cometPositions = new Float32Array(cometCount * 3);
  const cometVelocities = new Float32Array(cometCount * 3);
  const cometSizes = new Float32Array(cometCount);

  for (let i = 0; i < cometCount; i++) {
    cometPositions[i * 3] = (Math.random() - 0.5) * 20;
    cometPositions[i * 3 + 1] = Math.random() * 30;
    cometPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    
    cometVelocities[i * 3] = (Math.random() - 0.5) * 0.2;
    cometVelocities[i * 3 + 1] = -Math.random() * 0.5;
    cometVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    
    cometSizes[i] = Math.random() * 0.3 + 0.1;
  }

  cometGeometry.setAttribute('position', new THREE.BufferAttribute(cometPositions, 3));
  cometGeometry.setAttribute('velocity', new THREE.BufferAttribute(cometVelocities, 3));
  cometGeometry.setAttribute('size', new THREE.BufferAttribute(cometSizes, 1));

  cometSystem = new THREE.Points(cometGeometry, cometShaderMaterial);
  scene.add(cometSystem);

  // Create falling debris system
  const debrisGeometry = new THREE.BufferGeometry();
  const debrisCount = 200;
  const debrisPositions = new Float32Array(debrisCount * 3);
  const debrisVelocities = new Float32Array(debrisCount * 3);
  const debrisSizes = new Float32Array(debrisCount);

  for (let i = 0; i < debrisCount; i++) {
    debrisPositions[i * 3] = (Math.random() - 0.5) * 15;
    debrisPositions[i * 3 + 1] = Math.random() * 25;
    debrisPositions[i * 3 + 2] = (Math.random() - 0.5) * 15;
    
    debrisVelocities[i * 3] = (Math.random() - 0.5) * 0.3;
    debrisVelocities[i * 3 + 1] = -Math.random() * 0.7;
    debrisVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    
    debrisSizes[i] = Math.random() * 0.5 + 0.2;
  }

  debrisGeometry.setAttribute('position', new THREE.BufferAttribute(debrisPositions, 3));
  debrisGeometry.setAttribute('velocity', new THREE.BufferAttribute(debrisVelocities, 3));
  debrisGeometry.setAttribute('size', new THREE.BufferAttribute(debrisSizes, 1));

  fallingDebrisSystem = new THREE.Points(debrisGeometry, debrisShaderMaterial);
  scene.add(fallingDebrisSystem);
}

/**
 * Optional proximity-trigger flow (currently depends on `triggerMesh` which may be disabled).
 *
 * If enabled, this checks distance to a trigger mesh and starts the emergency
 * when the player gets close enough.
 *
 * @param {THREE.Object3D} player
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D} interiorModel
 * @param {THREE.Scene} scene
 */
export function checkEmergencyTrigger(player, camera, interiorModel, scene) {
  if (emergencyTriggered || !player || !triggerMesh) return;
  
  // Calculate distance to trigger mesh
  const playerPosition = new THREE.Vector3();
  playerPosition.setFromMatrixPosition(player.matrixWorld);
  const distanceToTrigger = playerPosition.distanceTo(triggerMesh.position);
  
  // Update debug info
  debugInfo.distance = distanceToTrigger;
  
  // Log distance every second for debugging
  // if (Math.floor(performance.now() / 1000) % 1 === 0) {
  //   console.log("Distance to emergency trigger:", distanceToTrigger.toFixed(2));
  // }
  
  // Check if player is within trigger distance (5 units)
  if (distanceToTrigger <= 5 && !emergencyTriggered) {
    // console.log("Emergency trigger activated! Distance:", distanceToTrigger.toFixed(2));
    emergencyTriggered = true;
    
    // Start the emergency sequence
    startEmergencySequence(camera, interiorModel, scene, player);
  }
}





function startEmergencySequence(camera, interiorModel, scene, player) {
  if (isEmergencyActive) return;
  isEmergencyActive = true;
  emergencyStartTime = performance.now();
  currentCamera = camera;
  
  console.log("Starting emergency sequence");
  
  // Play emergency audio
  if (emergencyAudio) {
    emergencyAudio.play();
  }
  
  // Set trigger position to be in front of camera
  if (camera) {
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    emergencyTriggerPosition.copy(camera.position).add(cameraDirection.multiplyScalar(5));
    emergencyTriggerPosition.y = 0; // Keep at ground level
    console.log("Set emergency trigger position to:", emergencyTriggerPosition);
  }
  
  // Create initial shockwave effect at trigger position
  createShockwaveEffect(scene, emergencyTriggerPosition);
  

  
  // Immediately turn off all lights
  turnOffAllLights(scene);
  
  // Start earthquake effect
  startEarthquakeEffect(camera);
  
  // Start particle systems with increased visibility
  if (particleSystem && cometSystem && fallingDebrisSystem) {
    particleSystem.visible = true;
    cometSystem.visible = true;
    fallingDebrisSystem.visible = true;
    
    // Position particle systems in front of camera
    if (camera) {
      const cameraDirection = new THREE.Vector3(0, 0, -1);
      cameraDirection.applyQuaternion(camera.quaternion);
      const particlePosition = new THREE.Vector3();
      particlePosition.copy(camera.position).add(cameraDirection.multiplyScalar(5));
      
      particleSystem.position.copy(particlePosition);
      cometSystem.position.copy(particlePosition);
      fallingDebrisSystem.position.copy(particlePosition);
    }
    
    // Increase particle system sizes
    if (particleSystem.material) {
      particleSystem.material.size = 0.2;
    }
    if (cometSystem.material) {
      cometSystem.material.size = 0.3;
    }
    if (fallingDebrisSystem.material) {
      fallingDebrisSystem.material.size = 0.4;
    }
  }
  
  // Start collapse sequence immediately with more frequent debris
  startCollapseSequence(scene, player);
}

/**
 * Spawn a brief expanding ring as an initial “shockwave” marker.
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} position
 */
function createShockwaveEffect(scene, position) {
  const geometry = new THREE.RingGeometry(1, 1.2, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  
  const shockwave = new THREE.Mesh(geometry, material);
  shockwave.position.copy(position);
  shockwave.rotation.x = Math.PI / 2;
  scene.add(shockwave);
  
  // Animate shockwave
  let scale = 1;
  const animateShockwave = () => {
    scale += 0.1;
    shockwave.scale.set(scale, scale, scale);
    shockwave.material.opacity = Math.max(0, 1 - scale / 10);
    
    if (scale > 10) {
      scene.remove(shockwave);
      return;
    }
    
    requestAnimationFrame(animateShockwave);
  };
  
  animateShockwave();
}

/**
 * Start a camera shake loop to simulate an earthquake.
 * Uses `setInterval` for a deterministic cadence.
 *
 * @param {THREE.Camera} camera
 */
function startEarthquakeEffect(camera) {
  console.log("Starting earthquake effect");
  
  // Store original camera position
  const originalCameraPosition = camera.position.clone();
  const originalCameraRotation = camera.rotation.clone();
  
  // Create earthquake shake effect
  emergencyShakeInterval = setInterval(() => {
    if (camera) {
      // Random camera shake with varying intensity
      let shakeIntensity = 0.1;
      const shakeAmount = Math.random() * shakeIntensity;
      
      // Apply shake to camera position with more realistic movement
      camera.position.x = originalCameraPosition.x + (Math.random() - 0.5) * shakeAmount;
      camera.position.y = originalCameraPosition.y + (Math.random() - 0.5) * shakeAmount;
      camera.position.z = originalCameraPosition.z + (Math.random() - 0.5) * shakeAmount;
      
      // Apply shake to camera rotation with more realistic movement
      camera.rotation.x = originalCameraRotation.x + (Math.random() - 0.5) * shakeAmount * 0.1;
      camera.rotation.y = originalCameraRotation.y + (Math.random() - 0.5) * shakeAmount * 0.1;
      camera.rotation.z = originalCameraRotation.z + (Math.random() - 0.5) * shakeAmount * 0.1;
      
      // Gradually increase shake intensity
      if (shakeIntensity < 1.0) {
        shakeIntensity += 0.0001;
      }
    }
  }, 50); // Update every 50ms for smooth effect
}

/**
 * Turn off all lights in the scene except the player-local light(s),
 * darken background/environment, and increase vignette intensity.
 *
 * @param {THREE.Scene} scene
 */
function turnOffAllLights(scene) {
  console.log("Turning off all lights");
  
  // Turn off all lights except player light and spotlight
  scene.traverse((object) => {
    if (object.isLight && object !== playerLight && object !== playerSpotLight) {
      object.intensity = 0;
   
    }
  });
  
  // Darken scene background
  if (scene.background) {
    if (scene.background.isColor) {
      scene.background.set(0x000000);
    } else if (scene.background.isCubeTexture) {
      scene.background = new THREE.Color(0x000000);
    }
  }
  
  // Darken environment map
  if (scene.environment && scene.environment.intensity !== undefined) {
    scene.environment.intensity = 0;
  }
  
  // Set vignette effect to full opacity
  if (vignetteEffect && vignetteEffect.material.uniforms) {
    vignetteEffect.material.uniforms.opacity.value = 0.7;
  }
  
  // Show canvas vignette
  const canvasVignette = document.getElementById('canvas-vignette');
  if (canvasVignette) {
    canvasVignette.style.opacity = '1';
  }
}

/**
 * Begin the collapse loop: create floor cracks and periodically spawn debris/particles.
 * Also starts the player falling presentation.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D} player
 */
function startCollapseSequence(scene, player) {
  console.log("Starting collapse sequence");
  
  // Create floor crack effect
  createFloorCracks(scene);
  
  // Start spawning debris and particles more frequently
  emergencyCollapseInterval = setInterval(() => {
    spawnDebris(scene, player);
    spawnParticles(scene, player);
  }, 100); // Reduced interval from 200ms to 100ms
  
  // Start player falling effect immediately
  startPlayerFallingEffect(player);
}

/**
 * Crude floor “crack” effect: perturb floor mesh vertices.
 * This is destructive to geometry and should only be used during the emergency.
 *
 * @param {THREE.Scene} scene
 */
function createFloorCracks(scene) {
  console.log("Creating floor cracks");
  
  // Find floor meshes in the scene
  scene.traverse((object) => {
    if (object.isMesh && object.name.toLowerCase().includes('floor')) {
      // Create crack effect by modifying vertices
      if (object.geometry && object.geometry.attributes.position) {
        const position = object.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          let y = position.getY(i);
          position.setY(i, y - Math.random() * 0.5); // deeper crack
          position.setX(i, position.getX(i) + (Math.random() - 0.5) * 0.2); // horizontal fracture
          position.setZ(i, position.getZ(i) + (Math.random() - 0.5) * 0.2);
        }
        position.needsUpdate = true;
      }
    }
  });
}

/**
 * Spawn a single large debris mesh and add it to the fallingPieces simulation list.
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D} player
 */
function spawnDebris(scene, player) {
  // Create larger debris pieces
  const blockGeo = new THREE.BoxGeometry(
    Math.random() * 3.0 + 2.0,
    Math.random() * 1.5 + 0.8,
    Math.random() * 3.0 + 2.0
  );
  
  const blockMat = new THREE.MeshStandardMaterial({ 
    color: 0x555555, 
    roughness: 0.5, 
    metalness: 1.0,
    emissive: new THREE.Color(0x222222),
    emissiveIntensity: 0.5,
    flatShading: true
  });
  
  const block = new THREE.Mesh(blockGeo, blockMat);
  
  // Position debris in front of camera
  if (currentCamera) {
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(currentCamera.quaternion);
    const debrisPosition = new THREE.Vector3();
    debrisPosition.copy(currentCamera.position).add(cameraDirection.multiplyScalar(5));
    
    // Add random offset within a smaller radius
    const radius = Math.random() * 3;
    const angle = Math.random() * Math.PI * 2;
    debrisPosition.x += Math.cos(angle) * radius;
    debrisPosition.z += Math.sin(angle) * radius;
    debrisPosition.y = 10 + Math.random() * 5; // Start from above
    
    block.position.copy(debrisPosition);
  } else {
    block.position.set(
      (Math.random() - 0.5) * 15,
      10 + Math.random() * 5,
      (Math.random() - 0.5) * 15
    );
  }
  
  block.castShadow = true;
  block.receiveShadow = true;
  
  scene.add(block);
  
  fallingPieces.push({
    mesh: block,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      Math.random() * 1.5,
      (Math.random() - 0.5) * 0.8
    ),
    rotationSpeed: new THREE.Vector3(
      Math.random() * 0.04,
      Math.random() * 0.04,
      Math.random() * 0.04
    )
  });
}

/**
 * Spawn multiple small particle meshes and add them to fallingParticles list.
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D} player
 */
function spawnParticles(scene, player) {
  const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const particleMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });
  
  // Create more particles
  for (let i = 0; i < 30; i++) {
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Position particles in front of camera
    if (currentCamera) {
      const cameraDirection = new THREE.Vector3(0, 0, -1);
      cameraDirection.applyQuaternion(currentCamera.quaternion);
      const particlePosition = new THREE.Vector3();
      particlePosition.copy(currentCamera.position).add(cameraDirection.multiplyScalar(5));
      
      // Add random offset within a smaller radius
      const radius = Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;
      particlePosition.x += Math.cos(angle) * radius;
      particlePosition.z += Math.sin(angle) * radius;
      particlePosition.y = 10 + Math.random() * 5; // Start from above
      
      particle.position.copy(particlePosition);
    } else {
      particle.position.set(
        (Math.random() - 0.5) * 15,
        10 + Math.random() * 5,
        (Math.random() - 0.5) * 15
      );
    }
    
    scene.add(particle);
    
    fallingParticles.push({
      mesh: particle,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      )
    });
  }
}

/**
 * Start the “player is falling” presentation.
 * Note: This does not necessarily move the player object; it drives camera/effects.
 *
 * @param {THREE.Object3D} player
 */
function startPlayerFallingEffect(player) {
  if (!player) return;
  
  console.log("Starting player falling effect");
  
  isFalling = true;
  
  // Set initial velocity (but don't actually move the player)
  playerVelocity.set(
    (Math.random() - 0.5) * 0.1,
    0.07,
    (Math.random() - 0.5) * 0.1
  );
  
  // Start falling animation
  if (player.userData && player.userData.animations) {
    const fallAnimation = player.userData.animations.find(anim => 
      anim.name.toLowerCase().includes('fall') || 
      anim.name.toLowerCase().includes('falling') ||
      anim.name.toLowerCase().includes('jump')
    );
    
    if (fallAnimation) {
      const action = player.userData.mixer.clipAction(fallAnimation);
      action.reset();
      action.play();
      console.log("Playing fall/jump animation:", fallAnimation.name);
    } else {
      console.warn("No fall/jump animation found for player");
    }
  }
  
  // Create space particles and rock pieces immediately
  createSpaceParticles(player);
  createRockPieces(player);
}

/**
 * Create “space” particles around the player to sell the falling-through-void feel.
 * @param {THREE.Object3D} player
 */
function createSpaceParticles(player) {
  console.log("Creating space particles");
  
  const particleGeometry = new THREE.SphereGeometry(0.01, 4, 4);
  const particleMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });
  
  // Create many particles
  for (let i = 0; i < 200; i++) {
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Position particles around player
    if (player) {
      const playerPosition = new THREE.Vector3();
      playerPosition.setFromMatrixPosition(player.matrixWorld);
      
      // Create a sphere of particles around the player
      const radius = Math.random() * 10 + 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      particle.position.set(
        playerPosition.x + radius * Math.sin(phi) * Math.cos(theta),
        playerPosition.y + radius * Math.sin(phi) * Math.sin(theta),
        playerPosition.z + radius * Math.cos(phi)
      );
    }
    
    player.parent.add(particle);
    
    spaceParticles.push({
      mesh: particle,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      ),
      rotationSpeed: new THREE.Vector3(
        Math.random() * 0.02,
        Math.random() * 0.02,
        Math.random() * 0.02
      )
    });
  }
}

/**
 * Create floating rock meshes around the player.
 * @param {THREE.Object3D} player
 */
function createRockPieces(player) {
  console.log("Creating rock pieces");
  
  // Create several rock pieces
  for (let i = 0; i < 30; i++) {
    const rockGeometry = new THREE.DodecahedronGeometry(
      Math.random() * 0.5 + 0.2,
      0
    );
    const rockMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x888888, 
      roughness: 0.8, 
      metalness: 0.2,
      flatShading: true
    });
    
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    
    // Position rocks around player
    if (player) {
      const playerPosition = new THREE.Vector3();
      playerPosition.setFromMatrixPosition(player.matrixWorld);
      
      // Create a sphere of rocks around the player
      const radius = Math.random() * 8 + 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      rock.position.set(
        playerPosition.x + radius * Math.sin(phi) * Math.cos(theta),
        playerPosition.y + radius * Math.sin(phi) * Math.sin(theta),
        playerPosition.z + radius * Math.cos(phi)
      );
    }
    
    rock.castShadow = true;
    rock.receiveShadow = true;
    
    player.parent.add(rock);
    
    rockPieces.push({
      mesh: rock,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      ),
      rotationSpeed: new THREE.Vector3(
        Math.random() * 0.02,
        Math.random() * 0.02,
        Math.random() * 0.02
      )
    });
  }
}

/**
 * Fade the scene to black and initialize the dedicated falling effect.
 * This hides most scene objects and transitions control to `fallingEffect.js`.
 *
 * @param {THREE.Camera} camera
 */
function startFadeOut(camera) {
  if (isFadeOutActive || !currentScene) return;
  
  isFadeOutActive = true;
  
  // Make scene background black
  currentScene.background = new THREE.Color(0x000000);
  
  // Hide all objects except fall character, rocks, and player
  currentScene.traverse((object) => {
    if (object.isMesh || object.isLight) {
      // Keep fall character, its light, and player visible
      if (object === fallCharacter || 
          object === fallCharacterLight || 
          object.parent === fallCharacter || 
          object.parent === fallCharacterLight ||
          object.name === "playerCapsule" || // Keep player visible
          (object.parent && object.parent.name === "playerCapsule")) { // Keep player's children visible
        return;
      }
      // Hide everything else
      object.visible = false;
      if (object.isLight) {
        object.intensity = 0;
      }
    }
  });
  
  // Initialize falling effect
  initializeFallingEffect(currentScene, camera, allAssets);
  
  // Remove vignette effect if it exists
  const canvasVignette = document.getElementById('canvas-vignette');
  if (canvasVignette) {
    canvasVignette.remove();
  }
}

/**
 * Per-frame update for the emergency sequence.
 *
 * Phases:
 * - Before fade-out: update particle systems and camera shake/fall.
 * - After fade-out starts: delegate to `updateFallingEffect(delta)` only.
 *
 * @param {number} delta Seconds since last frame
 * @param {THREE.Object3D} player
 * @param {THREE.Camera} camera
 */
export function updateEmergency(delta, player, camera) {
  if (!isEmergencyActive) return;
  
  const elapsedTime = (performance.now() - emergencyStartTime) / 1000;
  
  // Check if 20 seconds have passed
  if (elapsedTime >= 5 && !isFadeOutActive) {
    startFadeOut(camera);
  }
  
  if (isFadeOutActive) {
    // Update falling effect
    updateFallingEffect(delta);
    return;
  }
  
  // Update particle systems
  if (particleSystem) {
    const positions = particleSystem.geometry.attributes.position.array;
    const velocities = particleSystem.geometry.attributes.velocity.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i] * delta * 5;
      positions[i + 1] += velocities[i + 1] * delta * 5;
      positions[i + 2] += velocities[i + 2] * delta * 5;
      
      // Reset particles that fall too far
      if (positions[i + 1] < -10) {
        positions[i] = (Math.random() - 0.5) * 10;
        positions[i + 1] = Math.random() * 20;
        positions[i + 2] = (Math.random() - 0.5) * 10;
      }
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleShaderMaterial.uniforms.time.value += delta;
  }
  
  if (cometSystem) {
    const positions = cometSystem.geometry.attributes.position.array;
    const velocities = cometSystem.geometry.attributes.velocity.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i] * delta * 5;
      positions[i + 1] += velocities[i + 1] * delta * 5;
      positions[i + 2] += velocities[i + 2] * delta * 5;
      
      // Reset comets that fall too far
      if (positions[i + 1] < -10) {
        positions[i] = (Math.random() - 0.5) * 10;
        positions[i + 1] = Math.random() * 30;
        positions[i + 2] = (Math.random() - 0.5) * 10;
      }
    }
    
    cometSystem.geometry.attributes.position.needsUpdate = true;
    cometShaderMaterial.uniforms.time.value += delta;
  }
  
  if (fallingDebrisSystem) {
    const positions = fallingDebrisSystem.geometry.attributes.position.array;
    const velocities = fallingDebrisSystem.geometry.attributes.velocity.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i] * delta * 5;
      positions[i + 1] += velocities[i + 1] * delta * 5;
      positions[i + 2] += velocities[i + 2] * delta * 5;
      
      // Reset debris that fall too far
      if (positions[i + 1] < -10) {
        positions[i] = (Math.random() - 0.5) * 15;
        positions[i + 1] = Math.random() * 25;
        positions[i + 2] = (Math.random() - 0.5) * 15;
      }
    }
    
    fallingDebrisSystem.geometry.attributes.position.needsUpdate = true;
    debrisShaderMaterial.uniforms.time.value += delta;
  }
  
  // Update camera to simulate falling without moving the player
  if (isFalling && camera) {
    camera.position.y -= 0.05;
    camera.position.x += (Math.random() - 0.5) * 0.02;
    camera.position.z += (Math.random() - 0.5) * 0.02;
    
    if (player) {
      camera.lookAt(player.position);
    }
  }
}

/**
 * Cleanup all emergency resources, restore original scene state, and dispose
 * shader materials/geometries created by this module.
 *
 * @param {THREE.Scene} scene
 */
export function cleanupEmergency(scene) {
  if (!isEmergencyActive) return;
  
  console.log("Cleaning up emergency sequence");
  
  // Stop emergency audio
  if (emergencyAudio) {
    emergencyAudio.stop();
  }
  
  // Clear intervals
  if (emergencyShakeInterval) clearInterval(emergencyShakeInterval);
  if (emergencyCollapseInterval) clearInterval(emergencyCollapseInterval);
  
  // Clean up falling effect
  cleanupFallingEffect();
  
  // Remove particle systems
  if (particleSystem) {
    particleSystem.geometry.dispose();
    particleShaderMaterial.dispose();
    scene.remove(particleSystem);
  }
  
  if (cometSystem) {
    cometSystem.geometry.dispose();
    cometShaderMaterial.dispose();
    scene.remove(cometSystem);
  }
  
  if (fallingDebrisSystem) {
    fallingDebrisSystem.geometry.dispose();
    debrisShaderMaterial.dispose();
    scene.remove(fallingDebrisSystem);
  }
  
  // Restore original objects
  originalObjects.forEach(({ object, visible, intensity }) => {
    object.visible = visible;
    if (object.isLight && intensity !== null) {
      object.intensity = intensity;
    }
  });
  originalObjects = [];
  
  // Reset scene background
  if (originalSceneBackground) {
    scene.background = originalSceneBackground;
  }
  
  // Reset state
  isEmergencyActive = false;
  isFalling = false;
  emergencyTriggered = false;
  isNearTriggerMesh = false;
  isFadeOutActive = false;
  currentScene = null;
  
  // Remove spotlight
  if (playerSpotLight && playerSpotLight.parent) {
    playerSpotLight.parent.remove(playerSpotLight);
  }
  
  // Remove fall character and its light
  if (fallCharacter) {
    scene.remove(fallCharacter);
    fallCharacter = null;
  }
  if (fallCharacterLight) {
    fallCharacterLight = null;
  }
} 