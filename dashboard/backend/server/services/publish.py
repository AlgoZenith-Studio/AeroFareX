"""
Index publication (TRD Part B, Part E): compute the day's AFI / TCT-AFI / ANC-AFI and the
movement waterfall, and write them as a new vintage. Snapshots are never edited; a
revision is a new vintage row (append-only triggers enforce this).
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import Engine, func, insert, select

from ..core.config import get_settings
from ..econometrics.basket import SERIES_MEASURE
from ..econometrics.engine import BasePeriodIncomplete, IndexEngine
from ..econometrics.jsnum import add_days
from ..models import audit_events, index_contributions, index_snapshots
from .dataset import build_engine

log = logging.getLogger("aerofarex.publish")

AXES_ORDER = ("route", "carrier", "window", "component", "driver")


class PublicationError(Exception):
    pass


@dataclass
class Published:
    date: str
    vintage: int
    values: dict[str, float]
    reconciled: bool


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def publish_date(db: Engine, date: str, actor: str = "scheduler", engine: IndexEngine | None = None) -> Published:
    """Publish (or re-publish as a new vintage) the index for `date`."""
    settings = get_settings()
    with db.begin() as conn:
        eng = engine or build_engine(conn, until=date)
        quality = eng.quality(date)
        if quality.observed == 0:
            raise PublicationError(f"no usable observations on {date}; nothing to publish")

        vintage = (conn.execute(
            select(func.max(index_snapshots.c.vintage)).where(index_snapshots.c.index_date == date)
        ).scalar() or 0) + 1
        provenance = eng.provenance(date)
        calculated_at = _now()
        has_previous = date > eng.first_date and bool(eng.observations_on(add_days(date, -1)))

        try:
            values: dict[str, float] = {
                "AFI": eng.index_value(date, "base"),
                "TCT-AFI": eng.index_value(date, "total"),
            }
        except BasePeriodIncomplete as exc:
            raise PublicationError(
                f"{exc}. Every route × window must be priced on the base day; set BASE_DATE to a fully "
                "collected day (see /api/v1/quality/coverage).") from exc
        anc = eng.ancillary_index(date)
        if anc is not None:
            values["ANC-AFI"] = anc

        reconciled = True
        for series, value in values.items():
            snapshot_id = str(uuid.uuid4())
            conn.execute(insert(index_snapshots).values(
                snapshot_id=snapshot_id, index_name=series, index_date=date, value=value, base_value=100.0,
                base_period=settings.base_date, coverage_ratio=quality.coverage,
                imputation_ratio=quality.imputation_rate, provenance=provenance, vintage=vintage,
                is_provisional=1, methodology_version=settings.methodology_version, calculated_at=calculated_at,
            ))
            if series in SERIES_MEASURE and has_previous:
                delta, axes = eng.attribution(date, SERIES_MEASURE[series])
                expected = value - eng.index_value(add_days(date, -1), SERIES_MEASURE[series])
                rows = []
                for axis in AXES_ORDER:
                    total = 0.0
                    for i, c in enumerate(axes[axis]):
                        total += c.contribution
                        rows.append(dict(snapshot_id=snapshot_id, axis=axis, key=c.key, label=c.label,
                                         contribution=c.contribution, sort_order=i))
                    if abs(total - expected) >= settings.attribution_reconciliation_tolerance:
                        reconciled = False
                        log.error("%s %s: %s axis sums to %.6f, index moved %.6f", series, date, axis, total, expected)
                conn.execute(insert(index_contributions), rows)

        conn.execute(insert(audit_events).values(
            event_id=str(uuid.uuid4()), occurred_at=calculated_at, actor=actor, action="PUBLISH_INDEX",
            detail=json.dumps({"date": date, "vintage": vintage, "values": values, "coverage": quality.coverage,
                               "reconciled": reconciled}),
        ))
    log.info("published %s vintage %d: %s", date, vintage, {k: round(v, 3) for k, v in values.items()})
    return Published(date, vintage, values, reconciled)


def publish_range(db: Engine, dates: list[str], actor: str) -> list[Published]:
    """Publish several days from one engine (used after a bulk load)."""
    with db.connect() as conn:
        eng = build_engine(conn)
    return [publish_date(db, d, actor=actor, engine=eng) for d in dates]
