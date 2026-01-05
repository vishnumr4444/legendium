import "./minimap.css";

/**
 * @fileoverview Scene 4 minimap (DOM canvas overlay).
 *
 * This module creates a small circular minimap drawn on a `<canvas>`, positioned
 * in the DOM. It visualizes:
 * - the player's position (center of the map)
 * - fixed world markers (portal, info zone)
 * - curved “navigation” paths from player to important markers
 *
 * Coordinate mapping:
 * - The minimap is top-down and uses the player's world X/Z as the 2D plane.
 * - The map rotates with `player.rotation.y` so “forward” aligns with the top.
 * - World → minimap pixels uses a constant scalar (`scale`) tuned for Scene 4.
 *
 * Lifecycle:
 * - `createMinimap(sceneRef, physicsRef, portalRef)` creates DOM nodes once.
 * - `updateMinimap()` is called every frame by the scene render loop.
 * - `cleanupMinimap()` removes DOM and clears references.
 *
 * Important: This module uses module-level state and assumes a single minimap
 * instance at a time.
 */

let container,
  canvas,
  ctx,
  toggleBtn,
  visible = false;
let scene, physicsController, portal;
let backgroundPattern = null;

/**
 * Fixed markers for Scene 4.
 * Positions are in *world coordinates*.
 *
 * If you adjust Scene 4 layout, update these values accordingly.
 */
const markers = [
  {
    type: "portal",
    color: "#ff00ff",
    size: 10,
    position: { x: -27.0, y: -2.0, z: 0.4 },
  },
  {
    type: "info",
    color: "#ffffff",
    size: 8,
    position: { x: -3.75, y: -1.8, z: -3.0 },
  },
];

/** Player marker styling (the player is always drawn at the center). */
const playerMarker = { color: "#00f6ff", size: 6 };

/**
 * Draw the “icon” glyph for a marker type at the origin (0,0).
 * Caller is responsible for translating to the marker's screen position.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{type: string, color: string, size: number}} marker
 */
function drawMarkerSymbol(ctx, marker) {
  ctx.save();
  ctx.strokeStyle = marker.color;
  ctx.fillStyle = marker.color;
  ctx.lineWidth = 2;
  ctx.shadowColor = marker.color;
  ctx.shadowBlur = 10;
  switch (marker.type) {
    case "portal":
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#fff";
      for (const r of [marker.size * 0.6, marker.size]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.8);
        ctx.stroke();
      }
      break;
    case "info":
      ctx.beginPath();
      ctx.arc(0, 0, marker.size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-marker.size * 0.8, -marker.size * 0.8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(marker.size * 0.8, -marker.size * 0.8, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "hostile":
      const size = marker.size;
      const pulse = (Math.sin(performance.now() * 0.005) + 1) / 2;

      // Dynamic properties based on the pulse
      const dynamicSize = size * (0.9 + pulse * 0.2);
      const dynamicAlpha = Math.floor(70 + pulse * 60).toString(16);

      ctx.save();
      ctx.fillStyle = marker.color + dynamicAlpha;
      ctx.shadowBlur = 0;

      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle) * (dynamicSize * 0.2),
          Math.sin(angle) * (dynamicSize * 0.2)
        );
        ctx.arc(
          Math.cos(angle) * (dynamicSize * 0.5),
          Math.sin(angle) * (dynamicSize * 0.5),
          dynamicSize * 0.5,
          angle + Math.PI * 0.3,
          angle + Math.PI * 0.7
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, dynamicSize * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = marker.color;
      ctx.shadowColor = marker.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
      break;
  }
  ctx.restore();
}

/**
 * Draw a marker at (x, y) in minimap-local coordinates, including a soft glow.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {any} marker
 */
function drawSciFiMarker(ctx, x, y, marker) {
  ctx.save();
  ctx.translate(x, y);
  const glowPulse = (Math.sin(performance.now() * 0.004) + 1) / 2;
  ctx.fillStyle = marker.color + "33";
  ctx.beginPath();
  ctx.arc(0, 0, marker.size + 2 + glowPulse * 2, 0, Math.PI * 2);
  ctx.fill();
  drawMarkerSymbol(ctx, marker);
  ctx.restore();
}

