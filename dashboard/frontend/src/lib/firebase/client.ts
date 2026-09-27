import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { FIREBASE_CONFIG, FIREBASE_CONFIGURED } from '../config';

let app: FirebaseApp | null = null;

/** Lazily initialised Firebase app; null until the NEXT_PUBLIC_FIREBASE_* env is set. */
export const firebaseApp = (): FirebaseApp | null => {
  if (!FIREBASE_CONFIGURED) return null;
  app ??= getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  return app;
};

export const firebaseAuth = (): Auth | null => {
  const a = firebaseApp();
  return a ? getAuth(a) : null;
};
