/**
 * About: `scene6/ui.js`
 *
 * Scene 6 UI + lesson step system.
 * Owns the step-by-step instruction panel, navigation buttons, lesson switching, and related UI helpers.
 */

"use strict"; // Enable strict mode for safer JavaScript

// Core Scene 6 UI module: manages step-by-step instructions, buttons, lesson switching,
// and ties the 3D instruction panel to the lesson logic and audio cues.
import * as THREE from "three";
import ThreeMeshUI from "three-mesh-ui";
import RobotoFontJSON from "../fonts/msdf/Roboto-msdf.json";
import RobotoFontImage from "../fonts/msdf/Roboto-msdf.png";
// Removed code editor font imports
import { modelTransforms } from "./modelTransforms.js";
import { KpRgbDefault } from "./RgbLesson.js";
import { scene } from "./scene6.js";
import { KpMotorLesson } from "./MotorLesson.js";
import { KpIRLesson } from "./IRLesson.js";
import { JstXhFemalePin } from "./JstXhFemalePin.js";
// Import the new shader manager
import { cleanupShader } from "./shaderManager.js";
import { playAudio } from "../commonFiles/audiomanager.js";
// Import allAssets to check audio availability
import { allAssets } from "../commonFiles/assetsLoader.js";
import { scene6State } from "./scene6State.js";

// Removed - Code editor functionality removed
// --- Step-by-step instructions logic (multi-lesson support) ---
/**
 * Human-readable instruction steps for each lesson.
 * Consumed by the MeshUI instruction panel and forward arrow navigation.
 */
export const lessonSteps = {
  lesson1: [
    "Insert the JST-XH connector into the RGB port on the expansion board.",
    "Attach the  opposite side of the JST-XH connector on the RGB LED.",
    "Connect the Arduino Nano to the expansion board.",
    "Connect the JST-XH connector from the battery to the expansion board power pin",
    "",
    //"Connect the power supply to the Nano.",
  ],
  lesson2: [
    "Buzzer",
    "Connect the JST-XH connector into the  buzzer port on the expansion board.",
    "Connect the another side JST-XH connector into the buzzer",
    "Connect the Arduino Nano to the expansion board",
    "Connect the JST-XH connector from the battery to the expansion board power pin",
   // "Learn Some Coding Tutorial in!",
    // ...
  ],
  lesson3: [
    "LDR SENSOR",
    "Connect the Arduino Nano to the expansion board.",
    "Connect the JST-XH connector to the ldr male connector on the expansion board.",
    "Connect the JST-XH connector to the ldr male connector on the LDR Module.",
    "Connect the JST-XH connector to the Led male connector on the expansion board.",
    "Connect the JST-XH connector to the Led male connector on the Led Module.",
    "Connect the Battery JSX Female Pin to Expansion Board",
    // "Move the Cube to light the LED.",
  ],
  lesson4: [
    "MOTOR DRIVER",
    "Connect the Arduino Nano to the expansion board.",
    "Connect the JST-XH connector from the motor to the motor driver.",
    "Connect the JST-XH connector to the motor driver pin of expansion board",
    "Connect the JST-XH connector to the motor driver male connector.",
    "Connect the JST-XH connector from the battery to the motor driver",
    "Connect the JST-XH connector from the battery to the expansion board power pin ",
    "Test the motor driver setup.",
    "Complete motor driver lesson.",
    "Transition to next lesson.",
  ],
  lesson5: [
    "IR SENSOR",
    "Connect the Arduino Nano to the expansion board.",
    "Connect the JST-XH connector to the TSOP sensor.",
    "Connect the JST-XH connector to the TSOP pin on expansion board.",
    "Connect the JST-XH connector from the motor to the motor driver.",
    "Connect the JST-XH connector to the motor driver pin of expansion board",
    "Connect the JST-XH connector to the motor driver male connector.",
    "Connect the JST-XH connector from the battery to the motor driver",
    "Connect the JST-XH connector from the battery to the expansion board power pin ",
    // "Test the IR sensor with the remote control.",
    // "Complete IR sensor setup.",
    // "Final lesson completion.",
  ],
  // Add more lessons as needed
};

// Define which steps are title steps (not instructions)
const titleSteps = {
  lesson1: [], // No title steps in lesson1
  lesson2: [0], // Step 0 is title in lesson2
  lesson3: [0], // Step 0 is title in lesson3
  lesson4: [0], // Step 0 is title in lesson4
  lesson5: [0], // Step 0 is title in lesson5
};

let currentLessonId = "lesson1";
let currentStep = 0;
let instructionPanel, stepTextBlock;

// Function to determine if current step is a title step
export function isCurrentStepTitle() {
  return (
    titleSteps[currentLessonId] &&
    titleSteps[currentLessonId].includes(currentStep)
  );
}

// Function to determine if a specific step is a title step
export function isStepTitle(lessonId, stepIndex) {
  return titleSteps[lessonId] && titleSteps[lessonId].includes(stepIndex);
}

// Function to manage Next button state for all steps
export function updateNextButtonState() {
  // By default, disable the Next button for all steps
  setForwardArrowEnabled(false);
  
  // Only enable the button when specific conditions are met for each step
  const currentLesson = currentLessonId;
  const step = currentStep;

  if (currentLesson === "lesson1") {
    // Lesson 1 logic
    if (step === 0) {
      // Step 0: Always enable Next button on initial load
      setForwardArrowEnabled(true);
    } else if (step === 1) {
      // Step 1: Enable when RGB LED is connected
      // This will be handled by raycasterSetup.js
    } else if (step === 2) {
      // Step 2: Enable when Arduino Nano is snapped
      
      // This will be handled by raycasterSetup.js
    } else if (isLastStep()) {
      runCodeButton.visible = true;
      console.log("Last step - showing runCodeButton");
      try {
        if (!scene6State._lesson1StartCodingAudioPlayed) {
          playAudio("lesson1_s5");
          scene6State._lesson1StartCodingAudioPlayed = true;
        }
      } catch (e) { console.warn("Failed to play lesson1_s5:", e); }
    }
  } else if (currentLesson === "lesson2") {
    // Lesson 2 logic
    if (step === 0) {
      // Step 0: Title step - button should be enabled for title steps
      setForwardArrowEnabled(true);
    } else if (step === 1) {
      // Step 1: Enable when JST pin is snapped
      // This will be handled by raycasterSetup.js
    } else if (step >= 2) {
      // Step 2+: other enablement handled by raycasterSetup.js
    } else if (isLastStep()) {
      // Last step (step 4): Show Start Learning button (like lesson1 shows Start Coding button)
      runCodeButton.visible = true;
      console.log("Lesson2 last step - showing Start Learning button");
      // lesson2_s8 audio removed - no longer playing
    }
  } else if (currentLesson === "lesson3") {
    // Lesson 3 logic
    if (step === 0) {
      // Step 0: Title step - button should be enabled for title steps
      setForwardArrowEnabled(true);
    } else if (step === 1) {
      // Step 1: Enable when temperature sensor is connected
      // This will be handled by raycasterSetup.js
    } else if (step === 2) {
      // Step 2: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 3) {
      // Step 3: Enable when Arduino Nano is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 4) {
      // Step 4: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (isLastStep()) {
      // Last step: Show Start Coding button (like lesson1)
      runCodeButton.visible = true;
      console.log("Last step - showing runCodeButton");
      try {
        if (!scene6State._lesson3StartCodingAudioPlayed) {
          playAudio("lesson3_s5");
          scene6State._lesson3StartCodingAudioPlayed = true;
        }
      } catch (e) { console.warn("Failed to play lesson3_s5:", e); }
    }
  } else if (currentLesson === "lesson4") {
    // Lesson 4 logic (Motor lesson)
    if (step === 0) {
      // Enable Next on the initial/title step
      setForwardArrowEnabled(true);
    } else if (step === 1) {
      // Step 1: Enable when Arduino Nano is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 2) {
      // Step 2: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 3) {
      // Step 3: Enable when code is uploaded
      // This will be handled by raycasterSetup.js
    } else if (step === 4) {
      // Step 4: Enable when code is uploaded
      // This will be handled by raycasterSetup.js
    } else if (step === 5) {
      // Step 5: Enable when code is uploaded
      // This will be handled by raycasterSetup.js
    } else if (step === 6) {
      // Step 6: Enable when code is uploaded
      // This will be handled by raycasterSetup.js
    }
  } else if (currentLesson === "lesson5") {
    // Lesson 5 logic (IR lesson)
    if (step === 0) {
      // Enable Next on the initial/title step
      setForwardArrowEnabled(true);
    } else if (step === 1) {
      //setForwardArrowEnabled(true);
      // Step 1: Enable when Arduino Nano is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 2) {
      // Step 2: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 3) {
      // Step 3: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 4) {
      // Step 4: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 5) {
      // Step 5: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 6) {
      // Step 6: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 7) {
      // Step 7: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } else if (step === 8) {
      setForwardArrowEnabled(false)
      // Step 8: Enable when JST connector is snapped
      // This will be handled by raycasterSetup.js
    } 
  }
}

export const runCodeButton = new ThreeMeshUI.Block({
  width: 0.55,
  height: 0.12,
  justifyContent: "center",
  contentDirection: "row",
  borderRadius: 0.05,
  backgroundOpacity: 1.0,
  backgroundColor: new THREE.Color(0xffffff),
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.07,
  padding: 0.04,
}).add(
  new ThreeMeshUI.Text({
    content: "Start Coding",
  })
);

// Ensure styling is applied to text and background
runCodeButton.set({ backgroundColor: new THREE.Color(0xffffff), backgroundOpacity: 1.0, fontColor: new THREE.Color(0x000000) });

runCodeButton.position.set(0.2, 2.1, -4.01);
runCodeButton.userData.clickable = true;
runCodeButton.visible = false; // Start hidden

// Add clickable behavior
runCodeButton.traverse((child) => {
  if (child.isMesh) {
    child.userData.clickable = true;
    child.userData.parentButton = runCodeButton;
  }
});

// --- Start Coding Button for Lessons 3, 4, 5 ---
// Create a separate button specifically for lessons 3, 4, and 5
export const runCodeButtonL345 = new ThreeMeshUI.Block({
  width: 0.55,
  height: 0.12,
  justifyContent: "center",
  contentDirection: "row",
  borderRadius: 0.05,
  backgroundOpacity: 1.0,
  backgroundColor: new THREE.Color(0xffffff),
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.07,
  padding: 0.04,
}).add(
  new ThreeMeshUI.Text({
    content: "Start Coding",
  })
);

