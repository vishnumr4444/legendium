/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
/**
 * Script Description
 * Scene 3 asset manifest.
 * Created on 2025-12-22 by vishnumr
 */
/*******************************************************************************
 *
 * **************************************************************************
 *
 *
 * Author: vishnumr
 *
 * REVISION HISTORY
 *
 *
 ******************************************************************************/

/**
 * Resolve the CDN base URL.
 *
 * Priority:
 * 1) `window.ASSETS_CDN_BASE` (explicit full base URL)
 * 2) `window.ASSETS_R2_ACCOUNT_ID` (base URL becomes `https://<id>.r2.dev`)
 * 3) Hard-coded fallback base URL
 */
const CDN_BASE = (() => {
  if (typeof window !== "undefined") {
    if (window.ASSETS_CDN_BASE) return window.ASSETS_CDN_BASE;
    if (window.ASSETS_R2_ACCOUNT_ID)
      return `https://${window.ASSETS_R2_ACCOUNT_ID}.r2.dev`;
  }
  return "https://pub-4dc5824a7d6645b29006348054fb1f3f.r2.dev";
})();

/**
 * Detect whether we are on a local/dev host.
 * Used to decide whether `/r2/*` should be rewritten or left to the dev proxy.
 */
const isDevHost = () => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
  );
};

/**
 * Rewrite `/r2/*` paths to the CDN base in production-like environments.
 *
 * @param {string} p
 * @returns {string}
 */
const toCDN = (p) => {
  if (!p) return p;
  if (p.startsWith("/r2/")) {
    if (isDevHost()) return p; // Let Vite proxy handle /r2 in dev to avoid CORS
    const pathOnBucket = p.replace(/^\/r2\//, "/");
    return CDN_BASE ? `${CDN_BASE}${pathOnBucket}` : pathOnBucket;
  }
  return p;
};

/**
 * Scene 3 assets manifest.
 *
 * Categories:
 * - `characters`: glTF characters with animation rigs (Zoe, Electro, fall character).
 * - `models`: environment + props.
 * - `textures`: static textures (e.g., logos).
 * - `audios`: narration/dialogue/SFX used throughout Scene 3.
 * - `videoTextures`: MP4 HUD clips used on in-world planes.
 * - `hdris` / `cubeMaps`: lighting/background setup.
 * - `vfxs`: Quarks JSON definitions used by `TriggerPoint` and other effects.
 */
export const assetsEntry = {
  characters: [
    {
      name: "zoe",
      path: "/characters/zoe_spec_v3 6.glb", //zoe_spec_v3 5
    },
    {
      name: "electro",
      path: "/characters/ROBOT_17.glb",
    },
    {
      name: "fallcharacter",
      path: "/characters/fallcharacter.glb",
    },
  ],
  models: [
    {
      name: "interior",
      path: toCDN("/r2/interior_22.glb"),
      shadow: true,
    },
    // {
    //   name: "interior",
    //   path: "/scene33/legendium_interior4.glb",
    //   shadow: true,
    // },
    {
      name: "underground",
      path: "/scene33/underground_path1.glb",
      shadow: false,
    },
    {
      name: "flyingBot",
      path: "/scene33/robot1.glb",
      shadow: false,
    },
    {
      name: "robotSweeper",
      path: "/scene33/robotSweeper.glb",
      shadow: false,
    },
    {
      name: "drone",
      path: "/scene33/robotSweeper.glb",
      shadow: false,
    },
  ],
  textures: [
    {
      name: "logo",
      path: "/legendium1.png",
      shadow: false,
    },
  ],
  audios: [
    {
      name: "background",
      path: "/audios/background.mp3",
      volume: 0.2,
      loop: true,
    }, // Global background music
    { name: "zoesound", path: "/scene33/zoe.mp3" },
    { name: "zoesound1", path: "/scene33/zoe2.mp3" },
    { name: "electrosound1", path: "/scene33/electro1.mp3" },
    { name: "emergency", path: "/scene33/emergency.mp3" },
    {
      name: "shakesound",
      path: "/scene33/island volcano erupting sfx.mp3",
      positional: true,
    },
    { name: "fallsound", path: "/scene33/fallsound.mp3" },
    { name: "zoesound11", path: "/scene33/zoe11.mp3" },
    { name: "electrosound2", path: "/scene33/electrosound2.mp3" },
    { name: "electroLookat", path: "/scene33/electroLookat1.mp3" },
    { name: "electroAudio4", path: "/scene33/electroAudio4.mp3" },
  ],
  hdris: [{ name: "evening", path: "/hdris/minedump_flats_4k.hdr" }],
  cubeMaps: [
    {
      name: "scene2Cubemap",
      images: [
        "scene33/cube_left.webp",
        "scene33/cube_right.webp",
        "scene33/cube_up.webp",
        "scene33/cube_down.webp",
        "scene33/cube_front.webp",
        "scene33/cube_back.webp",
      ],
    },
  ],
  vfxs: [
    {
      name: "vfx",
      path: "/vfxFiles/vfx.json",
    },
    {
      name: "entryvfx",
      path: "/vfxFiles/entryvfx.json",
    },
    {
      name: "redzone",
      path: "/vfxFiles/redzone.json",
    },
  ],
  videoTextures: [
    {
      name: "hud1",
      path: "/scene33/hud11.mp4",
    },
    {
      name: "hud2",
      path: "/scene33/hud11.mp4",
    },
    {
      name: "hudvideo",
      path: "/scene33/9.mp4",
    },
    {
      name: "hudvideo1",
      path: "/scene33/hudvideo3.mp4",
    },
  ],
  pathFiles: [],
  jsonFiles: [
    {
      name: "path1",
      path: "/pathFiles/path1.json",
    },
    {
      name: "path2",
      path: "/pathFiles/path2.json",
    },
    {
      name: "path3",
      path: "/pathFiles/path3.json",
    },
    {
      name: "path4",
      path: "/pathFiles/path4.json",
    },
    {
      name: "path5",
      path: "/pathFiles/path5.json",
    },
  ],
  fonts: [],
  svgs: [],
};
