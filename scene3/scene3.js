/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
/**
 * Script Description
 * Scene 3 bootstrap and main update loop.
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
import gsap from "gsap";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { initializeNPCs } from "../commonFiles/npc.js";
// import { createGUI, destroyGUI } from "../commonFiles/guiManager";
import { initializeRenderer } from "../main.js";
import {
  allAssets,
  loadAllAsset,
  checkExistingAssets,
} from "../commonFiles/assetsLoader.js";
import { assetsEntry } from "./assetsEntry.js";
import { assetsEntry as nextEntry } from "../scene4/assetsEntry.js";
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer.js";
import { setCurrentScene, getUserInfo, markSceneCompleted } from "../data.js";
import { handleResize } from "../main.js";
import { BatchedRenderer, QuarksUtil } from "three.quarks";
import { initializeZoe, updateZoe, cleanupZoe } from "./zoeInteraction.js";
import {
  initializeElectro,
  updateElectro,
  cleanupElectro,
} from "./electroInteraction.js";
import {
  initializeEmergency,
  checkEmergencyTrigger,
  updateEmergency,
  cleanupEmergency,
} from "./emergencySequence.js";
import {
  initializeFadeOut,
  updateFadeOut,
  cleanupFadeOut,
} from "./fadeOutSequence.js";
import { holographicGlobeShader } from "./holographicGlobeShader.js";
// import Stats from "three/examples/jsm/libs/stats.module.js";
import { initializeScene4 } from "../scene4/scene4.js";

import {
  initializeVR,
  updateVR,
  cleanupVR,
  setCollisionMesh,
  disablePlayerMovement,
  enablePlayerMovement,
} from "../commonFiles/vrManager.js";
import { TriggerPoint } from "../commonFiles/triggerPoint.js";
import {
  handleCollisions,
  playerState,
  togglePlayerControls,
  togglePlayerPhysics,
  updatePlayerAnimation,
} from "../commonFiles/playerController.js";
import {
  playAudio,
  initializeAudioManager,
  cleanupAudioManager,
} from "../commonFiles/audiomanager.js";
import { createMinimap, updateMinimap, cleanupMinimap } from "./minimap.js";
// import { showSceneObjective, cleanupSceneObjectives } from "./objectives.js";
// import { cleanupMainFallingSequence } from "./fallingEffect.js";
// import { cleanupRenderer } from "../commonFiles/cleanupRenderer.js";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../WebFiles/firebase.js";
import { setupNPCsForScene3 } from "../commonFiles/npcConfig.js";
import { markSceneVisited } from "../data.js";
import { celebrateSceneCompletion } from "../commonFiles/sceneCompletionCelebration.js";

// Global variables
let scene, camera, renderer, controls;
let light, ambLight;
let batchSystemRef;
let vfxEffect, redzoneEffect;
let interiorModel;
let animationFrameId = null;
let collisionMesh;
let sceneInitialization;
let stats;
let clock;
let userInfo;
let isSceneTransitioning = false;
let backgroundAudio; // Add background music variable
// Billboard video plane reference
let hudVideoPlane = null;
// NPC system reference
let npcSystem;

// Constants
const frameTime = 1 / 60; // Target 60 FPS

// Add resizeHandler at module scope
let resizeHandler = null;

// Helper function to move player to safe position (like scene1)
function movePlayerToSafePosition(player, position, rotation) {
  if (!player) return;
  player.position.set(position.x, position.y, position.z);
  player.rotation.set(rotation.x, rotation.y, rotation.z);
  if (playerState) {
    playerState.velocity.set(0, 0, 0);
  }
}

// Define handleKeyPress at the top level
function handleKeyPress(event) {
  if (event.key.toLowerCase() === "y" && !isSceneTransitioning) {
    isSceneTransitioning = true;
    const session = renderer.xr.getSession();

    const transitionToNextScene = (isVR) => {
      // Mark completed and show celebration overlay (cleanup in onCleanup)
      try {
        markSceneCompleted("scene3");
      } catch (e) {}
      cleanupMainFallingSequence();
      window.removeEventListener("keydown", handleKeyPress);
      celebrateSceneCompletion({
        completedSceneKey: "scene3",
        nextSceneKey: "scene4",
        headline: "Robotics University Stabilized!",
        subtext:
          "Prepare for the depths of the Underground Lab. Returning to scene select...",
        onCleanup: () => {
          if (sceneInitialization) {
            try {
              sceneInitialization.cleanUpCollider();
            } catch (e) {}
          }
          try {
            cleanupScene3();
          } catch (e) {}
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
  }
}

// Function to disable IBL reflections by modifying material properties
function disableIBL(material) {
  if (!material) return;

  if (Array.isArray(material)) {
    material.forEach(disableIBL);
    return;
  }

  // Disable environment mapping
  material.envMap = null;
  material.envMapIntensity = 0;

  // For PBR materials, make surfaces completely non-reflective
  if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
    material.roughness = 1.0;
    material.metalness = 0.0;
  }

  // Ensure update
  material.needsUpdate = true;
}

/**
 * Initializes Scene 3.
 *
 * High‑level responsibilities:
 *  - Reuses an existing WebGL renderer if provided, or creates a new one
 *  - Loads all Scene 3 assets via the shared asset loader
 *  - Builds the interior, underground path and video-based HUD / signage
 *  - Sets up physics, player controller, VR integration and NPCs
 *  - Hooks up Zoe / Electro / emergency / fade out / minimap systems
 *
 * @param {THREE.WebGLRenderer} [existingRenderer] - Optional renderer instance to reuse
 * @param {boolean} isVRMode - True if the scene is entered from VR mode
 * @returns {Promise<{scene:THREE.Scene,camera:THREE.Camera,renderer:THREE.WebGLRenderer,controls:OrbitControls,sceneInitialization:Object}>}
 */