// Ensure styling is applied to text and background
runCodeButtonL345.set({ backgroundColor: new THREE.Color(0xffffff), backgroundOpacity: 1.0, fontColor: new THREE.Color(0x000000) });

runCodeButtonL345.position.set(0.2, 2.1, -4.01);
runCodeButtonL345.userData.clickable = true;
runCodeButtonL345.visible = false; // Start hidden

// Set rendering properties to ensure button is visible and renders on top
// Similar to nextLessonButton setup
try {
  runCodeButtonL345.renderOrder = 1000; // High render order to render on top
  runCodeButtonL345.traverse((child) => {
    if (child.isMesh) {
      if (child.material) {
        child.material.depthTest = false; // Don't test depth (render on top)
        child.material.depthWrite = false; // Don't write to depth buffer
        child.material.transparent = true; // Enable transparency
        if (child.material.opacity === undefined) {
          child.material.opacity = 1.0;
        }
      }
      if (!child.userData) child.userData = {};
      child.userData.clickable = true;
      child.userData.parentButton = runCodeButtonL345;
    }
  });
} catch (e) {
  console.warn("Error setting runCodeButtonL345 rendering properties:", e);
}

export function setLesson(lessonId) {
  if (lessonSteps[lessonId]) {
    console.log(
      "🎯 setLesson called with:",
      lessonId,
      "previous lesson was:",
      currentLessonId
    );
    console.log("🎯 Current step before transition:", currentStep);
    console.log("🎯 Current lessonId before transition:", scene6State.currentLessonId);
    
    // Play lesson1_s8 audio specifically when moving from lesson1 to lesson2
    if (currentLessonId === "lesson1" && lessonId === "lesson2") {
      console.log("🎵 DETECTED lesson1->lesson2 transition - attempting to play lesson1_s8");
      try {
        console.log("🎵 Calling playAudio('lesson1_s8')");
        const audioResult = playAudio('lesson1_s8');
        console.log("🎵 playAudio result:", audioResult);
        
        // Check if audio exists in allAssets
        if (allAssets && allAssets.audios) {
          console.log("🎵 Available audios:", Object.keys(allAssets.audios));
          console.log("🎵 lesson1_s8 audio object:", allAssets.audios['lesson1_s8']);
          
          // Check if the audio file path is correct
          if (allAssets.audios['lesson1_s8']) {
            console.log("🎵 Audio object details:", {
              hasBuffer: !!allAssets.audios['lesson1_s8'].buffer,
              isPlaying: allAssets.audios['lesson1_s8'].isPlaying,
              volume: allAssets.audios['lesson1_s8'].getVolume ? allAssets.audios['lesson1_s8'].getVolume() : 'N/A'
            });
          }
        } else {
          console.log("🎵 allAssets.audios not available");
        }
        
      } catch (e) {
        console.error("❌ Failed to play lesson1_s8 audio during lesson1->lesson2 transition:", e);
      }
    }
    
    // lesson2_s8 audio removed - no longer playing when transitioning from lesson2 to lesson3
    
    // Play lesson3_s10 audio specifically when moving from lesson3 to lesson4
    if (currentLessonId === "lesson3" && lessonId === "lesson4") {
      console.log("🎵 DETECTED lesson3->lesson4 transition - attempting to play lesson3_s10");
      
      try {
        console.log("🎵 Calling playAudio('lesson3_s10')");
        const audioResult = playAudio('lesson3_s10');
        console.log("🎵 playAudio result:", audioResult);
        
        // Check if audio exists in allAssets
        if (allAssets && allAssets.audios) {
          console.log("🎵 Available audios:", Object.keys(allAssets.audios));
          console.log("🎵 lesson3_s10 audio object:", allAssets.audios['lesson3_s10']);
          
          // Check if the audio file path is correct
          if (allAssets.audios['lesson3_s10']) {
            console.log("🎵 Audio object details:", {
              hasBuffer: !!allAssets.audios['lesson3_s10'].buffer,
              isPlaying: allAssets.audios['lesson3_s10'].isPlaying,
              volume: allAssets.audios['lesson3_s10'].getVolume ? allAssets.audios['lesson3_s10'].getVolume() : 'N/A'
            });
          } else {
            console.log("❌ lesson3_s10 is undefined in allAssets.audios");
            console.log("❌ This means the audio file failed to load during asset loading");
          }
        } else {
          console.log("🎵 allAssets.audios not available");
        }
        
      } catch (e) {
        console.error("❌ Failed to play lesson3_s10 audio during lesson3->lesson4 transition:", e);
      }
    }
    
    // Play lesson4_s9 audio specifically when moving from lesson4 to lesson5
    if (currentLessonId === "lesson4" && lessonId === "lesson5") {
      console.log("🎵 DETECTED lesson4->lesson5 transition - attempting to play lesson4_s9");
      
      try {
        console.log("🎵 Calling playAudio('lesson4_s9')");
        const audioResult = playAudio('lesson4_s9');
        console.log("🎵 playAudio result:", audioResult);
        
        // Check if audio exists in allAssets
        if (allAssets && allAssets.audios) {
          console.log("🎵 Available audios:", Object.keys(allAssets.audios));
          console.log("🎵 lesson4_s9 audio object:", allAssets.audios['lesson4_s9']);
          
          // Check if the audio file path is correct
          if (allAssets.audios['lesson4_s9']) {
            console.log("🎵 Audio object details:", {
              hasBuffer: !!allAssets.audios['lesson4_s9'].buffer,
              isPlaying: allAssets.audios['lesson4_s9'].isPlaying,
              volume: allAssets.audios['lesson4_s9'].getVolume ? allAssets.audios['lesson4_s9'].getVolume() : 'N/A'
            });
          } else {
            console.log("❌ lesson4_s9 is undefined in allAssets.audios");
            console.log("❌ This means the audio file failed to load during asset loading");
          }
        } else {
          console.log("🎵 allAssets.audios not available");
        }
        
      } catch (e) {
        console.error("❌ Failed to play lesson4_s9 audio during lesson4->lesson5 transition:", e);
      }
    }
    
    // Play lesson5_s9 audio specifically when moving from lesson5 to lesson6 (if lesson6 exists)
    if (currentLessonId === "lesson5" && lessonId === "lesson6") {
      console.log("🎵 DETECTED lesson5->lesson6 transition - attempting to play lesson5_s9");
      
      try {
        console.log("🎵 Calling playAudio('lesson5_s9')");
        const audioResult = playAudio('lesson5_s9');
        console.log("🎵 playAudio result:", audioResult);
        
        // Check if audio exists in allAssets
        if (allAssets && allAssets.audios) {
          console.log("🎵 Available audios:", Object.keys(allAssets.audios));
          console.log("🎵 lesson5_s9 audio object:", allAssets.audios['lesson5_s9']);
          
          // Check if the audio file path is correct
          if (allAssets.audios['lesson5_s9']) {
            console.log("🎵 Audio object details:", {
              hasBuffer: !!allAssets.audios['lesson5_s9'].buffer,
              isPlaying: allAssets.audios['lesson5_s9'].isPlaying,
              volume: allAssets.audios['lesson5_s9'].getVolume ? allAssets.audios['lesson5_s9'].getVolume() : 'N/A'
            });
          } else {
            console.log("❌ lesson5_s9 is undefined in allAssets.audios");
            console.log("❌ This means the audio file failed to load during asset loading");
          }
        } else {
          console.log("🎵 allAssets.audios not available");
        }
        
      } catch (e) {
        console.error("❌ Failed to play lesson5_s9 audio during lesson5->lesson6 transition:", e);
      }
    }
    
    // Debug: Check if the transition condition is being met
    console.log("🎯 Transition check - currentLessonId:", currentLessonId, "lessonId:", lessonId);
    console.log("🎯 lesson2->lesson3 condition:", currentLessonId === "lesson2" && lessonId === "lesson3");
    
    // Clean up shader manager when changing lessons
    cleanupShader();
    
    currentLessonId = lessonId;
    scene6State.currentLessonId = currentLessonId;
    console.log("🎯 After transition - currentLessonId:", currentLessonId);
    // Override global getters to avoid stale overrides from lessons
    try {
      scene6State.getCurrentLesson = function () { return currentLessonId; };
      scene6State.getCurrentStep = function () { return currentStep; };
    } catch (e) {}
    currentStep = 0;
    scene6State._lesson1ContinueAudioPlayed = false;
    scene6State._lesson1StartCodingAudioPlayed = false;
    scene6State._lesson3StartCodingAudioPlayed = false;
    scene6State._lesson4S6TransitionSetUp = false;
    scene6State._lesson5AudioSequenceSetUp = false;
    scene6State._lesson5ContinueAudioPlayed = false;
    if (stepTextBlock) {
      stepTextBlock.set({ content: lessonSteps[currentLessonId][currentStep] });
      stepTextBlock.update();
    }
    // Update Next button state for the new lesson
    updateNextButtonState();

    // Ensure code editor shows lesson-specific buttons and pin definitions
    try {
      if (typeof scene6State.setCodeEditorLesson === 'function') {
        scene6State.setCodeEditorLesson(lessonId);
      }
    } catch (e) { console.warn('setCodeEditorLesson call failed:', e); }

    // 🎯 CALL YOUR FUNCTION HERE - SPECIFIC LESSON STARTED!
    if (lessonId === "lesson3") {
      const camera = scene6State.camera;
      console.log("Starting lesson3 with scene:", scene, "camera:", camera);
      try {
        if (!scene || !camera) {
          console.error("Scene or camera not available for lesson3");
          return;
        }
        
        // Before starting lesson3, ensure old lesson2 jstPin2 is completely removed
        console.log("[Lesson3 Start] Ensuring old lesson2 jstPin2 is removed before starting lesson3");
        const oldJstPin2 = scene6State.jstPin2;
        if (oldJstPin2) {
          // Hide and remove old jstPin2
          if (oldJstPin2.group) {
            oldJstPin2.group.visible = false;
            if (scene.children.includes(oldJstPin2.group)) {
              scene.remove(oldJstPin2.group);
              console.log("[Lesson3 Start] Removed old lesson2 jstPin2.group from scene");
            }
          }
          if (oldJstPin2.pinGLTF1) {
            oldJstPin2.pinGLTF1.visible = false;
            if (scene.children.includes(oldJstPin2.pinGLTF1)) {
              scene.remove(oldJstPin2.pinGLTF1);
            }
          }
          if (oldJstPin2.pinGLTF2) {
            oldJstPin2.pinGLTF2.visible = false;
            if (scene.children.includes(oldJstPin2.pinGLTF2)) {
              scene.remove(oldJstPin2.pinGLTF2);
            }
          }
          
          // Remove from registry
          try {
            if (typeof JstXhFemalePin !== "undefined" && JstXhFemalePin.allModels && Array.isArray(JstXhFemalePin.allModels)) {
              const index = JstXhFemalePin.allModels.findIndex(entry => entry.instance === oldJstPin2 || (entry.instance && entry.instance.id === oldJstPin2.id));
              if (index !== -1) {
                JstXhFemalePin.allModels.splice(index, 1);
                console.log("[Lesson3 Start] Removed old lesson2 jstPin2 from JstXhFemalePin registry");
              }
            }
          } catch (e) {
            console.warn("[Lesson3 Start] Error removing old jstPin2 from registry:", e);
          }
        }
        
        // KpMotorLesson(scene, camera);
        KpRgbDefault(scene, camera);
        
        // After KpRgbDefault, ensure any remaining old jstPin2 is hidden
        setTimeout(() => {
          try {
            // Find all jstPin2 instances in the registry
            if (typeof JstXhFemalePin !== "undefined" && JstXhFemalePin.allModels && Array.isArray(JstXhFemalePin.allModels)) {
              const allJstPins = JstXhFemalePin.allModels.map(entry => entry.instance).filter(Boolean);
              // If there are multiple twoSide pins, hide the old one (lesson2 one should be removed, but just in case)
              const twoSidePins = allJstPins.filter(pin => pin.config && pin.config.twoSide);
              if (twoSidePins.length > 1) {
                // Hide all except the last one (which should be the new lesson3 one)
                twoSidePins.slice(0, -1).forEach((oldPin) => {
                  if (oldPin.group) {
                    oldPin.group.visible = false;
                    if (scene.children.includes(oldPin.group)) {
                      scene.remove(oldPin.group);
                      console.log("[Lesson3 Start] Removed duplicate old jstPin2 after KpRgbDefault");
                    }
                  }
                });
              }
            }
            
            // Final scene traversal to hide any remaining jstPin2 objects
            scene.traverse((child) => {
              if (child.userData && child.userData.lesson2) {
                child.visible = false;
                if (child.parent) {
                  child.parent.remove(child);
                  console.log("[Lesson3 Start] Final cleanup: Removed lesson2-marked object:", child.name || 'unnamed');
                }
              }
            });
          } catch (e) {
            console.warn("[Lesson3 Start] Error in post-KpRgbDefault cleanup:", e);
          }
        }, 500);
        
     // KpIRLesson(scene, camera);
        // KpIRLesson(scene, camera)
        // Example: yourLesson3StartFunction();
        // Example: window.yourCustomFunction();
        console.log("Lesson3 has started - call your function here!");
      } catch (error) {
        console.error("Error starting lesson3:", error);
      }
    }
    if (lessonId === "lesson4") {
      const camera = scene6State.camera;
      console.log("Starting lesson4 with scene:", scene, "camera:", camera);
      try {
        if (!scene || !camera) {
          console.error("Scene or camera not available for lesson4");
          return;
        }
        if (!scene6State._motorLessonInitialized) {
         // KpMotorLesson(scene, camera);
          scene6State._motorLessonInitialized = true;
          console.log("[Lesson4] KpMotorLesson initialized (once)");
        } else {
          console.log("[Lesson4] KpMotorLesson already initialized, skipping");
        }
        console.log("Lesson4 has started - motor lesson initialized!");
      } catch (error) {
        console.error("Error starting lesson4:", error);
      }
    }
    if (lessonId === "lesson5") {
      const camera = scene6State.camera;
      console.log("Starting lesson5 with scene:", scene, "camera:", camera);
      try {
        if (!scene || !camera) {
          console.error("Scene or camera not available for lesson5");
          return;
        }
        if (!scene6State._irLessonInitialized) {
         // KpIRLesson(scene, camera);
          scene6State._irLessonInitialized = true;
          console.log("[Lesson5] KpIRLesson initialized (once)");
        } else {
          console.log("[Lesson5] KpIRLesson already initialized, skipping");
        }
        console.log("Lesson5 has started - IR lesson initialized!");
      } catch (error) {
        console.error("Error starting lesson5:", error);
      }
    }
    console.log("setLesson completed. Current lesson is now:", currentLessonId);
  } else {
    console.warn("Lesson ID not found:", lessonId);
  }
}

