/**
 * ============================================
 * UV SPREAD INSTANCING MODULE
 * ============================================
 * Spreads instanced meshes across a texture's UV area based on pixel colors.
 * Creates grass, vegetation, or decorative elements distributed across surfaces.
 * 
 * Features:
 * - Texture-based instance placement
 * - Wind animation for organic movement
 * - Color-matching pixel detection
 * - Randomized rotation and scale
 * - GPU-accelerated instancing
 * - Vertex shader wind displacement
 * - Optional dual mesh instancing
 * 
 * Wind System:
 * - Amplitude, frequency, and speed control
 * - Height-based sway effect
 * - Per-instance phase variation
 * - Real-time uniform updates
 * 
 * Usage:
 * Place instances where specific texture colors are found
 * Useful for grass, flowers, rocks scattered on surfaces
 */

import * as THREE from 'three';

// Create a wind-enabled cloned material with vertex sway
function createWindMaterial(baseMaterial, options = {}) {
    const {
        amplitude = 0.12,
        frequency = 0.6,
        speed = 1.2,
        windDirection = new THREE.Vector2(1.0, 0.0)
    } = options;

    const mat = baseMaterial.clone();
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uWindAmplitude = { value: amplitude };
        shader.uniforms.uWindFrequency = { value: frequency };
        shader.uniforms.uWindSpeed = { value: speed };
        shader.uniforms.uWindDirection = { value: windDirection };

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>\n`+
            `uniform float uTime;\n`+
            `uniform float uWindAmplitude;\n`+
            `uniform float uWindFrequency;\n`+
            `uniform float uWindSpeed;\n`+
            `uniform vec2 uWindDirection;\n`
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>\n`+
            `// Wind sway displacement (object space before instancing transform)\n`+
            `vec2 windDir = normalize(uWindDirection);\n`+
            `float localHeight = clamp(position.y, 0.0, 1.0);\n`+
            `float phase = dot(position.xz, windDir) * uWindFrequency + uTime * uWindSpeed;\n`+
            `#ifdef USE_INSTANCING\n`+
            `phase += float(gl_InstanceID) * 0.37;\n`+
            `#endif\n`+
            `float sway = sin(phase) * uWindAmplitude * localHeight;\n`+
            `transformed.xz += windDir * sway;\n`
        );

        // Keep reference for runtime updates
        mat.userData.shader = shader;
    };

    mat.needsUpdate = true;
    return mat;
}

function attachWindUpdater(instanced) {
    const start = performance.now();
    instanced.onBeforeRender = function(renderer, scene, camera, geometry, material) {
        const shader = material && material.userData ? material.userData.shader : null;
        if (shader && shader.uniforms && shader.uniforms.uTime) {
            shader.uniforms.uTime.value = (performance.now() - start) / 1000;
        }
    };
}

