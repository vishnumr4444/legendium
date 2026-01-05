import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { logSystemEvent } from '../logger';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Global authentication context for the Legendium React app.
 *
 * Responsibilities:
 * - Listen to Firebase Auth state changes
 * - Ensure a corresponding Firestore `users/{uid}` document exists
 * - Provide `login`, `register`, and `logout` helpers to children
 */
const AuthContext = createContext();

/**
 * Convenience hook to access the auth context.
 *
 * @returns {{ user: import('firebase/auth').User|null, login: Function, register: Function, logout: Function }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Wraps the app with authentication logic.
 * Ensures we know when a user is logged in and initializes their Firestore
 * document with default `scenesCompleted` structure if missing.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Debug: Ensure db is valid
        if (!db) console.error('[AuthContext] DB is undefined!');

        // Log user login/active status.
        logSystemEvent('login', { status: 'active' }, firebaseUser);

        // Ensure user document exists (idempotent via merge: true).
        try {
          // Explicitly check if db is valid before calling doc
          if (db) {
            const userRef = doc(db, 'users', firebaseUser.uid);
            const snap = await getDoc(userRef);
            if (!snap.exists()) {
              console.log('[AuthContext] Creating new user profile for:', firebaseUser.uid);
              await setDoc(userRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                photoURL: firebaseUser.photoURL || '',
                scenesCompleted: {
                  scene1: false,
                  scene2: false,
                  scene3: false,
                  scene4: false,
                  scene5: false,
                  scene6: false,
                  scene7: false,
                },
                createdAt: new Date().toISOString(),
              }, { merge: true });
            }
          }
        } catch (err) {
          console.error('[AuthContext] Profile init error:', err);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const register = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid, email: userEmail, displayName, photoURL } = credential.user;
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        uid,
        email: userEmail || email,
        displayName: displayName || '',
        photoURL: photoURL || '',
        scenesCompleted: {
          scene1: false,
          scene2: false,
          scene3: false,
          scene4: false,
          scene5: false,
          scene6: false,
          scene7: false,

        },
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return credential;
  };

  const logout = async () => {
    try {
      if (user) {
        await logSystemEvent('logout', { action: 'user_initiated' }, user);
      }
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const value = { user, login, register, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
