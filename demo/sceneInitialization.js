/**
 * Scene Initialization
 *
 * This is the basic scene initialization code. Copy this code, rename the main export function, and paste it into your scene folder.
 *
 * Example:
 * If the export function name is `initializeScene`, you should add a number to indicate the scene order:
 * `initializeScene1`, `initializeScene2`, `initializeScene3`, etc.
 *
 * **Configuration Steps:**
 * 1. Pass the scene name to the `setCurrentScene` function.
 * 2. The export function **must be an async function**.
 * 3. Load the `LoadAllAssets` function **only after initializing the camera**, and pass the scene's `assetsEntry` to `LoadAllAssets`.
 * 4. Once all assets in `assetsEntry` are fully loaded, you can initialize your models, audios, textures, or any other resources.
 * 5. **Before switching to the next scene**, ensure that all scene data is cleaned up.
 * 6. Call the `checkExistingAssets` function from the `assetsLoader` and pass the next scene's `assetsEntry` file to it.
 * 7. You can now safely switch to the next scene.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { allAssets, loadAllAsset } from "../commonFiles/assetsLoader";
import { assetesEntry as currentEntry } from "./assestsEntry";
import { initializePhysicsAndPlayer } from "../commonFiles/initializePhysicsAndPlayer";
import { setCurrentScene } from "../data";
import Stats from "three/examples/jsm/libs/stats.module.js";
import GUI from "lil-gui";
import gsap from "gsap";

let scene, camera, renderer, controls;
const gui = new GUI();

export async function initializeScene(existingRenderer, isVRMode) {
  //Assigning current scene to scene1
  setCurrentScene("scene1");

  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom);

  // Cancel any existing animation frame
  if (window.animationFrameId) {
    cancelAnimationFrame(window.animationFrameId);
    window.animationFrameId = null;
  }

  // Setup camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 1.6);

  await loadAllAsset(currentEntry, camera);
  console.log(allAssets);

  scene = new THREE.Scene();

  // Use existing renderer
  renderer = existingRenderer;

  // Reset renderer state
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.physicallyCorrectLights = true;
  // Make sure renderer is in the document
  if (!renderer.domElement.parentElement) {
    document.body.appendChild(renderer.domElement);
  }
  controls = new OrbitControls(camera, renderer.domElement);
  // controls.minDistance = 1;
  // controls.dampingFactor = 0.05;
  // controls.maxPolarAngle = Math.PI / 2;
  const sceneInitialization = initializePhysicsAndPlayer(
    allAssets.models.gltf.garden_cave,
    {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    },
    [],
    scene,
    camera,
    controls
  );

  // Add lights
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  let directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.castShadow = true;
  directionalLight.position.set(60, 55, 0);

  directionalLight.shadow.bias = -0.001;
  directionalLight.shadow.normalBias = 0.1;
  directionalLight.shadow.radius = 4;

  const shadowCamera = directionalLight.shadow.camera;
  shadowCamera.near = 20 || 10;
  shadowCamera.far = 300 || 200;
  shadowCamera.left = -100 || -50;
  shadowCamera.right = 100 || 50;
  shadowCamera.top = 100 || 50;
  shadowCamera.bottom = -100 || -50;

  directionalLight.shadow.mapSize.width = 4096 || 2048;
  directionalLight.shadow.mapSize.height = 4096 || 2048;

  scene.add(directionalLight);

  // Animation loop
  const clock = new THREE.Clock();

  function animate() {
    stats.begin();
    const delta = clock.getDelta();
    window.animationFrameId = requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
    stats.end();
  }

  animate();

  window.addEventListener("resize", onWindowResize, false);

  // Handle window resize
  function onWindowResize() {
    if (!camera) {
      console.error("Camera is not defined!");
      return;
    }

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return { scene, camera, renderer, controls };
}