export function getCurrentStepText() {
  return lessonSteps[currentLessonId][currentStep];
}

export function getCurrentStep() {
  return currentStep;
}

export function getTotalSteps() {
  return lessonSteps[currentLessonId].length;
}

export function isLastStep() {
  return currentStep === lessonSteps[currentLessonId].length - 1;
}

export function resetSteps() {
  console.log(
    "resetSteps called. Current lesson before reset:",
    currentLessonId
  );
  
  // Clean up shader manager when resetting steps
  cleanupShader();
  
  currentStep = 0;
  scene6State._lesson1ContinueAudioPlayed = false;
  scene6State._lesson1StartCodingAudioPlayed = false;
  scene6State._lesson3StartCodingAudioPlayed = false;
  scene6State._lesson4S6TransitionSetUp = false;
  scene6State._lesson5AudioSequenceSetUp = false;
  scene6State._lesson5ContinueAudioPlayed = false;
  if (stepTextBlock) {
    stepTextBlock.set({ content: lessonSteps[currentLessonId][currentStep] });
    stepTextBlock.update();
  }
  console.log(
    "resetSteps completed. Current lesson after reset:",
    currentLessonId
  );
}

export function createStepByStepPanel(
  scene,
  position = new THREE.Vector3(0, 1.5, -2)
) {
  instructionPanel = new ThreeMeshUI.Block({
    width: 1.2,
    height: 0.4,
    justifyContent: "start",
    contentDirection: "column",
    borderRadius: 0.1,
    backgroundOpacity: 0,
    fontFamily: RobotoFontJSON,
    fontTexture: RobotoFontImage,
    fontSize: 0.07,
    padding: 0.05,
  });
  instructionPanel.set({ backgroundOpacity: 0.9 });
  instructionPanel.update();

  stepTextBlock = new ThreeMeshUI.Text({
    content: lessonSteps[currentLessonId][currentStep],
    textAlign: "left",
  });

  instructionPanel.add(stepTextBlock);
  instructionPanel.position.copy(position);
  scene.add(instructionPanel);
}

