"""
Apply infra/db/migrations/NNNN_*.sql in order, each once, each in its own transaction.
Applied files are recorded in `schema_migrations`; never edit an applied file.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Engine

log = logging.getLogger("aerofarex.migrate")

_NAME = re.compile(r"^\d{4}_[a-z0-9_]+\.sql$")


def pending_migrations(engine: Engine, migrations_dir: Path) -> list[Path]:
    files = sorted(p for p in migrations_dir.glob("*.sql") if _NAME.match(p.name))
    raw = engine.raw_connection()
    try:
        raw.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT"
        )
        done = {row[0] for row in raw.execute("SELECT name FROM schema_migrations")}
    finally:
        raw.close()
    return [p for p in files if p.name not in done]


def migrate(engine: Engine, migrations_dir: Path) -> list[str]:
    applied: list[str] = []
    for path in pending_migrations(engine, migrations_dir):
        sql = path.read_text(encoding="utf-8")
        raw = engine.raw_connection()
        try:
            # executescript would auto-commit statement by statement; wrap it so a
            # failing migration leaves nothing half-applied.
            raw.driver_connection.executescript(
                "BEGIN;\n" + sql + "\nINSERT INTO schema_migrations (name, applied_at) VALUES ("
                f"'{path.name}', '{datetime.now(timezone.utc).isoformat()}');\nCOMMIT;"
            )
        except Exception:
            raw.driver_connection.rollback()
            raise
        finally:
            raw.close()
        log.info("applied migration %s", path.name)
        applied.append(path.name)
    return applied
