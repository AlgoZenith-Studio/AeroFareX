"""
The dashboard's deterministic 30-day demo dataset (TRD Part F), ported bit-for-bit from
dashboard/frontend/src/lib/mock/seed.ts: same PRNG (mulberry32), same draw order, same
rounding. Loading it gives the backend exactly the data the mock API serves, so the
dashboard looks identical with NEXT_PUBLIC_USE_MOCK=false (milestone M2/M4).

DEMO DATA ONLY. It is generated, not collected (the mock labels the last 12 days
"REAL" to exercise the provenance boundary). Never load it into a production database;
`aerofarex seed-demo` refuses when collected data is present.
"""
from __future__ import annotations

import math
import uuid as uuid_mod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from ..econometrics.basket import MISSING_REASONS, WINDOW_DAYS, WINDOWS
from ..econometrics.engine import Obs
from ..econometrics.jsnum import add_days, is_weekend, js_round

DAYS = 30
START_DATE = "2026-08-29"
BASE_DATE = "2026-09-01"
SIMULATED_DAYS = 18
BLOCKED_DAY = "2026-09-10"
SURGE = ("2026-09-18", "2026-09-24", 1.15)

ROUTES = [  # id, origin, level (paise)
    ("DEL-BOM", "DEL", 485000), ("DEL-BLR", "DEL", 540000), ("BOM-BLR", "BOM", 360000),
    ("DEL-CCU", "DEL", 420000), ("BLR-HYD", "BLR", 285000),
]
WINDOW_MULTIPLE = {"T+1": 3.2, "T+7": 1.85, "T+15": 1.35, "T+30": 1.12, "T+45": 1}
SOURCES = [  # id, type, carrier, tier
    ("indigo", "AIRLINE", "6E", "HTTP"), ("air_india", "AIRLINE", "AI", "DYNAMIC"),
    ("akasa", "AIRLINE", "QP", "HTTP"), ("spicejet", "AIRLINE", "SG", "BROWSER"),
    ("makemytrip", "OTA", None, "DYNAMIC"),
]
CARRIER_CODES = ["6E", "AI", "QP", "SG"]
CARRIER_FACTOR = {"6E": 1, "AI": 1.08, "QP": 0.96, "SG": 0.93}
AIRPORT_FEES = {"DEL": (32000, 9100), "BOM": (42000, 9100), "BLR": (35000, 9100)}
# ANC-AFI basket levels (paise); the mock's ancillary factor scales all three.
ANCILLARY_LEVELS = {"SEAT": 45000, "BAG": 75000, "MEAL": 30000}

MASK = 0xFFFFFFFF
RAW_NAMESPACE = uuid_mod.UUID("6a3f8c1e-0b7d-4f2a-9c5e-2d1b8e7f4a60")


def _int32(x: int) -> int:
    x &= MASK
    return x - 0x100000000 if x & 0x80000000 else x


def _imul(a: int, b: int) -> int:
    return _int32((a & MASK) * (b & MASK))


class Mulberry32:
    """mulberry32 exactly as JavaScript evaluates it (the seed grows past 32 bits there)."""

    def __init__(self, seed: int) -> None:
        self.seed = seed

    def __call__(self) -> float:
        self.seed += 0x6D2B79F5
        t = self.seed
        t = _imul(t ^ ((t & MASK) >> 15), _int32(t) | 1)
        t = _int32(t ^ (t + _imul(t ^ ((t & MASK) >> 7), t | 61)))
        return ((t ^ ((t & MASK) >> 14)) & MASK) / 4294967296


@dataclass
class DemoData:
    observations: list[Obs]
    dates: list[str]
    provenance_boundary: str
    ancillary: list[dict]  # rows for ancillary_observations
    runs: list[dict]
    source_health: list[dict]
    audits: dict[str, dict]


def _dates() -> list[str]:
    return [add_days(START_DATE, i) for i in range(DAYS)]


def _market(dates: list[str]) -> list[dict]:
    return [{
        "date": d,
        "drift": 1 + i * 0.0019 + 0.003 * math.sin(i / 3.1),
        "fuel": 0.12 + i * 0.0045 + 0.004 * math.sin(i / 4),
        "airport": 1.35 if d >= "2026-09-12" else 1,
        "platform": 1 + i * 0.012,
        "ancillary": 1 + i * 0.0034 + 0.006 * math.sin(i / 2.3),
    } for i, d in enumerate(dates)]


