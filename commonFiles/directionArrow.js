/**
 * ============================================
 * DIRECTION ARROW SHADER & CLASS
 * ============================================
 * Creates animated directional arrows to guide player movement.
 * Used for:
 * - Waypoint indicators
 * - Quest direction markers
 * - Visual navigation aids
 * 
 * Components:
 * - Fragment shader: Creates animated arrow visuals with glow
 * - Vertex shader: Applies standard 3D positioning
 * - DirectionArrow class: Manages arrow behavior and positioning
 * 
 * Features:
 * - Animated glowing arrows
 * - Smooth camera-facing orientation
 * - Multiple target position support
 * - Customizable colors and sizes
 */

import * as THREE from 'three';

export const arrowGlowEffect = `
precision highp float;

uniform float time;
uniform vec2 resolution;

varying vec2 vUv;

// Helper functions
float line(vec2 p, vec2 p0, vec2 p1, float w) {
    vec2 d = p1 - p0;
    float t = clamp(dot(d,p-p0) / dot(d,d), 0.0, 1.0);
    vec2 proj = p0 + d * t;
    float dist = length(p - proj);
    float weight = 57.0 / resolution.x;
    dist = 1.0/dist * weight * w;
    return min(dist*dist, 1.0);
}

vec3 hsv(float h, float s, float v) {
    vec4 t = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(vec3(h) + t.xyz) * 6.0 - vec3(t.w));
    return v * mix(vec3(t.x), clamp(p - vec3(t.x), 0.0, 1.0), s);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= resolution.x / resolution.y;
    
    vec3 color = vec3(0.0);
    float arrowSize = 0.07;
    
    for (float i = 0.0; i < 2.0; i++) {
        float xOffset = (i / 2.0) * 0.22 - 0.25;
        
        vec2 center = vec2(xOffset, 0.0);
        vec2 topPoint = center + vec2(-arrowSize, arrowSize);
        vec2 bottomPoint = center + vec2(-arrowSize, -arrowSize);
        
        float topLine = line(uv, center, topPoint, 0.3);
        float bottomLine = line(uv, center, bottomPoint, 0.3);
        
        float arrow = topLine + bottomLine;
        
        vec3 arrowColor = hsv(i / 2.0 - time * 0.1, 0.8, 1.0);
        float glow = 1.0 + 0.0 * sin(-time * 3.0 + i * 0.2);
        color += arrowColor * arrow * glow;
    }
    
    color *= 1.5;
    color = smoothstep(0.0, 1.0, color);
    
    gl_FragColor = vec4(color, 1.0);
}
`;

