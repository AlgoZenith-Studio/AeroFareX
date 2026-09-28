"""/index/*: headline numbers, history, the index family and the movement waterfall."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import Engine, select

from ...core.config import get_settings
from ...core.errors import ApiError
from ...econometrics.basket import SERIES
from ...econometrics.jsnum import add_days
from ...models import index_contributions as contrib_t, index_snapshots as snap_t
from ...schemas.api import Attribution, Envelope, IndexFamily, IndexHistory, IndexLatest, IndexVintage, SeriesName
from ...services.published import PublishedIndex
from ..deps import DATE_PATTERN, date_query, db, envelope, published

router = APIRouter(prefix="/index", tags=["index"])


def latest_of(pub: PublishedIndex, series: str, date: str) -> dict:
    snap = pub.get(series, date)
    if snap is None:
        raise ApiError(404, "SERIES_NOT_PUBLISHED", f"{series} isn't published for {date}.")
    idx = pub.dates.index(date)
    prev = pub.get(series, pub.dates[idx - 1]) if idx > 0 else None
    previous_value = prev.value if prev else snap.value
    return {
        "series": series,
        "date": date,
        "value": snap.value,
        "previous_value": previous_value,
        "change": snap.value - previous_value,
        "change_pct": ((snap.value - previous_value) / previous_value) * 100,
        "base_period": snap.base_period,
        "quality": pub.quality(date, series),
    }


@router.get("/latest", response_model=Envelope[IndexLatest], response_model_exclude_unset=True)
def index_latest(series: SeriesName = "AFI", date: str | None = date_query(), pub: PublishedIndex = Depends(published)):
    return envelope(latest_of(pub, series, pub.resolve_date(date)))


@router.get("/history", response_model=Envelope[list[IndexHistory]], response_model_exclude_unset=True)
def index_history(
    series: str = Query("AFI", description="Comma-separated: AFI,TCT-AFI,ANC-AFI"),
    from_: str | None = Query(None, alias="from", pattern=DATE_PATTERN),
    to: str | None = Query(None, pattern=DATE_PATTERN),
    pub: PublishedIndex = Depends(published),
):
    names = [s.strip() for s in series.split(",") if s.strip()]
    unknown = [s for s in names if s not in SERIES]
    if unknown or not names:
        raise ApiError(422, "UNKNOWN_SERIES", f"Unknown series: {', '.join(unknown) or '(none)'}.")
    start = from_ or (pub.dates[0] if pub.dates else "")
    end = to or (pub.latest or "")
    boundary = pub.provenance_boundary()
    data = []
    for name in names:
        points = pub.by_series.get(name, {})
        data.append({
            "series": name,
            "base_period": get_settings().base_date,
            "provenance_boundary": boundary if boundary and start <= boundary <= end else None,
            "points": [{"date": d, "value": points[d].value, "provenance": points[d].provenance}
                       for d in sorted(points) if start <= d <= end],
        })
    return envelope(data)


@router.get("/family", response_model=Envelope[IndexFamily], response_model_exclude_unset=True)
def index_family(date: str | None = date_query(), pub: PublishedIndex = Depends(published)):
    day = pub.resolve_date(date)
    members = [latest_of(pub, s, day) for s in SERIES if pub.get(s, day)]
    afi = pub.get("AFI", day).value  # type: ignore[union-attr]
    tct_snap = pub.get("TCT-AFI", day)
    if tct_snap is None:
        raise ApiError(404, "SERIES_NOT_PUBLISHED", f"TCT-AFI isn't published for {day}.")
    tct = tct_snap.value
    return envelope({"date": day, "members": members, "drip_gap_points": tct - afi,
                     "drip_gap_pct": ((tct - afi) / afi) * 100})


@router.get("/attribution/{date}", response_model=Envelope[Attribution], response_model_exclude_unset=True)
def index_attribution(
    date: str = Path(pattern=DATE_PATTERN),
    series: SeriesName = "AFI",
    pub: PublishedIndex = Depends(published),
    engine: Engine = Depends(db),
):
    day = pub.resolve_date(date)
    if series == "ANC-AFI":
        raise ApiError(422, "UNSUPPORTED_SERIES", "Attribution is published for AFI and TCT-AFI.")
    snap = pub.get(series, day)
    previous = pub.get(series, add_days(day, -1))
    if snap is None or previous is None:
        raise ApiError(404, "NO_PREVIOUS_DAY", "Attribution needs a previous published day.")
    with engine.connect() as conn:
        rows = conn.execute(
            select(contrib_t).where(contrib_t.c.snapshot_id == snap.snapshot_id)
            .order_by(contrib_t.c.axis, contrib_t.c.sort_order)
        ).all()
    if not rows:
        raise ApiError(404, "NO_PREVIOUS_DAY", "Attribution needs a previous published day.")
    axes: dict[str, list[dict]] = {a: [] for a in ("route", "window", "carrier", "component", "driver")}
    for r in rows:
        axes[r.axis].append({"key": r.key, "label": r.label, "contribution": r.contribution})
    delta = snap.value - previous.value
    tolerance = get_settings().attribution_reconciliation_tolerance
    reconciled = all(abs(sum(c["contribution"] for c in items) - delta) < tolerance for items in axes.values())
    return envelope({
        "date": day, "series": series, "value": snap.value, "previous_value": previous.value, "delta": delta,
        "axes": axes, "reconciled": reconciled, "quality": pub.quality(day, series),
    })


@router.get("/vintages/{date}", response_model=Envelope[list[IndexVintage]], response_model_exclude_unset=True)
def index_vintages(date: str = Path(pattern=DATE_PATTERN), pub: PublishedIndex = Depends(published),
                   engine: Engine = Depends(db)):
    """Every published vintage for a day (revisions are new vintages, never edits)."""
    day = pub.resolve_date(date)
    with engine.connect() as conn:
        rows = conn.execute(
            select(snap_t).where(snap_t.c.index_date == day).order_by(snap_t.c.index_name, snap_t.c.vintage)
        ).all()
    data = [{
        "series": r.index_name, "date": r.index_date, "vintage": r.vintage, "value": r.value,
        "coverage": r.coverage_ratio, "imputation_rate": r.imputation_ratio, "provenance": r.provenance,
        "methodology_version": r.methodology_version, "calculated_at": r.calculated_at,
        "is_current": pub.get(r.index_name, day).snapshot_id == r.snapshot_id,  # type: ignore[union-attr]
    } for r in rows]
    return envelope(data, len(data))