def _departure_for(start: str, source_index: int) -> str:
    weekdays = 0
    for i in range(14):
        d = add_days(start, i)
        if source_index == 4:
            if is_weekend(d):
                return d
        elif not is_weekend(d):
            hit = weekdays == source_index
            weekdays += 1
            if hit:
                return d
    return start


def audit_of(observation_id: str, search_date: str, source: str, observed_at: str, boundary: str) -> dict:
    """Deterministic audit fields per observation (mock `auditOf`)."""
    seed = 7
    for ch in observation_id:
        seed = seed + ord(ch) * 31
    r = Mulberry32(seed)

    def h(n: int) -> str:
        return "".join(format(math.floor(r() * 16), "x") for _ in range(n))

    h(8), h(4), h(3), h(3), h(12)  # the mock's raw_id draws; kept so the hashes below line up
    return {
        # The mock derives raw_id from a character sum, so ids collide across observations;
        # the database needs them unique, so the seed uses a stable UUID of the observation.
        "raw_id": str(uuid_mod.uuid5(RAW_NAMESPACE, observation_id)),
        "object_key": f"gs://aerofarex-raw-observations/{search_date}/{source}/{observation_id}.json.gz",
        "sha256": h(64),
        "batch_hash": h(64),
        "prev_batch_hash": h(64),
        "adapter_version": f"{source}@2.{4 if search_date >= boundary else 3}.1",
        "fetched_at": observed_at,
    }


def _slot_to_utc(date: str, slot: str) -> datetime:
    h, m = (int(x) for x in slot.split(":"))
    return datetime.fromisoformat(f"{date}T00:00:00+00:00") + timedelta(hours=h - 5, minutes=m - 30)


