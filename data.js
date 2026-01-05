// data.js - Centralized game data management for the VR experience.
// Handles:
//   - Local in-memory scene definitions (start positions, checkpoints, saved positions)
//   - User selections (character + mode)
//   - Game state (current / start scenes, completed / visited scenes)
//   - Synchronization with Firebase + localStorage for persistence

import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./WebFiles/firebase.js";  // Adjust path if needed

// ---------------------------------------------------------------------------
// Core game data model
// ---------------------------------------------------------------------------

const gameData = {
  // Basic user selections made from the UI (character + VR/Web mode).
  userInfo: {
    selectedCharacter: "EMLY 4.glb", // Default character asset path.
    modeSelected: "non-vr", // Default mode (Web experience).
  },

  // Per‑scene configuration: start positions, checkpoints, and last saved
  // positions. These are consumed by the various scene initializers.
  scene1: {
    startPosition: {
      position: { x: -6, y: 20, z: -58},
      rotation: { y: Math.PI},
      cameraPosition: { x: 0, y: 5, z: -3 },
    },
    checkpoints: {
      electroIntro: {
        position: { x: 11.6, y: 10.2, z: -20 },
        rotation: { y: Math.PI },
        cameraPosition: { x: 0, y: 5, z: -3 },
      },
      resistorGame: {
        position: { x: -30.462, y: 5.359, z: -11.111 },
        rotation: { y: Math.PI },
        cameraPosition: { x: 0, y: 5, z: -3 },
      }
      // Add more checkpoints as needed
    },
    savedPosition: {
      position: null,
      rotation: null,
      cameraPosition: null,
    },
  },
  scene2: {
    startPosition: {
      position: { x: -0.16, y: 4.3, z: -256 },
      rotation: { y: Math.PI },
      cameraPosition: { x: 0, y: 0, z: 3 },
    },
    checkpoints: {
      university: {
        position: { x: 0, y: 38, z: 2490 },
        rotation: { y: 0 },
        cameraPosition: { x: 0, y: 43, z: 2500 },
      },
      // Add more checkpoints as needed
    },
    savedPosition: {
      position: null,
      rotation: null,
      cameraPosition: null,
    },
  },
  scene3: {
    startPosition: {
      position: { x: -5, y: 8, z: -130},
      rotation: { y: 0 },
      cameraPosition: { x: 0, y: 1, z: 0 },
    },
    checkpoints: {
      university: {
        position: { x: 0, y: 38, z: 2490 },
        rotation: { y: 0 },
        cameraPosition: { x: 0, y: 43, z: 2500 },
      },
    },
    savedPosition: {
      position: null,
      rotation: null,
      cameraPosition: null,
    },
  },
  scene4: {
    startPosition: {
      position: { x: -15, y: 0, z: 0 },
      rotation: { y: Math.PI/2 },
      cameraPosition: { x: 0, y: 1, z: 0 },
    },
    checkpoints: {
      university: {
        position: { x: 0, y: 38, z: 2490 },
        rotation: { y: 0 },
        cameraPosition: { x: 0, y: 43, z: 2500 },
      },
    },
    savedPosition: {
      position: null,
      rotation: null,
      cameraPosition: null,
    },
  },
  scene5: {
    startPosition: {
      position: { x: -31, y: 5, z: -0.5},
      rotation: { y: Math.PI/2 },
      cameraPosition: { x: 0, y: 1, z: 0 },
    },
    checkpoints: {
      university: {
        position: { x: 0, y: 8, z: -2 },
        rotation: { y: 0 },
        cameraPosition: { x: 0, y: 3, z: -5 },
      },
    },
    savedPosition: {
      position: null,
      rotation: null,
      cameraPosition: null,
    },
  },
  scene6: {
    startPosition: {
      position: { x: 0, y: 2, z: -2 },
      rotation: { y: 0 },
      cameraPosition: { x: 0, y: 2, z: 0 },
    },
    checkpoints: {
      university: {
        position: { x: 0, y: 0, z: -2 },
        rotation: { y: 0 },
        cameraPosition: { x: 0, y: 3, z: -5 },
      },
    },
    savedPosition: {
      position: null,
      rotation: null,
      cameraPosition: null,
    },
  },
  scene7: {
    startPosition: {
      position: { x: 0, y: 2, z: -2 },
      rotation: { y: 0 },
      cameraPosition: { x: 0.4, y: 2, z: 0 },
    },
    checkpoints: {},  // No checkpoints defined yet
    savedPosition: {
      position: null,
      rotation: null,
      cameraPosition: null,
    },
  },
  // Global game state not tied to any specific scene definition.
  gameState: {
    startScene: "scene1",     // Scene to load when the experience starts.
    currentScene: "scene1",   // Scene currently active.
    completedScenes: {},      // Local fallback for completed scenes.
    // visitedScenes is added lazily when first used.
  },
};