export function nextStep() {
  if (currentStep < lessonSteps[currentLessonId].length - 1) {
    currentStep++;
    
    // Play lesson2 audio files when specific steps are revealed
    if (currentLessonId === "lesson2") {
      let audioToPlay = null;
      
      switch (currentStep) {
        case 1:
          audioToPlay = 'lesson2_s1'; // "Connect the JST-XH connector into the buzzer port on the expansion board"
          break;
        case 2:
          audioToPlay = 'lesson2_s2'; // "Connect the another side JST-XH connector into the buzzer"
          break;
        case 3:
          audioToPlay = 'lesson2_s3'; // "Connect the Arduino Nano to the expansion board"
          break;
        case 4:
          audioToPlay = 'lesson2_s4'; // "Connect the JST-XH connector from the battery to the expansion board power pin"
          break;
        case 5:
          audioToPlay = 'lesson2_s5'; // "Learn Some Coding Tutorial in!"
          break;
      }
      
      if (audioToPlay) {
        console.log(`🎵 Revealing lesson2 step ${currentStep} - playing ${audioToPlay} audio`);
        try {
          playAudio(audioToPlay);
          
          // Special case: After lesson2_s4 plays, automatically play lesson2_s5
          if (currentStep === 4 && audioToPlay === 'lesson2_s4') {
            console.log("🎵 Setting up audio sequence: lesson2_s4 → lesson2_s5");
            // Wait for lesson2_s4 to finish, then play lesson2_s5
            // You'll need to adjust this timing based on the actual duration of lesson2_s4
            setTimeout(() => {
              console.log("🎵 lesson2_s4 finished, now playing lesson2_s5");
              try {
                playAudio('lesson2_s5');
              } catch (e) {
                console.error("❌ Failed to play lesson2_s5 in sequence:", e);
              }
            }, 5000); // Adjust this time (in milliseconds) to match lesson2_s4 duration
          }
          
        } catch (e) {
          console.error(`❌ Failed to play ${audioToPlay} audio:`, e);
        }
      }
    }
    
    // Play lesson3 audio files when specific steps are revealed
    if (currentLessonId === "lesson3") {
      console.log("🎵 Lesson3 detected - checking step:", currentStep);
      let audioToPlay = null;
      
      switch (currentStep) {
        case 1:
          audioToPlay = 'lesson3_s1'; // First instruction step
          break;
        case 2:
          audioToPlay = 'lesson3_s2'; // Second instruction step
          break;
        case 3:
          audioToPlay = 'lesson3_s3'; // Third instruction step
          break;
        case 4:
          audioToPlay = 'lesson3_s4'; // Fourth instruction step
          break;
        case 5:
          audioToPlay = 'lesson3_s5'; // Fifth instruction step
          break;
        case 6:
          audioToPlay = 'lesson3_s6'; // Sixth instruction step
          break;
        case 7:
          audioToPlay = 'lesson3_s7'; // Seventh instruction step
          break;
        case 8:
          audioToPlay = 'lesson3_s8'; // Eighth instruction step
          break;
        case 9:
          audioToPlay = 'lesson3_s9'; // Ninth instruction step
          break;
      }
      
      console.log("🎵 Audio to play:", audioToPlay);
      
      if (audioToPlay) {
        console.log(`🎵 Revealing lesson3 step ${currentStep} - playing ${audioToPlay} audio`);
        
        // Check if the audio exists in allAssets
        if (allAssets && allAssets.audios) {
          console.log("🎵 Available audios in lesson3:", Object.keys(allAssets.audios));
          console.log(`🎵 ${audioToPlay} audio object:`, allAssets.audios[audioToPlay]);
          
          if (!allAssets.audios[audioToPlay]) {
            console.error(`❌ ${audioToPlay} is not found in allAssets.audios`);
            console.error("❌ This means the lesson3 audio files failed to load");
            
            // Debug: Check if lesson3 audio files exist in the assets entry
            console.log("🎵 Checking assetsEntry for lesson3 audio files...");
            console.log("🎵 allAssets object structure:", allAssets);
            console.log("🎵 allAssets.audios object:", allAssets.audios);
            
            // Try to manually check if the audio files exist
            const lesson3Audios = ['lesson3_s1', 'lesson3_s2', 'lesson3_s3', 'lesson3_s4', 'lesson3_s5', 'lesson3_s6', 'lesson3_s7', 'lesson3_s8', 'lesson3_s9'];
            lesson3Audios.forEach(audioName => {
              console.log(`🎵 ${audioName}:`, allAssets.audios[audioName] ? 'EXISTS' : 'MISSING');
            });
          }
        }
        
        try {
          playAudio(audioToPlay);
          
          // Special case: After lesson3_s6 plays, automatically play lesson3_s7
          if (currentStep === 6 && audioToPlay === 'lesson3_s6') {
            console.log("🎵 Setting up audio sequence: lesson3_s6 → lesson3_s7");
            
            // Add event listener for when lesson3_s6 completes
            const handleLesson3S6Complete = () => {
              console.log("🎵 lesson3_s6 finished, now playing lesson3_s7");
              try {
                playAudio('lesson3_s7');
                // Remove the event listener after it's used
                window.removeEventListener('audioComplete-lesson3_s6', handleLesson3S6Complete);
              } catch (e) {
                console.error("❌ Failed to play lesson3_s7 in sequence:", e);
              }
            };
            
            // Listen for the audio completion event
            window.addEventListener('audioComplete-lesson3_s6', handleLesson3S6Complete);
          }
          
          // Special case: After lesson3_s8 plays, automatically play lesson3_s9
          if (currentStep === 8 && audioToPlay === 'lesson3_s8') {
            console.log("🎵 Setting up audio sequence: lesson3_s8 → lesson3_s9");
            setupLesson3S8ToS9Transition();
          }

          // Special case: After lesson3_s9 plays, automatically play lesson3_s10
          if (currentStep === 9 && audioToPlay === 'lesson3_s9') {
            console.log("🎵 Setting up audio sequence: lesson3_s9 → lesson3_s10");
            setupLesson3S9ToS10Transition();
          }
          
        } catch (e) {
          console.error(`❌ Failed to play ${audioToPlay} audio:`, e);
        }
      } else {
        console.log("🎵 No audio found for lesson3 step:", currentStep);
      }
    }
    
    // Play lesson4 audio files when specific steps are revealed
    if (currentLessonId === "lesson4") {
      console.log("🎵 Lesson4 detected - checking step:", currentStep);
      let audioToPlay = null;
      
      switch (currentStep) {
        case 1:
          audioToPlay = 'lesson4_s1'; // "Connect the Arduino Nano to the expansion board."
          break;
        case 2:
          audioToPlay = 'lesson4_s2'; // "Connect the JST-XH connector from the motor to the motor driver."
          break;
        case 3:
          audioToPlay = 'lesson4_s3'; // "Connect the JST-XH connector to the motor driver pin of expansion board"
          break;
        case 4:
          audioToPlay = 'lesson4_s4'; // "Connect the JST-XH connector to the motor driver male connector."
          break;
        case 5:
          audioToPlay = 'lesson4_s5'; // "Connect the JST-XH connector from the battery to the motor driver"
          break;
        case 6:
          audioToPlay = 'lesson4_s6'; // "Connect the JST-XH connector from the battery to the expansion board power pin"
          break;
        case 7:
          audioToPlay = 'lesson4_s7'; // "Test the motor driver setup."
          break;
        case 8:
          audioToPlay = 'lesson4_s8'; // "Complete motor driver lesson."
          break;
        case 9:
          audioToPlay = 'lesson4_s9'; // "Transition to next lesson."
          break;
      }
      
      console.log("🎵 Audio to play:", audioToPlay);
      
      if (audioToPlay) {
        console.log(`🎵 Revealing lesson4 step ${currentStep} - playing ${audioToPlay} audio`);
        
        // Check if the audio exists in allAssets
        if (allAssets && allAssets.audios) {
          console.log("🎵 Available audios in lesson4:", Object.keys(allAssets.audios));
          console.log(`🎵 ${audioToPlay} audio object:`, allAssets.audios[audioToPlay]);
          
          if (!allAssets.audios[audioToPlay]) {
            console.error(`❌ ${audioToPlay} is not found in allAssets.audios`);
            console.error("❌ This means the lesson4 audio files failed to load");
            
            // Debug: Check if lesson4 audio files exist in the assets entry
            console.log("🎵 Checking assetsEntry for lesson4 audio files...");
            console.log("🎵 allAssets object structure:", allAssets);
            console.log("🎵 allAssets.audios object:", allAssets.audios);
            
            // Try to manually check if the audio files exist
            const lesson4Audios = ['lesson4_s1', 'lesson4_s2', 'lesson4_s3', 'lesson4_s4', 'lesson4_s5', 'lesson4_s6', 'lesson4_s7', 'lesson4_s8', 'lesson4_s9'];
            lesson4Audios.forEach(audioName => {
              console.log(`🎵 ${audioName}:`, allAssets.audios[audioName] ? 'EXISTS' : 'MISSING');
            });
          }
        }
        
        try {
          playAudio(audioToPlay);
          
          // Special case: After lesson4_s6 plays, automatically play lesson4_s7
          if (currentStep === 6 && audioToPlay === 'lesson4_s6') {
            console.log("🎵 Setting up audio sequence: lesson4_s6 → lesson4_s7");
            setupLesson4S6ToS7Transition();
          }
          
        } catch (e) {
          console.error(`❌ Failed to play ${audioToPlay} audio:`, e);
        }
      } else {
        console.log("🎵 No audio found for lesson4 step:", currentStep);
      }
    }
    
    // Play lesson5 audio files when specific steps are revealed
    if (currentLessonId === "lesson5") {
      console.log("🎵 Lesson5 detected - checking step:", currentStep);
      let audioToPlay = null;
      
      switch (currentStep) {
        case 1:
          audioToPlay = 'lesson5_s1'; // "Connect the Arduino Nano to the expansion board."
          break;
        case 2:
          audioToPlay = 'lesson5_s2'; // "Connect the JST-XH connector to the TSOP sensor."
          break;
        case 3:
          audioToPlay = 'lesson5_s3'; // "Connect the JST-XH connector to the TSOP pin on expansion board."
          break;
        case 4:
          audioToPlay = 'lesson5_s4'; // "Connect the JST-XH connector from the motor to the motor driver."
          break;
        case 5:
          audioToPlay = 'lesson5_s5'; // "Connect the JST-XH connector to the motor driver pin of expansion board"
          break;
        case 6:
          audioToPlay = 'lesson5_s6'; // "Connect the JST-XH connector to the motor driver male connector."
          break;
        case 7:
          audioToPlay = 'lesson5_s7'; // "Connect the JST-XH connector from the battery to the motor driver"
          break;
        case 8:
          audioToPlay = 'lesson5_s8'; // "Connect the JST-XH connector from the battery to the expansion board power pin"
          break;
        case 9:
          audioToPlay = 'lesson5_s9'; // "Test the IR sensor with the remote control."
          break;
        case 10:
          audioToPlay = 'lesson5_s10'; // "Complete IR sensor setup."
          break;
        case 11:
          audioToPlay = 'lesson5_s11'; // "Final lesson completion."
          break;
      }
      
      console.log("🎵 Audio to play:", audioToPlay);
      
      if (audioToPlay) {
        console.log(`🎵 Revealing lesson5 step ${currentStep} - playing ${audioToPlay} audio`);
        
        // Check if the audio exists in allAssets
        if (allAssets && allAssets.audios) {
          console.log("🎵 Available audios in lesson5:", Object.keys(allAssets.audios));
          console.log(`🎵 ${audioToPlay} audio object:`, allAssets.audios[audioToPlay]);
          
          if (!allAssets.audios[audioToPlay]) {
            console.error(`❌ ${audioToPlay} is not found in allAssets.audios`);
            console.error("❌ This means the lesson5 audio files failed to load");
            
            // Debug: Check if lesson5 audio files exist in the assets entry
            console.log("🎵 Checking assetsEntry for lesson5 audio files...");
            console.log("🎵 allAssets object structure:", allAssets);
            console.log("🎵 allAssets.audios object:", allAssets.audios);
            
            // Try to manually check if the audio files exist
            const lesson5Audios = ['lesson5_s1', 'lesson5_s2', 'lesson5_s3', 'lesson5_s4', 'lesson5_s5', 'lesson5_s6', 'lesson5_s7', 'lesson5_s8', 'lesson5_s9', 'lesson5_s10', 'lesson5_s11'];
            lesson5Audios.forEach(audioName => {
              console.log(`🎵 ${audioName}:`, allAssets.audios[audioName] ? 'EXISTS' : 'MISSING');
            });
          }
        }
        
        try {
          playAudio(audioToPlay);
        } catch (e) {
          console.error(`❌ Failed to play ${audioToPlay} audio:`, e);
        }
      } else {
        console.log("🎵 No audio found for lesson5 step:", currentStep);
      }
    }
    
    // Update Next button state for the new step
    updateNextButtonState();
  }
}

export function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    // Update Next button state for the new step
    updateNextButtonState();
  }
}

export function createStepNavigationButtons(
  scene,
  position = new THREE.Vector3(0, 1.2, -2)
) {
  // Previous Button
  const prevButton = new ThreeMeshUI.Block({
    width: 0.4,
    height: 0.13,
    padding: 0.03,
    borderRadius: 0.04,
    backgroundOpacity: 0.85,
    fontFamily: RobotoFontJSON,
    fontTexture: RobotoFontImage,
    fontSize: 0.07,
  }).add(
    new ThreeMeshUI.Text({
      content: "Previous",
    })
  );
  prevButton.position.copy(
    position.clone().add(new THREE.Vector3(-0.35, 0, 0))
  );
  prevButton.userData.clickable = true;
  prevButton.traverse((child) => {
    child.userData.clickable = true;
    child.userData.parentButton = prevButton;
  });

  // Next Button
  const nextButton = new ThreeMeshUI.Block({
    width: 0.4,
    height: 0.13,
    padding: 0.03,
    borderRadius: 0.04,
    backgroundOpacity: 0.85,
    fontFamily: RobotoFontJSON,
    fontTexture: RobotoFontImage,
    fontSize: 0.07,
  }).add(
    new ThreeMeshUI.Text({
      content: "Next",
    })
  );
  nextButton.position.copy(position.clone().add(new THREE.Vector3(0.35, 0, 0)));
  nextButton.userData.clickable = true;
  nextButton.traverse((child) => {
    child.userData.clickable = true;
    child.userData.parentButton = nextButton;
  });

  scene.add(prevButton);
  scene.add(nextButton);
  return { prevButton, nextButton };
}