def _iso_ms(dt: datetime) -> str:
    """Date.prototype.toISOString(): always milliseconds and a Z."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def generate() -> DemoData:
    rand = Mulberry32(20260901)

    def between(lo: float, hi: float) -> float:
        return lo + (hi - lo) * rand()

    def gauss() -> float:
        u = max(rand(), 1e-9)
        return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * rand())

    def hexs(n: int) -> str:
        return "".join(format(math.floor(rand() * 16), "x") for _ in range(n))

    def uuid() -> str:
        a, b, c, d, e = hexs(8), hexs(4), hexs(3), hexs(3), hexs(12)
        return f"{a}-{b}-4{c}-a{d}-{e}"

    dates = _dates()
    boundary = dates[SIMULATED_DAYS]
    market = _market(dates)
    observations: list[Obs] = []
    missing_cursor = 0

    def components(base: float, day: dict, origin: str, ota: bool) -> dict[str, int]:
        base_fare = js_round(base / 100) * 100
        fuel = js_round((base_fare * day["fuel"]) / 100) * 100
        udf_level, psf = AIRPORT_FEES.get(origin, (30000, 9100))
        udf = js_round((udf_level * day["airport"]) / 100) * 100
        gst = js_round((base_fare + fuel) * 0.05)
        platform = js_round((between(35000, 55000) * day["platform"]) / 100) * 100 if ota else 0
        return {
            "base_fare_paise": base_fare, "fuel_surcharge_paise": fuel, "udf_paise": udf, "psf_paise": psf,
            "gst_paise": gst, "platform_fee_paise": platform,
            "total_payable_paise": base_fare + fuel + udf + psf + gst + platform,
        }

    for day_index, date in enumerate(dates):
        day = market[day_index]
        for route_id, origin, level in ROUTES:
            for window in WINDOWS:
                for source_index, (source_id, source_type, source_carrier, tier) in enumerate(SOURCES):
                    departure = _departure_for(add_days(date, WINDOW_DAYS[window]), source_index)
                    surge = SURGE[2] if SURGE[0] <= departure <= SURGE[1] else 1
                    weekend = between(1.15, 1.25) if is_weekend(departure) else 1
                    carrier = source_carrier or CARRIER_CODES[(day_index + source_index + WINDOWS.index(window)) % 4]
                    observed_at = f"{date}T13:30:00Z"
                    flight_no = f"{carrier}{100 + math.floor(rand() * 899)}"
                    degraded = source_id == "spicejet" and day_index >= DAYS - 4
                    blocked = source_id == "makemytrip" and date == BLOCKED_DAY
                    missing = blocked or rand() < (0.16 if degraded else 0.025)
                    base = (level * (WINDOW_MULTIPLE[window] / WINDOW_MULTIPLE["T+15"])
                            * CARRIER_FACTOR[carrier] * surge * weekend * day["drift"] * math.exp(0.035 * gauss()))
                    outlier = (not missing) and rand() < 0.008
                    if missing:
                        if blocked:
                            reason = "BLOCKED"
                        elif degraded:
                            reason = "SOURCE_ERROR"
                        else:
                            reason = MISSING_REASONS[missing_cursor % len(MISSING_REASONS)]
                            missing_cursor += 1
                    else:
                        reason = None
                    # Object-literal evaluation order in the TS: id, fare_family, refundable, components.
                    observation_id = uuid()
                    fare_family = None if missing else ("Saver" if rand() < 0.7 else "Flexi")
                    refundable = None if missing else rand() < 0.3
                    comps = None if missing else components(
                        base * 2.8 if outlier else base, day, origin, source_type == "OTA")
                    observations.append(Obs(
                        observation_id=observation_id,
                        observed_at=observed_at,
                        search_date=date,
                        source=source_id,
                        fetch_tier=tier,
                        route_id=route_id,
                        carrier_code=carrier,
                        flight_number=None if missing else flight_no,
                        departure_date=departure,
                        window=window,
                        fare_family=fare_family,
                        baggage_allowance_kg=None if missing else 15,
                        refundable=refundable,
                        available=not missing,
                        missing_reason=reason,
                        validation_status="FLAGGED" if outlier else "VALID",
                        provenance="SIMULATED" if date < boundary else "REAL",
                        components=comps,
                    ))

    ancillary = []
    for i, date in enumerate(dates):
        for item, lvl in ANCILLARY_LEVELS.items():
            ancillary.append({
                "ancillary_id": f"anc-{date}-{item.lower()}",
                "observed_at": f"{date}T13:30:00Z",
                "source": "indigo",
                "search_date": date,
                "item": item,
                "price_paise": js_round(lvl * market[i]["ancillary"]),
                "provenance": "SIMULATED" if date < boundary else "REAL",
                "adapter_version": "seed-demo@1",
            })

    latest = dates[-1]
    runs = []
    for date in list(reversed(dates[-3:])):
        for slot in ["19:00", "13:00", "05:30", "02:30"]:
            started = _slot_to_utc(date, slot)
            if date == latest and started > datetime.fromisoformat(f"{latest}T09:00:00+00:00"):
                continue
            partial = date >= add_days(latest, -3) and slot != "02:30"
            minutes = int(started.timestamp() * 1000) // 60000
            product = float(minutes * 2654435761)  # JS multiplies as doubles
            hex16 = format(int(product), "x").rjust(16, "0")[-16:]
            runs.append({
                "run_id": f"run-{date}-{slot.replace(':', '')}",
                "slot": slot,
                "started_at": _iso_ms(started),
                "duration_s": 380 + (minutes % 97),
                "observations": 114 + (minutes % 5) if partial else 125,
                "status": "PARTIAL" if partial else "SUCCESS",
                "batch_hash": hex16 * 4,
            })

    source_health = []
    for source_id, *_ in SOURCES:
        degraded = source_id == "spicejet"
        source_health.append({
            "source_id": source_id,
            "state": "DEGRADED" if degraded else "HEALTHY",
            "consecutive_failures": 3 if degraded else 0,
            "last_success_at": _iso_ms(_slot_to_utc(latest, "05:30" if degraded else "13:00")),
            "adapter_version": f"{source_id}@2.4.1",
        })

    audits = {o.observation_id: audit_of(o.observation_id, o.search_date, o.source, o.observed_at, boundary)
              for o in observations}
    return DemoData(observations, dates, boundary, ancillary, runs, source_health, audits)
