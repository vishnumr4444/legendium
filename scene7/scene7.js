import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  allAssets,
  checkExistingAssets,
  loadAllAsset,
} from "../commonFiles/assetsLoader.js";
import { assetsEntry as currentEntry } from "./assetsEntry.js";
// import { assetsEntry as nextEntry } from "../scene6/assetsEntry.js";
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer.js";
import { setCurrentScene, getUserInfo } from "../data.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
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
} from "../commonFiles/playerController.js";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";
// import { initializeScene6 } from "../scene6/scene6.js";
import {
  playAudio,
  initializeAudioManager,
  cleanupAudioManager,
} from "../commonFiles/audiomanager.js";
import { BotBuilding } from "./BotBuilding.js";
import { auth, db } from "../WebFiles/firebase.js";
import { doc, updateDoc } from "firebase/firestore";
import { markSceneVisited } from "../data.js";

/**
 * Mark the given scene as completed in the Firestore `users/{uid}` document.
 * This is a lightweight helper; higher-level scene completion logic lives in `data.js`.
 *
 * @param {string} sceneKey - e.g. "scene7"
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

// Core Three.js / scene state for scene7.
let skybox;
let scene, renderer, controls;

// Window resize handler reference so we can unregister it on cleanup.
let resizeHandler = null;

// Scene/player initialization reference (from physics/player helpers).
let sceneInitialization;
let collisionMesh;

let animationFrameId = null;

let camera = null;

// Add at the top with other state variables
let isSceneTransitioning = false;

// Global key handler for exiting/transitioning when user presses "Y".
function handleKeyPress(event) {
  if (event.key.toLowerCase() === "y" && !isSceneTransitioning) {
    isSceneTransitioning = true;
    const session = renderer.xr.getSession();

    const transitionToNextScene = (isVR) => {
      markSceneCompleted("scene7")
      // Remove the event listener before switching scenes
      window.removeEventListener("keydown", handleKeyPress);
      if (sceneInitialization) {
        sceneInitialization.cleanUpCollider();
      }
      cleanupScene7();
      // checkExistingAssets(nextEntry);
      // initializeScene1(renderer, isVR).finally(() => {
      //   isSceneTransitioning = false;
      // });
    };

    if (session) {
      session
        .end()
        .then(() => {
          transitionToNextScene(true);
          markSceneCompleted("scene7")
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
// Main bot-building mini-game controller instance (created in initializeScene7).
let botBuilding = null;

/**
 * Entry point for setting up scene7.
 *
 * - Configures camera, renderer, lighting, skybox, and audio
 * - Loads assets from `assetsEntry`
 * - Instantiates the BotBuilding flow
 * - Integrates with the global loading manager via `cameraReady-scene7`
 *
 * @param {THREE.WebGLRenderer} existingRenderer - Shared renderer from main app.
 * @param {boolean} isVRMode - Whether the experience is running in VR mode.
 */
