/**
 * @fileoverview Scene 5 asset manifest.
 *
 * This file declares the assets needed for Scene 5 and contains a small helper
 * to optionally rewrite certain paths to a CDN (Cloudflare R2 public bucket).
 *
 * Design goals:
 * - Keep *authoring* paths readable (e.g. "/r2/foo.glb").
 * - In development on LAN/localhost, allow the dev server to proxy `/r2/*`
 *   to avoid CORS and make iteration easier.
 * - In production, rewrite `/r2/*` paths to the configured CDN base.
 *
 * Notes:
 * - The loader (`../commonFiles/assetsLoader.js`) expects an `assetsEntry` object
 *   with stable keys: `models`, `textures`, `videoTextures`, `audios`, `hdris`, etc.
 * - Some assets are served from the app's public folder (e.g. `/scene55/*`).
 */

/**
 * Resolve the CDN base URL.
 *
 * Priority order:
 * 1) `window.ASSETS_CDN_BASE` (explicit full base URL, e.g. "https://…")
 * 2) `window.ASSETS_R2_ACCOUNT_ID` (build base URL as `https://<id>.r2.dev`)
 * 3) Hard-coded fallback bucket base (keeps the scene functional without config)
 */
const CDN_BASE = (() => {
  if (typeof window !== 'undefined') {
    if (window.ASSETS_CDN_BASE) return window.ASSETS_CDN_BASE;
    if (window.ASSETS_R2_ACCOUNT_ID) return `https://${window.ASSETS_R2_ACCOUNT_ID}.r2.dev`;
  }
  return 'https://pub-4dc5824a7d6645b29006348054fb1f3f.r2.dev';
})();

/**
 * Detect whether the current host is a local/dev host.
 * Used to decide whether we should keep `/r2/*` as-is (and let Vite proxy it).
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
 * Rewrite a path to use the CDN when it is prefixed with `/r2/`.
 *
 * Behavior:
 * - If `p` does not start with `/r2/`, returns `p` unchanged.
 * - If `p` starts with `/r2/`:
 *   - on dev hosts: returns the original `/r2/...` path to allow proxying
 *   - otherwise: rewrites to `${CDN_BASE}/...`
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
 * Scene 5 assets manifest.
 *
 * Conventions:
 * - `name` must match how `assetsLoader` indexes the loaded resources.
 * - `models[].path` should point to a `.glb` (or other supported model type).
 * - `audios[].path` points to a supported audio format; `volume`/`loop` are optional.
 * - `fonts[].data` references MSDF font json+texture for `three-mesh-ui`.
 */
export const assetsEntry = {
  characters: [
    {
      name: "electro",
      path: "/characters/ROBOT_17.glb",
    }
  ],
  models: [
    {
      name: "underground",
      path: toCDN("/r2/scene5Model.glb"),
      shadow: true,
    },
    {
      name:"unoModel",
      path:"/scene55/uno11.glb"
    },
    {
      name:"nanoModel",
      path:"/scene55/nano6.glb"
    },
    {
      name:"ldrModel",
      path:"/scene55/ldr9.glb"
    },
    {
      name:"irModel",
      path:"/scene55/ir91.glb"
    },
    {
      name: "buck",
      path:"/scene55/ubec3.glb"
    },
    {
      name: "motordriverModel",
      path:"/scene55/motordriver1.glb"
    },
    {
      name: "buttonModel",
      path:"/scene55/button.glb"
    },
    {
      name: "buzzerModel",
      path:"/scene55/buzzer2.glb"
    },
    {
      name: "pcbModel",
      path:"/scene55/pcb3.glb"
    },
    {
      name: "rgbModel",
      path:"/scene55/rgb1.glb"
    },  {
      name: "motorModel",
      path:"/scene55/motor.glb"
    }

  ],
  textures: [
    {
      name: "meshpicture",
      path:"/scene55/meshimage1.jpg"
    }
  ],
  videoTextures: [
    {
      name: "hudvideo2",
      path: "/scene55/zoehud.mp4"
    },
    {
      name: "screenvideo",
      path: "/scene55/screenvideo.mp4"
    },
    {
      name: "meshvideo",
      path: "/scene55/screenvideo.mp4"
    },
  ],
  audios: [
    {
      name: "background",
      path: "/audios/background.mp3",
      volume: 1,
      loop: true
    }, // Global background music
    {
      name: "scene5Intro",
      path: "/audios/scene5intro.mp3",
      volume: 1,
      loop: false
    },
    {
      name:"electrosound",
      path:"/scene55/electrosound.wav"
    },
    {
      name:"electrosound1",
      path:"/scene55/electrosound2.wav"
    },
    {
      name:"electrosound2",
      path:"/scene55/electrosound4.wav"
    },
    {
      name:"electrosound3",
      path:"/scene55/electrosound5.wav"
    },
    {
      name:"electrosound4",
      path:"/scene55/electrosound7.mp3"
    },
    {
      name:"componentsound",
      path:"/scene55/componentsound.mp3"
    },
    {
      name:"bytepanelsound",
      path:"/scene55/bytepanelsound.mp3"
    },
    {
      name:"spark",
      path:"/scene55/spark.mp3"
    }
    
  ],
  hdris: [
    {
      name: "sky",
      path: "/hdris/sky.hdr",
    },

  ],
  cubeMaps: [

  ],
  vfxs: [

  ],
  pathFiles: [],
  jsonFiles: [],
  fonts: [
    {
      fontName: "roboto",
      data: {
        jsonDataPath: "/fonts/msdf/Roboto-msdf.json",
        textureDataPath: "/fonts/msdf/Roboto-msdf.png"
      }
    }
  ],
  svgs: [],
};
 