// ---------------------------------------------------------------------------
// User info helpers
// ---------------------------------------------------------------------------

/**
 * Updates the in‑memory user information (selected character and mode).
 *
 * Any parameter passed as null will be ignored, allowing partial updates.
 *
 * @param {string|null} character - GLB file path of the selected character.
 * @param {string|null} mode - Either "vr" or "non-vr".
 */
export function updateUserInfo(character, mode) {
  if (character !== null) {
    gameData.userInfo.selectedCharacter = character;
  }
  if (mode !== null) {
    gameData.userInfo.modeSelected = mode;
  }
  console.log("Updated user info:", gameData.userInfo);
}

/**
 * Returns the current user info object.
 *
 * @returns {{ selectedCharacter: string, modeSelected: string }}
 */
export function getUserInfo() {
  return gameData.userInfo;
}

// ---------------------------------------------------------------------------
// Generalized scene accessors / mutators
// ---------------------------------------------------------------------------

/**
 * Gets the configuration object for a given scene name.
 *
 * @param {string} sceneName - e.g. "scene1", "scene2", etc.
 * @returns {object|null} Scene configuration or null if not found.
 */
export function getSceneData(sceneName) {
  if (gameData[sceneName]) {
    return gameData[sceneName];
  }
  console.warn(`No data found for scene: ${sceneName}`);
  return null;
}

/**
 * Updates a named checkpoint for a scene with new transform and camera data.
 *
 * @param {string} sceneName - Scene identifier.
 * @param {string} checkpointName - Key within sceneData.checkpoints.
 * @param {object} position - { x, y, z } world position of the checkpoint.
 * @param {object} rotation - Rotation info (usually { y }).
 * @param {object|null} cameraPosition - Optional camera position at checkpoint.
 * @param {object|null} controlsTarget - Optional controls target (e.g. orbit target).
 */
export function updateCheckpoint(sceneName, checkpointName, position, rotation, cameraPosition = null, controlsTarget = null) {
  const sceneData = gameData[sceneName];
  if (sceneData && sceneData.checkpoints[checkpointName]) {
    sceneData.checkpoints[checkpointName] = {
      position: { ...position },
      rotation: { ...rotation },
      cameraPosition: cameraPosition ? { ...cameraPosition } : null,
      controlsTarget: controlsTarget ? { ...controlsTarget } : null,
    };

  } else {
    console.warn(`Checkpoint '${checkpointName}' not found in ${sceneName}`);
  }
}

/**
 * Stores a "saved" position for a scene (e.g. last checkpoint reached) and
 * also updates the scene's startPosition to resume from there next time.
 *
 * @param {string} sceneName
 * @param {object} position
 * @param {object} rotation
 * @param {object|null} cameraPosition
 * @param {object|null} controlsTarget
 */
export function updateSavedPosition(sceneName, position, rotation, cameraPosition = null, controlsTarget = null) {
  const sceneData = gameData[sceneName];
  if (sceneData) {
    sceneData.savedPosition = {
      position: { ...position },
      rotation: { ...rotation },
      cameraPosition: cameraPosition ? { ...cameraPosition } : null,
      controlsTarget: controlsTarget ? { ...controlsTarget } : null,
    };
    // Update start position to match saved position
    sceneData.startPosition = {
      ...sceneData.startPosition,
      position: { ...position },
      rotation: { ...rotation },
      cameraPosition: cameraPosition ? { ...cameraPosition } : null,
      controlsTarget: controlsTarget ? { ...controlsTarget } : null,
    };

  } else {
    console.warn(`Scene data not found: ${sceneName}`);
  }
}

/**
 * Returns the configured start position for a scene.
 *
 * @param {string} sceneName
 * @returns {object|null}
 */
export function getStartPosition(sceneName) {
  const sceneData = getSceneData(sceneName);
  return sceneData ? sceneData.startPosition : null;
}

/**
 * Returns the configuration of a named checkpoint in a scene.
 *
 * @param {string} sceneName
 * @param {string} checkpointName
 * @returns {object|null}
 */
export function getCheckpoint(sceneName, checkpointName) {
  const sceneData = getSceneData(sceneName);
  return sceneData && sceneData.checkpoints[checkpointName] ? sceneData.checkpoints[checkpointName] : null;
}

/**
 * Returns the last saved position for the given scene, or null if none.
 *
 * @param {string} sceneName
 * @returns {object|null}
 */