export async function initializeScene3(existingRenderer, isVRMode) {
  setCurrentScene("scene3");
  await markSceneVisited("scene3");
  userInfo = getUserInfo();

  // Initialize objectives after loading screen is hidden (moved to event listener)

  // Initialize stats
  // stats = new Stats();
  // stats.showPanel(0);
  // document.body.appendChild(stats.dom);

  // // Create GUI
  // const gui = createGUI();
  // gui.close();

  // Cancel any existing animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Setup camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, -3);

  // Initialize renderer
  renderer = existingRenderer || initializeRenderer();
  // renderer.shadowMap.enabled = true;
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // renderer.shadowMap.autoUpdate = true;
  renderer.toneMapping = THREE.CineonToneMapping;
  // renderer.toneMappingExposure = 0.4;
  renderer.physicallyCorrectLights = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }

  // Load assets
  await loadAllAsset(assetsEntry, camera, renderer);

  // Initialize scene
  scene = new THREE.Scene();
  scene.frustumCulled = true;
  scene.background = allAssets.cubeMaps.scene2Cubemap;
  scene.environment = allAssets.cubeMaps.scene2Cubemap;

  // if (allAssets.hdris.evening) {
  //   scene.environment = allAssets.hdris.evening;
  //   scene.background = allAssets.hdris.evening;
  // }
  renderer.toneMappingExposure = 0.5;
  // Debug assets loading
  console.log("Available models in assets:", Object.keys(allAssets.models));
  console.log("GLTF models:", Object.keys(allAssets.models.gltf));

  // Load and position underground path model
  if (allAssets.models.gltf.underground) {
    console.log("Found underground model in assets");
    const undergroundPath = allAssets.models.gltf.underground;

    // Debug model properties
    console.log("Underground model properties:", {
      position: undergroundPath.position,
      scale: undergroundPath.scale,
      visible: undergroundPath.visible,
      children: undergroundPath.children?.length || 0,
    });

    // Set position and scale
    undergroundPath.position.set(-25, -135, -130);
    undergroundPath.scale.set(250, 250, 250);

    // Make sure model is visible
    undergroundPath.visible = true;

    // Add to scene
    scene.add(undergroundPath);

    // Verify model was added to scene
    const modelInScene = scene.children.find(
      (child) => child === undergroundPath
    );
    console.log("Model added to scene:", !!modelInScene);

    // Debug final model state
    console.log("Final underground model state:", {
      position: undergroundPath.position,
      scale: undergroundPath.scale,
      visible: undergroundPath.visible,
      inScene: !!modelInScene,
    });
  } else {
    console.warn(
      "Underground path model not found in assets. Available GLTF models:",
      Object.keys(allAssets.models.gltf)
    );
  }

  // Add lights
  // light = new THREE.DirectionalLight(0xffffff, 0.8  );
  // ambLight = new THREE.AmbientLight(0xffffff, 0.4);
  // light.position.set(50, 50, 50);
  // light.rotation.set(0,-Math.PI,0)
  // scene.add(ambLight);
  //add hemisphere light

  // Setup controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = true;
  controls.dampingFactor = 0.05;
  controls.enableDamping = true;

  // Initialize physics and player
  sceneInitialization = initializePhysicsAndPlayer(
    allAssets.models.gltf.interior,
    {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    },
    ["Plane007", "glass_plane"],
    scene,
    camera,
    controls,
    renderer
  );

  // Store interior model reference
  interiorModel = allAssets.models.gltf.interior;

  // Disable IBL reflections on interior model materials
  if (interiorModel) {
    interiorModel.traverse((child) => {
      if (child.isMesh && child.material) {
        disableIBL(child.material);
      }
    });
    console.log(
      "Disabled HDRI reflections and IBL on interior model materials."
    );
  }

  // Hide specific meshes from the interior model
  if (interiorModel) {
    interiorModel.traverse((child) => {
      if (child.isMesh && child.name === "stair_slide001") {
        child.visible = false;
        console.log("Hid 'stair_slide' mesh");
      }
    });
  }

  // Initialize batched renderer
  batchSystemRef = new BatchedRenderer();
  scene.add(batchSystemRef);

  // Initialize clock
  clock = new THREE.Clock();

  // Initialize audio
  initializeAudioManager(camera, scene);

  // Add event listeners
  window.addEventListener("keydown", handleKeyPress);
  window.addEventListener("loadingScreenHidden-scene3", () => {
    console.log("Loading screen hidden - Scene3 is ready!");
    // Show initial objective now that loading is complete
    // showSceneObjective(1);

    // Start background music
    if (allAssets.audios.background) {
      backgroundAudio = allAssets.audios.background;
      backgroundAudio.play();
    }

    playAudio("scene3Intro");
  });

  // Initialize VR if in VR mode
  if (isVRMode) {
    const clickableObjects = [];
    initializeVR(
      renderer,
      scene,
      camera,
      sceneInitialization.playerFunction.player,
      sceneInitialization.playerFunction.actions,
      clickableObjects,
      () => {}
    );

    collisionMesh = allAssets.models.gltf.interior.collisionMesh;
    setCollisionMesh(collisionMesh);
    enablePlayerMovement(sceneInitialization.playerFunction.player);
  }

  // Initialize other components
  const zoeInit = initializeZoe(
    scene,
    allAssets,
    camera,
    batchSystemRef,
    controls
  );

  // Debug Zoe initialization
  if (zoeInit && zoeInit.zoeCharacter) {
    console.log("Zoe character initialized successfully:", {
      visible: zoeInit.zoeCharacter.visible,
      position: zoeInit.zoeCharacter.position,
      scale: zoeInit.zoeCharacter.scale,
      hasMixer: !!zoeInit.zoeMixer,
      hasActions: !!zoeInit.zoeActions,
    });
  } else {
    console.warn("Zoe initialization failed or returned null");
  }

  const electroInit = initializeElectro(scene, allAssets, camera, controls);
  initializeEmergency(
    scene,
    allAssets,
    camera,
    interiorModel,
    sceneInitialization.playerFunction.player
  );


  // Initialize minimap with correct character references
  createMinimap(
    scene,
    sceneInitialization,
    electroInit.electroCharacter,
    zoeInit.zoeCharacter
  );

  // Initialize NPC system with customizable options
  // Initialize NPC system with custom colors and speeds
  npcSystem = initializeNPCs(scene, 10);

  // Apply NPC setup via shared config helper
  setupNPCsForScene3(allAssets, npcSystem);

  // Verify Zoe is in scene and visible
  if (zoeInit && zoeInit.zoeCharacter) {
    const zoeInScene = scene.children.includes(zoeInit.zoeCharacter);
    console.log("Zoe scene verification:", {
      inScene: zoeInScene,
      visible: zoeInit.zoeCharacter.visible,
      sceneChildrenCount: scene.children.length,
    });

    if (!zoeInScene) {
      console.error("Zoe character not found in scene children!");
    }
  }

  // Update video textures if they exist
  if (interiorModel) {
    // Define mesh-to-video mapping with reduced number of active videos
    const meshVideoMapping = {
      GLASS001: "hud1", // Consolidated to hud1
      polySurface2319002: "hud1",
      GLASS002: "hud2",
      pCube294006: "hud2", // Consolidated to hud2
      pCube294002: "hud2",
      GLASS003: "hud2",
      GLASS004: "hud1", // Consolidated to hud1
      title: "hud1",
      GLASS006: "hud2",
      GLASS007: "hud2",
    };

    // Create a pool for video textures with enhanced performance settings
    const videoPool = {
      textures: {},
      videos: {},
      activeMeshes: new Map(),
      distanceThreshold: 30,
      maxActiveVideos: 2,
      currentActiveVideos: 0,
    };

    // Create video elements for each unique video
    const uniqueVideos = [...new Set(Object.values(meshVideoMapping))];
    uniqueVideos.forEach((videoName) => {
      const video = document.createElement("video");
      video.src = allAssets.videotextures[videoName].path;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      // strengthen mobile autoplay support
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("muted", "");
      video.crossOrigin = "anonymous";
      video.preload = "auto";
      video.autoplay = true; // Added autoplay

      // More aggressive resolution reduction
      video.width = 256;
      video.height = 144;

      // Force hardware acceleration
      video.style.transform = "translateZ(0)";
      video.style.webkitTransform = "translateZ(0)";

      // Ensure video plays
      video
        .play()
        .catch((error) => console.log("Initial play prevented:", error));

      videoPool.videos[videoName] = video;

      // Create optimized texture
      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBFormat;
      texture.generateMipmaps = false;
      texture.encoding = THREE.sRGBEncoding;
      videoPool.textures[videoName] = texture;
    });

    // Enhanced distance check function with frame skipping
    let frameCounter = 0;
    const updateVideoVisibility = (camera, meshes) => {
      frameCounter++;
      if (frameCounter % 2 !== 0) return;

      const cameraPosition = camera.position;
      meshes.forEach((mesh) => {
        const distance = cameraPosition.distanceTo(mesh.position);
        const videoName = meshVideoMapping[mesh.name];
        const video = videoPool.videos[videoName];

        if (distance < videoPool.distanceThreshold) {
          if (
            !videoPool.activeMeshes.has(mesh.name) &&
            videoPool.currentActiveVideos < videoPool.maxActiveVideos
          ) {
            // Ensure video is playing
            if (video.paused) {
              const playPromise = video.play();
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    videoPool.currentActiveVideos++;
                    videoPool.activeMeshes.set(mesh.name, true);
                    video.playbackRate = 1.0; // Reset to normal speed
                  })
                  .catch((error) => {
                    console.log("Play prevented:", error);
                  });
              }
            }
          }
        } else {
          if (videoPool.activeMeshes.has(mesh.name)) {
            const otherActiveMeshesUsingVideo = Array.from(
              videoPool.activeMeshes.keys()
            ).filter(
              (activeMesh) =>
                activeMesh !== mesh.name &&
                meshVideoMapping[activeMesh] === videoName &&
                camera.position.distanceTo(
                  scene.getObjectByName(activeMesh).position
                ) < videoPool.distanceThreshold
            );

            if (otherActiveMeshesUsingVideo.length === 0 && !video.paused) {
              video.pause();
              videoPool.currentActiveVideos--;
            }
            videoPool.activeMeshes.delete(mesh.name);
          }
        }

        // Always update texture if video is playing
        if (!video.paused) {
          videoPool.textures[videoName].needsUpdate = true;
        }
      });
    };

    // Get all mesh names that need video
    const targetMeshNames = Object.keys(meshVideoMapping);
    const videoMeshes = [];

    // Wait for all videos to be ready enough to play
    Promise.all(
      Object.values(videoPool.videos).map((video) => {
        return new Promise((resolve) => {
          let resolved = false;
          const done = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          video.addEventListener("canplay", done, { once: true });
          video.addEventListener(
            "loadedmetadata",
            () => {
              video.play().finally(done);
            },
            { once: true }
          );
          setTimeout(done, 1500);
        });
      })
    ).then(() => {
      interiorModel.traverse((child) => {
        if (child.isMesh && targetMeshNames.includes(child.name)) {
          const geometry = child.geometry.clone();
          const videoName = meshVideoMapping[child.name];
          const material = new THREE.MeshBasicMaterial({
            map: videoPool.textures[videoName],
            transparent: true,
            opacity: 0.85,
            side: THREE.FrontSide,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
          });
          child.geometry = geometry;
          child.material = material;
          child.renderOrder = 1;
          child.frustumCulled = true;

          videoMeshes.push(child);
        }
      });

      // Optimize render loop for video updates
      const originalRender = render;
      render = function () {
        updateVideoVisibility(camera, videoMeshes);
        originalRender();
      };

      // Initial play attempt for all videos
      Object.values(videoPool.videos).forEach((video) => {
        if (video.paused) {
          video
            .play()
            .catch((error) => console.log("Play attempt failed:", error));
        }
      });
    });
  }

  // After scene/environment setup and before animation loop:
  // --- Add persistent alpha video plane near Zoe ---
  if (
    allAssets &&
    allAssets.videotextures &&
    allAssets.videotextures.hudvideo1
  ) {
    // Create video element
    const video = document.createElement("video");
    video.src = allAssets.videotextures.hudvideo1.path;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.autoplay = true;
    video.preload = "auto";
    video.style.display = "none";
    document.body.appendChild(video); // Optional: for debugging, can be removed

    // Create THREE video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
    videoTexture.generateMipmaps = false;

    // Plane geometry (adjust size as needed)
    const geometry = new THREE.PlaneGeometry(16, 9); // 16:9 aspect ratio, scale as needed

    // Shader material for black removal
    const material = new THREE.ShaderMaterial({
      uniforms: {
        videoTexture: { value: videoTexture },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D videoTexture;
        uniform float time;
        varying vec2 vUv;
        void main() {
          vec4 videoColor = texture2D(videoTexture, vUv);
          float intensity = (videoColor.r + videoColor.g + videoColor.b) / 3.0;
          vec3 enhancedColor = videoColor.rgb * 0.5;
          enhancedColor = clamp(enhancedColor, 0.0, 0.5);
          float alpha = smoothstep(0.15 - 0.05, 0.15 + 0.05, intensity);
          gl_FragColor = vec4(enhancedColor, alpha * videoColor.a);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Create mesh and set position/rotation
    hudVideoPlane = new THREE.Mesh(geometry, material);
    hudVideoPlane.position.set(-45, 3.5, -145);
    hudVideoPlane.rotation.set(0, Math.PI / 2, 0); // Flip if needed
    hudVideoPlane.renderOrder = 10;
    scene.add(hudVideoPlane);

    // Play video when ready
    video.addEventListener("canplay", () => {
      video.play();
    });
    // Fallback: try to play after a short delay
    setTimeout(() => {
      video.play().catch(() => {});
    }, 1000);
  }

  // Find and animate planes
  if (interiorModel) {
    interiorModel.traverse((child) => {
      if (child.isMesh && child.name === "polySurface5714001") {
        console.log("Found plane029 mesh:", child);
      }
    });
    let plane047, plane050;

    // First traverse to find and store the planes
    interiorModel.traverse((child) => {
      if (child.isMesh) {
        if (child.name === "Plane049") {
          plane047 = child;
          plane047.userData.initialZ = child.position.z;
          console.log("Found Plane047 at initial Z:", child.position.z);
        }
        if (child.name === "Plane050") {
          plane050 = child;
          plane050.userData.initialZ = child.position.z;
          console.log("Found Plane050 at initial Z:", child.position.z);
        }
      }
    });

    // Create smooth animations for both planes
    if (plane047) {
      gsap.to(plane047.position, {
        z: plane047.userData.initialZ + 2, // Move 2 units forward
        duration: 2,
        repeat: -1,
        yoyo: true, // Makes it move back and forth
        ease: "sine.inOut",
      });
    }

    if (plane050) {
      gsap.to(plane050.position, {
        z: plane050.userData.initialZ + 2, // Move 2 units forward
        duration: 2,
        repeat: -1,
        yoyo: true, // Makes it move back and forth
        ease: "sine.inOut",
      });
    }
  }

  // ---------------------------------------------------------
  // SCROLLING LOGO TEXTURE ON GLASS005 (CUSTOM SHADER)
  // ---------------------------------------------------------
  if (interiorModel) {
    interiorModel.traverse((child) => {
      // Find the specific glass mesh
      if (child.isMesh && child.name === "GLASS005") {
        console.log("Found GLASS005, applying scrolling logo shader...");

        const logoTexture =
          allAssets.textures && allAssets.textures.logo
            ? allAssets.textures.logo
            : null;

        if (logoTexture) {
          // Important: Standard wrap to allow scrolling loop in shader
          logoTexture.wrapS = THREE.RepeatWrapping;
          logoTexture.wrapT = THREE.ClampToEdgeWrapping;

          const logoShader = new THREE.ShaderMaterial({
            uniforms: {
              uTexture: { value: logoTexture },
              uTime: { value: 0 },
              uSpeed: { value: 0.2 }, // Speed
              // MANUAL SIZING CONTROLS
              uScaleX: { value: 1 }, // Width control (1.0 = fit)
              uScaleY: { value: 1 }, // Height control (1.0 = fit)
            },
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform sampler2D uTexture;
              uniform float uTime;
              uniform float uSpeed;
              uniform float uScaleX;
              uniform float uScaleY;
              varying vec2 vUv;

              void main() {
                // 1. Scroll Logic (Rightward movement: -time)
                // We use fract to loop the 'window' every 1.0 unit
                float scrollX = fract(vUv.x - uTime * uSpeed);
                vec2 uv = vec2(scrollX, vUv.y);

                // 2. Scale Logic (Independent X and Y scaling)
                vec2 center = vec2(0.5);
                
                // Calculate scaled UVs
                vec2 scaledUV = vec2(
                    (uv.x - center.x) * uScaleX + center.x,
                    (uv.y - center.y) * uScaleY + center.y
                );

                // 3. Masking Logic (Show nothing outside the logo area)
                if (scaledUV.x < 0.0 || scaledUV.x > 1.0 || scaledUV.y < 0.0 || scaledUV.y > 1.0) {
                   // Transparent padding
                   gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                } else {
                   // Sample logo
                   vec4 color = texture2D(uTexture, scaledUV);
                   gl_FragColor = color;
                   // Optional opacity
                   gl_FragColor.a *= 0.9; 
                }
              }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });

          child.material = logoShader;

          // Tag for render loop animation
          child.userData.isScrollingLogoShader = true;
          console.log(
            "Applied scaled & masked scrolling logo shader to GLASS005"
          );
        } else {
          console.warn("Logo texture not found!");
        }
      }
    });
  }

  if (interiorModel) {
    console.log("Starting to traverse interior model...");

    // Define the meshes we want to outline
    const targetMeshes = [
      "polySurface3931001",
      "MR_V01010",
      "UP_body002",
      "Object",
    ];

    // First, let's find all meshes in the model
    const meshes = [];
    interiorModel.traverse((child) => {
      if (child.isMesh && targetMeshes.includes(child.name)) {
        meshes.push(child);
        // console.log("Found target mesh:", child.name, "at position:", child.position);
      }
    });

    console.log("Total target meshes found:", meshes.length);

    // Create outline material
    const outlineMaterial = new THREE.ShaderMaterial({
      ...holographicGlobeShader,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Apply outline to each target mesh
    meshes.forEach((mesh) => {
      // Create outline mesh
      const outlineMesh = mesh.clone();
      outlineMesh.material = outlineMaterial;
      outlineMesh.scale.multiplyScalar(1.05); // Slightly larger than original
      mesh.parent.add(outlineMesh);

      // Add animation
      const animate = () => {
        if (outlineMesh) {
          outlineMaterial.uniforms.time.value = performance.now() * 0.001;
          outlineMaterial.uniforms.glowIntensity.value =
            1.0 + Math.sin(performance.now() * 0.001) * 0.5;
        }
        requestAnimationFrame(animate);
      };
      animate();
    });
  } else {
    console.log("interiorModel is not available");
  }

  if (interiorModel) {
    interiorModel.traverse((child) => {
      if (
        child.isMesh &&
        (child.name === "Cylinder017" || child.name === "Cylinder021")
      ) {
        console.log("Found cylinder:", child.name);
      }
    });
  }
  // Disable HDRI reflections on interior model with cloning and map overrides
  if (interiorModel) {
    const whiteTexture = new THREE.Texture(); // Placeholder for nulling maps (avoids errors)
    whiteTexture.image = new Image();
    whiteTexture.needsUpdate = true;

    interiorModel.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone material to avoid sharing issues
        let originalMat = child.material;
        if (Array.isArray(originalMat)) {
          // Multi-material: clone each
          child.material = originalMat.map((mat) => {
            return mat.clone();
          });
          originalMat = child.material;
        } else {
          child.material = originalMat.clone();
        }

        // Get the (possibly array) cloned material(s)
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];

        mats.forEach((mat) => {
          // Null reflection-controlling maps to prevent overrides
          mat.roughnessMap = null;
          mat.metalnessMap = null;
          mat.envMap = null; // Explicitly null per-material env

          // Force matte/non-reflective uniforms
          mat.roughness = 1.0;
          mat.metalness = 0.0;
          mat.envMapIntensity = 0.0;

          // Handle transparency (prevent see-through HDRI)
          if (mat.transparent) {
            mat.transmission = 0.0; // If PhysicalMaterial
            mat.thickness = 0.0; // Disable any refraction
            mat.ior = 1.0; // No bending
            mat.opacity = Math.min(mat.opacity || 1, 0.99); // Slight reduction if fully transparent
          }

          mat.needsUpdate = true;
        });

        // Force matrix update for immediate effect
        child.updateMatrix();
      }
    });

    console.log(
      "Cloned materials and disabled HDRI reflections/maps on interior model."
    );
  }
  // Start animation loop
  animate();

  // Add resize handler
  resizeHandler = () => {
    const aspect = window.innerWidth / window.innerHeight;
    if (camera && renderer) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };
  window.addEventListener("resize", resizeHandler);

  return { scene, camera, renderer, controls, sceneInitialization };
}

/**
 * Starts the animation loop for Scene 3.
 *
 * In VR:
 *   - Registers `render` as the XR animation loop.
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
 * Per–frame update for Scene 3.
 *
 * Responsibilities:
 *  - Updates logo shader time uniforms and billboards the HUD video plane
 *  - Updates VR or OrbitControls, batched particle renderer and NPCs
 *  - Steps player physics, collisions and animation
 *  - Steps Zoe / Electro / emergency / fadeout systems and minimap
 *  - Renders the scene from the active camera
 */
function render() {
  if (!camera) return;

  // stats.begin();
  const delta = Math.min(clock.getDelta(), 0.05);

  // ---------------------------------------------------------
  // UPDATE SCROLLING LOGO SHADER ON GLASS005
  // ---------------------------------------------------------
  if (interiorModel) {
    interiorModel.traverse((child) => {
      // Find the mesh tagged with scrolling shader
      if (child.userData.isScrollingLogoShader && child.material.uniforms) {
        // Update time uniform for scrolling
        child.material.uniforms.uTime.value = clock.getElapsedTime();
      }
    });
  }
  // ---------------------------------------------------------

  // Billboard the hud video plane
  if (hudVideoPlane && camera) {
    // Make the plane always face the camera
    hudVideoPlane.lookAt(camera.position);
  }

  // Update VR if in VR mode
  if (userInfo.modeSelected === "vr") {
    updateVR();
  } else if (controls) {
    controls.update();
  }

  // Update batched renderer
  if (batchSystemRef) {
    batchSystemRef.update();
  }

  // Update player and animations
  const player = sceneInitialization?.playerFunction?.player;
  if (player) {
    player.updateMatrixWorld();

    // Handle collisions
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

    // Update animations
    // updateZoe(frameTime, player);
    // updateElectro(frameTime, player);
    updateZoe(delta, player);
    updateElectro(delta, player);
    if (Math.random() < 0.1) {
      checkEmergencyTrigger(player, camera, interiorModel, scene);
    }
    // updateEmergency(frameTime, player, camera);
    // updateFadeOut(frameTime);

    updateEmergency(delta, player, camera);
    updateFadeOut(delta);

    // Update minimap
    updateMinimap();

    // Update NPC system
    if (npcSystem) {
      npcSystem.update(delta);
    }
  }

  renderer.render(scene, camera);
  // stats.end();
}

/**
 * Fully cleans up Scene 3.
 *
 * This tears down:
 *  - Audio and background music
 *  - NPCs, Zoe / Electro / emergency / fade out, VR and physics helpers
 *  - Batched particle renderer and all scene objects / materials / geometries
 *  - OrbitControls and resize listeners
 *
 * It should always be called before transitioning away from Scene 3.
 */
export function cleanupScene3() {
  // Clean up audio
  cleanupAudioManager();
  isSceneTransitioning = false;

  // Stop and clean up background music
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
    backgroundAudio = null;
  }

  // Clean up NPC system
  if (npcSystem) {
    npcSystem.cleanup();
    npcSystem = null;
  }

  // // Store renderer reference before cleanup
  // const currentRenderer = renderer;

  // Remove stats
  // if (stats) {
  //   stats.dom.remove();
  //   stats = null;
  // }

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

  // // Clean up GUI
  // destroyGUI();

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

  // Clean up effects and sequences
  cleanupZoe();
  cleanupElectro();
  cleanupEmergency(scene);
  cleanupFadeOut(scene);

  // Clean up falling sequence
  cleanupMainFallingSequence();

  // Clean up batched renderer
  if (batchSystemRef) {
    // Remove from scene
    if (scene) {
      scene.remove(batchSystemRef);
    }
    // Clear any particle systems
    if (batchSystemRef.particleSystems) {
      batchSystemRef.particleSystems.forEach((system) => {
        if (system.dispose) {
          system.dispose();
        }
      });
      batchSystemRef.particleSystems = [];
    }
    // Clear any emitters
    if (batchSystemRef.emitters) {
      batchSystemRef.emitters.forEach((emitter) => {
        if (emitter.dispose) {
          emitter.dispose();
        }
      });
      batchSystemRef.emitters = [];
    }
    batchSystemRef = null;
  }

  // Clean up scene
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            material.dispose();
            // Clear material properties
            material.map = null;
            material.lightMap = null;
            material.bumpMap = null;
            material.normalMap = null;
            material.specularMap = null;
            material.envMap = null;
          });
        } else {
          object.material.dispose();
          // Clear material properties
          object.material.map = null;
          object.material.lightMap = null;
          object.material.bumpMap = null;
          object.material.normalMap = null;
          object.material.specularMap = null;
          object.material.envMap = null;
        }
      }
      // Clear any custom properties
      object.userData = {};
    });

    // Remove all objects from scene
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
  }

  // Clean up controls
  if (controls) {
    controls.dispose();
  }

  // // Clean up renderer last, after all other cleanup is done
  // if (currentRenderer) {
  //   try {
  //     // Store the new renderer reference
  //     renderer = cleanupRenderer(currentRenderer);
  //   } catch (error) {
  //     console.error("Error cleaning up renderer:", error);
  //     // Create a new renderer as fallback
  //     renderer = new THREE.WebGLRenderer({
  //       antialias: true,
  //       powerPreference: "default",
  //     });
  //   }
  // }

  // Clean up lights
  if (light) {
    light.dispose();
    light = null;
  }
  if (ambLight) {
    ambLight.dispose();
    ambLight = null;
  }

  // Reset variables
  scene = null;
  camera = null;
  controls = null;
  sceneInitialization = null;
  interiorModel = null;
  batchSystemRef = null;
  light = null;
  ambLight = null;
  vfxEffect = null;
  redzoneEffect = null;
  collisionMesh = null;
  clock = null;

  // Clean up minimap
  cleanupMinimap();

  // Clean up objectives
  // cleanupSceneObjectives();

  // // Force garbage collection if available
  // if (window.gc) {
  //   window.gc();
  // }
}

