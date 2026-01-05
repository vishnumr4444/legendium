// Objectives for Scene 1
export const objectives = {
  1: {
    main: "Proceed to the introduction area",
    sub: "Follow the minimap and proceed to the introduction area.",
  },
  2: {
    main: "Proceed to solve the circuit to open the gate",
    sub: "Proceed solve the circuit puzzle.",
  },
  3: {
    main: "Proceed to the next area",
    sub: "",
  },
  4: {
    main: "Relearn the basics in the introduction area",
    sub: "Proceed to the introduction area."
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