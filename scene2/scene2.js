/**
 * Scene 2 bootstrap and main loop.
 *
 * Responsibilities:
 *  - Load and configure the futuristic "university" world (GLTF, HDRI, VFX, audio)
 *  - Initialize player physics, hoverboard system, UFOs, portal and minimap
 *  - Orchestrate Electro's multi‑stage interaction and camera focus shots
 *  - Drive the per‑frame update loop for gameplay, VR, and UI overlays
 *  - Provide a thorough `cleanupScene2` for safe scene transitions.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  allAssets,
  checkExistingAssets,
  loadAllAsset,
} from "../commonFiles/assetsLoader.js";
import { assetsEntry as currentEntry } from "./assetsEntry.js";
import { assetsEntry as nextEntry } from "../scene3/assetsEntry.js";
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer.js";
import { setCurrentScene, getUserInfo } from "../data.js";
// import Stats from "three/examples/jsm/libs/stats.module.js";
import { createGUI, destroyGUI } from "../commonFiles/guiManager.js";
import {
  initializeVR,
  updateVR,
  cleanupVR,
  enablePlayerMovement,
  disablePlayerMovement,
  setCollisionMesh,
} from "../commonFiles/vrManager.js";
import {
  handleCollisions,
  playerState,
  handleHoverboardCollisions,
  togglePlayerControls,
  togglePlayerPhysics,
  addCollider,
  removeCollider,
  toggleColliderVisibility,
  toggleColliderPhysics,
  updateColliderPosition,
  debugColliderPositions,
  toggleColliderDebugVisibility,
  additionalColliders,
} from "../commonFiles/playerController.js";
import {
  initializeElectro,
  updateElectro,
  setVRMode,
} from "./electrointeraction.js";
import {
  cleanupDirectionArrow,
  initializeDirectionArrow,
  updateDirectionArrow,
} from "../commonFiles/directionArrow.js";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";
import {
  initializeHoverboard,
  updateHoverboardMovement,
  updateHoverboardCamera,
  hoverboard as hoverboardModule,
  hoverboardCollisionMesh as hoverboardCollisionMeshModule,
  attachPlayerToHoverboard,
  enableHoverboardEKey,
  disableHoverboardEKey,
} from "../commonFiles/hoverboard.js";
import { Portal, handlePortalSceneSwitch } from "../commonFiles/portal.js";

import {
  objectives,
  cleanupObjectives,
  showObjective,
} from "./objectives.js";
import { initializeScene3 } from "../scene3/scene3.js";
import { createHologram } from "./ufohologram.js";
import {
  playAudio,
  initializeAudioManager,
  cleanupAudioManager,
  pauseAudio,
  resumeAudio,
} from "../commonFiles/audiomanager.js";
import { createMinimap, updateMinimap, cleanupMinimap } from "./minimap.js";
import { auth, db } from "../WebFiles/firebase.js";
import { doc, updateDoc } from "firebase/firestore";
import { 
  initializeHoverGame, 
  updateHoverGame, 
  cleanupHoverGame, 
  resetHoverGame,
  getHoverGameStats,
  toggleCollisionDebug
} from "./hoverGame.js";
import { markSceneVisited } from "../data.js";
import { celebrateSceneCompletion } from "../commonFiles/sceneCompletionCelebration.js";



/**
 * Marks a scene as completed for the authenticated user in Firestore.
 *
 * @param {string} sceneKey - Key of the scene to mark as completed (e.g. "scene2").
 */
async function markSceneCompleted(sceneKey) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { [`scenesCompleted.${sceneKey}`]: true });
  } catch (e) {
    console.error("Failed to mark scene completed", e);
  }
}

let ufos = [];
let waterfallVideo = null;
let waterfallTexture = null;
let waterfallMeshes = [];
let objectivesKeyListener = null;
let gateDebugKeyListener = null;  // For v/x/d/c/h/r/g/b keys
let gateGroup;

let skybox;
let electro;
let scene, renderer, controls;
let glassMaterial;
let chromeMaterial;
let sphere001Mesh; // Add variable to store Sphere001 reference
let plane020Mesh;
let portal;
let leftGate, rightGate;
let backgroundAudio; // Add background music variable

// Add resizeHandler at module scope
let resizeHandler = null;

// Add Electro focus camera
let electroFocusCamera;
let isElectroFocusActive = false;

// Add sceneInitialization as a global variable
let sceneInitialization;
let collisionMesh;
let loadingHiddenHandler = null;

// Add back the camera transition variables needed for Electro focus
let isCameraTransitioning = false;
let transitionStartTime = 0;
const transitionDuration = 1.5; // Duration in seconds
let transitionStartPosition = new THREE.Vector3();
let transitionStartRotation = new THREE.Quaternion();
let transitionTargetPosition = new THREE.Vector3();
let transitionTargetRotation = new THREE.Quaternion();
let transitionCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

// Add these variables at the top level to store material references
let glassSettings = {
  metalness: 1.0,
  roughness: 0.0,
  transmission: 0.0,
  thickness: 1.13,
  envMapIntensity: 5.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  opacity: 0.8,
  color: "#93b7d2",
};

let chromeSettings = {
  metalness: 1,
  roughness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  reflectivity: 1.0,
  envMapIntensity: 1.0,
  ior: 3.0,
  specularIntensity: 1.0,
  color: "#f3ddfb",
};

let glassGradientSettings = {
  colorTop: "#050c66", // Green
  colorBottom: "#090a11", // Blue
  mix: 0.5, // Mix between colors
};

// Add gate opening functionality
let isGateOpening = false;
const gateOpenSpeed = 0.01;
const maxGateHeight = 10;

// Hoverboard state variables
let hoverboard = null;
let hoverboardCollisionMesh = null;
let isPlayerOnHoverboard = false;
// const hoverboardSpeed = 0.2;
const hoverboardRotationSpeed = 0.005;

// Add these variables at the top with other state variables
let hoverboardVelocity = new THREE.Vector3();
let hoverboardAcceleration = 0.01; // Increased for more responsive movement
let hoverboardDeceleration = 0.1; // Increased for faster stopping
let hoverboardMaxSpeed = 0.1;
let isMovingForward = false;
let isMovingBackward = false;
let isTurningLeft = false;
let isTurningRight = false;
let isMovingUp = false;
let isMovingDown = false;
const hoverboardVerticalSpeed = 0.05;

// Add hoverboard camera offset variables
let hoverboardCameraOffset = new THREE.Vector3(5, 2, 0);
let hoverboardCameraTargetOffset = new THREE.Vector3(0, 1, 0);
let isHoverboardCameraActive = false;

// Add hoverboard state variables
let hoverboardVisible = false;
let hoverboardMesh = null;
let hoverboardKeyListenerActive = false;
let hoverboardKeyListener = null;

// Add hoverboard shader effect variables
let hoverboardShaderEffect = null;
let hoverboardShaderMaterial = null;

let camera = null;
// Camera plane is no longer needed with the new objectives system
let ufoModel;
let hologramEffect;
let hologramEffects;
// Add texture animation speed variable at the top with other settings
let textureAnimationSpeed = 0.00045; // Default speed for texture animation

// Add at the top with other state variables
let isSceneTransitioning = false;
let currentObjectiveNumber = 1; // Track current objective number

// Add direction arrow variable
let directionArrow;

// Add animation frame ID variable
let animationFrameId = null;

// Function to remove hoverboard shader effect
const removeHoverboardShaderEffect = () => {
  if (hoverboardShaderEffect) {
    if (scene) {
      scene.remove(hoverboardShaderEffect);
    }
    if (hoverboardShaderEffect.geometry) {
      hoverboardShaderEffect.geometry.dispose();
    }
    if (hoverboardShaderEffect.material) {
      hoverboardShaderEffect.material.dispose();
    }
    hoverboardShaderEffect = null;
  }
  if (hoverboardShaderMaterial) {
    hoverboardShaderMaterial.dispose();
    hoverboardShaderMaterial = null;
  }
};

// Define handleKeyPress at the top level
/**
 * Global key handler for manual scene transition (Y key).
 *
 * This:
 *  - Ends any active WebXR session
 *  - Shows the "scene completed" celebration overlay
 *  - Defers cleanup to the overlay's `onCleanup` callback.
 */
