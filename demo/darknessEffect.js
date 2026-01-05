import gsap from "gsap";
import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
/**
 * @function DarknessEffect
 * @description Creates a darkness overlay effect in a Three.js scene, smoothly fading in and out.
 * It uses GSAP for animations and adds a black plane in front of the camera.
 *
 * @param {THREE.Scene} scene - The Three.js scene where the effect will be applied.
 * @param {THREE.Camera} camera - The camera to which the darkness overlay will be attached.
 * @param {number} durationOfDarknessEffectFadeIn - The time (in seconds) for the darkness to fade in.
 * @param {number} durationOfDarknessEffectFadeOut - The time (in seconds) for the darkness to fade out.
 * @param {Function|null} callBackFunctionOnStartDarkness - A callback function triggered at the start of darkness.
 * @param {Function|null} callBackFunctionOnEndDarkness - A callback function triggered at the end of darkness.
 *
 * @returns {Object} An object containing:
 *  - `startDarkness()`: Function to start the darkness effect.
 *  - Any additional properties returned from the callback functions.
 *
 * @example
 * import { DarknessEffect } from "./DarknessEffect";
 *
 * function onStartDarkness() {
 *   console.log("Darkness is starting!");
 *   return {
 *     additionalFunction: () => console.log("Extra function triggered inside darkness"),
 *   };
 * }
 *
 * function onEndDarkness() {
 *   console.log("Darkness is ending!");
 * }
 *
 * const darknessEffect = DarknessEffect(scene, camera, 2, 2, onStartDarkness, onEndDarkness);
 *
 * // Start the darkness effect
 * darknessEffect.startDarkness();
 */

export function DarknessEffect(
  scene,
  camera,
  durationOfDarknessEffectFadeIn,
  durationOfDarknessEffectFadeOut,
  callBackFunctionOnStartDarkness,
  callBackFunctionOnEndDarkness
) {
  let returnedObject = {};

  if (callBackFunctionOnStartDarkness) {
    const result = callBackFunctionOnStartDarkness();
    if (result && typeof result === "object") {
      returnedObject = result; // Store whatever object is returned
    }
  }
  if (callBackFunctionOnEndDarkness) {
    const result = callBackFunctionOnEndDarkness();
    if (result && typeof result === "object") {
      returnedObject = result; // Store whatever object is returned
    }
  }

  let darkOverlay = null;

  function startDarkness() {
    const overlayGeometry = new PlaneGeometry(100, 100);
    const overlayMaterial = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
      side: DoubleSide,
    });

    darkOverlay = new Mesh(overlayGeometry, overlayMaterial);
    darkOverlay.renderOrder = 999;
    camera.add(darkOverlay);
    darkOverlay.position.z = -10;
    scene.add(camera);

    // Fade in the dark overlay
    gsap.to(darkOverlay.material, {
      opacity: 1,
      duration: durationOfDarknessEffectFadeIn,
      onComplete: () => {
        console.log("black Coming");
        setTimeout(() => {
          if (returnedObject && typeof returnedObject === "object") {
            Object.values(returnedObject).forEach((fn) => {
              if (typeof fn === "function") {
                fn();
              }
            });
          }
          setTimeout(() => {
            triggerEverythingBack();
          }, durationOfDarknessEffectFadeOut * 1000);
        }, 500);
      },
    });
  }

  function triggerEverythingBack() {
    gsap.to(darkOverlay.material, {
      opacity: 0,
      duration: 2,
      ease: "power2.inOut",
      onComplete: () => {
        console.log("black going");

        setTimeout(() => {
          if (callBackFunctionOnEndDarkness) {
            if (returnedObject && typeof returnedObject === "object") {
              Object.values(returnedObject).forEach((fn) => {
                if (typeof fn === "function") {
                  fn();
                }
              });
            }
          }
          if (darkOverlay) {
            camera.remove(darkOverlay); // Important: Remove before disposing
            scene.remove(darkOverlay); // Just in case it exists in the scene

            darkOverlay.geometry.dispose();
            darkOverlay.material.dispose();

            darkOverlay = null;
          }
        }, 500);
      },
    });
  }

  return { startDarkness, ...returnedObject };
}
