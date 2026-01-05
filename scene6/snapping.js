/**
 * About: `scene6/snapping.js`
 *
 * Snap-to-connect helper for Scene 6 interactions.
 * Provides `getSnapHandler()` which returns `snapIfClose()` used by raycaster logic for snapping
 * JST pins, nano, and battery connectors to predefined snap points.
 */

"use strict"; // Enable strict mode for safer JavaScript

// Snap-to-connect helper for JST pins, nano, and battery connectors in Scene 6.
// Provides a single snapIfClose(draggedObject) function used by raycasterSetup.
import * as THREE from "three";
import { gsap } from "gsap";
import { scene6State } from "./scene6State.js";

/**
 * Returns a snap handler function that checks if the dragged object is close to its snap point and snaps it if so.
 *
 * @returns {(draggedPinModel:THREE.Object3D) => boolean} Snap function that returns true when a snap occurs.
 */
export function getSnapHandler() {
  // Snap point for the female pin
  const FIRST_FEMALE_PIN_SNAP_POINT = new THREE.Vector3(-0.03, 1.77, -3.26);
  // Snap point for the nano model
  const NANO_SNAP_POINT = new THREE.Vector3(-0.005, 1.757, -3.45); // Adjust as needed
  const NANO_SNAP_POINT_LESSON2 = new THREE.Vector3(-0.005, 1.757, -3.37); // Example, update as needed
  const SECOND_FEMALE_PIN_SNAP_POINT = new THREE.Vector3(-0.63, 1.77, -3.25); // Example coordinates, update as needed
  // Add snap points for both sides of jstPin2
  const JSTPIN2_SIDE1_SNAP_POINT = new THREE.Vector3(-0.01, 1.82, -3.25); // Side 1
  const JSTPIN2_SIDE2_SNAP_POINT = new THREE.Vector3(0.45, 1.85, -3); // Side 2
  // Battery JST female pin snap point (align near battery terminals)
  const JSTPIN_BATTERY_SNAP_POINT = new THREE.Vector3(0.239, 1.78, -3.36);
  const JSTPIN_BATTERY_SNAP_POINT_LESSON2 = new THREE.Vector3(-0.22, 1.777, -3.46);
  const SNAP_THRESHOLD = 0.1; // Distance threshold for snapping

  /**
   * Checks if the dragged object is close to its snap point and snaps it if so.
   * @param {THREE.Object3D} draggedPinModel - The object being dragged
   * @returns {boolean} - True if snapped, false otherwise
   */
  function snapIfClose(draggedPinModel) {
    if (!draggedPinModel) {
      console.log("[Snapping] No draggedPinModel provided");
      return false;
    }
    // Helper to get model/state from scene6State or window (fallback)
    const getModel = (name) => scene6State[name];
    const getCurrentLesson = () => {
      if (typeof scene6State.getCurrentLesson === 'function') return scene6State.getCurrentLesson();
      return null;
    };
    
    const currentLesson = getCurrentLesson();
    
    // For lesson2, allow jstPin2 snapping even if disableNanoSnap is true
    // disableNanoSnap should only prevent nano snapping, not jstPin2 snapping
    let isJstPin2 = false;
    if (currentLesson === 'lesson2') {
      const jstPin2Check = getModel('jstPin2');
      const jstPin2Side1Check = getModel('jstPin2Side1');
      const jstPin2Side2Check = getModel('jstPin2Side2');
      isJstPin2 = jstPin2Check && (
        draggedPinModel === jstPin2Side1Check || 
        draggedPinModel === jstPin2Side2Check ||
        draggedPinModel === jstPin2Check.pinGLTF1 ||
        draggedPinModel === jstPin2Check.pinGLTF2 ||
        (jstPin2Check.pinGLTF1 && draggedPinModel.uuid === jstPin2Check.pinGLTF1.uuid) ||
        (jstPin2Check.pinGLTF2 && draggedPinModel.uuid === jstPin2Check.pinGLTF2.uuid)
      );
    }
    
    // Only block snapping if disableNanoSnap is true AND it's not a jstPin2 in lesson2
    if (scene6State.disableNanoSnap && !isJstPin2) {
      if (currentLesson === 'lesson2') {
        console.log("[Snapping] Snapping disabled - disableNanoSnap is true (but allowing jstPin2)");
      }
      return false;
    }
    
    if (isJstPin2 && scene6State.disableNanoSnap) {
      console.log("[Snapping] Allowing jstPin2 snapping even though disableNanoSnap is true");
    }
    
    // Always log when called in lesson2
    if (currentLesson === 'lesson2') {
      console.log("[Snapping] snapIfClose called for lesson2, draggedPinModel:", {
        name: draggedPinModel.name,
        uuid: draggedPinModel.uuid?.substring(0, 8),
        type: draggedPinModel.type,
        disableNanoSnap: scene6State.disableNanoSnap
      });
      console.log("[Snapping Debug] Checking snap for lesson2, draggedPinModel:", {
        name: draggedPinModel.name,
        uuid: draggedPinModel.uuid,
        type: draggedPinModel.type
      });
    }
    let snapPoint = FIRST_FEMALE_PIN_SNAP_POINT;
    let shouldRotateRGBLED = false;
    
    // Use lesson2 snap point for nano if lesson2 is active
    const nanoModel = getModel('nanoModel');
    if (nanoModel && draggedPinModel === nanoModel) {
      if (currentLesson === 'lesson2') {
        snapPoint = NANO_SNAP_POINT_LESSON2;
      } else {
        snapPoint = NANO_SNAP_POINT;
      }
    }
    
    // Snap logic for both sides of jstPin2 - CHECK THIS FIRST before secondPin4Female
    // because secondPin4Female might be set to jstPin2.pinGLTF2, and we want lesson2 pins to use their own snap points
    const jstPin2 = getModel('jstPin2');
    const jstPin2Side1 = getModel('jstPin2Side1');
    const jstPin2Side2 = getModel('jstPin2Side2');
    
    // Check if draggedPinModel is jstPin2Side1 or jstPin2Side2
    // This needs to work even when jstPin2 is found through componentData
    if (jstPin2 && currentLesson === 'lesson2') {
      console.log("[Snapping Debug] Checking jstPin2 detection:", {
        jstPin2Exists: !!jstPin2,
        pinGLTF1Exists: !!(jstPin2 && jstPin2.pinGLTF1),
        pinGLTF2Exists: !!(jstPin2 && jstPin2.pinGLTF2),
        draggedUUID: draggedPinModel.uuid,
        jstPin2Side1: jstPin2Side1 ? jstPin2Side1.uuid : 'N/A',
        jstPin2Side2: jstPin2Side2 ? jstPin2Side2.uuid : 'N/A',
        pinGLTF1UUID: jstPin2 && jstPin2.pinGLTF1 ? jstPin2.pinGLTF1.uuid : 'N/A',
        pinGLTF2UUID: jstPin2 && jstPin2.pinGLTF2 ? jstPin2.pinGLTF2.uuid : 'N/A'
      });
      
      let isSide1 = false;
      let isSide2 = false;
      
      // Check by direct reference comparison
      if (jstPin2.pinGLTF1) {
        if (draggedPinModel === jstPin2Side1 || 
            draggedPinModel === jstPin2.pinGLTF1 ||
            (draggedPinModel.uuid && jstPin2.pinGLTF1.uuid && jstPin2.pinGLTF1.uuid === draggedPinModel.uuid)) {
          isSide1 = true;
          console.log("[Snapping] Matched jstPin2Side1 by direct reference");
        }
      }
      
      if (jstPin2.pinGLTF2) {
        if (draggedPinModel === jstPin2Side2 || 
            draggedPinModel === jstPin2.pinGLTF2 ||
            (draggedPinModel.uuid && jstPin2.pinGLTF2.uuid && jstPin2.pinGLTF2.uuid === draggedPinModel.uuid)) {
          isSide2 = true;
          console.log("[Snapping] Matched jstPin2Side2 by direct reference");
        }
      }
      
      // If not found by direct reference, check by traversing the group
      if (!isSide1 && !isSide2 && jstPin2.group) {
        jstPin2.group.traverse((child) => {
          if (child === draggedPinModel || (child.uuid && draggedPinModel.uuid && child.uuid === draggedPinModel.uuid)) {
            if (child === jstPin2.pinGLTF1 || (jstPin2.pinGLTF1 && child.uuid === jstPin2.pinGLTF1.uuid)) {
              isSide1 = true;
              console.log("[Snapping] Matched jstPin2Side1 by group traversal");
            } else if (child === jstPin2.pinGLTF2 || (jstPin2.pinGLTF2 && child.uuid === jstPin2.pinGLTF2.uuid)) {
              isSide2 = true;
              console.log("[Snapping] Matched jstPin2Side2 by group traversal");
            }
          }
        });
      }
      
      // Also check if draggedPinModel is a child of pinGLTF1 or pinGLTF2
      if (!isSide1 && !isSide2 && jstPin2.pinGLTF1) {
        let foundInPin1 = false;
        jstPin2.pinGLTF1.traverse((child) => {
          if (child === draggedPinModel || (child.uuid && draggedPinModel.uuid && child.uuid === draggedPinModel.uuid)) {
            foundInPin1 = true;
          }
        });
        if (foundInPin1) {
          isSide1 = true;
          console.log("[Snapping] Matched jstPin2Side1 by traversing pinGLTF1");
        }
      }
      
      if (!isSide1 && !isSide2 && jstPin2.pinGLTF2) {
        let foundInPin2 = false;
        jstPin2.pinGLTF2.traverse((child) => {
          if (child === draggedPinModel || (child.uuid && draggedPinModel.uuid && child.uuid === draggedPinModel.uuid)) {
            foundInPin2 = true;
          }
        });
        if (foundInPin2) {
          isSide2 = true;
          console.log("[Snapping] Matched jstPin2Side2 by traversing pinGLTF2");
        }
      }
      
      // Apply snap point if detected
      if (isSide1) {
        snapPoint = JSTPIN2_SIDE1_SNAP_POINT;
        console.log("[Snapping] ✓ Detected jstPin2Side1, using snap point:", JSTPIN2_SIDE1_SNAP_POINT);
      } else if (isSide2) {
        snapPoint = JSTPIN2_SIDE2_SNAP_POINT;
        console.log("[Snapping] ✓ Detected jstPin2Side2, using snap point:", JSTPIN2_SIDE2_SNAP_POINT);
      } else {
        console.log("[Snapping Debug] ✗ jstPin2 pin NOT matched to any side");
      }
    }
    
    // Snap the second pin4Female to its own snap point (only if not already matched as jstPin2 and not lesson2)
    // This is for lesson1, not lesson2
    if (snapPoint === FIRST_FEMALE_PIN_SNAP_POINT && currentLesson !== 'lesson2') {
      const secondPin4Female = getModel('secondPin4Female');
      if (secondPin4Female && draggedPinModel === secondPin4Female) {
        snapPoint = SECOND_FEMALE_PIN_SNAP_POINT;
        shouldRotateRGBLED = true; // Rotate RGB LED when JST pin snaps
      }
    }
    // Snap logic for battery JST female pin
    const jstPinBatterySide1 = getModel('jstPinBatterySide1');
    if (jstPinBatterySide1 && draggedPinModel === jstPinBatterySide1) {
      if (currentLesson === 'lesson2') {
        snapPoint = JSTPIN_BATTERY_SNAP_POINT_LESSON2;
      } else {
        snapPoint = JSTPIN_BATTERY_SNAP_POINT;
      }
    }
    // Remove rgbLEDModel drag and snap logic
    // Use world position for distance calculation if the model has a parent
    let pinPos = draggedPinModel.position.clone();
    if (draggedPinModel.parent) {
      draggedPinModel.getWorldPosition(pinPos);
    }
    const distance = pinPos.distanceTo(snapPoint);
    
    // Enhanced logging for lesson2
    if (currentLesson === 'lesson2') {
      console.log("[Snapping] Distance to snap point:", distance.toFixed(3), "threshold:", SNAP_THRESHOLD, "for model:", draggedPinModel.name || draggedPinModel.uuid.substring(0, 8), "snap point:", snapPoint, "pinPos:", pinPos);
      if (distance < SNAP_THRESHOLD) {
        console.log("[Snapping] ✓ WITHIN THRESHOLD - Will snap!");
      } else {
        console.log("[Snapping] ✗ OUTSIDE THRESHOLD - Distance too large");
      }
    } else {
      console.log("[Snapping] Distance to snap point:", distance.toFixed(3), "for model:", draggedPinModel.name || draggedPinModel.uuid, "snap point:", snapPoint);
    }
    
    if (distance < SNAP_THRESHOLD) {
      // If the model has a parent, convert snap point to local coordinates
      if (draggedPinModel.parent) {
        const localSnapPoint = draggedPinModel.parent.worldToLocal(snapPoint.clone());
        draggedPinModel.position.copy(localSnapPoint);
        console.log("[Snapping] Applied snap (with parent transform). Local position:", draggedPinModel.position, "World snap point:", snapPoint);
      } else {
        draggedPinModel.position.copy(snapPoint);
        console.log("[Snapping] Applied snap (no parent). Position:", draggedPinModel.position);
      }
      console.log("[Snapping] ✓ SNAPPED! Model position set to:", draggedPinModel.position);
      
      // Rotate RGB LED when JST pin snaps
      const rgbLEDModel = getModel('rgbLEDModel');
      if (shouldRotateRGBLED && rgbLEDModel) {
        console.log("Rotating RGB LED after JST pin snap");
        // Animate the rotation for a smoother effect
        const startRotation = rgbLEDModel.rotation.clone();
        const endRotation = new THREE.Euler(0, -Math.PI, -Math.PI);
        gsap.to(rgbLEDModel.rotation, {
          x: endRotation.x,
          y: endRotation.y,
          z: endRotation.z,
          duration: 0.8,
          ease: "power2.out"
        });
        
        // Update the second JST pin to align with the rotated RGB LED
        const jstPin = getModel('jstPin');
        if (jstPin && jstPin.pinGLTF2) {
          console.log("Updating second JST pin position and rotation");
          scene6State.secondPin4Female = jstPin.pinGLTF2;
          jstPin.pinGLTF2.rotation.y = -Math.PI / 2;
          jstPin.pinGLTF2.rotation.z = -Math.PI / 2;
          jstPin.pinGLTF2.rotation.x = Math.PI / 2;
          if (typeof jstPin.updatePosition === 'function') {
            jstPin.updatePosition(SECOND_FEMALE_PIN_SNAP_POINT, jstPin.pinGLTF2);
          }
        }
      }
      
      return true;
    }
    return false;
  }

  return snapIfClose;
}
