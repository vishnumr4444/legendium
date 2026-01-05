/**
 * About: `scene6/Questionnaire.js`
 *
 * Alternative 3D questionnaire/quiz UI for Scene 6 built with ThreeMeshUI.
 * Loads lesson question JSON, renders multiple-choice panels, and tracks results.
 */

// 3D questionnaire / quiz UI for Scene 6.
// Renders multiple-choice questions using ThreeMeshUI and integrates with lesson progress.
import * as THREE from "three";
import ThreeMeshUI from "three-mesh-ui";
import ConsolasFontJSON from "../fonts/CONSOLAS-msdf.json";
import ConsolasFontImage from "../fonts/CONSOLAS.png";
import { scene6State } from "./scene6State.js";

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
    rotation = { x: 0, y: 0, z: 0 },
    camera = null
  ) {
    this.scene = scene;
    this.camera = camera;
    this.questions = null;
    this.currentQuestionIndex = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.interactableBlocks = [];
    this.interactableBlocksSummary = [];
    this.raycaster = new THREE.Raycaster();
    this.summaryPanel = null;
    this.fontLoaded = false;
    this.fontFamily = null;
    this.fontTexture = null;
    this.usedQuestionIds = [];
    this.incorrectComponents = [];
    
    // Load fonts synchronously since they're imported
    this.loadFonts();
    
    if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
      console.log("Fonts validated, setting up panel");
      this.setupPanel(position, rotation);
    } else {
      console.error("Font validation failed, skipping panel setup");
    }
  }

  loadFonts() {
    try {
      // Use the imported Consolas fonts directly
      this.fontFamily = ConsolasFontJSON;
      this.fontTexture = ConsolasFontImage;
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

  setupPanel(position, rotation) {
    if (!this.fontLoaded || !this.fontFamily?.info || !this.fontTexture) {
      console.warn("Fonts not properly loaded, skipping panel setup");
      return;
    }

    this.panel = new ThreeMeshUI.Block({
      width: 2.1,
      height: 1.6,
      padding: 0.06,
      borderRadius: 0.12,
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
    this.panel.visible = false; // Start hidden, will be shown when Take Quiz is clicked
    console.log("Panel setup:", {
      position: this.panel.position ,
      rotation: this.panel.rotation,
      visible: this.panel.visible,
    });

    this.questionText = new ThreeMeshUI.Text({
      content: "Loading question...",
      fontSize: 0.09,
      lineHeight: 1.2,
      margin: 0.04,
    });

    this.spacer = new ThreeMeshUI.Block({
      width: 1.4,
      height: 0.3, // Reduce from 0.4 to 0.2 for less spacing
      alignItems: "center",
      backgroundOpacity: 0,
    });

    this.optionsContainer = new ThreeMeshUI.Block({
      width: 1.4,
      height: 0.7,
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
    
    // Set up click handling for the questionnaire
    this.setupClickHandling();
    
    // Load questions after panel is set up
    this.loadQuestions();
  }

  setupClickHandling() {
    // Add click event listener to the document
    this.clickHandler = (event) => {
      if (!this.panel || !this.panel.visible) return;
      
      console.log('Click detected on questionnaire panel');
      
      // Convert mouse coordinates to normalized device coordinates
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      console.log('Mouse coordinates:', mouse);
      console.log('Interactable blocks:', this.interactableBlocks);
      
      // Use the raycaster to find intersected objects
      if (!this.camera) {
        console.warn('Camera not available for questionnaire click handling');
        return;
      }
      this.raycaster.setFromCamera(mouse, this.camera);
      
      // Check for intersections with option blocks
      const intersects = this.raycaster.intersectObjects(this.interactableBlocks, true);
      console.log('Raycaster intersects:', intersects);
      
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        console.log('Clicked object:', clickedObject);
        
        // Find the option block (might be a child of the clicked object)
        let optionBlock = clickedObject;
        while (optionBlock && optionBlock.userData?.type !== 'option') {
          optionBlock = optionBlock.parent;
        }
        
        if (optionBlock && optionBlock.userData?.clickable) {
          console.log('Option clicked:', optionBlock.userData);
          this.handleOptionClick(optionBlock);
        } else {
          console.log('Option block not clickable or not found');
        }
      } else {
        console.log('No intersects found with option blocks');
      }
    };
    
    // Add the event listener
    document.addEventListener('pointerdown', this.clickHandler);
    console.log('Click handling set up for questionnaire');
  }

  setupSummaryClickHandling() {
    // Add click event listener for summary buttons
    this.summaryClickHandler = (event) => {
      if (!this.summaryPanel || !this.summaryPanel.visible) return;
      
      console.log('Click detected on summary panel');
      
      // Convert mouse coordinates to normalized device coordinates
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      console.log('Mouse coordinates:', mouse);
      console.log('Summary interactable blocks:', this.interactableBlocksSummary);
      
      // Use the raycaster to find intersected objects
      if (!this.camera) {
        console.warn('Camera not available for summary click handling');
        return;
      }
      this.raycaster.setFromCamera(mouse, this.camera);
      
      // Check for intersections with summary buttons
      const intersects = this.raycaster.intersectObjects(this.interactableBlocksSummary, true);
      console.log('Summary raycaster intersects:', intersects);
      
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        console.log('Summary clicked object:', clickedObject);
        
        // Find the button (might be a child of the clicked object)
        let button = clickedObject;
        while (button && button.userData?.type === undefined) {
          button = button.parent;
        }
        
        if (button && button.userData?.clickable && button.userData?.type) {
          console.log('Summary button clicked:', button.userData);
          this.handleSummaryClick(button);
        } else {
          console.log('Summary button not clickable or type not found');
        }
      } else {
        console.log('No intersects found with summary buttons');
      }
    };
    
    // Add the event listener
    document.addEventListener('pointerdown', this.summaryClickHandler);
    console.log('Summary click handling set up for questionnaire');
  }

  async loadQuestions() {
    // Helper to get current lesson from scene6State or window (fallback)
    const getCurrentLesson = () => {
      if (typeof scene6State.getCurrentLesson === 'function') return scene6State.getCurrentLesson();
      if (typeof window.getCurrentLesson === 'function') return window.getCurrentLesson();
      return 'lesson1';
    };
    
    // Get current lesson from scene6State or window, default to lesson1
    let currentLesson = getCurrentLesson();
    
    // If getCurrentLesson is not available, wait a bit and try again
    if (typeof scene6State.getCurrentLesson !== 'function' && typeof window.getCurrentLesson !== 'function') {
      console.log('getCurrentLesson not available, waiting 500ms and retrying...');
      await new Promise(resolve => setTimeout(resolve, 500));
      currentLesson = getCurrentLesson();
    }
    
    console.log('Loading questions for lesson:', currentLesson);
    console.log('scene6State.getCurrentLesson function exists:', typeof scene6State.getCurrentLesson === 'function');
    console.log('window.getCurrentLesson function exists:', typeof window.getCurrentLesson === 'function');
    console.log('getCurrentLesson result:', getCurrentLesson());

    // Prefer module-relative asset URLs so bundlers include the JSON in production builds
    const moduleRelativeUrlMap = {
      lesson1: new URL('./lesson1-questions.json', import.meta.url).href,
      lesson2: new URL('./lesson2-questions.json', import.meta.url).href,
      lesson3: new URL('./lesson3-questions.json', import.meta.url).href,
      lesson4: new URL('./lesson4-questions.json', import.meta.url).href,
      lesson5: new URL('./lesson5-questions.json', import.meta.url).href,
    };

    // First attempt: try module-relative URL if available for the current lesson
    try {
      const prewiredUrl = moduleRelativeUrlMap[currentLesson];
      if (prewiredUrl) {
        console.log('Trying module-relative URL for questions:', prewiredUrl);
        const resp = await fetch(prewiredUrl, { cache: 'no-cache' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const txt = await resp.text();
        if (txt.trim().startsWith('<!DOCTYPE')) throw new Error('Received HTML instead of JSON at module-relative URL');
        const data = JSON.parse(txt);
        if (!data || !Array.isArray(data.questions)) throw new Error('Invalid question JSON format at module-relative URL');
        this.questions = [...data.questions];
        this.correctCount = 0;
        this.incorrectCount = 0;
        this.incorrectComponents = [];
        this.currentQuestionIndex = 0;
        if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
          this.showQuestion(0);
        }
        return true;
      }
    } catch (moduleUrlError) {
      console.warn('Module-relative URL load failed, will try path-based fallbacks:', moduleUrlError);
    }
    
          // Debug: Log current location and available paths
      console.log('Current window.location:', window.location.href);
      console.log('Current window.location.pathname:', window.location.pathname);
      console.log('Current window.location.origin:', window.location.origin);
      console.log('Current directory (estimated):', window.location.pathname.replace(/\/[^\/]*$/, ''));
      
      // Log all the paths we'll try
      console.log('Will try these paths for lesson questions:');
      [
        `./${currentLesson}-questions.json`,
        `../scene6/${currentLesson}-questions.json`,
        `./scene6/${currentLesson}-questions.json`,
        `/${currentLesson}-questions.json`,
        `${currentLesson}-questions.json`,
        `scene6/${currentLesson}-questions.json`,
        `../../scene6/${currentLesson}-questions.json`,
        `../${currentLesson}-questions.json`,
        `${window.location.origin}/scene6/${currentLesson}-questions.json`,
        `${window.location.origin}/${currentLesson}-questions.json`,
        `${window.location.pathname.replace(/\/[^\/]*$/, '')}/${currentLesson}-questions.json`,
        `${window.location.pathname.replace(/\/[^\/]*$/, '')}/scene6/${currentLesson}-questions.json`
      ].forEach((path, index) => {
        console.log(`  ${index + 1}. ${path}`);
      });
    
    try {
      // Test if we can access the scene6 directory and various paths
      console.log('Testing directory access...');
      const testPaths = ['./scene6/', './', '../scene6/', '../../scene6/'];
      for (const testPath of testPaths) {
        try {
          const testResponse = await fetch(testPath);
          console.log(`Directory test ${testPath}:`, testResponse.status, testResponse.statusText);
        } catch (testError) {
          console.log(`Directory test ${testPath} failed:`, testError);
        }
      }
      
      // Load lesson-specific questions file
      // Since the lesson question files are in the same directory as this Questionnaire.js file,
      // we need to determine the correct path based on where this script is being loaded from
      
      // First, try to get the script's location
      let scriptPath = '';
      try {
        // Try to find the current script element
        const scripts = document.querySelectorAll('script[src*="Questionnaire.js"]');
        if (scripts.length > 0) {
          const scriptSrc = scripts[scripts.length - 1].src;
          scriptPath = scriptSrc.replace(/\/[^\/]*$/, '/'); // Get directory path
          console.log('Found script path:', scriptPath);
        }
      } catch (e) {
        console.log('Could not determine script path:', e);
      }
      
      // Build possible paths
      const possiblePaths = [];
      
      // Try with script path if available
      if (scriptPath) {
        possiblePaths.push(`${scriptPath}${currentLesson}-questions.json`);
      }
      
      // Add all other paths in order of likelihood to work
      possiblePaths.push(
        // Try scene6 subdirectory paths first (most likely to work)
        `scene6/${currentLesson}-questions.json`,
        `./scene6/${currentLesson}-questions.json`,
        // Try with origin (absolute paths)
        `${window.location.origin}/scene6/${currentLesson}-questions.json`,
        // Try with the current pathname as base
        `${window.location.pathname.replace(/\/[^\/]*$/, '')}/scene6/${currentLesson}-questions.json`,
        // Try parent directory paths
        `../scene6/${currentLesson}-questions.json`,
        `../../scene6/${currentLesson}-questions.json`,
        // Try relative to current location (less likely to work)
        `./${currentLesson}-questions.json`,
        `${currentLesson}-questions.json`,
        `../${currentLesson}-questions.json`,
        // Try absolute paths
        `/${currentLesson}-questions.json`,
        `${window.location.pathname.replace(/\/[^\/]*$/, '')}/${currentLesson}-questions.json`,
        `${window.location.origin}/${currentLesson}-questions.json`
      );
      
      let response = null;
      let questionFile = '';
      
      for (const path of possiblePaths) {
        try {
          console.log('Trying path:', path);
          response = await fetch(path);
          console.log('Response status for', path, ':', response.status, response.statusText);
          if (response.ok) {
            questionFile = path;
            console.log('Successfully found question file at:', path);
            break;
          } else {
            console.log('Path failed with status:', path, response.status, response.statusText);
          }
        } catch (e) {
          console.log('Path failed with error:', path, e);
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(`Could not find question file. Tried paths: ${possiblePaths.join(', ')}`);
      }
      
      const text = await response.text();
      console.log("Raw response from", questionFile, ":", text.substring(0, 200) + "...");
      
      // Check if the response is actually JSON
      if (text.trim().startsWith('<!DOCTYPE')) {
        throw new Error(`Received HTML instead of JSON from ${questionFile}. This usually means a 404 page.`);
      }
      
      const data = JSON.parse(text);
      
      // Validate the data structure
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error(`Invalid question format in ${questionFile}`);
      }
      
      // Use all 5 questions from the lesson-specific file
      this.questions = [...data.questions];
      
      console.log(
        "Loaded questions for", currentLesson, ":",
        this.questions.map((q) => ({ id: q.id, question: q.question }))
      );

      this.correctCount = 0;
      this.incorrectCount = 0;
      this.incorrectComponents = [];
      this.currentQuestionIndex = 0;
      
      if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
        console.log("Questions loaded, showing first question");
        console.log("Questions array:", this.questions);
        this.showQuestion(0);
      } else {
        console.warn("Fonts not loaded, skipping question display");
        console.log("Font status:", {
          fontLoaded: this.fontLoaded,
          fontFamily: this.fontFamily,
          fontTexture: this.fontTexture
        });
      }
      return true;
    } catch (error) {
      console.error("Error loading questions:", error);
      console.error("Failed to load lesson-specific questions for:", currentLesson);
      
      // Only fallback if we absolutely can't load any questions
      // Try one more time with a different approach
      try {
        console.log("Attempting alternative path resolution...");
        const alternativePath = `scene6/${currentLesson}-questions.json`;
        console.log('Trying alternative path:', alternativePath);
        
        const alternativeResponse = await fetch(alternativePath);
        if (alternativeResponse.ok) {
          const alternativeText = await alternativeResponse.text();
          if (alternativeText.trim().startsWith('<!DOCTYPE')) throw new Error('Received HTML instead of JSON at alternative path');
          const alternativeData = JSON.parse(alternativeText);
          
          if (alternativeData.questions && Array.isArray(alternativeData.questions)) {
            this.questions = [...alternativeData.questions];
            console.log("Alternative path succeeded, loaded questions for", currentLesson);
            
            this.correctCount = 0;
            this.incorrectCount = 0;
            this.incorrectComponents = [];
            this.currentQuestionIndex = 0;
            
            if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
              this.showQuestion(0);
            }
            return true;
          }
        }
      } catch (alternativeError) {
        console.error("Alternative path also failed:", alternativeError);
      }
      
      // Last resort fallback: try to load the original questions file
      try {
        console.log("Attempting to load fallback questions as last resort...");
        const fallbackResponse = await fetch("/scene4/Utils/Questions.json");
        if (fallbackResponse.ok) {
          const fallbackText = await fallbackResponse.text();
          if (fallbackText.trim().startsWith('<!DOCTYPE')) throw new Error('Received HTML instead of JSON at fallback path');
          const fallbackData = JSON.parse(fallbackText);
          const lessons = fallbackData && Array.isArray(fallbackData.lessons) ? fallbackData.lessons : [];
          const firstLesson = lessons.length > 0 ? lessons[0] : null;
          const fallbackQuestions = firstLesson && Array.isArray(firstLesson.questions) ? firstLesson.questions.slice(0, 5) : [];
          if (fallbackQuestions.length === 0) throw new Error('Fallback questions are empty or invalid');
          this.questions = fallbackQuestions;
          console.log("Fallback questions loaded successfully as last resort");
          
          this.correctCount = 0;
          this.incorrectCount = 0;
          this.incorrectComponents = [];
          this.currentQuestionIndex = 0;
          
          if (this.fontLoaded && this.fontFamily?.info && this.fontTexture) {
            this.showQuestion(0);
          }
          return true;
        }
      } catch (fallbackError) {
        console.error("Fallback questions also failed:", fallbackError);
      }
      
      console.error("All question loading attempts failed. Cannot proceed with quiz.");
      return false;
    }
  }

  showQuestion(index) {
    console.log("showQuestion called with index:", index);
    console.log("Current state:", {
      questions: this.questions,
      fontLoaded: this.fontLoaded,
      fontFamily: this.fontFamily,
      fontTexture: this.fontTexture
    });
    
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

    // Reset options container
    this.optionsContainer.children = [];
    this.interactableBlocks = [];
    this.optionsContainer.set({
      height: 0.95,
      contentDirection: "column",
      justifyContent: "start",
      alignItems: "center",
      padding: 0.02,
      margin: 0.03, // Reduce from 0.05 to 0.02 for less top margin
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
      margin: 0.03, // Reduce from 0.05 to 0.02 for less top margin
    });

    question.options.forEach((option, optionIndex) => {
      const optionBlock = new ThreeMeshUI.Block({
        width: 1.6,
        height: optionHeight,
        margin: optionMargin,
        padding: 0.02,
        borderRadius: 0.09,
        backgroundColor: new THREE.Color(COLORS.OPTION_BG),
        backgroundOpacity: 0.9,
        justifyContent: "center",
        alignItems: "center",
      });

      const optionText = new ThreeMeshUI.Text({
        content: option,
        fontSize: 0.07,
        lineHeight: 1.2,
        margin: 0.02,
      });

      optionBlock.add(optionText);
      optionBlock.userData = {
        type: "option",
        optionIndex: optionIndex,
        questionIndex: index,
        isCorrect: optionIndex === question.answerIndex,
        clickable: true, // Make it clickable
      };
      
      console.log(`Option ${optionIndex}: isCorrect = ${optionIndex === question.answerIndex}, answerIndex = ${question.answerIndex}`);

      this.interactableBlocks.push(optionBlock);
      this.optionsContainer.add(optionBlock);
    });

    ThreeMeshUI.update();
  }

  clearOptions() {
    if (this.optionsContainer) {
      this.optionsContainer.children = [];
      this.interactableBlocks = [];
    }
  }

  handleOptionClick(optionBlock) {
    if (!optionBlock.userData) return;

    const { optionIndex, questionIndex, isCorrect } = optionBlock.userData;
    const question = this.questions[questionIndex];

    if (!question) return;

    // Disable all options after selection
    this.interactableBlocks.forEach((block) => {
      block.userData.clickable = false;
      if (block.material) {
        block.material.opacity = 0.5;
      }
    });

    // Show correct/incorrect feedback
    if (isCorrect) {
      optionBlock.set({
        backgroundColor: new THREE.Color(COLORS.CORRECT),
        backgroundOpacity: 0.9,
      });
      this.correctCount++;
      console.log("Correct answer! Correct count:", this.correctCount);
    } else {
      optionBlock.set({
        backgroundColor: new THREE.Color(COLORS.INCORRECT),
        backgroundOpacity: 0.9,
      });
      this.incorrectCount++;
      this.incorrectComponents.push(question.id);
      console.log("Incorrect answer. Correct was:", question.options[question.answerIndex]);
      console.log("Incorrect count:", this.incorrectCount);
    }
    
    console.log("Current score - Correct:", this.correctCount, "Incorrect:", this.incorrectCount);

    // Move to next question after delay
    setTimeout(() => {
      this.nextQuestion();
    }, 2000);

    ThreeMeshUI.update();
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.showQuestion(this.currentQuestionIndex + 1);
    } else {
      this.showSummary();
    }
  }

  showSummary() {
    console.log("=== QUIZ SUMMARY ===");
    console.log("Total questions:", this.questions ? this.questions.length : 0);
    console.log("Correct count:", this.correctCount);
    console.log("Incorrect count:", this.incorrectCount);
    console.log("Questions array:", this.questions);
    
    try {
      this.setupSummaryPanel();
      this.panel.visible = false;
      this.summaryPanel.visible = true;
      
      // Check if all questions were answered correctly
      if (this.correctCount === this.questions.length && this.incorrectCount === 0) {
        console.log("All questions correct! Showing Try This button");
        this.showTryThisButton();
      } else {
        console.log("Not all questions correct. Try This button will remain hidden");
        console.log("Expected:", this.questions.length, "correct, got:", this.correctCount);
      }
      
      ThreeMeshUI.update();
    } catch (error) {
      console.error("Error setting up summary panel:", error);
      // Fallback: just show the basic summary without the fancy panel
      this.showBasicSummary();
    }
  }

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
      width: 1.8,
      height: 1.0,
      padding: 0.06,
      borderRadius: 0.12,
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
      width: 1.6,
      height: 1.0,
      padding: 0.02,
      contentDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundOpacity: 0,
    });

    const totalQuestions = this.questions ? this.questions.length : 0;
    const isPerfect = this.correctCount === totalQuestions && this.incorrectCount === 0;
    
    const summaryText = new ThreeMeshUI.Text({
      content: `Quiz Complete!\nTotal Questions: ${totalQuestions}\nCorrect: ${this.correctCount}\nIncorrect: ${this.incorrectCount}\n\n${isPerfect ? 'Perfect Score! Try This button unlocked!' : 'Keep practicing to unlock the Try This button!'}`,
      fontSize: 0.08,
      lineHeight: 1.2,
      margin: 0.04,
    });

    // Only show relearn text when not perfect and there are incorrect components
    const showRelearn = !isPerfect && (this.incorrectComponents?.length > 0);
    if (showRelearn) {
      const relearnText = new ThreeMeshUI.Text({
        content: `\nPlease relearn about: ${
          this.incorrectComponents.length > 0
            ? this.incorrectComponents.join(", ")
            : "None"
        }`,
        fontSize: 0.07,
        lineHeight: 1.2,
        margin: 0.04,
      });
      summaryContainer.add(summaryText, relearnText);
    } else {
      summaryContainer.add(summaryText);
    }

    const spacer = new ThreeMeshUI.Block({
      width: 1.4,
      height: 0.15,
      backgroundOpacity: 0,
    });

    const buttonContainer = new ThreeMeshUI.Block({
      width: 1.4,
      height: 0.45,
      padding: 0.02,
      contentDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundOpacity: 0,
    });

    // Only show "Show Lesson" button when score is not perfect
    if (!isPerfect) {
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
        new ThreeMeshUI.Text({ content: "Show Lesson", fontSize: 0.065 })
      );
      rewatchButton.userData = { type: "rewatch" };
      // Note: This button now shows lesson content instead of restarting quiz

      buttonContainer.add(rewatchButton);

      // Add click handlers for summary buttons
      [rewatchButton].forEach((button) => {
        button.userData.clickable = true;
        this.interactableBlocksSummary.push(button);
      });
    }

    this.summaryPanel.add(summaryContainer, spacer, buttonContainer);
    this.scene.add(this.summaryPanel);

    // Set up click handling for summary buttons
    this.setupSummaryClickHandling();

    ThreeMeshUI.update();
    console.log("Summary panel setup completed");
  }

  handleSummaryClick(button) {
    if (!button.userData) return;

    const { type } = button.userData;
    if (type === "rewatch") {
      console.log("Rewatch clicked - showing lesson content again");
      // Show lesson content and labels again
      this.showLessonContent();
    }
  }

  hideQuestionnaire() {
    if (this.panel) this.panel.visible = false;
    if (this.summaryPanel) this.summaryPanel.visible = false;
    ThreeMeshUI.update();
  }

  showLessonContent() {
    console.log("Showing lesson content again");
    
    // Hide questionnaire panels
    if (this.panel) this.panel.visible = false;
    if (this.summaryPanel) this.summaryPanel.visible = false;
    
    console.log("Questionnaire panels hidden");
    console.log("Available global functions:", {
      resetCodeEditorView: typeof window.resetCodeEditorView,
      setCodeEditorLesson: typeof window.setCodeEditorLesson,
      getCurrentLesson: typeof scene6State.getCurrentLesson === 'function' ? 'scene6State' : (typeof window.getCurrentLesson === 'function' ? 'window' : 'none')
    });
    
    // Try to call the global function to show lesson content and labels
    if (typeof window.resetCodeEditorView === 'function') {
      console.log("Calling resetCodeEditorView...");
      try {
        window.resetCodeEditorView();
        console.log("Lesson content restored via resetCodeEditorView");
      } catch (error) {
        console.error("Error calling resetCodeEditorView:", error);
      }
    } else {
      console.warn("resetCodeEditorView function not found, trying alternative approach");
      // Try alternative approach - look for code editor elements and make them visible
      this.tryAlternativeLessonRestore();
    }
    
    // Also ensure lesson-specific content is loaded
    if (typeof window.setCodeEditorLesson === 'function') {
      // Helper to get current lesson from scene6State or window (fallback)
      const getCurrentLesson = () => {
        if (typeof scene6State.getCurrentLesson === 'function') return scene6State.getCurrentLesson();
        if (typeof window.getCurrentLesson === 'function') return window.getCurrentLesson();
        return 'lesson1';
      };
      const currentLesson = getCurrentLesson();
      console.log("Calling setCodeEditorLesson for:", currentLesson);
      try {
        window.setCodeEditorLesson(currentLesson);
        console.log("Lesson content refreshed for:", currentLesson);
      } catch (error) {
        console.error("Error calling setCodeEditorLesson:", error);
      }
    } else {
      console.warn("setCodeEditorLesson function not found");
    }
    
    // Hide the Try This button when returning to lesson content
    if (typeof window.hideTryThisButton === 'function') {
      try {
        window.hideTryThisButton();
        console.log('Try This button hidden when returning to lesson content');
      } catch (error) {
        console.error("Error hiding Try This button:", error);
      }
    }
    
    ThreeMeshUI.update();
    console.log("showLessonContent completed");
  }

  showTryThisButton() {
    console.log("Attempting to show Try This button...");
    
    // Try to call the global function to show the Try This button
    if (typeof window.showTryThisButton === 'function') {
      try {
        window.showTryThisButton();
        console.log("Try This button shown via global function");
      } catch (error) {
        console.error("Error calling showTryThisButton:", error);
      }
    } else {
      console.warn("showTryThisButton function not found");
      // Try alternative approach - look for the button and make it visible
      this.tryAlternativeTryThisButtonShow();
    }
  }

  showBasicSummary() {
    console.log("Using basic summary fallback");
    
    // Hide the quiz panel
    if (this.panel) this.panel.visible = false;
    
    // Check if all questions were answered correctly
    if (this.correctCount === this.questions.length && this.incorrectCount === 0) {
      console.log("All questions correct! Showing Try This button");
      this.showTryThisButton();
    } else {
      console.log("Not all questions correct. Try This button will remain hidden");
    }
    
    // Show a simple alert instead of the complex panel
    const message = `Quiz Complete!\n\nTotal Questions: ${this.questions ? this.questions.length : 0}\nCorrect: ${this.correctCount}\nIncorrect: ${this.incorrectCount}\n\n${this.correctCount === (this.questions ? this.questions.length : 0) ? 'Perfect Score! Try This button unlocked!' : 'Keep practicing to unlock the Try This button!'}`;
    
    alert(message);
  }

  tryAlternativeLessonRestore() {
    console.log("Trying alternative lesson restore approach...");
    
    // Try to find and show code editor elements directly
    try {
      // Look for common code editor elements that might be hidden
      const codeEditorElements = document.querySelectorAll('[data-code-editor]');
      if (codeEditorElements.length > 0) {
        codeEditorElements.forEach(el => el.style.display = 'block');
        console.log("Found and showed code editor elements");
      }
      
      // Try to find elements by class names that might be related to lesson content
      const lessonElements = document.querySelectorAll('.lesson-content, .code-editor, .pin-definitions');
      if (lessonElements.length > 0) {
        lessonElements.forEach(el => el.style.display = 'block');
        console.log("Found and showed lesson content elements");
      }
      
      // Try to call any available show functions
      if (typeof window.showCodeEditorPanels === 'function') {
        window.showCodeEditorPanels();
        console.log("Called showCodeEditorPanels");
      }
      
    } catch (error) {
      console.error("Alternative lesson restore failed:", error);
    }
  }

  tryAlternativeTryThisButtonShow() {
    console.log("Trying alternative Try This button show approach...");
    
    try {
      // Try to find and show the Try This button directly
      // Look for elements that might be the Try This button
      const tryThisElements = document.querySelectorAll('[data-try-this], .try-this-button, button[data-type="try-this"]');
      if (tryThisElements.length > 0) {
        tryThisElements.forEach(el => {
          el.style.display = 'block';
          el.visible = true;
        });
        console.log("Found and showed Try This button elements");
      }
      
      // Try to call any available show functions
      if (typeof window.showCodeEditorPanels === 'function') {
        window.showCodeEditorPanels();
        console.log("Called showCodeEditorPanels to show Try This button");
      }
      
    } catch (error) {
      console.error("Alternative Try This button show failed:", error);
    }
  }

  restartQuiz() {
    this.currentQuestionIndex = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.incorrectComponents = [];
    this.usedQuestionIds = [];
    
    if (this.summaryPanel) this.summaryPanel.visible = false;
    if (this.panel) this.panel.visible = true;
    
    this.loadQuestions();
  }

  disposeBlock(block) {
    if (!block) return;
    
    try {
      if (block.children) {
        block.children.forEach((child) => {
          if (child.material) {
            child.material.dispose();
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
        });
      }
    } catch (error) {
      console.warn("Error disposing block:", error);
    }
  }

  cleanup() {
    console.log("Cleaning up QuestionnaireUI...");
    
    // Remove click event listeners
    if (this.clickHandler) {
      document.removeEventListener('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    
    if (this.summaryClickHandler) {
      document.removeEventListener('pointerdown', this.summaryClickHandler);
      this.summaryClickHandler = null;
    }
    
    if (this.panel) {
      this.disposeBlock(this.panel);
      if (this.scene) this.scene.remove(this.panel);
      this.panel = null;
    }
    
    if (this.summaryPanel) {
      this.disposeBlock(this.summaryPanel);
      if (this.scene) this.scene.remove(this.summaryPanel);
      this.summaryPanel = null;
    }
    
    this.interactableBlocks = [];
    this.interactableBlocksSummary = [];
    this.questions = null;
    this.currentQuestionIndex = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.incorrectComponents = [];
    this.usedQuestionIds = [];
    
    console.log("QuestionnaireUI cleaned up, remaining objects:", this.scene ? this.scene.children.length : 0);
  }
} 