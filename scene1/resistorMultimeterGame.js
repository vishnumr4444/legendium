import * as THREE from 'three';
import { createResistorInstructionPanel } from './resistorInstructionPanel.js';


// Vertex shader for the glowing spheres
const glowVertexShader = `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDirection;

void main() {
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorldPos = worldPos.xyz;
	vWorldNormal = normalize(mat3(modelMatrix) * normal);
	vViewDirection = normalize(cameraPosition - vWorldPos);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader for the glowing spheres
const glowFragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 sphereColor;
uniform float glowIntensity;
uniform float stability; // 0.0 = very shaky, 1.0 = stable
uniform float brightness; // 0.0 = dull, 1.0 = bright
uniform float coreVisibility; // 0.0 = transparent core, 1.0 = solid core

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDirection;

void main() {
	vec3 N = normalize(vWorldNormal);
	vec3 V = normalize(vViewDirection);
	
	// Fresnel effect for glow
	float fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.0);
	
	// Stability factor - affects how much the sphere shakes
	float shake = (1.0 - stability) * 0.05 * sin(iTime * 10.0);
	
	// Core visibility - makes the sphere solid
	float core = coreVisibility * 0.7;
	
	// Brightness factor with subtle pulsing
	float pulse = 0.9 + 0.1 * sin(iTime * 2.0);
	float finalBrightness = brightness * pulse;
	
	// Combine effects
	float glow = (fresnel * glowIntensity + core) * finalBrightness + shake;
	
	// Output color with additive blending
	gl_FragColor = vec4(sphereColor * glow, 1.0);
}
`;

