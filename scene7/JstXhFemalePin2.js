import * as THREE from "three";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { Wire } from "./wire.js";

/**
 * Represents a JST-XH female pin connector (2/3/4 pin) with optional dual sides
 * and dynamically drawn wires.
 *
 * Responsibilities:
 * - Clone the appropriate GLTF pin model (or generate a simple fallback)
 * - Track world-space pin positions for each side
 * - Create and update `Wire` instances between pin groups and components
 * - Register itself in a static `allModels` array used by `RaycasterSetup2`
 *   for drag-and-drop interactions.
 */
export class JstXhFemalePin {
  static count = 0;
  static allModels = [];
  static getAllModels() {
    return this.allModels;
  }
  constructor(config) {
    JstXhFemalePin.count++;
    this.config = {
      pinCount: config.pinCount || 2,
      position: config.position || null,
      wireConfigs: config.wireConfigs || [],
      twoSide: config.twoSide || false,
      jstPinConfig: config.jstPinConfig || [],
      colors: config.colors || [],
      draggablePins: config.draggablePins || ["pinGLTF1", "pinGLTF2"],
      draggable: config.draggable !== undefined ? config.draggable : true,
    };
    if (!this.config.draggable) {
      this.config.draggablePins = [];
    }
    this.pinGLTF1 = null;
    this.pinGLTF2 = null;
    this.wires = [];
    this.group = new THREE.Group();
    this.isDraggable = true;
    this.pinPositions1 = [];
    this.pinPositions2 = [];
    this.wasAutoMoved = false;
    this.originalPinPositions = new Map();
    this.id = JstXhFemalePin.count;
    this.configurePinModel();
    this.createWires();
    this.groupInitialPosition = this.group.position.clone();
  }

  setDraggable(draggable, draggablePins = ["pinGLTF1", "pinGLTF2"]) {
    this.config.draggable = draggable;
    if (!draggable) {
      this.config.draggablePins = [];
    } else {
      this.config.draggablePins = draggablePins;
    }
    this.updateModelDraggability(this.config.draggablePins);
  }

  // Choose the correct GLTF model (or fallback geometry) and create one or two pin blocks.
  configurePinModel() {
    let { pinCount, position, twoSide, jstPinConfig, draggablePins } =
      this.config;
    let model = null;

    try {
      if (pinCount === 2) {
        model = allAssets.models.gltf.pin2Female;
      } else if (pinCount === 3) {
        model = allAssets.models.gltf.pin3Female;
      } else if (pinCount === 4) {
        model = allAssets.models.gltf.pin4Female;
      }
    } catch (error) {
      console.warn(
        `Pin model for ${pinCount} pins not found, creating fallback geometry`
      );
    }

    if (!model) {
      model = this.createFallbackPinModel(pinCount);
    }

    this.pinGLTF1 = model.clone();
    twoSide
      ? this.pinGLTF1.position.copy(jstPinConfig[0].startPosition)
      : this.pinGLTF1.position.copy(position);
    this.group.add(this.pinGLTF1);

    if (twoSide) {
      this.pinGLTF2 = model.clone();
      this.pinGLTF2.rotation.z = Math.PI * 3;
      this.pinGLTF2.position.copy(jstPinConfig[1].startPosition);
      this.group.add(this.pinGLTF2);
    }
    this.group.name = `jstPin${JstXhFemalePin.count}`;

    this.updateModelDraggability(draggablePins);
  }

