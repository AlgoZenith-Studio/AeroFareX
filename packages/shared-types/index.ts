/**
 * AeroFareX API contracts (TRD Part D), shared by the dashboard, its mock layer,
 * and (by convention) the FastAPI Pydantic schemas.
 *
 * Money is ALWAYS integer paise (1 INR = 100 paise). Index values are unitless
 * points (base period = 100). Dates are ISO strings: YYYY-MM-DD for days,
 * full ISO 8601 (UTC) for timestamps.
 */

// ---------------------------------------------------------------- enums
export type Role = 'VIEWER' | 'ANALYST' | 'ADMIN';
export type SeriesName = 'AFI' | 'TCT-AFI' | 'ANC-AFI';
export type RouteId = 'DEL-BOM' | 'DEL-BLR' | 'BOM-BLR' | 'DEL-CCU' | 'BLR-HYD';
export type AdvanceWindow = 'T+1' | 'T+7' | 'T+15' | 'T+30' | 'T+45';
export type CarrierCode = '6E' | 'AI' | 'QP' | 'SG';
export type SourceId = 'indigo' | 'air_india' | 'akasa' | 'spicejet' | 'makemytrip';
export type SourceType = 'AIRLINE' | 'OTA' | 'REFERENCE';
export type FetchTier = 'HTTP' | 'DYNAMIC' | 'BROWSER';
export type CircuitState = 'HEALTHY' | 'DEGRADED' | 'OPEN' | 'RECOVERING';
export type MissingReason =
  | 'SOLD_OUT' | 'NO_FLIGHT' | 'MISSING_SOURCE' | 'SOURCE_ERROR' | 'PARSER_ERROR' | 'BLOCKED' | 'UNKNOWN';
export type ImputationRule = 'CROSS_SOURCE' | 'CELL_MEAN' | 'CARRY_FORWARD' | 'EXCLUDED';
export type Provenance = 'REAL' | 'SIMULATED';
export type ValidationStatus = 'VALID' | 'INVALID' | 'FLAGGED';
export type QualityStatus = 'GOOD' | 'SERIOUS' | 'CRITICAL';
export type AttributionAxis = 'route' | 'carrier' | 'window' | 'component' | 'driver';

