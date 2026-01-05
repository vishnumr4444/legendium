import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { allAssets, loadAllAsset } from "../commonFiles/assetsLoader.js";
import { assetsEntry as currentEntry } from "./assetsEntry.js";
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer.js";
import {
  setCurrentScene,
  getUserInfo,
  markSceneVisited,
  updateUserInfo,
  getCheckpoint,
} from "../data.js";
// import Stats from "three/examples/jsm/libs/stats.module.js";
import {
  setCameraAndControls,
  playerState,
  handleCollisions,
  switchToFirstPerson,
  initializePlayer as scene1InitializePlayer,
} from "../playerController.js";
import { createMinimap, updateMinimap, cleanupMinimap } from "./minimap.js";
import { objectives, showObjective, hideObjective, cleanupObjectives } from "./objectives.js";
import { spreadInstancedRandomOnUVArea } from "../commonFiles/uvSpread.js";
import {
  initializeElectro,
  updateElectro,
  startElectroSequence,
  setDependencies,
  startElectroAppearanceSequence,
  cleanupElectro,
  triggerAutoMoveAndDisableControls,
  getElectroState
} from "./electrointeraction.js";
import { TriggerPoint } from "../commonFiles/triggerPoint.js";
import { Portal } from "../commonFiles/portal.js";
import { auth, db } from "../WebFiles/firebase.js";
import { doc, updateDoc } from "firebase/firestore";
import {
  initializeVR, updateVR, cleanupVR, enablePlayerMovement, disablePlayerMovement, setCollisionMesh
} from "../commonFiles/vrManager.js";

// Import inventory
import {
  createInventoryButton,
  showInventory,
  hideInventory,
  isInventoryVisible,
  cleanupInventory,
  setPlayerReference,
  addItem,
} from "./inventory.js";
import { celebrateSceneCompletion } from "../commonFiles/sceneCompletionCelebration.js";
import { createCollectedUI } from "./collectedUi.js";
import { createCollectibleDrop } from "./collectibles.js";
import { createEnemy } from "./enemy.js";
import { addRayDetectionBox, setupPlayerSpells } from "./playerSpells.js";
import { createPointSystem } from "./pointsystem.js";
import { createFloatingIslandSystem } from "./reachIsland.js";
import { createGlowingSpheres } from "./resistorMultimeterGame.js";
import { DEFAULT_LIGHTNING_PARAMS, LightningSystem } from "./lightningModule.js";
import { createQuarksEffect } from "./quarksEffect.js";
import { createPortalUnlockUI } from "./portalUnlockUI.js";
import { createDeathScreenShader } from "./deathScreenShader.js";

let scene, camera, renderer, controls;
let resizeHandler = null;
let animationFrameId = null;
let sceneInitialization = null;
let isSceneTransitioning = false;
let hasSceneCompletionStarted = false;
let portal = null;
let triggerPoint = null;
let electroComponents = null;
let hologramEffect = null;
let electroFocusCamera, isElectroFocusActive = false, isCameraTransitioning = false;
let ufo = null;
let transitionStartTime = 0;
const transitionDuration = 1.5;
let transitionStartPosition = new THREE.Vector3();
let transitionStartQuaternion = new THREE.Quaternion();
let transitionTargetPosition = new THREE.Vector3();
let transitionTargetQuaternion = new THREE.Quaternion();

// Add cactus and carnivorous plant variables
let cactus = null;
let carnivorous = null;
let isCactusAnimating = false;
let isCarnivorousAnimating = false;
let cactusMixer = null;
let carnivorousMixer = null;
let cactusAction = null;
let carnivorousAction = null;
let cactusAnimations = {};
let carnivorousAnimations = {};
let playerLife = 100;
let isVignetteActive = false;
let vignetteOverlay = null;
let lifeBarContainer = null;
let deathScreenContainer = null;
let isPlayerDead = false;
let deathScreenShader = null;
let isDeathEffectActive = false;
let ATTACK_DISTANCE = 5;
// Avatar-style hanging mesh (e.g., pink vines) swing vars
const USE_SHADER_SWAY_FOR_HANGING = true;
let avatarHangingMesh = null;
let avatarHangingMeshPivot = null;
let avatarHangingSwayUniforms = [];
let backgroundAudio;
let attackAudio = null;

let collisionMesh = null;
let quarksEffectInstance = null;
let enemyController = null;
let isEnemySequenceActive = false;
let spellsController = null;
let pointSystem = null;
let rewardUI = null;
let activeCollectibles = [];
let glowingSpheresSystem = null;
let lightningSystem = null;
let floatingIslandSystem = null;
let gardenColliderMeshes = [];
let detectionBox = null;
let originalSelectedCharacter = null;
let hasActivatedFloatingIslandContent = false;
let floatingIslandMesh = null;
let portalUnlockUI = null;
let collectedTreasureCount = 0;
let isLightningActive = true;
let lightningCenterPosition = null;
let hazardVisualizationMesh = null;

const stationaryEducationalTreasureConfigs = [
  {
    position: new THREE.Vector3(-17.009, 20, 35), //'-14.009', '21.024', '35.141'
    treasureType: "jumperWire",
  },
  {
    position: new THREE.Vector3(-15.077, 20, 37),
    treasureType: "breadboard",
  },
  {
    position: new THREE.Vector3(-13.077, 20, 33),
    treasureType: "powerRegulator",
  },
];

function isEmilyCharacter(selection) {
  if (!selection) return false;
  const normalized = selection.toLowerCase();
  return normalized.includes("emly") || normalized.includes("emily");
}

// Function to set hologram effect (exported for electrointeraction.js)
export function setHologramEffect(effect) {
  hologramEffect = effect;
}

// Function to get UFO reference (exported for electrointeraction.js)
export function getUFO() {
  return ufo;
}

// Add this function to setup the plants
function setupPlants(scene, assets) {
  // Setup Cactus
  if (assets.models.gltf.cactus) {
    cactus = assets.models.gltf.cactus;
    cactus.position.set(-5, 2.25, -37.5); //'-4.635', '3.839', '-38.986']
    cactus.rotation.y = -Math.PI / 2;
    cactus.scale.set(3, 3, 3);
    // Ensure cactus is rendered opaque (fix alpha/see-through issues)
    cactus.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
          mat.depthTest = true;
          // If texture has alpha, prefer alphaTest cutout instead of blending
          mat.alphaTest = (mat.alphaMap || (mat.map && mat.map.format === THREE.RGBAFormat)) ? 0.5 : 0.0;
          mat.side = THREE.FrontSide;
          mat.alphaToCoverage = false;
          mat.premultipliedAlpha = false;
          mat.needsUpdate = true;
        });
      }
    });
    scene.add(cactus);

    // Set up animation mixer if animations exist
    if (assets.models.animations.cactus) {
      cactusMixer = assets.models.animations.cactus.mixer;
      cactusAnimations = assets.models.animations.cactus.actions;

      // Configure all animations
      Object.values(cactusAnimations).forEach((action) => {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      });

      // Set the first animation as the default action
      cactusAction = Object.values(cactusAnimations)[0];
    } else {
      console.log("WARNING: No cactus animations found in allAssets");
    }
  } else {
    console.log("WARNING: Cactus model not found in assets");
  }

  // Setup Carnivorous Plant
  if (assets.models.gltf.carnivorus) {
    console.log("Found carnivorous model");
    carnivorous = assets.models.gltf.carnivorus;
    carnivorous.position.set(-4, 6, 0);
    carnivorous.scale.set(2.5, 2.5, 2.5);

    // Add material properties to carnivorous plant
    carnivorous.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.depthWrite = true;
        child.material.depthTest = true;
        child.material.alphaToCoverage = true;
        child.material.premultipliedAlpha = true;
        child.material.side = THREE.DoubleSide;
      }
    });

    scene.add(carnivorous);
    console.log("Carnivorous position set to:", carnivorous.position);

    // Set up animation mixer if animations exist
    if (assets.models.animations.carnivorus) {
      console.log("Found carnivorous animations in allAssets");
      carnivorousMixer = assets.models.animations.carnivorus.mixer;
      carnivorousAnimations = assets.models.animations.carnivorus.actions;

      // Configure all animations
      Object.values(carnivorousAnimations).forEach((action) => {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      });

      // Set the first animation as the default action
      carnivorousAction = Object.values(carnivorousAnimations)[0];
      console.log(
        "Carnivorous animations configured:",
        Object.keys(carnivorousAnimations)
      );
    } else {
      console.log("WARNING: No carnivorous animations found in allAssets");
    }
  } else {
    console.log("WARNING: Carnivorous model not found in assets");
  }
}

function disposeSceneSystems() {
  activeCollectibles.forEach((collectible) => {
    try {
      collectible.dispose?.();
    } catch (_) { }
  });
  activeCollectibles = [];

  if (rewardUI) {
    try {
      rewardUI.hide?.();
    } catch (_) { }
    rewardUI = null;
  }

  if (spellsController) {
    try {
      spellsController.dispose?.();
    } catch (_) { }
    spellsController = null;
  }

  if (enemyController) {
    try {
      enemyController.dispose?.();
    } catch (_) { }
    enemyController = null;
  }

  if (pointSystem) {
    try {
      pointSystem.dispose?.();
    } catch (_) { }
    pointSystem = null;
  }

  if (glowingSpheresSystem) {
    try {
      glowingSpheresSystem.dispose?.();
    } catch (_) { }
    glowingSpheresSystem = null;
  }

  if (lightningSystem) {
    try {
      lightningSystem.destroy?.();
    } catch (_) { }
    lightningSystem = null;
  }

  if (quarksEffectInstance) {
    try {
      quarksEffectInstance.dispose?.();
    } catch (_) { }
    quarksEffectInstance = null;
  }

  floatingIslandSystem = null;
  gardenColliderMeshes = [];
  hasActivatedFloatingIslandContent = false;
  floatingIslandMesh = null;
}

