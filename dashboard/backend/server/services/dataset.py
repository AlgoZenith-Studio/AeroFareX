"""
Load observations from SQLite into an IndexEngine.

The engine is rebuilt only when the data changes (a new collection run or publication),
detected with a cheap fingerprint query, so API reads stay fast between runs.
"""
from __future__ import annotations

import threading

from sqlalchemy import Engine, func, select

from ..core.config import get_settings
from ..econometrics.basket import DAYS_WINDOW
from ..econometrics.engine import CarrierDef, IndexEngine, Obs, RouteDef
from ..models import (
    ancillary_observations as anc_t, carriers as carriers_t, fare_components as comp_t,
    fare_observations as obs_t, index_snapshots as snap_t, raw_observations as raw_t, route_weights as rw_t,
    routes as routes_t, sources as sources_t,
)


def load_routes(conn, on_date: str | None = None) -> list[RouteDef]:
    """Basket routes with the DGCA pax share in force on `on_date` (latest if None)."""
    weights: dict[str, float] = {}
    q = select(rw_t.c.route_id, rw_t.c.pax_share, rw_t.c.effective_from).order_by(rw_t.c.effective_from)
    for row in conn.execute(q):
        if on_date is None or row.effective_from <= on_date:
            weights[row.route_id] = row.pax_share
    out = []
    for r in conn.execute(select(routes_t).order_by(routes_t.c.sort_order)):
        if r.route_id not in weights:
            raise ValueError(f"route {r.route_id} has no DGCA weight in force on {on_date}")
        out.append(RouteDef(r.route_id, r.label, r.origin, r.destination, weights[r.route_id]))
    return out


def load_carriers(conn) -> list[CarrierDef]:
    return [CarrierDef(r.carrier_code, r.label) for r in conn.execute(select(carriers_t).order_by(carriers_t.c.sort_order))]


def _observation_query():
    route_order = select(routes_t.c.sort_order).where(routes_t.c.route_id == obs_t.c.route_id).scalar_subquery()
    source_order = select(sources_t.c.sort_order).where(sources_t.c.source_id == obs_t.c.source).scalar_subquery()
    return (
        select(obs_t, comp_t, raw_t.c.fetch_tier)
        .join(comp_t, comp_t.c.observation_id == obs_t.c.observation_id, isouter=True)
        .join(raw_t, raw_t.c.raw_id == obs_t.c.raw_id)
        .order_by(obs_t.c.search_date, route_order, obs_t.c.advance_days, source_order, obs_t.c.observed_at)
    )


def row_to_obs(r) -> Obs:  # type: ignore[no-untyped-def]
    m = r._mapping
    has_components = m["base_fare_paise"] is not None
    return Obs(
        observation_id=m["observation_id"],
        observed_at=m["observed_at"],
        search_date=m["search_date"],
        source=m["source"],
        fetch_tier=m["fetch_tier"],
        route_id=m["route_id"],
        carrier_code=m["carrier_code"],
        flight_number=m["flight_number"],
        departure_date=m["departure_date"],
        window=DAYS_WINDOW.get(m["advance_days"], f"T+{m['advance_days']}"),
        fare_family=m["fare_family"],
        baggage_allowance_kg=m["baggage_allowance_kg"],
        refundable=None if m["refundable"] is None else bool(m["refundable"]),
        available=bool(m["available"]),
        missing_reason=m["missing_reason"],
        validation_status=m["validation_status"],
        provenance=m["provenance"],
        components={
            "base_fare_paise": m["base_fare_paise"],
            "fuel_surcharge_paise": m["fuel_surcharge_paise"],
            "udf_paise": m["udf_paise"],
            "psf_paise": m["psf_paise"],
            "gst_paise": m["gst_paise"],
            "platform_fee_paise": m["platform_fee_paise"],
            "total_payable_paise": m["total_payable_paise"],
        } if has_components else None,
    )


def build_engine(conn, until: str | None = None) -> IndexEngine:
    q = _observation_query()
    if until:
        q = q.where(obs_t.c.search_date <= until)
    # Only the five basket windows enter the index.
    q = q.where(obs_t.c.advance_days.in_(list(DAYS_WINDOW)))
    observations = [row_to_obs(r) for r in conn.execute(q)]
    ancillary: dict[str, dict[str, list[int]]] = {}
    aq = select(anc_t.c.search_date, anc_t.c.item, anc_t.c.price_paise).order_by(anc_t.c.search_date, anc_t.c.ancillary_id)
    if until:
        aq = aq.where(anc_t.c.search_date <= until)
    for r in conn.execute(aq):
        ancillary.setdefault(r.search_date, {}).setdefault(r.item, []).append(r.price_paise)
    first_candidates = [o.search_date for o in observations] + list(ancillary)
    first_date = min(first_candidates) if first_candidates else get_settings().base_date
    return IndexEngine(
        observations=observations,
        routes=load_routes(conn, until),
        carriers=load_carriers(conn),
        base_date=get_settings().base_date,
        first_date=first_date,
        ancillary=ancillary,
    )


class EngineCache:
    """One engine per data version; rebuilt lazily after collection or publication."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._key: tuple | None = None
        self._engine: IndexEngine | None = None

    def get(self, db: Engine) -> IndexEngine:
        with db.connect() as conn:
            # Tables are append-only, so row counts change exactly when the data does.
            key = (
                conn.execute(select(func.count(obs_t.c.observation_id))).scalar_one(),
                conn.execute(select(func.count(anc_t.c.ancillary_id))).scalar_one(),
                conn.execute(select(func.count(snap_t.c.snapshot_id))).scalar_one(),
            )
            with self._lock:
                if key != self._key or self._engine is None:
                    self._engine = build_engine(conn)
                    self._key = key
                return self._engine

    def clear(self) -> None:
        with self._lock:
            self._key = None
            self._engine = None


engine_cache = EngineCache()
