/**
 * ============================================
 * HOVERBOARD SYSTEM MODULE
 * ============================================
 * Complete hoverboard mechanics including movement, physics, and visual effects.
 * Integrates with player controller for seamless interaction.
 * 
 * Features:
 * - Physics-based movement with acceleration/deceleration
 * - Boost functionality with speed increase
 * - Propeller visual effects and animations
 * - Trail effects showing hoverboard path
 * - Sound effects that respond to speed
 * - Camera offset and smooth follow
 * - Manual detachment with keyboard control
 * - Collision detection integration
 * 
 * Movement States:
 * - Idle: No movement
 * - Movement: Forward/backward/strafe
 * - Boost: Enhanced speed mode
 * - Vertical: Up/down movement
 */

import * as THREE from "three";
import {
  togglePlayerControls,
  togglePlayerPhysics,
  playerState,
  switchAction,
  actionIdle,
  hoveraction,
  hoverspeed,
  selectedPlayerMixer,
} from "./playerController.js";

// ============================================
// HOVERBOARD STATE VARIABLES
// ============================================
let hoverboard = null;
let hoverboardCollisionMesh = null;
let isPlayerOnHoverboard = false;
let allowManualDetachment = true;
let isHoverboardEKeyEnabled = false;
const hoverboardRotationSpeed = 2.5;
let hoverboardCameraOffset = new THREE.Vector3(4, 2, 0);
let hoverboardCameraTargetOffset = new THREE.Vector3(0, 2, 0);
let isHoverboardCameraActive = false;
let hoverboardVelocity = new THREE.Vector3();
let hoverboardAcceleration = 10;
let hoverboardDeceleration = 5;
let hoverboardMaxSpeed = 40;
let hoverboardBoostMaxSpeed = 60;
let hoverboardBoostAcceleration = 20;
let isMovingForward = false;
let isMovingBackward = false;
let isTurningLeft = false;
let isTurningRight = false;
let isMovingUp = false;
let isMovingDown = false;
let isBoosting = false;
const hoverboardVerticalSpeed = 6;
let player = null;
let sceneRef = null;
let hoverboardMountPoint = null;
let resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
let targetVelocity = new THREE.Vector3();
let hoverboardAttachOffset = new THREE.Vector3(0, 1.35, 0);
let playerAttachQuaternion = null;
let playerAttachEuler = null;

// Hoverboard tilt and bob variables
const maxRoll = Math.PI / 12;
const maxPitch = Math.PI / 18;
let currentRoll = 0;
let currentPitch = 0;
let prevBob = 0;
const bobAmplitude = 0.1;
const bobFrequency = 0.5;

// Hoverboard trail variables
let hoverboardTrails = [];
let trailEmitters = [];
const TRAIL_SEGMENTS = 48;
const TRAIL_MIN_SPEED = 0.5;
const TRAIL_WIDTH = 0.25;
const TRAIL_FADE = 1.2;
const TRAIL_COLOR = new THREE.Color(1.0, 0.8, 0.3);
const TRAIL_CORE_COLOR = new THREE.Color(1.0, 1.0, 0.9);

// Boost glow effect variables
let boostGlowMeshes = [];
const BOOST_GLOW_COLOR = new THREE.Color(0.2, 0.4, 1.0);
const BOOST_GLOW_SIZE = 0.6;

// Hoverboard sound variables
let hoverboardSound = null;
const MIN_VOLUME = 0.3;
const MAX_VOLUME = 0.8;
const VOLUME_RAMP_SPEED = 2.0;
const FADE_OUT_THRESHOLD = 0.5;
const FADE_OUT_SPEED = 5.0;

// Propeller configuration
const PROPELLER_CONFIG = {
  scale: [0.15, 0.15, 0.15],
  positions: [
    [0.8, 0.05, 0],
    [-0.8, 0.05, 0],
  ],
  rotation: [Math.PI / 2, 0, 0],
};

const propellerVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const propellerFragmentShader = `
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = length(vUv - center);
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float blades = sin(angle * 3.0 + time * 10.0) * 0.5 + 0.5;
    float circle = smoothstep(0.5, 0.45, dist);
    float alpha = circle * blades;
    float glow = smoothstep(0.5, 0.2, dist) * 0.5;
    vec3 color = vec3(0.9, 0.9, 1.0);
    gl_FragColor = vec4(color, alpha + glow);
  }
`;

const propellerGeometry = new THREE.CircleGeometry(1, 32);
const propellerMaterial = new THREE.ShaderMaterial({
  vertexShader: propellerVertexShader,
  fragmentShader: propellerFragmentShader,
  uniforms: {
    time: { value: 0 },
  },
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
});

