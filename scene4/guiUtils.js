import GUI from "lil-gui";

/**
 * Initializes an interactive lil-gui control panel for manipulating
 * a 3D object's transform (position, rotation, scale) and some material properties.
 *
 * The GUI allows control over:
 * - Position (X, Y, Z) with independent min/max limits per axis
 * - Rotation (X, Y, Z) with a shared min/max range
 * - Scale (X, Y, Z) with independent min/max limits per axis
 * - Material color and wireframe (if available on the object)
 * - Visibility toggle
 *
 * Custom limits can be provided to override the default ranges.
 * If `min` is greater than `max` in any axis, the values are automatically swapped and a warning is logged.
 *
 * @param {THREE.Object3D} object
 * The Three.js object whose properties will be controlled.
 *
 * @param {Object} [customLimits]
 * Optional object defining custom min/max ranges for position, rotation, and scale.
 *
 * @param {Object} [customLimits.position]
 * Optional position limits.
 * @param {{min:number, max:number}} [customLimits.position.x]
 * X-axis position limits.
 * @param {{min:number, max:number}} [customLimits.position.y]
 * Y-axis position limits.
 * @param {{min:number, max:number}} [customLimits.position.z]
 * Z-axis position limits.
 *
 * @param {Object} [customLimits.rotation]
 * Rotation limits (shared for X, Y, Z).
 * @param {number} [customLimits.rotation.min]
 * Minimum rotation in radians.
 * @param {number} [customLimits.rotation.max]
 * Maximum rotation in radians.
 *
 * @param {Object} [customLimits.scale]
 * Optional scale limits.
 * @param {{min:number, max:number}} [customLimits.scale.x]
 * X-axis scale limits.
 * @param {{min:number, max:number}} [customLimits.scale.y]
 * Y-axis scale limits.
 * @param {{min:number, max:number}} [customLimits.scale.z]
 * Z-axis scale limits.
 *
 * @example
 * // Create a cube and add GUI controls with custom position and scale limits
 * const cube = new THREE.Mesh(
 *   new THREE.BoxGeometry(),
 *   new THREE.MeshStandardMaterial({ color: 0xff0000 })
 * );
 * scene.add(cube);
 *
 * initObjectControls(cube, {
 *   position: {
 *     x: { min: -5, max: 5 },
 *     y: { min: 0, max: 3 },
 *     z: { min: -2, max: 2 }
 *   },
 *   scale: {
 *     x: { min: 0.5, max: 2 },
 *     y: { min: 0.5, max: 2 },
 *     z: { min: 0.5, max: 2 }
 *   }
 * });
 */

let activeGUIs = [];

const defaultLimits = {
  position: {
    x: { min: -1, max: 1 },
    y: { min: -1, max: 1 },
    z: { min: -1, max: 1 },
  },
  rotation: { min: 0, max: Math.PI / 2 },
  scale: {
    x: { min: 0.1, max: 5 },
    y: { min: 0.1, max: 5 },
    z: { min: 0.1, max: 5 },
  },
};

function mergeLimits(customLimits = {}) {
  const merged = JSON.parse(JSON.stringify(defaultLimits)); // deep clone

  for (let category in customLimits) {
    if (typeof customLimits[category] === "object") {
      for (let axis in customLimits[category]) {
        if (typeof customLimits[category][axis] === "object") {
          merged[category][axis] = {
            ...merged[category][axis],
            ...customLimits[category][axis],
          };
        } else {
          merged[category][axis] = customLimits[category][axis];
        }
      }
    }
  }

  return merged;
}

export function initObjectControls(object, customLimits) {
  const limits = mergeLimits(customLimits);
  const gui = new GUI();
  gui.title("Object Controls");

  // Add GUI to tracking array
  activeGUIs.push(gui);

  const posFolder = gui.addFolder("Position");
  posFolder.add(
    object.position,
    "x",
    limits.position.x.min,
    limits.position.x.max,
    0.01
  );
  posFolder.add(
    object.position,
    "y",
    limits.position.y.min,
    limits.position.y.max,
    0.01
  );
  posFolder.add(
    object.position,
    "z",
    limits.position.z.min,
    limits.position.z.max,
    0.01
  );

  const rotFolder = gui.addFolder("Rotation");
  rotFolder.add(
    object.rotation,
    "x",
    limits.rotation.min,
    limits.rotation.max,
    0.01
  );
  rotFolder.add(
    object.rotation,
    "y",
    limits.rotation.min,
    limits.rotation.max,
    0.01
  );
  rotFolder.add(
    object.rotation,
    "z",
    limits.rotation.min,
    limits.rotation.max,
    0.01
  );

  const scaleFolder = gui.addFolder("Scale");
  scaleFolder.add(
    object.scale,
    "x",
    limits.scale.x.min,
    limits.scale.x.max,
    0.1
  );
  scaleFolder.add(
    object.scale,
    "y",
    limits.scale.y.min,
    limits.scale.y.max,
    0.1
  );
  scaleFolder.add(
    object.scale,
    "z",
    limits.scale.z.min,
    limits.scale.z.max,
    0.1
  );

  if (object.material) {
    const matFolder = gui.addFolder("Material");
    if ("color" in object.material)
      matFolder.addColor(object.material, "color");
    if ("wireframe" in object.material)
      matFolder.add(object.material, "wireframe");
  }

  gui.add(object, "visible").name("Visible");

  return gui; // Return the GUI instance
}

export function cleanupGUIControls() {
  activeGUIs.forEach((gui) => {
    if (gui && typeof gui.destroy === "function") {
      gui.destroy();
    }
  });
  activeGUIs = [];
}
