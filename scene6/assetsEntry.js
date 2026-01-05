/**
 * About: `scene6/assetsEntry.js`
 *
 * Scene 6 asset manifest + path helpers.
 * - Resolves `/r2/...` paths to the configured CDN in production (`toCDN`)
 * - Leaves `/r2/...` paths untouched on dev hosts so the dev proxy can handle them (avoid CORS)
 * - Exports `assetsEntry` listing models, audio, HDRIs, and JSON files consumed by the loader
 */

"use strict"; // Enable strict mode for safer, more predictable JavaScript

/**
 * Base URL for the asset CDN.
 * - Reads optional overrides from window.ASSETS_CDN_BASE or window.ASSETS_R2_ACCOUNT_ID.
 * - Falls back to the default public R2 bucket URL.
 *
 * @type {string}
 */
const CDN_BASE = (() => {
  if (typeof window !== 'undefined') {
    if (window.ASSETS_CDN_BASE) return window.ASSETS_CDN_BASE;
    if (window.ASSETS_R2_ACCOUNT_ID) return `https://${window.ASSETS_R2_ACCOUNT_ID}.r2.dev`;
  }
  return 'https://pub-4dc5824a7d6645b29006348054fb1f3f.r2.dev';
})();

/**
 * Detect whether the current host is a local / development environment.
 * Used to decide whether to let the dev server proxy /r2 paths directly.
 *
 * @returns {boolean} True if running on localhost or a private network range.
 */
const isDevHost = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
  );
};

/**
 * Normalize an asset path to point at the CDN (in production) or leave it
 * as a local /r2 path (in development so Vite proxy can avoid CORS issues).
 *
 * @param {string} p - Original relative asset path.
 * @returns {string} Resolved path, possibly rewritten to the CDN base URL.
 */
