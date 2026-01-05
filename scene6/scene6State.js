/**
 * About: `scene6/scene6State.js`
 *
 * Centralized shared state for Scene 6.
 * Exposes the `scene6State` Proxy used across modules to avoid relying on `window.*` globals.
 */

"use strict"; // Enable strict mode for safer JavaScript

// Centralized state management for scene6
// This replaces the use of window object for storing models and state

/**
 * Backing store for all Scene 6 state.
 * Access this via the exported Proxy `scene6State` instead of mutating directly.
 */
const state = {
  // Scene and camera references
  currentScene: null,
  camera: null,
  orbitControls: null,
  
  // 3D Models
  nanoModel: null,
  expansionBoardModel: null,
  rgbLEDModel: null,
  buzzerModel: null,
  tempSensorModel: null,
  batteryModel: null,
  
  // JST Pins
  jstPin: null,
  jstPin2: null,
  jstPin3: null,
  jstPinBattery: null,
  
  // JST Pin sides (for raycaster)
  jstPinBatterySide1: null,
  jstPin3Side1: null,
  jstPin3Side2: null,
  jstPin2Side1: null,
  jstPin2Side2: null,
  secondPin4Female: null,
  
  // Raycaster setup
  raycasterSetup: null,
  
  // UI elements
  codeEditorGroup: null,
  codePlane: null,
  forwardArrow: null,
  setForwardArrowEnabled: null,
  getCurrentStep: null,
  showNextLessonButton: null,
  hideNextLessonButton: null,
  
  // RGB LED blink shader
  rgbLEDBlinkMaterial: null,
  rgbLEDBlinkMesh: null,
  applyRGBLEDBlinkShader: null,
  
  // Lesson management
  getCurrentLesson: null,
  lesson1CameraGUI: null,
  currentLessonId: null,
  
  // UI buttons
  nextLessonButton: null,
  runCodeButton: null,
  makeSomeNoiseButton: null,
  
  // External functions
  setCodeEditorLesson: null,
  hideQuestionsPanel: null,
  setOnNextLesson: null,
  
  // Event handlers
  _runCodeRaycastHandler: null,
  _codeEditorRaycastHandler: null,
  _scene6RaycastHandler: null,
  _nextLessonRaycastHandler: null,
  _lesson2S8AudioHandler: null,
  _makeSomeNoiseRaycastHandler: null,
  
  // Lesson flags
  _lesson1StartCodingAudioPlayed: false,
  _lesson1ContinueAudioPlayed: false,
  _lesson3StartCodingAudioPlayed: false,
  _lesson3S8TransitionSetUp: false,
  _lesson3S9TransitionSetUp: false,
  _lesson3S10Played: false,
  _lesson4S6TransitionSetUp: false,
  _lesson5AudioSequenceSetUp: false,
  _lesson5ContinueAudioPlayed: false,
  _lesson4_s8Played: false,
  _lesson4_s9Played: false,
  _lesson5_s10Played: false,
  _lesson5_s11Played: false,
  _motorLessonInitialized: false,
  _irLessonInitialized: false,
  
  // Camera and animation
  cameraAnimationDisabled: false,
  _sceneCamera: null,
  
  // Other state
  disableNanoSnap: false,
};

// Export getter functions for accessing state
/**
 * Centralized state proxy for Scene 6.
 * Using a Proxy keeps the API simple while allowing us to swap internals later.
 */
export const scene6State = new Proxy(state, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  }
});

// Cleanup function to reset all state
/**
 * Reset all Scene 6 state fields back to safe defaults.
 * Call this when leaving Scene 6 to avoid memory leaks and stale references.
 */
export function cleanupScene6State() {
  // Reset all model references
  state.nanoModel = null;
  state.expansionBoardModel = null;
  state.rgbLEDModel = null;
  state.buzzerModel = null;
  state.tempSensorModel = null;
  state.batteryModel = null;
  
  // Reset JST pins
  state.jstPin = null;
  state.jstPin2 = null;
  state.jstPin3 = null;
  state.jstPinBattery = null;
  state.jstPinBatterySide1 = null;
  state.jstPin3Side1 = null;
  state.jstPin3Side2 = null;
  state.jstPin2Side1 = null;
  state.jstPin2Side2 = null;
  state.secondPin4Female = null;
  
  // Reset scene and camera
  state.currentScene = null;
  state.camera = null;
  state.orbitControls = null;
  
  // Reset raycaster
  state.raycasterSetup = null;
  
  // Reset UI
  state.codeEditorGroup = null;
  state.codePlane = null;
  state.forwardArrow = null;
  state.setForwardArrowEnabled = null;
  state.getCurrentStep = null;
  state.showNextLessonButton = null;
  state.hideNextLessonButton = null;
  
  // Reset shader
  state.rgbLEDBlinkMaterial = null;
  state.rgbLEDBlinkMesh = null;
  state.applyRGBLEDBlinkShader = null;
  
  // Reset lesson management
  state.getCurrentLesson = null;
  state.lesson1CameraGUI = null;
  state.currentLessonId = null;
  
  // Reset UI buttons
  state.nextLessonButton = null;
  state.runCodeButton = null;
  state.makeSomeNoiseButton = null;
  
  // Reset external functions
  state.setCodeEditorLesson = null;
  state.hideQuestionsPanel = null;
  state.setOnNextLesson = null;
  
  // Reset event handlers
  state._runCodeRaycastHandler = null;
  state._codeEditorRaycastHandler = null;
  state._scene6RaycastHandler = null;
  state._nextLessonRaycastHandler = null;
  state._lesson2S8AudioHandler = null;
  state._makeSomeNoiseRaycastHandler = null;
  
  // Reset lesson flags
  state._lesson1StartCodingAudioPlayed = false;
  state._lesson1ContinueAudioPlayed = false;
  state._lesson3StartCodingAudioPlayed = false;
  state._lesson3S8TransitionSetUp = false;
  state._lesson3S9TransitionSetUp = false;
  state._lesson3S10Played = false;
  state._lesson4S6TransitionSetUp = false;
  state._lesson5AudioSequenceSetUp = false;
  state._lesson5ContinueAudioPlayed = false;
  state._lesson4_s8Played = false;
  state._lesson4_s9Played = false;
  state._lesson5_s10Played = false;
  state._lesson5_s11Played = false;
  state._motorLessonInitialized = false;
  state._irLessonInitialized = false;
  
  // Reset camera and animation
  state.cameraAnimationDisabled = false;
  state._sceneCamera = null;
  
  // Reset other state
  state.disableNanoSnap = false;
}

