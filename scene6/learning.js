/**
 * About: `scene6/learning.js`
 *
 * Scene 6 Learning + Quiz UI controller.
 * Owns the MeshUI learning panel, lesson text rendering/formatting, and quiz/questions flow.
 */

 "use strict"; // Enable strict mode for safer, more predictable JavaScript

// Learning Panel - MeshUI Panel for Start Coding and lesson explanations.
// This module owns the 3D learning panel UI and navigation logic for Scene 6.
import * as ThreeMeshUI from "three-mesh-ui";
import * as THREE from "three";
import ConsolasFontJSON from "../fonts/CONSOLAS-msdf.json";
import ConsolasFontImage from "../fonts/CONSOLAS.png";
import { allAssets } from "../commonFiles/assetsLoader.js";
import { playAudio } from "../commonFiles/audiomanager.js";
import { runCodeButton } from "./ui.js";
import { scene6State } from "./scene6State.js";

// Geometry hardener: sanitize NaNs in position buffers; log each geometry once.
// This protects against invalid GLTF data causing crashes in bounding sphere computation.
(function hardenBoundingSphereOnce() {
  try {
    if (!THREE || !THREE.BufferGeometry) return;
    if (THREE.BufferGeometry.__hardened_once) return;
    const orig = THREE.BufferGeometry.prototype.computeBoundingSphere;
    const seen = new Set();
    THREE.BufferGeometry.prototype.computeBoundingSphere = function () {
      const pos = this.attributes && this.attributes.position;
      if (!pos || !pos.array || pos.count === 0) {
        this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
        return;
      }
      const arr = pos.array;
      let hadNaN = false;
      for (let i = 0; i < arr.length; i++) {
        if (!Number.isFinite(arr[i])) {
          hadNaN = true;
          arr[i] = 0;
        }
      }
      if (hadNaN && !seen.has(this.uuid)) {
        seen.add(this.uuid);
        try {
          pos.needsUpdate = true;
        } catch (e) {}
        // console.warn suppressed intentionally
      }
      try {
        orig.call(this);
        if (
          !this.boundingSphere ||
          !Number.isFinite(this.boundingSphere.radius)
        ) {
          this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
        }
      } catch (e) {
        this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
      }
    };
    THREE.BufferGeometry.__hardened_once = true;
  } catch (e) {}
})();

// Font configuration for the MeshUI text elements.
const fontFamily = ConsolasFontJSON;
const fontTexture = ConsolasFontImage;

// References to core learning panel UI elements.
let learningPanel = null;
let learningNextArrow = null;
let learningArrowClickHandler = null;
let learningArrowCamera = null;

// Track lesson content state (current lesson + index within that lesson).
let currentLessonName = null;
let currentLessonIndex = 0;
let learningSceneRef = null;

// Section containers for bordered display (What / How / Why / Syntax).
let sectionContainers = {
  what: null,
  how: null,
  why: null,
  syntax: null,
};

// Numeric guard for UI properties.
/**
 * Safely coerce a value to a finite number, falling back when invalid.
 *
 * @param {number} n - Input value to validate.
 * @param {number} fallback - Fallback value when n is not finite.
 * @returns {number} Either n (if finite) or the fallback.
 */
function finite(n, fallback) {
  return Number.isFinite(n) ? n : fallback;
}

// Replace unsupported glyphs with ASCII-safe equivalents for MSDF font.
/**
 * Normalize rich text so it only uses glyphs supported by the MSDF font.
 * - Replaces bullets, dashes, and curly quotes with simple ASCII equivalents.
 * - Strips out other non-ASCII characters that the font likely lacks.
 *
 * @param {string} text - Original text content.
 * @returns {string} Sanitized text safe for the MSDF font.
 */
function sanitizeForMSDFFont(text) {
  if (!text) return "";
  return (
    text
      .replace(/[•\u2022]/g, "-") // bullet
      .replace(/[—\u2014]/g, "-") // em dash
      .replace(/[–\u2013]/g, "-") // en dash
      .replace(/[""\u201C\u201D]/g, '"') // curly double quotes
      .replace(/[''\u2018\u2019]/g, "'") // curly single quotes
      .replace(/\u00A0/g, " ") // non-breaking space to normal space
      .replace(/[\u2000-\u200B]/g, " ") // various spaces/ZWSP
      // strip any remaining non-ASCII characters that the font likely lacks
      .replace(/[^\x20-\x7E\n\r\t]/g, "")
  );
}

// Format content into sections: What it is, How it works, Why useful, Syntax/Example (no bullets).
/**
 * Convert a raw lesson explanation string into a simple multi-section string.
 * Sections are extracted by markers in lessons.json:
 *   - "What it is", "How it works", "Why useful", "Syntax", "Example".
 *
 * @param {string} text - Raw lesson content.
 * @returns {string} Formatted string with labeled sections, or the original text if no markers match.
 */
function formatAsSections(text) {
  const raw = typeof text === "string" ? text : "";
  if (!raw.trim()) return "";

  // Extract sections by simple markers present in lessons.json
  const extract = (label) => {
    const re = new RegExp(
      label + "\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n[A-Za-z].*?:|$)",
      "i"
    );
    const m = raw.match(re);
    return m && m[1] ? m[1].trim() : "";
  };

  const what = extract("What it is");
  const how = extract("How it works");
  const why = extract("Why useful");
  const syntax = extract("Syntax");
  const example = extract("Example");

  const syntaxOrExample = syntax || example;

  const parts = [];
  if (what) parts.push("What it is:\n" + what);
  if (how) parts.push("How it works:\n" + how);
  if (why) parts.push("Why useful:\n" + why);
  if (syntaxOrExample) parts.push("Syntax / Example:\n" + syntaxOrExample);

  // Fallback: if nothing matched, return raw
  return parts.length > 0 ? parts.join("\n\n") : raw;
}

// Extract individual sections for bordered display.
/**
 * Extract individual section bodies from the raw lesson text.
 *
 * @param {string} text - Raw lesson content.
 * @returns {{what:string, how:string, why:string, syntax:string, example:string}} Section map.
 */
function extractSections(text) {
  const raw = typeof text === "string" ? text : "";
  if (!raw.trim()) return {};

  // Extract sections by simple markers present in lessons.json
  const extract = (label) => {
    const re = new RegExp(
      label + "\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n[A-Za-z].*?:|$)",
      "i"
    );
    const m = raw.match(re);
    return m && m[1] ? m[1].trim() : "";
  };

  return {
    what: extract("What it is"),
    how: extract("How it works"),
    why: extract("Why useful"),
    syntax: extract("Syntax"),
    example: extract("Example"),
  };
}

// Calculate dynamic height based on content length.
/**
 * Compute a reasonable mesh height for a section based on its text length.
 *
 * @param {string} content - Text content in the section.
 * @returns {number} Height in world units, clamped to a safe range.
 */
function calculateSectionHeight(content) {
  if (!content || content.trim() === "") return 0.08; // Further reduced minimum height

  const lines = content.split("\n").length;
  const words = content.split(/\s+/).length;
  const chars = content.length;

  // More conservative height calculation with minimal padding
  let height = 0.08; // Further reduced base height
  height += Math.max(0, lines - 1) * 0.035; // Height per line for code
  height += Math.min(0.12, words * 0.0025); // Word count factor
  height += Math.min(0.06, chars * 0.00012); // Character count factor

  // Cap the maximum height to prevent extremely tall sections
  return Math.min(0.5, Math.max(0.08, height));
}

// Format code so leading indentation is preserved for MeshUI (convert leading spaces/tabs to NBSP).
/**
 * Preserve leading indentation for code blocks rendered with MeshUI.
 * Converts leading spaces/tabs on each line into non-breaking spaces so alignment is stable.
 *
 * @param {string} raw - Raw code string.
 * @returns {string} Code string with indentation encoded as NBSPs.
 */
function formatCodeForMeshUI(raw) {
  const text = typeof raw === "string" ? raw : "";
  const lines = text.split(/\r?\n/);
  const toNbsp = (n) => "\u00A0".repeat(n);
  return lines
    .map((line) => {
      // Expand tabs to 2 spaces for consistent width, then convert only the leading spaces to NBSPs
      const expanded = line.replace(/\t/g, "  ");
      const m = expanded.match(/^(\s*)/);
      const lead = m ? m[1] : "";
      const leadCount = lead.length;
      return toNbsp(leadCount) + expanded.slice(leadCount);
    })
    .join("\n");
}

/**
 * Create the main learning panel and attach it to the given scene.
 * The panel is initially hidden; other helpers will control its visibility and content.
 *
 * @param {THREE.Scene} scene - Scene to which the learning panel should be added.
 */
