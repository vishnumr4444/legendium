import React, { useState, useEffect } from 'react';
import { WebsiteSections } from './components/WebsiteSections';
import { AuthProvider } from './components/AuthContext';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import CenterNav from './components/CenterNav';
import './styles/WebsiteStyles.css';

/**
 * Main landing SPA for the Legendium website.
 *
 * Responsibilities:
 * - Tracks which scroll "section" is active for navigation dots / center nav
 * - Shows or hides the authentication modal
 * - Handles a simple hash‑based "routing" to a profile page (`#/profile`)
 */
function App() {
  const [currentSection, setCurrentSection] = useState(0);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [route, setRoute] = useState(window.location.hash || '');

  // Attach scroll + hashchange listeners and compute the current section index.
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const sectionHeight = window.innerHeight * 1.2;
      const newSection = Math.floor(scrollPosition / sectionHeight);
      setCurrentSection(newSection);
    };
    const onHashChange = () => setRoute(window.location.hash || '');

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('hashchange', onHashChange);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  /**
   * Smoothly scroll to the given content section.
   *
   * @param {number} index - 0‑based index of the section to scroll to.
   */
  const scrollToSection = (index) => {
    window.scrollTo({
      top: index * (window.innerHeight * 1.2),
      behavior: 'smooth',
    });
  };

  // Updated to use 0-based indexing consistent with navigation dots and WebsiteSections.
  const handleCenterNavClick = (index) => {
    scrollToSection(index); // index is 0-based (0 for hero/first section, up to 5 or 6 as needed)
  };

  return (
    <AuthProvider>
      <div className="app">
        {/* Overlay added here for full app coverage */}
        <div className="overlay"></div>
        
        {route !== '#/profile' && (
          <>
            <div className="navigation-dots">
              {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                <div
                  key={index}
                  className={`nav-dot ${currentSection === index ? 'active' : ''}`}
                  onClick={() => scrollToSection(index)}
                >
                  <div className="nav-dot-inner"></div>
                </div>
              ))}
            </div>

            {!showAuthPage && (
              <CenterNav
                activeIndex={currentSection}
                onClick={handleCenterNavClick}
              />
            )}
          </>
        )}

        {route === '#/profile' ? (
          <ProfilePage />
        ) : (
          <>
            <WebsiteSections
              scrollToSection={scrollToSection}
              onLoginOpen={() => setShowAuthPage(true)}
              onRegisterOpen={() => setShowAuthPage(true)}
            />
            {showAuthPage && <AuthPage onClose={() => setShowAuthPage(false)} />}
          </>
        )}
      </div>
    </AuthProvider>
  );
}

export default App;