function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    const num = parseInt(hex, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function makeColorTest(color, tolerance = 10) {
    const { r, g, b } = hexToRgb(color);
    return (pr, pg, pb, pa) =>
        Math.abs(pr - r) <= tolerance &&
        Math.abs(pg - g) <= tolerance &&
        Math.abs(pb - b) <= tolerance;
}

export function spreadInstancedRandomOnUVArea(scene, sceneRoot, meshName, textureUrl, isTargetPixel, meshToInstance, count, meshToInstance2, baseScale, options) {
    let pixelTest = isTargetPixel;
    if (typeof isTargetPixel === 'string') {
        pixelTest = makeColorTest(isTargetPixel);
    }
    let targetMesh = null;
    sceneRoot.traverse((child) => {
        if (child.isMesh && child.name === meshName) {
            targetMesh = child;
        }
    });
    if (!targetMesh) return;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(textureUrl, function(texture) {
        const image = texture.image;
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const imgData = ctx.getImageData(0, 0, image.width, image.height).data;

        const blueUVs = [];
        for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
                const idx = (y * image.width + x) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];
                const a = imgData[idx + 3];
                if (pixelTest(r, g, b, a)) {
                    blueUVs.push({
                        u: x / (image.width - 1),
                        v: 1 - y / (image.height - 1)
                    });
                }
            }
        }
        if (blueUVs.length === 0) return;

        const geometry = targetMesh.geometry;
        const posAttr = geometry.attributes.position;
        const uvAttr = geometry.attributes.uv;
        const indexAttr = geometry.index;
        const triangles = [];
        for (let i = 0; i < indexAttr.count; i += 3) {
            const a = indexAttr.getX(i);
            const b = indexAttr.getX(i + 1);
            const c = indexAttr.getX(i + 2);
            const uvA = new THREE.Vector2(uvAttr.getX(a), uvAttr.getY(a));
            const uvB = new THREE.Vector2(uvAttr.getX(b), uvAttr.getY(b));
            const uvC = new THREE.Vector2(uvAttr.getX(c), uvAttr.getY(c));
            const posA = new THREE.Vector3(posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a));
            const posB = new THREE.Vector3(posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b));
            const posC = new THREE.Vector3(posAttr.getX(c), posAttr.getY(c), posAttr.getZ(c));
            triangles.push({uvA, uvB, uvC, posA, posB, posC});
        }

        function baryInterpolate(pA, pB, pC, wA, wB, wC) {
            return new THREE.Vector3().addScaledVector(pA, wA).addScaledVector(pB, wB).addScaledVector(pC, wC);
        }
        function uvInTriangle(uv, uvA, uvB, uvC) {
            const v0 = uvB.clone().sub(uvA);
            const v1 = uvC.clone().sub(uvA);
            const v2 = uv.clone().sub(uvA);
            const d00 = v0.dot(v0);
            const d01 = v0.dot(v1);
            const d11 = v1.dot(v1);
            const d20 = v2.dot(v0);
            const d21 = v2.dot(v1);
            const denom = d00 * d11 - d01 * d01;
            if (denom === 0) return null;
            const v = (d11 * d20 - d01 * d21) / denom;
            const w = (d00 * d21 - d01 * d20) / denom;
            const u = 1 - v - w;
            if (u >= -1e-4 && v >= -1e-4 && w >= -1e-4) return {u, v, w};
            return null;
        }

        const positions = [];
        for (let i = 0; i < count; i++) {
            const randIdx = Math.floor(Math.random() * blueUVs.length);
            const uv = new THREE.Vector2(blueUVs[randIdx].u, blueUVs[randIdx].v);
            let found = false;
            for (let t = 0; t < triangles.length; t++) {
                const tri = triangles[t];
                const bary = uvInTriangle(uv, tri.uvA, tri.uvB, tri.uvC);
                if (bary) {
                    const pos = baryInterpolate(tri.posA, tri.posB, tri.posC, bary.u, bary.v, bary.w);
                    targetMesh.localToWorld(pos);
                    positions.push(pos);
                    found = true;
                    break;
                }
            }
        }
        if (meshToInstance && positions.length > 0) {
            if (!scene.userData) scene.userData = {};
            if (!scene.userData.grassGroup) {
                scene.userData.grassGroup = new THREE.Group();
                scene.add(scene.userData.grassGroup);
            }

            const enableWind = !options || options.wind !== false;
            const windOptions = options && options.windOptions ? options.windOptions : {
                amplitude: 0.12,
                frequency: 0.6,
                speed: 1.1
            };

            const grassMaterial = enableWind ? createWindMaterial(meshToInstance.material, windOptions) : meshToInstance.material;

            const instanced = new THREE.InstancedMesh(
                meshToInstance.geometry,
                grassMaterial,
                positions.length
            );
            const dummy = new THREE.Object3D();
            for (let i = 0; i < positions.length; i++) {
                dummy.position.copy(positions[i]);
                // Use baseScale if provided, otherwise default to old behavior
                let scale = baseScale !== undefined ? (baseScale + Math.random() * baseScale) : (0.8 + Math.random() * 0.8);
                dummy.scale.set(scale, scale, scale);
                dummy.updateMatrix();
                instanced.setMatrixAt(i, dummy.matrix);
            }
            if (enableWind) {
                attachWindUpdater(instanced);
            }
            scene.userData.grassGroup.add(instanced);
        }
        if (meshToInstance2 && positions.length > 0) {
            if (!scene.userData) scene.userData = {};
            if (!scene.userData.grassGroup) {
                scene.userData.grassGroup = new THREE.Group();
                scene.add(scene.userData.grassGroup);
            }

            const enableWind2 = !options || options.wind !== false;
            const windOptions2 = options && options.windOptions ? options.windOptions : {
                amplitude: 0.07,
                frequency: 0.7,
                speed: 1.0
            };

            const grassMaterial2 = enableWind2 ? createWindMaterial(meshToInstance2.material, windOptions2) : meshToInstance2.material;

            const instanced2 = new THREE.InstancedMesh(
                meshToInstance2.geometry,
                grassMaterial2,
                positions.length
            );
            const dummy2 = new THREE.Object3D();
            for (let i = 0; i < positions.length; i++) {
                dummy2.position.copy(positions[i]);
                let scale2 = baseScale !== undefined ? (baseScale + Math.random() * baseScale) : (0.8 + Math.random() * 0.8);
                dummy2.scale.set(scale2, scale2, scale2);
                dummy2.updateMatrix();
                instanced2.setMatrixAt(i, dummy2.matrix);
            }
            if (enableWind2) {
                attachWindUpdater(instanced2);
            }
            scene.userData.grassGroup.add(instanced2);
        }
    });
} 