export function createLearningPanel(scene) {
  // Create the main learning panel
  learningSceneRef = scene || learningSceneRef;
  learningPanel = new ThreeMeshUI.Block({
    width: 1.7,
    // Remove fixed height to allow dynamic sizing based on content
    justifyContent: "start",
    contentDirection: "column",
    borderRadius: 0.05,
    backgroundOpacity: 0.0,
    backgroundColor: new THREE.Color(0x000000),
    padding: 0.08,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    fontSize: 0.04,
  });

  // Position the panel (initially hidden) - slightly moved up
  learningPanel.position.set(0, 2.4, -4.1);
  learningPanel.visible = false;

  // Small top label badge (shows current label)
  const labelBadge = new ThreeMeshUI.Text({
    content: "",
    fontSize: 0.06,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    textAlign: "center",
    color: new THREE.Color(0x7fb3ff),
  });

  // Create title
  const learningTitle = new ThreeMeshUI.Text({
    content: "",
    fontSize: 0.05,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    textAlign: "center",
    color: new THREE.Color(0xffffff),
  });

  // Create bordered sections container
  const sectionsContainer = new ThreeMeshUI.Block({
    width: 1.55,
    // Remove fixed height to allow dynamic sizing based on content
    contentDirection: "column",
    justifyContent: "start",
    alignItems: "stretch",
    backgroundOpacity: 0.0,
    margin: 0.03,
    padding: 0.02,
  });

  // Create individual bordered sections
  const createSection = (sectionName, sectionTitle, color = 0x2c3e50) => {
    const sectionContainer = new ThreeMeshUI.Block({
      width: 1.5,
      // Remove fixed height to allow dynamic sizing
      contentDirection: "column",
      justifyContent: "start",
      alignItems: "stretch",
      borderRadius: 0.03,
      backgroundOpacity: 0.0,
      backgroundColor: new THREE.Color(0x000000),
      borderWidth: 0.005,
      borderColor: new THREE.Color(0x3498db),
      borderOpacity: 0.3,
      margin: 0.01,
      padding: 0.02,
    });

    const sectionTitleText = new ThreeMeshUI.Text({
      content: sectionTitle,
      fontSize: 0.04,
      fontFamily: fontFamily,
      fontTexture: fontTexture,
      textAlign: "left",
      color: new THREE.Color(0x3498db),
    });

    const sectionContentText = new ThreeMeshUI.Text({
      content: "",
      fontSize: 0.032,
      fontFamily: fontFamily,
      fontTexture: fontTexture,
      textAlign: "left",
      color: new THREE.Color(0xecf0f1),
      width: 1.2,
      lineHeight: 1.15,
      margin: 0.005,
    });

    sectionContainer.add(sectionTitleText);
    sectionContainer.add(sectionContentText);

    return {
      container: sectionContainer,
      title: sectionTitleText,
      content: sectionContentText,
    };
  };

  // Create all sections
  sectionContainers.what = createSection("what", "What it is:", 0x2c3e50);
  sectionContainers.how = createSection("how", "How it works:", 0x27ae60);
  sectionContainers.why = createSection("why", "Why useful:", 0xe74c3c);
  sectionContainers.syntax = createSection(
    "syntax",
    "Syntax / Example:",
    0x9b59b6
  );

  // Add sections to container
  sectionsContainer.add(sectionContainers.what.container);
  sectionsContainer.add(sectionContainers.how.container);
  sectionsContainer.add(sectionContainers.why.container);
  sectionsContainer.add(sectionContainers.syntax.container);

  // Create instruction text
  const instructionText = new ThreeMeshUI.Text({
    content: "",
    fontSize: 0.035,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    textAlign: "center",
    color: new THREE.Color(0x3498db),
    width: 1.8,
    lineHeight: 1.2,
  });

  // Create learning next arrow (hidden by default)
  learningNextArrow = new ThreeMeshUI.Block({
    width: 0.2,
    height: 0.1,
    justifyContent: "center",
    contentDirection: "row",
    borderRadius: 0.05,
    backgroundOpacity: 0.95,
    backgroundColor: new THREE.Color(0x2ecc71),
    margin: 0.005,
  });
  const arrowLabel = new ThreeMeshUI.Text({
    content: ">",
    fontSize: 0.04,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    textAlign: "center",
    color: new THREE.Color(0x000000),
  });
  learningNextArrow.add(arrowLabel);
  learningNextArrow.visible = false;
  learningNextArrow.userData.clickable = true;
  learningNextArrow.traverse((child) => {
    if (child && child.userData) child.userData.clickable = true;
  });

  // Create Take Quiz button directly here
  learningQuizButton = new ThreeMeshUI.Block({
    width: 0.4,
    height: 0.1,
    justifyContent: "center",
    contentDirection: "row",
    borderRadius: 0.05,
    backgroundOpacity: 0.95,
    backgroundColor: new THREE.Color(0x9b59b6), // purple
    margin: 0.01,
  });
  const quizLabel = new ThreeMeshUI.Text({
    content: "Take Quiz",
    fontSize: 0.035,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    textAlign: "center",
    color: new THREE.Color(0x000000),
  });
  learningQuizButton.add(quizLabel);
  learningQuizButton.visible = false;
  learningQuizButton.userData.clickable = true;
  learningQuizButton.traverse((child) => {
    if (child && child.userData) child.userData.clickable = true;
  });

  // Footer row to hold the arrow and quiz button at bottom-right
  const learningFooterRow = new ThreeMeshUI.Block({
    width: 1.84,
    height: 0.12,
    contentDirection: "row",
    justifyContent: "end",
    alignItems: "center",
    backgroundOpacity: 0.0,
    margin: 0.005,
  });
  learningFooterRow.add(learningQuizButton);
  learningFooterRow.add(learningNextArrow);

  // Add elements to the panel (badge at top)
  learningPanel.add(labelBadge);
  learningPanel.add(learningTitle);
  learningPanel.add(sectionsContainer);
  learningPanel.add(instructionText);
  learningPanel.add(learningFooterRow);

  // Position the text elements within the panel
  labelBadge.position.set(0, 0.1, 0.01);
  learningTitle.position.set(0, 0.1, 0.01);
  instructionText.position.set(0, -0.25, 0.01);
  // learningNextArrow and learningQuizButton are aligned in the footer row via justifyContent: 'end'

  // Add the panel to the scene
  scene.add(learningPanel);

  // Auto-attach arrow handler if a global camera is available
  try {
    const camera = scene6State.camera;
    if (camera) {
      attachLearningArrowHandler(camera);
      attachLearningQuizHandler(camera);
    }
  } catch (e) {}

  // Force on-top rendering for the learning panel
  try {
    learningPanel.renderOrder = 1000;
    learningPanel.traverse((child) => {
      if (child.material) {
        child.material.depthTest = false;
        child.material.depthWrite = false;
        child.material.transparent = true;
      }
      try {
        child.frustumCulled = false;
      } catch (e) {}
    });
  } catch (e) {}

  console.log("Learning panel created and added to scene");

  return learningPanel;
}

// Function to show the learning panel
export function showLearningPanel() {
  if (learningPanel) {
    uiMode = "learning";
    learningPanel.visible = true;
    // Ensure quiz/questions panel is hidden when instruction panel is shown
    try {
      hideQuestionsPanel();
    } catch (e) {}
    console.log("Learning panel is now visible");
  } else {
    console.warn(
      "Learning panel not found - make sure createLearningPanel was called first"
    );
  }
}

// Function to hide the learning panel
export function hideLearningPanel() {
  if (learningPanel) {
    learningPanel.visible = false;
    console.log("Learning panel is now hidden");
  } else {
    console.warn("Learning panel not found");
  }
}

// Function to toggle the learning panel visibility
export function toggleLearningPanel() {
  if (learningPanel) {
    learningPanel.visible = !learningPanel.visible;
    // If instruction panel is now visible, hide the quiz/questions panel
    if (learningPanel.visible) {
      uiMode = "learning";
      try {
        hideQuestionsPanel();
      } catch (e) {}
    }
    console.log(
      `Learning panel visibility toggled to: ${learningPanel.visible}`
    );
  } else {
    console.warn("Learning panel not found");
  }
}

// Function to update panel content
export function updateLearningPanelContent(title, description, instruction) {
  if (learningPanel) {
    const safeTitle = sanitizeForMSDFFont(title);
    const safeDescription = sanitizeForMSDFFont(description);
    const safeInstruction = sanitizeForMSDFFont(instruction);

    // Extract individual sections from the description
    const sections = extractSections(description);

    // Find and update the text elements
    learningPanel.children.forEach((child, index) => {
      if (child.isText) {
        switch (index) {
          case 0: // Label badge (top)
            if (safeTitle) child.set({ content: safeTitle });
            break;
          case 1: // Title line
            if (safeTitle) child.set({ content: safeTitle });
            break;
          case 3: // Instruction footer
            if (safeInstruction) child.set({ content: safeInstruction });
            break;
        }
      }
    });

    // Update individual section contents with dynamic heights
    if (sectionContainers.what && sectionContainers.what.content) {
      const whatContent = sections.what || "No content available";
      sectionContainers.what.content.set({
        content: sanitizeForMSDFFont(whatContent),
      });
      // Set dynamic height based on content
      const whatHeight = calculateSectionHeight(whatContent);
      sectionContainers.what.container.set({ height: whatHeight });
    }

    if (sectionContainers.how && sectionContainers.how.content) {
      const howContent = sections.how || "No content available";
      sectionContainers.how.content.set({
        content: sanitizeForMSDFFont(howContent),
      });
      // Set dynamic height based on content
      const howHeight = calculateSectionHeight(howContent);
      sectionContainers.how.container.set({ height: howHeight });
    }

    if (sectionContainers.why && sectionContainers.why.content) {
      const whyContent = sections.why || "No content available";
      sectionContainers.why.content.set({
        content: sanitizeForMSDFFont(whyContent),
      });
      // Set dynamic height based on content
      const whyHeight = calculateSectionHeight(whyContent);
      sectionContainers.why.container.set({ height: whyHeight });
    }

    if (sectionContainers.syntax && sectionContainers.syntax.content) {
      const syntaxContent =
        sections.syntax || sections.example || "No content available";
      sectionContainers.syntax.content.set({
        content: sanitizeForMSDFFont(syntaxContent),
      });
      // Set dynamic height based on content
      const syntaxHeight = calculateSectionHeight(syntaxContent);
      sectionContainers.syntax.container.set({ height: syntaxHeight });
    }

    console.log("Learning panel content updated with bordered sections");
    // While updating learning content, ensure quiz stays hidden
    try {
      if (uiMode === "learning") hideQuestionsPanel();
      // Additional safeguard: always hide questions panel when learning panel is visible
      if (learningPanel && learningPanel.visible) hideQuestionsPanel();
    } catch (e) {}
  } else {
    console.warn("Learning panel not found - cannot update content");
  }
}

// Utilities to bind lessons.json to the panel
function getLessonConfig(lessonName) {
  const lessonsData = allAssets.jsonFiles["lessons"];
  if (!lessonsData || !lessonsData.lessonConfigs) return null;
  return lessonsData.lessonConfigs[lessonName] || null;
}

function clampIndex(index, max) {
  if (index < 0) return 0;
  if (index >= max) return max - 1;
  return index;
}

// Add a Take Quiz button that shows on the last label
let learningQuizButton = null;
let learningQuizClickHandler = null;
let learningQuizCamera = null;
let learningQuizCallback = null; // optional external handler

