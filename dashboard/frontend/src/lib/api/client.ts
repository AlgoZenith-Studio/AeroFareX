import type { ApiError, Envelope } from '@aerofarex/shared-types';
import { API_BASE, USE_MOCK } from '../config';
import { readControls } from '../mock/controls';

export class ApiRequestError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.message);
  }
}

/** Set by the auth layer; returns a fresh Firebase ID token for the Bearer header. */
let tokenGetter: (() => Promise<string | null>) | null = null;
export const setTokenGetter = (getter: typeof tokenGetter) => { tokenGetter = getter; };

const correlationId = () => Math.random().toString(16).slice(2, 10);

export type Params = Record<string, string | number | undefined | null>;

const toSearch = (params: Params = {}) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  return search;
};

/**
 * GET an endpoint from TRD Part D. In mock mode the request is served by the seed
 * handlers with the configured latency / failure / empty / stale behaviour.
 */
export async function apiGet<T>(path: string, params?: Params): Promise<Envelope<T>> {
  const search = toSearch(params);

  if (USE_MOCK) {
    const controls = readControls();
    await new Promise((resolve) => setTimeout(resolve, controls.latencyMs));
    if (Math.random() < controls.failRate) {
      throw new ApiRequestError(503, {
        error: 'Service Unavailable', code: 'MOCK_FAILURE', message: 'Simulated failure (mock controls).',
        correlation_id: correlationId(),
      });
    }
    const { mockFetch, MockHttpError } = await import('../mock/handlers');
    try {
      const result = mockFetch(path, search) as Envelope<T>;
      if (controls.empty && Array.isArray(result.data)) return { ...result, data: [] as T };
      if (controls.stale) return { ...result, meta: { ...result.meta, generated_at: '2026-09-24T14:30:00Z' } };
      return result;
    } catch (e) {
      if (e instanceof MockHttpError) {
        throw new ApiRequestError(e.status, { error: 'Request failed', code: e.code, message: e.message, correlation_id: correlationId() });
      }
      throw e;
    }
  }

  const token = tokenGetter ? await tokenGetter() : null;
  const res = await fetch(`${API_BASE}/${path.replace(/^\//, '')}${search.size ? `?${search}` : ''}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, body ?? {
      error: res.statusText, code: `HTTP_${res.status}`, message: `Request failed (${res.status}).`,
      correlation_id: res.headers.get('x-correlation-id') ?? correlationId(),
    });
  }
  return res.json() as Promise<Envelope<T>>;
}