// (Removed) canvas-based code editor button

// --- Instruction text panel ---
const codePlane = new ThreeMeshUI.Block({
  width: 1.8,
  height: 0.4,
  justifyContent: "start", // Changed from left to start for left alignment
  contentDirection: "row",
  borderRadius: 0.08,
  backgroundOpacity: 0, // Set to fully transparent
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.07,
  padding: 0.05,
});
// Force update in case material is cached
codePlane.set({ backgroundOpacity: 0 });
codePlane.update();
const codePlaneText = new ThreeMeshUI.Text({
  content: "", // Start with empty content so in nothing is visible before reveal
  textAlign: "left", // Ensure left alignment
});
codePlane.add(codePlaneText);
codePlane.position.set(0, 0, 0);
codePlane.userData.clickable = true;
codePlane.traverse((child) => {
  child.userData.clickable = true;
  child.userData.parentButton = codePlane;
});
// Ensure codePlane renders behind learning panel
try {
  codePlane.renderOrder = 10;
  codePlane.traverse((child) => {
    if (child.material) {
      child.material.depthTest = true;
      child.material.depthWrite = false;
    }
  });
} catch (e) {}

// --- Begin the Blink button (kept as action in step 0) ---
const beginBlinkButton = new ThreeMeshUI.Block({
  width: 0.55,
  height: 0.12,
  justifyContent: "center",
  contentDirection: "row",
  borderRadius: 0.05,
  backgroundOpacity: 1.0,
  backgroundColor: new THREE.Color(0xffffff),
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.06,
  padding: 0.04,
}).add(
  new ThreeMeshUI.Text({
    content: "Begin the Blink!",
  })
);
// Ensure text color
beginBlinkButton.set({ backgroundColor: new THREE.Color(0xffffff), backgroundOpacity: 1.0, fontColor: new THREE.Color(0x000000) });
beginBlinkButton.position.set(0.2, 2.1, -4.01); // Raised higher below the instruction text
beginBlinkButton.userData.clickable = true;
beginBlinkButton.traverse((child) => {
  child.userData.clickable = true;
  child.userData.parentButton = beginBlinkButton;
});
try { beginBlinkButton.renderOrder = 10; } catch (e) {}

// --- MeshUI-based Next and Prev buttons ---
const forwardArrow = new ThreeMeshUI.Block({
  width: 0.4,
  height: 0.14,
  justifyContent: "center",
  contentDirection: "row",
  borderRadius: 0.05,
  backgroundOpacity: 1.0,
  backgroundColor: new THREE.Color(0xffffff),
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.075,
  padding: 0.025,
});
const forwardArrowText = new ThreeMeshUI.Text({
  content: "Next",
});
// Only add the text ONCE
forwardArrow.add(forwardArrowText);
forwardArrowText.set({ fontColor: new THREE.Color(0x000000), color: new THREE.Color(0x000000) });
forwardArrow.position.set(1, 0, 0);
forwardArrow.userData.clickable = true;
forwardArrow.traverse((child) => {
  child.userData.clickable = true;
  child.userData.parentButton = forwardArrow;
});
try { forwardArrow.renderOrder = 10; } catch (e) {}

export function setForwardArrowEnabled(enabled) {
  forwardArrow.userData.clickable = enabled;
  forwardArrowText.set({
    fontColor: enabled ? new THREE.Color(0x000000) : new THREE.Color(0x888888),
    color: enabled ? new THREE.Color(0x000000) : new THREE.Color(0x888888),
  });
  forwardArrow.set({
    backgroundColor: enabled
      ? new THREE.Color(0xffffff)
      : new THREE.Color(0xcccccc),
    backgroundOpacity: 1.0,
  });
  // Code editor removed: control visibility directly
  forwardArrow.visible = enabled;
  forwardArrow.update();
}

// (Removed) Upload Code Button

// --- Next Lesson Button ---
const nextLessonButton = new ThreeMeshUI.Block({
  width: 0.55,
  height: 0.12,
  justifyContent: "center",
  contentDirection: "row",
  borderRadius: 0.05,
  backgroundOpacity: 1.0,
  backgroundColor: new THREE.Color(0xffffff),
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.07,
  padding: 0.04,
}).add(
  new ThreeMeshUI.Text({
    content: "Next Lesson",
  })
);
// Apply white background and black text for Next Lesson button
nextLessonButton.set({ backgroundColor: new THREE.Color(0xffffff), backgroundOpacity: 1.0, fontColor: new THREE.Color(0x000000) });
nextLessonButton.position.set(0.2, 2, -4.01); // Positioned for lesson navigation
// Ensure it renders on top and doesn't get occluded by depth
try {
  nextLessonButton.renderOrder = 1000;
  nextLessonButton.traverse((child) => {
    if (child.material) {
      child.material.depthTest = false;
      child.material.depthWrite = false;
      child.material.transparent = true;
    }
    if (child.userData) child.userData.clickable = true;
  });
} catch (e) {}
defineNextLessonButtonClickable();
nextLessonButton.visible = false; // Start hidden
function defineNextLessonButtonClickable() {
  nextLessonButton.userData.clickable = true;
  nextLessonButton.traverse((child) => {
    child.userData.clickable = true;
    child.userData.parentButton = nextLessonButton;
  });
}

// (Removed) loading block

// Utility to update the codePlane with instruction text (typewriter effect support)
export function updateCodePlaneWithInstruction(text) {
  if (codePlaneText && codePlane) {
    // Determine font size based on whether it's a title step or instruction step
    const isTitleStep = isCurrentStepTitle();
    const fontSize = isTitleStep ? 0.11 : 0.07; // Larger font for titles, smaller for instructions

    codePlaneText.set({ content: text, fontSize: fontSize, textAlign: "left" }); // Dynamic font size based on step type
    codePlane.set({
      backgroundOpacity: 0,
      backgroundColor: new THREE.Color(0x000000),
    }); // Transparent background
    codePlane.update();
    codePlaneText.update();

    // Show instruction panel only for instruction steps, not title steps
    const isTitle = isCurrentStepTitle();

    if (isTitle) {
      // For title steps, show the title text in codePlane but hide the instruction panel
      codePlane.visible = true;
      hideInstructionsLabel();
    } else {
      // Show instruction panel for instruction steps
      codePlane.visible = true;
      // Show instructions label for any instruction text
      if (text && text.length > 0) {
        showInstructionsLabel();
      } else {
        hideInstructionsLabel();
      }
    }
    
    // Hide questions panel when steps panel is visible
    try {
      if (typeof scene6State.hideQuestionsPanel === 'function') {
        scene6State.hideQuestionsPanel();
      }
    } catch (e) {
      console.warn('Failed to hide questions panel when steps panel is shown:', e);
    }
  }
}

// Utility to set the codePlane to the 'Instructions' placeholder
export function setCodePlaneToInstructions() {
  if (codePlaneText) {
    codePlaneText.set({ content: "RGB LED", fontSize: 0.09 });

    codePlaneText.update();

    // Show instruction panel only for instruction steps, not title steps
    const isTitle = isCurrentStepTitle();

    if (isTitle) {
      // For title steps, show the title text in codePlane but hide the instruction panel
      if (codePlane) codePlane.visible = true;
      hideInstructionsLabel();
    } else {
      // Show instruction panel for instruction steps
      if (codePlane) codePlane.visible = true;
      // Hide instructions label when codePlane is showing instructions
      hideInstructionsLabel();
    }
    
    // Hide questions panel when steps panel is visible
    try {
      if (typeof scene6State.hideQuestionsPanel === 'function') {
        scene6State.hideQuestionsPanel();
      }
    } catch (e) {
      console.warn('Failed to hide questions panel when steps panel is shown:', e);
    }
  }
}



// --- Next Lesson Button Show/Hide/Handler ---
export function showNextLessonButton() {
  nextLessonButton.visible = true;
  nextLessonButton.userData.clickable = true;
  nextLessonButton.traverse((child) => {
    child.userData.clickable = true;
  });
  try { if (scene6State.codeEditorGroup) scene6State.codeEditorGroup.visible = true; } catch (e) {}
  // Rename button for lesson5
  try {
    const isLesson5 = typeof scene6State.getCurrentLesson === 'function' && scene6State.getCurrentLesson() === 'lesson5';
    // Find Text child and update content
    let textNode = null;
    nextLessonButton.children.forEach((c) => {
      if (c && typeof c.set === 'function' && c.isUI) {
        textNode = c;
      }
    });
    if (textNode) {
      textNode.set({ content: isLesson5 ? 'Lets Build' : 'Next Lesson' });
    }
  } catch (e) {}
  attachNextLessonHandler();
  try { if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.update) ThreeMeshUI.update(); } catch (e) {}
}
export function hideNextLessonButton() {
  nextLessonButton.visible = false;
  detachNextLessonHandler();
}
function attachNextLessonHandler() {
  if (!scene6State._nextLessonRaycastHandler) {
    scene6State._nextLessonRaycastHandler = (event) => {
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      const camera = scene6State.camera || scene6State._sceneCamera;
      if (!camera) {
        console.warn("[NextLesson] Camera not available for raycasting");
        return;
      }
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([nextLessonButton], true);
      console.log("[NextLesson] Button click detected:", {
        intersects: intersects.length,
        buttonVisible: nextLessonButton.visible,
        onNextLessonExists: typeof onNextLesson === "function"
      });
      if (intersects.length > 0 && nextLessonButton.visible) {
        console.log("[NextLesson] Calling onNextLesson handler");
        if (typeof onNextLesson === "function") {
          try {
            onNextLesson();
            console.log("[NextLesson] onNextLesson handler executed successfully");
          } catch (e) {
            console.error("[NextLesson] Error executing onNextLesson handler:", e);
          }
        } else {
          console.error("[NextLesson] onNextLesson is not a function! Current value:", onNextLesson);
        }
      }
    };
    window.addEventListener("pointerdown", scene6State._nextLessonRaycastHandler);
    console.log("[NextLesson] Event listener attached for Next Lesson button");
  } else {
    console.log("[NextLesson] Handler already attached, skipping");
  }
}
function detachNextLessonHandler() {
  if (scene6State._nextLessonRaycastHandler) {
    window.removeEventListener("pointerdown", scene6State._nextLessonRaycastHandler);
    scene6State._nextLessonRaycastHandler = null;
  }
}