// Questions (Quiz) Panel state
let uiMode = "learning"; // 'learning' | 'quiz'
let questionsPanel = null;
let questionsCamera = null;
let questionTitleText = null;
let questionBodyText = null;
let optionButtons = [];
let currentQuestionIndex = 0;
let quizData = null;
let questionsClickHandler = null;
let quizResults = []; // Track user answers and correctness
let showingSummary = false; // Track if we're showing summary
let runCodeClickHandler = null; // handler for Run Code clicks
let runCodeAnimId = null; // requestAnimationFrame id for code bounce
let optionsColumnRef = null; // store the options column to dynamically add/remove buttons
let questionInteractionLocked = false; // lock to prevent rapid multi-click advancing
let lastQuestionPointerDownAt = 0; // timestamp throttle for pointer events

// Track best score achieved per lesson to avoid reducing marks across retakes
let bestScoresByLesson = {};

function createQuestionsPanel(scene) {
  console.log(
    "[Quiz] createQuestionsPanel called with scene:",
    !!scene,
    "currentLessonName:",
    currentLessonName
  );
  if (questionsPanel) {
    console.log("[Quiz] Questions panel already exists, returning existing");
    return questionsPanel;
  }

  // Load quiz data based on current lesson
  // Also check scene6State.getCurrentLesson() or window.getCurrentLesson() as a fallback to ensure we have the correct lesson
  const getCurrentLesson = typeof scene6State.getCurrentLesson === 'function' 
    ? scene6State.getCurrentLesson 
    : (typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson : null);
  const actualLesson =
    currentLessonName ||
    (getCurrentLesson ? getCurrentLesson() : "lesson1");
  console.log(
    `[Quiz] createQuestionsPanel - Actual lesson determined: ${actualLesson} (currentLessonName: ${currentLessonName})`
  );

  // Load quiz data from allAssets.jsonFiles
  if (actualLesson === "lesson2") {
    quizData = allAssets.jsonFiles["lesson2-questions"] || null;
    console.log("[Quiz] Loaded lesson2 quiz data:", !!quizData);
  } else if (actualLesson === "lesson3") {
    quizData = allAssets.jsonFiles["lesson3-questions"] || null;
    console.log(
      "[Quiz] Loaded lesson3 quiz data:",
      !!quizData,
      "questions count:",
      quizData?.questions?.length
    );
  } else if (actualLesson === "lesson4") {
    quizData = allAssets.jsonFiles["lesson4-questions"] || null;
    console.log(
      "[Quiz] Loaded lesson4 quiz data:",
      !!quizData,
      "questions count:",
      quizData?.questions?.length
    );
  } else if (actualLesson === "lesson5") {
    quizData = allAssets.jsonFiles["lesson5-questions"] || null;
    console.log(
      "[Quiz] Loaded lesson5 quiz data:",
      !!quizData,
      "questions count:",
      quizData?.questions?.length
    );
  } else {
    quizData = allAssets.jsonFiles["lesson1-questions"] || null;
    console.log("[Quiz] Loaded lesson1 quiz data (default):", !!quizData);
  }

  // Limit to first 5 questions for both lessons
  if (quizData && quizData.questions) {
    const maxQuestions = 5;
    if (quizData.questions.length > maxQuestions) {
      quizData = {
        ...quizData,
        questions: quizData.questions.slice(0, maxQuestions),
      };
    }
  }

  const targetScene =
    scene ||
    learningSceneRef ||
    (typeof window !== "undefined" ? window.scene : null);
  console.log(
    "[Quiz] Target scene available:",
    !!targetScene,
    "scene type:",
    typeof targetScene
  );
  if (!targetScene) {
    console.warn(
      "[Learning] createQuestionsPanel: No scene available to attach questionsPanel"
    );
  }

  questionsPanel = new ThreeMeshUI.Block({
    width: 1.5,
    height: 1,
    justifyContent: "start",
    contentDirection: "column",
    alignItems: "stretch",
    borderRadius: 0.05,
    backgroundOpacity: 0.0,
    backgroundColor: new THREE.Color(0x111111),
    padding: 0.08,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    fontSize: 0.04,
  });

  // Align to learning panel position if available
  try {
    if (learningPanel) {
      questionsPanel.position.set(0, learningPanel.position.y + 0.1, -4.1);
    } else {
      questionsPanel.position.set(0, 2.5, -4.1);
    }
  } catch (e) {
    questionsPanel.position.set(0, 2.2, -4.1);
  }
  questionsPanel.visible = false;
  try {
    questionsPanel.renderOrder = 1100;
    questionsPanel.traverse((child) => {
      if (child.material) {
        child.material.depthTest = false;
        child.material.depthWrite = false;
        child.material.transparent = true;
      }
      try {
        child.frustumCulled = false;
      } catch (e) {}
    });
  } catch (e) {}

  questionTitleText = new ThreeMeshUI.Text({
    content: sanitizeForMSDFFont(
      quizData && quizData.title ? quizData.title : "Questions"
    ),
    fontSize: 0.05,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    textAlign: "center",
    color: new THREE.Color(0x7fb3ff),
    width: 1.84,
    lineHeight: 1.2,
    margin: 0.02,
  });
  try {
    questionTitleText.renderOrder = 1102;
  } catch (e) {}
  // Hide heading per request
  try {
    questionTitleText.set({ content: "" });
  } catch (e) {}
  try {
    questionTitleText.visible = false;
  } catch (e) {}

  questionBodyText = new ThreeMeshUI.Text({
    content: "",
    fontSize: 0.05,
    fontFamily: fontFamily,
    fontTexture: fontTexture,
    textAlign: "left",
    color: new THREE.Color(0xffffff),
    width: 1.84,
    lineHeight: 1.3,
    margin: 0,
    padding: 0,
  });
  try {
    questionBodyText.renderOrder = 1102;
  } catch (e) {}

  const optionsColumn = new ThreeMeshUI.Block({
    width: 1.84,
    height: 1.2,
    contentDirection: "column",
    justifyContent: "start",
    alignItems: "stretch",
    backgroundOpacity: 0.0,
    margin: 0.2,
  });
  optionsColumnRef = optionsColumn;

  // Create 4 option buttons
  const makeOption = () =>
    new ThreeMeshUI.Block({
      width: 1.84,
      height: 0.09,
      justifyContent: "center",
      contentDirection: "row",
      borderRadius: 0.04,
      backgroundOpacity: 0.95,
      backgroundColor: new THREE.Color(0x2c3e50),
      margin: 0.02,
    });

  for (let i = 0; i < 4; i += 1) {
    const btn = makeOption();
    try {
      btn.renderOrder = 1100;
    } catch (e) {}
    const txt = new ThreeMeshUI.Text({
      content: "",
      fontSize: 0.04,
      fontFamily: fontFamily,
      fontTexture: fontTexture,
      textAlign: "left",
      color: new THREE.Color(0xecf0f1),
      width: 1.76,
      lineHeight: 1.2,
      margin: 0,
      padding: 0,
    });
    try {
      txt.renderOrder = 1101;
    } catch (e) {}
    btn.add(txt);
    btn.userData.clickable = true;
    btn.traverse((child) => {
      if (child && child.userData) child.userData.clickable = true;
    });
    optionButtons.push(btn);
    optionsColumn.add(btn);
  }

  questionsPanel.add(questionTitleText);
  questionsPanel.add(questionBodyText);
  questionsPanel.add(optionsColumn);

  if (targetScene) {
    targetScene.add(questionsPanel);
    console.log("[Quiz] Questions panel added to scene");
  } else {
    console.error(
      "[Quiz] No target scene available, questions panel not added to scene"
    );
  }

  // Auto-attach click handler if a global camera is available
  try {
    const camera = scene6State.camera;
    if (camera) {
      attachQuestionsHandler(camera);
    }
  } catch (e) {}

  updateQuestionsPanelContent();
  try {
    ThreeMeshUI.update();
  } catch (e) {}
  return questionsPanel;
}

function showQuestionsPanel() {
  console.log("[Quiz] showQuestionsPanel called");
  // Respect current UI mode; do not show quiz if we are in learning mode
  if (uiMode !== "quiz") {
    console.log("[Quiz] Aborting showQuestionsPanel because uiMode is", uiMode);
    return;
  }

  // Additional check: if learning panel is visible, don't show questions panel
  if (learningPanel && learningPanel.visible) {
    console.log(
      "[Quiz] Aborting showQuestionsPanel because learning panel is visible"
    );
    return;
  }

  // Additional check: if steps panel (instruction panel) is visible, don't show questions panel
  if (
    typeof window !== "undefined" &&
    window.codePlane &&
    window.codePlane.visible
  ) {
    console.log(
      "[Quiz] Aborting showQuestionsPanel because steps panel (codePlane) is visible"
    );
    return;
  }

  if (!questionsPanel) {
    console.log("[Quiz] Creating new questions panel");
    try {
      createQuestionsPanel(learningSceneRef);
    } catch (e) {
      console.error("[Quiz] Error creating questions panel:", e);
    }
  }
  if (questionsPanel) {
    console.log("[Quiz] Questions panel exists, making visible");
    try {
      // Ensure content is up-to-date before first visible frame
      updateQuestionsPanelContent();
      ThreeMeshUI.update();
      ThreeMeshUI.update();
    } catch (e) {
      console.error("[Quiz] Error updating questions panel content:", e);
    }
    questionsPanel.visible = true;
    console.log(
      "[Quiz] Questions panel visibility set to:",
      questionsPanel.visible
    );
    try {
      ThreeMeshUI.update();
    } catch (e) {
      console.error("[Quiz] Error updating ThreeMeshUI:", e);
    }
  } else {
    console.error("[Quiz] Questions panel is null after creation attempt");
  }
}

function hideQuestionsPanel() {
  if (questionsPanel) {
    questionsPanel.visible = false;
    try {
      ThreeMeshUI.update();
    } catch (e) {}
  }
}

