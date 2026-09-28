"""
Shared fixtures: a throwaway SQLite database per session, loaded with the demo seed and
published, and a TestClient whose Firebase verifier is a fake:

  Bearer analyst  -> role ANALYST        Bearer admin -> role ADMIN
  Bearer pending  -> signed in, no role  anything else -> invalid token
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def db_path(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("db") / "aerofarex-test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{path.as_posix()}"
    os.environ["ENV"] = "test"
    os.environ["AUTH_DEV_ROLE"] = ""
    os.environ["FIREBASE_PROJECT_ID"] = "aerofarex-test"
    os.environ["SCHEDULER_ENABLED"] = "false"
    from server.core.config import get_settings
    from server.db.session import get_engine

    get_settings.cache_clear()
    get_engine.cache_clear()
    return path


@pytest.fixture(scope="session")
def seeded(db_path: Path):
    from server.core.config import get_settings
    from server.db.migrate import migrate
    from server.db.session import get_engine
    from server.seed.load import load_demo

    engine = get_engine()
    migrate(engine, get_settings().migrations_dir)
    summary = load_demo(engine)
    return engine, summary


def fake_verifier(token: str) -> dict:
    claims = {
        "analyst": {"uid": "u-analyst", "email": "analyst@example.gov.in", "role": "ANALYST"},
        "admin": {"uid": "u-admin", "email": "admin@example.gov.in", "role": "ADMIN"},
        "pending": {"uid": "u-pending", "email": "someone@example.com"},
    }
    if token not in claims:
        raise ValueError("invalid token")
    return claims[token]


@pytest.fixture(scope="session")
def client(seeded):
    from fastapi.testclient import TestClient

    from public_api.guard import cache, limiter
    from server.core.auth import set_token_verifier
    from server.main import create_app
    from server.services.dataset import engine_cache

    set_token_verifier(fake_verifier)
    engine_cache.clear()
    cache.clear()
    limiter.reset()
    with TestClient(create_app()) as c:
        c.headers["Authorization"] = "Bearer analyst"
        yield c