function handleKeyPress(event) {
  if (event.key.toLowerCase() === "y" && !isSceneTransitioning) {
    isSceneTransitioning = true;
    const session = renderer.xr.getSession();

    const transitionToNextScene = (isVR) => {
      // Mark completed and show celebration overlay (cleanup in onCleanup)
      try { markSceneCompleted("scene2"); } catch (e) {}
      window.removeEventListener("keydown", handleKeyPress);
      celebrateSceneCompletion({
        completedSceneKey: "scene2",
        nextSceneKey: "scene3",
        headline: "Futuristic City Secured!",
        subtext: "Next up: Robotics University. Returning to scene select...",
        onCleanup: () => {
          if (sceneInitialization) {
            try { sceneInitialization.cleanUpCollider(); } catch (e) {}
          }
          try { cleanupScene2(); } catch (e) {}
        },
      });
      // Keep transition flag true until cleanup completes via overlay
    };

    if (session) {
      session
        .end()
        .then(() => {
          transitionToNextScene(true);
        })
        .catch((error) => {
          console.error("Error ending VR session:", error);
          isSceneTransitioning = false;
        });
    } else {
      transitionToNextScene(false);
    }
  }
}

/**
 * Main entry point for Scene 2 setup.
 *
 * High‑level flow:
 *  - Marks Scene 2 as current/visited and builds GUI controls
 *  - Constructs the Three.js scene, camera, renderer and loads all assets
 *  - Initializes physics/player, Electro triggers, hoverboard and hover game
 *  - Creates waterfall video planes, UFO swarm + holograms, gates and portal
 *  - Starts the animation loop and window resize handler.
 *
 * @param {THREE.WebGLRenderer} existingRenderer - Renderer instance to reuse.
 * @param {boolean} isVRMode - Whether Scene 2 is running in VR mode.
 * @returns {Object} Handles and references for other modules (scene, camera, electro, etc.).
 */