const toCDN = (p) => {
  if (!p) return p;
  if (p.startsWith('/r2/')) {
    if (isDevHost()) return p; // Let Vite proxy handle /r2 in dev to avoid CORS
    const pathOnBucket = p.replace(/^\/r2\//, '/');
    return CDN_BASE ? `${CDN_BASE}${pathOnBucket}` : pathOnBucket;
  }
  return p;
};

/**
 * Asset manifest for Scene 6.
 * This configuration is consumed by the shared assets loader to load:
 * - GLTF models
 * - Audio clips for each lesson
 * - HDRI environment(s)
 * - JSON configuration files (lessons and questions)
 */
export const assetsEntry = {
  models: [
    { name: "mainModel", path: "/scene66/robo_lab.glb", shadow: true },

    // ...existing entries...
    { name: "nano1", path: "/scene66/arduinonano.glb" },
    { name: "arduinoNano", path: "/scene66/arduinonano3.glb" },
    {
      name: "expansionBoard",
      path: "/scene66/expansion_board.glb",
    }, // update path/name as needed
    {
      name: "expansionBoard2",
      path: "/scene66/expansion_board3.glb",
    }, // update path/name as needed
    {
      name: "pin4Female",
      path: "/scene66/femalepin_1.glb",
      scale: { x: 10, y: 10, z: 10 },
    }, // JST-XH female pin model
    {
      name: "pin2Female",
      path: "scene66/pin2Female.glb",
      scale: { x: 1, y: 1, z: 1 },
      // rotation: {x:0, y: Math.PI / 2, z: 0}
    },
    {
      name: "pin3Female",
      path: "scene66/pin3Female.glb",
      scale: { x: 10, y: 10, z: 10 },
    },
    {
      name: "rgbLEDModule",
      path: "/scene66/rgbled_1.glb",
    },
    {
      name: "rgbLed",
      path: "/scene66/rgbLed.glb",
      scale: { x: 6, y: 6, z: 6 },
    },
    {
      name: "buzzer",
      path: "/scene66/buzzer.glb",
      scale: { x: 10, y: 10, z: 10 },
    },
    {
      name: "ldr",
      path: "/scene66/ldr.glb",
      scale: { x: 7, y: 7, z: 7 },
    },
    {
      name: "motorDriver",
      path: "/scene66/motorDriver.glb",
      scale: { x: 0.2, y: 0.2, z: 0.2 },
    },
    {
      name: "motor",
      path: "/scene66/motor.glb",
      scale: { x: 0.07, y: 0.07, z: 0.07 },
    },
    {
      name: "battery",
      path: "/scene66/battery_2.glb",
      scale: { x: 0.7, y: 0.7, z: 0.7 },
    },
    {
      name: "tsop",
      path: "/scene66/tsop.glb",
      scale: { x: 0.4, y: 0.4, z: 0.4 },
    },
    {
      name: "remote",
      path: "/scene66/remote.glb",
      scale: { x: 1, y: 1, z: 1 },
    },
    {
      name: "pin4Female2",
      path: "/scene66/pin4Female2.glb",
      scale: { x: 5, y: 5, z: 5 },
    },
    {
      name: "pin2Female2",
      path: "/scene66/pin2Female2.glb",
      scale: { x: 0.6, y: 0.6, z: 0.6 },
    },
    {
      name: "pin3Female2",
      path: "/scene66/pin3Female2.glb",
      scale: { x: 0.12, y: 0.12, z: 0.12 },
    },
    {
      name: "battery2",
      path: "/scene66/batteryHolder.glb",
      scale: { x: 1.0, y: 1.0, z: 1.0 },
    },
  ],
  textures: [],
  audios: [
    {
      name: "narrator_intro",
      path: "/scene66/audio/intro/narrator_intro.mp3",
    },
    {
      name: 'lesson1_s1',
      path: "/scene66/audio/lesson_1/step_2.wav"
    },
    {
      name: 'lesson1_s2',
      path: "/scene66/audio/lesson_1/step_3.wav"
    },
    {
      name: 'lesson1_s3',
      path: "/scene66/audio/lesson_1/step_4.wav"
    },
    {
      name: 'lesson1_s4',
      path: "/scene66/audio/lesson_1/step_5.wav"
    },
    {
      name: 'lesson1_s5',
      path: "/scene66/audio/lesson_1/step_1.wav"
    },
    {
      name: 'lesson1_s6',
      path: "/scene66/audio/lesson_1/step_6.wav"
    },
    {
      name: 'lesson1_s7',
      path: "/scene66/audio/lesson_1/step_3.wav"
    },
    {
      name: 'lesson1_s8',
      path: "/scene66/audio/lesson_1/step_7.wav"
    },
    {
      name: 'lesson2_s1',
      path: "/scene66/audio/lesson_2/step_1.wav"
    },
    {
      name: 'lesson2_s2',
      path: "/scene66/audio/lesson_2/step_2.wav"
    },
    {
      name: 'lesson2_s3',
      path: "/scene66/audio/lesson_2/step_3.wav"
    },
    {
      name: 'lesson2_s4',
      path: "/scene66/audio/lesson_2/step_4.wav"
    },
    {
      name: 'lesson2_s5',
      path: "/scene66/audio/lesson_2/step_5.wav"
    },
    {
      name: 'lesson2_s6',
      path: "/scene66/audio/lesson_2/buzzer_melody.mp3"
    },
    {
      name: 'lesson2_s7',
      path: "/scene66/audio/lesson_2/step_6.wav"
    },
    {
      name: 'lesson2_s8',
      path: "/scene66/audio/lesson_2/step_7.wav"
    },
    {
      name: 'lesson3_s1',
      path: "/scene66/audio/lesson_3/step_1.wav"  // Temporarily using lesson2 audio to test
    },
    {
      name: 'lesson3_s2',
      path: "/scene66/audio/lesson_3/step_2.wav"
    },
    {
      name: 'lesson3_s3',
      path: "/scene66/audio/lesson_3/step_3.wav"
    },
    {
      name: 'lesson3_s4',
      path: "/scene66/audio/lesson_3/step_4.wav"
    },
    {
      name: 'lesson3_s5',
      path: "/scene66/audio/lesson_3/step_5.wav"
    },
    {
      name: 'lesson3_s6',
      path: "/scene66/audio/lesson_3/step_6.wav"
    },
    {
      name: 'lesson3_s7',
      path: "/scene66/audio/lesson_3/step_7.wav"
    },
    {
      name: 'lesson3_s8',
      path: "/scene66/audio/lesson_3/step_8.wav"
    },
    {
      name: 'lesson3_s9',
      path: "/scene66/audio/lesson_3/step_9.wav"
    },
    {
      name: 'lesson3_s10',
      path: "/scene66/audio/lesson_3/step_10.wav"
    },
    {
      name: 'lesson4_s1',
      path: "/scene66/audio/lesson_4/step_1.wav"
    },
    {
      name: 'lesson4_s2',
      path: "/scene66/audio/lesson_4/step_2.wav"
    },
    {
      name: 'lesson4_s3',
      path: "/scene66/audio/lesson_4/step_3.wav"
    },
    {
      name: 'lesson4_s4',
      path: "/scene66/audio/lesson_4/step_4.wav"
    },
    {
      name: 'lesson4_s5',
      path: "/scene66/audio/lesson_4/step_5.wav"
    },
    {
      name: 'lesson4_s6',
      path: "/scene66/audio/lesson_4/step_6.wav"
    },
    {
      name: 'lesson4_s7',
      path: "/scene66/audio/lesson_4/step_7.wav"
    },
    {
      name: 'lesson4_s8',
      path: "/scene66/audio/lesson_4/step_8.wav"
    },
    {
      name: 'lesson4_s9',
      path: "/scene66/audio/lesson_4/step_9.wav"
    },
    {
      name: 'lesson5_s1',
      path: "/scene66/audio/lesson_5/step_1.wav"
    },
    {
      name: 'lesson5_s2',
      path: "/scene66/audio/lesson_5/step_2.wav"
    },
    {
      name: 'lesson5_s3',
      path: "/scene66/audio/lesson_5/step_3.wav"
    },
    {
      name: 'lesson5_s4',
      path: "/scene66/audio/lesson_5/step_4.wav"
    },
    {
      name: 'lesson5_s5',
      path: "/scene66/audio/lesson_5/step_5.wav"
    },
    {
      name: 'lesson5_s6',
      path: "/scene66/audio/lesson_5/step_6.wav"
    },
    {
      name: 'lesson5_s7',
      path: "/scene66/audio/lesson_5/step_7.wav"
    },
    {
      name: 'lesson5_s8',
      path: "/scene66/audio/lesson_5/step_8.wav"
    },
    {
      name: 'lesson5_s9',
      path: "/scene66/audio/lesson_5/step_9.wav"
    },
    {
      name: 'lesson5_s10',
      path: "/scene66/audio/lesson_5/step_10.wav"
    },
    {
      name: 'lesson5_s11',
      path: "/scene66/audio/lesson_5/step_11.wav"
    },
    {
      name: 'final',
      path: "/scene66/audio/final_audio.mp3"
    }
   
    
   
    
     
    
  ],
  vfxs: [],
  hdris: [
    {
      name: "sky6",
      path: toCDN("/r2/dark_forest.hdr")
    },
  ],
  cubeMaps: [],
  pathFiles: [],
  jsonFiles: [
    {
      name: "lessons",
      path: "/scene66/json/lessons.json",
    },
    {
      name: "lesson1-questions",
      path: "/scene66/json/lesson1-questions.json",
    },
    {
      name: "lesson2-questions",
      path: "/scene66/json/lesson2-questions.json",
    },
    {
      name: "lesson3-questions",
      path: "/scene66/json/lesson3-questions.json",
    },
    {
      name: "lesson4-questions",
      path: "/scene66/json/lesson4-questions.json",
    },
    {
      name: "lesson5-questions",
      path: "/scene66/json/lesson5-questions.json",
    },
  ],
  fonts: [],
  svgs: [],
};