// Make hideQuestionsPanel available globally for ui.js to call
if (typeof window !== "undefined") {
  scene6State.hideQuestionsPanel = hideQuestionsPanel;
}

function updateQuestionsPanelContent() {
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    console.warn(
      "[Quiz] No quiz data available for updateQuestionsPanelContent"
    );
    return;
  }
  currentQuestionIndex = Math.max(
    0,
    Math.min(currentQuestionIndex, quizData.questions.length - 1)
  );
  const q = quizData.questions[currentQuestionIndex];
  const qText = `${currentQuestionIndex + 1}/${quizData.questions.length} - ${
    q.question
  }`;
  console.log(
    `[Quiz] Updating question ${
      currentQuestionIndex + 1
    }: ${q.question.substring(0, 50)}...`
  );
  if (questionBodyText)
    questionBodyText.set({
      content: sanitizeForMSDFFont(qText),
      textAlign: "left",
      margin: 0,
      padding: 0,
      alignContent: "left",
      alignItems: "left",
      justifyContent: "start",
      position: new THREE.Vector3(
        -0.92,
        questionBodyText.position.y,
        questionBodyText.position.z
      ),
    });

  // Dynamically ensure we have the right number of option buttons for this question
  const optionCount = Array.isArray(q && q.options) ? q.options.length : 0;
  // Widths per lesson: make lesson2 options narrower, keep others as before
  const getCurrentLesson = typeof scene6State.getCurrentLesson === 'function' 
    ? scene6State.getCurrentLesson 
    : (typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson : null);
  const currentLessonNameSafe = getCurrentLesson 
    ? getCurrentLesson()
    : (typeof currentLessonName === 'string' ? currentLessonName : '');
  const narrowLessons = ['lesson2','lesson3','lesson4','lesson5'];
  const isNarrow = narrowLessons.includes(currentLessonNameSafe);
  const optionWidth = isNarrow ? 1.2 : 1.2;
  const textWidth = isNarrow ? 1.2 : 1.2;
  // Ensure the parent column does not stretch children to full width
  try {
    if (optionsColumnRef && typeof optionsColumnRef.set === 'function') {
      optionsColumnRef.set({ alignItems: 'center' });
    }
  } catch (e) {}
  const makeOption = () =>
    new ThreeMeshUI.Block({
      width: optionWidth,
      maxWidth: optionWidth,
      minWidth: optionWidth,
      height: 0.09,
      justifyContent: "center",
      contentDirection: "row",
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 0.04,
      backgroundOpacity: 0.95,
      backgroundColor: new THREE.Color(0x2c3e50),
      margin: 0.02,
    });
  const createText = () =>
    new ThreeMeshUI.Text({
      content: "",
      fontSize: 0.04,
      fontFamily: fontFamily,
      fontTexture: fontTexture,
      textAlign: "left",
      color: new THREE.Color(0xecf0f1),
      width: textWidth,
      maxWidth: textWidth,
      minWidth: textWidth,
      whiteSpace: 'normal',
      lineHeight: 1.2,
      margin: 0,
      padding: 0,
    });

  try {
    if (optionsColumnRef) {
      while (optionButtons.length < optionCount) {
        const btn = makeOption();
        try {
          btn.renderOrder = 1100;
        } catch (e) {}
        const txt = createText();
        try {
          txt.renderOrder = 1101;
        } catch (e) {}
        btn.add(txt);
        btn.userData.clickable = true;
        btn.traverse((child) => {
          if (child && child.userData) child.userData.clickable = true;
        });
        optionButtons.push(btn);
        optionsColumnRef.add(btn);
      }
    }
  } catch (e) {}

  // Set labels for available options and hide any extras
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < optionButtons.length; i += 1) {
    const btn = optionButtons[i];
    const within = i < optionCount;
    try {
      btn.visible = within;
      // Always enforce width based on lesson, even for pre-existing buttons
      btn.set({ width: optionWidth, maxWidth: optionWidth, minWidth: optionWidth, flexGrow: 0, flexShrink: 0 });
    } catch (e) {}
    if (!within) continue;

    let txt = null;
    if (btn.children && btn.children.length > 0) {
      txt = btn.children.find((ch) => ch && ch.isText) || btn.children[0];
    }
    if (!txt || !txt.isText) {
      txt = createText();
      try {
        txt.renderOrder = 1102;
      } catch (e) {}
      btn.add(txt);
    }

    const optRaw =
      q && q.options && q.options[i] != null ? String(q.options[i]) : "";
    const prefixChar = alphabet[i] || String(i + 1);
    const label = `${prefixChar}) ${optRaw}`;
    btn.set({ backgroundColor: new THREE.Color(0x2c3e50) });
    if (txt)
      txt.set({
        content: sanitizeForMSDFFont(label),
        textAlign: "center",
        margin: 0,
        padding: 0,
        alignContent: "center",
        alignItems: "center",
        justifyContent: "center",
        width: textWidth,
        maxWidth: textWidth,
        minWidth: textWidth,
        whiteSpace: 'normal',
        //position: new THREE.Vector3(0, txt.position.y, txt.position.z),
      });
  }
  try {
    ThreeMeshUI.update();
  } catch (e) {}
}

function onOptionSelected(optionIndex) {
  if (!quizData || showingSummary) return;

  // Prevent rapid multiple clicks from advancing multiple questions
  if (questionInteractionLocked) return;
  questionInteractionLocked = true;

  const q = quizData.questions[currentQuestionIndex];
  const isCorrect =
    q && typeof q.answerIndex === "number" && q.answerIndex === optionIndex;

  // Store the result
  quizResults.push({
    questionIndex: currentQuestionIndex,
    selectedOption: optionIndex,
    correctOption: q.answerIndex,
    isCorrect: isCorrect,
    question: q.question,
  });

  // Show visual feedback for selected option
  const selectedBtn = optionButtons[optionIndex];
  if (selectedBtn) {
    // Highlight the selected option briefly
    selectedBtn.set({ backgroundColor: new THREE.Color(0x3498db) }); // Blue highlight
    try {
      ThreeMeshUI.update();
    } catch (e) {}
  }

  // Move to next question after a brief delay to show selection
  setTimeout(() => {
    currentQuestionIndex += 1;
    if (currentQuestionIndex >= quizData.questions.length) {
      showQuizSummary();
      // unlock after reaching summary
      questionInteractionLocked = false;
      return;
    }
    updateQuestionsPanelContent();
    try {
      ThreeMeshUI.update();
    } catch (e) {}
    // unlock after the content updates
    questionInteractionLocked = false;
  }, 800); // Brief delay to show selection
}

