/**
 * Mock-mode test controls (TRD: "simulate errors and slow responses so Loading /
 * Error states are testable without a backend"). Stored per browser.
 */
export interface MockControls {
  latencyMs: number;
  failRate: number; // 0..1
  empty: boolean;
  stale: boolean;
}

export const DEFAULT_CONTROLS: MockControls = { latencyMs: 350, failRate: 0, empty: false, stale: false };
const KEY = 'afx-mock-controls';

export const readControls = (): MockControls => {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_CONTROLS, ...JSON.parse(raw) } : DEFAULT_CONTROLS;
  } catch {
    return DEFAULT_CONTROLS;
  }
};

export const writeControls = (next: MockControls) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: controls just don't persist */
  }
};