function extractColliderMeshes(root) {
  const colliders = [];
  if (!root) {
    return colliders;
  }
  root.traverse((child) => {
    if (child.isMesh && child.visible !== false) {
      colliders.push(child);
    }
  });
  return colliders;
}

function addTreasureInventoryItem(treasureType) {
  const treasureInventoryMap = {
    switch: {
      name: "Switch Module",
      icon: "switch.png",
      count: 1,
      description: "A practical guide to how electrical switches control circuits.",
      stats: "Category: Control Circuitry",
    },
    led: {
      name: "LED Knowledge Kit",
      icon: "led.png",
      count: 1,
      description: "Explains how light-emitting diodes manage current and light output.",
      stats: "Category: Optoelectronics",
    },
    breadboard: {
      name: "Breadboard Lab Kit",
      icon: "breadboard.png",
      count: 1,
      description: "Understand how breadboards enable rapid circuit prototyping.",
      stats: "Category: Prototyping",
    },
    jumperWire: {
      name: "Jumper Wire Set",
      icon: "jumperWire.png",
      count: 1,
      description: "Learn how jumper wires create flexible electrical connections.",
      stats: "Category: Circuit Fundamentals",
    },
    multimeter: {
      name: "Multimeter Module",
      icon: "multimeter.png",
      count: 1,
      description: "A multimeter is an essential tool for measuring voltage, current, and resistance in electrical circuits.",
      stats: "Category: Measurement Tools",
    },
    resistor: {
      name: "Resistor Component",
      icon: "resistor.png",
      count: 1,
      description: "Resistors limit current flow and divide voltage in electronic circuits based on their resistance value.",
      stats: "Category: Passive Components",
    },
    powerRegulator: {
      name: "Power Regulator",
      icon: "powerRegulator.png",
      count: 1,
      description: "Ensures a stable voltage supply to electronic circuits, protecting components from voltage fluctuations.",
      stats: "Category: Power Management",
    },
    batteryAndConnector: {
      name: "Battery & Connector",
      icon: "batteryAndConnector.png",
      count: 1,
      description: "Batteries provide power, and connectors ensure secure electrical connections.",
      stats: "Category: Power Source",
    },
  };

  const inventoryItem =
    treasureInventoryMap[treasureType] || treasureInventoryMap.led;
  addItem(inventoryItem);
}

function handleCollectiblePickup(item) {
  if (!item) return;
  if (item.type === "lifeToken") {
    rewardUI?.showLifeToken?.();
    pointSystem?.healPlayer?.(10);
    return;
  }
  if (item.type === "spellOrb") {
    rewardUI?.showSpellOrb?.();
    if (pointSystem) {
      const current = pointSystem.getSpellEnergy();
      const max = pointSystem.spellMaxEnergy || 3;
      pointSystem.spellEnergy = Math.min(max, current + 1);
      pointSystem.updateSpellBarUI();
    }
    return;
  }
  if (item.type === "treasure") {
    const treasureType =
      item.treasureType || item.mesh?.userData?.treasureType || "led";
    const treasureUIMap = {
      switch: () => rewardUI?.showSwitch?.(),
      breadboard: () => rewardUI?.showBreadboard?.(),
      jumperWire: () => rewardUI?.showJumperWire?.(),
      multimeter: () => rewardUI?.showMultimeter?.(),
      resistor: () => rewardUI?.showResistor?.(),
      powerRegulator: () => rewardUI?.showPowerRegulator?.(),
      batteryAndConnector: () => rewardUI?.showBatteryAndConnector?.(),
      led: () => rewardUI?.showTreasure?.(),
    };
    const showTreasureUI =
      treasureUIMap[treasureType] || treasureUIMap.led;
    showTreasureUI?.();
    pointSystem?.healPlayer?.(30);
    addTreasureInventoryItem(treasureType);

    // Track treasure collectibles for portal unlock
    collectedTreasureCount++;
    console.log(`Collected treasure ${collectedTreasureCount}/8: ${treasureType}`);

    // Update portal unlock UI
    if (portalUnlockUI) {
      portalUnlockUI.updateCollectedCount(collectedTreasureCount);
    }
  }
}

// Function to check distance between two points
function getDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) +
    Math.pow(point1.y - point2.y, 2) +
    Math.pow(point1.z - point2.z, 2)
  );
}

// Function to create and show vignette effect
function createVignetteEffect() {
  if (vignetteOverlay) {
    document.body.removeChild(vignetteOverlay);
  }

  vignetteOverlay = document.createElement("div");
  vignetteOverlay.style.position = "fixed";
  vignetteOverlay.style.top = "0";
  vignetteOverlay.style.left = "0";
  vignetteOverlay.style.width = "100%";
  vignetteOverlay.style.height = "100%";
  vignetteOverlay.style.pointerEvents = "none";
  vignetteOverlay.style.zIndex = "1000";
  vignetteOverlay.style.background =
    "radial-gradient(circle at center, transparent 0%, rgba(255, 0, 0, 0.4) 100%)";
  vignetteOverlay.style.transition = "opacity 0.3s ease-in-out";
  vignetteOverlay.style.opacity = "0";
  document.body.appendChild(vignetteOverlay);
}

// Function to show/hide vignette effect
function toggleVignette(show) {
  if (vignetteOverlay) {
    vignetteOverlay.style.opacity = show ? "1" : "0";
  }
}

// Function to create a modern life bar
function createLifeBar() {
  if (lifeBarContainer) {
    document.body.removeChild(lifeBarContainer);
  }

  // Main container (holds heart + bar)
  lifeBarContainer = document.createElement("div");
  lifeBarContainer.style.position = "fixed";
  lifeBarContainer.style.bottom = "40px";
  lifeBarContainer.style.left = "50px";
  lifeBarContainer.style.display = "flex";
  lifeBarContainer.style.alignItems = "center";
  lifeBarContainer.style.gap = "8px"; // spacing between heart and bar
  lifeBarContainer.style.zIndex = "1000";

  // Heart icon
  const heartIcon = document.createElement("div");
  heartIcon.innerHTML = "❤️";
  heartIcon.style.fontSize = "18px";
  heartIcon.style.textShadow = "0 0 6px rgba(255,0,0,0.9), 0 0 12px rgba(255,50,50,0.8)";
  lifeBarContainer.appendChild(heartIcon);

  // Metallic outer frame
  const frame = document.createElement("div");
  frame.style.width = "320px";
  frame.style.height = "22px";
  frame.style.borderRadius = "6px";
  frame.style.padding = "2px";
  frame.style.background = "linear-gradient(135deg, #cfcfcf, #777, #e5e5e5)";
  frame.style.boxShadow = "0 0 10px rgba(255,255,255,0.4), inset 0 0 8px rgba(0,0,0,0.6)";
  frame.style.clipPath = "polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)"; // beveled
  frame.style.overflow = "hidden";
  frame.style.position = "relative";

  // Inner black area
  const barWrapper = document.createElement("div");
  barWrapper.style.width = "100%";
  barWrapper.style.height = "100%";
  barWrapper.style.background = "rgba(0,0,0,0.7)";
  barWrapper.style.clipPath = "inherit"; // same trapezoid
  barWrapper.style.overflow = "hidden";
  barWrapper.style.position = "relative";

  // Fill bar
  const lifeBarInner = document.createElement("div");
  lifeBarInner.id = "life-bar-inner";
  lifeBarInner.style.width = "100%";
  lifeBarInner.style.height = "100%";
  lifeBarInner.style.transition = "width 0.3s ease-out, background 0.3s ease-out";
  lifeBarInner.style.clipPath = "inherit";

  // Gloss shine overlay
  const gloss = document.createElement("div");
  gloss.style.position = "absolute";
  gloss.style.top = "0";
  gloss.style.left = "0";
  gloss.style.width = "100%";
  gloss.style.height = "100%";
  gloss.style.background = "linear-gradient(120deg, rgba(255,255,255,0.25) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.25) 100%)";
  gloss.style.animation = "shine 3s infinite linear";
  gloss.style.pointerEvents = "none";

  // Text (percentage)
  const lifeText = document.createElement("div");
  lifeText.id = "life-text";
  lifeText.style.position = "absolute";
  lifeText.style.width = "100%";
  lifeText.style.height = "100%";
  lifeText.style.display = "flex";
  lifeText.style.alignItems = "center";
  lifeText.style.justifyContent = "center";
  lifeText.style.color = "#fff";
  lifeText.style.fontFamily = "'Orbitron', sans-serif";
  lifeText.style.fontSize = "11px";
  lifeText.style.fontWeight = "bold";
  lifeText.style.textShadow = "0 0 5px #000, 0 0 10px rgba(255,255,255,0.8)";
  lifeText.style.zIndex = "2";

  // Append hierarchy
  barWrapper.appendChild(lifeBarInner);
  barWrapper.appendChild(gloss);
  barWrapper.appendChild(lifeText);
  frame.appendChild(barWrapper);
  lifeBarContainer.appendChild(frame);
  document.body.appendChild(lifeBarContainer);

  // Shine animation keyframes
  const styleTag = document.createElement("style");
  styleTag.innerHTML = `
    @keyframes shine {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `;
  document.head.appendChild(styleTag);

  updateLifeDisplay();
}

