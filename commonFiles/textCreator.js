/**
 * ============================================
 * 3D TEXT CREATOR MODULE
 * ============================================
 * Generates 3D text objects for the game world.
 * Uses FontLoader and TextGeometry for text rendering.
 * 
 * Features:
 * - Multi-line text support
 * - Character-by-character rendering
 * - Customizable fonts, sizes, and colors
 * - Opacity and rotation control
 * - Automatic text centering
 * - Letter spacing configuration
 * - Async promise-based loading
 * 
 * Options:
 * - size: Text scale (default 0.2)
 * - color: Hex color code (default white)
 * - position: World position coordinates
 * - rotation: Euler angles for orientation
 * - opacity: Transparency level (0-1)
 * - font: Path to JSON font file
 * - letterSpacing: Space between characters
 */

import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export function create3DText(text = "", options = {}) {
    // Default parameters
    const params = {
        size: options.size || 0.2,
        letterSpacing: options.letterSpacing || 0,
        color: options.color || 0xffffff,
        position: options.position || { x: 0, y: 0, z: 0 },
        rotation: options.rotation || { x: 0, y: 0, z: 0 },
        opacity: options.opacity || 1.0,
        curveSegments: options.curveSegments || 12,
        font: options.font || './fonts/BOWLER_Regular.json'
    };

    const loader = new FontLoader();
    
    return new Promise((resolve) => {
        loader.load(params.font, (font) => {
            const textGroup = new THREE.Group();
            const lines = text.split('\n');
            let maxWidth = 0;
            let totalHeight = 0;
            const lineSpacing = params.size * 2;
            const lineMeshes = [];

            // First pass: create all meshes and calculate dimensions
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                let currentX = 0;
                let lineWidth = 0;
                const lineGroup = new THREE.Group();

                // Create individual letters for this line
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === ' ') {
                        currentX += params.size * 0.5;
                        lineWidth += params.size * 0.5;
                        continue;
                    }

                    const geometry = new TextGeometry(line[i], {
                        font: font,
                        size: params.size,
                        depth: 0,
                        curveSegments: params.curveSegments
                    });

                    const material = new THREE.MeshBasicMaterial({
                        color: params.color,
                        transparent: true,
                        opacity: params.opacity
                    });

                    const letterMesh = new THREE.Mesh(geometry, material);
                    geometry.computeBoundingBox();
                    const letterWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
                    const letterHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
                    
                    letterMesh.position.x = currentX;
                    letterMesh.position.y = -letterHeight / 2;
                    lineGroup.add(letterMesh);

                    currentX += letterWidth + params.letterSpacing;
                    lineWidth += letterWidth + params.letterSpacing;
                }

                // Store line width and add to total height
                maxWidth = Math.max(maxWidth, lineWidth - params.letterSpacing);
                lineMeshes.push({
                    group: lineGroup,
                    width: lineWidth - params.letterSpacing,
                    height: params.size
                });
            }

            // Calculate total height
            totalHeight = lineMeshes.length * lineSpacing;

            // Second pass: position all lines
            for (let i = 0; i < lineMeshes.length; i++) {
                const line = lineMeshes[i];
                const yOffset = (totalHeight / 2) - (i * lineSpacing) - (lineSpacing / 2);
                line.group.position.y = yOffset;
                line.group.position.x = -line.width / 2;
                textGroup.add(line.group);
            }

            // Apply final position and rotation
            textGroup.position.set(
                params.position.x,
                params.position.y,
                params.position.z
            );
            textGroup.rotation.set(
                params.rotation.x,
                params.rotation.y,
                params.rotation.z
            );

            resolve(textGroup);
        });
    });
} 