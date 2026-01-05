/**
 * About: `scene6/IRLesson.js`
 *
 * Scene 6 Lesson 5 (IR sensor + remote + motor) implementation.
 * Sets up models, raycasting/drag + snapping steps, UI interactions, and per-frame updates.
 */

"use strict"; // Enable strict mode for safer JavaScript

import * as THREE from "three";
import { RaycasterSetup2 } from "./raycasterSetup.js";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { JstXhFemalePin } from "./JstXhFemalePin2.js";
// Camera animation import removed - all lessons now have consistent camera behavior
import LessonCleaner from "./utils/lessonCleaner.js";
import getWorldPosititon from "./utils/getWorldPosition.js";
import getChildrenMesh from "./utils/getChildrenMesh.js";
import { setForwardArrowEnabled, enableCameraAnimation, runCodeButton, runCodeButtonL345, forwardArrow } from "./ui.js";
import { applyStepShader, handleDragStart as shaderHandleDragStart, handleSnap as shaderHandleSnap, cleanupShader } from "./shaderManager.js";
import { scene6State } from "./scene6State.js";
import ThreeMeshUI from "three-mesh-ui";

let motorGears = null;
let rotationSpeed = 0;
let upKey = false;
let downKey = false;
let leftKey = false;
let rightKey = false;
let remoteKeys = new Map();

/**
 * Lesson 5 (IR sensor) setup.
 * Configures all models, raycasting, snapping logic and keyboard controls for the IR remote + motor demo.
 *
 * @param {THREE.Scene} scene - Active scene6 Three.js scene.
 * @param {THREE.Camera} camera - Active camera for lesson5.
 */
