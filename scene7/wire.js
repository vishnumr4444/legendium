import {
  Mesh,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
  CatmullRomCurve3,
} from "three";

/**
 * Helper class for visualizing a flexible "wire" between two points.
 *
 * - Builds a simple Catmull-Rom spline (start → raised mid → end)
 * - Renders it as a thin `TubeGeometry`
 * - Can be attached to an optional Three.js scene for automatic add/remove
 */
export class Wire {
  constructor(wireConfig, scene = null) {
    this.wireConfig = wireConfig;
    this.scene = scene;
    this.wire = null;
    this.curve = null; // Ensure curve is initialized
    this.createGeometry();
  }

  // Build a 3‑point curve with a slightly elevated midpoint to create a natural sag.
  createCurve(start, end) {
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 0.1;
    this.curve = new CatmullRomCurve3([start, mid, end]);
  }

  // Create tube geometry + material and add to the scene (if provided).
  createGeometry() {
    const { startPosition, endPosition, color } = this.wireConfig;
    this.createCurve(startPosition, endPosition);

    // const geometry = new TubeGeometry(this.curve, 20, 0.0035, 8, false);
    const geometry = new TubeGeometry(this.curve, 20, 0.0015, 8, false);
    const material = new MeshStandardMaterial({ color });
    this.wire = new Mesh(geometry, material);
    // Only add to scene if scene is provided
    if (this.scene) {
      this.scene.add(this.wire);
    }
  }

  /**
   * Update the end position and rebuild the tube geometry in place.
   * Useful when a pin or component is dragged in the scene.
   */
  updateWire(newEnd) {
    this.wireConfig.endPosition.copy(newEnd);
    this.createCurve(
      this.wireConfig.startPosition,
      this.wireConfig.endPosition
    );

    // const newGeometry = new TubeGeometry(this.curve, 20, 0.0035, 8, false);
    const newGeometry = new TubeGeometry(this.curve, 20, 0.0015, 8, false);

    this.wire.geometry.dispose();
    this.wire.geometry = newGeometry;
  }

  // Remove the wire from the scene and dispose of its resources.
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




  async function showCompletionSequence() {
    try {
      console.log("Starting completion sequence...");

      // Stop the Three.js animation loop immediately
      if (renderer && renderer.setAnimationLoop) {
        renderer.setAnimationLoop(null);
      }

      // Cancel any animation frames
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      // Hide the canvas immediately to prevent any rendering
      const canvas = document.querySelector("canvas");
      if (canvas) {
        canvas.style.display = "none";
      }

      // Show the first subtitle with sci-fi styling
      await subtitleSystem.showSubtitle(
        "You have successfully built the first version of Byte",
        5000
      );

      // Small pause between subtitles
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Show the second subtitle
      await subtitleSystem.showSubtitle(
        "Now it's time to enter to the next level",
        5000
      );

      // Small pause before video
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Play the end video (this will handle cleanup and redirect automatically)
      await videoPlayer.playVideo("./public/audios/endvideo.mp4");
    } catch (error) {
      console.error("Error in completion sequence:", error);
      // Fallback redirect if something goes wrong
      setTimeout(() => {
        window.location.href = "./index.html";
      }, 2000);
    }
  }