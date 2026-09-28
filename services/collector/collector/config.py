"""Collector settings (see services/collector/.env.example)."""
from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from server.core.config import REPO_ROOT

COLLECTOR_DIR = REPO_ROOT / "services" / "collector"


class CollectorSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(COLLECTOR_DIR / ".env", COLLECTOR_DIR / ".env.local"), extra="ignore",
    )

    # Declared, identifiable collector (Part H §2). Never change this to a browser UA.
    user_agent: str = "AeroFareX-StatisticalCollector/2.0 (+https://mospi.gov.in/aerofarex-collector)"
    rate_limit_seconds: float = 3.5  # per domain, randomised 0.5–1.5× by Scrapy
    max_retries: int = 4
    download_timeout_seconds: int = 30
    obey_robots_txt: bool = True

    # Only sources listed here are collected, and only once their adapter is configured
    # (endpoint found per §4.5 and permission confirmed). Comma-separated source ids.
    enabled_sources: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # Test / staging hook: "source=module:Class,..." swaps in another adapter class.
    adapter_overrides: Annotated[dict[str, str], NoDecode] = Field(default_factory=dict)

    # Circuit breaker (orchestrator/circuit_breaker.py)
    circuit_failure_threshold: int = 3  # consecutive failed runs before OPEN
    circuit_degraded_below: float = 0.8  # success ratio under this -> DEGRADED
    circuit_cooldown_hours: float = 24.0  # OPEN -> RECOVERING trial after this

    outlier_iqr_multiplier: float = 1.5
    phantom_min_seats: int = 2

    @field_validator("enabled_sources", mode="before")
    @classmethod
    def _csv(cls, value: object) -> object:
        return [v.strip() for v in value.split(",") if v.strip()] if isinstance(value, str) else value

    @field_validator("adapter_overrides", mode="before")
    @classmethod
    def _pairs(cls, value: object) -> object:
        if isinstance(value, str):
            return dict(p.split("=", 1) for p in value.split(",") if "=" in p)
        return value


@lru_cache
def get_collector_settings() -> CollectorSettings:
    return CollectorSettings()
