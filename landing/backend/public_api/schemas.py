"""Public API response models; TypeScript mirrors live in packages/shared-types (Public*)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.schemas.api import Envelope, Provenance, QualityMetadata, RouteId, SeriesName  # noqa: F401


class PublicLatest(BaseModel):
    series: SeriesName
    date: str
    value: float
    previous_value: float
    change: float
    change_pct: float
    base_period: str
    drip_gap_points: float
    drip_gap_pct: float
    quality: QualityMetadata


class PublicMethodologySection(BaseModel):
    title: str
    body: str


class PublicMethodology(BaseModel):
    methodology_version: str
    base_period: str
    summary: str
    sections: list[PublicMethodologySection]


class PublicRouteSummary(BaseModel):
    route_id: RouteId
    label: str
    origin: str
    destination: str
    pax_share: float
    advertised_paise: int
    total_paise: int
    added_paise: int
    added_pct: float
    change_24h_pct: float
    date: str
    provenance: Provenance


class PublicPlatform(BaseModel):
    id: str
    name: str
    kind: Literal["AIRLINE", "OTA"]


class PublicOffer(BaseModel):
    platform: PublicPlatform
    advertised_paise: int
    fuel_paise: int
    airport_paise: int
    gst_paise: int
    platform_paise: int
    total_paise: int


class PublicFlight(BaseModel):
    carrier: str
    carrier_code: str
    flight_no: str
    depart: str
    arrive: str
    duration: str
    offers: list[PublicOffer]


class PublicDaysAhead(BaseModel):
    days: int
    label: str
    cheapest_paise: int


class PublicFareSearch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    date: str
    days_ahead: int
    flights: list[PublicFlight]
    by_days_ahead: list[PublicDaysAhead]
    seen_at: str | None
    sample: bool
