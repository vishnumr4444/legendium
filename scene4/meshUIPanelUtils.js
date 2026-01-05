import * as THREE from "three";
import ThreeMeshUI from "three-mesh-ui";
import FontJSON from "../fonts/msdf/Roboto-msdf.json";
import FontImage from "../fonts/msdf/Roboto-msdf.png";
 
/**
 * @fileoverview Scene 4 mesh-based UI panels.
 *
 * This module implements a reusable `MeshUIPanels` controller that:
 * - builds multiple `three-mesh-ui` panels (info panel, circuit panel, buttons)
 * - manages button state (idle/hovered/selected) using raycasting
 * - supports a paged "info" panel that can display text and optionally a model
 *   (cloned or reused) alongside the text content
 *
 * Integration points (see `scene4.js`):
 * - `updateButtons(mouse, currentCamera, renderer)` is called each frame
 *   to update hover/selection state for 3D UI buttons.
 * - `updateAnimation(elapsedTime)` is called each frame to animate the
 *   currently displayed model (gentle bob + rotation).
 * - External callbacks are provided to handle "Solve Circuit", "Return", etc.
 *
 * Notes:
 * - Fonts use MSDF assets imported from the local repo for stability/offline use.
 * - This class stores references to created UI blocks and should be cleaned up
 *   via `cleanup()` when leaving the scene.
 */

/**
 * Controller for Scene 4 mesh-based panels.
 *
 * @example
 * const panels = new MeshUIPanels(scene, panelData, onSolveCircuit, onHideCircuit, onShowObjective);
 * // in render loop:
 * panels.updateButtons(mouseNDC, currentCamera, renderer);
 * panels.updateAnimation(clock.getElapsedTime());
 * // on cleanup:
 * panels.cleanup();
 */
export class MeshUIPanels {
  constructor(
    scene,
    panelData,
    circuitSolutionCallback,
    hideCircuitItemsCallback,
    showSceneObjectiveCallback
  ) {
    /** @type {THREE.Scene} */
    this.scene = scene;
    /** @type {Array<any>} */
    this.panelData = panelData;
    /** @type {Function} Called when "Solve Circuit" is selected. */
    this.circuitSolutionCallback = circuitSolutionCallback;
    /** @type {Function} Called when leaving the circuit view. */
    this.hideCircuitItemsCallback = hideCircuitItemsCallback;
    /** @type {Function} Called to update/drive scene objectives from UI flow. */
    this.showSceneObjectiveCallback = showSceneObjectiveCallback;
    this.raycaster = new THREE.Raycaster();
    /** @type {THREE.Object3D[]} UI objects to ray-test each frame. */
    this.objsToTest = [];
    /** Current info panel page index. */
    this.panelIndex = 0;
    /**
     * Guard to prevent "selected" being applied repeatedly while the pointer is held.
     * `scene4.js` drives selectState; this module uses it to pick one selection.
     */
    this.buttonHandled = false;
    /** True when pointer is pressed (driven by scene input). */
    this.selectState = false;
    /** Models cloned for display; disposed in `removeClonedModels()`. */
    this.clonedModels = [];
    /** The currently visible model on the info panel (clone or original). */
    this.currentModel = null;
 
    /** Button style: hover state. */
    this.hoveredStateAttributes = {
      state: "hovered",
      attributes: {
        backgroundColor: new THREE.Color(0x999999),
        backgroundOpacity: 1,
        fontColor: new THREE.Color(0xffffff),
      },
    };
 
    /** Button style: idle state. */
    this.idleStateAttributes = {
      state: "idle",
      attributes: {
        backgroundColor: new THREE.Color(0x666666),
        backgroundOpacity: 0.3,
        fontColor: new THREE.Color(0xffffff),
      },
    };
 
    /** Button style: selected state. */
    this.selectedAttributes = {
      state: "selected",
      attributes: {
        backgroundColor: new THREE.Color(0x777777),
        fontColor: new THREE.Color(0x222222),
      },
    };
 
    this.initPanels();
    this.updatePanel(this.panelIndex);
  }
 
