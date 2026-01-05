/**
 * About: `scene6/MotorLesson.js`
 *
 * Scene 6 Lesson 4 (motor driver) implementation.
 * Handles model placement, raycasting/drag + snapping steps, and the per-frame gear rotation update.
 */

"use strict"; // Enable strict mode for safer JavaScript

import * as THREE from "three";
import { RaycasterSetup2 } from "./raycasterSetup.js";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { JstXhFemalePin } from "./JstXhFemalePin2.js";
// Camera animation import removed - all lessons now have consistent camera behavior
import { setForwardArrowEnabled, runCodeButton, runCodeButtonL345, forwardArrow } from "./ui.js";
import getChildrenMesh from "./utils/getChildrenMesh.js";
import getWorldPosititon from "./utils/getWorldPosition.js";
import LessonCleaner from "./utils/lessonCleaner.js";
import { KpIRLesson } from "./IRLesson.js";
import {
  applyStepShader,
  handleDragStart as shaderHandleDragStart,
  handleSnap as shaderHandleSnap,
  cleanupShader,
} from "./shaderManager.js";

import { playAudio } from "../commonFiles/audiomanager.js";
import { scene6State } from "./scene6State.js";
import ThreeMeshUI from "three-mesh-ui";
let motorGears = null;

/**
 * Lesson 4 (motor driver) setup.
 * Positions models on the table and wires up RaycasterSetup2 with step-based snapping logic.
 *
 * @param {THREE.Scene} scene - Active scene6 Three.js scene.
 * @param {THREE.Camera} camera - Active camera for lesson4.
 */
