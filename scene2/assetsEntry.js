/**
 * Asset manifest for Scene 2.
 *
 * This file defines which GLTF models, textures, HDRIs, videos and audio
 * should be loaded by the shared `assetsLoader` for the futuristic city /
 * university scene. Paths are routed through an R2/Cloudflare CDN when
 * available, but still work on localhost via Vite's `/r2` proxy.
 */
const CDN_BASE = (() => {
  if (typeof window !== 'undefined') {
    if (window.ASSETS_CDN_BASE) return window.ASSETS_CDN_BASE;
    if (window.ASSETS_R2_ACCOUNT_ID) return `https://${window.ASSETS_R2_ACCOUNT_ID}.r2.dev`;
  }
  return 'https://pub-4dc5824a7d6645b29006348054fb1f3f.r2.dev';
})();
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
 * Normalizes an asset path to a CDN URL when appropriate.
 *
 * - For `/r2/...` paths: rewrites to `CDN_BASE` unless on a dev host,
 *   in which case it returns the path unchanged so the dev server can proxy.
 * - For non‑`/r2` paths: returns the path unchanged (relative to app origin).
 *
 * @param {string} p - Original asset path.
 * @returns {string} Transformed or original path.
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
 * Scene 2 asset manifest consumed by `loadAllAsset`.
 *
 * Properties:
 *  - `characters`: GLB character rigs (Electro).
 *  - `models`: Environment GLBs (university, hoverboard, UFO).
 *  - `textures`: Static textures used for objectives UI, gates, portals.
 *  - `videoTextures`: MP4 waterfall video for in‑world screens.
 *  - `audios`: Background music + Electro trigger VO + hoverboard SFX.
 *  - `hdris`: Environment HDRIs used as skybox / lighting.
 *  - `vfxs`: Quarks/JSON VFX definitions (e.g., entry VFX).
 */
export const assetsEntry = {
  characters: [
    {
      name: "electro",
      path: "/characters/ROBOT_17.glb",
    },
  ],
  models: [
    {
      name: "university",
      path: toCDN("/r2/INNOVERSE_WORLDV_12.6.glb"),
      shadow: true,
    },
    //    {
    //   name: "university",
    //   path: "/scene22/legv3 1.glb",
    //   shadow: true,
    // },
    {
      name: "hoverboard",
      path: "/scene22/hoverboardv2.glb",
      shadow: true,
    },
    {
      name: "ufo",
      path: "/scene22/ufo1.glb",
    },
  ],
  textures: [
    {
      name: "objectivesalphamap",
      path: "/scene22/objectivesalphamap.jpg",
    },
    {
      name: "baseColor",
      path: "/scene22/garage_door_DefaultMaterial_BaseColor.png",
    },
    {
      name: "normalMap",
      path: "/scene22/garage_door_DefaultMaterial_Normal.png",
    },
    {
      name: "portal",
      path: "/scene11/portal.png",
    }

  ],
  videoTextures: [
    {
      name: "waterfall",
      path: "/scene22/waterfall3.mp4",
    },
  ],
  audios: [
    {
      name: "background",
      path: "/scene22/background.mp3",
      volume: 1,
      loop: true
    }, // Global background music
    {
      name: "scene2Intro",
      path: "/audios/background.mp3",
      volume: 1,
      loop: false
    }, // Scene2 intro voice
    {
      name: "electrofirsttrigger",
      path: "/audios/electrofirsttrigger.mp3",
      volume: 1,
      loop: false
    }, // Electro first trigger voice
    {
      name: "electrosecondtrigger",
      path: "/audios/electrosecondtrigger.mp3",
      volume: 1,
      loop: false
    }, // Electro second trigger voice
    {
      name: "electrothirdtrigger",
      path: "/audios/electrothirdtrigger.mp3",
      volume: 1,
      loop: false
    }, // Electro third trigger voice
    //hoverboard
    {
      name: "hoverboard",
      path: "/audios/hoverboardfinal.mp3",
      volume: 1,
      loop: true
    }
  ],
  hdris: [
   { name: "evening", path: toCDN("/r2/rosendal_plains.hdr") }
  ],
  cubeMaps: [
  ],
  vfxs: [
    {
      name: "entryvfx",
      path: "/vfxFiles/entryvfx.json",
    },
  ],
  pathFiles: [],
  jsonFiles: [],
  fonts: [],
  svgs: [],
};
