import * as THREE from 'three';

export const vertexShader = `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorldPos = worldPos.xyz;
	vWorldNormal = normalize(mat3(modelMatrix) * normal);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragmentShader = `
precision highp float;

uniform float iTime;
uniform samplerCube iChannel1;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

const float PI = 3.14159265359;

void main() {
	vec3 N = normalize(vWorldNormal);
	vec3 V = normalize(vWorldPos - cameraPosition);

	vec4 ballColor = vec4(1.0, 0.8, 0.0, 1.0) * 0.75;
	vec3 ref = reflect(-V, N);
	vec3 refr = refract(-V, N, 0.7);

	float rim = max(0.0, (0.7 + dot(N, V)));

	vec4 envRefract = textureCube(iChannel1, refr) * ballColor;
	vec4 envReflect = textureCube(iChannel1, ref) * 0.3;
	float center = clamp(dot(N, -V), 0.0, 1.0);
	float radial = smoothstep(0.6, 1.0, center);
	float pulse = mix(0.2, 1.0, abs(sin(iTime)));
	vec4 ring = vec4(0.6, 0.2, 0.0, 1.0) * radial * pulse * 2.0;
	vec4 starColor = vec4(0.0);

	vec4 color = envRefract + ring + starColor + envReflect + vec4(rim, rim * 0.5, 0.0, 1.0);
	gl_FragColor = vec4(color.rgb, 0.8);
}
`;

export function createShaderBall({ scene, renderer, controls, position = new THREE.Vector3(12, 12, -12), radius = 1, widthSegments = 64, heightSegments = 64 }) {
	const uniforms = {
		iTime: { value: 0 },
		iChannel1: { value: null },
	};

	const material = new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms,
		depthWrite: false,
		depthTest: true,
		transparent: true,
	});

	const sphereGeometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
	const sphere = new THREE.Mesh(sphereGeometry, material);
	sphere.position.copy(position);
	scene.add(sphere);

	const cubeRT = new THREE.WebGLCubeRenderTarget(128, {
		generateMipmaps: true,
		minFilter: THREE.LinearMipmapLinearFilter,
	});
	cubeRT.texture.colorSpace = THREE.SRGBColorSpace;
	const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRT);
	scene.add(cubeCamera);
	uniforms.iChannel1.value = cubeRT.texture;

	let needsReflectionUpdate = true;
	let rafScheduled = false;
	const requestReflectionUpdate = () => {
		needsReflectionUpdate = true;
	};

	if (controls) {
		controls.addEventListener('change', () => {
			if (!rafScheduled) {
				rafScheduled = true;
				requestAnimationFrame(() => {
					requestReflectionUpdate();
					rafScheduled = false;
				});
			}
		});
	}

	const intervalId = setInterval(() => {
		requestReflectionUpdate();
	}, 100);

	const update = (elapsedSeconds) => {
		uniforms.iTime.value = elapsedSeconds;
		if (needsReflectionUpdate) {
			const wasVisible = sphere.visible;
			sphere.visible = false;
			cubeCamera.position.copy(sphere.position);
			cubeCamera.update(renderer, scene);
			sphere.visible = wasVisible;
			needsReflectionUpdate = false;
		}
	};

	const dispose = () => {
		clearInterval(intervalId);
		sphere.geometry.dispose();
		material.dispose();
		cubeRT.dispose();
	};

	return {
		mesh: sphere,
		uniforms,
		update,
		requestReflectionUpdate,
		dispose,
	};
}
