import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { holographicGlobeShader } from "./holographicGlobeShader.js";
import { showMeshUIPanel, hideMeshUIPanel, getMeshUIPanel } from "./uiManager.js";
import {
  nanoMeshInfo,
  buckMeshInfo,
  motordriverMeshInfo,
  buttonMeshInfo,
  pcbMeshInfo,
  motorMeshInfo,
  rgbMeshInfo,
  buzzerMeshInfo,
  irMeshInfo,
  unoMeshInfo,
  ldrMeshInfo
} from "./meshData.js";

export const COMPONENT_KEYS = ['unoModel', 'nanoModel', 'ldrModel', 'irModel','buck','motordriverModel',"buttonModel","buzzerModel","pcbModel","rgbModel","motorModel"];
export let componentModels = {};
export let focusedComponentKey = null;
let glassPlane = null;
let focusLight = null;
const COMPONENT_ANIMATION_DURATION = 2.0;

export function initComponentModels() {
  COMPONENT_KEYS.forEach(key => {
    componentModels[key] = {
      model: null,
      orbitControls: null,
      outline: null,
      originalPosition: null,
      originalRotation: null,
      originalScale: null,
      isNearCamera: false,
      isAnimating: false,
      animationDirection: null,
      animationStartTime: 0,
      targetPosition: null,
      targetRotation: null,
      meshes: [],
      hoveredMesh: null,
      hoveredOutlineMesh: null,
      selectedMesh: null,
    };
  });
}

export function getFocusedComponentKey() {
  return focusedComponentKey;
}

export function setFocusedComponentKey(key) {
  focusedComponentKey = key;
}

export function setupComponents(scene, allAssets, renderer) {
  COMPONENT_KEYS.forEach((key, idx) => {
    const model = allAssets.models.gltf[key];
    if (model) {
      // Position models with some offset so they don't overlap
      const basePos = { unoModel: [-32, 1.1, 6.8], nanoModel: [-33, 1.2, 6.8], ldrModel: [-34, 1.2, 6.8], irModel: [-34.7, 1.2, 6.8],buck: [-31.2, 1.13, 6.8],motordriverModel: [-31.2, 1.13, 5.9],buttonModel: [-32, 1.13, 5.9],buzzerModel: [-32.6, 1.13, 5.9],pcbModel: [-33.3, 1.13, 5.9],rgbModel: [-34, 1.13, 5.9],motorModel: [-34.7, 1.13, 5.9] };
      const pos = basePos[key] || [-32 + idx * 2, 1.1, 7];
      model.position.set(...pos);
      model.scale.set(0.004, 0.004, 0.004);
      model.rotation.set(0, 0, 0);
      scene.add(model);
      componentModels[key].model = model;
      // Collect meshes for raycasting
      componentModels[key].meshes = [];
      model.traverse(obj => {
        if (obj.isMesh && (
          // TEMP: For nano, allow ALL meshes for debugging
          key !== 'nano' || true // nano: allow all
        )) {
          componentModels[key].meshes.push(obj);
        }
        // --- Set material properties for all child meshes ---
        if (obj.isMesh && obj.material) {
          // If material is an array, set for each
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => {
              mat.transparent = true;
              mat.depthWrite = true;
              mat.depthTest = true;
              mat.alphaToCoverage = true;
              mat.premultipliedAlpha = true;
              mat.side = THREE.DoubleSide;
            });
          } else {
            obj.material.transparent = true;
            obj.material.depthWrite = true;
            obj.material.depthTest = true;
            obj.material.alphaToCoverage = true;
            obj.material.premultipliedAlpha = true;
            obj.material.side = THREE.DoubleSide;
          }
        }
        // --- Enable frustum culling for all meshes ---
        if (obj.isMesh) {
          obj.frustumCulled = true;
        }
      });

     
      // Create outline
      createComponentOutline(key);
      // Setup OrbitControls (disabled by default)
      componentModels[key].orbitControls = new OrbitControls(model, renderer.domElement);
      componentModels[key].orbitControls.enabled = false;
      componentModels[key].orbitControls.enablePan = false;
      componentModels[key].orbitControls.enableZoom = false;
      componentModels[key].orbitControls.enableDamping = true;
      componentModels[key].orbitControls.dampingFactor = 0.1;
      componentModels[key].orbitControls.rotateSpeed = 0.7;
    }
  });
}

