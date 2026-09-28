"""Test adapters that talk to the local fixture server (FIXTURE_BASE_URL), never a real site."""
from __future__ import annotations

import json
import os

from collector.adapters.base import Adapter, Components, FareQuery, FareRequest, ParsedFare, RawResponse


def _url(path: str, q: FareQuery) -> str:
    base = os.environ["FIXTURE_BASE_URL"]
    return f"{base}{path}?from={q.origin}&to={q.destination}&dep={q.departure_date}&w={q.advance_days}"


class LocalIndigo(Adapter):
    source_id = "indigo"
    adapter_version = "indigo@test-1"
    fetch_tier = "HTTP"
    carrier_code = "6E"

    def build_requests(self, query: FareQuery) -> list[FareRequest]:
        return [FareRequest(self.source_id, query, _url("/fares", query))]

    def parse(self, raw: RawResponse) -> list[ParsedFare]:
        data = json.loads(raw.body)
        return [
            ParsedFare(carrier_code="6E", flight_number=f["no"], fare_family="Saver", baggage_allowance_kg=15,
                       refundable=False, seats_left=f.get("seats"), components=Components(**f["price"]))
            for f in data["flights"]
        ]


class BlockedAkasa(LocalIndigo):
    """Points at a path robots.txt disallows: every request must be refused, not sent."""

    source_id = "akasa"
    adapter_version = "akasa@test-1"
    carrier_code = "QP"

    def build_requests(self, query: FareQuery) -> list[FareRequest]:
        return [FareRequest(self.source_id, query, _url("/private/fares", query))]