function showQuizSummary() {
  showingSummary = true;

  // Calculate score and update best score for this lesson
  const correctCount = quizResults.filter((r) => r.isCorrect).length;
  const wrongCount = quizResults.filter((r) => !r.isCorrect).length;
  const totalQuestions = quizResults.length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  // Persist best score for the current lesson; never decrease on retakes
  try {
    const lessonKey = currentLessonName || "defaultLesson";
    const prevBest =
      typeof bestScoresByLesson[lessonKey] === "number"
        ? bestScoresByLesson[lessonKey]
        : 0;
    const newBest = Math.max(prevBest, percentage);
    bestScoresByLesson[lessonKey] = newBest;
  } catch (e) {}

  const lessonKeyForDisplay = currentLessonName || "Lesson";
  const bestToDisplay =
    bestScoresByLesson &&
    typeof bestScoresByLesson[lessonKeyForDisplay] === "number"
      ? bestScoresByLesson[lessonKeyForDisplay]
      : percentage;

  // Update the question body to show summary with best score retained across retakes
  const summaryText = `Quiz Complete!\n\nCorrect: ${correctCount}\nWrong: ${wrongCount}\nTotal: ${totalQuestions}\nScore: ${bestToDisplay}%\n\nClick \"Take quiz again\" to retry.`;

  if (questionBodyText) {
    questionBodyText.set({ content: sanitizeForMSDFFont(summaryText) });
  }

  // Hide all option buttons, then show the first as "Take quiz again"
  optionButtons.forEach((btn, i) => {
    btn.visible = false;
    try {
      btn.set({ backgroundColor: new THREE.Color(0x2c3e50) });
    } catch (e) {}
  });
  const retryBtn = optionButtons[0];
  if (retryBtn) {
    retryBtn.visible = true;
    try {
      retryBtn.set({
        backgroundColor: new THREE.Color(0x9b59b6),
        width: 0.3,
        alignSelf: "end",
        margin: 0.22,
      });
    } catch (e) {}
    // Ensure parent column does not stretch the child to full width
    try {
      const parentCol = retryBtn.parent;
      if (parentCol && typeof parentCol.set === "function") {
        parentCol.set({ alignItems: "end", justifyContent: "end" });
      }
    } catch (e) {}
    // Slight nudge up and right
    try {
      const z = retryBtn.position ? retryBtn.position.z : 0;
      retryBtn.position.set(0.04, 0.06, z);
    } catch (e) {}
    // Ensure it has a text child and set label
    let txt = null;
    if (retryBtn.children && retryBtn.children.length > 0) {
      txt =
        retryBtn.children.find((ch) => ch && ch.isText) || retryBtn.children[0];
    }
    if (!txt || !txt.isText) {
      txt = new ThreeMeshUI.Text({
        content: "",
        justifyContent: "start",
        contentDirection: "column",
        fontSize: 0.03,
        fontFamily: fontFamily,
        fontTexture: fontTexture,
        textAlign: "left",
        color: new THREE.Color(0x000000),
        width: 0.1,
        lineHeight: 1.2,
      });
      retryBtn.add(txt);
    }
    try {
      const isPerfect = wrongCount === 0;
      txt.set({
        content: isPerfect ? "Try this!" : "Take quiz again",
        textAlign: "center",
        width: 0.1,
        fontSize: 0.03,
      });
    } catch (e) {}
  }

  try {
    ThreeMeshUI.update();
  } catch (e) {}

  // Set up click handler to only restart on retry button click
  const summaryClickHandler = (event) => {
    try {
      const cam = questionsCamera;
      if (cam && retryBtn && retryBtn.visible) {
        const mouse = new THREE.Vector2(
          (event.clientX / window.innerWidth) * 2 - 1,
          -(event.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cam);
        const intersects = raycaster.intersectObjects([retryBtn], true);
        if (intersects.length > 0) {
          // If perfect score, show tryThisCode in the panel instead of restarting
          const correctCountNow = quizResults.filter((r) => r.isCorrect).length;
          const totalNow = quizResults.length;
          const isPerfectNow = correctCountNow === totalNow && totalNow > 0;
          if (isPerfectNow) {
            let code = "";
            try {
              const cfg =
                getLessonConfig && currentLessonName
                  ? getLessonConfig(currentLessonName)
                  : null;
              const lessonsData = allAssets.jsonFiles["lessons"];
              code =
                cfg && cfg.tryThisCode
                  ? String(cfg.tryThisCode)
                  : lessonsData && lessonsData.tryThisCode
                  ? String(lessonsData.tryThisCode)
                  : "";
            } catch (e) {}
            if (!code) code = "No code available.";
            if (questionBodyText) {
              try {
                const formatted = formatCodeForMeshUI(code);
                questionBodyText.set({
                  content: formatted,
                  textAlign: "left",
                  width: 1.84,
                  fontSize: 0.03,
                  lineHeight: 1.15,
                  margin: 0,
                  padding: 0,
                  alignContent: "left",
                  alignItems: "left",
                  justifyContent: "start",
                });

                // Adjust position to ensure text starts from far left
                questionBodyText.position.set(
                  0.3, // Move further left to align with margin
                  0, // Keep vertical position
                  questionBodyText.position ? questionBodyText.position.z : 0
                );

                // If the text is inside a container/parent, also adjust container alignment
                if (questionBodyText.parent) {
                  try {
                    questionBodyText.parent.set({
                      alignContent: "left",
                      alignItems: "left",
                      justifyContent: "start",
                      padding: 0,
                      margin: 0,
                    });
                  } catch (e) {}
                }
              } catch (e) {}
            }
            // Show an action button as 'Run Code' instead of hiding it
            try {
              if (retryBtn) {
                retryBtn.visible = true;
                retryBtn.set({
                  backgroundColor: new THREE.Color(0x9b59b6),
                  width: 0.3,
                  alignSelf: "end",
                  margin: 0.22,
                });
                const parentCol = retryBtn.parent;
                if (parentCol && typeof parentCol.set === "function")
                  parentCol.set({ alignItems: "end", justifyContent: "end" });
                let actTxt = null;
                if (retryBtn.children && retryBtn.children.length > 0) {
                  actTxt =
                    retryBtn.children.find((ch) => ch && ch.isText) ||
                    retryBtn.children[0];
                }
                if (!actTxt || !actTxt.isText) {
                  actTxt = new ThreeMeshUI.Text({
                    content: "",
                    fontSize: 0.03,
                    fontFamily: fontFamily,
                    fontTexture: fontTexture,
                    textAlign: "center",
                    color: new THREE.Color(0x000000),
                    width: 0.1,
                    lineHeight: 1.2,
                  });
                  retryBtn.add(actTxt);
                }
                actTxt.set({ content: "Run Code", textAlign: "center" });
              }
            } catch (e) {}
            try {
              ThreeMeshUI.update();
            } catch (e) {}
            document.removeEventListener("pointerdown", summaryClickHandler);

            // Attach a click handler for 'Run Code' to animate the code text
            try {
              if (runCodeClickHandler)
                document.removeEventListener(
                  "pointerdown",
                  runCodeClickHandler
                );
              runCodeClickHandler = (ev) => {
                try {
                  const cam2 = questionsCamera;
                  if (!cam2 || !retryBtn || !retryBtn.visible) return;
                  const mouse2 = new THREE.Vector2(
                    (ev.clientX / window.innerWidth) * 2 - 1,
                    -(ev.clientY / window.innerHeight) * 2 + 1
                  );
                  const ray2 = new THREE.Raycaster();
                  ray2.setFromCamera(mouse2, cam2);
                  const hit = ray2.intersectObjects([retryBtn], true);
                  if (hit.length > 0) {
                    try {
                      retryBtn.visible = false;
                      ThreeMeshUI.update();
                    } catch (e) {}
                    startCodeBounceAnimation();
                  }
                } catch (e) {}
              };
              document.addEventListener("pointerdown", runCodeClickHandler);
            } catch (e) {}
            return;
          }
          // Otherwise restart quiz
          try {
            restartQuiz();
          } catch (e) {
            // Fallback minimal reset
            quizResults = [];
            showingSummary = false;
            currentQuestionIndex = 0;
            optionButtons.forEach((btn) => {
              btn.visible = true;
            });
            updateQuestionsPanelContent();
          }
          // Keep best score intact across retakes; no changes needed here
          try {
            ThreeMeshUI.update();
          } catch (e) {}
          document.removeEventListener("pointerdown", summaryClickHandler);
        }
      }
    } catch (e) {}
  };

  // Add click handler for summary (does not exit on outside clicks)
  document.addEventListener("pointerdown", summaryClickHandler);
}

function startCodeBounceAnimation() {
  try {
    if (!questionBodyText) return;
    // cancel previous
    if (runCodeAnimId) cancelAnimationFrame(runCodeAnimId);
    const baseY = questionBodyText.position ? questionBodyText.position.y : 0;
    const amplitude = 0.03; // up/down distance
    const speed = 4.0; // cycles per second
    const durationMs = 2000; // total duration
    const start = performance.now();
    const animate = (t) => {
      const elapsed = t - start;
      const phase = (elapsed / 1000) * speed * Math.PI * 2;
      try {
        questionBodyText.position.set(
          questionBodyText.position ? questionBodyText.position.x : 0,
          baseY + Math.sin(phase) * amplitude,
          questionBodyText.position ? questionBodyText.position.z : 0
        );
      } catch (e) {}
      try {
        ThreeMeshUI.update();
      } catch (e) {}
      if (elapsed < durationMs) {
        runCodeAnimId = requestAnimationFrame(animate);
      } else {
        // snap back
        try {
          questionBodyText.position.set(
            questionBodyText.position ? questionBodyText.position.x : 0,
            baseY,
            questionBodyText.position ? questionBodyText.position.z : 0
          );
        } catch (e) {}
        try {
          ThreeMeshUI.update();
        } catch (e) {}
        runCodeAnimId = null;
        // Hide the code after the animation completes
        try {
          if (questionBodyText) {
            questionBodyText.visible = false;
            ThreeMeshUI.update();
          }
        } catch (e) {}

        // For lesson3: Start the LDR testing cube step after code animation
        try {
          if (
            currentLessonName === "lesson3" &&
            typeof window.startLesson3Step7 === "function"
          ) {
            console.log(
              "[Lesson3] Starting LDR testing cube step after code animation"
            );
            window.startLesson3Step7();
          }
        } catch (e) {
          console.error("[Lesson3] Error starting LDR testing step:", e);
        }

        // For lesson4: Set flag to indicate code animation completed
        try {
          console.log(
            "[Learning] Code animation completed, currentLessonName:",
            currentLessonName
          );
          const getCurrentLesson = typeof scene6State.getCurrentLesson === 'function' 
            ? scene6State.getCurrentLesson 
            : (typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson : null);
          const isLesson4 =
            currentLessonName === "lesson4" ||
            (getCurrentLesson && getCurrentLesson() === "lesson4");

          if (isLesson4) {
            console.log(
              "[Lesson4] Code animation completed, setting lesson4CodeAnimationCompleted flag"
            );
            if (typeof window !== "undefined") {
              window.lesson4CodeAnimationCompleted = true;
              console.log(
                "[Lesson4] lesson4CodeAnimationCompleted set to:",
                window.lesson4CodeAnimationCompleted
              );
              // Play lesson4_s7 audio exactly once from here as another guard
              try {
                if (!scene6State._lesson4_s8Played) {
                  // verify asset exists before playing
                  const audioExists =
                    typeof allAssets !== "undefined" &&
                    allAssets.audios &&
                    !!allAssets.audios["lesson4_s8"];
                  if (!audioExists) {
                    console.warn(
                      "[Lesson4] lesson4_s8 audio not found in assets"
                    );
                  }
                  if (playAudio) {
                    playAudio("lesson4_s8");
                    scene6State._lesson4_s8Played = true; // mark only after playAudio call

                    // Chain: after lesson4_s8 completes, play lesson4_s9
                    const onL4S8Complete = () => {
                      try {
                        window.removeEventListener(
                          "audioComplete-lesson4_s8",
                          onL4S8Complete
                        );
                      } catch (e) {}
                      try {
                        if (!scene6State._lesson4_s9Played) {
                          const ok =
                            typeof allAssets !== "undefined" &&
                            allAssets.audios &&
                            !!allAssets.audios["lesson4_s9"];
                          if (!ok)
                            console.warn(
                              "[Lesson4] lesson4_s9 audio not found in assets"
                            );
                          playAudio && playAudio("lesson4_s9");
                          scene6State._lesson4_s9Played = true;
                        }
                      } catch (e) {
                        console.warn("[Lesson4] Failed to play lesson4_s9", e);
                      }
                    };
                    try {
                      window.addEventListener(
                        "audioComplete-lesson4_s8",
                        onL4S8Complete
                      );
                    } catch (e) {}

                    // After lesson4_s9 completes, show Next Lesson button
                    const onL4S9Complete = () => {
                      try {
                        window.removeEventListener(
                          "audioComplete-lesson4_s9",
                          onL4S9Complete
                        );
                      } catch (e) {}
                      try {
                        if (typeof scene6State.showNextLessonButton === "function")
                          scene6State.showNextLessonButton();
                        if (typeof window.setForwardArrowEnabled === "function")
                          window.setForwardArrowEnabled(false);
                        if (window.forwardArrow)
                          window.forwardArrow.visible = false;
                      } catch (e) {
                        console.warn(
                          "[Lesson4] Failed to show Next Lesson button after s9",
                          e
                        );
                      }
                    };
                    try {
                      window.addEventListener(
                        "audioComplete-lesson4_s9",
                        onL4S9Complete
                      );
                    } catch (e) {}
                  }
                }
              } catch (e) {
                console.warn(
                  "[Lesson4] Failed to play lesson4_s8 from learning.js",
                  e
                );
              }

              // Also start Step7 to initialize motorGears
              if (typeof window.startLesson4Step7 === "function") {
                console.log(
                  "[Lesson4] Starting Step7 to initialize motorGears"
                );
                window.startLesson4Step7();
              } else {
                console.warn(
                  "[Lesson4] startLesson4Step7 function not available"
                );
              }
            }
          } else {
            const getCurrentLesson = typeof scene6State.getCurrentLesson === 'function' 
              ? scene6State.getCurrentLesson 
              : (typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson : null);
            console.log(
              "[Learning] Not lesson4, currentLessonName:",
              currentLessonName,
              "window lesson:",
              getCurrentLesson ? getCurrentLesson() : "unknown"
            );
          }
        } catch (e) {
          console.error(
            "[Lesson4] Error setting code animation completed flag:",
            e
          );
        }

        // For lesson5: play s10 and start Step10 (remote + motor control) after code animation
        try {
          const getCurrentLesson = typeof scene6State.getCurrentLesson === 'function' 
            ? scene6State.getCurrentLesson 
            : (typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson : null);
          const isLesson5 =
            currentLessonName === "lesson5" ||
            (getCurrentLesson && getCurrentLesson() === "lesson5");
          if (isLesson5) {
            // Play lesson5_s10 once
            try {
              if (!scene6State._lesson5_s10Played) {
                const exists =
                  typeof allAssets !== "undefined" &&
                  allAssets.audios &&
                  !!allAssets.audios["lesson5_s10"];
                if (!exists)
                  console.warn(
                    "[Lesson5] lesson5_s10 audio not found in assets"
                  );
                playAudio && playAudio("lesson5_s10");
                scene6State._lesson5_s10Played = true;
              }
            } catch (e) {
              console.warn("[Lesson5] Failed to play lesson5_s10", e);
            }

            if (typeof window.startLesson5Step10 === "function") {
              console.log("[Lesson5] Starting Step10 after code animation");
              window.startLesson5Step10();
            } else {
              console.warn(
                "[Lesson5] startLesson5Step10 function not available"
              );
            }

            // Chain: lesson5_s10 → lesson5_s11 → final → show Let's Build (Next Lesson)
            try {
              const onL5S10Complete = () => {
                try {
                  window.removeEventListener(
                    "audioComplete-lesson5_s10",
                    onL5S10Complete
                  );
                } catch (e) {}
                try {
                  if (!scene6State._lesson5_s11Played) {
                    const ok =
                      typeof allAssets !== "undefined" &&
                      allAssets.audios &&
                      !!allAssets.audios["lesson5_s11"];
                    if (!ok)
                      console.warn(
                        "[Lesson5] lesson5_s11 audio not found in assets"
                      );
                    playAudio && playAudio("lesson5_s11");
                    scene6State._lesson5_s11Played = true;
                  }
                } catch (e) {
                  console.warn("[Lesson5] Failed to play lesson5_s11", e);
                }
              };
              window.addEventListener(
                "audioComplete-lesson5_s10",
                onL5S10Complete
              );

              const onL5S11Complete = () => {
                try {
                  window.removeEventListener(
                    "audioComplete-lesson5_s11",
                    onL5S11Complete
                  );
                } catch (e) {}
                try {
                  if (!window._finalPlayed) {
                    const ok =
                      typeof allAssets !== "undefined" &&
                      allAssets.audios &&
                      !!allAssets.audios["final"];
                    if (!ok)
                      console.warn("[Lesson5] final audio not found in assets");
                    playAudio && playAudio("final");
                    window._finalPlayed = true;
                  }
                } catch (e) {
                  console.warn("[Lesson5] Failed to play final audio", e);
                }
              };
              window.addEventListener(
                "audioComplete-lesson5_s11",
                onL5S11Complete
              );

              const onFinalComplete = () => {
                try {
                  window.removeEventListener(
                    "audioComplete-final",
                    onFinalComplete
                  );
                } catch (e) {}
                try {
                        if (typeof scene6State.showNextLessonButton === "function")
                          scene6State.showNextLessonButton();
                  if (typeof window.setForwardArrowEnabled === "function")
                    window.setForwardArrowEnabled(false);
                  if (window.forwardArrow) window.forwardArrow.visible = false;
                } catch (e) {
                  console.warn(
                    "[Lesson5] Failed to show Next/Lets Build button after final",
                    e
                  );
                }
              };
              window.addEventListener("audioComplete-final", onFinalComplete);
            } catch (e) {
              console.warn(
                "[Lesson5] Failed to wire audio completion chain",
                e
              );
            }
          }
        } catch (e) {
          console.error(
            "[Lesson5] Error starting Step10 after code animation:",
            e
          );
        }

        // After the try-this-code text animation completes, start the RGB LED blink
        try {
          if (typeof scene6State.applyRGBLEDBlinkShader === "function") {
            scene6State.applyRGBLEDBlinkShader();
          }
          if (typeof scene6State.controlRGBLEDBlink === "function") {
            scene6State.controlRGBLEDBlink("start");
          }
        } catch (e) {}
        // Play the corresponding audio cue while the LED starts blinking
        try {
          // Get current lesson from currentLessonName or scene6State as fallback
          const lesson = currentLessonName || (typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : null);
          if (lesson === "lesson2") {
            console.log("[Lesson2] Playing buzzer audio (lesson2_s6) after code completion");
            playAudio && playAudio("lesson2_s6");
          } else if (lesson === "lesson3") {
            // Fire lesson3 sequence and also explicitly try lesson3_s8 after a small delay as a fallback
            playAudio && playAudio("lesson3_s6");
            // Fallback: ensure lesson3_s8 plays even if completion events are missed
            setTimeout(() => {
              try {
                if (
                  typeof allAssets !== "undefined" &&
                  allAssets.audios &&
                  allAssets.audios["lesson3_s8"]
                ) {
                  console.log("[Audio] Fallback triggering lesson3_s8");
                  playAudio && playAudio("lesson3_s8");
                } else {
                  console.warn(
                    "[Audio] lesson3_s8 not found in assets; check assetsEntry.js"
                  );
                }
              } catch (e) {
                console.warn("[Audio] lesson3_s8 fallback failed", e);
              }
            }, 4000);
          } else {
            playAudio && playAudio("lesson1_s6");
          }
        } catch (e) {}
        // For lesson2: after lesson2_s6 completes, play lesson2_s7, then lesson2_s8, then show Next Lesson button
        try {
          // Get current lesson from currentLessonName or scene6State as fallback
          const lesson = currentLessonName || (typeof scene6State.getCurrentLesson === 'function' ? scene6State.getCurrentLesson() : null);
          if (lesson === "lesson2") {
            const onL2S6Complete = () => {
              try {
                console.log("[Lesson2] lesson2_s6 completed - playing lesson2_s7");
                playAudio && playAudio("lesson2_s7");
              } catch (e) {
                console.warn("[Lesson2] Error playing lesson2_s7:", e);
              }
              try {
                window.removeEventListener(
                  "audioComplete-lesson2_s6",
                  onL2S6Complete
                );
              } catch (e) {}
              
              // After lesson2_s7 completes, play lesson2_s8
              try {
                const onL2S7Complete = () => {
                  try {
                    console.log("[Lesson2] lesson2_s7 completed - playing lesson2_s8");
                    playAudio && playAudio("lesson2_s8");
                  } catch (e) {
                    console.warn("[Lesson2] Error playing lesson2_s8:", e);
                  }
                  try {
                    window.removeEventListener(
                      "audioComplete-lesson2_s7",
                      onL2S7Complete
                    );
                  } catch (e) {}
                  
                  // After lesson2_s8 completes, show Next Lesson button
                  try {
                    const onL2S8Complete = () => {
                      try {
                        console.log("[Lesson2] lesson2_s8 completed - showing Next Lesson button");
                        
                        // Ensure the group that holds the Next Lesson button is visible
                        if (scene6State.codeEditorGroup) {
                          scene6State.codeEditorGroup.visible = true;
                          console.log("[Lesson2] codeEditorGroup made visible");
                        } else {
                          console.warn("[Lesson2] codeEditorGroup not found");
                        }
                        
                        // Ensure nextLessonButton is in the scene
                        const nextLessonButton = scene6State.nextLessonButton;
                        if (nextLessonButton) {
                          const currentScene = scene6State.currentScene;
                          if (currentScene && !currentScene.children.includes(nextLessonButton)) {
                            console.log("[Lesson2] Adding nextLessonButton to scene");
                            currentScene.add(nextLessonButton);
                          }
                          if (scene6State.codeEditorGroup && !scene6State.codeEditorGroup.children.includes(nextLessonButton)) {
                            console.log("[Lesson2] Adding nextLessonButton to codeEditorGroup");
                            scene6State.codeEditorGroup.add(nextLessonButton);
                          }
                        }
                        
                        // Show the Next Lesson button
                        if (typeof scene6State.showNextLessonButton === "function") {
                          console.log("[Lesson2] Calling showNextLessonButton()");
                          scene6State.showNextLessonButton();
                        } else {
                          console.warn("[Lesson2] showNextLessonButton function not found");
                          // Fallback: manually show the button
                          if (nextLessonButton) {
                            nextLessonButton.visible = true;
                            console.log("[Lesson2] Manually set nextLessonButton.visible = true");
                          }
                        }
                        
                        // Hide forward arrow
                        if (typeof window.setForwardArrowEnabled === "function") {
                          window.setForwardArrowEnabled(false);
                        }
                        if (window.forwardArrow) {
                          window.forwardArrow.visible = false;
                        }
                        
                        // Force UI update
                        try {
                          if (typeof ThreeMeshUI !== "undefined" && ThreeMeshUI.update) {
                            ThreeMeshUI.update();
                            console.log("[Lesson2] ThreeMeshUI.update() called");
                          }
                        } catch (e) {
                          console.warn("[Lesson2] Error updating ThreeMeshUI:", e);
                        }
                      } catch (e) {
                        console.error("[Lesson2] Error showing Next Lesson button:", e);
                      }
                      try {
                        window.removeEventListener(
                          "audioComplete-lesson2_s8",
                          onL2S8Complete
                        );
                      } catch (e) {}
                    };
                    window.addEventListener("audioComplete-lesson2_s8", onL2S8Complete);
                    console.log("[Lesson2] Event listener added for audioComplete-lesson2_s8");
                  } catch (e) {
                    console.error("[Lesson2] Error setting up lesson2_s8 completion handler:", e);
                  }
                };
                window.addEventListener("audioComplete-lesson2_s7", onL2S7Complete);
              } catch (e) {}
            };
            window.addEventListener("audioComplete-lesson2_s6", onL2S6Complete);
          }
        } catch (e) {}
        // Chain the next audio for lesson1 (shows Next Lesson button)
        try {
          if (
            typeof window !== "undefined" &&
            currentLessonName === "lesson1"
          ) {
            const onS6Complete = () => {
              try {
                playAudio && playAudio("lesson1_s8");
              } catch (e) {}
              try {
                window.removeEventListener(
                  "audioComplete-lesson1_s6",
                  onS6Complete
                );
              } catch (e) {}
              // After 'lesson1_s8' ends, show the Next Lesson button to move from lesson1 to lesson2
              try {
                const onS8Complete = () => {
                  try {
                        if (typeof scene6State.showNextLessonButton === "function")
                          scene6State.showNextLessonButton();
                    if (typeof window.setForwardArrowEnabled === "function")
                      window.setForwardArrowEnabled(false);
                    if (window.forwardArrow)
                      window.forwardArrow.visible = false;
                  } catch (e) {}
                  try {
                    window.removeEventListener(
                      "audioComplete-lesson1_s8",
                      onS8Complete
                    );
                  } catch (e) {}
                };
                window.addEventListener(
                  "audioComplete-lesson1_s8",
                  onS8Complete
                );
              } catch (e) {}
            };
            window.addEventListener("audioComplete-lesson1_s6", onS6Complete);
          }
        } catch (e) {}

        // For lesson3: play lesson3_s6, then lesson3_s7, then lesson3_s8, then show Start Coding button
        try {
          if (
            typeof window !== "undefined" &&
            currentLessonName === "lesson3"
          ) {
            const onL3S6Complete = () => {
              try {
                playAudio && playAudio("lesson3_s7");
              } catch (e) {}
              try {
                window.removeEventListener(
                  "audioComplete-lesson3_s6",
                  onL3S6Complete
                );
              } catch (e) {}

              // After lesson3_s7 completes, play lesson3_s8
              const onL3S7Complete = () => {
                try {
                  playAudio && playAudio("lesson3_s8");
                } catch (e) {}
                try {
                  window.removeEventListener(
                    "audioComplete-lesson3_s7",
                    onL3S7Complete
                  );
                } catch (e) {}

                // After lesson3_s8 completes, show the Start Coding button
                const onL3S8Complete = () => {
                  try {
                    // Show the Start Coding button for lesson3
                    if (runCodeButton) {
                      runCodeButton.visible = true;
                      runCodeButton.userData.clickable = true;
                      runCodeButton.traverse((child) => {
                        if (child.isMesh) child.userData.clickable = true;
                      });
                      console.log(
                        "[Lesson3] Showing Start Coding button after quiz completion"
                      );
                    }

                    // Play lesson3_s5 audio when Start Coding button appears
                    if (!scene6State._lesson3StartCodingAudioPlayed) {
                      playAudio("lesson3_s5");
                      scene6State._lesson3StartCodingAudioPlayed = true;
                    }
                  } catch (e) {
                    console.error(
                      "Error showing Start Coding button for lesson3:",
                      e
                    );
                  }
                  try {
                    window.removeEventListener(
                      "audioComplete-lesson3_s8",
                      onL3S8Complete
                    );
                  } catch (e) {}
                };
                window.addEventListener(
                  "audioComplete-lesson3_s8",
                  onL3S8Complete
                );
              };
              window.addEventListener(
                "audioComplete-lesson3_s7",
                onL3S7Complete
              );
            };
            window.addEventListener("audioComplete-lesson3_s6", onL3S6Complete);
          }
        } catch (e) {}
        // For lesson2: after lesson2_s8 completes, show Next Lesson
        try {
          if (
            typeof window !== "undefined" &&
            currentLessonName === "lesson2"
          ) {
            const onL2S8Complete = () => {
              try {
                // Ensure the group that holds the Next Lesson button is visible
                if (scene6State.codeEditorGroup)
                  scene6State.codeEditorGroup.visible = true;
                if (typeof scene6State.showNextLessonButton === "function")
                  scene6State.showNextLessonButton();
                if (typeof scene6State.setForwardArrowEnabled === "function")
                  scene6State.setForwardArrowEnabled(false);
                if (scene6State.forwardArrow) scene6State.forwardArrow.visible = false;
              } catch (e) {}
              try {
                window.removeEventListener(
                  "audioComplete-lesson2_s8",
                  onL2S8Complete
                );
              } catch (e) {}
            };
            window.addEventListener("audioComplete-lesson2_s8", onL2S8Complete);
          }
        } catch (e) {}
      }
    };
    runCodeAnimId = requestAnimationFrame(animate);
  } catch (e) {}
}

function restartQuiz() {
  showingSummary = false;
  currentQuestionIndex = 0;
  // Ensure previous attempt results are cleared on every restart
  quizResults = [];
  questionInteractionLocked = false;
  optionButtons.forEach((btn) => {
    btn.visible = true;
  });
  // reset any summary nudge
  try {
    const retry = optionButtons[0];
    if (retry && retry.position)
      retry.position.set(0, 0, retry.position.z || 0);
  } catch (e) {}
  try {
    if (questionBodyText && questionBodyText.position)
      questionBodyText.position.set(0, 0, questionBodyText.position.z || 0);
  } catch (e) {}
  try {
    if (questionsPanel && typeof questionsPanel.set === "function")
      questionsPanel.set({ padding: 0.08 });
  } catch (e) {}
  // cleanup any run code handler/animation
  try {
    if (runCodeClickHandler)
      document.removeEventListener("pointerdown", runCodeClickHandler);
    runCodeClickHandler = null;
    if (runCodeAnimId) {
      cancelAnimationFrame(runCodeAnimId);
      runCodeAnimId = null;
    }
  } catch (e) {}
  // restore parent column layout and button sizing to original
  try {
    const parentCol =
      optionButtons && optionButtons.length > 0
        ? optionButtons[0].parent
        : null;
    if (parentCol && typeof parentCol.set === "function") {
      parentCol.set({
        contentDirection: "column",
        justifyContent: "start",
        alignItems: "stretch",
        width: 1.84,
        height: 1.2,
        margin: 0.2,
      });
      if (parentCol.position)
        parentCol.position.set(0, 0, parentCol.position.z || 0);
    }
    optionButtons.forEach((btn) => {
      try {
        btn.set({
          width: 1.84,
          height: 0.09,
          justifyContent: "center",
          contentDirection: "row",
          borderRadius: 0.04,
          backgroundOpacity: 0.95,
          backgroundColor: new THREE.Color(0x2c3e50),
          alignSelf: "stretch",
          margin: 0.02,
        });
        if (btn.position) btn.position.set(0, 0, btn.position.z || 0);
        // Reset text child if present
        let txt = null;
        if (btn.children && btn.children.length > 0) {
          txt = btn.children.find((ch) => ch && ch.isText) || btn.children[0];
        }
        if (txt && txt.isText) {
          try {
            txt.set({
              width: 1.76,
              textAlign: "left",
              fontSize: 0.04,
              lineHeight: 1.2,
              color: new THREE.Color(0xecf0f1),
            });
            if (txt.position) txt.position.set(0, 0, txt.position.z || 0);
          } catch (e) {}
        }
      } catch (e) {}
    });
  } catch (e) {}
  updateQuestionsPanelContent();
  try {
    ThreeMeshUI.update();
  } catch (e) {}
}

function attachQuestionsHandler(camera) {
  questionsCamera =
    camera || scene6State.camera;
  if (!questionsCamera) {
    console.warn(
      "[Learning] attachQuestionsHandler: camera not provided and scene6State.camera not found"
    );
  }
  if (questionsClickHandler) return;

  questionsClickHandler = (event) => {
    if (!questionsPanel || !questionsPanel.visible) return;
    if (questionInteractionLocked) return;
    // Left-button only for mouse; allow touch/pen which usually have button===0
    if (
      typeof event.button === "number" &&
      event.pointerType === "mouse" &&
      event.button !== 0
    )
      return;

    const now = performance.now ? performance.now() : Date.now();
    if (now - lastQuestionPointerDownAt < 500) return; // throttle duplicate pointer events

    const cam = questionsCamera;
    if (!cam) return;

    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cam);
    const validTargets = optionButtons.filter((b) => b && b.visible);
    const intersects = raycaster.intersectObjects(validTargets, true);
    if (intersects.length > 0) {
      const object = intersects[0].object;
      const idx = optionButtons.findIndex(
        (btn) =>
          object === btn ||
          btn.children.includes(object) ||
          (object.parent && object.parent.parent === btn)
      );
      if (idx >= 0) {
        lastQuestionPointerDownAt = now;
        try {
          event.stopPropagation();
        } catch (e) {}
        try {
          event.preventDefault && event.preventDefault();
        } catch (e) {}
        onOptionSelected(idx);
      }
    }
  };

  document.addEventListener("pointerdown", questionsClickHandler);
}