export async function initializeScene2(existingRenderer, isVRMode) {
  setCurrentScene("scene2");
  await markSceneVisited("scene2");

  const userInfo = getUserInfo();
  // const stats = new Stats();
  // stats.showPanel(0);
  // document.body.appendChild(stats.dom);

  // Create GUI after scene initialization
  const gui = createGUI();
  // close the GUI by default
  gui.close();

  // Cancel any existing animation frame
  animationFrameId = null;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Setup main camera with proper aspect ratio
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.set(0, 0, 1.6);

  // Create scene first
  scene = new THREE.Scene();

  // Add keyboard event listener for toggling objectives visibility
  let isObjectivesVisible = true;
  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "u") {
      isObjectivesVisible = !isObjectivesVisible;
      if (isObjectivesVisible) {
        showObjective(currentObjectiveNumber || 1, objectives);
      } else {
        // Hide objectives by showing empty objective
        const objectiveContainer = document.getElementById("objective-container");
        if (objectiveContainer) {
          objectiveContainer.style.opacity = "0";
        }
      }
    }
  });

  // Setup Electro focus camera
  electroFocusCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  electroFocusCamera.position.set(-1.3, 0.8, -253.2); // Position to view Electro's entrance
  electroFocusCamera.lookAt(0, 0, -242); // Look at Electro's initial position

  // Use existing renderer
  renderer = existingRenderer;

  // Ensure renderer is properly configured
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.physicallyCorrectLights = true;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Make sure renderer is in the document
  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }
  console.log(renderer.antialias);
  // Initialize loading manager with both camera and renderer
  await loadAllAsset(currentEntry, camera, renderer, scene);
  console.log(allAssets);

  // Initialize audio manager
  initializeAudioManager(camera, scene);
 

  // Add event listener for loading screen hidden
  // Ensure player doesn't move/fall during loading dissolve
  togglePlayerControls(false);
  togglePlayerPhysics(false);

  loadingHiddenHandler = () => {
    console.log("Loading screen hidden - Scene2 is ready!");
    // Show initial objective after loading screen is hidden
    showObjective(1, objectives);
    // Show minimap after loading screen is hidden
  // Inside loadingHiddenHandler:
createMinimap(scene, sceneInitialization, null);
    // Re-enable player once scene is shown
    togglePlayerPhysics(true);
    togglePlayerControls(true);
    
    // Start background music
    if (allAssets.audios.background) {
  playAudio("background")
    }
    
    // Remove this listener after first run
    window.removeEventListener("loadingScreenHidden-scene2", loadingHiddenHandler);
    loadingHiddenHandler = null;
  };
  window.addEventListener("loadingScreenHidden-scene2", loadingHiddenHandler);
  // Removed event listener for scene2Intro audio completion and related player control logic

  // scene.fog = new THREE.Fog(0x8894ac, 600, 1800);

  // Add HDR background
  if (allAssets.hdris.evening) {
    scene.environment = allAssets.hdris.evening;
    scene.background = allAssets.hdris.evening;
  }

  // const params = {
  //   height: 100,
  //   radius: 1200,
  //   enabled: true,
  // };

  // skybox = new GroundedSkybox(
  //   allAssets.hdris.evening,
  //   params.height,
  //   params.radius
  // );
  // skybox.position.y = 100;
  // scene.add(skybox);
  // scene.environment = allAssets.hdris.evening;
  scene.environmentIntensity = 0.5;
  // Force an immediate render to ensure proper sizing
  renderer.render(scene, camera);

  controls = new OrbitControls(camera, renderer.domElement);
  // controls.enabled = false;
  // controls.minDistance = 1;
  controls.dampingFactor = 0.25;
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2;
  controls.enablePan = false;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.5;

  // Add the event listener after scene initialization is complete
  window.addEventListener("keydown", handleKeyPress);

  sceneInitialization = initializePhysicsAndPlayer(
    allAssets.models.gltf.university,
    {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
    },
    [],
    scene,
    camera,
    controls,
    renderer
  );

  // Function to show hoverboard after second trigger
  const showHoverboardAfterSecondTrigger = () => {
    if (hoverboardVisible) return;
    
    // Use the actual hoverboard from the hoverboard system
    if (hoverboardModule) {
      hoverboardMesh = hoverboardModule;
      hoverboardMesh.position.set(0, 1.2, -227);
      hoverboardMesh.rotation.set(0, Math.PI / 2, 0);
      hoverboardMesh.visible = true;
      
      // Update collision mesh position
      if (hoverboardCollisionMeshModule) {
        hoverboardCollisionMeshModule.position.copy(hoverboardMesh.position);
        hoverboardCollisionMeshModule.rotation.copy(hoverboardMesh.rotation);
      }
      
      hoverboardVisible = true;
      
      // Create round shader effect for hoverboard
      createHoverboardShaderEffect();
      
      // Activate E key listener and create the event listener
      hoverboardKeyListenerActive = true;
      createHoverboardKeyListener();
      
      // Enable the hoverboard system's E key functionality
      enableHoverboardEKey();
      
      console.log("Hoverboard appeared! Press E to interact.");
    }
  };

  // Function to create round shader effect for hoverboard
  const createHoverboardShaderEffect = () => {
    if (!hoverboardMesh) return;
    
    // Create a sphere geometry for the shader effect
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    
    // Create shader material with glowing effect
    hoverboardShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        color: { value: new THREE.Color(0x00ffff) },
        intensity: { value: 1.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float intensity;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          float pulse = sin(time * 2.0) * 0.5 + 0.5;
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          float alpha = fresnel * pulse * intensity;
          
          gl_FragColor = vec4(color, alpha * 0.6);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    // Create the shader effect mesh
    hoverboardShaderEffect = new THREE.Mesh(sphereGeometry, hoverboardShaderMaterial);
    hoverboardShaderEffect.position.copy(hoverboardMesh.position);
    // hoverboardShaderEffect.position.y += 0.5; // Slightly above hoverboard
    
    // Add to scene
    scene.add(hoverboardShaderEffect);
  };

  // Initialize Electro
  const {
    electro,
    electroTrigger,
    secondElectroTrigger,
    thirdElectroTrigger,
    electroMixer,
    electroActions,
  } = initializeElectro(
    scene,
    allAssets,
    sceneInitialization.playerFunction.player,
    showHoverboardAfterSecondTrigger
  );

  // Add handler for third Electro sequence completion
  const onThirdElectroSequenceComplete = () => {
    if (isSceneTransitioning) return;
    isSceneTransitioning = true;
    const session = renderer.xr.getSession();

    const transitionToNextScene = (isVR) => {
      try { markSceneCompleted("scene2"); } catch (e) {}
      window.removeEventListener("keydown", handleKeyPress);
      celebrateSceneCompletion({
        completedSceneKey: "scene2",
        nextSceneKey: "scene3",
        headline: "Futuristic City Secured!",
        subtext: "Next up: Robotics University. Returning to scene select...",
        onCleanup: () => {
          if (sceneInitialization) {
            try { sceneInitialization.cleanUpCollider(); } catch (e) {}
          }
          try { cleanupScene2(); } catch (e) {}
        },
      });
    };

    if (session) {
      session
        .end()
        .then(() => {
          transitionToNextScene(true);
        })
        .catch((error) => {
          console.error("Error ending VR session:", error);
          isSceneTransitioning = false;
        });
    } else {
      transitionToNextScene(false);
    }
  };

  // Add lights
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(-500, 200, 100);
  directionalLight.target.position.set(0, 2, 600);
  // directionalLight.castShadow = true;
  // scene.add(directionalLight);

  const clock = new THREE.Clock();

  // Move the NurbsPath004 modification outside VR block and add logging
  if (allAssets.models.gltf.university) {
    glassMaterial;
    chromeMaterial;
    sphere001Mesh; // Add variable to store Sphere001 reference
    plane020Mesh; // Add variable to store Plane020 reference

    allAssets.models.gltf.university.traverse((child) => {
      if (child.isMesh && child.name === "wall") {
        child.visible = false;
      }
      if (child.isMesh && child.material && child.material.emissiveMap) {
        const existingMaterial = child.material;
        const emissiveColor = existingMaterial.emissive;

        const emissiveMaterial = new THREE.MeshStandardMaterial({
          ...existingMaterial,
          emissive: emissiveColor,
          emissiveIntensity: 2.5,
          toneMapped: false,
        });

        child.material = emissiveMaterial;
        child.material.needsUpdate = true;
      }

      // Add handler for Plane020
      if (child.isMesh && child.name === "Plane020") {
        plane020Mesh = child;
        // Store original texture coordinates
        const originalUVs = child.geometry.attributes.uv.array.slice();
        child.userData.originalUVs = originalUVs;
        child.userData.uvOffset = 0;
      }

      if (child.isMesh && child.name === "glass") {
        // Create gradient texture
        const gradientCanvas = document.createElement("canvas");
        gradientCanvas.width = 256;
        gradientCanvas.height = 256;
        const ctx = gradientCanvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, glassGradientSettings.colorTop);
        gradient.addColorStop(1, glassGradientSettings.colorBottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);

        const gradientTexture = new THREE.CanvasTexture(gradientCanvas);
        gradientTexture.needsUpdate = true;

        // Create new metallic glass material
        glassMaterial = new THREE.MeshPhysicalMaterial({
          metalness: glassSettings.metalness,
          roughness: glassSettings.roughness,
          transmission: glassSettings.transmission,
          thickness: glassSettings.thickness,
          envMapIntensity: glassSettings.envMapIntensity,
          clearcoat: glassSettings.clearcoat,
          clearcoatRoughness: glassSettings.clearcoatRoughness,
          map: gradientTexture,
          side: THREE.DoubleSide,
          fog: true,
        });

        child.material = glassMaterial;
        child.material.envMap = scene.environment || allAssets.hdris.night4;
        child.material.needsUpdate = true;
      }

      if (child.name === "Sphere001") {
        sphere001Mesh = child; // Store reference to Sphere001 mesh
        const glassMaterial1 = new THREE.MeshPhysicalMaterial({
          color: "#93b7d2",
          metalness: 1,
          roughness: 0.0,
          transmission: 1.0,
          thickness: 1.13,
          envMapIntensity: 1.13,
          transparent: true,
          opacity: 0.6,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          depthWrite: false,
        });
        child.material = glassMaterial1;
        child.material.envMap = scene.environment || allAssets.hdris.night4;
        child.material.needsUpdate = true;
      }

      if (
        child.isMesh &&
        (child.name === "chrome002" || child.name === "Sphere")
      ) {
        chromeMaterial = new THREE.MeshPhysicalMaterial({
          color: chromeSettings.color,
          metalness: chromeSettings.metalness,
          roughness: chromeSettings.roughness,
          clearcoat: chromeSettings.clearcoat,
          clearcoatRoughness: chromeSettings.clearcoatRoughness,
          reflectivity: chromeSettings.reflectivity,
          envMapIntensity: chromeSettings.envMapIntensity,
          ior: chromeSettings.ior,
          specularIntensity: chromeSettings.specularIntensity,
          side: THREE.DoubleSide,
          fog: true,
        });

        child.material = chromeMaterial;
        child.material.envMap = scene.environment || allAssets.hdris.night4;
        child.material.needsUpdate = true;
      }
    });

    // Add GUI controls
    const glassFolder = gui.addFolder("Glass Material");
    glassFolder.add(glassSettings, "metalness", 0, 1).onChange((value) => {
      glassMaterial.metalness = value;
    });
    glassFolder.add(glassSettings, "roughness", 0, 1).onChange((value) => {
      glassMaterial.roughness = value;
    });
    glassFolder.add(glassSettings, "transmission", 0, 1).onChange((value) => {
      glassMaterial.transmission = value;
    });
    glassFolder.add(glassSettings, "thickness", 0, 5).onChange((value) => {
      glassMaterial.thickness = value;
    });
    glassFolder
      .add(glassSettings, "envMapIntensity", 0, 15)
      .onChange((value) => {
        glassMaterial.envMapIntensity = value;
      });
    glassFolder.addColor(glassSettings, "color").onChange((value) => {
      glassMaterial.color.set(value);
    });

    // Add gradient controls to glass folder
    const gradientFolder = glassFolder.addFolder("Gradient Colors");
    gradientFolder
      .addColor(glassGradientSettings, "colorTop")
      .onChange((value) => {
        const ctx = glassMaterial.map.image.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, value);
        gradient.addColorStop(1, glassGradientSettings.colorBottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        glassMaterial.map.needsUpdate = true;
      });

    gradientFolder
      .addColor(glassGradientSettings, "colorBottom")
      .onChange((value) => {
        const ctx = glassMaterial.map.image.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, glassGradientSettings.colorTop);
        gradient.addColorStop(1, value);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        glassMaterial.map.needsUpdate = true;
      });

    gradientFolder.add(glassGradientSettings, "mix", 0, 1).onChange((value) => {
      const ctx = glassMaterial.map.image.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, glassGradientSettings.colorTop);
      gradient.addColorStop(value, glassGradientSettings.colorTop);
      gradient.addColorStop(1, glassGradientSettings.colorBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
      glassMaterial.map.needsUpdate = true;
    });

    const chromeFolder = gui.addFolder("Chrome Material");
    chromeFolder.add(chromeSettings, "metalness", 0, 1).onChange((value) => {
      chromeMaterial.metalness = value;
    });
    chromeFolder.add(chromeSettings, "roughness", 0, 1).onChange((value) => {
      chromeMaterial.roughness = value;
    });
    chromeFolder.add(chromeSettings, "clearcoat", 0, 1).onChange((value) => {
      chromeMaterial.clearcoat = value;
    });
    chromeFolder.add(chromeSettings, "reflectivity", 0, 1).onChange((value) => {
      chromeMaterial.reflectivity = value;
    });
    chromeFolder
      .add(chromeSettings, "envMapIntensity", 0, 5)
      .onChange((value) => {
        chromeMaterial.envMapIntensity = value;
      });
    chromeFolder.add(chromeSettings, "ior", 1, 5).onChange((value) => {
      chromeMaterial.ior = value;
    });
    chromeFolder.addColor(chromeSettings, "color").onChange((value) => {
      chromeMaterial.color.set(value);
    });

    // Add GUI controls for Sphere001 glass material
    const sphereGlassFolder = gui.addFolder("Sphere001 Glass Material");
    const sphereGlassSettings = {
      color: "#93b7d2",
      metalness: 1,
      roughness: 0.0,
      transmission: 0.0,
      thickness: 1.13,
      envMapIntensity: 1.13,
      opacity: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    };

    sphereGlassFolder
      .addColor(sphereGlassSettings, "color")
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.color.set(value);
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "metalness", 0, 1)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.metalness = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "roughness", 0, 1)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.roughness = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "transmission", 0, 1)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.transmission = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "thickness", 0, 5)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.thickness = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "envMapIntensity", 0, 5)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.envMapIntensity = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "opacity", 0, 1)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.opacity = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "clearcoat", 0, 1)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.clearcoat = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });
    sphereGlassFolder
      .add(sphereGlassSettings, "clearcoatRoughness", 0, 1)
      .onChange((value) => {
        if (sphere001Mesh) {
          sphere001Mesh.material.clearcoatRoughness = value;
          sphere001Mesh.material.needsUpdate = true;
        }
      });

    // Add GUI control for texture animation speed
    const textureAnimationFolder = gui.addFolder("Texture Animation");
    textureAnimationFolder
      .add({ speed: textureAnimationSpeed }, "speed", 0, 0.01)
      .onChange((value) => {
        textureAnimationSpeed = value;
      });

    scene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry.clone();
        const glassNames = ["video"];
        if (glassNames.includes(child.name)) {
          // Create material with proper settings
          const material = new THREE.MeshPhysicalMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            opacity: 1,
            metalness: 0.8,
            roughness: 0.05,
            transmission: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            envMapIntensity: 1.0,
            reflectivity: 0.9,
            ior: 1.5,
            thickness: 0.02,
            attenuationDistance: 1.0,
            attenuationColor: new THREE.Color(0xffffff),
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });

          // Apply new geometry and material
          child.geometry = geometry;
          child.material = material;

          // Store original geometry for cleanup
          child.userData.originalGeometry = child.geometry;
        }
      }
    });
  } else {
    console.log("university model not found in allAssets");
  }

  // Add the text to the plane
  // Promise.all([
  //   create3DText("Journey to", {
  //     size: 0.5, // Slightly smaller than INNOVERSE
  //     letterSpacing: 0.0275,
  //     color: 0xffffff,
  //     opacity: 1.0,
  //     position: { x: -4, y: 0, z: 0.1 }, // Slightly higher z position than INNOVERSE
  //     rotation: { x: 0, y: 0, z: 0 },
  //     font: "./fonts/Arc_Regular.json", // Specify Arc_Regular font
  //   }),
  //   create3DText("LEGENDIUM", {
  //     size: 1,
  //     letterSpacing: 0.032,
  //     color: 0xffffff,
  //     opacity: 1.0,
  //     position: { x: -4, y: -1.5, z: 0.1 },
  //     rotation: { x: 0, y: 0, z: 0 },
  //   }),
  // ]).then(([journeyText, inverseText]) => {
  //   plane.add(journeyText);
  //   plane.add(inverseText);
  // });

  // // Add key press event listener
  // window.addEventListener('keydown', (event) => {
  //   if (event.key.toLowerCase() === 'g') {
  //     openGate();
  //   }
  // });

  // Objective will be shown after loading screen is hidden

  // Define UFO configurations
  const ufoConfigs = [
    { position: new THREE.Vector3(500, 250, 350), scale: 1.5 },
    { position: new THREE.Vector3(-500, 250, 350), scale: 1.3 },
    { position: new THREE.Vector3(475, 250, 800), scale: 0.9 },
    { position: new THREE.Vector3(-450, 250, 800), scale: 1.0 },
    { position: new THREE.Vector3(300, 350, 575), scale: 0.8 },
    { position: new THREE.Vector3(-300, 350, 575), scale: 0.8 },
    { position: new THREE.Vector3(300, 250, -100), scale: 0.8 },
    { position: new THREE.Vector3(-300, 250, -100), scale: 0.8 },
    // Add two more UFOs with spiral movement in different areas
    {
      position: new THREE.Vector3(400, 250, 500),
      scale: 0.6,
      isRandom: true,
      spiralParams: {
        radius: 300,
        speed: 0.2,
        verticalSpeed: 0.08,
      },
    },
    {
      position: new THREE.Vector3(-400, 250, 0),
      scale: 0.6,
      isRandom: true,
      spiralParams: {
        radius: 250,
        speed: 0.15,
        verticalSpeed: 0.06,
      },
    },
    {
      position: new THREE.Vector3(300, 250, 400),
      scale: 0.6,
      isRandom: true,
      spiralParams: {
        radius: 300,
        speed: 0.2,
        verticalSpeed: 0.08,
      },
    },
  ];

  // Create array to store all hologram effects and UFOs
  hologramEffects = [];
  const ufos = [];

  // Create and configure multiple UFOs
  ufoConfigs.forEach((config) => {
    const ufoModel = allAssets.models.gltf.ufo.clone();
    scene.add(ufoModel);
    ufoModel.scale.set(config.scale, config.scale, config.scale);
    ufoModel.position.copy(config.position);

    // Store initial position and movement data
    ufoModel.userData = {
      initialPosition: config.position.clone(),
      bobOffset: Math.random() * Math.PI * 2,
      rotationOffset: Math.random() * Math.PI * 2,
      isRandom: config.isRandom || false,
      spiralAngle: Math.random() * Math.PI * 2,
      spiralRadius: config.spiralParams?.radius || 200 + Math.random() * 100,
      spiralHeight: config.position.y,
      spiralSpeed: config.spiralParams?.speed || 0.1,
      verticalSpeed: config.spiralParams?.verticalSpeed || 0.05,
      verticalDirection: Math.random() > 0.5 ? 1 : -1,
      centerOffset: config.isRandom
        ? new THREE.Vector3(config.position.x, 0, config.position.z)
        : new THREE.Vector3(0, 0, 0),
      bounds: {
        minX: -1000,
        maxX: 1000,
        minY: 150,
        maxY: 400,
        minZ: -1000,
        maxZ: 1000,
      },
    };

    // Create hologram effect only for non-spiral UFOs
    if (!config.isRandom) {
      hologramEffect = createHologram(scene, camera, renderer);
      ufoModel.add(hologramEffect.meshes[0]);
      hologramEffects.push(hologramEffect);
    }

    // Store UFO for updates
    ufos.push(ufoModel);
  });

  // Entry effect removed

  // Create and add waterfall to scene
  if (allAssets.videotextures.waterfall) {
    const { video, videoTexture } = createVideoTexture(
      "/scene22/waterfall3.mp4"
    );
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    // Wait for video metadata to get correct aspect ratio
    video.addEventListener("loadedmetadata", () => {
      const aspectRatio = video.videoWidth / video.videoHeight;
      const width = 115; // Base width
      const height = (width / aspectRatio) * 2; // Calculate height based on aspect ratio

      const waterfallplane = new THREE.PlaneGeometry(width, height);
      const waterfallMaterial = new THREE.MeshBasicMaterial({
        map: videoTexture,
        alphaMap: videoTexture,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      });

      const waterfallMesh = new THREE.Mesh(waterfallplane, waterfallMaterial);
      scene.add(waterfallMesh);
      waterfallMesh.position.set(375, 15, -140);
      waterfallMesh.rotation.x = -Math.PI / 5;
      // waterfallMesh.rotation.y = Math.PI / 8.14;
      // Create second waterfall with same aspect ratio
      const width2 = 413; // Base width for second waterfall
      const height2 = width2 / aspectRatio; // Calculate height based on aspect ratio

      const waterfallplane2 = new THREE.PlaneGeometry(width2, height2);
      const waterfallMesh2 = new THREE.Mesh(waterfallplane2, waterfallMaterial);
      scene.add(waterfallMesh2);
      waterfallMesh2.position.set(-868.3, 55, 325);
      waterfallMesh2.rotation.y = Math.PI / 2.14;
    });
  } else {
    console.warn("Waterfall video texture not loaded");
  }

  // Function to create video texture
  function createVideoTexture(videoSrc) {
    const video = document.createElement("video");
    const videoSettings = {
      src: videoSrc,
      muted: true,
      playsInline: true,
      autoplay: true,
    };
    Object.assign(video, videoSettings);

    // Always loop naturally
    video.loop = true;
    // Slow down playback for a calmer waterfall effect
    video.playbackRate = 0.9;

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.encoding = THREE.sRGBEncoding;

    // Start playing once loaded
    video.addEventListener("loadeddata", () => {
      // Ensure playback rate persists after load
      video.playbackRate = 0.9;
      video.play().catch((error) => console.log("Video play failed:", error));
    });

    return { video, videoTexture };
  }

  // Set VR mode for Electro interaction
  setVRMode(isVRMode);

  // Initialize VR if in VR mode
  if (isVRMode) {
    const { actionIdle, actionWalk, actionRun } =
      allAssets.characters.animations[userInfo.selectedCharacter];

    // Create clickable objects array for VR interaction
    const clickableObjects = [];
    if (electroTrigger) {
      clickableObjects.push(electroTrigger.mesh);
    }
    if (plane) {
      clickableObjects.push(plane);
    }

    initializeVR(
      renderer,
      scene,
      camera,
      sceneInitialization.playerFunction.player,
      sceneInitialization.playerFunction.actions,
      // {
      //   actionIdle,
      //   actionWalk,
      //   actionRun,
      //   currentAction: actionIdle,
      // },
      clickableObjects,
      () => {
        // Handle VR button click
        if (electroTrigger && electroTrigger.isPlayerNear()) {
          electroTrigger.onTrigger();
        }
      }
    );

    // Store reference to collision mesh
    collisionMesh = allAssets.models.gltf.university.collisionMesh;

    // Set collision mesh for VR
    setCollisionMesh(collisionMesh);

    // Enable player movement
    enablePlayerMovement(sceneInitialization.playerFunction.player);

    // Modified VR animation loop to include all scene updates
    // renderer.setAnimationLoop(() => {
    //   const delta = clock.getDelta();

    //   // Update VR controls first
    //   if (vrControls) {
    //     vrControls.updateVRControls();
    //   }

    //   // Update physics and collisions
    //   if (sceneInitialization.playerFunction.player) {
    //     const player = sceneInitialization.playerFunction.player;
    //     player.updateMatrixWorld();

    //     // Handle collisions with the environment
    //     if (collisionMesh) {
    //       handleCollisions(player, collisionMesh, playerState.velocity, delta);
    //     }

    //     // Apply any remaining velocity after collision
    //     if (playerState.velocity.length() > 0) {
    //       player.position.x += playerState.velocity.x * delta;
    //       player.position.z += playerState.velocity.z * delta;
    //       if (!playerState.onGround) {
    //         player.position.y += playerState.velocity.y * delta;
    //       }
    //     }
    //   }

    //   // Update Electro and other scene elements
    //   updateElectro(
    //     delta,
    //     electroMixer,
    //     electroActions,
    //     electroTrigger,
    //     secondElectroTrigger,
    //     thirdElectroTrigger,
    //     sceneInitialization.playerFunction.player,
    //     sceneInitialization.playerFunction.player.position,
    //     electro,
    //     entryEffect,
    //     onThirdElectroSequenceComplete,
    //     sceneInitialization.playerFunction.actions
    //   );

    //   // Update gate position if opening
    //   if (isGateOpening && plane && plane.position.y < maxGateHeight) {
    //     plane.position.y += gateOpenSpeed;
    //   } else if (isGateOpening && plane && plane.position.y >= maxGateHeight) {
    //     scene.remove(plane);
    //     isGateOpening = false;
    //   }

    //   // Update hoverboard movement and camera
    //   updateHoverboardMovement(delta, allAssets);
    //   updateHoverboardCamera(camera, controls);

    //   // Update all hologram effects
    //   if (hologramEffects) {
    //     hologramEffects.forEach((effect) => {
    //       effect.update(0.016);
    //     });
    //   }

    //   // Update camera transition if active
    //   if (isCameraTransitioning) {
    //     updateCameraTransition(delta);
    //   }

    //   // Use the appropriate camera based on the current state
    //   const currentCamera = isCameraTransitioning
    //     ? transitionCamera
    //     : isElectroFocusActive
    //     ? electroFocusCamera
    //     : camera;

    //   // Update camera plane position only if it exists and we have a valid camera
    //   if (cameraPlane && currentCamera && scene) {
    //     cameraPlane.updatePosition(currentCamera);
    //   }

    //   renderer.render(scene, currentCamera);
    // });

    // // Handle VR session start/end
    // renderer.xr.addEventListener("sessionstart", () => {
    //   if (vrControls) {
    //     vrControls.enableVR();
    //   }
    // });

    // renderer.xr.addEventListener("sessionend", () => {
    //   if (vrControls) {
    //     vrControls.disableVR();
    //   }
    // });

    // setVRControls(vrControls);
  }

  // Add after scene initialization but before the animation loop
 gateGroup = new THREE.Group();
  gateGroup.position.set(0, 3.6, -245.7);
  scene.add(gateGroup);

  // Create left gate plane
  const leftGateGeometry = new THREE.PlaneGeometry(8, 6);
  const leftGateMaterial = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    map: allAssets.textures.baseColor,
    normalMap: allAssets.textures.normalMap,
    roughness: 0.2,
    metalness: 0.8,
  });
  leftGate = new THREE.Mesh(leftGateGeometry, leftGateMaterial);
  leftGate.position.set(-4, 0, 0);
  leftGate.rotation.y = Math.PI;
  gateGroup.add(leftGate);

  // Create right gate plane
  const rightGateGeometry = new THREE.PlaneGeometry(8, 6);
  const rightGateMaterial = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    map: allAssets.textures.baseColor,
    normalMap: allAssets.textures.normalMap,
    roughness: 0.2,
    metalness: 0.8,
  });
  rightGate = new THREE.Mesh(rightGateGeometry, rightGateMaterial);
  rightGate.position.set(4.0, 0, 0);
  rightGate.rotation.y = 0;
  gateGroup.add(rightGate);

  // Add collision to both gates
  const leftGateCollider = addCollider("leftGate", leftGate);
  leftGateCollider.position.copy(leftGate.position);
  leftGateCollider.rotation.copy(leftGate.rotation);
  gateGroup.add(leftGateCollider);

  const rightGateCollider = addCollider("rightGate", rightGate);
  rightGateCollider.position.copy(rightGate.position);
  rightGateCollider.rotation.copy(rightGate.rotation);
  gateGroup.add(rightGateCollider);

  // Store references to colliders for updating
  leftGate.userData.collider = leftGateCollider;
  rightGate.userData.collider = rightGateCollider;

  // Add keyboard controls for the demo cube
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "v") {
      openGate();
    } else if (event.key.toLowerCase() === "x") {
      // Remove gates completely
      scene.remove(gateGroup);
      removeCollider("leftGate");
      removeCollider("rightGate");
    } else if (event.key.toLowerCase() === "d") {
      // Debug collider positions
      debugColliderPositions();
    } else if (event.key.toLowerCase() === "c") {
      // Toggle collider visibility for debugging
      toggleColliderDebugVisibility(true);
    } else if (event.key.toLowerCase() === "h") {
      // Hide collider visibility
      toggleColliderDebugVisibility(false);
    } else if (event.key.toLowerCase() === "r") {
      // Reset hover game
      resetHoverGame();
      console.log("Hover game reset!");
    } else if (event.key.toLowerCase() === "g") {
      // Show hover game stats
      // const stats = getHoverGameStats();
      // console.log("Hover Game Stats:", stats);
    } else if (event.key.toLowerCase() === "b") {
      // Toggle collision debug visualization
      toggleCollisionDebug();
    }
  });

  // Initialize direction arrow after scene initialization
  const triggerPositions = [
    new THREE.Vector3(0, 0.6, -252), // First trigger
    new THREE.Vector3(-2.2, 0.6, -230), // Second trigger
    new THREE.Vector3(-31, 3, 610), // Third trigger
  ];
  directionArrow = initializeDirectionArrow(scene, triggerPositions);

  // // Initialize minimap
  // createMinimap(scene, sceneInitialization, null);

  // Setup portal for scene2
  const portalPosition = new THREE.Vector3(-30.4, 5.3, 619); // Place near university entrance
  const portalRotation = new THREE.Euler(0, 0, 0);
  portal = new Portal(scene, portalPosition, portalRotation, 1.5); // Scale factor of 1.5

