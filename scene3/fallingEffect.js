/**
 * Falling / collapsing floor sequences for Scene 3.
 *
 * This module contains two related effects:
 *  - A legacy "cracking floor + debris and particles" fall sequence,
 *  - A newer cinematic "main falling sequence" that tightly follows the
 *    player and Electro as they fall into the underground section.
 *
 * Responsibilities:
 *  - Temporarily disabling all player and camera controls while falling
 *  - Spawning / updating debris, particles and crack visuals
 *  - Cleaning up all temporary objects and restoring controls afterwards
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import gsap from "gsap";
import { 
    togglePlayerControls, 
    disableCameraControls, 
    enableCameraControls, 
    enablePlayerControls, 
    hidePlayerModel, 
    showPlayerModel, 
    setCameraFollowsPlayer, 
    setCameraFocusOnPlayer,
    disablePlayerControls,
    setMovementEnabled,
    playerState,
    actionFalling
} from "../commonFiles/playerController.js";
import { disablePlayerMovement } from "../commonFiles/vrManager.js";

// ------------------------
// Legacy falling sequence
// ------------------------
// These variables power the original "cracking floor + debris + dust" effect.
let fallingPieces = [];          // Large angular chunks of floor / debris
let fallingParticles = [];       // Small dust and rubble meshes
let fallCharacter = null;        // Optional separate character used in older versions
let mixer = null;                // Optional AnimationMixer for legacy character
let fallAnimations = [];         // Legacy character animation clips
let fallVelocity = new THREE.Vector3();
let cameraOffset = new THREE.Vector3(0, 1.5, -2); // Legacy camera offset
let cracked = false;             // Has the floor visually cracked yet?
let exploded = false;            // Has the floor been fully broken into pieces?
let isFalling = false;           // Global flag: falling update loop active
let floor = null;                // Temporary procedural floor plane
let triggered = false;           // Prevents multiple triggers in older flow
let debrisGravity = 0.007;
let loader = new GLTFLoader();
let scene = null;
let camera = null;
let floorMesh = null;            // Original "polySurface998" mesh from GLTF
let crackMaterial = null;        // Overlay material used for visual crack decal
let floorPieces = [];            // Plane segments that fall away
let isFloorCollapsing = false;   // Are procedural floor pieces currently falling?
let nebulaParticles = [];        // Optional tunnel / nebula FX (currently disabled)
let portalEffect = null;
let isPortalActive = false;
let tunnelShaderMaterial = null;
let tunnelMesh = null;
let isTunnelActive = false;

// -------------------------------
// "Main" falling story sequence
// -------------------------------
// These variables are used by the newer, story-driven falling sequence that
// is triggered near the end of Scene 3 (see startMainFallingSequence).
let isMainFallingSequenceActive = false;
let mainFallingRocks = [];          // Larger debris with textures
let mainFallingDebris = [];         // Smaller metallic-ish debris pieces
let mainFallStartTime = 0;          // Timestamp used for timing, if needed
let mainIsShattering = false;       // True while the "floor is breaking" shot is active
let mainCrackedMeshes = new Set();  // Reserved for future per-mesh crack tracking
let mainShatteredPieces = [];       // Reserved for future shatter fragments
let mainOriginalMeshPositions = new Map(); // Original transforms for restoration
let mainCrackMaterial = null;       // Reserved for main crack overlay material

/**
 * Entry point for the legacy "cracking floor + procedural debris" effect.
 *
 * - Disables all player and camera controls
 * - Places a temporary floor in front of the camera
 * - Finds the GLTF floor mesh and generates crack geometry on top of it
 * - After a short delay, explodes the floor into falling pieces and dust
 *
 * @param {THREE.Scene} currentScene - Active Three.js scene
 * @param {THREE.Camera} currentCamera - Active camera
 * @param {Object} allAssets - Asset bundle for the scene (textures, models, etc.)
 * @param {THREE.Object3D} player - Player character mesh / capsule
 */
export function initializeFallingEffect(currentScene, currentCamera, allAssets, player) {
    scene = currentScene;
    camera = currentCamera;
    
    // Debug logging
    console.log("Initializing falling effect with assets:", allAssets);
    
    // Set global falling state
    window.isFalling = true;
    
    // Completely disable player controls
    if (player) {
        player.visible = true;
        disablePlayerControls();
        togglePlayerControls(false);
        disableCameraControls();
        setCameraFollowsPlayer(false);
        setCameraFocusOnPlayer(false);
    }
    
    // Add stronger lights to player for better visibility
    if (player) {
        // Remove any existing lights
        player.children.forEach(child => {
            if (child.isLight) {
                player.remove(child);
            }
        });
        
        // Add stronger spot light
        const playerLight1 = new THREE.SpotLight(0xffffff, 30);
        playerLight1.angle = Math.PI / 2;
        playerLight1.penumbra = 0.5;
        playerLight1.decay = 1;
        playerLight1.distance = 30;
        playerLight1.position.set(0, 5, 0);
        player.add(playerLight1);

        // Add stronger point light
        const playerLight2 = new THREE.PointLight(0xffffff, 20);
        playerLight2.position.set(0, 2, 0);
        playerLight2.distance = 20;
        player.add(playerLight2);
    }
    
    // Calculate the center position in front of camera
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    const centerPosition = new THREE.Vector3();
    centerPosition.copy(camera.position).add(cameraDirection.multiplyScalar(8));
    
    // Create enhanced tunnel effect at center position
    // createTunnelEffect(centerPosition);
    
    // Create enhanced nebula particles at center position
    // createNebulaParticles(centerPosition);
    
    // Find and process floor mesh
    scene.traverse((object) => {
        if (object.isMesh && object.name === "polySurface998") {
            floorMesh = object;
            console.log("Found floor mesh:", floorMesh);
            
            // Create floor pieces
            createFloorPieces(floorMesh);
            
            // Create crack material
            crackMaterial = new THREE.MeshStandardMaterial({
                color: 0x000000,
                roughness: 0.9,
                metalness: 0.1,
                emissive: new THREE.Color(0x000000),
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.8
            });
            
            // Create crack geometry
            createCrackEffect(floorMesh);
        }
    });
    
    // Create enhanced floor at center position
    const floorGeometry = new THREE.PlaneGeometry(15, 15, 30, 30);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555, 
        roughness: 1.0, 
        metalness: 0.1,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.8
    });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.copy(centerPosition);
    floor.receiveShadow = true;
    scene.add(floor);

  

    // Set initial camera position
    camera.position.set(0, 5, 0);
    if (player) {
        camera.lookAt(player.position);
    }

    // Trigger effects
    triggerCrackVisual();
    setTimeout(explodeFloor, 1500);
}