function detachQuestionsHandler() {
  if (questionsClickHandler) {
    document.removeEventListener("pointerdown", questionsClickHandler);
    questionsClickHandler = null;
  }
  questionsCamera = null;
}

export function setQuestionsCamera(camera) {
  questionsCamera = camera;
}

function fireTakeQuiz() {
  try {
    document.dispatchEvent(
      new CustomEvent("learning:takeQuiz", {
        detail: { lesson: currentLessonName, index: currentLessonIndex },
      })
    );
  } catch (e) {}

  if (typeof learningQuizCallback === "function") {
    try {
      learningQuizCallback({
        lesson: currentLessonName,
        index: currentLessonIndex,
      });
    } catch (e) {}
  }

  // Start a fresh quiz for the current lesson
  startFreshQuiz();
}

function startFreshQuiz() {
  console.log(`[Quiz] Starting fresh quiz for lesson: ${currentLessonName}`);
  // Ensure the quiz matches the current lesson before showing and restore default (lesson1) look
  try {
    // Always reset quiz data for the current lesson
    // Also check scene6State.getCurrentLesson() or window.getCurrentLesson() as a fallback to ensure we have the correct lesson
    const getCurrentLesson = typeof scene6State.getCurrentLesson === 'function' 
      ? scene6State.getCurrentLesson 
      : (typeof scene6State.getCurrentLesson === "function" ? scene6State.getCurrentLesson : null);
    const actualLesson =
      currentLessonName ||
      (getCurrentLesson ? getCurrentLesson() : "lesson1");
    console.log(
      `[Quiz] Actual lesson determined: ${actualLesson} (currentLessonName: ${currentLessonName})`
    );

    // Load quiz data from allAssets.jsonFiles
    if (actualLesson === "lesson2") {
      quizData = allAssets.jsonFiles["lesson2-questions"] || null;
      console.log("[Quiz] Loaded lesson2 questions");
    } else if (actualLesson === "lesson3") {
      quizData = allAssets.jsonFiles["lesson3-questions"] || null;
      console.log("[Quiz] Loaded lesson3 questions");
    } else if (actualLesson === "lesson4") {
      quizData = allAssets.jsonFiles["lesson4-questions"] || null;
      console.log("[Quiz] Loaded lesson4 questions");
    } else if (actualLesson === "lesson5") {
      quizData = allAssets.jsonFiles["lesson5-questions"] || null;
      console.log("[Quiz] Loaded lesson5 questions");
    } else {
      quizData = allAssets.jsonFiles["lesson1-questions"] || null;
      console.log("[Quiz] Loaded lesson1 questions (default)");
    }
    // Enforce only 5 questions for both lessons even if panel already exists
    try {
      if (quizData && quizData.questions && quizData.questions.length > 5) {
        quizData = { ...quizData, questions: quizData.questions.slice(0, 5) };
      }
    } catch (e) {}

    // Reset quiz state for fresh start
    currentQuestionIndex = 0;
    quizResults = [];
    showingSummary = false;
    questionInteractionLocked = false;

    // If the questions panel already exists, reset it
    if (questionsPanel) {
      try {
        restartQuiz();
      } catch (e) {}
      // Restore question text styling to lesson1 defaults
      try {
        if (questionBodyText) {
          questionBodyText.visible = true;
          questionBodyText.set({
            content: "",
            fontSize: 0.05,
            fontFamily: fontFamily,
            fontTexture: fontTexture,
            textAlign: "left",
            color: new THREE.Color(0xffffff),
            width: 1.84,
            lineHeight: 1.3,
            margin: 0,
            padding: 0,
          });
        }
      } catch (e) {}
      updateQuestionsPanelContent();
      try {
        ThreeMeshUI.update();
      } catch (e) {}
    }
  } catch (e) {}

  // Optionally hide the learning panel when quiz starts
  uiMode = "quiz";
  try {
    hideLearningPanel();
  } catch (e) {}
  // Show the questions panel
  try {
    showQuestionsPanel();
  } catch (e) {}
}

