import * as THREE from "three";

/**
 * Creates a full‑screen loading screen effect powered by a custom shader.
 *
 * The effect combines:
 * - A "warp speed" radial streak effect
 * - A twinkling starfield
 * - A tunnel–like distortion
 * - A center glow and gradient vignette
 * - An adjustable dissolve mask (for fading in/out)
 *
 * The returned object exposes:
 * - `plane`: a `THREE.Mesh` that should be added to your scene
 * - `material`: the `THREE.ShaderMaterial` used for the effect
 * - `update(delta)`: call each frame with the time delta to animate the shader
 * - `handleResize(width, height)`: update resolution‑dependent uniforms
 *
 * @returns {{
 *   plane: THREE.Mesh,
 *   material: THREE.ShaderMaterial,
 *   update: (delta: number) => void,
 *   handleResize: (width: number, height: number) => void
 * }} Loading screen shader helpers.
 */
export function createLoadingScreenShader() {
    // Create a plane that fills the screen in clip space (NDC −1 → 1).
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Custom shader material powering the entire loading effect.
    const material = new THREE.ShaderMaterial({
        // All configurable shader parameters are defined as uniforms here.
        uniforms: {
            // Global animation time (seconds).
            time: { value: 0 },
            // Resolution of the viewport in pixels.
            resolution: {
                value: new THREE.Vector2(window.innerWidth, window.innerHeight),
            },
            // Aspect ratio (width / height) used for non‑distorted calculations.
            aspectRatio: { value: window.innerWidth / window.innerHeight },
            // Base tint color for gradient and glow.
            color: { value: new THREE.Color("0x4a6cf7") },
            // Post effect brightness multiplier.
            brightness: { value: 0.0 },
            // Post effect contrast multiplier.
            contrast: { value: 0.0 },
            // Controls the strength/falloff of the center glow.
            power: { value: 1.0 },
            // 0 → fully dissolved (transparent), 1 → fully visible.
            dissolve: { value: 0.0 },

            // -----------------------------------------------------------------
            // Warp Speed uniforms
            // -----------------------------------------------------------------

            // Speed of the radial streak / warp effect.
            speed: { value: 2 },
            // How quickly streaks fade as they move.
            fadeAway: { value: 0.5 },
            // Controls variation in streak distribution.
            uniformity: { value: 10.0 },
            // Color of the warp streaks.
            warpColor: { value: new THREE.Color(0x4a6cf7) },

            // -----------------------------------------------------------------
            // Starfield uniforms
            // -----------------------------------------------------------------

            // Scroll speed of the underlying star noise.
            starSpeed: { value: 0.1 },
            // Rate at which stars twinkle.
            twinkleSpeed: { value: 0.5 },
            // Scale of the starfield texture.
            starScale: { value: 1.0 },

            // -----------------------------------------------------------------
            // Tunnel uniforms
            // -----------------------------------------------------------------

            // Controls tunnel field‑of‑view / zoom.
            tunnelFov: { value: 2.0 },
            // Speed of tunnel movement.
            tunnelSpeed: { value: 1.2 },
            // How large the tunnel mask (fading edges) is.
            tunnelMaskSize: { value: 0.5 },
            // Overall tunnel size.
            tunnelSize: { value: 0.5 },
        },
        vertexShader: `
            // Pass‑through varyings from vertex to fragment shader.
            varying vec2 vUv;
            varying vec3 vPosition;
            varying vec3 vNormal;

            void main() {
                // Standard full‑screen quad vertex shader:
                // forward UVs and use clip‑space positions directly.
                vUv = uv;
                vPosition = position;
                vNormal = normal;
                
                gl_Position = vec4(position, 1.0); // Use position directly for screen-filling quad
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec2 resolution;
            uniform float aspectRatio;
            uniform vec3 color;
            uniform float brightness;
            uniform float contrast;
            uniform float power;
            uniform float dissolve;

            // Warp Speed uniforms
            uniform float speed;
            uniform float fadeAway;
            uniform float uniformity;
            uniform vec3 warpColor;

            // Starfield uniforms
            uniform float starSpeed;
            uniform float twinkleSpeed;
            uniform float starScale;

            // Tunnel uniforms
            uniform float tunnelFov;
            uniform float tunnelSpeed;
            uniform float tunnelMaskSize;
            uniform float tunnelSize;

            // Interpolated UV and geometry data from the vertex shader.
            varying vec2 vUv;
            varying vec3 vPosition;
            varying vec3 vNormal;

            // -----------------------------------------------------------------
            // Noise & Perlin functions
            // -----------------------------------------------------------------

            // Simple random hash based on UV coordinates.
            highp float rand(vec2 co) {
                highp float a = 1552.9898;
                highp float b = 78.233;
                highp float c = 43758.5453;
                highp float dt = dot(co.xy, vec2(a,b));
                highp float sn = mod(dt, 3.14);
                return fract(sin(sn) * c);
            }

            // 2D Perlin‑style noise with tiling frequency and a "Seed".
            float noise(vec2 UV, float Seed, vec2 Frequency) {
                vec2 PerlinR = UV * Frequency;
                highp vec2 Perlin1Pos = floor(PerlinR);
                
                float RandX0 = (Perlin1Pos.x + (Perlin1Pos.y) * Seed);
                float RandX1 = ((Perlin1Pos.x + 1.0) + (Perlin1Pos.y) * Seed);
                float RandX2 = (Perlin1Pos.x + (Perlin1Pos.y + 1.0) * Seed);
                float RandX3 = ((Perlin1Pos.x + 1.0) + (Perlin1Pos.y + 1.0) * Seed);
                
                float Perlin0Val = rand(vec2(RandX0, RandX0 * 0.1224));
                float Perlin1Val = rand(vec2(RandX1, RandX1 * 0.1224));
                float Perlin2Val = rand(vec2(RandX2, RandX2 * 0.1224));
                float Perlin3Val = rand(vec2(RandX3, RandX3 * 0.1224));
                
                vec2 Perc = (sin(((PerlinR - Perlin1Pos) * 3.1415926) - 1.570796) * 0.5) + 0.5;
                
                float Val0to2 = mix(Perlin0Val, Perlin2Val, Perc.y); 
                float Val1to3 = mix(Perlin1Val, Perlin3Val, Perc.y); 
                
                return mix(Val0to2, Val1to3, Perc.x);
            }

            // Layered (fractal) noise – variant 1 used for broad patterns.
            float perlinNoise1(vec2 UV, float Seed) {
                float RetVal = 0.0;
                RetVal += noise(UV, Seed * 1.2, vec2(2.0)) * 0.5;
                RetVal += noise(UV, Seed * 1.4, vec2(5.0)) * 0.25;
                RetVal += noise(UV, Seed * 1.1, vec2(10.0)) * 0.125;
                RetVal += noise(UV, Seed * 1.5, vec2(24.0)) * 0.0625;
                RetVal += noise(UV, Seed * 1.2, vec2(54.0)) * 0.03125;
                RetVal += noise(UV, Seed * 1.3, vec2(128.0)) * 0.025625;
                return RetVal;
            }

            // Layered (fractal) noise – variant 2 used for finer detail.
            float perlinNoise2(vec2 UV, float Seed) {
                float RetVal = 0.0;
                RetVal += noise(UV, Seed * 1.2, vec2(6.0)) * 0.5;
                RetVal += noise(UV, Seed * 1.4, vec2(12.0)) * 0.25;
                RetVal += noise(UV, Seed * 1.1, vec2(24.0)) * 0.125;
                RetVal += noise(UV, Seed * 1.5, vec2(40.0)) * 0.0625;
                RetVal += noise(UV, Seed * 1.2, vec2(80.0)) * 0.03125;
                RetVal += noise(UV, Seed * 1.3, vec2(158.0)) * 0.025625;
                return RetVal;
            }

            // -----------------------------------------------------------------
            // Twinkling starfield – background texture
            // -----------------------------------------------------------------

            vec4 twinklingStarfield(vec2 uv) {
                vec2 UV = uv * starScale + time * starSpeed;
                
                vec2 TimeOffset = vec2(
                    sin(time * 0.00962379),
                    cos(time * 0.00962379)) * (sin(time * 0.0041839) + 0.3);
                
                float tempC = pow(1.0 - perlinNoise1(UV + TimeOffset, 21.32143), 3.5);
                vec3 tempA = vec3(tempC) * vec3(0.25, 0.67, 0.5);
                tempC = pow(((1.0 - perlinNoise2(UV + (TimeOffset * 1.15), 12.523)) * tempC), 1.1);
                tempA += vec3(tempC) * vec3(1.0, 0.0, 0.0);
                
                vec4 RetVal = vec4(0.0);    
                float randX = rand(UV);
                float randY = rand(UV.yx);
                float powIn = ((sin(((time + 10.0) * randX * twinkleSpeed)) * 0.5) + 0.5); 
                RetVal.xyz = max(vec3(randX * pow(randY, 10.0) * pow(powIn, 2.0)), vec3(0.0)); 
                RetVal.xyz += tempA;

                return RetVal;
            }

            // -----------------------------------------------------------------
            // Warp speed radial streaks
            // -----------------------------------------------------------------

            vec4 warpSpeed() {
                float t = time * speed;
                vec2 position = (vUv.xy - 0.5) * vec2(aspectRatio, 1.0);
                float angle = atan(position.y, position.x) / (2.0 * 3.14159265359);
                angle -= floor(angle);
                float rad = length(position);
                float angleFract = fract(angle * 256.0);
                float angleRnd = floor(angle * 256.0) + 1.0;
                float angleRnd1 = fract(angleRnd * fract(angleRnd * 0.7235) * 45.1);
                float angleRnd2 = fract(angleRnd * fract(angleRnd * 0.82657) * 13.724);
                float t2 = t + angleRnd1 * uniformity;
                float radDist = sqrt(angleRnd2);
                float adist = radDist / rad * 0.1;
                float dist = (t2 * 0.1 + adist);
                dist = abs(fract(dist) - fadeAway);
                
                float outputColor = (1.0 / (dist)) * cos(0.7 * sin(t)) * adist / radDist / 30.0;
                return vec4(outputColor * warpColor, 1.0);
            }

            // -----------------------------------------------------------------
            // Tunnel distortion effect
            // -----------------------------------------------------------------

            vec4 uvTunnel() {
                vec2 uv = (vUv - 0.5) * vec2(tunnelFov * aspectRatio, tunnelFov);
                float t = time * tunnelSpeed;

                vec2 b = vec2(
                    1.0 / length(uv) + t,
                    atan(uv.y, abs(uv.x)) / 1.14
                );

                float tunnelMask = min(1.0, tunnelMaskSize - b.x + t);
                return vec4(
                    twinklingStarfield(b.xy).rgb * tunnelMask,
                    1.0
                );
            }

            // -----------------------------------------------------------------
            // Radial gradient and center glow helpers
            // -----------------------------------------------------------------

            // Darkens edges and slightly brightens the center (vignette style).
            vec4 gradientMultiply() {
                float amount = 1.0 - length(vUv - 0.5);
                return vec4(0.2 + vec3(pow(amount, 2.0)), 1.0);
            }

            // Strong glow at the very center based on the power uniform.
            vec4 glowingCenter() {
                float amount = 1.0 - length(vUv - 0.5);
                return vec4(vec3(pow(amount, power * 20.0)), 1.0);
            }

            // -----------------------------------------------------------------
            // Dissolve mask – used to fade in or out the loading screen
            // -----------------------------------------------------------------

            float dissolveEffect(vec2 uv, float dissolve) {
                float noise = perlinNoise1(uv * 3.0, 1.0);
                float smoothNoise = smoothstep(0.0, 1.0, noise);
                float smoothDissolve = smoothstep(0.0, 1.0, dissolve);
                float finalNoise = mix(smoothNoise, noise, 0.3);
                return step(smoothDissolve, finalNoise);
            }

            void main() {
                // Build each layer of the effect separately.
                vec4 warp = warpSpeed();
                vec4 tunnel = uvTunnel();
                vec4 gradient = gradientMultiply();
                vec4 glow = glowingCenter();
                
                // Combine all visual layers, applying global color/brightness/contrast.
                vec4 finalColor = warp + tunnel + (gradient * vec4(color * brightness, 1.0) * contrast) + glow;
                
                // Apply dissolve to the alpha channel: controls whether the
                // loading screen is visible or transparent at any given time.
                float dissolveMask = dissolveEffect(vUv, dissolve);
                finalColor.a = mix(0.0, 1.0, dissolveMask);
                
                gl_FragColor = finalColor;
            }
        `,
    });

    // Mesh that will render the shader – always on top and never culled.
    const plane = new THREE.Mesh(geometry, material);
    plane.renderOrder = 999; // Ensure it renders after everything else.
    plane.frustumCulled = false; // Always render, even if theoretically off‑screen.

    // Accumulated time used to drive the shader's `time` uniform.
    let totalTime = 0;

    return {
        plane,
        material,
        /**
         * Advances the internal time used by the shader for animation.
         *
         * @param {number} delta - Time in seconds since the last frame.
         */
        update: (delta) => {
            totalTime += delta;
            material.uniforms.time.value = totalTime;
        },
        /**
         * Updates resolution‑dependent uniforms when the viewport changes size.
         *
         * @param {number} width - New viewport width in pixels.
         * @param {number} height - New viewport height in pixels.
         */
        handleResize: (width, height) => {
            // Update shader uniforms for new dimensions
            material.uniforms.resolution.value.set(width, height);
            material.uniforms.aspectRatio.value = width / height;
        }
    };
}
