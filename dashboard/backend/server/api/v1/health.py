"""/sources and /health: collector circuit states, recent runs, next collection and publication."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import Engine, select

from ...core.config import get_settings
from ...econometrics.engine import IndexEngine, success_rate
from ...models import collection_runs as runs_t, source_health as health_t, sources as sources_t
from ...schemas.api import Envelope, HealthSnapshot, SourceHealth
from ...services.published import PublishedIndex
from ...services.schedule import iso_ms, next_at
from ..deps import db, envelope, index_engine, published

router = APIRouter(tags=["health"])

SLOTS = ("02:30", "05:30", "13:00", "19:00")


def source_health(engine: Engine, eng: IndexEngine, pub: PublishedIndex) -> list[dict]:
    recent = set(pub.dates[-7:])
    q = (select(sources_t, health_t.c.state, health_t.c.consecutive_failures, health_t.c.last_success_at,
                health_t.c.adapter_version)
         .join(health_t, health_t.c.source_id == sources_t.c.source_id, isouter=True)
         .order_by(sources_t.c.sort_order))
    with engine.connect() as conn:
        rows = conn.execute(q).all()
    return [{
        "source": r.source_id,
        "label": r.label,
        "type": r.type,
        "fetch_tier": r.fetch_tier,
        "state": r.state or "HEALTHY",
        "last_success_at": r.last_success_at,
        "success_rate_7d": success_rate(eng.observations, r.source_id, recent),
        "consecutive_failures": r.consecutive_failures or 0,
        "adapter_version": r.adapter_version or "not-configured",
    } for r in rows]


@router.get("/sources", response_model=Envelope[list[SourceHealth]], response_model_exclude_unset=True, tags=["health"])
def sources(engine: Engine = Depends(db), eng: IndexEngine = Depends(index_engine),
            pub: PublishedIndex = Depends(published)):
    return envelope(source_health(engine, eng, pub))


@router.get("/health", response_model=Envelope[HealthSnapshot], response_model_exclude_unset=True)
def health(engine: Engine = Depends(db), eng: IndexEngine = Depends(index_engine),
           pub: PublishedIndex = Depends(published)):
    settings = get_settings()
    with engine.connect() as conn:
        runs = conn.execute(
            select(runs_t).where(runs_t.c.status != "RUNNING", runs_t.c.slot.in_(SLOTS))
            .order_by(runs_t.c.started_at.desc()).limit(12)
        ).all()
    return envelope({
        "sources": source_health(engine, eng, pub),
        "runs": [{
            "run_id": r.run_id, "slot": r.slot, "started_at": r.started_at, "duration_s": r.duration_s or 0,
            "observations": r.observations, "status": r.status, "batch_hash": r.batch_hash or "",
        } for r in runs],
        "next_run_at": iso_ms(next_at(settings.collection_slots)),
        "next_publication_at": iso_ms(next_at([settings.publication_time])),
    })
