import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * One-time migration helper:
 * Ensures that all user documents in Firestore have `scene6` and `scene7`
 * keys in their `scenesCompleted` map (initialized to `false` if missing).
 *
 * This is useful when adding new scenes to an already-live experience
 * without breaking existing users' progress tracking.
 *
 * @param {string} userId - Firebase auth user UID to migrate.
 * @returns {Promise<boolean>} - `true` if updated, `false` if no change or error.
 */
export async function migrateUserScenesToV2(userId) {
  if (!userId) {
    console.warn('Migration: No user ID provided');
    return false;
  }

  try {
    console.log('Migration: Starting migration for user:', userId);
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);
    
    if (!docSnap.exists()) {
      console.warn('Migration: User document does not exist');
      return false;
    }

    const data = docSnap.data();
    // We only need to migrate if either scene6 or scene7 keys are missing.
    const needsUpdate =
      !data.scenesCompleted?.hasOwnProperty('scene6') ||
      !data.scenesCompleted?.hasOwnProperty('scene7');
    
    console.log('Migration: User data check:', {
      hasScene6: data.scenesCompleted?.hasOwnProperty('scene6'),
      hasScene7: data.scenesCompleted?.hasOwnProperty('scene7'),
      needsUpdate,
      currentScenes: Object.keys(data.scenesCompleted || {})
    });

    if (needsUpdate) {
      const updatedScenesCompleted = {
        ...data.scenesCompleted,
        scene6: false,
        scene7: false,
      };
      
      await updateDoc(userRef, {
        scenesCompleted: updatedScenesCompleted
      });
      
      console.log('Migration: Successfully updated user with scene6 and scene7');
      return true;
    } else {
      console.log('Migration: User already has scene6 and scene7');
      return false;
    }
  } catch (error) {
    console.error('Migration: Failed to migrate user:', error);
    return false;
  }
}

/**
 * Lightweight check to see if a given user needs migration.
 *
 * This is intended to be called before `migrateUserScenesToV2` so that
 * you can decide whether to run the migration in a session.
 *
 * @param {string} userId - Firebase auth user UID.
 * @returns {Promise<boolean>} - `true` if user is missing scene6/7 keys.
 */
export async function checkUserNeedsMigration(userId) {
  if (!userId) return false;
  
  try {
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);
    
    if (!docSnap.exists()) return false;
    
    const data = docSnap.data();
    return !data.scenesCompleted?.hasOwnProperty('scene6') || !data.scenesCompleted?.hasOwnProperty('scene7');
  } catch (error) {
    console.error('Migration: Error checking migration status:', error);
    return false;
  }
}
