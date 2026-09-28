"""Shared request dependencies and the response envelope (TRD Part D)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Query
from sqlalchemy import Engine

from ..db.session import get_engine
from ..econometrics.engine import IndexEngine
from ..services.dataset import engine_cache
from ..services.published import PublishedIndex, load_published

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def envelope(data: Any, total: int | None = None) -> dict:
    meta: dict[str, Any] = {"generated_at": now_iso()}
    if total is not None:
        meta.update(page=1, page_size=total, total=total)
    return {"data": data, "meta": meta}


def db() -> Engine:
    return get_engine()


def published() -> PublishedIndex:
    return load_published(get_engine())


def index_engine() -> IndexEngine:
    return engine_cache.get(get_engine())


def date_query(description: str = "YYYY-MM-DD; defaults to the latest published day") -> Any:
    return Query(None, pattern=DATE_PATTERN, description=description)
