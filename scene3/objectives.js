/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
/**
 * Script Description
 * Objectives for Scene 3.
 * Created on 2025-12-22 by vishnumr
 */
/*******************************************************************************
 * * OneSource IML | TGI FRIDAY *
 * **************************************************************************
 *
 *
 * Author: vishnumr
 *
 * REVISION HISTORY
 *
 *
 ******************************************************************************/
// Objectives for Scene 3
export const objectives = {
  1: {
    main: "Explore the university and Find Zoe",
    sub: "Navigate through the university to locate Zoe."
  },
  2: {
    main: "Find the Electro",
    sub: "Use the minimap to find the Electro."
  },
  3: {
    main: "Reach near the Electro",
    sub: ""
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

// Create a wrapper object for backward compatibility
const objectiveSystem = {
  showObjective: (text) => {
    // For custom text, use the legacy function
    import("../commonFiles/ObjectiveUI.js").then(({ showObjectivesText }) => {
      showObjectivesText(text);
    });
  },
  updateObjective: (text) => {
    // For custom text updates, use the legacy function
    import("../commonFiles/ObjectiveUI.js").then(({ showObjectivesText }) => {
      showObjectivesText(text);
    });
  },
  clear: () => {
    import("../commonFiles/ObjectiveUI.js").then(({ cleanupObjectives }) => {
      cleanupObjectives();
    });
  }
};

export default objectiveSystem;