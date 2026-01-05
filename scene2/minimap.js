/**
 * 2D circular minimap for Scene 2.
 *
 * Features:
 *  - World‑space aware player marker (supports parenting to hoverboard)
 *  - Sci‑fi markers for Electro, hoverboard and the portal
 *  - Curved "Google‑maps‑style" guidance paths with animated chevrons
 *  - Sweeping radar arc and pulsing rings to make the map feel alive.
 *
 * Public API:
 *  - `createMinimap`  — injects DOM elements and binds to the scene/player.
 *  - `updateMinimap`  — must be called each frame from Scene 2’s loop.
 *  - `cleanupMinimap` — removes DOM, patterns and state on scene exit.
 */
import './minimap.css';
import * as THREE from 'three';

// If the map's forward axis differs from the player's forward, adjust this value.
// Set to Math.PI to flip 180 degrees when the map shows the player's back instead of front.
const YAW_OFFSET = Math.PI; 

let container, canvas, ctx, toggleBtn, visible = false;
let scene, physicsController, electroCharacter, zoeCharacter;
let backgroundPattern = null;
let hoverboardReached = false;

const markers = [
  { type: 'friend', color: '#ffffff', size: 8, position: { x: -0.16, y: 1.9, z: -254 } },
  { type: 'hoverboard', color: '#00ff00', size: 8, position: { x: -2.2, y: 1.9, z: -231 } },
  { type: 'portal', color: '#ff00ff', size: 10, position: { x: -31, y: 4, z: 608 } }
];

const playerMarker = { color: '#00f6ff', size: 6 };

function getColorForType(type) {
  switch (type) {
    case 'friend':
      return 'rgba(255, 255, 255, 0.8)';
    case 'hoverboard':
      return 'rgba(0, 255, 0, 0.8)';
    case 'portal':
      return 'rgba(255, 0, 255, 0.8)';
    default:
      return 'rgba(255, 255, 255, 0.7)';
  }
}