function updateLifeDisplay() {
  const lifeBarInner = document.getElementById("life-bar-inner");
  const lifeText = document.getElementById("life-text");

  if (lifeBarInner && lifeText) {
    const percentage = Math.max(0, Math.min(100, playerLife));

    // Gradient colors: Green → Yellow → Red
    let barColor;
    if (percentage > 60) {
      barColor = "linear-gradient(90deg, #33ff66, #00cc33)";
    } else if (percentage > 30) {
      barColor = "linear-gradient(90deg, #ffcc00, #ff9900)";
    } else {
      barColor = "linear-gradient(90deg, #ff3300, #cc0000)";
    }

    lifeBarInner.style.width = `${percentage}%`;
    lifeBarInner.style.background = barColor;
    lifeText.textContent = `${Math.round(percentage)}%`;

    if (percentage <= 0 && !isPlayerDead) {
      isPlayerDead = true;
      createDeathScreen();
      // Total time: 1s delay + 3s display = 4s
      setTimeout(respawnPlayer, 4000);
    }
  }
}



// Function to create death screen with optimized animation handling
function createDeathScreen() {
  // Clean up existing container
  if (deathScreenContainer?.parentNode) {
    deathScreenContainer.parentNode.removeChild(deathScreenContainer);
    deathScreenContainer = null;
  }

  // Create and initialize the death screen shader once
  if (!deathScreenShader) {
    deathScreenShader = createDeathScreenShader(renderer, scene, camera);
  }

  // Hide spell bar during death screen
  pointSystem?.setSpellBarVisible(false);

  // Wait 1 second while scene continues playing, then freeze and apply grayscale

  // IMMEDIATE EFFECT: Turn on grayscale using CSS (lightweight, no lag)
  if (renderer && renderer.domElement) {
    renderer.domElement.style.transition = "filter 0.1s ease-out";
    renderer.domElement.style.filter = "grayscale(100%)";
  }

  // DELAYED EFFECT: Freeze frame and show text after 1 second
  const deathTimeout = setTimeout(() => {
    if (isPlayerDead) { // Guard check
      // Remove CSS filter and switch to shader (freeze frame)
      if (renderer && renderer.domElement) {
        renderer.domElement.style.filter = "none";
      }

      // Capture the scene (freeze the frame)
      deathScreenShader.captureScene();

      // Add shader plane to scene
      scene.add(deathScreenShader.plane);
      deathScreenShader.setGrayscale(1.0);
      isDeathEffectActive = true;

      // Show text
      showDeathText();
    }
  }, 1000);

  // Store timeout ID for cleanup if needed
  return { container: deathScreenContainer, timeoutId: deathTimeout };
}

// Helper function to animate death effect (grayscale + text)
function animateDeathEffect() {
  const startTime = performance.now();
  const grayscaleDuration = 1000; // 1 second

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / grayscaleDuration, 1);

    deathScreenShader.setGrayscale(progress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
  showDeathText();
}

// Initialize death screen styles once (moved to top-level)
let deathStylesInitialized = false;