export function createComponentOutline(key) {
  const comp = componentModels[key];
  if (!comp.model) return;
  comp.model.traverse(child => {
    if (child.isMesh) {
      const geometry = child.geometry.clone();
      const scale = 1.01;
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        positions.setXYZ(
          i,
          positions.getX(i) * scale,
          positions.getY(i) * scale,
          positions.getZ(i) * scale
        );
      }
      positions.needsUpdate = true;
      const holographicMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          glowColor: { value: new THREE.Color(0x00ffff) },
          glowIntensity: { value: 1.5 },
          glowPower: { value: 2.0 },
          glowSpeed: { value: 2.0 }
        },
        vertexShader: holographicGlobeShader.vertexShader,
        fragmentShader: holographicGlobeShader.fragmentShader,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
      });
      const outlineMesh = new THREE.Mesh(geometry, holographicMaterial);
      outlineMesh.position.copy(child.position);
      outlineMesh.rotation.copy(child.rotation);
      outlineMesh.scale.copy(child.scale);
      comp.model.add(outlineMesh);
      if (!comp.outline) comp.outline = outlineMesh;
    }
  });
}

export function animateComponentToCamera(key, scene, camera, controls, isElectroSequencePlaying) {
  // Instantly set background to dark sci-fi color
  scene.background = new THREE.Color(0x000714);
  const comp = componentModels[key];
  if (!comp.model || comp.isAnimating) return;
  comp.isAnimating = true;
  comp.animationStartTime = performance.now();
  comp.animationDuration = COMPONENT_ANIMATION_DURATION;
  comp.animationDirection = 'toCamera';
  if (!comp.originalPosition) {
    comp.originalPosition = comp.model.position.clone();
    comp.originalRotation = comp.model.rotation.clone();
    comp.originalScale = comp.model.scale.clone();
  }
  // Define camera direction, position, and left vector
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const camPos = camera.getWorldPosition(new THREE.Vector3());
  const left = new THREE.Vector3(-1.0, 0, 0).applyQuaternion(camera.quaternion).normalize();
  // Use a single, small left offset for all models
  const offset = left.multiplyScalar(0.4); // All models: slight left
  comp.targetPosition = camPos.clone().add(camDir.multiplyScalar(0.9)).add(offset);
  // Target rotation: smoothly rotate to original + Math.PI on Y
  comp.targetRotation = new THREE.Euler(
    comp.originalRotation.x,
    comp.originalRotation.y - Math.PI,
    comp.originalRotation.z
  );
  if (comp.outline) comp.outline.visible = false;
  if (controls) controls.enabled = false;
  comp.orbitControls.enabled = true;
  const closeButton = document.getElementById('closeUnoButton');
  if (closeButton) closeButton.style.display = 'block';
  focusedComponentKey = key;
  // Return others to original if needed
  COMPONENT_KEYS.forEach(otherKey => {
    if (otherKey !== key && componentModels[otherKey].isNearCamera) {
      animateComponentToOriginal(otherKey, scene, controls, isElectroSequencePlaying);
    }
  });
  // Show mesh UI panel for the first mesh after animation completes
  setTimeout(() => {
    const comp = componentModels[key];
    if (comp.meshes && comp.meshes.length > 0) {
      showMeshUIPanel(comp.meshes[0], focusedComponentKey, scene, camera, componentModels);
    }
  }, 1000); // match animation duration
}

export function animateComponentToOriginal(key, scene, controls, isElectroSequencePlaying) {
  // Instantly restore background to default (null = skybox or transparent)
  const comp = componentModels[key];
  if (!comp.model || comp.isAnimating || !comp.originalPosition) return;
  comp.isAnimating = true;
  comp.animationStartTime = performance.now();
  comp.animationDuration = COMPONENT_ANIMATION_DURATION;
  comp.animationDirection = 'toOriginal';
  if (comp.outline) comp.outline.visible = true;
  comp.orbitControls.enabled = false;
  if (controls && !isElectroSequencePlaying) controls.enabled = true; // Assuming isComponentIntroSequencePlaying logic is handled by caller or passed in
  const closeButton = document.getElementById('closeUnoButton');
  if (closeButton) closeButton.style.display = 'none';
  focusedComponentKey = null;
  scene.background = null;
}

