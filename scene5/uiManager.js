import * as THREE from "three";
import ThreeMeshUI from 'three-mesh-ui';

export function updateUI() {
  ThreeMeshUI.update();
}
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
import { holographicGlobeShader } from "./holographicGlobeShader.js";

let meshUIPanel = null;

export function getMeshUIPanel() {
  return meshUIPanel;
}

export function setMeshUIPanel(panel) {
  meshUIPanel = panel;
}

export function createComponentIntroPanel(scene) {
  let componentIntroPanel = new ThreeMeshUI.Block({
    width: 1.8,
    height: 1.1,
    padding: 0.07,
    justifyContent: 'start',
    alignItems: 'center',
    fontFamily: '/fonts/msdf/Roboto-msdf.json',
    fontTexture: '/fonts/msdf/Roboto-msdf.png',
    backgroundOpacity: 0.85,
    backgroundColor: new THREE.Color(0x000000), // dark blue
    borderRadius: 0.12,
    borderWidth: 0.014,
    borderColor: new THREE.Color(0x000000),
    borderOpacity: 0.7,
    flexDirection: 'column',
    fontSize: 0.05
  });
  // Heading block
  const headingBlock = new ThreeMeshUI.Block({
    width: 1.5,
    height: 0.18,
    margin: 0.01,
    backgroundOpacity: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  });
  headingBlock.add(new ThreeMeshUI.Text({
    content: 'Component Introduction',
    fontSize: 0.11,
    fontColor: new THREE.Color(0xffffff),
    fontOpacity: 1.0,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.01
  }));
  componentIntroPanel.add(headingBlock);
  // Spacer between heading and steps
  componentIntroPanel.add(new ThreeMeshUI.Block({
    width: 1.4,
    height: 0.04,
    backgroundOpacity: 0
  }));
  // Steps block with beige background
  const stepsBlock = new ThreeMeshUI.Block({
    width: 1.45,
    height: 0.6,
    backgroundOpacity: 0.95,
    backgroundColor: new THREE.Color(0xffffff), // beige
    borderRadius: 0.07,
    padding: 0.05,
    justifyContent: 'start',
    alignItems: 'start',
    flexDirection: 'column',
    margin: 0.01
  });
  // Step 1
  stepsBlock.add(new ThreeMeshUI.Text({
    content: 'Step 1: Click the component you want to inspect\n',
    fontSize: 0.08,
    fontColor: new THREE.Color(0x222222),
    fontWeight: 'bold',
    fontOpacity: 1.0,
    margin: 0.02,
    textAlign: 'left',
  }));
  // Step 2
  stepsBlock.add(new ThreeMeshUI.Text({
    content: 'Step 2: Click on the part you want details about',
    fontSize: 0.08,
    fontColor: new THREE.Color(0x222222),
    fontWeight: 'bold',
    fontOpacity: 1.0,
    margin: 0.02,
    textAlign: 'left',
  }));
  componentIntroPanel.add(stepsBlock);
  componentIntroPanel.position.set(-33, 1.9, 7.5);
  componentIntroPanel.rotation.set(0, Math.PI, 0);
  componentIntroPanel.visible = true;
  componentIntroPanel.userData.isComponentIntroPanel = true;
  scene.add(componentIntroPanel);
  return componentIntroPanel;
}

export function createByteAssemblyPanel(scene) {
  let byteAssemblyPanel = new ThreeMeshUI.Block({
    width: 1.4,
    height: 0.35,
    padding: 0.07,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: '/fonts/msdf/Roboto-msdf.json',
    fontTexture: '/fonts/msdf/Roboto-msdf.png',
    backgroundOpacity: 0,
    flexDirection: 'column',
    fontSize: 0.07
  });
  byteAssemblyPanel.add(new ThreeMeshUI.Text({
    content: 'Assemble parts of Byte',
    fontSize: 0.11,
    fontColor: new THREE.Color(0xffffff),
    fontOpacity: 1.0,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.01
  }));
  byteAssemblyPanel.position.set(-39, 2.25, -6.21);
  byteAssemblyPanel.rotation.set(0, 0, 0);
  byteAssemblyPanel.visible = true;
  // byteAssemblyPanel.userData.isByteAssemblyPanel = true;
  scene.add(byteAssemblyPanel);
  return byteAssemblyPanel;
}

