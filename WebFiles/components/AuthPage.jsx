import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import './AuthPage.css';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Full-screen authentication overlay that lets the user sign in or register.
 *
 * Behavior:
 * - Uses `AuthContext` to perform login/register
 * - Writes displayName into Firestore on successful registration
 * - Shows error/info messages and loading states
 *
 * @param {{ onClose?: () => void }} props
 */
export default function AuthPage({ onClose }) {
  const { login, register } = useAuth();
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // NEW STATES for show/hide password
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Handles login form submission using email/password auth.
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      onClose && onClose();
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    }
    setLoading(false);
  };

  // Handles register form submission and optional displayName update.
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await register(registerEmail, registerPassword);
      if (registerName.trim()) {
        await updateDoc(doc(db, 'users', cred.user.uid), { displayName: registerName.trim() });
      }
      setInfo('Registration successful! You can now log in.');
      setShowLogin(true);
    } catch (err) {
      setError(
        'Registration failed. ' +
          (err.code === 'auth/email-already-in-use' ? 'Email already registered.' : '')
      );
    }
    setLoading(false);
  };

  return (
    <>
      <div className="auth-bg-gradient"></div>
      
      <div className="auth-svg-card">
        {/* Left Panel: Simple Image/Welcome Side */}
        <div className="auth-left">
          <h2>Welcome Back!</h2>
          <p>Provide your personal details to use all features</p>
        </div>

        {/* Right Panel: Simple Login/Register Content */}
        <div className="auth-right">
          <button className="authpage-close" onClick={onClose}>
            &times;
          </button>

          {showLogin ? (
            <>
              <h2>Sign In</h2>
              <form className="auth-login-form" onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                /> 
                {/* Password with toggle */}
                <div className="auth-password-wrapper">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
     
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                  >
                    <i className={`fa ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>

                {error && <div className="authpage-error">{error}</div>}
                <button type="submit" className="auth-signin-btn" disabled={loading}>
                  {loading ? 'Signing in...' : 'SIGN IN'}
                </button>
                <p className="auth-toggle-text">
                  Don't have an account?{' '}
                  <span
                    onClick={() => {
                      setShowLogin(false);
                      setError('');
                      setInfo('');
                    }}
                  >
                    Sign up
                  </span>
                </p>
              </form>
            </>
          ) : (
            <>
              <h2>Register</h2>
              <form className="auth-register-form" onSubmit={handleRegister}>
                <input
                  type="text"
                  placeholder="Name"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />

                {/* Password with toggle */}
                <div className="auth-password-wrapper">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
                  >
                    <i className={`fa ${showRegisterPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>

                {error && <div className="authpage-error">{error}</div>}
                {info && <div className="authpage-info">{info}</div>}
                <button type="submit" className="auth-signup-btn" disabled={loading}>
                  {loading ? 'Signing up...' : 'SIGN UP'}
                </button>
                <p className="auth-toggle-text">
                  Already have an account?{' '}
                  <span
                    onClick={() => {
                      setShowLogin(true);
                      setError('');
                      setInfo('');
                    }}
                  >
                    Sign in
                  </span>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}