export function getSavedPosition(sceneName) {
  const sceneData = getSceneData(sceneName);
  return sceneData ? sceneData.savedPosition : null;
}

/**
 * Overrides the start position for the given scene.
 *
 * Useful for debugging, or changing spawn points after the scene is loaded.
 *
 * @param {string} sceneName
 * @param {object} position
 * @param {object} rotation
 * @param {object|null} cameraPosition
 * @param {object|null} controlsTarget
 */
export function setStartPosition(sceneName, position, rotation, cameraPosition = null, controlsTarget = null) {
  const sceneData = gameData[sceneName];
  if (sceneData) {
    sceneData.startPosition = {
      position: { ...position },
      rotation: { ...rotation },
      cameraPosition: cameraPosition ? { ...cameraPosition } : null,
      controlsTarget: controlsTarget ? { ...controlsTarget } : null,
    };
   
  } else {
    console.warn(`Scene data not found: ${sceneName}`);
  }
}

// ---------------------------------------------------------------------------
// User info completeness & start / current scene helpers
// ---------------------------------------------------------------------------

/**
 * Helper to check that the minimum user info is set prior to starting
 * the VR experience (character + mode).
 *
 * @returns {boolean}
 */
export function isUserInfoComplete() {
  return (
    gameData.userInfo.selectedCharacter !== "" &&
    gameData.userInfo.modeSelected !== ""
  );
}

/**
 * Sets the scene that should load first when the experience starts.
 * Also mirrors this value to localStorage for persistence across reloads.
 *
 * @param {string} sceneName
 */
export function setStartScene(sceneName) {

  gameData.gameState.startScene = sceneName;
  // Also store in localStorage for persistence across refreshes
  if (typeof window !== 'undefined') {
    localStorage.setItem('loadScene', sceneName);

  }
}

/**
 * Returns the start scene.
 *
 * Priority:
 *   1. User's last chosen scene from localStorage (loadScene).
 *   2. Fallback to default from gameData.gameState.startScene.
 *
 * @returns {string}
 */
export function getStartScene() {
  // First try to get from localStorage (user's last selection)
  if (typeof window !== 'undefined') {
    const savedScene = localStorage.getItem('loadScene');
    if (savedScene) {
 
      return savedScene;
    }
  }
  // Fallback to the default from gameData
  console.log(`getStartScene: Using default scene: ${gameData.gameState.startScene}`);
  return gameData.gameState.startScene;
}

/**
 * Sets which scene is currently active and mirrors this to localStorage.
 *
 * @param {string} sceneName
 */
export function setCurrentScene(sceneName) {
  gameData.gameState.currentScene = sceneName;
  
  // Also store in localStorage for persistence
  if (typeof window !== 'undefined') {
    localStorage.setItem('currentScene', sceneName);
  }
  console.log(`setCurrentScene: Set to ${sceneName}`);
}

/**
 * Returns the current scene name and its associated configuration object.
 *
 * @returns {{ currentScene: string, currentSceneData: object|null }}
 */
export function getCurrentScene() {
  // First try to get from localStorage
  if (typeof window !== 'undefined') {
    const currentScene = localStorage.getItem('currentScene');
    if (currentScene) {
      gameData.gameState.currentScene = currentScene;
    }
  }
  
  const current = gameData.gameState.currentScene;
  return {
    currentScene: current,
    currentSceneData: getSceneData(current),
  };
}

/**
 * Marks the current scene as completed in Firebase and localStorage.
 * Enhanced to trigger falling effect and return Promise for transitions.
 * @param {string} sceneName - The scene to mark (e.g., "scene3")
 * @param {Object} [context] - Optional: { scene, camera, allAssets, player, fallingEffectFn } for falling effect
 * @returns {Promise<void>} Resolves after marking and effect trigger
 */
export async function markSceneCompleted(sceneName, context = {}) {
  if (!auth.currentUser) {
    console.warn("No user authenticated; skipping scene completion mark.");
    // Fallback to local only
    _markLocalOnly(sceneName);
    return;
  }

  try {
    // 1. Update Firebase
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      [`scenesCompleted.${sceneName}`]: true,
      lastCompletedScene: sceneName,
      updatedAt: new Date().toISOString()
    });

    // 2. Update localStorage (for offline/resilience)
    _markLocalOnly(sceneName);



    // 3. Trigger falling effect if context provided
    if (context && (typeof window.initializeFallingEffect === 'function' || context.fallingEffectFn)) {

      const fallingFn = window.initializeFallingEffect || context.fallingEffectFn;
      await fallingFn(
        context.scene || null,
        context.camera || null,
        context.allAssets || null,
        context.player || null
      );
    }

    // Optional: Scene-specific hook
    if (typeof window.onSceneCompleted === 'function') {
      window.onSceneCompleted(sceneName, context);
    }

  } catch (error) {
    console.error(`Error marking ${sceneName} as completed:`, error);
    // Fallback to localStorage only
    _markLocalOnly(sceneName);
  }
}

