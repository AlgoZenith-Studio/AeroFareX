/**
 * Mock implementation of the TRD Part D endpoints, backed by ./seed. Same paths,
 * same query parameters, same data/meta envelope as the real FastAPI backend, so
 * switching NEXT_PUBLIC_USE_MOCK off needs no component changes.
 */
import type {
  AdvanceWindow, Attribution, CollectionRun, CoverageDay, Envelope, FareComponents, HealthSnapshot,
  IndexFamily, IndexHistory, IndexLatest, LeadTimeMatrix, ObservationAudit, QualityMetadata, RouteFareDay,
  RouteId, RouteSummary, SeriesName, SourceHealth,
} from '@aerofarex/shared-types';
import {
  addDays, attributionOf, auditOf, BASE_DATE, cellObservations, cellValue, DATES, LATEST_DATE, METHODOLOGY_VERSION,
  OBSERVATIONS, PROVENANCE_BOUNDARY, provenanceOf, qualityOf, ROUTES, SERIES_VALUES, SOURCES, WINDOW_WEIGHT, WINDOWS,
} from './seed';

export class MockHttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const envelope = <T>(data: T, total?: number): Envelope<T> => ({
  data,
  meta: { generated_at: `${LATEST_DATE}T14:30:00Z`, ...(total !== undefined ? { page: 1, page_size: total, total } : {}) },
});

const clampDate = (date: string | null) => {
  if (!date) return LATEST_DATE;
  if (!DATES.includes(date)) throw new MockHttpError(404, 'DATE_OUT_OF_RANGE', `No published index for ${date}.`);
  return date;
};

export const qualityMeta = (date: string): QualityMetadata => {
  const q = qualityOf(date);
  return {
    coverage: q.coverage,
    imputation_rate: q.imputation_rate,
    provenance: provenanceOf(date),
    vintage: 1,
    is_provisional: date === LATEST_DATE,
    methodology_version: METHODOLOGY_VERSION,
    quality_status: q.coverage >= 0.9 ? 'GOOD' : q.coverage >= 0.8 ? 'SERIOUS' : 'CRITICAL',
  };
};

const latestOf = (series: SeriesName, date: string): IndexLatest => {
  const idx = DATES.indexOf(date);
  const value = SERIES_VALUES[series][date];
  const previous_value = idx > 0 ? SERIES_VALUES[series][DATES[idx - 1]] : value;
  return {
    series, date, value, previous_value,
    change: value - previous_value,
    change_pct: ((value - previous_value) / previous_value) * 100,
    base_period: BASE_DATE,
    quality: qualityMeta(date),
  };
};

/** ω-weighted daily component aggregate for one route (arithmetic mean per window). */
const routeDay = (route: RouteId, date: string): FareComponents => {
  const keys: (keyof FareComponents)[] = [
    'base_fare_paise', 'fuel_surcharge_paise', 'udf_paise', 'psf_paise', 'gst_paise', 'platform_fee_paise',
  ];
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as unknown as FareComponents;
  for (const w of WINDOWS) {
    const obs = cellObservations(date, route, w).filter((o) => o.available && o.validation_status === 'VALID');
    if (!obs.length) continue;
    for (const k of keys) {
      out[k] += WINDOW_WEIGHT[w] * (obs.reduce((s, o) => s + o.components![k], 0) / obs.length);
    }
  }
  for (const k of keys) out[k] = Math.round(out[k]);
  out.total_payable_paise = keys.reduce((s, k) => s + out[k], 0);
  return out;
};

const routeIndex = (route: RouteId, date: string) =>
  100 * WINDOWS.reduce((s, w) => s + WINDOW_WEIGHT[w]
    * (cellValue(date, route, w, 'total').value / cellValue(BASE_DATE, route, w, 'total').value), 0);

// ---------------------------------------------------------------- health
const IST_SLOTS: CollectionRun['slot'][] = ['02:30', '05:30', '13:00', '19:00'];
const slotToUtc = (date: string, slot: string) => {
  const [h, m] = slot.split(':').map(Number);
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h - 5, m - 30));
};
const nextIst = (times: string[], now = new Date()) => {
  for (let d = 0; d < 3; d++) {
    const day = addDays(now.toISOString().slice(0, 10), d - 1);
    for (const t of times) {
      const at = slotToUtc(day, t);
      if (at > now) return at.toISOString();
    }
  }
  return now.toISOString();
};

