// src/firebase.js
// Centralized Firebase initialization for the Legendium web app.
// Exports configured instances of:
//   - firebaseApp: base app instance
//   - auth: Firebase Authentication
//   - db: Firestore database (with custom options)

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";

// Firebase project configuration (public keys; safe for client use).
// NOTE: Do not commit private server keys or secrets here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize the Firebase app instance once for the entire SPA.
const firebaseApp = initializeApp(firebaseConfig);

// Optional: enable debug logging while you debug Firestore behavior.
// Prefer commenting this out or using 'silent' in production to avoid noise.
// setLogLevel('debug');

// Initialize Firestore with options tuned for browser environments.
const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

// Firebase Authentication instance used throughout the app.
const auth = getAuth(firebaseApp);

export { firebaseApp, auth, db };