function initDeathScreenStyles() {
  if (deathStylesInitialized) return;
  deathStylesInitialized = true;

  const style = document.createElement("style");
  style.textContent = `
    .death-screen-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: transparent;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: 'Orbitron', sans-serif;
      color: #ff0000;
      text-shadow: 0 0 20px rgba(255, 0, 0, 0.8);
      pointer-events: none;
      opacity: 0;
      transition: opacity 1s ease-in-out;
    }
    
    .death-screen-overlay.visible {
      opacity: 1;
    }
    
    .death-text {
      font-size: 96px;
      font-weight: 750;
      margin-bottom: 30px;
      animation: pulse 2s infinite;
      text-shadow: 0 0 30px rgba(255, 0, 0, 1);
    }
    

    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// Helper function to show death text - optimized with CSS classes
function showDeathText() {
  initDeathScreenStyles();

  // Create text overlay container
  deathScreenContainer = document.createElement("div");
  deathScreenContainer.className = "death-screen-overlay";

  const deathText = document.createElement("div");
  deathText.className = "death-text";
  deathText.textContent = "YOU LOST";

  deathScreenContainer.appendChild(deathText);
  document.body.appendChild(deathScreenContainer);

  // Fade in the death screen text using CSS class
  requestAnimationFrame(() => {
    deathScreenContainer.classList.add("visible");
  });
}

// Helper function to animate dissolve effect
function animateDissolveEffect(onComplete) {
  const dissolveStartTime = performance.now();
  const dissolveDuration = 1500; // 1.5 seconds

  const animate = () => {
    const elapsed = performance.now() - dissolveStartTime;
    const progress = Math.min(elapsed / dissolveDuration, 1);

    deathScreenShader.setDissolve(progress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      if (onComplete) onComplete();
    }
  };

  animate();
}

// Function to respawn player - optimized
function respawnPlayer(checkpointName = "electroIntro") {
  if (!sceneInitialization?.playerFunction?.player) return;

  const player = sceneInitialization.playerFunction.player;

  // Reset player position to checkpoint
  const checkpoint = getCheckpoint("scene1", checkpointName);
  const posData = checkpoint || { position: { x: -58, y: 10, z: 5 }, rotation: { y: Math.PI / 2 } };

  player.position.set(posData.position.x, posData.position.y, posData.position.z);
  player.rotation.y = posData.rotation?.y || 0;

  if (checkpoint) {
    console.log("player defeated, rising at electroIntro checkpoint");
  }

  // Reset player life and controls via PointSystem
  pointSystem?.reset() || (playerLife = 100, updateLifeDisplay());

  // Reset defeat animation state
  if (sceneInitialization?.playerFunction?.resetDefeatState) {
    sceneInitialization.playerFunction.resetDefeatState();
  }

  // Reset vignette effect and animation states
  toggleVignette(false);
  isCactusAnimating = false;
  isCarnivorousAnimating = false;

  // Animate dissolve effect and cleanup
  if (deathScreenShader) {
    animateDissolveEffect(() => {
      scene.remove(deathScreenShader.plane);
      deathScreenShader.setGrayscale(0);
      deathScreenShader.setDissolve(0);
      isDeathEffectActive = false;
    });
  }

  // Reset CSS filter just in case
  if (renderer && renderer.domElement) {
    renderer.domElement.style.filter = "none";
  }

  // Fade out and remove death screen text
  if (deathScreenContainer) {
    deathScreenContainer.classList.remove("visible");
    setTimeout(() => {
      deathScreenContainer?.parentNode?.removeChild(deathScreenContainer);
      deathScreenContainer = null;
    }, 2000);
  }


  isPlayerDead = false;

  // Show spell bar again after respawn
  if (pointSystem) {
    pointSystem.setSpellBarVisible(true);
  }
}

export async function initializeScene1(existingRenderer, isVRMode) {
  setCurrentScene("scene1");
  await markSceneVisited("scene1");
  disposeSceneSystems();
  const userInfo = getUserInfo();
  originalSelectedCharacter = null;
  if (isEmilyCharacter(userInfo.selectedCharacter)) {
    originalSelectedCharacter = userInfo.selectedCharacter;
    updateUserInfo("characters/game_character.glb", userInfo.modeSelected);
  }
  // const stats = new Stats();
  // stats.showPanel(0);
  // document.body.appendChild(stats.dom);

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1500
  );
  camera.position.set(0, 0, 0);

  // Electro focus camera for closeup
  electroFocusCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1500
  );

  // Position for closeup of Electro (tweak as needed)
  electroFocusCamera.position.set(12, 10.5, -16);
  electroFocusCamera.lookAt(new THREE.Vector3(12, 9.8, -10));

  scene = new THREE.Scene();
  renderer = existingRenderer;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  switchToFirstPerson(camera, controls);
  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }

  await loadAllAsset(currentEntry, camera, renderer, scene);
  console.log(allAssets);

  // Create a simple sky background
  // const canvas = document.createElement('canvas');
  // canvas.width = 256;
  // canvas.height = 256;
  // const context = canvas.getContext('2d');

  // const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  // gradient.addColorStop(0, '#87CEEB');   // Sky blue at top
  // gradient.addColorStop(1, '#E0F6FF');   // Light blue at bottom

  // context.fillStyle = gradient;
  // context.fillRect(0, 0, canvas.width, canvas.height);

  // const gradientTexture = new THREE.CanvasTexture(canvas);
  // scene.background = gradientTexture;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.render(scene, camera);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;

  sceneInitialization = initializePhysicsAndPlayer(
    allAssets.models.gltf.garden,
    {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    },
    ["treeLeaf","treeLeaf1","grass","grass1","grass2","grass3","grass4","grass5","grass6","grass7","grass8","portalWall"],
    scene,
    camera,
    controls,
    renderer,
    {
      playerControllerModule: { initializePlayer: scene1InitializePlayer },
    }
  );

  setCameraAndControls(camera, controls, scene);

  const playerController = sceneInitialization?.playerFunction || null;
  const playerObject = playerController?.player || null;

  if (playerController) {
    createInventoryButton(playerController);
    setPlayerReference(playerController);
  } else {
    createInventoryButton();
  }

  rewardUI = createCollectedUI();

  if (playerObject) {
    if (!playerController.object) {
      playerController.object = playerObject;
    }
    playerObject.position.x += 0.75;
    playerObject.position.z += 0.35;
  }

  pointSystem = createPointSystem(scene, camera, playerController || playerObject);
  if (pointSystem && playerObject) {
    pointSystem.createPlayerHealthBar(playerObject);
  }
  if (playerController) {
    playerController.pointSystem = pointSystem;
  }

  // Register player defeat callback to trigger death sequence
  if (pointSystem) {
    pointSystem.setOnPlayerDefeated(() => {
      if (!isPlayerDead) {
        isPlayerDead = true;
        createDeathScreen();
        setTimeout(respawnPlayer, 3000);
      }
    });
  }

  quarksEffectInstance = createQuarksEffect({
    scene,
    position: new THREE.Vector3(12, 11, -15),
  });

  enemyController = createEnemy(scene, new THREE.Vector3(-7, 10.5, -4));

  if (enemyController && pointSystem) {
    const enemyModel = enemyController.getModel();
    if (enemyModel) {
      pointSystem.createEnemyHealthBar(enemyModel);
      pointSystem.enemyHealthBar?.setVisible(false);
    }
  }
  if (enemyController && playerController) {
    enemyController.setPlayer(playerController);
  }

  function startEnemySequence() {
    if (isEnemySequenceActive) return;
    if (!enemyController || !pointSystem) return;
    enemyController.setPointSystem(pointSystem);
    pointSystem.enemyHealthBar?.setVisible(true);
    isEnemySequenceActive = true;
  }

  detectionBox = null;
  if (enemyController?.getModel) {
    const model = enemyController.getModel();
    if (model) {
      detectionBox = addRayDetectionBox(
        model,
        null,
        new THREE.Vector3(0.6, 0.7, 0.6)
      );
    }
  }

  spellsController = setupPlayerSpells({
    scene,
    player: playerController || { object: playerObject },
    target: detectionBox || undefined,
    camera,
    pointSystem,
    onHit: () => {
      pointSystem?.damageEnemy?.(25);
    },
  });

  lightningSystem = new LightningSystem(scene);
  const sourcePositions = [];
  if (allAssets.models.gltf.garden) {
    allAssets.models.gltf.garden.traverse((child) => {
      if (child.isMesh && child.name?.startsWith("source")) {
        const position = new THREE.Vector3();
        child.getWorldPosition(position);
        sourcePositions.push(position);
      }
    });
  }
  if (sourcePositions.length === 0) {
    sourcePositions.push(
      new THREE.Vector3(-15, 15, -15),
      new THREE.Vector3(15, 15, 15),
      new THREE.Vector3(0, 25, 0)
    );
  }
  if (sourcePositions.length >= 2) {
    lightningSystem.setSourcePositions(sourcePositions);
    const LIGHTNING_THICKNESS = 0.035;
    const lightningParams = {
      ...DEFAULT_LIGHTNING_PARAMS,
      radius0: LIGHTNING_THICKNESS,
      radius1: LIGHTNING_THICKNESS,
      minRadius: 0.01,
    };
    lightningSystem.createLightningStrikesBetweenSources(lightningParams);
    lightningSystem.createSourceMarkers();

    // Lightning meshes are visible by default
    lightningSystem.lightningMeshes.forEach(mesh => {
      if (mesh) mesh.visible = true;
    });
  }

  const spherePosition = new THREE.Vector3(-47, -4.35, 24);
  const sphereRotation = new THREE.Euler(0, Math.PI, 0);

  // Find screen meshes from garden model (screen, screen1, screen2)
  const screenMeshes = [];
  let instructionsPanelMesh = null;
  if (allAssets.models.gltf.garden) {
    allAssets.models.gltf.garden.traverse((child) => {
      if (child.isMesh && (child.name === 'screen' || child.name === 'screen1' || child.name === 'screen2')) {
        screenMeshes.push(child);
      }
      if (child.isMesh && child.name === 'instructionsPanel') {
        instructionsPanelMesh = child;
      }
    });
    // Sort to ensure consistent order: screen, screen1, screen2
    screenMeshes.sort((a, b) => {
      const order = { 'screen': 0, 'screen1': 1, 'screen2': 2 };
      return (order[a.name] || 999) - (order[b.name] || 999);
    });
  }

  // Callback when all three spheres are stabilized
  const onAllSpheresStabilized = () => {
    console.log("All spheres stabilized! Showing lightning and dropping collectibles.");
    isLightningActive = false;
    if (hazardVisualizationMesh) {
      hazardVisualizationMesh.visible = false;
    }

    // Hide UI
    if (glowingSpheresSystem && glowingSpheresSystem.controls) {
      glowingSpheresSystem.controls.hideUI();
    }

    // Play success sound if available (reuse background or attack for now, or just rely on visual)
    // Ideally we'd have a success sound.

    // Visual Effect: Move quarks effect to this location and play
    if (quarksEffectInstance && quarksEffectInstance.group) {
      quarksEffectInstance.group.position.set(-47, -4, 24);
      quarksEffectInstance.play();
    }

    // Hide lightning meshes
    if (lightningSystem && lightningSystem.lightningMeshes) {
      lightningSystem.lightningMeshes.forEach(mesh => {
        if (mesh) mesh.visible = false;
      });
    }

    // Drop two collectibles (multimeter and resistor) at specified position
    const collectiblePosition = new THREE.Vector3(-43, 8, -4);

    // Drop multimeter
    const multimeterDrop = createCollectibleDrop(scene, collectiblePosition.clone(), renderer, controls, {
      count: 0,
      isStationary: false,
      treasureType: "multimeter",
      colliders: gardenColliderMeshes,
      groundY: 0.2,
      minSpeed: 0.5,
      maxSpeed: 1.5,
      upwardBias: 2.0,
    });
    activeCollectibles.push(multimeterDrop);

    // Drop resistor (slightly offset position)
    const resistorPosition = collectiblePosition.clone();
    resistorPosition.x += 3.0; // Offset by 3.0 units
    const resistorDrop = createCollectibleDrop(scene, resistorPosition, renderer, controls, {
      count: 0,
      isStationary: false,
      treasureType: "resistor",
      colliders: gardenColliderMeshes,
      groundY: 0.2,
      minSpeed: 0.5,
      maxSpeed: 1.5,
      upwardBias: 2.0,
    });
    activeCollectibles.push(resistorDrop);

    // Drop battery and connector (another offset position)
    const batteryPosition = collectiblePosition.clone();
    batteryPosition.x += 6.0; // Offset by 6.0 units
    const batteryDrop = createCollectibleDrop(scene, batteryPosition, renderer, controls, {
      count: 0,
      isStationary: false,
      treasureType: "batteryAndConnector",
      colliders: gardenColliderMeshes,
      groundY: 0.2,
      minSpeed: 0.5,
      maxSpeed: 1.5,
      upwardBias: 2.0,
    });
    activeCollectibles.push(batteryDrop);
  };

  glowingSpheresSystem = createGlowingSpheres(scene, renderer, {
    position: spherePosition,
    rotation: sphereRotation,
    onAllStabilized: onAllSpheresStabilized,
    screenMeshes: screenMeshes, // Pass screen meshes from garden model
    instructionsPanelMesh: instructionsPanelMesh, // Pass instructions panel mesh from garden model
  });

  if (pointSystem) {
    pointSystem.setOnEnemyDefeated(() => {
      const enemyModel = enemyController?.getModel?.();
      if (!enemyModel) return;
      const dropOrigin = enemyModel.position.clone();
      try {
        quarksEffectInstance?.group?.position.copy(dropOrigin);
        quarksEffectInstance?.play?.();
      } catch (_) { }
      const drop = createCollectibleDrop(scene, dropOrigin, renderer, controls, {
        count: 6,
        groundY: 0.2,
        minSpeed: 2,
        maxSpeed: 5,
        colliders: gardenColliderMeshes,
      });
      activeCollectibles.push(drop);
      enemyController?.markDefeated?.();
    });
  }

  function activateFloatingIslandContent() {
    if (hasActivatedFloatingIslandContent) return;
    hasActivatedFloatingIslandContent = true;

    if (floatingIslandMesh && floatingIslandMesh.userData.originalPosition) {
      // Move back to original position instead of just making visible
      floatingIslandMesh.position.copy(floatingIslandMesh.userData.originalPosition);
    }

    floatingIslandSystem = createFloatingIslandSystem(
      scene,
      playerController || playerObject,
      allAssets
    );
    if (
      floatingIslandSystem?.initializeColliders &&
      playerController?.addCollider &&
      playerController?.updateColliderPosition
    ) {
      floatingIslandSystem.initializeColliders(
        playerController.addCollider,
        playerController.updateColliderPosition
      );
    }

    stationaryEducationalTreasureConfigs.forEach(({ position, treasureType }) => {
      const drop = createCollectibleDrop(scene, position, renderer, controls, {
        count: 0,
        isStationary: true,
        treasureType,
        colliders: gardenColliderMeshes,
        groundY: position.y,
      });
      activeCollectibles.push(drop);
    });
  }

  const handleKeyPress = (event) => {
    const key = event.key.toLowerCase();

    if (key === "i") {
      // Prevent opening inventory if player is dead
      if (isPlayerDead) return;

      event.preventDefault();
      if (isInventoryVisible()) {
        hideInventory();
      } else {
        showInventory();
      }
      return;
    }

    // Handle E key for portal unlock
    if (key === "e" && portalUnlockUI && sceneInitialization?.playerFunction?.player) {
      event.preventDefault();
      const playerPosition = sceneInitialization.playerFunction.player.position;
      portalUnlockUI.checkPlayerInteraction(playerPosition, true);
      return;
    }

    if (glowingSpheresSystem && glowingSpheresSystem.controls) {
      // Cycle selection with Tab
      if (key === "tab") {
        event.preventDefault();
        glowingSpheresSystem.controls.cycleSlider();
      }

      // Adjust with Arrows
      if (key === "arrowleft") {
        // Only prevent default if we are close enough to interact (UI is visible)
        // We'll check visibility state from the system if possible, or just assume if it exists
        if (glowingSpheresSystem.controls.showUI) {
          // We can't easily check visibility state here without exposing it, 
          // but we can check if the player is close enough in the update loop.
          // For now, let's just allow it if the system exists.
          // Better: check distance here? No, expensive.
          // Let's just prevent default if it's an arrow key.
          event.preventDefault();
          glowingSpheresSystem.controls.adjustSlider(-0.05); // Slower, more precise adjustment
        }
      }
      if (key === "arrowright") {
        if (glowingSpheresSystem.controls.showUI) {
          event.preventDefault();
          glowingSpheresSystem.controls.adjustSlider(0.05);
        }
      }

      // Keep bracket controls for fine tuning if desired, or remove them. 
      // User didn't mention them, but they are harmless.
      if (key === "[") {
        event.preventDefault();
        glowingSpheresSystem.controls.adjustSlider(-0.01); // Very fine tune
      }
      if (key === "]") {
        event.preventDefault();
        glowingSpheresSystem.controls.adjustSlider(0.01);
      }
    }

    if (key === "y" && !hasSceneCompletionStarted) {
      triggerSceneCompletion("keyboard");
    }
  };
  window.addEventListener("keydown", handleKeyPress);

  // Add basic lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const clock = new THREE.Clock();

  // Helper function to calculate distance between two points
  function getDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point1.x - point2.x, 2) +
      Math.pow(point1.y - point2.y, 2) +
      Math.pow(point1.z - point2.z, 2)
    );
  }

  async function markSceneCompleted(sceneKey) {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn("No authenticated user; skipping scene completion update");
        return;
      }
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { [`scenesCompleted.${sceneKey}`]: true });
    } catch (e) {
      console.error("Failed to mark scene completed", e);
    }
  }


  function triggerSceneCompletion(triggerSource = "portal") {
    if (hasSceneCompletionStarted) return;
    hasSceneCompletionStarted = true;
    isSceneTransitioning = true;
    window.removeEventListener("keydown", handleKeyPress);

    const proceed = () => {
      markSceneCompleted("scene1");
      celebrateSceneCompletion({
        completedSceneKey: "scene1",
        nextSceneKey: "scene2",
        headline: "Mystical Forest Cleared!",
        subtext: "Next up: Futuristic City. Returning to scene select...",
        onCleanup: () => {
          if (sceneInitialization) {
            sceneInitialization.cleanUpCollider();
          }
          cleanupScene1();
        },
      });
    };

    const session = renderer?.xr?.getSession?.();
    if (session) {
      session
        .end()
        .catch((error) => console.error("Error ending VR session:", error))
        .finally(proceed);
    } else {
      proceed();
    }
  }

  // Helper function to move player to safe position
  function movePlayerToSafePosition(player, position, rotation) {
    if (!player) return;
    player.position.set(position.x, position.y, position.z);
    player.rotation.set(rotation.x, rotation.y, rotation.z);
    if (playerState) {
      playerState.velocity.set(0, 0, 0);
    }
  }

  // Add camera transition helpers
  function startElectroFocusCameraTransition() {
    isCameraTransitioning = true;
    transitionStartTime = performance.now();
    transitionStartPosition.copy(camera.position);
    transitionStartQuaternion.copy(camera.quaternion);
    transitionTargetPosition.copy(electroFocusCamera.position);
    transitionTargetQuaternion.copy(electroFocusCamera.quaternion);
    isElectroFocusActive = true;
    if (controls) controls.enabled = false;
  }

  function startMainCameraTransition() {
    // Check if cleanup is in progress and wait if necessary
    const electroState = getElectroState();
    if (electroState?.isCleanupInProgress) {
      // Wait for cleanup to complete before starting camera transition
      setTimeout(() => startMainCameraTransition(), 50);
      return;
    }

    // Add a small delay to ensure cleanup is complete before camera transition
    setTimeout(() => {
      isCameraTransitioning = true;
      transitionStartTime = performance.now();
      transitionStartPosition.copy(electroFocusCamera.position);
      transitionStartQuaternion.copy(electroFocusCamera.quaternion);
      transitionTargetPosition.copy(camera.position);
      transitionTargetQuaternion.copy(camera.quaternion);
      isElectroFocusActive = false;
      if (controls) controls.enabled = true;
    }, 100); // 100ms delay to allow cleanup to complete
  }

  // Initialize UFO
  function initializeUFO() {
    if (!scene || !allAssets) {
      console.error("Scene or assets not initialized when trying to create UFO");
      return;
    }

    const ufoModel = allAssets.models.gltf.ufo;
    if (!ufoModel) {
      console.error("UFO model not found in assets");
      return;
    }

    ufo = ufoModel.clone();
    ufo.visible = false;
    ufo.scale.set(0.1, 0.1, 0.1); // Scale down the UFO
    scene.add(ufo);
    console.log("UFO added to scene");
  }

  // Setup portal
  const portalPosition = new THREE.Vector3(61, 5.4, 2);
  const portalRotation = new THREE.Euler(0, Math.PI / 2, 0);
  portal = new Portal(scene, portalPosition, portalRotation);

  // Create portal unlock UI
  portalUnlockUI = createPortalUnlockUI(scene, portalPosition, () => {
    console.log('Portal unlock callback triggered - allowing scene transition');
  });

  // Helper: add lightweight vertex sway via shader for hanging mesh
  function addSwayToMaterial(material, minY, maxY) {
    if (!material || material.userData?.__hasHangingSway) return;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uMinY = { value: minY };
      shader.uniforms.uMaxY = { value: maxY };
      shader.uniforms.uAmpX = { value: 0.01 };
      shader.uniforms.uAmpZ = { value: 0.3 };
      shader.uniforms.uFreqX = { value: 0.18 };
      shader.uniforms.uFreqZ = { value: 0.25 };
      shader.uniforms.uPhase = { value: 1.3 };
      avatarHangingSwayUniforms.push(shader.uniforms);

      shader.vertexShader = `uniform float uTime;
uniform float uMinY;
uniform float uMaxY;
uniform float uAmpX;
uniform float uAmpZ;
uniform float uFreqX;
uniform float uFreqZ;
uniform float uPhase;
` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>

  float normY = clamp((position.y - uMinY) / max(0.0001, (uMaxY - uMinY)), 0.0, 1.0);
  float heightWeight = 1.0 - normY;
  float swayX = uAmpX * sin(uTime * uFreqX + uPhase);
  float swayZ = uAmpZ * sin(uTime * uFreqZ);
  transformed.x += swayX * heightWeight;
  transformed.z += swayZ * heightWeight;
`
      );
    };
    material.userData = material.userData || {};
    material.userData.__hasHangingSway = true;
    material.needsUpdate = true;
  }

  function setupHangingSway(targetMesh) {
    if (!targetMesh || !targetMesh.geometry) return;
    if (!targetMesh.geometry.boundingBox) targetMesh.geometry.computeBoundingBox();
    const box = targetMesh.geometry.boundingBox;
    const materials = Array.isArray(targetMesh.material)
      ? targetMesh.material
      : [targetMesh.material];
    materials.forEach((mat) => addSwayToMaterial(mat, box.min.y, box.max.y));
  }

  // Create minimap
  createMinimap(scene, sceneInitialization, portal);

  // Setup grass and vegetation
  if (allAssets.models.gltf.garden) {
    gardenColliderMeshes = extractColliderMeshes(allAssets.models.gltf.garden);
    let groundMesh = null;
    allAssets.models.gltf.garden.traverse((child) => {
      if (!floatingIslandMesh && child.name === "floatingIsland") {
        floatingIslandMesh = child;
        // Store original position and move far away instead of making invisible
        floatingIslandMesh.userData.originalPosition = floatingIslandMesh.position.clone();
        floatingIslandMesh.position.x -= 1000; // Move far away on Y-axis
      }
      if (child.isMesh && child.name === "center") {
        lightningCenterPosition = new THREE.Vector3();
        child.getWorldPosition(lightningCenterPosition);

        // Create hazard visualization
        const geometry = new THREE.SphereGeometry(2, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        hazardVisualizationMesh = new THREE.Mesh(geometry, material);
        hazardVisualizationMesh.position.copy(lightningCenterPosition);
        // scene.add(hazardVisualizationMesh);
      }
      if (child.isMesh && child.name === "low002") {
        groundMesh = child;
        groundMesh.userData = groundMesh.userData || {};
      }
      // Make wall mesh invisible
      if (child.isMesh && child.name === "wall" || child.name === "portalWall") {
        child.visible = false;
      }
      // Setup swinging for the Avatar-style hanging mesh
      if (!avatarHangingMesh && child.isMesh && child.name === "NurbsPath003") {
        avatarHangingMesh = child;
        try {
          // Compute bottom/top points of the mesh in world space (assuming Y-up)
          avatarHangingMesh.updateWorldMatrix(true, false);
          const box = new THREE.Box3().setFromObject(avatarHangingMesh);
          const anchorWorld = new THREE.Vector3(
            (box.min.x + box.max.x) * 0.5,
            box.max.y,
            (box.min.z + box.max.z) * 0.5
          );

          if (USE_SHADER_SWAY_FOR_HANGING) {
            // GPU sway: add lightweight vertex modification shader
            setupHangingSway(avatarHangingMesh);
          } else {
            // Create pivot at the top (anchored) point in the parent's local space
            const parentObject = avatarHangingMesh.parent;
            const anchorLocal = parentObject.worldToLocal(anchorWorld.clone());
            avatarHangingMeshPivot = new THREE.Group();
            avatarHangingMeshPivot.name = "AvatarHangingMeshPivot";
            avatarHangingMeshPivot.position.copy(anchorLocal);

            // Insert pivot into the same parent, then reparent mesh to pivot while preserving world transform
            parentObject.add(avatarHangingMeshPivot);

            // Preserve world transform while moving the mesh under the pivot
            parentObject.updateWorldMatrix(true, false);
            avatarHangingMesh.updateWorldMatrix(true, false);
            avatarHangingMeshPivot.updateWorldMatrix(true, false);
            const meshWorldMatrix = avatarHangingMesh.matrixWorld.clone();
            avatarHangingMeshPivot.add(avatarHangingMesh);
            const invPivotWorld = new THREE.Matrix4().copy(avatarHangingMeshPivot.matrixWorld).invert();
            const newLocalMatrix = invPivotWorld.multiply(meshWorldMatrix);
            newLocalMatrix.decompose(
              avatarHangingMesh.position,
              avatarHangingMesh.quaternion,
              avatarHangingMesh.scale
            );
          }
        } catch (e) {
          console.warn("Failed to set up swing for NurbsPath003:", e);
        }
      }
    });

    if (groundMesh) {
      let grassMesh = null;
      let wheatMesh = null;

      if (allAssets.models.gltf.grass) {
        allAssets.models.gltf.grass.traverse((child) => {
          if (child.isMesh && !grassMesh) {
            grassMesh = child;
            grassMesh.material.transparent = true;
            grassMesh.material.alphaTest = 0.1;
            grassMesh.material.depthWrite = true;
            grassMesh.material.side = THREE.DoubleSide;

            // Add subtle emissive glow to grass
            if (!grassMesh.material.emissive) {
              grassMesh.material.emissive = new THREE.Color(0x00ff00);
            }
            grassMesh.material.emissiveIntensity = 0.3;
            grassMesh.material.emissiveEnabled = true;
            grassMesh.material.needsUpdate = true;
          }
        });
      }

      if (allAssets.models.gltf.wheat) {
        allAssets.models.gltf.wheat.traverse((child) => {
          if (child.isMesh && !wheatMesh) {
            wheatMesh = child;

            // Add subtle emissive glow to wheat
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach(material => {
                if (!material.emissive) {
                  material.emissive = new THREE.Color(0xffff00);
                }
                material.emissiveIntensity = 1;
                material.emissiveEnabled = true;
                material.needsUpdate = true;
              });
            }
          }
        });
      }

      const groundBlueTexture = allAssets.textures.groundBlue?.image?.currentSrc ||
        allAssets.textures.groundBlue?.image?.src ||
        allAssets.textures.groundBlue?.image ||
        allAssets.textures.groundBlue?.src ||
        "/scene1/groundBlue.png";

      if (grassMesh && wheatMesh) {
        spreadInstancedRandomOnUVArea(
          scene,
          allAssets.models.gltf.garden,
          "low002",
          groundBlueTexture,
          "#0000ff",
          grassMesh,
          2500,
          wheatMesh,
          undefined,            // baseScale (optional)
          { wind: true }       // disable wind here
        );
      }
    } else {
      console.error("Ground mesh 'low002' not found in garden model");
    }
  } else {
    console.log("garden model not found in allAssets");
  }

  // Initialize electro components
  electroComponents = initializeElectro(scene, allAssets, sceneInitialization.playerFunction.player, camera, controls, renderer);
  setDependencies(
    camera,
    sceneInitialization.playerFunction.player,
    scene,
    controls,
    renderer
  );

  // Initialize UFO
  initializeUFO();

  // Setup plants
  // setupPlants(scene, allAssets);

  // Create vignette effect
  createVignetteEffect();

  // Create life bar
  // createLifeBar();

  // Show initial objective after loading screen is hidden (moved from timeout)

  // Start electro sequence after loading screen is hidden
  window.addEventListener("loadingScreenHidden-scene1", () => {
    if (isSceneTransitioning) {
      console.log("Scene transition in progress - skipping electro sequence");
      return;
    }
    if (!electroComponents) {
      console.log("Electro sequence cancelled - components not initialized");
      return;
    }
    console.log("Loading screen hidden - Scene1 is ready! Starting electro sequence.");
    // Show objectives after loading is complete
    backgroundAudio = allAssets.audios.background;
    backgroundAudio.play();
    // Prepare attack sound (non-looping by default; we will loop only during active attacks)
    try {
      attackAudio = allAssets.audios.attacksound || null;
      if (attackAudio) {
        attackAudio.setLoop ? attackAudio.setLoop(false) : (attackAudio.loop = false);
        attackAudio.setVolume ? attackAudio.setVolume(1) : (attackAudio.volume = 1);
        // Pause to ensure clean state
        if (attackAudio.isPlaying) attackAudio.stop?.();
      }
    } catch (_) { }
    // Show spell bar after loading is complete
    if (pointSystem) {
      pointSystem.setSpellBarVisible(true);
    }
    showObjective(1, objectives);
    startElectroSequence();
  });



  function handleElectroSequenceComplete() {
    activateFloatingIslandContent();
    startMainCameraTransition();
    startEnemySequence();
  }

  // Add a trigger point at position (11, 9.8, -20)
  triggerPoint = TriggerPoint(
    allAssets.vfxs.entryvfx,
    { x: 11, y: 9, z: -20 },
    scene,
    null,
    () => {
      hideObjective();
      // Move player to a fixed safe position and rotation before auto-move
      movePlayerToSafePosition(
        sceneInitialization.playerFunction.player,
        { x: 11, y: 10.3, z: -21 },
        { x: 0, y: Math.PI, z: 0 }
      );
      // Start camera transition to electro focus
      startElectroFocusCameraTransition();
      // Disable controls, reset actions, and auto-move player, then start electro sequence
      triggerAutoMoveAndDisableControls(
        sceneInitialization.playerFunction.player,
        () => {
          // Start the electro sequence and pass a callback to return camera after it's done
          startElectroAppearanceSequence(handleElectroSequenceComplete, triggerPoint);
          console.log("Player entered the trigger zone at (11, 9.8, -20) and auto-move completed");
        }
      );
    }
  );

  // VR Setup Block (new: mirrors scene5 - place after triggerPoint setup, before animate())
  if (isVRMode) {
    // Create clickable objects array for VR interaction
    const clickableObjects = [];

    // Add portal as clickable
    if (portal && portal.mesh) {
      portal.mesh.userData = {
        ...portal.mesh.userData,
        isPortal: true,
        onClick: () => {
          console.log('VR Controller clicked on portal');
          if (window.isElectroSequencePlaying) { // Gate with sequence flag (add this global if missing)
            console.log('Electro sequence playing, ignoring VR portal click');
            return;
          }
          triggerSceneCompletion("vr-portal");
        }
      };
      clickableObjects.push(portal.mesh);
    }

    // Add triggerPoint (if it has a 3D mesh/VFX; assume triggerPoint.mesh exists - adjust if not)
    if (triggerPoint && triggerPoint.mesh) {
      triggerPoint.mesh.userData = {
        ...triggerPoint.mesh.userData,
        isTriggerPoint: true,
        onClick: () => {
          console.log('VR Controller clicked on trigger point');
          if (window.isElectroSequencePlaying) {
            console.log('Electro sequence playing, ignoring VR trigger click');
            return;
          }
          // Invoke trigger callback (hideObjective, move player, start transition/sequence)
          hideObjective();
          movePlayerToSafePosition(sceneInitialization.playerFunction.player, { x: 11, y: 10.3, z: -21 }, { x: 0, y: 0, z: 0 });
          startElectroFocusCameraTransition();
          triggerAutoMoveAndDisableControls(sceneInitialization.playerFunction.player, () => {
            startElectroAppearanceSequence(handleElectroSequenceComplete, triggerPoint);
          });
        }
      };
      clickableObjects.push(triggerPoint.mesh);
    }

    // Add electro model and meshes (traverse for granular interaction, gate with sequence)
    if (electroComponents && electroComponents.electro) {
      electroComponents.electro.userData = {
        ...electroComponents.electro.userData,
        isElectro: true,
        onClick: () => {
          console.log('VR Controller clicked on Electro model');
          if (window.isElectroSequencePlaying) {
            console.log('Electro sequence playing, ignoring VR click');
            return;
          }
          // Trigger electro interaction (e.g., start sequence if not active)
          if (typeof startElectroSequence === 'function') startElectroSequence();
        }
      };
      clickableObjects.push(electroComponents.electro);

      // Add individual meshes for details
      electroComponents.electro.traverse((child) => {
        if (child.isMesh) {
          child.userData = {
            ...child.userData,
            isElectroMesh: true,
            parentModel: electroComponents.electro,
            onClick: () => {
              console.log(`VR Controller clicked on Electro mesh: ${child.name}`);
              if (window.isElectroSequencePlaying) return;
              // e.g., Show details or trigger sub-interaction (adapt from scene5's meshUIPanel)
              // For now, log; add showMeshUIPanel if implemented
            }
          };
          clickableObjects.push(child);
        }
      });
    }

    // Add plants (cactus, carnivorous) for attack interaction
    if (cactus) {
      cactus.userData = {
        ...cactus.userData,
        isCactus: true,
        onClick: () => {
          console.log('VR Controller clicked on cactus');
          if (window.isElectroSequencePlaying) return;
          // Trigger attack animation/life loss
          if (cactusAction && !isCactusAnimating) {
            isCactusAnimating = true;
            cactusAction.reset().play();
            // ... (rest of attack logic: audio, vignette, life--)
            const duration = cactusAction.getClip().duration * 1000;
            setTimeout(() => { isCactusAnimating = false; /* ... reset */ }, duration);
          }
        }
      };
      clickableObjects.push(cactus);
    }

    if (carnivorous) {
      carnivorous.userData = {
        ...carnivorous.userData,
        isCarnivorous: true,
        onClick: () => {
          console.log('VR Controller clicked on carnivorous plant');
          if (window.isElectroSequencePlaying) return;
          // Trigger attack (similar to cactus)
          if (carnivorousAction && !isCarnivorousAnimating) {
            isCarnivorousAnimating = true;
            carnivorousAction.reset().play();
            // ... (attack logic)
            const duration = carnivorousAction.getClip().duration * 1000;
            setTimeout(() => { isCarnivorousAnimating = false; /* ... */ }, duration);
          }
        }
      };
      clickableObjects.push(carnivorous);
    }

    // Add UFO
    if (ufo) {
      ufo.userData = {
        ...ufo.userData,
        isUFO: true,
        onClick: () => {
          console.log('VR Controller clicked on UFO');
          if (window.isElectroSequencePlaying) return;
          // Trigger UFO interaction (e.g., visibility toggle or sequence)
          ufo.visible = !ufo.visible;
        }
      };
      clickableObjects.push(ufo);
    }

    // Store clickable objects globally for VR updates
    window.vrClickableObjects = clickableObjects;

    // Get collision mesh from garden model (assume it exists; adjust path if needed)
    collisionMesh = allAssets.models.gltf.garden?.collisionMesh || null;
    if (collisionMesh) {
      setCollisionMesh(collisionMesh);
    }

    // Enable player movement for VR
    if (sceneInitialization?.playerFunction?.player) {
      enablePlayerMovement(sceneInitialization.playerFunction.player);
    }

    // Initialize VR session
    initializeVR(
      renderer,
      scene,
      camera,
      sceneInitialization.playerFunction.player,
      // backgroundMusic (commented like scene5),
      sceneInitialization.playerFunction.actions, // Assume actions exist from physics init
      clickableObjects,
      (clickedObject) => {
        // Handle VR click (invoke onClick if present)
        if (clickedObject && clickedObject.userData?.onClick) {
          clickedObject.userData.onClick();
        }
      }
    );

    // Debug logging (like scene5)
    console.log('VR Controller raycasting setup completed for Scene1');
    console.log('Clickable objects:', clickableObjects.length);
    console.log('Portal/Trigger/Electro/Plants/UFO added:', !!portal?.mesh || !!triggerPoint?.mesh || !!electroComponents?.electro || !!cactus || !!ufo);

    // Global debug function
    window.debugVRClickableObjects = () => {
      console.log('Current VR clickable objects:', window.vrClickableObjects);
      if (window.vrClickableObjects) {
        window.vrClickableObjects.forEach((obj, index) => {
          console.log(`Object ${index}:`, obj.name || obj.type, obj.userData);
        });
      }
    };
  }

  function animate() {
    if (userInfo.modeSelected === "vr") {
      renderer.setAnimationLoop(render);
    } else {
      function loop() {
        if (!camera) {
          cancelAnimationFrame(animationFrameId);
          return;
        }
        animationFrameId = requestAnimationFrame(loop);
        render();
      }
      loop();
    }
  }



  function render() {
    if (!scene || !camera || !renderer || !camera.isCamera) return;
    // stats.begin();
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    if (userInfo.modeSelected === "vr") {
      updateVR(); // New: Update VR controllers, raycasting, session
    } else {
      if (controls) {
        controls.update();
      }
    }

    // Update portal
    if (portal) {
      portal.update(elapsed);
    }

    // Gentle, slow swinging motion for the Avatar-style hanging mesh (CPU path)
    if (avatarHangingMeshPivot && !USE_SHADER_SWAY_FOR_HANGING) {
      const swayZ = 0.09 * Math.sin(elapsed * 0.25);
      const swayX = 0.06 * Math.sin(elapsed * 0.18 + 1.3);
      avatarHangingMeshPivot.rotation.z = swayZ;
      avatarHangingMeshPivot.rotation.x = swayX;
    }

    // Update GPU sway uniforms (GPU path)
    if (USE_SHADER_SWAY_FOR_HANGING && avatarHangingSwayUniforms.length) {
      for (const uniforms of avatarHangingSwayUniforms) {
        if (uniforms.uTime) uniforms.uTime.value = elapsed;
      }
    }

    if (enemyController && isEnemySequenceActive) {
      enemyController.update?.();
      enemyController.updateParticles?.(delta);
    }

    if (floatingIslandSystem) {
      floatingIslandSystem.update?.(delta, elapsed);
      if (
        floatingIslandSystem.updateColliderPositions &&
        playerController?.updateColliderPosition
      ) {
        floatingIslandSystem.updateColliderPositions(
          playerController.updateColliderPosition
        );
      }
    }

    if (lightningSystem) {
      lightningSystem.update(elapsed);

      // Lightning Hazard Check
      if (isLightningActive && !isPlayerDead && sceneInitialization?.playerFunction?.player && lightningCenterPosition) {
        const playerPos = sceneInitialization.playerFunction.player.position;
        const dist = playerPos.distanceTo(lightningCenterPosition);

        // If player is within 4 units of the center, trigger death
        if (dist < 3) {
          console.log("Player electrocuted by lightning!");
          isPlayerDead = true;
          if (sceneInitialization?.playerFunction?.playDefeatAnimation) {
            sceneInitialization.playerFunction.playDefeatAnimation();
          }
          createDeathScreen();
          setTimeout(() => respawnPlayer("resistorGame"), 3000);
        }
      }
    }

    if (glowingSpheresSystem?.update) {
      glowingSpheresSystem.update(elapsed);

      // Check distance for UI visibility
      if (sceneInitialization?.playerFunction?.player && glowingSpheresSystem.controls) {
        const playerPos = sceneInitialization.playerFunction.player.position;
        // Sphere position is (-47, -4.35, 24)
        const dist = playerPos.distanceTo(new THREE.Vector3(-47, -4.35, 24));
        if (dist < 15) { // Show UI when within 15 units
          glowingSpheresSystem.controls.showUI();
        } else {
          glowingSpheresSystem.controls.hideUI();
        }
      }
    }

    if (quarksEffectInstance?.update) {
      quarksEffectInstance.update(elapsed);
    }

    // Update death screen shader if active
    if (isDeathEffectActive && deathScreenShader) {
      deathScreenShader.update(delta);
    }

    if (pointSystem) {
      pointSystem.update();
    }

    if (spellsController?.update) {
      spellsController.update(elapsed);
    }

    if (activeCollectibles.length && sceneInitialization?.playerFunction?.player) {
      const playerPosition = sceneInitialization.playerFunction.player.position;
      for (let i = activeCollectibles.length - 1; i >= 0; i--) {
        const drop = activeCollectibles[i];
        drop.update(delta, elapsed);
        drop.checkCollection(playerPosition, 1.5, handleCollectiblePickup);
        if (drop.getActiveCount() === 0) {
          drop.dispose();
          activeCollectibles.splice(i, 1);
        }
      }
    }

    // Update minimap
    updateMinimap();

    // Update the trigger point logic
    if (triggerPoint && triggerPoint.updateQuarksScene && sceneInitialization?.playerFunction?.player) {
      triggerPoint.updateQuarksScene(delta, sceneInitialization.playerFunction.player);
    }

    // Update electro components
    if (electroComponents?.electroMixer) {
      electroComponents.electroMixer.update(delta);
    }

    // Update plant mixers
    if (cactusMixer) {
      cactusMixer.update(delta);
    }
    if (carnivorousMixer) {
      carnivorousMixer.update(delta);
    }

    // Ensure updateElectro is called to process auto-move and electro logic
    updateElectro(delta);

    // Only update hologram if it exists and is not being cleaned up
    const electroState = getElectroState();
    if (hologramEffect && typeof hologramEffect.update === 'function' && !electroState?.isCleanupInProgress) {
      hologramEffect.update(delta);
    }

    // Camera transition logic
    let currentCamera = camera;
    if (isCameraTransitioning) {
      const elapsed = (performance.now() - transitionStartTime) / 1000;
      const t = Math.min(elapsed / transitionDuration, 1);
      // Smoothstep for smooth transition
      const smoothT = t * t * (3 - 2 * t);
      const pos = new THREE.Vector3().lerpVectors(
        transitionStartPosition,
        transitionTargetPosition,
        smoothT
      );
      const quat = new THREE.Quaternion().slerpQuaternions(
        transitionStartQuaternion,
        transitionTargetQuaternion,
        smoothT
      );
      if (isElectroFocusActive) {
        electroFocusCamera.position.copy(pos);
        electroFocusCamera.quaternion.copy(quat);
        currentCamera = electroFocusCamera;
      } else {
        camera.position.copy(pos);
        camera.quaternion.copy(quat);
        currentCamera = camera;
      }
      if (t >= 1) {
        isCameraTransitioning = false;
      }
    } else if (isElectroFocusActive) {
      currentCamera = electroFocusCamera;
    } else {
      currentCamera = camera;
    }

    // Check plant interactions
    if (sceneInitialization?.playerFunction?.player) {
      const playerPosition = sceneInitialization.playerFunction.player.position;

      // Check cactus interaction
      if (cactus && cactusAction) {
        const distance = getDistance(playerPosition, cactus.position);
        if (distance <= ATTACK_DISTANCE && !isCactusAnimating) {
          isCactusAnimating = true;
          cactusAction.reset().play();
          // Start attack audio loop while any attack animation is active
          try {
            if (attackAudio) {
              attackAudio.setLoop ? attackAudio.setLoop(true) : (attackAudio.loop = true);
              if (!attackAudio.isPlaying) attackAudio.play?.();
            }
          } catch (_) { }
          toggleVignette(true);
          playerLife = Math.max(0, playerLife - 10);
          updateLifeDisplay();

          const duration = cactusAction.getClip().duration * 1000;
          setTimeout(() => {
            isCactusAnimating = false;
            toggleVignette(false);
            // If neither plant is animating, stop attack audio
            try {
              if (!isCactusAnimating && !isCarnivorousAnimating && attackAudio) {
                attackAudio.setLoop ? attackAudio.setLoop(false) : (attackAudio.loop = false);
                attackAudio.stop ? attackAudio.stop() : attackAudio.pause?.();
              }
            } catch (_) { }
          }, duration);
        }
      }

      // Check carnivorous plant interaction
      if (carnivorous && carnivorousAction) {
        const distance = getDistance(playerPosition, carnivorous.position);
        if (distance <= ATTACK_DISTANCE && !isCarnivorousAnimating) {
          isCarnivorousAnimating = true;
          carnivorousAction.reset().play();
          // Start attack audio loop while any attack animation is active
          try {
            if (attackAudio) {
              attackAudio.setLoop ? attackAudio.setLoop(true) : (attackAudio.loop = true);
              if (!attackAudio.isPlaying) attackAudio.play?.();
            }
          } catch (_) { }
          toggleVignette(true);
          playerLife = Math.max(0, playerLife - 15);
          updateLifeDisplay();

          const duration = carnivorousAction.getClip().duration * 1000;
          setTimeout(() => {
            isCarnivorousAnimating = false;
            toggleVignette(false);
            // If neither plant is animating, stop attack audio
            try {
              if (!isCactusAnimating && !isCarnivorousAnimating && attackAudio) {
                attackAudio.setLoop ? attackAudio.setLoop(false) : (attackAudio.loop = false);
                attackAudio.stop ? attackAudio.stop() : attackAudio.pause?.();
              }
            } catch (_) { }
          }, duration);
        }
      }
    }

    // Check for portal interaction
    if (sceneInitialization?.playerFunction?.player && portal && portal.mesh) {
      const playerPosition = sceneInitialization.playerFunction.player.position;
      const distance = getDistance(playerPosition, portal.mesh.position);

      // Update portal unlock UI
      if (portalUnlockUI) {
        portalUnlockUI.update();
        portalUnlockUI.checkPlayerInteraction(playerPosition, false);
      }

      // Only allow portal transition if unlocked
      if (distance <= 2 && !hasSceneCompletionStarted) {
        if (portalUnlockUI && portalUnlockUI.getUnlockStatus()) {
          triggerSceneCompletion("portal-proximity");
        } else if (!portalUnlockUI) {
          // Fallback if UI is not initialized
          triggerSceneCompletion("portal-proximity");
        }
      }
    }

    // New: VR collision handling (gated by sequence, like scene5)
    if (userInfo.modeSelected === "vr" && sceneInitialization?.playerFunction?.player && !window.isElectroSequencePlaying) {
      const player = sceneInitialization.playerFunction.player;
      if (collisionMesh) {
        handleCollisions(player, collisionMesh, playerState.velocity, delta);
      }
      // Apply velocity
      if (playerState.velocity.length() > 0) {
        player.position.x += playerState.velocity.x * delta;
        player.position.z += playerState.velocity.z * delta;
        if (!playerState.onGround) {
          player.position.y += playerState.velocity.y * delta;
        }
      }
    }

    // Only render if we have valid references at this moment (guard against async cleanup)
    if (renderer && scene && currentCamera && currentCamera.isCamera) {
      renderer.render(scene, currentCamera);
    }
    // stats.end();
  }

  animate();

  resizeHandler = () => {
    if (camera && renderer) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);

      // Update death screen shader if it exists
      if (deathScreenShader) {
        deathScreenShader.handleResize(window.innerWidth, window.innerHeight);
      }
    }
  };
  window.addEventListener("resize", resizeHandler);

  return {
    scene,
    camera,
    renderer,
    controls,
    sceneInitialization,
    electroComponents,
  };
}

