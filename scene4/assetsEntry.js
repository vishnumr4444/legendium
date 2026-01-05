/**
 * @fileoverview Scene 4 asset manifest.
 *
 * This file declares *all* assets Scene 4 depends on and includes a small helper
 * for rewriting `/r2/*` paths to a CDN base (Cloudflare R2 public bucket).
 *
 * Why the CDN helper exists:
 * - In production we want heavy assets (GLBs/HDRs) served from a CDN.
 * - In development, we often proxy `/r2/*` via the dev server to avoid CORS and
 *   keep local iteration fast.
 *
 * Loader expectations:
 * - `../commonFiles/assetsLoader.js` reads this object and produces `allAssets`.
 * - `name` fields become stable keys for lookups like:
 *   - `allAssets.models.gltf.main`
 *   - `allAssets.textures.portal`
 *   - `allAssets.videotextures.DTwin`
 *   - `allAssets.audios.electroFirstAudio`
 */

/**
 * Resolve the CDN base URL.
 *
 * Priority:
 * 1) `window.ASSETS_CDN_BASE` (explicit full base URL)
 * 2) `window.ASSETS_R2_ACCOUNT_ID` (base URL becomes `https://<id>.r2.dev`)
 * 3) Hard-coded fallback base URL (ensures scene works without config)
 */
const CDN_BASE = (() => {
  if (typeof window !== 'undefined') {
    if (window.ASSETS_CDN_BASE) return window.ASSETS_CDN_BASE;
    if (window.ASSETS_R2_ACCOUNT_ID) return `https://${window.ASSETS_R2_ACCOUNT_ID}.r2.dev`;
  }
  return 'https://pub-4dc5824a7d6645b29006348054fb1f3f.r2.dev';
})();

/**
 * Detect whether we are on a local/dev host.
 * If true, we keep `/r2/*` paths unchanged so the dev server can proxy them.
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
 * Rewrite `/r2/*` paths to the resolved CDN base in production-like environments.
 *
 * @param {string} p
 * @returns {string}
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
 * Scene 4 assets manifest.
 *
 * Categories:
 * - `models`: GLB scene + component models used in the puzzle / info panels.
 * - `textures`: UI textures, portal textures, and small reference images.
 * - `videoTextures`: MP4s used on in-world screens (digital twin + Zoe).
 * - `audios`: Scene narration/dialogue, feedback sounds, and background music.
 * - `hdris`: Environment HDR used for lighting and background.
 *
 * Notes:
 * - Some audio paths are relative without a leading `/` (e.g. `"scene44/Audio/..."`).
 *   Ensure your asset server serves those correctly, or standardize to `/scene44/...`.
 */
export const assetsEntry = {
  characters: [
    {
      name: "electro",
      path: "/characters/ROBOT_17.glb",
      shadow: false,
    },
  ],
  models: [
    {
      name: "battery9v",
      path: "/scene44/battery9vtest.glb",
      shadow: false,
    },
    {
      name: "introBattery9v",
      path: "/scene44/introbattery9v.glb",
      shadow: false,
    },
    {
      name: "capacitor",
      path: "/scene44/capacitor.glb",
      shadow: false,
    },
    {
      name: "resistor100",
      path: "/scene44/resistor.glb",
      shadow: false,
    },
    {
      name: "dcMotor",
      path: "/scene44/circuitMotor.glb",
      shadow: false,
    },
    {
      name: "introMotor",
      path: "/scene44/motor.glb",
      shadow: false,
    },
    {
      name: "led",
      path: "/scene44/led.glb",
      shadow: false,
    },
    {
      name: "UBEC",
      path: "/scene44/ubec.glb",
      shadow: false,
    },
    {
      name: "rgbModule",
      path: "/scene44/rgbModule.glb",
      shadow: false,
    },
    {
      name: "powerDistributionModule",
      path: "/scene44/powerDistributor.glb",
      shadow: false,
    },
    {
      name: "motorDriver",
      path: "/scene44/motorDriver.glb",
      shadow: false,
    },
    {
      name: "button",
      path: "/scene44/button.glb",
      shadow: false,
    },
    {
      name: "buzzer",
      path: "/scene44/buzzer.glb",
      shadow: false,
    },
    {
      name: "main",
      path: toCDN("/r2/baked_4.5.glb"),
      shadow: true,
    },
  ],
  textures: [
    {
      name: "portal",
      path: "/scene44/Images/Textures/Portal_Base_Upscaled.png",
    },
    {
      name: "screen",
      path: "/scene44/Images/Textures/Frame 1 (7).png",
    },
    {
      name: "Lock_Base",
      path: "/scene44/Images/Textures/Lock_Base.png",
    },
    {
      name: "Lock_Base_Alpha",
      path: "/scene44/Images/Textures/Lock_Base_Alpha.png",
    },
    {
      name: "batteryImg",
      path: "/scene44/Images/Textures/CircuitImages/batteryBW.png",
    },
    {
      name: "capacitorImg",
      path: "/scene44/Images/Textures/CircuitImages/capacitorBW.png",
    },
    {
      name: "ledImg",
      path: "/scene44/Images/Textures/CircuitImages/ledBW.png",
    },
    {
      name: "motorImg",
      path: "/scene44/Images/Textures/CircuitImages/motorBW.png",
    },
    {
      name: "resistorImg",
      path: "/scene44/Images/Textures/CircuitImages/resistorBW.png",
    },
    {
      name: "keyboardImg",
      path: "/scene44/Images/Textures/Keyboard.png",
    },
  ],
  videoTextures: [{
    name: "DTwin",
    path: "/scene44/Videos/dTwin.mp4",
  }, {
    name: "ZoeVid",
    path: "/scene44/Videos/zoeVid.mp4",
  },],
  audios: [
    {
      name: "background",
      path: "/audios/background.mp3",
      volume: 1,
      loop: true
    }, // Global background music
    {
      name: "electroCaution1",
      path: "scene44/Audio/electroCaution1.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "electroFirstAudio",
      path: "scene44/Audio/electroFirstAudio.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "eIntroFinal",
      path: "scene44/Audio/eIntroFinalEdit2.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "electroCall",
      path: "scene44/Audio/electroCall.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "digiTwinConvo",
      path: "scene44/Audio/dTwinConvo.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "electroIntroDone",
      path: "scene44/Audio/electroIntroDone.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "electroWrongCircuit",
      path: "scene44/Audio/ElectroCircuitDisagree.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "electroCorrectCircuit",
      path: "scene44/Audio/ElectroCircuitAgree.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "electroGateOpen",
      path: "scene44/Audio/ElectroGateOpen.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
    {
      name: "digiTwinEnd",
      path: "scene44/Audio/dtwinEnd.mp3",
      volume: 1,
      loop: false,
      positional: false,
    },
  ],
  hdris: [{ name: "env", path: toCDN("/r2/dark_forest.hdr") }],
  cubeMaps: [],
  vfxs: [
    { name: "zone", path: "vfxFiles/zone.json" },
    { name: "circuitPuzzleZone", path: "vfxFiles/zone.json" },
  ],
  pathFiles: [],
  jsonFiles: [],
  fonts: [],
  svgs: [],
};
