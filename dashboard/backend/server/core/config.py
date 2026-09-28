"""All environment-driven settings in one place (see dashboard/backend/.env.example)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "dashboard" / "backend"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", BACKEND_DIR / ".env.local"), extra="ignore",
    )

    env: Literal["development", "test", "production"] = "development"

    # Database (decision D1: SQLite on a Railway volume in production)
    database_url: str = f"sqlite:///{(REPO_ROOT / 'data' / 'aerofarex.db').as_posix()}"
    migrations_dir: Path = REPO_ROOT / "infra" / "db" / "migrations"

    # Raw payload archive (collector). file:// path locally, gs:// bucket in production.
    raw_archive_url: str = f"file:///{(REPO_ROOT / 'data' / 'raw').as_posix()}"

    # Firebase Admin: ID-token verification needs only the project id; the service-account
    # key (Storage/Firestore writes) comes from GOOGLE_APPLICATION_CREDENTIALS.
    firebase_project_id: str = ""
    # Local preview only: requests with no token act as this role. Refused in production.
    auth_dev_role: Literal["", "ANALYST", "ADMIN"] = ""

    # API
    # Comma-separated in the environment (NoDecode: not JSON).
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"])
    public_rate_limit_per_minute: int = 60
    public_cache_ttl_seconds: int = 300

    # Methodology (TRD Part B)
    base_date: str = "2026-09-01"
    methodology_version: str = "h-1.2"
    outlier_iqr_multiplier: float = 1.5
    attribution_reconciliation_tolerance: float = 1e-4

    # Scheduler (decision D2: in-process, Asia/Kolkata)
    scheduler_enabled: bool = False
    timezone: str = "Asia/Kolkata"
    collection_slots: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["02:30", "05:30", "13:00", "19:00"])
    publication_time: str = "20:00"

    @field_validator("cors_origins", "collection_slots", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        return [v.strip() for v in value.split(",") if v.strip()] if isinstance(value, str) else value

    @property
    def sqlite_path(self) -> Path | None:
        prefix = "sqlite:///"
        return Path(self.database_url[len(prefix):]) if self.database_url.startswith(prefix) else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
