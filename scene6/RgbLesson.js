/**
 * About: `scene6/RgbLesson.js`
 *
 * Scene 6 Lesson 3 (RGB LED + LDR) implementation.
 * Manages model placement, drag/snap wiring steps, shader hints, and LDR-driven brightness interaction.
 */

"use strict"; // Enable strict mode for safer JavaScript

import * as THREE from "three";
import { RaycasterSetup2 } from "./raycasterSetup.js";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { JstXhFemalePin } from "./JstXhFemalePin2.js";
import getWorldPosititon from "./utils/getWorldPosition.js";
import getChildrenMesh from "./utils/getChildrenMesh.js";
import LessonCleaner from "./utils/lessonCleaner.js";
// Camera animation import removed - all lessons now have consistent camera behavior
import { setForwardArrowEnabled, setLesson, runCodeButton, runCodeButtonL345, forwardArrow } from "./ui.js";
import { KpMotorLesson } from "./MotorLesson.js";
import {
  applyStepShader,
  handleDragStart as shaderHandleDragStart,
  handleSnap as shaderHandleSnap,
  cleanupShader,
} from "./shaderManager.js";
import { playAudio } from "../commonFiles/audiomanager.js";
import { scene6State } from "./scene6State.js";
import ThreeMeshUI from "three-mesh-ui";

/**
 * Lesson 3 (RGB LED + LDR) setup.
 * Handles model placement, JST wiring steps, shader hints, and LDR brightness interaction.
 *
 * @param {THREE.Scene} scene - Active scene6 Three.js scene.
 * @param {THREE.Camera} camera - Active camera for lesson3.
 * @param {THREE.OrbitControls} controls - Orbit controls used for interaction.
 */