function drawMarkerSymbol(ctx, marker) {
    ctx.save();
    ctx.strokeStyle = marker.color;
    ctx.fillStyle = marker.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = marker.color;
    ctx.shadowBlur = 10;
    switch (marker.type) {
        case 'friend':
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
        case 'hoverboard':
            // Simple hoverboard representation: rectangle with wheels
            ctx.fillRect(-marker.size * 0.5, -marker.size * 0.2, marker.size, marker.size * 0.4);
            ctx.beginPath();
            ctx.arc(-marker.size * 0.3, marker.size * 0.2, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(marker.size * 0.3, marker.size * 0.2, 1.5, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'portal':
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#fff';
            for (const r of [marker.size * 0.6, marker.size]) {
                ctx.beginPath();
                ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.8);
                ctx.stroke();
            }
            break;
    }
    ctx.restore();
}

function drawSciFiMarker(ctx, x, y, marker) {
    ctx.save();
    ctx.translate(x, y);
    const glowPulse = (Math.sin(performance.now() * 0.004) + 1) / 2;
    ctx.fillStyle = marker.color + '33';
    ctx.beginPath();
    ctx.arc(0, 0, marker.size + 2 + glowPulse * 2, 0, Math.PI * 2);
    ctx.fill();
    drawMarkerSymbol(ctx, marker);
    ctx.restore();
}

function drawPlayerChevron(ctx) {
    // Draw a rounded player marker: outer glowing circle + small forward dot
    ctx.save();
    const outerR = playerMarker.size + 6; // soft rim
    const innerR = playerMarker.size; // main circle
    // Outer glow
    ctx.beginPath();
    ctx.fillStyle = playerMarker.color + '33';
    ctx.shadowColor = playerMarker.color;
    ctx.shadowBlur = 18;
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.fill();
    // Main circle
    ctx.beginPath();
    ctx.shadowBlur = 0;
    ctx.fillStyle = playerMarker.color;
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.fill();
    // Small forward dot to indicate facing direction (curved, no corners)
    const forwardDotY = -innerR * 0.55; // forward offset (negative Y in rotated canvas)
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(0, forwardDotY, Math.max(1.6, innerR * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Helpers to get player's world position and yaw (works when player is parented to hoverboard)
const _tmpVec3 = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
function getPlayerWorldPosition(player) {
    if (!player) return { x: 0, y: 0, z: 0 };
    player.getWorldPosition(_tmpVec3);
    return { x: _tmpVec3.x, y: _tmpVec3.y, z: _tmpVec3.z };
}

function getPlayerWorldYaw(player) {
    if (!player) return 0;
    // Use world forward vector to derive yaw. This is robust when player is parented.
    const dir = new THREE.Vector3();
    player.getWorldDirection(dir); // returns the object's -Z direction in world space
    // Map forward vector to yaw such that forward (0,0,-1) -> 0
    // Apply optional offset to correct 180° flips in some rigs.
    return Math.atan2(dir.x, -dir.z) + YAW_OFFSET;
}

function createBackgroundGrid() {
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    const size = 40;
    patternCanvas.width = size;
    patternCanvas.height = size;
    patternCtx.strokeStyle = 'rgba(0, 179, 215, 0.58)';
    patternCtx.lineWidth = 0.5;
    patternCtx.beginPath();
    patternCtx.moveTo(0, size); patternCtx.lineTo(size, 0);
    patternCtx.moveTo(0, 0); patternCtx.lineTo(size, size);
    patternCtx.stroke();
    return patternCanvas;
}

function drawCurvedPath(ctx, startX, startY, endX, endY, color, dash = []) {
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    let controlX = startX + dx / 2;
    let controlY = startY + dy / 2;
    if (len > 10) {
        const offset = 25; // Fixed offset for consistent curve without vibration
        const perpX = -dy / len * offset;
        const perpY = dx / len * offset;
        const side = 1; // Fixed side for consistency
        controlX += perpX * side;
        controlY += perpY * side;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4; // Thicker line like Google Maps
    ctx.lineCap = 'round';
    ctx.shadowColor = color.replace(/0\.\d+/, '0.4');
    ctx.shadowBlur = 6;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
    ctx.restore();
}

// Compute control point used by drawCurvedPath so we can evaluate points/tangents on the same curve
function computeCurveControl(startX, startY, endX, endY) {
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    let controlX = startX + dx / 2;
    let controlY = startY + dy / 2;
    if (len > 10) {
        const offset = 25;
        const perpX = -dy / len * offset;
        const perpY = dx / len * offset;
        const side = 1;
        controlX += perpX * side;
        controlY += perpY * side;
    }
    return { x: controlX, y: controlY };
}

// Evaluate a point on a quadratic Bezier curve at parameter t (0..1)
function quadraticPoint(p0x, p0y, cx, cy, p2x, p2y, t) {
    const u = 1 - t;
    const x = u * u * p0x + 2 * u * t * cx + t * t * p2x;
    const y = u * u * p0y + 2 * u * t * cy + t * t * p2y;
    return { x, y };
}

// Evaluate the tangent (derivative) of a quadratic Bezier at t
function quadraticTangent(p0x, p0y, cx, cy, p2x, p2y, t) {
    const u = 1 - t;
    const dx = 2 * u * (cx - p0x) + 2 * t * (p2x - cx);
    const dy = 2 * u * (cy - p0y) + 2 * t * (p2y - cy);
    return { x: dx, y: dy };
}

// Draw a small arrowhead/chevron at (x,y) rotated by angle (radians)
function drawArrowhead(ctx, x, y, angle, size = 12, color = '#00f6ff') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-size * 0.6, -size * 0.4);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size * 0.6, size * 0.4);
    ctx.lineTo(-size * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/**
 * Creates the minimap DOM, canvas and supporting state.
 *
 * @param {THREE.Scene} sceneRef                - Scene reference (used for markers if needed).
 * @param {Object}      physicsControllerRef    - Player/physics controller from `initializePhysicsAndPlayer`.
 * @param {THREE.Object3D} electroRef           - Optional Electro reference (currently unused placeholder).
 * @param {THREE.Object3D} zoeRef               - Optional Zoe reference (currently unused placeholder).
 */
export function createMinimap(sceneRef, physicsControllerRef, electroRef, zoeRef) {
    scene = sceneRef;
    physicsController = physicsControllerRef;
    electroCharacter = electroRef;
    zoeCharacter = zoeRef;
    hoverboardReached = false;
    container = document.createElement('div');
    container.id = 'minimap-container';
    document.body.appendChild(container); // Append map to body
    canvas = document.createElement('canvas');
    canvas.id = 'minimap-canvas';
    canvas.width = 210;
    canvas.height = 210;
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'minimap-toggle';
    toggleBtn.textContent = 'Hide Map';

    document.body.appendChild(toggleBtn);
    
    toggleBtn.addEventListener('click', () => {
        visible = !visible;
        container.classList.toggle('visible');
        toggleBtn.textContent = visible ? 'Hide Map' : 'Show Map';
    });
    const gridCanvas = createBackgroundGrid();
    backgroundPattern = ctx.createPattern(gridCanvas, 'repeat');
    setTimeout(() => {
        visible = true;
        container.classList.add('visible');
    }, 1200);
}

/**
 * Renders one frame of the minimap.
 *
 * It:
 *  - Reads the player world transform (supports hoverboard parenting)
 *  - Draws the background grid, radar sweep and pulse ring
 *  - Draws context‑aware guidance paths (to hoverboard / portal)
 *  - Draws animated markers and the player chevron.
 */
export function updateMinimap() {
    if (!visible || !ctx || !physicsController?.playerFunction?.player) return;
    const player = physicsController.playerFunction.player;
    const playerPos = getPlayerWorldPosition(player);
    const playerYaw = getPlayerWorldYaw(player);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const mapRadius = centerX - 2;
    const scale = 2.5;

    const hbMarker = markers.find(m => m.type === 'hoverboard');
    let hoverDist = Infinity;
    if (hbMarker) {
        const relHbX = hbMarker.position.x - playerPos.x;
        const relHbZ = hbMarker.position.z - playerPos.z;
        hoverDist = Math.hypot(relHbX, relHbZ);
        if (hoverDist < 5 && !hoverboardReached) {
            hoverboardReached = true;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, mapRadius, 0, Math.PI * 2);
    ctx.clip();
    
    // This part draws the background grid using player's world transform
    ctx.translate(centerX, centerY);
    ctx.rotate(playerYaw);
    const offsetX = -(playerPos.x * scale);
    const offsetY = -(playerPos.z * scale);
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = backgroundPattern;
    ctx.fillRect(-centerX - offsetX, -centerY - offsetY, canvas.width, canvas.height);
    ctx.restore();

    const time = performance.now();
    
    // Sweeping scanner effect
    const sweepAngle = (time * 0.002) % (Math.PI * 2);
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, mapRadius);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
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

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(playerYaw);

    // Draw paths based on state
    if (!hoverboardReached) {
        // Draw paths to friend and hoverboard
        for (const m of markers) {
            if (m.type !== 'friend' && m.type !== 'hoverboard') continue;
            const relativeX = m.position.x - playerPos.x;
            const relativeZ = m.position.z - playerPos.z;
            const dist = Math.hypot(relativeX, relativeZ);
            if (dist === 0) continue;
            const screenDist = dist * scale;
            const unitX = relativeX / dist;
            const unitZ = relativeZ / dist;
            let pathEndX, pathEndY;
            if (screenDist <= mapRadius) {
                pathEndX = relativeX * scale;
                pathEndY = relativeZ * scale;
            } else {
                pathEndX = unitX * mapRadius;
                pathEndY = unitZ * mapRadius;
            }
            drawCurvedPath(ctx, 0, 0, pathEndX, pathEndY, getColorForType(m.type), []);
        }
    } else {
        // Draw path from player to portal
        const portalMarker = markers.find(m => m.type === 'portal');
        if (portalMarker) {
            const relativeX = portalMarker.position.x - playerPos.x;
            const relativeZ = portalMarker.position.z - playerPos.z;
            const dist = Math.hypot(relativeX, relativeZ);
            // If player is exactly at the portal position, skip drawing this path.
            if (dist !== 0) {
                const screenDist = dist * scale;
                const unitX = relativeX / dist;
                const unitZ = relativeZ / dist;
                let pathEndX, pathEndY;
                if (screenDist <= mapRadius) {
                    pathEndX = relativeX * scale;
                    pathEndY = relativeZ * scale;
                } else {
                    pathEndX = unitX * mapRadius;
                    pathEndY = unitZ * mapRadius;
                }
                // Draw the curved path to the portal
                drawCurvedPath(ctx, 0, 0, pathEndX, pathEndY, getColorForType('portal'), []);

                // Compute control point for the same curve so we can animate an arrow along it
                const ctrl = computeCurveControl(0, 0, pathEndX, pathEndY);

                // Animate a chevron arrow near the end of the path. Keep it oscillating close to the destination.
                const animSpeed = 0.0035; // animation speed factor
                const tOsc = 0.5 * (1 + Math.sin(time * animSpeed)); // 0..1 oscillation
                const arrowT = 0.85 + 0.15 * tOsc; // stay near the end (0.85..1.0)
                const pt = quadraticPoint(0, 0, ctrl.x, ctrl.y, pathEndX, pathEndY, arrowT);
                const tan = quadraticTangent(0, 0, ctrl.x, ctrl.y, pathEndX, pathEndY, arrowT);
                const angle = Math.atan2(tan.y, tan.x);
                // Draw moving arrowhead
                drawArrowhead(ctx, pt.x, pt.y, angle, 11, getColorForType('portal'));

                // Draw a subtle pulsing arrow at the exact endpoint to indicate destination
                const endPulse = 1 + 0.15 * Math.sin(time * 0.006);
                const endTan = quadraticTangent(0, 0, ctrl.x, ctrl.y, pathEndX, pathEndY, 0.99);
                const endAngle = Math.atan2(endTan.y, endTan.x);
                drawArrowhead(ctx, pathEndX, pathEndY, endAngle, 14 * endPulse, '#ffffff');
            }
        }
    }

    ctx.restore();

    // Always draw markers within radius
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(playerYaw);
    for (const m of markers) {
        const relativeX = m.position.x - playerPos.x;
        const relativeZ = m.position.z - playerPos.z;
        const screenDist = Math.hypot(relativeX, relativeZ) * scale;
        if (screenDist <= mapRadius) {
            drawSciFiMarker(ctx, relativeX * scale, relativeZ * scale, m);
        }
    }
    ctx.restore();

    // This part draws the player's marker
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(playerYaw);
    drawPlayerChevron(ctx);
    ctx.restore();
}

/**
 * Tears down the minimap UI and frees references.
 *
 * - Removes the canvas and toggle button from the DOM
 * - Clears background patterns to help GC
 * - Resets module‑level state so the map can be safely recreated.
 */
export function cleanupMinimap() {
    // Remove event listener from toggle button if it exists
    if (toggleBtn) {
        toggleBtn.removeEventListener('click', toggleBtn.onclick || toggleBtn._listener);
        toggleBtn.innerHTML = ''; // Clear any inner content like SVG
    }
    // Clear container content and remove
    if (container) {
        container.innerHTML = ''; // Clear canvas and any potential SVG children
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
    hoverboardReached = false;
}