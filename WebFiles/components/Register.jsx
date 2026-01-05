import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import './LoginRegister.css';

/**
 * Simple registration modal that wraps `AuthContext.register` and
 * displays friendly error messages for common Firebase auth failures.
 *
 * @param {{ onClose?: () => void }} props
 */
export default function Register({ onClose }) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Map Firebase auth error codes to human-readable registration messages.
  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please try logging in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled. Please contact support.';
      default:
        return 'Registration failed. Please try again.';
    }
  };

  // Submit handler for registration; performs basic client-side validation.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      onClose && onClose();
    } catch (err) {
      console.error('Registration error:', err);
      setError(getErrorMessage(err.code));
    }
    setLoading(false);
  };

  return (
    <div className="auth-modal-bg">
      <div className="auth-modal">
        <button className="auth-close" onClick={onClose}>&times;</button>
        <h2>Register</h2>
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
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
