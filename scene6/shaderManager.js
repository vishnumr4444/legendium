/**
 * About: `scene6/shaderManager.js`
 *
 * Central shader/highlight manager for Scene 6.
 * Handles step-based highlight shaders, drag/snap feedback, and small MeshUI labels.
 */

"use strict"; // Enable strict mode for safer JavaScript

// Central shader manager for Scene 6.
// Handles step-based highlight shaders, drag/snap visual feedback, and UI labels.
import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import ConsolasFontJSON from '../fonts/CONSOLAS-msdf.json';
import ConsolasFontImage from '../fonts/CONSOLAS.png';
import { scene6State } from './scene6State.js';

// Vertex shader for blinking effect
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader with blinking effect
const fragmentShader = `
  uniform float time;
  uniform vec3 baseColor;
  uniform vec3 glowColor;
  uniform float blinkSpeed;
  uniform float glowIntensity;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    // Create a pulsing effect based on time
    float pulse = sin(time * blinkSpeed) * 0.5 + 0.5;
    
    // Create a glow effect that pulses
    float glow = pulse * glowIntensity;
    
    // Mix base color with glow color based on pulse
    vec3 finalColor = mix(baseColor, glowColor, glow);
    
    // Add some variation based on position for more interesting effect
    float positionVariation = sin(vPosition.x * 10.0 + time) * 0.1 + 0.9;
    finalColor *= positionVariation;
    
    // Add edge glow effect
    float edgeGlow = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    edgeGlow = pow(edgeGlow, 2.0);
    finalColor += glowColor * edgeGlow * pulse * 0.3;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Configuration for each lesson and step
const SHADER_CONFIG = {
  lesson1: {
    0: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x3498db,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPinAndApplyToRgbPin1',
      onDragEnd: 'none',
      onSnap: 'removeFromRgbPin1'
    },
    1: {
      target: 'jstPin.pinGLTF2',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0xe74c3c,
        blinkSpeed: 2.5,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromJstPinAndApplyToRgbPin',
      onDragEnd: 'none',
      onSnap: 'removeFromRgbPin'
    },
    2: {
        target: 'nanoModel',
        action: 'blink',
        config: {
            baseColor: 0x2c3e50,
            glowColor: 0x9b59b6,
            blinkSpeed: 2.0,
            glowIntensity: 0.9
        },
        onDragStart: 'removeFromNanoApplyToExpansionNano',
        onDragEnd: 'none',
        onSnap: 'removeFromExpansionNano'
    },
    3: {
      target: 'jstPinBattery.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0xe74c3c,
        blinkSpeed: 2.0,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromJstPinBatteryAndApplyToPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromPowerPin'
    }
  },
  lesson2: {
    1: {
      target: 'jstPin2.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0xf39c12,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPin2AndApplyToBuzzer',
      onDragEnd: 'none',
      onSnap: 'removeFromBuzzer'
    },
    2: {
      target: 'jstPin2.pinGLTF2',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x9b59b6,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPin2AndApplyToMalePin',
      onDragEnd: 'none',
      onSnap: 'removeFromMalePin'
    },
    3: {
      target: 'nanoModel',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x9b59b6,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromNanoApplyToExpansionNano',
      onDragEnd: 'none',
      onSnap: 'removeFromExpansionNano'
    },
    4: {
      target: 'jstPinBattery.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x9b59b6,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPinBatteryAndApplyToPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromPowerPin'
    }
   
  },
  lesson3: {
    1: {
      target: 'nanoModel',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x9b59b6,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromNanoApplyToExpansionNano',
      onDragEnd: 'none',
      onSnap: 'removeFromExpansionNano'
    },
    2: {
      target: 'jstPin2.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x1abc9c,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPin2AndApplyToLdrPin',
      onDragEnd: 'none',
      onSnap: 'removeFromLdrPin'
    },
    3: {
      target: 'jstPin2.pinGLTF2',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x1abc9c,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPin2AndApplyToLdr',
      onDragEnd: 'none',
      onSnap: 'removeFromLdrPin001'
    },
    4: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x3498db,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPinAndApplyToRgbPin1',
      onDragEnd: 'none',
      onSnap: 'removeFromRgbPin1'
    },
    5: {
      target: 'jstPin.pinGLTF2',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x3498db,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPinAndApplyToRgbLed',
      onDragEnd: 'none',
      onSnap: 'removeFromRgbLed'
    },
    6: {
      target: 'batteryWire2.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x3498db,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromBatteryWire2AndApplyToPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromPowerPin'
    }
  },
  lesson4: {
    1: {
      target: 'nanoModel',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x9b59b6,
        blinkSpeed: 2.0,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromNanoApplyToExpansionNano',
      onDragEnd: 'none',
      onSnap: 'removeFromExpansionNano'
    },
    2: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0xe74c3c,
        blinkSpeed: 2.0,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverMotorPin1',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverPin'
    },
    3: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x3498db,
        blinkSpeed: 2.0,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverPin',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverPin'
    },
    4: {
      target: 'jstPin.pinGLTF2',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x1abc9c,
        blinkSpeed: 2.0,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverInputPin',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverInputPin'
    },
    5: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0xf39c12,
        blinkSpeed: 2.0,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverPowerPin'
    },
    6: {
      target: 'batteryWire2.pinGLTF1',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x3498db,
        blinkSpeed: 2.0,
        glowIntensity: 0.9
      },
      onDragStart: 'removeFromBatteryWire2AndApplyToPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromPowerPin'
    }
  },
  lesson5: {
    1: {
      target: 'nanoModel',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0x9b59b6, blinkSpeed: 2.0, glowIntensity: 0.9 },
      onDragStart: 'removeFromNanoApplyToExpansionNano',
      onDragEnd: 'none',
      onSnap: 'removeFromExpansionNano'
    },
    2: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.8 },
      onDragStart: 'removeFromJstPinAndApplyToTsopPin',
      onDragEnd: 'none',
      onSnap: 'removeFromTsopPin'
    },
    3: {
      target: 'jstPin.pinGLTF2',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.8 },
      onDragStart: 'removeFromJstPinAndApplyToExpansionBoardTsopPin',
      onDragEnd: 'none',
      onSnap: 'removeFromExpansionBoardTsopPin'
    },
    4: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0xe74c3c, blinkSpeed: 2.0, glowIntensity: 0.9 },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverMotorPin1',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverPin'
    },
    5: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.9 },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverPin',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverPin'
    },
    6: {
      target: 'jstPin.pinGLTF2',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.9 },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverInputPin',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverInputPin'
    },
    7: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0xf39c12, blinkSpeed: 2.0, glowIntensity: 0.9 },
      onDragStart: 'removeFromJstPinAndApplyToMotorDriverPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromMotorDriverPowerPin'
    },
    8: {
      target: 'jstPin.pinGLTF1',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.9 },
      onDragStart: 'removeFromJstPinAndApplyToPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromPowerPin'
    },
    9: {
      target: 'batteryWire2.pinGLTF1',
      action: 'blink',
      config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.9 },
      onDragStart: 'removeFromBatteryWire2AndApplyToPowerPin',
      onDragEnd: 'none',
      onSnap: 'removeFromPowerPin'
    }
  }
  
  // Add more lessons as needed
};

// Lesson1 camera targets removed - now behaves like lesson2

export class ShaderManager {
  constructor() {
    this.currentShader = null;
    this.originalMaterials = new Map();
    this.materialMeshes = new Map();
    this.isActive = false;
    this.currentConfig = null;
    this.lastDraggedObject = null;
  }

  // Helper to get model/state from scene6State
  getModel(name) {
    return scene6State[name];
  }

  // Helper to get current lesson from scene6State
  getCurrentLesson() {
    if (typeof scene6State.getCurrentLesson === 'function') return scene6State.getCurrentLesson();
    return 'lesson1';
  }

  // Helper to get current step from scene6State
  getCurrentStep() {
    if (typeof scene6State.getCurrentStep === 'function') return scene6State.getCurrentStep();
    return 0;
  }

  // Helper to get camera from scene6State or window (fallback)
  getCamera() {
    return scene6State.camera;
  }

  // Helper to get orbitControls from scene6State or window (fallback)
  getOrbitControls() {
    return scene6State.orbitControls;
  }

  // Create shader material with custom parameters
  createShaderMaterial(config) {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        baseColor: { value: new THREE.Color(config.baseColor) },
        glowColor: { value: new THREE.Color(config.glowColor) },
        blinkSpeed: { value: config.blinkSpeed },
        glowIntensity: { value: config.glowIntensity }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
  }

  // Get meshes from an object (handles both direct meshes and GLTF models)
  getMeshesFromObject(object) {
    const meshes = [];
    
    if (!object) return meshes;

    if (object.geometry && object.material) {
      // Direct mesh
      meshes.push(object);
    } else if (object.children && object.children.length > 0) {
      // GLTF model or group - traverse children
      object.traverse((child) => {
        if (child.material && child.geometry) {
          // Filter out wires and very small parts
          const childName = child.name.toLowerCase();
          const isWire = childName.includes('wire') || 
                        childName.includes('line') ||
                        childName.includes('cable') ||
                        childName.includes('trace') ||
                        childName.includes('conductor');
          
          // Less aggressive thin wire detection
          let isThinWire = false;
          if (child.geometry) {
            if (!child.geometry.boundingBox) {
              child.geometry.computeBoundingBox();
            }
            
            if (child.geometry.boundingBox) {
              const box = child.geometry.boundingBox;
              const sizeX = box.max.x - box.min.x;
              const sizeY = box.max.y - box.min.y;
              const sizeZ = box.max.z - box.min.z;
              
              isThinWire = sizeX < 0.001 || sizeY < 0.001 || sizeZ < 0.001;
              
              const maxSize = Math.max(sizeX, sizeY, sizeZ);
              const minSize = Math.min(sizeX, sizeY, sizeZ);
              const aspectRatio = maxSize / (minSize + 0.0001);
              isThinWire = isThinWire || aspectRatio > 200;
            }
          }
          
          if (!isWire && !isThinWire) {
            meshes.push(child);
          }
        }
      });
    }

    return meshes;
  }

  // Store original materials for an object
  storeOriginalMaterials(object, meshes) {
    if (!object.userData) {
      object.userData = {};
    }

    const originalMaterials = [];
    meshes.forEach((mesh, index) => {
      try {
        originalMaterials.push(mesh.material.clone());
      } catch (error) {
        console.warn(`Could not clone material for mesh ${index}:`, error);
        originalMaterials.push(new THREE.MeshStandardMaterial({
          color: 0x808080,
          metalness: 0.5,
          roughness: 0.5
        }));
      }
    });

    object.userData.originalMaterials = originalMaterials;
    object.userData.materialMeshes = meshes;
    
    this.originalMaterials.set(object, originalMaterials);
    this.materialMeshes.set(object, meshes);
  }

  // Apply shader to an object
  applyShaderToObject(object, stepConfig) {
    if (!object) {
      console.warn('Cannot apply shader: object is null');
      return false;
    }

    const meshes = this.getMeshesFromObject(object);
    if (meshes.length === 0) {
      console.warn('No valid meshes found in object:', object);
      return false;
    }

    // Store original materials
    this.storeOriginalMaterials(object, meshes);

    // Create and apply shader using the config from stepConfig
    const shaderConfig = stepConfig.config || stepConfig;
    this.currentShader = this.createShaderMaterial(shaderConfig);
    
    meshes.forEach((mesh) => {
      mesh.material = this.currentShader;
    });

    this.isActive = true;
    this.currentConfig = stepConfig; // Store the full step config for drag events
    
    console.log(`Shader applied to ${object.name || 'object'} with ${meshes.length} meshes`);
    console.log('Shader Manager: Current config set to:', this.currentConfig);
    return true;
  }

  // Remove shader from an object
  removeShaderFromObject(object) {
    if (!object || !object.userData || !object.userData.originalMaterials || !object.userData.materialMeshes) {
      console.warn('Cannot remove shader: no original materials stored');
      return false;
    }

    const originalMaterials = object.userData.originalMaterials;
    const materialMeshes = object.userData.materialMeshes;

    materialMeshes.forEach((mesh, index) => {
      if (originalMaterials[index]) {
        mesh.material = originalMaterials[index];
        // Ensure the material is properly updated
        if (mesh.material.needsUpdate !== undefined) {
          mesh.material.needsUpdate = true;
        }
      }
    });

    // Don't clear isActive or currentConfig here, as we need them for subsequent drag events
    // Only clear the current shader material
    this.currentShader = null;
    
    console.log(`Shader removed from ${object.name || 'object'}`);
    return true;
  }

  // Comprehensive shader cleanup for an object and all its children
  removeShaderFromObjectAndChildren(object) {
    if (!object) return false;
    
    let removed = this.removeShaderFromObject(object);
    
    // Also traverse all children and remove shaders from them
    object.traverse((child) => {
      if (child.material && child.userData && child.userData.originalMaterials) {
        const childRemoved = this.removeShaderFromObject(child);
        removed = removed || childRemoved;
      }
      // Fallback: if a mesh has a shader material but no original materials stored,
      // try to restore it to a default material
      else if (child.material && child.material.type === 'ShaderMaterial') {
        console.log('Shader Manager: Found shader material without original materials, restoring to default');
        child.material = new THREE.MeshStandardMaterial({
          color: 0x808080,
          metalness: 0.5,
          roughness: 0.5
        });
        child.material.needsUpdate = true;
        removed = true;
      }
    });
    
    return removed;
  }

  // Update shader animation
  update(deltaTime) {
    if (this.currentShader && this.isActive) {
      this.currentShader.uniforms.time.value += deltaTime;
    }
    // Keep labels facing the camera if visible
    try { if (this._dragLabel && this._dragLabel.visible) this.faceLabelToCamera(this._dragLabel); } catch (e) {}
    try { if (this._dropLabel && this._dropLabel.visible) this.faceLabelToCamera(this._dropLabel); } catch (e) {}
  }

  ensureMeshUIFontLoaded() {
    if (this._fontLoaded) return;
    if (!this._textureLoader) this._textureLoader = new THREE.TextureLoader();
    try {
      this._fontFamily = ConsolasFontJSON;
      // Use the imported image path directly, matching codeEditor usage
      this._fontTexture = ConsolasFontImage;
      this._fontLoaded = true;
      try { if (this._dragLabel) this._dragLabel.set({ fontFamily: this._fontFamily, fontTexture: this._fontTexture }); } catch (e) {}
      try { if (this._dropLabel) this._dropLabel.set({ fontFamily: this._fontFamily, fontTexture: this._fontTexture }); } catch (e) {}
      // Enforce black text color after font application
      try {
        if (this._dragLabel) {
          this._dragLabel.traverse((child) => { if (child && child.isText) child.set({ color: new THREE.Color(0x000000) }); });
        }
      } catch (e) {}
      try {
        if (this._dropLabel) {
          this._dropLabel.traverse((child) => { if (child && child.isText) child.set({ color: new THREE.Color(0x000000) }); });
        }
      } catch (e) {}
    } catch (e) { console.warn('Failed to load MeshUI font:', e); }
  }

  // Lazy-create and return the "Drag this" label
  getDragLabel() {
    this.ensureMeshUIFontLoaded();
    if (!this._dragLabel) {
      this._dragLabel = new ThreeMeshUI.Block({
        width: 0.25,
        height: 0.06,
        padding: 0.005,
        margin: 0.002,
        backgroundOpacity: 1,
        backgroundColor: new THREE.Color(0xF0A800),
        borderRadius: 0.01,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: this._fontFamily,
        fontTexture: this._fontTexture
      });
      const dragText = new ThreeMeshUI.Text({ content: 'Drag', fontSize: 0.018, fontFamily: this._fontFamily, fontTexture: this._fontTexture, color: new THREE.Color(0x000000) });
      this._dragLabel.add(dragText);
      try {
        const currentScene = scene6State.currentScene;
        if (currentScene) currentScene.add(this._dragLabel);
      } catch (e) {}
      this._dragLabel.visible = false;
      this.applyLabelRenderSettings(this._dragLabel);
      // Enforce black text color in case of theme/style overrides
      try { dragText.set({ color: new THREE.Color(0x000000) }); } catch (e) {}
    }
    return this._dragLabel;
  }

  // Lazy-create and return the "Drop here" label
  getDropLabel() {
    this.ensureMeshUIFontLoaded();
    if (!this._dropLabel) {
      this._dropLabel = new ThreeMeshUI.Block({
        width: 0.25,
        height: 0.07,
        padding: 0.006,
        margin: 0.002,
        backgroundOpacity: 0.9,
        backgroundColor: new THREE.Color(0xF0A800),
        borderRadius: 0.012,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: this._fontFamily,
        fontTexture: this._fontTexture
      });
      const dropText = new ThreeMeshUI.Text({ content: 'Drop', fontSize: 0.02, fontFamily: this._fontFamily, fontTexture: this._fontTexture, color: new THREE.Color(0x000000) });
      this._dropLabel.add(dropText);
      try {
        const currentScene = scene6State.currentScene;
        if (currentScene) currentScene.add(this._dropLabel);
      } catch (e) {}
      this._dropLabel.visible = false;
      this.applyLabelRenderSettings(this._dropLabel);
      // Enforce black text color in case of theme/style overrides
      try { dropText.set({ color: new THREE.Color(0x000000) }); } catch (e) {}
    }
    return this._dropLabel;
  }

  // Clamp world Y so labels are always at least 0.1 high
  ensureMinHeight(vec3) {
    if (vec3 && typeof vec3.y === 'number') {
      vec3.y = Math.max(0.1, vec3.y);
    }
    return vec3;
  }

  faceLabelToCamera(label) {
    try {
      const camera = this.getCamera();
      if (label && camera) {
        label.lookAt(camera.position);
      }
    } catch (e) {}
  }

  applyLabelRenderSettings(label) {
    try {
      label.renderOrder = 9999;
      label.traverse((child) => {
        if (child.material) {
          child.material.depthTest = false;
          child.renderOrder = 9999;
          if (child.material.transparent !== true) child.material.transparent = true;
        }
      });
    } catch (e) {}
  }

  // Compute snap point for a dragged object name
  getSnapPointFor(draggedObjectName) {
    const SNAP_POINTS = {
      FIRST_FEMALE_PIN_SNAP_POINT: new THREE.Vector3(-0.03, 1.77, -3.26),
      SECOND_FEMALE_PIN_SNAP_POINT: new THREE.Vector3(-0.63, 1.77, -3.25),
      NANO_SNAP_POINT: new THREE.Vector3(-0.005, 1.757, -3.45),
      NANO_SNAP_POINT_LESSON2: new THREE.Vector3(-0.005, 1.757, -3.37),
      JSTPIN2_SIDE1_SNAP_POINT: new THREE.Vector3(-0.01, 1.82, -3.25),
      JSTPIN2_SIDE2_SNAP_POINT: new THREE.Vector3(0.45, 1.85, -3.0),
      JSTPIN_BATTERY_SNAP_POINT: new THREE.Vector3(0.239, 1.78, -3.36),
      JSTPIN_BATTERY_SNAP_POINT_LESSON2: new THREE.Vector3(-0.22, 1.777, -3.46)
    };
    const lesson = this.getCurrentLesson();
    const step = this.getCurrentStep();

    // Lesson-specific dynamic targets
    if (lesson === 'lesson3') {
      // Step 2: dragging jstPin2 side1 to expansionBoard ldrPin
      if (step === 2 && (draggedObjectName === 'jstPin2' || draggedObjectName === 'jstPin2.pinGLTF1')) {
        const ldrPinChild = this.getTargetObject('ldrPin'); // expansionBoard ldrPin
        if (ldrPinChild && ldrPinChild.getWorldPosition) {
          const wp = new THREE.Vector3();
          ldrPinChild.getWorldPosition(wp);
          return this.ensureMinHeight(wp);
        }
      }
      // Step 3: dragging jstPin2 side2 to LDR model's ldrPin
      if (step === 3 && (draggedObjectName === 'jstPin2' || draggedObjectName === 'jstPin2.pinGLTF2')) {
        let target = null;
        try {
          const ldrModel = this.getModel('ldrModel');
          if (ldrModel) {
            ldrModel.traverse((child) => {
              if (!target && child && child.name === 'ldrPin') target = child;
            });
          }
        } catch (e) {}
        if (target && target.getWorldPosition) {
          const wp = new THREE.Vector3();
          target.getWorldPosition(wp);
          return this.ensureMinHeight(wp);
        }
      }
      // Step 4: dragging jstPin side1 to expansionBoard rgbPin1
      if (step === 4 && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1')) {
        const rgbPin1 = this.getTargetObject('rgbPin1');
        if (rgbPin1 && rgbPin1.getWorldPosition) {
          const wp = new THREE.Vector3();
          rgbPin1.getWorldPosition(wp);
          return this.ensureMinHeight(wp);
        }
      }
      // Step 5: dragging jstPin side2 to rgbLED model 'rgbPin'
      if (step === 5 && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const rgbPin = this.getTargetObject('rgbPin');
        if (rgbPin && rgbPin.getWorldPosition) {
          const wp = new THREE.Vector3();
          rgbPin.getWorldPosition(wp);
          return this.ensureMinHeight(wp);
        }
      }
    }
    if (lesson === 'lesson4') {
      // Step 1: dragging nanoModel to expansionBoard position
      if (step === 1 && draggedObjectName === 'nanoModel') {
        const board = this.getTargetObject('expansionBoard');
        if (board) {
          const wp = new THREE.Vector3();
          board.getWorldPosition(wp);
          return this.ensureMinHeight(wp);
        }
      }
      // Step 2: dragging jstPin.pinGLTF1 to motorDriver child index 1 (destination used in lesson code)
      if (step === 2 && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1')) {
        const motorDriver = this.getModel('motorDriverModel');
        try {
          if (motorDriver && motorDriver.children && motorDriver.children[1]) {
            const wp = new THREE.Vector3();
            motorDriver.children[1].getWorldPosition(wp);
            return this.ensureMinHeight(wp);
          }
        } catch (e) {}
      }
      // Step 3: dragging jstPin.pinGLTF2 to expansionBoard child 'motordriverPin'
      if (step === 3 && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const board = this.getTargetObject('expansionBoard');
        if (board) {
          let target = null;
          try {
            board.traverse((child) => {
              if (!target && child && child.name === 'motordriverPin') target = child;
            });
          } catch (e) {}
          if (target) {
            const wp = new THREE.Vector3();
            target.getWorldPosition(wp);
            return this.ensureMinHeight(wp);
          }
        }
      }
      // Step 4: dragging jstPin.pinGLTF2 to motorDriver child named 'motorDriverInputPin'
      if (step === 4 && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const motorDriver = this.getModel('motorDriverModel');
        if (motorDriver) {
          let target = null;
          try {
            motorDriver.traverse((child) => {
              if (!target && child && child.name === 'motorDriverInputPin') target = child;
            });
          } catch (e) {}
          if (target) {
            const wp = new THREE.Vector3();
            target.getWorldPosition(wp);
            return this.ensureMinHeight(wp);
          }
        }
      }
      // Step 5: dragging jstPin.pinGLTF1 (batteryWire1) to motorDriver child index 4 (power pin in lesson code)
      if (step === 5 && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1')) {
        const motorDriver = this.getModel('motorDriverModel');
        try {
          if (motorDriver && motorDriver.children && motorDriver.children[4]) {
            const wp = new THREE.Vector3();
            motorDriver.children[4].getWorldPosition(wp);
            return this.ensureMinHeight(wp);
          }
        } catch (e) {}
      }
      // Step 6: dragging batteryWire2.pinGLTF1 to expansionBoard 'powerPin'
      if (step === 6 && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'batteryWire2')) {
        const board = this.getTargetObject('expansionBoard');
        if (board) {
          let target = null;
          try {
            board.traverse((child) => {
              if (!target && child && child.name === 'powerPin') target = child;
            });
          } catch (e) {}
          if (target) {
            const wp = new THREE.Vector3();
            target.getWorldPosition(wp);
            return this.ensureMinHeight(wp);
          }
        }
      }
    }
    switch (draggedObjectName) {
      case 'nanoModel':
        return lesson === 'lesson2' ? SNAP_POINTS.NANO_SNAP_POINT_LESSON2.clone() : SNAP_POINTS.NANO_SNAP_POINT.clone();
      case 'secondPin4Female':
        return SNAP_POINTS.SECOND_FEMALE_PIN_SNAP_POINT.clone();
      case 'jstPin2':
      case 'jstPin2.pinGLTF1':
        return SNAP_POINTS.JSTPIN2_SIDE1_SNAP_POINT.clone();
      case 'jstPin2.pinGLTF2':
        return SNAP_POINTS.JSTPIN2_SIDE2_SNAP_POINT.clone();
      case 'jstPinBattery':
      case 'jstPinBattery.pinGLTF1':
        return lesson === 'lesson2' ? SNAP_POINTS.JSTPIN_BATTERY_SNAP_POINT_LESSON2.clone() : SNAP_POINTS.JSTPIN_BATTERY_SNAP_POINT.clone();
      case 'jstPin':
      case 'jstPin.pinGLTF1':
        return SNAP_POINTS.FIRST_FEMALE_PIN_SNAP_POINT.clone();
      case 'jstPin.pinGLTF2':
        return SNAP_POINTS.SECOND_FEMALE_PIN_SNAP_POINT.clone();
      case 'tempSensorModel':
        // Fallback to first female pin snap for generic sensor; adjust if needed
        return SNAP_POINTS.FIRST_FEMALE_PIN_SNAP_POINT.clone();
      default:
        return null;
    }
  }

  // Main function to handle shader application based on lesson and step
  handleStepShader(lessonId, stepIndex) {
    console.log('Shader Manager: handleStepShader called', { lessonId, stepIndex });
    const lessonConfig = SHADER_CONFIG[lessonId];
    if (!lessonConfig || !lessonConfig[stepIndex]) {
      console.log('Shader Manager: No shader config found for', lessonId, 'step', stepIndex);
      this.cleanup();
      return;
    }

    const stepConfig = lessonConfig[stepIndex];
    const targetObject = this.getTargetObject(stepConfig.target);

    console.log('Shader Manager: Step config found', {
      stepConfig,
      targetObject: stepConfig.target,
      foundObject: targetObject
    });

    if (targetObject) {
      // Clear previously applied shaders before applying new step
      if (this.originalMaterials.size > 0) {
        console.log('Shader Manager: Clearing previously applied shaders before applying new step');
        this.originalMaterials.forEach((_, object) => {
          this.removeShaderFromObject(object);
        });
        this.originalMaterials.clear();
        this.materialMeshes.clear();
        this.currentShader = null;
        this.isActive = false;
      }
      // Additional cleanup: specifically remove shaders from LDR model if it exists
      const ldrModel = this.getTargetObject('ldrModel');
      if (ldrModel) {
        console.log('Shader Manager: Additional cleanup - removing shaders from LDR model');
        this.removeShaderFromObjectAndChildren(ldrModel);
      }

      console.log('Shader Manager: Applying shader to target object', targetObject);
      this.applyShaderToObject(targetObject, stepConfig);

      // Show "Drag" label slightly above the target
      try {
        const dragLabel = this.getDragLabel();
        const worldPos = new THREE.Vector3();
        targetObject.getWorldPosition(worldPos);
        const pos = worldPos.clone().add(new THREE.Vector3(0, 0.15, 0));
        this.ensureMinHeight(pos);
        dragLabel.position.copy(pos);
        this.faceLabelToCamera(dragLabel);
        dragLabel.visible = true;
      } catch (e) { console.warn('Failed to position Drag label:', e); }
    } else {
      console.warn(`Target object '${stepConfig.target}' not found for ${lessonId} step ${stepIndex}`);
      // Do not cleanup if target isn't found to avoid removing current highlight prematurely
      return;
    }

    // Apply to additional targets if specified
    if (Array.isArray(stepConfig.additionalTargets)) {
      stepConfig.additionalTargets.forEach((name) => {
        const extra = this.getTargetObject(name);
        if (extra) {
          console.log('Shader Manager: Applying shader to additional target', name);
          this.applyShaderToObject(extra, stepConfig);
        } else {
          console.warn('Shader Manager: Additional target not found:', name);
        }
      });
    }
  }

  // Get target object based on name
  getTargetObject(targetName) {
    console.log('Shader Manager: getTargetObject called with targetName:', targetName);
    console.log('Shader Manager: Available objects:', {
      jstPin: this.getModel('jstPin'),
      jstPinGroup: this.getModel('jstPin')?.group,
      jstPin2: this.getModel('jstPin2'),
      jstPin3: this.getModel('jstPin3'),
      nanoModel: this.getModel('nanoModel'),
      tempSensorModel: this.getModel('tempSensorModel'),
      expansionBoardModel: this.getModel('expansionBoardModel'),
      rgbLEDModel: this.getModel('rgbLEDModel')
    });
    
    switch (targetName) {
      case 'jstPin':
        const jstPinGroup = this.getModel('jstPin') ? this.getModel('jstPin').group : null;
        console.log('Shader Manager: jstPin group found:', jstPinGroup);
        return jstPinGroup;
      case 'jstPin.pinGLTF1':
        return this.getModel('jstPin') ? this.getModel('jstPin').pinGLTF1 : null;
      case 'jstPin.pinGLTF2':
        return this.getModel('jstPin') ? this.getModel('jstPin').pinGLTF2 : null;
      case 'jstPin2':
        return this.getModel('jstPin2') ? this.getModel('jstPin2').group : null;
      case 'jstPin2.pinGLTF1':
        return this.getModel('jstPin2') ? this.getModel('jstPin2').pinGLTF1 : null;
      case 'jstPin2.pinGLTF2':
        return this.getModel('jstPin2') ? this.getModel('jstPin2').pinGLTF2 : null;
      case 'jstPin3':
        return this.getModel('jstPin3') ? this.getModel('jstPin3').group : null;
      case 'nanoModel':
        return this.getModel('nanoModel');
      case 'tempSensorModel':
        return this.getModel('tempSensorModel');
      case 'expansionBoard':
        return this.getModel('expansionBoardModel');
      case 'buzzer': {
        // Prefer a child named 'buzzer' on the expansion board
        const expansionBoard = this.getModel('expansionBoardModel');
        if (expansionBoard) {
          let buzzerChild = null;
          expansionBoard.traverse((child) => {
            if (typeof child.name === 'string' && child.name.toLowerCase().includes('buzzerpin')) {
              buzzerChild = child;
            }
          });
          if (buzzerChild) return buzzerChild;
        }
        // Fallback to a standalone buzzer model if present
        return this.getModel('buzzerModel') || null;
      }
      case 'buzzerPin': {
        // Find the buzzerPin child on the expansion board
        const expansionBoard = this.getModel('expansionBoardModel');
        if (expansionBoard) {
          let buzzerPinChild = null;
          expansionBoard.traverse((child) => {
            if (typeof child.name === 'string' && child.name.toLowerCase().includes('buzzerpin')) {
              buzzerPinChild = child;
            }
          });
          if (buzzerPinChild) return buzzerPinChild;
        }
        // Fallback to a standalone buzzer model if present
        return this.getModel('buzzerModel') || null;
      }
      case 'tsopPin': {
        // Prefer the tsop model's own child first
        const tsopModel = this.getModel('tsopModel');
        if (tsopModel) {
          let target = null;
          tsopModel.traverse((child) => {
            if (child && child.name === 'tsopPin') target = child;
          });
          if (target) return target;
        }
        // Fallback: expansion board child search
        const expansionBoard = this.getModel('expansionBoardModel');
        if (expansionBoard) {
          let target = null;
          expansionBoard.traverse((child) => {
            if (child && typeof child.name === 'string' && child.name.toLowerCase().includes('tsoppin')) {
              target = child;
            }
          });
          return target;
        }
        return null;
      }
      case 'expansionBoardTsopPin': {
        const expansionBoard = this.getModel('expansionBoardModel');
        if (expansionBoard) {
          let target = null;
          expansionBoard.traverse((child) => {
            if (child && child.name === 'tsopPin') target = child;
          });
          return target;
        }
        return null;
      }
      case 'malePin': {
        // Find the malePin child inside buzzer model
        const buzzerModel = this.getModel('buzzerModel');
        if (buzzerModel) {
          let malePinChild = null;
          buzzerModel.traverse((child) => {
            if (typeof child.name === 'string' && child.name.toLowerCase().includes('malepin')) {
              malePinChild = child;
            }
          });
          console.log('Shader Manager: malePin child found:', malePinChild);
          return malePinChild;
        }
        return null;
      }
      case 'rgbPin1':
        // Find the rgbPin1 child of the expansion board
        const expansionBoard = this.getModel('expansionBoardModel');
        if (expansionBoard) {
          let rgbPin1Child = null;
          expansionBoard.traverse((child) => {
            if (child.name === 'rgbPin1') {
              rgbPin1Child = child;
            }
          });
          console.log('Shader Manager: rgbPin1 child found:', rgbPin1Child);
          return rgbPin1Child;
        }
        return null;
      case 'ldrPin':
        // Find the ldrPin child of the expansion board
        const expansionBoardForLdr = this.getModel('expansionBoardModel');
        if (expansionBoardForLdr) {
          let ldrPinChild = null;
          expansionBoardForLdr.traverse((child) => {
            if (child && child.name === 'ldrPin') {
              ldrPinChild = child;
            }
          });
          console.log('Shader Manager: ldrPin child found:', ldrPinChild);
          return ldrPinChild;
        }
        return null;
      case 'ldrModel':
        // Return the LDR model from scene6State or window
        const ldrModel = this.getModel('ldrModel');
        console.log('Shader Manager: ldrModel found:', ldrModel);
        return ldrModel;
     
      case 'jstPinBattery':
        // Return the battery JST pin group if available
        const jstPinBattery = this.getModel('jstPinBattery');
        return jstPinBattery ? (jstPinBattery.group || jstPinBattery.pinGLTF1) : null;
      case 'jstPinBattery.pinGLTF1':
        const jstPinBatteryForPin = this.getModel('jstPinBattery');
        return jstPinBatteryForPin ? jstPinBatteryForPin.pinGLTF1 : null;
      case 'powerPin':
        // Find the 'powerPin' child inside expansion board
        const expansionBoardForPower = this.getModel('expansionBoardModel');
        if (expansionBoardForPower) {
          let powerPinChild = null;
          expansionBoardForPower.traverse((child) => {
            if (child.name === 'powerPin') {
              powerPinChild = child;
            }
          });
          console.log('Shader Manager: powerPin child found:', powerPinChild);
          return powerPinChild;
        }
        return null;
      case 'rgbLED':
        return this.getModel('rgbLEDModel');
      case 'rgbPin': {
        // Find the rgbPin child inside rgbLED model
        const rgbLEDModel = this.getModel('rgbLEDModel');
        if (rgbLEDModel) {
          let rgbPinChild = null;
          rgbLEDModel.traverse((child) => {
            if (child.name === 'rgbPin') {
              rgbPinChild = child;
            }
          });
          console.log('Shader Manager: rgbPin child found:', rgbPinChild);
          return rgbPinChild;
        }
        return null;
      }
      case 'rgbled':
        // Find the specific child inside rgbLED model
        const rgbLEDModelForRgbled = this.getModel('rgbLEDModel');
        if (rgbLEDModelForRgbled) {
          let moduleChild = null;
          rgbLEDModelForRgbled.traverse((child) => {
            if (child.name === 'rgbPin') {
              moduleChild = child;
            }
          });
          console.log('Shader Manager: rgbled child found:', moduleChild);
          return moduleChild;
        }
        return null;
      case 'expansionNano':
        // Find the 'nano' child inside expansion board
        const expansionBoardForNano = this.getModel('expansionBoardModel');
        if (expansionBoardForNano) {
          let nanoChild = null;
          const childNames = [];
          
          expansionBoardForNano.traverse((child) => {
            childNames.push(child.name);
            // Try multiple possible names for the nano pin
            if (child.name === 'nano' || 
                child.name === 'nanoPin' || 
                child.name === 'arduinoPin' ||
                child.name === 'arduinoNanoPin' ||
                child.name.toLowerCase().includes('nano') ||
                child.name.toLowerCase().includes('arduino')) {
              nanoChild = child;
            }
          });
          
          console.log('Shader Manager: expansion board children:', childNames);
          console.log('Shader Manager: expansion nano child found:', nanoChild);
          return nanoChild;
        }
        return null;
      case 'motorDriverPin': {
        // In kpMotorLesson Step2/3, destination is motorDriver pin on expansion board
        const expansionBoardForMotor = this.getModel('expansionBoardModel');
        if (expansionBoardForMotor) {
          let target = null;
          expansionBoardForMotor.traverse((child) => {
            if (child && typeof child.name === 'string' && child.name.toLowerCase().includes('motordriverpin')) {
              target = child;
            }
          });
          return target;
        }
        // Fallback: look in motorDriver model if exposed
        const motorDriverForPin = this.getModel('motorDriverModel');
        if (motorDriverForPin) {
          let target = null;
          motorDriverForPin.traverse((child) => {
            if (child && typeof child.name === 'string' && child.name.toLowerCase().includes('motordriverpin')) {
              target = child;
            }
          });
          return target;
        }
        return null;
      }
      case 'motorDriverMotorPin1': {
        // Specific motor driver motor pin child on motorDriver model
        const motorDriverForMotorPin = this.getModel('motorDriverModel');
        if (motorDriverForMotorPin) {
          let target = null;
          motorDriverForMotorPin.traverse((child) => {
            if (child && child.name === 'motorDriverMotorPin1') {
              target = child;
            }
          });
          if (target) return target;
        }
        // Fallback: search on expansion board if it's attached there
        const expansionBoardForMotorPin = this.getModel('expansionBoardModel');
        if (expansionBoardForMotorPin) {
          let target = null;
          expansionBoardForMotorPin.traverse((child) => {
            if (child && child.name === 'motorDriverMotorPin1') {
              target = child;
            }
          });
          return target;
        }
        return null;
      }
      case 'motorDriverInputPin': {
        const motorDriverForInput = this.getModel('motorDriverModel');
        if (motorDriverForInput) {
          let target = null;
          motorDriverForInput.traverse((child) => {
            if (child && typeof child.name === 'string' && child.name.toLowerCase().includes('motordriverinputpin')) {
              target = child;
            }
          });
          if (target) return target;
        }
        // Fallback: sometimes named on expansion board
        const expansionBoardForInput = this.getModel('expansionBoardModel');
        if (expansionBoardForInput) {
          let target = null;
          expansionBoardForInput.traverse((child) => {
            if (child && typeof child.name === 'string' && child.name.toLowerCase().includes('motordriverinputpin')) {
              target = child;
            }
          });
          return target;
        }
        return null;
      }
      case 'motorDriverPowerPin': {
        const motorDriverForPower = this.getModel('motorDriverModel');
        if (motorDriverForPower) {
          let target = null;
          motorDriverForPower.traverse((child) => {
            if (child && typeof child.name === 'string' && child.name.toLowerCase().includes('power')) {
              target = child;
            }
          });
          if (target) return target;
        }
        // Fallback: power pin could live on expansionBoard as 'powerPin'
        const powerOnBoard = this.getTargetObject('powerPin');
        return powerOnBoard;
      }
      case 'rgbLed':
        return this.getModel('rgbLedModel');
      case 'batteryWire2':
        return this.getModel('batteryWire2');
      case 'batteryWire2.pinGLTF1':
        return this.getModel('batteryWire2');
      default:
        console.warn(`Unknown target object: ${targetName}`);
        return null;
    } 
  }

  // Handle drag start events
  handleDragStart(draggedObject) {
    console.log('Shader Manager: Drag start detected', {
      draggedObject,
      isActive: this.isActive,
      currentConfig: this.currentConfig,
      hasCurrentShader: !!this.currentShader
    });
    this.lastDraggedObject = draggedObject;

    // Always get the current lesson and step to determine the correct config
    const currentLesson = this.getCurrentLesson();
    const currentStep = this.getCurrentStep();
    
    // Disable OrbitControls on any drag start; will be re-enabled on snap
    try {
      const orbitControls = this.getOrbitControls();
      if (orbitControls) {
        orbitControls.enabled = false;
      }
    } catch (e) {}
    
    // Lesson1 camera positioning logic removed - now behaves like lesson2
    
    // Lesson1 step 0 camera logic removed - now behaves like lesson2
    
    // Always get the current config from the lesson/step to ensure it's up to date
    console.log('Shader Manager: Getting current config for lesson/step:', currentLesson, currentStep);
    const lessonConfig = SHADER_CONFIG[currentLesson];
    if (lessonConfig && lessonConfig[currentStep]) {
      this.currentConfig = lessonConfig[currentStep];
      console.log('Shader Manager: Updated current config:', this.currentConfig);
    } else {
      console.warn('Shader Manager: No config found for', currentLesson, 'step', currentStep);
      return;
    }

    const draggedObjectName = this.getObjectName(draggedObject);
    const onDragStartAction = this.currentConfig?.onDragStart;
    
    console.log('Shader Manager: Drag start details', {
      draggedObjectName,
      onDragStartAction,
      currentConfig: this.currentConfig
    });

    // Hide "Drag this" when drag begins
    try { const dragLabel = this.getDragLabel(); dragLabel.visible = false; } catch (e) {}

    // Show "Drop here" at the expected snap point
    try {
      const dropLabel = this.getDropLabel();
      const snapPoint = this.getSnapPointFor(draggedObjectName);
      if (snapPoint) {
        const pos = snapPoint.clone().add(new THREE.Vector3(0, 0.08, 0));
        this.ensureMinHeight(pos);
        dropLabel.position.copy(pos);
        this.faceLabelToCamera(dropLabel);
        dropLabel.visible = true;
      } else {
        dropLabel.visible = false;
      }
    } catch (e) { console.warn('Failed to position Drop label:', e); }

    // Special handling for combined action
    if (onDragStartAction === 'removeFromJstPinAndApplyToRgbPin1' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: JST pin (or child) dragged, removing shader from dragged object and applying to rgbPin1');
      
      // Prefer removing from the actual dragged object (child) since shader may be applied to that specific mesh
      let removed = this.removeShaderFromObject(draggedObject);
      // Try the specific pin child container if removal above failed
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          console.log('Shader Manager: Attempting removal from pin child container:', draggedObjectName);
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        // Fallback: remove from the JST pin group
        const jstPinObject = this.getTargetObject('jstPin');
        if (jstPinObject) {
          console.log('Shader Manager: Fallback removal from JST pin group');
          this.removeShaderFromObject(jstPinObject);
        } else {
          console.warn('Shader Manager: JST pin object not found for shader removal');
        }
      }
      
      // Immediately apply shader to rgbPin1
      const rgbPin1 = this.getTargetObject('rgbPin1');
      if (rgbPin1) {
        console.log('Shader Manager: Applying shader to rgbPin1 on drag start');
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0x3498db,
            blinkSpeed: 2.0,
            glowIntensity: 0.8
          }
        };
        this.applyShaderToObject(rgbPin1, stepConfigToUse);
      } else {
        console.warn('Shader Manager: rgbPin1 not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToRgbPin' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: JST pin (or child) dragged, removing shader from dragged object and applying to rgbPin');
      
      // Prefer removing from the actual dragged object (child)
      let removed = this.removeShaderFromObject(draggedObject);
      // Try the specific pin child container if removal above failed
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          console.log('Shader Manager: Attempting removal from pin child container:', draggedObjectName);
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        // Fallback: remove from the JST pin group
        const jstPinObject = this.getTargetObject('jstPin');
        if (jstPinObject) {
          console.log('Shader Manager: Fallback removal from JST pin group');
          this.removeShaderFromObject(jstPinObject);
        } else {
          console.warn('Shader Manager: JST pin object not found for shader removal');
        }
      }
      
      // Immediately apply shader to rgbPin
      const rgbPin = this.getTargetObject('rgbPin');
      if (rgbPin) {
        console.log('Shader Manager: Applying shader to rgbPin on drag start');
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0xe74c3c,
            blinkSpeed: 2.5,
            glowIntensity: 0.9
          }
        };
        this.applyShaderToObject(rgbPin, stepConfigToUse);
      } else {
        console.warn('Shader Manager: rgbPin not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToMotorDriverMotorPin1' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: JST pin (or child) dragged, removing shader from dragged object and applying to motorDriverMotorPin1');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          console.log('Shader Manager: Attempting removal from pin child container:', draggedObjectName);
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        const jstPinObject = this.getTargetObject('jstPin');
        if (jstPinObject) {
          console.log('Shader Manager: Fallback removal from JST pin group');
          this.removeShaderFromObject(jstPinObject);
        } else {
          console.warn('Shader Manager: JST pin object not found for shader removal');
        }
      }
      const motorDriverMotorPin1 = this.getTargetObject('motorDriverMotorPin1');
      if (motorDriverMotorPin1) {
        console.log('Shader Manager: Applying shader to motorDriverMotorPin1 on drag start');
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0xe74c3c,
            blinkSpeed: 2.0,
            glowIntensity: 0.9
          }
        };
        this.applyShaderToObject(motorDriverMotorPin1, stepConfigToUse);
      } else {
        console.warn('Shader Manager: motorDriverMotorPin1 not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromNanoApplyToExpansionNano' && (draggedObjectName === 'nanoModel' || draggedObjectName === 'unknown')) {
      // Handle nano: remove from nanoModel and apply to expansion child named 'nano'
      console.log('Shader Manager: Nano dragged, removing shader from nanoModel and applying to expansion board child "nano"');
      
      // Try to remove from the actual dragged object; if that fails, remove from nanoModel root
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed) {
        const nanoRoot = this.getTargetObject('nanoModel');
        if (nanoRoot) {
          console.log('Shader Manager: Fallback removal from nanoModel root');
          this.removeShaderFromObject(nanoRoot);
        } else {
          console.warn('Shader Manager: nanoModel object not found for shader removal');
        }
      }
      
      // Apply to expansion board child 'nano'
      const expansionNano = this.getTargetObject('expansionNano');
      console.log('Shader Manager: expansionNano target found:', expansionNano);
      const expansionBoardModel = this.getModel('expansionBoardModel');
      console.log('Shader Manager: expansionBoardModel exists:', !!expansionBoardModel);
      
      if (expansionNano) {
        console.log('Shader Manager: Applying shader to expansion board child "nano" on drag start');
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0x9b59b6,
            blinkSpeed: 2.0,
            glowIntensity: 0.9
          }
        };
        const success = this.applyShaderToObject(expansionNano, stepConfigToUse);
        console.log('Shader Manager: Shader application to expansionNano successful:', success);
      } else {
        console.warn('Shader Manager: expansion board child "nano" not found for shader application on drag start');
        // Debug: let's see what children are available
        if (expansionBoardModel) {
          const allChildren = [];
          expansionBoardModel.traverse((child) => {
            allChildren.push(child.name);
          });
          console.log('Shader Manager: All expansion board children:', allChildren);
        }
      }
    } else if (onDragStartAction === 'removeFromJstPinBatteryAndApplyToPowerPin') {
      // Remove shader from battery JST pin and apply to expansion board child 'powerPin'
      console.log('Shader Manager: Battery pin dragged, remove from jstPinBattery and apply to powerPin');
      const batteryTarget = this.getTargetObject('jstPinBattery.pinGLTF1') || this.getTargetObject('jstPinBattery');
      if (batteryTarget) {
        this.removeShaderFromObject(batteryTarget);
      }
      const powerPinChild = this.getTargetObject('powerPin');
      if (powerPinChild) {
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0xe74c3c,
            blinkSpeed: 2.0,
            glowIntensity: 0.9
          }
        };
        this.applyShaderToObject(powerPinChild, stepConfigToUse);
      } else {
        console.warn('Shader Manager: powerPin child not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPin2AndApplyToMalePin' && (draggedObjectName === 'jstPin2' || draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
      // Lesson2: remove blink from jstPin2 (or its child) and apply to malePin
      console.log('Shader Manager: Removing from jstPin2 (or child) and applying to malePin');
      // Remove from the specific dragged object if possible
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) removed = this.removeShaderFromObject(pinChildObj) || removed;
      }
      if (!removed) {
        const jst2Group = this.getTargetObject('jstPin2');
        if (jst2Group) this.removeShaderFromObject(jst2Group);
      }
      // Apply to malePin target
      const malePinObj = this.getTargetObject('malePin');
      if (malePinObj) {
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0x9b59b6,
            blinkSpeed: 2.0,
            glowIntensity: 0.8
          }
        };
        this.applyShaderToObject(malePinObj, stepConfigToUse);
      } else {
        console.warn('Shader Manager: malePin target not found for shader application');
      }
    } else if (onDragStartAction === 'removeFromJstPin2AndApplyToBuzzer' && (draggedObjectName === 'jstPin2' || draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
      // Lesson2: remove blink from jstPin2 (or its child) and apply to buzzer only
      console.log('Shader Manager: Removing from jstPin2 (or child) and applying to buzzer');
      // Remove from the specific dragged object if possible
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) removed = this.removeShaderFromObject(pinChildObj) || removed;
      }
      if (!removed) {
        const jst2Group = this.getTargetObject('jstPin2');
        if (jst2Group) this.removeShaderFromObject(jst2Group);
      }
      // Apply to buzzer target
      const buzzerObj = this.getTargetObject('buzzerPin');
      if (buzzerObj) {
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0xf39c12,
            blinkSpeed: 2.0,
            glowIntensity: 0.8
          }
        };
        this.applyShaderToObject(buzzerObj, stepConfigToUse);
      } else {
        console.warn('Shader Manager: buzzer target not found for shader application');
      }
    } else if (onDragStartAction === 'removeFromJstPin2AndApplyToRgbPin1' && (draggedObjectName === 'jstPin2' || draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
      console.log('Shader Manager: JST pin 2 (or child) dragged, removing shader from dragged object and applying to rgbPin1');

      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          console.log('Shader Manager: Attempting removal from jstPin2 pin child container:', draggedObjectName);
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        const jstPin2Object = this.getTargetObject('jstPin2');
        if (jstPin2Object) {
          console.log('Shader Manager: Fallback removal from jstPin2 group');
          this.removeShaderFromObject(jstPin2Object);
        } else {
          console.warn('Shader Manager: jstPin2 object not found for shader removal');
        }
      }

      const rgbPin1 = this.getTargetObject('rgbPin1');
      if (rgbPin1) {
        console.log('Shader Manager: Applying shader to rgbPin1 on drag start (from jstPin2)');
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0x3498db,
            blinkSpeed: 2.0,
            glowIntensity: 0.8
          }
        };
        this.applyShaderToObject(rgbPin1, stepConfigToUse);
      } else {
        console.warn('Shader Manager: rgbPin1 not found for shader application on drag start (from jstPin2)');
      }
    } else if (onDragStartAction === 'removeFromJstPin3AndApplyToRgbPin1' && (draggedObjectName === 'jstPin3' || draggedObjectName === 'jstPin3.pinGLTF1' || draggedObjectName === 'jstPin3.pinGLTF2')) {
      console.log('Shader Manager: JST pin 3 (or child) dragged, removing shader from dragged object and applying to rgbPin1');

      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin3.pinGLTF1' || draggedObjectName === 'jstPin3.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          console.log('Shader Manager: Attempting removal from jstPin3 pin child container:', draggedObjectName);
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        const jstPin3Object = this.getTargetObject('jstPin3');
        if (jstPin3Object) {
          console.log('Shader Manager: Fallback removal from jstPin3 group');
          this.removeShaderFromObject(jstPin3Object);
        } else {
          console.warn('Shader Manager: jstPin3 object not found for shader removal');
        }
      }

      const rgbPin1 = this.getTargetObject('rgbPin1');
      if (rgbPin1) {
        console.log('Shader Manager: Applying shader to rgbPin1 on drag start (from jstPin3)');
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0x3498db,
            blinkSpeed: 2.0,
            glowIntensity: 0.8
          }
        };
        this.applyShaderToObject(rgbPin1, stepConfigToUse);
      } else {
        console.warn('Shader Manager: rgbPin1 not found for shader application on drag start (from jstPin3)');
      }
    } 
    
     else if (onDragStartAction === 'removeFromJstPin2AndApplyToLdrPin' && (draggedObjectName === 'jstPin2' || draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin2 (or child) and applying to ldrPin');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        const jst2Group = this.getTargetObject('jstPin2');
        if (jst2Group) this.removeShaderFromObject(jst2Group);
      }
      const ldrPinChild = this.getTargetObject('ldrPin');
      if (ldrPinChild) {
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.8 }
        };
        this.applyShaderToObject(ldrPinChild, stepConfigToUse);
      } else {
        console.warn('Shader Manager: ldrPin not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPin2AndApplyToLdr' && (draggedObjectName === 'jstPin2' || draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin2 (or child) and applying to ldr model');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin2.pinGLTF1' || draggedObjectName === 'jstPin2.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        const jst2Group = this.getTargetObject('jstPin2');
        if (jst2Group) this.removeShaderFromObject(jst2Group);
      }
      const ldrModel = this.getTargetObject('ldrModel');
      if (ldrModel) {
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.8 }
        };
        this.applyShaderToObject(ldrModel, stepConfigToUse);
      } else {
        console.warn('Shader Manager: ldrModel not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromBatteryWire2AndApplyToPowerPin' && (draggedObjectName === 'batteryWire2' || draggedObjectName === 'batteryWire2.pinGLTF1' || draggedObjectName === 'unknown')) {
      console.log('Shader Manager: Battery wire dragged, removing shader from batteryWire2 and applying to powerPin');
      
      // Remove shader from the specific dragged object first
      let removed = this.removeShaderFromObject(draggedObject);
      
      // If that didn't work, try removing from the specific pin child
      if (!removed && draggedObjectName === 'batteryWire2.pinGLTF1') {
        const pinChildObj = this.getTargetObject('batteryWire2.pinGLTF1');
        if (pinChildObj) {
          console.log('Shader Manager: Attempting removal from batteryWire2.pinGLTF1');
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      
      // Fallback: remove from the main batteryWire2 object
      if (!removed) {
        const batteryWire2Obj = this.getTargetObject('batteryWire2');
        if (batteryWire2Obj) {
          console.log('Shader Manager: Fallback removal from batteryWire2');
          this.removeShaderFromObject(batteryWire2Obj);
        }
      }
      
      // Apply shader to powerPin
      const powerPinChild = this.getTargetObject('powerPin');
      if (powerPinChild) {
        const stepConfigToUse = this.currentConfig || {
          config: {
            baseColor: 0x2c3e50,
            glowColor: 0x3498db,
            blinkSpeed: 2.0,
            glowIntensity: 0.8
          }
        };
        this.applyShaderToObject(powerPinChild, stepConfigToUse);
      } else {
        console.warn('Shader Manager: powerPin child not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToRgbLed' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin (or child) and applying to rgbLed model');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        const jstPinGroup = this.getTargetObject('jstPin');
        if (jstPinGroup) this.removeShaderFromObject(jstPinGroup);
      }
      const rgbLedModel = this.getTargetObject('rgbLed');
      if (rgbLedModel) {
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.8 }
        };
        this.applyShaderToObject(rgbLedModel, stepConfigToUse);
      } else {
        console.warn('Shader Manager: rgbLED model not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToTsopPin' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin (or child) and applying to tsopPin');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) removed = this.removeShaderFromObject(pinChildObj) || removed;
      }
      if (!removed) {
        const jstPinGroup = this.getTargetObject('jstPin');
        if (jstPinGroup) this.removeShaderFromObject(jstPinGroup);
      }
      const tsopPin = this.getTargetObject('tsopPin');
      if (tsopPin) {
        const stepConfigToUse = this.currentConfig || { config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.8 } };
        this.applyShaderToObject(tsopPin, stepConfigToUse);
      } else {
        console.warn('Shader Manager: tsopPin not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToExpansionBoardTsopPin' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin (or child) and applying to expansionBoard tsopPin');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) removed = this.removeShaderFromObject(pinChildObj) || removed;
      }
      if (!removed) {
        const jstPinGroup = this.getTargetObject('jstPin');
        if (jstPinGroup) this.removeShaderFromObject(jstPinGroup);
      }
      const expTsopPin = this.getTargetObject('expansionBoardTsopPin');
      if (expTsopPin) {
        const stepConfigToUse = this.currentConfig || { config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.8 } };
        this.applyShaderToObject(expTsopPin, stepConfigToUse);
      } else {
        console.warn('Shader Manager: expansionBoard tsopPin not found for shader application on drag start');
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToMotorDriverPowerPin' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin (or child) and applying to motorDriverPowerPin');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) removed = this.removeShaderFromObject(pinChildObj) || removed;
      }
      if (!removed) {
        const jstPinGroup = this.getTargetObject('jstPin');
        if (jstPinGroup) this.removeShaderFromObject(jstPinGroup);
      }
      const powerPin = this.getTargetObject('motorDriverPowerPin');
      if (powerPin) {
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0xf39c12, blinkSpeed: 2.0, glowIntensity: 0.9 }
        };
        this.applyShaderToObject(powerPin, stepConfigToUse);
      }
    } else if (onDragStartAction === 'applyToDragged') {
      console.log('Shader Manager: Applying shader to dragged object');
      // Try removing from the initially highlighted target for this step
      const initialTargetName = this.currentConfig?.target;
      if (typeof initialTargetName === 'string') {
        const initialTargetObj = this.getTargetObject(initialTargetName);
        if (initialTargetObj) {
          this.removeShaderFromObject(initialTargetObj);
        }
      }
      const stepConfigToUse = this.currentConfig || {
        config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.8 }
      };
      this.applyShaderToObject(draggedObject, stepConfigToUse);
      
      // Remember it for later removal on snap if needed
      this.lastDraggedObject = draggedObject;
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToMotorDriverPin' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin (or child) and applying to motorDriverPin');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) {
          removed = this.removeShaderFromObject(pinChildObj) || removed;
        }
      }
      if (!removed) {
        const jstPinObject = this.getTargetObject('jstPin');
        if (jstPinObject) this.removeShaderFromObject(jstPinObject);
      }
      const motorDriverPin = this.getTargetObject('motorDriverPin');
      if (motorDriverPin) {
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.9 }
        };
        this.applyShaderToObject(motorDriverPin, stepConfigToUse);
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToMotorDriverInputPin' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin (or child) and applying to motorDriverInputPin');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) removed = this.removeShaderFromObject(pinChildObj) || removed;
      }
      if (!removed) {
        const jstPinObject = this.getTargetObject('jstPin');
        if (jstPinObject) this.removeShaderFromObject(jstPinObject);
      }
      const motorDriverInputPin = this.getTargetObject('motorDriverInputPin');
      if (motorDriverInputPin) {
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x1abc9c, blinkSpeed: 2.0, glowIntensity: 0.9 }
        };
        this.applyShaderToObject(motorDriverInputPin, stepConfigToUse);
      }
    } else if (onDragStartAction === 'removeFromJstPinAndApplyToPowerPin' && (draggedObjectName === 'jstPin' || draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
      console.log('Shader Manager: Removing from jstPin (or child) and applying to powerPin');
      let removed = this.removeShaderFromObject(draggedObject);
      if (!removed && (draggedObjectName === 'jstPin.pinGLTF1' || draggedObjectName === 'jstPin.pinGLTF2')) {
        const pinChildObj = this.getTargetObject(draggedObjectName);
        if (pinChildObj) removed = this.removeShaderFromObject(pinChildObj) || removed;
      }
      if (!removed) {
        const jstPinObject = this.getTargetObject('jstPin');
        if (jstPinObject) this.removeShaderFromObject(jstPinObject);
      }
      const powerPin = this.getTargetObject('powerPin');
      if (powerPin) {
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.9 }
        };
        this.applyShaderToObject(powerPin, stepConfigToUse);
      }
    } else {
      // Extract the target object name from the action (e.g., 'removeFromJstPin' -> 'jstPin')
      const actionTargetName = onDragStartAction ? onDragStartAction.replace('removeFrom', '') : '';
      const normalizedActionTargetName = actionTargetName.charAt(0).toLowerCase() + actionTargetName.slice(1);
      
      console.log('Shader Manager: Action analysis:', {
        actionTargetName,
        normalizedActionTargetName,
        draggedObjectName,
        matches: draggedObjectName === normalizedActionTargetName
      });
      
      if (onDragStartAction && draggedObjectName === normalizedActionTargetName) {
        console.log('Shader Manager: Condition passed, processing drag start action');
        const targetObject = this.getTargetObject(normalizedActionTargetName);
        if (targetObject) {
          console.log('Shader Manager: Removing shader from', normalizedActionTargetName, 'object:', targetObject);
          this.removeShaderFromObject(targetObject);
        } else {
          console.warn('Shader Manager: Target object not found for', normalizedActionTargetName);
        }
      } else {
        console.log('Shader Manager: No matching drag start action for', draggedObjectName);
        console.log('Shader Manager: Expected action for', draggedObjectName, 'but got:', onDragStartAction);
      }
    }
  }

  // Handle drag end events
  handleDragEnd(draggedObject) {
    console.log('Shader Manager: Drag end detected', {
      draggedObject,
      currentConfig: this.currentConfig,
      isActive: this.isActive,
      hasCurrentShader: !!this.currentShader
    });

    // Always hide the drop label when drag ends
    try { const dropLabel = this.getDropLabel(); dropLabel.visible = false; } catch (e) {}
    
    // Re-enable OrbitControls and release camera lock after drag ends for lesson1
    if (this.getCurrentLesson() === 'lesson1') {
      // Camera look lock logic removed - all lessons now have consistent camera behavior
      const orbitControls = this.getOrbitControls();
      if (orbitControls) {
        orbitControls.enabled = true;
        orbitControls.update();
        console.log('OrbitControls re-enabled and camera lock released after drag end for lesson1 step', this.getCurrentStep());
      }
    }

    // Always get the current lesson and step to determine the correct config
    const currentLesson = this.getCurrentLesson();
    const currentStep = this.getCurrentStep();
    
    // Always get the current config from the lesson/step to ensure it's up to date
    console.log('Shader Manager: Getting current config for lesson/step:', currentLesson, currentStep);
    const lessonConfig = SHADER_CONFIG[currentLesson];
    if (lessonConfig && lessonConfig[currentStep]) {
      this.currentConfig = lessonConfig[currentStep];
      console.log('Shader Manager: Updated current config:', this.currentConfig);
    } else {
      console.warn('Shader Manager: No config found for', currentLesson, 'step', currentStep);
      return;
    }

    const draggedObjectName = this.getObjectName(draggedObject);
    const onDragEndAction = this.currentConfig?.onDragEnd;
    
    console.log('Shader Manager: Drag end details', {
      draggedObjectName,
      onDragEndAction,
      currentConfig: this.currentConfig
    });

    // Handle 'none'
    if (onDragEndAction === 'none') {
      console.log('Shader Manager: No action needed on drag end for this step');
      return;
    }

    // Specific handlers retained
    if (onDragEndAction === 'applyToRgbPin1') {
      const rgbPin1 = this.getTargetObject('rgbPin1');
      if (rgbPin1) {
        console.log('Shader Manager: Applying shader to rgbPin1 on drag end');
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.8 }
        };
        this.applyShaderToObject(rgbPin1, stepConfigToUse);
      } else {
        console.warn('Shader Manager: rgbPin1 not found for shader application on drag end');
      }
      return;
    }
    if (onDragEndAction === 'applyToExpansionBoard') {
      const expansionBoardObj = this.getTargetObject('expansionBoard');
      if (expansionBoardObj) {
        console.log('Shader Manager: Applying shader to expansion board on drag end');
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.8 }
        };
        this.applyShaderToObject(expansionBoardObj, stepConfigToUse);
      } else {
        console.warn('Shader Manager: Expansion board not found for shader application on drag end');
      }
      return;
    }
    if (onDragEndAction === 'applyToRgbPin') {
      const rgbPin = this.getTargetObject('rgbPin');
      if (rgbPin) {
        console.log('Shader Manager: Applying shader to rgbPin on drag end');
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0xe74c3c, blinkSpeed: 2.5, glowIntensity: 0.9 }
        };
        this.applyShaderToObject(rgbPin, stepConfigToUse);
      } else {
        console.warn('Shader Manager: rgbPin not found for shader application on drag end');
      }
      return;
    }

    // Generic handler: applyTo<Thing>
    if (typeof onDragEndAction === 'string' && onDragEndAction.startsWith('applyTo')) {
      const rawTarget = onDragEndAction.replace('applyTo', '');
      const normalizedTarget = rawTarget.charAt(0).toLowerCase() + rawTarget.slice(1);
      const targetObject = this.getTargetObject(normalizedTarget);
      if (targetObject) {
        console.log('Shader Manager: Applying shader generically to', normalizedTarget, 'on drag end');
        const stepConfigToUse = this.currentConfig || {
          config: { baseColor: 0x2c3e50, glowColor: 0x3498db, blinkSpeed: 2.0, glowIntensity: 0.8 }
        };
        this.applyShaderToObject(targetObject, stepConfigToUse);
      } else {
        console.warn('Shader Manager: Target not found for generic apply:', normalizedTarget);
      }
      return;
    }

    console.log('Shader Manager: No matching drag end action for', draggedObjectName);
  }

  // Handle snap events
  handleSnap(snapType) {
    console.log('Shader Manager: Snap detected', {
      snapType,
      currentConfig: this.currentConfig,
      isActive: this.isActive
    });

    // On snap, release camera look lock and re-enable controls
    try {
      // Camera look lock logic removed - all lessons now have consistent camera behavior
      if (typeof window.enableOrbitControls === 'function') {
        window.enableOrbitControls();
      } else {
        const orbitControls = this.getOrbitControls();
        if (orbitControls && this.getCurrentStep() !== 0) {
          setTimeout(() => {
            orbitControls.enabled = true;
            orbitControls.update();
            console.log('OrbitControls enabled after 1s delay in shaderManager snap');
          }, 1000);
        }
      }
    } catch (e) {
      console.warn('Error in snap handler:', e);
    }

    // Always get the current lesson and step to determine the correct config
    const currentLesson = this.getCurrentLesson();
    const currentStep = this.getCurrentStep();
    
    // Always get the current config from the lesson/step to ensure it's up to date
    console.log('Shader Manager: Getting current config for lesson/step:', currentLesson, currentStep);
    const lessonCfg = SHADER_CONFIG[currentLesson];
    if (lessonCfg && lessonCfg[currentStep]) {
      this.currentConfig = lessonCfg[currentStep];
      console.log('Shader Manager: Updated current config:', this.currentConfig);
    } else {
      console.warn('Shader Manager: No config found for', currentLesson, 'step', currentStep);
      return;
    }

    const onSnapAction = this.currentConfig?.onSnap;
    console.log('Shader Manager: Snap action:', onSnapAction);

    if (onSnapAction === 'removeFromExpansionBoard') {
      const expansionBoardObj = this.getTargetObject('expansionBoard');
      if (expansionBoardObj) {
        console.log('Shader Manager: Removing shader from expansion board on snap');
        this.removeShaderFromObject(expansionBoardObj);
      } else {
        console.warn('Shader Manager: Expansion board not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromExpansionBoardTsopPin') {
      const pin = this.getTargetObject('expansionBoardTsopPin');
      if (pin) {
        console.log('Shader Manager: Removing shader from expansionBoard tsopPin on snap');
        this.removeShaderFromObject(pin);
      }
      return;
    }
    if (onSnapAction === 'removeFromTsopPin') {
      const tsopPin = this.getTargetObject('tsopPin');
      if (tsopPin) {
        console.log('Shader Manager: Removing shader from tsopPin on snap');
        this.removeShaderFromObject(tsopPin);
      } else {
        console.warn('Shader Manager: tsopPin not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromMotorDriverPin') {
      const motorDriverPin = this.getTargetObject('motorDriverPin');
      if (motorDriverPin) {
        console.log('Shader Manager: Removing shader from motorDriverPin on snap');
        this.removeShaderFromObject(motorDriverPin);
      } else {
        console.warn('Shader Manager: motorDriverPin not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromMotorDriverInputPin') {
      const inputPin = this.getTargetObject('motorDriverInputPin');
      if (inputPin) {
        console.log('Shader Manager: Removing shader from motorDriverInputPin on snap');
        this.removeShaderFromObject(inputPin);
      } else {
        console.warn('Shader Manager: motorDriverInputPin not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromMotorDriverPowerPin') {
      const powerPin = this.getTargetObject('motorDriverPowerPin');
      if (powerPin) {
        console.log('Shader Manager: Removing shader from motorDriverPowerPin on snap');
        this.removeShaderFromObject(powerPin);
      } else {
        console.warn('Shader Manager: motorDriverPowerPin not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromRgbPin1') {
      const rgbPin1 = this.getTargetObject('rgbPin1');
      if (rgbPin1) {
        console.log('Shader Manager: Removing shader from rgbPin1 on snap');
        this.removeShaderFromObject(rgbPin1);
      } else {
        console.warn('Shader Manager: rgbPin1 not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromRgbPin') {
      const rgbPin = this.getTargetObject('rgbPin');
      if (rgbPin) {
        console.log('Shader Manager: Removing shader from rgbPin on snap');
        this.removeShaderFromObject(rgbPin);
      } else {
        console.warn('Shader Manager: rgbPin not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromExpansionNano') {
      const expansionNano = this.getTargetObject('expansionNano');
      if (expansionNano) {
        console.log('Shader Manager: Removing shader from expansion board child "nano" on snap');
        this.removeShaderFromObject(expansionNano);
      } else {
        console.warn('Shader Manager: expansion board child "nano" not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromPowerPin') {
      const powerPinChild = this.getTargetObject('powerPin');
      if (powerPinChild) {
        console.log('Shader Manager: Removing shader from powerPin on snap');
        this.removeShaderFromObject(powerPinChild);
      } else {
        console.warn('Shader Manager: powerPin child not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromMalePin') {
      const malePinObj = this.getTargetObject('malePin');
      if (malePinObj) {
        console.log('Shader Manager: Removing shader from malePin on snap');
        this.removeShaderFromObject(malePinObj);
      } else {
        console.warn('Shader Manager: malePin not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromBuzzer') {
      const buzzerObj = this.getTargetObject('buzzerPin');
      if (buzzerObj) {
        console.log('Shader Manager: Removing shader from buzzer on snap');
        this.removeShaderFromObject(buzzerObj);
      } else {
        console.warn('Shader Manager: buzzer not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromLdrPin') {
      const ldrPinChild = this.getTargetObject('ldrPin');
      if (ldrPinChild) {
        console.log('Shader Manager: Removing shader from ldrPin on snap');
        this.removeShaderFromObject(ldrPinChild);
      } else {
        console.warn('Shader Manager: ldrPin not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromLdrPin001') {
      const ldrModel = this.getTargetObject('ldrModel');
      if (ldrModel) {
        console.log('Shader Manager: Removing shader from ldrModel and all children on snap');
        this.removeShaderFromObjectAndChildren(ldrModel);
        
        // Clear any remaining shader state and do a full cleanup
        this.currentShader = null;
        this.isActive = false;
        this.currentConfig = null;
        this.lastDraggedObject = null;
      } else {
        console.warn('Shader Manager: ldrModel not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromRgbLed') {
      const rgbLedModel = this.getTargetObject('rgbLed');
      if (rgbLedModel) {
        console.log('Shader Manager: Removing shader from rgbLED model and all children on snap');
        this.removeShaderFromObjectAndChildren(rgbLedModel);
        
        // Clear any remaining shader state and do a full cleanup
        this.currentShader = null;
        this.isActive = false;
        this.currentConfig = null;
        this.lastDraggedObject = null;
      } else {
        console.warn('Shader Manager: rgbLED model not found for shader removal on snap');
      }
      return;
    }
    if (onSnapAction === 'removeFromDragged') {
      if (this.lastDraggedObject) {
        console.log('Shader Manager: Removing shader from last dragged object on snap');
        this.removeShaderFromObject(this.lastDraggedObject);
      } else {
        console.warn('Shader Manager: No lastDraggedObject to remove shader from');
      }
      return;
    }

    // Generic handler: removeFrom<Thing>
    if (typeof onSnapAction === 'string' && onSnapAction.startsWith('removeFrom')) {
      const rawTarget = onSnapAction.replace('removeFrom', '');
      const normalizedTarget = rawTarget.charAt(0).toLowerCase() + rawTarget.slice(1);
      const targetObject = this.getTargetObject(normalizedTarget);
      if (targetObject) {
        console.log('Shader Manager: Removing shader generically from', normalizedTarget, 'on snap');
        this.removeShaderFromObject(targetObject);
      } else {
        console.warn('Shader Manager: Target not found for generic remove:', normalizedTarget);
      }
      return;
    }

    console.log('Shader Manager: No matching snap action for', snapType);
  }

  // Get object name for comparison
  getObjectName(object) {
    console.log('Shader Manager: getObjectName called with object:', object);
    
    const jstPin = this.getModel('jstPin');
    const jstPin2 = this.getModel('jstPin2');
    const jstPin3 = this.getModel('jstPin3');
    const jstPinBattery = this.getModel('jstPinBattery');
    const nanoModel = this.getModel('nanoModel');
    const tempSensorModel = this.getModel('tempSensorModel');
    const expansionBoardModel = this.getModel('expansionBoardModel');
    const rgbLEDModel = this.getModel('rgbLEDModel');
    const rgbLedModel = this.getModel('rgbLedModel');
    const buzzerModel = this.getModel('buzzerModel');
    const batteryWire2 = this.getModel('batteryWire2');
    
    if (object === jstPin?.group) {
      console.log('Shader Manager: Identified as jstPin');
      return 'jstPin';
    }
    if (object === jstPin?.pinGLTF1) {
      console.log('Shader Manager: Identified as jstPin.pinGLTF1');
      return 'jstPin.pinGLTF1';
    }
    if (object === jstPin?.pinGLTF2) {
      console.log('Shader Manager: Identified as jstPin.pinGLTF2');
      return 'jstPin.pinGLTF2';
    }
    if (object === jstPin2?.group) {
      console.log('Shader Manager: Identified as jstPin2');
      return 'jstPin2';
    }
    if (object === jstPin2?.pinGLTF1) {
      console.log('Shader Manager: Identified as jstPin2.pinGLTF1');
      return 'jstPin2.pinGLTF1';
    }
    if (object === jstPin2?.pinGLTF2) {
      console.log('Shader Manager: Identified as jstPin2.pinGLTF2');
      return 'jstPin2.pinGLTF2';
    }
    if (object === jstPin3?.group) {
      console.log('Shader Manager: Identified as jstPin3');
      return 'jstPin3';
    }
    if (object === jstPin3?.pinGLTF1) {
      console.log('Shader Manager: Identified as jstPin3.pinGLTF1');
      return 'jstPin3.pinGLTF1';
    }
    if (object === jstPin3?.pinGLTF2) {
      console.log('Shader Manager: Identified as jstPin3.pinGLTF2');
      return 'jstPin3.pinGLTF2';
    }
    if (object === nanoModel) {
      console.log('Shader Manager: Identified as nanoModel');
      return 'nanoModel';
    }
    if (object === tempSensorModel) {
      console.log('Shader Manager: Identified as tempSensorModel');
      return 'tempSensorModel';
    }
    if (object === expansionBoardModel) {
      console.log('Shader Manager: Identified as expansionBoard');
      return 'expansionBoard';
    }
    if (object === rgbLEDModel) {
      console.log('Shader Manager: Identified as rgbLED');
      return 'rgbLED';
    }
    if (object === rgbLedModel) {
      console.log('Shader Manager: Identified as rgbLed');
      return 'rgbLed';
    }
    if (object === buzzerModel) {
      console.log('Shader Manager: Identified as buzzerModel');
      return 'buzzerModel';
    }
    if (object === jstPinBattery?.pinGLTF1) {
      console.log('Shader Manager: Identified as jstPinBattery.pinGLTF1');
      return 'jstPinBattery.pinGLTF1';
    }
    if (object === batteryWire2) {
      console.log('Shader Manager: Identified as batteryWire2');
      return 'batteryWire2';
    }
    if (object === batteryWire2?.pinGLTF1) {
      console.log('Shader Manager: Identified as batteryWire2.pinGLTF1');
      return 'batteryWire2.pinGLTF1';
    }
    
    // Ascend parents to detect known containers like pinGLTF1/2
    let current = object;
    while (current && current.parent) {
      if (current === jstPin?.pinGLTF1) {
        console.log('Shader Manager: Identified via ancestor as jstPin.pinGLTF1');
        return 'jstPin.pinGLTF1';
      }
      if (current === jstPin?.pinGLTF2) {
        console.log('Shader Manager: Identified via ancestor as jstPin.pinGLTF2');
        return 'jstPin.pinGLTF2';
      }
      if (current === jstPin?.group) {
        console.log('Shader Manager: Identified via ancestor as jstPin');
        return 'jstPin';
      }
      if (current === jstPinBattery?.pinGLTF1) {
        console.log('Shader Manager: Identified via ancestor as jstPinBattery.pinGLTF1');
        return 'jstPinBattery.pinGLTF1';
      }
      if (current === buzzerModel) {
        console.log('Shader Manager: Identified via ancestor as buzzerModel');
        return 'buzzerModel';
      }
      if (current === rgbLedModel) {
        console.log('Shader Manager: Identified via ancestor as rgbLed');
        return 'rgbLed';
      }
      if (current === batteryWire2) {
        console.log('Shader Manager: Identified via ancestor as batteryWire2');
        return 'batteryWire2';
      }
      if (current === batteryWire2?.pinGLTF1) {
        console.log('Shader Manager: Identified via ancestor as batteryWire2.pinGLTF1');
        return 'batteryWire2.pinGLTF1';
      }
      current = current.parent;
    }
    
    // Check if it's a JST pin child object (generic fallback)
    if (jstPin && (object === jstPin.pinGLTF1 || object === jstPin.pinGLTF2)) {
      console.log('Shader Manager: Identified as jstPin child');
      return 'jstPin';
    }
    if (jstPin2 && (object === jstPin2.pinGLTF1 || object === jstPin2.pinGLTF2)) {
      console.log('Shader Manager: Identified as jstPin2 child');
      return 'jstPin2';
    }
    if (jstPin3 && (object === jstPin3.pinGLTF1 || object === jstPin3.pinGLTF2)) {
      console.log('Shader Manager: Identified as jstPin3 child');
      return 'jstPin3';
    }
    
    console.log('Shader Manager: Object not identified, returning unknown');
    return 'unknown';
  }

  // Cleanup all shaders
  cleanup() {
    if (this.isActive) {
      // Remove shader from any active object
      this.originalMaterials.forEach((originalMaterials, object) => {
        this.removeShaderFromObject(object);
      });
    }
    
    this.originalMaterials.clear();
    this.materialMeshes.clear();
    this.isActive = false;
    this.currentShader = null;
    this.currentConfig = null;
    this.lastDraggedObject = null;

    // Hide labels on cleanup
    try { if (this._dragLabel) this._dragLabel.visible = false; } catch (e) {}
    try { if (this._dropLabel) this._dropLabel.visible = false; } catch (e) {}
  }

  // Set custom shader parameters
  setBaseColor(color) {
    if (this.currentShader) {
      this.currentShader.uniforms.baseColor.value.set(color);
    }
  }

  setGlowColor(color) {
    if (this.currentShader) {
      this.currentShader.uniforms.glowColor.value.set(color);
    }
  }

  setBlinkSpeed(speed) {
    if (this.currentShader) {
      this.currentShader.uniforms.blinkSpeed.value = speed;
    }
  }

  setGlowIntensity(intensity) {
    if (this.currentShader) {
      this.currentShader.uniforms.glowIntensity.value = intensity;
    }
  }
}

// Global instance
let shaderManagerInstance = null;

export function getShaderManager() {
  if (!shaderManagerInstance) {
    shaderManagerInstance = new ShaderManager();
  }
  return shaderManagerInstance;
}

// Convenience functions for easy integration
export function applyStepShader(lessonId, stepIndex) {
  const manager = getShaderManager();
  manager.handleStepShader(lessonId, stepIndex);
}

export function handleDragStart(draggedObject) {
  const manager = getShaderManager();
  manager.handleDragStart(draggedObject);
}

export function handleDragEnd(draggedObject) {
  const manager = getShaderManager();
  manager.handleDragEnd(draggedObject);
}

export function handleSnap(snapType) {
  const manager = getShaderManager();
  manager.handleSnap(snapType);
}

export function updateShader(deltaTime) {
  const manager = getShaderManager();
  manager.update(deltaTime);
}

export function cleanupShader() {
  const manager = getShaderManager();
  manager.cleanup();
}

// Test function to manually verify shader manager is working
export function testShaderManager() {
  console.log('Testing Shader Manager...');
  const manager = getShaderManager();
  
  // Test 1: Apply shader to JST pin
  console.log('Test 1: Applying shader to JST pin');
  const jstPin = manager.getModel('jstPin');
  const jstPinGroup = jstPin?.group;
  if (jstPinGroup) {
    const testStepConfig = {
      target: 'jstPin',
      action: 'blink',
      config: {
        baseColor: 0x2c3e50,
        glowColor: 0x3498db,
        blinkSpeed: 2.0,
        glowIntensity: 0.8
      },
      onDragStart: 'removeFromJstPinAndApplyToRgbPin1',
      onDragEnd: 'none',
      onSnap: 'removeFromRgbPin1'
    };
    manager.applyShaderToObject(jstPinGroup, testStepConfig);
    console.log('Test 1: Shader applied to JST pin');
  } else {
    console.warn('Test 1: JST pin not found');
  }
  
  // Test 2: Check expansion board
  console.log('Test 2: Checking expansion board');
  const expansionBoard = manager.getModel('expansionBoardModel');
  if (expansionBoard) {
    console.log('Test 2: Expansion board found:', expansionBoard);
    // Debug expansion board children
    const allChildren = [];
    expansionBoard.traverse((child) => {
      allChildren.push(child.name);
    });
    console.log('Test 2: Expansion board children:', allChildren);
    
    // Test finding nano child
    const expansionNano = manager.getTargetObject('expansionNano');
    console.log('Test 2: expansionNano found:', expansionNano);
  } else {
    console.warn('Test 2: Expansion board not found');
  }
  
  // Test 3: Check object identification
  console.log('Test 3: Testing object identification');
  if (jstPinGroup) {
    const objectName = manager.getObjectName(jstPinGroup);
    console.log('Test 3: JST pin identified as:', objectName);
  }
  
  // Test 4: Check nano model
  console.log('Test 4: Testing nano model');
  const nanoModel = manager.getModel('nanoModel');
  if (nanoModel) {
    console.log('Test 4: Nano model found:', nanoModel);
    const objectName = manager.getObjectName(nanoModel);
    console.log('Test 4: Nano model identified as:', objectName);
  } else {
    console.warn('Test 4: Nano model not found');
  }
} 