// --- Next Lesson Button Click Handler (exportable callback) ---
let onNextLesson = null;
export function setOnNextLesson(callback) {
  onNextLesson = callback;
}

// Helper for multi-line text wrapping
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      lines.push(line);
      line = words[n] + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  const totalHeight = lines.length * lineHeight;
  let startY = y - totalHeight / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight);
  }
}

// --- Lesson Title Block ---
let lessonTitleBlock, lessonTitlePanel;

function createLessonTitle(scene, position = new THREE.Vector3(0, 2.5, -2)) {
  lessonTitleBlock = new ThreeMeshUI.Text({
    content: "",
    fontSize: 0.12,
    textAlign: "center",
  });
  lessonTitlePanel = new ThreeMeshUI.Block({
    width: 1.2,
    height: 0.18,
    justifyContent: "center",
    contentDirection: "row",
    backgroundOpacity: 0,
    fontFamily: RobotoFontJSON,
    fontTexture: RobotoFontImage,
    padding: 0.02,
  });
  lessonTitlePanel.add(lessonTitleBlock);
  lessonTitlePanel.position.copy(position);
  scene.add(lessonTitlePanel);
}

function setLessonTitle(title) {
  if (lessonTitleBlock) {
    lessonTitleBlock.set({ content: title });
    lessonTitleBlock.update();
  }
}

// (Removed) code editor panels for lesson2 and lesson3

// (Removed) swap icon and button

// --- Make Some Noise Button ---
export const makeSomeNoiseButton = new ThreeMeshUI.Block({
  width: 0.55,
  height: 0.12,
  justifyContent: "center",
  contentDirection: "row",
  borderRadius: 0.05,
  backgroundOpacity: 1.0,
  backgroundColor: new THREE.Color(0xffffff),
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.05,
  padding: 0.04,
}).add(
  new ThreeMeshUI.Text({
    content: "Make Some Noise!",
  })
);
makeSomeNoiseButton.set({ backgroundColor: new THREE.Color(0xffffff), backgroundOpacity: 1.0, fontColor: new THREE.Color(0x000000) });
makeSomeNoiseButton.position.set(0.2, 2, -4.01);
makeSomeNoiseButton.visible = false; // Start hidden
makeSomeNoiseButton.userData.clickable = true;
makeSomeNoiseButton.traverse((child) => {
  child.userData.clickable = true;
  child.userData.parentButton = makeSomeNoiseButton;
});

// (Removed) Show Blinking Button - removed per user request

// (Removed) close code panel button

// (Removed) close handler for code panel

/* Removed - Code editor functionality removed */

/* Removed - Code editor functionality removed */

// --- Instructions Label ---
const instructionsLabel = new ThreeMeshUI.Block({
  width: 0.48,
  height: 0.08,
  justifyContent: "center",
  contentDirection: "row",
  borderRadius: 0.02,
  backgroundOpacity: 0.8,
  backgroundColor: new THREE.Color(0x2c3e50),
  fontFamily: RobotoFontJSON,
  fontTexture: RobotoFontImage,
  fontSize: 0.08,
  padding: 0.02,
}).add(
  new ThreeMeshUI.Text({
    content: "Instructions",
    color: new THREE.Color(0xffffff),
  })
);
instructionsLabel.position.set(0.2, 2.8, -4.01); // Position above the codePlane
instructionsLabel.visible = false; // Start hidden
try { instructionsLabel.renderOrder = 10; } catch (e) {}

// Utility to show the instructions label
export function showInstructionsLabel() {
  if (instructionsLabel) {
    instructionsLabel.visible = true;
    instructionsLabel.update();
  }
}

// Utility to hide the instructions label
export function hideInstructionsLabel() {
  if (instructionsLabel) {
    instructionsLabel.visible = false;
    instructionsLabel.update();
  }
}

// --- Camera Animation Control ---
export function disableCameraAnimation() {
  scene6State.cameraAnimationDisabled = true;
}

export function enableCameraAnimation() {
  scene6State.cameraAnimationDisabled = false;
}

// Export canvas-based meshes for use in scene
export { codePlane, forwardArrow };
export { beginBlinkButton };
export { nextLessonButton };
export { createLessonTitle, setLessonTitle };
export { instructionsLabel };
// --- Reset all models to original position ---
export function resetAllModelsToOriginalPosition() {
  // Set disableNanoSnap on both scene6State and window for compatibility
  if (scene6State.disableNanoSnap !== undefined) {
    scene6State.disableNanoSnap = true;
  }
  scene6State.disableNanoSnap = true;
  
  const nanoModel = scene6State.nanoModel;
  const expansionBoardModel = scene6State.expansionBoardModel;
  const rgbLEDModel = scene6State.rgbLEDModel;
  const jstPin = scene6State.jstPin;
  const jstPinBattery = scene6State.jstPinBattery;
  const currentScene = scene6State.currentScene;
  
  // Nano Model
  if (nanoModel) {
    nanoModel.position.copy(modelTransforms.nano1.position);
    nanoModel.rotation.copy(modelTransforms.nano1.lesson2rotation);
    nanoModel.scale.copy(modelTransforms.nano1.scale);
  }
  // Expansion Board Model
  if (expansionBoardModel) {
    expansionBoardModel.position.copy(
      modelTransforms.expansionBoard.position
    );
    expansionBoardModel.rotation.copy(
      modelTransforms.expansionBoard.lesson2rotation
    );
    expansionBoardModel.scale.copy(modelTransforms.expansionBoard.scale);
  }
  // RGB LED Model - Reset to original rotation
  if (rgbLEDModel && currentScene) {
    currentScene.remove(rgbLEDModel);
    // Reset RGB LED rotation to original position
    rgbLEDModel.rotation.copy(modelTransforms.rgbLED.rotation);
    // Optionally, also set rgbLEDModel = null; if you want to fully clear the reference
    // rgbLEDModel = null;
  }
  // JST Pin(s)
  if (jstPin) {
    if (jstPin.pinGLTF1) {
      currentScene.remove(jstPin.pinGLTF1);
    }
    if (jstPin.pinGLTF2) {
      currentScene.remove(jstPin.pinGLTF2);
    }
  }
  // Battery JST pin - reset to original rotation and position
  if (jstPinBattery && jstPinBattery.pinGLTF1) {
    try {
      jstPinBattery.pinGLTF1.rotation.y = -Math.PI / 2;
      if (typeof jstPinBattery.updatePosition === "function") {
        jstPinBattery.updatePosition(new THREE.Vector3(0.8, 1.7, -3.2), jstPinBattery.pinGLTF1);
      } else if (jstPinBattery.pinGLTF1.position) {
        jstPinBattery.pinGLTF1.position.set(0.8, 1.7, -3.2);
      }
    } catch (e) {}
  }
  setTimeout(() => {
    if (scene6State.disableNanoSnap !== undefined) {
      scene6State.disableNanoSnap = false;
    }
    scene6State.disableNanoSnap = false;
  }, 500);
}

function removeLesson2Models() {
  const jstPin = scene6State.jstPin;
  const rgbLEDModel = scene6State.rgbLEDModel;
  const currentScene = scene6State.currentScene;
  
  // Remove JST pin group
  if (jstPin && jstPin.group && currentScene) {
    currentScene.remove(jstPin.group);
  }
  // Dispose all wires
  if (jstPin && jstPin.wires) {
    jstPin.wires.forEach((wireObj) => {
      if (typeof wireObj.dispose === "function") wireObj.dispose();
    });
  }
  // Remove and hide RGB LED Model
  if (rgbLEDModel && currentScene) {
    currentScene.remove(rgbLEDModel);
    rgbLEDModel.visible = false;
  }
}

// New function to remove all lesson2 models when Next Lesson button is clicked
export function removeAllLesson2Models() {
  console.log("removeAllLesson2Models called - removing lesson2 models");

  const jstPin2 = scene6State.jstPin2;
  const nanoModel = scene6State.nanoModel;
  const expansionBoardModel = scene6State.expansionBoardModel;
  const buzzerModel = scene6State.buzzerModel;
  const currentScene = scene6State.currentScene || window.currentScene;

  // Remove jstPin2
  if (jstPin2 && jstPin2.group && currentScene) {
    console.log("Removing jstPin2 from scene");
    currentScene.remove(jstPin2.group);
  } else {
    console.log("jstPin2 not found or no scene available");
  }

  // Remove nano model
  if (nanoModel && currentScene) {
    console.log("Removing nanoModel from scene");
    currentScene.remove(nanoModel);
  } else {
    console.log("nanoModel not found or no scene available");
  }

  // Remove expansion board model
  if (expansionBoardModel && currentScene) {
    console.log("Removing expansionBoardModel from scene");
    currentScene.remove(expansionBoardModel);
  } else {
    console.log("expansionBoardModel not found or no scene available");
  }

  // Remove buzzer model
  if (buzzerModel && currentScene) {
    console.log("Removing buzzerModel from scene");
    currentScene.remove(buzzerModel);
  } else {
    console.log("buzzerModel not found or no scene available");
  }

  // Clean up global references
  scene6State.jstPin2 = null;
  scene6State.nanoModel = null;
  scene6State.expansionBoardModel = null;
  scene6State.buzzerModel = null;

  console.log("removeAllLesson2Models completed");
}

// New function to remove all lesson3 models when Next Lesson button is clicked
export function removeAllLesson3Models() {
  console.log("removeAllLesson3Models called - removing lesson3 models");

  const tempSensorModel = scene6State.tempSensorModel;
  const jstPin3 = scene6State.jstPin3;
  const nanoModel = scene6State.nanoModel;
  const expansionBoardModel = scene6State.expansionBoardModel;
  const currentScene = scene6State.currentScene;

  // Remove temperature sensor model
  if (tempSensorModel && currentScene) {
    console.log("Removing tempSensorModel from scene");
    currentScene.remove(tempSensorModel);
  } else {
    console.log("tempSensorModel not found or no scene available");
  }

  // Remove jstPin3 (if exists)
  if (jstPin3 && jstPin3.group && currentScene) {
    console.log("Removing jstPin3 from scene");
    currentScene.remove(jstPin3.group);
  } else {
    console.log("jstPin3 not found or no scene available");
  }

  // Remove nano model
  if (nanoModel && currentScene) {
    console.log("Removing nanoModel from scene");
    currentScene.remove(nanoModel);
  } else {
    console.log("nanoModel not found or no scene available");
  }

  // Remove expansion board model
  if (expansionBoardModel && currentScene) {
    console.log("Removing expansionBoardModel from scene");
    currentScene.remove(expansionBoardModel);
  } else {
    console.log("expansionBoardModel not found or no scene available");
  }

  // Clean up global references
  scene6State.tempSensorModel = null;
  scene6State.jstPin3 = null;
  scene6State.nanoModel = null;
  scene6State.expansionBoardModel = null;

  console.log("removeAllLesson3Models completed");
}

