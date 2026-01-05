import * as THREE from 'three';

export const holographicGlobeShader = {
    uniforms: {
        time: { value: 0 },
        glowColor: { value: new THREE.Color(0x00ffff) },
        glowIntensity: { value: 1.0 },
        glowPower: { value: 2.0 },
        glowSpeed: { value: 1.0 }
    },

    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vGlow;
        
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            // Calculate glow based on view angle
            vGlow = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,

    fragmentShader: `
        uniform float time;
        uniform vec3 glowColor;
        uniform float glowIntensity;
        uniform float glowPower;
        uniform float glowSpeed;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vGlow;
        
        void main() {
            // Calculate pulsing glow
            float pulse = sin(time * glowSpeed) * 0.5 + 0.5;
            float glow = pow(vGlow, glowPower) * glowIntensity * (0.5 + pulse * 0.5);
            
            // Only add glow to edges
            vec3 finalColor = glowColor * glow;
            
            gl_FragColor = vec4(finalColor, glow);
        }
    `
}; 