function triggerCrackVisual() {
    if (!floor) return;
    
    // Stronger crack effect
    const position = floor.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        let y = position.getY(i);
        position.setY(i, y - Math.random() * 0.5); // deeper crack
        position.setX(i, position.getX(i) + (Math.random() - 0.5) * 0.2); // horizontal fracture
        position.setZ(i, position.getZ(i) + (Math.random() - 0.5) * 0.2);
    }
    position.needsUpdate = true;
}

function explodeFloor() {
    if (!floor) return;
    
    cracked = true;
    scene.remove(floor);

    // Generate debris with random gaps
    const gridSize = 8;
    const spacing = 1.5;
    for (let x = -gridSize; x <= gridSize; x++) {
        for (let z = -gridSize; z <= gridSize; z++) {
            if (Math.random() < 0.4) { // 40% chance to spawn block
                createDebris(x * spacing, z * spacing);
            }
        }
    }

    spawnParticles();
    exploded = true;
    isFalling = true;

  
}





function createFloorPieces(mesh) {
    if (!mesh) return;
    
    // Get floor dimensions
    const geometry = mesh.geometry;
    const size = 1.5; // Larger pieces
    const width = 15; // Wider area
    const depth = 15; // Deeper area
    
    // Create pieces with more spacing
    for (let x = -width/2; x < width/2; x += size * 1.5) {
        for (let z = -depth/2; z < depth/2; z += size * 1.5) {
            if (Math.random() < 0.7) { // 70% chance to create piece
                const pieceGeometry = new THREE.PlaneGeometry(size, size);
                const pieceMaterial = new THREE.MeshStandardMaterial({
                    color: 0x888888,
                    roughness: 0.8,
                    metalness: 0.2,
                    flatShading: true
                });
                
                const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);
                piece.position.set(x, 0, z);
                piece.rotation.x = -Math.PI / 2;
                piece.castShadow = true;
                piece.receiveShadow = true;
                
                scene.add(piece);
                floorPieces.push({
                    mesh: piece,
                    velocity: new THREE.Vector3(0, 0, 0),
                    rotationSpeed: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.01,
                        (Math.random() - 0.5) * 0.01,
                        (Math.random() - 0.5) * 0.01
                    ),
                    delay: Math.random() * 3 // Longer delay
                });
            }
        }
    }
    
    // Remove original floor
    scene.remove(mesh);
    isFloorCollapsing = true;
}

function createDebris(x, z) {
    // Create angular debris shapes using random geometry
    let blockGeo;
    const shapeType = Math.random();
    
    if (shapeType < 0.4) {
        blockGeo = new THREE.BoxGeometry(
            Math.random() * 0.4 + 0.2, // Reduced size
            Math.random() * 0.3 + 0.1,
            Math.random() * 0.4 + 0.2
        );
    } else if (shapeType < 0.7) {
        blockGeo = new THREE.BoxGeometry(
            Math.random() * 0.5 + 0.2,
            Math.random() * 0.15 + 0.05,
            Math.random() * 0.5 + 0.2
        );
    } else {
        blockGeo = new THREE.OctahedronGeometry(
            Math.random() * 0.3 + 0.1,
            0
        );
    }

    // Create more visible material
    const blockMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(0x888888).offsetHSL(0, 0, (Math.random() - 0.5) * 0.2),
        roughness: Math.random() * 0.5 + 0.5,
        metalness: Math.random() * 0.3,
        flatShading: true,
        emissive: new THREE.Color(0x444444), // Increased emissive
        emissiveIntensity: 0.4 // Increased intensity
    });

    const block = new THREE.Mesh(blockGeo, blockMat);
    
    // Position debris in front of camera with consistent spacing
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    const debrisPosition = new THREE.Vector3();
    debrisPosition.copy(camera.position).add(cameraDirection.multiplyScalar(5)); // Reduced distance
    
    // Add random offset with smaller radius for tighter grouping
    const radius = Math.random() * 3; // Reduced from 6 to 3
    const angle = Math.random() * Math.PI * 2;
    debrisPosition.x += Math.cos(angle) * radius;
    debrisPosition.z += Math.sin(angle) * radius;
    debrisPosition.y = 10 + Math.random() * 5; // Reduced height range
    
    block.position.copy(debrisPosition);
    
    // Add random rotation for more natural look
    block.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );
    
    block.castShadow = true;
    block.receiveShadow = true;

    scene.add(block);

    // Add more controlled motion
    const speed = Math.random() * 0.2 + 0.1; // Reduced speed
    fallingPieces.push({
        mesh: block,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * speed,
            -Math.random() * 0.3 - 0.2,
            (Math.random() - 0.5) * speed
        ),
        rotationSpeed: new THREE.Vector3(
            Math.random() * 0.02,
            Math.random() * 0.02,
            Math.random() * 0.02
        )
    });
}