export function cleanupScene1() {
  // Stop and clean up background music
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
    backgroundAudio = null;
  }
  // Stop and clear attackAudio
  try {
    if (attackAudio) {
      attackAudio.setLoop ? attackAudio.setLoop(false) : (attackAudio.loop = false);
      attackAudio.stop ? attackAudio.stop() : attackAudio.pause?.();
      attackAudio = null;
    }
  } catch (_) { }

  disposeSceneSystems();

  // Clean up death screen shader
  if (deathScreenShader) {
    if (scene && deathScreenShader.plane) {
      scene.remove(deathScreenShader.plane);
    }
    deathScreenShader.dispose();
    deathScreenShader = null;
  }
  isDeathEffectActive = false;

  // Clean up death screen container
  if (deathScreenContainer && deathScreenContainer.parentNode) {
    deathScreenContainer.parentNode.removeChild(deathScreenContainer);
    deathScreenContainer = null;
  }

  if (originalSelectedCharacter && isEmilyCharacter(originalSelectedCharacter)) {
    const userInfo = getUserInfo();
    updateUserInfo(originalSelectedCharacter, userInfo.modeSelected);
    originalSelectedCharacter = null;
  }

  // const stats = document.querySelector(".stats");
  // if (stats) {
  //   stats.remove();
  // }

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Clean up portal
  if (portal) {
    portal.dispose();
    portal = null;
  }

  // Cleanup portal unlock UI
  if (portalUnlockUI) {
    portalUnlockUI.dispose();
    portalUnlockUI = null;
  }
  collectedTreasureCount = 0;

  // Clean up minimap
  cleanupMinimap();

  // Clean up objectives
  cleanupObjectives();

  // Clean up floating island system
  if (floatingIslandSystem) {
    if (typeof floatingIslandSystem.cleanup === 'function') {
      floatingIslandSystem.cleanup();
    }
    floatingIslandSystem = null;
  }

  // Clean up trigger point
  if (triggerPoint && typeof triggerPoint.removeParticleEffects === 'function') {
    triggerPoint.removeParticleEffects();
    triggerPoint = null;
  }

  // Clean up electro components
  if (electroComponents) {
    if (electroComponents.electroMixer) {
      electroComponents.electroMixer.stopAllAction();
    }
    if (electroComponents.electro) {
      scene.remove(electroComponents.electro);
      if (electroComponents.electro.geometry) {
        electroComponents.electro.geometry.dispose();
      }
      if (electroComponents.electro.material) {
        if (Array.isArray(electroComponents.electro.material)) {
          electroComponents.electro.material.forEach(mat => mat.dispose());
        } else {
          electroComponents.electro.material.dispose();
        }
      }
    }
    electroComponents = null;
  }

  // Clean up electro system
  cleanupElectro();

  // New: VR Cleanup (mirrors scene5 - place after electro cleanup)
  cleanupVR(); // Ends session, disposes controllers
  if (sceneInitialization?.playerFunction?.player) {
    disablePlayerMovement(sceneInitialization.playerFunction.player);
  }
  if (window.vrClickableObjects) {
    window.vrClickableObjects.length = 0;
    delete window.vrClickableObjects;
  }

  // Clean up grass groups
  if (scene?.userData?.grassGroup) {
    scene.userData.grassGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    scene.remove(scene.userData.grassGroup);
    scene.userData.grassGroup = null;
  }

  // Clean up UFO
  if (ufo) {
    ufo.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    scene.remove(ufo);
    ufo = null;
  }

  // Remove life bar
  if (lifeBarContainer) {
    document.body.removeChild(lifeBarContainer);
    lifeBarContainer = null;
  }

  // Remove death screen
  if (deathScreenContainer) {
    document.body.removeChild(deathScreenContainer);
    deathScreenContainer = null;
  }

  // Remove vignette overlay
  if (vignetteOverlay) {
    document.body.removeChild(vignetteOverlay);
    vignetteOverlay = null;
  }

  // Clean up inventory
  cleanupInventory();

  // Clean up plants
  if (cactus) {
    cactus.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    scene.remove(cactus);
    cactus = null;
  }
  if (carnivorous) {
    carnivorous.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    scene.remove(carnivorous);
    carnivorous = null;
  }

  // Clean up hazard visualization
  if (hazardVisualizationMesh) {
    scene.remove(hazardVisualizationMesh);
    if (hazardVisualizationMesh.geometry) hazardVisualizationMesh.geometry.dispose();
    if (hazardVisualizationMesh.material) hazardVisualizationMesh.material.dispose();
    hazardVisualizationMesh = null;
  }
  carnivorous = null;
}