export function createStartBuildButton(scene, byteAssemblyPanel, isComponentIntroSequencePlayingCallback, cleanupScene5Callback, transitionToScene6Callback) {
  // 1. Button options - made wider
  const buttonOptions = {
    width: 0.9, // <-- CHANGED from 0.4 to make it wider
    height: 0.25,
    justifyContent: 'center',
    offset: 0.05,
    margin: 0.02,
    borderRadius: 0.075
  };
  // 2. Hovered state - changed font to black
  const hoveredStateAttributes = {
    state: 'hovered',
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0xebebd9), // Kept this as a light gray for hover feedback
      backgroundOpacity: 1,
      fontColor: new THREE.Color(0x000000) // <-- CHANGED from 0xffffff (white) to 0x000000 (black)
    },
  };
  // 3. Idle state - made background opaque white
  const idleStateAttributes = {
    state: 'idle',
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0xffffff), // This is white, as requested
      backgroundOpacity: 1.0, // <-- CHANGED from 0.3 to make it fully opaque
      fontColor: new THREE.Color(0x000000) // This is black, as requested
    },
  };
  // 4. Selected state - already has white bg and black text, no change needed
  const selectedAttributes = {
    state: 'selected',
    attributes: {
      offset: 0.02,
      backgroundColor: new THREE.Color(0xffffff),
      fontColor: new THREE.Color(0x000000)
    },
    onSet: async () => {
      // Block Start Build action during the intro sequence
      if (isComponentIntroSequencePlayingCallback()) return;
      try {
        // Proactive cleanup before transition
        if (typeof cleanupScene5Callback === 'function') cleanupScene5Callback();
      } catch (_) {}
      transitionToScene6Callback();
    }
  };
  // 5. Button Block creation
  let startBuildButton = new ThreeMeshUI.Block(buttonOptions);
  // 6. Text Block creation - adjusted to fit new button size
  startBuildButton.add(new ThreeMeshUI.Text({
    // width: 1.4, // <-- REMOVED (lets parent button control width)
    // height: 0.35, // <-- REMOVED (lets parent button control height)
    content: 'Start Build',
    fontSize: 0.12, // <-- REDUCED from 0.27 (to fit inside button height of 0.15)
    backgroundOpacity: 0, // <-- ADDED (ensures text bg is transparent)
    fontColor: new THREE.Color(0x000000), // Default text color is black
    fontWeight: 'bold',
    fontFamily: '/fonts/msdf/Roboto-msdf.json',
    fontTexture: '/fonts/msdf/Roboto-msdf.png',
    textAlign: 'center',
    letterSpacing: 0.01,
    fontOpacity: 1.0
  }));
  startBuildButton.setupState(selectedAttributes);
  startBuildButton.setupState(hoveredStateAttributes);
  startBuildButton.setupState(idleStateAttributes);
  startBuildButton.setState('idle');
  // Position the button just below the byteAssemblyPanel
  startBuildButton.position.copy(byteAssemblyPanel.position);
  startBuildButton.position.y -= 0.28;
  startBuildButton.position.z += 0.012;
  startBuildButton.rotation.copy(byteAssemblyPanel.rotation);
  startBuildButton.visible = true;
  scene.add(startBuildButton);
  // 7. Shadow Block - made wider to match button
  let startBuildButtonShadow = new ThreeMeshUI.Block({
    width: 0.80, // <-- CHANGED from 0.40 to match new button width
    height: 0.23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: new THREE.Color(0x000000),
    backgroundOpacity: 0.98,
    borderRadius: 0.035,
    borderWidth: 0,
    borderOpacity: 0,
    margin: 0.02
  });
  startBuildButtonShadow.position.copy(byteAssemblyPanel.position);
  startBuildButtonShadow.position.y -= 0.28;
  startBuildButtonShadow.position.z += 0.005;
  startBuildButtonShadow.rotation.copy(byteAssemblyPanel.rotation);
  startBuildButtonShadow.visible = true;
  scene.add(startBuildButtonShadow);
  
  return { startBuildButton, startBuildButtonShadow };
}

