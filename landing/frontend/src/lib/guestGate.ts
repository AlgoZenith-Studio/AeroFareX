/**
 * Guest allowance on the fare search: 5 free searches, then the sign-in prompt
 * appears (only after the 5th search is used). Counted in this browser only.
 */
export const GUEST_SEARCHES = 5;
const KEY = 'afx-guest';

interface Guest { searches: number }

const read = (): Guest => {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Guest | null) ?? { searches: 0 }; } catch { return { searches: 0 }; }
};

/** Kept for call-site compatibility; the allowance no longer has a time limit. */
export const startGuestClock = () => {};

export const recordGuestSearch = () => {
  try { localStorage.setItem(KEY, JSON.stringify({ searches: read().searches + 1 })); } catch { /* ignore */ }
};

export const guestStatus = () => {
  const searchesLeft = Math.max(0, GUEST_SEARCHES - read().searches);
  return { searchesLeft, exhausted: searchesLeft === 0 };
};
