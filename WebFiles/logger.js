import { db, auth } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// --- Internal Helper: Get Current Context ---
// Logger Version 3.0 - Single User Document
function getLogContext() {
    // 1. Identify User & Email
    let uid = 'anonymous';
    let email = 'unknown';

    const currentUser = auth.currentUser;
    if (currentUser) {
        uid = currentUser.uid;
        email = currentUser.email || 'unknown';
    }

    // 2. Identify Current Scene
    let currentScene = 'Web Interface';
    if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const hash = window.location.hash;

        if (path.includes('experience.html')) {
            // Try to get the specific scene from storage
            currentScene = localStorage.getItem('loadScene') || 'VR Experience (Unknown Scene)';
        } else if (hash.includes('profile')) {
            currentScene = 'Profile Page';
        } else if (path.includes('scene-select')) {
            currentScene = 'Scene Selection';
        }
    }

    return { uid, email, currentScene };
}

/**
 * Core logging function. Reference this for all logging needs.
 * 
 * @param {string} eventType - e.g. 'login', 'error', 'crash', 'scene_entry', 'logout'
 * @param {object} details - Any custom data to attach (error stack, metadata, etc.)
 * @param {object|string|null} userOverride - Optional user object/ID to force specific user context
 */
export async function logSystemEvent(eventType, details = {}, userOverride = null) {
    try {
        const context = getLogContext();

        // Allow overriding uid/email if a specific user object is passed
        if (userOverride) {
            if (typeof userOverride === 'object') {
                context.uid = userOverride.uid || context.uid;
                context.email = userOverride.email || context.email;
            } else if (typeof userOverride === 'string') {
                context.uid = userOverride;
            }
        }

        // Determine simple status (Active / Logged Out)
        let status = 'active';
        if (eventType === 'logout') {
            status = 'logged_out';
        }

        const logUpdate = {
            uid: context.uid,
            email: context.email,
            status: status,
            currentScene: context.currentScene,
            lastEventType: eventType,
            lastEventDetails: details,
            lastActive: serverTimestamp(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // If it's a crash, preserve/append it separately or just overwrite for now as requested "single log change value"
        // keeping a dedicated "lastCrash" field helps separate errors from general activity
        if (eventType === 'crash' || eventType === 'error') {
            logUpdate.lastCrash = {
                type: eventType,
                details: details,
                timestamp: new Date().toISOString()
            };
        }

        // Write to Firestore 'system_logs/{uid}' (Single document per user)
        // Using setDoc with merge: true ensures we don't wipe existing fields if we add new ones later
        await setDoc(doc(db, 'system_logs', context.uid), logUpdate, { merge: true });

        // Print to console for dev awareness (commented out to reduce noise as requested)
        // const consoleMsg = `[SystemLog] Updated ${context.uid} | Status: ${status} | Scene: ${context.currentScene} | Event: ${eventType}`;
        // console.log(consoleMsg);

    } catch (err) {
        // console.error('[SystemLog] FAILED TO LOG EVENT:', err);
    }
}

/**
 * Initializes global error listeners (window.onerror, unhandledrejection).
 * Call this once at the start of your app (main.jsx_ and experience.html).
 */
export function initGlobalLogging() {
    if (window.__loggingInitialized) return;
    window.__loggingInitialized = true;

    // console.log('[SystemLog] Initializing Global Crash Reporters...');

    // 1. Catch synchronous errors / crashes
    window.addEventListener('error', (event) => {
        // Ensure we don't log infinite loops if the logger itself crashes
        try {
            logSystemEvent('crash', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                errorStack: event.error ? event.error.stack : 'No stack trace'
            });
        } catch (e) {
            // console.error('logger fatal error', e);
        }
    });

    // 2. Catch unhandled Promise rejections (async crashes)
    window.addEventListener('unhandledrejection', (event) => {
        try {
            logSystemEvent('crash', {
                type: 'Unhandled Promise Rejection',
                reason: event.reason ? (event.reason.stack || event.reason) : 'Unknown reason'
            });
        } catch (e) {
            // console.error('logger fatal error', e);
        }
    });
}
