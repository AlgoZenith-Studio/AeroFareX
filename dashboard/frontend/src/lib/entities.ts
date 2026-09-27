import type { CarrierCode, CircuitState, SeriesName, SourceId } from '@aerofarex/shared-types';

/**
 * Permanent entity -> colour bindings (rule 2: colour follows the entity, never
 * its rank; filtering never repaints the survivors).
 */
export const SERIES_COLOR: Record<SeriesName, string> = {
  AFI: 'var(--slot-1)',
  'TCT-AFI': 'var(--slot-2)',
  'ANC-AFI': 'var(--slot-4)',
};

export const SERIES_LABEL: Record<SeriesName, string> = {
  AFI: 'AFI',
  'TCT-AFI': 'TCT-AFI',
  'ANC-AFI': 'ANC-AFI',
};

export const SOURCE_COLOR: Record<SourceId, string> = {
  indigo: 'var(--slot-1)',
  air_india: 'var(--slot-2)',
  akasa: 'var(--slot-3)',
  spicejet: 'var(--slot-4)',
  makemytrip: 'var(--slot-5)',
};

export const CARRIER_COLOR: Record<CarrierCode, string> = {
  '6E': 'var(--slot-1)',
  AI: 'var(--slot-2)',
  QP: 'var(--slot-3)',
  SG: 'var(--slot-4)',
};

export const CIRCUIT: Record<CircuitState, { label: string; tone: string; bg: string }> = {
  HEALTHY: { label: 'Healthy', tone: 'text-status-good', bg: 'bg-status-good/12' },
  DEGRADED: { label: 'Degraded', tone: 'text-status-warning', bg: 'bg-status-warning/15' },
  OPEN: { label: 'Circuit open', tone: 'text-status-critical', bg: 'bg-status-critical/12' },
  RECOVERING: { label: 'Recovering', tone: 'text-status-serious', bg: 'bg-status-serious/15' },
};
