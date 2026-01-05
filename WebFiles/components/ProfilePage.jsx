import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { migrateUserScenesToV2 } from '../utils/migration';
import '../styles/ProfilePage.css';

/**
 * ProfilePage
 *
 * Shows learner profile information backed by Firestore:
 * - Avatar and editable display name
 * - Progress through scenes (1–7), with ability to navigate to scenes
 * - Static "gifts" list (placeholder for future rewards system)
 *
 * Also ensures the user's Firestore document exists and runs a migration to
 * guarantee `scene6` and `scene7` keys are present in `scenesCompleted`.
 */
export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ displayName: '', photoURL: '', scenesCompleted: {} });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');
  const [uploading, setUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef(null);

  // Memoized reference to the user's Firestore document.
  const userDocRef = useMemo(() => (user ? doc(db, 'users', user.uid) : null), [user]);

  // Listen to auth + Firestore changes and keep `profile` in sync.
  useEffect(() => {
    if (!user) {
      window.location.hash = '';
      return;
    }
    if (!userDocRef) return;

    const unsub = onSnapshot(userDocRef, async (snap) => {
      if (!snap.exists()) {
        // Initialize user document if missing (first-time login).
        const initialData = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
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
        };
        await setDoc(userDocRef, initialData, { merge: true });
        setProfile(initialData);
      } else {
        const data = snap.data();
        
        // Use migration utility to ensure scene6 and scene7 exist.
        const migrationResult = await migrateUserScenesToV2(user.uid);
        if (migrationResult) {
          console.log('ProfilePage: User migration completed');
        }
        
        setProfile({
          displayName: data.displayName || '',
          photoURL: data.photoURL || '',
          scenesCompleted: {
            scene1: Boolean(data.scenesCompleted?.scene1),
            scene2: Boolean(data.scenesCompleted?.scene2),
            scene3: Boolean(data.scenesCompleted?.scene3),
            scene4: Boolean(data.scenesCompleted?.scene4),
            scene5: Boolean(data.scenesCompleted?.scene5),
            scene6: Boolean(data.scenesCompleted?.scene6),
            scene7: Boolean(data.scenesCompleted?.scene7),
          },
        });
        setEditName(data.displayName || '');
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user, userDocRef]);

  // Persist current displayName/photoURL back to Firestore.
  const handleSaveProfile = async () => {
    if (!userDocRef) return;
    setSaving(true);
    await updateDoc(userDocRef, {
      displayName: profile.displayName || '',
      photoURL: profile.photoURL || '',
    });
    setSaving(false);
  };

  // Toggle completion flag for a given scene and sync to Firestore.
  const handleToggleScene = async (sceneKey) => {
    if (!userDocRef) return;
    const newValue = !profile.scenesCompleted[sceneKey];
    setProfile((p) => ({
      ...p,
      scenesCompleted: { ...p.scenesCompleted, [sceneKey]: newValue },
    }));
    await updateDoc(userDocRef, {
      [`scenesCompleted.${sceneKey}`]: newValue,
    });
  };

  // Handle avatar upload: converts image to base64 and stores it in Firestore.
  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // Convert file to base64 for storage
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        await updateDoc(userDocRef, { photoURL: base64 });
        setProfile(p => ({ ...p, photoURL: base64 }));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
    }
  };

  // Set the scene to load and redirect to `experience.html` for the 3D view.
  const navigateToScene = (sceneNumber) => {
    if (typeof window !== 'undefined') {
      // Store the scene to load in localStorage
      localStorage.setItem('loadScene', `scene${sceneNumber}`);
      window.location.href = './experience.html';
    }
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  // Save edited display name into Firestore.
  const handleNameSave = async () => {
    if (!userDocRef) return;
    
    try {
      await updateDoc(userDocRef, {
        displayName: editName.trim()
      });
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating name:', error);
    }
  };

  const handleNameCancel = () => {
    setEditName(profile.displayName);
    setIsEditingName(false);
  };

  // Manual migration function for existing users (exposed via window for debug).
  const migrateUserScenes = async () => {
    if (!user) return;
    
    try {
      console.log('Starting manual migration for user...');
      const migrationResult = await migrateUserScenesToV2(user.uid);
      
      if (migrationResult) {
        console.log('Manual migration completed successfully!');
        alert('Migration completed! Scene6 and Scene7 have been added to your profile.');
      } else {
        console.log('User already has scene6 and scene7');
        alert('Your profile already has all scenes!');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      alert('Migration failed. Please try again.');
    }
  };

  // Expose migration function globally for manual use in the browser console.
  React.useEffect(() => {
    if (user) {
      window.migrateUserScenes = migrateUserScenes;
    }
  }, [user]);

  if (loading) {
    return <div className="profile-page"><div className="profile-card">Loading...</div></div>;
  }

  const avatarFallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(profile.displayName || user.email || 'U')}`;
  const avatarSrc = profile.photoURL || avatarFallback;
  const completedScenes = Object.values(profile.scenesCompleted).filter(Boolean).length;
  const totalScenes = 7;
  const progressPercentage = (completedScenes / totalScenes) * 100;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <button className="back-btn" onClick={() => (window.location.hash = '')}>×</button>
          <h2>Profile Info</h2>
        </div>
        
        <div className="profile-content">
          {/* Left Section - Profile Info */}
          <div className="profile-left">
            <div className="profile-avatar-section">
              <div className="profile-avatar-container">
                <img className="profile-avatar" src={avatarSrc} alt="Avatar" />
                <div className="avatar-upload-overlay" onClick={() => fileInputRef.current?.click()}>
                  <span>📷</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
              </div>
              
              <div className="profile-name">
                {isEditingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(0, 255, 255, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: 'white',
                        fontSize: '18px',
                        width: '200px'
                      }}
                    />
                    <button 
                      onClick={handleNameSave}
                      style={{
                        background: 'rgba(0, 255, 255, 0.2)',
                        border: '1px solid rgba(0, 255, 255, 0.5)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      ✓
                    </button>
                    <button 
                      onClick={handleNameCancel}
                      style={{
                        background: 'rgba(255, 100, 100, 0.2)',
                        border: '1px solid rgba(255, 100, 100, 0.5)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3>{profile.displayName || 'Player'}</h3>
                    <button 
                      onClick={handleNameEdit}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(0, 255, 255, 0.7)',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>
              
              <div className="profile-level">
                <span className="level-icon">👑</span>
                <span className="level-text">Master</span>
                <div className="level-progress">
                  <div className="level-progress-fill" style={{ width: `${progressPercentage}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Section - Progress/Gifts */}
          <div className="profile-right">
            <div className="profile-tabs">
              <button 
                className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
                onClick={() => setActiveTab('progress')}
              >
                Progress
              </button>
              <button 
                className={`tab-btn ${activeTab === 'gifts' ? 'active' : ''}`}
                onClick={() => setActiveTab('gifts')}
              >
                Gifts
              </button>
            </div>
            
            <div 
              className="tab-content" 
              style={{ 
                maxHeight: '60vh', 
                overflowY: 'auto', 
                paddingRight: '8px' // Slight padding to avoid scrollbar overlap
              }}
            >
              {activeTab === 'progress' ? (
                <div className="progress-content">
                  <div 
                    className="scenes-grid" 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                      gap: '1rem', 
                      padding: '1rem 0'
                    }}
                  >
                    {[
                      { key: 'scene1', name: 'Mystical Forest' },
                      { key: 'scene2', name: 'Futuristic City' },
                      { key: 'scene3', name: 'Robotics University' },
                      { key: 'scene4', name: 'Underground Lab' },
                      { key: 'scene5', name: 'Robotic Assembly' },
                      { key: 'scene6', name: 'Component Lesson' },
                      { key: 'scene7', name: 'Component Assembly' }
                    ].map((scene, idx) => (
                      <div key={scene.key} className={`scene-card ${profile.scenesCompleted[scene.key] ? 'completed' : ''}`}>
                        <div className="scene-icon">🎮</div>
                        <div className="scene-info">
                          <h4>{scene.name}</h4>
                          <p>{profile.scenesCompleted[scene.key] ? 'Completed' : 'Not Started'}</p>
                        </div>
                        <button 
                          className="scene-play-btn"
                          onClick={() => navigateToScene(idx + 1)}
                          disabled={!profile.scenesCompleted[scene.key]}
                        >
                          {profile.scenesCompleted[scene.key] ? 'Replay' : 'Locked'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  className="gifts-content" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem', 
                    padding: '1rem 0'
                  }}
                >
                  <div className="gift-item">
                    <div className="gift-icon">🧁</div>
                    <div className="gift-info">
                      <span className="gift-name">Vera Orange</span>
                      <span className="gift-type">Cupcake</span>
                    </div>
                    <button className="gift-remove">×</button>
                  </div>
                  <div className="gift-item">
                    <div className="gift-icon">💙</div>
                    <div className="gift-info">
                      <span className="gift-name">Paul Nintendo</span>
                      <span className="gift-type">Heart Box</span>
                    </div>
                    <button className="gift-remove">×</button>
                  </div>
                  <div className="gift-item">
                    <div className="gift-icon">🍺</div>
                    <div className="gift-info">
                      <span className="gift-name">Niki Nebula</span>
                      <span className="gift-type">Beer Mug</span>
                    </div>
                    <button className="gift-remove">×</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* <div className="profile-actions">
          <button className="save-btn" onClick={handleSaveProfile} disabled={saving || uploading}>
            {saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save Profile'}
          </button>
          <button 
            className="migrate-btn" 
            onClick={migrateUserScenes}
            style={{
              background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              marginLeft: '12px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            Update Scenes
          </button>
        </div> */}
      </div>
    </div>
  );
}