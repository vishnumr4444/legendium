/**
 * About: `scene6/JstXhFemalePin.js`
 *
 * Legacy JST-XH female pin connector implementation for Scene 6.
 * Provides a simple connector + wire model and a registry used by older lessons/raycasting.
 */

"use strict"; // Enable strict mode for safer JavaScript

import * as THREE from "three";
import { TubeGeometry, Vector3 } from "three";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { Wire } from "./wire.js";

/**
 * Represents a JST-XH female pin connector with optional wires.
 * This version is used for legacy pins (lesson1/2/3) and exposes a simple API
 * for raycasting and snapping via the JstXhFemalePin registry.
 */
export class JstXhFemalePin {
  static count = 0;
  static allModels = [];
  /**
   * Get a list of all JST pin instances and their associated meshes.
   *
   * @returns {Array<{instance:JstXhFemalePin, models:THREE.Object3D[]}>}
   */
  static getAllModels() {
    return this.allModels;
  }
  /**
   * Create a new JST-XH female pin connector.
   *
   * @param {Object} config - Configuration for the pin.
   * @param {number} [config.pinCount=2] - Number of pins (2, 3, or 4).
   * @param {THREE.Vector3} [config.position] - Default position for single-sided pins.
   * @param {Array} [config.wireConfigs] - Array of wire configs { startPosition, endPosition, color }.
   * @param {boolean} [config.twoSide=false] - Whether this connector has two opposing sides.
   * @param {Array} [config.jstPinConfig] - Positions for each side when twoSide is true.
   * @param {Array<string|number>} [config.colors] - Wire colors when twoSide is true.
   * @param {THREE.Scene} scene - Scene to which the pin group and wires are added.
   */
  constructor(config, scene) {
    JstXhFemalePin.count++;
    this.config = {
      pinCount: config.pinCount || 2, // 2, 3, or 4 pins
      position: config.position || null, // Default position
      wireConfigs: config.wireConfigs || [], // Array of { startPosition, endPosition, color }
      twoSide: config.twoSide || false,
      jstPinConfig: config.jstPinConfig || [],
      colors: config.colors || [],
    };
    this.scene = scene;
    this.pinGLTF1 = null;
    this.pinGLTF2 = null;
    this.wires = [];
    this.group = new THREE.Group(); // Group to hold pin and wires
    this.isDraggable = true; // Flag for raycaster dragging
    this.pinPositions1 = []; // Store pin positions for fallback
    this.pinPositions2 = []; // Store pin positions for fallback
    this.wasAutoMoved = false; // Track if this pin was auto-moved after the other pin snapped
    this.configurePinModel();
    this.createWires();
  }

  configurePinModel() {
    let { pinCount, position, twoSide, jstPinConfig } = this.config;
    let model = null;
    
    // Try to get the model from assets, with fallback to simple geometry
    try {
      if (pinCount === 2) {
        model = allAssets.models.gltf.pin2Female;
      } else if (pinCount === 3) {
        model = allAssets.models.gltf.pin3Female;
      } else if (pinCount === 4) {
        model = allAssets.models.gltf.pin4Female;
      }
    } catch (error) {
      console.warn(`Pin model for ${pinCount} pins not found, creating fallback geometry`);
    }

    // Create fallback geometry if model is not available
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
    this.scene.add(this.group);
    this.extractPinPositions();
  }

  createFallbackPinModel(pinCount) {
    // Create a simple group to represent the pin connector
    const group = new THREE.Group();
    
    // Create connector body
    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.3);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);
    
    // Create individual pins
    const pinSpacing = 0.2;
    const startX = -(pinCount - 1) * pinSpacing / 2;
    
    for (let i = 0; i < pinCount; i++) {
      const pinGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8);
      const pinMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
      const pin = new THREE.Mesh(pinGeometry, pinMaterial);
      
      pin.position.x = startX + i * pinSpacing;
      pin.position.y = 0.15;
      pin.name = `pin${i + 1}`; // Important for raycasting
      
      group.add(pin);
    }
    
    return group;
  }

  extractPinPositions() {
    let { twoSide } = this.config;

    this.pinPositions1 = [];
    this.pinGLTF1.traverse((child) => {
      if (child.name.includes("pin") && child.isMesh) {
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);
        this.pinPositions1.push(worldPos);
      }
    });
    if (twoSide) {
      this.pinPositions2 = [];
      this.pinGLTF2.traverse((child) => {
        if (child.name.includes("pin") && child.isMesh) {
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          this.pinPositions2.push(worldPos);
        }
      });
    }

    twoSide
      ? JstXhFemalePin.allModels.push({
          instance: this,
          models: [this.pinGLTF1, this.pinGLTF2],
        })
      : JstXhFemalePin.allModels.push({
          instance: this,
          models: [this.pinGLTF1],
        });
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
    // Determine which pin is being moved
    const isPin1 = pinModel === this.pinGLTF1;
    const isPin2 = this.config.twoSide && pinModel === this.pinGLTF2;

    // Update the position of the selected pin
    if (isPin1) {
      this.pinGLTF1.position.copy(newPosition);
    } else if (isPin2) {
      this.pinGLTF2.position.copy(newPosition);
    }

    // Recompute pin positions
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

    // Update wires based on which pin was moved
    let pinCount = this.config.pinCount - 1;
    this.wires.forEach((wire, i) => {
      if (this.config.twoSide) {
        // For two-sided pins, update either start or end position based on which pin is dragged
        if (isPin1) {
          // Moving pinGLTF1, update endPosition
          wire.updateWire(this.pinPositions1[i]);
          wire.wireConfig.startPosition.copy(this.pinPositions2[pinCount]);
        } else if (isPin2) {
          // Moving pinGLTF2, update startPosition
          wire.wireConfig.startPosition.copy(this.pinPositions2[pinCount]);
          wire.updateWire(this.pinPositions1[i]);
        }
      } else {
        // For single-sided pins, update endPosition only
        wire.updateWire(this.pinPositions1[i]);
        wire.wireConfig.startPosition.copy(
          this.config.wireConfigs[i].startPosition
        );
      }
      pinCount--;
    });
  }

  dispose() {}
}
