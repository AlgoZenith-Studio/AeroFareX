'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  Attribution, CoverageDay, HealthSnapshot, IndexFamily, IndexHistory, LeadTimeMatrix, Observation,
  ObservationAudit, RouteFareDay, RouteSummary, SeriesName,
} from '@aerofarex/shared-types';
import { apiGet, type Params } from './client';

/** One typed hook per TRD Part D endpoint. Returns the whole envelope (data + meta). */
const useEndpoint = <T>(path: string, params?: Params, enabled = true) =>
  useQuery({
    queryKey: [path, params],
    queryFn: () => apiGet<T>(path, params),
    enabled,
  });

export const useIndexFamily = (date?: string) => useEndpoint<IndexFamily>('index/family', { date });
export const useIndexHistory = (series: SeriesName[], from?: string, to?: string) =>
  useEndpoint<IndexHistory[]>('index/history', { series: series.join(','), from, to });
export const useAttribution = (date: string | undefined, series: SeriesName, enabled = true) =>
  useEndpoint<Attribution>(`index/attribution/${date}`, { series }, enabled && Boolean(date));
export const useRoutes = (date?: string) => useEndpoint<RouteSummary[]>('routes', { date });
export const useRouteFares = (routeId: string) => useEndpoint<RouteFareDay[]>(`routes/${routeId}/fares`);
export const useObservations = (date?: string, route?: string) => useEndpoint<Observation[]>('observations', { date, route });
export const useObservationAudit = (id: string | null) =>
  useEndpoint<ObservationAudit>(`observations/${id}`, undefined, Boolean(id));
export const useLeadTime = (date?: string) => useEndpoint<LeadTimeMatrix>('lead-time/matrix', { date });
export const useCoverage = (from?: string, to?: string) => useEndpoint<CoverageDay[]>('quality/coverage', { from, to });
export const useHealth = () => useEndpoint<HealthSnapshot>('health');