function refreshFromState() {
  if (!currentLessonName) return;
  const cfg = getLessonConfig(currentLessonName);
  if (!cfg) return;
  const labels = cfg.labels || [];
  const contents = cfg.contents || [];
  const count = Math.min(labels.length, contents.length);
  if (count === 0) return;
  currentLessonIndex = clampIndex(currentLessonIndex, count);
  const title = labels[currentLessonIndex] || "";
  const body = contents[currentLessonIndex] || "";
  const bodySectioned = formatAsSections(body);
  const instruction = `${
    currentLessonIndex + 1
  }/${count} - Click Next to continue`;
  updateLearningPanelContent(title, bodySectioned, instruction);
  try {
    ThreeMeshUI.update();
  } catch (e) {}
  // Force UI to learning when refreshing instruction state
  uiMode = "learning";
  try {
    hideQuestionsPanel();
    // Additional safeguard: ensure questions panel is hidden when learning panel is visible
    if (learningPanel && learningPanel.visible && questionsPanel) {
      questionsPanel.visible = false;
    }
  } catch (e) {}

  // Show arrow only while there is a next label within the current lesson
  if (learningNextArrow) {
    const hasNext = currentLessonName && currentLessonIndex < count - 1;
    learningNextArrow.visible = !!hasNext;
    
    // Find the footer row to ensure quiz button is properly set up
    let footerRow = null;
    if (learningPanel && learningPanel.children) {
      // Look for the footer row by checking if it contains the next arrow
      for (let i = 0; i < learningPanel.children.length; i++) {
        const child = learningPanel.children[i];
        if (child && child.children && child.children.includes(learningNextArrow)) {
          footerRow = child;
          break;
        }
      }
    }
    
    // Ensure quiz button exists in footer row
    if (footerRow && learningQuizButton && !footerRow.children.includes(learningQuizButton)) {
      footerRow.add(learningQuizButton);
      console.log('[Learning] Added quiz button to footer row');
    }
  }

  // Show quiz button on last item - but only if we're actually on the last item
  // Don't show quiz button immediately when transitioning to a new lesson
  if (learningQuizButton) {
    const hasNext = currentLessonName && currentLessonIndex < count - 1;
    // Only show quiz button if we're actually on the last item AND it's not a fresh lesson transition
    const isLastItem = !hasNext;
    // A fresh transition is when we're at index 0 of a lesson (just started)
    const isFreshTransition = currentLessonIndex === 0;
    learningQuizButton.visible = isLastItem && !isFreshTransition;
    
    // Explicitly ensure quiz is visible on lesson2 last label (override fresh transition check for lesson2)
    try {
      const getCurrentLesson = typeof window.getCurrentLesson === 'function' 
        ? window.getCurrentLesson 
        : null;
      if (getCurrentLesson && getCurrentLesson() === 'lesson2' && isLastItem) {
        learningQuizButton.visible = true;
        console.log('[Learning] Quiz button explicitly shown for lesson2 last item');
      }
    } catch (e) {
      console.warn('[Learning] Error checking lesson2 for quiz button:', e);
    }
    
    try {
      ThreeMeshUI.update();
    } catch (e) {}
  }
}

