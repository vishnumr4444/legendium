import * as THREE from "three";
// import Stats from "three/examples/jsm/libs/stats.module.js";
import ThreeMeshUI from "three-mesh-ui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  allAssets,
  checkExistingAssets,
  loadAllAsset,
} from "../commonFiles/assetsLoader.js";
import { assetsEntry as currentEntry } from "./assetsEntry.js";
import { assetsEntry as nextEntry } from "../scene5/assetsEntry.js";
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer.js";
import { setCurrentScene, getUserInfo } from "../data.js";
import { celebrateSceneCompletion } from "../commonFiles/sceneCompletionCelebration.js";
import {
  createMinimap,
  updateMinimap,
  cleanupMinimap,
} from "./minimap.js";
import {
  initializeVR,
  updateVR,
  cleanupVR,
  enablePlayerMovement,
  disablePlayerMovement,
  setCollisionMesh,
} from "../commonFiles/vrManager.js";
import { TriggerPoint } from "../commonFiles/triggerPoint.js";
import {
  enablePlayerControls,
  handleCollisions,
  playerState,
  disablePlayerControls,
  togglePlayerControls,
  togglePlayerPhysics,
  addCollider,
  removeCollider,
  toggleColliderVisibility,
  toggleColliderPhysics,
  additionalColliders,
} from "../commonFiles/playerController.js";
import { initializeScene5 } from "../scene5/scene5.js";
import {
  playAudio,
  initializeAudioManager,
  cleanupAudioManager,
  pauseAudio,
  resumeAudio,
  stopAudio,
} from "../commonFiles/audiomanager.js";
import {
  Line2,
  LineGeometry,
  LineMaterial,
} from "three/examples/jsm/Addons.js";
import vShader from "/public/scene44/Shaders/portalVShader.glsl";
import fShader from "/public/scene44/Shaders/portalFShader.glsl";
import videoVshader from "/public/scene44/Shaders/videoAlphaVshader.glsl";
import videoFshader from "/public/scene44/Shaders/videoAlphaFshader.glsl";
import { WireConfig } from "/commonFiles/CreateWire.js";
import { applyDistanceFade } from "./fadeUtil.js";
import {
  showSceneObjective,
  hideObjective,
  cleanupObjectives,
} from "./objectives.js";
import {
  updateFilterObjects,
  draggingControl,
  cleanupDragControls,
} from "./dragUtils.js";
import gsap from "gsap";
import { cleanupGUIControls, initObjectControls } from "./guiUtils.js";
import FakeGlowMaterial from "./FakeGlowMaterial.js";
import { setupShapeKeyAnimations } from "../commonFiles/electroShapeKey.js";
import { QuestionnaireUI } from "./QuestionnaireMeshUIUtil.js";
import { MeshUIPanels } from "./meshUIPanelUtils.js";
import { auth, db } from "../WebFiles/firebase.js";
import { doc, updateDoc } from "firebase/firestore";
import { createSkipButton, showSkipButton, hideSkipButton } from "../commonFiles/skipButton.js";
import { markSceneVisited } from "../data.js";
// ADD THESE VARIABLES
let skipButtonInitialized = false;
let isSequenceSkipped = false;

/**
 * @fileoverview Scene 4 runtime ("Underground Lab" + Electro intro + quiz + circuit puzzle).
 *
 * Scene 4 is a multi-stage experience with several major systems:
 * - **Asset loading**: `assetsEntry` + `assetsLoader` populates `allAssets`.
 * - **Player & physics**: `initializePhysicsAndPlayer` + `playerController`.
 * - **Cinematics**: multiple cameras are used for scripted beats and puzzles.
 * - **In-world UI**:
 *   - `MeshUIPanels` renders an info panel and navigation buttons (three-mesh-ui).
 *   - `QuestionnaireUI` renders a quiz panel backed by `Questions.json`.
 * - **Minimap**: DOM overlay (canvas) showing markers and paths.
 * - **Triggers/objectives**: zone triggers drive audio, UI, and transitions.
 * - **VR support**: optional XR interaction.
 *
 * Cleanup:
 * This file uses extensive module-level state and registers many global event
 * listeners. Always call `cleanupScene4()` when leaving this scene.
 */

/**
 * Mark a scene as completed for the current authenticated user.
 * Stored in Firestore under `users/<uid>/scenesCompleted.<sceneKey>`.
 *
 * @param {string} sceneKey
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



let scene, renderer, controls;
let camera,
  circuitCam,
  gateViewCam,
  electroViewCam,
  electroExplaination,
  introRoomCam;
let circPanel, gateMesh, gatePlane, line, lockPlane, guiMesh;
let capacitorModel,
  batteryModel,
  introBatteryModel,
  introMotorModel,
  ledModel,
  mainModel,
  resistorModel,
  dcMotorModel,
  ubecModel,
  buttonModel,
  buzzerModel,
  motorDriverModel,
  powerDistributorModel,
  electro,
  dTwinPlane,
  keyPadPlane,
  zoePlane;
let ledGlowClone;
let panelData;
let questionnairePanel;
let response, data;
let backgroundAudio; // Add background music variable

let electroMixer,
  wakeup,
  headUp,
  electroIdle,
  electroType,
  electroExplain,
  electroReach;

let circuitPanel,
  button,
  prevButton,
  nextButton,
  backButton,
  circBackButton,
  infoMainPanel,
  controlButtonContainer,
  circControlButtonContainer,
  contentBlock,
  leftSubBlock,
  rightSubBlock;
let currentCamera, viewCam;
let collisionMesh;
let clock;
let wireGlowPoints1, wireGlowPoints2;
let directionalLight1;

let panelIndex = 0;
let snapThreshold = 0.11;

let fakeGlowMaterial, pointLight;

let meshUIPanels = null;
let electroShapekey = null;
let animationFrameId = null;
let sceneInitialization = null;
// let stats = null;
let selectedObject = null;
let resizeHandler = null;
let infoZoneTrigger,
  advancedInfoZoneTrigger,
  sceneSwitchTrigger,
  warningZoneTrigger1 = null;
let currentModel = null;

// Add at the top with other state variables
let isSceneTransitioning = false;
let addedToScene = false;
let isQuizSubmitted = false;
let physicsSet = false;
let introCompleted = false;
let selectState = false;
let buttonHandled = false;
let circuitCheck = false;
let isMovingCameraBack = false;
let isMovingCameraToTarget = false;
let isPanelLoading = false;

// At the top, add these variables to store event handler references
let pointerDownHandler = null;
let pointerUpHandler = null;
let mouseMoveHandler = null;
let windowMouseDownHandler = null;
let windowResizeHandler = null;

let objectToPlaneMap = {};

const targetMap = {
  battery9v: new THREE.Vector3(-3.29, -0.99, 7.4),
  dcMotor: new THREE.Vector3(-4.38, -0.95, 7.95),
  resistor100: new THREE.Vector3(-3.7, -0.97, 8.1),
  led: new THREE.Vector3(-4.12, -0.97, 8.1),
  capacitor: new THREE.Vector3(-3.5, -0.97, 7.5),
};

let activeWireGlows = [],
  circuitLines = [],
  objsToTest = [],
  connections = [],
  planeTextures = [],
  planeCloneTracker = [],
  planeMaterialTracker = [];
// filterObjects = [];

let planePositions = [
  new THREE.Vector3(-3.3, -0.945, 7.4),
  new THREE.Vector3(-3.5, -0.945, 7.5),
  new THREE.Vector3(-4.12, -0.945, 8.1),
  new THREE.Vector3(-4.38, -0.92, 7.9),
  new THREE.Vector3(-3.7, -0.945, 8.1),
];

let planeRotations = [
  new THREE.Euler(Math.PI / 2, 0, Math.PI / 2),
  new THREE.Euler(Math.PI / 2, 0, 0),
  new THREE.Euler(Math.PI / 2, 0, 0),
  new THREE.Euler(Math.PI / 2, Math.PI, 0),
  new THREE.Euler(Math.PI / 2, 0, 0),
];

let wireGlowPoints = [
  (wireGlowPoints1 = [
    new THREE.Vector3(-3.15, -0.93, 7.43),
    new THREE.Vector3(-3.3, -0.93, 7.43),
    new THREE.Vector3(-3.3, -0.97, 7.43),
    new THREE.Vector3(-3.3, -0.97, 8.1),
    new THREE.Vector3(-3.62, -0.97, 8.1),
    new THREE.Vector3(-3.62, -0.93, 8.1),
    new THREE.Vector3(-3.78, -0.93, 8.1),
    new THREE.Vector3(-3.78, -0.97, 8.1),
    new THREE.Vector3(-4.105, -0.97, 8.1),
    new THREE.Vector3(-4.105, -0.8, 8.1),
    new THREE.Vector3(-4.135, -0.8, 8.1),
    new THREE.Vector3(-4.135, -0.97, 8.1),
    new THREE.Vector3(-4.38, -0.97, 8.1),
    new THREE.Vector3(-4.38, -0.97, 7.96),
    new THREE.Vector3(-4.38, -0.93, 7.96),
    new THREE.Vector3(-4.4, -0.93, 7.96),
    new THREE.Vector3(-4.4, -0.93, 7.88),
    new THREE.Vector3(-4.38, -0.93, 7.88),
    new THREE.Vector3(-4.38, -0.97, 7.88),
    new THREE.Vector3(-4.38, -0.97, 7.25),
    new THREE.Vector3(-3.3, -0.97, 7.25),
    new THREE.Vector3(-3.3, -0.97, 7.37),
    new THREE.Vector3(-3.3, -0.93, 7.37),
    new THREE.Vector3(-3.15, -0.93, 7.37),
  ]),
  (wireGlowPoints2 = [
    new THREE.Vector3(-3.5, -0.97, 8.1),
    new THREE.Vector3(-3.5, -0.97, 7.501),
    new THREE.Vector3(-3.5, -0.85, 7.501),
    new THREE.Vector3(-3.5, -0.85, 7.48),
    new THREE.Vector3(-3.5, -0.97, 7.48),
    new THREE.Vector3(-3.5, -0.97, 7.25),
  ]),
];

let finalPositions = Object.values(targetMap);

let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let occupiedPositions = new Map();
let pointer = new THREE.Vector2();
let baseColorTex,
  portalTex,
  lockTex,
  alphaTex,
  batteryTex,
  capacitorTex,
  ledTex,
  motorTex,
  resistorTex,
  keyBoardTex,
  dTwinTex,
  zoeTex,
  zoeVideo,
  dTwinVideo;

// Define handleKeyPress at the top level
function handleKeyPress(event) {
  if (event.key.toLowerCase() === "y" && !isSceneTransitioning) {
    isSceneTransitioning = true;
    const session = renderer.xr.getSession();
    const transitionToNextScene = (isVR) => {
      try { markSceneCompleted("scene4"); } catch (e) {}
      window.removeEventListener("keydown", handleKeyPress);
      celebrateSceneCompletion({
        completedSceneKey: "scene4",
        nextSceneKey: "scene5",
        headline: "Underground Lab Explored!",
        subtext: "The Robotic Assembly line awaits your command. Returning to scene select...",
        onCleanup: () => {
          if (sceneInitialization) {
            try { sceneInitialization.cleanUpCollider(); } catch (e) {}
          }
          try { cleanupScene4(); } catch (e) {}
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

export async function initializeScene4(existingRenderer, isVRMode) {
  /**
   * Initialize Scene 4.
   *
   * Responsibilities:
   * - Load assets and build the scene graph (environment, UI, triggers).
   * - Initialize audio and player physics.
   * - Run the Electro intro sequence (supports "Skip").
   * - Drive the quiz + circuit puzzle flow and enable transition to Scene 5.
   *
   * @param {THREE.WebGLRenderer} existingRenderer
   * @param {boolean} isVRMode
   * @returns {Promise<{scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: any}>}
   */


  // ... (inside initializeScene4)
