-- AeroFareX schema v1 (TRD Part E). SQLite 3, STRICT tables, integer paise,
-- ISO-8601 UTC timestamps as TEXT. Applied by `aerofarex migrate`
-- (server/db/migrate.py), which records each file in schema_migrations.

-- ------------------------------------------------------------------ reference
CREATE TABLE routes (
    route_id    TEXT PRIMARY KEY,                      -- e.g. DEL-BOM
    label       TEXT NOT NULL,
    origin      TEXT NOT NULL CHECK (length(origin) = 3),
    destination TEXT NOT NULL CHECK (length(destination) = 3),
    sort_order  INTEGER NOT NULL
) STRICT;

-- DGCA passenger volume per route; W_r is pax_share normalised over the basket.
-- A new share takes effect from effective_from (monthly chaining links here).
CREATE TABLE route_weights (
    route_id       TEXT NOT NULL REFERENCES routes(route_id),
    effective_from TEXT NOT NULL,
    pax_share      REAL NOT NULL CHECK (pax_share > 0),
    source_note    TEXT,
    PRIMARY KEY (route_id, effective_from)
) STRICT;

CREATE TABLE carriers (
    carrier_code TEXT PRIMARY KEY CHECK (length(carrier_code) = 2),
    label        TEXT NOT NULL,
    sort_order   INTEGER NOT NULL
) STRICT;

CREATE TABLE sources (
    source_id    TEXT PRIMARY KEY,
    label        TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('AIRLINE','OTA','REFERENCE')),
    carrier_code TEXT REFERENCES carriers(carrier_code),
    fetch_tier   TEXT NOT NULL CHECK (fetch_tier IN ('HTTP','DYNAMIC','BROWSER')),
    sort_order   INTEGER NOT NULL
) STRICT;

-- ------------------------------------------------------------------ collection
-- Append-only raw observations (the payload itself lives in the raw archive).
CREATE TABLE raw_observations (
    raw_id          TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL,
    source          TEXT NOT NULL,
    object_key      TEXT NOT NULL,
    sha256          TEXT NOT NULL CHECK (length(sha256) = 64),
    batch_hash      TEXT NOT NULL CHECK (length(batch_hash) = 64),
    prev_batch_hash TEXT,
    adapter_version TEXT NOT NULL,
    fetch_tier      TEXT NOT NULL CHECK (fetch_tier IN ('HTTP','DYNAMIC','BROWSER')),
    fetched_at      TEXT NOT NULL
) STRICT;

CREATE TABLE fare_observations (
    observation_id       TEXT PRIMARY KEY,
    observed_at          TEXT NOT NULL,
    raw_id               TEXT NOT NULL REFERENCES raw_observations(raw_id),
    source               TEXT NOT NULL,
    route_id             TEXT NOT NULL,
    carrier_code         TEXT NOT NULL CHECK (length(carrier_code) = 2),
    flight_number        TEXT,
    departure_datetime   TEXT,
    search_date          TEXT NOT NULL,
    departure_date       TEXT NOT NULL,
    advance_days         INTEGER NOT NULL,
    fare_family          TEXT,
    baggage_allowance_kg INTEGER,
    refundable           INTEGER CHECK (refundable IN (0,1)),
    available            INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)),
    missing_reason       TEXT CHECK (missing_reason IN ('SOLD_OUT','NO_FLIGHT','MISSING_SOURCE','SOURCE_ERROR','PARSER_ERROR','BLOCKED','UNKNOWN')),
    validation_status    TEXT NOT NULL DEFAULT 'VALID' CHECK (validation_status IN ('VALID','INVALID','FLAGGED')),
    provenance           TEXT NOT NULL DEFAULT 'REAL' CHECK (provenance IN ('REAL','SIMULATED')),
    fingerprint          TEXT NOT NULL,
    adapter_version      TEXT NOT NULL,
    -- an unavailable quote must say why; an available one must not
    CHECK ((available = 1 AND missing_reason IS NULL) OR (available = 0 AND missing_reason IS NOT NULL))
) STRICT;
CREATE INDEX idx_obs_cell ON fare_observations (search_date, route_id, advance_days);
CREATE INDEX idx_obs_source ON fare_observations (source, search_date);

CREATE TABLE fare_components (
    observation_id       TEXT PRIMARY KEY REFERENCES fare_observations(observation_id),
    base_fare_paise      INTEGER NOT NULL CHECK (base_fare_paise >= 0),
    fuel_surcharge_paise INTEGER NOT NULL CHECK (fuel_surcharge_paise >= 0),
    gst_paise            INTEGER NOT NULL CHECK (gst_paise >= 0),
    udf_paise            INTEGER NOT NULL CHECK (udf_paise >= 0),
    psf_paise            INTEGER NOT NULL CHECK (psf_paise >= 0),
    platform_fee_paise   INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_paise >= 0),
    total_payable_paise  INTEGER NOT NULL,
    currency             TEXT NOT NULL DEFAULT 'INR',
    CHECK (total_payable_paise = base_fare_paise + fuel_surcharge_paise + gst_paise
                               + udf_paise + psf_paise + platform_fee_paise)
) STRICT;