export function setupStartBuildButtonHandlers(renderer, camera, startBuildButton, startBuildButtonShadow, scene, isComponentIntroSequencePlayingCallback, getFocusedComponentKeyCallback) {
  function pointerMoveHandler(event) {
    // Disable hover while the component intro sequence is playing
    if (isComponentIntroSequencePlayingCallback()) {
      if (startBuildButton && startBuildButton.currentState !== 'idle') {
        startBuildButton.setState('idle');
      }
      return;
    }
    if (!camera) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(startBuildButton, true);
    if (intersects.length > 0) {
      if (startBuildButton.currentState !== 'hovered') startBuildButton.setState('hovered');
    } else {
      if (startBuildButton.currentState === 'hovered') startBuildButton.setState('idle');
    }
  }
  function pointerDownHandler(event) {
    if (startBuildButton.currentState === 'hovered' && !getFocusedComponentKeyCallback()) { // Only if not focused
      startBuildButton.setState('selected');
    }
  }
  function pointerUpHandler(event) {
    // Ignore mouse up while the component intro sequence is playing
    if (isComponentIntroSequencePlayingCallback()) return;
    if (startBuildButton.currentState === 'selected') startBuildButton.setState('idle');
  }
  renderer.domElement.addEventListener('pointermove', pointerMoveHandler);
  renderer.domElement.addEventListener('pointerdown', pointerDownHandler);
  renderer.domElement.addEventListener('pointerup', pointerUpHandler);
  
  return function cleanup() {
    renderer.domElement.removeEventListener('pointermove', pointerMoveHandler);
    renderer.domElement.removeEventListener('pointerdown', pointerDownHandler);
    renderer.domElement.removeEventListener('pointerup', pointerUpHandler);
    if (scene && startBuildButton) scene.remove(startBuildButton);
    if (scene && startBuildButtonShadow) scene.remove(startBuildButtonShadow);
  };
}

