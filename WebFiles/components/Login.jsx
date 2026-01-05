import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import './LoginRegister.css';

/**
 * Simple modal login form (email + password) that uses `AuthContext.login`.
 *
 * Displays user-friendly error messages based on Firebase error codes and
 * closes itself when login succeeds.
 *
 * @param {{ onClose?: () => void }} props
 */
export default function Login({ onClose }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Map Firebase auth error codes to human-readable messages.
  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email. Please register first.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return 'Login failed. Please check your credentials and try again.';
    }
  };

  // Submit handler for the login form.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      onClose && onClose();
    } catch (err) {
      console.error('Login error:', err);
      setError(getErrorMessage(err.code));
    }
    setLoading(false);
  };

  return (
    <div className="auth-modal-bg">
      <div className="auth-modal">
        <button className="auth-close" onClick={onClose}>&times;</button>
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