export function KpIRLesson(scene, camera) {
  console.log("KpIRLesson called with scene:", scene, "camera:", camera);
  console.log("Available models:", Object.keys(allAssets.models.gltf || {}));
  
  const lessonCleanner = new LessonCleaner(scene);
  
  function setupCameraAndNext() {
    const straightAhead = new THREE.Vector3(
      camera.position.x,
      camera.position.y,
      camera.position.z - 1
    );
    // Camera animation removed - all lessons now have consistent camera behavior
    setForwardArrowEnabled(true);
  }
  
  function setupKeyControls() {
    window.addEventListener("keydown", (event) => {
      switch (event.key.toLowerCase()) {
        case "w":
          rotationSpeed = 0.5;
          upKey = true;
          break;
        case "s":
          rotationSpeed = -0.5;
          downKey = true;
          break;
        case "a":
          rotationSpeed = 0.25;
          leftKey = true;
          break;
        case "d":
          rotationSpeed = -0.25;
          rightKey = true;
          break;
      }
    });

    window.addEventListener("keyup", (event) => {
      if (["w", "s", "a", "d"].includes(event.key.toLowerCase())) {
        rotationSpeed = 0;
        upKey = false;
        downKey = false;
        leftKey = false;
        rightKey = false;
      }
    });
  }

  async function InitialiseSteps() {
    let stepCounter = 1;
    let irJstPin = null;
    let motorDriverInputJstPin = null; // Store motorDriverInputJstPin for Step7
    
    let raycasterSetup;
    try {
      raycasterSetup = new RaycasterSetup2(
        scene,
        camera,
        () => stepCounter
      );
    } catch (error) {
      console.error("Failed to initialize RaycasterSetup2:", error);
      return;
    }
    
    const arduinoNano = allAssets.models.gltf.nano1;

    const expansionBoard = allAssets.models.gltf.expansionBoard;
    const battery = allAssets.models.gltf.battery2;
    const tsop = allAssets.models.gltf.tsop;
    const remote = allAssets.models.gltf.remote;
    const motorDriver = allAssets.models.gltf.motorDriver;
    const motor = allAssets.models.gltf.motor;

    console.log("Model availability check:", {
      arduinoNano: !!arduinoNano,
      expansionBoard: !!expansionBoard,
      battery: !!battery,
      tsop: !!tsop,
      remote: !!remote,
      motorDriver: !!motorDriver,
      motor: !!motor,
      mainModel: !!allAssets.models.gltf.mainModel
    });

    // Check if all required models are loaded
    if (!arduinoNano || !expansionBoard || !battery || !tsop || !remote || !motorDriver || !motor) {
      console.error("Required models not loaded for KpIRLesson:", {
        arduinoNano: !!arduinoNano,
        expansionBoard: !!expansionBoard,
        battery: !!battery,
        tsop: !!tsop,
        remote: !!remote,
        motorDriver: !!motorDriver,
        motor: !!motor
      });
      return; // Exit early if models are not available
    }

    arduinoNano.rotation.y = - Math.PI * 0.5;
    arduinoNano.scale.set(5, 5, 5);
    arduinoNano.position.set(0, 0.3, 0.2);
    expansionBoard.position.set(-0.4, 0.3, 0.3);
    expansionBoard.rotation.y = -Math.PI * 0.5;
    expansionBoard.scale.set(5, 5, 5);
    battery.position.set(-1, 0.3, 0.4);
    tsop.scale.set(0.3,0.3,0.3);
    tsop.position.set(0.5, 0.3, 0);
    remote.position.set(-1, 0.3, 0);
    motorDriver.position.set(-0.7, 0.3, 0.3);
    motor.position.set(-0.2, 0.3, 0.4);

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

    try {
      table.add(
        arduinoNano,
        expansionBoard,
        battery,
        tsop,
        remote,
        motorDriver,
        motor
      );
    } catch (error) {
      console.error("Failed to add models to table:", error);
      return;
    }
    // Expose models and lesson/step for shader manager
    try {
      scene6State.nanoModel = arduinoNano;
      scene6State.expansionBoardModel = expansionBoard;
      scene6State.tsopModel = tsop;
      scene6State.motorDriverModel = motorDriver;
      scene6State.getCurrentLesson = () => "lesson5";
      scene6State.getCurrentStep = () => stepCounter;
      // Also set on window for backward compatibility
      window.nanoModel = arduinoNano;
      window.expansionBoardModel = expansionBoard;
      window.tsopModel = tsop;
      window.motorDriverModel = motorDriver;
      window.getCurrentLesson = () => "lesson5";
      window.getCurrentStep = () => stepCounter;
    } catch (e) {}

    function Step1() {
      raycasterSetup.addInteractiveObjects(arduinoNano);
      setTimeout(() => { applyStepShader("lesson5", 1); }, 500);

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
          if (distance < 2) {
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
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                Step2();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step2() {
      tsop.position.set(0.3, 0.5, 0);

      irJstPin = new JstXhFemalePin({
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.1, y: 1.8, z: -2.8 } },
          { startPosition: { x: -0.4, y: 1.8, z: -3 } },
        ],
        colors: ["black", "brown", "red"],
        draggablePins: ["pinGLTF1"],
      });
      scene.add(irJstPin.getGroup());
      try { 
        scene6State.jstPin = irJstPin;
        window.jstPin = irJstPin; // Backward compatibility
      } catch (e) {}

      irJstPin.pinGLTF1.rotation.y = Math.PI;

      irJstPin.updatePosition(
        irJstPin.pinGLTF1.position.clone(),
        irJstPin.pinGLTF1
      );
      setTimeout(() => { applyStepShader("lesson5", 2); }, 500);
      const originalOnMouseDown2 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown2.call(raycasterSetup, event);
        try {
          if (raycasterSetup.isDragging && raycasterSetup.draggedComponent instanceof JstXhFemalePin && stepCounter === 2) {
            const draggedObj = raycasterSetup.draggedPinModel || raycasterSetup.draggedComponent?.getGroup?.() || raycasterSetup.draggedComponent;
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

          let irPin = getChildrenMesh(allAssets.models.gltf.tsop, "tsopPin");
          const irPinWorldPosition = getWorldPosititon(irPin);

          const distance = pinPos.distanceTo(irPinWorldPosition);
          console.log("Step 2 distance:", distance);

          if (distance < 1) {
            raycasterSetup.snapObject(
              pinModel,
              irPinWorldPosition,
              irJstPin,
              pinModel,
              () => {
                console.log("JST pin snapped to tsop's pin");
                try { shaderHandleSnap("removeFromTsopPin"); } catch (e) {}
                stepCounter = 3;
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                Step3();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step3() {
      console.log("irJstPin in Step3:", irJstPin);
      if (!irJstPin) {
        console.error("JST pin from Step 2 not found");
        return;
      }

      irJstPin.config.draggablePins = ["pinGLTF2"];
      irJstPin.updateModelDraggability(["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();

      irJstPin.pinGLTF2.rotation.x = Math.PI;
      // irJstPin.pinGLTF2.rotation.y = Math.PI * 0.5;
      irJstPin.updatePosition(
        irJstPin.pinGLTF2.position.clone(),
        irJstPin.pinGLTF2
      );
      setTimeout(() => { applyStepShader("lesson5", 3); }, 500);
      const originalOnMouseDown3 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown3.call(raycasterSetup, event);
        try {
          if (raycasterSetup.isDragging && raycasterSetup.draggedComponent instanceof JstXhFemalePin && stepCounter === 3) {
            const draggedObj = raycasterSetup.draggedPinModel || raycasterSetup.draggedComponent?.getGroup?.() || raycasterSetup.draggedComponent;
            shaderHandleDragStart(draggedObj);
          }
        } catch (e) {}
      };
      let expansionBoardTsopPin = getChildrenMesh(expansionBoard, "tsopPin");

      const expansionBoardTsopPinWorldPosition = getWorldPosititon(
        expansionBoardTsopPin
      );
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

          const distance = pinPos.distanceTo(
            expansionBoardTsopPinWorldPosition
          );
          console.log("Step 3 distance:", distance);

          if (distance < 5.5) {
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardTsopPinWorldPosition,
              irJstPin,
              pinModel,
              () => {
                console.log("JST pin snapped to expansionBoard's tsopPin");
                try { shaderHandleSnap("removeFromTsopPin"); } catch (e) {}
                stepCounter = 4;
                console.log("Step 3 completed");
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                Step4();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step4() {
      let motorPin1 = getChildrenMesh(motor, "motorPin1");
      let motorPin2 = getChildrenMesh(motor, "motorPin2");

      const motorPin1WorldPosition = getWorldPosititon(motorPin1);
      const motorPin2WorldPosition = getWorldPosititon(motorPin2);
      const motorJstPin = new JstXhFemalePin(
        {
          pinCount: 2,
          twoSide: false,
          position: new THREE.Vector3(-0.1, 1.8, -3),
          wireConfigs: [
            {
              startPosition: motorPin1WorldPosition,
              color: 0xff0000,
            },
            {
              startPosition: motorPin2WorldPosition,
              color: 0x00ff00,
            },
          ],
        },
        scene
      );
      scene.add(motorJstPin.getGroup());
      try { 
        scene6State.jstPin = motorJstPin;
        window.jstPin = motorJstPin; // Backward compatibility
      } catch (e) {}

      motorJstPin.pinGLTF1.rotation.y = Math.PI * 0.5;

      motorJstPin.updatePosition(
        motorJstPin.pinGLTF1.position,
        motorJstPin.pinGLTF1
      );
      setTimeout(() => { applyStepShader("lesson5", 4); }, 500);
      const originalOnMouseDown4 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown4.call(raycasterSetup, event);
        try {
          if (raycasterSetup.isDragging && raycasterSetup.draggedComponent instanceof JstXhFemalePin && stepCounter === 4) {
            const draggedObj = raycasterSetup.draggedPinModel || raycasterSetup.draggedComponent?.getGroup?.() || raycasterSetup.draggedComponent;
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

          motorJstPin.originalPinPositions = new Map();
          motorJstPin.originalPinPositions.set(
            motorJstPin.pinGLTF1,
            motorJstPin.pinGLTF1.position.clone()
          );
          const motorPinA = getChildrenMesh(
            motorDriver,
            "motorDriverMotorPin1"
          );

          const motorJstPinWorldPosition = getWorldPosititon(motorPinA);

          const distance = pinPos.distanceTo(motorJstPinWorldPosition);
          console.log("Step 4 distance:", distance);

          if (distance < 2) {
            raycasterSetup.snapObject(
              pinModel,
              motorJstPinWorldPosition,
              motorJstPin,
              pinModel,
              () => {
                console.log("JST pin snapped to motorDriver's pin");
                try { shaderHandleSnap("removeFromMotorDriverPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                stepCounter = 5;
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                Step5();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step5() {
      arduinoNano.rotation.y = Math.PI * 0.5;
      expansionBoard.rotation.y = Math.PI * 0.5;
      const irPinExpansionBoard = getChildrenMesh(expansionBoard, "tsopPin");
      console.log(irPinExpansionBoard);

      const irPinExpansionBoardWorldPosition =
        getWorldPosititon(irPinExpansionBoard);
      irJstPin.pinGLTF2.position.copy(irPinExpansionBoardWorldPosition);
      irJstPin.updatePosition(
        irJstPin.pinGLTF1.position.clone(),
        irJstPin.pinGLTF2
      );

      motorDriverInputJstPin = new JstXhFemalePin({
        pinCount: 4,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0, y: 1.8, z: -3 } },
          { startPosition: { x: -0.4, y: 1.8, z: -3 } },
        ],
        colors: ["black", "brown", "red", "green"],
        draggablePins: ["pinGLTF1"],
      });

      scene.add(motorDriverInputJstPin.getGroup());
      motorDriverInputJstPin.pinGLTF2.rotation.x = Math.PI;
      // motorDriverInputJstPin.pinGLTF1.rotation.y = -Math.PI * 0.5;

      motorDriverInputJstPin.updatePosition(
        motorDriverInputJstPin.pinGLTF2.position.clone(),
        motorDriverInputJstPin.pinGLTF2
      );
      try { 
        scene6State.jstPin = motorDriverInputJstPin;
        window.jstPin = motorDriverInputJstPin; // Backward compatibility
      } catch (e) {}
      setTimeout(() => { applyStepShader("lesson5", 5); }, 500);
      const originalOnMouseDown5 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown5.call(raycasterSetup, event);
        try {
          if (raycasterSetup.isDragging && raycasterSetup.draggedComponent instanceof JstXhFemalePin && stepCounter === 5) {
            const draggedObj = raycasterSetup.draggedPinModel || raycasterSetup.draggedComponent?.getGroup?.() || raycasterSetup.draggedComponent;
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
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);

          const localMotorDriverPin = getChildrenMesh(
            expansionBoard,
            "motordriverPin"
          );

          const motorInputPinWorldPosition =
            getWorldPosititon(localMotorDriverPin);

          const distance = pinPos.distanceTo(motorInputPinWorldPosition);
          console.log("Step 5 distance:", distance);

          if (distance < 2) {
            raycasterSetup.snapObject(
              pinModel,
              motorInputPinWorldPosition,
              motorDriverInputJstPin,
              pinModel,
              () => {
                console.log("JST pin snapped to motorDriver's input pin");
                try { shaderHandleSnap("removeFromMotorDriverInputPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                stepCounter = 6;
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                Step6();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step6() {
      console.log("Step6: motorDriverInputJstPin:", motorDriverInputJstPin);

      let motorDriverInputPin = getChildrenMesh(
        motorDriver,
        "motorDriverInputPin"
      );

      motorDriverInputJstPin.config.draggablePins = ["pinGLTF2"];
      motorDriverInputJstPin.updateModelDraggability(["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();

      motorDriverInputJstPin.pinGLTF2.rotation.y = Math.PI * 0.5;
      motorDriverInputJstPin.updatePosition(
        motorDriverInputJstPin.pinGLTF2.position.clone(),
        motorDriverInputJstPin.pinGLTF2
      );
      try { 
        scene6State.jstPin = motorDriverInputJstPin;
        window.jstPin = motorDriverInputJstPin; // Backward compatibility
      } catch (e) {}
      setTimeout(() => { applyStepShader("lesson5", 6); }, 500);
      const originalOnMouseDown6 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown6.call(raycasterSetup, event);
        try {
          if (raycasterSetup.isDragging && raycasterSetup.draggedComponent instanceof JstXhFemalePin && stepCounter === 6) {
            const draggedObj = raycasterSetup.draggedPinModel || raycasterSetup.draggedComponent?.getGroup?.() || raycasterSetup.draggedComponent;
            shaderHandleDragStart(draggedObj);
          }
        } catch (e) {}
      };

      const motorDriverMotorInputPinWorldPosition =
        getWorldPosititon(motorDriverInputPin);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === motorDriverInputJstPin &&
          stepCounter === 6
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);

          const distance = pinPos.distanceTo(
            motorDriverMotorInputPinWorldPosition
          );
          console.log("Step 6 distance:", distance);

          if (distance < 5.5) {
            raycasterSetup.snapObject(
              pinModel,
              motorDriverMotorInputPinWorldPosition,
              motorDriverInputJstPin,
              pinModel,
              () => {
                console.log("JST pin snapped to motorDriver's input pin");
                stepCounter = 7;
                console.log("Step 6 completed");
                try { shaderHandleSnap("removeFromMotorDriverInputPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                Step7();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step7() {
      const batteryPositiveTerminal = getChildrenMesh(
        battery,
        "positiveTerminal"
      );
      const batteryNegativeTerminal = getChildrenMesh(
        battery,
        "negativeTerminal"
      );
      console.log(batteryPositiveTerminal, batteryNegativeTerminal);

      const batteryPositiveTerminalWorldPosition = getWorldPosititon(
        batteryPositiveTerminal
      );
      const batteryNegativeTerminalWorldPosition = getWorldPosititon(
        batteryNegativeTerminal
      );

      const batteryWire1 = new JstXhFemalePin(
        {
          pinCount: 2,
          twoSide: false,
          position: new THREE.Vector3(-0.5, 1.8, -3.5),
          wireConfigs: [
            {
              startPosition: batteryPositiveTerminalWorldPosition,
              color: 0xff0000,
            },
            {
              startPosition: batteryNegativeTerminalWorldPosition,
              color: 0x00ff00,
            },
          ],
        },
        scene
      );
      scene.add(batteryWire1.getGroup());
      try { 
        scene6State.jstPin = batteryWire1;
        window.jstPin = batteryWire1; // Backward compatibility
      } catch (e) {}

      batteryWire1.pinGLTF1.rotation.y = -Math.PI * 0.5;
      batteryWire1.updatePosition(
        batteryWire1.pinGLTF1.position,
        batteryWire1.pinGLTF1
      );
      const motorDriverPowerPin = getChildrenMesh(
        motorDriver,
        "motorDriverPowerPin"
      );
      const motorDriverPowerPinWorldPosition =
        getWorldPosititon(motorDriverPowerPin);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      setTimeout(() => { applyStepShader("lesson5", 7); }, 500);
      const originalOnMouseDown7 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown7.call(raycasterSetup, event);
        try {
          if (raycasterSetup.isDragging && raycasterSetup.draggedComponent instanceof JstXhFemalePin && stepCounter === 7) {
            const draggedObj = raycasterSetup.draggedPinModel || raycasterSetup.draggedComponent?.getGroup?.() || raycasterSetup.draggedComponent;
            shaderHandleDragStart(draggedObj);
          }
        } catch (e) {}
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          stepCounter === 7
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);

          const distance = pinPos.distanceTo(motorDriverPowerPinWorldPosition);
          console.log("Step 7 distance:", distance);

          if (distance < 2) {
            raycasterSetup.snapObject(
              pinModel,
              motorDriverPowerPinWorldPosition,
              batteryWire1,
              pinModel,
              () => {
                console.log("JST pin snapped to motorDriver's power pin");
                try { shaderHandleSnap("removeFromMotorDriverPowerPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                stepCounter = 8;
                setTimeout(() => { setupCameraAndNext(); }, 2000);
                Step8();
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    function Step8() {
      const batteryPositiveTerminal = getChildrenMesh(
        battery,
        "positiveTerminal"
      );
      const batteryNegativeTerminal = getChildrenMesh(
        battery,
        "negativeTerminal"
      );
      const batteryPositiveTerminalWorldPosition = getWorldPosititon(
        batteryPositiveTerminal
      );
      const batteryNegativeTerminalWorldPosition = getWorldPosititon(
        batteryNegativeTerminal
      );

      const batteryWire2 = new JstXhFemalePin(
        {
          pinCount: 2,
          twoSide: false,
          position: new THREE.Vector3(-0.5, 1.8, -3.5),
          wireConfigs: [
            {
              startPosition: batteryPositiveTerminalWorldPosition,
              color: 0xff0000,
            },
            {
              startPosition: batteryNegativeTerminalWorldPosition,
              color: 0x00ff00,
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
      try { 
        scene6State.jstPin = batteryWire2;
        window.jstPin = batteryWire2; // Backward compatibility
      } catch (e) {}
      try { window.batteryWire2 = batteryWire2.pinGLTF1; } catch (e) {}
      setTimeout(() => { applyStepShader("lesson5", 8); }, 500);
      const originalOnMouseDown8 = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown8.call(raycasterSetup, event);
        try {
          if (raycasterSetup.isDragging && raycasterSetup.draggedComponent instanceof JstXhFemalePin && stepCounter === 8) {
            const draggedObj = raycasterSetup.draggedPinModel || raycasterSetup.draggedComponent?.getGroup?.() || raycasterSetup.draggedComponent;
            shaderHandleDragStart(draggedObj);
          }
        } catch (e) {}
      };

      const expansionBoardPowerPin = getChildrenMesh(
        expansionBoard,
        "powerPin"
      );
      const expansionBoardPowerPinWorldPosition = getWorldPosititon(
        expansionBoardPowerPin
      );

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          stepCounter === 8
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);

          const distance = pinPos.distanceTo(
            expansionBoardPowerPinWorldPosition
          );
          console.log("Step 8 distance:", distance);

          if (distance < 2) {
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardPowerPinWorldPosition,
              batteryWire2,
              pinModel,
              () => {
                console.log("JST pin snapped to expansionBoard's power pin");
                stepCounter = 10;
                console.log("Step 8 completed");
                try { shaderHandleSnap("removeFromPowerPin"); } catch (e) {}
                try { cleanupShader(); } catch (e) {}
                // Animate camera straight ahead, then show Start Coding and hide Next
                try {
                  const straightAhead = new THREE.Vector3(
                    camera.position.x,
                    camera.position.y,
                    camera.position.z - 1
                  );
                  // Camera animation removed - all lessons now have consistent camera behavior
                  setTimeout(() => {
                    // Delayed by 2s before showing Start Coding
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
                      
                      console.log("Start Coding button (L345) shown for lesson5");
                    }
                  });
                } catch (e) {}
              }
            );
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }



    function Step10() {
      // console.log(scene);

      // lessonCleanner.removeObjects();
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
      console.log(motorGears);
      const names = ["leftButton", "rightButton", "frontButton", "backButton"];
      remote.traverse((child) => {
        if (names.includes(child.name)) {
          remoteKeys.set(child.name, child);
        }
      });
      //   console.log(remoteKeys.size);

      setupKeyControls();
      
      // Keep Next button hidden/disabled for the final step in lesson5
      try { if (typeof setForwardArrowEnabled === 'function') setForwardArrowEnabled(false); } catch (e) {}
      try { if (typeof forwardArrow !== 'undefined' && forwardArrow) forwardArrow.visible = false; } catch (e) {}
    }

    // Expose inner Step10 so external handlers (Continue button) can start it after camera animation
    try { window._startLesson5Step10Inner = Step10; } catch (e) {}

    Step1();
  }

  InitialiseSteps();

  // Expose Lesson 5 full starter so it can be triggered if initialization is needed
  try {
    window.startLesson5 = () => {
      try { if (typeof stepCounter !== 'undefined') stepCounter = 1; } catch (e) {}
      InitialiseSteps();
    };
  } catch (e) {}

  // Expose Lesson 5 Step10 trigger so it runs only after Continue button camera animation completes
  try {
    window.startLesson5Step10 = () => {
      try { if (typeof stepCounter !== 'undefined') stepCounter = 10; } catch (e) {}
      try { if (typeof window._startLesson5Step10Inner === 'function') window._startLesson5Step10Inner(); } catch (e) {}
    };
  } catch (e) {}
}

/**
 * Update the remote key meshes based on current WASD key state.
 *
 * @returns {void}
 */
function updateRemoteKeys() {
  let frontButton = remoteKeys.get("frontButton");
  let backButton = remoteKeys.get("backButton");
  let leftButton = remoteKeys.get("leftButton");
  let rightButton = remoteKeys.get("rightButton");

  frontButton.position.z = 0.015;
  backButton.position.z = 0.015;
  leftButton.position.z = 0.015;
  rightButton.position.z = 0.015;

  if (upKey) {
    frontButton.position.z = 0.01;
  }
  if (downKey) {
    backButton.position.z = 0.01;
  }
  if (leftKey) {
    leftButton.position.z = 0.01;
  }
  if (rightKey) {
    rightButton.position.z = 0.01;
  }
}

/**
 * Per-frame update for lesson5 (IR sensor).
 * Rotates gears based on current rotationSpeed and updates remote key press depth.
 *
 * @param {number} deltaTime - Time since last frame in seconds.
 */
export function updateFunction(deltaTime) {
  if (motorGears) {
    motorGears.forEach((gear) => {
      gear.rotation.x += deltaTime * rotationSpeed;
    });

    if (remoteKeys.size) {
      updateRemoteKeys();
    }
  }
}