// Clean up avatar hanging mesh pivot and references
if (avatarHangingMeshPivot && !USE_SHADER_SWAY_FOR_HANGING) {
  try {
    if (avatarHangingMesh && avatarHangingMeshPivot.parent) {
      // Reparent mesh back to the original parent to avoid dangling refs
      const parentObject = avatarHangingMeshPivot.parent;
      parentObject.add(avatarHangingMesh);
      parentObject.remove(avatarHangingMeshPivot);
    }
  } catch (e) {
    // noop
  }
  avatarHangingMeshPivot = null;
}
avatarHangingMesh = null;
avatarHangingSwayUniforms = [];

if (sceneInitialization?.playerFunction?.player) {
  // Disable player movement if needed
}

if (scene) {
  scene.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
}

if (controls) {
  controls.dispose();
}

scene = null;
camera = null;
controls = null;
sceneInitialization = null;

// Reset plant-related variables
isCactusAnimating = false;
isCarnivorousAnimating = false;
isPlayerDead = false;
playerLife = 100;
isVignetteActive = false;
hasSceneCompletionStarted = false;
isEnemySequenceActive = false;
pointSystem?.enemyHealthBar?.setVisible(false);

// New: Reset VR globals
collisionMesh = null;
if (window.debugVRClickableObjects) delete window.debugVRClickableObjects;