-- Seat / bag / meal prices for the ANC-AFI ancillary basket.
CREATE TABLE ancillary_observations (
    ancillary_id    TEXT PRIMARY KEY,
    observed_at     TEXT NOT NULL,
    raw_id          TEXT REFERENCES raw_observations(raw_id),
    source          TEXT NOT NULL,
    search_date     TEXT NOT NULL,
    item            TEXT NOT NULL CHECK (item IN ('SEAT','BAG','MEAL')),
    price_paise     INTEGER NOT NULL CHECK (price_paise > 0),
    provenance      TEXT NOT NULL DEFAULT 'REAL' CHECK (provenance IN ('REAL','SIMULATED')),
    adapter_version TEXT NOT NULL
) STRICT;
CREATE INDEX idx_anc_date ON ancillary_observations (search_date, item);

CREATE TABLE collection_runs (
    run_id       TEXT PRIMARY KEY,
    slot         TEXT NOT NULL CHECK (slot IN ('02:30','05:30','13:00','19:00','manual')),
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    duration_s   REAL,
    observations INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCESS','PARTIAL','FAILED')),
    batch_hash   TEXT,
    note         TEXT
) STRICT;

-- Circuit breaker state per source (mutable by design: it is live state).
CREATE TABLE source_health (
    source_id            TEXT PRIMARY KEY REFERENCES sources(source_id),
    state                TEXT NOT NULL DEFAULT 'HEALTHY' CHECK (state IN ('HEALTHY','DEGRADED','OPEN','RECOVERING')),
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    opened_at            TEXT,
    last_success_at      TEXT,
    adapter_version      TEXT NOT NULL,
    updated_at           TEXT NOT NULL
) STRICT;

-- ------------------------------------------------------------------ publication
CREATE TABLE index_snapshots (
    snapshot_id         TEXT PRIMARY KEY,
    index_name          TEXT NOT NULL CHECK (index_name IN ('AFI','TCT-AFI','ANC-AFI')),
    index_date          TEXT NOT NULL,
    value               REAL NOT NULL,
    base_value          REAL NOT NULL DEFAULT 100,
    base_period         TEXT NOT NULL,
    coverage_ratio      REAL NOT NULL,
    imputation_ratio    REAL NOT NULL,
    provenance          TEXT NOT NULL CHECK (provenance IN ('REAL','SIMULATED')),
    vintage             INTEGER NOT NULL DEFAULT 1,
    is_provisional      INTEGER NOT NULL DEFAULT 0,
    methodology_version TEXT NOT NULL,
    calculated_at       TEXT NOT NULL,
    UNIQUE (index_name, index_date, vintage)
) STRICT;

-- The published movement waterfall, one row per axis entry (TRD Part B §5).
CREATE TABLE index_contributions (
    snapshot_id  TEXT NOT NULL REFERENCES index_snapshots(snapshot_id),
    axis         TEXT NOT NULL CHECK (axis IN ('route','carrier','window','component','driver')),
    key          TEXT NOT NULL,
    label        TEXT NOT NULL,
    contribution REAL NOT NULL,
    sort_order   INTEGER NOT NULL,
    PRIMARY KEY (snapshot_id, axis, key)
) STRICT;

CREATE TABLE audit_events (
    event_id    TEXT PRIMARY KEY,
    occurred_at TEXT NOT NULL,
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL,
    detail      TEXT
) STRICT;

-- ------------------------------------------------------------------ append-only guarantees
-- Enforced in the database, not only in code. Revisions are new vintages, never edits.
CREATE TRIGGER raw_no_update BEFORE UPDATE ON raw_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER raw_no_delete BEFORE DELETE ON raw_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER obs_no_update BEFORE UPDATE ON fare_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER obs_no_delete BEFORE DELETE ON fare_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER comp_no_update BEFORE UPDATE ON fare_components BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER comp_no_delete BEFORE DELETE ON fare_components BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER anc_no_update BEFORE UPDATE ON ancillary_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER anc_no_delete BEFORE DELETE ON ancillary_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER snap_no_update BEFORE UPDATE ON index_snapshots BEGIN SELECT RAISE(ABORT, 'publish a new vintage instead'); END;
CREATE TRIGGER snap_no_delete BEFORE DELETE ON index_snapshots BEGIN SELECT RAISE(ABORT, 'publish a new vintage instead'); END;
CREATE TRIGGER contrib_no_update BEFORE UPDATE ON index_contributions BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER contrib_no_delete BEFORE DELETE ON index_contributions BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'append-only'); END;
