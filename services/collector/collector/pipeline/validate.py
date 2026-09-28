"""
Turn one source's responses into observation rows, and screen them (TRD Part B, Part E):

  * a response that failed      -> one unavailable row: BLOCKED / SOURCE_ERROR / PARSER_ERROR
  * a response with no fares    -> one unavailable row: NO_FLIGHT
  * components don't add up     -> INVALID (kept, excluded, components not stored)
  * fewer than 2 seats left     -> FLAGGED (phantom fare: not reproducibly bookable)
  * outside 1.5 × IQR of the cell's log totals -> FLAGGED
Nothing is deleted: flagged and invalid quotes stay in the table for audit.
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field

from server.econometrics.outliers import iqr_flags

from ..adapters.base import Adapter, ParsedFare, RawResponse

BLOCKED_STATUSES = {401, 403, 407, 429, 451}
UNKNOWN_CARRIER = "ZZ"  # failed OTA fetch: no carrier to attribute the gap to


@dataclass
class ObservationRow:
    observation: dict
    components: dict | None = None


@dataclass
class ParsedResponse:
    raw: RawResponse
    raw_id: str
    rows: list[ObservationRow] = field(default_factory=list)
    outcome: str = "OK"  # OK | BLOCKED | SOURCE_ERROR | PARSER_ERROR


def classify_failure(raw: RawResponse) -> str | None:
    if raw.status in BLOCKED_STATUSES or (raw.error or "").startswith("robots.txt"):
        return "BLOCKED"
    if raw.status == 0 or raw.status >= 400:
        return "SOURCE_ERROR"
    return None


def _fingerprint(*parts: object) -> str:
    return hashlib.sha256("|".join("" if p is None else str(p) for p in parts).encode()).hexdigest()


def _row(adapter: Adapter, raw: RawResponse, raw_id: str, fare: ParsedFare | None, reason: str | None,
         status: str = "VALID") -> ObservationRow:
    q = raw.request.query
    carrier = (fare.carrier_code if fare else None) or adapter.carrier_code or UNKNOWN_CARRIER
    available = fare is not None and fare.available and reason is None
    obs = {
        "observation_id": str(uuid.uuid4()),
        "observed_at": raw.fetched_at,
        "raw_id": raw_id,
        "source": adapter.source_id,
        "route_id": q.route_id,
        "carrier_code": carrier,
        "flight_number": fare.flight_number if fare else None,
        "departure_datetime": fare.departure_datetime if fare else None,
        "search_date": q.search_date,
        "departure_date": q.departure_date,
        "advance_days": q.advance_days,
        "fare_family": fare.fare_family if fare else None,
        "baggage_allowance_kg": fare.baggage_allowance_kg if fare else None,
        "refundable": None if not fare or fare.refundable is None else int(fare.refundable),
        "available": int(available),
        "missing_reason": None if available else (reason or (fare.missing_reason if fare else None) or "UNKNOWN"),
        "validation_status": status,
        "provenance": "REAL",
        "fingerprint": _fingerprint(adapter.source_id, q.route_id, carrier, fare.flight_number if fare else None,
                                    q.departure_date, q.search_date, q.window, raw.fetched_at),
        "adapter_version": adapter.adapter_version,
    }
    components = None
    if available and status != "INVALID" and fare and fare.components:
        components = {**fare.components.model_dump(), "observation_id": obs["observation_id"], "currency": "INR"}
    return ObservationRow(obs, components)


def parse_response(adapter: Adapter, raw: RawResponse, raw_id: str, phantom_min_seats: int) -> ParsedResponse:
    result = ParsedResponse(raw, raw_id)
    failure = classify_failure(raw)
    if failure:
        result.outcome = failure
        result.rows.append(_row(adapter, raw, raw_id, None, failure))
        return result
    try:
        fares = adapter.parse(raw)
    except Exception:
        result.outcome = "PARSER_ERROR"
        result.rows.append(_row(adapter, raw, raw_id, None, "PARSER_ERROR"))
        return result
    if not fares:
        result.rows.append(_row(adapter, raw, raw_id, None, "NO_FLIGHT"))
        return result
    for fare in fares:
        if not fare.available:
            result.rows.append(_row(adapter, raw, raw_id, fare, fare.missing_reason or "UNKNOWN"))
        elif fare.components is None or not fare.components.adds_up:
            result.rows.append(_row(adapter, raw, raw_id, fare, None, status="INVALID"))
        elif fare.seats_left is not None and fare.seats_left < phantom_min_seats:
            result.rows.append(_row(adapter, raw, raw_id, fare, None, status="FLAGGED"))
        else:
            result.rows.append(_row(adapter, raw, raw_id, fare, None))
    return result


def flag_outliers(responses: list[ParsedResponse], multiplier: float) -> int:
    """Flag VALID quotes outside the IQR fence of their (route, window) cell, this run."""
    cells: dict[tuple[str, int], list[ObservationRow]] = {}
    for resp in responses:
        for row in resp.rows:
            o = row.observation
            if o["validation_status"] == "VALID" and row.components:
                cells.setdefault((o["route_id"], o["advance_days"]), []).append(row)
    flagged = 0
    for rows in cells.values():
        marks = iqr_flags([r.components["total_payable_paise"] for r in rows], multiplier)  # type: ignore[index]
        for row, is_out in zip(rows, marks):
            if is_out:
                row.observation["validation_status"] = "FLAGGED"
                flagged += 1
    return flagged
