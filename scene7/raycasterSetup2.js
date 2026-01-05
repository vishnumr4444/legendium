/**
 * Centralized mouse interaction controller for the bot-building mini-game.
 *
 * Features:
 * - Singleton pattern (one instance per scene)
 * - Drag & drop of side panel components onto the work table
 * - Drag & drop of JST pin connectors managed by `JstXhFemalePin`
 * - Step-based gating: only allows interaction with the component relevant
 *   to the current `stepCounterCallback` step
 */
import * as THREE from "three";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { gsap } from "gsap";
import { JstXhFemalePin } from "./JstXhFemalePin2.js";
import { isAudioPlaying } from "./utils/audioHandler.js";


export class RaycasterSetup2 {
  constructor(scene, camera, controls, stepCounterCallback) {
    if (!RaycasterSetup2.instance) {
      this.scene = scene;
      this.camera = camera;
      this.controls = controls;
      this.stepCounterCallback = stepCounterCallback;
      this.currentStep = stepCounterCallback(); // Initialize current step
      this.mouseCoord = new THREE.Vector2();
      this.raycaster = new THREE.Raycaster();
      this.raycaster.near = 0;
      this.raycaster.far = Infinity;

      this.draggedPinModel = null;
      this.lastPosition = null;
      this.pinModelsRef = JstXhFemalePin.getAllModels();
      console.log("pinModelsRef initialized:", this.pinModelsRef);

      this.kpLessons = true;
      this.interactiveObjects = [];
      this.sidePanelObjects = [];
      this.isDragging = false;
      this.draggedComponent = null;
      this.originalPosition = null;
      this.draggedElement = null;

      this.referencePlaneGeometry = new THREE.PlaneGeometry(10, 10, 8, 8);
      this.referencePlaneGeometry.rotateX(-Math.PI * 0.5);
      this.referencePlaneMaterial = new THREE.MeshBasicMaterial({
        color: "red",
        transparent: true,
        side: THREE.DoubleSide,
        visible: false,
        opacity: 0.5,
      });
      this.referencePlane = new THREE.Mesh(
        this.referencePlaneGeometry,
        this.referencePlaneMaterial
      );
      this.referencePlane.position.set(0, 2, 0);
      this.scene.add(this.referencePlane);

      window.addEventListener("mousedown", (event) => this.onMouseDown(event));
      window.addEventListener("mousemove", (event) => this.onMouseMove(event));
      window.addEventListener("mouseup", (event) => this.onMouseUp(event));

      RaycasterSetup2.instance = this;
    }
    return RaycasterSetup2.instance;
  }

  // Method to update the current step (called externally as the tutorial advances).
  updateStep(step) {
    this.currentStep = step;
    console.log("RaycasterSetup2 updated to step:", this.currentStep);
  }

  refreshPinModelsRef() {
    this.pinModelsRef = JstXhFemalePin.getAllModels();
    // console.log("Refreshed pinModelsRef:", this.pinModelsRef);
  }

  addSidePanelObjects(...objects) {
    this.sidePanelObjects.push(...objects);
  }

  // Primary mouse-down handler: decides whether to drag from side panel, JST pins, or 3D components.
  onMouseDown(event) {
    this.mouseCoord.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoord.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseCoord, this.camera);

    // Refresh pin models before intersection
    this.refreshPinModelsRef();
    if (isAudioPlaying(allAssets.audios[`step${this.currentStep}`])) {
      return;
    }
    // Define the component names for each step
    const stepComponentMap = {
      1: "botBody",
      2: "chargingModule",
      3: "motor1",
      4: "motor2",
      5: "battery",
      6: "motorCasing",
      7: "motorDriver",
      8: null,
      9: null,
      10: "bucConverter",
      11: "switch",
      12: "powerDistributionBoard",
      13: null,
      14: null,
      15: null,
      16: null,
      17: null,
      18: null,
      19: null,
      20: "botClosingCase",
      21: "botMiddleClip1",
      22: "botMiddleCase",
      23: "expansionBoard",
      24: null,
      25: null,
      26: "frontPannel",
      27: "rightEye",
      28: "leftEye",
      29: "rgbModuleRight",
      30: "rgbModuleLeft",
      31: "arduinoNano",
      32: null,
      33: null,
      34: null,
      35: null,
      36: "topCase",
      37: "tsopSensor",
      38: null,
      39: "pushButton",
      40: null,
      41: "buzzerSensor",
      42: null,
      43: "ldrSensor",
      44: null,
      45: null,
      46: null,
      47: null,
      48: null,
      49: "tyreCase1",
      50: "tyre1",
    };

