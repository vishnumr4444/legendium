/**
 * ============================================
 * AUDIO MANAGER MODULE
 * ============================================
 * Centralized audio management system for the game.
 * Handles:
 * - Playing sound effects and background music
 * - 3D positional audio (sounds from specific positions in the scene)
 * - Volume control and audio listener management
 * - Cleanup and disposal of audio resources
 * - Prevention of audio memory leaks
 * 
 * Features:
 * - Supports both global and positional audio
 * - Auto-converts audio to positional when needed
 * - Tracks all active audio instances
 * - Properly disposes resources on cleanup
 */

import { allAssets } from "./assetsLoader.js";
import * as THREE from "three";

// Map to track all active audio instances to prevent memory leaks
const audioInstances = new Map();
const DEFAULT_RADIUS = 10; // Default distance for 3D positional audio attenuation

let currentCamera = null;
let currentScene = null;

export const initializeAudioManager = (camera, scene) => {
  currentCamera = camera;
  currentScene = scene;
};

export const cleanupAudioManager = () => {
  // Stop and dispose of all audio instances
  audioInstances.forEach((audio, audioName) => {
    if (audio instanceof THREE.PositionalAudio) {
      // Stop the audio
      audio.stop();
      
      // Remove from scene
      if (currentScene) {
        currentScene.remove(audio);
      }
      
      // Remove listener from camera
      if (currentCamera && audio.listener) {
        currentCamera.remove(audio.listener);
      }
    } else if (audio instanceof HTMLAudioElement) {
      // Stop and reset HTML audio
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    }
  });

  // Clear all instances
  audioInstances.clear();

  // Reset camera and scene references
  currentCamera = null;
  currentScene = null;

  // Clear any Three.js audio objects from allAssets
  Object.keys(allAssets.audios).forEach(key => {
    const audio = allAssets.audios[key];
    if (audio instanceof THREE.Audio || audio instanceof THREE.PositionalAudio) {
      audio.stop();
      // Remove listener from camera if it exists
      if (audio.listener && currentCamera) {
        currentCamera.remove(audio.listener);
      }
    }
  });
};

export const playAudio = (audioName, position = null, radius = null) => {
  if (!currentCamera || !currentScene) {
    console.warn('Audio manager not initialized. Call initializeAudioManager first.');
    return null;
  }

  console.log('Attempting to play audio:', audioName);
  
  // Get the audio from allAssets
  const audio = allAssets.audios[audioName];
  
  if (!audio) {
    console.warn(`Audio "${audioName}" not found in assets`);
    return null;
  }

  // For Three.js Audio objects
  if (audio.isObject3D) {
    // Handle positional audio
    if (position) {
      // If it's not already a positional audio, convert it
      if (!(audio instanceof THREE.PositionalAudio)) {
        const listener = new THREE.AudioListener();
        currentCamera.add(listener);
        
        // Create new positional audio
        const positionalAudio = new THREE.PositionalAudio(listener);
        positionalAudio.setBuffer(audio.buffer);
        positionalAudio.setVolume(audio.volume || 1);
        positionalAudio.setLoop(audio.loop || false);
        
        // Set position and radius
        positionalAudio.position.copy(position);
        positionalAudio.setRefDistance(radius || DEFAULT_RADIUS);
        
        // Add to scene
        currentScene.add(positionalAudio);
        
        // Store reference
        audioInstances.set(audioName, positionalAudio);
        
        // Add completion listener
        positionalAudio.onEnded = () => {
          console.log(`Audio ${audioName} completed`);
          window.dispatchEvent(new CustomEvent(`audioComplete-${audioName}`));
        };
        
        // Play the audio
        positionalAudio.play();
        return positionalAudio;
      } else {
        // Update existing positional audio
        audio.position.copy(position);
        if (radius) {
          audio.setRefDistance(radius);
        }
        // Add completion listener
        audio.onEnded = () => {
          console.log(`Audio ${audioName} completed`);
          window.dispatchEvent(new CustomEvent(`audioComplete-${audioName}`));
        };
        audio.play();
        return audio;
      }
    } else {
      // Regular non-positional audio
      audio.setVolume(audio.volume || 1);
      audio.setLoop(audio.loop || false);
      // Add completion listener
      audio.onEnded = () => {
        console.log(`Audio ${audioName} completed`);
        window.dispatchEvent(new CustomEvent(`audioComplete-${audioName}`));
      };
      audio.play();
      return audio;
    }
  }

  // Fallback for regular HTML Audio objects (non-positional)
  if (!audioInstances.has(audioName)) {
    const audioInstance = new Audio(audio.path);
    audioInstance.volume = audio.volume || 1;
    audioInstance.loop = audio.loop || false;
    // Add completion listener
    audioInstance.addEventListener('ended', () => {
      console.log(`Audio ${audioName} completed`);
      window.dispatchEvent(new CustomEvent(`audioComplete-${audioName}`));
    });
    audioInstances.set(audioName, audioInstance);
  }

  const audioInstance = audioInstances.get(audioName);
  audioInstance.play().catch(error => {
    console.warn(`Failed to play audio "${audioName}":`, error);
  });

  return audioInstance;
};

export const stopAudio = (audioName) => {
  const audio = allAssets.audios[audioName];
  if (audio && audio.isObject3D) {
    audio.stop();
    return;
  }

  const audioInstance = audioInstances.get(audioName);
  if (audioInstance) {
    audioInstance.pause();
    audioInstance.currentTime = 0;
  }
};

export const pauseAudio = (audioName) => {
  const audio = allAssets.audios[audioName];
  if (audio && audio.isObject3D) {
    audio.pause();
    return;
  }

  const audioInstance = audioInstances.get(audioName);
  if (audioInstance) {
    audioInstance.pause();
  }
};

export const resumeAudio = (audioName) => {
  const audio = allAssets.audios[audioName];
  if (audio && audio.isObject3D) {
    audio.play();
    return;
  }

  const audioInstance = audioInstances.get(audioName);
  if (audioInstance) {
    audioInstance.play().catch(error => {
      console.warn(`Failed to resume audio "${audioName}":`, error);
    });
  }
};

export const setVolume = (audioName, volume) => {
  const audio = allAssets.audios[audioName];
  if (audio && audio.isObject3D) {
    audio.setVolume(volume);
    return;
  }

  const audioInstance = audioInstances.get(audioName);
  if (audioInstance) {
    audioInstance.volume = Math.max(0, Math.min(1, volume));
  }
};

// Helper function to update audio position
export const updateAudioPosition = (audioName, position, radius = null) => {
  const audio = audioInstances.get(audioName);
  if (audio && audio instanceof THREE.PositionalAudio) {
    audio.position.copy(position);
    if (radius) {
      audio.setRefDistance(radius);
    }
  }
};
