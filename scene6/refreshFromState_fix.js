/**
 * About: `scene6/refreshFromState_fix.js`
 *
 * Patch module that provides an improved `refreshFromState()` implementation for Scene 6 learning UI.
 * Primarily focuses on correct "Take Quiz" button visibility/behavior across lessons.
 */

"use strict"; // Enforce strict mode for safer JavaScript

// Patch module for learning panel: replaces the original refreshFromState logic
// to ensure the "Take Quiz" button appears only at the correct time, especially in lesson2.
import { scene6State } from "./scene6State.js";

/**
 * Refreshes the learning panel UI based on the current lesson state.
 * - Updates the title and body content for the active learning item.
 * - Controls visibility of the "Next" arrow.
 * - Ensures the quiz button is created and shown at the correct time.
 *
 * This function relies on globally-available lesson helpers such as:
 * - currentLessonName, currentLessonIndex
 * - getLessonConfig, clampIndex, formatAsSections
 * - updateLearningPanelContent, learningPanel, learningNextArrow, learningQuizButton
 * - ThreeMeshUI
 */
function refreshFromState() {
  // If we don't know which lesson is active, nothing to refresh.
  if (!currentLessonName) return;

  // Read the configuration for the current lesson (labels + contents).
  const cfg = getLessonConfig(currentLessonName);
  if (!cfg) return;

  const labels = cfg.labels || [];
  const contents = cfg.contents || [];
  const count = Math.min(labels.length, contents.length);
  if (count === 0) return;

  // Clamp the current index into the valid range [0, count-1].
  currentLessonIndex = clampIndex(currentLessonIndex, count);

  // Resolve the current title/body; fall back to empty strings if missing.
  const title = labels[currentLessonIndex] || "";
  const body = contents[currentLessonIndex] || "";

  // Convert the raw body text into UI sections (e.g., paragraphs, bullets).
  const bodySectioned = formatAsSections(body);

  // For now, instruction index is always 0 (single instruction per learning item).
  const instruction = 0;

  // Push the content into the 3D learning panel UI.
  updateLearningPanelContent(title, bodySectioned, instruction);

  // Safely request a ThreeMeshUI layout update (ignore if ThreeMeshUI is not ready).
  try {
    ThreeMeshUI.update();
  } catch (e) {}

  // Show the "Next" arrow only if there is another label within the current lesson.
  if (learningNextArrow) {
    const hasNext = currentLessonName && currentLessonIndex < (count - 1);
    learningNextArrow.visible = !!hasNext;

    // Find the footer row more reliably by searching for the row that owns the arrow.
    let footerRow = null;
    if (learningPanel && learningPanel.children) {
      // Look for the footer row by checking if it contains the next arrow.
      for (let i = 0; i < learningPanel.children.length; i++) {
        const child = learningPanel.children[i];
        if (child && child.children && child.children.includes(learningNextArrow)) {
          footerRow = child;
          break;
        }
      }
    }

    // Ensure the quiz button exists in the footer row and is wired correctly.
    if (footerRow) {
      ensureQuizButton(footerRow);
    }

    if (learningQuizButton) {
      // Default behavior: show quiz button only on the last item of any lesson.
      const atLast = !hasNext;
      learningQuizButton.visible = atLast;

      // Explicitly ensure quiz is visible on lesson2 last label as well (defensive check).
      try {
        const getCurrentLesson =
          typeof scene6State.getCurrentLesson === "function"
            ? scene6State.getCurrentLesson
            : typeof window.getCurrentLesson === "function"
            ? window.getCurrentLesson
            : null;

        if (getCurrentLesson && getCurrentLesson() === "lesson2" && atLast) {
          learningQuizButton.visible = true;
        }
      } catch (e) {}

      // After toggling visibility, request another UI layout update.
      try {
        ThreeMeshUI.update();
      } catch (e) {}
    }
  }
}

// Expose the function so other modules can import/use this improved implementation.
export { refreshFromState };

