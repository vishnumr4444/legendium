/**
 * Scene 1 asset manifest.
 *
 * This file exports a single `assetsEntry` object that is consumed by the shared
 * asset loader (`commonFiles/assetsLoader.js`).
 *
 * Notes:
 * - Paths are typically relative to the app's public root (e.g. `/scene11/...`).
 * - Some deployments support serving large files via Cloudflare R2. For those,
 *   the helper `toCDN("/r2/...")` rewrites the path to an R2 public bucket URL.
 * - In local/dev environments, we intentionally keep `/r2/...` paths unchanged
 *   so a dev proxy can handle them without CORS issues.
 */

/**
 * Resolve the base URL for the R2 asset bucket.
 *
 * Order of precedence:
 * - `window.ASSETS_CDN_BASE` (explicit full base URL)
 * - `window.ASSETS_R2_ACCOUNT_ID` (construct `https://{id}.r2.dev`)
 * - hard-coded fallback public bucket URL
 *
 * @returns {string} Base URL used for R2 path rewrites.
 */
const CDN_BASE = (() => {
  if (typeof window !== 'undefined') {
    if (window.ASSETS_CDN_BASE) return window.ASSETS_CDN_BASE;
    if (window.ASSETS_R2_ACCOUNT_ID) return `https://${window.ASSETS_R2_ACCOUNT_ID}.r2.dev`;
  }
  return 'https://pub-4dc5824a7d6645b29006348054fb1f3f.r2.dev';
})();

/**
 * Returns true when running on a local/private network host.
 *
 * This is used to avoid CDN rewrites in development so Vite (or another dev
 * server) can proxy `/r2/*` requests.
 *
 * @returns {boolean}
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
 * Optionally rewrites `/r2/...` paths to the configured CDN base URL.
 *
 * - If `p` does not start with `/r2/`, it is returned unchanged.
 * - If running on a dev host, `/r2/...` is returned unchanged (proxy-friendly).
 * - Otherwise the path is rewritten to `${CDN_BASE}/{pathOnBucket}`.
 *
 * @param {string} p - Input path (absolute from public root).
 * @returns {string} Rewritten CDN URL or original path.
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
 * Asset loader entry for Scene 1 ("Legendium" island).
 *
 * Structure:
 * - `characters`: player/NPC character models (GLTF) that the loader will mount under `allAssets.characters`.
 * - `models`: scene models (GLTF) mounted under `allAssets.models.gltf`.
 * - `textures`: 2D textures mounted under `allAssets.textures`.
 * - `audios`: audio tracks mounted under `allAssets.audios`.
 * - `vfxs`: Quarks JSON emitters mounted under `allAssets.vfxs`.
 *
 * Each item typically has:
 * - `name`: key used to reference the asset later
 * - `path`: URL/path to fetch
 * - optional metadata (e.g. `shadow`) used by the loader/scene.
 */
export const assetsEntry = {
  characters: [
    {
      name: "electro",
      path: "/characters/ROBOT_17.glb",
    },
  ],
  models: [
    // {
    //   name: "garden",
    //   path: toCDN("/r2/island.glb"),
    //   shadow: false
    // },
    {
      name: "garden",
      path: "/scene11/legendium_island10.glb",
      shadow: false
    },
    {
      name: "grass",
      path: "/scene11/grass_emision.glb",
      shadow: false
    },
    {
      name: "wheat",
      path: "/scene11/wheat-opt.glb",
      shadow: false
    },
    {
      name: "enemy",
      path: "/scene11/enemybotv3-v1.glb",
      shadow: true
    },
    {
      name: "stand",
      path: "/scene11/stand.glb",
      shadow: true
    },
    {
      name: "ufo",
      path: "/scene11/ufo2.glb",
      shadow: false
    },
    {
      name: "stonePath",
      path: "/scene11/stonePath.glb",
      shadow: false
    }
  ],
  textures: [
    {
      name: "portal",
      path: "/scene11/portal.png",
    },
    {
      name: "groundBlue",
      path: "/scene11/groundBlue.png",
    }
  ],
  videoTextures: [
  ],
  audios: [
    { name: "background", path: "/scene11/background.mp3", volume: 0.2,loop:true }, // Global background music
    {name:"electrosound",path:"/scene11/electro2.wav"},
    //make usfosound positional
    {name:"ufosound",path:"/scene11/ufo3.mp3",volume:1},
    {name:"attacksound",path:"/scene11/beast-plant.mp3",volume:1},
    {name:"spellcastsound",path:"/scene11/spellSound.mp3",volume:1}
  ],
  hdris: [
  ],
  cubeMaps: [
  ],
  vfxs: [
    {
      name: "entryvfx",
      path: "/vfxFiles/entryvfx.json",
    },
    {
      name: "appear",
      path: "/vfxFiles/appear.json"
    },
    {
      name: "disappear",
      path: "/vfxFiles/disappear.json"
    },
    {
      name: "nuke",
      path: "/vfxFiles/nuke.json"
    },
    {
      name: "onHit",
      path: "/vfxFiles/onHit.json"
    },
    {
      name: "onHitEnemy",
      path: "/vfxFiles/onHitEnemy.json"
    },
    {
      name: "fireBullet",
      path: "/vfxFiles/fireBullet.json"
    }
  ],
  pathFiles: [],
  jsonFiles: [],
  fonts: [],
  svgs: [],
};
