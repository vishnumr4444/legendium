import { allAssets } from "../commonFiles/assetsLoader.js";
import { JstXhFemalePin } from "./JstXhFemalePin2";
import { RaycasterSetup2 } from "./raycasterSetup2";
import { BlinkMesh, HideMesh } from "./utils/blinkMesh";
import {
  getDistance,
  setupForNextSetup,
  snappingEffect,
} from "./utils/botBuildingHelperModules";
import getChildrenMesh from "./utils/getChildrenMesh";
import getWorldPosititon from "./utils/getWorldPosition";
import Sidepanel from "./utils/sidePannel";
import * as THREE from "three";
import { gsap } from "gsap";
import { AudioHandler } from "./utils/audioHandler";
import { SubtitleSystem, VideoPlayer } from "./utils/subtitleSystem.js";
import { showIndication } from "./utils/indicationMarker";

/**
 * Core controller for the scene7 "Bot Building" interactive tutorial.
 *
 * It wires together:
 * - Asset references (`allAssets`) and lookups into the robotics lab scene
 * - Step tracking and text instructions (`botBuildingSteps`)
 * - Drag/drop interactions (`RaycasterSetup2`, `JstXhFemalePin`, side panel)
 * - Highlighting / hiding meshes (`BlinkMesh`, `HideMesh`)
 * - VO audio per step (`AudioHandler` + `allAssets.audios.stepX`)
 * - Subtitle + video outro flow (`SubtitleSystem`, `VideoPlayer`)
 *
 * This function is intentionally stateful and large; most reusable logic
 * lives in the `scene7/utils` helpers referenced above.
 */

