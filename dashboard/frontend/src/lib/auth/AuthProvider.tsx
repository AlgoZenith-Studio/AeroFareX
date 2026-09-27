'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onIdTokenChanged, sendPasswordResetEmail, signInWithEmailAndPassword,
  updateProfile, signInWithPopup, signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import type { Role } from '@aerofarex/shared-types';
import { DEV_ROLE, FIREBASE_CONFIGURED } from '../config';
import { firebaseAuth } from '../firebase/client';
import { setTokenGetter } from '../api/client';

/**
 * Firebase Auth with role-based access from the `role` custom claim
 * (ANALYST, or ADMIN which has the same access). A signed-in user without it gets no
 * access ('no-role'): default deny. Roles are granted with scripts/set-role.mjs.
 */
export type AuthStatus = 'loading' | 'unconfigured' | 'signed-out' | 'no-role' | 'ready';

interface AuthState {
  status: AuthStatus;
  user: { name: string; email: string; photoURL: string | null; method: string; lastSignIn: string | null } | null;
  role: Role | null;
  isDevPreview: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Request access: creates an account with no role; an admin must approve it. */
  signUp: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Dev preview only: sign back in as NEXT_PUBLIC_AUTH_DEV_ROLE after signing out. */
  signInDevPreview: () => void;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
/** Roles that open the dashboard. VIEWER is no longer a dashboard role (public users use the landing site). */
const ROLES: Role[] = ['ANALYST', 'ADMIN'];
/** Dev preview "signed out" flag, per browser tab. */
const DEV_SIGNED_OUT = 'afx-dev-signed-out';
const METHOD: Record<string, string> = { password: 'Email and password', 'google.com': 'Google' };

const roleFromClaims = (claims: Record<string, unknown>): Role | null =>
  ROLES.includes(claims.role as Role) ? (claims.role as Role) : null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (DEV_ROLE) {
      const signedOut = window.sessionStorage.getItem(DEV_SIGNED_OUT) === '1';
      setRole(signedOut ? null : DEV_ROLE);
      setStatus(signedOut ? 'signed-out' : 'ready');
      return;
    }
    const auth = firebaseAuth();
    if (!auth) {
      setStatus(FIREBASE_CONFIGURED ? 'signed-out' : 'unconfigured');
      return;
    }
    setTokenGetter(async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));
    return onIdTokenChanged(auth, async (user) => {
      setFbUser(user);
      if (!user) {
        setRole(null);
        setStatus('signed-out');
        return;
      }
      const { claims } = await user.getIdTokenResult();
      const next = roleFromClaims(claims);
      setRole(next);
      setStatus(next ? 'ready' : 'no-role');
    });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const auth = firebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = firebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const auth = firebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(user, { displayName: name.trim() });
      setFbUser({ ...user, displayName: name.trim() } as User);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const auth = firebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    await sendPasswordResetEmail(auth, email);
  }, []);

  const signOut = useCallback(async () => {
    if (DEV_ROLE) {
      window.sessionStorage.setItem(DEV_SIGNED_OUT, '1');
      setRole(null);
      setStatus('signed-out');
      return;
    }
    const auth = firebaseAuth();
    if (auth) await fbSignOut(auth);
  }, []);

  const signInDevPreview = useCallback(() => {
    if (!DEV_ROLE) return;
    window.sessionStorage.removeItem(DEV_SIGNED_OUT);
    setRole(DEV_ROLE);
    setStatus('ready');
  }, []);

  /** Force a token refresh, e.g. right after an admin grants a role. */
  const refreshRole = useCallback(async () => {
    const user = firebaseAuth()?.currentUser;
    if (!user) return;
    const { claims } = await user.getIdTokenResult(true);
    const next = roleFromClaims(claims);
    setRole(next);
    setStatus(next ? 'ready' : 'no-role');
  }, []);

  const value = useMemo<AuthState>(() => ({
    status,
    role,
    isDevPreview: Boolean(DEV_ROLE),
    user: DEV_ROLE
      ? status === 'ready'
        ? { name: `Preview ${DEV_ROLE.toLowerCase()}`, email: 'local preview (next dev)', photoURL: null, method: 'Dev preview (no Firebase)', lastSignIn: null }
        : null
      : fbUser
        ? {
            name: fbUser.displayName ?? fbUser.email ?? 'Analyst',
            email: fbUser.email ?? '',
            photoURL: fbUser.photoURL,
            method: METHOD[fbUser.providerData[0]?.providerId ?? ''] ?? 'Firebase',
            lastSignIn: fbUser.metadata.lastSignInTime ?? null,
          }
        : null,
    signInWithEmail, signInWithGoogle, signUp, resetPassword, signInDevPreview, signOut, refreshRole,
  }), [status, role, fbUser, signInWithEmail, signInWithGoogle, signUp, resetPassword, signInDevPreview, signOut, refreshRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
};

const RANK: Record<Role, number> = { VIEWER: 1, ANALYST: 2, ADMIN: 3 };
export const hasRole = (role: Role | null, min: Role) => Boolean(role && RANK[role] >= RANK[min]);