  /**
   * Build all ThreeMeshUI blocks and attach them to the scene.
   *
   * Panels created:
   * - circuit panel: contains the "Solve Circuit" button
   * - info panel: shows text + optional model
   * - control containers: Prev/Next/Return navigation buttons
   */
  initPanels() {
    this.circuitPanel = new ThreeMeshUI.Block({
      width: 1.2,
      height: 1.0,
      justifyContent: "start",
      contentDirection: "column",
      borderRadius: 0.15,
      backgroundOpacity: 0.0,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.08,
    });
 
    const spacer = new ThreeMeshUI.Block({
      width: 0.2,
      height: 0.4,
      backgroundOpacity: 0.0,
    });
 
    this.controlButtonContainer = new ThreeMeshUI.Block({
      height: 0.4,
      width: 3.5,
      padding: 0.045,
      contentDirection: "row",
      justifyContent: "center",
      borderRadius: 0.05,
      backgroundOpacity: 0.8,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.12,
    });
 
    this.circControlButtonContainer = new ThreeMeshUI.Block({
      height: 0.1,
      width: 0.25,
      contentDirection: "row",
      justifyContent: "center",
      borderRadius: 0.03,
      backgroundOpacity: 0.8,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.12,
    });
 
    this.button = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.25,
      padding: 0.045,
      borderRadius: 0.05,
      backgroundOpacity: 0.8,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.12,
    }).add(
      new ThreeMeshUI.Text({
        content: "Solve Circuit",
      })
    );
 
    this.circBackButton = new ThreeMeshUI.Block({
      height: 0.05,
      width: 0.2,
      margin: 0,
      padding: 0.005,
      borderRadius: 0.015,
      backgroundOpacity: 0.8,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.03,
    }).add(
      new ThreeMeshUI.Text({
        content: "Return",
      })
    );
 
    this.prevButton = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.25,
      margin: 0.05,
      padding: 0.045,
      borderRadius: 0.05,
      backgroundOpacity: 0.8,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.12,
    }).add(
      new ThreeMeshUI.Text({
        content: "Prev",
      })
    );
 
    this.nextButton = new ThreeMeshUI.Block({
      height: 0.25,
      width: 1.0,
      margin: 0.05,
      padding: 0.045,
      borderRadius: 0.05,
      backgroundOpacity: 0.8,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.12,
    }).add(
      new ThreeMeshUI.Text({
        content: "Next",
      })
    );
 
    this.backButton = new ThreeMeshUI.Block({
      height: 0.25,
      width: 1.0,
      margin: 0.05,
      padding: 0.045,
      borderRadius: 0.05,
      backgroundOpacity: 0.8,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.12,
    }).add(
      new ThreeMeshUI.Text({
        content: "Return",
      })
    );
 
    this.infoMainPanel = new ThreeMeshUI.Block({
      height: 2.4,
      width: 4.65,
      justifyContent: "center",
      borderRadius: 0.15,
      backgroundOpacity: 0.0,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.12,
    });
 
    this.contentBlock = new ThreeMeshUI.Block({
      height: 2.4,
      width: 4.5,
      borderRadius: 0.15,
      backgroundOpacity: 0.0,
      contentDirection: "row",
      justifyContent: "space-between",
    });
 
    this.leftSubBlock = new ThreeMeshUI.Block({
      height: 2.2,
      width: 1.3,
      margin: 0.025,
      backgroundOpacity: 0.0,
      borderRadius: 0.15,
    });
 
    this.rightSubBlockText = new ThreeMeshUI.Text({
      content: "",
    });
 
    this.rightSubBlock = new ThreeMeshUI.Block({
      height: 2.2,
      width: 3.0,
      padding: 0.15,
      borderRadius: 0.15,
      margin: 0.025,
      fontSize: 0.11,
      backgroundOpacity: 0.0,
      justifyContent: "center",
      textAlign: "justify-left",
    }).add(this.rightSubBlockText);
 
    // Set up button clickability
    [
      this.button,
      this.circBackButton,
      this.prevButton,
      this.nextButton,
      this.backButton,
    ].forEach((btn) => {
      btn.traverse((child) => {
        child.userData.clickable = true;
        child.userData.parentButton = btn;
      });
      btn.userData.clickable = true;
    });
 
    // Set up button states
    this.button.setupState(this.idleStateAttributes);
    this.button.setupState(this.hoveredStateAttributes);
    this.button.setupState({
      state: "selected",
      attributes: this.selectedAttributes.attributes,
      onSet: () => {
        console.log("Solve Circuit button selected");
        this.circuitSolutionCallback();
        this.circControlButtonContainer.visible = true;
      },
    });
 
    this.circBackButton.setupState(this.idleStateAttributes);
    this.circBackButton.setupState(this.hoveredStateAttributes);
    this.circBackButton.setupState({
      state: "selected",
      attributes: this.selectedAttributes.attributes,
      onSet: () => {
        console.log("Back button selected");
        this.hideCircuitItemsCallback();
      },
    });
 
    this.prevButton.setupState(this.idleStateAttributes);
    this.prevButton.setupState(this.hoveredStateAttributes);
    this.prevButton.setupState({
      state: "selected",
      attributes: this.selectedAttributes.attributes,
      onSet: () => {
        if (this.panelIndex > 0) {
          this.panelIndex -= 1;
        } else {
          this.panelIndex = this.panelData.length - 1;
        }
        this.updatePanel(this.panelIndex);
        console.log("Prev clicked → index:", this.panelIndex);
        this.prevButton.setState("idle");
      },
    });
 
    this.nextButton.setupState(this.idleStateAttributes);
    this.nextButton.setupState(this.hoveredStateAttributes);
    this.nextButton.setupState({
      state: "selected",
      attributes: this.selectedAttributes.attributes,
      onSet: () => {
        if (this.panelIndex < this.panelData.length - 1) {
          this.panelIndex += 1;
        } else {
          this.panelIndex = 0;
        }
        this.updatePanel(this.panelIndex);
        console.log("Next clicked → index:", this.panelIndex);
        this.nextButton.setState("idle");
      },
    });
 
    this.backButton.setupState(this.idleStateAttributes);
    this.backButton.setupState(this.hoveredStateAttributes);
    this.backButton.setupState({
      state: "selected",
      attributes: this.selectedAttributes.attributes,
      onSet: () => {
        console.log("Back clicked → index:", this.panelIndex);
        this.backButton.setState("idle");
        this.showSceneObjectiveCallback(2);
        this.infoMainPanel.visible = false;
        this.controlButtonContainer.visible = false;
        this.hideCircuitItemsCallback();
        this.removeClonedModels();
      },
    });
 
    // Configure panel properties
    [this.infoMainPanel, this.circuitPanel].forEach((panel) => {
      panel.traverse((child) => {
        if (child.isMesh) {
          child.material.depthWrite = false;
          child.material.transparent = true;
        }
      });
    });
 
    // Add buttons to containers
    this.circuitPanel.add(spacer, this.button);
    this.contentBlock.add(this.leftSubBlock, this.rightSubBlock);
    this.infoMainPanel.add(this.contentBlock);
    this.circControlButtonContainer.add(this.circBackButton);
    this.controlButtonContainer.add(
      this.prevButton,
      this.nextButton,
      this.backButton
    );
 
    // Position panels
    this.infoMainPanel.position.set(-3.7, 0, -8.2);
    this.circControlButtonContainer.position.set(-4.8, -0.5, 8.0);
    this.circControlButtonContainer.rotation.set(Math.PI / 12, Math.PI, 0);
    this.controlButtonContainer.position.set(-3.8, -1.5, -8.2);
    this.circuitPanel.position.set(-28.0, -0.45, 0.3);
    this.circuitPanel.rotation.y = Math.PI / 2;
 
    // Add panels to scene
    this.scene.add(
      this.circuitPanel,
      this.infoMainPanel,
      this.controlButtonContainer
    );
    this.infoMainPanel.visible = false;
    this.controlButtonContainer.visible = false;
    this.circControlButtonContainer.visible = false;
 
    // Initialize objsToTest
    this.objsToTest = [
      this.circBackButton,
      this.prevButton,
      this.nextButton,
      this.backButton,
    ];
  }
 
  /**
   * Update the info panel content to show the page at `index`.
   *
   * The panel entry can optionally specify a `model`:
   * - if `shouldClone` is true, we clone the model and later dispose it
   * - otherwise we reuse the model reference (caller owns its lifecycle)
   *
   * @param {number} index
   */
  updatePanel(index) {
    const contentData = this.panelData[index];
    if (!contentData) return;
 
    let {
      text,
      model,
      shouldClone = true,
      position = new THREE.Vector3(-5.25, -0.45, -8.0),
      rotation = new THREE.Vector3(0, 0, 0),
      scale = new THREE.Vector3(1, 1, 1),
    } = contentData;
 
    if (Array.isArray(position)) position = new THREE.Vector3(...position);
    if (Array.isArray(rotation)) rotation = new THREE.Vector3(...rotation);
    if (Array.isArray(scale)) scale = new THREE.Vector3(...scale);
 
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      if (this.currentModel.userData?.isClone) {
        this.currentModel.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        });
      }
      this.currentModel = null;
    }
 
    if (model) {
      this.currentModel = shouldClone ? model.clone() : model;
      if (shouldClone) {
        this.currentModel.userData.isClone = true;
        this.clonedModels.push(this.currentModel);
      }
      this.currentModel.position.copy(position);
      this.currentModel.rotation.set(rotation.x, rotation.y, rotation.z);
      this.currentModel.scale.copy(scale);
      this.currentModel.userData.baseY = this.currentModel.position.y;
      this.scene.add(this.currentModel);
    }
 
    this.rightSubBlockText.set({ content: text });
    this.rightSubBlockText.update();
    this.rightSubBlock.update();
  }
 
  /**
   * Update button hover/selected states using raycasting.
   *
   * Expected inputs:
   * - `mouse`: normalized device coordinates (NDC), range [-1..1]
   * - `currentCamera`: the active camera for raycasting
   * - `renderer`: used to skip hover checks when XR is presenting
   *
   * Selection behavior:
   * - When `this.selectState === true`, the closest hovered button is set to "selected" once.
   * - When `this.selectState === false`, the closest hovered button is set to "hovered".
   *
   * @param {THREE.Vector2} mouse
   * @param {THREE.Camera} currentCamera
   * @param {THREE.WebGLRenderer} renderer
   */
  updateButtons(mouse, currentCamera, renderer) {
    if (renderer.xr.isPresenting || !this.objsToTest.length) return;
    if (mouse.x === null || mouse.y === null) return;
 
    this.raycaster.setFromCamera(mouse, currentCamera);
 
    let closest = null;
    let minDistance = Infinity;
 
    this.objsToTest.forEach((obj) => {
      if (!obj || !obj.parent || !obj.visible) return;
      const intersections = this.raycaster.intersectObject(obj, true);
      if (intersections.length > 0 && intersections[0].distance < minDistance) {
        closest = obj;
        minDistance = intersections[0].distance;
      }
    });
 
    this.objsToTest.forEach((obj) => {
      if (obj && obj.isUI && obj.visible) {
        obj.setState("idle");
      }
    });
 
    if (closest && closest.isUI && closest.visible) {
      if (this.selectState && !this.buttonHandled) {
        closest.setState("selected");
        this.buttonHandled = true;
      } else if (!this.selectState) {
        closest.setState("hovered");
        this.buttonHandled = false;
      }
    }
  }
 
  /**
   * Animate the currently displayed model (if any) and set render orders.
   * Called from the main render loop.
   *
   * @param {number} elapsedTime
   */
  updateAnimation(elapsedTime) {
    if (this.currentModel) {
      this.currentModel.renderOrder = 2;
      let bobHeight = 0.05 * Math.sin(elapsedTime * 2);
      this.currentModel.position.y =
        this.currentModel.userData.baseY + bobHeight;
      this.currentModel.rotation.y += 0.01;
    }
    [
      this.circuitPanel,
      this.infoMainPanel,
      this.contentBlock,
      this.leftSubBlock,
      this.rightSubBlock,
      this.button,
    ].forEach((element) => {
      if (element) element.renderOrder = 0;
    });
  }
 
  /**
   * Set whether the pointer is currently pressed.
   * This is typically driven by `window.pointerdown/pointerup` handlers.
   *
   * @param {boolean} state
   */
  setSelectState(state) {
    this.selectState = state;
  }
 
  /**
   * Dispose and remove any cloned models created for the info panel.
   * This prevents memory leaks when switching pages or leaving the scene.
   */
  removeClonedModels() {
    this.clonedModels.forEach((clone) => {
      if (!clone) return;
      this.scene.remove(clone);
      clone.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.clonedModels.length = 0;
  }
 
  /**
   * Clean up all panels, remove from scene, and dispose cloned models.
   * Call this from the owning scene cleanup.
   */
  cleanup() {
    [
      this.circuitPanel,
      this.button,
      this.prevButton,
      this.nextButton,
      this.backButton,
      this.circBackButton,
      this.infoMainPanel,
      this.controlButtonContainer,
      this.circControlButtonContainer,
      this.contentBlock,
      this.leftSubBlock,
      this.rightSubBlock,
    ].forEach((element) => {
      if (element && element.parent) {
        element.parent.remove(element);
        ThreeMeshUI.update();
        element = null;
      }
    });
    this.removeClonedModels();
    this.objsToTest = [];
    this.currentModel = null;
    this.panelData = [];
  }
 
  /**
   * Get the current set of UI objects that should be ray-tested by the scene.
   * @returns {THREE.Object3D[]}
   */
  getObjsToTest() {
    return this.objsToTest;
  }
}
 
 