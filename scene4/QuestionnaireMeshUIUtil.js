/* backup */

import * as THREE from "three";
import ThreeMeshUI from "three-mesh-ui";

/**
 * @fileoverview Scene 4 in-world quiz UI (three-mesh-ui).
 *
 * This module implements `QuestionnaireUI`, a mesh-based quiz panel rendered in
 * the 3D scene. It supports:
 * - Loading MSDF fonts (currently fetched from unpkg CDN)
 * - Loading questions from `Questions.json` (with multiple fallbacks)
 * - Presenting multiple-choice options with hover and selection feedback
 * - Tracking correct/incorrect counts and listing components to relearn
 * - Showing a summary panel at the end with a "Proceed" or "Rewatch" option
 *
 * Interaction model (see integration in `scene4.js`):
 * - The scene owns pointer/click handling and uses the class' raycaster helpers:
 *   - `updateHoverStates(mouseNDC, camera)` each frame while the quiz is visible
 *   - `handleOptionSelect(index)` when a click selects an option
 *
 * Data contract (`Questions.json`):
 * - Top-level: `{ lessons: [{ id, title, questions: Question[] }] }`
 * - Question: `{ id, question, options: string[], answerIndex: number }`
 */

const COLORS = {
  PANEL_BG: 0x111827,
  PANEL_BORDER: 0x374151,
  OPTION_BG: 0x1f2937,
  OPTION_HOVER: 0x374151,
  CORRECT: 0x065f46,
  INCORRECT: 0x7f1d1d,
};

