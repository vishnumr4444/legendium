/**
 * ============================================
 * GUI MANAGER MODULE
 * ============================================
 * Lightweight wrapper for managing lil-gui instances.
 * Used for:
 * - Debug controls and settings
 * - Development-time parameter tweaking
 * - Visual testing of game properties
 * 
 * Features:
 * - Single active GUI instance management
 * - Automatic cleanup of previous GUIs
 * - Safe destruction and recreation
 */

import GUI from 'lil-gui';

let currentGUI = null;

export function createGUI() {
    // If there's an existing GUI, destroy it first
    if (currentGUI) {
        currentGUI.destroy();
    }
    
    // Create new GUI instance
    currentGUI = new GUI();
    return currentGUI;
}

export function destroyGUI() {
    if (currentGUI) {
        currentGUI.destroy();
        currentGUI = null;
    }
}

export function getCurrentGUI() {
    return currentGUI;
} 