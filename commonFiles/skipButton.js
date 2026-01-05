

/**
 * ============================================
 * SKIP BUTTON MODULE
 * ============================================
 * Creates an on-screen skip button for cutscenes and long animations.
 * 
 * Features:
 * - Fixed position in corner of screen
 * - Hover effects with backdrop blur
 * - Fade in/out animations
 * - Reusable callback system
 * - Styled with game theme colors
 * - Easy show/hide control
 * 
 * Usage:
 * 1. createSkipButton(callback) - Initialize the button
 * 2. showSkipButton() - Make it visible
 * 3. hideSkipButton() - Make it invisible
 * 
 * Styling:
 * - Purple gradient background
 * - 1000px z-index for top layer visibility
 * - Smooth opacity transitions
 */

let skipButton = null;
let skipCallback = null;

/**
 * Creates and inserts the styled Skip button into the DOM.
 * @param {function} callback - The function to execute when the button is clicked.
 */
export function createSkipButton(callback) {
    skipCallback = callback;


    let existingButton = document.getElementById('scene-skip-btn');
    if (existingButton) {
        skipButton = existingButton;
        skipButton.onclick = skipCallback; 
        return;
    }
    
    const button = document.createElement('button');
    button.id = 'scene-skip-btn';
    button.textContent = 'SKIP';
    button.style.cssText = `
        position: fixed;
        bottom: 40px;
        right: 120px;
        padding: 10px 20px;
        background-color: rgba(147, 51, 234, 0.7);
        color: white;
        border: 1px solid #9333ea;
        border-radius: 8px;
        cursor: pointer;
        font-family: 'Lexend', sans-serif;
        font-size: 16px;
        font-weight: 600;
        z-index: 1000;
        opacity: 0;
        pointer-events: none; /* Inactive state */
        transition: opacity 0.3s ease;
        backdrop-filter: blur(5px);
    `;

    button.onmouseover = () => button.style.backgroundColor = 'rgba(147, 51, 234, 0.9)';
    button.onmouseout = () => button.style.backgroundColor = 'rgba(147, 51, 234, 0.7)';
    button.onclick = skipCallback;
    
    document.body.appendChild(button);
    skipButton = button;
}


export function showSkipButton() {
    if (skipButton) {
        skipButton.style.opacity = '1';
        skipButton.style.pointerEvents = 'auto';
    }
}


export function hideSkipButton() {
    if (skipButton) {
        skipButton.style.opacity = '0';
        skipButton.style.pointerEvents = 'none';
    }
}