export function handleComponentClick(key, scene, camera, controls, isComponentIntroSequencePlaying, isElectroSequencePlaying) {
  if (isComponentIntroSequencePlaying) return;
  if (!componentModels[key].isNearCamera) {
    animateComponentToCamera(key, scene, camera, controls, isElectroSequencePlaying);
    // Show mesh UI panel for the first mesh after animation completes
    setTimeout(() => {
      const comp = componentModels[key];
      if (comp.meshes && comp.meshes.length > 0) {
        showMeshUIPanel(comp.meshes[0], focusedComponentKey, scene, camera, componentModels);
      }
    }, 1000); // match animation duration
  }
}

export function updateComponents(scene, camera, isElectroSequencePlaying) {
  COMPONENT_KEYS.forEach(key => {
    const comp = componentModels[key];
    if (comp.isAnimating && comp.model) {
      // Guard: skip animation if any required property is missing
      if (!comp.originalPosition || !comp.originalRotation || !comp.originalScale || !comp.targetPosition || !comp.targetRotation) return;
      const elapsed = (performance.now() - comp.animationStartTime) / 1000;
      const duration = comp.animationDuration || COMPONENT_ANIMATION_DURATION;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // cubic ease
      if (comp.animationDirection === 'toCamera') {
        comp.model.position.lerpVectors(comp.originalPosition, comp.targetPosition, easeProgress);
        comp.model.scale.lerpVectors(comp.originalScale, new THREE.Vector3(0.006, 0.006, 0.006), easeProgress);
        // Keep rotation at original during move
        comp.model.rotation.copy(comp.originalRotation);
        comp.model.updateMatrix();
        comp.model.updateMatrixWorld();
        if (progress >= 1) {
          comp.model.position.copy(comp.targetPosition);
          comp.model.scale.set(0.006, 0.006, 0.006);
          // Snap rotation to original + Math.PI on Y
          comp.model.rotation.set(
            comp.originalRotation.x,
            comp.originalRotation.y - Math.PI,
            comp.originalRotation.z
          );
          comp.model.updateMatrix();
          comp.model.updateMatrixWorld();
          comp.isAnimating = false;
          comp.isNearCamera = true;
          setSceneIsolation(key, scene); // <--- Hide everything except focused model and meshUIPanel
          if (comp.orbitControls && !isElectroSequencePlaying) {
            comp.orbitControls.enabled = true;
            const box = new THREE.Box3().setFromObject(comp.model);
            const center = box.getCenter(new THREE.Vector3());
            comp.orbitControls.target.copy(center);
            comp.orbitControls.update();
          }
          // --- Add focus light ONLY after animation completes ---
          addFocusLightForModel(key, scene);
        }
      } else if (comp.animationDirection === 'toOriginal') {
        comp.model.position.lerpVectors(comp.targetPosition, comp.originalPosition, easeProgress);
        comp.model.scale.lerpVectors(new THREE.Vector3(0.006, 0.006, 0.006), comp.originalScale, easeProgress);
        // Keep rotation fixed at originalRotation during return
        // comp.model.rotation.copy(comp.originalRotation);
        comp.model.updateMatrix();
        comp.model.updateMatrixWorld();
        if (progress >= 1) {
          // Restore exact original state
          comp.model.position.copy(comp.originalPosition);
          comp.model.scale.copy(comp.originalScale);
          comp.model.rotation.copy(comp.originalRotation);
          comp.model.updateMatrix();
          comp.model.updateMatrixWorld();
          comp.isAnimating = false;
          comp.isNearCamera = false;
          if (comp.orbitControls) comp.orbitControls.enabled = false;
          restoreSceneVisibility(scene); // <--- Restore everything
          // --- Remove focus light ONLY after animation completes ---
          removeFocusLight(scene);
        }
      }
    }
    if (comp.isNearCamera && comp.orbitControls && comp.orbitControls.enabled) {
      comp.orbitControls.update();
    }
  });
}