export function createGlowingSpheres(scene, renderer, options = {}) {
	const { position = new THREE.Vector3(0, 0, 0), rotation = new THREE.Euler(0, 0, 0), onAllStabilized = null, screenMeshes = [], instructionsPanelMesh = null } = options;

	const spheres = [];
	const displays = []; // Array to store display groups (containing needle, markings, and box)
	const sliders = []; // Array to store slider controls
	const needlePivotGroups = []; // Array to store needle pivot groups for rotation control
	let instructionPanel = null; // Instruction panel for game controls
	let hasTriggeredStabilized = false; // Track if stabilization callback has been called
	const PERFECT_THRESHOLD = 0.05; // Consider perfect if within 0.05 of 0

	// Base positions relative to the provided position
	const baseSpherePositions = [
		new THREE.Vector3(9, 12, -29),  // Stable and properly glowing
		new THREE.Vector3(11, 12, -29),  // Less dull
		new THREE.Vector3(13, 12, -29)   // Very bright and slightly shaky
	];

	// Apply the provided position offset to all sphere positions
	const spherePositions = baseSpherePositions.map(basePos => {
		const pos = basePos.clone();
		pos.add(position);
		return pos;
	});

	// Default needle positions for each sphere: [perfect, dull, overbright]
	const defaultNeedlePositions = [
		0,            // Upright position for perfect sphere (0°)    
		-Math.PI / 4,   // Left position for dull sphere (-45°)
		Math.PI / 4     // Right position for overbright sphere (+45°)
	];

	// Initial sphere states: [perfect, dull, overbright]
	const initialStates = [
		'perfect',  // First sphere starts perfect
		'dull',     // Second sphere starts dull
		'overbright' // Third sphere starts overbright
	];

	// All spheres are golden color
	const goldenColor = new THREE.Color(0xffd700); // Golden color
	const colors = [
		goldenColor,
		goldenColor,
		goldenColor
	];

	// Sphere properties: [glowIntensity, stability, brightness, coreVisibility]
	const sphereProperties = [
		[1.5, 1.0, 1.0, 0.8],   // Stable and properly glowing (more solid core)
		[0.8, 1.0, 0.6, 0.4],   // Less dull (increased glow and brightness)
		[3.0, 0.7, 2.0, 0.2]    // Very bright and slightly shaky
	];

	// Create three glowing spheres with different properties
	for (let i = 0; i < 3; i++) {
		const [glowIntensity, stability, brightness, coreVisibility] = sphereProperties[i];

		const uniforms = {
			iTime: { value: 0 },
			sphereColor: { value: colors[i] },
			glowIntensity: { value: glowIntensity },
			stability: { value: stability },
			brightness: { value: brightness },
			coreVisibility: { value: coreVisibility }
		};

		const material = new THREE.ShaderMaterial({
			vertexShader: glowVertexShader,
			fragmentShader: glowFragmentShader,
			uniforms,
			depthWrite: true,
			depthTest: true,
			transparent: true,
			blending: THREE.AdditiveBlending
		});

		const sphereGeometry = new THREE.SphereGeometry(0.5, 64, 64);
		const sphere = new THREE.Mesh(sphereGeometry, material);
		sphere.position.copy(spherePositions[i]);
		scene.add(sphere);

		// Set initial state flags
		const initialState = initialStates[i];
		sphere.isOverbright = (initialState === 'overbright');
		sphere.isDull = (initialState === 'dull');

		spheres.push({
			mesh: sphere,
			uniforms,
			color: colors[i],
			properties: sphereProperties[i],
			state: initialState
		});

		// Create a group for the entire display (box, needle, and markings)
		const displayGroup = new THREE.Group();

		// Create multimeter-style display panel
		const displayHeight = 1.2; // Increased height
		const displayGeometry = new THREE.BoxGeometry(1.5, displayHeight, 0.1);
		const displayMaterial = new THREE.MeshBasicMaterial({
			color: 0x111111, // Darker background
			transparent: true,
			opacity: 0.85
		});
		const displayBox = new THREE.Mesh(displayGeometry, displayMaterial);
		displayBox.position.z = -0.05; // Position within the group
		displayGroup.add(displayBox);

		// Add curved scale markings to the display
		// Create curved scale lines
		const scaleRadius = 0.6; // Radius of the curved scale
		const scaleCenterY = 0.0; // Center of the curve (relative to display)

		// Create 11 scale marks in a curved arc
		for (let j = -3; j <= 13; j++) {
			const angle = (j - 5) * 0.15; // Spread from -0.75 to 0.75 radians

			const scaleLineGeometry = new THREE.BoxGeometry(0.02, 0.1, 0.02);
			const scaleLineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
			const scaleLine = new THREE.Mesh(scaleLineGeometry, scaleLineMaterial);

			// Position the scale lines in a curve
			scaleLine.position.x = Math.sin(angle) * scaleRadius;
			scaleLine.position.y = scaleCenterY + (Math.cos(angle) - 1) * scaleRadius + (displayHeight / 2 - 0.25); // Adjust vertical position
			scaleLine.position.z = 0.01; // Slightly in front of display box

			// Rotate the scale lines to be perpendicular to the curve
			scaleLine.rotation.z = -angle;

			displayGroup.add(scaleLine);
		}

		// Add center marker (larger)
		const centerMarkerGeometry = new THREE.BoxGeometry(0.03, 0.15, 0.03);
		const centerMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red center marker
		const centerMarker = new THREE.Mesh(centerMarkerGeometry, centerMarkerMaterial);
		centerMarker.position.y = (displayHeight / 2 - 0.25); // Center position
		centerMarker.position.z = 0.01;
		displayGroup.add(centerMarker);

		// Create red needle indicator with pivot at bottom
		const needleHeight = 0.8; // Increased needle height
		const needleGeometry = new THREE.CylinderGeometry(0.01, 0.02, needleHeight, 8);
		const needleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color

		// Create a group for the needle to control the pivot point
		const needlePivotGroup = new THREE.Group();
		const needle = new THREE.Mesh(needleGeometry, needleMaterial);

		// Position needle within the group so it extends upward from the pivot point
		needle.position.y = needleHeight / 2; // Move needle up by half its height
		needlePivotGroup.add(needle);

		// Position the needle pivot group at the center bottom of the display
		needlePivotGroup.position.y = -(displayHeight / 2); // Center bottom of display
		needlePivotGroup.position.z = 0.02; // Slightly in front of markings

		// Set initial needle rotation based on sphere type
		needlePivotGroup.rotation.z = -defaultNeedlePositions[i]; // Negative because of Three.js coordinate system

		// Store needle pivot group for slider control
		needlePivotGroups.push(needlePivotGroup);

		displayGroup.add(needlePivotGroup);

		// Position the entire display group behind the sphere
		displayGroup.position.copy(spherePositions[i]);
		displayGroup.position.y += 1.2; // Increased position to move displays higher
		displayGroup.position.z -= 0.5; // Move behind the sphere/

		// Apply the provided rotation to the display group
		displayGroup.rotation.copy(rotation);

		scene.add(displayGroup);
		displays.push(displayGroup);

		// Create slider below the sphere (visual representation only)
		const sliderGroup = new THREE.Group();

		// Slider track
		const trackGeometry = new THREE.BoxGeometry(1.0, 0.05, 0.02);
		const trackMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
		const track = new THREE.Mesh(trackGeometry, trackMaterial);
		sliderGroup.add(track);

		// Slider handle
		const handleGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.05);
		const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green handle
		const handle = new THREE.Mesh(handleGeometry, handleMaterial);
		handle.position.x = 0; // Start in the center
		// handle.position.y = 0.05; // Slightly above the track
		sliderGroup.add(handle);

		// Position slider below the sphere
		sliderGroup.position.copy(spherePositions[i]);
		sliderGroup.position.y -= 2.6; // Position below the sphere
		sliderGroup.position.z -= 0.2; // Move behind the sphere
		// Apply the provided rotation to the slider group
		sliderGroup.rotation.copy(rotation);

		scene.add(sliderGroup);
		sliders.push({
			group: sliderGroup,
			handle: handle,
			needlePivot: needlePivotGroup,
			initialX: spherePositions[i].x,
			value: defaultNeedlePositions[i] / (Math.PI / 4) // Convert angle to -1 to 1 range
		});
	}

	// Use screen meshes from garden model if available
	// Mapping: display[0] -> screen2, display[1] -> screen, display[2] -> screen1
	if (screenMeshes && screenMeshes.length >= 3) {
		// Map display indices to screen mesh indices
		const displayToScreenMap = [2, 0, 1]; // display[0] -> screenMeshes[2] (screen2), display[1] -> screenMeshes[0] (screen), display[2] -> screenMeshes[1] (screen1)
		
		// Attach displays to the existing screen meshes in the garden model
		for (let i = 0; i < 3; i++) {
			const screenMeshIndex = displayToScreenMap[i];
			const screenMesh = screenMeshes[screenMeshIndex];

			// Position the display group relative to the screen mesh if found
			if (screenMesh && displays[i]) {
				// Remove the display from the scene temporarily
				scene.remove(displays[i]);

				// Add the display as a child of the screen mesh
				screenMesh.add(displays[i]);

				// Reset the display's transform to match the screen mesh
				displays[i].position.set(0, 0, 0);
				displays[i].rotation.set(0, 0, 0);
				displays[i].scale.set(1, 1, 1);

				// Position the display slightly in front of the screen
				// Move it down slightly to align with the screen (adjust Y position)
				displays[i].position.y = 0.01; // Adjust this value to align with the screen
				displays[i].position.z = 0.025; // Slightly in front of the screen

				displays[i].rotation.x = -Math.PI / 8;
				displays[i].scale.set(0.8, 0.75, 0.8);
			}
		}
	}

	// Create instruction panel and attach to instructionsPanel mesh if available
	if (instructionsPanelMesh) {
		// Create panel at origin (will be positioned relative to parent mesh)
		const panelPosition = new THREE.Vector3(0, 0, 0);
		const panelRotation = new THREE.Euler(0, 0, 0);
		
		instructionPanel = createResistorInstructionPanel(scene, panelPosition, panelRotation);
		
		// Attach panel to the instructionsPanel mesh
		if (instructionPanel && instructionPanel.container) {
			// Remove panel from scene temporarily
			scene.remove(instructionPanel.container);
			
			// Add panel as a child of the instructionsPanel mesh
			instructionsPanelMesh.add(instructionPanel.container);
			
			// Reset panel's transform to match the parent mesh
			instructionPanel.container.position.set(0, 0, 0);
			// Set rotation: Y axis 90 degrees, Z axis 90 degrees
			instructionPanel.container.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
			instructionPanel.container.scale.set(1, 1, 1);
			
			// Position panel slightly in front of the mesh (adjust as needed)
			instructionPanel.container.position.y = 0.31;
		}
	} else {
		// Fallback: create panel at default position if mesh not found
		const panelPosition = new THREE.Vector3(0, 0, 0);
		const panelRotation = new THREE.Euler(0, 0, 0);
		instructionPanel = createResistorInstructionPanel(scene, panelPosition, panelRotation);
	}

	// Update function for animation
	const update = (elapsedSeconds) => {
		spheres.forEach((sphere, index) => {
			sphere.uniforms.iTime.value = elapsedSeconds;

			// Only apply subtle shaking (no bouncing) to overbright spheres
			if (sphere.isOverbright) {
				// Add subtle shaking effect without vertical bouncing (only to the sphere)
				const shakeIntensity = 0.03;
				sphere.mesh.position.x = spherePositions[index].x + (Math.random() - 0.5) * shakeIntensity;
				sphere.mesh.position.y = spherePositions[index].y + (Math.random() - 0.5) * shakeIntensity;
				sphere.mesh.position.z = spherePositions[index].z + (Math.random() - 0.5) * shakeIntensity;
			}
		});

		// Update needle positions based on slider positions and adjust sphere properties
		sliders.forEach((slider, index) => {
			// Map slider value (-1 to 1) to needle angle (-45° to 45°)
			const angle = slider.value * (Math.PI / 4);
			// Update needle rotation
			slider.needlePivot.rotation.z = -angle;

			// Update handle position based on slider value
			slider.handle.position.x = slider.value * 0.45;

			// Update sphere properties based on needle position with smooth transitions
			const sphere = spheres[index];
			const absAngle = Math.abs(angle);

			// Use smooth interpolation based on angle for all properties
			// Perfect properties (angle = 0)
			const perfectGlow = 1.5;
			const perfectBrightness = 1.0;
			const perfectCore = 0.8;
			const perfectStability = 1.0;

			// Dull properties (angle < 0)
			const dullGlow = 0.8;
			const dullBrightness = 0.6;
			const dullCore = 0.4;
			const dullStability = 1.0;

			// Overbright properties (angle > 0)
			const overbrightGlow = 3.0;
			const overbrightBrightness = 2.0;
			const overbrightCore = 0.2;
			const overbrightStability = 0.7;

			if (angle >= 0) {
				// Transition from perfect to overbright
				// Map angle from 0 to π/4 to factor from 0 to 1
				const factor = Math.min(1, angle / (Math.PI / 4));

				// Set state flags
				sphere.isOverbright = factor > 0.7; // Become overbright when mostly there
				sphere.isDull = false;
				sphere.state = sphere.isOverbright ? 'overbright' : 'perfect';

				// Interpolate properties
				sphere.uniforms.glowIntensity.value = perfectGlow + factor * (overbrightGlow - perfectGlow);
				sphere.uniforms.brightness.value = perfectBrightness + factor * (overbrightBrightness - perfectBrightness);
				sphere.uniforms.coreVisibility.value = perfectCore + factor * (overbrightCore - perfectCore);
				sphere.uniforms.stability.value = perfectStability + factor * (overbrightStability - perfectStability);
			} else {
				// Transition from perfect to dull
				// Map angle from 0 to -π/4 to factor from 0 to 1
				const factor = Math.min(1, absAngle / (Math.PI / 4));

				// Set state flags
				sphere.isOverbright = false;
				sphere.isDull = factor > 0.7; // Become dull when mostly there
				sphere.state = sphere.isDull ? 'dull' : 'perfect';

				// Interpolate properties
				sphere.uniforms.glowIntensity.value = perfectGlow + factor * (dullGlow - perfectGlow);
				sphere.uniforms.brightness.value = perfectBrightness + factor * (dullBrightness - perfectBrightness);
				sphere.uniforms.coreVisibility.value = perfectCore + factor * (dullCore - perfectCore);
				sphere.uniforms.stability.value = perfectStability + factor * (dullStability - perfectStability);
			}
		});

		// Check if all three spheres are stabilized (all sliders at perfect position)
		if (!hasTriggeredStabilized && onAllStabilized) {
			const allPerfect = sliders.every(slider => Math.abs(slider.value) < PERFECT_THRESHOLD);
			if (allPerfect) {
				hasTriggeredStabilized = true;
				onAllStabilized();
			}
		}
	};

	// Keyboard controls for sliders
	let selectedSliderIndex = 0; // Initially select first slider

	// Function to select a slider (1, 2, 3 keys)
	const selectSlider = (index) => {
		if (index >= 0 && index < sliders.length) {
			// Change color of previously selected slider handle to green
			if (sliders[selectedSliderIndex]) {
				sliders[selectedSliderIndex].handle.material.color.set(0x00ff00);
			}
			// Change color of newly selected slider handle to yellow
			sliders[index].handle.material.color.set(0xffff00);
			// Update selected slider index
			selectedSliderIndex = index;
			console.log(`Selected slider ${index + 1}`);
			updateUI();
		}
	};

	// Function to cycle through sliders
	const cycleSlider = () => {
		let nextIndex = (selectedSliderIndex + 1) % sliders.length;
		selectSlider(nextIndex);
	};

	// Function to adjust selected slider
	const adjustSlider = (delta) => {
		if (sliders[selectedSliderIndex]) {
			// Adjust slider value within range -1 to 1
			sliders[selectedSliderIndex].value = Math.max(-1, Math.min(1, sliders[selectedSliderIndex].value + delta));
			console.log(`Slider ${selectedSliderIndex + 1} value: ${sliders[selectedSliderIndex].value.toFixed(2)}`);
			updateUI();
		}
	};

	// UI Elements
	let gameUI = null;

	const createGameUI = () => {
		gameUI = document.createElement('div');
		gameUI.style.position = 'fixed';
		gameUI.style.bottom = '100px';
		gameUI.style.right = '50px';
		gameUI.style.padding = '20px';
		gameUI.style.background = 'rgba(0, 0, 0, 0.8)';
		gameUI.style.border = '2px solid #00ff00';
		gameUI.style.borderRadius = '10px';
		gameUI.style.color = '#00ff00';
		gameUI.style.fontFamily = "'Orbitron', monospace";
		gameUI.style.zIndex = '1000';
		gameUI.style.display = 'none'; // Hidden by default
		gameUI.style.width = '250px';

		const title = document.createElement('div');
		title.textContent = 'RESISTOR CALIBRATION';
		title.style.fontSize = '16px';
		title.style.fontWeight = 'bold';
		title.style.marginBottom = '10px';
		title.style.textAlign = 'center';
		title.style.textShadow = '0 0 5px #00ff00';
		gameUI.appendChild(title);

		const instructions = document.createElement('div');
		instructions.style.fontSize = '12px';
		instructions.style.marginBottom = '15px';
		instructions.style.lineHeight = '1.5';
		instructions.innerHTML = `
            <div><span style="color: #ffff00">[TAB]</span> Cycle Resistor</div>
            <div><span style="color: #ffff00">[ARROWS]</span> Adjust Value</div>
            <div style="margin-top: 5px; color: #aaa;">Goal: Stabilize all spheres</div>
        `;
		gameUI.appendChild(instructions);

		const statusContainer = document.createElement('div');
		statusContainer.id = 'resistor-status-container';
		gameUI.appendChild(statusContainer);

		document.body.appendChild(gameUI);
		updateUI();
	};

	const updateUI = () => {
		if (!gameUI) return;
		const container = document.getElementById('resistor-status-container');
		if (!container) return;

		container.innerHTML = '';
		sliders.forEach((slider, i) => {
			const isSelected = i === selectedSliderIndex;
			const isPerfect = Math.abs(slider.value) < PERFECT_THRESHOLD;

			const row = document.createElement('div');
			row.style.display = 'flex';
			row.style.justifyContent = 'space-between';
			row.style.marginBottom = '5px';
			row.style.color = isSelected ? '#ffff00' : (isPerfect ? '#00ff00' : '#888');
			row.style.fontWeight = isSelected ? 'bold' : 'normal';

			const label = document.createElement('span');
			label.textContent = `R${i + 1}`;

			const valueBar = document.createElement('div');
			valueBar.style.width = '100px';
			valueBar.style.height = '8px';
			valueBar.style.background = '#333';
			valueBar.style.border = '1px solid #555';
			valueBar.style.position = 'relative';

			const indicator = document.createElement('div');
			indicator.style.position = 'absolute';
			indicator.style.left = `${(slider.value + 1) * 50}%`;
			indicator.style.top = '0';
			indicator.style.bottom = '0';
			indicator.style.width = '4px';
			indicator.style.background = isPerfect ? '#00ff00' : (isSelected ? '#ffff00' : '#888');
			indicator.style.transform = 'translateX(-50%)';

			const centerLine = document.createElement('div');
			centerLine.style.position = 'absolute';
			centerLine.style.left = '50%';
			centerLine.style.top = '0';
			centerLine.style.bottom = '0';
			centerLine.style.width = '1px';
			centerLine.style.background = '#fff';
			centerLine.style.opacity = '0.3';

			valueBar.appendChild(centerLine);
			valueBar.appendChild(indicator);

			row.appendChild(label);
			row.appendChild(valueBar);
			container.appendChild(row);
		});
	};

	const showUI = () => {
		if (gameUI) gameUI.style.display = 'block';
	};

	const hideUI = () => {
		if (gameUI) gameUI.style.display = 'none';
	};

	// Initialize UI
	createGameUI();

	// Expose functions for external control
	const controls = {
		selectSlider: selectSlider,
		cycleSlider: cycleSlider,
		adjustSlider: adjustSlider,
		showUI: showUI,
		hideUI: hideUI
	};

	// Dispose function to clean up resources
	const dispose = () => {
		if (gameUI) {
			document.body.removeChild(gameUI);
			gameUI = null;
		}

		spheres.forEach((sphere) => {
			scene.remove(sphere.mesh);
			sphere.mesh.geometry.dispose();
			sphere.mesh.material.dispose();
		});

		// Dispose displays (which contain all components)
		displays.forEach((displayGroup) => {
			scene.remove(displayGroup);
			// Dispose of all children in the display group
			displayGroup.traverse((child) => {
				if (child.isMesh) {
					child.geometry.dispose();
					child.material.dispose();
				}
			});
		});

		// Dispose sliders
		sliders.forEach((slider) => {
			scene.remove(slider.group);
			slider.handle.geometry.dispose();
			slider.handle.material.dispose();
			slider.group.children.forEach((child) => {
				if (child !== slider.handle) {
					child.geometry.dispose();
					child.material.dispose();
				}
			});
		});

		// Dispose instruction panel
		if (instructionPanel) {
			instructionPanel.dispose();
			instructionPanel = null;
		}
	};

	return {
		spheres,
		displays,
		sliders,
		controls, // Expose controls for external use
		update,
		dispose
	};
}