/**
 * Starts the Scene 2 animation loop.
 *
 * In VR:
 *   - Delegates to `renderer.setAnimationLoop(render)`.
 * In non‑VR:
 *   - Uses `requestAnimationFrame` with an internal `loop` function.
 */
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

  /**
   * Per‑frame update for Scene 2.
   *
   * Responsibilities:
   *  - Updates minimap, direction arrow and portal
   *  - Updates hoverboard movement/camera and hover‑rings mini‑game
   *  - Steps player collisions, Electro interaction and gate animation
   *  - Chooses the correct active camera (player vs Electro focus vs transition)
   *  - Renders the scene.
   */
  function render() {
    // Check if camera exists before rendering
    if (!camera || !renderer || !scene) {
      return;
    }

    // stats.begin();
    const delta = clock.getDelta();

    // Update direction arrow (use world position to handle parenting to hoverboard)
    if (directionArrow && sceneInitialization?.playerFunction?.player) {
      const playerWorldPos = new THREE.Vector3();
      sceneInitialization.playerFunction.player.getWorldPosition(playerWorldPos);
      updateDirectionArrow(delta, playerWorldPos, camera);
    }

    // Update minimap
    updateMinimap();

    // Update UFO bobbing animation and spiral movement
    const time = performance.now() * 0.001; // Convert to seconds
    if (ufos) {
      ufos.forEach((ufo) => {
        // Gentle bobbing motion
        const bobHeight = 2; // Height of bobbing motion
        const bobSpeed = 0.5; // Speed of bobbing
        const rotationSpeed = 0.6; // Speed of rotation

        // Calculate new position with bobbing
        const newY =
          ufo.userData.initialPosition.y +
          Math.sin(time * bobSpeed + ufo.userData.bobOffset) * bobHeight;

        // Apply bobbing
        ufo.position.y = newY;

        // Add gentle rotation
        ufo.rotation.y =
          Math.sin(time * rotationSpeed + ufo.userData.rotationOffset) * 0.1;

        // Handle spiral movement for specific UFOs
        if (ufo.userData.isRandom) {
          // Update spiral angle
          ufo.userData.spiralAngle += ufo.userData.spiralSpeed * delta;

          // Calculate new position in spiral relative to center offset
          const x =
            ufo.userData.centerOffset.x +
            Math.cos(ufo.userData.spiralAngle) * ufo.userData.spiralRadius;
          const z =
            ufo.userData.centerOffset.z +
            Math.sin(ufo.userData.spiralAngle) * ufo.userData.spiralRadius;

          // Update vertical position
          ufo.userData.spiralHeight +=
            ufo.userData.verticalSpeed * ufo.userData.verticalDirection;

          // Check vertical bounds and reverse direction if needed
          if (ufo.userData.spiralHeight > ufo.userData.bounds.maxY - 50) {
            ufo.userData.verticalDirection = -1;
          } else if (
            ufo.userData.spiralHeight <
            ufo.userData.bounds.minY + 50
          ) {
            ufo.userData.verticalDirection = 1;
          }

          // Check horizontal bounds and adjust radius if needed
          const currentRadius = Math.sqrt(
            Math.pow(x - ufo.userData.centerOffset.x, 2) +
              Math.pow(z - ufo.userData.centerOffset.z, 2)
          );

          if (currentRadius > ufo.userData.bounds.maxX - 100) {
            ufo.userData.spiralRadius *= 0.95;
          } else if (currentRadius < 100) {
            ufo.userData.spiralRadius *= 1.05;
          }

          // Apply new position
          ufo.position.set(x, ufo.userData.spiralHeight, z);

          // Make UFO face direction of movement
          const targetRotation =
            Math.atan2(
              z - ufo.userData.centerOffset.z,
              x - ufo.userData.centerOffset.x
            ) +
            Math.PI / 2;
          ufo.rotation.y = targetRotation;

          // // Occasionally change spiral parameters
          // if (Math.random() < 0.001) {
          //   ufo.userData.spiralSpeed = (ufo.userData.spiralSpeed * 0.8) + (Math.random() * 0.2);
          //   ufo.userData.verticalSpeed = (ufo.userData.verticalSpeed * 0.8) + (Math.random() * 0.1);
          // }
        }
      });
    }

    // Update portal
    if (portal) {
      portal.update(time);
    }

    // Update VR if in VR mode
    if (userInfo.modeSelected === "vr") {
      updateVR();
    } else {
      // Update controls only in non-VR mode
      if (controls) {
        controls.update();
      }
    }

    // Update physics and collisions (skip while on hoverboard to prevent jitter)
    if (!window.isPlayerOnHoverboard && sceneInitialization?.playerFunction?.player) {
      const player = sceneInitialization.playerFunction.player;
      player.updateMatrixWorld();

      // Handle collisions with the environment
      if (collisionMesh) {
        handleCollisions(player, collisionMesh, playerState.velocity, delta);
      }

      // Apply any remaining velocity after collision
      if (playerState.velocity.length() > 0) {
        player.position.x += playerState.velocity.x * delta;
        player.position.z += playerState.velocity.z * delta;
        if (!playerState.onGround) {
          player.position.y += playerState.velocity.y * delta;
        }
      }
    }

    // Update Electro and other scene elements
    if (
      electroMixer &&
      electroActions &&
      electroTrigger &&
      secondElectroTrigger &&
      thirdElectroTrigger
    ) {
      updateElectro(
        delta,
        electroMixer,
        electroActions,
        electroTrigger,
        secondElectroTrigger,
        thirdElectroTrigger,
        sceneInitialization?.playerFunction?.player,
        sceneInitialization?.playerFunction?.player?.position,
        electro,
        onThirdElectroSequenceComplete,
        sceneInitialization?.playerFunction?.actions,
        showHoverboardAfterSecondTrigger
      );
    }

    // Update gate position if opening
    if (isGateOpening && gateGroup) {
      const moveSpeed = 2.0; // Units per second
      const maxDistance = 8; // Maximum distance to move apart
      const movement = moveSpeed * delta; // Scale movement by delta time

      // Move left gate to the left
      if (leftGate.position.x > leftGate.userData.initialX - maxDistance) {
        leftGate.position.x -= movement;
        updateColliderPosition("leftGate", leftGate.position, leftGate.rotation);
      }

      // Move right gate to the right
      if (rightGate.position.x < rightGate.userData.initialX + maxDistance) {
        rightGate.position.x += movement;
        updateColliderPosition("rightGate", rightGate.position, rightGate.rotation);
      }

      // Check if both gates have reached their maximum distance
      if (
        leftGate.position.x <= leftGate.userData.initialX - maxDistance &&
        rightGate.position.x >= rightGate.userData.initialX + maxDistance
      ) {
        // Remove gates and colliders
        scene.remove(gateGroup);
        removeCollider("leftGate");
        removeCollider("rightGate");
        isGateOpening = false;
      }
    }

    // Update hoverboard movement and camera
    if (allAssets) {
      updateHoverboardMovement(delta, allAssets);
      updateHoverboardCamera(camera, controls, delta);
    }

    // Update hover game
    updateHoverGame(delta);

    // Update camera transition if active
    if (isCameraTransitioning) {
      updateCameraTransition(delta);
    }

    // Use the appropriate camera based on the current state
    const currentCamera = isCameraTransitioning
      ? transitionCamera
      : isElectroFocusActive
      ? electroFocusCamera
      : camera;

          // Camera plane is no longer needed with the new objectives system

    // Update all hologram effects
    if (hologramEffects) {
      hologramEffects.forEach((effect) => {
        effect.update(0.016);
      });
    }

    // Update hoverboard shader effect
    if (hoverboardShaderEffect && hoverboardShaderMaterial) {
      hoverboardShaderMaterial.uniforms.time.value = time;
    }

    // Update texture animation for Plane020
    if (plane020Mesh && plane020Mesh.userData.originalUVs) {
      const uvs = plane020Mesh.geometry.attributes.uv.array;
      const originalUVs = plane020Mesh.userData.originalUVs;

      // Update UV offset
      plane020Mesh.userData.uvOffset += textureAnimationSpeed;
      if (plane020Mesh.userData.uvOffset > 1) {
        plane020Mesh.userData.uvOffset -= 1;
      }

      // Apply offset to UVs
      for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] = originalUVs[i] + plane020Mesh.userData.uvOffset;
      }
      plane020Mesh.geometry.attributes.uv.needsUpdate = true;
    }

    // After updateHoverboardMovement and updateHoverboardCamera
    if (
      window.isPlayerOnHoverboard &&
      sceneInitialization?.playerFunction?.selectedPlayerMixer
    ) {
      sceneInitialization.playerFunction.selectedPlayerMixer.update(
        clock.getDelta()
      );
      
      // Update to objective 4 when player gets on hoverboard (objective 3 should already be shown)
      if (currentObjectiveNumber === 3) {
        showObjective(4, objectives);
        currentObjectiveNumber = 4;
      }
    }

    // Check for portal interaction
    if (sceneInitialization?.playerFunction?.player && portal && portal.mesh) {
      const playerPosition = sceneInitialization.playerFunction.player.position;
      const distance = playerPosition.distanceTo(portal.mesh.position);
      
      if (distance <= 2 && !isSceneTransitioning) {
        handlePortalSceneSwitch({
          renderer,
          nextEntry,
          initializeNextScene: initializeScene3,
          cleanupCurrentScene: cleanupScene2,
          sceneInitialization,
          isSceneTransitioningRef: { value: isSceneTransitioning },
          handleKeyPress,
        });
      }
    }

    // Only render if we have a valid camera
    if (currentCamera) {
      renderer.render(scene, currentCamera);
    }
    // stats.end();
  }

  animate();
  // Define resizeHandler to handle all camera updates
  resizeHandler = () => {
    const aspect = window.innerWidth / window.innerHeight;

    // Update main camera
    if (camera) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }

    // Update electro focus camera
    if (electroFocusCamera) {
      electroFocusCamera.aspect = aspect;
      electroFocusCamera.updateProjectionMatrix();
    }

    // Update transition camera if it exists
    if (transitionCamera) {
      transitionCamera.aspect = aspect;
      transitionCamera.updateProjectionMatrix();
    }

    // Update renderer size
    if (renderer) {
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  window.addEventListener("resize", resizeHandler);

  // Initialize hoverboard
  initializeHoverboard(
    scene,
    allAssets,
    sceneInitialization.playerFunction.player,
    false,
    camera // Disable manual detachment for scene2
  );

  // Initialize hover game after hoverboard is available
  initializeHoverGame(scene, sceneInitialization.playerFunction.player);

  // E key event listener for hoverboard interaction (only active after second trigger)
  const createHoverboardKeyListener = () => {
    if (hoverboardKeyListener) return; // Already created
    
    hoverboardKeyListener = (event) => {
      if (event.key.toLowerCase() === "e" && hoverboardKeyListenerActive && hoverboardVisible) {
        // Handle hoverboard interaction
        if (hoverboardMesh && !window.isPlayerOnHoverboard) {
          // Remove the round shader effect when player enters hoverboard
          removeHoverboardShaderEffect();
          
          // Move player to hoverboard position before attaching
          if (sceneInitialization?.playerFunction?.player) {
            const player = sceneInitialization.playerFunction.player;
            player.position.set(-1.02, 2, -227);
            
            // Reset player velocity
            if (playerState) {
              playerState.velocity.set(0, 0, 0);
            }
          }
          
                  // Disable the E key functionality since player is now attaching
        hoverboardKeyListenerActive = false;
        
        // Remove the E key listener since player is now attached
        if (hoverboardKeyListener) {
          document.removeEventListener("keydown", hoverboardKeyListener);
          hoverboardKeyListener = null;
        }
        
        // Disable the hoverboard system's E key functionality
        disableHoverboardEKey();
        
        // Call the hoverboard system's attach function
        attachPlayerToHoverboard();
        }
      }
    };
    
    // Add the event listener
    document.addEventListener("keydown", hoverboardKeyListener);
    console.log("Hoverboard E key listener activated!");
  };

  // Add function to update current objective number (for electrointeraction.js)
  window.setCurrentObjectiveNumber = (number) => {
    currentObjectiveNumber = number;
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    sceneInitialization,
    electro,
    electroTrigger,
    secondElectroTrigger,
    thirdElectroTrigger,
    electroMixer,
    electroActions,
    hologramEffects,
    onThirdElectroSequenceComplete,
  };
}

