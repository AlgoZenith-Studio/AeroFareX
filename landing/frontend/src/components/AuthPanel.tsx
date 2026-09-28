import React, { useId, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useUserAuth } from '../lib/userAuth';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password don’t match an account.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

/** Sign in / create account for travellers. Used by the search-limit dialog and /account. */
export const AuthPanel: React.FC<{ initialMode?: 'signin' | 'signup' }> = ({ initialMode = 'signup' }) => {
  const { configured, signInWithEmail, signUp, signInWithGoogle, resetPassword } = useUserAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordId = useId();

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg({ kind: 'info', text: done });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof FirebaseError ? MESSAGES[e.code] ?? e.message : (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return <div className="auth-panel"><p className="auth-msg" data-kind="error">Sign-in isn’t configured on this site yet.</p></div>;
  }

  const signup = mode === 'signup';
  return (
    <div className="auth-panel">
      <div className="auth-tabs" role="group" aria-label="Account">
        <button type="button" aria-pressed={signup} onClick={() => { setMode('signup'); setMsg(null); }}>Create account</button>
        <button type="button" aria-pressed={!signup} onClick={() => { setMode('signin'); setMsg(null); }}>Sign in</button>
      </div>

      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run(signInWithGoogle)}>
        <img className="auth-google-icon" src="/google-g.svg" alt="" aria-hidden="true" />
        Continue with Google
      </button>
      <p className="auth-or">or with email</p>

      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => (signup ? signUp(name, email, password) : signInWithEmail(email, password)));
        }}
      >
        {signup && (
          <label className="auth-field">
            Your name
            <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
          </label>
        )}
        <label className="auth-field">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <div className="auth-field">
          <span className="auth-field-heading">
            <label htmlFor={passwordId}>Password</label>
            {!signup && (
              <button
                type="button"
                className="auth-link"
                onClick={() => (email
                  ? void run(() => resetPassword(email), `If ${email} has an account, a reset link is on its way.`)
                  : setMsg({ kind: 'error', text: 'Enter your email first, then choose “Forgot password?”.' }))}
              >
                Forgot password?
              </button>
            )}
          </span>
          <div className="auth-password-input">
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder={signup ? 'At least 8 characters' : '••••••••'}
            />
            <button
              type="button"
              className="auth-password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {msg && <p className="auth-msg" data-kind={msg.kind} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Create free account' : 'Sign in'} {!busy && <ArrowRight size={17} aria-hidden="true" />}
        </button>
      </form>
      <p className="auth-fine">
        <LockKeyhole size={14} aria-hidden="true" />
        <span>No ads. Delete your searches, saved routes, or account at any time.</span>
      </p>
    </div>
  );
};
