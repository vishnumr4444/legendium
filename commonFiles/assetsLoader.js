/**
 * ============================================
 * ASSETS LOADER MODULE
 * ============================================
 * This module is responsible for loading all game assets including:
 * - 3D Models (GLTF format)
 * - Textures and HDRIs
 * - Audio files (background music, sound effects)
 * - VFX (Visual Effects) using three.quarks
 * - Character models and animations
 * - Path files for NPC navigation
 * - Font files for 3D text creation
 * - SVG assets and other JSON files
 * 
 * Key Features:
 * - Centralized asset management through 'allAssets' object
 * - Loading manager for progress tracking
 * - Parallel asset loading for performance
 * - Support for video textures
 * - Audio listener setup for 3D positional audio
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { initializeLoadingManager, loadingManager } from "../loadingManager";
import { getUserInfo } from "../data";
import { QuarksLoader } from "three.quarks";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { FontLoader } from "three/examples/jsm/Addons.js";
import { playerAssetsEntry } from "./playerAssetsEntry";

// Loader instances - initialized once and reused for all asset loading
let modelLoader = null;
let textureLoader = null;
let audioLoader = null;
let quarksLoader = null;
let rgbeLoader = null;
let cubeTextureLoader = null;
let listener = null;
let videoTextureLoader = null;
// ============================================
// GLOBAL ASSETS OBJECT
// ============================================
// Central repository for all loaded game assets
// Organized by type for easy access throughout the game
// Each property is populated as assets are loaded
export const allAssets = {
  models: {
    gltf: {},          // GLTF 3D models
    animations: {},    // Animation data associated with models
  },
  textures: {},        // 2D textures for materials
  audios: {},          // Audio files for sound effects and music
  videotextures: {},   // Video files used as textures
  characters: {
    animations: {},    // Character-specific animation data
    models: {},        // Character model variants
  },
  selectedPlayer: {
    model: {},         // Currently selected player character model
    audios: {},        // Player-specific audio (footsteps, voice lines)
  },
  hdris: {},           // High Dynamic Range Images for environment lighting
  cubeMaps: {},        // Skybox/environment cubemaps
  vfxs: {},            // Visual effects (particle systems, shaders)
  pathFiles: {},       // Path data for NPC movement and animations
  jsonFiles: {},       // Generic JSON data files
  fonts: {},           // Font files for 3D text rendering
  svgs: {},            // SVG assets
};
const userInfo = getUserInfo();
export async function loadAllAsset(assetesEntry, camera, renderer, scene) {
  initializeLoadingManager(camera, renderer, scene);
  modelLoader = new GLTFLoader(loadingManager);
  textureLoader = new THREE.TextureLoader(loadingManager);
  audioLoader = new THREE.AudioLoader(loadingManager);
  
  // Suppress quarks library console message during initialization
  const originalLog = console.log;
  console.log = function(...args) {
    // Filter out the quarks message
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Particle system powered by three.quarks')) {
      return;
    }
    originalLog.apply(console, args);
  };
  quarksLoader = new QuarksLoader(loadingManager);
  console.log = originalLog; // Restore console.log
  
  rgbeLoader = new RGBELoader(loadingManager);
  cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);
  listener = new THREE.AudioListener();
  videoTextureLoader = new THREE.VideoTexture(loadingManager);
  const modelPromises = loadModels(assetesEntry);
  const characterPromises = loadCharacters(assetesEntry);
  const texturePromises = loadTextures(assetesEntry);
  const audioPromises = await loadAudios(assetesEntry, camera);
  const selectedPlayerPromise = loadSelectedCharacter(
    userInfo.selectedCharacter
  );

  const vfxPromises = loadVFX(assetesEntry);
  const hdrisPromises = loadHdris(assetesEntry);
  const cubemapsPromises = loadCubeMaps(assetesEntry);
  const pathJsonFilePromises = loadPathFile(assetesEntry);
  const fontFilePromises = loadFontFile(assetesEntry);
  const jsonFilePromises = loadJsonFiles(assetesEntry);
  const svgsFilesPromises = loadSvgs(assetesEntry);
  const playerMovementAudioPromises =
    loadPlayerMovementAudio(playerAssetsEntry);
  const videoTexturePromises = loadVideoTextures(assetesEntry);
  await Promise.all([
    ...modelPromises,
    playerMovementAudioPromises,
    ...characterPromises,
    ...texturePromises,
    ...audioPromises,
    selectedPlayerPromise,
    ...videoTexturePromises,
    ...vfxPromises,
    ...hdrisPromises,
    ...cubemapsPromises,
    ...pathJsonFilePromises,
    ...fontFilePromises,
    ...jsonFilePromises,
    ...svgsFilesPromises,
  ]);
}
function loadModels(assetsEntry) {
  
  return (
    assetsEntry.models?.map(({ name, path, shadow,scale }) => {
      if (allAssets.models.gltf[name]) {
        console.log(`${name} model already exists.`);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        modelLoader.load(
          path,
          (gltf) => {
            if(scale){
              gltf.scene.scale.set(scale.x, scale.y, scale.z);
            }
            gltf.scene.name = name;
            allAssets.models.gltf[name] = gltf.scene;

            // Enable or disable shadows based on the `shadow` property
            gltf.scene.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = shadow ?? false; // Default to false if not set
                child.receiveShadow = shadow ?? false;
              }
            });

            // Handle animations
            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(gltf.scene);
              allAssets.models.animations[name] = { mixer, actions: {} };

              gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                allAssets.models.animations[name].actions[clip.name] = action;
              });
            }

            resolve();
          },
          undefined,
          reject
        );
      });
    }) || []
  );
}

function loadVideoTextures(assetesEntry) {
  return (
    assetesEntry.videoTextures?.map(({ name, path }) => {
      if (allAssets.videotextures[name]) {
        console.log(`${name} video texture already exists.`);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = path;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        // Store the video path and element in allAssets
        allAssets.videotextures[name] = {
          video: video,
          path: path
        };
        
        resolve();
      });
    }) || []
  );
}

function loadCharacters(assetesEntry) {
  return (
    assetesEntry.characters?.map(({ name, path, shadow }) => {
      if (allAssets.characters[name]) {
        console.log(`${name} character already exists.`);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        modelLoader.load(
          path,
          (gltf) => {
            gltf.scene.name = name;
            allAssets.characters.models[name] = gltf.scene;
            gltf.scene.traverse((obj) => {
              obj.castShadow = shadow ?? false;
              obj.receiveShadow = shadow ?? false;
            });
            animationConfig(gltf, name);
            // console.log(allAssets.characters);
            
            resolve();
          },
          undefined,
          reject
        );
      });
    }) || []
  );
}
function animationConfig(modelRoot, modelName) {
  if (
    !modelRoot ||
    !modelRoot.animations ||
    modelRoot.animations.length === 0
  ) {
    return;
  }

  // Create an AnimationMixer for the model
  const animationMixer = new THREE.AnimationMixer(modelRoot.scene);
  const animationActions = {};

  // Loop through all animations and create corresponding AnimationActions
  modelRoot.animations.forEach((clip) => {
    animationActions[clip.name] = animationMixer.clipAction(clip);
  });

  // Store animations inside allAssets.animations with model-specific data
  allAssets.characters.animations[modelName] = {
    mixer: animationMixer, // Store mixer for this model
    actions: animationActions, // Store actions for each animation clip
  };
}
function loadTextures(assetesEntry) {
  return (
    assetesEntry.textures?.map(({ name, path }) => {
      if (allAssets.textures[name]) {
        console.log(`${name} texture already exists.`);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const texture = textureLoader.load(path, () => resolve(texture));
        allAssets.textures[name] = texture;
      });
    }) || []
  );
}
function loadAudios(assetesEntry, camera) {
  // camera.add(listener); // Attach listener to the camera

  const promises =
    assetesEntry.audios?.map(
      ({
        name,
        path,
        volume = 1,
        loop = false,
        positional = false,
        refDistance = 5,
      }) => {
        if (allAssets.audios[name]) {
          console.log(`${name} audio already exists.`);
          return Promise.resolve(allAssets.audios[name]); // Return the existing audio
        }

        return new Promise((resolve, reject) => {
          audioLoader.load(
            path,
            (buffer) => {
              let sound;

              if (positional) {
                sound = new THREE.PositionalAudio(listener);
                sound.setRefDistance(refDistance);
              } else {
                sound = new THREE.Audio(listener);
              }

              sound.setBuffer(buffer);
              sound.setVolume(volume);
              sound.setLoop(loop);
              allAssets.audios[name] = sound;

              resolve(sound);
            },
            undefined,
            reject
          );
        });
      }
    ) || [];

  return Promise.all(promises).then((loadedAudios) => loadedAudios);
}

function loadSelectedCharacter(name) {
  if (allAssets.characters[name]) {
    console.log(`${name} character already exists.`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    modelLoader.load(
      userInfo.selectedCharacter,
      (gltf) => {
        gltf.scene.name = name;

        allAssets.selectedPlayer.model[name] = gltf.scene;
        gltf.scene.traverse((obj) => {
          obj.castShadow = true;
          obj.receiveShadow = true;
        });
        animationConfig(gltf, name);
        resolve();
      },
      undefined,
      reject
    );
  });
}
function loadPlayerMovementAudio(playerAssetsEntry) {
  const audioPromises =
    playerAssetsEntry.audios?.map(({ name, path, volume }) => {
      if (allAssets.selectedPlayer.audios[name]) {
        console.log(`${name} audio already exists.`);
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        audioLoader.load(
          path,
          (buffer) => {
            let sound = new THREE.Audio(listener);
            sound.setBuffer(buffer);
            sound.setLoop(false);
            sound.setVolume(volume ?? 1);
            allAssets.selectedPlayer.audios[name] = sound;
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Error loading audio: ${name}`, error);
            reject(error);
          }
        );
      });
    }) || [];
  return Promise.all(audioPromises);
}
function loadVFX(assetesEntry) {
  return (
    assetesEntry.vfxs?.map(({ name, path }) => {
      if (allAssets.vfxs[name]) {
        console.log(`${name} VFX already exists.`);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        quarksLoader.load(
          path,
          (effect) => {
            effect.name = name;
            allAssets.vfxs[name] = effect;
            resolve();
          },
          undefined,
          reject
        );
      });
    }) || []
  );
}
function loadHdris(assetesEntry) {
  return (
    assetesEntry.hdris?.map(({ name, path }) => {
      if (allAssets.hdris[name]) {
        console.log(`${name} HDRI already exists.`);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        rgbeLoader.load(
          path,
          (texture) => {
            texture.name = name;
            texture.mapping = THREE.EquirectangularReflectionMapping;
            allAssets.hdris[name] = texture;
            resolve();
          },
          undefined,
          reject
        );
      });
    }) || []
  );
}

function loadCubeMaps(assetesEntry) {
  return (
    assetesEntry.cubeMaps?.map(({ name, images }) => {
      if (allAssets.cubeMaps[name]) {
        console.log(`${name} CubeMap already exists.`);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        cubeTextureLoader.load(
          images, // Updated from paths to images
          (texture) => {
            texture.mapping = THREE.CubeReflectionMapping;
            allAssets.cubeMaps[name] = texture;
            resolve();
          },
          undefined,
          reject
        );
      });
    }) || []
  );
}

function loadPathFile(assetesEntry) {
  if (!assetesEntry.pathFiles || assetesEntry.pathFiles.length === 0) {
    console.warn("No path files provided in assetesEntry.");
    return []; // Ensure it returns an array
  }

  const promises = assetesEntry.pathFiles.map(
    ({ name, path, offset, invertZ }) => {
      if (allAssets.pathFiles[name]) {
        console.log(`Path file for ${name} is already loaded.`);
        return Promise.resolve(allAssets.pathFiles[name]);
      }

      return fetch(path)
        .then((response) => response.json())
        .then((data) => {
          if (!Array.isArray(data)) {
            throw new Error(`Invalid JSON structure for ${name}`);
          }

          const points = processCurveData(data, offset, invertZ);
          const result = { name, points };

          // Store in allAssets.pathFiles
          allAssets.pathFiles[name] = result;
          console.log(`Loaded and cached path file for ${name}.`);

          return result;
        })
        .catch((error) => {
          console.error(`Error loading path file for ${name}:`, error);
          return null; // Ensure it doesn't break Promise.all()
        });
    }
  );

  return promises; // Should always return an array of promises
}

function processCurveData(
  curvesData,
  offset = { x: 0, y: 0, z: 0 },
  invertZ = false
) {
  let points = [];

  curvesData.forEach((curveData) => {
    curveData.vertices.forEach((spline) => {
      spline.forEach((point) => {
        const x = point.co[0] + offset.x;
        const y = point.co[1] + offset.y;
        const z = (invertZ ? -point.co[2] : point.co[2]) + offset.z;

        points.push(new THREE.Vector3(x, y, z));
      });
    });
  });

  return points;
}

function loadFontFile(assetesEntry) {
  if (!assetesEntry.fonts || assetesEntry.fonts.length === 0) {
    console.warn("No font files provided in assetesEntry.");
    return [];
  }

  return assetesEntry.fonts.map(({ fontName, data }) => {
    if (allAssets.fonts[fontName]) {
      console.log(`Font ${fontName} is already loaded.`);
      return Promise.resolve(allAssets.fonts[fontName]);
    }

    return fetch(data.jsonDataPath)
      .then((res) => res.json()) // Load JSON
      .then((jsonData) => {
        let font;

        if (!data.textureDataPath) {
          // If there's no texture, parse JSON using FontLoader
          const loader = new FontLoader();
          const parsedFont = loader.parse(jsonData);
          font = {
            name: fontName,
            json: parsedFont, // Store the parsed Font object
            image: null,
          };
        } else {
          // If there is a texture, load JSON normally
          font = {
            name: fontName,
            json: jsonData, // Keep JSON without parsing
            image: data.textureDataPath, // Store texture path
          };
        }

        // Store in `allAssets`
        allAssets.fonts[fontName] = font;
        console.log(`Loaded and cached font: ${fontName}.`);

        return font;
      })
      .catch((error) => {
        console.error(`Error loading font ${fontName}:`, error);
        return null;
      });
  });
}

function loadJsonFiles(assetsEntry) {
  return (
    assetsEntry.jsonFiles?.map(({ name, path }) => {
      if (allAssets.jsonFiles[name]) {
        console.log(`${name} JSON file already exists.`);
        return Promise.resolve();
      }

      return fetch(path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load JSON file: ${name}`);
          }
          return response.json();
        })
        .then((jsonData) => {
          allAssets.jsonFiles[name] = jsonData;
          console.log(`Loaded JSON file: ${name}`);
        })
        .catch((error) => console.error(error));
    }) || []
  );
}
function loadSvgs(assetsEntry) {
  return (
    assetsEntry.svgs?.map(({ name, path }) => {
      console.log(name, path);

      if (allAssets.svgs[name]) {
        console.log(`${name} SVG already exists.`);
        return Promise.resolve();
      }

      return fetch(path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load SVG file: ${name}`);
          }
          return response.text();
        })
        .then((svgData) => {
          allAssets.svgs[name] = svgData;
          console.log(`Loaded SVG file: ${name}`);
        })
        .catch((error) => console.error(error));
    }) || []
  );
}

export function checkExistingAssets(nextAssetsEntry) {
  Object.keys(allAssets).forEach((category) => {
    // --- FIX 1: Add this block to skip global/persistent assets ---
    // Skip 'selectedPlayer' as it's managed globally, not by scene entries
    if (category === "selectedPlayer") {
      return;
    }
    // --- End of FIX 1 ---

    // --- FIX 2: This logic is moved outside the faulty 'if' ---
    // Get the next scene's asset names for this category.
    // If the category doesn't exist in the next scene (nextAssetsEntry[category] is undefined),
    // default to an empty array []. This creates an empty Set.
    const nextAssetsNames = new Set(
      (nextAssetsEntry[category] || []).map((asset) => asset.name)
    );
    // --- End of FIX 2 ---

    // The original 'if (nextAssetsEntry[category])' check is REMOVED.
    // Now, the cleanup logic below will ALWAYS run for every category.

    // If 'nextAssetsNames' is empty (because the category was missing),
    // the check '!nextAssetsNames.has(existingKey)' will be TRUE for all
    // existing assets, and the entire category will be correctly purged.

    if (category === "models") {
      Object.keys(allAssets.models.gltf).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const gltf = allAssets.models.gltf[existingKey];
          if (gltf) {
            gltf.traverse((child) => {
              if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.isMaterial) {
                  child.material.dispose();
                  if (child.material.map) child.material.map.dispose();
                }
              }
            });
            delete allAssets.models.gltf[existingKey];
          }
        }
      });
      Object.keys(allAssets.models.animations).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          delete allAssets.models.animations[existingKey];
        }
      });
    }

    if (category === "textures") {
      Object.keys(allAssets.textures).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const texture = allAssets.textures[existingKey];
          if (texture) {
            texture.dispose();
            delete allAssets.textures[existingKey];
          }
        }
      });
    }

    if (category === "audios") {
      Object.keys(allAssets.audios).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const audio = allAssets.audios[existingKey];
          if (audio) {
            audio.stop(); // Stop playback if active
            // Note: Audio buffers are not explicitly disposed,
            // letting garbage collection handle them after removing reference.
            delete allAssets.audios[existingKey];
          }
        }
      });
    }

    if (category === "videotextures") {
      Object.keys(allAssets.videotextures).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const videoData = allAssets.videotextures[existingKey];
          if (videoData && videoData.video) {
            videoData.video.pause();
            videoData.video.src = ""; // Clear source
            videoData.video.load(); // Abort pending network requests
            videoData.video = null;
            delete allAssets.videotextures[existingKey];
          }
        }
      });
    }

    if (category === "hdris") {
      Object.keys(allAssets.hdris).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const hdri = allAssets.hdris[existingKey];
          if (hdri) {
            hdri.dispose();
            delete allAssets.hdris[existingKey];
          }
        }
      });
    }

    if (category === "cubeMaps") {
      Object.keys(allAssets.cubeMaps).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const cubeMap = allAssets.cubeMaps[existingKey];
          if (cubeMap) {
            cubeMap.dispose();
            delete allAssets.cubeMaps[existingKey];
          }
        }
      });
    }

    if (category === "vfxs") {
      Object.keys(allAssets.vfxs).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const vfx = allAssets.vfxs[existingKey];
          if (vfx) {
            // Add Quarks-specific cleanup if available, e.g., vfx.destroy()
            if (typeof vfx.destroy === 'function') {
                vfx.destroy();
            }
            delete allAssets.vfxs[existingKey];
          }
        }
      });
    }

    if (category === "pathFiles") {
      Object.keys(allAssets.pathFiles).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          delete allAssets.pathFiles[existingKey];
        }
      });
    }

    if (category === "jsonFiles") {
      Object.keys(allAssets.jsonFiles).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          delete allAssets.jsonFiles[existingKey];
        }
      });
    }

    if (category === "fonts") {
      Object.keys(allAssets.fonts).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const font = allAssets.fonts[existingKey];
          if (font) {
            // Standard THREE.Font objects (from loader.parse) don't
            // have a dispose method. Geometries created *from* them
            // must be disposed, but the font data itself is just JS.
            // If font.image stored a loaded texture (which it doesn't
            // in your current loader), it would be disposed here.
            // For now, just deleting the reference is correct.
            delete allAssets.fonts[existingKey];
          }
        }
      });
    }

    if (category === "svgs") {
      Object.keys(allAssets.svgs).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          delete allAssets.svgs[existingKey];
        }
      });
    }

    if (category === "characters") {
      Object.keys(allAssets.characters.models).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          const gltf = allAssets.characters.models[existingKey];
          if (gltf) {
            gltf.traverse((child) => {
              if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.isMaterial) {
                  child.material.dispose();
                  if (child.material.map) child.material.map.dispose();
                }
              }
            });
            delete allAssets.characters.models[existingKey];
          }
        }
      });
      Object.keys(allAssets.characters.animations).forEach((existingKey) => {
        if (!nextAssetsNames.has(existingKey)) {
          delete allAssets.characters.animations[existingKey];
        }
      });
    }
  });
}
 