export function BotBuilding(scene, camera, controls, renderer) { // Added renderer
  let stepCounter = 1; // Track current step
  let chargingModuleWire = null;
  let batteryWire = null;
  let motor1Wire = null;
  let motor2Wire = null;
  let bucConverterOutputWire = null;
  let buckConverterInputWire = null;
  let botSwitchWire = null;
  let motorDriverJstPowerWire = null;
  let motorDriverInputWire = null;
  let rightRbgModuleWire = null;
  let leftRbgModuleWire = null;
  let tsopJstWire = null;
  let pushButtonJstWire = null;
  let buzzerJstWire = null;
  let ldrJstWire = null;
  const subtitleSystem = new SubtitleSystem(scene, camera); // Pass params if your class needs them
  const videoPlayer = new VideoPlayer();
  const botFemalePins = [
    "buzzerPinFemalePin",
    "expansionBoardButtonFemalePin",
    "expansionBoardBuzzerFemale",
    "expansionBoardLdrFemalePin",
    "expansionBoardMotorDriverFemalePin",
    "expansionBoardRgb1FemalePin",
    "expansionBoardRgb2FemalePin",
    "expansionBoardTsopFemalePin",
    "expansionBordPowerFemalePin",
    "ldrFemalePin",
    "motorDriverPowerFemalePin",
    "powerDistributionBatteryFemalePin",
    "powerDistributionChargingModuleFemalePin",
    "powerDistributionMotorDriverFemalePin",
    "powerDistributionSwitchFemalePin",
    "powerDistributionUbecFemalePin",
    "rightRgbFemalePin",
    "tsopFemalePin",
    "PushButtonFemalePin",
    "rgbLeftFemalePin",
  ];
  const botMalePins = [
    "buzzerSensorMalePin",
    "expansionBoardButtonMalePin",
    "expansionBoardBuzzerMalePin",
    "expansionBoardLdrMalePin",
    "expansionBoardMotorDriverMalePin",
    "expansionBoardPowerMalePin",
    "expansionBoardRgb1MalePin",
    "expansionBoardRgb2MalePin",
    "expansionBoardTsopMalePin",
    "motorDriverPowerMalePin",
    "ldrMalePin",
    "leftRgbMalePin",
    "powerDistributionBatteryMalePin",
    "powerDistributionMotorDriverMalePin",
    "powerDistributionSwitchMalePin",
    "powerDistributionUbecMalePin",
    "powerDistributionChargingModuleMalePin",
    "pushButtonMalePin",
    "rightRgbMalePin",
    "tsopMalePin",
  ];
  const botWires = [
    "batteryWire",
    "buttonWire",
    "buzzerWire",
    "chargingModuleWire",
    "leftLedWire",
    "ldrWire",
    "motorDriverPowerWire",
    "motorInputWire",
    "motorWire1",
    "motorWire2",
    "rightLedWire",
    "powerWire",
    "switchWire",
    "tsopWire",
    "ubecWire",
  ];
  const botTerminals = [
    "motor1Terminal1",
    "motor1Terminal2",
    "motor2Terminal1",
    "motor2Terminal2",
    "motorDriverMotorsPin2",
    "motorDriverMotorsPin1",
    "motorDriverInputPin",
    "switchTerminal1",
    "switchTerminal2",
    "switchTerminal3",
    "bucConverterNegativeTerminal",
    "bucConverterPositiveTerminal",
    "batteryNegativeTerminal",
    "batteryPositiveTerminal",
    "bucConverterPowerPositiveTerminal",
    "buckConverterPowerNegativeTerminal",
    "chargingModuleNegativeTerminal",
    "chargingModulePositiveTerminal",
  ];
  const botComponents = [
    "botBody",
    "chargingModule",
    "motor1",
    "motor2",
    "battery",
    "motorCasing",
    "motorDriver",
    "bucConverter",
    "powerDistributionBoard",
    "arduinoNano",
    "botClosingCase",
    "botMiddleCase",
    "botMiddleClip1",
    "botMiddleClip2",
    "botMiddleClip3",
    "botMiddleClip4",
    "buzzerSensor",
    "expansionBoard",
    "frontPannel",
    "ldrSensor",
    "leftEye",
    "pushButton",
    "rgbModuleLeft",
    "rgbModuleRight",
    "rightEye",
    "switch",
    "topCase",
    "tsopSensor",
    "tyre1",
    "tyre2",
    "tyre3",
    "tyre4",
    "tyreCase1",
    "tyreCase2",
    "tyreCase3",
    "tyreCase4",
  ];
  const botBuildingSteps = [
    "Drag and drop the bot body to the blinking part position", //step1
    "Drag and drop the charging module to the blinking part position", //step2
    "Drag and drop the motor to the blinking part position", //step3
    "Drag and drop the motor to the blinking part position", //step4
    "Drag and drop the battery holder to the blinking part position", //step5
    "Drag and drop the motor casing to the blinking part position", //step6
    "Drag and drop the motor driver to the blinking part position", //step7
    "Connect the motor wire to the motor driver motor pin", //step8
    "Connect the motor wire to the motor driver motor pin", //step9
    "Drag and drop the buck converter to the blinking part position", //step10
    "Drag and drop the switch to the blinking part position", //step11
    "Drag and drop the power distribution board to the blinking part position", //step12
    "Connect the charging module wire to the power distribution board", //step13
    "Connect the battery wire to the power distribution board", //step14
    "Connect the switch wire to the power distribution board", //step15
    "Connect the buck converter wire to the power distribution board", //step16
    "Connect the wire to the motor driver power port", //step17
    "Connect the other end of the wire to the power distribution board", //step18
    "Connect the wire to the motor driver input pin", //step19
    "Drag and drop the bot closing case to the blinking part position", //step20
    "Drag and drop the supporting clip to the blinking part position", //step21
    "Drag and drop the bot middle case to the blinking part position", //step22
    "Drag and drop the expansion board to the blinking part position", //step23
    "Connect the buck converter output wire to the power pin of the expansion board", //step24
    "Connect the other end of the motor driver input pin to the motor driver port of the expansion board", //step25
    "Drag and drop the bot front panel to the blinking part position", //step26
    "Drag and drop the left eye to the blinking part position", //step27
    "Drag and drop the right eye to the blinking part position", //step28
    "Drag and drop the left RGB module to the blinking part position", //step29
    "Drag and drop the right RGB module to the blinking part position", //step30
    "Drag and drop the Arduino Nano to the blinking part position", //step31
    "Connect the wire to the left RGB module", //step32
    "Connect the other end of the wire to the expansion board RGB port", //step33
    "Connect the wire to the right RGB module", //step34
    "Connect the other end of the wire to the expansion board RGB port", //step35
    "Drag and drop the top case to the blinking part position", //step36
    "Drag and drop the TSOP sensor to the blinking part position", //step37
    "Connect the wire to the TSOP sensor", //step38
    "Drag and drop the push button to the blinking part position", //step39
    "Connect the wire to the push button", //step40
    "Drag and drop the buzzer sensor to the blinking part position", //step41
    "Connect the wire to the buzzer sensor", //step42
    "Drag and drop the LDR sensor to the blinking part position", //step43
    "Connect the wire to the LDR sensor", //step44
    "Connect the other end of the wire from the TSOP sensor to the TSOP port of the expansion board", //step45
    "Connect the other end of the wire from the push button to the button port of the expansion board", //step46
    "Connect the other end of the wire from the buzzer to the buzzer port of the expansion board", //step47
    "Connect the other end of the wire from the LDR to the LDR port of the expansion board", //step48
    "Drag and drop the tyre case to the blinking part position", //step49
    "Drag and drop the tyre to the blinking part position", //step50
  ];
  const assembeldBot = allAssets.models.gltf.assembeldBot;
  assembeldBot.position.set(-0.2, 0.33, 0);

  // Copying bot parts and their world position
  const assembeldBotCopy = new Map();
  const assembeldBotOrginal = new Map();
  const wiresMap = new Map();
  const botFemalePinsMap = new Map();
  const botMalePinsMap = new Map();
  const botTerminalsMap = new Map();
  botComponents.forEach((name) => {
    assembeldBot.traverse((child) => {
      const part = {};
      if (child.name === name) {
        part.mesh = child.clone();
        part.worldPosition = getWorldPosititon(part.mesh);
        assembeldBotCopy.set(child.name, part);
        child.visible = false;
        assembeldBotOrginal.set(child.name, child);
      }
    });
  });
  botWires.forEach((name) => {
    assembeldBot.traverse((child) => {
      const part = {};
      if (child.name === name) {
        part.mesh = child;
        part.worldPosition = getWorldPosititon(part.mesh);
        wiresMap.set(child.name, part);
        child.visible = false;
      }
    });
  });
  botFemalePins.forEach((name) => {
    assembeldBot.traverse((child) => {
      const part = {};
      if (child.name === name) {
        part.mesh = child;
        part.worldPosition = getWorldPosititon(part.mesh);
        botFemalePinsMap.set(child.name, part);
        child.visible = false;
      }
    });
  });
  botMalePins.forEach((name) => {
    assembeldBot.traverse((child) => {
      const part = {};
      if (child.name === name) {
        part.mesh = child;
        part.worldPosition = getWorldPosititon(part.mesh);
        botMalePinsMap.set(child.name, part);
        child.visible = false;
      }
    });
  });
  botTerminals.forEach((name) => {
    assembeldBot.traverse((child) => {
      const part = {};
      if (child.name === name) {
        part.mesh = child;
        part.mesh.visible = false;
        part.worldPosition = getWorldPosititon(part.mesh);
        botTerminalsMap.set(child.name, part);
        child.visible = false;
      }
    });
  });
  const distanceValue = 2;
  const raycasterSetup = new RaycasterSetup2(
    scene,
    camera,
    controls,
    () => stepCounter
  );
  console.log(assembeldBotCopy);

  
  // Side panel initialized with the first step's meshs
  const sidepanelInstance = Sidepanel(
    assembeldBotCopy.get("botBody").mesh,
    allAssets.textures.botBase,
    botBuildingSteps[0]
  );
  raycasterSetup.addSidePanelObjects(...sidepanelInstance.elements);

  let table = getChildrenMesh(allAssets.models.gltf.roboticsLab, "table2");
  table.add(assembeldBot);

  async function InitialiseSteps() {
    async function Step1() {
      const botBody = assembeldBotOrginal.get("botBody");
      botBody.visible = true;
      const botBodyBlink = BlinkMesh([botBody]);

      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "botBody" &&
          stepCounter === 1
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, botBody);

          if (distance < distanceValue) {
            botBodyBlink();

            snappingEffect(botBody, [0, 0.04, 0]);
            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 2;

                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.chargingModule,
                  "chargingModule",
                  botBuildingSteps[stepCounter - 1]
                );
                Step2();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    async function Step2() {
      const chargingModuleNegativeTerminal = botTerminalsMap.get(
        "chargingModuleNegativeTerminal"
      ).mesh;
      const chargingModulePositiveTerminal = botTerminalsMap.get(
        "chargingModulePositiveTerminal"
      ).mesh;
      // sidepanelInstance.updateTextOnly(botBuildingSteps[stepCounter - 1]);
      const chargingModule = assembeldBotOrginal.get("chargingModule");
      chargingModule.visible = true;
      chargingModulePositiveTerminal.visible = true;
      chargingModuleNegativeTerminal.visible = true;

      const chargingModuleBlinking = BlinkMesh([
        chargingModule,
        chargingModuleNegativeTerminal,
        chargingModulePositiveTerminal,
      ]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;

      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "chargingModule" &&
          stepCounter === 2
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            chargingModule
          );

          if (distance < distanceValue) {
            chargingModuleBlinking();

            snappingEffect(chargingModule, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                chargingModuleWire = new JstXhFemalePin({
                  pinCount: 2,
                  twoSide: false,
                  position: new THREE.Vector3(0, 1.8, -3.5),
                  wireConfigs: [
                    {
                      startPosition: getWorldPosititon(
                        chargingModulePositiveTerminal
                      ),
                      color: 0xff0000, // Red
                    },
                    {
                      startPosition: getWorldPosititon(
                        chargingModuleNegativeTerminal
                      ),
                      color: 0x00ff00, // Green
                    },
                  ],
                  draggable: false, // Non-draggable
                });
                chargingModuleWire.pinGLTF1.rotation.y = Math.PI * 0.5;
                chargingModuleWire.updatePosition(
                  new THREE.Vector3(),
                  chargingModuleWire.pinGLTF1
                );
                scene.add(chargingModuleWire.getGroup());
                stepCounter = 3;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.motor,
                  "motor1",
                  botBuildingSteps[stepCounter - 1]
                );

                Step3();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motor 1 snapping
    async function Step3() {
      const motor1 = assembeldBotOrginal.get("motor1");
      motor1.visible = true;
      const motorTerminal1 = botTerminalsMap.get("motor1Terminal1");
      const motorTerminal2 = botTerminalsMap.get("motor1Terminal2");

      const motor1Blinking = BlinkMesh([motor1]);

      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "motor1" &&
          stepCounter === 3
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, motor1);

          if (distance < distanceValue) {
            motor1Blinking();

            snappingEffect(motor1, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                motorTerminal1.mesh.visible = true;
                motorTerminal2.mesh.visible = true;

                motor1Wire = new JstXhFemalePin({
                  pinCount: 2,
                  twoSide: false,
                  position: new THREE.Vector3(0, 1.8, -3.2),
                  wireConfigs: [
                    {
                      startPosition: getWorldPosititon(motorTerminal1.mesh),
                      color: 0xff0000, // Red
                    },
                    {
                      startPosition: getWorldPosititon(motorTerminal2.mesh),
                      color: 0x00ff00, // Green
                    },
                  ],
                  draggable: false, // Non-draggable initially
                });
                motor1Wire.pinGLTF1.rotation.y = Math.PI * 0.5;
                motor1Wire.updatePosition(
                  new THREE.Vector3(),
                  motor1Wire.pinGLTF1
                );
                // console.log(motor1Wire);

                scene.add(motor1Wire.getGroup());
                stepCounter = 4;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.motor,
                  "motor2",
                  botBuildingSteps[stepCounter - 1]
                );

                Step4();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motor2
    async function Step4() {
      const motor2 = assembeldBotOrginal.get("motor2");
      motor2.visible = true;
      const motorTerminal1 = botTerminalsMap.get("motor2Terminal1");
      const motorTerminal2 = botTerminalsMap.get("motor2Terminal2");
      const motor2Blinking = BlinkMesh([motor2]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "motor2" &&
          stepCounter === 4
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, motor2);

          if (distance < distanceValue) {
            motor2Blinking();

            snappingEffect(motor2, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                motorTerminal1.mesh.visible = true;
                motorTerminal2.mesh.visible = true;

                motor2Wire = new JstXhFemalePin({
                  pinCount: 2,
                  twoSide: false,
                  position: new THREE.Vector3(0, 1.8, -3),
                  wireConfigs: [
                    {
                      startPosition: getWorldPosititon(motorTerminal1.mesh),
                      color: 0xff0000, // Red
                    },
                    {
                      startPosition: getWorldPosititon(motorTerminal2.mesh),
                      color: 0x00ff00, // Green
                    },
                  ],
                  draggable: false,
                });
                motor2Wire.pinGLTF1.rotation.y = Math.PI * 0.5;
                motor2Wire.updatePosition(
                  new THREE.Vector3(),
                  motor2Wire.pinGLTF1
                );
                scene.add(motor2Wire.getGroup());
                stepCounter = 5;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.batteryCase,
                  "battery",
                  botBuildingSteps[stepCounter - 1]
                );

                Step5();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Battery
    async function Step5() {
      const batteryNegativeTerminal = botTerminalsMap.get(
        "batteryNegativeTerminal"
      ).mesh;
      const batteryPositiveTerminal = botTerminalsMap.get(
        "batteryPositiveTerminal"
      ).mesh;
      const battery = assembeldBotOrginal.get("battery");
      battery.visible = true;

      const batteryBlinking = BlinkMesh([battery]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "battery" &&
          stepCounter === 5
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, battery);

          if (distance < distanceValue) {
            batteryBlinking();
            snappingEffect(battery, [0, 0.04, 0]);
            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                batteryWire = new JstXhFemalePin({
                  pinCount: 2,
                  twoSide: false,
                  position: new THREE.Vector3(0, 1.8, -2.8),
                  wireConfigs: [
                    {
                      startPosition: getWorldPosititon(batteryPositiveTerminal),
                      color: 0xff0000, // Red
                    },
                    {
                      startPosition: getWorldPosititon(batteryNegativeTerminal),
                      color: 0x00ff00, // Green
                    },
                  ],
                  draggable: false, // Non-draggable
                });
                batteryWire.pinGLTF1.rotation.y = Math.PI * 0.5;
                batteryWire.updatePosition(
                  new THREE.Vector3(),
                  batteryWire.pinGLTF1
                );
                scene.add(batteryWire.getGroup());
                stepCounter = 6;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.motorCasing,
                  "motorCasing",
                  botBuildingSteps[stepCounter - 1]
                );

                Step6();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motor casing
    async function Step6() {
      const motorCasing = assembeldBotOrginal.get("motorCasing");
      motorCasing.visible = true;
      const motorCasingBlinking = BlinkMesh([motorCasing]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "motorCasing" &&
          stepCounter === 6
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            motorCasing
          );

          if (distance < distanceValue) {
            motorCasingBlinking();

            snappingEffect(motorCasing, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 7;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.motorDriver,
                  "motorDriver",
                  botBuildingSteps[stepCounter - 1]
                );

                Step7();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motor Driver
    async function Step7() {
      const motorDriverMotorsPin2 = botTerminalsMap.get(
        "motorDriverMotorsPin2"
      ).mesh;
      const motorDriverMotorsPin1 = botTerminalsMap.get(
        "motorDriverMotorsPin1"
      ).mesh;
      const motorDriverInputPin = botTerminalsMap.get(
        "motorDriverInputPin"
      ).mesh;
      const motorDriverPowerMalePin = botMalePinsMap.get(
        "motorDriverPowerMalePin"
      ).mesh;
      const motorDriver = assembeldBotOrginal.get("motorDriver");
      motorDriver.visible = true;
      motorDriverMotorsPin2.visible = true;
      motorDriverMotorsPin1.visible = true;
      motorDriverInputPin.visible = true;
      motorDriverPowerMalePin.visible = true;
      const motorDriverBlinking = BlinkMesh([
        motorDriver,
        motorDriverMotorsPin2,
        motorDriverMotorsPin1,
        motorDriverInputPin,
        motorDriverPowerMalePin,
      ]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "motorDriver" &&
          stepCounter === 7
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            motorDriver
          );

          if (distance < distanceValue) {
            motorDriverBlinking();

            snappingEffect(motorDriver, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 8;
                raycasterSetup.updateStep(stepCounter);
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );

                Step8();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motor1 connection
    async function Step8() {
      const motorDriverMotorsPin = botTerminalsMap.get(
        "motorDriverMotorsPin1"
      ).mesh;
      const motor1WireBlinking = BlinkMesh([
        motor1Wire.getGroup(),
        motorDriverMotorsPin,
      ]);
      motor1Wire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();

      const indication = showIndication(
        scene,
        camera,
        motorDriverMotorsPin,
        motor1Wire.pinGLTF1
      );

      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === motor1Wire &&
          stepCounter === 8
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const motorDriverMotorsPinWorldPosition =
            getWorldPosititon(motorDriverMotorsPin);

          const distance = pinPos.distanceTo(motorDriverMotorsPinWorldPosition);

          if (distance < distanceValue) {
            motor1WireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(motorDriverMotorsPin),
              motor1Wire,
              pinModel,
              () => {
                indication.cleanup();
                const motor1WireOrginal = wiresMap.get("motorWire1");
                motor1WireOrginal.mesh.visible = true;
                motor1Wire.dispose();
                motor1Wire = null;
                stepCounter = 9;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step9();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motor Connection2
    async function Step9() {
      const motorDriverMotorsPin = botTerminalsMap.get(
        "motorDriverMotorsPin2"
      ).mesh;
      const motor2WireBlinking = BlinkMesh([
        motor2Wire.getGroup(),
        motorDriverMotorsPin,
      ]);

      raycasterSetup.refreshPinModelsRef();

      const indication = showIndication(
        scene,
        camera,
        motorDriverMotorsPin,
        motor2Wire.pinGLTF1
      );
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      motor2Wire.setDraggable(true, ["pinGLTF1"]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === motor2Wire &&
          stepCounter === 9
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const motorDriverMotorsPinWorldPosition =
            getWorldPosititon(motorDriverMotorsPin);

          const distance = pinPos.distanceTo(motorDriverMotorsPinWorldPosition);

          if (distance < distanceValue) {
            motor2WireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(motorDriverMotorsPin),
              motor2Wire,
              pinModel,
              () => {
                indication.cleanup();
                const motor2WireOrginal = wiresMap.get("motorWire2");
                motor2WireOrginal.mesh.visible = true;
                motor2Wire.dispose();
                motor2Wire = null;
                stepCounter = 10;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.buckConverter,
                  "bucConverter",
                  botBuildingSteps[stepCounter - 1]
                );

                Step10();
                // Proceed to next step if needed
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Buck cinverter
    async function Step10() {
      const bucConverterPowerPositiveTerminal = botTerminalsMap.get(
        "bucConverterPowerPositiveTerminal"
      ).mesh;
      const buckConverterPowerNegativeTerminal = botTerminalsMap.get(
        "buckConverterPowerNegativeTerminal"
      ).mesh;
      const bucConverterNegativeTerminal = botTerminalsMap.get(
        "bucConverterNegativeTerminal"
      ).mesh;
      const bucConverterPositiveTerminal = botTerminalsMap.get(
        "bucConverterPositiveTerminal"
      ).mesh;
      const bucConverter = assembeldBotOrginal.get("bucConverter");
      bucConverter.visible = true;
      const bucConverterBlinking = BlinkMesh([bucConverter]);
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "bucConverter" &&
          stepCounter === 10
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            bucConverter
          );

          if (distance < distanceValue) {
            bucConverterBlinking();

            snappingEffect(bucConverter, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                bucConverterOutputWire = new JstXhFemalePin({
                  pinCount: 2,
                  twoSide: false,
                  position: new THREE.Vector3(0, 1.8, -3.2),
                  wireConfigs: [
                    {
                      startPosition: getWorldPosititon(
                        bucConverterPowerPositiveTerminal
                      ),
                      color: 0xff0000, // Red
                    },
                    {
                      startPosition: getWorldPosititon(
                        buckConverterPowerNegativeTerminal
                      ),
                      color: 0x00ff00, // Green
                    },
                  ],
                  draggable: false, // Non-draggable
                });

                scene.add(bucConverterOutputWire.getGroup());

                buckConverterInputWire = new JstXhFemalePin({
                  pinCount: 2,
                  twoSide: false,
                  position: new THREE.Vector3(0, 1.8, -3.1),
                  wireConfigs: [
                    {
                      startPosition: getWorldPosititon(
                        bucConverterNegativeTerminal
                      ),
                      color: 0xff0000, // Red
                    },
                    {
                      startPosition: getWorldPosititon(
                        bucConverterPositiveTerminal
                      ),
                      color: 0x00ff00, // Green
                    },
                  ],
                  draggable: false, // Non-draggable
                });
                buckConverterInputWire.pinGLTF1.rotation.y = Math.PI * 0.5;
                buckConverterInputWire.updatePosition(
                  new THREE.Vector3(),
                  buckConverterInputWire.pinGLTF1
                );
                scene.add(buckConverterInputWire.getGroup());
                stepCounter = 11;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.toggleSwitch,
                  "switch",
                  botBuildingSteps[stepCounter - 1]
                );
                Step11();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Switch snapping
    async function Step11() {
      const botSwitch = assembeldBotOrginal.get("switch");
      const switchTerminal1 = botTerminalsMap.get("switchTerminal1");
      const switchTerminal2 = botTerminalsMap.get("switchTerminal2");
      const switchTerminal3 = botTerminalsMap.get("switchTerminal3");
      botSwitch.visible = true;
      switchTerminal1.mesh.visible = true;
      switchTerminal2.mesh.visible = true;
      switchTerminal3.mesh.visible = true;
      const botSwitchBlinking = BlinkMesh([botSwitch]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "switch" &&
          stepCounter === 11
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            botSwitch
          );

          if (distance < distanceValue) {
            botSwitchBlinking();

            snappingEffect(botSwitch, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                botSwitchWire = new JstXhFemalePin({
                  pinCount: 3,
                  twoSide: false,
                  position: new THREE.Vector3(0, 1.8, -3.0),
                  wireConfigs: [
                    {
                      startPosition: getWorldPosititon(switchTerminal1.mesh),
                      color: 0xff0000, // Red
                    },
                    {
                      startPosition: getWorldPosititon(switchTerminal2.mesh),
                      color: 0x00ff00, // Green
                    },
                    {
                      startPosition: getWorldPosititon(switchTerminal3.mesh),
                      color: 0x0000ff, // Green
                    },
                  ],
                  draggable: false,
                });
                scene.add(botSwitchWire.getGroup());

                stepCounter = 12;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.powerDistributionBoard,
                  "powerDistributionBoard",
                  botBuildingSteps[stepCounter - 1]
                );
                Step12();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Power distribution
    async function Step12() {
      const powerDistributionBoard = assembeldBotOrginal.get(
        "powerDistributionBoard"
      );

      const powerDistributionBatteryMalePin = botMalePinsMap.get(
        "powerDistributionBatteryMalePin"
      );
      const powerDistributionMotorDriverMalePin = botMalePinsMap.get(
        "powerDistributionMotorDriverMalePin"
      );
      const powerDistributionSwitchMalePin = botMalePinsMap.get(
        "powerDistributionSwitchMalePin"
      );
      const powerDistributionUbecMalePin = botMalePinsMap.get(
        "powerDistributionUbecMalePin"
      );
      const powerDistributionChargingModuleMalePin = botMalePinsMap.get(
        "powerDistributionChargingModuleMalePin"
      );

      powerDistributionBoard.visible = true;
      powerDistributionBatteryMalePin.mesh.visible = true;
      powerDistributionMotorDriverMalePin.mesh.visible = true;
      powerDistributionSwitchMalePin.mesh.visible = true;
      powerDistributionUbecMalePin.mesh.visible = true;
      powerDistributionChargingModuleMalePin.mesh.visible = true;
      const powerDistributionBlinking = BlinkMesh([
        powerDistributionBoard,
        powerDistributionBatteryMalePin.mesh,
        powerDistributionMotorDriverMalePin.mesh,
        powerDistributionSwitchMalePin.mesh,
        powerDistributionUbecMalePin.mesh,
        powerDistributionChargingModuleMalePin.mesh,
      ]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "powerDistributionBoard" &&
          stepCounter === 12
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            powerDistributionBoard
          );

          if (distance < distanceValue) {
            powerDistributionBlinking();
            snappingEffect(powerDistributionBatteryMalePin.mesh, [0, 0.04, 0]);
            snappingEffect(
              powerDistributionMotorDriverMalePin.mesh,
              [0, 0.04, 0]
            );
            snappingEffect(powerDistributionSwitchMalePin.mesh, [0, 0.04, 0]);
            snappingEffect(powerDistributionUbecMalePin.mesh, [0, 0.04, 0]);
            snappingEffect(
              powerDistributionChargingModuleMalePin.mesh,
              [0, 0.04, 0]
            );
            snappingEffect(powerDistributionBoard, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 13;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step13();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Charging module connection1
    async function Step13() {
      const powerDistributionChargingModuleMalePin = botMalePinsMap.get(
        "powerDistributionChargingModuleMalePin"
      ).mesh;
      const chargingModuleWireBlinking = BlinkMesh([
        chargingModuleWire.getGroup(),
        powerDistributionChargingModuleMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        powerDistributionChargingModuleMalePin,
        chargingModuleWire.pinGLTF1
      );
      const powerDistributionChargingModuleFemalePin = botFemalePinsMap.get(
        "powerDistributionChargingModuleFemalePin"
      ).mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      chargingModuleWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === chargingModuleWire &&
          stepCounter === 13
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const powerDistributionChargingModuleMalePinWorldPosition =
            getWorldPosititon(powerDistributionChargingModuleMalePin);

          const distance = pinPos.distanceTo(
            powerDistributionChargingModuleMalePinWorldPosition
          );
          if (distance < distanceValue) {
            chargingModuleWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              powerDistributionChargingModuleMalePinWorldPosition,
              chargingModuleWire,
              pinModel,
              () => {
                indication.cleanup();
                const chargingModuleWireOrginal =
                  wiresMap.get("chargingModuleWire");
                chargingModuleWireOrginal.mesh.visible = true;
                powerDistributionChargingModuleFemalePin.visible = true;
                chargingModuleWire.dispose();
                chargingModuleWire = null;
                stepCounter = 14;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step14();
              }
            );
          } else {
            // console.lo("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Baaattery wire connection
    async function Step14() {
      const powerDistributionBatteryMalePin = botMalePinsMap.get(
        "powerDistributionBatteryMalePin"
      ).mesh;
      const batteryWireBlinking = BlinkMesh([
        batteryWire.getGroup(),
        powerDistributionBatteryMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        powerDistributionBatteryMalePin,
        batteryWire.pinGLTF1
      );
      const powerDistributionBatteryFemalePin = botFemalePinsMap.get(
        "powerDistributionBatteryFemalePin"
      ).mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      batteryWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === batteryWire &&
          stepCounter === 14
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const powerDistributionBatteryMalePinWorldPosition =
            getWorldPosititon(powerDistributionBatteryMalePin);

          const distance = pinPos.distanceTo(
            powerDistributionBatteryMalePinWorldPosition
          );
          // console.log("Step 14 distance:", distance);

          if (distance < distanceValue) {
            batteryWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              powerDistributionBatteryMalePinWorldPosition,
              batteryWire,
              pinModel,
              () => {
                indication.cleanup();
                const batteryWireOrginal = wiresMap.get("batteryWire");
                batteryWireOrginal.mesh.visible = true;
                powerDistributionBatteryFemalePin.visible = true;
                batteryWire.dispose();
                batteryWire = null;
                stepCounter = 15;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step15();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Switch connection
    async function Step15() {
      // console.log("Switch Connection Step15 ");
      const switchPinOnPowerDistribuiton = botMalePinsMap.get(
        "powerDistributionSwitchMalePin"
      ).mesh;
      const powerDistributionSwitchFemalePin = botFemalePinsMap.get(
        "powerDistributionSwitchFemalePin"
      ).mesh;

      const botSwitchWireBlinking = BlinkMesh([
        botSwitchWire.getGroup(),
        switchPinOnPowerDistribuiton,
      ]);
      const indication = showIndication(
        scene,
        camera,
        switchPinOnPowerDistribuiton,
        botSwitchWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      botSwitchWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === botSwitchWire &&
          stepCounter === 15
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const switchPinOnPowerDistribuitonWorldPosition = getWorldPosititon(
            switchPinOnPowerDistribuiton
          );

          const distance = pinPos.distanceTo(
            switchPinOnPowerDistribuitonWorldPosition
          );
          // console.log("Step 15 distance:", distance);

          if (distance < distanceValue) {
            botSwitchWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(switchPinOnPowerDistribuiton),
              botSwitchWire,
              pinModel,
              () => {
                const botSwitchWireOrginal = wiresMap.get("switchWire");
                botSwitchWireOrginal.mesh.visible = true;
                powerDistributionSwitchFemalePin.visible = true;
                botSwitchWire.dispose();
                botSwitchWire = null;
                stepCounter = 16;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step16();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Connection buck input wire
    async function Step16() {
      // console.log("Step16 Connection Buck Input Wire ");
      const powerDistributionUbecMalePin = botMalePinsMap.get(
        "powerDistributionUbecMalePin"
      ).mesh;
      const powerDistributionUbecFemalePin = botFemalePinsMap.get(
        "powerDistributionUbecFemalePin"
      ).mesh;

      const buckConverterInputWireBlinking = BlinkMesh([
        buckConverterInputWire.getGroup(),
        powerDistributionUbecMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        powerDistributionUbecMalePin,
        buckConverterInputWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      buckConverterInputWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === buckConverterInputWire &&
          stepCounter === 16
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const powerDistributionUbecMalePinWorldPosition = getWorldPosititon(
            powerDistributionUbecMalePin
          );

          const distance = pinPos.distanceTo(
            powerDistributionUbecMalePinWorldPosition
          );
          // console.log("Step 16 distance:", distance);

          if (distance < distanceValue) {
            buckConverterInputWireBlinking();

            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(powerDistributionUbecMalePin),
              buckConverterInputWire,
              pinModel,
              () => {
                indication.cleanup();
                const botSwitchWireOrginal = wiresMap.get("ubecWire");
                botSwitchWireOrginal.mesh.visible = true;
                powerDistributionUbecFemalePin.visible = true;
                buckConverterInputWire.dispose();
                buckConverterInputWire = null;
                stepCounter = 17;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step17();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motor Driver power Connection
    async function Step17() {
      motorDriverJstPowerWire = new JstXhFemalePin({
        pinCount: 2,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.1, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue"],
        draggable: false,
      });
      motorDriverJstPowerWire.pinGLTF2.rotation.x = Math.PI;
      motorDriverJstPowerWire.pinGLTF2.rotation.y = Math.PI * 0.5;
      motorDriverJstPowerWire.pinGLTF1.rotation.y = Math.PI * 0.5;
      motorDriverJstPowerWire.updatePosition(
        new THREE.Vector3(),
        motorDriverJstPowerWire.pinGLTF2
      );
      motorDriverJstPowerWire.updatePosition(
        new THREE.Vector3(),
        motorDriverJstPowerWire.pinGLTF1
      );
      scene.add(motorDriverJstPowerWire.getGroup());

      const motorDriverPowerMalePin = botMalePinsMap.get(
        "motorDriverPowerMalePin"
      ).mesh;
      const motorDriverJstPowerWireBlinking = BlinkMesh([
        motorDriverJstPowerWire.wires[0].wire,
        motorDriverJstPowerWire.wires[1].wire,
        motorDriverJstPowerWire.pinGLTF1,
        motorDriverPowerMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        motorDriverPowerMalePin,
        motorDriverJstPowerWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      motorDriverJstPowerWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === motorDriverJstPowerWire &&
          stepCounter === 17
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const motorDriverPowerMalePinWorldPosition = getWorldPosititon(
            motorDriverPowerMalePin
          );

          const distance = pinPos.distanceTo(
            motorDriverPowerMalePinWorldPosition
          );
          // console.log("Step 17 distance:", distance);

          if (distance < distanceValue) {
            motorDriverJstPowerWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(motorDriverPowerMalePin),
              motorDriverJstPowerWire,
              pinModel,
              () => {
                stepCounter = 18;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step18();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    async function Step18() {
      const powerDistributionMotorDriverMalePin = botMalePinsMap.get(
        "powerDistributionMotorDriverMalePin"
      ).mesh;
      const motorDriverJstPowerWireBlinking = BlinkMesh([
        motorDriverJstPowerWire.wires[0].wire,
        motorDriverJstPowerWire.wires[1].wire,
        motorDriverJstPowerWire.pinGLTF2,
        powerDistributionMotorDriverMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        powerDistributionMotorDriverMalePin,
        motorDriverJstPowerWire.pinGLTF2
      );
      const motorDriverPowerFemalePin = botFemalePinsMap.get(
        "motorDriverPowerFemalePin"
      ).mesh;
      const powerDistributionMotorDriverFemalePin = botFemalePinsMap.get(
        "powerDistributionMotorDriverFemalePin"
      ).mesh;

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      motorDriverJstPowerWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === motorDriverJstPowerWire &&
          stepCounter === 18
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const powerDistributionMotorDriverMalePinWorldPosition =
            getWorldPosititon(powerDistributionMotorDriverMalePin);

          const distance = pinPos.distanceTo(
            powerDistributionMotorDriverMalePinWorldPosition
          );
          // console.log("Step 18 distance:", distance);

          if (distance < distanceValue) {
            motorDriverJstPowerWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              powerDistributionMotorDriverMalePinWorldPosition,
              motorDriverJstPowerWire,
              pinModel,
              () => {
                const motorDriverPowerWireOrginal = wiresMap.get(
                  "motorDriverPowerWire"
                );
                motorDriverPowerWireOrginal.mesh.visible = true;
                motorDriverPowerFemalePin.visible = true;
                powerDistributionMotorDriverFemalePin.visible = true;
                motorDriverJstPowerWire.dispose();
                motorDriverJstPowerWire = null;

                stepCounter = 19;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step19();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Motot driver input wire connection
    async function Step19() {
      motorDriverInputWire = new JstXhFemalePin({
        pinCount: 4,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.0, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue", "black"],
        draggable: false,
      });
      motorDriverInputWire.pinGLTF1.rotation.y = Math.PI * 0.5;
      motorDriverInputWire.pinGLTF2.rotation.x = Math.PI;
      motorDriverInputWire.pinGLTF2.rotation.y = Math.PI * 0.5;
      motorDriverInputWire.updatePosition(
        new THREE.Vector3(),
        motorDriverInputWire.pinGLTF1
      );
      motorDriverInputWire.updatePosition(
        new THREE.Vector3(),
        motorDriverInputWire.pinGLTF2
      );

      scene.add(motorDriverInputWire.getGroup());

      const motorDriverInputPin = botTerminalsMap.get(
        "motorDriverInputPin"
      ).mesh;
      const motorDriverInputWireBlinking = BlinkMesh([
        motorDriverInputWire.wires[0].wire,
        motorDriverInputWire.wires[1].wire,
        motorDriverInputWire.wires[2].wire,
        motorDriverInputWire.wires[3].wire,
        motorDriverInputWire.pinGLTF1,
        motorDriverInputPin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        motorDriverInputPin,
        motorDriverInputWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      motorDriverInputWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === motorDriverInputWire &&
          stepCounter === 19
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const motorDriverInputPinWorldPosition =
            getWorldPosititon(motorDriverInputPin);

          const distance = pinPos.distanceTo(motorDriverInputPinWorldPosition);
          // console.log("Step 19 distance:", distance);

          if (distance < distanceValue) {
            indication.cleanup();
            motorDriverInputWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              motorDriverInputPinWorldPosition,
              motorDriverInputWire,
              pinModel,
              () => {
                stepCounter = 20;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.botMiddleCase,
                  "botClosingCase",
                  botBuildingSteps[stepCounter - 1]
                );
                Step20();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    let botClosingCase = null;
    let botClosingCaseOrginalPosition = null;
    async function Step20() {
      botClosingCase = assembeldBotOrginal.get("botClosingCase");
      botClosingCaseOrginalPosition = botClosingCase.position.clone();
      botClosingCase.position.x = 0.1;

      botClosingCase.visible = true;
      const botClosingCaseBlinking = BlinkMesh([botClosingCase]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "botClosingCase" &&
          stepCounter === 20
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            botClosingCase
          );
          // console.log(distance);

          if (distance < distanceValue) {
            botClosingCaseBlinking();
            snappingEffect(botClosingCase, [0, 0.05, 0]);
            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 21;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.botMiddleClip,
                  "botMiddleClip1",
                  botBuildingSteps[stepCounter - 1]
                );
                Step21();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    let botMiddleClip1OrginalPosition = null;
    let botMiddleClip1 = null;
    let botMiddleClip2OrginalPosition = null;
    let botMiddleClip2 = null;
    let botMiddleClip3OrginalPosition = null;
    let botMiddleClip3 = null;
    let botMiddleClip4OrginalPosition = null;
    let botMiddleClip4 = null;
    async function Step21() {
      botMiddleClip1 = assembeldBotOrginal.get("botMiddleClip1");
      botMiddleClip2 = assembeldBotOrginal.get("botMiddleClip2");
      botMiddleClip3 = assembeldBotOrginal.get("botMiddleClip3");
      botMiddleClip4 = assembeldBotOrginal.get("botMiddleClip4");

      botMiddleClip1OrginalPosition = botMiddleClip1.position.clone();

      botMiddleClip1.position.x = 0.118;
      botMiddleClip2OrginalPosition = botMiddleClip2.position.clone();

      botMiddleClip2.position.set(0.118, botMiddleClip2.position.y, -0.015);
      botMiddleClip3OrginalPosition = botMiddleClip3.position.clone();
      botMiddleClip3.position.set(0.073, botMiddleClip3.position.y, -0.0186);
      botMiddleClip4OrginalPosition = botMiddleClip4.position.clone();

      botMiddleClip4.position.set(0.073, botMiddleClip4.position.y, 0.027);

      botMiddleClip1.visible = true;
      botMiddleClip2.visible = true;
      botMiddleClip3.visible = true;
      botMiddleClip4.visible = true;

      const botMiddleClip1Blinking = BlinkMesh([
        botMiddleClip1,
        botMiddleClip2,
        botMiddleClip3,
        botMiddleClip4,
      ]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "botMiddleClip1" &&
          stepCounter === 21
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            botMiddleClip1
          );
          // console.log(distance);

          if (distance < distanceValue) {
            botMiddleClip1Blinking();

            snappingEffect(botMiddleClip1, [0, -0.08, 0]);
            snappingEffect(botMiddleClip2, [0, -0.08, 0]);
            snappingEffect(botMiddleClip3, [0, -0.08, 0]);
            snappingEffect(botMiddleClip4, [0, -0.08, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                gsap.to(botClosingCase.position, {
                  y: botClosingCaseOrginalPosition.clone().y + 0.1,
                  onComplete: () => {
                    gsap.to(botClosingCase.position, {
                      x: botClosingCaseOrginalPosition.clone().x,
                      onComplete: () => {
                        gsap.to(botClosingCase.position, {
                          x: botClosingCaseOrginalPosition.x,
                          y: botClosingCaseOrginalPosition.y,
                          z: botClosingCaseOrginalPosition.z,
                        });
                      },
                    });
                  },
                });
                gsap.to(botMiddleClip1.position, {
                  y: botMiddleClip1OrginalPosition.clone().y + 0.1,
                  onComplete: () => {
                    gsap.to(botMiddleClip1.position, {
                      x: botMiddleClip1OrginalPosition.clone().x,
                      onComplete: () => {
                        gsap.to(botMiddleClip1.position, {
                          x: botMiddleClip1OrginalPosition.x,
                          y: botMiddleClip1OrginalPosition.y,
                          z: botMiddleClip1OrginalPosition.z,
                        });
                      },
                    });
                  },
                });
                gsap.to(botMiddleClip2.position, {
                  y: botMiddleClip2OrginalPosition.clone().y + 0.1,
                  onComplete: () => {
                    gsap.to(botMiddleClip2.position, {
                      x: botMiddleClip2OrginalPosition.clone().x,
                      onComplete: () => {
                        gsap.to(botMiddleClip2.position, {
                          x: botMiddleClip2OrginalPosition.x,
                          y: botMiddleClip2OrginalPosition.y,
                          z: botMiddleClip2OrginalPosition.z,
                        });
                      },
                    });
                  },
                });
                gsap.to(botMiddleClip3.position, {
                  y: botMiddleClip3OrginalPosition.clone().y + 0.1,
                  onComplete: () => {
                    gsap.to(botMiddleClip3.position, {
                      x: botMiddleClip3OrginalPosition.clone().x,
                      onComplete: () => {
                        gsap.to(botMiddleClip3.position, {
                          x: botMiddleClip3OrginalPosition.x,
                          y: botMiddleClip3OrginalPosition.y,
                          z: botMiddleClip3OrginalPosition.z,
                        });
                      },
                    });
                  },
                });
                gsap.to(botMiddleClip4.position, {
                  y: botMiddleClip4OrginalPosition.clone().y + 0.1,
                  onComplete: () => {
                    gsap.to(botMiddleClip4.position, {
                      x: botMiddleClip4OrginalPosition.clone().x,
                      onComplete: () => {
                        gsap.to(botMiddleClip4.position, {
                          x: botMiddleClip4OrginalPosition.x,
                          y: botMiddleClip4OrginalPosition.y,
                          z: botMiddleClip4OrginalPosition.z,
                          onComplete: () => {
                            stepCounter = 22;
                            setupForNextSetup(
                              raycasterSetup,
                              stepCounter,
                              sidepanelInstance,
                              assembeldBotCopy,
                              allAssets.textures.botMiddleCase2,
                              "botMiddleCase",
                              botBuildingSteps[stepCounter - 1]
                            );
                            Step25();
                          },
                        });
                      },
                    });
                  },
                });
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Bot Middle Case
    async function Step25() {
      const botMiddleCase = assembeldBotOrginal.get("botMiddleCase");
      botMiddleCase.visible = true;
      const botMiddleCaseBlinking = BlinkMesh([botMiddleCase]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "botMiddleCase" &&
          stepCounter === 22
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            botMiddleCase
          );
          // console.log(distance);

          if (distance < distanceValue) {
            botMiddleCaseBlinking();
            snappingEffect(botMiddleCase, [0, 0.08, 0]);
            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 23;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.expansionBoard,
                  "expansionBoard",
                  botBuildingSteps[stepCounter - 1]
                );
                Step26();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //ExpansionBoard
    async function Step26() {
      const expansionBoard = assembeldBotOrginal.get("expansionBoard");
      const expansionBoardRgb2MalePin = botMalePinsMap.get(
        "expansionBoardRgb2MalePin"
      ).mesh;
      const expansionBoardRgb1MalePin = botMalePinsMap.get(
        "expansionBoardRgb1MalePin"
      ).mesh;
      const expansionBoardTsopMalePin = botMalePinsMap.get(
        "expansionBoardTsopMalePin"
      ).mesh;
      const expansionBoardPowerMalePin = botMalePinsMap.get(
        "expansionBoardPowerMalePin"
      ).mesh;
      const expansionBoardButtonMalePin = botMalePinsMap.get(
        "expansionBoardButtonMalePin"
      ).mesh;
      const expansionBoardLdrMalePin = botMalePinsMap.get(
        "expansionBoardLdrMalePin"
      ).mesh;
      const expansionBoardBuzzerMalePin = botMalePinsMap.get(
        "expansionBoardBuzzerMalePin"
      ).mesh;
      const expansionBoardMotorDriverMalePin = botMalePinsMap.get(
        "expansionBoardMotorDriverMalePin"
      ).mesh;

      const expansionBoardBlinking = BlinkMesh([
        expansionBoard,
        expansionBoardRgb2MalePin,
        expansionBoardRgb1MalePin,
        expansionBoardTsopMalePin,
        expansionBoardPowerMalePin,
        expansionBoardButtonMalePin,
        expansionBoardLdrMalePin,
        expansionBoardBuzzerMalePin,
        expansionBoardMotorDriverMalePin,
      ]);
      expansionBoard.visible = true;
      expansionBoardRgb2MalePin.visible = true;
      expansionBoardRgb1MalePin.visible = true;
      expansionBoardTsopMalePin.visible = true;
      expansionBoardPowerMalePin.visible = true;
      expansionBoardButtonMalePin.visible = true;
      expansionBoardLdrMalePin.visible = true;
      expansionBoardBuzzerMalePin.visible = true;
      expansionBoardMotorDriverMalePin.visible = true;

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "expansionBoard" &&
          stepCounter === 23
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            expansionBoard
          );
          // console.log(distance);

          if (distance < distanceValue) {
            expansionBoardBlinking();
            snappingEffect(expansionBoard, [0, 0, 0.08]);
            snappingEffect(expansionBoardRgb2MalePin, [0, 0, 0.08]);
            snappingEffect(expansionBoardRgb1MalePin, [0, 0, 0.08]);
            snappingEffect(expansionBoardTsopMalePin, [0, 0, 0.08]);
            snappingEffect(expansionBoardPowerMalePin, [0, 0, 0.08]);
            snappingEffect(expansionBoardButtonMalePin, [0, 0, 0.08]);
            snappingEffect(expansionBoardLdrMalePin, [0, 0, 0.08]);
            snappingEffect(expansionBoardBuzzerMalePin, [0, 0, 0.08]);
            snappingEffect(expansionBoardMotorDriverMalePin, [0, 0, 0.08]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 24;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step27();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Power Connection
    async function Step27() {
      // console.log("Power connection to Expansion board step27");

      const expansionBoardPowerMalePin = botMalePinsMap.get(
        "expansionBoardPowerMalePin"
      ).mesh;
      const bucConverterOutputWireBlinking = BlinkMesh([
        bucConverterOutputWire.getGroup(),
        expansionBoardPowerMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardPowerMalePin,
        bucConverterOutputWire.pinGLTF1
      );
      const expansionBordPowerFemalePin = botFemalePinsMap.get(
        "expansionBordPowerFemalePin"
      ).mesh;
      const powerWire = wiresMap.get("powerWire").mesh;

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      bucConverterOutputWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === bucConverterOutputWire &&
          stepCounter === 24
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardPowerMalePinWorldPosition = getWorldPosititon(
            expansionBoardPowerMalePin
          );

          const distance = pinPos.distanceTo(
            expansionBoardPowerMalePinWorldPosition
          );
          // console.log("Step 18 distance:", distance);

          if (distance < distanceValue) {
            bucConverterOutputWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardPowerMalePinWorldPosition,
              bucConverterOutputWire,
              pinModel,
              () => {
                indication.cleanup();
                powerWire.visible = true;
                expansionBordPowerFemalePin.visible = true;
                bucConverterOutputWire.dispose();
                bucConverterOutputWire = null;

                stepCounter = 25;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step28();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Second Motor Driver input connection
    async function Step28() {
      // console.log("Connection MotorDriver input wire");

      const expansionBoardMotorDriverMalePin = botMalePinsMap.get(
        "expansionBoardMotorDriverMalePin"
      ).mesh;
      const motorDriverInputWireBlinking = BlinkMesh([
        motorDriverInputWire.wires[0].wire,
        motorDriverInputWire.wires[1].wire,
        motorDriverInputWire.wires[2].wire,
        motorDriverInputWire.wires[3].wire,
        motorDriverInputWire.pinGLTF2,
        expansionBoardMotorDriverMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardMotorDriverMalePin,
        motorDriverInputWire.pinGLTF2
      );
      const expansionBoardMotorDriverFemalePin = botFemalePinsMap.get(
        "expansionBoardMotorDriverFemalePin"
      ).mesh;
      const motorInputWire = wiresMap.get("motorInputWire").mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      motorDriverInputWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === motorDriverInputWire &&
          stepCounter === 25
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardMotorDriverMalePinWorldPosition =
            getWorldPosititon(expansionBoardMotorDriverMalePin);

          const distance = pinPos.distanceTo(
            expansionBoardMotorDriverMalePinWorldPosition
          );
          // console.log("Step 28 distance:", distance);

          if (distance < distanceValue) {
            indication.cleanup();

            motorDriverInputWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardMotorDriverMalePinWorldPosition,
              motorDriverInputWire,
              pinModel,
              () => {
                indication.cleanup();
                motorInputWire.visible = true;
                expansionBoardMotorDriverFemalePin.visible = true;
                motorDriverInputWire.dispose();
                motorDriverInputWire = null;

                stepCounter = 26;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.frontPannel,
                  "frontPannel",
                  botBuildingSteps[stepCounter - 1]
                );
                Step29();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Front Pannel
    async function Step29() {
      // console.log("FrontPannel Step29");
      const frontPannel = assembeldBotOrginal.get("frontPannel");
      frontPannel.visible = true;
      const frontPannelBlinking = BlinkMesh([frontPannel]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "frontPannel" &&
          stepCounter === 26
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            frontPannel
          );
          // console.log(distance);

          if (distance < distanceValue) {
            frontPannelBlinking();
            snappingEffect(frontPannel, [0, 0.08, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 27;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.eye,
                  "rightEye",
                  botBuildingSteps[stepCounter - 1]
                );
                Step30();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //RightEye
    async function Step30() {
      // console.log("Right Eye Step 30");

      const rightEye = assembeldBotOrginal.get("rightEye");
      rightEye.visible = true;
      const rightEyeBlinking = BlinkMesh([rightEye]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "rightEye" &&
          stepCounter === 27
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, rightEye);
          // console.log(distance);

          if (distance < distanceValue) {
            rightEyeBlinking();
            snappingEffect(rightEye, [0, 0, 0.01]);
            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 28;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.eye,
                  "leftEye",
                  botBuildingSteps[stepCounter - 1]
                );
                Step31();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //left eye
    async function Step31() {
      // console.log("Left Eye Step 31");
      const leftEye = assembeldBotOrginal.get("leftEye");
      leftEye.visible = true;
      const leftEyeBlinking = BlinkMesh([leftEye]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "leftEye" &&
          stepCounter === 28
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, leftEye);
          // console.log(distance);

          if (distance < distanceValue) {
            leftEyeBlinking();
            snappingEffect(leftEye, [0, 0, 0.01]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 29;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.rgbModule,
                  "rgbModuleRight",
                  botBuildingSteps[stepCounter - 1]
                );
                Step32();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Right Rgb Module
    let hideFrontPannel = null;

    async function Step32() {
      // console.log("RGB module Step 32");
      hideFrontPannel = HideMesh(
        [
          assembeldBotOrginal.get("frontPannel"),
          assembeldBotOrginal.get("rightEye"),
          assembeldBotOrginal.get("leftEye"),
        ],
        0.1
      );
      const rgbModuleRight = assembeldBotOrginal.get("rgbModuleRight");
      // console.log(rgbModuleRight);

      const rightRgbMalePin = botMalePinsMap.get("rightRgbMalePin").mesh;
      rgbModuleRight.visible = true;
      rightRgbMalePin.visible = true;
      const rgbModuleRightBlinking = BlinkMesh([
        rgbModuleRight,
        rightRgbMalePin,
      ]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "rgbModuleRight" &&
          stepCounter === 29
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            rgbModuleRight
          );
          // console.log(distance);

          if (distance < distanceValue) {
            rgbModuleRightBlinking();
            snappingEffect(rgbModuleRight, [0, 0.04, 0]);
            snappingEffect(rightRgbMalePin, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 30;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.rgbModule,
                  "rgbModuleLeft",
                  botBuildingSteps[stepCounter - 1]
                );
                Step33();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Left Rgb Module
    async function Step33() {
      // console.log("RGB module Step 33");
      const rgbModuleLeft = assembeldBotOrginal.get("rgbModuleLeft");
      const leftRgbMalePin = botMalePinsMap.get("leftRgbMalePin").mesh;
      leftRgbMalePin.visible = true;
      rgbModuleLeft.visible = true;
      const rgbModuleLeftBlinking = BlinkMesh([rgbModuleLeft, leftRgbMalePin]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "rgbModuleLeft" &&
          stepCounter === 30
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            rgbModuleLeft
          );
          // console.log(distance);

          if (distance < distanceValue) {
            rgbModuleLeftBlinking();
            snappingEffect(rgbModuleLeft, [0, 0.04, 0]);
            snappingEffect(leftRgbMalePin, [0, 0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 31;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.arduinoBoard,
                  "arduinoNano",
                  botBuildingSteps[stepCounter - 1]
                );
                Step34();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Arduino nano
    async function Step34() {
      // console.log("Arduino Nano module Step 34");
      const arduinoNano = assembeldBotOrginal.get("arduinoNano");
      arduinoNano.visible = true;
      const arduinoNanoBlinking = BlinkMesh([arduinoNano]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "arduinoNano" &&
          stepCounter === 31
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            arduinoNano
          );
          // console.log(distance);

          if (distance < distanceValue) {
            arduinoNanoBlinking();
            snappingEffect(arduinoNano, [0, 0.04, 0]);
            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 32;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step35();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Right Rgb Module Wiring
    let rightRgbMalePinOrginalPosition = null;
    let rightRgbMalePinOrginalRotation = null;
    let rightRgbModuleOrginalRotation = null;

    async function Step35() {
      rightRbgModuleWire = new JstXhFemalePin({
        pinCount: 4,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.1, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue", "yellow"],
        draggable: false,
      });
      rightRbgModuleWire.pinGLTF2.rotation.x = Math.PI;
      rightRbgModuleWire.pinGLTF2.rotation.y = Math.PI * 0.5;
      rightRbgModuleWire.pinGLTF1.rotation.x = Math.PI * 0.5;
      rightRbgModuleWire.updatePosition(
        new THREE.Vector3(),
        rightRbgModuleWire.pinGLTF2
      );
      rightRbgModuleWire.updatePosition(
        new THREE.Vector3(),
        rightRbgModuleWire.pinGLTF1
      );

      scene.add(rightRbgModuleWire.getGroup());

      const rightRgbMalePin = botMalePinsMap.get("rightRgbMalePin").mesh;
      const rgbModuleRight = assembeldBotOrginal.get("rgbModuleRight");
      rightRgbModuleOrginalRotation = rgbModuleRight.rotation.clone();
      rightRgbMalePinOrginalPosition = rightRgbMalePin.position.clone();
      rightRgbMalePinOrginalRotation = rightRgbMalePin.rotation.clone();
      rgbModuleRight.visible = true;
      rightRgbMalePin.visible = true;

      const rightRbgModuleWireBlinking = BlinkMesh([
        rightRbgModuleWire.wires[0].wire,
        rightRbgModuleWire.wires[1].wire,
        rightRbgModuleWire.wires[2].wire,
        rightRbgModuleWire.wires[3].wire,
        rightRbgModuleWire.pinGLTF1,
        rightRgbMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        rightRgbMalePin,
        rightRbgModuleWire.pinGLTF1
      );
      rgbModuleRight.rotation.x = Math.PI * 0.5;
      rgbModuleRight.rotation.y = -Math.PI * 0.5;
      rightRgbMalePin.rotation.x = Math.PI * 0.5;
      rightRgbMalePin.position.z = 0.036;

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      rightRbgModuleWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === rightRbgModuleWire &&
          stepCounter === 32
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const rightRgbMalePinWorldPosition =
            getWorldPosititon(rightRgbMalePin);

          const distance = pinPos.distanceTo(rightRgbMalePinWorldPosition);
          // console.log("Step 35 distance:", distance);

          if (distance < distanceValue) {
            indication.cleanup();
            rightRbgModuleWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(rightRgbMalePin),
              rightRbgModuleWire,
              pinModel,
              () => {
                stepCounter = 33;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step36();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //rightRbgModuleWire second Connection
    async function Step36() {
      console.log("Connection rightRb gModule  wire");
      const rightRgbMalePin = botMalePinsMap.get("rightRgbMalePin").mesh;
      const rgbModuleRight = assembeldBotOrginal.get("rgbModuleRight");

      // rgbModuleRight.rotation.y = 0;
      // rightRgbMalePin.rotation.x = 0;

      const expansionBoardRgb1MalePin = botMalePinsMap.get(
        "expansionBoardRgb1MalePin"
      ).mesh;

      const rightRbgModuleWireBlinking = BlinkMesh([
        rightRbgModuleWire.wires[0].wire,
        rightRbgModuleWire.wires[1].wire,
        rightRbgModuleWire.wires[2].wire,
        rightRbgModuleWire.wires[3].wire,
        rightRbgModuleWire.pinGLTF2,
        expansionBoardRgb1MalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardRgb1MalePin,
        rightRbgModuleWire.pinGLTF2
      );
      const expansionBoardRgb2FemalePin = botFemalePinsMap.get(
        "expansionBoardRgb2FemalePin"
      ).mesh;
      const rightLedWire = wiresMap.get("rightLedWire").mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      rightRbgModuleWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();

      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === rightRbgModuleWire &&
          stepCounter === 33
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardRgb1MalePinWorldPosition = getWorldPosititon(
            expansionBoardRgb1MalePin
          );

          const distance = pinPos.distanceTo(
            expansionBoardRgb1MalePinWorldPosition
          );
          console.log("Step 36 distance:", distance);

          if (distance < distanceValue) {
            indication.cleanup();
            rightRbgModuleWireBlinking();
            rgbModuleRight.rotation.set(
              rightRgbModuleOrginalRotation.x,
              rightRgbModuleOrginalRotation.y,
              rightRgbModuleOrginalRotation.z
            );
            rightRgbMalePin.position.z = rightRgbMalePinOrginalPosition.z;
            rightRgbMalePin.rotation.set(
              rightRgbMalePinOrginalRotation.x,
              rightRgbMalePinOrginalRotation.y,
              rightRgbMalePinOrginalRotation.z
            );
            rightRbgModuleWire.updatePosition(
              new THREE.Vector3(),
              rightRbgModuleWire.pinGLTF1
            );
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardRgb1MalePinWorldPosition,
              rightRbgModuleWire,
              pinModel,
              () => {
                rightLedWire.visible = true;
                expansionBoardRgb2FemalePin.visible = true;
                rightRbgModuleWire.dispose();
                rightRbgModuleWire = null;

                stepCounter = 34;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step37();
              }
            );
          } else {
            console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          console.log(
            "Drag ignored: draggedComponent:",
            raycasterSetup.draggedComponent,
            "stepCounter:",
            stepCounter
          );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Right Rgb Module Wiring
    let leftRgbMalePinOrginalPosition = null;
    let leftRgbMalePinOrginalRotation = null;
    let leftRgbModuleOrginalRotation = null;
    async function Step37() {
      leftRbgModuleWire = new JstXhFemalePin({
        pinCount: 4,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.1, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue", "yellow"],
        draggable: false,
      });
      leftRbgModuleWire.pinGLTF2.rotation.x = Math.PI;
      leftRbgModuleWire.pinGLTF2.rotation.y = Math.PI * 0.5;
      leftRbgModuleWire.pinGLTF1.rotation.x = Math.PI * 0.5;
      leftRbgModuleWire.updatePosition(
        new THREE.Vector3(),
        leftRbgModuleWire.pinGLTF2
      );
      leftRbgModuleWire.updatePosition(
        new THREE.Vector3(),
        leftRbgModuleWire.pinGLTF1
      );
      scene.add(leftRbgModuleWire.getGroup());

      const leftRgbMalePin = botMalePinsMap.get("leftRgbMalePin").mesh;
      const leftRbgModuleWireBlinking = BlinkMesh([
        leftRbgModuleWire.wires[0].wire,
        leftRbgModuleWire.wires[1].wire,
        leftRbgModuleWire.wires[2].wire,
        leftRbgModuleWire.wires[3].wire,
        leftRbgModuleWire.pinGLTF1,
        leftRgbMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        leftRgbMalePin,
        leftRbgModuleWire.pinGLTF1
      );
      const rgbModuleLeft = assembeldBotOrginal.get("rgbModuleLeft");
      leftRgbModuleOrginalRotation = rgbModuleLeft.rotation.clone();
      leftRgbMalePinOrginalPosition = leftRgbMalePin.position.clone();
      leftRgbMalePinOrginalRotation = leftRgbMalePin.rotation.clone();
      rgbModuleLeft.visible = true;
      leftRgbMalePin.visible = true;

      rgbModuleLeft.rotation.x = Math.PI * 0.5;
      rgbModuleLeft.rotation.y = -Math.PI * 0.5;
      leftRgbMalePin.rotation.x = Math.PI * 0.5;
      leftRgbMalePin.position.z = 0.036;

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      leftRbgModuleWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();

      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === leftRbgModuleWire &&
          stepCounter === 34
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const leftRgbMalePinWorldPosition = getWorldPosititon(leftRgbMalePin);

          const distance = pinPos.distanceTo(leftRgbMalePinWorldPosition);
          // console.log("Step 35 distance:", distance);

          if (distance < distanceValue) {
            indication.cleanup();
            leftRbgModuleWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(leftRgbMalePin),
              leftRbgModuleWire,
              pinModel,
              () => {
                stepCounter = 35;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step38();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //leftRbgModuleWire second Connection
    async function Step38() {
      // console.log("Connection rightRb gModule  wire");
      const leftRgbMalePin = botMalePinsMap.get("leftRgbMalePin").mesh;
      const rgbModuleLeft = assembeldBotOrginal.get("rgbModuleLeft");

      const expansionBoardRgb2MalePin = botMalePinsMap.get(
        "expansionBoardRgb2MalePin"
      ).mesh;
      const leftRbgModuleWireBlinking = BlinkMesh([
        leftRbgModuleWire.wires[0].wire,
        leftRbgModuleWire.wires[1].wire,
        leftRbgModuleWire.wires[2].wire,
        leftRbgModuleWire.wires[3].wire,
        leftRbgModuleWire.pinGLTF2,
        expansionBoardRgb2MalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardRgb2MalePin,
        leftRbgModuleWire.pinGLTF2
      );
      const expansionBoardRgb1FemalePin = botFemalePinsMap.get(
        "expansionBoardRgb1FemalePin"
      ).mesh;
      const leftLedWire = wiresMap.get("leftLedWire").mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      leftRbgModuleWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === leftRbgModuleWire &&
          stepCounter === 35
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardRgb2MalePinWorldPosition = getWorldPosititon(
            expansionBoardRgb2MalePin
          );

          const distance = pinPos.distanceTo(
            expansionBoardRgb2MalePinWorldPosition
          );
          // console.log("Step 38 distance:", distance);

          if (distance < distanceValue) {
            indication.cleanup();
            leftRbgModuleWireBlinking();
            rgbModuleLeft.rotation.set(
              leftRgbModuleOrginalRotation.x,
              leftRgbModuleOrginalRotation.y,
              leftRgbModuleOrginalRotation.z
            );
            leftRgbMalePin.position.z = leftRgbMalePinOrginalPosition.z;
            leftRgbMalePin.rotation.set(
              leftRgbMalePinOrginalRotation.x,
              leftRgbMalePinOrginalRotation.y,
              leftRgbMalePinOrginalRotation.z
            );
            leftRbgModuleWire.updatePosition(
              new THREE.Vector3(),
              leftRbgModuleWire.pinGLTF1
            );
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardRgb2MalePinWorldPosition,
              leftRbgModuleWire,
              pinModel,
              () => {
                leftLedWire.visible = true;
                expansionBoardRgb1FemalePin.visible = true;
                leftRbgModuleWire.dispose();
                leftRbgModuleWire = null;

                stepCounter = 36;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.topCase,
                  "topCase",
                  botBuildingSteps[stepCounter - 1]
                );
                Step39();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Inserting Top case
    async function Step39() {
      const topCase = assembeldBotOrginal.get("topCase");
      topCase.visible = true;
      const topCaseBlinking = BlinkMesh([topCase]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "topCase" &&
          stepCounter === 36
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, topCase);
          // console.log(distance);

          if (distance < distanceValue) {
            topCaseBlinking();
            snappingEffect(topCase, [0, 0.04, 0]);
            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 37;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.tsopSensor,
                  "tsopSensor",
                  botBuildingSteps[stepCounter - 1]
                );
                Step40();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //TSOP Sensor dragging
    let topCaseHiding = null;
    async function Step40() {
      const topCase = assembeldBotOrginal.get("topCase");
      topCaseHiding = HideMesh([topCase], 0.2);
      const tsopSensor = assembeldBotOrginal.get("tsopSensor");
      const tsopMalePin = botMalePinsMap.get("tsopMalePin").mesh;
      tsopSensor.visible = true;
      tsopMalePin.visible = true;
      const tsopSensorBlinking = BlinkMesh([tsopSensor, tsopMalePin]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "tsopSensor" &&
          stepCounter === 37
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            tsopSensor
          );
          // console.log(distance);

          if (distance < distanceValue) {
            tsopSensorBlinking();
            snappingEffect(tsopSensor, [0, -0.04, 0]);
            snappingEffect(tsopMalePin, [0, -0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 38;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step41();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    // Tsop Sensor 1st connection
    async function Step41() {
      const tsopMalePin = botMalePinsMap.get("tsopMalePin").mesh;
      tsopJstWire = new JstXhFemalePin({
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.1, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue"],
        draggable: false,
      });

      tsopJstWire.pinGLTF1.rotation.x = Math.PI;
      tsopJstWire.updatePosition(new THREE.Vector3(), tsopJstWire.pinGLTF1);
      tsopJstWire.pinGLTF2.rotation.x = -Math.PI;
      tsopJstWire.pinGLTF2.rotation.y = Math.PI * 0.5;

      tsopJstWire.updatePosition(new THREE.Vector3(), tsopJstWire.pinGLTF2);
      scene.add(tsopJstWire.getGroup());
      const tsopJstWireBlinking = BlinkMesh([
        tsopJstWire.wires[0].wire,
        tsopJstWire.wires[1].wire,
        tsopJstWire.wires[2].wire,
        tsopJstWire.pinGLTF1,
        tsopMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        tsopMalePin,
        tsopJstWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      tsopJstWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === tsopJstWire &&
          stepCounter === 38
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const tsopMalePinWorldPosition = getWorldPosititon(tsopMalePin);

          const distance = pinPos.distanceTo(tsopMalePinWorldPosition);
          // console.log("Step 41 distance:", distance);

          if (distance < distanceValue) {
            tsopJstWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(tsopMalePin),
              tsopJstWire,
              pinModel,
              () => {
                stepCounter = 39;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.pushButton,
                  "pushButton",
                  botBuildingSteps[stepCounter - 1]
                );
                Step42();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Push Button Sanapping
    async function Step42() {
      const pushButton = assembeldBotOrginal.get("pushButton");
      const pushButtonMalePin = botMalePinsMap.get("pushButtonMalePin").mesh;
      pushButton.visible = true;
      pushButtonMalePin.visible = true;
      const pushButtonBlinking = BlinkMesh([pushButton, pushButtonMalePin]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "pushButton" &&
          stepCounter === 39
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            pushButton
          );
          // console.log(distance);

          if (distance < distanceValue) {
            pushButtonBlinking();
            snappingEffect(pushButton, [0, -0.04, 0]);
            snappingEffect(pushButtonMalePin, [0, -0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 40;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step43();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    // PushButton 1st connection
    async function Step43() {
      const pushButtonMalePin = botMalePinsMap.get("pushButtonMalePin").mesh;
      pushButtonJstWire = new JstXhFemalePin({
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.2, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue"],
        draggable: false,
      });

      pushButtonJstWire.pinGLTF1.rotation.x = Math.PI;
      pushButtonJstWire.updatePosition(
        new THREE.Vector3(),
        pushButtonJstWire.pinGLTF1
      );
      pushButtonJstWire.pinGLTF2.rotation.x = -Math.PI;
      pushButtonJstWire.updatePosition(
        new THREE.Vector3(),
        pushButtonJstWire.pinGLTF2
      );
      scene.add(pushButtonJstWire.getGroup());
      const pushButtonJstWireBlinking = BlinkMesh([
        pushButtonJstWire.wires[0].wire,
        pushButtonJstWire.wires[1].wire,
        pushButtonJstWire.wires[2].wire,
        pushButtonJstWire.pinGLTF1,
        pushButtonMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        pushButtonMalePin,
        pushButtonJstWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      pushButtonJstWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === pushButtonJstWire &&
          stepCounter === 40
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const pushButtonMalePinWorldPosition =
            getWorldPosititon(pushButtonMalePin);

          const distance = pinPos.distanceTo(pushButtonMalePinWorldPosition);
          // console.log("Step 43 distance:", distance);

          if (distance < distanceValue) {
            pushButtonJstWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(pushButtonMalePin),
              pushButtonJstWire,
              pinModel,
              () => {
                indication.cleanup();
                stepCounter = 41;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.buzzerModule,
                  "buzzerSensor",
                  botBuildingSteps[stepCounter - 1]
                );
                Step44();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Buzzer Sensor Sanapping
    async function Step44() {
      const buzzerSensor = assembeldBotOrginal.get("buzzerSensor");
      const buzzerSensorMalePin = botMalePinsMap.get(
        "buzzerSensorMalePin"
      ).mesh;
      buzzerSensor.visible = true;
      buzzerSensorMalePin.visible = true;
      const buzzerSensorBlinking = BlinkMesh([
        buzzerSensor,
        buzzerSensorMalePin,
      ]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "buzzerSensor" &&
          stepCounter === 41
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            buzzerSensor
          );
          // console.log(distance);

          if (distance < distanceValue) {
            buzzerSensorBlinking();
            snappingEffect(buzzerSensor, [0, 0, 0.04]);
            snappingEffect(buzzerSensorMalePin, [0, -0.04, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 42;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step45();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    // BuzzerSensor 1st connection
    async function Step45() {
      const buzzerSensorMalePin = botMalePinsMap.get(
        "buzzerSensorMalePin"
      ).mesh;
      buzzerJstWire = new JstXhFemalePin({
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.0, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue"],
        draggable: false,
      });

      buzzerJstWire.pinGLTF1.rotation.x = Math.PI * 0.5;
      buzzerJstWire.pinGLTF2.rotation.x = -Math.PI;
      buzzerJstWire.pinGLTF2.rotation.y = Math.PI * 0.5;

      buzzerJstWire.updatePosition(new THREE.Vector3(), buzzerJstWire.pinGLTF1);
      buzzerJstWire.updatePosition(new THREE.Vector3(), buzzerJstWire.pinGLTF2);

      scene.add(buzzerJstWire.getGroup());
      const buzzerJstWireBlinking = BlinkMesh([
        buzzerJstWire.wires[0].wire,
        buzzerJstWire.wires[1].wire,
        buzzerJstWire.wires[2].wire,
        buzzerJstWire.pinGLTF1,
        buzzerSensorMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        buzzerSensorMalePin,
        buzzerJstWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      buzzerJstWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === buzzerJstWire &&
          stepCounter === 42
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const buzzerSensorMalePinWorldPosition =
            getWorldPosititon(buzzerSensorMalePin);

          const distance = pinPos.distanceTo(buzzerSensorMalePinWorldPosition);
          // console.log("Step 46 distance:", distance);

          if (distance < distanceValue) {
            buzzerJstWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(buzzerSensorMalePin),
              buzzerJstWire,
              pinModel,
              () => {
                stepCounter = 43;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.ldrModule,
                  "ldrSensor",
                  botBuildingSteps[stepCounter - 1]
                );
                Step46();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //ldrSensor snapping
    async function Step46() {
      const ldrSensor = assembeldBotOrginal.get("ldrSensor");
      const ldrSensorMalePin = botMalePinsMap.get("ldrMalePin").mesh;
      ldrSensor.visible = true;
      ldrSensorMalePin.visible = true;
      const ldrSensorBlinking = BlinkMesh([ldrSensor, ldrSensorMalePin]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "ldrSensor" &&
          stepCounter === 43
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            ldrSensor
          );
          // console.log(distance);

          if (distance < distanceValue) {
            ldrSensorBlinking();
            snappingEffect(ldrSensor, [0, 0, 0.04]);
            snappingEffect(ldrSensorMalePin, [0, 0, 0.04]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 44;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step47();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    // Ldr Sensor 1st connection
    async function Step47() {
      const ldrMalePin = botMalePinsMap.get("ldrMalePin").mesh;
      ldrJstWire = new JstXhFemalePin({
        pinCount: 3,
        twoSide: true,
        jstPinConfig: [
          { startPosition: { x: 0.5, y: 1.8, z: -3 } },
          { startPosition: { x: 0.6, y: 1.8, z: -3 } },
        ],
        colors: ["red", "green", "blue"],
        draggable: false,
      });

      ldrJstWire.pinGLTF1.rotation.x = Math.PI * 0.5;
      ldrJstWire.pinGLTF2.rotation.x = -Math.PI;
      ldrJstWire.pinGLTF2.rotation.y = Math.PI * 0.5;

      ldrJstWire.updatePosition(new THREE.Vector3(), ldrJstWire.pinGLTF1);
      ldrJstWire.updatePosition(new THREE.Vector3(), ldrJstWire.pinGLTF2);
      scene.add(ldrJstWire.getGroup());
      const ldrJstWireBlinking = BlinkMesh([
        ldrJstWire.wires[0].wire,
        ldrJstWire.wires[1].wire,
        ldrJstWire.wires[2].wire,
        ldrJstWire.pinGLTF1,
        ldrMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        ldrMalePin,
        ldrJstWire.pinGLTF1
      );
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      ldrJstWire.setDraggable(true, ["pinGLTF1"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === ldrJstWire &&
          stepCounter === 44
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const ldrMalePinWorldPosition = getWorldPosititon(ldrMalePin);

          const distance = pinPos.distanceTo(ldrMalePinWorldPosition);
          // console.log("Step 47 distance:", distance);

          if (distance < distanceValue) {
            ldrJstWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              getWorldPosititon(ldrMalePin),
              ldrJstWire,
              pinModel,
              () => {
                stepCounter = 45;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step48();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Connection tsop second
    async function Step48() {
      const expansionBoardTsopMalePin = botMalePinsMap.get(
        "expansionBoardTsopMalePin"
      ).mesh;

      const tsopJstWireBlinking = BlinkMesh([
        tsopJstWire.wires[0].wire,
        tsopJstWire.wires[1].wire,
        tsopJstWire.wires[2].wire,
        tsopJstWire.pinGLTF2,
        expansionBoardTsopMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardTsopMalePin,
        tsopJstWire.pinGLTF2
      );
      const expansionBoardTsopFemalePin = botFemalePinsMap.get(
        "expansionBoardTsopFemalePin"
      ).mesh;
      const tsopWire = wiresMap.get("tsopWire").mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      tsopJstWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === tsopJstWire &&
          stepCounter === 45
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardTsopMalePinWorldPosition = getWorldPosititon(
            expansionBoardTsopMalePin
          );

          const distance = pinPos.distanceTo(
            expansionBoardTsopMalePinWorldPosition
          );
          // console.log("Step 48 distance:", distance);

          if (distance < distanceValue) {
            tsopJstWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardTsopMalePinWorldPosition,
              tsopJstWire,
              pinModel,
              () => {
                tsopWire.visible = true;
                expansionBoardTsopFemalePin.visible = true;
                tsopJstWire.dispose();
                tsopJstWire = null;

                stepCounter = 46;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step49();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Connection button second
    async function Step49() {
      const expansionBoardButtonMalePin = botMalePinsMap.get(
        "expansionBoardButtonMalePin"
      ).mesh;

      const pushButtonJstWireBlinking = BlinkMesh([
        pushButtonJstWire.wires[0].wire,
        pushButtonJstWire.wires[1].wire,
        pushButtonJstWire.wires[2].wire,
        pushButtonJstWire.pinGLTF2,
        expansionBoardButtonMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardButtonMalePin,
        pushButtonJstWire.pinGLTF2
      );
      const expansionBoardButtonFemalePin = botFemalePinsMap.get(
        "expansionBoardButtonFemalePin"
      ).mesh;
      const buttonWire = wiresMap.get("buttonWire").mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      pushButtonJstWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === pushButtonJstWire &&
          stepCounter === 46
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardButtonMalePinWorldPosition = getWorldPosititon(
            expansionBoardButtonMalePin
          );

          const distance = pinPos.distanceTo(
            expansionBoardButtonMalePinWorldPosition
          );
          // console.log("Step 49 distance:", distance);

          if (distance < distanceValue) {
            pushButtonJstWireBlinking();
            indication.cleanup();
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardButtonMalePinWorldPosition,
              pushButtonJstWire,
              pinModel,
              () => {
                buttonWire.visible = true;
                expansionBoardButtonFemalePin.visible = true;
                pushButtonJstWire.dispose();
                pushButtonJstWire = null;

                stepCounter = 47;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step50();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //Buzzer pin second conection
    async function Step50() {
      const expansionBoardBuzzerMalePin = botMalePinsMap.get(
        "expansionBoardBuzzerMalePin"
      ).mesh;

      const buzzerJstWireBlinking = BlinkMesh([
        buzzerJstWire.wires[0].wire,
        buzzerJstWire.wires[1].wire,
        buzzerJstWire.wires[2].wire,
        buzzerJstWire.pinGLTF2,
        expansionBoardBuzzerMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardBuzzerMalePin,
        buzzerJstWire.pinGLTF2
      );
      const expansionBoardBuzzerFemale = botFemalePinsMap.get(
        "expansionBoardBuzzerFemale"
      ).mesh;
      const buzzerWire = wiresMap.get("buzzerWire").mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      buzzerJstWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === buzzerJstWire &&
          stepCounter === 47
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardBuzzerMalePinWorldPosition = getWorldPosititon(
            expansionBoardBuzzerMalePin
          );

          const distance = pinPos.distanceTo(
            expansionBoardBuzzerMalePinWorldPosition
          );
          // console.log("Step 50 distance:", distance);

          if (distance < distanceValue) {
            indication.cleanup();
            buzzerJstWireBlinking();
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardBuzzerMalePinWorldPosition,
              buzzerJstWire,
              pinModel,
              () => {
                buzzerWire.visible = true;
                expansionBoardBuzzerFemale.visible = true;
                buzzerJstWire.dispose();
                buzzerJstWire = null;

                stepCounter = 48;
                sidepanelInstance.updateTextOnly(
                  botBuildingSteps[stepCounter - 1]
                );
                Step51();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //LDR connection second
    async function Step51() {
      const expansionBoardLdrMalePin = botMalePinsMap.get(
        "expansionBoardLdrMalePin"
      ).mesh;

      const ldrJstWireBlinking = BlinkMesh([
        ldrJstWire.wires[0].wire,
        ldrJstWire.wires[1].wire,
        ldrJstWire.wires[2].wire,
        ldrJstWire.pinGLTF2,
        expansionBoardLdrMalePin,
      ]);
      const indication = showIndication(
        scene,
        camera,
        expansionBoardLdrMalePin,
        ldrJstWire.pinGLTF2
      );
      const expansionBoardLdrFemalePin = botFemalePinsMap.get(
        "expansionBoardLdrFemalePin"
      ).mesh;
      const ldrWire = wiresMap.get("ldrWire").mesh;
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);
      ldrJstWire.setDraggable(true, ["pinGLTF2"]);
      raycasterSetup.refreshPinModelsRef();
      const originalOnMouseDown = raycasterSetup.onMouseDown;
      raycasterSetup.onMouseDown = (event) => {
        originalOnMouseDown.call(raycasterSetup, event);
        if (raycasterSetup.draggedComponent instanceof JstXhFemalePin) {
          indication.toggleVisibility();
        }
      };
      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent instanceof JstXhFemalePin &&
          raycasterSetup.draggedComponent === ldrJstWire &&
          stepCounter === 48
        ) {
          const pinModel = raycasterSetup.draggedPinModel;
          const pinPos = getWorldPosititon(pinModel);
          const expansionBoardLdrMalePinWorldPosition = getWorldPosititon(
            expansionBoardLdrMalePin
          );

          const distance = pinPos.distanceTo(
            expansionBoardLdrMalePinWorldPosition
          );
          // console.log("Step 51 distance:", distance);

          if (distance < distanceValue) {
            ldrJstWireBlinking();
            indication.cleanup();
            hideFrontPannel();
            topCaseHiding();
            raycasterSetup.snapObject(
              pinModel,
              expansionBoardLdrMalePinWorldPosition,
              ldrJstWire,
              pinModel,
              () => {
                ldrWire.visible = true;
                expansionBoardLdrFemalePin.visible = true;
                ldrJstWire.dispose();
                ldrJstWire = null;

                stepCounter = 49;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.tyreCasing,
                  "tyreCase1",
                  botBuildingSteps[stepCounter - 1]
                );
                Step52();
              }
            );
          } else {
            // console.log("JST pin not snapped, distance too large:", distance);
          }
        } else {
          // console.log(
          //   "Drag ignored: draggedComponent:",
          //   raycasterSetup.draggedComponent,
          //   "stepCounter:",
          //   stepCounter
          // );
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }
    //tyrecase1
    async function Step52() {
      const tyreCase1 = assembeldBotOrginal.get("tyreCase1");
      const tyreCase2 = assembeldBotOrginal.get("tyreCase2");
      const tyreCase3 = assembeldBotOrginal.get("tyreCase3");
      const tyreCase4 = assembeldBotOrginal.get("tyreCase4");

      tyreCase1.visible = true;
      tyreCase2.visible = true;
      tyreCase3.visible = true;
      tyreCase4.visible = true;
      const tyreCase1Blinking = BlinkMesh([
        tyreCase1,
        tyreCase2,
        tyreCase3,
        tyreCase4,
      ]);

      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "tyreCase1" &&
          stepCounter === 49
        ) {
          const { distance, targetPos } = getDistance(
            raycasterSetup,
            tyreCase1
          );
          // console.log(distance);

          if (distance < distanceValue) {
            tyreCase1Blinking();
            snappingEffect(tyreCase1, [-0.04, 0, 0]);
            snappingEffect(tyreCase2, [-0.04, 0, , 0]);
            snappingEffect(tyreCase3, [0.04, 0, 0]);
            snappingEffect(tyreCase4, [0.04, 0, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 50;
                setupForNextSetup(
                  raycasterSetup,
                  stepCounter,
                  sidepanelInstance,
                  assembeldBotCopy,
                  allAssets.textures.tyre,
                  "tyre1",
                  botBuildingSteps[stepCounter - 1]
                );
                Step56();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    async function Step56() {
      const tyre1 = assembeldBotOrginal.get("tyre1");
      const tyre2 = assembeldBotOrginal.get("tyre2");
      const tyre3 = assembeldBotOrginal.get("tyre3");
      const tyre4 = assembeldBotOrginal.get("tyre4");
      tyre1.visible = true;
      tyre2.visible = true;
      tyre3.visible = true;

      tyre4.visible = true;

      const tyre1Blinking = BlinkMesh([tyre1, tyre2, tyre3, tyre4]);
      const originalOnMouseUp = raycasterSetup.onMouseUp;
      await AudioHandler(allAssets.audios[`step${stepCounter}`]);

      raycasterSetup.onMouseUp = (event) => {
        if (
          raycasterSetup.isDragging &&
          raycasterSetup.draggedComponent &&
          raycasterSetup.draggedComponent.name === "tyre1" &&
          stepCounter === 50
        ) {
          const { distance, targetPos } = getDistance(raycasterSetup, tyre1);
          // console.log(distance);

          if (distance < distanceValue) {
            tyre1Blinking();
            snappingEffect(tyre1, [-0.04, 0, 0]);
            snappingEffect(tyre2, [-0.04, 0, 0]);
            snappingEffect(tyre3, [0.04, 0, 0]);
            snappingEffect(tyre4, [0.04, 0, 0]);

            const targetLocal = table.worldToLocal(targetPos.clone());
            raycasterSetup.snapObject(
              raycasterSetup.draggedComponent,
              targetLocal,
              null,
              null,
              () => {
                stepCounter = 51;
                showCompletionSequence();
              }
            );
          } else {
            table.remove(raycasterSetup.draggedComponent);
            raycasterSetup.draggedElement = null;
          }
        }
        originalOnMouseUp.call(raycasterSetup, event);
      };
    }

    Step1();
  }

  InitialiseSteps();
async function showCompletionSequence() {
    try {
      console.log("Starting completion sequence...");

      // --- FIX 1: Stop the Loop ---
      // We use the renderer to stop the loop instead of 'animationFrameId'
      if (renderer && typeof renderer.setAnimationLoop === 'function') {
        renderer.setAnimationLoop(null);
      }

      // --- FIX 2: Hide Canvas ---
      // We look for the renderer's DOM element or fallback to a query selector
      const canvas = renderer ? renderer.domElement : document.querySelector("canvas");
      if (canvas) {
        canvas.style.display = "none";
      }

      // --- FIX 3: Hide Sidepanel (Optional) ---
      // Hides the UI so it doesn't overlap the video
      if (sidepanelInstance) {
         sidepanelInstance.elements.forEach(el => {
            el.visible = false;
         });
      }

      // --- FIX 4: Run Sequence ---
      // Now safe to use subtitleSystem because we defined it at the top
      await subtitleSystem.showSubtitle(
        "You have successfully built the first version of Byte",
        4000
      );

      await new Promise((resolve) => setTimeout(resolve, 800));

      await subtitleSystem.showSubtitle(
        "Now it's time to enter to the next level",
        4000
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Play the end video (Using the imported VideoPlayer class logic)
      // Make sure the path is correct for your project structure
      await videoPlayer.playVideo("./audios/endvideo2.mp4");

    } catch (error) {
      console.error("Error in completion sequence:", error);
      // Fallback: If video/subtitles fail, force redirect after 2 seconds
      setTimeout(() => {
        window.location.href = "./index.html";
      }, 2000);
    }
  }
}