export function KpRgbDefault(scene, camera, controls) {
  console.log("KpRgbDefault called with scene:", scene, "camera:", camera);
  console.log("Available models:", Object.keys(allAssets.models.gltf || {}));
  
  const straightAhead = new THREE.Vector3(
    camera.position.x,
    camera.position.y,
    camera.position.z - 1
  );
  function setupCameraAndNext() {
   // Camera animation removed - all lessons now have consistent camera behavior
    setForwardArrowEnabled(true);
  }
  let stepCounter = 1; // Track current step
  let ledGlass = null; // Store ledGlass for brightness adjustment

  // Callback to adjust ledGlass brightness based on cube Y-position
  const adjustLedBrightness = (cubeY) => {
    if (!ledGlass) return;
    // Map cube Y-position (2.0 to 2.4) to opacity (0.2 to 1.0) and emissive intensity (0.0 to 1.0)
    const minY = 2.0;
    const maxY = 2.4;
    const minOpacity = 0.2;
    const maxOpacity = 1.0;
    const minEmissiveIntensity = 0.0;
    const maxEmissiveIntensity = 1.0;

    // Normalize cubeY to [0, 1]
    const t = (cubeY - minY) / (maxY - minY);

    // Calculate opacity
    const opacity = minOpacity + t * (maxOpacity - minOpacity);
    ledGlass.material.opacity = Math.max(
      minOpacity,
      Math.min(maxOpacity, opacity)
    );

    // Calculate emissive intensity for glow effect
    const emissiveIntensity =
      minEmissiveIntensity + t * (maxEmissiveIntensity - minEmissiveIntensity);
    ledGlass.material.emissiveIntensity = Math.max(
      minEmissiveIntensity,
      Math.min(maxEmissiveIntensity, emissiveIntensity)
    );

    // Ensure emissive color is set (e.g., white or a color matching the LED)
    ledGlass.material.emissive = new THREE.Color(1, 1, 1); // White for a neutral glow, adjust as needed
    ledGlass.material.needsUpdate = true;

    // console.log(
    //   `Cube Y: ${cubeY}, LED opacity: ${opacity}, Emissive intensity: ${emissiveIntensity}`
    // );
  };

  let raycasterSetup;
  try {
    raycasterSetup = new RaycasterSetup2(
      scene,
      camera,
      () => stepCounter,
      adjustLedBrightness // Pass the brightness callback
    );
    // Expose for cleanup
    try {
      window.kpL3Raycaster = raycasterSetup;
    } catch (e) {}
  } catch (error) {
    console.error("Failed to initialize RaycasterSetup2:", error);
    return;
  }

  const arduinoNano = allAssets.models.gltf.nano1;
  const expansionBoard = allAssets.models.gltf.expansionBoard;
  const ldr = allAssets.models.gltf.ldr;
  const rgbLed = allAssets.models.gltf.rgbLed;
  const battery = allAssets.models.gltf.battery2;

  console.log("Model availability check:", {
    arduinoNano: !!arduinoNano,
    expansionBoard: !!expansionBoard,
    ldr: !!ldr,
    rgbLed: !!rgbLed,
    battery: !!battery,
    mainModel: !!allAssets.models.gltf.mainModel
  });

  // Check if all required models are loaded
  if (!arduinoNano || !expansionBoard || !ldr || !rgbLed || !battery) {
    console.error("Required models not loaded for KpRgbDefault:", {
      arduinoNano: !!arduinoNano,
      expansionBoard: !!expansionBoard,
      ldr: !!ldr,
      rgbLed: !!rgbLed,
      battery: !!battery
    });
    return; // Exit early if models are not available
  }

  try {
    window.ldrModel = ldr;
  } catch (e) {}
  try {
    window.rgbLedModel = rgbLed;
  } catch (e) {}

  battery.position.set(0.2, 0.3, 0.4);
  battery.scale.set(0.6, 0.6, 0.6);
  
  // Tag lesson3-specific models for cleanup
  arduinoNano.userData.kpLesson3 = true;
  expansionBoard.userData.kpLesson3 = true;
  ldr.userData.kpLesson3 = true;
  rgbLed.userData.kpLesson3 = true;

  let table = null;
  if (allAssets.models.gltf.mainModel) {
    allAssets.models.gltf.mainModel.traverse((child) => {
      if (child.name === "table2") {
        table = child;
      }
    });
  }

  if (!table) {
    console.error("Table not found in mainModel");
    return;
  }

  // console.log(scene);

  try {
    table.add(arduinoNano, expansionBoard, ldr, rgbLed, battery);
  } catch (error) {
    console.error("Failed to add models to table:", error);
    return;
  }
  arduinoNano.position.set(-0.4, 0.4, 0.0);
  arduinoNano.scale.set(5, 5, 5);
  expansionBoard.position.set(0, 0.3, 0.2);
  expansionBoard.scale.set(5, 5, 5);
  ldr.position.set(-1, 0.45, 0);
  rgbLed.position.set(-0.7, 0.5, 0.2);
  // Ensure objects are interactive
  raycasterSetup.addInteractiveObjects(arduinoNano);

  // Expose to shader manager
  try {
    scene6State.expansionBoardModel = expansionBoard;
    scene6State.ldrModel = ldr;
    scene6State.getCurrentLesson = () => "lesson3";
    scene6State.getCurrentStep = () => stepCounter;
    // Also set on window for backward compatibility
    window.expansionBoardModel = expansionBoard;
    window.ldrModel = ldr;
    window.getCurrentLesson = () => "lesson3";
    window.getCurrentStep = () => stepCounter;
  } catch (e) {}


  async function InitialiseSteps() {
    let jstPinRgb = null;
    scene6State.jstPinRgb = jstPinRgb;
    window.jstPinRgb = jstPinRgb; // Backward compatibility
    function Step1() {
      console.log("Step 1: Drag Arduino Nano to Expansion Board");

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent === arduinoNano &&
          stepCounter === 1
        ) {
          const arduinoPos = getWorldPosititon(arduinoNano);
          const expansionPos = getWorldPosititon(expansionBoard);

          const distance = arduinoPos.distanceTo(expansionPos);
          if (distance < 1) {
            raycasterSetup.snapObject(
              arduinoNano,
              expansionBoard.position,
              null,
              null,
              () => {
                console.log("Arduino Nano snapped to Expansion Board");

                setTimeout(() => {
                  setupCameraAndNext();
                  setTimeout(() => {
                    stepCounter = 2;
                    Step2();
                  }, 1000);
                }, 1000);
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step2() {
      console.log("Step 2: Connect LDR to Expansion Board with JST Pin");

      // Animate camera for step reveal, then we will blink after 2s
      setupCameraAndNext();

      const jstPin2 = new JstXhFemalePin({
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0, y: 1.8, z: -3 } },
          { startPosition: { x: -0.4, y: 1.8, z: -3 } },
        ],
        colors: ["black", "brown", "red"],
      });
      scene.add(jstPin2.getGroup());
      // Expose for shader targeting
      try {
        scene6State.jstPin2 = jstPin2;
        window.jstPin2 = jstPin2; // Backward compatibility
      } catch (e) {}

      // Highlight jstPin2.pinGLTF1 AFTER Step 2 camera animation (2s)
      setTimeout(() => {
        applyStepShader("lesson3", 2);
      }, 1000);

      ldr.rotation.x = Math.PI;
      // jstPin2.pinGLTF1.rotation.y = -Math.PI * 0.5;

      //   const pinGLTF1WorldPosition = new THREE.Vector3();
      //   jstPin2.pinGLTF1.getWorldPosition(pinGLTF1WorldPosition);
      // jstPin2.updatePosition(jstPin2.pinGLTF1.posititon, jstPin2.pinGLTF1);

      // Wire drag start to shader manager to move blink to ldrPin
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.isDragging &&
            raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
            stepCounter === 2
          ) {
            const draggedObj =
              raycasterSetup.draggedPinModel ||
              raycasterSetup.draggedComponent?.getGroup?.() ||
              raycasterSetup.draggedComponent;
            shaderHandleDragStart(draggedObj);
          }
        } catch (e) {}
      };

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          stepCounter === 2
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);

          const localRgbPin = getChildrenMesh(expansionBoard, "ldrPin");
          const ldrPinWorldPosition = getWorldPosititon(localRgbPin);

          const distance = pinPos.distanceTo(ldrPinWorldPosition);
          console.log("Step 2 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              ldrPinWorldPosition,
              jstPin2,
              pinModel,
              () => {
                jstPin2.updatePosition(ldrPinWorldPosition, pinModel);
                console.log("JST pin snapped to expansionBoard's ldrPin");
                // Remove blink from ldrPin on snap BEFORE advancing the step
                try {
                  shaderHandleSnap("step2Snap");
                } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                stepCounter = 3;
                setTimeout(() => {
                  setupCameraAndNext();
                  Step3();
                }, 1000);
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step3() {
      let ldrPin = getChildrenMesh(ldr, "ldrPin");

      const ldrPinWorldPosition = getWorldPosititon(ldrPin);

      const jstPin2 = JstXhFemalePin.getAllModels().find(
        (entry) => entry.instance.config.twoSide
      )?.instance;

      if (!jstPin2) {
        console.error("JST pin from Step 2 not found");
        return;
      }

      jstPin2.pinGLTF2.rotation.x = Math.PI;
      jstPin2.pinGLTF2.rotation.y = Math.PI;
      jstPin2.updatePosition(jstPin2.pinGLTF2.position, jstPin2.pinGLTF2);

      // Reveal camera for step 3, then blink jstPin2.pinGLTF2 after 2s
      setupCameraAndNext();
      setTimeout(() => {
        applyStepShader("lesson3", 3);
      }, 1000);

      // Wire drag start to shader manager to move blink to the dragged pin model
      const originalOnMouseDown3 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown3.call(raycasterSetup, event);
        try {
          const tryApply = () => {
            if (
              raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
              stepCounter === 3
            ) {
              const draggedObj =
                raycasterSetup.draggedPinModel ||
                raycasterSetup.draggedComponent?.getGroup?.() ||
                raycasterSetup.draggedComponent;
              shaderHandleDragStart(draggedObj);
            }
          };
          // Attempt immediately and shortly after to cover timing
          tryApply();
          setTimeout(tryApply, 0);
        } catch (e) {}
      };

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === jstPin2 &&
          stepCounter === 3
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);

          const distance = pinPos.distanceTo(ldrPinWorldPosition);
          console.log("Step 3 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              ldrPinWorldPosition,
              jstPin2,
              pinModel,
              () => {
                // Remove blink from the dragged pin model on successful drop
                try {
                  shaderHandleSnap("removeFromLdrPin001");
                } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                
                // Additional cleanup to ensure LDR model is completely restored
                try {
                  const ldrModel = window.ldrModel;
                  if (ldrModel) {
                    ldrModel.traverse((child) => {
                      if (child.material && child.material.type === 'ShaderMaterial') {
                        console.log('Step 3 cleanup: Restoring LDR child material to default');
                        child.material = new THREE.MeshStandardMaterial({
                          color: 0x808080,
                          metalness: 0.5,
                          roughness: 0.5
                        });
                        child.material.needsUpdate = true;
                      }
                    });
                  }
                } catch (e) {
                  console.warn('Error during LDR cleanup:', e);
                }
                
                jstPin2.updatePosition(ldrPinWorldPosition, pinModel);
                stepCounter = 4;

                arduinoNano.rotation.y = -Math.PI * 0.5;
                expansionBoard.rotation.y = -Math.PI * 0.5;
                ldr.rotation.x = 0;
                jstPin2.pinGLTF2.rotation.x = 0;

                const ldrPinCurrentWorldPosition = getWorldPosititon(ldrPin);

                jstPin2.pinGLTF2.position.copy(ldrPinCurrentWorldPosition);
                jstPin2.updatePosition(
                  ldrPinCurrentWorldPosition,
                  jstPin2.pinGLTF2
                );
                const expansionBoardLdrPin = getChildrenMesh(
                  expansionBoard,
                  "ldrPin"
                );
                const expansionBoardLdrPinWorldPosition =
                  getWorldPosititon(expansionBoardLdrPin);

                jstPin2.pinGLTF1.position.copy(
                  expansionBoardLdrPinWorldPosition
                );
                jstPin2.updatePosition(
                  ldrPinCurrentWorldPosition,
                  jstPin2.pinGLTF1
                );
                setTimeout(() => {
                  setupCameraAndNext();
                  setTimeout(() => {
                    Step4();
                  }, 1000);
                }, 1000);
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step4() {
      // Cleanup any remaining shaders from previous steps
      try {
        const ldrModel = window.ldrModel;
        if (ldrModel) {
          ldrModel.traverse((child) => {
            if (child.material && child.material.type === 'ShaderMaterial') {
              console.log('Step 4 cleanup: Restoring LDR child material to default');
              child.material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                metalness: 0.5,
                roughness: 0.5
              });
              child.material.needsUpdate = true;
            }
          });
        }
      } catch (e) {
        console.warn('Error during Step 4 cleanup:', e);
      }
      
      jstPinRgb = new JstXhFemalePin({
        pinCount: 4,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.4, y: 1.8, z: -3 } },
          { startPosition: { x: -0.3, y: 1.8, z: -3 } },
        ],
        colors: ["black", "brown", "red", "blue"],
      });
      scene.add(jstPinRgb.getGroup());
      // Expose for shader manager targeting
      scene6State.jstPin = jstPinRgb;
      window.jstPin = jstPinRgb; // Backward compatibility

      rgbLed.rotation.x = Math.PI;

      // Reveal camera, then blink jstPin.pinGLTF1 for Step 4
      setupCameraAndNext();
      setTimeout(() => {
        applyStepShader("lesson3", 4);
      }, 1000);

      // Wire drag start to move blink to rgbPin1
      const originalOnMouseDown4 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown4.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
            stepCounter === 4
          ) {
            const draggedObj =
              raycasterSetup.draggedPinModel ||
              raycasterSetup.draggedComponent?.getGroup?.() ||
              raycasterSetup.draggedComponent;
            shaderHandleDragStart(draggedObj);
          }
        } catch (e) {}
      };

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          stepCounter === 4
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);

          const localRgbPin = getChildrenMesh(expansionBoard, "rgbPin1");
          const rgbPinWorldPosition = getWorldPosititon(localRgbPin);

          const distance = pinPos.distanceTo(rgbPinWorldPosition);
          console.log("Step 4 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              rgbPinWorldPosition,
              jstPinRgb,
              pinModel,
              () => {
                // Remove blink from rgbPin1 on snap
                try {
                  shaderHandleSnap("removeFromRgbPin1");
                } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                jstPinRgb.updatePosition(rgbPinWorldPosition, pinModel);
                console.log("JST pin snapped to expansionBoard's rgbPin");
                stepCounter = 5;
                setTimeout(() => {
                  setupCameraAndNext();
                  Step5();
                }, 1000);
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step5() {
      console.log("Step 5: Connect the other JST pin to RGB model's rgbPin");

      // Reveal camera for step 5, then blink jstPin.pinGLTF2 after 2s
      setupCameraAndNext();
      setTimeout(() => {
        applyStepShader("lesson3", 5);
      }, 1000);

      // Wire drag start to shader manager to move blink to rgbLed model
      const originalOnMouseDown5 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown5.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
            stepCounter === 5
          ) {
            const draggedObj =
              raycasterSetup.draggedPinModel ||
              raycasterSetup.draggedComponent?.getGroup?.() ||
              raycasterSetup.draggedComponent;
            shaderHandleDragStart(draggedObj);
          }
        } catch (e) {}
      };

      let rgbPin = getChildrenMesh(rgbLed, "rgbPin");

      const rgbPinWorldPosition = getWorldPosititon(rgbPin);

      jstPinRgb.pinGLTF2.rotation.x = Math.PI;
      jstPinRgb.pinGLTF2.rotation.y = Math.PI;
      const pinGLTF2WorldPosition = getWorldPosititon(jstPinRgb.pinGLTF2);

      jstPinRgb.updatePosition(pinGLTF2WorldPosition, jstPinRgb.pinGLTF2);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === jstPinRgb &&
          stepCounter === 5
        ) {
          const pinPos = new THREE.Vector3();
          const pinModel = raycasterSetup.draggedPinModel;
          pinModel.getWorldPosition(pinPos);

          const distance = pinPos.distanceTo(rgbPinWorldPosition);
          console.log("Step 5 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              rgbPinWorldPosition,
              jstPinRgb,
              pinModel,
              () => {
                // Remove blink from rgbLed model on successful snap
                try {
                  shaderHandleSnap("removeFromRgbLed");
                } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                
                jstPinRgb.updatePosition(rgbPinWorldPosition, pinModel);
                console.log("JST pin snapped to RGB's rgbPin");
                stepCounter = 6;
                console.log("Step 5 completed");

                rgbLed.rotation.x = 0;
                jstPinRgb.pinGLTF2.rotation.x = 0;

                const rgbLedPinCurrentWorldPosition = getWorldPosititon(rgbPin);

                jstPinRgb.pinGLTF2.position.copy(rgbLedPinCurrentWorldPosition);

                jstPinRgb.updatePosition(
                  rgbLedPinCurrentWorldPosition,
                  jstPinRgb.pinGLTF2
                );
                setTimeout(() => {
                  setupCameraAndNext();
                  Step6();
                }, 1000);
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
          }
      function Step6() {
        console.log("Step 6: Connect battery wire to expansion board power pin");

        // Reveal camera for step 6, then blink batteryWire2 after 2s
        setupCameraAndNext();
        setTimeout(() => {
          applyStepShader("lesson3", 6);
        }, 1000);

        // Wire drag start to shader manager to move blink to powerPin
        const originalOnMouseDown6 = raycasterSetup.onMouseDown;
        raycasterSetup.onMouseDown = (event) => {
          originalOnMouseDown6.call(raycasterSetup, event);
          try {
            if (
              raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
              stepCounter === 6
            ) {
              const draggedObj =
                raycasterSetup.draggedPinModel ||
                raycasterSetup.draggedComponent?.getGroup?.() ||
                raycasterSetup.draggedComponent;
              shaderHandleDragStart(draggedObj);
            }
          } catch (e) {}
        };

        const batteryPositiveTerminalWorldPosition = new THREE.Vector3();
      battery.children[2].getWorldPosition(
        batteryPositiveTerminalWorldPosition
      );
      const batteryNegativeTerminalWorldPosition = new THREE.Vector3();
      battery.children[1].getWorldPosition(
        batteryNegativeTerminalWorldPosition
      );
      const batteryWire2 = new JstXhFemalePin(
        {
          pinCount: 2,
          twoSide: false,
          position: new THREE.Vector3(0.5, 1.8, -3.0),
          wireConfigs: [
            {
              startPosition: batteryPositiveTerminalWorldPosition, // Pin 1 (2.54mm pitch)
              color: 0xff0000, // Red
            },
            {
              startPosition: batteryNegativeTerminalWorldPosition, // Pin 2
              color: 0x00ff00, // Green
            },
          ],
        },
        scene
      );
      scene.add(batteryWire2.getGroup());
      batteryWire2.pinGLTF1.rotation.y = -Math.PI * 0.5;
      batteryWire2.updatePosition(
        batteryWire2.pinGLTF1.posititon,
        batteryWire2.pinGLTF1
      );
      
      // Expose batteryWire2 to shader manager
      try {
        window.batteryWire2 = batteryWire2.pinGLTF1;
      } catch (e) {}

      const expansionBoardPowerPin = getChildrenMesh(
        expansionBoard,
        "powerPin"
      );
      const expansionBoardPowerPinWorldPosititon = getWorldPosititon(
        expansionBoardPowerPin
      );

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          stepCounter === 6
        ) {
          const pinPos = new THREE.Vector3();
          const pinModel = raycasterSetup.draggedPinModel;
          pinModel.getWorldPosition(pinPos);

          const distance = pinPos.distanceTo(
            expansionBoardPowerPinWorldPosititon
          );
          console.log("Step 5 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardPowerPinWorldPosititon,
              batteryWire2,
              pinModel,
              () => {
                // Remove blink from powerPin on successful snap
                try {
                  shaderHandleSnap("removeFromPowerPin");
                } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                
                console.log("JST pin snapped to motorDriver's input pin");
                // After successful snap in lesson3 Step6: show Start Coding button immediately (no camera animation)
                try {
                  // Hide/disable Next button when Start Coding is shown
                  try {
                    setForwardArrowEnabled(false);
                    if (forwardArrow) forwardArrow.visible = false;
                  } catch (e) {}

                  // Show Start Coding button for lesson3 - use dedicated button for lessons 3, 4, 5
                  if (scene && runCodeButtonL345) {
                    // Remove from any existing parent first
                    if (runCodeButtonL345.parent) {
                      runCodeButtonL345.parent.remove(runCodeButtonL345);
                    }
                    
                    // Add to scene if not already there
                    if (!scene.children.includes(runCodeButtonL345)) {
                      scene.add(runCodeButtonL345);
                    }
                    
                    // Set visibility and clickable
                    runCodeButtonL345.visible = true;
                    runCodeButtonL345.userData.clickable = true;
                    
                    // Ensure position is correct
                    runCodeButtonL345.position.set(0.2, 2.1, -4.01);
                    
                    // Set clickable on all child meshes
                    if (runCodeButtonL345.traverse) {
                      runCodeButtonL345.traverse((child) => {
                        if (child.isMesh) {
                          if (!child.userData) child.userData = {};
                          child.userData.clickable = true;
                        }
                      });
                    }
                    
                    // Update ThreeMeshUI to ensure rendering
                    try {
                      if (typeof ThreeMeshUI !== 'undefined' && typeof ThreeMeshUI.update === 'function') {
                        ThreeMeshUI.update();
                        // Force a second update after a brief delay
                        setTimeout(() => {
                          if (runCodeButtonL345 && runCodeButtonL345.visible) {
                            ThreeMeshUI.update();
                          }
                        }, 50);
                      }
                      if (typeof runCodeButtonL345.update === 'function') {
                        runCodeButtonL345.update();
                      }
                    } catch (e) {
                      console.warn("Error updating ThreeMeshUI:", e);
                    }
                    
                    console.log("Start Coding button (L345) shown for lesson3 step 6");
                  } else {
                    console.warn("runCodeButtonL345 not available");
                  }
                } catch (e) {
                  console.error("Error showing Start Coding button:", e);
                }
                stepCounter = 7;
                console.log("Step 6 completed");
                //Step7();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    function Step7() {
      console.log("Step 6: Drag ldrTestingCube to adjust RGB LED brightness");
      playAudio("lesson3_s8");
      // Find ledGlass in rgbLed
      rgbLed.traverse((child) => {
        if (child.name === "ledGlass" && child.isMesh) {
          ledGlass = child;
        }
      });

      if (!ledGlass) {
        console.error("ledGlass not found in RGB model");
        return;
      }

      // Ensure ledGlass material supports opacity
      if (!ledGlass.material.transparent) {
        ledGlass.material.transparent = true;
        ledGlass.material.needsUpdate = true;
      }

      // Create and position ldrTestingCube
      const ldrPinCurrentWorldPosition = getWorldPosititon(ldr);

      const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const material = new THREE.MeshBasicMaterial();
      const cube = new THREE.Mesh(geometry, material);
      cube.name = "ldrTestingCube";
      // console.log("LDR position:", ldrPinCurrentWorldPosition);

      cube.position.set(
        ldrPinCurrentWorldPosition.x,
        ldrPinCurrentWorldPosition.y + 0.2,
        ldrPinCurrentWorldPosition.z
      );
     scene.add(cube);
      raycasterSetup.addInteractiveObjects(cube);

      // Initial brightness adjustment
      adjustLedBrightness(cube.position.y);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent === cube &&
          stepCounter === 7
        ) {
          const cubePos = getWorldPosititon(cube);

          // console.log("Cube final Y-position:", cubePos.y);
          adjustLedBrightness(cubePos.y);

          console.log("Step 7 interaction completed");
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    // Expose Step7 so it can be triggered after Continue button camera animation
    try {
      window.startLesson3Step7 = () => {
        try {
          if (typeof stepCounter !== 'undefined') stepCounter = 7;
        } catch (e) {}
        Step7();
      };
    } catch (e) {}

    Step1();
  }

  InitialiseSteps();
}

// Clean up helper for lesson3 (RGB/LDR flow)
/**
 * Comprehensive cleanup for lesson3 (RGB/LDR) components and globals.
 *
 * @param {THREE.Scene} scene - Scene from which lesson3 objects should be removed.
 */
export function cleanupKpRgbLesson(scene) {
  console.log("Starting comprehensive cleanup of lesson3 (RGB/LDR) components...");
  console.log("cleanupKpRgbLesson: scene parameter type:", typeof scene, "value:", scene);
  
  // Check if scene is valid before proceeding
  if (!scene) {
    console.warn("cleanupKpRgbLesson: scene parameter is undefined or null, skipping cleanup");
    return;
  }
  
  // Additional validation
  if (typeof scene.traverse !== 'function') {
    console.warn("cleanupKpRgbLesson: scene.traverse is not a function, scene type:", typeof scene);
    return;
  }
  
  // This function cleans up:
  // 1. kpL3Raycaster (lesson3-specific raycaster)
  // 2. jstPinRgb (RGB JST pin created in lesson3)
  // 3. window.jstPin (global reference to jstPinRgb)
  // 4. batteryWire2 (battery wire created in lesson3)
  // 5. lesson3-specific global variables (ldrModel, rgbLedModel, jstPin2, etc.)
  // 6. lesson3-specific functions (getCurrentLesson, getCurrentStep)
  // 7. Models tagged with kpLesson3 (arduinoNano, expansionBoard, ldr, rgbLed)
  // 8. table2 if it becomes empty after cleanup
  
  // 1) Dispose raycaster if exposed
  try {
    if (
      window.kpL3Raycaster &&
      typeof window.kpL3Raycaster.dispose === "function"
    ) {
      window.kpL3Raycaster.dispose();
    }
    window.kpL3Raycaster = null;
  } catch (e) {}

  // 2) Explicitly remove jstPinRgb if it exists
  try {
    if (window.jstPinRgb && window.jstPinRgb.getGroup) {
      const jstPinRgbGroup = window.jstPinRgb.getGroup();
      if (jstPinRgbGroup && jstPinRgbGroup.parent) {
        jstPinRgbGroup.parent.remove(jstPinRgbGroup);
        console.log("Removed jstPinRgb group from scene");
      }
      // Dispose wires if present
      if (window.jstPinRgb.wires && Array.isArray(window.jstPinRgb.wires)) {
        window.jstPinRgb.wires.forEach((wireObj) => {
          try { 
            if (typeof wireObj.dispose === 'function') wireObj.dispose(); 
          } catch (e) {}
        });
        console.log("Disposed jstPinRgb wires");
      }
      // Clear the reference
      scene6State.jstPinRgb = null;
      window.jstPinRgb = null;
      console.log("Cleared jstPinRgb reference");
    }
    
    // Also clean up the global jstPin reference that points to jstPinRgb
    if ((scene6State.jstPin || window.jstPin) && (scene6State.jstPin?.getGroup || window.jstPin?.getGroup)) {
      const jstPin = scene6State.jstPin || window.jstPin;
      const jstPinGroup = jstPin.getGroup();
      if (jstPinGroup && jstPinGroup.parent) {
        jstPinGroup.parent.remove(jstPinGroup);
        console.log("Removed global jstPin group from scene");
      }
      // Dispose wires if present
      if (jstPin.wires && Array.isArray(jstPin.wires)) {
        jstPin.wires.forEach((wireObj) => {
          try { 
            if (typeof wireObj.dispose === 'function') wireObj.dispose(); 
          } catch (e) {}
        });
        console.log("Disposed global jstPin wires");
      }
      // Clear the global reference
      scene6State.jstPin = null;
      window.jstPin = null;
      console.log("Cleared global jstPin reference");
    }
    
    // Also clean up batteryWire2 which is created in lesson3
    if (window.batteryWire2 && window.batteryWire2.parent) {
      window.batteryWire2.parent.remove(window.batteryWire2);
      console.log("Removed batteryWire2 from scene");
      // Clear the reference
      window.batteryWire2 = null;
      console.log("Cleared batteryWire2 reference");
    }
    
    // Clean up lesson3-specific global variables
    if (scene6State.ldrModel || window.ldrModel) {
      scene6State.ldrModel = null;
      window.ldrModel = null;
      console.log("Cleared ldrModel reference");
    }
    if (window.rgbLedModel) {
      window.rgbLedModel = null;
      console.log("Cleared rgbLedModel reference");
    }
    if (scene6State.jstPin2 || window.jstPin2) {
      scene6State.jstPin2 = null;
      window.jstPin2 = null;
      console.log("Cleared jstPin2 reference");
    }
    if (scene6State.expansionBoardModel || window.expansionBoardModel) {
      scene6State.expansionBoardModel = null;
      window.expansionBoardModel = null;
      console.log("Cleared expansionBoardModel reference");
    }
    if (scene6State.nanoModel || window.nanoModel) {
      scene6State.nanoModel = null;
      window.nanoModel = null;
      console.log("Cleared nanoModel reference");
    }
    
    // Clean up lesson3-specific functions
    if (scene6State.getCurrentLesson && typeof scene6State.getCurrentLesson === 'function') {
      scene6State.getCurrentLesson = null;
      console.log("Cleared scene6State.getCurrentLesson function");
    }
    if (window.getCurrentLesson && typeof window.getCurrentLesson === 'function') {
      delete window.getCurrentLesson;
      console.log("Cleared getCurrentLesson function");
    }
    if (scene6State.getCurrentStep && typeof scene6State.getCurrentStep === 'function') {
      scene6State.getCurrentStep = null;
      console.log("Cleared scene6State.getCurrentStep function");
    }
    if (window.getCurrentStep && typeof window.getCurrentStep === 'function') {
      delete window.getCurrentStep;
      console.log("Cleared getCurrentStep function");
    }
    
    // Clean up any models tagged with kpLesson3
    try {
      if (scene && typeof scene.traverse === 'function') {
        scene.traverse((child) => {
          if (child.userData && child.userData.kpLesson3 === true) {
            if (child.parent) {
              child.parent.remove(child);
              console.log(`Removed lesson3-tagged model: ${child.name || 'unnamed'}`);
            }
          }
        });
      }
    } catch (e) {
      console.warn("Error cleaning up lesson3-tagged models:", e);
    }
    
    // Clean up table2 if it exists and contains lesson3 models
    try {
      let table2 = null;
      if (scene && typeof scene.traverse === 'function') {
        scene.traverse((child) => {
          if (child.name === "table2") {
            table2 = child;
          }
        });
      }
      
      if (table2 && table2.children.length === 0) {
        // If table2 is empty after removing lesson3 models, remove it too
        if (table2.parent) {
          table2.parent.remove(table2);
          console.log("Removed empty table2 after lesson3 cleanup");
        }
      }
    } catch (e) {
      console.warn("Error cleaning up table2:", e);
    }
  } catch (e) {
    console.warn("Error cleaning up jstPinRgb:", e);
  }

  // 3) Remove JST pins created by JstXhFemalePin2 registry (if available)
  try {
    if (
      JstXhFemalePin &&
      typeof JstXhFemalePin !== "undefined" &&
      typeof JstXhFemalePin.getAllModels === "function"
    ) {
      const all = JstXhFemalePin.getAllModels() || [];
      all.forEach((entry) => {
        const inst = entry?.instance || entry;
        const group =
          inst && typeof inst.getGroup === "function"
            ? inst.getGroup()
            : inst?.group || entry?.group;
        if (group && group.parent) {
          group.parent.remove(group);
        }
        // Try to dispose wires if present
        try {
          if (inst && Array.isArray(inst.wires)) {
            inst.wires.forEach((w) => {
              try {
                if (typeof w.dispose === 'function') w.dispose();
              } catch (e) {}
            });
          }
        } catch (e) {}
      });
    }
  } catch (e) {}

  // 4) Remove lesson3-only models: ldr, rgbLed; reparent shared nano/expansionBoard back to scene
  try {
    if (!allAssets?.models?.gltf) {
      console.warn("cleanupKpRgbLesson: allAssets.models.gltf is not available");
      return;
    }
    
    const arduinoNano = allAssets.models.gltf.nano;
    const expansionBoard = allAssets.models.gltf.expansionBoard;
    const ldr = allAssets.models.gltf.ldr;
    const rgbLed = allAssets.models.gltf.rgbLed;

    // Remove ldr and rgbLed if present
    [ldr, rgbLed].forEach((obj) => {
      try {
        if (obj && obj.parent) {
          obj.parent.remove(obj);
        }
      } catch (e) {}
    });

    // Ensure nano and expansionBoard remain in scene (reparent if needed)
    [arduinoNano, expansionBoard].forEach((obj) => {
      try {
        if (!obj) return;
        if (scene && obj.parent !== scene) {
          scene.add(obj);
        }
      } catch (e) {}
    });
  } catch (e) {}

  // 5) Remove temporary cube if still present
  try {
    let cube = null;
    if (scene && typeof scene.traverse === 'function') {
      scene.traverse((child) => {
        if (child.name === "ldrTestingCube") cube = child;
      });
    }
    if (cube && cube.parent) cube.parent.remove(cube);
  } catch (e) {}
}
