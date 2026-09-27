#!/usr/bin/env node
/**
 * Grant a dashboard role to a Firebase user by setting the `role` custom claim.
 *
 *   npm run set-role -- <email> <ANALYST|ADMIN|NONE>
 *
 * ANALYST opens the dashboard (ADMIN has the same access for now). NONE revokes it.
 *
 * Needs a Firebase service-account key: set GOOGLE_APPLICATION_CREDENTIALS to its
 * path (never commit the file). The user sees the new role after their token
 * refreshes (sign out and in, or within the hour).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [email, role] = process.argv.slice(2);
const ROLES = ['ANALYST', 'ADMIN', 'NONE'];

if (!email || !ROLES.includes(role)) {
  console.error('Usage: npm run set-role -- <email> <ANALYST|ADMIN|NONE>');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service-account JSON path.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const { role: _previous, ...otherClaims } = user.customClaims ?? {};
await auth.setCustomUserClaims(user.uid, role === 'NONE' ? otherClaims : { ...otherClaims, role });
console.log(`${email}: role ${role === 'NONE' ? 'removed' : `set to ${role}`}.`);
