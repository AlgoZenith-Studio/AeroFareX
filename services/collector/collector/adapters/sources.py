"""
Adapters for the five basket sources. None is configured yet, on purpose.

Before an adapter can be switched on (Project_context §4.5, decisions D6/D7):
  1. Check the site's terms; prefer written permission or a data agreement.
  2. Chrome DevTools -> Network -> Fetch/XHR, run a search, find the fare request,
     "Copy as cURL".
  3. Confirm a plain-HTTP replay works when only route and date change. If it needs a
     session token, obtain it with Playwright once (fetch_tier = "BROWSER"/"DYNAMIC").
  4. Save 3–5 real responses under adapters/fixtures/<source>/ and write `parse`
     against them; the pipeline's add-up check must pass on every fixture.
  5. Implement build_requests + parse below, set `configured = True`, bump the version,
     add the source to ENABLED_SOURCES and watch /api/v1/health for a week.

No proxy rotation, CAPTCHA solving or bot evasion, ever. A block means "ask for a data
agreement", not "work around it".
"""
from __future__ import annotations

from .base import Adapter, FareQuery, FareRequest, NotConfigured, ParsedFare, RawResponse


class _Pending(Adapter):
    configured = False

    def build_requests(self, query: FareQuery) -> list[FareRequest]:
        raise NotConfigured(f"{self.source_id}: endpoint not set up yet (see collector/adapters/sources.py)")

    def parse(self, raw: RawResponse) -> list[ParsedFare]:
        raise NotConfigured(f"{self.source_id}: parser not written yet")


class IndiGo(_Pending):
    source_id = "indigo"
    adapter_version = "indigo@0.0.0"
    fetch_tier = "HTTP"
    carrier_code = "6E"


class AirIndia(_Pending):
    source_id = "air_india"
    adapter_version = "air_india@0.0.0"
    fetch_tier = "DYNAMIC"
    carrier_code = "AI"


class Akasa(_Pending):
    source_id = "akasa"
    adapter_version = "akasa@0.0.0"
    fetch_tier = "HTTP"
    carrier_code = "QP"


class SpiceJet(_Pending):
    source_id = "spicejet"
    adapter_version = "spicejet@0.0.0"
    fetch_tier = "BROWSER"
    carrier_code = "SG"


class MakeMyTrip(_Pending):
    source_id = "makemytrip"
    adapter_version = "makemytrip@0.0.0"
    fetch_tier = "DYNAMIC"
    carrier_code = None
