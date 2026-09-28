"""
The adapter contract. One adapter per source; it knows how to ask the source for fares
and how to read the answer, and nothing else (fetching, archiving, validation and loading
are the pipeline's job, so every source gets the same etiquette and audit trail).

Bump `adapter_version` whenever `parse` changes: every observation records it, and the
archived raw payloads can be re-parsed with a newer version.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import ClassVar, Literal

from pydantic import BaseModel, Field

FetchTier = Literal["HTTP", "DYNAMIC", "BROWSER"]


@dataclass(frozen=True)
class FareQuery:
    """One cell of the collection plan: a route, a search day and an advance window."""

    route_id: str
    origin: str
    destination: str
    search_date: str  # YYYY-MM-DD (IST)
    departure_date: str
    window: str  # T+1 ... T+45
    advance_days: int


@dataclass(frozen=True)
class FareRequest:
    source: str
    query: FareQuery
    url: str
    method: str = "GET"
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes | None = None


@dataclass
class RawResponse:
    request: FareRequest
    status: int  # 0 when no HTTP response (network error, robots.txt refusal)
    body: bytes
    content_type: str
    fetched_at: str  # ISO-8601 UTC
    error: str | None = None  # e.g. "robots.txt disallows", "TimeoutError"


class Components(BaseModel):
    """What the traveller pays, split the way TRD Part E stores it. Integer paise."""

    base_fare_paise: int = Field(ge=0)
    fuel_surcharge_paise: int = Field(ge=0)
    udf_paise: int = Field(ge=0)
    psf_paise: int = Field(ge=0)
    gst_paise: int = Field(ge=0)
    platform_fee_paise: int = Field(default=0, ge=0)
    total_payable_paise: int = Field(ge=0)

    @property
    def adds_up(self) -> bool:
        return self.total_payable_paise == (
            self.base_fare_paise + self.fuel_surcharge_paise + self.udf_paise + self.psf_paise
            + self.gst_paise + self.platform_fee_paise
        )


class ParsedFare(BaseModel):
    carrier_code: str = Field(min_length=2, max_length=2)
    flight_number: str | None = None
    departure_datetime: str | None = None
    fare_family: str | None = None
    baggage_allowance_kg: int | None = None
    refundable: bool | None = None
    seats_left: int | None = None  # for the phantom-fare filter
    components: Components | None = None
    available: bool = True
    missing_reason: Literal["SOLD_OUT", "NO_FLIGHT", "UNKNOWN"] | None = None


class NotConfigured(Exception):
    """The adapter's endpoint hasn't been set up (see its docstring)."""


class Adapter(ABC):
    source_id: ClassVar[str]
    adapter_version: ClassVar[str]
    fetch_tier: ClassVar[FetchTier] = "HTTP"
    # Carrier for airline sources; None for OTAs (their quotes name the carrier).
    carrier_code: ClassVar[str | None] = None
    configured: ClassVar[bool] = True

    @abstractmethod
    def build_requests(self, query: FareQuery) -> list[FareRequest]:
        """HTTP request(s) that fetch this source's fares for one plan cell."""

    @abstractmethod
    def parse(self, raw: RawResponse) -> list[ParsedFare]:
        """Fares in one successful response. Raise on anything unexpected: the pipeline
        records PARSER_ERROR and keeps the raw payload for a re-parse."""