/**
 * Triggers the animated opening of the large gate planes in front of the player.
 *
 * The actual movement is handled in the main `render` loop; this function
 * simply sets state and records the starting positions so the animation
 * can interpolate from the current layout.
 */
export const openGate = () => {
  if (!isGateOpening) {
    isGateOpening = true;
    // Store initial positions
    leftGate.userData.initialX = leftGate.position.x;
    rightGate.userData.initialX = rightGate.position.x;
  }
};

// Add cleanup function
// Add cleanup function
/**
 * Fully cleans up Scene 2 and releases resources.
 *
 * This includes:
 *  - Stopping music, hover game and minimap
 *  - Removing event listeners (keyboard, resize, loading events)
 *  - Disabling VR and player movement
 *  - Disposing Electro, portals, holograms, UFOs, waterfall meshes
 *  - Disposing all scene geometries/materials and controls
 *  - Resetting hoverboard and objective state.
 */
export function cleanupScene2() {
  // Add at the start of cleanup
  isSceneTransitioning = false;

  // Stop and clean up background music
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
    backgroundAudio = null;
  }

  // Clean up objectives
  cleanupObjectives();

  // Clean up audio manager
  cleanupAudioManager();

  // Remove stats
  // const stats = document.querySelector(".stats");
  // if (stats) {
  //   stats.remove();
  // }

  // Remove event listeners
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  if (loadingHiddenHandler) {
    window.removeEventListener("loadingScreenHidden-scene2", loadingHiddenHandler);
    loadingHiddenHandler = null;
  }
  window.removeEventListener("keydown", handleKeyPress);

  // NEW: Remove named keydown listeners
  if (objectivesKeyListener) {
    document.removeEventListener("keydown", objectivesKeyListener);
    objectivesKeyListener = null;
  }
  if (gateDebugKeyListener) {
    window.removeEventListener("keydown", gateDebugKeyListener);
    gateDebugKeyListener = null;
  }
  if (hoverboardKeyListener) {
    document.removeEventListener("keydown", hoverboardKeyListener);
    hoverboardKeyListener = null;
  }

  // Clean up animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Disable player movement before cleanup
  if (sceneInitialization?.playerFunction?.player) {
    disablePlayerMovement(sceneInitialization.playerFunction.player);
  }

  // Ensure global player flags are restored if we leave before loading completes
  togglePlayerPhysics(true);
  togglePlayerControls(true);

  // Clean up VR
  cleanupVR();

  // Camera plane cleanup is no longer needed with the new objectives system

  // Clean up GUI
  destroyGUI();

  // NEW: Dispose custom materials if they exist (e.g., from GUI tweaks)
  if (glassMaterial) {
    if (glassMaterial.map) glassMaterial.map.dispose();
    glassMaterial.dispose();
    glassMaterial = null;
  }
  if (chromeMaterial) {
    if (chromeMaterial.map) chromeMaterial.map.dispose();
    chromeMaterial.dispose();
    chromeMaterial = null;
  }
  if (hoverboardShaderMaterial) {
    hoverboardShaderMaterial.dispose();
    hoverboardShaderMaterial = null;
  }

  // Clean up scene initialization
  if (sceneInitialization) {
    sceneInitialization.cleanUpCollider();
    sceneInitialization = null;
  }

  // Clean up electro components
  if (electro) {
    if (electroMixer) {
      electroMixer.stopAllAction();
    }
    if (electro) {
      scene?.remove(electro);
      electro.traverse((child) => {  // Enhanced: Traverse for sub-meshes
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      });
    }
    electro = null;
    electroMixer = null;
    electroActions = null;
  }

  // Clean up portal
  if (portal) {
    portal.dispose();
    portal = null;
  }

  // Clean up hologram effects
  if (hologramEffects) {
    hologramEffects.forEach((effect) => {
      if (effect.meshes) {
        effect.meshes.forEach((mesh) => {
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
              });
            } else {
              if (mesh.material.map) mesh.material.map.dispose();
              mesh.material.dispose();
            }
          }
          if (mesh.geometry) mesh.geometry.dispose();
          scene?.remove(mesh);
        });
      }
    });
    hologramEffects = null;
  }

  // NEW: Clean up UFOs
  ufos.forEach((ufo) => {
    scene?.remove(ufo);
    ufo.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat.map) mat.map.dispose();
              mat.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      }
    });
  });
  ufos.length = 0;  // Clear array

  // NEW: Clean up waterfall video/textures/meshes
  if (waterfallVideo) {
    waterfallVideo.pause();
    waterfallVideo.src = '';
    waterfallVideo = null;
  }
  if (waterfallTexture) {
    waterfallTexture.dispose();
    waterfallTexture = null;
  }
  waterfallMeshes.forEach((mesh) => {
    scene?.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        });
      } else {
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
      }
    }
  });
  waterfallMeshes.length = 0;

  
