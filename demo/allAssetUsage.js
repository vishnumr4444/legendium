export const assetesEntry = {
    characters: [
      { name: "zoe", path: "/characters/zoe_meta_v5.glb", shadow: true },
      { name: "electro", path: "/characters/electrorl7-opt.glb", shadow: true },
    ],
    models: [
      {
        name: "garden_cave",
        path: "/scene1/garden_cave_v10-opt.glb",
        shadow: true,
      },
      { name: "aircraft", path: "/scene1/space_craft_v4-opt.glb", shadow: true },
      { name: "ticket", path: "/scene1/ticket.glb", shadow: true },
      { name: "isLand", path: "/scene1/topography.glb", shadow: false },
      { name: "pineTree", path: "/scene1/pine_v2.glb", shadow: true },
    ],
    textures: [
      { name: "waterNormalTexture", path: "/scene1/water.jpg" },
      { name: "ticketAlpha", path: "/ticketAlpha.png" },
    ],
    audios: [
      { name: "background", path: "/audios/bgm1.wav", volume: 1,loop:true,positional:true,refDistance:10 }, // Global background music
      { name: "introAudio", path: "/audios/sound2.wav", volume: 1, loop: false },
    ],
    hdris: [{ name: "skyHdr", path: "/hdris/sky.hdr" }],
    cubeMaps: [
      {
        name: "scene2Cubemap",
        images: [
          "/cube_left.webp",
          "/cube_right.webp",
          "/cube_up.webp",
          "/cube_down.webp",
          "/cube_front.webp",
          "/cube_back.webp",
        ],
      },
    ],
    vfxs: [
      { name: "shipThruster", path: "vfxFiles/ShipThruster.json" },
      { name: "ticketEffect", path: "vfxFiles/vfx.json" },
    ],
    pathFiles: [
      { name: "walkingPath", path: "pathFiles/path4.json" },
      { name: "dummyPath", path: "pathFiles/dummy.json" },
    ],
    jsonFiles: [{ name: "treesPositionPath", path: "/treePositions.json" }],
    fonts: [
      {
        fontName: "robotoFont",
        data: {
          jsonDataPath: "../fonts/msdf/Roboto-msdf.json",
          textureDataPath: "../fonts/msdf/Roboto-msdf.png",
        },
      },
      {
        fontName: "Arc_Regular",
        data: {
          jsonDataPath: "../fonts/Arc_Regular.json",
        },
      },
      {
        fontName: "BOWLER_Regular",
        data: {
          jsonDataPath: "../fonts/BOWLER_Regular.json",
        },
      },
    ],
    svgs: [{ name: "introSvg", path: "innoverse_logo.svg" }],
  };
  

/**
 * 📌 **Asset Usage Guide**
 * This guide provides examples of how to use different asset types such as audios, HDRIs, cubemaps, VFXs, path files, JSON files, fonts, and SVGs.
 * Make sure to properly reference `allAssets` when accessing assets.
 */

/**
 * 🎵 **Audio Usage**
 */
const backgroundAudio = allAssets.audios.background;
backgroundAudio.play();

/**
 * 🌄 **HDRIs (High Dynamic Range Images)**
 */
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const envMap = pmremGenerator.fromEquirectangular(
  allAssets.hdris.skyHdr
).texture;

scene.environment = envMap;
scene.background = envMap;
pmremGenerator.dispose();

/**
 * 🏙 **Cubemaps**
 */
scene.background = allAssets.cubeMaps.scene2Cubemap;
scene.environment = allAssets.cubeMaps.scene2Cubemap;

/**
 * ✨ **VFX (Visual Effects)**
 */
const effect1 = allAssets.vfxs.ticketEffect;
QuarksUtil.addToBatchRenderer(effect1, batchSystemRef);

/**
 * 🛤 **Path Files**
 * If you want to walk through a path, use the `PathFollower` function.
 */
// Disable player controls before animation
togglePlayerControls(false);
controls.enable = false;

const options = {
  triggerPointNumber: 3,
  onCompleteFunction: onCompleteSetupFunction, // Corrected function name spelling
};

const enteringAircraftPath = pathFollower(
  allAssets.pathFiles.walkingPath,
  sceneInitialization.playerFunction.player,
  selectedPlayerMixer,
  camera,
  0.2,
  actionWalk,
  actionIdle,
  false,
  options
);

enteringAircraftPath.startAnimation();
await enteringAircraftPath.pathEndPromise;

/**
 * 📄 **JSON Files**
 */
const treePositions = allAssets.jsonFiles.treesPositionPath;

/**
 * 🔤 **Fonts**
 * There are two types of fonts:
 * 1️⃣ Fonts with textures
 */
const fontWithTexture = {
  fontFamily: allAssets.loadedFonts.robotoFont.json,
  fontTexture: allAssets.loadedFonts.robotoFont.image,
};

/*
 * 2️⃣ Fonts without textures (only JSON)
 */
const font = allAssets.loadedFonts.BOWLER_Regular.json;

const geometry = new TextGeometry(text[i], {
  font: font,
  size: params.size,
  depth: 0,
  curveSegments: params.curveSegments,
});

/**
 * 🖼 **SVGs**
 */
const parser = new DOMParser();
const svgDoc = parser.parseFromString(allAssets.svgs.introSvg, "image/svg+xml");
