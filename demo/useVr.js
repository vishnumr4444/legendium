// //To use this VR setup in another scene, you would follow a similar pattern to what's shown in your scene1. Here's a simplified example:



// import { setupVR } from "../commonFiles/vr.js";
// import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

// export async function initializeAnotherScene(existingRenderer) {
//   // ... other scene setup code ...

//   if (isVRMode) {
//     renderer.xr.enabled = true;
//     document.body.appendChild(VRButton.createButton(renderer));
    
//     const vrControls = setupVR(
//       renderer,
//       scene,
//       camera,
//       player, // Your player object
//       backgroundMusic, // Optional background music
//       {   
//         actionIdle: yourIdleAnimation,
//         actionWalk: yourWalkAnimation,
//         actionRun: yourRunAnimation,
//         currentAction: yourIdleAnimation
//       },
//       clickableObjects, // Array of objects that can be interacted with
//       () => {
//         // Callback for when VR controller button is pressed
//         console.log('VR button clicked');
//       }
//     );
    
//     // Set up VR animation loop
//     renderer.setAnimationLoop(() => {
//       const delta = clock.getDelta();
      
//       // Update VR controls
//       vrControls.updateVRControls();
      
//       // Your other animation updates
      
//       renderer.render(scene, camera);
//     });

//     // Handle VR session events
//     renderer.xr.addEventListener('sessionstart', () => {
//       vrControls.enableVR();
//     });

//     renderer.xr.addEventListener('sessionend', () => {
//       vrControls.disableVR();
//     });
//   }
// }



// Key points about the VR setup:
// The setupVR function handles:
// VR controller setup and models
// Controller input handling
// Player movement in VR
// Animation state management
// Background music control
// Required parameters:
// renderer: Your THREE.js WebGLRenderer
// scene: Your THREE.js Scene
// camera: Your THREE.js Camera
// player: Your player object/model
// backgroundMusic: Optional audio for the scene
// animations: Object containing your animation actions
// clickableObjects: Array of interactive objects
// onButtonClick: Callback for VR controller button press
// The returned object provides:
// updateVRControls: Function to update VR controls each frame
// enableVR: Function called when VR session starts
// disableVR: Function called when VR session ends
// controller1 and controller2: References to the VR controllers
// Remember to always check if VR is supported and enabled before setting up VR controls, and make sure to clean up event listeners and controllers when switching scenes.
