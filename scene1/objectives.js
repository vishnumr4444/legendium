// Objectives for Scene 1
export const objectives = {
  1: {
    main: "Reach near the UFO",
    sub: "Get into the trigger zone to see the electro."
  },
  2: {
    main: "Find the portal",
    sub: "Hint: use the minimap."
  }
};

// Import UI functions from common file
export { showObjective, hideObjective, cleanupObjectives } from "../commonFiles/ObjectiveUI.js";

// Create wrapper functions that pass the scene-specific objectives
export function showSceneObjective(objectiveNumber) {
  // Import the function dynamically to avoid circular dependency issues
  import("../commonFiles/ObjectiveUI.js").then(({ showObjective: showObjectiveUI }) => {
    showObjectiveUI(objectiveNumber, objectives);
  });
}

export function hideSceneObjective() {
  import("../commonFiles/ObjectiveUI.js").then(({ hideObjective: hideObjectiveUI }) => {
    hideObjectiveUI();
  });
}

export function cleanupSceneObjectives() {
  import("../commonFiles/ObjectiveUI.js").then(({ cleanupObjectives: cleanupObjectivesUI }) => {
    cleanupObjectivesUI();
  });
}
