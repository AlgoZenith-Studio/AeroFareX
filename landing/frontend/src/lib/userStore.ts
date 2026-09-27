import {
  addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc, writeBatch,
} from 'firebase/firestore';
import { firestore } from './firebase';

/**
 * A signed-in traveller's search history and saved routes.
 *
 * Stored in Firestore under users/{uid}/... (rules: infra/firebase/firestore.rules
 * let each user read and write only their own documents). If Firestore isn't
 * enabled or reachable, it falls back to this browser's storage so the feature
 * still works; `where` tells the UI which one is in use.
 */
export interface SearchRecord {
  id: string;
  from: string; // IATA
  to: string;
  date: string; // YYYY-MM-DD
  at: string; // ISO timestamp of the search
  cheapestPaise: number | null;
}

export interface SavedRoute {
  id: string; // `${from}-${to}`
  from: string;
  to: string;
  at: string;
}

export type StoreLocation = 'cloud' | 'device';

const localKey = (uid: string, kind: 'searches' | 'saved') => `afx-${kind}-${uid}`;
const readLocal = <T,>(uid: string, kind: 'searches' | 'saved'): T[] => {
  try { return JSON.parse(localStorage.getItem(localKey(uid, kind)) ?? '[]') as T[]; } catch { return []; }
};
const writeLocal = <T,>(uid: string, kind: 'searches' | 'saved', rows: T[]) => {
  try { localStorage.setItem(localKey(uid, kind), JSON.stringify(rows)); } catch { /* storage full or blocked */ }
};

let cloudOk = true; // flips to false after the first Firestore failure this session

async function withFallback<T>(cloud: () => Promise<T>, device: () => T): Promise<{ value: T; where: StoreLocation }> {
  const db = firestore();
  if (db && cloudOk) {
    try {
      return { value: await cloud(), where: 'cloud' };
    } catch {
      cloudOk = false;
    }
  }
  return { value: device(), where: 'device' };
}

export const listSearches = (uid: string) => withFallback(
  async () => {
    const snap = await getDocs(query(collection(firestore()!, 'users', uid, 'searches'), orderBy('at', 'desc'), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SearchRecord, 'id'>) }));
  },
  () => readLocal<SearchRecord>(uid, 'searches'),
);

export const addSearch = (uid: string, rec: Omit<SearchRecord, 'id'>) => withFallback(
  async () => { await addDoc(collection(firestore()!, 'users', uid, 'searches'), rec); },
  () => {
    const rows = readLocal<SearchRecord>(uid, 'searches');
    writeLocal(uid, 'searches', [{ id: crypto.randomUUID(), ...rec }, ...rows].slice(0, 50));
  },
);

export const deleteSearch = (uid: string, id: string) => withFallback(
  async () => { await deleteDoc(doc(firestore()!, 'users', uid, 'searches', id)); },
  () => writeLocal(uid, 'searches', readLocal<SearchRecord>(uid, 'searches').filter((r) => r.id !== id)),
);

export const clearSearches = (uid: string) => withFallback(
  async () => {
    const snap = await getDocs(collection(firestore()!, 'users', uid, 'searches'));
    const batch = writeBatch(firestore()!);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },
  () => writeLocal(uid, 'searches', []),
);

export const listSaved = (uid: string) => withFallback(
  async () => {
    const snap = await getDocs(collection(firestore()!, 'users', uid, 'saved'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedRoute, 'id'>) }));
  },
  () => readLocal<SavedRoute>(uid, 'saved'),
);

export const toggleSaved = (uid: string, from: string, to: string, save: boolean) => withFallback(
  async () => {
    const ref = doc(firestore()!, 'users', uid, 'saved', `${from}-${to}`);
    if (save) await setDoc(ref, { from, to, at: new Date().toISOString() });
    else await deleteDoc(ref);
  },
  () => {
    const rows = readLocal<SavedRoute>(uid, 'saved').filter((r) => r.id !== `${from}-${to}`);
    writeLocal(uid, 'saved', save ? [{ id: `${from}-${to}`, from, to, at: new Date().toISOString() }, ...rows] : rows);
  },
);

/** Mock accounts only: a few past searches and saved routes so the account page has content. */
export const seedDemoHistory = (uid: string) => {
  if (localStorage.getItem(localKey(uid, 'searches'))) return;
  const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  writeLocal<SearchRecord>(uid, 'searches', [
    { id: crypto.randomUUID(), from: 'DEL', to: 'BOM', date: day(14), at: ago(3), cheapestPaise: 553800 },
    { id: crypto.randomUUID(), from: 'BLR', to: 'HYD', date: day(6), at: ago(27), cheapestPaise: 412300 },
    { id: crypto.randomUUID(), from: 'DEL', to: 'CCU', date: day(30), at: ago(52), cheapestPaise: 468900 },
    { id: crypto.randomUUID(), from: 'BOM', to: 'BLR', date: day(-2), at: ago(170), cheapestPaise: 389500 },
  ]);
  writeLocal<SavedRoute>(uid, 'saved', [
    { id: 'DEL-BOM', from: 'DEL', to: 'BOM', at: ago(3) },
    { id: 'BLR-HYD', from: 'BLR', to: 'HYD', at: ago(27) },
  ]);
};

/** Everything we hold for this user (used before deleting the account). */
export const deleteAllUserData = async (uid: string) => {
  await clearSearches(uid);
  const saved = await listSaved(uid);
  for (const s of saved.value) await toggleSaved(uid, s.from, s.to, false);
  try { localStorage.removeItem(localKey(uid, 'searches')); localStorage.removeItem(localKey(uid, 'saved')); } catch { /* ignore */ }
};
