import * as THREE from "three";
import getChildrenMesh from "./getChildrenMesh";
import { allAssets } from "../../commonFiles/assetsLoader";
import ThreeMeshUI from "three-mesh-ui";

/**
 * Sidepanel
 *
 * UI helper that reuses the "screen" mesh inside `roboticsLab` as a canvas
 * for:
 * - showing the current 3D component thumbnail (as a textured plane)
 * - rendering step-by-step instruction text via ThreeMeshUI
 *
 * Returns an object exposing:
 * - `elements`: the active panel meshes
 * - `addElement`, `updateElement`, `updateTextOnly`: mutators for panel content
 */
export default function Sidepanel(initialMesh, initialTexture, initialText) {
  const screen = getChildrenMesh(allAssets.models.gltf.roboticsLab, "screen");
  const elements = [];
  const elementSize = 0.5;
  let textBlock = null;
  console.log(allAssets)
  function createText(textContent) {
    // Clean up previous text if it exists
    if (textBlock) {
      screen.remove(textBlock);
      textBlock = null;
    }

    // Create a new ThreeMeshUI Block for text
    textBlock = new ThreeMeshUI.Block({
      width: 3.0,
      height: 0.4,
      justifyContent: "start",
      contentDirection: "column",
      backgroundOpacity: 0,
      fontFamily: allAssets.fonts.robotoFont.json,
      fontTexture: allAssets.fonts.robotoFont.image,
      borderRadius: 0.1,
      fontSize: 0.1,
      padding: 0.05,
    });

    // Create text content
    const text = new ThreeMeshUI.Text({
      content: textContent || "",
      textAlign: "left",
      fontColor: new THREE.Color(0xffffff),
    });

    textBlock.add(text);
    textBlock.position.set(0, -0.2, 0.01);
    textBlock.visible = true; // Explicitly set visibility
    screen.add(textBlock);

    // Update ThreeMeshUI to ensure rendering
    ThreeMeshUI.update();
  }

  // Function to add a single mesh to the side panel
  function addElement(mesh, texture, name, textContent) {
    const elementGeometry = new THREE.PlaneGeometry(
      elementSize,
      elementSize,
      1,
      1
    );
    const elementMaterial = new THREE.MeshBasicMaterial({
      map: texture, // Replace 'sidePanelBackground' with your actual 'texturename'. If texture has alpha, add: transparent: true,
      side: THREE.DoubleSide,
    });
    const element = new THREE.Mesh(elementGeometry, elementMaterial);
    element.name = name;
    screen.add(element);

    // Clone the mesh and ensure it has a unique material
    const clonedMesh = mesh.clone();
    if (clonedMesh.name === "buzzerSensor") {
      clonedMesh.scale.set(0.0025, 0.0025, 0.0025);
    } else {
      clonedMesh.scale.set(0.05, 0.05, 0.05);
    }

    clonedMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = false;
        child.material.opacity = 1.0;
      }
    });
    element.add(clonedMesh);
    clonedMesh.visible = false; // Initially hide the 3D model mesh

    // Position element
    element.position.set(0, 0.4, 0.1);
    element.visible = true;
    elements.push(element);

    // Create and add text
    createText(textContent);
  }

  // Function to update the side panel with a new mesh and text
  function updateElement(newMesh, texture, name, newText) {
    // Remove previous element if it exists
    removePreviousElement();

    // Add new element with updated text
    addElement(newMesh, texture, name, newText);
  }

  function updateTextOnly(newText) {
    // Remove previous element if it exists
    removePreviousElement();

    // Update existing text if possible, otherwise create new
    if (textBlock) {
      textBlock.children.forEach((child) => {
        if (child instanceof ThreeMeshUI.Text) {
          child.set({ content: newText || "" });
        }
      });
      textBlock.visible = true;
      ThreeMeshUI.update();
    } else {
      createText(newText);
    }
  }

  // Helper function to remove previous element
  function removePreviousElement() {
    if (elements.length > 0) {
      const prevElement = elements.pop();
      if (prevElement.parent) {
        prevElement.parent.remove(prevElement);
      }
    }
  }

  // Initialize with the first mesh and text
  if (initialMesh) {
    addElement(initialMesh, initialTexture, initialMesh.name, initialText);
  }

  return {
    elements,
    addElement,
    updateElement,
    updateTextOnly,
  };
}