// Store event listener handlers for cleanup
let scene6EventHandlers = {};

// Setup function for scene6 event listeners - called only when scene6 is initialized
export function setupScene6EventListeners() {
  // Set up getCurrentLesson function
  scene6State.getCurrentLesson = function () {
    console.log("getCurrentLesson called, returning:", currentLessonId);
    return currentLessonId;
  };

  // Helper function to set up lesson3_s8 to lesson3_s9 transition
  function setupLesson3S8ToS9Transition() {
    console.log("🎵 Setting up lesson3_s8 → lesson3_s9 transition");
    
    // Check if we already have a listener for this transition
    if (window._lesson3S8TransitionSetUp) {
      console.log("🎵 Transition already set up, skipping...");
      return;
    }
    
    // Add event listener for when lesson3_s8 completes
    const handleLesson3S8Complete = () => {
      console.log("🎵 EVENT FIRED: lesson3_s8 finished, now playing lesson3_s9");
      try {
        console.log("🎵 Attempting to play lesson3_s9...");
        const result = playAudio('lesson3_s9');
        console.log("🎵 playAudio result:", result);
        
        // Mark that we've used this transition
        window._lesson3S8TransitionSetUp = false;
        
      } catch (e) {
        console.error("❌ Failed to play lesson3_s9 in sequence:", e);
      }
    };
    
    // Listen for the audio completion event
    window.addEventListener('audioComplete-lesson3_s8', handleLesson3S8Complete);
    console.log("🎵 Event listener added successfully for audioComplete-lesson3_s8");
    
    // Mark that we've set up this transition
    window._lesson3S8TransitionSetUp = true;
  }

  // Add global audio completion event monitoring for debugging
  scene6EventHandlers.audioCompleteLesson3S8 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson3_s8 fired!");
    
    // Always try to play lesson3_s9 when lesson3_s8 completes
    if (typeof window.getCurrentLesson === 'function' && window.getCurrentLesson() === 'lesson3') {
      console.log("🎵 AUTO-TRANSITION: lesson3_s8 completed, automatically playing lesson3_s9");
      try {
        const result = playAudio('lesson3_s9');
        console.log("🎵 Auto-transition result:", result);
      } catch (e) {
        console.error("❌ Auto-transition failed:", e);
      }
    }
  };
  window.addEventListener('audioComplete-lesson3_s8', scene6EventHandlers.audioCompleteLesson3S8);

  scene6EventHandlers.audioCompleteLesson3S6 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson3_s6 fired!");
  };
  window.addEventListener('audioComplete-lesson3_s6', scene6EventHandlers.audioCompleteLesson3S6);

  // Helper function to set up lesson3_s9 to lesson3_s10 transition
  function setupLesson3S9ToS10Transition() {
    console.log("🎵 Setting up lesson3_s9 → lesson3_s10 transition");
    if (window._lesson3S9TransitionSetUp) {
      console.log("🎵 lesson3_s9 → lesson3_s10 transition already set up, skipping...");
      return;
    }
    const handleLesson3S9Complete = () => {
      console.log("🎵 EVENT FIRED: lesson3_s9 finished, now playing lesson3_s10");
      try {
        if (!window._lesson3S10Played) {
          const result = playAudio('lesson3_s10');
          console.log("🎵 playAudio result (s10):", result);
          window._lesson3S10Played = true;
        }
      } catch (e) {
        console.error("❌ Failed to play lesson3_s10 in sequence:", e);
      } finally {
        try { window.removeEventListener('audioComplete-lesson3_s9', handleLesson3S9Complete); } catch (e) {}
        window._lesson3S9TransitionSetUp = false;
      }
    };
    window.addEventListener('audioComplete-lesson3_s9', handleLesson3S9Complete);
    window._lesson3S9TransitionSetUp = true;
  }

  // Global fallback: when lesson3_s9 completes during lesson3, ensure lesson3_s10 plays
  scene6EventHandlers.audioCompleteLesson3S9 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson3_s9 fired!");
    if (typeof window.getCurrentLesson === 'function' && window.getCurrentLesson() === 'lesson3') {
      try {
        if (!window._lesson3S10Played) {
          const result = playAudio('lesson3_s10');
          console.log("🎵 Global auto-transition result (s10):", result);
          window._lesson3S10Played = true;
        }
      } catch (e) {
        console.error("❌ Global auto-transition to lesson3_s10 failed:", e);
      }
    }
  };
  window.addEventListener('audioComplete-lesson3_s9', scene6EventHandlers.audioCompleteLesson3S9);

  // After lesson3_s10 completes, show Next Lesson button to move to lesson4
  scene6EventHandlers.audioCompleteLesson3S10 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson3_s10 fired!");
    if (typeof window.getCurrentLesson === 'function' && window.getCurrentLesson() === 'lesson3') {
      try {
        // Hide/disable forward arrow and show Next Lesson button
        try { setForwardArrowEnabled(false); } catch (e) {}
        try { if (forwardArrow) forwardArrow.visible = false; } catch (e) {}
        showNextLessonButton();
        // Do not override the global Next Lesson handler set by scene6; it performs full cleanup and setup
      } catch (e) {
        console.error('❌ Failed to show Next Lesson after lesson3_s10:', e);
      }
    }
  };
  window.addEventListener('audioComplete-lesson3_s10', scene6EventHandlers.audioCompleteLesson3S10);

  // Helper function to set up lesson4_s6 to lesson4_s7 transition
  function setupLesson4S6ToS7Transition() {
    console.log("🎵 Setting up lesson4_s6 → lesson4_s7 transition");
    
    // Check if we already have a listener for this transition
    if (window._lesson4S6TransitionSetUp) {
      console.log("🎵 Transition already set up, skipping...");
      return;
    }
    
    // Add event listener for when lesson4_s6 completes
    const handleLesson4S6Complete = () => {
      console.log("🎵 EVENT FIRED: lesson4_s6 finished, now playing lesson4_s7");
      try {
        console.log("🎵 Attempting to play lesson4_s7...");
        const result = playAudio('lesson4_s7');
        console.log("🎵 playAudio result:", result);
        
        // Mark that we've used this transition
        window._lesson4S6TransitionSetUp = false;
        
      } catch (e) {
        console.error("❌ Failed to play lesson4_s7 in sequence:", e);
      }
    };
    
    // Listen for the audio completion event
    window.addEventListener('audioComplete-lesson4_s6', handleLesson4S6Complete);
    console.log("🎵 Event listener added successfully for audioComplete-lesson4_s6");
    
    // Mark that we've set up this transition
    window._lesson4S6TransitionSetUp = true;
  }

  // Add global audio completion event monitoring for lesson4
  scene6EventHandlers.audioCompleteLesson4S6 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson4_s6 fired!");
    
    // Always try to play lesson4_s7 when lesson4_s6 completes
    if (typeof window.getCurrentLesson === 'function' && window.getCurrentLesson() === 'lesson4') {
      console.log("🎵 AUTO-TRANSITION: lesson4_s6 completed, automatically playing lesson4_s7");
      try {
        const result = playAudio('lesson4_s7');
        console.log("🎵 Auto-transition result:", result);
      } catch (e) {
        console.error("❌ Auto-transition failed:", e);
      }
    }
  };
  window.addEventListener('audioComplete-lesson4_s6', scene6EventHandlers.audioCompleteLesson4S6);

  scene6EventHandlers.audioCompleteLesson4S7 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson4_s7 fired!");
    
    // Log when lesson4_s7 completes for debugging
    if (typeof window.getCurrentLesson === 'function' && window.getCurrentLesson() === 'lesson4') {
      console.log("🎵 lesson4_s7 completed in lesson4");
    }
  };
  window.addEventListener('audioComplete-lesson4_s7', scene6EventHandlers.audioCompleteLesson4S7);

  // Add global audio completion event monitoring for lesson5 (with fallback)
  scene6EventHandlers.audioCompleteLesson5S8 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson5_s8 fired!");
    
    // Fallback: Always try to play lesson5_s9 when lesson5_s8 completes
    if (typeof window.getCurrentLesson === 'function' && window.getCurrentLesson() === 'lesson5') {
      console.log("🎵 FALLBACK: lesson5_s8 completed, automatically playing lesson5_s9");
      try {
        const result = playAudio('lesson5_s9');
        console.log("🎵 Fallback playAudio result:", result);
      } catch (e) {
        console.error("❌ Fallback failed:", e);
      }
    }
  };
  window.addEventListener('audioComplete-lesson5_s8', scene6EventHandlers.audioCompleteLesson5S8);

  scene6EventHandlers.audioCompleteLesson5S9 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson5_s9 fired!");
  };
  window.addEventListener('audioComplete-lesson5_s9', scene6EventHandlers.audioCompleteLesson5S9);

  scene6EventHandlers.audioCompleteLesson5S10 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson5_s10 fired!");
  };
  window.addEventListener('audioComplete-lesson5_s10', scene6EventHandlers.audioCompleteLesson5S10);

  scene6EventHandlers.audioCompleteLesson5S11 = () => {
    console.log("🎵 GLOBAL EVENT: audioComplete-lesson5_s11 fired!");
    
    // Automatically play the final audio after lesson5_s11 completes
    console.log("🎵 lesson5_s11 completed, automatically playing final audio");
    try {
      const result = playAudio('final');
      console.log("🎵 Final audio play result:", result);
    } catch (e) {
      console.error("❌ Failed to play final audio after lesson5_s11:", e);
    }
  };
  window.addEventListener('audioComplete-lesson5_s11', scene6EventHandlers.audioCompleteLesson5S11);
}

