"""
Sample fare search for /fares, ported bit-for-bit from landing/frontend/src/data/fares.ts
(`searchFares`), so the landing site can switch to this endpoint with identical output.

These are SAMPLE prices, not collected ones: every response carries `sample: true`.
When the collector has flight-level offers for all platforms, replace `search` with a
query over fare_observations; the response shape stays the same.
"""
from __future__ import annotations

import math
from datetime import date as Date, datetime, timezone

MASK = 0xFFFFFFFF


def _int32(x: int) -> int:
    x &= MASK
    return x - 0x100000000 if x & 0x80000000 else x


def _imul(a: int, b: int) -> int:
    return _int32((a & MASK) * (b & MASK))


def _hash(s: str):
    """The FNV-style seeded PRNG from fares.ts (`hash`)."""
    h = 2166136261
    for ch in s:
        h = _int32(h) ^ ord(ch)
        h = _imul(h, 16777619)
    state = [h]

    def rnd() -> float:
        h = state[0]
        h = _imul(h ^ ((h & MASK) >> 15), 2246822507)
        h = _imul(h ^ ((h & MASK) >> 13), 3266489909)
        h = _int32(h ^ ((h & MASK) >> 16))
        state[0] = h
        return (h & MASK) / 4294967296

    return rnd


def _js_round(x: float) -> int:
    f = math.floor(x)
    return f + 1 if x - f >= 0.5 else f


def _round100(p: float) -> int:
    return _js_round(p / 100) * 100


CITIES = [
    {"code": "DEL", "city": "Delhi", "airport": "Indira Gandhi International"},
    {"code": "BOM", "city": "Mumbai", "airport": "Chhatrapati Shivaji Maharaj International"},
    {"code": "BLR", "city": "Bengaluru", "airport": "Kempegowda International"},
    {"code": "CCU", "city": "Kolkata", "airport": "Netaji Subhas Chandra Bose International"},
    {"code": "HYD", "city": "Hyderabad", "airport": "Rajiv Gandhi International"},
]
_ROUTES = [("DEL-BOM", 485000), ("DEL-BLR", 540000), ("BOM-BLR", 360000), ("DEL-CCU", 420000), ("BLR-HYD", 285000)]
TRACKED: list[tuple[str, str, int]] = []
for _rid, _base in _ROUTES:
    _a, _b = _rid.split("-")
    TRACKED.append((_a, _b, _base))
    TRACKED.append((_b, _a, _js_round(_base * 0.97)))

OTAS = [
    {"id": "makemytrip", "name": "MakeMyTrip", "kind": "OTA"},
    {"id": "easemytrip", "name": "EaseMyTrip", "kind": "OTA"},
    {"id": "ixigo", "name": "ixigo", "kind": "OTA"},
]
CARRIERS = [("6E", "IndiGo", 1), ("AI", "Air India", 1.09), ("QP", "Akasa Air", 0.96), ("SG", "SpiceJet", 0.93)]
AIRPORT_FEE = {"DEL": 41100, "BOM": 51100, "BLR": 44100, "CCU": 38100, "HYD": 42100}
CURVE = [(1, 2.4), (7, 1.4), (15, 1), (30, 0.83), (45, 0.75)]
DAYS_AHEAD = [1, 7, 15, 30, 45]


def is_tracked(frm: str, to: str) -> bool:
    return any(t[0] == frm and t[1] == to for t in TRACKED)


def _curve(days: float) -> float:
    d = min(45, max(1, days))
    for i in range(1, len(CURVE)):
        d0, m0 = CURVE[i - 1]
        d1, m1 = CURVE[i]
        if d <= d1:
            return m0 + ((m1 - m0) * (d - d0)) / (d1 - d0)
    return CURVE[-1][1]


def _is_weekend(iso: str) -> bool:
    return Date.fromisoformat(iso).weekday() >= 5


def _days_between(a: str, b: str) -> int:
    return _js_round((Date.fromisoformat(b) - Date.fromisoformat(a)).days)


def _hhmm(mins: int) -> str:
    return f"{(mins // 60) % 24:02d}:{mins % 60:02d}"


def _parts(base: float, origin: str, platform: dict, rnd) -> dict:
    advertised = _round100(base * (0.965 + rnd() * 0.03) if platform["kind"] == "OTA" else base)
    fuel = _round100(advertised * 0.13)
    airport = AIRPORT_FEE.get(origin, 40000)
    gst = _js_round((advertised + fuel) * 0.05)
    platform_fee = _round100(35000 + rnd() * 20000) if platform["kind"] == "OTA" else 0
    return {
        "advertised_paise": advertised,
        "fuel_paise": fuel,
        "airport_paise": airport,
        "gst_paise": gst,
        "platform_paise": platform_fee,
        "total_paise": advertised + fuel + airport + gst + platform_fee,
    }


def _route_base(frm: str, to: str) -> int:
    return next(t[2] for t in TRACKED if t[0] == frm and t[1] == to)


def _cheapest_for(frm: str, to: str, day: str, days: int) -> int:
    base_paise = _route_base(frm, to)
    best = math.inf
    for code, name, factor in CARRIERS:
        rnd = _hash(f"{frm}{to}{day}{code}{days}")
        base = base_paise * _curve(days) * factor * (1.18 if _is_weekend(day) else 1) * (0.94 + rnd() * 0.12)
        for p in [{"id": "direct", "name": name, "kind": "AIRLINE"}, *OTAS]:
            best = min(best, _parts(base, frm, p, rnd)["total_paise"])
    return int(best)


def search(frm: str, to: str, day: str, today: str | None = None, seen_at: str | None = None) -> dict | None:
    """Flights × platforms for a tracked route; None for a route the collector doesn't track."""
    if not is_tracked(frm, to):
        return None
    today = today or datetime.now(timezone.utc).date().isoformat()
    days_ahead = max(1, _days_between(today, day))
    base_paise = _route_base(frm, to)
    flights = []
    for ci, (code, name, factor) in enumerate(CARRIERS):
        for slot in (0, 1):
            rnd = _hash(f"{frm}{to}{day}{code}{slot}")
            dep = 330 + ci * 95 + slot * 420 + math.floor(rnd() * 40)
            dur = 125 + math.floor(rnd() * 25) + (20 if "CCU" in (frm, to) else 0)
            base = (base_paise * _curve(days_ahead) * factor * (1.18 if _is_weekend(day) else 1)
                    * (1.06 if slot == 0 else 0.97) * (0.94 + rnd() * 0.12))
            platforms = [{"id": "direct", "name": f"{name} website", "kind": "AIRLINE"}, *OTAS]
            offers = sorted(({"platform": p, **_parts(base, frm, p, rnd)} for p in platforms),
                            key=lambda o: o["total_paise"])
            flights.append({
                "carrier": name,
                "carrier_code": code,
                "flight_no": f"{code} {100 + math.floor(rnd() * 800)}",
                "depart": _hhmm(dep),
                "arrive": _hhmm(dep + dur),
                "duration": f"{dur // 60}h {dur % 60}m",
                "offers": offers,
            })
    flights.sort(key=lambda f: f["offers"][0]["total_paise"])
    return {
        "from": frm,
        "to": to,
        "date": day,
        "days_ahead": days_ahead,
        "flights": flights,
        "by_days_ahead": [{"days": d, "label": "Tomorrow" if d == 1 else f"{d} days",
                           "cheapest_paise": _cheapest_for(frm, to, day, d)} for d in DAYS_AHEAD],
        "seen_at": seen_at,
        "sample": True,
    }