// Add this function to handle scene switching
/**
 * Schedules a transition from Scene 3 to Scene 4.
 *
 * - Waits for the specified delay
 * - Gracefully ends any active WebXR session
 * - Cleans up Scene 3 and then calls `initializeScene4` reusing the renderer
 *
 * @param {number} [delay=10000] - Delay in milliseconds before switching scenes.
 */
export function switchToScene4AfterDelay(delay = 10000) {
  if (isSceneTransitioning) return;
  isSceneTransitioning = true;

  setTimeout(() => {
    const session = renderer.xr.getSession();

    const transitionToNextScene = (isVR) => {
      markSceneCompleted("scene3");
      // Stop the falling sequence before scene transition
      cleanupMainFallingSequence();

      // Remove the event listener before switching scenes
      window.removeEventListener("keydown", handleKeyPress);
      if (sceneInitialization) {
        sceneInitialization.cleanUpCollider();
      }
      cleanupScene3();
      checkExistingAssets(nextEntry);
      initializeScene4(renderer, isVR).finally(() => {
        isSceneTransitioning = false;
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
  }, delay);
}

/**
 * Thin wrapper used by Scene 3 to trigger the legacy falling effect.
 *
 * This version only:
 *  - Sets `window.isFalling`
 *  - Disables camera controls
 *  - Locates the floor mesh and triggers crack + explosion
 *  - Schedules a timed transition to Scene 4 after ~10 seconds
 *
 * @param {THREE.Scene}  currentScene  - Current scene instance
 * @param {THREE.Camera} currentCamera - Camera used for the fall
 * @param {Object}       allAssets     - Loaded assets for scene 3
 * @param {THREE.Object3D} player      - Player instance used for lookAt
 */
export async function initializeFallingEffect(
  currentScene,
  currentCamera,
  allAssets,
  player
) {
  console.log("Initializing falling effect...");
  scene = currentScene;
  camera = currentCamera;

  // Set global falling state
  window.isFalling = true;

  // Disable player controls during fadeout
  if (camera.userData && camera.userData.controls) {
    camera.userData.controls.enabled = false;
  }

  // Create sci-fi tunnel effect
  // createTunnelEffect();

  // Create nebula particles
  // createNebulaParticles();

  // Find the floor mesh
  scene.traverse((object) => {
    if (object.isMesh && object.name === "polySurface998") {
      floorMesh = object;
      console.log("Found floor mesh:", floorMesh);
    }
  });

  // Set initial camera position
  camera.position.set(0, 5, 0);
  if (player) {
    camera.lookAt(player.position);
  }

  // Trigger the effect
  console.log("Triggering crack visual...");
  triggerCrackVisual();

  console.log("Setting up floor explosion...");
  setTimeout(explodeFloor, 1500);

  // Add timer to switch to scene4 after 10 seconds
  console.log("Setting up scene4 transition timer...");
  setTimeout(() => {
    console.log("Timer completed, initiating scene4 switch...");
    switchToScene4AfterDelay();
  }, 10000); // 10 seconds
}

// Add this to your zoeInteraction.js event handler or wherever Zoe interaction completes
export function onZoeInteractionComplete() {
  // showSceneObjective(2);
}
