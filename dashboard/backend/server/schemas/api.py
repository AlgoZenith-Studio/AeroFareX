"""
Pydantic mirrors of packages/shared-types/index.ts (TRD Part D), field for field.
If you change one, change the other; tests/test_contract.py checks the field names.
Money is integer paise; index values are points (base = 100); dates are YYYY-MM-DD.
"""
from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel

SeriesName = Literal["AFI", "TCT-AFI", "ANC-AFI"]
RouteId = Literal["DEL-BOM", "DEL-BLR", "BOM-BLR", "DEL-CCU", "BLR-HYD"]
AdvanceWindow = Literal["T+1", "T+7", "T+15", "T+30", "T+45"]
CarrierCode = Literal["6E", "AI", "QP", "SG"]
SourceId = Literal["indigo", "air_india", "akasa", "spicejet", "makemytrip"]
SourceType = Literal["AIRLINE", "OTA", "REFERENCE"]
FetchTier = Literal["HTTP", "DYNAMIC", "BROWSER"]
CircuitState = Literal["HEALTHY", "DEGRADED", "OPEN", "RECOVERING"]
MissingReason = Literal["SOLD_OUT", "NO_FLIGHT", "MISSING_SOURCE", "SOURCE_ERROR", "PARSER_ERROR", "BLOCKED", "UNKNOWN"]
ImputationRule = Literal["CROSS_SOURCE", "CELL_MEAN", "CARRY_FORWARD", "EXCLUDED"]
Provenance = Literal["REAL", "SIMULATED"]
ValidationStatus = Literal["VALID", "INVALID", "FLAGGED"]
QualityStatus = Literal["GOOD", "SERIOUS", "CRITICAL"]

T = TypeVar("T")


# ---------------------------------------------------------------- envelope
class Meta(BaseModel):
    page: int | None = None
    page_size: int | None = None
    total: int | None = None
    generated_at: str


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta


class ApiErrorBody(BaseModel):
    error: str
    code: str
    message: str
    correlation_id: str


# ---------------------------------------------------------------- quality
class QualityMetadata(BaseModel):
    coverage: float
    imputation_rate: float
    provenance: Provenance
    vintage: int
    is_provisional: bool
    methodology_version: str
    quality_status: QualityStatus


# ---------------------------------------------------------------- index
class IndexPoint(BaseModel):
    date: str
    value: float
    provenance: Provenance


class IndexLatest(BaseModel):
    series: SeriesName
    date: str
    value: float
    previous_value: float
    change: float
    change_pct: float
    base_period: str
    quality: QualityMetadata


class IndexHistory(BaseModel):
    series: SeriesName
    base_period: str
    provenance_boundary: str | None
    points: list[IndexPoint]


class IndexFamily(BaseModel):
    date: str
    members: list[IndexLatest]
    drip_gap_points: float
    drip_gap_pct: float


class AttributionContribution(BaseModel):
    key: str
    label: str
    contribution: float


class AttributionAxes(BaseModel):
    route: list[AttributionContribution]
    carrier: list[AttributionContribution]
    window: list[AttributionContribution]
    component: list[AttributionContribution]
    driver: list[AttributionContribution]


class Attribution(BaseModel):
    date: str
    series: SeriesName
    previous_value: float
    value: float
    delta: float
    axes: AttributionAxes
    reconciled: bool
    quality: QualityMetadata


# ---------------------------------------------------------------- routes & fares
class FareComponents(BaseModel):
    base_fare_paise: int
    fuel_surcharge_paise: int
    udf_paise: int
    psf_paise: int
    gst_paise: int
    platform_fee_paise: int
    total_payable_paise: int


class RouteSummary(BaseModel):
    route_id: RouteId
    label: str
    origin: str
    destination: str
    pax_share: float
    base_fare_paise: int
    total_fare_paise: int
    change_24h_pct: float
    sparkline: list[IndexPoint]
    quality: QualityMetadata


class RouteFareDay(BaseModel):
    date: str
    provenance: Provenance
    components: FareComponents


class Observation(BaseModel):
    observation_id: str
    observed_at: str
    source: SourceId
    fetch_tier: FetchTier
    route_id: RouteId
    # "ZZ" = unknown carrier: a failed OTA fetch has no airline to name (never priced).
    # Not yet in the TS CarrierCode union; add it there before an OTA adapter goes live.
    carrier_code: CarrierCode | Literal["ZZ"]
    flight_number: str | None
    departure_date: str
    advance_window: AdvanceWindow
    fare_family: str | None
    baggage_allowance_kg: int | None
    refundable: bool | None
    available: bool
    missing_reason: MissingReason | None
    validation_status: ValidationStatus
    provenance: Provenance
    components: FareComponents | None


class ObservationAudit(Observation):
    raw_id: str
    object_key: str
    sha256: str
    batch_hash: str
    prev_batch_hash: str | None
    adapter_version: str
    fetched_at: str


# ---------------------------------------------------------------- lead time
class LeadTimeCell(BaseModel):
    route_id: RouteId
    window: AdvanceWindow
    total_fare_paise: int | None
    missing_reason: MissingReason | None
    provenance: Provenance


class LeadTimeMatrix(BaseModel):
    date: str
    windows: list[AdvanceWindow]
    weights: dict[AdvanceWindow, float]
    cells: list[LeadTimeCell]


# ---------------------------------------------------------------- quality
class CoverageDay(BaseModel):
    date: str
    expected: int
    observed: int
    coverage: float
    imputation_rate: float
    provenance: Provenance
    by_rule: dict[ImputationRule, int]
    missing_by_reason: dict[MissingReason, int]


# ---------------------------------------------------------------- sources & health
class SourceHealth(BaseModel):
    source: SourceId
    label: str
    type: SourceType
    fetch_tier: FetchTier
    state: CircuitState
    last_success_at: str | None
    success_rate_7d: float
    consecutive_failures: int
    adapter_version: str


class CollectionRun(BaseModel):
    run_id: str
    slot: Literal["02:30", "05:30", "13:00", "19:00"]
    started_at: str
    duration_s: float
    observations: int
    status: Literal["SUCCESS", "PARTIAL", "FAILED"]
    batch_hash: str


class HealthSnapshot(BaseModel):
    sources: list[SourceHealth]
    runs: list[CollectionRun]
    next_run_at: str
    next_publication_at: str


# ---------------------------------------------------------------- methodology & vintages
class IndexVintage(BaseModel):
    series: SeriesName
    date: str
    vintage: int
    value: float
    coverage: float
    imputation_rate: float
    provenance: Provenance
    methodology_version: str
    calculated_at: str
    is_current: bool


class MethodologyWeight(BaseModel):
    key: str
    label: str
    weight: float


class Methodology(BaseModel):
    methodology_version: str
    base_period: str
    formula: str
    elementary_aggregate: str
    route_weights: list[MethodologyWeight]
    window_weights: list[MethodologyWeight]
    outlier_rule: str
    imputation_rules: dict[ImputationRule, str]
    attribution: str
    quality_thresholds: dict[QualityStatus, str]
    notes: list[str]
