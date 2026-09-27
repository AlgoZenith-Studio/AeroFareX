import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase for public user accounts (fare search history, saved routes).
 * Same project as the analyst dashboard; public accounts never carry the
 * dashboard `role` claim, so they can't open it.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/**
 * Mock accounts (VITE_MOCK_AUTH=true): sign-up / sign-in work locally without
 * Firebase, and history is kept in this browser. For building and demos only.
 */
export const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
export const FIREBASE_READY = !MOCK_AUTH && Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
const firebaseApp = () => {
  if (!FIREBASE_READY) return null;
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
};

export const firebaseAuth = (): Auth | null => {
  const a = firebaseApp();
  return a ? getAuth(a) : null;
};

export const firestore = (): Firestore | null => {
  const a = firebaseApp();
  return a ? getFirestore(a) : null;
};