function spawnParticles() {
    // Create two types of particles: dust and small debris
    const dustCount = 2500; // Increased for more density
    const debrisCount = 600; // Increased for more variety
    
    // Create dust particles (smaller, more numerous)
    for (let i = 0; i < dustCount; i++) {
        const particleGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.02); // Changed to box for angular look
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x555555, // Darkened from 0xcccccc to prevent white blink
            transparent: true,
            opacity: 0.2 // Reduced from 0.4 to minimize accumulation effect
        });

        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position particles in front of camera with increased spacing
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);
        const particlePosition = new THREE.Vector3();
        particlePosition.copy(camera.position).add(cameraDirection.multiplyScalar(8));
        
        // Add random offset with larger radius
        const radius = Math.random() * 6 + 2;
        const angle = Math.random() * Math.PI * 2;
        particlePosition.x += Math.cos(angle) * radius;
        particlePosition.z += Math.sin(angle) * radius;
        particlePosition.y = 15 + Math.random() * 8;
        
        particle.position.copy(particlePosition);
        scene.add(particle);

        fallingParticles.push({
            mesh: particle,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                -Math.random() * 0.5 - 0.3,
                (Math.random() - 0.5) * 0.4
            )
        });
    }
    
    // Create small debris particles (slightly larger, fewer)
    for (let i = 0; i < debrisCount; i++) {
        // Mix of concrete chips and stone fragments
        const isStone = Math.random() > 0.4;
        let particleGeometry;
        let particleMaterial;
        
        if (isStone) {
            // Stone fragments with jagged edges
            particleGeometry = new THREE.OctahedronGeometry(0.04, 0);
            particleMaterial = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(0x666666).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15),
                roughness: 0.9,
                metalness: 0.0,
                flatShading: true
            });
        } else {
            // Concrete chunks with more angular geometry
            particleGeometry = new THREE.BoxGeometry(
                0.03 + Math.random() * 0.03,
                0.02 + Math.random() * 0.03,
                0.03 + Math.random() * 0.03
            );
            particleMaterial = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(0x777777).offsetHSL(0, 0, (Math.random() - 0.5) * 0.2),
                roughness: 0.95,
                metalness: 0.05,
                flatShading: true
            });
        }

        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position particles in front of camera with increased spacing
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);
        const particlePosition = new THREE.Vector3();
        particlePosition.copy(camera.position).add(cameraDirection.multiplyScalar(8));
        
        // Add random offset with larger radius
        const radius = Math.random() * 7 + 1;
        const angle = Math.random() * Math.PI * 2;
        particlePosition.x += Math.cos(angle) * radius;
        particlePosition.z += Math.sin(angle) * radius;
        particlePosition.y = 16 + Math.random() * 10;
        
        particle.position.copy(particlePosition);
        particle.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        scene.add(particle);

        fallingParticles.push({
            mesh: particle,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                -Math.random() * 0.6 - 0.35,
                (Math.random() - 0.5) * 0.5
            ),
            rotationSpeed: new THREE.Vector3(
                Math.random() * 0.03,
                Math.random() * 0.03,
                Math.random() * 0.03
            )
        });
    }
}



/**
 * Main per-frame update for the legacy falling effect.
 *
 * Responsibilities:
 *  - Keeps all player & camera controls disabled
 *  - Updates procedural crack nebula, floor pieces, debris blocks and particles
 *  - Recycles objects when they pass below a threshold so the effect can loop
 *
 * @param {number} delta - Frame delta time (in seconds)
 * @param {THREE.Object3D} player - Player mesh / capsule to anchor the camera to
 */
