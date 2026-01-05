/**
 * About: `scene6/raycasterSetup.js`
 *
 * Raycasting + drag-and-snap controllers for Scene 6.
 * Contains `RaycasterSetup1` (legacy pins/nano) and `RaycasterSetup2` (newer JST system + LDR cube).
 */

"use strict"; // Enable strict mode for safer JavaScript

// Raycasting and drag-and-snap controllers for Scene 6.
// RaycasterSetup1 handles legacy pins/nano; RaycasterSetup2 handles newer JST pins and LDR cube.
import * as THREE from "three";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { gsap } from "gsap";
import { JstXhFemalePin } from "./JstXhFemalePin.js";
import { getSnapHandler } from "./snapping.js";
import { modelTransforms } from "./modelTransforms.js";
import { JstXhFemalePin as Jst2 } from "./JstXhFemalePin2.js";
// Import the new shader manager
import { handleDragStart, handleDragEnd, handleSnap } from "./shaderManager.js";
import { scene6State } from "./scene6State.js";

const snapIfClose = getSnapHandler();
let nanoSnapCameraAdjusted = false;

/**
 * Raycaster + drag handler for legacy JST pins and nano in lessons 1–3.
 * Handles:
 * - Dragging JST pins and snapping them via snapping.js
 * - Enabling/disabling OrbitControls
 * - Forward arrow enablement when snaps complete
 */
export class RaycasterSetup1 {
  
  constructor(scene, camera, controls, onSnap, models = {}) {
    
    if (!RaycasterSetup1.instance) {
      this.scene = scene;
      this.camera = camera;
      this.controls = controls;
      this.mouseCoord = new THREE.Vector2();
      this.raycaster = new THREE.Raycaster();
      this.raycaster.near = 0;
      this.raycaster.far = Infinity;

      this.isDragging = false;
      this.draggedComponent = null;
      this.draggedPinModel = null;
      this.lastPosition = null; // Track last position for drag direction
      this.mouseDownPosition = null; // Track mouse down position for drag threshold

      this.referencePlaneGeometry = new THREE.PlaneGeometry(10, 10, 64, 64);
      this.referencePlaneGeometry.rotateX(-Math.PI * 0.5)

      this.referencePlaneMaterial = new THREE.MeshBasicMaterial({
        color: "red",
        transparent: true,
        visible: false,
        opacity: 0.5,
      });
      this.referencePlane = new THREE.Mesh(
        this.referencePlaneGeometry,
        this.referencePlaneMaterial
      );
      this.referencePlane.position.y = 1.8
      this.scene.add(this.referencePlane);

      this.pinModelsRef = JstXhFemalePin.getAllModels();

      // Store model references from parameters instead of window
      this.models = models;
      this.nanoModel = models.nanoModel || null;
      this.jstPinBatterySide1 = models.jstPinBatterySide1 || null;
      this.rgbLEDModel = models.rgbLEDModel || null;
      this.tempSensorModel = models.tempSensorModel || null;
      this.jstPin2Side1 = models.jstPin2Side1 || null;
      this.jstPin2Side2 = models.jstPin2Side2 || null;
      this.jstPin3Side1 = models.jstPin3Side1 || null;
      this.jstPin3Side2 = models.jstPin3Side2 || null;
      this.secondPin4Female = models.secondPin4Female || null;
      
      // UI callbacks
      this.setForwardArrowEnabled = models.setForwardArrowEnabled || null;
      this.getCurrentStep = models.getCurrentStep || null;
      this.getCurrentLesson = models.getCurrentLesson || null;

      this.onSnap = onSnap; // callback for snap events

      window.addEventListener("mousedown", (event) => this.onMouseDown(event));
      window.addEventListener("mousemove", (event) => this.onMouseMove(event));
      window.addEventListener("mouseup", (event) => this.onMouseUp(event));

      RaycasterSetup1.instance = this;
    }
    return RaycasterSetup1.instance;
  }
  