export async function initializeScene7(existingRenderer, isVRMode) {
  setCurrentScene("scene7");
  await markSceneVisited("scene7");
  const userInfo = getUserInfo();
  const stats = new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

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
    500
  );
  // camera.position.set(
  //   0.4033093896899428,
  //   2.5973672052169077,
  //   -1.783624732924128
  // );

  // Use existing renderer
  renderer = existingRenderer;

  // Ensure renderer is properly configured
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.physicallyCorrectLights = true;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.4;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Make sure renderer is in the document
  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }

  console.log(renderer);

  // Initialize loading manager with both camera and renderer
  await loadAllAsset(currentEntry, camera, renderer);

  scene = new THREE.Scene();

  // Add camera to scene so its children (like the plane) render
  // scene.add(camera);
  // scene.add(allAssets.models.gltf.roboticsLab)
  //play background music
  // const backgroundMusic = allAssets.audios.background;

  initializeAudioManager(camera, scene);
  //set timeout for loading screen hidden after camera position set
  
  // Remove delayed camera/target changes; we set them immediately before hiding

  // After initial asset load, set the camera to the correct position and notify loading manager
  // Ensures loading screen for scene7 only hides after camera is correctly placed
  // Initialize controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.dampingFactor = 0.25;
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.5;

  // Create BotBuilding so we can aim the camera at it immediately
  botBuilding = BotBuilding(scene, camera, controls, renderer, animationFrameId);

  // Desired camera position
    camera.position.set(
    0.3056433451044461,
    2.337678309088362,
    -2.1778413856492636
  );
 
 
  controls.target.set(
    0.3106101309643541,
    2.282379953486963,
    -2.864472016469322
  );
 
  camera.lookAt(controls.target);
  controls.update();

  // Render a frame with the correct camera before signaling readiness
  renderer.render(scene, camera);
  window.dispatchEvent(new CustomEvent("cameraReady-scene7"));

  const params = {
    height: 100,
    radius: 1200,
    enabled: true,
  };

  skybox = new GroundedSkybox(
    allAssets.hdris.background,
    params.height,
    params.radius
  );
  skybox.position.y = 0;
  scene.add(skybox);
  scene.environment = allAssets.hdris.background;
  scene.environmentIntensity = 0.6;
  // Force an immediate render to ensure proper sizing
  renderer.render(scene, camera);

  // Controls already initialized and targeted above

  // Add the event listener after scene initialization is complete
  window.addEventListener("keydown", handleKeyPress);

  // sceneInitialization = initializePhysicsAndPlayerAndPlayer(
  //   allAssets.models.gltf.gardencave,
  //   {
  //     position: { x: 0, y: 0, z: 0 },
  //     rotation: { x: 0, y: 0, z: 0 },
  //   },
  //   [],
  //   scene,
  //   camera,
  //   controls,
  //   renderer
  // );

  // Add lights
  let ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  const roboticsLab = allAssets.models.gltf.roboticsLab;
  roboticsLab.position.y = 1;
  scene.add(roboticsLab);


  const clock = new THREE.Clock();

  // Initialize VR if in VR mode
  if (isVRMode) {
    // Create clickable objects array for VR interaction
    const clickableObjects = [];

    // initializeVR(
    //   renderer,
    //   scene,
    //   camera,
    //   sceneInitialization.playerFunction.player,
    //   // backgroundMusic,
    //   sceneInitialization.playerFunction.actions,
    //   clickableObjects,
    //   () => {}
    // );

    // Store reference to collision mesh
    // collisionMesh = allAssets.models.gltf.gardencave.collisionMesh;

    // Set collision mesh for VR
    // setCollisionMesh(collisionMesh);

    // Enable player movement
    // enablePlayerMovement(sceneInitialization.playerFunction.player);
  }

  // Main render loop; uses WebXR animation loop in VR, requestAnimationFrame otherwise.
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
        // console.log(camera.position);
      }
      loop();
    }
  }

  // Per-frame render function (shared between VR and non-VR paths).
  function render() {
    // Check if camera exists before rendering
    if (!camera) {
      return;
    }

    stats.begin();
    const delta = clock.getDelta();

    // Update VR if in VR mode
    if (userInfo.modeSelected === "vr") {
      updateVR();
    } else {
      // Update controls only in non-VR mode
      if (controls) {
        controls.update();
      }
    }

    // if (sceneInitialization?.playerFunction?.player) {
    //   const player = sceneInitialization.playerFunction.player;
    //   player.updateMatrixWorld();

    //   // Handle collisions with the environment
    //   if (collisionMesh) {
    //     handleCollisions(player, collisionMesh, playerState.velocity, delta);
    //   }

    //   // Apply any remaining velocity after collision
    //   if (playerState.velocity.length() > 0) {
    //     player.position.x += playerState.velocity.x * delta;
    //     player.position.z += playerState.velocity.z * delta;
    //     if (!playerState.onGround) {
    //       player.position.y += playerState.velocity.y * delta;
    //     }
    //   }
    // }

    renderer.render(scene, camera);
    stats.end();
  }

  animate();

  // Define resizeHandler to handle all camera updates
  resizeHandler = () => {
    const aspect = window.innerWidth / window.innerHeight;

    if (camera && renderer) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  window.addEventListener("resize", resizeHandler);

  return {
    scene,
    camera,
    renderer,
    controls,
    sceneInitialization,
  };
}

// Add cleanup function
export function cleanupScene7() {
  botBuilding.clearEverything()
  // Add at the start of cleanup
  isSceneTransitioning = false;

  cleanupAudioManager();
  // Remove stats
  const stats = document.querySelector(".stats");
  if (stats) {
    stats.remove();
  }

  // Remove event listeners
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  window.removeEventListener("keydown", handleKeyPress);

  // Clean up animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  renderer.setAnimationLoop(null);

  // Clean up GUI
  destroyGUI();

  // Disable player movement
  if (sceneInitialization?.playerFunction?.player) {
    disablePlayerMovement(sceneInitialization.playerFunction.player);
  }

  // Clean up VR
  cleanupVR();

  // Clean up scene initialization
  if (sceneInitialization) {
    sceneInitialization.cleanUpCollider();
    sceneInitialization = null;
  }

  // Clean up skybox
  if (skybox) {
    if (skybox.material) {
      skybox.material.dispose();
    }
    if (skybox.geometry) {
      skybox.geometry.dispose();
    }
    skybox = null;
  }

  // Clean up scene
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

  // Clean up controls
  if (controls) {
    controls.dispose();
  }

  // Clear the renderer
  renderer.clear();

  // Reset variables
  scene = null;
  camera = null;
  controls = null;
  skybox = null;
  sceneInitialization = null;
}