export function createCloseButton(scene, animateComponentToOriginal, focusedComponentKey, hideMeshUIPanelCallback, removeGlassPlaneCallback, isComponentIntroSequencePlaying) {
  // Create close button
  const closeButton = document.createElement('div');
  closeButton.id = 'closeUnoButton';
  closeButton.innerHTML = '✕';
  closeButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    background: rgba(255, 0, 0, 0.8);
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    display: none;
    z-index: 1000;
    text-align: center;
    line-height: 40px;
    transition: background 0.3s ease;
  `;
  // Add hover effect
  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.background = 'rgba(255, 0, 0, 1)';
  });
 
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.background = 'rgba(255, 0, 0, 0.8)';
  });
 
  // Add click event
  closeButton.addEventListener('click', () => {
    // Don't allow interactions during the intro sequence
    if (isComponentIntroSequencePlaying()) {
      return;
    }
    // Instantly restore background to normal scene
    scene.background = null;
    const currentFocusedKey = focusedComponentKey();
    if (currentFocusedKey) {
      animateComponentToOriginal(currentFocusedKey);
      hideMeshUIPanelCallback();
      removeGlassPlaneCallback(); // Remove glass plane immediately
    }
  });
 
  document.body.appendChild(closeButton);
  return closeButton;
}

export function createPanel(mesh, focusedComponentKey, scene, camera, componentModels) {
  // Main panel with glassy feel
  meshUIPanel = new ThreeMeshUI.Block({
    width: 0.9,
    height: 0.7,
    padding: 0.05,
    fontFamily: '/fonts/msdf/Roboto-msdf.json',
    fontTexture: '/fonts/msdf/Roboto-msdf.png',
    // Glassy bluish background
    backgroundColor: new THREE.Color(0x000000),
    backgroundOpacity: 0.02,
    // ✨ Rounded corners mimic a custom sci-fi silhouette
    borderRadius: 0.02,
    // 💡 Bright glowing border
    borderWidth: 0.001,
    borderColor: new THREE.Color(0x00ffff),
    borderOpacity: 0.95,
    // 🧊 Inner text shadow-like overlay (optional UI trick)
    fontColor: new THREE.Color(0xffffff)
  });
  let meshInfo = null;
  let headingTitle = '';
  
  const key = focusedComponentKey;
  
  if (key === 'nanoModel' && mesh && mesh.name && nanoMeshInfo[mesh.name]) {
    meshInfo = nanoMeshInfo[mesh.name];
    headingTitle = "Arduino Nano";
  } else if (key === 'irModel' && mesh && mesh.name && irMeshInfo[mesh.name]) {
    meshInfo = irMeshInfo[mesh.name];
    headingTitle = "TSOP IR";
  } else if (key === 'unoModel' && mesh && mesh.name && unoMeshInfo[mesh.name]) {
    meshInfo = unoMeshInfo[mesh.name];
    headingTitle = "Expansion board";
  } else if (key === 'ldrModel' && mesh && mesh.name && ldrMeshInfo[mesh.name]) {
    meshInfo = ldrMeshInfo[mesh.name];
    headingTitle = "LDR Module";
  } else if (key === 'buck' && mesh && mesh.parent?.name && buckMeshInfo[mesh.parent?.name]) {
    meshInfo = buckMeshInfo[mesh.parent?.name];
    headingTitle = "Buck Convertor";
  } else if (key === 'motordriverModel' && mesh && mesh.parent?.name && motordriverMeshInfo[mesh.parent?.name]) {
    meshInfo = motordriverMeshInfo[mesh.parent?.name];
    headingTitle = "Motor Driver";
  } else if (key === 'buttonModel' && mesh && mesh.parent?.name && buttonMeshInfo[mesh.parent?.name]) {
    meshInfo = buttonMeshInfo[mesh.parent?.name];
    headingTitle = "Button";
  } else if (key === 'buzzerModel' && mesh && mesh.parent?.name && buzzerMeshInfo[mesh.parent?.name]) {
    meshInfo = buzzerMeshInfo[mesh.parent?.name];
    headingTitle = "Buzzer";
  } else if (key === 'pcbModel' && mesh && mesh.parent?.name && pcbMeshInfo[mesh.parent?.name]) {
    meshInfo = pcbMeshInfo[mesh.parent?.name];
    headingTitle = "PCB";
  } else if (key === 'rgbModel' && mesh && mesh.parent?.name && rgbMeshInfo[mesh.parent?.name]) {
    meshInfo = rgbMeshInfo[mesh.parent?.name];
    headingTitle = "RGB";
  } else if (key === 'motorModel' && mesh && mesh.parent?.name && motorMeshInfo[mesh.parent?.name]) {
    meshInfo = motorMeshInfo[mesh.parent?.name];
    headingTitle = "motor";
  }

  if (meshInfo) {
    // Title container with glowing effect
    const titleContainer = new ThreeMeshUI.Block({
      width: 0.85,
      height: 0.15,
      backgroundColor: new THREE.Color(0x00a2ff),
      backgroundOpacity: 0.1,
      margin: 0.02,
      padding: 0.02,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 0.006,
      borderColor: new THREE.Color(0x00ffff),
      borderOpacity: 0.9,
      borderRadius: 0.02
    });
    titleContainer.add(
      new ThreeMeshUI.Text({
        content: headingTitle,
        fontSize: 0.06,
        fontColor: new THREE.Color(0x00ffff),
        fontOpacity: 0.9
      })
    );
    meshUIPanel.add(titleContainer);
    // Component name with subtle highlight
    const nameContainer = new ThreeMeshUI.Block({
      width: 0.65,
      height: 0.12,
      margin: 0.02,
      padding: 0.025,
      borderWidth: 0.001,
      backgroundColor: new THREE.Color(0x001a33),
      backgroundOpacity: 0.00015,
      justifyContent: 'start',
      borderRadius: 0.02
    });
    nameContainer.add(
      new ThreeMeshUI.Text({
        content: meshInfo.heading,
        fontSize: 0.045,
        fontColor: new THREE.Color(0x00ffff),
        fontOpacity: 0.95
      })
    );
    meshUIPanel.add(nameContainer);
    // Description with glassy background
    const descContainer = new ThreeMeshUI.Block({
      width: 0.85,
      height: 0.25,
      margin: 0.02,
      padding: 0.03,
      backgroundColor: new THREE.Color(0x000000),
      backgroundOpacity: 0.2,
      justifyContent: 'start',
      borderOpacity:0
    });
    descContainer.add(
      new ThreeMeshUI.Text({
        content: meshInfo.description,
        fontSize: 0.04,
        fontColor: new THREE.Color(0xffffff),
        fontOpacity: 0.85
      })
    );
    meshUIPanel.add(descContainer);
    scene.add(meshUIPanel);
    // Position panel relative to focused model
    if (componentModels[key]?.model && camera) {
      const box = new THREE.Box3().setFromObject(componentModels[key].model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
    
      // Position panel to the left of the model
      meshUIPanel.position.copy(center).add(new THREE.Vector3(-size.x * 1.2, 0.1, 0));
      meshUIPanel.lookAt(camera.position);
    }
  }
}

export function showMeshUIPanel(mesh, focusedComponentKey, scene, camera, componentModels, vrClickableObjects) {
  // Remove existing panel if it exists
  if (meshUIPanel && scene.children.includes(meshUIPanel)) {
    scene.remove(meshUIPanel);
    meshUIPanel = null;
  }
  // Create new panel with the mesh
  createPanel(mesh, focusedComponentKey, scene, camera, componentModels);
  // Add mesh UI panel to VR clickable objects if in VR mode
  if (vrClickableObjects && meshUIPanel) {
    meshUIPanel.userData = {
      ...meshUIPanel.userData,
      isMeshUIPanel: true,
      onClick: () => {
        console.log('VR Controller clicked on mesh UI panel');
        // Handle mesh UI panel click if needed
      }
    };
    vrClickableObjects.push(meshUIPanel);
  }
}

export function hideMeshUIPanel(scene, vrClickableObjects) {
  if (meshUIPanel) {
    // Remove mesh UI panel from VR clickable objects if in VR mode
    if (vrClickableObjects) {
      const index = vrClickableObjects.indexOf(meshUIPanel);
      if (index > -1) {
        vrClickableObjects.splice(index, 1);
      }
    }
    scene.remove(meshUIPanel);
    meshUIPanel = null;
  }
}

export function showFPPOverlay() {
  // Remove any existing overlay
  let existing = document.getElementById('fpp-overlay-container');
  if (existing) existing.remove();
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'fpp-overlay-container';
  overlay.style.position = 'fixed';
  overlay.style.bottom = '20px';
  overlay.style.left = '50%';
  overlay.style.transform = 'translateX(-50%)';
  overlay.style.zIndex = '99999';
  overlay.style.fontFamily = "'Orbitron', 'Segoe UI', Arial, sans-serif";
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.gap = '10px';
  overlay.style.padding = '18px 28px 14px 28px';
  overlay.style.borderRadius = '18px';
  overlay.style.background = 'rgba(20, 30, 40, 0.55)';
  overlay.style.boxShadow = '0 4px 32px 0 rgba(0, 255, 255, 0.18)';
  overlay.style.border = '1.5px solid rgba(0, 255, 255, 0.18)';
  overlay.style.backdropFilter = 'blur(14px) saturate(1.2)';
  overlay.style.transition = 'opacity 1s cubic-bezier(.4,0,.2,1)';
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  // Title
  const title = document.createElement('div');
  title.textContent = 'You are now Entering first person perspective';
  title.style.color = '#00f6ff';
  title.style.fontSize = '18px';
  title.style.fontWeight = 'bold';
  title.style.textShadow = '0 0 8px #00f6ff88';
  title.style.letterSpacing = '1.5px';
  title.style.marginBottom = '2px';
  overlay.appendChild(title);
  // Controls display (compact)
  const controlsSection = document.createElement('div');
  controlsSection.style.display = 'flex';
  controlsSection.style.flexDirection = 'row';
  controlsSection.style.alignItems = 'center';
  controlsSection.style.gap = '18px';
  // Movement controls (WASD/Arrows)
  const movementControls = document.createElement('div');
  movementControls.style.display = 'flex';
  movementControls.style.flexDirection = 'column';
  movementControls.style.alignItems = 'center';
  movementControls.style.gap = '2px';
  // WASD/Arrow keys (compact)
  const wasdContainer = document.createElement('div');
  wasdContainer.style.display = 'flex';
  wasdContainer.style.flexDirection = 'column';
  wasdContainer.style.alignItems = 'center';
  wasdContainer.style.gap = '1px';
  // Top row (W/Up)
  const topRow = document.createElement('div');
  topRow.style.display = 'flex';
  topRow.style.justifyContent = 'center';
  topRow.style.width = '100%';
  const wKey = createKeyElement('W');
  const upArrow = createKeyElement('↑');
  topRow.appendChild(wKey);
  topRow.appendChild(upArrow);
  wasdContainer.appendChild(topRow);
  // Middle row (A/Left, S/Down, D/Right)
  const middleRow = document.createElement('div');
  middleRow.style.display = 'flex';
  middleRow.style.justifyContent = 'center';
  middleRow.style.width = '100%';
  middleRow.style.gap = '1px';
  const aKey = createKeyElement('A');
  const leftArrow = createKeyElement('←');
  const sKey = createKeyElement('S');
  const downArrow = createKeyElement('↓');
  const dKey = createKeyElement('D');
  const rightArrow = createKeyElement('→');
  middleRow.appendChild(aKey);
  middleRow.appendChild(leftArrow);
  middleRow.appendChild(sKey);
  middleRow.appendChild(downArrow);
  middleRow.appendChild(dKey);
  middleRow.appendChild(rightArrow);
  wasdContainer.appendChild(middleRow);
  // Label
  const wasdLabel = document.createElement('div');
  wasdLabel.textContent = 'MOVE';
  wasdLabel.style.color = '#00f6ff';
  wasdLabel.style.fontSize = '12px';
  wasdLabel.style.marginTop = '1px';
  wasdLabel.style.textShadow = '0 0 4px #00f6ff88';
  wasdLabel.style.letterSpacing = '0.5px';
  movementControls.appendChild(wasdContainer);
  movementControls.appendChild(wasdLabel);
  // Run control (compact)
  const runControl = document.createElement('div');
  runControl.style.display = 'flex';
  runControl.style.flexDirection = 'column';
  runControl.style.alignItems = 'center';
  runControl.style.gap = '1px';
  const shiftKey = createKeyElement('SHIFT');
  shiftKey.style.width = '54px';
  shiftKey.style.fontSize = '15px';
  const runLabel = document.createElement('div');
  runLabel.textContent = 'RUN';
  runLabel.style.color = '#00f6ff';
  runLabel.style.fontSize = '12px';
  runLabel.style.marginTop = '1px';
  runLabel.style.textShadow = '0 0 4px #00f6ff88';
  runLabel.style.letterSpacing = '0.5px';
  runControl.appendChild(shiftKey);
  runControl.appendChild(runLabel);
  controlsSection.appendChild(movementControls);
  controlsSection.appendChild(runControl);
  overlay.appendChild(controlsSection);
  // Helper for key element
  function createKeyElement(label) {
    const key = document.createElement('span');
    key.textContent = label;
    key.style.display = 'inline-block';
    key.style.minWidth = '22px';
    key.style.height = '22px';
    key.style.lineHeight = '22px';
    key.style.background = 'rgba(0,255,255,0.10)';
    key.style.color = '#00f6ff';
    key.style.fontWeight = 'bold';
    key.style.fontSize = '15px';
    key.style.textAlign = 'center';
    key.style.borderRadius = '5px';
    key.style.margin = '0 1px';
    key.style.border = '1px solid #00f6ff33';
    key.style.boxShadow = '0 0 4px #00f6ff22';
    key.style.textShadow = '0 0 4px #00f6ff';
    key.style.userSelect = 'none';
    return key;
  }
  document.body.appendChild(overlay);
  // Fade in
  setTimeout(() => {
    overlay.style.opacity = '1';
  }, 50);
  // Fade out after 3 seconds
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 1000);
  }, 6000);
}