// --- Hoverboard Trail Utilities (GPU ribbon trails) ---
function createHoverTrail(scene) {
  const segments = TRAIL_SEGMENTS;
  const points = new Array(segments).fill(null).map(() => new THREE.Vector3());
  const ages = new Float32Array(segments).fill(1);

  const vertCount = segments * 2;
  const position = new Float32Array(vertCount * 3);
  const prev = new Float32Array(vertCount * 3);
  const next = new Float32Array(vertCount * 3);
  const side = new Float32Array(vertCount);
  const age = new Float32Array(vertCount);

  for (let i = 0; i < segments; i++) {
    side[i * 2 + 0] = -1;
    side[i * 2 + 1] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aPrev", new THREE.BufferAttribute(prev, 3));
  geometry.setAttribute("aNext", new THREE.BufferAttribute(next, 3));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geometry.setAttribute("aAge", new THREE.BufferAttribute(age, 1));

  const indices = [];
  for (let i = 0; i < segments - 1; i++) {
    const i0 = i * 2;
    const i1 = i * 2 + 1;
    const i2 = (i + 1) * 2;
    const i3 = (i + 1) * 2 + 1;
    indices.push(i0, i2, i1);
    indices.push(i1, i2, i3);
  }
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: {
        value: new THREE.Color(TRAIL_COLOR.r, TRAIL_COLOR.g, TRAIL_COLOR.b),
      },
      uCoreColor: {
        value: new THREE.Color(
          TRAIL_CORE_COLOR.r,
          TRAIL_CORE_COLOR.g,
          TRAIL_CORE_COLOR.b
        ),
      },
      uFade: { value: TRAIL_FADE },
      uWidth: { value: TRAIL_WIDTH },
      uMinAlpha: { value: 0.05 },
      uTime: { value: 0.0 },
    },
    vertexShader: `
      uniform float uWidth;
      uniform float uTime;
      attribute vec3 aPrev;
      attribute vec3 aNext;
      attribute float aSide;
      attribute float aAge;
      varying float vAge;
      varying float vSide;
      varying float vDistanceFromCenter;
      void main(){
        vec3 P = position;
        vec3 Pprev = aPrev;
        vec3 Pnext = aNext;
        vec3 T = normalize(Pnext - Pprev);
        if (length(T) < 1e-5) T = vec3(0.0, 0.0, 1.0);
        vec3 N = normalize(cross(vec3(0.0, 1.0, 0.0), T));
        if (length(N) < 1e-5) N = normalize(cross(vec3(1.0, 0.0, 0.0), T));
        
        float turbulence = 0.01 * sin(uTime * 3.0 + aAge * 8.0) * (1.0 - aAge);
        vec3 turbulenceOffset = N * turbulence;
        
        float distanceFromCenter = abs(aSide);
        vDistanceFromCenter = distanceFromCenter;
        
        float widthVariation = uWidth * (1.0 - aAge * 0.2) * (1.0 + 0.1 * sin(uTime * 2.0 + aAge * 6.0));
        vec3 offset = N * aSide * widthVariation + turbulenceOffset;
        
        vec3 finalPos = P + offset;
        vAge = aAge;
        vSide = aSide;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uCoreColor;
      uniform float uFade;
      uniform float uMinAlpha;
      uniform float uTime;
      varying float vAge;
      varying float vSide;
      varying float vDistanceFromCenter;
      void main() {
        float alpha = max(uMinAlpha, exp(-uFade * vAge));
        float pulse = 1.0 + 0.2 * sin(uTime * 4.0 + vAge * 10.0);
        alpha *= pulse;
        float edgeFade = smoothstep(0.0, 0.1, vAge) * (1.0 - smoothstep(0.8, 1.0, vAge));
        alpha *= edgeFade;
        float glowStart = smoothstep(0.2, 0.0, vAge);
        float glowIntensity = 0.7 + 0.7 * glowStart;
        vec3 coreColor = uCoreColor * glowIntensity * (1.0 + 0.5 * sin(uTime * 3.0 + vAge * 8.0));
        vec3 edgeColor = uColor * glowIntensity * (2.0 + 0.8 * sin(uTime * 2.0 + vAge * 6.0));
        vec3 finalColor = mix(coreColor, edgeColor, smoothstep(0.1, 1.0, vDistanceFromCenter));
        float sparkle = sin(uTime * 6.0 + vAge * 15.0 + vSide * 10.0) * 0.1 + 0.9;
        finalColor *= sparkle;
        alpha *= (0.5 + edgeFade * 1.5);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  return { mesh, geometry, material, points, ages };
}

function rebuildTrailGeometry(trail) {
  const { geometry, points, ages } = trail;
  const segments = points.length;
  const posAttr = geometry.getAttribute("position");
  const prevAttr = geometry.getAttribute("aPrev");
  const nextAttr = geometry.getAttribute("aNext");
  const ageAttr = geometry.getAttribute("aAge");

  for (let i = 0; i < segments; i++) {
    const p = points[i];
    const pPrev = points[Math.max(0, i - 1)];
    const pNext = points[Math.min(segments - 1, i + 1)];
    const a = ages[i];

    const i2 = i * 2;
    posAttr.setXYZ(i2 + 0, p.x, p.y, p.z);
    posAttr.setXYZ(i2 + 1, p.x, p.y, p.z);
    prevAttr.setXYZ(i2 + 0, pPrev.x, pPrev.y, pPrev.z);
    prevAttr.setXYZ(i2 + 1, pPrev.x, pPrev.y, pPrev.z);
    nextAttr.setXYZ(i2 + 0, pNext.x, pNext.y, pNext.z);
    nextAttr.setXYZ(i2 + 1, pNext.x, pNext.y, pNext.z);
    ageAttr.setX(i2 + 0, a);
    ageAttr.setX(i2 + 1, a);
  }

  posAttr.needsUpdate = true;
  prevAttr.needsUpdate = true;
  nextAttr.needsUpdate = true;
  ageAttr.needsUpdate = true;
}

function updateHoverTrail(trail, emitterWorldPos, isEmitting, delta) {
  const { points, ages } = trail;

  for (let i = 0; i < ages.length; i++) {
    ages[i] = Math.min(1, ages[i] + delta * 0.6);
  }

  if (isEmitting) {
    for (let i = points.length - 1; i > 0; i--) {
      points[i].copy(points[i - 1]);
      ages[i] = ages[i - 1];
    }
    points[0].copy(emitterWorldPos);
    ages[0] = 0;
  } else {
    if (points[0]) {
      points[0].lerp(emitterWorldPos, 0.2);
    }
  }

  rebuildTrailGeometry(trail);
}

export function initializeHoverboard(
  scene,
  allAssets,
  playerObject,
  allowManualDetach = true
) {
  player = playerObject;
  sceneRef = scene;
  allowManualDetachment = allowManualDetach;

  if (!allAssets.models.gltf.hoverboard) {
    console.warn("Hoverboard model not found");
    return;
  }

  if (allAssets.audios.hoverboard) {
    hoverboardSound = allAssets.audios.hoverboard;
    hoverboardSound.setLoop(true);
    hoverboardSound.setVolume(MIN_VOLUME);
  }

  hoverboard = allAssets.models.gltf.hoverboard.clone();
  hoverboard.position.set(0, 0, 0);
  hoverboard.rotation.order = "YXZ";
  hoverboard.rotation.y = Math.PI / 2;
  hoverboard.visible = false;
  scene.add(hoverboard);

  PROPELLER_CONFIG.positions.forEach((position) => {
    const geometry = new THREE.PlaneGeometry(0.8, 0.8);
    const uniforms = {
      time: { value: 0 },
      resolution: { value: resolution.clone() },
      zoom: { value: 1.0 },
    };
    const propShaderMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv=uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        #ifdef GL_ES
        precision highp float;
        #endif
        uniform float time;
        uniform vec2 resolution;
        uniform float zoom;
        varying vec2 vUv;
        #define PI 3.1415926535
        mat2 rotate3d(float angle) {
          return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        }
        void main() {
          vec2 p=(vUv*2.0-1.0)*zoom;
          p=rotate3d(time*2.0*PI)*p;
          float t=0.075/abs(0.4-length(p));
          vec3 color=1.0-exp(-vec3(t)*vec3(0.13*(sin(time)+12.0),abs(p.y)*0.7,3.0));
          float alpha=smoothstep(0.0,1.0,length(color)*0.5);
          gl_FragColor=vec4(color,alpha);
        }
      `,
      uniforms: uniforms,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      depthWrite: false,
      depthTest: true,
    });
    const plane = new THREE.Mesh(geometry, propShaderMat);
    plane.position.set(...position);
    plane.position.y = 0.08;
    plane.rotation.set(...PROPELLER_CONFIG.rotation);
    hoverboard.add(plane);
  });

  PROPELLER_CONFIG.positions.forEach((position) => {
    const prop = new THREE.Mesh(propellerGeometry, propellerMaterial.clone());
    prop.scale.set(...PROPELLER_CONFIG.scale);
    prop.position.set(...position);
    prop.rotation.set(...PROPELLER_CONFIG.rotation);
    hoverboard.add(prop);
  });

  hoverboardMountPoint = new THREE.Object3D();
  hoverboardMountPoint.position.set(0, 1.35, 0);
  hoverboard.add(hoverboardMountPoint);

  trailEmitters = [];
  const centerRear = new THREE.Object3D();
  centerRear.position.set(0.8, 0.05, 0);
  hoverboard.add(centerRear);
  trailEmitters.push(centerRear);
  hoverboardTrails = [createHoverTrail(scene)];
  hoverboardTrails.forEach((trail) => (trail.mesh.visible = false));
  
  // Create boost glow effect
  boostGlowMeshes = [];
  trailEmitters.forEach((emitter) => {
    const boostGlowGeometry = new THREE.CircleGeometry(BOOST_GLOW_SIZE, 32);
    const boostGlowMaterial = new THREE.ShaderMaterial({
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
        uniform float intensity;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = length(vUv - center);
          float pulse = 0.5 + 0.5 * sin(time * 5.0);
          float glow = smoothstep(0.5, 0.0, dist) * intensity;
          float outerGlow = smoothstep(0.8, 0.4, dist) * 0.5 * intensity;
          vec3 finalColor = mix(color, vec3(0.7, 0.8, 1.0), outerGlow);
          float alpha = glow * (0.7 + 0.3 * pulse);
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
        color: { value: BOOST_GLOW_COLOR },
        intensity: { value: 0.0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    const boostGlowMesh = new THREE.Mesh(boostGlowGeometry, boostGlowMaterial);
    boostGlowMesh.position.copy(emitter.position);
    boostGlowMesh.rotation.set(-Math.PI / 2, 0, 0);
    boostGlowMesh.visible = false;
    hoverboard.add(boostGlowMesh);
    boostGlowMeshes.push(boostGlowMesh);
  });

  function animatePropellers() {
    if (hoverboard) {
      hoverboard.traverse((child) => {
        if (child.material) {
          if (child.material.uniforms && child.material.uniforms.time) {
            child.material.uniforms.time.value = performance.now() / 1000;
          }
          if (child.material.uniforms && child.material.uniforms.resolution)
            child.material.uniforms.resolution.value.copy(resolution);
        }
      });
    }
    requestAnimationFrame(animatePropellers);
  }
  animatePropellers();

  window.addEventListener("resize", () =>
    resolution.set(window.innerWidth, window.innerHeight)
  );

  const hoverboardBox = new THREE.Box3().setFromObject(hoverboard);
  const size = hoverboardBox.getSize(new THREE.Vector3());
  const capsuleLength = size.x;
  const capsuleRadius = Math.max(size.y, size.z) * 0.45;

  const capsuleGeometry = new THREE.CapsuleGeometry(
    capsuleRadius,
    Math.max(0.01, capsuleLength - 2 * capsuleRadius),
    8,
    16
  );

  hoverboardCollisionMesh = new THREE.Mesh(
    capsuleGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      opacity: 1,
      transparent: true,
      visible: false,
    })
  );
  hoverboardCollisionMesh.name = "hoverboardCollision";
  hoverboardCollisionMesh.capsuleInfo = {
    radius: capsuleRadius,
    segment: new THREE.Line3(
      new THREE.Vector3(-capsuleLength / 2, 0, 0),
      new THREE.Vector3(capsuleLength / 2, 0, 0)
    ),
  };

  hoverboardCollisionMesh.position.copy(hoverboard.position);
  hoverboardCollisionMesh.rotation.copy(hoverboard.rotation);
  scene.add(hoverboardCollisionMesh);

  window.addEventListener("keydown", handleHoverboardKeys);
  window.addEventListener("keyup", handleHoverboardKeyUp);

  window.addEventListener("resize", () => {
    resolution.set(window.innerWidth, window.innerHeight);
  });
}