export function updateFallingEffect(delta, player) {
    if (!isFalling) return;

    // Properly disable ALL player controls
    if (player) {
        // Disable player movement and controls
        disablePlayerControls(); // This resets all movement states and stops animations
        togglePlayerControls(false); // This prevents key events from being processed
        setMovementEnabled(false); // This disables the movement system entirely
        
        // Disable camera controls
        disableCameraControls(); // This disables camera controls
        setCameraFollowsPlayer(false); // This prevents camera from following player
        setCameraFocusOnPlayer(false); // This prevents camera from focusing on player
        
        // Reset player state
        playerState.velocity.set(0, 0, 0);
        playerState.fwdPressed = false;
        playerState.bkdPressed = false;
        playerState.lftPressed = false;
        playerState.rgtPressed = false;
        playerState.shiftPressed = false;
        
        // Stop any ongoing animations
        if (player.userData && player.userData.mixer) {
            player.userData.mixer.stopAllAction();
        }
    }

    // Update center position based on camera
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    const centerPosition = new THREE.Vector3();
    centerPosition.copy(camera.position).add(cameraDirection.multiplyScalar(8));

    // Update nebula particles - make them fall straight down
    nebulaParticles.forEach(nebula => {
        const positions = nebula.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            // Only update Y position for downward fall with consistent speed
            positions[i + 1] += delta * 5; // Increased speed for more dramatic effect
            
            // Reset particles that fall too far
            if (positions[i + 1] > 50) {
                // Reset to random position above
                const radius = Math.random() * 4;
                const angle = Math.random() * Math.PI * 2;
                positions[i] = centerPosition.x + Math.cos(angle) * radius;
                positions[i + 1] = centerPosition.y - 150; // Start from above
                positions[i + 2] = centerPosition.z + Math.sin(angle) * radius;
            }
        }
        nebula.geometry.attributes.position.needsUpdate = true;
    });

    // Update floor pieces
    if (isFloorCollapsing) {
        floorPieces.forEach((piece, index) => {
            if (piece.delay > 0) {
                piece.delay -= delta;
                return;
            }
            
            // Apply gravity
            piece.velocity.y -= 0.005;
            
            // Update position
            piece.mesh.position.add(piece.velocity.clone().multiplyScalar(delta * 3));
            
            // Update rotation
            piece.mesh.rotation.x += piece.rotationSpeed.x;
            piece.mesh.rotation.y += piece.rotationSpeed.y;
            piece.mesh.rotation.z += piece.rotationSpeed.z;
            
            // Remove pieces that fall too far
            if (piece.mesh.position.y < -20) {
                scene.remove(piece.mesh);
                floorPieces.splice(index, 1);
            }
        });
    }

    // Keep camera static during falling
    if (player) {
        player.visible = true;
        const targetPosition = new THREE.Vector3(
            player.position.x,
            player.position.y + 5,
            player.position.z + 5
        );

        // Keep camera position fixed
        camera.position.copy(targetPosition);
        camera.lookAt(player.position);
    }

    // Update falling pieces to fall straight down
    fallingPieces.forEach((piece) => {
        // Apply gravity
        piece.velocity.y -= 0.005;
        
        // Update position with straight downward motion
        piece.mesh.position.add(piece.velocity.clone().multiplyScalar(delta * 3));
        piece.mesh.rotation.x += piece.rotationSpeed.x;
        piece.mesh.rotation.y += piece.rotationSpeed.y;
        piece.mesh.rotation.z += piece.rotationSpeed.z;

        // Regenerate blocks that fall below
        if (piece.mesh.position.y < -10) {
            const radius = Math.random() * 6;
            const angle = Math.random() * Math.PI * 2;
            
            piece.mesh.position.set(
                centerPosition.x + Math.cos(angle) * radius,
                centerPosition.y + 50 + Math.random() * 20,
                centerPosition.z + Math.sin(angle) * radius
            );
            
            // Set velocity to fall straight down
            piece.velocity.set(
                0,
                -Math.random() * 0.2 - 0.1,
                0
            );
        }
    });

    // Update particles to fall straight down
    fallingParticles.forEach((particle) => {
        // Apply gravity
        particle.velocity.y -= 0.005;
        
        // Update position with straight downward motion
        particle.mesh.position.add(particle.velocity.clone().multiplyScalar(delta * 3));

        // Regenerate particles that fall below
        if (particle.mesh.position.y < -10) {
            const radius = Math.random() * 6;
            const angle = Math.random() * Math.PI * 2;
            
            particle.mesh.position.set(
                centerPosition.x + Math.cos(angle) * radius,
                centerPosition.y + 50 + Math.random() * 20,
                centerPosition.z + Math.sin(angle) * radius
            );
            particle.velocity.y = -Math.random() * 0.2 - 0.1;
        }
    });

    if (Math.random() < 0.05) spawnDebrisNearCharacter(centerPosition);
    if (Math.random() < 0.1) spawnParticleNearCharacter(centerPosition);

    if (mixer) mixer.update(delta);
}

function spawnDebrisNearCharacter(centerPosition) {
    if (!fallCharacter) return;
    
    // Create angular debris shapes
    let blockGeo;
    const shapeType = Math.random();
    
    if (shapeType < 0.4) {
        blockGeo = new THREE.BoxGeometry(
            Math.random() * 0.4 + 0.2,
            Math.random() * 0.3 + 0.1,
            Math.random() * 0.4 + 0.2
        );
    } else if (shapeType < 0.7) {
        blockGeo = new THREE.BoxGeometry(
            Math.random() * 0.5 + 0.2,
            Math.random() * 0.15 + 0.05,
            Math.random() * 0.5 + 0.2
        );
    } else {
        blockGeo = new THREE.OctahedronGeometry(
            Math.random() * 0.3 + 0.1,
            0
        );
    }
    
    const blockMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(0x888888).offsetHSL(0, 0, (Math.random() - 0.5) * 0.2),
        roughness: Math.random() * 0.5 + 0.5,
        metalness: Math.random() * 0.3,
        flatShading: true,
        emissive: new THREE.Color(0x222222),
        emissiveIntensity: 0.2
    });
    
    const block = new THREE.Mesh(blockGeo, blockMat);

    // Position debris near center
    const radius = Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    block.position.set(
        centerPosition.x + Math.cos(angle) * radius,
        centerPosition.y + 10 + Math.random() * 8,
        centerPosition.z + Math.sin(angle) * radius
    );
    
    block.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );
    
    block.castShadow = true;
    scene.add(block);

    fallingPieces.push({
        mesh: block,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            Math.random() * 1.2,
            (Math.random() - 0.5) * 0.8
        ),
        rotationSpeed: new THREE.Vector3(
            Math.random() * 0.1,
            Math.random() * 0.1,
            Math.random() * 0.1
        )
    });
}