export function setSceneIsolation(focusedKey, scene) {
  // Only handle visibility, not background color
  // First, hide everything
  scene.traverse(obj => {
    if (obj.type !== 'Scene') {
      obj.visible = false;
    }
  });
  // Then explicitly show what we want visible
  if (componentModels[focusedKey] && componentModels[focusedKey].model) {
    componentModels[focusedKey].model.visible = true;
    componentModels[focusedKey].model.traverse(child => {
      child.visible = true;
    });
  }
  const meshUIPanel = getMeshUIPanel(); // Need to import getMeshUIPanel from uiManager
  if (meshUIPanel) {
    meshUIPanel.visible = true;
    meshUIPanel.traverse(child => {
      child.visible = true;
    });
  }
  // Make sure camera is visible (if it's in the scene)
  // Note: Camera is usually not traversed if it's not added to scene, but here it is added.
  // We can't easily access camera here unless passed, but usually camera visibility doesn't matter for rendering unless it has children.
  // The original code accessed global `camera`. We should probably pass it or ignore it if it's just about rendering.
  // Actually, `scene.traverse` hits everything.
  
  // Enable orbit controls only for focused model
  COMPONENT_KEYS.forEach(key => {
    if (componentModels[key].orbitControls) {
      componentModels[key].orbitControls.enabled = (key === focusedKey);
    }
  });
}

export function restoreSceneVisibility(scene) {
  // Remove meshUIPanel if it exists
  hideMeshUIPanel(scene); // This removes it from scene
  
  // Only handle visibility, not background color
  // Show all scene objects
  scene.traverse(obj => {
    if (obj.type !== 'Scene') {
      obj.visible = true;
    }
  });
  // Enable orbit controls for all models only if not focused
  COMPONENT_KEYS.forEach(key => {
    if (componentModels[key].orbitControls) {
      componentModels[key].orbitControls.enabled = false;
    }
  });
}

export function addFocusLightForModel(key, scene) {
  removeFocusLight(scene);
  const comp = componentModels[key];
  if (!comp || !comp.model) return;
  // Place light above and in front of the model
  const box = new THREE.Box3().setFromObject(comp.model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const lightPos = center.clone().add(new THREE.Vector3(0, size.y * 1.2 + 0.2, size.z * 0.7));
  focusLight = new THREE.PointLight(0x00fff7, 2.2, 4.5, 2.2); // Neon cyan, strong, short range
  focusLight.position.copy(lightPos);
  focusLight.castShadow = false;
  focusLight.name = 'focusLight';
  scene.add(focusLight);
  // Optionally, add a rim/back light for more 3D effect
  focusLight.rim = new THREE.PointLight(0xffffff, 0.7, 6, 2.2);
  focusLight.rim.position.copy(center.clone().add(new THREE.Vector3(0, size.y * 0.7, -size.z * 1.2)));
  scene.add(focusLight.rim);
}

export function removeFocusLight(scene) {
  if (focusLight) {
    scene.remove(focusLight);
    if (focusLight.rim) scene.remove(focusLight.rim);
    focusLight = null;
  }
}

export function addGlassPlaneBehindUno(camera) {
  if (!glassPlane) {
    // Create glass plane if it doesn't exist
    const geometry = new THREE.PlaneGeometry(10, 10);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      metalness: 0,
      roughness: 0,
      transmission: 1, // Add transmission
      transparent: true,
      opacity: 0.5
    });
    glassPlane = new THREE.Mesh(geometry, material);
  }
  
  if (focusedComponentKey && componentModels[focusedComponentKey]?.targetPosition && camera) {
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    glassPlane.position.copy(componentModels[focusedComponentKey].targetPosition.clone().sub(camDir.clone().multiplyScalar(1.2)));
    glassPlane.lookAt(camera.position);
    glassPlane.visible = true;
  }
  return glassPlane;
}

export function removeGlassPlane() {
  if (glassPlane) glassPlane.visible = false;
}

export function getGlassPlane() {
  return glassPlane;
}