// ---------------------------------------------------------------- envelope
export interface Meta {
  page?: number;
  page_size?: number;
  total?: number;
  generated_at: string;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface ApiError {
  error: string;
  code: string;
  message: string;
  correlation_id: string;
}

// ---------------------------------------------------------------- quality metadata
/** Mandatory on every index-bearing response (TRD rule 5). */
export interface QualityMetadata {
  coverage: number; // 0..1
  imputation_rate: number; // 0..1
  provenance: Provenance;
  vintage: number;
  is_provisional: boolean;
  methodology_version: string;
  quality_status: QualityStatus;
}

// ---------------------------------------------------------------- index
export interface IndexPoint {
  date: string;
  value: number;
  provenance: Provenance;
}

export interface IndexLatest {
  series: SeriesName;
  date: string;
  value: number;
  previous_value: number;
  change: number; // points, day on day
  change_pct: number; // percent, day on day
  base_period: string;
  quality: QualityMetadata;
}

export interface IndexHistory {
  series: SeriesName;
  base_period: string;
  /** First date whose provenance is REAL; charts draw a rule here. */
  provenance_boundary: string | null;
  points: IndexPoint[];
}

export interface IndexFamily {
  date: string;
  members: IndexLatest[];
  /** TCT-AFI minus AFI, in index points, and as % of AFI. */
  drip_gap_points: number;
  drip_gap_pct: number;
}

export interface AttributionContribution {
  key: string;
  label: string;
  contribution: number; // index points
}

export interface Attribution {
  date: string;
  series: SeriesName;
  previous_value: number;
  value: number;
  delta: number;
  axes: Record<AttributionAxis, AttributionContribution[]>;
  reconciled: boolean;
  quality: QualityMetadata;
}

// ---------------------------------------------------------------- routes & fares
export interface FareComponents {
  base_fare_paise: number;
  fuel_surcharge_paise: number;
  udf_paise: number;
  psf_paise: number;
  gst_paise: number;
  platform_fee_paise: number;
  total_payable_paise: number;
}

export interface RouteSummary {
  route_id: RouteId;
  label: string;
  origin: string;
  destination: string;
  pax_share: number; // DGCA weight 0..1 (normalised)
  base_fare_paise: number; // Jevons cell aggregate, today
  total_fare_paise: number;
  change_24h_pct: number;
  sparkline: IndexPoint[]; // route-level total fare index, 30 days
  quality: QualityMetadata;
}

export interface RouteFareDay {
  date: string;
  provenance: Provenance;
  components: FareComponents; // Jevons-style daily aggregate per component
}

export interface Observation {
  observation_id: string;
  observed_at: string;
  source: SourceId;
  fetch_tier: FetchTier;
  route_id: RouteId;
  carrier_code: CarrierCode;
  flight_number: string | null;
  departure_date: string;
  advance_window: AdvanceWindow;
  fare_family: string | null;
  baggage_allowance_kg: number | null;
  refundable: boolean | null;
  available: boolean;
  missing_reason: MissingReason | null;
  validation_status: ValidationStatus;
  provenance: Provenance;
  components: FareComponents | null;
}

export interface ObservationAudit extends Observation {
  raw_id: string;
  object_key: string;
  sha256: string;
  batch_hash: string;
  prev_batch_hash: string | null;
  adapter_version: string;
  fetched_at: string;
}

// ---------------------------------------------------------------- lead time
export interface LeadTimeCell {
  route_id: RouteId;
  window: AdvanceWindow;
  total_fare_paise: number | null;
  missing_reason: MissingReason | null;
  provenance: Provenance;
}

export interface LeadTimeMatrix {
  date: string;
  windows: AdvanceWindow[];
  weights: Record<AdvanceWindow, number>; // booking-curve ω_k
  cells: LeadTimeCell[];
}

// ---------------------------------------------------------------- quality
export interface CoverageDay {
  date: string;
  /** Observations the schedule expected, and how many were usable (valid). */
  expected: number;
  observed: number;
  coverage: number;
  imputation_rate: number;
  provenance: Provenance;
  by_rule: Record<ImputationRule, number>;
  missing_by_reason: Record<MissingReason, number>;
}

// ---------------------------------------------------------------- sources & health
export interface SourceHealth {
  source: SourceId;
  label: string;
  type: SourceType;
  fetch_tier: FetchTier;
  state: CircuitState;
  last_success_at: string | null;
  success_rate_7d: number; // 0..1
  consecutive_failures: number;
  adapter_version: string;
}

export interface CollectionRun {
  run_id: string;
  slot: '02:30' | '05:30' | '13:00' | '19:00';
  started_at: string;
  duration_s: number;
  observations: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  batch_hash: string;
}

export interface HealthSnapshot {
  sources: SourceHealth[];
  runs: CollectionRun[];
  next_run_at: string;
  next_publication_at: string;
}

// ---------------------------------------------------------------- methodology & vintages
/** GET /index/vintages/{date}: every published version of a day (revisions never edit). */
export interface IndexVintage {
  series: SeriesName;
  date: string;
  vintage: number;
  value: number;
  coverage: number;
  imputation_rate: number;
  provenance: Provenance;
  methodology_version: string;
  calculated_at: string;
  is_current: boolean;
}

export interface MethodologyWeight {
  key: string;
  label: string;
  weight: number;
}

/** GET /methodology */
export interface Methodology {
  methodology_version: string;
  base_period: string;
  formula: string;
  elementary_aggregate: string;
  route_weights: MethodologyWeight[];
  window_weights: MethodologyWeight[];
  outlier_rule: string;
  imputation_rules: Record<ImputationRule, string>;
  attribution: string;
  quality_thresholds: Record<QualityStatus, string>;
  notes: string[];
}

// ---------------------------------------------------------------- public API (/api/v1/public/*)
/** GET /public/latest?series=AFI|TCT-AFI */
export interface PublicLatest {
  series: 'AFI' | 'TCT-AFI';
  date: string;
  value: number;
  previous_value: number;
  change: number;
  change_pct: number;
  base_period: string;
  drip_gap_points: number;
  drip_gap_pct: number;
  quality: QualityMetadata;
}

/** GET /public/methodology */
export interface PublicMethodology {
  methodology_version: string;
  base_period: string;
  summary: string;
  sections: { title: string; body: string }[];
}

/** GET /public/routes/summary */
export interface PublicRouteSummary {
  route_id: RouteId;
  label: string;
  origin: string;
  destination: string;
  pax_share: number;
  advertised_paise: number;
  total_paise: number;
  added_paise: number; // total minus advertised
  added_pct: number;
  change_24h_pct: number;
  date: string;
  provenance: Provenance;
}

export interface PublicOffer {
  platform: { id: string; name: string; kind: 'AIRLINE' | 'OTA' };
  advertised_paise: number;
  fuel_paise: number;
  airport_paise: number; // UDF + PSF
  gst_paise: number;
  platform_paise: number;
  total_paise: number;
}

/** GET /public/fares/search?from=&to=&date=  (404 ROUTE_NOT_TRACKED for other routes) */
export interface PublicFareSearch {
  from: string;
  to: string;
  date: string;
  days_ahead: number;
  flights: {
    carrier: string;
    carrier_code: string;
    flight_no: string;
    depart: string; // HH:MM
    arrive: string;
    duration: string;
    offers: PublicOffer[]; // cheapest total first
  }[];
  by_days_ahead: { days: number; label: string; cheapest_paise: number }[];
  seen_at: string | null; // last collection slot
  /** true until the collector has flight-level offers for every platform. */
  sample: boolean;
}