  // Method to update model references
  updateModels(models) {
    this.models = models;
    this.nanoModel = models.nanoModel || null;
    this.jstPinBatterySide1 = models.jstPinBatterySide1 || null;
    this.rgbLEDModel = models.rgbLEDModel || null;
    this.tempSensorModel = models.tempSensorModel || null;
    this.jstPin2Side1 = models.jstPin2Side1 || null;
    this.jstPin2Side2 = models.jstPin2Side2 || null;
    this.jstPin3Side1 = models.jstPin3Side1 || null;
    this.jstPin3Side2 = models.jstPin3Side2 || null;
    this.secondPin4Female = models.secondPin4Female || null;
    
    // UI callbacks
    this.setForwardArrowEnabled = models.setForwardArrowEnabled || null;
    this.getCurrentStep = models.getCurrentStep || null;
    this.getCurrentLesson = models.getCurrentLesson || null;
  }

  // Add method to refresh pin models reference
  refreshPinModelsRef() {
    this.pinModelsRef = JstXhFemalePin.getAllModels();
    console.log("[RaycasterSetup1] Refreshed pin models reference:", this.pinModelsRef);
  }

  update(deltaTime) {
    // Shader updates are now handled by the shader manager
    // This method is kept for compatibility but no longer needed
  }

  updateReferencePlane() {
    // Align the reference plane to face the camera
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    this.referencePlane.lookAt(this.camera.position.clone().add(cameraDirection));

    // Position the plane at the dragged pin's position or a reasonable distance
    if (this.draggedPinModel) {
      this.referencePlane.position.copy(this.draggedPinModel.position);
    } else {
      // Fallback position (e.g., scene origin)
      this.referencePlane.position.set(0, 0, 0);
    }
  }