function spawnParticleNearCharacter(centerPosition) {
    if (!fallCharacter) return;
    
    const particleGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xcccccc,
        transparent: true,
        opacity: 0.4
    });

    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Position particles near center
    const radius = Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    particle.position.set(
        centerPosition.x + Math.cos(angle) * radius,
        centerPosition.y + 10 + Math.random() * 8,
        centerPosition.z + Math.sin(angle) * radius
    );
    
    scene.add(particle);

    fallingParticles.push({
        mesh: particle,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
        )
    });
}

/**
 * Fully tears down the legacy falling effect and restores:
 *  - Player & camera controls
 *  - Scene state (removes temporary floor, particles, debris, tunnel, nebula)
 *
 * This should be called before transitioning to another scene or sequence.
 */
export function cleanupFallingEffect() {
    // Reset global falling state
    window.isFalling = false;
    
    // Re-enable player controls
    if (camera && camera.userData && camera.userData.controls) {
        camera.userData.controls.enabled = true;
    }
    
    // Re-enable player movement
    enablePlayerControls();
    togglePlayerControls(true);
    enableCameraControls();
    setCameraFollowsPlayer(true);
    setCameraFocusOnPlayer(true);
    
    // Clean up floor
    if (floor) {
        if (scene) {
            scene.remove(floor);
        }
        if (floor.geometry) {
            floor.geometry.dispose();
        }
        if (floor.material) {
            if (Array.isArray(floor.material)) {
                floor.material.forEach(material => material.dispose());
            } else {
                floor.material.dispose();
            }
        }
        floor = null;
    }
    
   
    
    // Clean up falling pieces
    fallingPieces.forEach(piece => {
        if (piece.mesh) {
            if (scene) {
                scene.remove(piece.mesh);
            }
            if (piece.mesh.geometry) {
                piece.mesh.geometry.dispose();
            }
            if (piece.mesh.material) {
                if (Array.isArray(piece.mesh.material)) {
                    piece.mesh.material.forEach(material => material.dispose());
                } else {
                    piece.mesh.material.dispose();
                }
            }
        }
    });
    fallingPieces = [];
    
    // Clean up falling particles
    fallingParticles.forEach(particle => {
        if (particle.mesh) {
            if (scene) {
                scene.remove(particle.mesh);
            }
            if (particle.mesh.geometry) {
                particle.mesh.geometry.dispose();
            }
            if (particle.mesh.material) {
                if (Array.isArray(particle.mesh.material)) {
                    particle.mesh.material.forEach(material => material.dispose());
                } else {
                    particle.mesh.material.dispose();
                }
            }
        }
    });
    fallingParticles = [];
    
    // Clean up tunnel effect
    if (tunnelMesh) {
        if (scene) {
            scene.remove(tunnelMesh);
        }
        if (tunnelMesh.geometry) {
            tunnelMesh.geometry.dispose();
        }
        if (tunnelMesh.material) {
            tunnelMesh.material.dispose();
        }
        tunnelMesh = null;
    }
    
    // Clean up nebula particles
    nebulaParticles.forEach(nebula => {
        if (scene) {
            scene.remove(nebula);
        }
        if (nebula.geometry) {
            nebula.geometry.dispose();
        }
        if (nebula.material) {
            nebula.material.dispose();
        }
    });
    nebulaParticles = [];
    
    // Clean up floor pieces
    floorPieces.forEach(piece => {
        if (piece.mesh) {
            if (scene) {
                scene.remove(piece.mesh);
            }
            if (piece.mesh.geometry) {
                piece.mesh.geometry.dispose();
            }
            if (piece.mesh.material) {
                if (Array.isArray(piece.mesh.material)) {
                    piece.mesh.material.forEach(material => material.dispose());
                } else {
                    piece.mesh.material.dispose();
                }
            }
        }
    });
    floorPieces = [];
    
    // Reset state variables
    isFalling = false;
    cracked = false;
    exploded = false;
    triggered = false;
    isFloorCollapsing = false;
    isTunnelActive = false;
    
    // Clear references
    scene = null;
    camera = null;
    floorMesh = null;
    if (crackMaterial) {
        crackMaterial.dispose();
        crackMaterial = null;
    }
}

function createCrackEffect(mesh) {
    if (!mesh) return;
    
    // Store original geometry
    const originalGeometry = mesh.geometry.clone();
    const positions = originalGeometry.attributes.position.array;
    
    // Create crack pattern
    const center = new THREE.Vector3();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getCenter(center);
    
    // Create crack lines
    const crackLines = [];
    const numCracks = 10;
    
    for (let i = 0; i < numCracks; i++) {
        const angle = (i / numCracks) * Math.PI * 2;
        const length = 2 + Math.random() * 3;
        const startPoint = new THREE.Vector3(
            center.x + Math.cos(angle) * 0.5,
            center.y,
            center.z + Math.sin(angle) * 0.5
        );
        
        const endPoint = new THREE.Vector3(
            center.x + Math.cos(angle) * length,
            center.y,
            center.z + Math.sin(angle) * length
        );
        
        crackLines.push({ start: startPoint, end: endPoint });
    }
    
    // Modify vertices to create crack effect
    for (let i = 0; i < positions.length; i += 3) {
        const vertex = new THREE.Vector3(
            positions[i],
            positions[i + 1],
            positions[i + 2]
        );
        
        // Check distance to each crack line
        let minDistance = Infinity;
        crackLines.forEach(line => {
            const distance = distanceToLine(vertex, line.start, line.end);
            minDistance = Math.min(minDistance, distance);
        });
        
        // Create crack effect based on distance
        if (minDistance < 0.5) {
            // Lower vertices near crack
            positions[i + 1] -= (0.5 - minDistance) * 0.2;
            
            // Add random variation
            positions[i] += (Math.random() - 0.5) * 0.1;
            positions[i + 2] += (Math.random() - 0.5) * 0.1;
        }
    }
    
    // Update geometry
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    
    // Create crack overlay
    const crackOverlay = new THREE.Mesh(
        mesh.geometry.clone(),
        crackMaterial
    );
    crackOverlay.position.copy(mesh.position);
    crackOverlay.rotation.copy(mesh.rotation);
    crackOverlay.scale.copy(mesh.scale);
    scene.add(crackOverlay);
    
    // Animate crack
    gsap.to(crackOverlay.material, {
        opacity: 1,
        duration: 1,
        ease: "power2.inOut"
    });
}

