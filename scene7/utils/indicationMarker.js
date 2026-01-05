import * as THREE from "three";
import { allAssets } from "../../commonFiles/assetsLoader";
import ThreeMeshUI from "three-mesh-ui";
import getWorldPosition from "../utils/getWorldPosition"

/**
 * Creates floating "Drag" and "Drop" labels above two target objects
 * and keeps them facing the camera in a flat, HUD-like orientation.
 *
 * Returns helpers to toggle which label is shown and to fully clean up.
 */
export function showIndication(scene, camera, target, target2) {
  const font = allAssets.fonts.robotoFont;

  // Shared style for both labels
  function createLabel(text) {
    const label = new ThreeMeshUI.Block({
      width: 0.18,
      height: 0.06,
      padding: 0.005,
      margin: 0.002,
      backgroundOpacity: 0.85,
      backgroundColor: new THREE.Color(0xf0a800),
      borderRadius: 0.01,
      alignItems: "center",
      justifyContent: "center",
      fontFamily: font.json,
      fontTexture: font.image,
    });

    const labelText = new ThreeMeshUI.Text({
      content: text,
      fontSize: 0.018,
      color: new THREE.Color(0xffffff),
    });

    label.add(labelText);
    return label;
  }

  const dragLabel = createLabel("Drag");
  const dropLabel = createLabel("Drop");

  const targetWorldPosition = getWorldPosition(target);
  const targetWorldPosition2 = getWorldPosition(target2);

  dropLabel.position
    .copy(targetWorldPosition)
    .add(new THREE.Vector3(0, 0.1, 0));
  dragLabel.position
    .copy(targetWorldPosition2)
    .add(new THREE.Vector3(0, 0.1, 0));

  scene.add(dragLabel, dropLabel);

  dragLabel.visible = true;
  dropLabel.visible = false;

  let animationId = null;

  function render() {
    if (!dragLabel.parent && !dropLabel.parent) return;
    const cameraPos = camera.position.clone();

    [dragLabel, dropLabel].forEach((label) => {
      if (!label.visible) return;
      const labelPos = label.position.clone();
      const dir = new THREE.Vector3().subVectors(cameraPos, labelPos);
      dir.y = 0;
      dir.normalize();

      const flatTarget = labelPos.clone().add(dir);
      label.lookAt(flatTarget);
    });

    ThreeMeshUI.update();
    animationId = requestAnimationFrame(render);
  }

  render();

  function toggleVisibility() {
    dragLabel.visible = !dragLabel.visible;
    dropLabel.visible = !dropLabel.visible;
  }

  function cleanup() {
    cancelAnimationFrame(animationId);

    scene.remove(dragLabel, dropLabel);

    disposeLabel(dragLabel);
    disposeLabel(dropLabel);
    ThreeMeshUI.update();
  }

  function disposeLabel(label) {
    label.clear();

    label.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  return { toggleVisibility, cleanup };
}
