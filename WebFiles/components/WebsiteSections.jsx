import React, { useState, useEffect, useRef, Suspense, memo, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';

// Preload the robot model used in the Characters section to avoid pop-in.
useGLTF.preload('/WebAssets/bot_compressed-opt.glb');

/**
 * Small utility to throttle a function to at most once every `limit` ms.
 * Used for scroll and mousemove handlers to improve performance.
 */
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

/**
 * 3D character model that:
 * - Rotates its head toward the mouse position
 * - Animates a morph target for subtle breathing/face motion
 *
 * Wrapped in `memo` to avoid unnecessary re-renders.
 */
const Model = memo(() => {
  const { scene } = useGLTF('/WebAssets/bot_compressed-opt.glb');
  const headRef = useRef();
  const morphMeshesRef = useRef([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const frameCount = useRef(0);

  // Throttled mouse move handler that maps screen coordinates to [-1, 1].
  const handleMouseMove = useCallback(
    throttle((e) => {
      setMousePos({
        x: Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1)),
        y: Math.max(-1, Math.min(1, -(e.clientY / window.innerHeight) * 2 + 1))
      });
    }, 16), // ~60fps
    []
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Traversal setup: find morph-target meshes and head bone once.
  useEffect(() => {
    if (!scene) return;

    morphMeshesRef.current = [];
    headRef.current = null;

    scene.traverse((child) => {
      if (child.isMesh && child.morphTargetInfluences?.length > 0) {
        morphMeshesRef.current.push(child);
      } else if (child.isBone && child.name === 'mixamorigNeck') {
        headRef.current = child;
      }
    });

    const leftHand = scene.getObjectByName('mixamorigLeftArm');
    if (leftHand) {
      leftHand.rotation.set(0.5, 0.9, 7.1);
    }

    const rightUpperArm = scene.getObjectByName('mixamorigRightArm');
    if (rightUpperArm) {
      rightUpperArm.rotation.set(1.8, -2.0, 7);
    }

    scene.updateMatrixWorld(true);

    return () => {
      morphMeshesRef.current = [];
      headRef.current = null;
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    };
  }, [scene]);

  // Per-frame animation for head tracking and morph influence.
  useFrame((state) => {
    frameCount.current++;
    const elapsedTime = state.clock.elapsedTime;
    const damping = 0.08; // Slower for less computation
    const maxAngle = Math.PI / 4;
    const sensitivity = Math.PI * 0.2;

    if (headRef.current) {
      let targetY = mousePos.x * sensitivity;
      let targetX = -mousePos.y * sensitivity;
      targetY = Math.max(-maxAngle, Math.min(maxAngle, targetY));
      targetX = Math.max(-maxAngle, Math.min(maxAngle, targetX));

      headRef.current.rotation.y += (targetY - headRef.current.rotation.y) * damping;
      headRef.current.rotation.x += (targetX - headRef.current.rotation.x) * damping;
    }

    if (frameCount.current % 5 === 0) {
      morphMeshesRef.current.forEach((mesh) => {
        if (mesh.morphTargetInfluences?.length > 0) {
          const influence = Math.max(0, Math.min(0.5, (Math.sin(elapsedTime * 2) + 1) / 2 * 0.5));
          mesh.morphTargetInfluences[0] = influence;
        }
      });
    }
  });

  return <primitive object={scene} scale={2.2} position={[0, -1.8, 0]} frustumCulled={true} />;
});

Model.displayName = 'Model';

/**
 * Main marketing/landing page content.
 *
 * Contains:
 * - Persistent background and navbar
 * - Hero section with CTA
 * - Features, circuit demo, scenes, characters, and subscribe sections
 * - Scroll-based section highlighting and reveal animations
 *
 * @param {{ scrollToSection: (index: number) => void, onLoginOpen: () => void, onRegisterOpen: () => void }} props
 */
export function WebsiteSections({ scrollToSection, onLoginOpen, onRegisterOpen }) {
  // --- Component State and Context Hooks ---
  const [isVisible, setIsVisible] = useState(false);
  const { user, logout } = useAuth();
  const [userProfile, setUserProfile] = useState({ displayName: '', photoURL: '' });
  const [currentSection, setCurrentSection] = useState(0);
  const [showModel, setShowModel] = useState(false);
  
  // --- Handler Functions ---
  const openCircuitDemo = useCallback(() => {
    window.open('./circuit-demo.html', '_blank');
  }, []);

  // Single throttled scroll handler
  const throttledScrollHandler = useMemo(
    () => throttle(() => {
      const sections = document.querySelectorAll("section");
      const scrollPos = window.scrollY + window.innerHeight / 2;

      let inViewIndex = -1;
      sections.forEach((section, i) => {
        if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
          inViewIndex = i;
        }
      });
      if (inViewIndex !== -1) setCurrentSection(inViewIndex);

      // Reveal animations
      const revealElements = document.querySelectorAll('[data-reveal]');
      revealElements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;
        if (elementTop < window.innerHeight - elementVisible) {
          element.classList.add('revealed');
        }
      });
    }, 16), // ~60fps
    []
  );

  

  // --- Effects ---
  // Single scroll effect
  useEffect(() => {
    setIsVisible(true);
    window.addEventListener("scroll", throttledScrollHandler);
    throttledScrollHandler(); // Initial check
    return () => {
      window.removeEventListener("scroll", throttledScrollHandler);
    };
  }, [throttledScrollHandler]);

  // IntersectionObserver for model
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowModel(true);
          observer.disconnect(); // One-time trigger
        }
      },
      { threshold: 0.1 }
    );
  
    const charactersSection = document.querySelector('.characters-section');
    if (charactersSection) {
      observer.observe(charactersSection);
    }
  
    return () => observer.disconnect();
  }, []);

  // Effect to load user profile data from Firestore in real-time
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserProfile({
          displayName: data.displayName || '',
          photoURL: data.photoURL || ''
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  // --- Avatar Logic ---
  const avatarFallback = useMemo(
    () => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(userProfile.displayName || user?.email || 'U')}`,
    [userProfile.displayName, user?.email]
  );
  const avatarSrc = userProfile.photoURL || avatarFallback;

  return (
    <div className="page-container">
      <div className="persistent-background">
        <div className="gradient-blur-1"></div>
        <div className="gradient-blur-2"></div>
        <div className="bg-grid-pattern"></div>
      </div>

      <nav className="navbar">
        <div className="nav-content">
        <div className="nav-left">
  <h1 className="nav-logo">
    <img src="/WebAssets/LEGENDIUM.svg" alt="Legendium" />
  </h1>
</div>
          <div className="nav-right">
            {!user ? (
              <>
                <button className="nav-register-btn" onClick={() => scrollToSection(5)}>Subscribe</button>
                <button className="nav-login-btn" onClick={onLoginOpen}>
                  <span className="nav-login-btn-inner">Login</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  className="nav-profile-btn" 
                  onClick={() => { window.location.hash = '#/profile'; }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', borderRadius: '50%', overflow: 'hidden', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img 
                    src={avatarSrc} 
                    alt="Profile" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', border: '2px solid rgba(0, 255, 255, 0.3)' }}
                  />
                </button>
                <button className="nav-login-btn" onClick={logout}>Logout</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="scrollable-content">

        {/* --- HERO SECTION --- */}
        <section className="hero-section content-section">
          <div className="hero-background"></div>
          
          <div className="hero-content" data-reveal>
            <div className="hero-text">
              <h1 className="hero-title">
                <span className="title-line">Beautiful Game,</span>
                <span className="title-line">Intense Reality</span>
              </h1>
              <p className="hero-description">
                Experience the future of interactive storytelling in 
                virtual reality.
              </p>
              <div className="hero-buttons">
                {user ? (
                  <button className="start-button" onClick={() => (window.location.href = "./scene-select.html")}>
                    <svg width="15" height="10" viewBox="0 0 24 24" fill="none"><path d="M8 5V19L19 12L8 5Z" fill="currentColor" /></svg>
                    START EXPERIENCE
                  </button>
                ) : (
                  <button className="hero-login-btn" onClick={onLoginOpen}>
                    Subscribe
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="features-section content-section">
          <div className="section-content" data-reveal>
            <div className="section-header">
              <div className="section-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/>
                </svg>
                <span>Advanced Technology</span>
              </div>
              <h2 className="section-title">FEATURES</h2>
              <h3 className="section-subtitle">What Makes Us Special</h3>
              <p className="section-description">
                Discover the cutting-edge features that make this experience truly unique and immersive.
              </p>
            </div>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#ffffff" strokeWidth="1" fill="none"/>
                    <path d="M12 16L14 18L20 14" stroke="#ffffff" strokeWidth="1"/>
                  </svg>
                </div>
                <h4>VR Support</h4>
                <p>Full virtual reality compatibility with all major headsets including Oculus and Valve Index</p>
                <div className="feature-highlight">Compatible</div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#ffffff" strokeWidth="1" fill="none"/>
                    <path d="M10 16C10 12.7 12.7 10 16 10C19.3 10 22 12.7 22 16C22 19.3 19.3 22 16 22" stroke="#ffffff" strokeWidth="1"/>
                    <circle cx="16" cy="16" r="2" fill="#ffffff"/>
                  </svg>
                </div>
                <h4>Multiplayer</h4>
                <p>Connect with friends and explore together in real-time with seamless synchronization</p>
                <div className="feature-highlight">Real-time</div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#ffffff" strokeWidth="1" fill="none"/>
                    <path d="M8 16L12 12L16 16L20 12L24 16" stroke="#ffffff" strokeWidth="1"/>
                  </svg>
                </div>
                <h4>Real-time</h4>
                <p>Instant updates and seamless synchronization across all devices and platforms</p>
                <div className="feature-highlight">Instant</div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#ffffff" strokeWidth="1" fill="none"/>
                    <path d="M12 12L20 20M20 12L12 20" stroke="#ffffff" strokeWidth="1"/>
                    <circle cx="16" cy="16" r="2" fill="#ffffff"/>
                  </svg>
                </div>
                <h4>AI Characters</h4>
                <p>Intelligent NPCs that adapt to your actions and provide dynamic storytelling and perfomance</p>
                <div className="feature-highlight">Adaptive</div>
              </div>
            </div>
          </div>
        </section>

        <section className="circuit-demo-section content-section">
          <div className="section-content" data-reveal>
            <div className="circuit-demo-content">
              <div className="circuit-info">
                <div className="circuit-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                  <span>Interactive Demo</span>
                </div>
                <h2 className="circuit-title">CIRCUIT SOLVING</h2>
                <h3 className="circuit-subtitle">Interactive Electrical Puzzles</h3>
                <p className="circuit-description">
                  Experience our cutting-edge circuit solving technology in virtual reality.
                  Test your electrical engineering skills with interactive 3D circuit puzzles
                  that respond to your actions in real-time.
                </p>
                <div className="circuit-features">
                  <div className="circuit-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                    <span>Real-time Circuit Simulation</span>
                  </div>
                  <div className="circuit-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                    <span>Interactive 3D Components</span>
                  </div>
                  <div className="circuit-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                    <span>VR-Compatible Controls</span>
                  </div>
                  <div className="circuit-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                    <span>Multiple Difficulty Levels</span>
                  </div>
                </div>
                <button className="cta-button primary" onClick={openCircuitDemo}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg>
                  START DEMO
                </button>
              </div>
              <div className="circuit-preview">
                <div className="circuit-board">
                  <div className="circuit-lines">
                    <div className="circuit-line"></div>
                    <div className="circuit-line"></div>
                    <div className="circuit-line"></div>
                  </div>
                  <div className="circuit-components">
                    <div className="circuit-component">
                      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <rect x="15" y="15" width="50" height="50" rx="6" stroke="#00ff88" strokeWidth="3" fill="none"/>
                        <circle cx="25" cy="25" r="4" fill="#00ff88"/>
                        <circle cx="55" cy="55" r="4" fill="#00ff88"/>
                        <path d="M25 25L55 55" stroke="#00ff88" strokeWidth="3"/>
                      </svg>
                    </div>
                    <div className="circuit-component">
                      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
                        <circle cx="35" cy="35" r="25" stroke="#ff6b6b" strokeWidth="3" fill="none"/>
                        <path d="M20 35L35 50L50 20" stroke="#ff6b6b" strokeWidth="3"/>
                      </svg>
                    </div>
                    <div className="circuit-component">
                      <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                        <rect x="8" y="8" width="44" height="44" rx="4" stroke="#4ecdc4" strokeWidth="3" fill="none"/>
                        <circle cx="20" cy="20" r="3" fill="#4ecdc4"/>
                        <circle cx="40" cy="40" r="3" fill="#4ecdc4"/>
                      </svg>
                    </div>
                    <div className="circuit-component">
                      <svg width="75" height="75" viewBox="0 0 75 75" fill="none">
                        <polygon points="37.5,15 60,35 37.5,55 15,35" stroke="#ffd93d" strokeWidth="3" fill="none"/>
                        <circle cx="37.5" cy="35" r="10" fill="#ffd93d" opacity="0.3"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="scenes-section content-section">
          <div className="section-content" data-reveal>
            <div className="section-header">
              <div className="section-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                <span>Multiple Worlds</span>
              </div>
              <h2 className="section-title">SCENES</h2>
              <h3 className="section-subtitle">Multiple Worlds to Explore</h3>
              <p className="section-description">
                From mystical forests to futuristic cities, each scene offers unique experiences and challenges.
              </p>
            </div>
            <div className="scenes-grid">
              {[
                { name: 'Mystical Forest', image: '/mysticforest.jpg' },
                { name: 'Futuristic City', image: '/futuristiccity.jpg' },
                { name: 'Robotics University', image: '/roboticsuniversity.png' },
                { name: 'Underground Lab', image: '/undergroundlab.jpg' },
                { name: 'Robotic Assembly', image: '/roboticassembly.jpg' },
                { name: 'Component Lesson', image: '/roboticassembly.jpg' },
              ].map((scene, index) => (
                <div key={index} className="scene-card">
                  <div className="scene-image">
                    <img src={scene.image} alt={scene.name} className="scene-img" loading="lazy" />
                    <div className="scene-overlay"></div>
                  </div>
                  <h4>{scene.name}</h4>
                  <p>Explore the unique environment of {scene.name.toLowerCase()}</p>
                  <div className="scene-badge">Scene {index + 1}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="characters-section content-section">
          <div className="section-content" data-reveal>
            <div className="section-header">
              <div className="section-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                <span>Choose Your Hero</span>
              </div>
              <h2 className="section-title">CHARACTERS</h2>
              <p className="section-description">
                Select from our diverse cast of characters, each with unique abilities and stories.
              </p>
            </div>
            <div className="characters-container">
              <div className="character-card">
                <div className="character-grid">
                  <div className="character-text">
                    <h4>ELECTRO</h4>
                    <p>Electro is a master of circuits and currents, wielding the power of electricity to solve intricate puzzles and outsmart formidable foes in the virtual world. With unparalleled technical expertise, he hacks through digital barriers and harnesses energy flows to turn the tide of any adventure.</p>
                  </div>
                  <div className="character-model">
                    {showModel && (
                      <Suspense fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px' }}>Loading 3D Model...</div>}>
                        <Canvas
                          camera={{ position: [0, 0, 2], fov: 40 }}  
                          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                          gl={{ 
                            preserveDrawingBuffer: true, 
                            antialias: false,
                            powerPreference: 'low-power'
                          }}
                          dpr={1}
                          shadows={false}
                        >
                          <ambientLight intensity={0.3} />
                          <pointLight position={[10, 10, 10]} intensity={0.5} />
                          <Model />  
                          <Environment preset="night" background={false} />
                        </Canvas>
                      </Suspense>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="subscribe-section content-section">
          <div className="section-content" data-reveal>
            <div className="section-header">
              <div className="section-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                <span>Premium Plans</span>
              </div>
              <h2 className="section-title">SUBSCRIBE</h2>
              <h3 className="section-subtitle">Choose Your Plan</h3>
            </div>
            <div className="subscribe-cards">
              <div className="subscribe-card">
                <div className="card-header">
                  <div className="plan-icon">
                  </div>
                  <h3>Essential</h3>
                  <div className="price-container">
                    <span className="price">$8.99</span>
                    <span className="period">/month</span>
                  </div>
                  <div className="duration">1 Month Plan</div>
                </div>
                <div className="card-features">
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#b38170"/></svg><span>Rating Mechanism</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#b38170"/></svg><span>Exclusive Backgrounds</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#b38170"/></svg><span>Extra Content</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#b38170"/></svg><span>Game Help</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#b38170"/></svg><span>Deck Sharing</span></div>
                </div>
                <button className="subscribe-btn">
                  <span>Choose Plan</span>
                </button>
              </div>
              <div className="subscribe-card featured">
                <div className="popular-badge">Most Popular</div>
                <div className="card-header">
                  <div className="plan-icon">
                  </div>
                  <h3>Extra</h3>
                  <div className="price-container">
                    <span className="price">$21.99</span>
                    <span className="period">/month</span>
                  </div>
                  <div className="duration">3 Months Plan</div>
                  <div className="savings">Save 14%</div>
                </div>
                <div className="card-features">
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#d4af37"/></svg><span>Rating Mechanism</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#d4af37"/></svg><span>Exclusive Backgrounds</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#d4af37"/></svg><span>Extra Content</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#d4af37"/></svg><span>Game Help</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#d4af37"/></svg><span>Deck Sharing</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#d4af37"/></svg><span>Deck Unlock Guides</span></div>
                </div>
                <button className="subscribe-btn featured">
                  <span>Choose Plan</span>
                </button>
              </div>
              <div className="subscribe-card">
                <div className="card-header">
                  <div className="plan-icon">
                  </div>
                  <h3>Deluxe</h3>
                  <div className="price-container">
                    <span className="price">$45.99</span>
                    <span className="period">/month</span>
                  </div>
                  <div className="duration">6 Months Plan</div>
                  <div className="savings">Save 7%</div>
                </div>
                <div className="card-features">
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#E5E4E2"/></svg><span>Rating Mechanism</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#E5E4E2"/></svg><span>Exclusive Backgrounds</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#E5E4E2"/></svg><span>Extra Content</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#E5E4E2"/></svg><span>Game Help</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#E5E4E2"/></svg><span>Deck Sharing</span></div>
                  <div className="feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#E5E4E2"/></svg><span>Monthly Card Packs</span></div>
                </div>
                <button className="subscribe-btn">
                  <span>Choose Plan</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="start-section content-section">
          <div className="section-content" data-reveal>
            <div className="section-header">
              <div className="section-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/></svg>
                <span>Ready to Begin</span>
              </div>
              <h2 className="section-title">READY TO START?</h2>
              <h3 className="section-subtitle">Begin Your Adventure</h3>
              <p className="section-description">
                Click the button below to start your immersive VR experience and begin your journey.
              </p>
            </div>
            <div className="start-content">
              <div className="start-features">
                <div className="start-feature">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/>
                  </svg>
                  <span>7 Unique Scenes</span>
                </div>
                <div className="start-feature">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/>
                  </svg>
                  <span>2 Playable Characters</span>
                </div>
                <div className="start-feature">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ffffff"/>
                  </svg>
                  <span>VR Compatible</span>
                </div>
              </div>
              {user && (
                <button className="start-button" onClick={() => window.location.href = './scene-select.html'}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg>
                  START EXPERIENCE
                </button>
              )}
            </div>
          </div>
        </section>

      </main> 

    </div> 
  );
}