/**
 * About: `scene6/JstXhFemalePin2.js`
 *
 * Newer/enhanced JST-XH female pin connector implementation for Scene 6.
 * Adds per-pin draggability + instance registry used by `RaycasterSetup2` and later lessons.
 */

"use strict"; // Enable strict mode for safer JavaScript

import * as THREE from "three";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { Wire } from "./wire.js";

/**
 * Enhanced JST-XH female pin connector used in later lessons.
 * Supports:
 * - Selectively draggable pin models
 * - Central registry of all instances for raycaster setup
 * - Automatic wire creation and updates when pins are moved
 */
export class JstXhFemalePin {
  static count = 0;
  static allModels = [];
  /**
   * Get a list of all JST pin instances and their associated meshes.
   *
   * @returns {Array<{instance:JstXhFemalePin, models:Array<{model:THREE.Object3D, draggable:boolean, pinType:string}>, id:number}>}
   */
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
    };
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
  configurePinModel() {
    let { pinCount, position, twoSide, jstPinConfig, draggablePins } =
      this.config;
    let model = null;

    try {
      if (pinCount === 2) {
        model = allAssets.models.gltf.pin2Female2;
      } else if (pinCount === 3) {
        model = allAssets.models.gltf.pin3Female2;
      } else if (pinCount === 4) {
        model = allAssets.models.gltf.pin4Female2;
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

  dispose() {}
}