export function setupMeshHoverInteraction(renderer, camera, componentModels, getFocusedComponentKeyCallback) {
  function hoverPointerMoveHandler(event) {
    if (!camera || (!camera.isPerspectiveCamera && !camera.isOrthographicCamera)) return;
    const focusedKey = getFocusedComponentKeyCallback();
    if (!focusedKey) return;
    const comp = componentModels[focusedKey];
    if (!comp.isNearCamera || !comp.meshes.length) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(comp.meshes, true);

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      // For nanoModel, irModel, etc., only allow outline for specific mesh names
      if (
        (focusedKey === 'nanoModel' && (!mesh.name || !nanoMeshInfo[mesh.name])) ||
        (focusedKey === 'irModel' && (!mesh.name || !irMeshInfo[mesh.name])) ||
        (focusedKey === 'unoModel' && (!mesh.name || !unoMeshInfo[mesh.name])) ||
        (focusedKey === 'ldrModel' && (!mesh.name || !ldrMeshInfo[mesh.name])) ||
        (focusedKey === 'buck' && (!mesh.parent?.name || !buckMeshInfo[mesh.parent?.name])) ||
        (focusedKey === 'motordriverModel' && (!mesh.parent?.name || !motordriverMeshInfo[mesh.parent?.name])) ||
        (focusedKey === 'buttonModel' && (!mesh.parent?.name || !buttonMeshInfo[mesh.parent?.name])) ||
        (focusedKey === 'buzzerModel' && (!mesh.parent?.name || !buzzerMeshInfo[mesh.parent?.name])) ||
        (focusedKey === 'pcbModel' && (!mesh.parent?.name || !pcbMeshInfo[mesh.parent?.name])) ||
        (focusedKey === 'rgbModel' && (!mesh.parent?.name || !rgbMeshInfo[mesh.parent?.name])) ||
        (focusedKey === 'motorModel' && (!mesh.parent?.name || !motorMeshInfo[mesh.parent?.name]))
      ) {
        if (comp.hoveredMesh && comp.hoveredOutlineMesh) {
          comp.hoveredMesh.remove(comp.hoveredOutlineMesh);
          comp.hoveredOutlineMesh.geometry.dispose();
          comp.hoveredOutlineMesh.material.dispose();
        }
        comp.hoveredMesh = null;
        comp.hoveredOutlineMesh = null;
        return;
      }
      if (comp.hoveredMesh !== mesh) {
        if (comp.hoveredMesh && comp.hoveredOutlineMesh) {
          comp.hoveredMesh.remove(comp.hoveredOutlineMesh);
          comp.hoveredOutlineMesh.geometry.dispose();
          comp.hoveredOutlineMesh.material.dispose();
        }
        const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x00fff7, side: THREE.BackSide, transparent: true });
        const outlineMesh = new THREE.Mesh(mesh.geometry.clone(), outlineMaterial);
        outlineMesh.position.copy(mesh.position);
        outlineMesh.rotation.copy(mesh.rotation);
        outlineMesh.scale.copy(mesh.scale).multiplyScalar(1.006);
        mesh.add(outlineMesh);
        comp.hoveredMesh = mesh;
        comp.hoveredOutlineMesh = outlineMesh;
      }
    } else {
      if (comp.hoveredMesh && comp.hoveredOutlineMesh) {
        comp.hoveredMesh.remove(comp.hoveredOutlineMesh);
        comp.hoveredOutlineMesh.geometry.dispose();
        comp.hoveredOutlineMesh.material.dispose();
      }
      comp.hoveredMesh = null;
      comp.hoveredOutlineMesh = null;
    }
  }

  renderer.domElement.addEventListener('pointermove', hoverPointerMoveHandler);
  
  return function cleanup() {
    renderer.domElement.removeEventListener('pointermove', hoverPointerMoveHandler);
  };
}