if (gateGroup && scene) {
  scene.remove(gateGroup);
  [leftGate, rightGate].forEach(gate => {
    if (gate) {
      removeCollider(gate.name.toLowerCase());  // e.g., "leftgate"
      if (gate.geometry) gate.geometry.dispose();
      if (gate.material) {
        if (Array.isArray(gate.material)) {
          gate.material.forEach(mat => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        } else {
          if (gate.material.map) gate.material.map.dispose();
          gate.material.dispose();
        }
      }
    }
  });
  leftGate = null;
  rightGate = null;
  gateGroup = null;  // NEW: Reset the variable
}

  // Clean up hoverboard shader effect
  removeHoverboardShaderEffect();

  // Entry effect cleanup removed

  // Clean up skybox
  if (skybox) {
    scene?.remove(skybox);
    if (skybox.material) {
      if (Array.isArray(skybox.material)) {
        skybox.material.forEach(mat => {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        });
      } else {
        if (skybox.material.map) skybox.material.map.dispose();
        skybox.material.dispose();
      }
    }
    if (skybox.geometry) skybox.geometry.dispose();
    skybox = null;
  }

  // Clean up scene (enhanced traversal)
  if (scene) {
    // Explicitly remove known non-standard children first
    if (directionArrow) scene.remove(directionArrow);
    if (hoverboardShaderEffect) scene.remove(hoverboardShaderEffect);

    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material && object.material !== null && object.material !== undefined) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            if (material) {
              // Clear all texture maps
              if (material.map) material.map.dispose();
              if (material.lightMap) material.lightMap.dispose();
              if (material.bumpMap) material.bumpMap.dispose();
              if (material.normalMap) material.normalMap.dispose();
              if (material.specularMap) material.specularMap.dispose();
              if (material.envMap) material.envMap.dispose();
              if (material.emissiveMap) material.emissiveMap.dispose();
              material.dispose();
            }
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          if (object.material.lightMap) object.material.lightMap.dispose();
          if (object.material.bumpMap) object.material.bumpMap.dispose();
          if (object.material.normalMap) object.material.normalMap.dispose();
          if (object.material.specularMap) object.material.specularMap.dispose();
          if (object.material.envMap) object.material.envMap.dispose();
          if (object.material.emissiveMap) object.material.emissiveMap.dispose();
          object.material.dispose();
        }
      }
      // Clear any custom properties
      object.userData = {};
      object.children = [];  // Force-clear children to prevent traversal loops
    });

    // Remove all objects from scene
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    scene = null;  // Null after full cleanup
  }

  // Clean up controls
  if (controls) {
    controls.dispose();
    controls = null;
  }

  // Reset variables (expanded for completeness)
  camera = null;
  electroFocusCamera = null;
  transitionCamera = null;
  isCameraTransitioning = false;
  isElectroFocusActive = false;
  isGateOpening = false;
  hoverboard = null;
  hoverboardCollisionMesh = null;
  isPlayerOnHoverboard = false;
  isHoverboardCameraActive = false;
  hoverboardVelocity = new THREE.Vector3();
  isMovingForward = false;
  isMovingBackward = false;
  isTurningLeft = false;
  isTurningRight = false;
  isMovingUp = false;
  isMovingDown = false;
  
  // Reset hoverboard variables
  hoverboardVisible = false;
  hoverboardMesh = null;
  hoverboardKeyListenerActive = false;
  hoverboardKeyListener = null;
  
  // Reset objective number
  currentObjectiveNumber = 1;

  // Clean up direction arrow
  cleanupDirectionArrow();

  // Clean up minimap
  cleanupMinimap();

  // Clean up hover game
  cleanupHoverGame();

  // NEW: Clean up window function
  if (window.setCurrentObjectiveNumber) {
    delete window.setCurrentObjectiveNumber;
  }

  // NEW: Reset arrays/objects
  ufos = [];
  waterfallMeshes = [];
  hologramEffects = [];

  console.log("Scene2 cleanup completed.");
}

