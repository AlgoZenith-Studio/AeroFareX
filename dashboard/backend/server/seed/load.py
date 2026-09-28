"""
`aerofarex seed-demo`: load the dashboard's demo dataset into SQLite and publish all 30
days, so the dashboard runs against the real API with the numbers it shows in mock mode.

Refuses to touch a database that holds collected data: demo rows must never mix with
real observations in an official statistic.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from sqlalchemy import Engine, func, insert, select

from ..econometrics.basket import WINDOW_DAYS
from ..models import (
    ancillary_observations, collection_runs, fare_components, fare_observations, raw_observations, source_health,
)
from ..services.publish import publish_range
from .generator import generate

log = logging.getLogger("aerofarex.seed")

SEED_RUN_ID = "seed-demo"


class SeedRefused(Exception):
    pass


def fingerprint(*parts: object) -> str:
    return hashlib.sha256("|".join("" if p is None else str(p) for p in parts).encode()).hexdigest()


def load_demo(db: Engine) -> dict:
    with db.connect() as conn:
        foreign = conn.execute(
            select(func.count()).select_from(raw_observations).where(raw_observations.c.run_id != SEED_RUN_ID)
        ).scalar_one()
        seeded = conn.execute(
            select(func.count()).select_from(raw_observations).where(raw_observations.c.run_id == SEED_RUN_ID)
        ).scalar_one()
    if foreign:
        raise SeedRefused("This database holds collected observations; demo data can't be mixed in.")
    if seeded:
        raise SeedRefused("Demo data is already loaded (tables are append-only; delete the file to start over).")

    data = generate()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    raws, obs, comps = [], [], []
    for o in data.observations:
        a = data.audits[o.observation_id]
        raws.append(dict(
            raw_id=a["raw_id"], run_id=SEED_RUN_ID, source=o.source, object_key=a["object_key"], sha256=a["sha256"],
            batch_hash=a["batch_hash"], prev_batch_hash=a["prev_batch_hash"], adapter_version=a["adapter_version"],
            fetch_tier=o.fetch_tier, fetched_at=a["fetched_at"],
        ))
        obs.append(dict(
            observation_id=o.observation_id, observed_at=o.observed_at, raw_id=a["raw_id"], source=o.source,
            route_id=o.route_id, carrier_code=o.carrier_code, flight_number=o.flight_number, departure_datetime=None,
            search_date=o.search_date, departure_date=o.departure_date, advance_days=WINDOW_DAYS[o.window],
            fare_family=o.fare_family, baggage_allowance_kg=o.baggage_allowance_kg,
            refundable=None if o.refundable is None else int(o.refundable), available=int(o.available),
            missing_reason=o.missing_reason, validation_status=o.validation_status, provenance=o.provenance,
            fingerprint=fingerprint(o.source, o.route_id, o.carrier_code, o.flight_number, o.departure_date,
                                    o.search_date, o.window, o.observed_at),
            adapter_version=a["adapter_version"],
        ))
        if o.components:
            comps.append(dict(observation_id=o.observation_id, currency="INR", **o.components))

    with db.begin() as conn:
        conn.execute(insert(raw_observations), raws)
        conn.execute(insert(fare_observations), obs)
        conn.execute(insert(fare_components), comps)
        conn.execute(insert(ancillary_observations), data.ancillary)
        conn.execute(insert(collection_runs), [
            dict(r, finished_at=None, note="demo seed") for r in data.runs
        ])
        conn.execute(insert(source_health), [dict(h, opened_at=None, updated_at=now) for h in data.source_health])

    published = publish_range(db, data.dates, actor="seed-demo")
    log.info("loaded %d demo observations and published %d days", len(obs), len(published))
    return {
        "observations": len(obs),
        "published_days": len(published),
        "latest": published[-1].values if published else {},
        "reconciled": all(p.reconciled for p in published),
    }