function distanceToLine(point, lineStart, lineEnd) {
    const line = new THREE.Vector3().subVectors(lineEnd, lineStart);
    const lineLength = line.length();
    line.normalize();
    
    const pointToStart = new THREE.Vector3().subVectors(point, lineStart);
    const dot = pointToStart.dot(line);
    
    if (dot <= 0) return pointToStart.length();
    if (dot >= lineLength) return point.distanceTo(lineEnd);
    
    const projection = new THREE.Vector3().copy(line).multiplyScalar(dot);
    const closestPoint = new THREE.Vector3().addVectors(lineStart, projection);
    
    return point.distanceTo(closestPoint);
}

// Modify the startFadeOut function to keep interior model visible


/**
 * Starts the story-driven main falling sequence.
 *
 * What this does:
 *  - Softens / fades the GLTF floor ("polySurface998") and spawns a break overlay
 *  - Forces the player's "falling" animation if available (via `actionFalling`)
 *  - Aligns Electro near the player so they fall together
 *  - Spawns textured concrete rocks and debris around the player
 *  - Starts a custom animation loop (`fallAnimation`) using `requestAnimationFrame`
 *    that continuously moves the player, Electro, camera and debris.
 *
 * NOTE: This function intentionally maintains its own animation loop, separate
 * from the main Scene 3 `render()` loop, because it manages camera/player motion
 * in a self-contained cinematic.
 *
 * @param {THREE.Scene} scene - Active scene (used to find floor and add debris)
 * @param {THREE.Camera} camera - Active camera (will be driven by the sequence)
 * @param {THREE.Object3D} player - Player character
 * @param {THREE.Object3D} electroCharacter - Electro character model, if present
 */