// Public API to control lesson/step
export function setLearningLesson(lessonName) {
  currentLessonName = lessonName;
  currentLessonIndex = 0;
  refreshFromState();
}

export function nextLearningItem() {
  if (!currentLessonName) return;
  const cfg = getLessonConfig(currentLessonName);
  if (!cfg) return;
  const count = Math.min(
    (cfg.labels || []).length,
    (cfg.contents || []).length
  );
  if (count === 0) return;
  if (currentLessonIndex < count - 1) {
    currentLessonIndex += 1;
    refreshFromState();
  }
}

export function prevLearningItem() {
  if (!currentLessonName) return;
  if (currentLessonIndex > 0) {
    currentLessonIndex -= 1;
    refreshFromState();
  }
}

export function getLearningState() {
  return {
    lesson: currentLessonName,
    index: currentLessonIndex,
  };
}

// Click handling for learning arrow
export function attachLearningArrowHandler(camera) {
  learningArrowCamera =
    camera || (typeof window !== "undefined" ? window.camera : null);
  if (!learningArrowCamera) {
    console.warn(
      "[Learning] attachLearningArrowHandler: camera not provided and window.camera not found"
    );
  }
  if (learningArrowClickHandler) return; // already attached

  learningArrowClickHandler = (event) => {
    if (!learningNextArrow || !learningNextArrow.visible) return;
    const cam = learningArrowCamera;
    if (!cam) return;

    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cam);
    const targets = [learningNextArrow].filter((b) => b && b.visible);
    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      nextLearningItem();
      try {
        ThreeMeshUI.update();
      } catch (e) {}
    }
  };

  document.addEventListener("pointerdown", learningArrowClickHandler);
}

export function detachLearningArrowHandler() {
  if (learningArrowClickHandler) {
    document.removeEventListener("pointerdown", learningArrowClickHandler);
    learningArrowClickHandler = null;
  }
  learningArrowCamera = null;
}

export function setLearningArrowCamera(camera) {
  learningArrowCamera = camera;
}

// Click handling for Take Quiz button
export function attachLearningQuizHandler(camera) {
  learningQuizCamera =
    camera || (typeof window !== "undefined" ? window.camera : null);
  if (!learningQuizCamera) {
    console.warn(
      "[Learning] attachLearningQuizHandler: camera not provided and window.camera not found"
    );
  }
  if (learningQuizClickHandler) return; // already attached

  learningQuizClickHandler = (event) => {
    if (!learningQuizButton || !learningQuizButton.visible) return;
    const cam = learningQuizCamera;
    if (!cam) return;

    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cam);
    const targets = [learningQuizButton].filter((b) => b && b.visible);
    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      fireTakeQuiz();
      try {
        ThreeMeshUI.update();
      } catch (e) {}
    }
  };

  document.addEventListener("pointerdown", learningQuizClickHandler);
}

export function detachLearningQuizHandler() {
  if (learningQuizClickHandler) {
    document.removeEventListener("pointerdown", learningQuizClickHandler);
    learningQuizClickHandler = null;
  }
  learningQuizCamera = null;
}

export function setLearningQuizCamera(camera) {
  learningQuizCamera = camera;
}

export function setLearningQuizCallback(callback) {
  learningQuizCallback = typeof callback === "function" ? callback : null;
}

// Export the panel for external access
export { learningPanel };
export { questionsPanel };