/**
 * Draw the player indicator (a chevron) at the origin.
 * This is rendered last so it stays above the map layers.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
function drawPlayerChevron(ctx) {
  ctx.save();
  ctx.fillStyle = playerMarker.color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = playerMarker.color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(9, 9);
  ctx.lineTo(0, 4);
  ctx.lineTo(-9, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Create a repeating sci-fi grid background pattern for the minimap.
 * The returned canvas is used as a `ctx.createPattern(...)` source.
 */
function createBackgroundGrid() {
  const patternCanvas = document.createElement("canvas");
  const patternCtx = patternCanvas.getContext("2d");
  const size = 40;
  patternCanvas.width = size;
  patternCanvas.height = size;
  patternCtx.strokeStyle = "rgba(0, 179, 215, 0.58)";
  patternCtx.lineWidth = 0.5;
  patternCtx.beginPath();
  patternCtx.moveTo(0, size);
  patternCtx.lineTo(size, 0);
  patternCtx.moveTo(0, 0);
  patternCtx.lineTo(size, size);
  patternCtx.stroke();
  return patternCanvas;
}

/**
 * Create the minimap DOM elements and initialize internal state.
 *
 * @param {any} sceneRef Scene reference (currently unused but kept for future extensions)
 * @param {any} physicsRef Result of `initializePhysicsAndPlayer` (must expose `playerFunction.player`)
 * @param {any} portalRef Optional portal reference (not required for current rendering)
 */
export function createMinimap(sceneRef, physicsRef, portalRef) {
  scene = sceneRef;
  physicsController = physicsRef;
  portal = portalRef;
  container = document.createElement("div");
  container.id = "minimap-container";
  document.body.appendChild(container); // Append map to body
  canvas = document.createElement("canvas");
  canvas.id = "minimap-canvas";
  canvas.width = 210;
  canvas.height = 210;
  container.appendChild(canvas);
  ctx = canvas.getContext("2d");
  toggleBtn = document.createElement("button");
  toggleBtn.id = "minimap-toggle";
  toggleBtn.textContent = "Hide Map";

  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    visible = !visible;
    container.classList.toggle("visible");
    toggleBtn.textContent = visible ? "Hide Map" : "Show Map";
  });
  const gridCanvas = createBackgroundGrid();
  backgroundPattern = ctx.createPattern(gridCanvas, "repeat");
  setTimeout(() => {
    visible = true;
    container.classList.add("visible");
  }, 1200);
}

/**
 * Draw a curved path between two points using a quadratic Bezier curve.
 * Used for “navigation” lines to key markers.
 */
