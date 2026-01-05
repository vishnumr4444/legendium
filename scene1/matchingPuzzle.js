import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import { togglePlayerControls, setMovementEnabled, requestPointerLock } from '../playerController.js';

/**
 * Creates a matching puzzle UI for collectibles
 * @param {THREE.Scene} scene - The scene to add UI to
 * @param {Function} onComplete - Callback when puzzle is solved
 * @returns {Object} API for managing puzzle
 */
export function createMatchingPuzzle(scene, onComplete) {
    let puzzleContainer = null;
    let isActive = false;
    let selectedLeft = null;
    let selectedRight = null;
    let matches = {};
    let leftButtons = [];
    let rightButtons = [];
    let lineContainer = null;
    let lines = [];
    let pointerLockChangeHandler = null;

    // Collectibles data with descriptions
    const collectiblesData = [
        { id: 'switch', name: 'Switch', description: 'Controls circuit flow' },
        { id: 'led', name: 'LED', description: 'Emits light when current flows' },
        { id: 'breadboard', name: 'Breadboard', description: 'Prototyping platform' },
        { id: 'jumperWire', name: 'Jumper Wire', description: 'Connects components' },
        { id: 'multimeter', name: 'Multimeter', description: 'Measures voltage and current' },
        { id: 'resistor', name: 'Resistor', description: 'Limits current flow' },
        { id: 'powerRegulator', name: 'Power Regulator', description: 'Stabilizes voltage supply' },
        { id: 'batteryAndConnector', name: 'Battery & Connector', description: 'Provides electrical energy' },
    ];

    // Shuffle descriptions for right side
    const shuffledDescriptions = [...collectiblesData].sort(() => Math.random() - 0.5);

    function show() {
        if (isActive) return;
        isActive = true;

        // Disable player controls (movement and spell cast)
        togglePlayerControls(false);
        setMovementEnabled(false);

        // Exit pointer lock to allow clicking
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Prevent pointer lock while puzzle is active
        pointerLockChangeHandler = () => {
            if (isActive && document.pointerLockElement) {
                document.exitPointerLock();
            }
        };
        document.addEventListener('pointerlockchange', pointerLockChangeHandler);

        // Disable clicks on the canvas
        const canvas = document.querySelector('canvas');
        if (canvas) canvas.style.pointerEvents = 'none';

        // Create main container
        puzzleContainer = document.createElement('div');
        puzzleContainer.style.position = 'fixed';
        puzzleContainer.style.top = '0';
        puzzleContainer.style.left = '0';
        puzzleContainer.style.width = '100vw';
        puzzleContainer.style.height = '100vh';
        puzzleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        puzzleContainer.style.display = 'flex';
        puzzleContainer.style.flexDirection = 'column';
        puzzleContainer.style.justifyContent = 'center';
        puzzleContainer.style.alignItems = 'center';
        puzzleContainer.style.zIndex = '10000';
        puzzleContainer.style.fontFamily = "'Orbitron', sans-serif";
        puzzleContainer.style.cursor = 'default'; // Show cursor

        // Title
        const title = document.createElement('div');
        title.textContent = 'Match the Collectibles';
        title.style.fontSize = '48px';
        title.style.fontWeight = 'bold';
        title.style.color = '#00ffff';
        title.style.marginBottom = '20px';
        title.style.textShadow = '0 0 20px rgba(0, 255, 255, 0.8)';
        puzzleContainer.appendChild(title);

        // Instructions
        const instructions = document.createElement('div');
        instructions.textContent = 'Click on a collectible, then click on its matching description';
        instructions.style.fontSize = '20px';
        instructions.style.color = '#ffffff';
        instructions.style.marginBottom = '40px';
        instructions.style.opacity = '0.8';
        puzzleContainer.appendChild(instructions);

        // Puzzle area
        const puzzleArea = document.createElement('div');
        puzzleArea.style.display = 'flex';
        puzzleArea.style.gap = '100px';
        puzzleArea.style.position = 'relative';
        puzzleContainer.appendChild(puzzleArea);

        // Line container (for drawing connection lines)
        lineContainer = document.createElement('svg');
        lineContainer.style.position = 'absolute';
        lineContainer.style.top = '0';
        lineContainer.style.left = '0';
        lineContainer.style.width = '100%';
        lineContainer.style.height = '100%';
        lineContainer.style.pointerEvents = 'none';
        lineContainer.style.zIndex = '1';
        puzzleArea.appendChild(lineContainer);

        // Left column (collectibles)
        const leftColumn = document.createElement('div');
        leftColumn.style.display = 'flex';
        leftColumn.style.flexDirection = 'column';
        leftColumn.style.gap = '15px';
        leftColumn.style.zIndex = '2';
        leftColumn.style.position = 'relative';
        puzzleArea.appendChild(leftColumn);

        // Right column (descriptions)
        const rightColumn = document.createElement('div');
        rightColumn.style.display = 'flex';
        rightColumn.style.flexDirection = 'column';
        rightColumn.style.gap = '15px';
        rightColumn.style.zIndex = '2';
        rightColumn.style.position = 'relative';
        puzzleArea.appendChild(rightColumn);

        // Create left buttons (collectibles)
        collectiblesData.forEach((item, index) => {
            const button = createButton(item.name, 'left', item.id, index);
            leftColumn.appendChild(button);
            leftButtons.push({ element: button, id: item.id, index });
        });

        // Create right buttons (descriptions)
        shuffledDescriptions.forEach((item, index) => {
            const button = createButton(item.description, 'right', item.id, index);
            rightColumn.appendChild(button);
            rightButtons.push({ element: button, id: item.id, index });
        });

        document.body.appendChild(puzzleContainer);
    }

    function createButton(text, side, id, index) {
        const button = document.createElement('div');
        button.dataset.side = side;
        button.dataset.id = id;
        button.dataset.index = index;
        button.textContent = text;
        button.style.padding = '15px 25px';
        button.style.backgroundColor = 'rgba(26, 26, 46, 0.9)';
        button.style.border = '2px solid rgba(0, 255, 255, 0.5)';
        button.style.borderRadius = '10px';
        button.style.color = '#00ffff';
        button.style.fontSize = '18px';
        button.style.cursor = 'pointer';
        button.style.transition = 'all 0.3s ease';
        button.style.minWidth = '300px';
        button.style.textAlign = 'center';
        button.style.userSelect = 'none';

        button.addEventListener('mouseenter', () => {
            if (!button.dataset.matched) {
                button.style.backgroundColor = 'rgba(0, 255, 255, 0.2)';
                button.style.borderColor = 'rgba(0, 255, 255, 0.8)';
                button.style.transform = 'scale(1.05)';
            }
        });

        button.addEventListener('mouseleave', () => {
            if (!button.dataset.matched && button.dataset.selected !== 'true') {
                button.style.backgroundColor = 'rgba(26, 26, 46, 0.9)';
                button.style.borderColor = 'rgba(0, 255, 255, 0.5)';
                button.style.transform = 'scale(1)';
            }
        });

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            handleButtonClick(button, side, id);
        });

        return button;
    }

    function handleButtonClick(button, side, id) {
        // Don't allow clicking matched buttons
        if (button.dataset.matched) return;

        if (side === 'left') {
            // Deselect previous left selection
            if (selectedLeft) {
                selectedLeft.style.backgroundColor = 'rgba(26, 26, 46, 0.9)';
                selectedLeft.style.borderColor = 'rgba(0, 255, 255, 0.5)';
                selectedLeft.dataset.selected = 'false';
            }

            selectedLeft = button;
            button.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';
            button.style.borderColor = 'rgba(255, 215, 0, 0.8)';
            button.dataset.selected = 'true';
        } else {
            // Deselect previous right selection
            if (selectedRight) {
                selectedRight.style.backgroundColor = 'rgba(26, 26, 46, 0.9)';
                selectedRight.style.borderColor = 'rgba(0, 255, 255, 0.5)';
                selectedRight.dataset.selected = 'false';
            }

            selectedRight = button;
            button.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';
            button.style.borderColor = 'rgba(255, 215, 0, 0.8)';
            button.dataset.selected = 'true';
        }

        // Check if both are selected
        if (selectedLeft && selectedRight) {
            checkMatch();
        }
    }

    function checkMatch() {
        const leftId = selectedLeft.dataset.id;
        const rightId = selectedRight.dataset.id;

        if (leftId === rightId) {
            // Correct match!
            selectedLeft.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
            selectedLeft.style.borderColor = 'rgba(0, 255, 0, 0.8)';
            selectedLeft.dataset.matched = 'true';
            selectedLeft.dataset.selected = 'false';

            selectedRight.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
            selectedRight.style.borderColor = 'rgba(0, 255, 0, 0.8)';
            selectedRight.dataset.matched = 'true';
            selectedRight.dataset.selected = 'false';

            matches[leftId] = true;

            // Draw connection line
            drawLine(selectedLeft, selectedRight, true);

            // Check if all matched
            if (Object.keys(matches).length === collectiblesData.length) {
                setTimeout(() => {
                    completePuzzle();
                }, 1000);
            }
        } else {
            // Wrong match - flash red
            const leftButton = selectedLeft;
            const rightButton = selectedRight;

            leftButton.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
            leftButton.style.borderColor = 'rgba(255, 0, 0, 0.8)';
            rightButton.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
            rightButton.style.borderColor = 'rgba(255, 0, 0, 0.8)';

            setTimeout(() => {
                if (leftButton && rightButton) {
                    leftButton.style.backgroundColor = 'rgba(26, 26, 46, 0.9)';
                    leftButton.style.borderColor = 'rgba(0, 255, 255, 0.5)';
                    leftButton.dataset.selected = 'false';
                    rightButton.style.backgroundColor = 'rgba(26, 26, 46, 0.9)';
                    rightButton.style.borderColor = 'rgba(0, 255, 255, 0.5)';
                    rightButton.dataset.selected = 'false';
                }
            }, 500);
        }

        selectedLeft = null;
        selectedRight = null;
    }

    function drawLine(leftButton, rightButton, isCorrect) {
        const leftRect = leftButton.getBoundingClientRect();
        const rightRect = rightButton.getBoundingClientRect();
        const containerRect = lineContainer.getBoundingClientRect();

        const x1 = leftRect.right - containerRect.left;
        const y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
        const x2 = rightRect.left - containerRect.left;
        const y2 = rightRect.top + rightRect.height / 2 - containerRect.top;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', isCorrect ? '#00ff00' : '#ff0000');
        line.setAttribute('stroke-width', '3');
        line.style.opacity = '0.6';

        lineContainer.appendChild(line);
        lines.push(line);
    }

    function completePuzzle() {
        console.log('Puzzle completed! All collectibles matched correctly.');

        // Add blur effect to puzzle container
        if (puzzleContainer) {
            puzzleContainer.style.filter = 'blur(10px)';
            puzzleContainer.style.pointerEvents = 'none';
        }

        // Create overlay for blur effect
        const blurOverlay = document.createElement('div');
        blurOverlay.style.position = 'fixed';
        blurOverlay.style.top = '0';
        blurOverlay.style.left = '0';
        blurOverlay.style.width = '100vw';
        blurOverlay.style.height = '100vh';
        blurOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        blurOverlay.style.zIndex = '10000';
        blurOverlay.style.backdropFilter = 'blur(5px)';
        document.body.appendChild(blurOverlay);

        // Add keyframe animation for fade-in effect
        if (!document.getElementById('fadeInAnimation')) {
            const style = document.createElement('style');
            style.id = 'fadeInAnimation';
            style.textContent = `
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Add modern animations
        let styleModern = document.getElementById('puzzleSolvedAnimations');
        if (!styleModern) {
            styleModern = document.createElement('style');
            styleModern.id = 'puzzleSolvedAnimations';
            styleModern.textContent = `
                @keyframes slideInScale {
                    0% {
                        transform: translate(-50%, -50%) scale(0.3);
                        opacity: 0;
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.05);
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes glowPulse {
                    0%, 100% {
                        box-shadow: 0 0 30px rgba(0, 255, 150, 0.5), 0 0 60px rgba(0, 255, 150, 0.3);
                    }
                    50% {
                        box-shadow: 0 0 50px rgba(0, 255, 150, 0.8), 0 0 100px rgba(0, 255, 150, 0.5);
                    }
                }
                
                @keyframes floatUp {
                    0%, 100% {
                        transform: translateY(0px);
                    }
                    50% {
                        transform: translateY(-10px);
                    }
                }
                
                .puzzle-solved-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    animation: slideInScale 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    background: rgba(255, 255, 255, 0.62);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 20px;
                    padding: 60px 80px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                
                .puzzle-solved-icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                    animation: floatUp 2s ease-in-out infinite;
                    filter: drop-shadow(0 0 20px rgba(0, 255, 150, 0.6));
                }
                
                .puzzle-solved-text {
                    font-size: 64px;
                    font-weight: 700;
                    color: #000000;
                    letter-spacing: 3px;
                    margin-bottom: 15px;
                }
                
                .puzzle-solved-subtitle {
                    font-size: 24px;
                    color: #000000;
                    letter-spacing: 1px;
                    font-weight: 300;
                }
            `;
            document.head.appendChild(styleModern);
        }

        // Create animated success card
        const successContainer = document.createElement('div');
        successContainer.className = 'puzzle-solved-container';
        successContainer.style.position = 'fixed';
        successContainer.style.top = '50%';
        successContainer.style.left = '50%';
        successContainer.style.zIndex = '10001';
        successContainer.style.textAlign = 'center';
        successContainer.style.fontFamily = "'Orbitron', 'Arial', sans-serif";
        successContainer.style.pointerEvents = 'none';

        // Icon
        const icon = document.createElement('div');
        icon.className = 'puzzle-solved-icon';
        icon.textContent = '✓';
        icon.style.color = '#00ff99';
        successContainer.appendChild(icon);

        // Main text
        const successMsg = document.createElement('div');
        successMsg.className = 'puzzle-solved-text';
        successMsg.textContent = 'PUZZLE SOLVED';
        successContainer.appendChild(successMsg);

        // Subtitle
        const subtitle = document.createElement('div');
        subtitle.className = 'puzzle-solved-subtitle';
        subtitle.textContent = 'Collectibles Matched Successfully';
        successContainer.appendChild(subtitle);

        document.body.appendChild(successContainer);
        
        const successMsg_oldRef = successContainer;

        setTimeout(() => {
            hide();
            blurOverlay.remove();
            if (typeof onComplete === 'function') {
                onComplete();
            }
            successContainer.remove();
        }, 2000);
    }

    function hide() {
        // Re-enable player controls (movement and spell cast)
        togglePlayerControls(true);
        setMovementEnabled(true);

        // Remove pointer lock change listener
        if (pointerLockChangeHandler) {
            document.removeEventListener('pointerlockchange', pointerLockChangeHandler);
            pointerLockChangeHandler = null;
        }

        // Re-enable clicks on the canvas
        const canvas = document.querySelector('canvas');
        if (canvas) canvas.style.pointerEvents = 'auto';

        if (puzzleContainer && puzzleContainer.parentNode) {
            puzzleContainer.parentNode.removeChild(puzzleContainer);
        }
        puzzleContainer = null;
        isActive = false;
        selectedLeft = null;
        selectedRight = null;
        matches = {};
        leftButtons = [];
        rightButtons = [];
        lines = [];

        // Re-request pointer lock after a short delay
        setTimeout(() => {
            if (!document.pointerLockElement) {
                requestPointerLock();
            }
        }, 100);
    }

    return {
        show,
        hide,
        isActive: () => isActive,
    };
}