// Add back the camera transition functions
/**
 * Smoothly transitions the camera from the player view to a cinematic
 * Electro‑focused shot, depending on which Electro sequence is active.
 *
 * - Computes a target camera position/orientation based on Electro's Z position
 * - Initializes the `transitionCamera` and flags `isElectroFocusActive`
 * - Disables OrbitControls while the transition is in progress.
 *
 * @param {THREE.Object3D} electro - The Electro character object currently in the scene.
 */
export function switchToElectroFocus(electro) {
  console.log('switchToElectroFocus called with:', { 
    electro, 
    electroPosition: electro?.position,
    isCameraTransitioning,
    camera: !!camera,
    electroFocusCamera: !!electroFocusCamera,
    controls: !!controls
  });
  
  if (isCameraTransitioning) return;
  
  // Check if electro parameter is valid
  if (!electro || !electro.position) {
    console.error('Invalid electro parameter passed to switchToElectroFocus:', electro);
    return;
  }
  
  // Check if electro is still in the scene
  if (!scene || !scene.children.includes(electro)) {
    console.error('Electro object is not in the scene:', { electro, scene: !!scene });
    return;
  }
  
  // Check if camera and electroFocusCamera are initialized
  if (!camera || !electroFocusCamera) {
    console.error('Camera or electroFocusCamera not initialized:', { camera, electroFocusCamera });
    return;
  }

  isCameraTransitioning = true;
  transitionStartTime = performance.now();

  // Store current camera state
  transitionStartPosition.copy(camera.position);
  transitionStartRotation.copy(camera.quaternion);

  // Determine target position based on Electro's position
  if (electro.position.z === 616) {
    electroFocusCamera.position.set(-32, 3.9, 609);
    electroFocusCamera.lookAt(-31, 3, 616);
  } else if (electro.position.z === -225) {
    // Second sequence position
    electroFocusCamera.position.set(1, 2, -228);
    electroFocusCamera.lookAt(0, 2, -228);
  } else {
    // First sequence position
    electroFocusCamera.position.set(-1, 1.3, -249.3);
    electroFocusCamera.lookAt(-1, 1.3, -242);
  }

  // Store target camera state
  transitionTargetPosition.copy(electroFocusCamera.position);
  transitionTargetRotation.copy(electroFocusCamera.quaternion);

  // Initialize transition camera
  transitionCamera.position.copy(transitionStartPosition);
  transitionCamera.quaternion.copy(transitionStartRotation);
  transitionCamera.fov = camera.fov;
  transitionCamera.updateProjectionMatrix();

  isElectroFocusActive = true;
  if (controls) {
    controls.enabled = false;
  }
  
  console.log('switchToElectroFocus completed successfully');
}

