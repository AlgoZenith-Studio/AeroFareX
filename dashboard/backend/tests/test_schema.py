"""M1: the database itself refuses edits to raw data, observations and published snapshots."""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


@pytest.mark.parametrize("statement", [
    "UPDATE raw_observations SET source = 'x'",
    "DELETE FROM raw_observations",
    "UPDATE fare_observations SET available = 0",
    "DELETE FROM fare_observations",
    "UPDATE fare_components SET gst_paise = 0",
    "DELETE FROM fare_components",
    "UPDATE index_snapshots SET value = 1",
    "DELETE FROM index_snapshots",
    "UPDATE index_contributions SET contribution = 0",
    "DELETE FROM audit_events",
])
def test_append_only(seeded, statement):
    engine, _ = seeded
    with pytest.raises(IntegrityError, match="append-only|new vintage"):
        with engine.begin() as conn:
            conn.execute(text(statement))


def test_components_must_add_up(seeded):
    engine, _ = seeded
    with engine.connect() as conn:
        obs_id = conn.execute(text(
            "SELECT o.observation_id FROM fare_observations o LEFT JOIN fare_components c USING (observation_id) "
            "WHERE c.observation_id IS NULL LIMIT 1")).scalar_one()
    with pytest.raises(IntegrityError, match="CHECK"):
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO fare_components (observation_id, base_fare_paise, fuel_surcharge_paise, gst_paise, "
                "udf_paise, psf_paise, platform_fee_paise, total_payable_paise) VALUES (:id, 100, 10, 5, 1, 1, 0, 999)"
            ), {"id": obs_id})


def test_unavailable_quote_needs_reason(seeded):
    engine, _ = seeded
    with engine.connect() as conn:
        raw_id = conn.execute(text("SELECT raw_id FROM raw_observations LIMIT 1")).scalar_one()
    with pytest.raises(IntegrityError, match="CHECK"):
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO fare_observations (observation_id, observed_at, raw_id, source, route_id, carrier_code, "
                "search_date, departure_date, advance_days, available, missing_reason, fingerprint, adapter_version) "
                "VALUES ('t-1', '2026-09-27T00:00:00Z', :raw, 'indigo', 'DEL-BOM', '6E', '2026-09-27', '2026-09-28', "
                "1, 0, NULL, 'fp', 'test@1')"), {"raw": raw_id})


def test_migrations_are_idempotent(seeded):
    from server.core.config import get_settings
    from server.db.migrate import migrate

    engine, _ = seeded
    assert migrate(engine, get_settings().migrations_dir) == []


def test_seed_refuses_second_load(seeded):
    from server.seed.load import SeedRefused, load_demo

    engine, _ = seeded
    with pytest.raises(SeedRefused):
        load_demo(engine)
