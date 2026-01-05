/**
 * ============================================
 * PORTAL & SCENE TRANSITION MODULE
 * ============================================
 * Handles scene transitions through portal interaction.
 * Creates visual portal effects and manages scene switching.
 * 
 * Components:
 * - Portal class: Creates animated portal visuals
 * - handlePortalSceneSwitch(): Scene transition logic
 * 
 * Features:
 * - Animated portal mesh with shader effects
 * - VR session handling
 * - Seamless scene transitions
 * - Asset checking and loading
 * - Proper cleanup of current scene
 * - VR session end support
 * 
 * Portal Animations:
 * - Swirling noise distortion
 * - Dynamic lighting effects
 * - Time-based shader uniforms
 * - Additive blending for glow effect
 */

import * as THREE from "three";
import { checkExistingAssets } from "./assetsLoader.js";

// Handles scene switching when player interacts with the portal
export function handlePortalSceneSwitch({
  renderer,
  nextEntry,
  initializeNextScene,
  cleanupCurrentScene,
  sceneInitialization,
  isSceneTransitioningRef,
  handleKeyPress,
}) {
  if (isSceneTransitioningRef.value) return;
  isSceneTransitioningRef.value = true;
  const session = renderer.xr.getSession();
  const transitionToNextScene = (isVR) => {
    window.removeEventListener("keydown", handleKeyPress);
    if (sceneInitialization) {      
      sceneInitialization.cleanUpCollider();
    }
    cleanupCurrentScene();
    checkExistingAssets(nextEntry);
    initializeNextScene(renderer, isVR).finally(() => {
      isSceneTransitioningRef.value = false;
    });
  };
  if (session) {
    session.end().then(() => {
      transitionToNextScene(true);
    }).catch(error => {
      console.error("Error ending VR session:", error);
      isSceneTransitioningRef.value = false;
    });
  } else {
    transitionToNextScene(false);
  }
}

export class Portal {
  constructor(
    scene,
    position = new THREE.Vector3(0, 0, 0),
    rotation = new THREE.Euler(0, Math.PI, 0),
    scale = 1.0
  ) {
    const circleGeometry = new THREE.CircleGeometry(2.5, 64);
    
    // Load portal texture directly from public folder
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('/scene11/portal.png');
    
    if (!texture) {
      console.error("Portal texture not found in public folder");
      return;
    }
    
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    const customShaderMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: texture },
      },
      vertexShader: `
              varying vec2 vUv;
              varying float vDistortion;
              void main() {
                  vUv = uv;
                  float angle = atan(position.y, position.x);
                  float radius = length(position.xy);
                  float distortion = sin(angle * 8.0 + uv.y * 5.0 + uv.x * 10.0) * 0.05;
                  vec3 displacedPosition = position + normal * distortion;
                  vDistortion = distortion;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
              }
          `,
      fragmentShader: `
              uniform sampler2D uTexture;
              uniform float uTime;
              varying vec2 vUv;
              varying float vDistortion;
              vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
              float snoise(vec2 v) {
                  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                                      -0.577350269189626, 0.024390243902439);
                  vec2 i  = floor(v + dot(v, C.yy) );
                  vec2 x0 = v -   i + dot(i, C.xx);
                  vec2 i1;
                  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                  vec4 x12 = x0.xyxy + C.xxzz;
                  x12.xy -= i1;
                  i = mod(i, 289.0);
                  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                      + i.x + vec3(0.0, i1.x, 1.0 ));
                  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                      dot(x12.zw,x12.zw)), 0.0);
                  m = m*m ;
                  m = m*m ;
                  vec3 x = 2.0 * fract(p * C.www) - 1.0;
                  vec3 h = abs(x) - 0.5;
                  vec3 ox = floor(x + 0.5);
                  vec3 a0 = x - ox;
                  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                  vec3 g;
                  g.x  = a0.x  * x0.x  + h.x  * x0.y;
                  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                  return 130.0 * dot(m, g);
              }
              void main() {
                  float noise = snoise(vUv * 6.0 + uTime * 0.4) * 0.2;
                  vec2 distortedUV = vUv + vec2(noise * 0.2, noise * 0.15);
                  vec4 texColor = texture2D(uTexture, distortedUV);
                  vec3 energyColor = vec3(0.2 + 0.5 * sin(uTime), 0.8, 1.2);
                  vec3 color = texColor.rgb * energyColor + vec3(noise * 0.3);
                  float alpha = (texColor.r + texColor.g + texColor.b) / 3.0;
                  alpha *= 1.2 + noise * 0.8;
                  alpha = pow(alpha, 2.0);
                  alpha = max(alpha, 0.35);
                  gl_FragColor = vec4(color, alpha);
              }
          `,
    });
    
    this.mesh = new THREE.Mesh(circleGeometry, customShaderMaterial);
    this.mesh.position.copy(position);
    this.mesh.rotation.copy(rotation);
    this.mesh.scale.setScalar(scale); // Apply scale to the portal mesh
    this.light = new THREE.PointLight(0x00ffff, 4, 15);
    this.light.position.copy(position);
    scene.add(this.mesh);
    scene.add(this.light);
    this.scene = scene;
  }
  
  update(time) {
    if (this.mesh && this.mesh.material) {
      this.mesh.material.uniforms.uTime.value = time;
      if (this.light) {
        this.light.intensity = 4 + Math.sin(time * 2) * 1.5;
        this.light.distance = 15 + Math.sin(time * 3) * 3;
      }
    }
  }
  
  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(mat => mat.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
      this.scene.remove(this.mesh);
    }
    if (this.light) {
      this.scene.remove(this.light);
    }
  }
}