  onMouseDown(event) {
    this.mouseCoord.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoord.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseCoord, this.camera);
    const allModels = this.pinModelsRef.flatMap((obj) => obj.models);
    // Add nanoModel to the list of draggable objects if available
    if (this.nanoModel) {
      allModels.push(this.nanoModel);
    }
    // Add battery JST female pin to draggable objects if available
    if (this.jstPinBatterySide1) {
      allModels.push(this.jstPinBatterySide1);
    }
    // Add lesson2 JST pin sides to draggable objects if available
    if (this.jstPin2Side1) {
      allModels.push(this.jstPin2Side1);
    }
    if (this.jstPin2Side2) {
      allModels.push(this.jstPin2Side2);
    }
    // Do NOT add rgbLEDModel to the draggable list
    const intersects = this.raycaster.intersectObjects(allModels, true); // recursive search
    if (intersects.length > 0) {
      this.isDragging = true;

      const mesh = intersects[0].object;
      let parentGroup = mesh;

      // Traverse up to find the pin model (pinGLTF1 or pinGLTF2) or nanoModel
      while (
        parentGroup.parent &&
        !allModels.includes(parentGroup)
      ) {
        parentGroup = parentGroup.parent;
      }

      // Find the corresponding JstXhFemalePin instance
      const componentData = this.pinModelsRef.find((entry) =>
        entry.models.includes(parentGroup)
      );
      if (componentData) {
        this.draggedComponent = componentData.instance;
        this.draggedPinModel = parentGroup; // Store the specific pin model being dragged
        
        // Check if this is jstPin2 and set the appropriate side references
        const jstPin2 = this.models?.jstPin2 || scene6State?.jstPin2 || window?.jstPin2;
        if (jstPin2 && componentData.instance === jstPin2) {
          // This is jstPin2, ensure side references are set correctly
          if (parentGroup === jstPin2.pinGLTF1 || (jstPin2.pinGLTF1 && parentGroup.uuid === jstPin2.pinGLTF1.uuid)) {
            this.jstPin2Side1 = parentGroup;
            this.draggedPinModel = parentGroup;
            console.log("[Raycaster] Detected jstPin2Side1 through componentData");
          } else if (parentGroup === jstPin2.pinGLTF2 || (jstPin2.pinGLTF2 && parentGroup.uuid === jstPin2.pinGLTF2.uuid)) {
            this.jstPin2Side2 = parentGroup;
            this.draggedPinModel = parentGroup;
            console.log("[Raycaster] Detected jstPin2Side2 through componentData");
          }
        }
        
        this.lastPosition = parentGroup.position.clone(); // Initialize last position
        // Disable controls using scene6State.orbitControls if available, otherwise use this.controls
        if (scene6State.orbitControls) {
          scene6State.orbitControls.enabled = false;
        } else if (this.controls) {
          this.controls.enabled = false;
        }
        
        // Use new shader manager for drag start
        handleDragStart(this.draggedPinModel);
        
        // this.updateReferencePlane(); // Update plane orientation and position
      } else if (this.jstPinBatterySide1 && parentGroup === this.jstPinBatterySide1) {
        this.draggedComponent = null;
        this.draggedPinModel = this.jstPinBatterySide1;
        this.lastPosition = this.jstPinBatterySide1.position.clone();
        if (scene6State.orbitControls) {
          scene6State.orbitControls.enabled = false;
        } else if (this.controls) {
          this.controls.enabled = false;
        }
        handleDragStart(this.draggedPinModel);
      } else if (this.jstPin2Side1 && parentGroup === this.jstPin2Side1) {
        // Dragging lesson2 JST pin side 1
        this.draggedComponent = null;
        this.draggedPinModel = this.jstPin2Side1;
        this.lastPosition = this.jstPin2Side1.position.clone();
        if (scene6State.orbitControls) {
          scene6State.orbitControls.enabled = false;
        } else if (this.controls) {
          this.controls.enabled = false;
        }
        handleDragStart(this.draggedPinModel);
      } else if (this.jstPin2Side2 && parentGroup === this.jstPin2Side2) {
        // Dragging lesson2 JST pin side 2
        this.draggedComponent = null;
        this.draggedPinModel = this.jstPin2Side2;
        this.lastPosition = this.jstPin2Side2.position.clone();
        if (scene6State.orbitControls) {
          scene6State.orbitControls.enabled = false;
        } else if (this.controls) {
          this.controls.enabled = false;
        }
        handleDragStart(this.draggedPinModel);
      } else if (this.nanoModel && parentGroup === this.nanoModel) {
        // Dragging the nanoModel
        this.draggedComponent = null;
        this.draggedPinModel = this.nanoModel;
        this.lastPosition = this.nanoModel.position.clone();
        if (scene6State.orbitControls) {
          scene6State.orbitControls.enabled = false;
        } else if (this.controls) {
          this.controls.enabled = false;
        }
        
        // Use new shader manager for drag start
        handleDragStart(this.draggedPinModel);
        
        // this.updateReferencePlane();
      } else if (this.rgbLEDModel && parentGroup === this.rgbLEDModel) {
        // Dragging the rgbLEDModel
        this.draggedComponent = null;
        this.draggedPinModel = this.rgbLEDModel;
        this.lastPosition = this.rgbLEDModel.position.clone();
        if (this.controls) this.controls.enabled = false;
        
        // Use new shader manager for drag start
        handleDragStart(this.draggedPinModel);
        
        // this.updateReferencePlane();
      } else if (this.tempSensorModel && parentGroup === this.tempSensorModel) {
        // Dragging the tempSensorModel (lesson3)
        this.draggedComponent = null;
        this.draggedPinModel = this.tempSensorModel;
        this.lastPosition = this.tempSensorModel.position.clone();
        if (this.controls) this.controls.enabled = false;
        
        // Use new shader manager for drag start
        handleDragStart(this.draggedPinModel);
        
        // this.updateReferencePlane();
      }
    }
  }

  onMouseMove(event) {
    this.mouseCoord.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoord.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseCoord, this.camera);

    if (this.isDragging && this.draggedPinModel) {
      // Update reference plane orientation and position
      // this.updateReferencePlane();

      // --- SNAPPING LOGIC ---
      // Try to snap the dragged pin or nano to the expansion board
      const currentLesson = typeof this.getCurrentLesson === 'function' ? this.getCurrentLesson() : (typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : null);
      if (currentLesson === 'lesson2') {
        console.log("[Raycaster] onMouseMove - lesson2, isDragging:", this.isDragging, "draggedPinModel:", this.draggedPinModel?.name || this.draggedPinModel?.uuid?.substring(0, 8));
      }
      const snapResult = snapIfClose(this.draggedPinModel);
      if (snapResult) {
        // Update the component position if it has an updatePosition method
        if (this.draggedComponent && typeof this.draggedComponent.updatePosition === 'function') {
          // For JST pins, updatePosition handles both the pin model and wire positions
          this.draggedComponent.updatePosition(this.draggedPinModel.position, this.draggedPinModel);
        } else {
          // For nanoModel or other models without updatePosition, just set the position
          this.draggedPinModel.position.copy(this.draggedPinModel.position);
        }
        // --- REMOVED: No more auto-move of the other female pin ---
        // Enable the Next button after JST pin snap (only for first step)
        if (this.setForwardArrowEnabled && typeof this.getCurrentStep === 'function' && this.getCurrentStep() === 0) {
          this.setForwardArrowEnabled(true);
        }
        // Enable Next after battery JST pin snap
        if (this.setForwardArrowEnabled && this.jstPinBatterySide1 && this.draggedPinModel === this.jstPinBatterySide1) {
          this.setForwardArrowEnabled(true);
          // For lesson2 step 4 (last step), this will enable the forward arrow to show Next Lesson button
          if (typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson2') {
            const step = typeof this.getCurrentStep === 'function' ? this.getCurrentStep() : -1;
            console.log(`[Raycaster] Enabled forward arrow after battery JST pin snap in lesson2 step ${step}`);
          }
        }
        // Enable Next button after nanoModel snap on step 2
        if (this.setForwardArrowEnabled && typeof this.getCurrentStep === 'function' && this.nanoModel && this.draggedPinModel === this.nanoModel && this.getCurrentStep() === 2) {
          this.setForwardArrowEnabled(true);
        }
        // Enable Next button after nanoModel snap for lesson2, step 3 (last step)
        if (this.setForwardArrowEnabled && typeof this.getCurrentStep === 'function' && this.nanoModel && this.draggedPinModel === this.nanoModel && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson2' && this.getCurrentStep() === 3) {
          this.setForwardArrowEnabled(true);
        }
        // Enable Next button after nanoModel snap for lesson3, step 3 (last step)
        if (this.setForwardArrowEnabled && typeof this.getCurrentStep === 'function' && this.nanoModel && this.draggedPinModel === this.nanoModel && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson3' && this.getCurrentStep() === 3) {
          this.setForwardArrowEnabled(true);
        }
        // Enable Next button after jstPin2Side1 or jstPin2Side2 snap (any step)
        const jstPin2ForCheck = this.models?.jstPin2 || scene6State?.jstPin2 || window?.jstPin2;
        if (this.setForwardArrowEnabled && this.jstPin2Side1 && (this.draggedPinModel === this.jstPin2Side1 || (jstPin2ForCheck && jstPin2ForCheck.pinGLTF1 === this.draggedPinModel))) {
          this.setForwardArrowEnabled(true);
        }
        if (this.setForwardArrowEnabled && this.jstPin2Side2 && (this.draggedPinModel === this.jstPin2Side2 || (jstPin2ForCheck && jstPin2ForCheck.pinGLTF2 === this.draggedPinModel))) {
          this.setForwardArrowEnabled(true);
        }
        // Enable Next button after lesson3 components snap
        if (this.setForwardArrowEnabled && this.tempSensorModel && this.draggedPinModel === this.tempSensorModel && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson3' && this.getCurrentStep() === 1) {
          this.setForwardArrowEnabled(true);
        }
        if (this.setForwardArrowEnabled && this.jstPin3Side1 && this.draggedPinModel === this.jstPin3Side1 && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson3' && this.getCurrentStep() === 2) {
          this.setForwardArrowEnabled(true);
        }
        if (this.setForwardArrowEnabled && this.jstPin3Side2 && this.draggedPinModel === this.jstPin3Side2 && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson3' && this.getCurrentStep() === 2) {
          this.setForwardArrowEnabled(true);
        }
        
        // Add missing lesson3 LED module connection handlers
        if (this.setForwardArrowEnabled && this.rgbLEDModel && this.draggedPinModel === this.rgbLEDModel && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson3' && this.getCurrentStep() === 4) {
          this.setForwardArrowEnabled(true);
          console.log("[Lesson3] Enabled Next button after LED expansion board connection (step 4)");
        }
        if (this.setForwardArrowEnabled && this.rgbLEDModel && this.draggedPinModel === this.rgbLEDModel && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson3' && this.getCurrentStep() === 5) {
          this.setForwardArrowEnabled(true);
          console.log("[Lesson3] Enabled Next button after LED module connection (step 5)");
        }
        // Notify main scene of snap events
        if (this.onSnap) {
          if (this.secondPin4Female && this.draggedPinModel === this.secondPin4Female) {
            this.onSnap('secondPin4Female');
            // Use new shader manager for snap
            handleSnap('secondPin4Female');
          }
          if (this.jstPinBatterySide1 && this.draggedPinModel === this.jstPinBatterySide1) {
            this.onSnap('jstPinBattery');
            handleSnap('jstPinBattery');
          }
          // Fix: Only emit 'nanoModel' snapType for lesson1, lesson2, or lesson3, step 2
          if (
            this.nanoModel &&
            this.draggedPinModel === this.nanoModel &&
            typeof this.getCurrentLesson === 'function' &&
            (this.getCurrentLesson() === 'lesson1' || this.getCurrentLesson() === 'lesson2' || this.getCurrentLesson() === 'lesson3')
          ) {
            this.onSnap('nanoModel');
            // Use new shader manager for snap
            handleSnap('nanoModel');
          }
          // Check jstPin2Side1 (by reference or by checking if it's part of jstPin2)
          const jstPin2 = this.models?.jstPin2 || scene6State?.jstPin2 || window?.jstPin2;
          if (this.jstPin2Side1 && (this.draggedPinModel === this.jstPin2Side1 || (jstPin2 && jstPin2.pinGLTF1 === this.draggedPinModel))) {
            this.onSnap('jstPin2Side1');
            // Use new shader manager for snap
            handleSnap('jstPin2Side1');
          }
          // Check jstPin2Side2 (by reference or by checking if it's part of jstPin2)
          if (this.jstPin2Side2 && (this.draggedPinModel === this.jstPin2Side2 || (jstPin2 && jstPin2.pinGLTF2 === this.draggedPinModel))) {
            this.onSnap('jstPin2Side2');
            // Use new shader manager for snap
            handleSnap('jstPin2Side2');
          }
          // Lesson3 snap event notifications
          if (this.tempSensorModel && this.draggedPinModel === this.tempSensorModel) {
            this.onSnap('tempSensorModel');
            // Use new shader manager for snap
            handleSnap('tempSensorModel');
          }
          if (this.jstPin3Side1 && this.draggedPinModel === this.jstPin3Side1) {
            this.onSnap('jstPin3Side1');
            handleSnap('jstPin3Side1');
          }
          if (this.jstPin3Side2 && this.draggedPinModel === this.jstPin3Side2) {
            this.onSnap('jstPin3Side2');
            handleSnap('jstPin3Side2');
          }
          
          // Add LED module snap event notifications for lesson3
          if (this.rgbLEDModel && this.draggedPinModel === this.rgbLEDModel && typeof this.getCurrentLesson === 'function' && this.getCurrentLesson() === 'lesson3') {
            const currentStep = typeof this.getCurrentStep === 'function' ? this.getCurrentStep() : 0;
            if (currentStep === 4) {
              this.onSnap('ledExpansionBoard');
              handleSnap('ledExpansionBoard');
            } else if (currentStep === 5) {
              this.onSnap('ledModule');
              handleSnap('ledModule');
            }
          }
        }
        return;
      }
      // --- END SNAPPING LOGIC ---

      const intersects = this.raycaster.intersectObject(this.referencePlane);
      if (intersects.length > 0) {
        const newPosition = intersects[0].point;
        // Calculate drag direction
        let dragDirection = null;
        if (this.lastPosition) {
          dragDirection = newPosition.clone().sub(this.lastPosition).normalize();
        }
        if (this.draggedComponent && this.draggedComponent.updatePosition) {
          this.draggedComponent.updatePosition(newPosition, this.draggedPinModel);
        } else {
          // For nanoModel, just set its position
          this.draggedPinModel.position.copy(newPosition);
        }
        this.lastPosition = newPosition.clone(); // Update last position
      }
    }
  }

  onMouseUp(event) {
    this.isDragging = false;
    // Re-enable controls using scene6State.orbitControls if available, otherwise use this.controls
    if (scene6State.orbitControls) {
      scene6State.orbitControls.enabled = true;
      console.log("[Raycaster] OrbitControls re-enabled on mouse up");
    } else if (this.controls) {
      this.controls.enabled = true;
    }
    
    // Use new shader manager for drag end
    if (this.draggedPinModel) {
      handleDragEnd(this.draggedPinModel);
    }
    try { const mgr = getShaderManager && getShaderManager(); if (mgr && mgr.getDropLabel) { const l = mgr.getDropLabel(); l.visible = false; } } catch (e) {}
    
    this.draggedComponent = null;
    this.draggedPinModel = null;
    this.lastPosition = null; // Reset last position
    // --- NEW LOGIC: Reset wasAutoMoved for all pins on mouse up ---
    for (const entry of this.pinModelsRef) {
      if (entry.instance) {
        entry.instance.wasAutoMoved = false;
      }
    }
  }
};

