/**\n * ============================================
 * ENTRY EFFECT SHADER MODULE
 * ============================================
 * Creates elaborate entry/portal visual effects using shaders.
 * Used for:
 * - Scene entrance animations
 * - Character appearance effects
 * - Magical/technological portal visuals
 * 
 * Components:
 * - Ring materials: Expanding glow rings
 * - Rectangle shader: Orbital rectangular patterns
 * - Full animation sequence from zero to complete effect
 * 
 * Features:
 * - GPU-accelerated shader animations
 * - Multiple layered ring effects
 * - Customizable position, scale, and colors
 * - Returns animation control methods
 */

import * as THREE from 'three';

export function createEntryEffect(scene, position = new THREE.Vector3(0, 0, 0), scale = 1) {
    // Animation states
    let animationState = {
        hasAnimationPlayed: false,
        isEffectComplete: false
    };

    // Reuse plane geometry
    const planeGeometry = new THREE.PlaneGeometry(6 * scale, 6 * scale);

    // Shader material factory for rings
    const createRingMaterial = (color, radius) => new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(color) },
            ringRadius: { value: radius * scale },
            ringThickness: { value: 0.05 * scale },
            glowStrength: { value: 0.1 * scale },
            intensity: { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform float ringRadius;
            uniform float ringThickness;
            uniform float glowStrength;
            uniform float intensity;
            varying vec2 vUv;
            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float dist = length(p);
                float ring = smoothstep(ringRadius - ringThickness, ringRadius, dist) - 
                             smoothstep(ringRadius, ringRadius + ringThickness, dist);
                float glow = 1.0 - smoothstep(ringRadius, ringRadius + glowStrength, dist);
                glow = pow(glow, intensity);
                vec3 color = glowColor * (glow + ring);
                float alpha = dist < (ringRadius - ringThickness) ? 0.0 : max(ring, glow * 0.3);
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true
    });

    // Ring materials and planes
    const ringMaterials = [
        createRingMaterial(0x00FFFF, 0.8),
        createRingMaterial(0x00FFFF, 0.6),
        createRingMaterial(0x00FFFF, 0.4),
    ];

    const ringPlanes = ringMaterials.map((material, i) => {
        const plane = new THREE.Mesh(planeGeometry, material);
        plane.rotation.x = -Math.PI / 2;
        plane.position.copy(position);
        plane.position.y += i * 0.1 * scale;
        plane.visible = false;
        scene.add(plane);
        return plane;
    });

    // Rectangle shader material
    const rectShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(0x00FFFF) },
            rectSize: { value: new THREE.Vector2(0.06 * scale, 0.01 * scale) },
            numGroups: { value: 10 },
            radius: { value: 0.48 * scale },
            groupSpacing: { value: 0.2 * scale },
            intraGroupSpacing: { value: 0.01 * scale }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform vec2 rectSize;
            uniform int numGroups;
            uniform float radius;
            uniform float groupSpacing;
            uniform float intraGroupSpacing;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                float totalAngle = 6.28318;
                float groupAngleStep = totalAngle / float(numGroups);
                float baseAngleStep = groupAngleStep - groupSpacing;
                float rectAngleStep = baseAngleStep / 8.0;
                float ring = 0.0;
                for (int i = 0; i < 10; i++) {
                    if (i >= numGroups) break;
                    float groupAngle = float(i) * groupAngleStep;
                    for (int j = 0; j < 3; j++) {
                        float angle = groupAngle + float(j) * rectAngleStep;
                        vec2 pos = vec2(cos(angle), sin(angle)) * radius;
                        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                        vec2 rUv = rot * (uv - pos);
                        vec2 absUv = abs(rUv);
                        float box = step(absUv.x, rectSize.x) * step(absUv.y, rectSize.y);
                        ring += smoothstep(0.02, 0.03, box);
                    }
                }
                vec3 color = glowColor * ring;
                gl_FragColor = vec4(color, ring);
            }
        `,
        transparent: true
    });

    const rectShaderMaterial1 = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(0x00FFFF) },
            rectSize: { value: new THREE.Vector2(0.03 * scale, 0.04 * scale) },
            numRects: { value: 12 },
            radius: { value: 0.3 * scale }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform vec2 rectSize;
            uniform int numRects;
            uniform float radius;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                float angleStep = 6.28318 / float(numRects);
                float ring = 0.0;
                for (int i = 0; i < 12; i++) {
                    if (i >= numRects) break;
                    float angle = float(i) * angleStep;
                    vec2 pos = vec2(cos(angle), sin(angle)) * radius;
                    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                    vec2 rUv = rot * (uv - pos);
                    float box = step(abs(rUv.x), rectSize.x) * step(abs(rUv.y), rectSize.y);
                    ring += smoothstep(0.02, 0.03, box);
                }
                vec3 color = glowColor * ring;
                gl_FragColor = vec4(color, ring);
            }
        `,
        transparent: true
    });

    const rectPlane = new THREE.Mesh(planeGeometry, rectShaderMaterial);
    const rectPlane1 = new THREE.Mesh(planeGeometry, rectShaderMaterial1);
    rectPlane.rotation.x = -Math.PI / 2;
    rectPlane1.rotation.x = -Math.PI / 2;
    rectPlane.position.copy(position);
    rectPlane1.position.copy(position);
    rectPlane.position.y += 0.15 * scale;
    rectPlane1.position.y += 0.2 * scale;
    rectPlane.visible = false;
    rectPlane1.visible = false;
    scene.add(rectPlane);
    scene.add(rectPlane1);

    // Falling particles with comet-like effect
    const particleCount = 400;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.8 * scale;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = 2 * scale + Math.random() * 0.5 * scale;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        velocities[i] = (0.5 + Math.random() * 1) * scale;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            headColor: { value: new THREE.Color(0x00FFFF) },
            tailColor: { value: new THREE.Color(0x00FFFF) },
            pointSize: { value: 0.2 * scale },
            trailLength: { value: 50.0 * scale }
        },
        vertexShader: `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_PointSize = 40.0;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 headColor;
            uniform vec3 tailColor;
            uniform float pointSize;
            uniform float trailLength;
            varying vec3 vPosition;
            void main() {
                vec2 p = gl_PointCoord - vec2(0.5);
                float dist = length(p);
                float circle = 1.0 - smoothstep(pointSize * 0.3, pointSize * 0.5, dist);
                float trail = 1.0 - smoothstep(0.0, trailLength, p.y + 0.5);
                trail *= smoothstep(-0.5, -0.3, p.y);
                float trailWidth = mix(1.0, 0.1, trail);
                trail *= (1.0 - smoothstep(0.0, trailWidth * pointSize, abs(p.x)));
                vec3 color = mix(headColor, tailColor, trail);
                float intensity = max(circle * 2.5, trail * 2.0);
                color *= intensity;
                float alpha = clamp(intensity, 0.0, 1.0);
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particleGeometry, particleShaderMaterial);
    particles.position.copy(position);
    particles.position.y += 1 * scale;
    particles.visible = false;
    scene.add(particles);

    // Disc material for dark blue plane
    const discMaterial = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(0x000033) },
            neonColor: { value: new THREE.Color(0x00FFFF) },
            coreRadius: { value: 1.5 * scale },
            glowRadius: { value: 0.8 * scale },
            intensity: { value: 2.5 },
            time: { value: 0.0 },
            innerCutRadius: { value: 0.4 * scale }
        },
        vertexShader: `
            uniform float time;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                float angle = time * 1.0;
                mat2 rotationMatrix = mat2(
                    cos(angle), -sin(angle),
                    sin(angle), cos(angle)
                );
                vUv = rotationMatrix * (vUv - 0.5) + 0.5;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform vec3 neonColor;
            uniform float coreRadius;
            uniform float glowRadius;
            uniform float intensity;
            uniform float innerCutRadius;
            varying vec2 vUv;
            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float dist = length(p);
                float innerGlow = 1.0 - smoothstep(innerCutRadius - 0.02, innerCutRadius, dist);
                innerGlow = pow(innerGlow, 3.0);
                float core = 1.0 - smoothstep(coreRadius - 0.01, coreRadius, dist);
                float glow = smoothstep(coreRadius, glowRadius, dist);
                glow = 1.0 - glow;
                glow = pow(glow, intensity);
                vec3 color = mix(glowColor * glow + glowColor * core, neonColor, innerGlow);
                float alpha = max(core, glow * 0.6);
                alpha = max(alpha, innerGlow * 0.8);
                alpha *= step(dist, glowRadius);
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
    });

    const darkBluePlane = new THREE.Mesh(planeGeometry, discMaterial);
    darkBluePlane.rotation.x = -Math.PI / 2;
    darkBluePlane.position.copy(position);
    darkBluePlane.position.y -= 0.1 * scale;
    darkBluePlane.visible = false;
    scene.add(darkBluePlane);

    // Energy stream tube
    const tubeRadius = 0.1 * scale;
    const tubeHeight = 5 * scale;
    const tubeSegments = 32;
    const tubeGeometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeHeight, tubeSegments, 1, true);

    const tubeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            glowColor: { value: new THREE.Color(0x00ffff) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float time;
            uniform vec3 glowColor;
            void main() {
                float gradient = 1.0 - vUv.y;
                float pulse = 0.5 + 0.5 * sin(time * 5.0 + vUv.y * 10.0);
                float noise = sin(vUv.x * 20.0 + time * 2.0) * 0.1;
                float intensity = gradient * pulse + noise;
                vec3 color = glowColor * intensity;
                gl_FragColor = vec4(color, intensity * 0.8);
            }
        `,
        side: THREE.DoubleSide,
        transparent: true
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.copy(position);
    tube.position.y = tubeHeight / 2;
    tube.visible = false;
    // scene.add(tube);

    // Reset all elements to initial state
    const resetAnimation = () => {
        ringPlanes.forEach(plane => {
            plane.visible = false;
            plane.material.uniforms.intensity.value = 0;
        });
        rectPlane.visible = false;
        rectPlane1.visible = false;
        rectPlane.material.uniforms.glowColor.value.set(0x00FFFF);
        rectPlane1.material.uniforms.glowColor.value.set(0x00FFFF);
        particles.visible = false;
        darkBluePlane.visible = false;
        tube.visible = false;
        animationState.hasAnimationPlayed = false;
        animationState.isEffectComplete = false;
    };

    const animate = () => {
        if (!animationState.hasAnimationPlayed) return;
        
        const startTime = performance.now();
        const duration = 4000;
        
        const animateFrame = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Animate rings
            ringPlanes.forEach((plane, i) => {
                plane.visible = true;
                const intensity = Math.sin(progress * Math.PI) * 2;
                plane.material.uniforms.intensity.value = intensity;
            });

            // Animate rectangles
            rectPlane.visible = true;
            rectPlane1.visible = true;
            const rectIntensity = Math.sin(progress * Math.PI) * 2;
            rectPlane.material.uniforms.glowColor.value.setRGB(0, rectIntensity, rectIntensity);
            rectPlane1.material.uniforms.glowColor.value.setRGB(0, rectIntensity, rectIntensity);

            // Animate dark blue plane
            darkBluePlane.visible = true;
            darkBluePlane.material.uniforms.time.value = elapsed * 0.001;

            // Animate tube
            tube.visible = true;
            tube.material.uniforms.time.value = elapsed * 0.001;

            // Animate particles
            particles.visible = true;
            const positions = particles.geometry.attributes.position.array;
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3 + 1] -= velocities[i] * 0.02;
                if (positions[i * 3 + 1] < -2 * scale) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 0.8 * scale;
                    positions[i * 3] = Math.cos(angle) * radius;
                    positions[i * 3 + 1] = 2 * scale + Math.random() * 0.5 * scale;
                    positions[i * 3 + 2] = Math.sin(angle) * radius;
                }
            }
            particles.geometry.attributes.position.needsUpdate = true;
            
            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                animationState.isEffectComplete = true;
                resetAnimation();
            }
        };

        animateFrame();
    };

    // Return a function to trigger the animation
    return {
        trigger: () => {
            if (!animationState.hasAnimationPlayed) {
                resetAnimation();
                animationState.hasAnimationPlayed = true;
                animate();
            }
        },
        getPosition: () => position.clone()
    };
}