function handleHoverboardKeys(event) {
  if (!hoverboard || !hoverboardCollisionMesh) return;

  const isKeyDown = event.type === "keydown";
  const key = event.key.toLowerCase();

  if (key === "e" && isHoverboardEKeyEnabled) {
    if (isKeyDown) {
      if (!hoverboard.visible) {
        hoverboard.position.copy(
          player.position.clone().add(new THREE.Vector3(-1.2, -0.8, 0))
        );
        hoverboard.visible = true;
        hoverboardCollisionMesh.position.copy(hoverboard.position);
        attachPlayerToHoverboard();
      } else if (isPlayerOnHoverboard && allowManualDetachment) {
        detachPlayerFromHoverboard();
        hoverboard.visible = false;
      }
    }
    return;
  }

  if (!isPlayerOnHoverboard) return;

  switch (key) {
    case "arrowup":
      isMovingForward = isKeyDown;
      break;
    case "arrowdown":
      isMovingBackward = isKeyDown;
      break;
    case "arrowleft":
      isTurningLeft = isKeyDown;
      break;
    case "arrowright":
      isTurningRight = isKeyDown;
      break;
    case "w":
      isMovingUp = isKeyDown;
      break;
    case "s":
      isMovingDown = isKeyDown;
      break;
    case "shift":
      isBoosting = isKeyDown;
      if (isKeyDown && (isMovingForward || isMovingBackward) && hoverspeed && switchAction) {
        if (hoveraction && hoveraction.isRunning()) {
          hoveraction.stop();
        }
        switchAction(hoverspeed);
        hoverspeed.setLoop(THREE.LoopOnce);
        hoverspeed.clampWhenFinished = true;
        hoverspeed.reset().play();
      }
      break;
  }
}