export function startMainFallingSequence(scene, camera, player, electroCharacter) {
  if (!scene || !camera || !player) return;
  
  console.log("Starting main falling sequence from fallingEffect.js");
  
  isMainFallingSequenceActive = true;
  mainIsShattering = true;
  mainFallStartTime = performance.now();
  
  // Find the player and collision mesh
  if (player) {
    console.log("Found player, starting main fall sequence");
    
    // Make floor mesh transparent and break it
    scene.traverse((object) => {
      if (object.isMesh && object.name === "polySurface998") {
        if (object.material) {
          // Make material transparent
          object.material.transparent = true;
          object.material.opacity = 0.3;
          object.material.depthWrite = false;
          object.material.needsUpdate = true;
          
          // Create breaking effect
          const breakGeometry = object.geometry.clone();
          const breakMaterial = new THREE.MeshStandardMaterial({
            color: 0x4B2A0A,
            roughness: 1.0,
            metalness: 0.0,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
          });
          
          const breakMesh = new THREE.Mesh(breakGeometry, breakMaterial);
          breakMesh.position.copy(object.position);
          breakMesh.rotation.copy(object.rotation);
          breakMesh.scale.copy(object.scale);
          scene.add(breakMesh);
          
          // Animate breaking effect
          gsap.to(breakMesh.scale, {
            x: 0.95,
            y: 0.95,
            z: 0.95,
            duration: 0.5,
            ease: "power2.inOut"
          });
          
          gsap.to(breakMesh.material, {
            opacity: 0,
            duration: 1,
            delay: 0.5,
            ease: "power2.inOut",
            onComplete: () => {
              scene.remove(breakMesh);
            }
          });
        }
      }
    });
    
    // Ensure player is visible
    scene.traverse((object) => {
      if (object.name === "playerCapsule" || 
          (object.parent && object.parent.name === "playerCapsule") ||
          object.name === "player" ||
          (object.parent && object.parent.name === "player")) {
        object.visible = true;
        if (object.isLight) {
          object.intensity = 1;
        }
      }
    });

    // Start falling animation for the player
    if (actionFalling) {
      console.log("Starting falling animation for player using actionFalling");
      actionFalling.reset();
      actionFalling.setLoop(THREE.LoopRepeat);
      actionFalling.clampWhenFinished = false;
      actionFalling.fadeIn(0.5).play();
      
      // Store the action in player userData for reference
      if (player.userData) {
        player.userData.currentAction = actionFalling;
      }
    } else if (player.userData && player.userData.mixer) {
      // Fallback: try to find any falling-related animation
      const animations = player.userData.animations || [];
      const fallingAnim = animations.find(anim => 
        anim.name.toLowerCase().includes('fall') || 
        anim.name.toLowerCase().includes('falling') ||
        anim.name.toLowerCase().includes('jump')
      );
      
      if (fallingAnim) {
        console.log("Found fallback falling animation:", fallingAnim.name);
        const action = player.userData.mixer.clipAction(fallingAnim);
        action.reset();
        action.setLoop(THREE.LoopRepeat);
        action.clampWhenFinished = false;
        action.fadeIn(0.5).play();
        
        // Store the action in player userData for reference
        if (player.userData) {
          player.userData.currentAction = action;
        }
      } else {
        console.warn("No falling animation found for player");
      }
    }

    // Position Electro next to player if it exists
    if (electroCharacter) {
      electroCharacter.visible = true;
      electroCharacter.position.set(
        player.position.x + 1, // Slightly to the right of player
        player.position.y,
        player.position.z
      );
      electroCharacter.rotation.set(0, Math.PI / 2, 0); // Face towards player
    }

    // Store original positions
    const originalCameraY = camera.position.y;
    const originalPlayerY = player.position.y;
    
    // Create arrays to store falling objects
    const fallingRocks = [];
    const fallingDebris = [];
    
    // Function to create a falling rock
    const textureLoader = new THREE.TextureLoader();
    const concreteTexture = textureLoader.load('/scene33/concrete_diff.jpg');
    const concreteNormal = textureLoader.load('/scene33/concrete_nor.jpg');
    
    const createFallingRock = () => {
      // Randomly pick a debris type
      const type = Math.floor(Math.random() * 3); // 0 = brick, 1 = chunk, 2 = cylinder
      
      let rockGeometry;
      
      if (type === 0) {
        // Brick-like block
        rockGeometry = new THREE.BoxGeometry(
          Math.random() * 0.6 + 0.3, // width
          Math.random() * 0.2 + 0.1, // height
          Math.random() * 0.3 + 0.15 // depth
        );
      } else if (type === 1) {
        // Irregular chunk (distorted box)
        rockGeometry = new THREE.BoxGeometry(
          Math.random() * 0.5 + 0.2,
          Math.random() * 0.5 + 0.2,
          Math.random() * 0.5 + 0.2
        );
        // Add some jitter to vertices for broken effect
        const pos = rockGeometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.1);
          pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.1);
          pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.1);
        }
        rockGeometry.computeVertexNormals();
      } else {
        // Broken cylindrical piece (like concrete pillar)
        rockGeometry = new THREE.CylinderGeometry(
          Math.random() * 0.2 + 0.1, // radiusTop
          Math.random() * 0.3 + 0.15, // radiusBottom
          Math.random() * 0.5 + 0.3, // height
          8 // segments
        );
      }
    
      const rockMaterial = new THREE.MeshStandardMaterial({ 
        map: concreteTexture,
        normalMap: concreteNormal,
        color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.2), // gray variations
        roughness: 0.95,
        metalness: 0.05,
        flatShading: true
      });
      
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      
      // Position rock above player with slight random offset
      const radius = Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;
      
      rock.position.set(
        player.position.x + Math.cos(angle) * radius,
        player.position.y + 5 + Math.random() * 3,
        player.position.z + Math.sin(angle) * radius
      );
      
      rock.castShadow = true;
      rock.receiveShadow = true;
      
      scene.add(rock);
      
      fallingRocks.push({
        mesh: rock,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          -0.08,
          (Math.random() - 0.5) * 0.02
        ),
        rotationSpeed: new THREE.Vector3(
          Math.random() * 0.02,
          Math.random() * 0.02,
          Math.random() * 0.02
        )
      });
    };
    
    
    // Function to create falling debris
    const createFallingDebris = () => {
      // Create various rectangular shapes for debris
      const shapes = [
        // Thin rectangular pieces
        new THREE.BoxGeometry(0.3, 0.1, 0.1),
        new THREE.BoxGeometry(0.1, 0.3, 0.1),
        new THREE.BoxGeometry(0.1, 0.1, 0.3),
        // Square pieces
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        // Larger rectangular pieces
        new THREE.BoxGeometry(0.4, 0.2, 0.2),
        new THREE.BoxGeometry(0.2, 0.4, 0.2),
        new THREE.BoxGeometry(0.2, 0.2, 0.4)
      ];
      
      const debrisGeometry = shapes[Math.floor(Math.random() * shapes.length)];
      const debrisMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444, 
        roughness: 0.8, 
        metalness: 0.3,
        emissive: new THREE.Color(0x111111),
        emissiveIntensity: 0.2,
        flatShading: true
      });
      
      const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
      
      // Position debris above player with slight random offset
      const radius = Math.random() * 2;
      const angle = Math.random() * Math.PI * 2;
      
      debris.position.set(
        player.position.x + Math.cos(angle) * radius,
        player.position.y + 4 + Math.random() * 2,
        player.position.z + Math.sin(angle) * radius
      );
      
      scene.add(debris);
      
      fallingDebris.push({
        mesh: debris,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          -0.07,
          (Math.random() - 0.5) * 0.01
        ),
        rotationSpeed: new THREE.Vector3(
          Math.random() * 0.02,
          Math.random() * 0.02,
          Math.random() * 0.02
        )
      });
    };
    
    // Create initial falling objects
    for (let i = 0; i < 5; i++) {
      createFallingRock();
      createFallingDebris();
    }
    
    // Animate both camera and player falling with physics
    const fallAnimation = () => {
      if (!mainIsShattering) return;
      
      // Update player position with synchronized fall speed
      player.position.y -= 0.05; // Slower fall speed
      player.rotation.x += 0.003
      
      // Update Electro position to fall with player
      if (electroCharacter) {
        electroCharacter.position.y = player.position.y;
        // Add slight random rotation for more dramatic effect
        electroCharacter.rotation.y += 0.002;
        electroCharacter.rotation.z += 0.005;
      }
      
      // Update camera position to follow player from further back
      camera.position.y = player.position.y + 1.2;
      camera.position.x = player.position.x + 1.0;
      camera.position.z = player.position.z + 1.0;
      
      // Make camera look at player
      if (camera.userData?.controls) {
        camera.userData.controls.target.copy(player.position);
        camera.userData.controls.update();
      }
      
      // Add slight random movement for more natural fall
      player.position.x += (Math.random() - 0.5) * 0.01; // Reduced random movement
      player.position.z += (Math.random() - 0.5) * 0.01;
      
      // Update player animation mixer if it exists
      if (player.userData && player.userData.mixer) {
        player.userData.mixer.update(0.016); // Update animation mixer
        
        // Ensure the falling animation keeps playing
        if (player.userData.currentAction) {
          if (!player.userData.currentAction.isRunning()) {
            player.userData.currentAction.play();
          }
        }
      }
      
      // Also update the actionFalling if it exists
      if (actionFalling && !actionFalling.isRunning()) {
        actionFalling.play();
      }
      
      // Create new falling objects periodically
      if (Math.random() < 0.03) { // Reduced spawn rate
        createFallingRock();
      }
      if (Math.random() < 0.04) { // Reduced spawn rate
        createFallingDebris();
      }
      
      // Update falling rocks
      fallingRocks.forEach((rock, index) => {
        rock.mesh.position.add(rock.velocity);
        rock.mesh.rotation.x += rock.rotationSpeed.x;
        rock.mesh.rotation.y += rock.rotationSpeed.y;
        rock.mesh.rotation.z += rock.rotationSpeed.z;
        
        // Remove rocks that fall too far
        if (rock.mesh.position.y < -50) {
          scene.remove(rock.mesh);
          fallingRocks.splice(index, 1);
        }
      });
      
      // Update falling debris
      fallingDebris.forEach((debris, index) => {
        debris.mesh.position.add(debris.velocity);
        debris.mesh.rotation.x += debris.rotationSpeed.x;
        debris.mesh.rotation.y += debris.rotationSpeed.y;
        debris.mesh.rotation.z += debris.rotationSpeed.z;
        
        // Remove debris that fall too far
        if (debris.mesh.position.y < -50) {
          scene.remove(debris.mesh);
          fallingDebris.splice(index, 1);
        }
      });
      
      // Continue animation
      requestAnimationFrame(fallAnimation);
    };
    
    // Start falling animation
    fallAnimation();
  } else {
    console.error("Player not found for falling sequence");
  }
}

