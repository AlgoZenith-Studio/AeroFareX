"""/observations: raw quotes behind a day, and the full audit record for one of them."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Engine

from ...core.errors import ApiError
from ...econometrics.engine import Obs
from ...models import fare_observations as obs_t, raw_observations as raw_t
from ...schemas.api import Envelope, Observation, ObservationAudit
from ...services.dataset import _observation_query, row_to_obs
from ...services.published import PublishedIndex
from ..deps import date_query, db, envelope, published

router = APIRouter(prefix="/observations", tags=["observations"])


def observation_json(o: Obs) -> dict:
    return {
        "observation_id": o.observation_id,
        "observed_at": o.observed_at,
        "source": o.source,
        "fetch_tier": o.fetch_tier,
        "route_id": o.route_id,
        "carrier_code": o.carrier_code,
        "flight_number": o.flight_number,
        "departure_date": o.departure_date,
        "advance_window": o.window,
        "fare_family": o.fare_family,
        "baggage_allowance_kg": o.baggage_allowance_kg,
        "refundable": o.refundable,
        "available": o.available,
        "missing_reason": o.missing_reason,
        "validation_status": o.validation_status,
        "provenance": o.provenance,
        "components": o.components,
    }


@router.get("", response_model=Envelope[list[Observation]], response_model_exclude_unset=True)
def list_observations(
    date: str | None = date_query(),
    route: str | None = Query(None, description="Route id, e.g. DEL-BOM"),
    pub: PublishedIndex = Depends(published),
    engine: Engine = Depends(db),
):
    day = pub.resolve_date(date)
    q = _observation_query().where(obs_t.c.search_date == day)
    if route:
        q = q.where(obs_t.c.route_id == route)
    with engine.connect() as conn:
        data = [observation_json(row_to_obs(r)) for r in conn.execute(q)]
    return envelope(data, len(data))


@router.get("/{observation_id}", response_model=Envelope[ObservationAudit], response_model_exclude_unset=True)
def observation_audit(observation_id: str, engine: Engine = Depends(db)):
    q = _observation_query().add_columns(
        raw_t.c.object_key, raw_t.c.sha256, raw_t.c.batch_hash, raw_t.c.prev_batch_hash,
        raw_t.c.adapter_version.label("raw_adapter_version"), raw_t.c.fetched_at,
    ).where(obs_t.c.observation_id == observation_id)
    with engine.connect() as conn:
        row = conn.execute(q).first()
    if row is None:
        raise ApiError(404, "OBSERVATION_NOT_FOUND", "No such observation.")
    m = row._mapping
    return envelope({
        **observation_json(row_to_obs(row)),
        "raw_id": m["raw_id"],
        "object_key": m["object_key"],
        "sha256": m["sha256"],
        "batch_hash": m["batch_hash"],
        "prev_batch_hash": m["prev_batch_hash"],
        "adapter_version": m["raw_adapter_version"],
        "fetched_at": m["fetched_at"],
    })
