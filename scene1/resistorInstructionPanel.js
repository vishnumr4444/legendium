import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';

/**
 * Creates a simple 3D MeshUI instruction panel for the resistor multimeter game
 * @param {THREE.Scene} scene - The scene to add the panel to
 * @param {THREE.Vector3} position - Position for the panel
 * @param {THREE.Euler} rotation - Rotation for the panel
 * @returns {Object} API for managing the instruction panel
 */
export function createResistorInstructionPanel(scene, position, rotation) {
    let panelContainer = null;

    // Create container for the panel
    panelContainer = new THREE.Group();
    panelContainer.position.copy(position);
    panelContainer.rotation.copy(rotation);
    scene.add(panelContainer);

    // Create main panel block - increased height for more content
    const mainPanel = new ThreeMeshUI.Block({
        width: 2.0,
        height: 2.4,
        padding: 0.12,
        backgroundColor: new THREE.Color(0x000000),
        backgroundOpacity: 0, // Transparent background
        borderRadius: 0.05,
        borderWidth: 0, // Remove border
        justifyContent: 'center',
        contentDirection: 'column',
        alignItems: 'center',
        fontFamily: '/fonts/msdf/Roboto-msdf.json',
        fontTexture: '/fonts/msdf/Roboto-msdf.png',
    });

    // Title text in container
    const titleContainer = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.14,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
    });
    const titleText = new ThreeMeshUI.Text({
        content: 'RESISTOR CALIBRATION',
        fontSize: 0.09,
        fontColor: new THREE.Color(0x00ffff),
        textAlign: 'justify-left',
    });
    titleContainer.add(titleText);
    mainPanel.add(titleContainer);

    // Spacer
    const spacer1 = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.06,
        backgroundOpacity: 0,
        borderWidth: 0,
    });
    mainPanel.add(spacer1);

    // Explanation text in container
    const explanationContainer = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.18,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
    });
    const explanationText = new ThreeMeshUI.Text({
        content: 'Adjust 3 resistors to stabilize the glowing spheres. Watch the multimeter displays above each sphere.',
        fontSize: 0.055,
        fontColor: new THREE.Color(0xffffff),
        textAlign: 'justify-left',
    });
    explanationContainer.add(explanationText);
    mainPanel.add(explanationContainer);

    // Spacer
    const spacer2 = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.08,
        backgroundOpacity: 0,
        borderWidth: 0,
    });
    mainPanel.add(spacer2);

    // Objective text in container
    const objectiveContainer = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.12,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
    });
    const objectiveText = new ThreeMeshUI.Text({
        content: 'GOAL: Center all red needles',
        fontSize: 0.07,
        fontColor: new THREE.Color(0xffff00),
        textAlign: 'justify-left',
    });
    objectiveContainer.add(objectiveText);
    mainPanel.add(objectiveContainer);

    // Spacer
    const spacer3 = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.08,
        backgroundOpacity: 0,
        borderWidth: 0,
    });
    mainPanel.add(spacer3);

    // Controls header in container
    const controlsContainer = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.1,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
    });
    const controlsText = new ThreeMeshUI.Text({
        content: 'HOW TO PLAY:',
        fontSize: 0.07,
        fontColor: new THREE.Color(0x00ff00),
        textAlign: 'justify-left',
    });
    controlsContainer.add(controlsText);
    mainPanel.add(controlsContainer);

    // Spacer
    const spacer4 = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.05,
        backgroundOpacity: 0,
        borderWidth: 0,
    });
    mainPanel.add(spacer4);

    // Step 1: TAB control in container
    const step1Container = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.1,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'start',
        alignItems: 'center',
    });
    const step1Text = new ThreeMeshUI.Text({
        content: '1. Press TAB to select a resistor (R1, R2, or R3)',
        fontSize: 0.06,
        fontColor: new THREE.Color(0xffffff),
        textAlign: 'left',
    });
    step1Container.add(step1Text);
    mainPanel.add(step1Container);

    // Spacer
    const spacer5 = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.04,
        backgroundOpacity: 0,
        borderWidth: 0,
    });
    mainPanel.add(spacer5);

    // Step 2: Arrow keys control in container
    const step2Container = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.12,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'start',
        alignItems: 'center',
    });
    const step2Text = new ThreeMeshUI.Text({
        content: '2. Use LEFT/RIGHT arrows to adjust the selected resistor value',
        fontSize: 0.06,
        fontColor: new THREE.Color(0xffffff),
        textAlign: 'left',
    });
    step2Container.add(step2Text);
    mainPanel.add(step2Container);

    // Spacer
    const spacer6 = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.04,
        backgroundOpacity: 0,
        borderWidth: 0,
    });
    mainPanel.add(spacer6);

    // Step 3: Visual feedback
    const step3Container = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.12,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'start',
        alignItems: 'center',
    });
    const step3Text = new ThreeMeshUI.Text({
        content: '3. Watch the multimeter needle move as you adjust',
        fontSize: 0.06,
        fontColor: new THREE.Color(0xffffff),
        textAlign: 'left',
    });
    step3Container.add(step3Text);
    mainPanel.add(step3Container);

    // Spacer
    const spacer7 = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.06,
        backgroundOpacity: 0,
        borderWidth: 0,
    });
    mainPanel.add(spacer7);

    // Tip text in container
    const tipContainer = new ThreeMeshUI.Block({
        width: 1.8,
        height: 0.14,
        backgroundOpacity: 0,
        borderWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
    });
    const tipText = new ThreeMeshUI.Text({
        content: 'TIP: When the needle is centered (upright), the sphere is perfectly balanced!',
        fontSize: 0.055,
        fontColor: new THREE.Color(0x00ff00),
        textAlign: 'justify-left',
    });
    tipContainer.add(tipText);
    mainPanel.add(tipContainer);

    panelContainer.add(mainPanel);

    // Update function
    function update() {
        if (mainPanel) {
            ThreeMeshUI.update();
        }
    }

    // Show/hide functions
    function show() {
        if (panelContainer) {
            panelContainer.visible = true;
        }
    }

    function hide() {
        if (panelContainer) {
            panelContainer.visible = false;
        }
    }

    // Cleanup
    function dispose() {
        if (panelContainer) {
            scene.remove(panelContainer);
            panelContainer = null;
        }
    }

    return {
        update,
        show,
        hide,
        dispose,
        container: panelContainer,
    };
}
