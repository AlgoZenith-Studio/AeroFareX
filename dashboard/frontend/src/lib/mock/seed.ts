/**
 * Deterministic 30-day seed dataset (TRD Part F) plus the index maths (TRD Part B)
 * run over it, so every number the mock API returns is internally consistent:
 * attribution genuinely reconciles, coverage is genuinely computed, etc.
 *
 * Same seed -> same data on every load. Money is integer paise throughout.
 */
import type {
  AdvanceWindow, CarrierCode, FareComponents, FetchTier, ImputationRule, MissingReason,
  Observation, Provenance, RouteId, SourceId,
} from '@aerofarex/shared-types';

// ---------------------------------------------------------------- constants
export const DAYS = 30;
export const START_DATE = '2026-08-29';
export const BASE_DATE = '2026-09-01'; // index = 100
export const SIMULATED_DAYS = 18; // first 18 days SIMULATED, last 12 REAL
export const METHODOLOGY_VERSION = 'h-1.2';

export const ROUTES: {
  id: RouteId; label: string; origin: string; destination: string; paxShare: number; level: number;
}[] = [
  { id: 'DEL-BOM', label: 'Delhi → Mumbai', origin: 'DEL', destination: 'BOM', paxShare: 12.4, level: 485000 },
  { id: 'DEL-BLR', label: 'Delhi → Bengaluru', origin: 'DEL', destination: 'BLR', paxShare: 9.8, level: 540000 },
  { id: 'BOM-BLR', label: 'Mumbai → Bengaluru', origin: 'BOM', destination: 'BLR', paxShare: 7.6, level: 360000 },
  { id: 'DEL-CCU', label: 'Delhi → Kolkata', origin: 'DEL', destination: 'CCU', paxShare: 5.2, level: 420000 },
  { id: 'BLR-HYD', label: 'Bengaluru → Hyderabad', origin: 'BLR', destination: 'HYD', paxShare: 4.3, level: 285000 },
];
const PAX_TOTAL = ROUTES.reduce((sum, r) => sum + r.paxShare, 0);
export const ROUTE_WEIGHT: Record<RouteId, number> = Object.fromEntries(
  ROUTES.map((r) => [r.id, r.paxShare / PAX_TOTAL]),
) as Record<RouteId, number>;

export const WINDOWS: AdvanceWindow[] = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'];
export const WINDOW_DAYS: Record<AdvanceWindow, number> = { 'T+1': 1, 'T+7': 7, 'T+15': 15, 'T+30': 30, 'T+45': 45 };
/** Booking-curve weights ω_k (TRD Part B §3). Sum = 1. */
export const WINDOW_WEIGHT: Record<AdvanceWindow, number> = {
  'T+1': 0.1, 'T+7': 0.22, 'T+15': 0.35, 'T+30': 0.23, 'T+45': 0.1,
};
/** Price multiple vs T+45 (TRD: T+1 is 2.5x-4x T+45). */
const WINDOW_MULTIPLE: Record<AdvanceWindow, number> = {
  'T+1': 3.2, 'T+7': 1.85, 'T+15': 1.35, 'T+30': 1.12, 'T+45': 1,
};

