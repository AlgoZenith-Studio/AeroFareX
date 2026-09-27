/**
 * Mock fare-comparison data for the public fare checker (/fares).
 *
 * Mirrors what the collector will provide: the five tracked routes, each flight
 * priced on the airline's own site and on booking platforms, split into the
 * advertised fare and what is added at checkout. Deterministic per search, so
 * the same search always shows the same prices. MONEY IS INTEGER PAISE.
 * Replace `searchFares` with a call to the public API when it exists.
 */
import { ROUTES } from './mockData';

export interface City { code: string; city: string; airport: string }

export const CITIES: City[] = [
  { code: 'DEL', city: 'Delhi', airport: 'Indira Gandhi International' },
  { code: 'BOM', city: 'Mumbai', airport: 'Chhatrapati Shivaji Maharaj International' },
  { code: 'BLR', city: 'Bengaluru', airport: 'Kempegowda International' },
  { code: 'CCU', city: 'Kolkata', airport: 'Netaji Subhas Chandra Bose International' },
  { code: 'HYD', city: 'Hyderabad', airport: 'Rajiv Gandhi International' },
];
export const cityOf = (code: string) => CITIES.find((c) => c.code === code);

/** Tracked routes, both directions. */
export const TRACKED: { from: string; to: string; basePaise: number }[] = ROUTES.flatMap((r) => {
  const [a, b] = r.id.split('-');
  return [
    { from: a, to: b, basePaise: r.baseFarePaise },
    { from: b, to: a, basePaise: Math.round(r.baseFarePaise * 0.97) },
  ];
});
export const isTracked = (from: string, to: string) => TRACKED.some((t) => t.from === from && t.to === to);
export const POPULAR = ROUTES.map((r) => { const [from, to] = r.id.split('-'); return { from, to }; });

export type PlatformKind = 'AIRLINE' | 'OTA';
export interface Platform { id: string; name: string; kind: PlatformKind }
const OTAS: Platform[] = [
  { id: 'makemytrip', name: 'MakeMyTrip', kind: 'OTA' },
  { id: 'easemytrip', name: 'EaseMyTrip', kind: 'OTA' },
  { id: 'ixigo', name: 'ixigo', kind: 'OTA' },
];
const CARRIERS = [
  { code: '6E', name: 'IndiGo', factor: 1 },
  { code: 'AI', name: 'Air India', factor: 1.09 },
  { code: 'QP', name: 'Akasa Air', factor: 0.96 },
  { code: 'SG', name: 'SpiceJet', factor: 0.93 },
];
const AIRPORT_FEE: Record<string, number> = { DEL: 41100, BOM: 51100, BLR: 44100, CCU: 38100, HYD: 42100 };

export interface PriceParts {
  advertisedPaise: number; // the fare shown first
  fuelPaise: number;
  airportPaise: number; // UDF + PSF
  gstPaise: number;
  platformPaise: number; // convenience / platform fee
  totalPaise: number; // what you pay at checkout
}
export interface Offer { platform: Platform; parts: PriceParts }
export interface Flight {
  carrier: string;
  carrierCode: string;
  flightNo: string;
  depart: string; // HH:MM
  arrive: string;
  duration: string;
  offers: Offer[]; // sorted cheapest total first
}
export interface SearchResult {
  from: string;
  to: string;
  date: string;
  daysAhead: number;
  flights: Flight[]; // sorted by cheapest total
  byDaysAhead: { days: number; label: string; cheapestPaise: number }[];
  seenAt: string; // when these prices were collected (ISO)
}

