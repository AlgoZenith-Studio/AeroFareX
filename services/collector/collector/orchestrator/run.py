"""
One collection run:  python -m collector.orchestrator.run --slot 19:00

  plan -> circuit check -> fetch (Scrapy) -> parse/validate -> archive + load -> health

Exit code 0 when the run finished (even with failed sources, which are recorded), 1 when
it failed outright. Runs with no enabled, configured source do nothing and say why.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import insert, select, update

from server.core.config import get_settings
from server.db.migrate import migrate
from server.db.session import get_engine
from server.econometrics.basket import WINDOW_DAYS, WINDOWS
from server.econometrics.jsnum import add_days
from server.models import collection_runs, routes as routes_t, source_health
from server.services.schedule import ist_today
from server.services.dataset import engine_cache

from ..adapters.base import Adapter, FareQuery, FareRequest, NotConfigured
from ..adapters.registry import enabled_adapters
from ..config import CollectorSettings, get_collector_settings
from ..monitoring.health import push_source_health
from ..pipeline.load import archive_and_load
from ..pipeline.validate import ParsedResponse, flag_outliers, parse_response
from ..storage.raw_archive import batch_hash, open_archive
from .circuit_breaker import Circuit, after_run, should_run
from .spider import fetch_all

log = logging.getLogger("aerofarex.collector")

SLOTS = ("02:30", "05:30", "13:00", "19:00", "manual")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


def plan(db, search_date: str) -> list[FareQuery]:
    with db.connect() as conn:
        rows = conn.execute(select(routes_t).order_by(routes_t.c.sort_order)).all()
    return [
        FareQuery(r.route_id, r.origin, r.destination, search_date, add_days(search_date, WINDOW_DAYS[w]), w,
                  WINDOW_DAYS[w])
        for r in rows for w in WINDOWS
    ]


def load_circuits(db) -> dict[str, Circuit]:
    with db.connect() as conn:
        return {r.source_id: Circuit(r.source_id, r.state, r.consecutive_failures, r.opened_at, r.last_success_at)
                for r in conn.execute(select(source_health))}


def save_circuit(db, c: Circuit, adapter: Adapter, now: str) -> dict:
    row = {"source_id": c.source_id, "state": c.state, "consecutive_failures": c.consecutive_failures,
           "opened_at": c.opened_at, "last_success_at": c.last_success_at,
           "adapter_version": adapter.adapter_version, "updated_at": now}
    with db.begin() as conn:
        exists = conn.execute(select(source_health.c.source_id).where(source_health.c.source_id == c.source_id)).first()
        if exists:
            conn.execute(update(source_health).where(source_health.c.source_id == c.source_id).values(**row))
        else:
            conn.execute(insert(source_health).values(**row))
    return row


def collect(slot: str, cs: CollectorSettings | None = None) -> int:
    cs = cs or get_collector_settings()
    settings = get_settings()
    db = get_engine()
    migrate(db, settings.migrations_dir)

    adapters, notes = enabled_adapters(cs)
    for note in notes:
        log.warning(note)
    if not adapters:
        log.warning("nothing to collect: no enabled source has a configured adapter (ENABLED_SOURCES=%s)",
                    ",".join(cs.enabled_sources) or "empty")
        return 0

    started = _now()
    search_date = ist_today(started).isoformat()
    run_id = f"run-{search_date}-{slot.replace(':', '')}"
    with db.begin() as conn:
        if conn.execute(select(collection_runs.c.run_id).where(collection_runs.c.run_id == run_id)).first():
            run_id = f"{run_id}-{uuid.uuid4().hex[:6]}"
        conn.execute(insert(collection_runs).values(run_id=run_id, slot=slot, started_at=_iso(started),
                                                    status="RUNNING", observations=0))
    log.info("run %s: %d source(s), search date %s", run_id, len(adapters), search_date)

    try:
        circuits = load_circuits(db)
        cooldown = timedelta(hours=cs.circuit_cooldown_hours)
        active: list[tuple[Adapter, Circuit]] = []
        for a in adapters:
            go, circuit = should_run(circuits.get(a.source_id, Circuit(a.source_id)), started, cooldown)
            if go:
                active.append((a, circuit))
            else:
                notes.append(f"{a.source_id}: circuit OPEN since {circuit.opened_at}, skipped")
                log.warning(notes[-1])

        queries = plan(db, search_date)
        requests: list[FareRequest] = []
        for a, _ in active:
            for q in queries:
                try:
                    requests.extend(a.build_requests(q))
                except NotConfigured as exc:
                    notes.append(str(exc))
                    break

        t0 = time.monotonic()
        raws = fetch_all(requests, cs)
        log.info("fetched %d responses in %.1fs", len(raws), time.monotonic() - t0)

        by_source: dict[str, list[ParsedResponse]] = {a.source_id: [] for a, _ in active}
        adapter_of = {a.source_id: a for a, _ in active}
        for raw in raws:
            a = adapter_of[raw.request.source]
            by_source[a.source_id].append(parse_response(a, raw, str(uuid.uuid4()), cs.phantom_min_seats))
        flagged = flag_outliers([r for rs in by_source.values() for r in rs], cs.outlier_iqr_multiplier)

        archive = open_archive(settings.raw_archive_url)
        total_obs, ok_total, resp_total, batch_hashes, health_rows = 0, 0, 0, [], []
        now_iso = _iso(_now())
        for a, circuit in active:
            responses = by_source[a.source_id]
            bh, n = archive_and_load(db, archive, a, run_id, responses)
            if bh:
                batch_hashes.append(bh)
            total_obs += n
            ok = sum(1 for r in responses if r.outcome == "OK")
            blocked = any(r.outcome == "BLOCKED" for r in responses)
            ok_total += ok
            resp_total += len(responses)
            new_circuit = after_run(circuit, ok, len(responses), blocked, now_iso,
                                    threshold=cs.circuit_failure_threshold, degraded_below=cs.circuit_degraded_below)
            if blocked:
                notes.append(f"{a.source_id}: BLOCKED; circuit opened. Seek a data agreement before retrying.")
            health_rows.append(save_circuit(db, new_circuit, a, now_iso))
            log.info("%s: %d/%d responses ok, %d observations, circuit %s", a.source_id, ok, len(responses), n,
                     new_circuit.state)

        status = "SUCCESS" if resp_total and ok_total == resp_total else "PARTIAL" if ok_total else "FAILED"
        finished = _now()
        note = "; ".join(notes + ([f"{flagged} outlier(s) flagged"] if flagged else [])) or None
        with db.begin() as conn:
            conn.execute(update(collection_runs).where(collection_runs.c.run_id == run_id).values(
                finished_at=_iso(finished), duration_s=round((finished - started).total_seconds(), 1),
                observations=total_obs, status=status,
                batch_hash=batch_hash(None, batch_hashes) if batch_hashes else None, note=note,
            ))
        engine_cache.clear()
        push_source_health(health_rows, settings.firebase_project_id)
        log.info("run %s: %s, %d observations", run_id, status, total_obs)
        return 0 if status != "FAILED" else 1
    except Exception as exc:
        log.exception("run %s failed", run_id)
        with db.begin() as conn:
            conn.execute(update(collection_runs).where(collection_runs.c.run_id == run_id).values(
                finished_at=_iso(_now()), status="FAILED", note=f"{type(exc).__name__}: {exc}"[:500]))
        return 1


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(prog="collector")
    parser.add_argument("--slot", choices=SLOTS, default="manual")
    args = parser.parse_args(argv)
    return collect(args.slot)


if __name__ == "__main__":
    sys.exit(main())