export const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export class DirectionArrow {
    constructor(targetPositions = []) {
        this.arrowMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: arrowGlowEffect,
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            side: THREE.DoubleSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        // Create a plane geometry for the arrow
        const geometry = new THREE.PlaneGeometry(5, 2);
        this.arrowPlane = new THREE.Mesh(geometry, this.arrowMaterial);
        
        // Store target positions
        this.triggerPositions = targetPositions.map(pos => 
            pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(pos.x, pos.y, pos.z)
        );
        
        // Current trigger index
        this.currentTriggerIndex = 0;
        
        // Trigger reached flag
        this.targetReached = false;
        
        // Create a group to handle positioning and rotation
        this.arrowGroup = new THREE.Group();
        this.arrowGroup.add(this.arrowPlane);
        
        // Position the plane within the group
        this.arrowPlane.position.set(0, -1.2, -0.2);
        this.arrowPlane.rotation.set(Math.PI / 2, 0, Math.PI / 2);

        // Trigger radius for detection
        this.triggerRadius = 2.0;

        // Smoothed follow position
        this._smoothedPosition = new THREE.Vector3();
    }

    // Method to manually set current trigger index
    setCurrentTrigger(index) {
        if (index >= 0 && index < this.triggerPositions.length) {
            this.currentTriggerIndex = index;
            this.targetReached = false;
            this.arrowGroup.visible = true;
        } else if (index >= this.triggerPositions.length) {
            // If index is beyond available triggers, hide the arrow
            this.arrowGroup.visible = false;
        }
    }

    // Method to get current target position
    getCurrentTarget() {
        return this.triggerPositions[this.currentTriggerIndex];
    }

    // Method to check if all targets have been reached
    areAllTargetsReached() {
        return this.currentTriggerIndex >= this.triggerPositions.length - 1 && this.targetReached;
    }

    // Method to set trigger radius
    setTriggerRadius(radius) {
        this.triggerRadius = radius;
    }

    // Method to update target positions
    setTargetPositions(positions) {
        this.triggerPositions = positions.map(pos => 
            pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(pos.x, pos.y, pos.z)
        );
        this.reset(); // Reset to first target
    }

    // Method to reset arrow to first trigger
    reset() {
        this.currentTriggerIndex = 0;
        this.targetReached = false;
        this.arrowGroup.visible = true;
    }

    // Internal update method
    _update(deltaTime, playerPosition, camera) {
        // If no targets, hide arrow
        if (this.triggerPositions.length === 0) {
            this.arrowGroup.visible = false;
            return;
        }

        // Check if player has reached current trigger
        if (this.checkTriggerReached(playerPosition)) {
            this.targetReached = true;
            this.arrowGroup.visible = false;
            
            // Move to next trigger if available
            if (this.currentTriggerIndex < this.triggerPositions.length - 1) {
                this.currentTriggerIndex++;
                this.targetReached = false;
                this.arrowGroup.visible = true;
            }
            return;
        }

        // Update shader time
        if (this.arrowMaterial.uniforms) {
            this.arrowMaterial.uniforms.time.value += deltaTime;
        }

        // Update arrow position to follow player with smoothing to avoid jitter
        const followFactor = 1 - Math.exp(-10 * deltaTime);
        if (this._smoothedPosition.lengthSq() === 0) {
            this._smoothedPosition.copy(playerPosition);
        }
        this._smoothedPosition.lerp(playerPosition, followFactor);
        this.arrowGroup.position.copy(this._smoothedPosition);

        // Get current target position
        const currentTarget = this.triggerPositions[this.currentTriggerIndex];

        // Calculate direction to target
        const directionToTarget = new THREE.Vector3();
        directionToTarget.subVectors(currentTarget, playerPosition);
        directionToTarget.y = 0; // Keep arrow parallel to ground

        // Calculate the angle between the direction vector and positive Z axis
        const angle = Math.atan2(directionToTarget.x, directionToTarget.z);

        // Smoothly rotate the arrow group to point towards the target
        const currentAngle = this.arrowGroup.rotation.y;
        const targetAngle = angle;
        
        // Calculate the shortest rotation path
        let angleDiff = targetAngle - currentAngle;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Smooth rotation using lerp
        const rotationSpeed = 5;
        this.arrowGroup.rotation.y += angleDiff * Math.min(deltaTime * rotationSpeed, 1);

        // Keep arrow horizontal
        this.arrowGroup.rotation.x = 0;
        this.arrowGroup.rotation.z = 0;

        // Always show the arrow if not reached
        this.arrowGroup.visible = !this.targetReached;
        this.arrowPlane.scale.setScalar(1);
    }

    // Internal method to check if trigger is reached
    checkTriggerReached(playerPosition) {
        const currentTarget = this.triggerPositions[this.currentTriggerIndex];
        const distance = playerPosition.distanceTo(currentTarget);
        return distance < this.triggerRadius;
    }

    // Internal method to update resolution
    _updateResolution(width, height) {
        if (this.arrowMaterial.uniforms) {
            this.arrowMaterial.uniforms.resolution.value.set(width, height);
        }
    }
}

// Global instance for scene management
let directionArrowInstance = null;

// Initialize direction arrow
export function initializeDirectionArrow(scene, triggerPositions) {
    if (!scene || !(scene instanceof THREE.Scene)) {
        console.error('Invalid scene provided to initializeDirectionArrow');
        return null;
    }
    
    // Create new instance if none exists
    if (!directionArrowInstance) {
        directionArrowInstance = new DirectionArrow(triggerPositions);
        directionArrowInstance.arrowGroup.add(directionArrowInstance.arrowPlane);
        scene.add(directionArrowInstance.arrowGroup);
    }
    
    return directionArrowInstance;
}

// Update direction arrow
export function updateDirectionArrow(delta, playerPosition, camera) {
    if (directionArrowInstance) {
        directionArrowInstance._update(delta, playerPosition, camera);
    }
}

// Cleanup direction arrow
export function cleanupDirectionArrow() {
    if (directionArrowInstance) {
        if (directionArrowInstance.arrowGroup) {
            directionArrowInstance.arrowGroup.parent?.remove(directionArrowInstance.arrowGroup);
        }
        if (directionArrowInstance.arrowMaterial) {
            directionArrowInstance.arrowMaterial.dispose();
        }
        if (directionArrowInstance.arrowPlane?.geometry) {
            directionArrowInstance.arrowPlane.geometry.dispose();
        }
        directionArrowInstance = null;
    }
} 