function handleHoverboardKeyUp(event) {
  switch (event.key.toLowerCase()) {
    case "arrowup":
      isMovingForward = false;
      if (!isMovingBackward && isBoosting && hoverspeed && hoveraction && switchAction) {
        if (hoverspeed.isRunning()) {
          hoverspeed.stop();
        }
        switchAction(hoveraction);
        hoveraction.setLoop(THREE.LoopRepeat);
        hoveraction.reset().fadeIn(0.3).play();
      }
      break;
    case "arrowdown":
      isMovingBackward = false;
      if (!isMovingForward && isBoosting && hoverspeed && hoveraction && switchAction) {
        if (hoverspeed.isRunning()) {
          hoverspeed.stop();
        }
        switchAction(hoveraction);
        hoveraction.setLoop(THREE.LoopRepeat);
        hoveraction.reset().fadeIn(0.3).play();
      }
      break;
    case "arrowleft":
      isTurningLeft = false;
      break;
    case "arrowright":
      isTurningRight = false;
      break;
    case "w":
      isMovingUp = false;
      break;
    case "s":
      isMovingDown = false;
      break;
    case "shift":
      isBoosting = false;
      if (isPlayerOnHoverboard && hoveraction && hoverspeed && switchAction && (isMovingForward || isMovingBackward)) {
        if (hoverspeed.isRunning()) {
          hoverspeed.stop();
        }
        switchAction(hoveraction);
        hoveraction.setLoop(THREE.LoopRepeat);
        hoveraction.reset().fadeIn(0.3).play();
      }
      break;
  }
}

