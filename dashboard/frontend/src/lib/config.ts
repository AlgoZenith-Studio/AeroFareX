import type { Role } from '@aerofarex/shared-types';

/** All environment-driven settings in one place (see .env.example). */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
/** Public landing site (the "Back to website" link on the login page). */
export const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:5173';
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000/api/v1';

export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};
export const FIREBASE_CONFIGURED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

/**
 * Local preview only: when running `next dev`, NEXT_PUBLIC_AUTH_DEV_ROLE signs you
 * in as that role without Firebase. It is ignored in every production build.
 */
const devRole = process.env.NEXT_PUBLIC_AUTH_DEV_ROLE as Role | undefined;
export const DEV_ROLE: Role | null =
  process.env.NODE_ENV === 'development' && devRole && ['ANALYST', 'ADMIN'].includes(devRole) ? devRole : null;