export const SOURCES: { id: SourceId; label: string; type: 'AIRLINE' | 'OTA'; carrier: CarrierCode | null; tier: FetchTier }[] = [
  { id: 'indigo', label: 'IndiGo', type: 'AIRLINE', carrier: '6E', tier: 'HTTP' },
  { id: 'air_india', label: 'Air India', type: 'AIRLINE', carrier: 'AI', tier: 'DYNAMIC' },
  { id: 'akasa', label: 'Akasa Air', type: 'AIRLINE', carrier: 'QP', tier: 'HTTP' },
  { id: 'spicejet', label: 'SpiceJet', type: 'AIRLINE', carrier: 'SG', tier: 'BROWSER' },
  { id: 'makemytrip', label: 'MakeMyTrip', type: 'OTA', carrier: null, tier: 'DYNAMIC' },
];
export const CARRIERS: { code: CarrierCode; label: string }[] = [
  { code: '6E', label: 'IndiGo' },
  { code: 'AI', label: 'Air India' },
  { code: 'QP', label: 'Akasa Air' },
  { code: 'SG', label: 'SpiceJet' },
];
const CARRIER_FACTOR: Record<CarrierCode, number> = { '6E': 1, AI: 1.08, QP: 0.96, SG: 0.93 };
/** User development fee and passenger service fee by origin airport (paise, fixed). */
const AIRPORT_FEES: Record<string, { udf: number; psf: number }> = {
  DEL: { udf: 32000, psf: 9100 },
  BOM: { udf: 42000, psf: 9100 },
  BLR: { udf: 35000, psf: 9100 },
};
const MISSING_REASONS: MissingReason[] = [
  'SOLD_OUT', 'NO_FLIGHT', 'MISSING_SOURCE', 'SOURCE_ERROR', 'PARSER_ERROR', 'BLOCKED', 'UNKNOWN',
];
/** A day the OTA blocked the collector (exercises the partial-coverage state). */
export const BLOCKED_DAY = '2026-09-10';
/** Festival demand-surge week (departure dates). */
const SURGE = { from: '2026-09-18', to: '2026-09-24', factor: 1.15 };

