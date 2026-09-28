"""
SQLAlchemy Core tables mirroring infra/db/migrations (TRD Part E). The SQL files own the
DDL (STRICT tables, CHECKs, append-only triggers); these definitions are for queries and
inserts only, so they carry columns and keys, not constraints. Keep the two in step.
"""
from sqlalchemy import Column, Float, Integer, MetaData, String, Table

metadata = MetaData()

routes = Table(
    "routes", metadata,
    Column("route_id", String, primary_key=True), Column("label", String), Column("origin", String),
    Column("destination", String), Column("sort_order", Integer),
)
route_weights = Table(
    "route_weights", metadata,
    Column("route_id", String, primary_key=True), Column("effective_from", String, primary_key=True),
    Column("pax_share", Float), Column("source_note", String),
)
carriers = Table(
    "carriers", metadata,
    Column("carrier_code", String, primary_key=True), Column("label", String), Column("sort_order", Integer),
)
sources = Table(
    "sources", metadata,
    Column("source_id", String, primary_key=True), Column("label", String), Column("type", String),
    Column("carrier_code", String), Column("fetch_tier", String), Column("sort_order", Integer),
)
raw_observations = Table(
    "raw_observations", metadata,
    Column("raw_id", String, primary_key=True), Column("run_id", String), Column("source", String),
    Column("object_key", String), Column("sha256", String), Column("batch_hash", String),
    Column("prev_batch_hash", String), Column("adapter_version", String), Column("fetch_tier", String),
    Column("fetched_at", String),
)
fare_observations = Table(
    "fare_observations", metadata,
    Column("observation_id", String, primary_key=True), Column("observed_at", String), Column("raw_id", String),
    Column("source", String), Column("route_id", String), Column("carrier_code", String),
    Column("flight_number", String), Column("departure_datetime", String), Column("search_date", String),
    Column("departure_date", String), Column("advance_days", Integer), Column("fare_family", String),
    Column("baggage_allowance_kg", Integer), Column("refundable", Integer), Column("available", Integer),
    Column("missing_reason", String), Column("validation_status", String), Column("provenance", String),
    Column("fingerprint", String), Column("adapter_version", String),
)
fare_components = Table(
    "fare_components", metadata,
    Column("observation_id", String, primary_key=True), Column("base_fare_paise", Integer),
    Column("fuel_surcharge_paise", Integer), Column("gst_paise", Integer), Column("udf_paise", Integer),
    Column("psf_paise", Integer), Column("platform_fee_paise", Integer), Column("total_payable_paise", Integer),
    Column("currency", String),
)
ancillary_observations = Table(
    "ancillary_observations", metadata,
    Column("ancillary_id", String, primary_key=True), Column("observed_at", String), Column("raw_id", String),
    Column("source", String), Column("search_date", String), Column("item", String), Column("price_paise", Integer),
    Column("provenance", String), Column("adapter_version", String),
)
collection_runs = Table(
    "collection_runs", metadata,
    Column("run_id", String, primary_key=True), Column("slot", String), Column("started_at", String),
    Column("finished_at", String), Column("duration_s", Float), Column("observations", Integer),
    Column("status", String), Column("batch_hash", String), Column("note", String),
)
source_health = Table(
    "source_health", metadata,
    Column("source_id", String, primary_key=True), Column("state", String), Column("consecutive_failures", Integer),
    Column("opened_at", String), Column("last_success_at", String), Column("adapter_version", String),
    Column("updated_at", String),
)
index_snapshots = Table(
    "index_snapshots", metadata,
    Column("snapshot_id", String, primary_key=True), Column("index_name", String), Column("index_date", String),
    Column("value", Float), Column("base_value", Float), Column("base_period", String),
    Column("coverage_ratio", Float), Column("imputation_ratio", Float), Column("provenance", String),
    Column("vintage", Integer), Column("is_provisional", Integer), Column("methodology_version", String),
    Column("calculated_at", String),
)
index_contributions = Table(
    "index_contributions", metadata,
    Column("snapshot_id", String, primary_key=True), Column("axis", String, primary_key=True),
    Column("key", String, primary_key=True), Column("label", String), Column("contribution", Float),
    Column("sort_order", Integer),
)
audit_events = Table(
    "audit_events", metadata,
    Column("event_id", String, primary_key=True), Column("occurred_at", String), Column("actor", String),
    Column("action", String), Column("detail", String),
)
