"""
Public read-only API (TRD Part D §1), mounted by aerofarex-core at /api/v1/public.
No sign-in; responses are cached in-process and marked cacheable for a CDN; each client
IP gets PUBLIC_RATE_LIMIT_PER_MINUTE requests a minute.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from server.api.deps import DATE_PATTERN, envelope, index_engine, published
from server.core.config import get_settings
from server.core.errors import ApiError
from server.econometrics.engine import IndexEngine
from server.services.published import PublishedIndex
from server.services.schedule import iso_ms, last_at

from . import fares
from .guard import cache, limiter
from .schemas import Envelope, PublicFareSearch, PublicLatest, PublicMethodology, PublicRouteSummary


def guard(request: Request, response: Response) -> None:
    settings = get_settings()
    client = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown")
    if not limiter.allow(client, settings.public_rate_limit_per_minute):
        raise ApiError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.")
    response.headers["Cache-Control"] = f"public, max-age={settings.public_cache_ttl_seconds}"


router = APIRouter(prefix="/public", tags=["public"], dependencies=[Depends(guard)])


def _ttl() -> int:
    return get_settings().public_cache_ttl_seconds


@router.get("/latest", response_model=Envelope[PublicLatest], response_model_exclude_unset=True)
def latest(series: Literal["AFI", "TCT-AFI"] = "AFI", pub: PublishedIndex = Depends(published)):
    """Headline index and the drip-pricing gap (what's added on top of the base fare)."""

    def produce() -> dict:
        day = pub.resolve_date(None)
        snap = pub.get(series, day)
        afi, tct = pub.get("AFI", day), pub.get("TCT-AFI", day)
        if snap is None or afi is None or tct is None:
            raise ApiError(404, "NO_PUBLICATION", "No index has been published yet.")
        idx = pub.dates.index(day)
        prev = pub.get(series, pub.dates[idx - 1]) if idx > 0 else None
        previous_value = prev.value if prev else snap.value
        return envelope({
            "series": series,
            "date": day,
            "value": snap.value,
            "previous_value": previous_value,
            "change": snap.value - previous_value,
            "change_pct": (snap.value - previous_value) / previous_value * 100,
            "base_period": snap.base_period,
            "drip_gap_points": tct.value - afi.value,
            "drip_gap_pct": (tct.value - afi.value) / afi.value * 100,
            "quality": pub.quality(day, series),
        })

    return cache.get_or_set(f"latest|{series}|{pub.latest}", _ttl(), produce)


@router.get("/methodology", response_model=Envelope[PublicMethodology], response_model_exclude_unset=True)
def methodology():
    s = get_settings()
    return envelope({
        "methodology_version": s.methodology_version,
        "base_period": s.base_date,
        "summary": "We check fares on India's five busiest air routes four times a day, on airline websites and "
                   "booking sites, and publish two numbers every evening.",
        "sections": [
            {"title": "What we measure",
             "body": "AFI follows the base fare airlines advertise. TCT-AFI follows the total you actually pay: "
                     "base fare plus fuel surcharge, airport fees, GST and any booking-site fee. Both start at 100 "
                     f"on {s.base_date}; 110 means prices are 10% higher than then."},
            {"title": "The hidden-fee gap",
             "body": "The difference between TCT-AFI and AFI shows how much of what you pay is added after the "
                     "advertised price. When it grows, fees are rising faster than fares."},
            {"title": "How the number is built",
             "body": "For each route and each booking lead time (1, 7, 15, 30 and 45 days ahead) we take the "
                     "typical price of that day's quotes. Busier routes count for more, using official DGCA "
                     "passenger numbers, and lead times count by how often people actually book that far ahead."},
            {"title": "Quality and honesty",
             "body": "Every published number shows how complete the day's data was. Unusual prices are flagged "
                     "and left out, never deleted. Published numbers are never edited: a correction is published "
                     "as a new version, and the old one stays on record."},
            {"title": "How we collect",
             "body": "Our collector identifies itself, makes one request at a time with pauses, and stops when a "
                     "site asks it to. We don't hide or disguise it."},
        ],
    })


@router.get("/routes/summary", response_model=Envelope[list[PublicRouteSummary]], response_model_exclude_unset=True)
def routes_summary(pub: PublishedIndex = Depends(published), eng: IndexEngine = Depends(index_engine)):
    """Advertised vs total fare on each tracked route, latest published day."""

    def produce() -> dict:
        day = pub.resolve_date(None)
        idx = pub.dates.index(day)
        prev = pub.dates[idx - 1] if idx > 0 else None
        data = []
        for r in eng.routes:
            today = eng.route_day(r.route_id, day)
            before = eng.route_day(r.route_id, prev) if prev else today
            hidden = today["total_payable_paise"] - today["base_fare_paise"]
            data.append({
                "route_id": r.route_id,
                "label": r.label,
                "origin": r.origin,
                "destination": r.destination,
                "pax_share": eng.route_weight[r.route_id],
                "advertised_paise": today["base_fare_paise"],
                "total_paise": today["total_payable_paise"],
                "added_paise": hidden,
                "added_pct": hidden / today["base_fare_paise"] * 100 if today["base_fare_paise"] else 0.0,
                "change_24h_pct": (today["total_payable_paise"] - before["total_payable_paise"])
                                  / before["total_payable_paise"] * 100,
                "date": day,
                "provenance": pub.by_series["AFI"][day].provenance,
            })
        return envelope(data, len(data))

    return cache.get_or_set(f"routes|{pub.latest}", _ttl(), produce)


@router.get("/fares/search", response_model=Envelope[PublicFareSearch], response_model_exclude_unset=True)
def fares_search(
    from_: str = Query(..., alias="from", pattern=r"^[A-Z]{3}$"),
    to: str = Query(..., pattern=r"^[A-Z]{3}$"),
    date: str = Query(..., pattern=DATE_PATTERN),
):
    """Flights on a tracked route, priced per platform. Sample data until live collection."""
    if not fares.is_tracked(from_, to):
        raise ApiError(404, "ROUTE_NOT_TRACKED", f"We don't track {from_} → {to} yet.")

    def produce() -> dict:
        seen = iso_ms(last_at(get_settings().collection_slots))
        return envelope(fares.search(from_, to, date, seen_at=seen))

    return cache.get_or_set(f"fares|{from_}|{to}|{date}", _ttl(), produce)
