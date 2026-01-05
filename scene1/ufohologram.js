import * as THREE from "three";

export function createHologram(scene, camera, renderer) {
  // Function to create a new ring material with independent uniforms
  function createRingMaterial(color, radius) {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(color) },
        ringRadius: { value: radius },
        ringThickness: { value: 0.05 },
        glowStrength: { value: 0.3 },
        intensity: { value: 2 },
        time: { value: 0.0 },
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
                    float glow = smoothstep(ringRadius, ringRadius + glowStrength, dist);
                    glow = 1.0 - glow;
                    glow = pow(glow, intensity);
                    vec3 color = glowColor * glow + glowColor * ring;
                    float alpha = (dist < (ringRadius - ringThickness)) ? 0.0 : max(ring, glow * 0.5);
                    gl_FragColor = vec4(color, alpha);
                }
            `,
      transparent: true,
    });
  }

  // Plane Geometry
  const planeGeometry = new THREE.PlaneGeometry(4, 4);

  // Creating separate materials for each plane
  const discMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x00aaff) },
      coreRadius: { value: 0.3 },
      glowRadius: { value: 0.6 },
      intensity: { value: 2.5 },
      time: { value: 0.0 },
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
            uniform float coreRadius;
            uniform float glowRadius;
            uniform float intensity;
            varying vec2 vUv;

            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float dist = length(p);
                float core = 1.0 - smoothstep(coreRadius - 0.01, coreRadius, dist);
                float glow = smoothstep(coreRadius, glowRadius, dist);
                glow = 1.0 - glow;
                glow = pow(glow, intensity);
                vec3 color = glowColor * glow + glowColor * core;
                float alpha = max(core, glow * 0.6);
                gl_FragColor = vec4(color, alpha);
            }
        `,
    transparent: true,
  });

  const plane4 = new THREE.Mesh(planeGeometry, discMaterial);
  plane4.rotation.x = Math.PI / 2;
  plane4.position.y = -1.0;

  // Create separate materials for ring planes
  const ringMaterial1 = createRingMaterial(0x00aaff, 0.07); // much smaller radius
  const plane1 = new THREE.Mesh(planeGeometry, ringMaterial1);
  plane1.rotation.x = Math.PI / 2;
  plane1.position.y = -0.18;

  const ringMaterial2 = createRingMaterial(0x00aaff, 0.11); // much smaller radius
  const plane2 = new THREE.Mesh(planeGeometry, ringMaterial2);
  plane2.rotation.x = Math.PI / 2;
  plane2.position.y = -0.18;

  const rectShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x00aaff) },
      rectSize: { value: new THREE.Vector2(0.02, 0.01) },
      numRects: { value: 72 },
      radius: { value: 0.5 },
      time: { value: 0.001 },
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
            uniform float time;
            varying vec2 vUv;

            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                float angleStep = 6.28318 / float(numRects);
                float ring = 0.0;

                for (int i = 0; i < 72; i++) {
                    if (i >= numRects) break;
                    float angle = float(i) * angleStep + time;
                    vec2 rectCenter = vec2(cos(angle), sin(angle)) * radius;
                    mat2 rotationMatrix = mat2(
                        cos(angle), -sin(angle),
                        sin(angle), cos(angle)
                    );
                    vec2 rotatedUV = rotationMatrix * (uv - rectCenter);
                    rotatedUV = abs(rotatedUV);
                    float box = step(rotatedUV.x, rectSize.x) * step(rotatedUV.y, rectSize.y);
                    float softBox = smoothstep(0.02, 0.03, box);
                    ring += softBox;
                }

                vec3 color = glowColor * ring;
                gl_FragColor = vec4(color, ring);
            }
        `,
    transparent: true,
  });

  const rectPlane = new THREE.Mesh(planeGeometry, rectShaderMaterial);
  rectPlane.rotation.x = Math.PI / 2;
  rectPlane.position.y = -1.0;

  // Create uniforms
  let uniforms = {
    u_time: { value: 0.0 },
  };

  // Create ShaderMaterial
  let neonMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            precision mediump float;
            uniform float u_time;
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                if (vUv.y < 0.5) discard;
                vec3 neonBlue = vec3(0.0, 0.6, 1.2);  
                float glow = sin(u_time * 3.0) * 0.2 + 0.8;
                float edgeFade = smoothstep(1.0, 0.5, abs(vUv.y - 0.5) * 2.0);
                vec3 color = neonBlue * glow * edgeFade;
                gl_FragColor = vec4(color, 1.0);
            }
        `,
  });

  let geometry = new THREE.CylinderGeometry(2.0, 2.0, 16, 32, 1, true);
  let cylinder = new THREE.Mesh(geometry, neonMaterial);
  cylinder.position.y = -1.0;
  cylinder.rotation.x = Math.PI;

  // Number of particles
  const particleCount = 200;

  // Function to generate random points inside a cylinder
  function randomPointInCylinder(radius, height) {
    let angle = Math.random() * Math.PI * 2;
    let r = Math.sqrt(Math.random()) * radius;
    let x = Math.cos(angle) * r;
    let z = Math.sin(angle) * r;
    let y = (Math.random() - 0.5) * height;
    return new THREE.Vector3(x, y, z);
  }

  // Generate random positions inside the cylinder
  const positions = new Float32Array(particleCount * 3);
  const particleVectors = [];
  for (let i = 0; i < particleCount; i++) {
    let pos = randomPointInCylinder(1.7, 6); // increased radius for more spread
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    particleVectors.push(pos);
  }

  // Create buffer geometry for particles
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  // Particle ShaderMaterial
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0.0 },
    },
    vertexShader: `
            uniform float u_time;
            varying vec3 vColor;
            void main() {
                vec3 newPosition = position;
                float speed = 0.7; // faster movement
                float height = 6.0;
                // Animate particles moving upward, wrapping around
                newPosition.y = mod(position.y + u_time * speed + height * 0.5, height) - height * 0.5;
                vColor = vec3(0.0, 0.6, 1.2);
               
                // Calculate perspective scaling for consistent size
                vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
                gl_PointSize = 0.15 * (300.0 / -mvPosition.z); // even smaller particles
               
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
    fragmentShader: `
            precision mediump float;
            varying vec3 vColor;
            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                float alpha = smoothstep(0.5, 0.2, dist);
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.position.set(0, -10, 0);

  // Create a group to hold all hologram elements
  const hologramGroup = new THREE.Group();
  hologramGroup.add(plane4, plane1, plane2, rectPlane, cylinder, particles);

  // Add shader effects
  const shaderPositions = [
    [0, 0, 0],
    [0, -0.76, 0],
  ];

  shaderPositions.forEach((position, index) => {
    const geometry = new THREE.PlaneGeometry(8, 8);
    const uniforms = {
      time: { value: 0 },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      zoom: { value: 1.0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
      fragmentShader: `
                #ifdef GL_ES
                precision highp float;
                #endif

                uniform float time;
                uniform vec2 resolution;
                uniform float zoom;
                varying vec2 vUv;

                #define PI 3.1415926535

                mat2 rotate3d(float angle) {
                    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                }

                void main() {
                    vec2 p = (vUv * 2.0 - 1.0) * zoom;
                    p = rotate3d(time * 2.0 * PI) * p;
                   
                    float t = 0.075 / abs(0.4 - length(p));
                   
                    // vec3 color = 1.0 - exp(-vec3(t) * vec3(0.13 * (sin(time) + 12.0), abs(p.y) * 0.7, 3.0));
                    vec3 color = 1.0 - exp(-vec3(t) * vec3(0.01, 0.02, 0.8 * (sin(time) + 2.0)));
                    float alpha = smoothstep(0.0, 1.0, length(color) * 0.5);
                   
                    gl_FragColor = vec4(color, alpha);
                }
            `,
      uniforms: uniforms,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      depthWrite: false,
      depthTest: true,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(...position);
    plane.rotation.x = Math.PI / 2;

    // Add scale for the first position [0, 0, 0]
    if (index === 0) {
      plane.scale.set(3, 3, 3); // Increase scale by 50%
    }

    hologramGroup.add(plane);
  });

  // Scale the entire group
  hologramGroup.scale.set(1, 1, 1); // scale down for better fit

  // Center the hologram group so it attaches to the UFO base
  hologramGroup.position.set(0, -0.3, 0); // adjust Y to attach to UFO base
 
  // Return an object with update function and meshes
  const timeUniformMeshes = [];
  let cylinderMesh = null;
  let ringMeshes = [];

  hologramGroup.traverse(child => {
    if (child.isMesh && child.material && child.material.uniforms?.time) {
      timeUniformMeshes.push(child);
    }
    if (child.geometry?.type === 'CylinderGeometry') {
      cylinderMesh = child;
    }
    if (child.geometry?.type === 'RingGeometry') {
      ringMeshes.push(child);
    }
  });

  return {
    update: (delta) => {
      const elapsedTime = performance.now() * 0.0001;
      ringMaterial1.uniforms.time.value = elapsedTime;
      rectShaderMaterial.uniforms.time.value = elapsedTime;
      uniforms.u_time.value += delta;
      particleMaterial.uniforms.u_time.value += delta;

      // Update shader uniforms
      hologramGroup.children.forEach((child) => {
        if (
          child.material &&
          child.material.uniforms &&
          child.material.uniforms.time
        ) {
          child.material.uniforms.time.value += delta;
        }
      });
    },
    meshes: [hologramGroup],
    timeUniformMeshes,
    cylinderMesh,
    ringMeshes,
  };
}