const sourceHealth = (): SourceHealth[] => {
  const recent = DATES.slice(-7);
  return SOURCES.map((s) => {
    const obs = OBSERVATIONS.filter((o) => o.source === s.id && recent.includes(o.search_date));
    const ok = obs.filter((o) => o.available).length;
    const degraded = s.id === 'spicejet';
    return {
      source: s.id,
      label: s.label,
      type: s.type,
      fetch_tier: s.tier,
      state: degraded ? 'DEGRADED' : 'HEALTHY',
      last_success_at: slotToUtc(LATEST_DATE, degraded ? '05:30' : '13:00').toISOString(),
      success_rate_7d: ok / obs.length,
      consecutive_failures: degraded ? 3 : 0,
      adapter_version: `${s.id}@2.4.1`,
    };
  });
};

const runs = (): CollectionRun[] => {
  const out: CollectionRun[] = [];
  for (const date of DATES.slice(-3).reverse()) {
    for (const slot of [...IST_SLOTS].reverse()) {
      const started = slotToUtc(date, slot);
      if (started > new Date(`${LATEST_DATE}T09:00:00Z`) && date === LATEST_DATE) continue; // not run yet today
      const partial = date >= addDays(LATEST_DATE, -3) && slot !== '02:30';
      const seed = started.getTime() / 60000;
      out.push({
        run_id: `run-${date}-${slot.replace(':', '')}`,
        slot,
        started_at: started.toISOString(),
        duration_s: 380 + (seed % 97),
        observations: partial ? 114 + (seed % 5) : 125,
        status: partial ? 'PARTIAL' : 'SUCCESS',
        batch_hash: (seed * 2654435761).toString(16).padStart(16, '0').slice(-16).repeat(4),
      });
    }
  }
  return out;
};

