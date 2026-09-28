"""/routes: per-route fares today, 24h change and the route-level total-fare index."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ...core.errors import ApiError
from ...econometrics.engine import IndexEngine
from ...econometrics.jsnum import add_days
from ...schemas.api import Envelope, RouteFareDay, RouteSummary
from ...services.published import PublishedIndex
from ..deps import date_query, envelope, index_engine, published

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("", response_model=Envelope[list[RouteSummary]], response_model_exclude_unset=True)
def list_routes(date: str | None = date_query(), pub: PublishedIndex = Depends(published),
                eng: IndexEngine = Depends(index_engine)):
    day = pub.resolve_date(date)
    prev = add_days(day, -1)
    history = [d for d in pub.dates if d <= day]
    data = []
    for r in eng.routes:
        today = eng.route_day(r.route_id, day)
        before = eng.route_day(r.route_id, prev) if prev in pub.by_series["AFI"] else today
        data.append({
            "route_id": r.route_id,
            "label": r.label,
            "origin": r.origin,
            "destination": r.destination,
            "pax_share": eng.route_weight[r.route_id],
            "base_fare_paise": today["base_fare_paise"],
            "total_fare_paise": today["total_payable_paise"],
            "change_24h_pct": ((today["total_payable_paise"] - before["total_payable_paise"])
                               / before["total_payable_paise"]) * 100,
            "sparkline": [{"date": d, "value": eng.route_index(r.route_id, d),
                           "provenance": pub.by_series["AFI"][d].provenance} for d in history],
            "quality": pub.quality(day),
        })
    return envelope(data, len(data))


@router.get("/{route_id}/fares", response_model=Envelope[list[RouteFareDay]], response_model_exclude_unset=True)
def route_fares(route_id: str, pub: PublishedIndex = Depends(published), eng: IndexEngine = Depends(index_engine)):
    if route_id not in eng.route_weight:
        raise ApiError(404, "ROUTE_NOT_FOUND", f"Unknown route {route_id}.")
    data = [{"date": d, "provenance": pub.by_series["AFI"][d].provenance, "components": eng.route_day(route_id, d)}
            for d in pub.dates]
    return envelope(data, len(data))
