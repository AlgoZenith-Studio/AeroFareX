"""
In-process scheduler (decision D2): APScheduler on Asia/Kolkata time.

  02:30 · 05:30 · 13:00 · 19:00 IST   collector run, in a child process
  20:00 IST                           publish today's index

The collector runs as `python -m collector.orchestrator.run` in a subprocess: Scrapy's
Twisted reactor can start only once per process, and a crash there must not take the
API down. Misfire grace covers the brief downtime of a redeploy.
"""
from __future__ import annotations

import logging
import subprocess
import sys

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..core.config import get_settings
from ..db.session import get_engine
from .publish import PublicationError, publish_date
from .schedule import ist_today

log = logging.getLogger("aerofarex.scheduler")

MISFIRE_GRACE_S = 45 * 60
COLLECT_TIMEOUT_S = 90 * 60


def run_collection(slot: str) -> int:
    log.info("collection %s: starting", slot)
    try:
        result = subprocess.run(
            [sys.executable, "-m", "collector.orchestrator.run", "--slot", slot],
            timeout=COLLECT_TIMEOUT_S, check=False,
        )
    except subprocess.TimeoutExpired:
        log.error("collection %s: timed out after %ds", slot, COLLECT_TIMEOUT_S)
        return -1
    log.info("collection %s: exited %d", slot, result.returncode)
    return result.returncode


def run_publication() -> None:
    day = ist_today().isoformat()
    try:
        published = publish_date(get_engine(), day, actor="scheduler")
        if not published.reconciled:
            log.error("publication %s: attribution did not reconcile", day)
    except PublicationError as exc:
        log.warning("publication %s skipped: %s", day, exc)


def build_scheduler() -> BackgroundScheduler:
    settings = get_settings()
    scheduler = BackgroundScheduler(timezone=settings.timezone)
    for slot in settings.collection_slots:
        hour, minute = (int(x) for x in slot.split(":"))
        scheduler.add_job(
            run_collection, CronTrigger(hour=hour, minute=minute, timezone=settings.timezone), args=[slot],
            id=f"collect-{slot}", misfire_grace_time=MISFIRE_GRACE_S, coalesce=True, max_instances=1,
        )
    hour, minute = (int(x) for x in settings.publication_time.split(":"))
    scheduler.add_job(
        run_publication, CronTrigger(hour=hour, minute=minute, timezone=settings.timezone),
        id="publish", misfire_grace_time=MISFIRE_GRACE_S, coalesce=True, max_instances=1,
    )
    return scheduler
