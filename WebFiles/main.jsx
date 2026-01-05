import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initGlobalLogging } from './logger';

// Initialize global crash/error logging
initGlobalLogging();

// Entry point for the React SPA.
// This file bootstraps the root React tree into the #root element
// defined in `index.html` / `landing.html`.

// Find the root container element injected by the HTML shell.
const container = document.getElementById('root');
// Create a concurrent React root (React 18+ API).
const root = createRoot(container);

// Render the main App component tree.
root.render(<App />); 