  // Fallback geometry used when GLTF assets are missing: simple box + cylinders.
  createFallbackPinModel(pinCount) {
    const group = new THREE.Group();
    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.3);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);

    const pinSpacing = 0.2;
    const startX = (-(pinCount - 1) * pinSpacing) / 2;

    for (let i = 0; i < pinCount; i++) {
      const pinGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8);
      const pinMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
      const pin = new THREE.Mesh(pinGeometry, pinMaterial);
      pin.position.x = startX + i * pinSpacing;
      pin.position.y = 0.15;
      pin.name = `pin${i + 1}`;
      group.add(pin);
    }

    return group;
  }

  /**
   * Rebuild internal pin position arrays and mark which GLTF groups are draggable.
   * Also syncs this instance into the static `allModels` registry.
   */
  updateModelDraggability(draggablePins) {
    let { twoSide } = this.config;

    this.pinPositions1 = [];
    this.pinGLTF1.traverse((child) => {
      if (child.name.includes("pin") && child.isMesh) {
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);
        this.pinPositions1.push(worldPos);
      }
    });

    const models = [
      {
        model: this.pinGLTF1,
        draggable: draggablePins.includes("pinGLTF1"),
        pinType: "pinGLTF1",
      },
    ];
    if (twoSide) {
      this.pinPositions2 = [];
      this.pinGLTF2.traverse((child) => {
        if (child.name.includes("pin") && child.isMesh) {
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          this.pinPositions2.push(worldPos);
        }
      });
      models.push({
        model: this.pinGLTF2,
        draggable: draggablePins.includes("pinGLTF2"),
        pinType: "pinGLTF2",
      });
    }

    const existingEntryIndex = JstXhFemalePin.allModels.findIndex(
      (e) => e.id === this.id
    );
    if (existingEntryIndex !== -1) {
      JstXhFemalePin.allModels[existingEntryIndex].models = models;
    } else {
      JstXhFemalePin.allModels.push({
        instance: this,
        models,
        id: this.id,
      });
    }
    console.log("Updated allModels:", JstXhFemalePin.allModels);
  }

  // Initialize `Wire` objects between pin positions and their configured endpoints.
  createWires() {
    let { twoSide, wireConfigs, colors } = this.config;
    let pinCount = this.config.pinCount - 1;

    for (let i = 0; i < this.config.pinCount; i++) {
      const wireConfig = {
        startPosition: twoSide
          ? this.pinPositions2[pinCount]
          : wireConfigs[i].startPosition.clone(),
        endPosition: this.pinPositions1[i],
        color: twoSide ? colors[i] : wireConfigs[i].color,
      };
      const wire = new Wire(wireConfig, null);
      this.wires.push(wire);
      this.group.add(wire.wire);
      pinCount--;
    }
  }

  /**
   * Called when either side of the connector is moved; recomputes wire curves
   * based on updated world-space pin positions.
   *
   * @param {THREE.Vector3} newPosition - New local position for the dragged pin block.
   * @param {THREE.Object3D} pinModel - The specific GLTF group being dragged.
   */
  updatePosition(newPosition, pinModel) {
    this.group.position.copy(this.groupInitialPosition);

    const isPin1 = pinModel === this.pinGLTF1;
    const isPin2 = this.config.twoSide && pinModel === this.pinGLTF2;

    this.pinPositions1 = [];
    this.pinGLTF1.traverse((child) => {
      if (child.name.includes("pin") && child.isMesh) {
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);
        this.pinPositions1.push(worldPos);
      }
    });
    if (this.config.twoSide) {
      this.pinPositions2 = [];
      this.pinGLTF2.traverse((child) => {
        if (child.name.includes("pin") && child.isMesh) {
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          this.pinPositions2.push(worldPos);
        }
      });
    }

    let pinCount = this.config.pinCount - 1;
    this.wires.forEach((wire, i) => {
      if (this.config.twoSide) {
        if (isPin1) {
          wire.updateWire(this.pinPositions1[i]);
          wire.wireConfig.startPosition.copy(this.pinPositions2[pinCount]);
        } else if (isPin2) {
          wire.wireConfig.startPosition.copy(this.pinPositions2[pinCount]);
          wire.updateWire(this.pinPositions1[i]);
        }
      } else {
        wire.updateWire(this.pinPositions1[i]);
        wire.wireConfig.startPosition.copy(
          this.config.wireConfigs[i].startPosition
        );
      }
      pinCount--;
    });
  }

  getGroup() {
    return this.group;
  }

  /**
   * Fully dispose this connector:
   * - Remove from scene
   * - Dispose wires and GLTF meshes/materials
   * - Remove from the static `allModels` registry
   */
  dispose() {
    // Remove the group from its parent (scene or other object)
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }

    // Dispose of wires
    this.wires.forEach((wire) => {
      if (wire && wire.dispose) {
        wire.dispose();
      }
    });
    this.wires = [];

    // Helper function to dispose of a model's geometry and materials
    const disposeModel = (model) => {
      if (!model) return;
      model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            // Handle both single material and array of materials
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    };

    // Dispose of pinGLTF1
    disposeModel(this.pinGLTF1);
    this.pinGLTF1 = null;

    // Dispose of pinGLTF2 if it exists
    if (this.config.twoSide && this.pinGLTF2) {
      disposeModel(this.pinGLTF2);
      this.pinGLTF2 = null;
    }

    // Remove this instance from allModels
    JstXhFemalePin.allModels = JstXhFemalePin.allModels.filter(
      (entry) => entry.id !== this.id
    );

    // Clear internal references
    this.config = null;
    this.pinPositions1 = [];
    this.pinPositions2 = [];
    this.originalPinPositions.clear();
    this.group = null;

    console.log(`JstXhFemalePin ${this.id} disposed`);
  }
}