// ---------------------------------------------------------------- helpers
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
};
const round100 = (p: number) => Math.round(p / 100) * 100;
/** Price multiple by days ahead (T+1 about 3x T+45), interpolated. */
const CURVE: [number, number][] = [[1, 2.4], [7, 1.4], [15, 1], [30, 0.83], [45, 0.75]];
const curve = (days: number) => {
  const d = Math.min(45, Math.max(1, days));
  for (let i = 1; i < CURVE.length; i++) {
    const [d0, m0] = CURVE[i - 1];
    const [d1, m1] = CURVE[i];
    if (d <= d1) return m0 + ((m1 - m0) * (d - d0)) / (d1 - d0);
  }
  return CURVE[CURVE.length - 1][1];
};
const todayIso = () => new Date().toISOString().slice(0, 10);
export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
const isWeekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());
const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const parts = (base: number, origin: string, platform: Platform, rnd: () => number): PriceParts => {
  // OTAs often advertise slightly below the airline, then add a platform fee.
  const advertisedPaise = round100(platform.kind === 'OTA' ? base * (0.965 + rnd() * 0.03) : base);
  const fuelPaise = round100(advertisedPaise * 0.13);
  const airportPaise = AIRPORT_FEE[origin] ?? 40000;
  const gstPaise = Math.round((advertisedPaise + fuelPaise) * 0.05);
  const platformPaise = platform.kind === 'OTA' ? round100(35000 + rnd() * 20000) : 0;
  return {
    advertisedPaise, fuelPaise, airportPaise, gstPaise, platformPaise,
    totalPaise: advertisedPaise + fuelPaise + airportPaise + gstPaise + platformPaise,
  };
};

const cheapestFor = (from: string, to: string, date: string, days: number) => {
  const route = TRACKED.find((t) => t.from === from && t.to === to)!;
  let best = Infinity;
  for (const c of CARRIERS) {
    const rnd = hash(`${from}${to}${date}${c.code}${days}`);
    const base = route.basePaise * curve(days) * c.factor * (isWeekend(date) ? 1.18 : 1) * (0.94 + rnd() * 0.12);
    for (const p of [{ id: 'direct', name: c.name, kind: 'AIRLINE' as const }, ...OTAS]) {
      best = Math.min(best, parts(base, from, p, rnd).totalPaise);
    }
  }
  return best;
};

/** Mock search. Returns null for routes the collector doesn't track yet. */
export function searchFares(from: string, to: string, date: string): SearchResult | null {
  const route = TRACKED.find((t) => t.from === from && t.to === to);
  if (!route) return null;
  const daysAhead = Math.max(1, daysBetween(todayIso(), date));
  const flights: Flight[] = CARRIERS.flatMap((c, ci) => [0, 1].map((slot) => {
    const rnd = hash(`${from}${to}${date}${c.code}${slot}`);
    const dep = 330 + ci * 95 + slot * 420 + Math.floor(rnd() * 40);
    const dur = 125 + Math.floor(rnd() * 25) + (from === 'CCU' || to === 'CCU' ? 20 : 0);
    const base = route.basePaise * curve(daysAhead) * c.factor * (isWeekend(date) ? 1.18 : 1)
      * (slot === 0 ? 1.06 : 0.97) * (0.94 + rnd() * 0.12);
    const platforms: Platform[] = [{ id: 'direct', name: `${c.name} website`, kind: 'AIRLINE' }, ...OTAS];
    const offers = platforms
      .map((p) => ({ platform: p, parts: parts(base, from, p, rnd) }))
      .sort((a, b) => a.parts.totalPaise - b.parts.totalPaise);
    return {
      carrier: c.name, carrierCode: c.code, flightNo: `${c.code} ${100 + Math.floor(rnd() * 800)}`,
      depart: hhmm(dep), arrive: hhmm(dep + dur), duration: `${Math.floor(dur / 60)}h ${dur % 60}m`,
      offers,
    };
  })).sort((a, b) => a.offers[0].parts.totalPaise - b.offers[0].parts.totalPaise);

  const seen = new Date();
  seen.setMinutes(0, 0, 0);
  const slots = [2.5, 5.5, 13, 19]; // collection slots, IST
  const istHour = (seen.getUTCHours() + 5.5) % 24;
  const last = [...slots].reverse().find((s) => s <= istHour) ?? 19;
  seen.setUTCHours(Math.floor(last - 5.5 + 24) % 24, (last % 1) * 60);

  return {
    from, to, date, daysAhead, flights,
    byDaysAhead: [1, 7, 15, 30, 45].map((d) => ({
      days: d,
      label: d === 1 ? 'Tomorrow' : `${d} days`,
      cheapestPaise: cheapestFor(from, to, date, d),
    })),
    seenAt: seen.toISOString(),
  };
}