export function KpMotorLesson(scene, camera) {
  console.log("KpMotorLesson called with scene:", scene, "camera:", camera);
  console.log("Available models:", Object.keys(allAssets.models.gltf || {}));
  
  function setupCameraAndNext() {
  
    setForwardArrowEnabled(true);
  }
  
  let stepCounter = 1; // Track current step
  let raycasterSetup;
  try {
    raycasterSetup = new RaycasterSetup2(scene, camera, () => stepCounter);
  } catch (error) {
    console.error("Failed to initialize RaycasterSetup2:", error);
    return;
  }
  
  let motorDriverInputJstPin = null; // Store reference to the pin created in Step 3

  const arduinoNano = allAssets.models.gltf.nano1;
  const expansionBoard = allAssets.models.gltf.expansionBoard;
  const motorDriver = allAssets.models.gltf.motorDriver;
  const motor = allAssets.models.gltf.motor;
  const battery = allAssets.models.gltf.battery;

  console.log("Model availability check:", {
    arduinoNano: !!arduinoNano,
    expansionBoard: !!expansionBoard,
    motorDriver: !!motorDriver,
    motor: !!motor,
    battery: !!battery,
    mainModel: !!allAssets.models.gltf.mainModel
  });

  // Check if all required models are loaded
  if (!arduinoNano || !expansionBoard || !motorDriver || !motor || !battery) {
    console.error("Required models not loaded for KpMotorLesson:", {
      arduinoNano: !!arduinoNano,
      expansionBoard: !!expansionBoard,
      motorDriver: !!motorDriver,
      motor: !!motor,
      battery: !!battery
    });
    return; // Exit early if models are not available
  }

  arduinoNano.position.set(0.2, 0.3, 0.3);
  arduinoNano.scale.set(5, 5, 5);
  expansionBoard.scale.set(5, 5, 5);
  expansionBoard.position.set(-0.4, 0.3, 0.3);
  motorDriver.position.set(-0.7, 0.3, 0.3);
  motor.position.set(-0.2, 0.3, 0.3);
  battery.position.set(-1, 0.3, 0.3);

  let table = null;
  if (allAssets.models.gltf.mainModel) {
    table = getChildrenMesh(allAssets.models.gltf.mainModel, "table2");
  }

  if (!table) {
    console.error("Table not found in mainModel");
    return;
  }

  try {
    table.add(arduinoNano, expansionBoard, motorDriver, motor, battery);
  } catch (error) {
    console.error("Failed to add models to table:", error);
    return;
  }

  let motorPin1 = getChildrenMesh(motor, "motorPin1");
  let motorPin2 = getChildrenMesh(motor, "motorPin2");

  if (!motorPin1 || !motorPin2) {
    console.error("Motor pins not found:", { motorPin1: !!motorPin1, motorPin2: !!motorPin2 });
    return;
  }

  motor.updateMatrixWorld(true);
  const motorPin1WorldPosition = getWorldPosititon(motorPin1);
  const motorPin2WorldPosition = getWorldPosititon(motorPin2);

  raycasterSetup.addInteractiveObjects(arduinoNano);
  async function InitialiseSteps() {
    function Step1() {
      console.log("Step 1: Drag Arduino Nano to Expansion Board");
      // Expose models and lesson/step for shader manager
      try {
        scene6State.nanoModel = arduinoNano;
        scene6State.expansionBoardModel = expansionBoard;
        scene6State.motorDriverModel = motorDriver;
        scene6State.getCurrentLesson = () => "lesson4";
        scene6State.getCurrentStep = () => stepCounter;
        // Also set on window for backward compatibility
        window.nanoModel = arduinoNano;
        window.expansionBoardModel = expansionBoard;
        window.motorDriverModel = motorDriver;
        window.getCurrentLesson = () => "lesson4";
        window.getCurrentStep = () => stepCounter;
      } catch (e) {}

      // Reveal highlight for lesson4 step 1
      setTimeout(() => {
        applyStepShader("lesson4", 1);
      }, 500);

      // Wire drag start to move blink per config
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.isDragging &&
            raycasterSetup.draggedComponent === arduinoNano &&
            stepCounter === 1
          ) {
            const draggedObj =
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
                try { shaderHandleSnap("removeFromExpansionNano"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                stepCounter = 2;
                setTimeout(() => {
                  setupCameraAndNext();
                  Step2();
                }, 2000);
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    function Step2() {
      const motorJstPin = new JstXhFemalePin(
        {
          pinCount: 2,
          twoSide: false,
          position: new THREE.Vector3(-0.1, 1.8, -3),
          wireConfigs: [
            {
              startPosition: motorPin1WorldPosition, // Pin 1 (2.54mm pitch)
              color: 0xff0000, // Red
            },
            {
              startPosition: motorPin2WorldPosition, // Pin 2
              color: 0x00ff00, // Green
            },
          ],
        },
        scene
      );
      scene.add(motorJstPin.getGroup());
      // Expose for shader manager targeting in lesson4 step 2
      try { 
        scene6State.jstPin = motorJstPin;
        window.jstPin = motorJstPin; // Backward compatibility
      } catch (e) {}

      motorJstPin.pinGLTF1.rotation.y = Math.PI * 0.5;

      motorJstPin.updatePosition(
        motorJstPin.pinGLTF1.position,
        motorJstPin.pinGLTF1
      );

      // Highlight destination pin for lesson4 step 2
      setTimeout(() => {
        applyStepShader("lesson4", 2);
      }, 500);

      // Wire drag start so blink jumps to dragged object per config
      const originalOnMouseDown2 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown2.call(raycasterSetup, event);
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

          motorJstPin.originalPinPositions = new Map();
          motorJstPin.originalPinPositions.set(
            motorJstPin.pinGLTF1,
            motorJstPin.pinGLTF1.position.clone()
          );

          const motorPinA = allAssets.models.gltf.motorDriver.children[1];
          const motorJstPinWorldPosition = new THREE.Vector3();
          motorPinA.getWorldPosition(motorJstPinWorldPosition);

          const distance = pinPos.distanceTo(motorJstPinWorldPosition);
          console.log("Step 2 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              motorJstPinWorldPosition,
              motorJstPin,
              pinModel,
              () => {
                console.log("JST pin snapped to motorDriver's pin");
                try { shaderHandleSnap("removeFromMotorDriverPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                stepCounter = 3;
                Step3();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
         function Step3() {
       motorDriverInputJstPin = new JstXhFemalePin({
         pinCount: 4,
         twoSide: true,
         jstPinConfig: [
           { startPosition: { x: 0, y: 1.8, z: -3 } },
           { startPosition: { x: -0.4, y: 1.8, z: -3 } },
         ],
         colors: ["black", "brown", "red", "green"],
       });

      scene.add(motorDriverInputJstPin.getGroup());
      // Expose for shader manager targeting in lesson4 steps 3 and 4
      try { 
        scene6State.jstPin = motorDriverInputJstPin;
        window.jstPin = motorDriverInputJstPin; // Backward compatibility
      } catch (e) {}
      motorDriverInputJstPin.pinGLTF2.rotation.x = Math.PI;
      // motorDriverInputJstPin.pinGLTF1.rotation.y = -Math.PI * 0.5;

      motorDriverInputJstPin.updatePosition(
        motorDriverInputJstPin.pinGLTF2.position.clone(),
        motorDriverInputJstPin.pinGLTF2
      );

      // Highlight destination for lesson4 step 3
      setTimeout(() => {
        applyStepShader("lesson4", 3);
      }, 500);

      // Wire drag start for step 3
      const originalOnMouseDown3 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown3.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.isDragging &&
            raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
            stepCounter === 3
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
          stepCounter === 3
        ) {
          const pinPos = new THREE.Vector3();
          const pinModel = raycasterSetup.draggedPinModel;
          pinModel.getWorldPosition(pinPos);

          const localMotorDriverPin = getChildrenMesh(
            expansionBoard,
            "motordriverPin"
          );
          const motorInputPinWorldPosition = new THREE.Vector3();
          localMotorDriverPin.getWorldPosition(motorInputPinWorldPosition);

          const distance = pinPos.distanceTo(motorInputPinWorldPosition);
          console.log("Step 3 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              motorInputPinWorldPosition,
              motorDriverInputJstPin,
              pinModel,
              () => {
                console.log("JST pin snapped to expansionBoard's pin");
                try { shaderHandleSnap("removeFromMotorDriverPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                stepCounter = 4;
                Step4();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    function Step4() {
      console.log("Step 4: Snap JST pin to motorDriver's input pin");
      let motorDriverInputPin = null;

      motorDriver.traverse((child) => {
        if (child.name === "motorDriverInputPin") {
          motorDriverInputPin = child;
        }
      });
             console.log("Motor driver input pin found:", motorDriverInputPin);
      
       // Use the stored reference to the pin created in Step 3
       const motorInputPin2 = motorDriverInputJstPin;

       if (!motorInputPin2) {
         console.error("JST pin from Step 3 not found");
         return;
       }
       
       console.log("motorInputPin2:", motorInputPin2);

      // Make sure pinGLTF2 is draggable
      motorInputPin2.pinGLTF2.rotation.y = Math.PI * 0.5;
      motorInputPin2.updatePosition(
        motorInputPin2.pinGLTF2.position.clone(),
        motorInputPin2.pinGLTF2
      );

      // Highlight destination for lesson4 step 4
      setTimeout(() => {
        applyStepShader("lesson4", 4);
      }, 500);

      // Wire drag start for step 4
      const originalOnMouseDown4 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown4.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.isDragging &&
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

      // Mark the pin as draggable in the pin models reference
      const pinModelsRef = raycasterSetup.pinModelsRef;
      const pinEntry = pinModelsRef.find(entry => entry.instance === motorInputPin2);
      if (pinEntry) {
        const modelEntry = pinEntry.models.find(m => m.model === motorInputPin2.pinGLTF2);
        if (modelEntry) {
          modelEntry.draggable = true;
          console.log("Set pinGLTF2 as draggable for Step 4");
          console.log("Updated pinModelsRef:", pinModelsRef);
        } else {
          console.warn("Could not find pinGLTF2 model in pinModelsRef");
        }
      } else {
        console.warn("Could not find motorInputPin2 in pinModelsRef");
      }

      const motorDriverMotorInputPinWorldPosition = new THREE.Vector3();
      motorDriverInputPin.getWorldPosition(
        motorDriverMotorInputPinWorldPosition
      );
      console.log("Motor driver input pin world position:", motorDriverMotorInputPinWorldPosition);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
             raycasterSetup.onMouseUp = (event) => {
         console.log("Step 4 onMouseUp - isDragging:", raycasterSetup.isDragging, "draggedComponent:", raycasterSetup.draggedComponent, "stepCounter:", stepCounter);
         if (
           raycasterSetup.isDragging &&
           raycasterSetup.draggedComponent === motorInputPin2 &&
           stepCounter === 4
         ) {
          const pinPos = new THREE.Vector3();
          const pinModel = raycasterSetup.draggedPinModel;
          pinModel.getWorldPosition(pinPos);

          const distance = pinPos.distanceTo(
            motorDriverMotorInputPinWorldPosition
          );
          console.log("Step 4 distance:", distance, "threshold: 10.0");

          if (distance < 10) {
            console.log("Attempting to snap pin to motorDriver input pin");
            raycasterSetup.snapObject(
              pinModel,
              motorDriverMotorInputPinWorldPosition,
              motorInputPin2,
              pinModel,
              () => {
                console.log("JST pin snapped to motorDriver's input pin");
                try { shaderHandleSnap("removeFromMotorDriverInputPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                stepCounter = 5;
                console.log("Step 4 completed");
                Step5();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    function Step5() {
      const batteryPositiveTerminalWorldPosition = new THREE.Vector3();
      battery.children[2].getWorldPosition(
        batteryPositiveTerminalWorldPosition
      );
      const batteryNegativeTerminalWorldPosition = new THREE.Vector3();
      battery.children[1].getWorldPosition(
        batteryNegativeTerminalWorldPosition
      );
      const batteryWire1 = new JstXhFemalePin(
        {
          pinCount: 2,
          twoSide: false,
          position: new THREE.Vector3(-0.5, 1.8, -3.5),
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
      scene.add(batteryWire1.getGroup());
      // Expose for shader manager targeting in lesson4 step 5
      try { 
        scene6State.jstPin = batteryWire1;
        window.jstPin = batteryWire1; // Backward compatibility
      } catch (e) {}
      batteryWire1.pinGLTF1.rotation.y = Math.PI * 0.5;
      batteryWire1.updatePosition(
        batteryWire1.pinGLTF1.position,
        batteryWire1.pinGLTF1
      );
      const motorDriverPowerPinWorldPosititon = new THREE.Vector3();
      motorDriver.children[4].getWorldPosition(
        motorDriverPowerPinWorldPosititon
      );

      // Highlight destination for lesson4 step 5
      setTimeout(() => {
        applyStepShader("lesson4", 5);
      }, 500);

      // Wire drag start for step 5
      const originalOnMouseDown5 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown5.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.isDragging &&
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

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          stepCounter === 5
        ) {
          const pinPos = new THREE.Vector3();
          const pinModel = raycasterSetup.draggedPinModel;
          pinModel.getWorldPosition(pinPos);

          const distance = pinPos.distanceTo(motorDriverPowerPinWorldPosititon);
          console.log("Step 5 distance:", distance);

          if (distance < 2) {
            raycasterSetup.snapObject(
              pinModel,
              motorDriverPowerPinWorldPosititon,
              batteryWire1,
              pinModel,
              () => {
                console.log("JST pin snapped to motorDriver's input pin");
                try { shaderHandleSnap("removeFromMotorDriverPowerPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                stepCounter = 6;
                console.log("Step 5 completed");
                Step6();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    function Step6() {
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
          position: new THREE.Vector3(-0.5, 1.8, -3.5),
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
        batteryWire2.pinGLTF1.position,
        batteryWire2.pinGLTF1
      );
      // Expose for shader manager targeting in lesson4 step 6
      try { window.batteryWire2 = batteryWire2.pinGLTF1; } catch (e) {}

      const expansionBoardPowerPin = getChildrenMesh(
        expansionBoard,
        "powerPin"
      );
      const expansionBoardPowerPinWorldPosititon = getWorldPosititon(
        expansionBoardPowerPin
      );

      // Highlight destination for lesson4 step 6
      setTimeout(() => {
        applyStepShader("lesson4", 6);
      }, 500);

      // Wire drag start for step 6
      const originalOnMouseDown6 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown6.call(raycasterSetup, event);
        try {
          if (
            raycasterSetup.isDragging &&
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
          console.log("Step 6 distance:", distance);

          if (distance < 2) {
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardPowerPinWorldPosititon,
              batteryWire2,
              pinModel,
              () => {
                console.log("JST pin snapped to expansionBoard's power pin");
                // Animate camera straight ahead, then show Start Coding and hide Next
                try {
                  const straightAhead = new THREE.Vector3(
                    camera.position.x,
                    camera.position.y,
                    camera.position.z - 1
                  );
                  setTimeout(() => {
                    // Camera animation removed - all lessons now have consistent camera behavior
                    setTimeout(() => {
                      try {
                        setForwardArrowEnabled(false);
                        if (forwardArrow) forwardArrow.visible = false;
                      } catch (e) {}
                      // Use dedicated button for lessons 3, 4, 5
                      if (scene && runCodeButtonL345) {
                        // Remove from any existing parent first
                        if (runCodeButtonL345.parent) {
                          runCodeButtonL345.parent.remove(runCodeButtonL345);
                        }
                        
                        // Add to scene if not already there
                        if (!scene.children.includes(runCodeButtonL345)) {
                          scene.add(runCodeButtonL345);
                        }
                        
                        runCodeButtonL345.visible = true;
                        runCodeButtonL345.userData.clickable = true;
                        runCodeButtonL345.position.set(0.2, 2.1, -4.01);
                        
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
                        
                        console.log("Start Coding button (L345) shown for lesson4");
                      }
                    });
                  }, 2000);
                } catch (e) {}
                try { shaderHandleSnap("removeFromPowerPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                stepCounter = 7;
                console.log("Step 6 completed");
               // Step7();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    function Step7() {
      motorGears = new Map();
      const motorGearNames = [
        "gear1",
        "gear2",
        "gear3",
        "gear4",
        "gear5",
        "gear6",
        "shaft",
      ];
      motorGearNames.forEach((value) => {
        motor.traverse((child) => {
          if (child.name === value) {
            motorGears.set(value, child);
          }
        });
      });
      
    }

    // Expose inner Step7 so external handlers can run it after Continue animation
    try { window._startLesson4Step7Inner = Step7; } catch (e) {}

    Step1();
  }

  InitialiseSteps();

  // Expose Lesson 4 starter so it can be triggered after Continue camera animation
  try {
    window.startLesson4 = () => {
      try { if (typeof stepCounter !== 'undefined') stepCounter = 1; } catch (e) {}
      InitialiseSteps();
    };
  } catch (e) {}

  // Expose Lesson 4 Step7 trigger so it runs only after Continue button camera animation completes
  try {
    window.startLesson4Step7 = () => {
      try { if (typeof stepCounter !== 'undefined') stepCounter = 7; } catch (e) {}
      try { if (typeof window._startLesson4Step7Inner === 'function') window._startLesson4Step7Inner(); } catch (e) {}
    };
  } catch (e) {}

  // Do not auto-start here; wait for Continue handler in lesson4 to trigger
  // Step1();
}

/**
 * Per-frame update for lesson4 (motor driver).
 * Rotates motor gears when the lesson has reached the animation step.
 *
 * @param {number} deltaTime - Time since last frame in seconds.
 */
export function updateFunction(deltaTime) {
  //play audio only once when rotation starts
  try {
    const alreadyPlayed = (typeof window !== 'undefined' && window._lesson4_s7Played) || false;
    if (!alreadyPlayed && typeof window !== 'undefined') {
      // If gears are ready to rotate, play once
      if (motorGears && motorGears.size > 0) {
        // Do not play audio here; audio is played after code animation (lesson4_s8)
      }
    }
  } catch (e) {}
  if (motorGears && motorGears.size > 0) {
    console.log('[MotorLesson] updateFunction running, motorGears size:', motorGears.size);
    motorGears.forEach((gear, name) => {
      if (gear && gear.rotation) {
        gear.rotation.x += deltaTime * 0.5;
        console.log(`[MotorLesson] Rotating gear ${name}, rotation.x:`, gear.rotation.x);
      }
    });
  } else {
    console.log('[MotorLesson] updateFunction called but motorGears not ready:', motorGears ? motorGears.size : 'null');
  }
}