    const targetComponentName = stepComponentMap[this.currentStep];
    if (!targetComponentName && this.currentStep !== 8) {
      console.warn("No component defined for step:", this.currentStep);
      return;
    }

    const sideIntersects = this.raycaster.intersectObjects(
      this.sidePanelObjects,
      true
    );
    if (sideIntersects.length > 0) {
      let hitObject = sideIntersects[0].object;
      let rootElement = hitObject;
      while (rootElement && !this.sidePanelObjects.includes(rootElement)) {
        rootElement = rootElement.parent;
      }
      if (
        rootElement &&
        this.sidePanelObjects.includes(rootElement) &&
        rootElement.name === targetComponentName
      ) {
        // Show the 3D model in the side panel when drag begins
        if (rootElement.children[0]) {
          rootElement.children[0].visible = true;
        }

        const clonedMesh = rootElement.children[0].clone();
        clonedMesh.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
          }
        });
        if (clonedMesh) {
          this.draggedElement = rootElement;
          const table = this.scene.getObjectByName("table2");
          if (table) {
            table.add(clonedMesh);
            const planeIntersects = this.raycaster.intersectObject(
              this.referencePlane
            );
            if (planeIntersects.length > 0) {
              const point = planeIntersects[0].point;
              const localPoint = table.worldToLocal(point.clone());
              clonedMesh.position.copy(localPoint);
            }
            this.isDragging = true;
            this.draggedComponent = clonedMesh;
            this.originalPosition = clonedMesh.position.clone();
            this.draggedPinModel = null;
            this.controls.enabled = false;
            console.log(
              "Started dragging side panel mesh:",
              clonedMesh.name || "Unnamed"
            );
          } else {
            console.warn("Table not found for adding dragged mesh.");
          }
        }
      } else {
        console.log(
          "Ignoring drag: Component",
          rootElement?.name,
          "does not match step",
          this.currentStep,
          "expected component",
          targetComponentName
        );
      }
      return;
    }

    const allModels = this.pinModelsRef.flatMap((obj) =>
      obj.models.filter((m) => m.draggable).map((m) => m.model)
    );
    // console.log("All draggable models:", allModels);

    const jstIntersects = this.raycaster.intersectObjects(allModels, true);
    // console.log("JST intersects:", jstIntersects);

    if (jstIntersects.length > 0) {
      const mesh = jstIntersects[0].object;
      let parentGroup = mesh;
      while (parentGroup.parent && !allModels.includes(parentGroup)) {
        parentGroup = parentGroup.parent;
      }
      // console.log("Parent group (pin model):", parentGroup);
      const componentData = this.pinModelsRef.find((entry) =>
        entry.models.some((m) => m.model === parentGroup && m.draggable)
      );
      if (componentData) {
        this.isDragging = true;
        this.draggedComponent = componentData.instance;
        this.draggedPinModel = parentGroup;
        this.originalPosition = parentGroup.position.clone();
        this.lastPosition = parentGroup.position.clone();
        this.controls.enabled = false;
        // console.log(
        //   "Dragging JST pin:",
        //   parentGroup,
        //   "Instance:",
        //   componentData.instance
        // );
      } else {
        console.warn(
          "No component data found for intersected JST pin model:",
          parentGroup
        );
      }
      return;
    }

    const intersects = this.raycaster.intersectObjects(
      this.interactiveObjects,
      true
    );
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      let targetObject = intersectedObject;
      while (
        targetObject.parent &&
        !this.interactiveObjects.includes(targetObject)
      ) {
        targetObject = targetObject.parent;
      }

      if (
        this.interactiveObjects.includes(targetObject) &&
        targetObject.name === targetComponentName
      ) {
        this.isDragging = true;
        this.draggedComponent = targetObject;
        this.originalPosition = targetObject.position.clone();
        this.draggedPinModel = null;
        this.controls.enabled = false;
        console.log(
          "Dragging interactive object:",
          targetObject.name || "Unnamed"
        );
      } else {
        console.log(
          "Ignoring drag: Interactive object",
          targetObject.name,
          "does not match step",
          this.currentStep,
          "expected component",
          targetComponentName
        );
      }
    }
  }

  // Move handler for whichever component is currently being dragged.
  onMouseMove(event) {
    if (!this.isDragging || !this.draggedComponent) {
      return;
    }

    this.mouseCoord.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoord.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseCoord, this.camera);

    const intersects = this.raycaster.intersectObject(this.referencePlane);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      if (this.draggedComponent instanceof JstXhFemalePin) {
        if (!this.draggedPinModel) {
          console.warn(
            "onMouseMove: Dragging aborted - missing draggedPinModel for JST pin"
          );
          return;
        }
        const parent = this.draggedPinModel.parent.parent;
        if (!parent) {
          console.error(
            "draggedPinModel has no grandparent (table):",
            this.draggedPinModel
          );
          this.isDragging = false;
          return;
        }
        const localPoint = parent.worldToLocal(point.clone());
        this.draggedPinModel.position.copy(localPoint);
        this.draggedComponent.updatePosition(localPoint, this.draggedPinModel);
      } else if (this.draggedComponent.name === "ldrTestingCube") {
        this.referencePlane.rotation.x = Math.PI * 0.5;
        this.referencePlane.position.set(0, 0, -3.3);
        const parent = this.draggedComponent.parent;
        if (!parent) {
          console.error(
            "draggedComponent has no parent:",
            this.draggedComponent
          );
          this.isDragging = false;
          return;
        }
        const localPoint = parent.position;
        let newY = Math.max(2, Math.min(2.4, intersects[0].point.y));
        this.draggedComponent.position.set(
          this.draggedComponent.position.x,
          newY,
          -3.3
        );
      } else {
        const parent = this.draggedComponent.parent;
        if (!parent) {
          console.error(
            "draggedComponent has no parent:",
            this.draggedComponent
          );
          this.isDragging = false;
          return;
        }
        const localPoint = parent.worldToLocal(point.clone());
        this.draggedComponent.position.copy(localPoint);
      }
    }
  }

  // Mouse-up: release drag, clean up temporary clones and state.
  onMouseUp(event) {
    if (this.isDragging && this.draggedComponent) {
      this.draggedComponent.visible = false;
    }
    this.isDragging = false;
    this.draggedComponent = null;
    this.originalPosition = null;
    this.draggedPinModel = null;
    this.lastPosition = null;
    this.controls.enabled = true;

    if (this.draggedElement) {
      if (this.draggedElement.parent) {
        this.draggedElement.parent.remove(this.draggedElement);
      }
      const index = this.sidePanelObjects.indexOf(this.draggedElement);
      if (index !== -1) {
        this.sidePanelObjects.splice(index, 1);
      }
      this.draggedElement = null;
    }
  }

  /**
   * Animate a dragged object into its "snap" position and finalize its state.
   * Also marks JST pins as no longer draggable once snapped.
   */
  snapObject(object, targetPosition, component, pinModel, callback) {
    gsap.to(object.position, {
      x: targetPosition.x,
      y: targetPosition.y - 0.01,
      z: targetPosition.z,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: () => {
        if (component instanceof JstXhFemalePin && pinModel) {
          component.updatePosition(object.position, pinModel);
        }
      },
      onComplete: () => {
        if (component instanceof JstXhFemalePin && pinModel) {
          component.updatePosition(targetPosition, pinModel);
          const entryIndex = this.pinModelsRef.findIndex((entry) =>
            entry.models.some((m) => m.model === pinModel)
          );
          if (entryIndex !== -1) {
            const entry = this.pinModelsRef[entryIndex];
            const modelEntry = entry.models.find((m) => m.model === pinModel);
            if (modelEntry) {
              modelEntry.draggable = false;
              console.log(`Set ${modelEntry.pinType} draggability to false`);
            }
            console.log("Updated pinModelsRef:", this.pinModelsRef);
          } else {
            console.warn("Pin model not found in pinModelsRef:", pinModel);
          }
        }
        const index = this.interactiveObjects.indexOf(object);
        if (index !== -1) {
          this.interactiveObjects.splice(index, 1);
          console.log("Removed object from interactiveObjects:", object);
        }
        if (callback) callback();
      },
    });
  }

  addInteractiveObjects(...objects) {
    this.interactiveObjects.push(...objects);
  }

  static getInstance() {
    return RaycasterSetup2.instance;
  }
}