function attachPlayerToHoverboard() {
  if (!hoverboard || !player) return;

  togglePlayerControls(false);
  togglePlayerPhysics(false);

  if (hoveraction && switchAction) {
    switchAction(hoveraction);
    hoveraction.setLoop(THREE.LoopRepeat);
    hoveraction.reset().play();
  }

  playerAttachQuaternion = player.quaternion.clone();

  const attachWorldPos = hoverboardAttachOffset.clone();
  hoverboard.localToWorld(attachWorldPos);

  if (player.parent !== sceneRef && sceneRef) {
    sceneRef.add(player);
  }
  player.position.copy(attachWorldPos);

  const yawOffset = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 2
  );
  const finalQuat = hoverboard.quaternion.clone().multiply(yawOffset);
  player.quaternion.copy(finalQuat);

  isHoverboardCameraActive = true;

  if (hoverboardSound) {
    hoverboardSound.setVolume(0);
    hoverboardSound.play();
    let rampTime = 0;
    const rampDuration = 0.5;
    const rampInterval = setInterval(() => {
      rampTime += 0.016;
      const progress = Math.min(rampTime / rampDuration, 1.0);
      hoverboardSound.setVolume(MIN_VOLUME * progress);
      if (progress >= 1.0) clearInterval(rampInterval);
    }, 16);
  }

  isPlayerOnHoverboard = true;
  window.isPlayerOnHoverboard = true;

  try {
    window.dispatchEvent(new CustomEvent("hoverboard:mounted"));
  } catch (e) {}
}

export function detachPlayerFromHoverboard() {
  if (!hoverboard || !player) return;

  playerState.fwdPressed = false;
  playerState.bkdPressed = false;
  playerState.lftPressed = false;
  playerState.rgtPressed = false;
  playerState.shiftPressed = false;
  playerState.velocity.set(0, 0, 0);

  togglePlayerControls(true);
  setTimeout(() => {
    togglePlayerPhysics(true);
  }, 50);

  isHoverboardCameraActive = false;

  if (hoverboardSound && hoverboardSound.isPlaying) {
    const fadeOutDuration = 0.3;
    const startVolume = hoverboardSound.getVolume();
    let fadeTime = 0;
    const fadeInterval = setInterval(() => {
      fadeTime += 0.016;
      const progress = Math.min(fadeTime / fadeOutDuration, 1.0);
      hoverboardSound.setVolume(startVolume * (1.0 - progress));
      if (progress >= 1.0) {
        hoverboardSound.stop();
        hoverboardSound.setVolume(MIN_VOLUME);
        if (hoverboardSound.setPlaybackRate) {
          hoverboardSound.setPlaybackRate(1.0);
        }
        clearInterval(fadeInterval);
      }
    }, 16);
  }

  hoverboard.visible = false;
  if (hoverboardCollisionMesh) {
    hoverboardCollisionMesh.visible = false;
  }

  if (hoverboardTrails) {
    hoverboardTrails.forEach((trail) => {
      if (trail && trail.mesh) trail.mesh.visible = false;
    });
  }

  if (sceneRef && player.parent === hoverboardMountPoint) {
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    player.getWorldPosition(worldPos);
    player.getWorldQuaternion(worldQuat);
    sceneRef.add(player);
    player.position.copy(worldPos);
    player.quaternion.copy(worldQuat);
  }

  isPlayerOnHoverboard = false;
  window.isPlayerOnHoverboard = false;

  try {
    window.dispatchEvent(new CustomEvent("hoverboard:dismounted"));
  } catch (e) {}
}