/**
 * Raycaster + drag handler for the newer JST system (JstXhFemalePin2).
 * Used by lessons 3–5 for multi-pin connectors and LDR cube interaction.
 */
export class RaycasterSetup2 {
  constructor(
    scene,
    camera,
    stepCounterCallback,
    adjustLedBrightness
  ) {
    if (!RaycasterSetup2.instance) {
      this.scene = scene;
      this.camera = camera;
      // this.controls = controls;
      this.stepCounterCallback = stepCounterCallback;
      this.adjustLedBrightness = adjustLedBrightness;
      this.mouseCoord = new THREE.Vector2();
      this.raycaster = new THREE.Raycaster();
      this.raycaster.near = 0;
      this.raycaster.far = Infinity;

      this.draggedPinModel = null;
      this.lastPosition = null;
      this.pinModelsRef = Jst2.getAllModels();
      console.log("pinModelsRef initialized:", this.pinModelsRef);

      this.kpLessons = true;
      this.interactiveObjects = [];
      this.isDragging = false;
      this.draggedComponent = null;
      this.originalPosition = null;

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

  refreshPinModelsRef() {
    this.pinModelsRef = Jst2.getAllModels();
    console.log("Refreshed pinModelsRef:", this.pinModelsRef);
  }

  onMouseDown(event) {
    this.mouseCoord.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoord.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseCoord, this.camera);

    const allModels = this.pinModelsRef.flatMap((obj) =>
      obj.models.filter((m) => m.draggable).map((m) => m.model)
    );
    console.log("All draggable models:", allModels);

    const jstIntersects = this.raycaster.intersectObjects(allModels, true);
    console.log("JST intersects:", jstIntersects);

    if (jstIntersects.length > 0) {
      const mesh = jstIntersects[0].object;
      let parentGroup = mesh;
      while (parentGroup.parent && !allModels.includes(parentGroup)) {
        parentGroup = parentGroup.parent;
      }
      console.log("Parent group (pin model):", parentGroup);
      const componentData = this.pinModelsRef.find((entry) =>
        entry.models.some((m) => m.model === parentGroup && m.draggable)
      );
      if (componentData) {
        this.isDragging = true;
        this.draggedComponent = componentData.instance;
        this.draggedPinModel = parentGroup;
        this.originalPosition = parentGroup.position.clone();
        this.lastPosition = parentGroup.position.clone();
        // this.controls.enabled = false;
        console.log(
          "Dragging JST pin:",
          parentGroup,
          "Instance:",
          componentData.instance
        );
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

      if (this.interactiveObjects.includes(targetObject)) {
        this.isDragging = true;
        this.draggedComponent = targetObject;
        this.originalPosition = targetObject.position.clone();
        this.draggedPinModel = null;
        // this.controls.enabled = false;
        console.log(
          "Dragging interactive object:",
          targetObject.name || "Unnamed"
        );
      }
    }
  }

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
      if (this.draggedComponent instanceof Jst2) {
        if (!this.draggedPinModel) {
          console.warn(
            "onMouseMove: Dragging aborted - missing draggedPinModel for JST pin"
          );
          return;
        }
        // Move in the coordinate space of the immediate parent of the dragged model
        const parent = this.draggedPinModel.parent;
        if (!parent) {
          console.error(
            "draggedPinModel has no parent:",
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
        if (this.stepCounterCallback() === 6) {
          this.adjustLedBrightness(newY);
        }
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

  onMouseUp(event) {
    if (this.isDragging && this.draggedComponent) {
      // console.log("Mouse up, ending drag for:", this.draggedComponent);
    }
    this.isDragging = false;
    this.draggedComponent = null;
    this.originalPosition = null;
    this.draggedPinModel = null;
    this.lastPosition = null;
    // this.controls.enabled = true;
  }

  snapObject(object, targetPosition, component, pinModel, callback) {
    gsap.to(object.position, {
      x: targetPosition.x,
      y: targetPosition.y - 0.01,
      z: targetPosition.z,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: () => {
        if (component instanceof Jst2 && pinModel) {
          component.updatePosition(object.position, pinModel);
        }
      },
      onComplete: () => {
        if (component instanceof Jst2 && pinModel) {
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
    // console.log("Interactive objects updated:", this.interactiveObjects);
  }

  static getInstance() {
    return RaycasterSetup2.instance;
  }
}
