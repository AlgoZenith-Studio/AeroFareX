import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword, deleteUser, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, updateProfile, type User,
} from 'firebase/auth';
import { FIREBASE_READY, MOCK_AUTH, firebaseAuth } from './firebase';
import { seedDemoHistory } from './userStore';

/** Public (traveller) accounts on the landing site. Optional: search works without one. */
export interface PublicUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  createdAt: string | null;
}

interface UserAuthState {
  ready: boolean; // first auth state known
  configured: boolean;
  user: PublicUser | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<UserAuthState | null>(null);

const toPublic = (u: User): PublicUser => ({
  uid: u.uid,
  name: u.displayName ?? u.email?.split('@')[0] ?? 'Traveller',
  email: u.email ?? '',
  photoURL: u.photoURL,
  createdAt: u.metadata.creationTime ?? null,
});

// ---------------------------------------------------------------- mock accounts (VITE_MOCK_AUTH)
const MOCK_KEY = 'afx-mock-user';
const readMock = (): PublicUser | null => {
  try { return JSON.parse(localStorage.getItem(MOCK_KEY) ?? 'null') as PublicUser | null; } catch { return null; }
};
const mockSignIn = (name: string, email: string, photoURL: string | null = null): PublicUser => {
  const u: PublicUser = {
    uid: `mock-${email.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    name: name || email.split('@')[0],
    email,
    photoURL,
    createdAt: new Date(Date.now() - 42 * 86_400_000).toISOString(),
  };
  localStorage.setItem(MOCK_KEY, JSON.stringify(u));
  seedDemoHistory(u.uid);
  return u;
};
const pause = () => new Promise((r) => setTimeout(r, 450));

export const UserAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(!FIREBASE_READY);
  const [user, setUser] = useState<PublicUser | null>(() => (MOCK_AUTH ? readMock() : null));

  useEffect(() => {
    if (MOCK_AUTH) return;
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? toPublic(u) : null);
      setReady(true);
    });
  }, []);

  const need = () => {
    const auth = firebaseAuth();
    if (!auth) throw new Error('Sign-in isn’t configured on this site yet.');
    return auth;
  };

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (MOCK_AUTH) { await pause(); setUser(mockSignIn('', email)); return; }
    await signInWithEmailAndPassword(need(), email, password);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (MOCK_AUTH) { await pause(); setUser(mockSignIn(name.trim(), email)); return; }
    const { user: u } = await createUserWithEmailAndPassword(need(), email, password);
    if (name.trim()) {
      await updateProfile(u, { displayName: name.trim() });
      setUser(toPublic(u));
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (MOCK_AUTH) { await pause(); setUser(mockSignIn('Demo Traveller', 'demo.traveller@gmail.com')); return; }
    await signInWithPopup(need(), new GoogleAuthProvider());
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (MOCK_AUTH) { await pause(); return; }
    await sendPasswordResetEmail(need(), email);
  }, []);

  const signOut = useCallback(async () => {
    if (MOCK_AUTH) { localStorage.removeItem(MOCK_KEY); setUser(null); return; }
    const auth = firebaseAuth();
    if (auth) await fbSignOut(auth);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (MOCK_AUTH) { localStorage.removeItem(MOCK_KEY); setUser(null); return; }
    const current = firebaseAuth()?.currentUser;
    if (current) await deleteUser(current);
  }, []);

  const value = useMemo<UserAuthState>(() => ({
    ready, configured: FIREBASE_READY || MOCK_AUTH, user,
    signInWithEmail, signUp, signInWithGoogle, resetPassword, signOut, deleteAccount,
  }), [ready, user, signInWithEmail, signUp, signInWithGoogle, resetPassword, signOut, deleteAccount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useUserAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserAuth must be used inside <UserAuthProvider>.');
  return ctx;
};