// ---------------------------------------------------------------- router
export const mockFetch = (path: string, params: URLSearchParams): Envelope<unknown> => {
  const parts = path.replace(/^\/+|\/+$/g, '').split('/');

  if (parts[0] === 'index') {
    const series = (params.get('series') ?? 'AFI') as SeriesName;
    if (parts[1] === 'latest') return envelope(latestOf(series, clampDate(params.get('date'))));
    if (parts[1] === 'history') {
      const from = params.get('from') ?? DATES[0];
      const to = params.get('to') ?? LATEST_DATE;
      const list = (params.get('series') ?? 'AFI').split(',') as SeriesName[];
      const data: IndexHistory[] = list.map((name) => ({
        series: name,
        base_period: BASE_DATE,
        provenance_boundary: PROVENANCE_BOUNDARY >= from && PROVENANCE_BOUNDARY <= to ? PROVENANCE_BOUNDARY : null,
        points: DATES.filter((d) => d >= from && d <= to).map((date) => ({
          date, value: SERIES_VALUES[name][date], provenance: provenanceOf(date),
        })),
      }));
      return envelope(data);
    }
    if (parts[1] === 'family') {
      const date = clampDate(params.get('date'));
      const members = (['AFI', 'TCT-AFI', 'ANC-AFI'] as SeriesName[]).map((s) => latestOf(s, date));
      const afi = members[0].value;
      const tct = members[1].value;
      const data: IndexFamily = { date, members, drip_gap_points: tct - afi, drip_gap_pct: ((tct - afi) / afi) * 100 };
      return envelope(data);
    }
    if (parts[1] === 'attribution') {
      const date = clampDate(parts[2] ?? null);
      if (date === DATES[0]) throw new MockHttpError(404, 'NO_PREVIOUS_DAY', 'Attribution needs a previous published day.');
      const series = (params.get('series') ?? 'AFI') as SeriesName;
      if (series === 'ANC-AFI') throw new MockHttpError(422, 'UNSUPPORTED_SERIES', 'Attribution is published for AFI and TCT-AFI.');
      const a = attributionOf(date, series === 'AFI' ? 'base' : 'total');
      const value = SERIES_VALUES[series][date];
      const previous_value = SERIES_VALUES[series][addDays(date, -1)];
      const sums = Object.values(a.axes).map((list) => list.reduce((s, c) => s + c.contribution, 0));
      const data: Attribution = {
        date, series, value, previous_value, delta: value - previous_value, axes: a.axes,
        reconciled: sums.every((s) => Math.abs(s - (value - previous_value)) < 1e-4),
        quality: qualityMeta(date),
      };
      return envelope(data);
    }
  }

  if (parts[0] === 'routes') {
    const date = clampDate(params.get('date'));
    if (parts.length === 1) {
      const prev = addDays(date, -1);
      const data: RouteSummary[] = ROUTES.map((r) => {
        const today = routeDay(r.id, date);
        const before = DATES.includes(prev) ? routeDay(r.id, prev) : today;
        return {
          route_id: r.id, label: r.label, origin: r.origin, destination: r.destination,
          pax_share: r.paxShare / ROUTES.reduce((s, x) => s + x.paxShare, 0),
          base_fare_paise: today.base_fare_paise,
          total_fare_paise: today.total_payable_paise,
          change_24h_pct: ((today.total_payable_paise - before.total_payable_paise) / before.total_payable_paise) * 100,
          sparkline: DATES.filter((d) => d <= date).map((d) => ({ date: d, value: routeIndex(r.id, d), provenance: provenanceOf(d) })),
          quality: qualityMeta(date),
        };
      });
      return envelope(data, data.length);
    }
    const route = ROUTES.find((r) => r.id === parts[1]);
    if (!route) throw new MockHttpError(404, 'ROUTE_NOT_FOUND', `Unknown route ${parts[1]}.`);
    if (parts[2] === 'fares') {
      const data: RouteFareDay[] = DATES.map((d) => ({ date: d, provenance: provenanceOf(d), components: routeDay(route.id, d) }));
      return envelope(data, data.length);
    }
  }

  if (parts[0] === 'observations') {
    if (parts[1]) {
      const o = OBSERVATIONS.find((x) => x.observation_id === parts[1]);
      if (!o) throw new MockHttpError(404, 'OBSERVATION_NOT_FOUND', 'No such observation.');
      const data: ObservationAudit = { ...o, ...auditOf(o) };
      return envelope(data);
    }
    const date = clampDate(params.get('date'));
    const route = params.get('route');
    const data = OBSERVATIONS.filter((o) => o.search_date === date && (!route || o.route_id === route));
    return envelope(data, data.length);
  }

  if (parts[0] === 'lead-time' && parts[1] === 'matrix') {
    const date = clampDate(params.get('date'));
    const data: LeadTimeMatrix = {
      date,
      windows: WINDOWS,
      weights: WINDOW_WEIGHT as Record<AdvanceWindow, number>,
      cells: ROUTES.flatMap((r) => WINDOWS.map((w) => {
        const obs = cellObservations(date, r.id, w);
        const c = cellValue(date, r.id, w, 'total');
        return {
          route_id: r.id, window: w,
          total_fare_paise: c.imputed ? null : Math.round(c.value),
          missing_reason: c.imputed ? (obs.find((o) => o.missing_reason)?.missing_reason ?? 'UNKNOWN') : null,
          provenance: provenanceOf(date),
        };
      })),
    };
    return envelope(data);
  }

  if (parts[0] === 'quality' && (parts[1] === 'coverage' || parts[1] === 'imputation')) {
    const from = params.get('from') ?? DATES[0];
    const to = params.get('to') ?? LATEST_DATE;
    const data: CoverageDay[] = DATES.filter((d) => d >= from && d <= to).map((date) => ({
      date, provenance: provenanceOf(date), ...qualityOf(date),
    }));
    return envelope(data, data.length);
  }

  if (parts[0] === 'sources') return envelope(sourceHealth());
  if (parts[0] === 'health') {
    const data: HealthSnapshot = {
      sources: sourceHealth(),
      runs: runs(),
      next_run_at: nextIst(IST_SLOTS),
      next_publication_at: nextIst(['20:00']),
    };
    return envelope(data);
  }

  throw new MockHttpError(404, 'NOT_FOUND', `No mock handler for /${parts.join('/')}.`);
};
