"""
aerofarex-core: FastAPI app (TRD Part A/H).

  /api/v1/*          analyst API (Firebase ID token, role ANALYST/ADMIN)
  /api/v1/public/*   public read-only API (landing/backend)
  /healthz           liveness probe for Railway (no auth, no data)
  /docs              OpenAPI

Run locally:  uv run aerofarex serve      (or: uv run uvicorn server.main:app --reload)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .api.v1 import router as analyst_router
from .core.auth import check_auth_config
from .core.config import get_settings
from .core.errors import install_error_handlers
from .db.migrate import migrate
from .db.session import get_engine

log = logging.getLogger("aerofarex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    check_auth_config(settings)
    applied = migrate(get_engine(), settings.migrations_dir)
    if applied:
        log.info("migrations applied: %s", ", ".join(applied))
    scheduler = None
    if settings.scheduler_enabled:
        from .services.scheduler import build_scheduler

        scheduler = build_scheduler()
        scheduler.start()
        log.info("scheduler started (%s): collect %s, publish %s", settings.timezone,
                 ", ".join(settings.collection_slots), settings.publication_time)
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    from public_api.router import router as public_router

    settings = get_settings()
    app = FastAPI(
        title="AeroFareX API",
        version="0.1.0",
        description="Airfare price indices for India (AFI, TCT-AFI, ANC-AFI). Contracts: TRD Part D.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["Authorization", "Content-Type", "x-correlation-id"],
        expose_headers=["x-correlation-id"],
    )
    install_error_handlers(app)
    app.include_router(public_router, prefix="/api/v1")
    app.include_router(analyst_router, prefix="/api/v1")

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}

    return app


app = create_app()
