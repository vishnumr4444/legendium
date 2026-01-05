/**
 * About: `scene6/wire.js`
 *
 * Wire geometry helper for Scene 6 connectors.
 * Defines `Wire`, which builds and updates a TubeGeometry spline between two points.
 */

"use strict"; // Enable strict mode for safer JavaScript

import {
  Mesh,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
  CatmullRomCurve3,
} from "three";

/**
 * Represents a curved wire between two 3D points.
 * Creates a TubeGeometry along a Catmull-Rom spline and can be updated or disposed.
 */
export class Wire {
  /**
   * @param {{startPosition:THREE.Vector3,endPosition:THREE.Vector3,color:number}} wireConfig - Wire configuration.
   * @param {THREE.Scene|null} [scene=null] - Optional scene to which the wire mesh is added.
   */
  constructor(wireConfig, scene = null) {
    this.wireConfig = wireConfig;
    this.scene = scene;
    this.wire = null;
    this.curve = null; // Ensure curve is initialized
    this.createGeometry();
  }

  /**
   * Create a smooth curve between two points with a slight arch in the middle.
   *
   * @param {THREE.Vector3} start - Start position.
   * @param {THREE.Vector3} end - End position.
   */
  createCurve(start, end) {
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 0.1;
    this.curve = new CatmullRomCurve3([start, mid, end]);
  }

  /**
   * Build the TubeGeometry and Mesh for the current curve and add it to the scene (if provided).
   */
  createGeometry() {
    const { startPosition, endPosition, color } = this.wireConfig;
    this.createCurve(startPosition, endPosition);

    const geometry = new TubeGeometry(this.curve, 20, 0.002, 8, false);
    const material = new MeshStandardMaterial({ color });
    this.wire = new Mesh(geometry, material);
    // Only add to scene if scene is provided
    if (this.scene) {
      this.scene.add(this.wire);
    }
  }

  /**
   * Update the wire geometry when the end position moves.
   *
   * @param {THREE.Vector3} newEnd - New end position for the wire.
   */
  updateWire(newEnd) {
    this.wireConfig.endPosition.copy(newEnd);
    this.createCurve(this.wireConfig.startPosition, this.wireConfig.endPosition);

    const newGeometry = new TubeGeometry(this.curve, 20, 0.002, 8, false);
    if (!this.wire) {
      this.wire = new Mesh(
        newGeometry,
        new MeshStandardMaterial({ color: this.wireConfig.color })
      );
      if (this.scene) {
        this.scene.add(this.wire);
      }
      return;
    }
    if (this.wire.geometry) {
      this.wire.geometry.dispose();
    }
    this.wire.geometry = newGeometry;
  }

  /**
   * Remove the wire from the scene and free GPU resources.
   */
  dispose() {
    if (this.wire) {
      if (this.scene) {
        this.scene.remove(this.wire);
      }
      this.wire.geometry.dispose();
      this.wire.material.dispose();
      this.wire = null;
    }
  }
}