/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 */
/**
 * Script Description
 * Scene 3 minimap (DOM canvas overlay).
 * Created on 2025-12-22 by vishnumr
 */
/*******************************************************************************
 * * OneSource IML | TGI FRIDAY *
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
 * @fileoverview Scene 3 minimap (DOM canvas overlay).
 *
 * This module renders a circular “radar” minimap in the DOM using `<canvas>`.
 * It is tailored for Scene 3's interior environment and supports:
 * - Player marker at map center, with map rotated by player yaw (so forward stays “up”).
 * - Dynamic markers for Zoe and Electro (using world transforms when models exist).
 * - A curved guidance path + animated arrow pointing toward the current follow target.
 * - A simple follow target state machine: start following Zoe, then switch to Electro
 *   when the player is close to Zoe (configurable threshold).
 *
 * Lifecycle:
 * - `createMinimap(sceneRef, physicsControllerRef, electroRef, zoeRef)` creates DOM nodes once.
 * - `updateMinimap()` is called every frame by Scene 3's render loop.
 * - `cleanupMinimap()` removes DOM and clears internal references.
 *
 * Important:
 * - This module is single-instance and stores state at module scope.
 * - It assumes `physicsControllerRef.playerFunction.player` exists once initialized.
 */

import './minimap.css';
import * as THREE from 'three';

// --- Orientation / coordinate helpers ---
// Small yaw offset if the map convention differs (auto-detected once on first update).
let YAW_OFFSET = 0; // may be set automatically on first update
let _autoYawChecked = false;

// Helpers: world position/yaw (works even when the player is parented).
const _tmpVec3 = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Get world position for an object.
 * @param {THREE.Object3D} player
 * @returns {{x:number,y:number,z:number}}
 */
function getPlayerWorldPosition(player) {
    if (!player) return { x: 0, y: 0, z: 0 };
    player.getWorldPosition(_tmpVec3);
    return { x: _tmpVec3.x, y: _tmpVec3.y, z: _tmpVec3.z };
}

/**
 * Get world yaw (heading) for the player.
 *
 * Uses `getWorldDirection` and computes yaw so that:
 * - yaw=0 roughly aligns to world forward (0,0,-1).
 * - if needed, flips by 180 degrees once to align “front” on the minimap.
 *
 * @param {THREE.Object3D} player
 * @returns {number} yaw in radians
 */
function getPlayerWorldYaw(player) {
    if (!player) return 0;
    const dir = new THREE.Vector3();
    player.getWorldDirection(dir);
    // Auto-detect whether we need to flip 180deg so the map shows the player's front.
    if (!_autoYawChecked) {
        const worldForward = new THREE.Vector3(0, 0, -1);
        // if dot < 0, player's forward is opposite world forward -> flip
        try {
            if (dir.dot(worldForward) < 0) {
                YAW_OFFSET = Math.PI;
            } else {
                YAW_OFFSET = 0;
            }
        } catch (e) {
            YAW_OFFSET = 0;
        }
        _autoYawChecked = true;
    }
    return Math.atan2(dir.x, -dir.z) + YAW_OFFSET;
}

// --- Curve helpers for animated arrow ---
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

function quadraticPoint(p0x, p0y, cx, cy, p2x, p2y, t) {
    const u = 1 - t;
    const x = u * u * p0x + 2 * u * t * cx + t * t * p2x;
    const y = u * u * p0y + 2 * u * t * cy + t * t * p2y;
    return { x, y };
}

function quadraticTangent(p0x, p0y, cx, cy, p2x, p2y, t) {
    const u = 1 - t;
    const dx = 2 * u * (cx - p0x) + 2 * t * (p2x - cx);
    const dy = 2 * u * (cy - p0y) + 2 * t * (p2y - cy);
    return { x: dx, y: dy };
}

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

// --- Follow target state ---
// 'zoe' initially, can be switched to 'electro'
let followTarget = 'zoe';

/**
 * Set which marker the guidance arrow should point toward.
 * @param {'zoe'|'electro'} target
 */
export function setFollowTarget(target) {
    if (target !== 'zoe' && target !== 'electro') return;
    followTarget = target;
}

let container, canvas, ctx, toggleBtn, visible = false;
let scene, physicsController, electroCharacter, zoeCharacter;
let backgroundPattern = null;

/**
 * Static marker definitions (used as fallback positions when character refs are missing).
 * These values are in Scene 3 world coordinates.
 */
const markers = [
    { type: 'zoe', color: '#ffffff', size: 8, position: { x: 45, y: -5.5, z: -60 } },
    { type: 'electro', color: '#00ff00', size: 8, position: { x: -15, y: 1.9, z: -142 } },
];

const playerMarker = { color: '#00f6ff', size: 6 };

/**
 * Draw a marker symbol at the origin. Caller should translate beforehand.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} marker
 */
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
        case 'zoe':
            ctx.beginPath();
            ctx.arc(0, 0, marker.size * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-marker.size * 0.4, -marker.size * 0.4, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(marker.size * 0.4, -marker.size * 0.4, 2, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'electro':
            ctx.beginPath();
            ctx.arc(0, 0, marker.size * 0.7, 0, Math.PI * 2);
            ctx.fill();
            break;
    }
    ctx.restore();
}

/**
 * Draw a marker with glow at minimap-local coordinates (x,y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {any} marker
 */
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

/**
 * Draw player chevron at origin (0,0). Caller translates to map center.
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
 * Create a repeating background grid pattern canvas.
 * @returns {HTMLCanvasElement}
 */
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

