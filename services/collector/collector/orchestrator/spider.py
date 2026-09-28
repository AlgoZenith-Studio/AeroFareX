"""
The fetch step: one Scrapy crawl per collection run (decision D6).

Etiquette (TRD Part H §2, decision D7) is set here and nowhere else:
  * declared user-agent; robots.txt obeyed (a refusal is recorded as BLOCKED)
  * one request at a time per domain, 3.5 s delay randomised to 0.5–1.5×
  * retries with backoff for transient errors; no cookies carried between requests
  * no proxies, no header spoofing, no CAPTCHA handling
Every response, successful or not, is handed back as a RawResponse.
"""
from __future__ import annotations

from datetime import datetime, timezone

import scrapy
from scrapy.crawler import CrawlerProcess
from scrapy.exceptions import IgnoreRequest

from ..adapters.base import FareRequest, RawResponse
from ..config import CollectorSettings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def scrapy_settings(cs: CollectorSettings) -> dict:
    return {
        "USER_AGENT": cs.user_agent,
        "ROBOTSTXT_OBEY": cs.obey_robots_txt,
        "DOWNLOAD_DELAY": cs.rate_limit_seconds,
        "RANDOMIZE_DOWNLOAD_DELAY": True,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "CONCURRENT_REQUESTS": 8,  # across different domains only
        "AUTOTHROTTLE_ENABLED": False,
        "RETRY_ENABLED": True,
        "RETRY_TIMES": cs.max_retries,
        "DOWNLOAD_TIMEOUT": cs.download_timeout_seconds,
        "COOKIES_ENABLED": False,
        "TELNETCONSOLE_ENABLED": False,
        "LOG_LEVEL": "INFO",
    }


class FareSpider(scrapy.Spider):
    name = "aerofarex-fares"

    def __init__(self, fare_requests: list[FareRequest], sink: list[RawResponse], **kwargs) -> None:
        super().__init__(**kwargs)
        self.fare_requests = fare_requests
        self.sink = sink

    async def start(self):
        for fr in self.fare_requests:
            yield scrapy.Request(
                fr.url, method=fr.method, headers=fr.headers, body=fr.body, dont_filter=True,
                meta={"fare_request": fr, "handle_httpstatus_all": True},
                callback=self.on_response, errback=self.on_error,
            )

    def on_response(self, response):  # type: ignore[no-untyped-def]
        self.sink.append(RawResponse(
            request=response.meta["fare_request"],
            status=response.status,
            body=response.body,
            content_type=response.headers.get("Content-Type", b"").decode("latin-1"),
            fetched_at=_now(),
        ))

    def on_error(self, failure):  # type: ignore[no-untyped-def]
        request = failure.request
        err = failure.value
        message = ("robots.txt disallows this request" if isinstance(err, IgnoreRequest) and "robots" in str(err)
                   else f"{type(err).__name__}: {err}")
        self.sink.append(RawResponse(
            request=request.meta["fare_request"], status=0, body=message.encode(), content_type="text/plain",
            fetched_at=_now(), error=message,
        ))


def fetch_all(fare_requests: list[FareRequest], cs: CollectorSettings) -> list[RawResponse]:
    """Run the crawl to completion. Call once per process (Twisted's reactor can't restart)."""
    sink: list[RawResponse] = []
    if not fare_requests:
        return sink
    process = CrawlerProcess(scrapy_settings(cs), install_root_handler=False)
    process.crawl(FareSpider, fare_requests=fare_requests, sink=sink)
    process.start()
    return sink