const MAX_HOVERBOARD_SUBSTEP = 1 / 120;

export function updateHoverboardMovement(delta, allAssets) {
  if (!hoverboard || !hoverboardCollisionMesh || !isPlayerOnHoverboard) return;

  const speed = hoverboardVelocity.length();

  if (selectedPlayerMixer) {
    selectedPlayerMixer.update(delta);
  }
  
  // Update boost glow effect
  if (boostGlowMeshes && boostGlowMeshes.length > 0) {
    const currentTime = performance.now() / 1000;
    const shouldShowGlow = isBoosting && (isMovingForward || isMovingBackward) && speed > 5;
    
    boostGlowMeshes.forEach((mesh, index) => {
      if (mesh && mesh.material && mesh.material.uniforms) {
        mesh.material.uniforms.time.value = currentTime;
        
        // Smoothly transition intensity based on boost state
        const targetIntensity = shouldShowGlow ? 1.0 : 0.0;
        const currentIntensity = mesh.material.uniforms.intensity.value;
        const newIntensity = THREE.MathUtils.lerp(currentIntensity, targetIntensity, delta * 5.0);
        
        mesh.material.uniforms.intensity.value = newIntensity;
        mesh.visible = newIntensity > 0.01;
      }
    });
  }

  let remaining = Math.min(delta, 0.2);

  const stepOnce = (dt) => {
    const speed = hoverboardVelocity.length();

    const currentMaxSpeed =
      isBoosting && (isMovingForward || isMovingBackward)
        ? hoverboardBoostMaxSpeed
        : hoverboardMaxSpeed;

    const currentAcceleration =
      isBoosting && (isMovingForward || isMovingBackward)
        ? hoverboardBoostAcceleration
        : hoverboardAcceleration;

    let turnRate = 0;
    if (isTurningLeft) turnRate += hoverboardRotationSpeed;
    if (isTurningRight) turnRate -= hoverboardRotationSpeed;
    hoverboard.rotation.y += turnRate * dt;

    targetVelocity.set(0, 0, 0);
    if (isMovingForward) {
      targetVelocity.x = -currentMaxSpeed;
    } else if (isMovingBackward) {
      targetVelocity.x = currentMaxSpeed / 2;
    }

    if (targetVelocity.length() > 0) {
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        hoverboard.rotation.y
      );
      targetVelocity.applyQuaternion(yawQuat);
      hoverboardVelocity.lerp(targetVelocity, currentAcceleration * dt);
    } else {
      const damping = Math.max(0, 1 - hoverboardDeceleration * dt);
      hoverboardVelocity.multiplyScalar(damping);
      if (hoverboardVelocity.length() < 0.001) {
        hoverboardVelocity.set(0, 0, 0);
      }
    }

    if (isMovingUp) {
      hoverboardVelocity.y = hoverboardVerticalSpeed;
    } else if (isMovingDown) {
      hoverboardVelocity.y = -hoverboardVerticalSpeed;
    } else {
      const verticalDamping = Math.max(0, 1 - hoverboardDeceleration * dt);
      hoverboardVelocity.y *= verticalDamping;
      if (Math.abs(hoverboardVelocity.y) < 0.001) hoverboardVelocity.y = 0;
    }

    hoverboard.position.addScaledVector(hoverboardVelocity, dt);

    if (speed < 0.1 && Math.abs(hoverboardVelocity.y) < 0.1) {
      const time = performance.now() / 1000;
      const bob = Math.sin(time * 2 * Math.PI * bobFrequency) * bobAmplitude;
      hoverboard.position.y += bob - prevBob;
      prevBob = bob;
    } else {
      prevBob = 0;
    }

    const normalizedSpeed = Math.min(speed / hoverboardMaxSpeed, 1);
    const targetPitch =
      (isMovingForward ? -1 : isMovingBackward ? 1 : 0) *
      maxPitch *
      normalizedSpeed;
    const targetRoll = turnRate * normalizedSpeed * maxRoll;
    currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, 5 * dt);
    currentRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, 5 * dt);
    hoverboard.rotation.z = currentPitch;
    hoverboard.rotation.x = currentRoll;

    hoverboardCollisionMesh.position.copy(hoverboard.position);
    hoverboardCollisionMesh.rotation.copy(hoverboard.rotation);

    const collisionMesh = allAssets.models.gltf.university.collisionMesh;
    if (collisionMesh?.geometry?.boundsTree) {
      const capsuleInfo = hoverboardCollisionMesh.capsuleInfo;
      const tempBox = new THREE.Box3();
      const tempMat = new THREE.Matrix4();
      const tempSegment = new THREE.Line3();

      tempMat.copy(collisionMesh.matrixWorld).invert();
      tempSegment.copy(capsuleInfo.segment);

      tempSegment.start
        .applyMatrix4(hoverboardCollisionMesh.matrixWorld)
        .applyMatrix4(tempMat);
      tempSegment.end
        .applyMatrix4(hoverboardCollisionMesh.matrixWorld)
        .applyMatrix4(tempMat);

      tempBox.expandByPoint(tempSegment.start);
      tempBox.expandByPoint(tempSegment.end);

      tempBox.min.addScalar(-capsuleInfo.radius);
      tempBox.max.addScalar(capsuleInfo.radius);

      let collisionNormal = new THREE.Vector3();
      let collisionPoint = new THREE.Vector3();
      let hasCollision = false;
      let minDistance = Infinity;

      collisionMesh.geometry.boundsTree.shapecast({
        intersectsBounds: (box) => box.intersectsBox(tempBox),
        intersectsTriangle: (tri) => {
          const triPoint = new THREE.Vector3();
          const capsulePoint = new THREE.Vector3();

          const distance = tri.closestPointToSegment(
            tempSegment,
            triPoint,
            capsulePoint
          );

          if (distance < capsuleInfo.radius && distance < minDistance) {
            minDistance = distance;
            const depth = capsuleInfo.radius - distance;
            const direction = capsulePoint.sub(triPoint).normalize();

            collisionNormal.copy(direction);
            collisionPoint.copy(capsulePoint);
            hasCollision = true;
          }
        },
      });

      if (hasCollision) {
        collisionNormal
          .applyMatrix4(collisionMesh.matrixWorld)
          .sub(collisionMesh.position)
          .normalize();

        const normalVelocity = collisionNormal
          .clone()
          .multiplyScalar(hoverboardVelocity.dot(collisionNormal));
        const tangentVelocity = hoverboardVelocity.clone().sub(normalVelocity);

        const dampingFactor = 0.95;
        const frictionFactor = 0.95;

        normalVelocity.multiplyScalar(0);
        tangentVelocity.multiplyScalar(frictionFactor);
        hoverboardVelocity.copy(tangentVelocity);
        hoverboardVelocity.multiplyScalar(dampingFactor);

        const penetrationDepth = capsuleInfo.radius - minDistance;
        if (penetrationDepth > 0) {
          const maxCorrection = currentMaxSpeed * Math.max(dt, 0.001) * 3;
          const appliedDepth = Math.min(penetrationDepth, maxCorrection);
          const correction = collisionNormal
            .clone()
            .multiplyScalar(appliedDepth);
          hoverboard.position.add(correction);
          hoverboardCollisionMesh.position.copy(hoverboard.position);
        }

        if (hoverboardVelocity.length() > currentMaxSpeed) {
          hoverboardVelocity.setLength(currentMaxSpeed);
        }
      }
    }
  };

  while (remaining > 1e-6) {
    const dt = Math.min(MAX_HOVERBOARD_SUBSTEP, remaining);
    stepOnce(dt);
    remaining -= dt;
  }

  if (hoverboardSound) {
    const speed = hoverboardVelocity.length();
    const normalizedSpeed = Math.min(speed / hoverboardMaxSpeed, 1.0);

    const targetVolume =
      speed > FADE_OUT_THRESHOLD
        ? MIN_VOLUME +
          (MAX_VOLUME - MIN_VOLUME) * Math.pow(normalizedSpeed, 0.7)
        : 0;

    const currentVolume = hoverboardSound.getVolume();
    const fadeSpeed =
      speed > FADE_OUT_THRESHOLD ? VOLUME_RAMP_SPEED : FADE_OUT_SPEED;
    const newVolume = THREE.MathUtils.lerp(
      currentVolume,
      targetVolume,
      fadeSpeed * delta
    );
    hoverboardSound.setVolume(newVolume);

    if (hoverboardSound.setPlaybackRate) {
      const basePitch = 1.0;
      const pitchVariation = 0.3;
      const boostPitch = isBoosting ? 0.2 : 0;
      const targetPitch =
        basePitch + pitchVariation * normalizedSpeed + boostPitch;
      const currentPitch = hoverboardSound.getPlaybackRate
        ? hoverboardSound.getPlaybackRate()
        : basePitch;
      const newPitch = THREE.MathUtils.lerp(
        currentPitch,
        targetPitch,
        3.0 * delta
      );
      hoverboardSound.setPlaybackRate(newPitch);
    }

    if (speed > FADE_OUT_THRESHOLD && !hoverboardSound.isPlaying) {
      hoverboardSound.setVolume(MIN_VOLUME);
      hoverboardSound.play();
    } else if (speed <= FADE_OUT_THRESHOLD && newVolume < 0.01) {
      hoverboardSound.stop();
      hoverboardSound.setVolume(MIN_VOLUME);
      if (hoverboardSound.setPlaybackRate) {
        hoverboardSound.setPlaybackRate(1.0);
      }
    }
  }

  const BOOST_TRAIL_COLOR = new THREE.Color(0x66ccff);
  const BOOST_TRAIL_CORE_COLOR = new THREE.Color(0xaaddff);
  const NORMAL_TRAIL_COLOR = new THREE.Color(1.0, 0.8, 0.3);
  const NORMAL_TRAIL_CORE_COLOR = new THREE.Color(1.0, 1.0, 0.9);

  if (hoverboardTrails && trailEmitters && hoverboardTrails.length === trailEmitters.length) {
    // Only emit trails when moving forward and above minimum speed
    const emitting = speed > TRAIL_MIN_SPEED && isMovingForward;
    const time = performance.now() * 0.001;
    const isBoostingActive = isBoosting && isMovingForward;

    for (let i = 0; i < trailEmitters.length; i++) {
      const emitter = trailEmitters[i];
      const worldPos = new THREE.Vector3();
      emitter.getWorldPosition(worldPos);

      const trail = hoverboardTrails[i];

      // When moving backward, reset trail ages to fade out existing trails
      if (isMovingBackward) {
        trail.ages.fill(1);
      }

      updateHoverTrail(trail, worldPos, emitting, delta);

      if (isBoostingActive) {
        trail.material.uniforms.uColor.value.lerp(BOOST_TRAIL_COLOR, 0.1);
        trail.material.uniforms.uCoreColor.value.lerp(BOOST_TRAIL_CORE_COLOR, 0.1);
        trail.material.uniforms.uWidth.value += (TRAIL_WIDTH * 0.5 - trail.material.uniforms.uWidth.value) * 0.1;
      } else {
        trail.material.uniforms.uColor.value.lerp(NORMAL_TRAIL_COLOR, 0.1);
        trail.material.uniforms.uCoreColor.value.lerp(NORMAL_TRAIL_CORE_COLOR, 0.1);
        trail.material.uniforms.uWidth.value += (TRAIL_WIDTH - trail.material.uniforms.uWidth.value) * 0.1;
      }

      if (trail.material.uniforms.uTime) {
        trail.material.uniforms.uTime.value = time;
      }

      const hasAlive = trail.ages.some(a => a < 0.99);
      trail.mesh.visible = isPlayerOnHoverboard && (emitting || hasAlive);
    }
  }

  if (isPlayerOnHoverboard && player) {
    const attachPos = hoverboardAttachOffset.clone();
    hoverboard.localToWorld(attachPos);
    player.position.copy(attachPos);

    const yawOffset = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );
    const finalQuat = hoverboard.quaternion.clone().multiply(yawOffset);
    player.quaternion.copy(finalQuat);
  }
}