// ---------------------------------------------------------------- helpers
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(20260901);
const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
const gauss = () => {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const isWeekend = (iso: string) => {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Departure sampled by each source for a window: four sources take the next four
 * weekdays, the fifth the next weekend day. Every cell keeps the same weekday/
 * weekend mix, so the weekend premium doesn't make the index wobble weekly.
 */
const departureFor = (from: string, sourceIndex: number) => {
  let weekdays = 0;
  for (let i = 0; i < 14; i++) {
    const d = addDays(from, i);
    if (sourceIndex === 4 ? isWeekend(d) : !isWeekend(d) && weekdays++ === sourceIndex) return d;
  }
  return from;
};

export const DATES: string[] = Array.from({ length: DAYS }, (_, i) => addDays(START_DATE, i));
export const LATEST_DATE = DATES[DATES.length - 1];
export const PROVENANCE_BOUNDARY = DATES[SIMULATED_DAYS];
export const provenanceOf = (date: string): Provenance => (date < PROVENANCE_BOUNDARY ? 'SIMULATED' : 'REAL');

// ---------------------------------------------------------------- observations
export interface SeedObservation extends Observation {
  search_date: string;
}

/** Daily market drift, fuel pressure and ancillary level (shared across cells). */
const market = DATES.map((date, i) => ({
  date,
  drift: 1 + i * 0.0019 + 0.003 * Math.sin(i / 3.1),
  // Fees rise faster than base fares: that divergence is the drip-pricing wedge.
  fuel: 0.12 + i * 0.0045 + 0.004 * Math.sin(i / 4), // fuel surcharge as share of base
  airport: date >= '2026-09-12' ? 1.35 : 1, // airport UDF revision from 12 Sep
  platform: 1 + i * 0.012, // OTA platform fee creep
  ancillary: 1 + i * 0.0034 + 0.006 * Math.sin(i / 2.3),
}));

const makeComponents = (
  base: number, day: (typeof market)[number], origin: string, ota: boolean,
): FareComponents => {
  const base_fare_paise = Math.round(base / 100) * 100;
  const fuel_surcharge_paise = Math.round((base_fare_paise * day.fuel) / 100) * 100;
  const fees = AIRPORT_FEES[origin] ?? { udf: 30000, psf: 9100 };
  const udf_paise = Math.round((fees.udf * day.airport) / 100) * 100;
  const gst_paise = Math.round((base_fare_paise + fuel_surcharge_paise) * 0.05);
  const platform_fee_paise = ota ? Math.round((between(35000, 55000) * day.platform) / 100) * 100 : 0;
  const total_payable_paise = base_fare_paise + fuel_surcharge_paise + udf_paise + fees.psf + gst_paise + platform_fee_paise;
  return {
    base_fare_paise, fuel_surcharge_paise, udf_paise, psf_paise: fees.psf, gst_paise, platform_fee_paise,
    total_payable_paise,
  };
};

export const OBSERVATIONS: SeedObservation[] = [];
let missingCursor = 0;
DATES.forEach((date, dayIndex) => {
  const day = market[dayIndex];
  ROUTES.forEach((route) => {
    WINDOWS.forEach((window) => {
      SOURCES.forEach((source, sourceIndex) => {
        const departure = departureFor(addDays(date, WINDOW_DAYS[window]), sourceIndex);
        const surge = departure >= SURGE.from && departure <= SURGE.to ? SURGE.factor : 1;
        const weekend = isWeekend(departure) ? between(1.15, 1.25) : 1;
        const carrier = source.carrier ?? CARRIERS[(dayIndex + sourceIndex + WINDOWS.indexOf(window)) % 4].code;
        const observed_at = `${date}T13:30:00Z`; // 19:00 IST slot
        const flightNo = `${carrier}${100 + Math.floor(rand() * 899)}`;
        // The DEGRADED source (SpiceJet) fails far more often in the last 4 days.
        const degraded = source.id === 'spicejet' && dayIndex >= DAYS - 4;
        // Incident: the OTA blocked the declared collector for all of 10 Sep.
        const blocked = source.id === 'makemytrip' && date === BLOCKED_DAY;
        const missing = blocked || rand() < (degraded ? 0.16 : 0.025);
        const base = route.level * (WINDOW_MULTIPLE[window] / WINDOW_MULTIPLE['T+15'])
          * CARRIER_FACTOR[carrier] * surge * weekend * day.drift * Math.exp(0.035 * gauss());
        const outlier = !missing && rand() < 0.008;
        const reason = missing
          ? blocked ? 'BLOCKED' : degraded ? 'SOURCE_ERROR' : MISSING_REASONS[missingCursor++ % MISSING_REASONS.length]
          : null;
        OBSERVATIONS.push({
          observation_id: uuid(),
          observed_at,
          search_date: date,
          source: source.id,
          fetch_tier: source.tier,
          route_id: route.id,
          carrier_code: carrier,
          flight_number: missing ? null : flightNo,
          departure_date: departure,
          advance_window: window,
          fare_family: missing ? null : rand() < 0.7 ? 'Saver' : 'Flexi',
          baggage_allowance_kg: missing ? null : 15,
          refundable: missing ? null : rand() < 0.3,
          available: !missing,
          missing_reason: reason,
          validation_status: outlier ? 'FLAGGED' : 'VALID',
          provenance: provenanceOf(date),
          components: missing
            ? null
            : makeComponents(outlier ? base * 2.8 : base, day, route.origin, source.type === 'OTA'),
        });
      });
    });
  });
});

// ---------------------------------------------------------------- cell aggregation (Jevons)
type Measure = 'base' | 'total';
const measureOf = (c: FareComponents, m: Measure) => (m === 'base' ? c.base_fare_paise : c.total_payable_paise);
const usable = (o: SeedObservation) => o.available && o.validation_status === 'VALID' && o.components !== null;

/** Observations indexed by date|route|window for fast cell lookup. */
const CELL_OBS = new Map<string, SeedObservation[]>();
for (const o of OBSERVATIONS) {
  const key = `${o.search_date}|${o.route_id}|${o.advance_window}`;
  const list = CELL_OBS.get(key) ?? [];
  list.push(o);
  CELL_OBS.set(key, list);
}
export const cellObservations = (date: string, route: RouteId, window: AdvanceWindow) =>
  CELL_OBS.get(`${date}|${route}|${window}`) ?? [];

const geoMean = (values: number[]) => Math.exp(values.reduce((s, v) => s + Math.log(v), 0) / values.length);

/** Jevons cell aggregate; empty cells carry the previous day forward (imputed). */
const cellCache = new Map<string, { value: number; imputed: boolean }>();
export const cellValue = (date: string, route: RouteId, window: AdvanceWindow, m: Measure): { value: number; imputed: boolean } => {
  const key = `${date}|${route}|${window}|${m}`;
  const cached = cellCache.get(key);
  if (cached) return cached;
  const obs = cellObservations(date, route, window).filter(usable);
  let result: { value: number; imputed: boolean };
  if (obs.length) {
    result = { value: geoMean(obs.map((o) => measureOf(o.components!, m))), imputed: false };
  } else {
    const prev = DATES.indexOf(date) > 0 ? cellValue(addDays(date, -1), route, window, m).value : 0;
    result = { value: prev, imputed: true };
  }
  cellCache.set(key, result);
  return result;
};

// ---------------------------------------------------------------- index (chained Laspeyres, fixed base here)
const indexValue = (date: string, m: Measure) => {
  let total = 0;
  for (const r of ROUTES) {
    for (const k of WINDOWS) {
      total += ROUTE_WEIGHT[r.id] * WINDOW_WEIGHT[k]
        * (cellValue(date, r.id, k, m).value / cellValue(BASE_DATE, r.id, k, m).value);
    }
  }
  return 100 * total;
};

/** ANC-AFI: ancillary basket (seat + bag + meal) relative to the base date. */
const ancillaryValue = (date: string) => {
  const i = DATES.indexOf(date);
  const b = DATES.indexOf(BASE_DATE);
  return (100 * market[i].ancillary) / market[b].ancillary;
};

export const SERIES_VALUES: Record<'AFI' | 'TCT-AFI' | 'ANC-AFI', Record<string, number>> = {
  AFI: Object.fromEntries(DATES.map((d) => [d, indexValue(d, 'base')])),
  'TCT-AFI': Object.fromEntries(DATES.map((d) => [d, indexValue(d, 'total')])),
  'ANC-AFI': Object.fromEntries(DATES.map((d) => [d, ancillaryValue(d)])),
};

// ---------------------------------------------------------------- quality
export interface DayQuality {
  expected: number;
  observed: number;
  coverage: number;
  imputation_rate: number;
  by_rule: Record<ImputationRule, number>;
  missing_by_reason: Record<MissingReason, number>;
}
export const qualityOf = (date: string): DayQuality => {
  const by_rule: Record<ImputationRule, number> = { CROSS_SOURCE: 0, CELL_MEAN: 0, CARRY_FORWARD: 0, EXCLUDED: 0 };
  const missing_by_reason = Object.fromEntries(MISSING_REASONS.map((r) => [r, 0])) as Record<MissingReason, number>;
  let expected = 0;
  let valid = 0;
  for (const r of ROUTES) {
    for (const k of WINDOWS) {
      const obs = cellObservations(date, r.id, k);
      const good = obs.filter(usable).length;
      expected += obs.length;
      valid += good;
      for (const o of obs) {
        if (o.validation_status === 'FLAGGED') by_rule.EXCLUDED += 1;
        if (!o.available) {
          missing_by_reason[o.missing_reason ?? 'UNKNOWN'] += 1;
          if (good === 0) by_rule.CARRY_FORWARD += 1;
          else if (good >= 2) by_rule.CROSS_SOURCE += 1;
          else by_rule.CELL_MEAN += 1;
        }
      }
    }
  }
  const imputed = by_rule.CROSS_SOURCE + by_rule.CELL_MEAN + by_rule.CARRY_FORWARD;
  return { expected, observed: valid, coverage: valid / expected, imputation_rate: imputed / expected, by_rule, missing_by_reason };
};

// ---------------------------------------------------------------- attribution
export interface Contribution { key: string; label: string; contribution: number }

const splitBy = <K extends string>(total: number, parts: Record<K, number>): Record<K, number> => {
  const keys = Object.keys(parts) as K[];
  const sum = keys.reduce((s, k) => s + parts[k], 0);
  const out = {} as Record<K, number>;
  keys.forEach((k) => { out[k] = Math.abs(sum) < 1e-12 ? total / keys.length : (total * parts[k]) / sum; });
  return out;
};

/**
 * Additive decomposition of ΔI between `date` and the previous day. Each cell's
 * contribution is exact (Laspeyres is linear in cell relatives); carrier,
 * component and driver splits allocate each cell's contribution proportionally,
 * so every axis sums to the same ΔI by construction.
 */
export const attributionOf = (date: string, m: Measure) => {
  const prev = addDays(date, -1);
  const route: Record<string, number> = {};
  const window: Record<string, number> = {};
  const carrier: Record<string, number> = Object.fromEntries(CARRIERS.map((c) => [c.code, 0]));
  const component: Record<string, number> = { base: 0, fuel: 0, airport: 0, gst: 0, platform: 0 };
  const dayIdx = DATES.indexOf(date);
  const fuelShare = Math.min(0.6, Math.max(0.05, Math.abs(market[dayIdx].fuel - market[dayIdx - 1].fuel) * 30));

  for (const r of ROUTES) {
    for (const k of WINDOWS) {
      const now = cellValue(date, r.id, k, m).value;
      const before = cellValue(prev, r.id, k, m).value;
      const baseVal = cellValue(BASE_DATE, r.id, k, m).value;
      const delta = (100 * ROUTE_WEIGHT[r.id] * WINDOW_WEIGHT[k] * (now - before)) / baseVal;
      route[r.id] = (route[r.id] ?? 0) + delta;
      window[k] = (window[k] ?? 0) + delta;

      // Carrier: each carrier's share of the change in mean log price.
      const nowObs = cellObservations(date, r.id, k).filter(usable);
      const prevObs = cellObservations(prev, r.id, k).filter(usable);
      const logShare = (obs: SeedObservation[], code: CarrierCode) => {
        const mine = obs.filter((o) => o.carrier_code === code);
        return obs.length ? mine.reduce((s, o) => s + Math.log(measureOf(o.components!, m)), 0) / obs.length : 0;
      };
      const carrierParts = Object.fromEntries(
        CARRIERS.map((c) => [c.code, logShare(nowObs, c.code) - logShare(prevObs, c.code)]),
      ) as Record<CarrierCode, number>;
      const byCarrier = splitBy(delta, carrierParts);
      for (const c of CARRIERS) carrier[c.code] += byCarrier[c.code];

      // Component: change in each component's cell mean (AFI moves on base fare only).
      if (m === 'base') {
        component.base += delta;
      } else {
        const mean = (obs: SeedObservation[], f: (c: FareComponents) => number) =>
          obs.length ? obs.reduce((s, o) => s + f(o.components!), 0) / obs.length : 0;
        const d = (f: (c: FareComponents) => number) => mean(nowObs, f) - mean(prevObs, f);
        const byComponent = splitBy(delta, {
          base: d((c) => c.base_fare_paise),
          fuel: d((c) => c.fuel_surcharge_paise),
          airport: d((c) => c.udf_paise + c.psf_paise),
          gst: d((c) => c.gst_paise),
          platform: d((c) => c.platform_fee_paise),
        });
        for (const [key, value] of Object.entries(byComponent)) component[key] += value;
      }
    }
  }
  const total = Object.values(route).reduce((s, v) => s + v, 0);
  const label = {
    route: (id: string) => ROUTES.find((r) => r.id === id)!.label,
    carrier: (id: string) => CARRIERS.find((c) => c.code === id)!.label,
    component: (id: string) => ({ base: 'Base fare', fuel: 'Fuel surcharge', airport: 'Airport fees (UDF/PSF)', gst: 'GST', platform: 'Platform fee' } as Record<string, string>)[id],
  };
  const list = (rec: Record<string, number>, name?: (k: string) => string): Contribution[] =>
    Object.entries(rec).map(([key, contribution]) => ({ key, label: name ? name(key) : key, contribution }));
  return {
    delta: total,
    axes: {
      route: list(route, label.route),
      window: list(window),
      carrier: list(carrier, label.carrier),
      component: list(component, label.component),
      driver: [
        { key: 'fuel', label: 'Jet fuel (ATF) cost', contribution: total * fuelShare },
        { key: 'demand', label: 'Demand', contribution: total * (1 - fuelShare) },
      ],
    },
  };
};

// ---------------------------------------------------------------- audit
export const auditOf = (o: SeedObservation) => {
  const r = mulberry32(o.observation_id.split('').reduce((s, ch) => s + ch.charCodeAt(0) * 31, 7));
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('');
  return {
    raw_id: `${h(8)}-${h(4)}-4${h(3)}-b${h(3)}-${h(12)}`,
    object_key: `gs://aerofarex-raw-observations/${o.search_date}/${o.source}/${o.observation_id}.json.gz`,
    sha256: h(64),
    batch_hash: h(64),
    prev_batch_hash: h(64),
    adapter_version: `${o.source}@2.${o.search_date >= PROVENANCE_BOUNDARY ? 4 : 3}.1`,
    fetched_at: o.observed_at,
  };
};