/**
 * Create minimap DOM elements.
 *
 * @param {any} sceneRef Scene reference (currently unused but kept for parity)
 * @param {any} physicsControllerRef Must expose `playerFunction.player`
 * @param {THREE.Object3D|null} electroRef Electro model reference (optional)
 * @param {THREE.Object3D|null} zoeRef Zoe model reference (optional)
 */
export function createMinimap(sceneRef, physicsControllerRef, electroRef, zoeRef) {
    scene = sceneRef;
    physicsController = physicsControllerRef;
    electroCharacter = electroRef;
    zoeCharacter = zoeRef;
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
        toggleBtn.textContent = visible ? 'Hide Map' : '';
    });
    const gridCanvas = createBackgroundGrid();
    backgroundPattern = ctx.createPattern(gridCanvas, 'repeat');
    setTimeout(() => {
        visible = true;
        container.classList.add('visible');
    }, 1200);
}

/**
 * Update the minimap each frame.
 *
 * Rendering steps:
 * - Draw clipped circular grid background, rotated by player yaw.
 * - Draw scanner sweep + pulsing rings.
 * - Compute current follow target position, draw curved path + animated arrow.
 * - Draw Zoe/Electro markers, then draw player chevron last.
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, mapRadius, 0, Math.PI * 2);
    ctx.clip();

    // This part draws the background grid using player's world transform
    ctx.translate(centerX, centerY);
    ctx.rotate(-playerYaw);
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

    // Handle follow target dynamically
    let targetPos = null;
    let targetMarker = markers.find(m => m.type === followTarget);
    let relativeX = 0;
    let relativeZ = 0;
    let dist = 0;
    if (targetMarker) {
        if (followTarget === 'zoe' && zoeCharacter) {
            targetPos = getPlayerWorldPosition(zoeCharacter);
        } else if (followTarget === 'electro' && electroCharacter) {
            targetPos = getPlayerWorldPosition(electroCharacter);
        } else {
            // Fallback to fixed position if character not available
            targetPos = targetMarker.position;
        }
        if (targetPos) {
            relativeX = targetPos.x - playerPos.x;
            relativeZ = targetPos.z - playerPos.z;
            dist = Math.hypot(relativeX, relativeZ);

            // Switch to electro after zoe sequence finishes (when close to zoe)
            if (followTarget === 'zoe' && dist < 5) { // Adjust threshold as needed
                setFollowTarget('electro');
                // Update targetMarker to new one
                targetMarker = markers.find(m => m.type === 'electro');
                if (targetMarker) {
                    if (electroCharacter) {
                        targetPos = getPlayerWorldPosition(electroCharacter);
                    } else {
                        targetPos = targetMarker.position;
                    }
                    relativeX = targetPos.x - playerPos.x;
                    relativeZ = targetPos.z - playerPos.z;
                    dist = Math.hypot(relativeX, relativeZ);
                }
            }
        }
    }

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-playerYaw);

    // Draw animated path to the active followTarget
    if (targetPos && dist !== 0 && targetMarker) {
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
        drawCurvedPath(ctx, 0, 0, pathEndX, pathEndY, targetMarker.color, []);

        // Animated arrow along curve
        const ctrl = computeCurveControl(0, 0, pathEndX, pathEndY);
        const animTime = performance.now();
        const animSpeed = 0.0035;
        const tOsc = 0.5 * (1 + Math.sin(animTime * animSpeed));
        const arrowT = 0.65 + 0.35 * tOsc; // slightly earlier along curve
        const pt = quadraticPoint(0, 0, ctrl.x, ctrl.y, pathEndX, pathEndY, arrowT);
        const tan = quadraticTangent(0, 0, ctrl.x, ctrl.y, pathEndX, pathEndY, arrowT);
        const angle = Math.atan2(tan.y, tan.x);
        drawArrowhead(ctx, pt.x, pt.y, angle, 10, targetMarker.color);
        // Endpoint indicator
        const endPulse = 1 + 0.15 * Math.sin(time * 0.006);
        const endTan = quadraticTangent(0, 0, ctrl.x, ctrl.y, pathEndX, pathEndY, 0.99);
        const endAngle = Math.atan2(endTan.y, endTan.x);
        drawArrowhead(ctx, pathEndX, pathEndY, endAngle, 14 * endPulse, '#ffffff');
    }

    // This part draws the markers (triggers) dynamically or fixed
    for (const m of markers) {
        let mPos;
        if (m.type === 'zoe' && zoeCharacter) {
            mPos = getPlayerWorldPosition(zoeCharacter);
        } else if (m.type === 'electro' && electroCharacter) {
            mPos = getPlayerWorldPosition(electroCharacter);
        } else {
            mPos = m.position;
        }
        if (!mPos) continue;
        const relX = mPos.x - playerPos.x;
        const relZ = mPos.z - playerPos.z;
        const x = relX * scale;
        const y = relZ * scale;
        if (Math.hypot(x, y) < mapRadius) {
            drawSciFiMarker(ctx, x, y, m);
        }
    }

    ctx.restore();

    // This part draws the player's marker
    ctx.save();
    ctx.translate(centerX, centerY);
    drawPlayerChevron(ctx);
    ctx.restore();
}

/**
 * Remove DOM nodes and clear minimap references.
 * Safe to call multiple times.
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
}

/**
 * Draw a quadratic curved path between two points.
 * Used for guidance lines.
 */
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
    ctx.strokeStyle = color || 'rgba(0,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    try {
        ctx.shadowColor = (color || '#00ffff').replace(/0\.[0-9]+/, '0.4');
    } catch (e) {
        ctx.shadowColor = color || '#00ffff';
    }
    ctx.shadowBlur = 6;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
    ctx.restore();
}