export function setupSceneClickInteraction(renderer, camera, scene, controls, isComponentIntroSequencePlayingCallback, isElectroSequencePlayingCallback, vrClickableObjects, startBuildButton) {
  function meshPointerDownHandler(event) {
    // 💥 Safety guard
    if (
      !scene ||
      !renderer ||
      !renderer.domElement ||
      !camera ||
      (!camera.isPerspectiveCamera && !camera.isOrthographicCamera)
    ) {
      return;
    }

    try {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      // --- Check Start Build button first ---
      const buttonRaycaster = new THREE.Raycaster();
      buttonRaycaster.setFromCamera(mouse, camera);
      const buttonIntersects = startBuildButton
        ? buttonRaycaster.intersectObject(startBuildButton, true)
        : [];

      if (buttonIntersects.length > 0) {
        // Button handles its own logic
        return;
      }

      // --- General raycast for models and meshes ---
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      
      const focusedKey = getFocusedComponentKey();

      // --- Focused model handling ---
      if (focusedKey) {
        const comp = componentModels[focusedKey];
        if (comp && comp.isNearCamera && comp.meshes && comp.meshes.length > 0) {
          const intersects = raycaster.intersectObjects(comp.meshes, true);
          if (intersects.length > 0) {
            const mesh = intersects[0].object;

            const invalid =
              (focusedKey === 'nanoModel' && (!mesh.name || !nanoMeshInfo[mesh.name])) ||
              (focusedKey === 'irModel' && (!mesh.name || !irMeshInfo[mesh.name])) ||
              (focusedKey === 'unoModel' && (!mesh.name || !unoMeshInfo[mesh.name])) ||
              (focusedKey === 'ldrModel' && (!mesh.name || !ldrMeshInfo[mesh.name])) ||
              (focusedKey === 'buck' && (!mesh.parent?.name || !buckMeshInfo[mesh.parent?.name])) ||
              (focusedKey === 'motordriverModel' && (!mesh.parent?.name || !motordriverMeshInfo[mesh.parent?.name])) ||
              (focusedKey === 'buttonModel' && (!mesh.parent?.name || !buttonMeshInfo[mesh.parent?.name])) ||
              (focusedKey === 'buzzerModel' && (!mesh.parent?.name || !buzzerMeshInfo[mesh.parent?.name])) ||
              (focusedKey === 'pcbModel' && (!mesh.parent?.name || !pcbMeshInfo[mesh.parent?.name])) ||
              (focusedKey === 'rgbModel' && (!mesh.parent?.name || !rgbMeshInfo[mesh.parent?.name])) ||
              (focusedKey === 'motorModel' && (!mesh.parent?.name || !motorMeshInfo[mesh.parent?.name]));

            if (invalid) {
              hideMeshUIPanel(scene, vrClickableObjects);
              comp.selectedMesh = null;
            } else {
              showMeshUIPanel(mesh, focusedKey, scene, camera, componentModels, vrClickableObjects);
              comp.selectedMesh = mesh;
              return; // Hit valid mesh → done
            }
          } else {
            hideMeshUIPanel(scene, vrClickableObjects);
            comp.selectedMesh = null;
          }
        }

        // --- Check if click hit the focused MODEL at all ---
        if (comp && comp.model) {
          const modelIntersects = raycaster.intersectObject(comp.model, true);
          if (modelIntersects.length === 0) {
            // Clicked completely outside the focused model → unfocus
            animateComponentToOriginal(focusedKey, scene, controls, isElectroSequencePlayingCallback());
            hideMeshUIPanel(scene, vrClickableObjects);
          }
        }

        return; // Exit early — handled focused model
      }

      // --- No model focused: check for new selection ---
      let found = false;
      for (const key of COMPONENT_KEYS) {
        const comp = componentModels[key];
        if (!comp || !comp.model) continue;

        const intersects = raycaster.intersectObject(comp.model, true);
        if (intersects.length > 0) {
          handleComponentClick(key, scene, camera, controls, isComponentIntroSequencePlayingCallback(), isElectroSequencePlayingCallback());
          found = true;
          break;
        }
      }

    } catch (err) {
      console.warn('PointerDown handler skipped due to cleanup or missing camera:', err);
    }
  }

  renderer.domElement.addEventListener('pointerdown', meshPointerDownHandler);

  return function cleanup() {
    renderer.domElement.removeEventListener('pointerdown', meshPointerDownHandler);
  };
}
