// Objectives for Scene 2
/**
 * Scene‑specific objective text for Scene 2.
 *
 * These IDs are used both by the Scene 2 logic and by the shared `ObjectiveUI`
 * module to render HUD text. Keep them in sync with any in‑game sequences.
 */
export const objectives = {
  1: {
    main: "Get into the bluezone",
    sub: "Reach the trigger area to meet Electro."
  },
  2: {
    main: "Get the Hoverboard",
    sub: "Electro will guide you to the hoverboard."
  },
  3: {
    main: "Press E to get into the hoverboard",
    sub: "Use the E key to mount the hoverboard."
  },
  4: {
    main: "Reach the university entrance",
    sub: "Use the hoverboard"
  }
};

// Import UI functions from common file
export { showObjective, hideObjective, cleanupObjectives } from "../commonFiles/ObjectiveUI.js";

// Create wrapper functions that pass the scene-specific objectives
/**
 * Convenience wrapper to show a Scene‑2 objective by ID.
 *
 * @param {number} objectiveNumber - One of the keys from `objectives`.
 */
export function showSceneObjective(objectiveNumber) {
  // Import the function dynamically to avoid circular dependency issues
  import("../commonFiles/ObjectiveUI.js").then(({ showObjective: showObjectiveUI }) => {
    showObjectiveUI(objectiveNumber, objectives);
  });
}

/**
 * Hides whichever objective is currently visible in the shared UI.
 */
export function hideSceneObjective() {
  import("../commonFiles/ObjectiveUI.js").then(({ hideObjective: hideObjectiveUI }) => {
    hideObjectiveUI();
  });
}

/**
 * Cleans up the shared objective UI when leaving Scene 2.
 */
export function cleanupSceneObjectives() {
  import("../commonFiles/ObjectiveUI.js").then(({ cleanupObjectives: cleanupObjectivesUI }) => {
    cleanupObjectivesUI();
  });
}