/**
 * Optional hook for wiring the main falling sequence into the shared
 * Scene 3 update loop if needed in the future.
 *
 * Currently the main falling animation runs inside its own `requestAnimationFrame`
 * loop inside `startMainFallingSequence`, so nothing is required here.
 *
 * @param {number} delta - Frame delta time (unused)
 */
export function updateMainFallingSequence(delta) {
  if (!isMainFallingSequenceActive) return;
  
  // Update main falling sequence logic here if needed
  // Currently the animation runs in its own loop
}

/**
 * Stops the main falling sequence without necessarily tearing down all
 * associated meshes.
 *
 * - Sets control flags so `fallAnimation` will naturally exit
 * - Stops the shared `actionFalling` animation (if present)
 * - Traverses the scene to find any `userData.currentAction` set up by
 *   this module and stops / resets them.
 */
export function stopMainFallingSequence() {
  console.log("Stopping main falling sequence");
  mainIsShattering = false;
  isMainFallingSequenceActive = false;
  
  // Stop the falling animation
  if (actionFalling && actionFalling.isRunning()) {
    actionFalling.stop();
    actionFalling.reset();
  }
  
  // Stop any stored current action
  if (scene) {
    scene.traverse((object) => {
      if (object.userData && object.userData.currentAction) {
        const currentAction = object.userData.currentAction;
        if (currentAction && currentAction.isRunning()) {
          currentAction.stop();
          currentAction.reset();
        }
        delete object.userData.currentAction;
      }
    });
  }
}

/**
 * Full cleanup for the main falling sequence.
 *
 * - Calls `stopMainFallingSequence` to halt any running animations
 * - Removes all rocks and debris spawned by the main sequence from the scene
 * - Clears internal bookkeeping sets/maps so the module can be reused safely
 */
export function cleanupMainFallingSequence() {
  console.log("Cleaning up main falling sequence");
  
  // Stop the sequence first
  stopMainFallingSequence();
  
  // Reset state variables
  isMainFallingSequenceActive = false;
  mainIsShattering = false;
  
  // Clean up main falling rocks
  mainFallingRocks.forEach(rock => {
    if (rock.mesh && scene) {
      scene.remove(rock.mesh);
    }
  });
  mainFallingRocks = [];
  
  // Clean up main falling debris
  mainFallingDebris.forEach(debris => {
    if (debris.mesh && scene) {
      scene.remove(debris.mesh);
    }
  });
  mainFallingDebris = [];
  
  // Clear other main falling variables
  mainCrackedMeshes.clear();
  mainShatteredPieces = [];
  mainOriginalMeshPositions.clear();
} 