import * as THREE from "three";

/**
 * Death screen post-process (freeze-frame + grayscale + dissolve).
 *
 * This helper captures the current rendered scene into an offscreen render target,
 * then draws a full-screen quad that samples that texture and applies:
 * - **Grayscale** ramp (`grayscaleAmount`)
 * - **Vignette** (scaled by grayscale for a "tunnel vision" feel)
 * - **Dissolve mask** to fade out / transition during respawn (`dissolveAmount`)
 *
 * Intended usage pattern:
 *  1) Create once per scene: `const deathFx = createDeathScreenShader(renderer, scene, camera)`
 *  2) When death triggers:
 *     - `deathFx.captureScene()` (freezes the current view)
 *     - `scene.add(deathFx.plane)`
 *     - Animate `deathFx.setGrayscale(t)` and/or `deathFx.setDissolve(t)` from 0..1
 *  3) On respawn/cleanup:
 *     - remove `deathFx.plane` from the scene
 *     - call `deathFx.dispose()`
 *
 * Important:
 * - This is not a full EffectComposer pipeline; it is a lightweight "single quad" pass.
 * - `captureScene()` must be called *before* showing the plane if you want a frozen frame.
 *
 * @param {THREE.WebGLRenderer} renderer - Renderer used to capture the scene to a render target.
 * @param {THREE.Scene} scene - Scene to capture.
 * @param {THREE.Camera} camera - Camera used for the capture.
 * @returns {{
 *   plane:THREE.Mesh,
 *   material:THREE.ShaderMaterial,
 *   renderTarget:THREE.WebGLRenderTarget,
 *   update:Function,
 *   captureScene:Function,
 *   setGrayscale:(amount:number)=>void,
 *   setDissolve:(amount:number)=>void,
 *   setVignetteStrength:(strength:number)=>void,
 *   handleResize:(width:number,height:number)=>void,
 *   dispose:()=>void
 * }}
 */
export function createDeathScreenShader(renderer, scene, camera) {
    const dpr = Math.min(window.devicePixelRatio, 2); // Cap DPR to 2 for performance
    
    // Create a render target to capture the scene
    const renderTarget = new THREE.WebGLRenderTarget(
        window.innerWidth * dpr,
        window.innerHeight * dpr,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        }
    );

    // Create a plane that fills the screen
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            sceneTexture: { value: renderTarget.texture },
            time: { value: 0 },
            grayscaleAmount: { value: 0.0 },
            dissolveAmount: { value: 0.0 },
            vignetteStrength: { value: 0.5 },
        },
        vertexShader: `
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D sceneTexture;
            uniform float time;
            uniform float grayscaleAmount;
            uniform float dissolveAmount;
            uniform float vignetteStrength;
            
            varying vec2 vUv;
            
            // Optimized hash function
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
            
            // Simplified Perlin-like noise
            float noise(vec2 p) {
                vec2 ip = floor(p);
                vec2 fp = fract(p);
                fp = fp * fp * (3.0 - 2.0 * fp);
                
                float n00 = hash(ip + vec2(0.0, 0.0));
                float n10 = hash(ip + vec2(1.0, 0.0));
                float n01 = hash(ip + vec2(0.0, 1.0));
                float n11 = hash(ip + vec2(1.0, 1.0));
                
                float nx0 = mix(n00, n10, fp.x);
                float nx1 = mix(n01, n11, fp.x);
                return mix(nx0, nx1, fp.y);
            }
            
            float dissolveEffect(vec2 uv, float dissolve) {
                float noiseValue = noise(uv * 2.0) * 0.5 + noise(uv * 4.0) * 0.3 + noise(uv * 8.0) * 0.2;
                return step(dissolve, noiseValue);
            }
            
            void main() {
                vec4 sceneColor = texture2D(sceneTexture, vUv);
                
                // Apply grayscale conversion using luminance formula
                float gray = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));
                
                // Mix between original color and grayscale based on grayscaleAmount
                vec3 finalColor = mix(sceneColor.rgb, vec3(gray), grayscaleAmount);
                
                // Apply vignette effect
                float dist = distance(vUv, vec2(0.5, 0.5));
                float vignette = smoothstep(0.8, 0.3, dist);
                finalColor *= mix(1.0, vignette, vignetteStrength * grayscaleAmount);
                
                // Apply dissolve effect
                float dissolveMask = dissolveEffect(vUv, dissolveAmount);
                
                gl_FragColor = vec4(finalColor, dissolveMask);
            }
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.renderOrder = 9999;
    plane.frustumCulled = false;

    let isDisposed = false;

    /**
     * Helper to clamp values into an allowed range.
     * We keep this local to avoid depending on any external utilities.
     */
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    return {
        plane,
        material,
        renderTarget,
        /**
         * Per-frame hook.
         *
         * The shader no longer animates `time` for performance reasons (the dissolve noise
         * is static); this method remains for API symmetry and future extensions.
         */
        update: () => {
            // time uniform is no longer needed for performance
            // material.uniforms.time.value += delta; // Removed - not used in current shader
        },
        /**
         * Captures the current scene into the internal render target.
         * Call this right before adding `plane` so the death screen displays a frozen frame.
         */
        captureScene: () => {
            if (isDisposed) return;
            // Render the scene to the render target (static capture)
            renderer.setRenderTarget(renderTarget);
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
        },
        /**
         * Sets grayscale blend factor.
         * @param {number} amount - 0..1, where 1 is fully grayscale.
         */
        setGrayscale: (amount) => {
            if (isDisposed) return;
            material.uniforms.grayscaleAmount.value = clamp(amount, 0, 1);
        },
        /**
         * Sets dissolve amount.
         * @param {number} amount - 0..1, where 1 is fully dissolved (transparent).
         */
        setDissolve: (amount) => {
            if (isDisposed) return;
            material.uniforms.dissolveAmount.value = clamp(amount, 0, 1);
        },
        /**
         * Sets vignette strength.
         * @param {number} strength - 0..1.
         */
        setVignetteStrength: (strength) => {
            if (isDisposed) return;
            material.uniforms.vignetteStrength.value = clamp(strength, 0, 1);
        },
        /**
         * Resizes the internal render target (should be called on window resize).
         * @param {number} width
         * @param {number} height
         */
        handleResize: (width, height) => {
            if (isDisposed) return;
            const dpr = Math.min(window.devicePixelRatio, 2);
            renderTarget.setSize(width * dpr, height * dpr);
        },
        /**
         * Disposes GPU resources owned by this helper.
         *
         * Callers should also remove `plane` from the scene before disposing.
         */
        dispose: () => {
            if (isDisposed) return;
            isDisposed = true;
            geometry.dispose();
            material.dispose();
            renderTarget.dispose();
        }
    };
}