export function updateHoverboardCamera(camera, controls, delta) {
  if (!isHoverboardCameraActive || !hoverboard) return;

  const cameraPosition = new THREE.Vector3();
  cameraPosition.copy(hoverboardCameraOffset);

  const rotationMatrix = new THREE.Matrix4();
  rotationMatrix.makeRotationY(hoverboard.rotation.y);
  cameraPosition.applyMatrix4(rotationMatrix);

  cameraPosition.add(hoverboard.position);

  const cameraTarget = new THREE.Vector3();
  cameraTarget.copy(hoverboardCameraTargetOffset);
  cameraTarget.applyMatrix4(rotationMatrix);
  cameraTarget.add(hoverboard.position);

  const lerpFactor = 1 - Math.exp(-10 * delta);
  camera.position.lerp(cameraPosition, lerpFactor);
  controls.target.lerp(cameraTarget, lerpFactor);
  controls.update();
}

export function cleanupHoverboard() {
  if (hoverboardSound) {
    hoverboardSound.stop();
    hoverboardSound = null;
  }

  if (hoverboard) {
    hoverboard.traverse((child) => {
      if (child.material) {
        if (child.material.uniforms) {
          child.material.uniforms = null;
        }
        child.material.dispose();
      }
      if (child.geometry) {
        child.geometry.dispose();
      }
    });
  }

  hoverboard = null;
  hoverboardCollisionMesh = null;
  isPlayerOnHoverboard = false;
  isHoverboardCameraActive = false;
  hoverboardVelocity.set(0, 0, 0);
  targetVelocity.set(0, 0, 0);
  isMovingForward = false;
  isMovingBackward = false;
  isTurningLeft = false;
  isTurningRight = false;
  isMovingUp = false;
  isMovingDown = false;

  if (hoverboardTrails) {
    hoverboardTrails.forEach((trail) => {
      if (!trail) return;
      if (trail.mesh && trail.mesh.parent) trail.mesh.parent.remove(trail.mesh);
      if (trail.geometry) trail.geometry.dispose();
      if (trail.material) trail.material.dispose();
    });
  }
  hoverboardTrails = [];
  trailEmitters = [];
}

export { hoverboard, hoverboardCollisionMesh, attachPlayerToHoverboard };

export function enableHoverboardEKey() {
  isHoverboardEKeyEnabled = true;
}

export function disableHoverboardEKey() {
  isHoverboardEKeyEnabled = false;
}