/**
 * Immediately returns control back to the normal player camera.
 *
 * Re‑enables OrbitControls and clears the `isElectroFocusActive` flag.
 */
export function switchToPlayerCamera() {
  // Directly switch back to player camera without transition
  isElectroFocusActive = false;
  if (controls) {
    controls.enabled = true;
  }
}

/**
 * Per‑frame camera transition handler for `switchToElectroFocus`.
 *
 * - Interpolates between `transitionStartPosition/Rotation` and
 *   `transitionTargetPosition/Rotation` using smoothstep easing
 * - Tweens the field‑of‑view to match the Electro focus camera
 * - When finished, hands control back to the primary `camera`.
 *
 * @param {number} delta - Frame delta time (seconds).
 */
function updateCameraTransition(delta) {
  if (!isCameraTransitioning) return;

  const elapsed = (performance.now() - transitionStartTime) / 1000;
  const progress = Math.min(elapsed / transitionDuration, 1);

  // Use smoothstep for easing
  const smoothProgress = progress * progress * (3 - 2 * progress);

  // Interpolate position and rotation
  transitionCamera.position.lerpVectors(
    transitionStartPosition,
    transitionTargetPosition,
    smoothProgress
  );

  transitionCamera.quaternion.slerpQuaternions(
    transitionStartRotation,
    transitionTargetRotation,
    smoothProgress
  );

  // Update FOV if needed
  const targetFOV = isElectroFocusActive ? electroFocusCamera.fov : camera.fov;
  transitionCamera.fov = THREE.MathUtils.lerp(
    transitionCamera.fov,
    targetFOV,
    smoothProgress
  );
  transitionCamera.updateProjectionMatrix();

  // End transition when complete
  if (progress >= 1) {
    isCameraTransitioning = false;
    if (isElectroFocusActive) {
      camera.position.copy(electroFocusCamera.position);
      camera.quaternion.copy(electroFocusCamera.quaternion);
    } else {
      camera.position.copy(transitionTargetPosition);
      camera.quaternion.copy(transitionTargetRotation);
    }
  }
}