// Cleanup function for scene6 event listeners - called when scene6 is cleaned up
export function cleanupScene6EventListeners() {
  // Remove all event listeners
  if (scene6EventHandlers.audioCompleteLesson3S8) {
    window.removeEventListener('audioComplete-lesson3_s8', scene6EventHandlers.audioCompleteLesson3S8);
    delete scene6EventHandlers.audioCompleteLesson3S8;
  }
  if (scene6EventHandlers.audioCompleteLesson3S6) {
    window.removeEventListener('audioComplete-lesson3_s6', scene6EventHandlers.audioCompleteLesson3S6);
    delete scene6EventHandlers.audioCompleteLesson3S6;
  }
  if (scene6EventHandlers.audioCompleteLesson3S9) {
    window.removeEventListener('audioComplete-lesson3_s9', scene6EventHandlers.audioCompleteLesson3S9);
    delete scene6EventHandlers.audioCompleteLesson3S9;
  }
  if (scene6EventHandlers.audioCompleteLesson3S10) {
    window.removeEventListener('audioComplete-lesson3_s10', scene6EventHandlers.audioCompleteLesson3S10);
    delete scene6EventHandlers.audioCompleteLesson3S10;
  }
  if (scene6EventHandlers.audioCompleteLesson4S6) {
    window.removeEventListener('audioComplete-lesson4_s6', scene6EventHandlers.audioCompleteLesson4S6);
    delete scene6EventHandlers.audioCompleteLesson4S6;
  }
  if (scene6EventHandlers.audioCompleteLesson4S7) {
    window.removeEventListener('audioComplete-lesson4_s7', scene6EventHandlers.audioCompleteLesson4S7);
    delete scene6EventHandlers.audioCompleteLesson4S7;
  }
  if (scene6EventHandlers.audioCompleteLesson5S8) {
    window.removeEventListener('audioComplete-lesson5_s8', scene6EventHandlers.audioCompleteLesson5S8);
    delete scene6EventHandlers.audioCompleteLesson5S8;
  }
  if (scene6EventHandlers.audioCompleteLesson5S9) {
    window.removeEventListener('audioComplete-lesson5_s9', scene6EventHandlers.audioCompleteLesson5S9);
    delete scene6EventHandlers.audioCompleteLesson5S9;
  }
  if (scene6EventHandlers.audioCompleteLesson5S10) {
    window.removeEventListener('audioComplete-lesson5_s10', scene6EventHandlers.audioCompleteLesson5S10);
    delete scene6EventHandlers.audioCompleteLesson5S10;
  }
  if (scene6EventHandlers.audioCompleteLesson5S11) {
    window.removeEventListener('audioComplete-lesson5_s11', scene6EventHandlers.audioCompleteLesson5S11);
    delete scene6EventHandlers.audioCompleteLesson5S11;
  }

  // Clean up window functions
  if (window.getCurrentLesson && typeof window.getCurrentLesson === 'function') {
    delete window.getCurrentLesson;
  }
  
  // Clear all handlers
  scene6EventHandlers = {};
}

// Test function to manually test the audio sequence
window.testLesson3AudioSequence = function() {
  console.log("🎵 TESTING: Manual test of lesson3 audio sequence");
  console.log("🎵 Attempting to play lesson3_s8...");
  
  try {
    const result = playAudio('lesson3_s8');
    console.log("🎵 lesson3_s8 play result:", result);
    
    // Set up a manual test of the completion event
    setTimeout(() => {
      console.log("🎵 MANUAL TEST: Dispatching audioComplete-lesson3_s8 event");
      window.dispatchEvent(new CustomEvent('audioComplete-lesson3_s8'));
    }, 3000);
    
  } catch (e) {
    console.error("❌ Failed to play lesson3_s8 in test:", e);
  }
};


// Test function to manually test lesson4 audio
window.testLesson4Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson4 audio");
  console.log("🎵 Checking if lesson4 audio files are loaded...");
  
  if (allAssets && allAssets.audios) {
    console.log("🎵 Available audios:", Object.keys(allAssets.audios));
    
    const lesson4Audios = ['lesson4_s1', 'lesson4_s2', 'lesson4_s3', 'lesson4_s4', 'lesson4_s5', 'lesson4_s6', 'lesson4_s7', 'lesson4_s8', 'lesson4_s9'];
    lesson4Audios.forEach(audioName => {
      console.log(`🎵 ${audioName}:`, allAssets.audios[audioName] ? 'EXISTS' : 'MISSING');
    });
    
    // Try to play the first lesson4 audio
    try {
      console.log("🎵 Attempting to play lesson4_s1...");
      const result = playAudio('lesson4_s1');
      console.log("🎵 lesson4_s1 play result:", result);
    } catch (e) {
      console.error("❌ Failed to play lesson4_s1:", e);
    }
  } else {
    console.error("❌ allAssets or allAssets.audios not available");
  }
};

// Test function to manually test lesson4 audio sequence
window.testLesson4AudioSequence = function() {
  console.log("🎵 TESTING: Manual test of lesson4 audio sequence");
  console.log("🎵 Attempting to play lesson4_s6...");
  
  try {
    const result = playAudio('lesson4_s6');
    console.log("🎵 lesson4_s6 play result:", result);
    
    // Set up a manual test of the completion event
    setTimeout(() => {
      console.log("🎵 MANUAL TEST: Dispatching audioComplete-lesson4_s6 event");
      window.dispatchEvent(new CustomEvent('audioComplete-lesson4_s6'));
    }, 3000);
    
  } catch (e) {
    console.error("❌ Failed to play lesson4_s6 in test:", e);
  }
};

// Test function to manually test lesson4_s7 audio
window.testLesson4S7Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson4_s7 audio");
  
  try {
    const result = playAudio('lesson4_s7');
    console.log("🎵 lesson4_s7 play result:", result);
  } catch (e) {
    console.error("❌ Failed to play lesson4_s7:", e);
  }
};

// Test function to manually test lesson4_s9 audio
window.testLesson4S9Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson4_s9 audio");
  
  try {
    const result = playAudio('lesson4_s9');
    console.log("🎵 lesson4_s9 play result:", result);
  } catch (e) {
    console.error("❌ Failed to play lesson4_s9:", e);
  }
};

// Test function to manually test lesson5 audio
window.testLesson5Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson5 audio");
  console.log("🎵 Checking if lesson5 audio files are loaded...");
  
  if (allAssets && allAssets.audios) {
    console.log("🎵 Available audios:", Object.keys(allAssets.audios));
    
    const lesson5Audios = ['lesson5_s1', 'lesson5_s2', 'lesson5_s3', 'lesson5_s4', 'lesson5_s5', 'lesson5_s6', 'lesson5_s7', 'lesson5_s8', 'lesson5_s9', 'lesson5_s10', 'lesson5_s11'];
    lesson5Audios.forEach(audioName => {
      console.log(`🎵 ${audioName}:`, allAssets.audios[audioName] ? 'EXISTS' : 'MISSING');
    });
    
    // Try to play the first lesson5 audio
    try {
      console.log("🎵 Attempting to play lesson5_s1...");
      const result = playAudio('lesson5_s1');
      console.log("🎵 lesson5_s1 play result:", result);
    } catch (e) {
      console.error("❌ Failed to play lesson5_s1:", e);
    }
  } else {
    console.error("❌ allAssets or allAssets.audios not available");
  }
};

// Test function to manually test lesson5_s8 audio
window.testLesson5S8Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson5_s8 audio");
  
  try {
    const result = playAudio('lesson5_s8');
    console.log("🎵 lesson5_s8 play result:", result);
  } catch (e) {
    console.error("❌ Failed to play lesson5_s8:", e);
  }
};

// Test function to manually test lesson5_s9 audio
window.testLesson5S9Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson5_s9 audio");
  
  try {
    const result = playAudio('lesson5_s9');
    console.log("🎵 lesson5_s9 play result:", result);
  } catch (e) {
    console.error("❌ Failed to play lesson5_s9:", e);
  }
};

// Test function to manually test lesson5_s10 audio
window.testLesson5S10Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson5_s10 audio");
  
  try {
    const result = playAudio('lesson5_s10');
    console.log("🎵 lesson5_s10 play result:", result);
  } catch (e) {
    console.error("❌ Failed to play lesson5_s10:", e);
  }
};

// Test function to manually test lesson5_s11 audio
window.testLesson5S11Audio = function() {
  console.log("🎵 TESTING: Manual test of lesson5_s11 audio");
  
  try {
    const result = playAudio('lesson5_s11');
    console.log("🎵 lesson5_s11 play result:", result);
  } catch (e) {
    console.error("❌ Failed to play lesson5_s11:", e);
  }
};

// Test function to manually test final audio
window.testFinalAudio = function() {
  console.log("🎵 TESTING: Manual test of final audio");
  
  try {
    const result = playAudio('final');
    console.log("🎵 Final audio play result:", result);
  } catch (e) {
    console.error("❌ Failed to play final audio:", e);
  }
};

// Test function to manually test lesson5_s11 → final audio sequence
window.testLesson5S11ToFinalSequence = function() {
  console.log("🎵 TESTING: Manual test of lesson5_s11 → final audio sequence");
  
  try {
    const result = playAudio('lesson5_s11');
    console.log("🎵 lesson5_s11 play result:", result);
    
    // The event listener should automatically trigger final audio when lesson5_s11 completes
    console.log("🎵 lesson5_s11 started - final audio should play automatically when it completes");
  } catch (e) {
    console.error("❌ Failed to play lesson5_s11 in sequence test:", e);
  }
};

// Test function to manually test lesson5 audio sequence
window.testLesson5AudioSequence = function() {
  console.log("🎵 TESTING: Manual test of lesson5 audio sequence");
  console.log("🎵 Attempting to play lesson5_s8...");
  
  try {
    const result = playAudio('lesson5_s8');
    console.log("🎵 lesson5_s8 play result:", result);
    
    // Set up a manual test of the completion events
    setTimeout(() => {
      console.log("🎵 MANUAL TEST: Dispatching audioComplete-lesson5_s8 event");
      window.dispatchEvent(new CustomEvent('audioComplete-lesson5_s8'));
    }, 3000);
    
  } catch (e) {
    console.error("❌ Failed to play lesson5_s8 in test:", e);
  }
};

// Test function to manually test lesson5_s9 audio directly
window.testLesson5S9Direct = function() {
  console.log("🎵 TESTING: Direct test of lesson5_s9 audio");
  
  try {
    const result = playAudio('lesson5_s9');
    console.log("🎵 lesson5_s9 direct play result:", result);
  } catch (e) {
    console.error("❌ Failed to play lesson5_s9 directly:", e);
  }
};