export class QuestionnaireUI {
  constructor(
    scene,
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0 }
  ) {
    /** @type {THREE.Scene} */
    this.scene = scene;
    /** @type {Array<any>|null} Loaded question list (after sampling). */
    this.questions = null;
    this.currentQuestionIndex = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    /** UI blocks that can be hovered/clicked on the question panel. */
    this.interactableBlocks = [];
    /** UI blocks that can be hovered/clicked on the summary panel. */
    this.interactableBlocksSummary = [];
    this.raycaster = new THREE.Raycaster();
    this.summaryPanel = null;
    this.fontLoaded = false;
    this.fontFamily = null;
    this.fontTexture = null;
    this.usedQuestionIds = [];
    /** List of component/category names where the user answered incorrectly. */
    this.incorrectComponents = [];
    this.loadFonts().then(() => {
      if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
        console.log("Fonts validated, setting up panel");
        this.setupPanel(position, rotation);
      } else {
        console.error("Font validation failed, skipping panel setup");
      }
    });
  }

  /**
   * Load the MSDF font JSON + texture.
   *
   * Current implementation fetches from unpkg (network dependency).
   * If you need offline stability, consider switching to local MSDF assets
   * like Scene 4's `meshUIPanelUtils.js` does.
   */
  async loadFonts() {
    try {
      const fontFamilyUrl =
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.json";
      const fontTextureUrl =
        "https://unpkg.com/three-mesh-ui/examples/assets/Roboto-msdf.png";
      const [fontFamilyResponse, fontTextureResponse] = await Promise.all([
        fetch(fontFamilyUrl),
        fetch(fontTextureUrl),
      ]);

      if (!fontFamilyResponse.ok) {
        throw new Error(
          `Failed to fetch font JSON: ${fontFamilyResponse.status}`
        );
      }
      if (!fontTextureResponse.ok) {
        throw new Error(
          `Failed to fetch font texture: ${fontTextureResponse.status}`
        );
      }

      const fontFamilyData = await fontFamilyResponse.json();
      if (!fontFamilyData?.info) {
        throw new Error("Invalid font JSON: missing info property");
      }

      this.fontFamily = fontFamilyData;
      this.fontTexture = fontTextureUrl;
      this.fontLoaded = true;
      console.log(
        "Fonts loaded successfully:",
        this.fontFamily.info,
        this.fontTexture
      );
    } catch (error) {
      console.error("Error loading fonts:", error);
      this.fontLoaded = false;
      this.fontFamily = null;
      this.fontTexture = null;
    }
  }

  /**
   * Create the main quiz panel (question text + options list).
   *
   * @param {{x:number,y:number,z:number}} position
   * @param {{x:number,y:number,z:number}} rotation
   */
  setupPanel(position, rotation) {
    if (!this.fontLoaded || !this.fontFamily?.info || !this.fontTexture) {
      console.warn("Fonts not properly loaded, skipping panel setup");
      return;
    }

    this.panel = new ThreeMeshUI.Block({
      width: 2.4,
      height: 1.6,
      padding: 0.08,
      borderRadius: 0.18,
      backgroundColor: new THREE.Color(COLORS.PANEL_BG),
      backgroundOpacity: 0.96,
      contentDirection: "column",
      justifyContent: "start",
      alignItems: "center",
      fontFamily: this.fontFamily,
      fontTexture: this.fontTexture,
    });

    this.panel.position.set(position.x, position.y, position.z);
    this.panel.rotation.set(rotation.x, rotation.y, rotation.z);
    this.panel.visible = true;
    console.log("Panel setup:", {
      position: this.panel.position,
      rotation: this.panel.rotation,
      visible: this.panel.visible,
    });

    this.questionText = new ThreeMeshUI.Text({
      content: "Loading question...",
      fontSize: 0.11,
      lineHeight: 1.2,
      margin: 0.05,
    });

    this.spacer = new ThreeMeshUI.Block({
      width: 1.8,
      height: 0.3,
      alignItems: "center",
      backgroundOpacity: 0,
    });

    this.optionsContainer = new ThreeMeshUI.Block({
      width: 1.8,
      height: 0.95,
      padding: 0.02,
      contentDirection: "column",
      justifyContent: "start",
      alignItems: "center",
      backgroundOpacity: 0,
    });

    this.panel.add(this.questionText, this.spacer, this.optionsContainer);
    this.scene.add(this.panel);
    ThreeMeshUI.update();
    console.log("Panel added to scene, ThreeMeshUI updated");
  }

  /**
   * Build and display the final summary panel after the quiz is completed.
   *
   * Behavior:
   * - Shows totals and optionally “Please relearn about: ...”
   * - If there were no incorrect answers → shows "Proceed"
   * - Otherwise → shows "Rewatch"
   */
  async setupSummaryPanel() {
    if (!this.fontLoaded || !this.fontFamily?.info || !this.fontTexture) {
      console.warn("Fonts invalid/missing, reloading before summary setup");
      await this.loadFonts();
      if (!this.fontLoaded || !this.fontFamily?.info || !this.fontTexture) {
        console.error("Font reload failed, skipping summary panel");
        return;
      }
    }

    if (this.summaryPanel) {
      this.disposeBlock(this.summaryPanel);
      this.scene.remove(this.summaryPanel);
      this.summaryPanel = null;
      this.interactableBlocksSummary = [];
    }

    this.summaryPanel = new ThreeMeshUI.Block({
      width: 2.4,
      height: 1.4,
      padding: 0.08,
      borderRadius: 0.18,
      backgroundColor: new THREE.Color(COLORS.PANEL_BG),
      backgroundOpacity: 0.96,
      contentDirection: "column",
      justifyContent: "start",
      alignItems: "center",
      fontFamily: this.fontFamily,
      fontTexture: this.fontTexture,
    });

    this.summaryPanel.position.copy(this.panel.position);
    this.summaryPanel.rotation.copy(this.panel.rotation);
    this.summaryPanel.visible = false;

    const summaryContainer = new ThreeMeshUI.Block({
      width: 1.8,
      height: 0.8,
      padding: 0.02,
      contentDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundOpacity: 0,
    });

    const totalQuestions = this.questions ? this.questions.length : 0;
    const summaryText = new ThreeMeshUI.Text({
      content: `Quiz Complete!\nTotal Questions: ${totalQuestions}\nCorrect: ${this.correctCount}\nIncorrect: ${this.incorrectCount}`,
      fontSize: 0.1,
      lineHeight: 1.2,
      margin: 0.05,
    });

    summaryContainer.add(summaryText);

    if (this.incorrectComponents.length > 0) {
      const relearnText = new ThreeMeshUI.Text({
        content: `\nPlease relearn about: ${
          this.incorrectComponents.length > 0
            ? this.incorrectComponents.join(", ")
            : "None"
        }`,
        fontSize: 0.08,
        lineHeight: 1.2,
        margin: 0.05,
      });
      summaryContainer.add(relearnText);
    }

    const spacer = new ThreeMeshUI.Block({
      width: 1.8,
      height: 0.1,
      backgroundOpacity: 0,
    });

    const buttonContainer = new ThreeMeshUI.Block({
      width: 1.8,
      height: 0.6,
      padding: 0.02,
      contentDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundOpacity: 0,
    });

    const submitButton = new ThreeMeshUI.Block({
      width: 0.6,
      height: 0.18,
      margin: 0.05,
      padding: 0.02,
      borderRadius: 0.09,
      backgroundColor: new THREE.Color(COLORS.OPTION_BG),
      backgroundOpacity: 0.9,
      justifyContent: "center",
    });
    submitButton.add(
      new ThreeMeshUI.Text({ content: "Proceed", fontSize: 0.065 })
    );
    submitButton.userData = { type: "submit" };

    const rewatchButton = new ThreeMeshUI.Block({
      width: 0.6,
      height: 0.18,
      margin: 0.05,
      padding: 0.02,
      borderRadius: 0.09,
      backgroundColor: new THREE.Color(COLORS.OPTION_BG),
      backgroundOpacity: 0.9,
      justifyContent: "center",
    });
    rewatchButton.add(
      new ThreeMeshUI.Text({ content: "Rewatch", fontSize: 0.065 })
    );
    rewatchButton.userData = { type: "rewatch" };

    if (this.incorrectCount === 0) {
      buttonContainer.add(submitButton);
      this.interactableBlocksSummary.push(submitButton);
    } else {
      buttonContainer.add(rewatchButton);
      this.interactableBlocksSummary.push(rewatchButton);
    }

    this.summaryPanel.add(summaryContainer, spacer, buttonContainer);
    this.scene.add(this.summaryPanel);
    ThreeMeshUI.update();
    console.log(
      "Summary panel setup, interactable blocks:",
      this.interactableBlocksSummary.length
    );
  }

 /**
  * Load questions from `Questions.json` and select one question per category.
  *
  * This implementation tries:
  * 1) module-relative URL via `import.meta.url`
  * 2) a set of path-based fallbacks
  *
  * @returns {Promise<boolean>} whether questions were successfully loaded
  */
 async loadQuestions() {
    const moduleRelativeUrl = new URL("./Questions.json", import.meta.url).href;

    let response = null;
    let questionFile = "";
    let allQuestions = null;

    // Try module-relative URL first
    try {
      console.log(
        "Trying module-relative URL for questions:",
        moduleRelativeUrl
      );
      const resp = await fetch(moduleRelativeUrl, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const txt = await resp.text();
      if (txt.trim().startsWith("<!DOCTYPE"))
        throw new Error("Received HTML instead of JSON at module-relative URL");
      const data = JSON.parse(txt);
      if (!data || !data.lessons || !Array.isArray(data.lessons[0].questions))
        throw new Error("Invalid question JSON format at module-relative URL");
      allQuestions = data.lessons[0].questions;
      questionFile = moduleRelativeUrl;
    } catch (moduleUrlError) {
      console.warn(
        "Module-relative URL load failed, trying path-based fallbacks:",
        moduleUrlError
      );
    }

    // If module-relative URL failed, try fallback paths
    if (!allQuestions) {
      console.log("Environment details:", {
        location: window.location.href,
        pathname: window.location.pathname,
        origin: window.location.origin,
        estimatedDir: window.location.pathname.replace(/\/[^\/]*$/, ""),
      });

      const possiblePaths = [
        "./Questions.json",
        "/Questions.json",
        `${window.location.origin}/Questions.json`,
        `${window.location.pathname.replace(/\/[^\/]*$/, "")}/Questions.json`,
      ];

      console.log("Will try these paths for questions:");
      possiblePaths.forEach((path, index) => {
        console.log(`  ${index + 1}. ${path}`);
      });

      for (const path of possiblePaths) {
        try {
          console.log("Trying path:", path);
          response = await fetch(path, { cache: "no-cache" });
          console.log(
            "Response status for",
            path,
            ":",
            response.status,
            response.statusText
          );
          if (response.ok) {
            questionFile = path;
            console.log("Successfully found question file at:", path);
            break;
          } else {
            console.log(
              "Path failed with status:",
              path,
              response.status,
              response.statusText
            );
          }
        } catch (e) {
          console.log("Path failed with error:", path, e);
        }
      }

      if (!response || !response.ok) {
        console.error(
          "Could not find question file. Tried paths:",
          possiblePaths.join(", ")
        );
        this.showTestQuestion();
        return false;
      }

      const text = await response.text();
      console.log(
        "Raw response from",
        questionFile,
        ":",
        text.substring(0, 200) + "..."
      );

      if (text.trim().startsWith("<!DOCTYPE")) {
        throw new Error(
          `Received HTML instead of JSON from ${questionFile}. This usually means a 404 page.`
        );
      }

      const data = JSON.parse(text);
      if (!data.lessons || !Array.isArray(data.lessons[0].questions)) {
        throw new Error(`Invalid question format in ${questionFile}`);
      }

      allQuestions = data.lessons[0].questions;
    }

    // Select one question per category
    const categories = {
      Battery: allQuestions.filter(
        (q) => q.id === "q1" || q.id === "q2" || q.id === "q3"
      ),
      LED: allQuestions.filter(
        (q) => q.id === "q4" || q.id === "q5" || q.id === "q6"
      ),
      Capacitor: allQuestions.filter(
        (q) => q.id === "q7" || q.id === "q8" || q.id === "q9"
      ),
      Motor: allQuestions.filter(
        (q) => q.id === "q10" || q.id === "q11" || q.id === "q12"
      ),
      Resistor: allQuestions.filter(
        (q) => q.id === "q13" || q.id === "q14" || q.id === "q15"
      ),
    };

    this.questions = [];
    Object.keys(categories).forEach((category) => {
      const availableQuestions = categories[category].filter(
        (q) => !this.usedQuestionIds.includes(q.id)
      );
      if (availableQuestions.length === 0) {
        this.usedQuestionIds = this.usedQuestionIds.filter(
          (id) => !categories[category].some((q) => q.id === id)
        );
        const question =
          categories[category][
            Math.floor(Math.random() * categories[category].length)
          ];
        this.questions.push(question);
        this.usedQuestionIds.push(question.id);
      } else {
        const question =
          availableQuestions[
            Math.floor(Math.random() * availableQuestions.length)
          ];
        this.questions.push(question);
        this.usedQuestionIds.push(question.id);
      }
    });

    console.log(
      "Selected questions:",
      this.questions.map((q) => ({ id: q.id, question: q.question }))
    );
    console.log("Used question IDs:", this.usedQuestionIds);

    this.correctCount = 0;
    this.incorrectCount = 0;
    this.incorrectComponents = [];
    this.currentQuestionIndex = 0;
    if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
      console.log("Questions loaded, showing first question");
      this.showQuestion(0);
    } else {
      console.warn("Fonts not loaded, skipping question display");
    }
    return true;
  }

  /**
   * Render the question at `index` into the options container.
   *
   * @param {number} index
   */
  showQuestion(index) {
    if (
      !this.questions ||
      !this.fontLoaded ||
      !this.fontFamily?.info ||
      !this.fontTexture
    ) {
      console.warn("Cannot show question: fonts or questions not loaded");
      return;
    }

    if (!this.questions[index]) {
      console.error(
        `Invalid question index: ${index}, questions length: ${this.questions.length}`
      );
      return;
    }

    this.currentQuestionIndex = index;
    const question = this.questions[index];
    console.log("Showing question:", {
      index,
      id: question.id,
      text: question.question,
      options: question.options,
    });

    this.optionsContainer.children = [];
    this.interactableBlocks = [];
    this.optionsContainer.set({
      height: 0.95,
      contentDirection: "column",
      justifyContent: "start",
      alignItems: "center",
      padding: 0.02,
    });

    this.questionText.set({ content: `${index + 1}) ${question.question}` });
    this.clearOptions();

    const optionHeight = 0.18;
    const optionMargin = 0.05;
    this.optionsContainer.set({
      height: question.options.length * (optionHeight + 2 * optionMargin),
      contentDirection: "column",
      justifyContent: "start",
      alignItems: "center",
      padding: 0.02,
    });

    const letters = ["a", "b", "c", "d"];
    question.options.forEach((opt, i) => {
      const optionBlock = this.createOptionBlock(`${letters[i]}) ${opt}`, i);
      if (optionBlock) {
        optionBlock.position.set(
          0,
          -i * (optionHeight + 2 * optionMargin),
          0.01
        );
        this.optionsContainer.add(optionBlock);
        this.interactableBlocks.push(optionBlock);
        console.log(`Added option ${i} for question ${question.id}:`, {
          content: `${letters[i]}) ${opt}`,
          position: optionBlock.position,
        });
      } else {
        console.warn(`Failed to create option block for option ${i}: ${opt}`);
      }
    });

    console.log(
      "Options container children:",
      this.optionsContainer.children.length,
      "Interactable blocks:",
      this.interactableBlocks.length
    );

    ThreeMeshUI.update();
    setTimeout(() => {
      ThreeMeshUI.update();
      console.log("ThreeMeshUI updated for question", index);
    }, 50);
    setTimeout(() => {
      ThreeMeshUI.update();
      console.log("ThreeMeshUI second update for question", index);
    }, 100);
  }

  /**
   * Create a single option block for the options list.
   *
   * @param {string} label Text shown to the user
   * @param {number} index Option index (0..n-1)
   * @returns {any|null}
   */
  createOptionBlock(label, index) {
    if (!this.fontLoaded || !this.fontFamily?.info || !this.fontTexture) {
      console.warn("Fonts not loaded, cannot create option block");
      return null;
    }

    const block = new ThreeMeshUI.Block({
      width: 1.3,
      height: 0.18,
      margin: 0.05,
      padding: 0.02,
      borderRadius: 0.09,
      backgroundColor: new THREE.Color(COLORS.OPTION_BG),
      backgroundOpacity: 0.9,
      justifyContent: "center",
      alignItems: "center",
    });

    const text = new ThreeMeshUI.Text({
      content: label,
      fontSize: 0.065,
      lineHeight: 1.2,
    });

    block.add(text);
    block.userData = { index, locked: false };
    block.traverse((child) => {
      child.userData = { index, locked: false, parentBlock: block };
    });
    console.log("Created option block:", { label, index });
    return block;
  }

  /**
   * Dispose a ThreeMeshUI block recursively.
   * Used to avoid leaking geometries/materials when rebuilding UI.
   */
  disposeBlock(block) {
    if (!block) return;
    block.traverse((child) => {
      if (child.material) {
        child.material.dispose();
      }
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.children) {
        child.children.forEach((grandchild) => this.disposeBlock(grandchild));
      }
    });
    if (block.parent) {
      block.parent.remove(block);
    }
  }

  /** Remove and dispose all option blocks from the container. */
  clearOptions() {
    console.log(
      "Clearing options, current children:",
      this.optionsContainer.children.length
    );
    while (this.optionsContainer.children.length > 0) {
      const child = this.optionsContainer.children[0];
      this.disposeBlock(child);
      this.optionsContainer.remove(child);
    }
    this.interactableBlocks = [];
    this.optionsContainer.children = [];
    console.log(
      "Options cleared, children after:",
      this.optionsContainer.children.length
    );
    ThreeMeshUI.update();
  }

  /**
   * Handle selecting an option.
   *
   * Side effects:
   * - Locks all options for the current question (prevents double-click)
   * - Colors the selected option (green/red) and highlights correct answer
   * - Updates correct/incorrect counters and component relearn list
   *
   * @param {number} optionIndex
   * @returns {boolean} Whether selection succeeded
   */
  handleOptionSelect(optionIndex) {
    const correctIndex = this.questions[this.currentQuestionIndex].answerIndex;
    const selectedBlock = this.interactableBlocks[optionIndex];
    const questionId = this.questions[this.currentQuestionIndex].id;

    if (!selectedBlock || selectedBlock.userData.locked) {
      console.warn(
        "Option select failed:",
        !selectedBlock ? "No block found" : "Block is locked",
        { optionIndex }
      );
      return false;
    }

    this.interactableBlocks.forEach((block) => {
      block.userData.locked = true;
    });

    let component;
    if (["q1", "q2", "q3"].includes(questionId)) component = "Battery";
    else if (["q4", "q5", "q6"].includes(questionId)) component = "LED";
    else if (["q7", "q8", "q9"].includes(questionId)) component = "Capacitor";
    else if (["q10", "q11", "q12"].includes(questionId)) component = "Motor";
    else if (["q13", "q14", "q15"].includes(questionId)) component = "Resistor";

    if (optionIndex === correctIndex) {
      selectedBlock.set({ backgroundColor: new THREE.Color(COLORS.CORRECT) });
      this.correctCount++;
    } else {
      selectedBlock.set({ backgroundColor: new THREE.Color(COLORS.INCORRECT) });
      this.incorrectCount++;
      this.interactableBlocks[correctIndex].set({
        backgroundColor: new THREE.Color(COLORS.CORRECT),
      });
      if (component && !this.incorrectComponents.includes(component)) {
        this.incorrectComponents.push(component);
      }
    }
    console.log("Option selected:", {
      optionIndex,
      correctIndex,
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
      incorrectComponents: this.incorrectComponents,
    });
    ThreeMeshUI.update();
    return true;
  }

  /**
   * Update hover highlight based on raycast intersection.
   *
   * @param {THREE.Vector2} mousePosition Mouse in NDC coordinates
   * @param {THREE.Camera} camera Active camera
   * @returns {number|string} hovered option index, button type, or -1
   */
  updateHoverStates(mousePosition, camera) {
    this.raycaster.setFromCamera(mousePosition, camera);
    const blocksToCheck = this.panel?.visible
      ? this.interactableBlocks
      : this.summaryPanel?.visible
      ? this.interactableBlocksSummary
      : [];
    const intersects = this.raycaster.intersectObjects(blocksToCheck, true);

    blocksToCheck.forEach((block) => {
      if (!block.userData.locked) {
        block.set({ backgroundColor: new THREE.Color(COLORS.OPTION_BG) });
      }
    });

    if (intersects.length > 0) {
      const hoveredBlock = this.findParentBlock(intersects[0].object);
      if (hoveredBlock && !hoveredBlock.userData.locked) {
        hoveredBlock.set({
          backgroundColor: new THREE.Color(COLORS.OPTION_HOVER),
        });
      }
      console.log("Hover state updated:", {
        hovered: hoveredBlock?.userData.index ?? hoveredBlock?.userData.type,
      });
      return hoveredBlock?.userData.index ?? hoveredBlock?.userData.type;
    }
    return -1;
  }

  /**
   * Walk up the object parent chain to find the top-level option block.
   * @param {THREE.Object3D} object
   */
  findParentBlock(object) {
    let current = object;
    while (
      current &&
      !this.interactableBlocks.includes(current) &&
      !this.interactableBlocksSummary.includes(current)
    ) {
      current = current.parent;
    }
    return current;
  }

  /**
   * Advance to the next question and render it.
   * @returns {boolean} false if quiz is complete
   */
  getNextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex += 1;
      console.log("Moving to next question, index:", this.currentQuestionIndex);
      this.showQuestion(this.currentQuestionIndex);
      return true;
    }
    console.log("No more questions, quiz completed");
    return false;
  }

  /**
   * Reset quiz state and re-load the question set.
   * Intended for "Rewatch" flows or retry logic.
   */
  async resetQuiz() {
    // if (!this.fontLoaded || !this.fontFamily?.info || !this.fontTexture) {
    //   await this.loadFonts();
    // }
    if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
      console.log("Resetting quiz, reloading questions");
      this.loadQuestions();
    } else {
      console.warn("Fonts not loaded, cannot reset quiz");
    }
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.currentQuestionIndex = 0;
    this.incorrectComponents = [];
  }

  hide() {
    if (this.panel) {
      this.panel.visible = false;
      ThreeMeshUI.update();
    }
  }

  show() {
    if (this.panel) {
      this.panel.visible = true;
      ThreeMeshUI.update();
    }
  }

  hideSummary() {
    if (this.summaryPanel) {
      this.summaryPanel.visible = false;
      ThreeMeshUI.update();
    }
  }

  showSummary() {
    if (this.summaryPanel) {
      this.summaryPanel.visible = true;
      ThreeMeshUI.update();
    }
  }

  cleanup() {
    // Clear options
    this.clearOptions();

    // Dispose main panel and its children
    if (this.panel) {
      this.disposeBlock(this.panel);
      this.scene.remove(this.panel);
      this.panel = null;
      this.questionText = null;
      this.spacer = null;
      this.optionsContainer = null;
    }

    // Dispose summary panel and its children
    if (this.summaryPanel) {
      this.disposeBlock(this.summaryPanel);
      this.scene.remove(this.summaryPanel);
      this.summaryPanel = null;
      this.interactableBlocksSummary = [];
    }

    // Clear state
    this.questions = null;
    this.currentQuestionIndex = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.interactableBlocks = [];
    this.usedQuestionIds = [];
    this.incorrectComponents = [];
    // this.fontFamily = null;
    // this.fontTexture = null;
    // this.fontLoaded = false;

    // Update UI
    ThreeMeshUI.update();
    console.log(
      "QuestionnaireUI cleaned up, remaining objects:",
      this.scene.children.length
    );
  }
}
