"""SQLAlchemy engine for SQLite with the TRD Part E pragmas on every connection."""
from __future__ import annotations

from contextlib import contextmanager
from functools import lru_cache
from typing import Iterator

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import Connection

from ..core.config import get_settings


def make_engine(database_url: str) -> Engine:
    if database_url.startswith("sqlite:///"):
        from pathlib import Path

        path = database_url[len("sqlite:///"):]
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(database_url, connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {})
    if database_url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _pragmas(dbapi_connection, _record) -> None:  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()
    return engine


@lru_cache
def get_engine() -> Engine:
    return make_engine(get_settings().database_url)


@contextmanager
def transaction(engine: Engine | None = None) -> Iterator[Connection]:
    with (engine or get_engine()).begin() as conn:
        yield conn
