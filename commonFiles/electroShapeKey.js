/**
 * ============================================
 * ELECTRO CHARACTER ANIMATION MODULE
 * ============================================
 * Handles morph target (shape key) animations for the Electro character.
 * Manages:
 * - Eye expressions (Bored, Angry, Star, Eyelid, Low)
 * - Mouth/lip sync for talking
 * - Emission glow effects
 * - Animation state management
 * 
 * Features:
 * - Automatic expression cycling
 * - Synchronized talking animation
 * - Custom glow material for character eyes
 * - Start/stop animation control
 * 
 * NOTE: For best visual appearance, ensure renderer uses:
 * renderer.toneMapping = THREE.ACESFilmicToneMapping;
 */

import * as THREE from 'three';

// --- IMPORTANT REMINDER ---
// For the glow effect to look its best, make sure you set this on your renderer:
// renderer.toneMapping = THREE.ACESFilmicToneMapping;
// This is done where you create your THREE.WebGLRenderer, not inside this function.

// Shapekey names for the eyes/expressions
const expressionArray = ['Bored', 'Angry', 'Star', 'Eyelid', 'Low'];

export function setupShapeKeyAnimations(electroModel) {
  const morphTargetMeshes = [];
  const clock = new THREE.Clock();
  let isAnimating = false;

  // --- Animation state variables ---
  let currentExpressionIndex = 0; 
  let lastExpressionTime = 0;
  let nextExpressionDelay = 0;
  let isAnimatingExpression = false;
  let expressionStartTime = 0;
  let expressionDuration = 1.0;

  // Find all meshes with morph targets and apply the custom glow
  electroModel.traverse((node) => {
    if (node.isMesh && node.morphTargetDictionary) {
      
      const material = node.material;

      // --- UPDATED: Target the material by its specific name ---
      if (material && material.name === 'eyelipmaterial') {
        
        // Clone the material to ensure our changes don't affect other potential objects
        const uniqueMaterial = material.clone();
        node.material = uniqueMaterial;
        
        // Apply a strong glow using the material's existing color
        uniqueMaterial.emissive = uniqueMaterial.color.clone(); 
        uniqueMaterial.emissiveIntensity = 0.9; // Increased intensity for a powerful glow
      }
      // --- END OF UPDATE ---

      morphTargetMeshes.push(node);
      // Initialize all morph target influences to 0
      if (node.morphTargetInfluences) {
        for (let i = 0; i < node.morphTargetInfluences.length; i++) {
          node.morphTargetInfluences[i] = 0;
        }
      }
    }
  });

  // Function to set morph target value for all relevant meshes
  function setMorphTarget(targetName, value) {
    morphTargetMeshes.forEach(mesh => {
      if (mesh.morphTargetDictionary) {
        const index = mesh.morphTargetDictionary[targetName];
        if (index !== undefined && mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = value;
        }
      }
    });
  }

  // Function to generate random delay between expressions
  function getRandomExpressionDelay() {
    return 0.2 + Math.random() * 0.4;
  }

  // Function to create talking animation (This remains unchanged)
  function updateTalkingAnimation(time) {
    const baseTalking = Math.sin(time * 8) * 0.3 + 0.2;
    const quickMouth = Math.sin(time * 15) * 0.15;
    const slowMouth = Math.sin(time * 3) * 0.1;
    const talkingValue = Math.max(0, Math.min(1, baseTalking + quickMouth + slowMouth));
    
    setMorphTarget('Key 1', talkingValue);
    setMorphTarget('LIPS', talkingValue);
  }

  // Function to animate eye expressions from the array one by one
  function updateEyeExpressionAnimation(time) {
    if (!isAnimatingExpression) {
      if (time - lastExpressionTime >= nextExpressionDelay) {
        isAnimatingExpression = true;
        expressionStartTime = time;
      }
    } else {
      const progress = (time - expressionStartTime) / expressionDuration;
      const currentExpressionName = expressionArray[currentExpressionIndex];

      if (progress <= 1) {
        const value = Math.sin(progress * Math.PI);
        setMorphTarget(currentExpressionName, value);
      } else {
        setMorphTarget(currentExpressionName, 0);
        currentExpressionIndex = (currentExpressionIndex + 1) % expressionArray.length;
        isAnimatingExpression = false;
        lastExpressionTime = time;
        nextExpressionDelay = getRandomExpressionDelay();
      }
    }
  }

  function startAnimation() {
    isAnimating = true;
    const startTime = clock.getElapsedTime();
    lastExpressionTime = startTime;
    nextExpressionDelay = getRandomExpressionDelay();
    isAnimatingExpression = false;
    currentExpressionIndex = 0;
    
    const animate = () => {
      if (!isAnimating) return;
      
      const time = clock.getElapsedTime();
      
      updateTalkingAnimation(time);
      updateEyeExpressionAnimation(time);
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  function stopAnimation() {
    isAnimating = false;
    isAnimatingExpression = false;
    
    morphTargetMeshes.forEach(mesh => {
      if (mesh.morphTargetInfluences) {
        for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
          mesh.morphTargetInfluences[i] = 0;
        }
      }
    });
  }

  return { startAnimation, stopAnimation };
}