// Internal helper for local-only completion marking.
function _markLocalOnly(sceneName) {
  if (!gameData.gameState.completedScenes) {
    gameData.gameState.completedScenes = {};
  }
  gameData.gameState.completedScenes[sceneName] = true;
  
  if (typeof window !== 'undefined') {
    const completedScenes = JSON.parse(localStorage.getItem('completedScenes') || '{}');
    completedScenes[sceneName] = true;
    localStorage.setItem('completedScenes', JSON.stringify(completedScenes));
  }
  

}

/**
 * Returns a map of scenes that have been completed.
 *
 * If the user is authenticated:
 *   - Fetches from Firebase, merges with any local data, and persists merged
 *     results back into localStorage and gameData.
 * Otherwise:
 *   - Falls back to localStorage or in-memory state only.
 *
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getCompletedScenes() {
  // Sync from Firebase first if authenticated
  if (auth.currentUser) {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : {};
      const firebaseScenes = data.scenesCompleted || {};
      
      // Merge with local (prioritize Firebase)
      if (typeof window !== 'undefined') {
        const localScenes = JSON.parse(localStorage.getItem('completedScenes') || '{}');
        const merged = { ...localScenes, ...firebaseScenes };
        localStorage.setItem('completedScenes', JSON.stringify(merged));
        gameData.gameState.completedScenes = merged;
        return merged;
      }
      gameData.gameState.completedScenes = firebaseScenes;
      return firebaseScenes;
    } catch (error) {
      console.error("Error fetching completed scenes from Firebase:", error);
    }
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const completedScenes = JSON.parse(localStorage.getItem('completedScenes') || '{}');
    gameData.gameState.completedScenes = completedScenes;
    return completedScenes;
  }
  
  // Ultimate fallback
  return gameData.gameState.completedScenes || {};
}

/**
 * Marks the scene as visited (unlocked for entry) in Firebase/localStorage.
 * Called on scene entry, not completion.
 * @param {string} sceneName - The scene to mark as visited.
 * @returns {Promise<void>}
 */
export async function markSceneVisited(sceneName) {
  if (!auth.currentUser) {
    console.warn("No user authenticated; skipping scene visit mark.");
    _markLocalOnlyVisited(sceneName);
    return;
  }

  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      [`scenesVisited.${sceneName}`]: true,
      lastVisitedScene: sceneName,
      updatedAt: new Date().toISOString()
    });

    _markLocalOnlyVisited(sceneName);

 
  } catch (error) {
    console.error(`Error marking ${sceneName} as visited:`, error);
    _markLocalOnlyVisited(sceneName);
  }
}

// Internal helper for local-only visited marking.
function _markLocalOnlyVisited(sceneName) {
  if (!gameData.gameState.visitedScenes) {
    gameData.gameState.visitedScenes = {};
  }
  gameData.gameState.visitedScenes[sceneName] = true;
  
  if (typeof window !== 'undefined') {
    const visitedScenes = JSON.parse(localStorage.getItem('visitedScenes') || '{}');
    visitedScenes[sceneName] = true;
    localStorage.setItem('visitedScenes', JSON.stringify(visitedScenes));
  }

}

/**
 * Returns a map of scenes that have been visited (unlocked).
 *
 * Behavior mirrors getCompletedScenes, but for the scenesVisited key.
 *
 * @returns {Promise<Record<string, boolean>>}
 */
export async function getVisitedScenes() {
  // Similar to getCompletedScenes, but for scenesVisited
  if (auth.currentUser) {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : {};
      const firebaseVisited = data.scenesVisited || {};
      
      if (typeof window !== 'undefined') {
        const localVisited = JSON.parse(localStorage.getItem('visitedScenes') || '{}');
        const merged = { ...localVisited, ...firebaseVisited };
        localStorage.setItem('visitedScenes', JSON.stringify(merged));
        gameData.gameState.visitedScenes = merged;
        return merged;
      }
      gameData.gameState.visitedScenes = firebaseVisited;
      return firebaseVisited;
    } catch (error) {
      console.error("Error fetching visited scenes from Firebase:", error);
    }
  }
  
  if (typeof window !== 'undefined') {
    const visitedScenes = JSON.parse(localStorage.getItem('visitedScenes') || '{}');
    gameData.gameState.visitedScenes = visitedScenes;
    return visitedScenes;
  }
  
  return gameData.gameState.visitedScenes || {};
}