let isSceneTransitioning = false;
let addedToScene = false;
// ... (other state flags) ...
let isPanelLoading = false;




  //Assigning current scene to scene1
  setCurrentScene("scene4");
  await markSceneVisited("scene4");

  isSequenceSkipped = false;
  skipButtonInitialized = false;
  const userInfo = getUserInfo();
  // stats = new Stats();
  // stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  // document.body.appendChild(stats.dom);

  // Cancel any existing animation frame
  animationFrameId = null;
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
  camera.position.set(0, 0, 1.6);

  viewCam = new THREE.PerspectiveCamera(
    32,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  circuitCam = new THREE.PerspectiveCamera(
    32,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  gateViewCam = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  electroViewCam = new THREE.PerspectiveCamera(
    32,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  electroExplaination = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  introRoomCam = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  await loadAllAsset(currentEntry, camera);
  console.log(allAssets);

  currentCamera = camera;

  scene = new THREE.Scene();

  initializeAudioManager(currentCamera, scene);

  // Use existing renderer
  renderer = existingRenderer;

  // Reset renderer state
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.physicallyCorrectLights = true;

  pointLight = new THREE.PointLight(0xff5051, 0, 5);
  pointLight.position.set(-4.12, -0.76, 8.1);

  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }

  console.log(renderer);

  clock = new THREE.Clock();

  baseColorTex = allAssets.textures.screen;
  alphaTex = allAssets.textures.Lock_Base_Alpha;
  portalTex = allAssets.textures.portal;
  lockTex = allAssets.textures.Lock_Base;
  batteryTex = allAssets.textures.batteryImg;
  capacitorTex = allAssets.textures.capacitorImg;
  ledTex = allAssets.textures.ledImg;
  motorTex = allAssets.textures.motorImg;
  resistorTex = allAssets.textures.resistorImg;
  keyBoardTex = allAssets.textures.keyboardImg;
  dTwinTex = allAssets.videotextures.DTwin;
  zoeTex = allAssets.videotextures.ZoeVid;

  if (allAssets && allAssets.videotextures && allAssets.videotextures.DTwin) {
    dTwinVideo = document.createElement("video");
    dTwinVideo.src = allAssets.videotextures.DTwin.path;
    dTwinVideo.loop = true;
    dTwinVideo.muted = true;
    dTwinVideo.playsInline = true;
    dTwinVideo.crossOrigin = "anonymous";
    dTwinVideo.autoplay = false;
    dTwinVideo.preload = "auto";
    dTwinVideo.style.display = "none";
    document.body.appendChild(dTwinVideo);

    dTwinTex = new THREE.VideoTexture(dTwinVideo);
    dTwinTex.minFilter = THREE.LinearFilter;
    dTwinTex.magFilter = THREE.LinearFilter;
    dTwinTex.format = THREE.RGBAFormat;
    dTwinTex.generateMipmaps = false;

    window.dTwinVideoElement = dTwinVideo;
    window.dTwinVideoTexture = dTwinTex;
  } else {
    console.error("dTwinTex not found in allAssets.videotextures");
  }

  if (allAssets && allAssets.videotextures && allAssets.videotextures.ZoeVid) {
    zoeVideo = document.createElement("video");
    zoeVideo.src = allAssets.videotextures.ZoeVid.path;
    zoeVideo.loop = true;
    zoeVideo.muted = true;
    zoeVideo.playsInline = true;
    zoeVideo.crossOrigin = "anonymous";
    zoeVideo.autoplay = false;
    zoeVideo.preload = "auto";
    zoeVideo.style.display = "none";
    document.body.appendChild(zoeVideo);

    zoeTex = new THREE.VideoTexture(zoeVideo);
    zoeTex.minFilter = THREE.LinearFilter;
    zoeTex.magFilter = THREE.LinearFilter;
    zoeTex.format = THREE.RGBAFormat;
    zoeTex.generateMipmaps = false;

    window.zoeVideoElement = zoeVideo;
    window.zoeVideoTexture = zoeTex;
  } else {
    console.error("zoeTex not found in allAssets.videotextures");
  }

  let texturesToCheck = {
    baseColorTex,
    portalTex,
    alphaTex,
    lockTex,
    batteryTex,
    capacitorTex,
    ledTex,
    motorTex,
    resistorTex,
    keyBoardTex,
  };

  const missingTextures = Object.entries(texturesToCheck)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingTextures.length > 0) {
    console.error("Missing textures:", missingTextures.join(", "));
    return;
  }

  baseColorTex.wrapS =
    baseColorTex.wrapT =
    portalTex.wrapS =
    portalTex.wrapT =
    alphaTex.wrapS =
    alphaTex.wrapT =
    lockTex.wrapS =
    lockTex.wrapT =
    batteryTex.wrapS =
    batteryTex.wrapT =
    capacitorTex.wrapS =
    capacitorTex.wrapT =
    ledTex.wrapS =
    ledTex.wrapT =
    motorTex.wrapS =
    motorTex.wrapT =
    resistorTex.wrapS =
    resistorTex.wrapT =
    keyBoardTex.wrapS =
    keyBoardTex.wrapT =
    THREE.RepeatWrapping;

  planeTextures = [
    batteryTex,
    capacitorTex,
    ledTex,
    motorTex,
    resistorTex,
    keyBoardTex,
  ];

  circPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.7),
    new THREE.MeshStandardMaterial({
      map: baseColorTex,
      side: THREE.DoubleSide,
      depthWrite: true,
    })
  );
  gatePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
  );
  lockPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({
      map: lockTex,
      alphaMap: alphaTex,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    })
  );

  keyPadPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.5),
    new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      map: keyBoardTex,
      transparent: true,
    })
  );

  zoePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    dTwinTex
      ? new THREE.ShaderMaterial({
        uniforms: {
          videoTexture: { value: dTwinTex },
          time: { value: 0 },
        },
        vertexShader: videoVshader,
        fragmentShader: videoFshader,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      : new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        color: 0x00ff00, // Fallback green color
      })
  );

  dTwinPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: {
        videoTexture: { value: dTwinTex },
        time: { value: 0 },
      },
      vertexShader: videoVshader,
      fragmentShader: videoFshader,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  fakeGlowMaterial = new FakeGlowMaterial({
    glowColor: "#ff5051",
    falloff: 0.5,
    glowInternalRadius: 1.5,
    glowSharpness: 0.2,
    opacity: 0,
  });

  mainModel = allAssets.models.gltf.main;
  batteryModel = allAssets.models.gltf.battery9v;
  introBatteryModel = allAssets.models.gltf.introBattery9v;
  ledModel = allAssets.models.gltf.led;
  capacitorModel = allAssets.models.gltf.capacitor;
  resistorModel = allAssets.models.gltf.resistor100;
  dcMotorModel = allAssets.models.gltf.dcMotor;
  introMotorModel = allAssets.models.gltf.introMotor;
  ubecModel = allAssets.models.gltf.UBEC;
  powerDistributorModel = allAssets.models.gltf.powerDistributionModule;
  buzzerModel = allAssets.models.gltf.buzzer;
  buttonModel = allAssets.models.gltf.button;
  motorDriverModel = allAssets.models.gltf.motorDriver;
  electro = allAssets.characters.models.electro;
  console.log(electro);

  electroShapekey = setupShapeKeyAnimations(electro);

  electroMixer = allAssets.characters.animations.electro.mixer;

  wakeup = allAssets.characters.animations.electro.actions.IDEL;
  electroIdle = allAssets.characters.animations.electro.actions.BREATHING_IDLE;
  headUp = allAssets.characters.animations.electro.actions.HEAD_UP;
  electroType = allAssets.characters.animations.electro.actions.ENTERING_CODE;
  electroExplain = allAssets.characters.animations.electro.actions.TALKING_02;
  electroReach = allAssets.characters.animations.electro.actions.REACHING_OUT;

  let customShaderMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uTexture: { value: portalTex },
      uOpacity: { value: 1.0 },
    },
    vertexShader: vShader,
    fragmentShader: fShader,
  });

  mainModel.traverse((child) => {
    if (child.isMesh) {
      if (child.name === "portal_physics") {
        gateMesh = child;
        gateMesh.material = customShaderMaterial;
        console.log(child.position);
      }
    }
  });

  camera.position.set(0, 0.5, -0.2);

  let camHolder = new THREE.Group();
  camHolder.add(electroViewCam);

  camHolder.position.set(0, 0.5, -0.2);
  camHolder.rotation.set(0, Math.PI, 0);

  electro.traverse((child) => {
    if (child.isBone && child.name === "mixamorigHead") {
      child.add(camHolder);
    }
  });

  gatePlane.position.set(-27.5, 0, 0);
  circPanel.position.set(-27.6, -0.2, -7.1);
  lockPlane.position.set(-27.8, -0.5, 0.3);
  keyPadPlane.position.set(-26.0, -1.4, -0.1);
  zoePlane.position.set(-26.5, -0.1, 2.9);
  dTwinPlane.position.set(-27.0, -0.1, -2.9);

  ledModel.position.set(-2.8, -0.95, 7.925);
  dcMotorModel.position.set(-2.7, -0.95, 8.15);
  capacitorModel.position.set(-2.8, -0.95, 7.475);
  resistorModel.position.set(-2.8, -0.95, 7.7);
  batteryModel.position.set(-2.8, -0.99, 7.25);

  electro.position.set(-15, -2.0, 5.0);

  pointLight.position.set(-4.12, -0.97, 8.1);

  keyPadPlane.rotateY(-Math.PI / 2);
  keyPadPlane.rotateX(-Math.PI / 4);
  zoePlane.rotateY((13 * Math.PI) / 18);
  dTwinPlane.rotateY(Math.PI / 3);

  ledModel.rotateY(-Math.PI / 2);
  dcMotorModel.rotation.set(Math.PI / 2, Math.PI, 0);
  batteryModel.rotation.set(Math.PI / 2, Math.PI, 0);
  resistorModel.rotateY(Math.PI);
  capacitorModel.rotation.set(0, Math.PI / 2, Math.PI / 2);

  electro.rotateY((-2 * Math.PI) / 3);

  dcMotorModel.userData.initialRotation = dcMotorModel.rotation.clone();
  capacitorModel.userData.initialRotation = capacitorModel.rotation.clone();
  ledModel.userData.initialRotation = new THREE.Euler().copy(ledModel.rotation);
  ledModel.userData.initialQuaternion = new THREE.Quaternion().copy(
    ledModel.quaternion
  );
  resistorModel.userData.initialRotation = resistorModel.rotation.clone();
  batteryModel.userData.initialRotation = batteryModel.rotation.clone();

  gatePlane.rotateY(Math.PI / 2);
  lockPlane.rotateY(Math.PI / 2);
  circPanel.rotateY(Math.PI / 2);
  circPanel.rotateZ(Math.PI / 2);

  zoePlane.scale.set(2.0, 2.0, 2.0);
  dTwinPlane.scale.set(2.0, 2.0, 2.0);

  ledModel.scale.set(0.14, 0.14, 0.14);
  dcMotorModel.scale.set(0.3, 0.3, 0.3);
  capacitorModel.scale.set(0.22, 0.22, 0.22);
  resistorModel.scale.set(0.17, 0.17, 0.17);
  batteryModel.scale.set(0.2, 0.2, 0.2);

  introBatteryModel.visible = false;
  ledModel.visible = false;
  capacitorModel.visible = false;
  introMotorModel.visible = false;
  resistorModel.visible = false;
  ubecModel.visible = false;
  powerDistributorModel.visible = false;
  buzzerModel.visible = false;
  buttonModel.visible = false;
  motorDriverModel.visible = false;
  batteryModel.visible = false;
  dcMotorModel.visible = false;

  circPanel.visible = false;
  gatePlane.visible = false;
  circPanel.visible = false;
  gatePlane.visible = false;

  scene.add(gatePlane, lockPlane);
  scene.add(pointLight);
  scene.add(electro);

  ledModel.traverse((child) => {
    if (child.isMesh && child.name === "Cylinder_0") {
      let glowClone = child.clone();
      glowClone.material = fakeGlowMaterial;
      glowClone.position.copy(child.position);
      glowClone.quaternion.copy(child.quaternion);
      child.parent.add(glowClone);
      ledGlowClone = glowClone;
    }
  });

  let gateCollider = addCollider("gatePlane", gatePlane);
  gateCollider.position.copy(gatePlane.position);
  gateCollider.rotation.copy(gatePlane.rotation);
  scene.add(gateCollider);

  let pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  let envMap = pmremGenerator.fromEquirectangular(allAssets.hdris.env).texture;

  scene.environment = envMap;
  scene.background = envMap;
  pmremGenerator.dispose();

  function createCircuit() {
    connections = [
      [-3.3, -0.97, 7.25, -3.3, -0.97, 7.37],
      [-3.3, -0.97, 7.43, -3.3, -0.97, 8.1], // battery
      [-3.3, -0.97, 7.37, -3.3, -0.95, 7.37], // battery top line 1
      [-3.3, -0.97, 7.43, -3.3, -0.95, 7.43], // battery top line 2
      [-3.5, -0.97, 7.25, -3.5, -0.97, 7.48],
      [-3.5, -0.97, 7.501, -3.5, -0.97, 8.1], // capacitor
      [-3.5, -0.97, 7.48, -3.5, -0.96, 7.48], // capacitor top line 1
      [-3.5, -0.97, 7.501, -3.5, -0.96, 7.501], // capacitor top line 2
      [-4.38, -0.97, 7.25, -4.38, -0.97, 7.88],
      [-4.38, -0.97, 7.96, -4.38, -0.97, 8.1], // motor
      [-4.38, -0.97, 7.88, -4.38, -0.93, 7.88], // motor top line 1
      [-4.38, -0.97, 7.96, -4.38, -0.93, 7.96], // motor top line 2
      [-3.3, -0.97, 8.1, -3.62, -0.97, 8.1],
      [-3.78, -0.97, 8.1, -4.105, -0.97, 8.1], // resistor
      [-4.105, -0.97, 8.1, -4.105, -0.95, 8.1], // led  top line 1
      [-4.135, -0.97, 8.1, -4.38, -0.97, 8.1], // led
      [-3.3, -0.97, 7.25, -4.38, -0.97, 7.25], // bottom line
    ];

    let material = new LineMaterial({
      color: 0xff0000,
      linewidth: 6,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    connections.forEach((conn) => {
      let geometry = new LineGeometry();
      geometry.setPositions(conn);

      line = new Line2(geometry, material);
      line.computeLineDistances();
      scene.add(line);
      circuitLines.push(line);
    });
  }

  function circuitSolution() {
    console.log("circuit solution");
    circPanel.visible = true;
    createCircuit();
    switchToCircuitCam();
    scene.add(mainModel);

    batteryModel.visible = true;
    ledModel.visible = true;
    capacitorModel.visible = true;
    resistorModel.visible = true;
    dcMotorModel.visible = true;

    console.log("Battery:", {
      visible: batteryModel.visible,
      position: batteryModel.position.toArray(),
      inScene: scene.children.includes(batteryModel),
    });
    console.log("LED:", {
      visible: ledModel.visible,
      position: ledModel.position.toArray(),
      inScene: scene.children.includes(ledModel),
    });
    console.log("Capacitor:", {
      visible: capacitorModel.visible,
      position: capacitorModel.position.toArray(),
      inScene: scene.children.includes(capacitorModel),
    });
    console.log("Resistor:", {
      visible: resistorModel.visible,
      position: resistorModel.position.toArray(),
      inScene: scene.children.includes(resistorModel),
    });
    console.log("DC Motor:", {
      visible: dcMotorModel.visible,
      position: dcMotorModel.position.toArray(),
      inScene: scene.children.includes(dcMotorModel),
    });

    if (!scene.children.includes(batteryModel)) scene.add(batteryModel);
    if (!scene.children.includes(ledModel)) scene.add(ledModel);
    if (!scene.children.includes(capacitorModel)) scene.add(capacitorModel);
    if (!scene.children.includes(resistorModel)) scene.add(resistorModel);
    if (!scene.children.includes(dcMotorModel)) scene.add(dcMotorModel);

    meshUIPanels.circuitPanel.visible = false;
    planePositions.forEach((pos, i) => {
      let tex = planeTextures[i];
      let material = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.DoubleSide,
        opacity: 0.2,
        transparent: true,
      });

      let plane = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), material);
      plane.position.copy(pos);
      if (planeRotations[i]) {
        plane.rotation.copy(planeRotations[i]);
      } else {
        plane.rotation.x = Math.PI / 2;
      }
      scene.add(plane);
      planeCloneTracker.push(plane);
      planeMaterialTracker.push(material);

      let objectNames = [
        "battery9v",
        "capacitor",
        "led",
        "dcMotor",
        "resistor100",
      ];
      let objName = objectNames[i];
      objectToPlaneMap[objName] = {
        plane,
        correctPosition: targetMap[objName],
      };

      gsap.to(material, {
        opacity: 0.8,
        duration: 0.8,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    });

    updateFilterObjects({
      scene,
      circuitCam,
      renderer,
      finalPositions,
      snapThreshold,
      occupiedPositions,
      allObjectsPlaced,
      objectToPlaneMap,
    });
  }

  function wireGlowEffect(onComplete) {
    let completedWires = 0;
    const totalWires = wireGlowPoints.length;

    function handleWireComplete() {
      completedWires++;
      if (completedWires === totalWires) {
        if (typeof onComplete === "function") {
          onComplete();
        }

        gsap.to(pointLight, {
          intensity: 5,
          duration: 5,
          ease: "power2.out",
          onComplete: () => {
            setTimeout(() => {
              gateAnims();
              switchtoGateViewCam();
              // playAudio("electroGateOpen");
            }, 500);
          },
        });

        if (ledGlowClone?.material) {
          gsap.to(ledGlowClone.material.uniforms.opacity, {
            value: 1,
            duration: 5,
            ease: "power2.out",
          });
        }
      }
    }

    activeWireGlows = wireGlowPoints.map((points) =>
      WireConfig(
        scene,
        points,
        5000,
        0.01,
        "#48cae4",
        handleWireComplete,
        true,
        1.0,
        0.02
      )
    );


    activeWireGlows.forEach((glow) => glow.start());
  }

  function checkCircuitPlacement() {
    const placedObjects = Array.from(occupiedPositions.entries());

    if (placedObjects.length !== Object.keys(targetMap).length) {
      return false;
    }

    const wrongPlacements = placedObjects.some(([position, object]) => {
      const correctPosition = targetMap[object.name];
      if (!correctPosition) return true; // Object shouldn't be here

      return position.distanceTo(correctPosition) >= 0.05;
    });

    return !wrongPlacements;
  }

  function allObjectsPlaced() {
    console.log("Checking circuit completion...");
    if (occupiedPositions.size === 0) {
      return;
    }
    const isCircuitCorrect = checkCircuitPlacement();
    if (isCircuitCorrect) {
      console.log("All components placed correctly.");
      scene.remove(meshUIPanels.circControlButtonContainer);
      wireGlowEffect(() => {
        disposeWireGlow();
        playAudio("electroCorrectCircuit");
      });
      if (!physicsSet) {
        scene.remove(gatePlane);
        removeCollider("gatePlane");
        physicsSet = true;
      }
    } else if (occupiedPositions.size === Object.keys(targetMap).length) {
      stopAudio("electroCorrectCircuit");
      playAudio("electroWrongCircuit");
      console.log("Circuit assembled incorrectly");
    }
  }

  function disposeWireGlow() {
    activeWireGlows.forEach((glow) => {
      if (glow && typeof glow.dispose === "function") {
        glow.dispose();
      }
    });
    activeWireGlows.length = 0;
  }

  function infoPanel() {
    meshUIPanels.infoMainPanel.visible = true;
    meshUIPanels.controlButtonContainer.visible = true;
    meshUIPanels.panelIndex = 0;
    meshUIPanels.updatePanel(meshUIPanels.panelIndex);
    introBatteryModel.visible = true;
    ledModel.visible = true;
    capacitorModel.visible = true;
    introMotorModel.visible = true;
    resistorModel.visible = true;
    ubecModel.visible = true;
    powerDistributorModel.visible = true;
    buzzerModel.visible = true;
    buttonModel.visible = true;
    motorDriverModel.visible = true;
  }

  infoZoneTrigger = TriggerPoint(
    allAssets.vfxs.zone,
    { x: -3.75, y: -1.8, z: -3.0 },
    scene,
    { x: 0.6, y: 0.6, z: 0.6 },
    () => {
      disablePlayerControls();
      console.log("callback triggered");
      switchCameraFocus();
      infoPanel();
    },
    true
  );

  warningZoneTrigger1 = TriggerPoint(
    allAssets.vfxs.circuitPuzzleZone,
    { x: -27.0, y: -2.0, z: 0.4 },
    scene,
    { x: 1.1, y: 1.1, z: 1.1 },
    () => {
      if (!introCompleted) playAudio("electroCaution1");
    }
  );

  sceneSwitchTrigger = TriggerPoint(
    allAssets.vfxs.circuitPuzzleZone,
    { x: -29.2, y: -2.0, z: 0.5 },
    scene,
    { x: 1.2, y: 1.2, z: 1.2 },
    () => {
      console.log("triggered");
      isSceneTransitioning = true;
      const session = renderer.xr.getSession();

      const transitionToNextScene = (isVR) => {
        // Ensure minimap is fully removed before entering scene5
        try {
          cleanupMinimap();
          const mm = document.getElementById('minimap-container');
          if (mm && mm.parentNode) mm.parentNode.removeChild(mm);
          const btn = document.getElementById('minimap-toggle');
          if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        } catch (_) {}
        markSceneCompleted("scene4");
        window.removeEventListener("keydown", handleKeyPress);
        if (sceneInitialization) {
          sceneInitialization.cleanUpCollider();
        }
        cleanupScene4();
        checkExistingAssets(nextEntry);
        initializeScene5(renderer, isVR).finally(() => {
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
    }
  );

  function hideCircuitItems() {
    meshUIPanels.backButton.setState("idle");
    currentCamera = camera;
    enablePlayerControls();
    controls.enabled = true;
    meshUIPanels.circuitPanel.visible = true;
    meshUIPanels.circControlButtonContainer.visible = false;
    introBatteryModel.visible = false;
    ledModel.visible = false;
    capacitorModel.visible = false;
    introMotorModel.visible = false;
    resistorModel.visible = false;
    ubecModel.visible = false;
    powerDistributorModel.visible = false;
    buzzerModel.visible = false;
    buttonModel.visible = false;
    motorDriverModel.visible = false;
    batteryModel.visible = false;
    dcMotorModel.visible = false;
    circPanel.visible = false;
    circuitLines.forEach((line) => (line.visible = false));
    planeCloneTracker.forEach((plane) => (plane.visible = false));
  }

  warningZoneTrigger1.setVFXVisible(false);
  sceneSwitchTrigger.setVFXVisible(false);

  panelData = [
    {
      text: "A rechargeable Li-ion battery is designed to deliver reliable performance in a compact AA cell form factor(this one here is a 9V battery in PP3 form factor), making it suitable for various applications requiring efficient power storage and delivery.",
      model: introBatteryModel,
      shouldClone: false,
      position: new THREE.Vector3(-5.25, -0.1, -8.0),
      rotation: new THREE.Vector3(0, 0, Math.PI / 2),
      scale: new THREE.Vector3(0.8, 0.8, 0.8),
    },
    {
      text: "The RGB Common Anode LED is a bright, efficient, and versatile lighting option for creative projects. Its low power use and compact size make it ideal for everything from simple indicators to colorful decorative setups. Easy to install and durable, it's a great choice for adding vibrant light to any design.",
      model: ledModel,
      shouldClone: true,
      position: new THREE.Vector3(-5.25, -0.5, -8.0),
      scale: new THREE.Vector3(0.6, 0.6, 0.6),
    },
    {
      text: "The capacitor is a key passive component that stores and releases electrical energy. It charges and discharges quickly, making it useful for smoothing voltage, filtering signals, and timing tasks. Commonly found in power supplies, audio systems, and oscillators, it is essential in many electronic circuits.",
      model: capacitorModel,
      shouldClone: true,
      rotation: new THREE.Vector3(0, 0, Math.PI / 2),
    },
    {
      text: "The DC motor converts electrical energy into mechanical motion using electromagnetic force. With parts like a rotor and stator, it spins when current flows through its windings. Compact and reliable, it is widely used in robotics, fans, and other systems needing controlled motion.",
      model: introMotorModel,
      shouldClone: false,
      position: new THREE.Vector3(-4.95, -0.15, -7.0),
      rotation: new THREE.Vector3(0, Math.PI / 2, 0),
      scale: new THREE.Vector3(0.7, 0.7, 0.7),
    },
    {
      text: "Fixed-value resistors are essential components that limit current and drop voltage in a circuit. They help protect components, set operating points, and shape signals. Found in nearly all electronics, they are key in power control, LED circuits, filters, and logic systems.",
      model: resistorModel,
      shouldClone: true,
      position: new THREE.Vector3(-4.96, -0.17, -7.0),
    },
    {
      text: "The UBEC (Universal Battery Elimination Circuit) is a compact voltage regulator that supplies stable, lower voltage from higher-voltage batteries. It is commonly used in RC models and robotics to safely power controllers, sensors, and receivers. With high efficiency and built-in protection, a UBEC ensures your devices get consistent power without overloading.",
      model: ubecModel,
      shouldClone: false,
      position: new THREE.Vector3(-4.96, -0.14, -7.0),
      scale: new THREE.Vector3(0.008, 0.008, 0.008),
    },
    {
      text: "The Power Distributor splits power from a single source to multiple components. It ensures stable voltage delivery across circuits and prevents overloads.",
      model: powerDistributorModel,
      shouldClone: false,
      position: new THREE.Vector3(-4.96, -0.14, -7.0),
      scale: new THREE.Vector3(0.005, 0.005, 0.005),
    },
    {
      text: "The Motor Driver is an electronic component that controls the speed and direction of a DC motor. It receives signals from a microcontroller and adjusts the power supplied to the motor, allowing for precise control in robotics and automation.",
      model: motorDriverModel,
      shouldClone: false,
      position: new THREE.Vector3(-4.96, -0.14, -7.0),
      scale: new THREE.Vector3(0.005, 0.005, 0.005),
    },
    {
      text: "A buzzer is an electronic device that produces sound when an electric current passes through it. It is commonly used in alarms, timers, and notification systems to alert users with audible signals.",
      model: buzzerModel,
      shouldClone: false,
      position: new THREE.Vector3(-4.96, -0.1, -7.0),
      scale: new THREE.Vector3(0.008, 0.008, 0.008),
    },
    {
      text: "A button is a simple mechanical or electronic switch that allows users to control devices by pressing it. It can be used to start, stop, or change the state of an electronic circuit, making it a fundamental component in user interfaces.",
      model: buttonModel,
      shouldClone: false,
      position: new THREE.Vector3(-4.96, -0.14, -7.0),
      scale: new THREE.Vector3(0.005, 0.005, 0.005),
    },
  ];

  meshUIPanels = new MeshUIPanels(
    scene,
    panelData,
    circuitSolution,
    hideCircuitItems,
    showSceneObjective
  );
  objsToTest = meshUIPanels.getObjsToTest();

  questionnairePanel = new QuestionnaireUI(
    scene,
    { x: -3.75, y: 0.5, z: 8.8 },
    { x: 0, y: Math.PI, z: 0 }
  );
  questionnairePanel.hide();

  function switchCameraFocus() {
    console.log("Switching to Electro Focus");
    viewCam.position.set(-3.75, 0, -2);
    viewCam.lookAt(-3.75, 0, -15);
    disablePlayerControls();
    currentCamera = viewCam;
    controls.enabled = false;
    introCompleted = true;
    hideObjective();
    if (allAssets.audios?.walk) {
      let walkSound = allAssets.audios.walk;
      if (walkSound.isPlaying) walkSound.stop();
    }
    if (allAssets.audios?.run) {
      let runSound = allAssets.audios.run;
      if (runSound.isPlaying) runSound.stop();
    }
  }

  function switchToElectro() {
    disablePlayerControls();
    currentCamera = electroExplaination;
    electroExplaination.position.set(-24.0, -0.5, 0.0);
    electroExplaination.lookAt(electro.position);
    electroExplaination.rotation.set(0, Math.PI / 2, 0);
  }

  function switchToIntroRoom() {
    currentCamera = introRoomCam;
    introRoomCam.position.set(-8.0, 0.0, 0.0);
    introRoomCam.rotation.set(0, (11 * Math.PI) / 6, 0);
    electro.position.set(-26.5, -2.0, -2.0);
    electro.rotation.set(0, Math.PI / 2, 0);
    electroShapekey?.stopAnimation();
    showSceneObjective(1);
    scene.remove(dTwinPlane);
    setTimeout(() => {
      currentCamera = camera;
      enablePlayerControls();
      createMinimap(scene, sceneInitialization);
    }, 5000);
  }

  function switchToCircuitCam() {
    console.log("Switching to Circuit Cam");
    circuitCam.position.set(-3.75, 0.5, 5.7);
    if (isQuizSubmitted) {
      circuitCam.lookAt(-3.76, -1.0, 7.675);
      questionnairePanel.hide();
    } else {
      circuitCam.rotation.set(0, Math.PI, 0);
      isPanelLoading = true; // Set flag to block clicks
      questionnairePanel.loadQuestions();
      // Reset flag after a short delay to allow panel to load
      setTimeout(() => {
        isPanelLoading = false;
        console.log("Panel loading complete, clicks enabled");
      }, 500); // 500ms delay to prevent immediate click
    }
    currentCamera = circuitCam;
    controls.enabled = false;
    disablePlayerControls();
    hideObjective();
  }

  function switchtoGateViewCam() {
    console.log("Switching to Gate View Cam");
    gateViewCam.position.set(-20, 2, 0);
    gateViewCam.lookAt(-50, 0, 0);
    currentCamera = gateViewCam;
    controls.enabled = false;
    disablePlayerControls();
    [meshUIPanels.button, meshUIPanels.circBackButton].forEach((uiElement) => {
      if (uiElement) {
        uiElement.traverse((child) => {
          if (child.userData) {
            child.userData.clickable = false;
            child.userData.parentButton = null;
          }
        });
        if (uiElement.parent) {
          uiElement.parent.remove(uiElement);
        }
        uiElement.setState("idle");
      }
    });
    [
      meshUIPanels.circControlButtonContainer,
      meshUIPanels.circuitPanel,
    ].forEach((container) => {
      if (container && container.parent) {
        container.parent.remove(container);
      }
    });
    scene.remove(circPanel);
    scene.remove(batteryModel);
    scene.remove(ledModel);
    scene.remove(capacitorModel);
    scene.remove(resistorModel);
    scene.remove(dcMotorModel);
    scene.remove(ubecModel);
    scene.remove(powerDistributorModel);
    scene.remove(buzzerModel);
    scene.remove(buttonModel);
    scene.remove(motorDriverModel);
    scene.remove(lockPlane);
    scene.remove(pointLight);
    circuitLines.forEach((line) => {
      scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    });
    circuitLines.length = 0;
    showSceneObjective(3);
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 1;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2;

  sceneInitialization = initializePhysicsAndPlayer(
    mainModel,
    {
      position: { x: 0, y: -2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    },
    [
      "portal_physics",
      "circPanel",
      "batteryModel",
      "ledModel",
      "capacitorModel",
      "resistorModel",
      "dcMotorModel",
      "Cube005",
      "table",
      "lockPlane",
    ],
    scene,
    camera,
    controls
  );

  function gateAnims() {
    if (!gateMesh) return;

    // Ensure material supports transparency
    if (Array.isArray(gateMesh.material)) {
      gateMesh.material.forEach((mat) => {
        mat.transparent = true;
      });
    } else {
      gateMesh.material.transparent = true;
    }

    gsap.to(customShaderMaterial.uniforms.uOpacity, {
      value: 0,
      duration: 2,
      ease: "power2.out",
      onComplete: () => {
        gateMesh.geometry.dispose();
        gateMesh.material.dispose();
        gateMesh.parent.remove(gateMesh);
        console.log("Gate removed from scene.");
        currentCamera = camera;
        controls.enabled = true;
        enablePlayerControls();
      },
    });
  }

  pointerDownHandler = () => {
    selectState = true;
    meshUIPanels.setSelectState(true);
  };

  pointerUpHandler = () => {
    selectState = false;
    meshUIPanels.setSelectState(false);
  };

  mouseMoveHandler = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    if (currentCamera == circuitCam && questionnairePanel) {
      questionnairePanel.updateHoverStates(mouse, currentCamera);
    }
  };

  const clickHandler = () => {
    if (currentCamera !== circuitCam || !questionnairePanel || isPanelLoading)
      return; // Block clicks during panel load
    questionnairePanel.raycaster.setFromCamera(mouse, currentCamera);
    const isQuestionnaireActive = questionnairePanel.panel?.visible;
    const isSummaryActive = questionnairePanel.summaryPanel?.visible;
    if (!isQuestionnaireActive && !isSummaryActive) return;
    const blocks = isQuestionnaireActive
      ? questionnairePanel.interactableBlocks
      : questionnairePanel.interactableBlocksSummary;
    const intersects = questionnairePanel.raycaster.intersectObjects(
      blocks,
      true
    );
    if (intersects.length === 0) return;
    const selectedBlock = questionnairePanel.findParentBlock(
      intersects[0].object
    );
    if (!selectedBlock) return;
    if (isQuestionnaireActive && !selectedBlock.userData.locked) {
      const selectedIndex = selectedBlock.userData.index;
      questionnairePanel.handleOptionSelect(selectedIndex);
      setTimeout(() => {
        const hasNextQuestion = questionnairePanel.getNextQuestion();
        if (!hasNextQuestion) {
          console.log("Quiz completed!");
          questionnairePanel.hide();
          questionnairePanel.setupSummaryPanel();
          questionnairePanel.showSummary();
        }
      }, 1000);
    } else if (isSummaryActive) {
      const buttonType = selectedBlock.userData.type;
      if (buttonType === "submit") {
        circuitCam.lookAt(-3.76, -1.0, 7.675);
        isQuizSubmitted = true;
        questionnairePanel.hideSummary();
        window.dispatchEvent(new CustomEvent("quizSubmitted"));
        console.log("Quiz submitted!");
      } else if (buttonType === "rewatch") {
        currentCamera = camera;
        hideCircuitItems();
        showSceneObjective(4);
        questionnairePanel.hideSummary();
      }
    }
  };

  windowResizeHandler = resizeHandler;

  window.addEventListener("loadingScreenHidden-scene4", () => {
    console.log("Loading screen hidden - Scene4 is ready!");
  
    // --- Add this block ---
    if (!skipButtonInitialized) {
      createSkipButton(skipIntroSequence);
      skipButtonInitialized = true;
    }
    showSkipButton();
    isSequenceSkipped = false; // Start sequence
    // --- End of block ---
  
    disablePlayerControls();
    currentCamera = electroViewCam;
    wakeup.play();
    playAudio("electroFirstAudio");
  });
  window.addEventListener("audioComplete-electroFirstAudio", () => {
    if (isSequenceSkipped) return;
    stopAudio("electroFirstAudio");

    setTimeout(() => {
      if (isSequenceSkipped) return;
      const audio = allAssets.audios.eIntroFinal;
      const startTime = audio.context.currentTime;
      playAudio("eIntroFinal");

      const checkAudioTime = setInterval(() => {
        if (isSequenceSkipped) { // <<<--- ADD THIS BLOCK
          clearInterval(checkAudioTime);
          pauseAudio("eIntroFinal");
          return;
        }
        const playbackTime = audio.context.currentTime - startTime;
        if (playbackTime >= 7) {
          pauseAudio("eIntroFinal");
          clearInterval(checkAudioTime);
          electroReach.setLoop(THREE.LoopOnce);
          electroReach.clampWhenFinished = true;
          electroReach.reset();
          electroReach.timeScale = 1;

          electroReach
            .getMixer()
            .addEventListener("finished", onReachForwardFinished);
          electroReach.play();
        }
      }, 100);
    }, 2000);

    electro.position.set(-26.5, -2.0, 0);
    wakeup.stop();
    electroShapekey?.startAnimation();
    electroIdle.play();
    switchToElectro();
  });

  window.addEventListener("audioComplete-eIntroFinal", () => {
    if (isSequenceSkipped) return;
    stopAudio("eIntroFinal");

    electroExplain.stop();
    if (keyPadPlane) {
      keyPadPlane.material.opacity = 1;
      keyPadPlane.material.needsUpdate = true;
      scene.add(keyPadPlane);
    } else {
      console.warn("keyPadPlane not initialized");
    }

    if (zoePlane && zoeTex && zoeVideo) {
      zoePlane.material.uniforms.videoTexture.value = zoeTex;
      zoePlane.material.opacity = 1;
      zoePlane.material.needsUpdate = true;
      scene.add(zoePlane);

      zoeVideo
        .play()
        .catch((err) => console.error("Failed to play zoe video:", err));
    } else {
      console.warn("zoePlane, zoeTex, or zoeVideo not initialized");
    }

    electroType.setLoop(THREE.LoopOnce);
    electroType.clampWhenFinished = true;
    electroType.reset().play();

    const initialPos = electroExplaination.position.clone();

    isMovingCameraToTarget = true;
    gsap.to(electroExplaination.position, {
      x: initialPos.x - 2,
      z: initialPos.z - 2,
      duration: 0.8,
      ease: "power2.inOut",
      onComplete: () => {
        isMovingCameraToTarget = false;
        electroExplaination.position.set(
          initialPos.x - 2,
          initialPos.y,
          initialPos.z - 2
        );
      },
    });

    electroMixer.addEventListener("finished", onTypeFinished);

    function onTypeFinished(event) {
      if (isSequenceSkipped) return;
      if (event.action === electroType) {
        electroMixer.removeEventListener("finished", onTypeFinished);
        electroIdle.reset().play();
        isMovingCameraBack = true;
        const tl = gsap.timeline();
        tl.to(electroExplaination.position, {
          x: -24.0,
          y: -0.5,
          z: 0.0,
          duration: 0.8,
          ease: "power2.inOut",
          onComplete: () => {
            gsap.to(electroExplaination.rotation, {
              y: (13 * Math.PI) / 18,
              duration: 2,
              ease: "power2.inOut",
            });
          },
        })
          .to(
            electro.rotation,
            { y: (7 * Math.PI) / 6, duration: 2, ease: "power2.inOut" },
            0.2
          )
          .call(() => {
            isMovingCameraBack = false;
            switchToElectro();
            if (keyPadPlane) {
              scene.remove(keyPadPlane);
            }
          });
      }
    }

    setTimeout(() => {
      playAudio("electroCall");
    }, 5000);
  });

  window.addEventListener("audioComplete-electroCall", () => {
    if (isSequenceSkipped) return;
    stopAudio("electroCall");
    setTimeout(() => {
      if (zoePlane) {
        zoePlane.material.opacity = 0;
        scene.remove(zoePlane);
        if (zoeVideo) {
          zoeVideo.pause();
        }
      }

      if (dTwinPlane && dTwinTex && dTwinVideo) {
        dTwinPlane.material.uniforms.videoTexture.value = dTwinTex;
        dTwinPlane.material.opacity = 1;
        dTwinPlane.material.needsUpdate = true;
        scene.add(dTwinPlane);

        dTwinVideo
          .play()
          .catch((err) => console.error("Failed to play dTwin video:", err));
      } else {
        console.warn("dTwinPlane, dTwinTex, or dTwinVideo not initialized");
      }

      const tl = gsap.timeline();
      tl.to(
        electroExplaination.rotation,
        { y: (5 * Math.PI) / 12, duration: 2, ease: "power2.inOut" },
        0.5
      ).to(
        electro.rotation,
        { y: (23 * Math.PI) / 12, duration: 2, ease: "power2.inOut" },
        0.7
      );

      playAudio("digiTwinConvo");
    }, 2000);
  });

  window.addEventListener("audioComplete-digiTwinConvo", () => {
    if (isSequenceSkipped) return;
    stopAudio("digiTwinConvo");
    playAudio("digiTwinEnd");
  });

  window.addEventListener("audioComplete-digiTwinEnd", () => {
    if (isSequenceSkipped) return; // Add the guard
    stopAudio("digiTwinEnd");
    
    // Call your new function which does all the cleanup
    jumpToIntroRoomState(); 
  });

  window.addEventListener("audioComplete-electroCorrectCircuit", () => {
    stopAudio("electroCorrectCircuit");
    playAudio("electroGateOpen");
  });

  window.addEventListener("keydown", handleKeyPress);
  window.addEventListener("mousedown", windowMouseDownHandler, false);
  window.addEventListener("pointerdown", pointerDownHandler);
  window.addEventListener("pointerup", pointerUpHandler);
  window.addEventListener("mousemove", mouseMoveHandler);
  window.addEventListener("click", clickHandler);
  window.addEventListener("resize", windowResizeHandler);

  function onReachForwardFinished(event) {
    if (isSequenceSkipped) return;
    if (event.action === electroReach) {
      electroReach
        .getMixer()
        .removeEventListener("finished", onReachForwardFinished);
      console.log("electroReach forward finished, time:", electroReach.time);

      const clipDuration = electroReach.getClip().duration;
      electroReach.time = clipDuration;
      electroReach.timeScale = -1;
      electroReach.setLoop(THREE.LoopOnce);
      electroReach.clampWhenFinished = true;
      electroReach.paused = false;
      console.log("Playing electroReach reverse, time:", electroReach.time);

      electroReach
        .getMixer()
        .addEventListener("finished", onReachReverseFinished);
      electroReach.play();
    }
  }

  function onReachReverseFinished(event) {
    if (isSequenceSkipped) return;
    if (event.action === electroReach) {
      electroReach
        .getMixer()
        .removeEventListener("finished", onReachReverseFinished);
      gsap.to(electro.rotation, {
        y: Math.PI / 2,
        duration: 2, // Reduced from 3s
        ease: "power2.inOut",
        onComplete: () => {
          playAudio("eIntroFinal");
          electroIdle.stop();
          electroExplain.play();
        },
      });

      electroIdle.reset().play();
    }
  }

  // Add lights
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  console.log(scene);

  let directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.castShadow = true;
  directionalLight.position.set(60, 55, 0);

  directionalLight.shadow.bias = -0.001;
  directionalLight.shadow.normalBias = 0.1;
  directionalLight.shadow.radius = 4;

  directionalLight1.shadow.bias = -0.001;
  directionalLight1.shadow.normalBias = 0.1;
  directionalLight1.shadow.radius = 4;

  let shadowCamera = directionalLight.shadow.camera;
  shadowCamera.near = 20 || 10;
  shadowCamera.far = 300 || 200;
  shadowCamera.left = -100 || -50;
  shadowCamera.right = 100 || 50;
  shadowCamera.top = 100 || 50;
  shadowCamera.bottom = -100 || -50;

  directionalLight.shadow.mapSize.width = 4096 || 2048;
  directionalLight.shadow.mapSize.height = 4096 || 2048;

  if (isVRMode) {
    const clickableObjects = [];

    initializeVR(
      renderer,
      scene,
      camera,
      sceneInitialization.playerFunction.player,
      sceneInitialization.playerFunction.actions, // Your player object
      clickableObjects,
      () => {
        // Callback for when VR controller button is pressed
        console.log("VR button clicked");
      }
    );

    // Store reference to collision mesh
    collisionMesh = allAssets.models.gltf.main;

    // Set collision mesh for VR
    setCollisionMesh(collisionMesh);

    // Enable player movement
    enablePlayerMovement(sceneInitialization.playerFunction.player);
  }
  function skipIntroSequence() {
    if (isSceneTransitioning || isSequenceSkipped) return; // Prevent double-skip
    console.log("Intro sequence skipped by user.");

    isSequenceSkipped = true; // Flag to stop all pending timeouts

    // 1. Kill all GSAP animations
    gsap.killTweensOf(electro.rotation);
    gsap.killTweensOf(electroExplaination.position);
    gsap.killTweensOf(electroExplaination.rotation);
    if (electroReach) gsap.killTweensOf(electroReach); 

    // 2. Stop all sequence audio
    stopAudio("electroFirstAudio");
    stopAudio("eIntroFinal");
    stopAudio("electroCall");
    stopAudio("digiTwinConvo");
    stopAudio("digiTwinEnd");

    // 3. Stop all animation mixer actions
    if (electroMixer) {
      electroMixer.stopAllAction();
    }
    [wakeup, headUp, electroIdle, electroType, electroExplain, electroReach].forEach(action => {
      if (action && action.isRunning()) {
        action.stop();
      }
    });
    
    // 4. Stop shape key animations
    if (electroShapekey) {
      electroShapekey.stopAnimation();
    }

    // 5. Hide skip button
    hideSkipButton();

    // 6. Jump to the final state
    jumpToIntroRoomState();
  }

  /**
   * Cleans up all sequence assets and switches camera to player.
   * This is the final state that skipIntroSequence() jumps to.
   */
/**
   * Cleans up all sequence assets and switches camera to player.
   * This is the final state that skipIntroSequence() jumps to.
   */
function jumpToIntroRoomState() {
  // This logic is copied from your 'audioComplete-digiTwinEnd'
  if (dTwinPlane && scene) {
    scene.remove(dTwinPlane);
    if (dTwinPlane.geometry) dTwinPlane.geometry.dispose();
    if (dTwinPlane.material.uniforms?.videoTexture?.value) {
      dTwinPlane.material.uniforms.videoTexture.value.dispose();
    }
    dTwinPlane.material.dispose();
    dTwinPlane = null;
  }
  if (dTwinVideo && dTwinVideo.parentNode) {
    dTwinVideo.pause(); dTwinVideo.src = "";
    dTwinVideo.parentNode.removeChild(dTwinVideo);
    dTwinVideo = null;
  }
  window.dTwinVideoElement = null;
  window.dTwinVideoTexture = null;

  if (zoePlane && scene) {
    scene.remove(zoePlane);
    if (zoePlane.geometry) zoePlane.geometry.dispose();
    if (zoePlane.material.uniforms?.videoTexture?.value) {
      zoePlane.material.uniforms.videoTexture.value.dispose();
    }
    zoePlane.material.dispose();
    zoePlane = null;
  }
  if (zoeVideo && zoeVideo.parentNode) {
    zoeVideo.pause(); zoeVideo.src = "";
    zoeVideo.parentNode.removeChild(zoeVideo);
    zoeVideo = null;
  }
  window.zoeVideoElement = null;
  window.zoeVideoTexture = null;

  // Remove all sequence-specific objects
  scene.remove(
    keyPadPlane,
    electroExplaination,
    electroViewCam,
    introRoomCam
  );
  
  // --- NEW LOGIC TO SET FINAL PLAYER-READY STATE ---

  // 1. Set Electro's final position and rotation
  electro.position.set(-26.5, -2.0, -2.0);
  electro.rotation.set(0, Math.PI / 2, 0);

  // 2. Stop sequence animations
  if (electroShapekey) {
      electroShapekey.stopAnimation();
  }
  if (electroMixer) {
      electroMixer.stopAllAction();
  }
  
  // 3. FORCE PLAY the idle animation
  if (electroIdle) {
      electroIdle.reset().play();
  }

  // 4. Give control back to the player immediately
  currentCamera = camera;
  enablePlayerControls();
  createMinimap(scene, sceneInitialization);
  showSceneObjective(1);
  
  // --- END OF NEW LOGIC ---

  // Final cleanup
  hideSkipButton();
  isSequenceSkipped = true; // Ensure it stays skipped
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
    // Check if camera exists before rendering
    if (!camera || !currentCamera) {
      return;
    }

    if (isMovingCameraToTarget || isMovingCameraBack) {
      electroExplaination.lookAt(-26.5, -2.0, 0);
      // console.log(
      //   "Camera looking at fixed position:",
      //   electroExplaination.getWorldDirection(new THREE.Vector3())
      // );
    }

    if (
      currentCamera !== circuitCam ||
      isQuizSubmitted ||
      questionnairePanel.summaryPanel?.visible
    ) {
      questionnairePanel.hide();
    } else {
      questionnairePanel.show();
    }

    // Only begin stats if it exists
    // if (stats) {
    //   stats.begin();
    // }

    updateMinimap();
    meshUIPanels.updateButtons(mouse, currentCamera, renderer);
    meshUIPanels.updateButtons(mouse, currentCamera, renderer);
    ThreeMeshUI.update();
    let delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    customShaderMaterial.uniforms.uTime.value = elapsedTime;
    electroMixer.update(delta);
    meshUIPanels.updateAnimation(elapsedTime);
    // Get the player reference from sceneInitialization
    const player = sceneInitialization?.playerFunction?.player;

    if (currentModel) {
      currentModel.renderOrder = 2;
      let bobHeight = 0.05 * Math.sin(elapsedTime * 2);
      currentModel.position.y = currentModel.userData.baseY + bobHeight;
      currentModel.rotation.y += 0.01;
    }
    lockPlane.renderOrder = 1;

    if (currentCamera == circuitCam || currentCamera == viewCam) {
      player.visible = false;
    } else {
      player.visible = true;
    }

    applyDistanceFade(lockPlane, player, 2.5, 3.5);

    if (introCompleted) {
      scene.remove(lockPlane);
      // clickableObjects.push(button);
      // objsToTest = meshUIPanels.getObjsToTest();
      if (!objsToTest.includes(meshUIPanels.button) && !addedToScene) {
        objsToTest.push(meshUIPanels.button);
        addedToScene = true;
      }
    }

    // Update triggers with player reference
    if (infoZoneTrigger && player) {
      infoZoneTrigger.updateQuarksScene(delta, player);
    }
    if (warningZoneTrigger1 && player) {
      warningZoneTrigger1.updateQuarksScene(delta, player);
    }
    if (sceneSwitchTrigger && player) {
      sceneSwitchTrigger.updateQuarksScene(delta, player);
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

    if (sceneInitialization?.playerFunction?.player) {
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

    renderer.render(scene, currentCamera);

    // Only end stats if it exists
    // if (stats) {
    //   stats.end();
    // }
  }

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

  return { scene, camera, renderer, controls };
}

export function cleanupScene4() {
  /**
   * Cleanup Scene 4.
   *
   * Key teardown steps:
   * - Stop audio + mark the intro sequence as skipped to halt pending callbacks.
   * - Remove global listeners (keyboard, pointer/mouse, resize, audioComplete).
   * - Dispose video elements/textures, Three.js geometries/materials, and UI panels.
   * - Cleanup helper modules (minimap, objectives, VR, drag controls).
   *
   * This function is designed to be defensive: it tolerates partial initialization
   * and attempts to avoid "zombie" callbacks after scene switching.
   */
  // --- Add this block at the top ---
  isSequenceSkipped = true; // Set flag to stop any pending callbacks
  hideSkipButton();
  
  // Stop all sequence audio
  stopAudio("electroFirstAudio");
  stopAudio("eIntroFinal");
  stopAudio("electroCall");
  stopAudio("digiTwinConvo");
  stopAudio("digiTwinEnd");
  // --- End of block ---

  // Reset scene transition flag
  isSceneTransitioning = false;
  // Reset scene transition flag
  isSceneTransitioning = false;

  // Stop and clean up background music
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
    backgroundAudio = null;
  }

  // Clean up audio and common systems
  cleanupAudioManager();
  cleanupObjectives();
  cleanupMinimap();
  cleanupGUIControls();

  // Clean up GUI mesh
  if (guiMesh) {
    if (guiMesh.geometry) guiMesh.geometry.dispose();
    if (guiMesh.material) guiMesh.material.dispose();
    guiMesh = null;
  }

  // Clean up stats
  // if (stats) {
  //   stats.dom.remove();
  //   stats = null;
  // }

  // Remove event listeners
  window.removeEventListener("resize", windowResizeHandler);
  window.removeEventListener("keydown", handleKeyPress);
  window.removeEventListener("mousedown", windowMouseDownHandler);
  window.removeEventListener("pointerdown", pointerDownHandler);
  window.removeEventListener("pointerup", pointerUpHandler);
  window.removeEventListener("mousemove", mouseMoveHandler);
  window.removeEventListener("loadingScreenHidden-scene4", null);
  window.removeEventListener("audioComplete-electroFirstAudio", null);
  window.removeEventListener("audioComplete-eIntroFinal", null);
  window.removeEventListener("audioComplete-electroCall", null);
  window.removeEventListener("audioComplete-digiTwinConvo", null);
  window.removeEventListener("audioComplete-digiTwinEnd", null);

  // Reset event handler references
  windowResizeHandler = null;
  windowMouseDownHandler = null;
  pointerDownHandler = null;
  pointerUpHandler = null;
  mouseMoveHandler = null;

  // Clean up drag controls
  cleanupDragControls();

  // Cancel animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Stop renderer animation loop
  if (renderer) {
    renderer.setAnimationLoop(null);
  }

  // Clean up VR and player systems
  cleanupVR();
  if (sceneInitialization) {
    sceneInitialization.cleanUpCollider();
    sceneInitialization = null;
  }

  // Clean up trigger points
  [infoZoneTrigger, warningZoneTrigger1, sceneSwitchTrigger].forEach(
    (trigger) => {
      if (trigger) {
        trigger.removeParticleEffects();
        trigger = null;
      }
    }
  );

  // Clean up video textures and video element
  if (dTwinVideo && dTwinVideo.parentNode) {
    dTwinVideo.pause();
    dTwinVideo.src = "";
    dTwinVideo.parentNode.removeChild(dTwinVideo);
    dTwinVideo = null;
    console.log("dTwinVideo removed from DOM");
  }
  if (dTwinTex) {
    dTwinTex.dispose();
    dTwinTex = null;
    console.log("dTwinTex disposed");
  }
  window.dTwinVideoElement = null;
  window.dTwinVideoTexture = null;

  // Clean up zoePlane and dTwinPlane
  [zoePlane, dTwinPlane].forEach((plane) => {
    if (plane && scene) {
      scene.remove(plane);
      if (plane.geometry) plane.geometry.dispose();
      if (plane.material) {
        if (plane.material.uniforms?.videoTexture?.value) {
          plane.material.uniforms.videoTexture.value.dispose();
        }
        plane.material.dispose();
      }
      plane = null;
      console.log("Plane removed and disposed");
    }
  });

  // Clean up textures
  [
    baseColorTex,
    portalTex,
    alphaTex,
    lockTex,
    batteryTex,
    capacitorTex,
    ledTex,
    motorTex,
    resistorTex,
    keyBoardTex,
  ].forEach((texture) => {
    if (texture) {
      texture.dispose();
      texture = null;
    }
  });
  planeTextures.length = 0;

  // Clean up circuit lines
  circuitLines.forEach((line) => {
    if (line) {
      scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    }
  });
  circuitLines.length = 0;

  // Clean up plane clones and materials
  planeCloneTracker.forEach((plane) => {
    if (plane) {
      scene.remove(plane);
      if (plane.geometry) plane.geometry.dispose();
      if (plane.material) plane.material.dispose();
    }
  });
  planeCloneTracker.length = 0;
  planeMaterialTracker.forEach((material) => {
    if (material) material.dispose();
  });
  planeMaterialTracker.length = 0;

  // Clean up fake glow material
  if (fakeGlowMaterial) {
    fakeGlowMaterial.dispose();
    fakeGlowMaterial = null;
  }

  // Clean up gate mesh
  if (gateMesh) {
    if (gateMesh.material) {
      if (Array.isArray(gateMesh.material)) {
        gateMesh.material.forEach((m) => m.dispose());
      } else {
        gateMesh.material.dispose();
      }
    }
    if (gateMesh.geometry) gateMesh.geometry.dispose();
    gateMesh = null;
  }

  // Clean up UI elements
  [
    circuitPanel,
    button,
    prevButton,
    nextButton,
    backButton,
    circBackButton,
    infoMainPanel,
    controlButtonContainer,
    circControlButtonContainer,
    contentBlock,
    leftSubBlock,
    rightSubBlock,
    keyPadPlane,
    circPanel,
    gatePlane,
    lockPlane,
  ].forEach((element) => {
    if (element) {
      if (element.parent) element.parent.remove(element);
      if (element.geometry) element.geometry.dispose();
      if (element.material) {
        if (Array.isArray(element.material)) {
          element.material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (element.material.map) element.material.map.dispose();
          element.material.dispose();
        }
      }
      element = null;
    }
  });

  // Clean up models
  [
    mainModel,
    batteryModel,
    introBatteryModel,
    ledModel,
    capacitorModel,
    resistorModel,
    dcMotorModel,
    introMotorModel,
    ubecModel,
    powerDistributorModel,
    buzzerModel,
    buttonModel,
    motorDriverModel,
    electro,
    ledGlowClone,
  ].forEach((model) => {
    if (model) {
      scene.remove(model);
      model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                if (m.map) m.map.dispose();
                m.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      });
      model = null;
    }
  });

  // Clean up questionnaire panel
  if (questionnairePanel) {
    questionnairePanel.cleanup(); // Assuming QuestionnaireUI has a cleanup method
    questionnairePanel = null;
  }

  // Clean up MeshUI panels
  if (meshUIPanels) {
    meshUIPanels.cleanup();
    meshUIPanels = null;
  }

  // Clean up electro shape key animations
  if (electroShapekey) {
    electroShapekey.stopAnimation();
    electroShapekey = null;
  }

  // Clean up electro mixer
  if (electroMixer) {
    electroMixer.stopAllAction();
    electroMixer = null;
  }
  [
    wakeup,
    headUp,
    electroIdle,
    electroType,
    electroExplain,
    electroReach,
  ].forEach((action) => {
    if (action) {
      action.stop();
      action = null;
    }
  });



  // Clean up lights
  [pointLight, directionalLight1].forEach((light) => {
    if (light) {
      scene.remove(light);
      light.dispose();
      light = null;
    }
  });

  // Clean up scene environment and background
  if (scene) {
    scene.environment = null;
    scene.background = null;

    // Remove all objects
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }

    // Dispose of remaining geometries and materials
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });

    scene = null;
  }

  // Clean up cameras
  [
    camera,
    circuitCam,
    gateViewCam,
    electroViewCam,
    electroExplaination,
    introRoomCam,
    viewCam,
  ].forEach((cam) => {
    if (cam) {
      cam.clear();
      cam = null;
    }
  });
  currentCamera = null;

  // Clean up controls
  if (controls) {
    controls.dispose();
    controls = null;
  }

  // Clean up arrays and maps
  activeWireGlows = [];
  circuitLines = [];
  objsToTest = [];
  connections = [];
  wireGlowPoints = [];
  planeTextures = [];
  planeCloneTracker = [];
  planeMaterialTracker = [];
  objectToPlaneMap = {};
  occupiedPositions.clear();

  // Reset variables
  clock = null;
  panelIndex = 0;
  mouse.set(0, 0);
  raycaster = null;
  currentModel = null;
  buttonHandled = false;
  selectState = false;
  introCompleted = false;
  physicsSet = false;
  isQuizSubmitted = false;
  addedToScene = false;
  isMovingCameraBack = false;
  isMovingCameraToTarget = false;
  isPanelLoading = false;

  console.log("Scene 4 cleanup completed");
}