function drawCurvedPath(ctx, startX, startY, endX, endY, color, dash = []) {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.hypot(dx, dy);
  let controlX = startX + dx / 2;
  let controlY = startY + dy / 2;
  if (len > 10) {
    const offset = 25; // Fixed offset for consistent curve without vibration
    const perpX = (-dy / len) * offset;
    const perpY = (dx / len) * offset;
    const side = 1; // Fixed side for consistency
    controlX += perpX * side;
    controlY += perpY * side;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4; // Thicker line like Google Maps
  ctx.lineCap = "round";
  ctx.shadowColor = color
    .replace("0.8", "0.5")
    .replace("0.6", "0.4")
    .replace("0.7", "0.4")
    .replace("0.9", "0.5");
  ctx.shadowBlur = 6;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(controlX, controlY, endX, endY);
  ctx.stroke();
  ctx.restore();
}

/**
 * Update the minimap for the current frame.
 *
 * Requirements:
 * - `createMinimap()` must have been called once.
 * - `physicsController.playerFunction.player` must exist.
 *
 * This function is intentionally cheap and avoids allocations where possible,
 * as it runs every frame.
 */
export function updateMinimap() {
  if (!visible || !ctx || !physicsController?.playerFunction?.player) return;
  const player = physicsController.playerFunction.player;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const mapRadius = centerX - 2;
  const scale = 2.5;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, mapRadius, 0, Math.PI * 2);
  ctx.clip();

  // This part draws the background grid
  ctx.translate(centerX, centerY);
  ctx.rotate(player.rotation.y);
  const offsetX = -(player.position.x * scale);
  const offsetY = -(player.position.z * scale);
  ctx.translate(offsetX, offsetY);
  ctx.fillStyle = backgroundPattern;
  ctx.fillRect(
    -centerX - offsetX,
    -centerY - offsetY,
    canvas.width,
    canvas.height
  );
  ctx.restore();

  const time = performance.now();

  // Sweeping scanner effect
  const sweepAngle = (time * 0.002) % (Math.PI * 2);
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    mapRadius
  );
  gradient.addColorStop(0, "rgba(0, 255, 255, 0.25)");
  gradient.addColorStop(1, "rgba(0, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, mapRadius, sweepAngle - 0.3, sweepAngle + 0.3);
  ctx.closePath();
  ctx.fill();

  // Pulsing ring effect
  const pulse = (Math.sin(time * 0.002) + 1) / 2;
  ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 - pulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, mapRadius * pulse, 0, Math.PI * 2);
  ctx.stroke();

  // Precompute screen positions for info and portal
  let infoScreenX = 0,
    infoScreenY = 0,
    portalScreenX = 0,
    portalScreenY = 0;
  const info = markers.find((m) => m.type === "info");
  const portalM = markers.find((m) => m.type === "portal");
  if (info) {
    const relinfoX = info.position.x - player.position.x;
    const relinfoZ = info.position.z - player.position.z;
    infoScreenX = relinfoX * scale;
    infoScreenY = relinfoZ * scale;
  }
  if (portalM) {
    const relPortalX = portalM.position.x - player.position.x;
    const relPortalZ = portalM.position.z - player.position.z;
    portalScreenX = relPortalX * scale;
    portalScreenY = relPortalZ * scale;
  }

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(player.rotation.y);

  // **** CODE TO REMOVE WAS HERE ****
  // The 'for' loops that drew the circles and lines have been deleted.

  // This part draws the markers (portal, info, hostile)
  for (const m of markers) {
    const relativeX = m.position.x - player.position.x;
    const relativeZ = m.position.z - player.position.z;
    const x = relativeX * scale;
    const y = relativeZ * scale;
    if (Math.hypot(x, y) < mapRadius) {
      drawSciFiMarker(ctx, x, y, m);
    }
  }

  // Draw curved path from player to info (thick, consistent, always visible)
  if (info) {
    drawCurvedPath(
      ctx,
      0,
      0,
      infoScreenX,
      infoScreenY,
      "rgba(0, 255, 128, 0.9)",
      []
    );
  }

  // Draw curved path from player to portal (thick, consistent, always visible)
  if (portalM) {
    drawCurvedPath(
      ctx,
      0,
      0,
      portalScreenX,
      portalScreenY,
      "rgba(0, 128, 255, 0.9)",
      []
    );
  }

  ctx.restore();

  // This part draws the player's marker
  ctx.save();
  ctx.translate(centerX, centerY);
  drawPlayerChevron(ctx);
  ctx.restore();
}

/**
 * Remove the minimap from the DOM and clear all references.
 *
 * Note: The toggle button uses an inline anonymous handler in `createMinimap()`,
 * which cannot be removed via `removeEventListener` unless we store the function.
 * We still remove the DOM nodes, which is sufficient for practical cleanup.
 */
export function cleanupMinimap() {
  // Remove event listener from toggle button if it exists
  if (toggleBtn) {
    toggleBtn.removeEventListener(
      "click",
      toggleBtn.onclick || toggleBtn._listener
    );
    toggleBtn.innerHTML = ""; // Clear any inner content like SVG
  }
  // Clear container content and remove
  if (container) {
    container.innerHTML = ""; // Clear canvas and any potential SVG children
    container.remove();
  }
  // Explicitly remove toggle button
  if (toggleBtn && toggleBtn.parentNode) {
    toggleBtn.parentNode.removeChild(toggleBtn);
  }
  // Dispose pattern canvas if exists
  if (backgroundPattern && backgroundPattern.image) {
    backgroundPattern.image = null;
  }
  container = null;
  canvas = null;
  ctx = null;
  toggleBtn = null;
  visible = false;
  backgroundPattern = null;
}
