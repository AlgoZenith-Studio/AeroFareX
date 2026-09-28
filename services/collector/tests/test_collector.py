"""
M5/M6: the collector end to end, against a local HTTP server (never a real site):
fetch with the declared user-agent, obey robots.txt, archive + hash-chain raw payloads,
parse, validate, load, circuit breaker, then publish an index from the collected data.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import subprocess
import sys
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select, text

HERE = Path(__file__).parent
UA_SEEN: list[str] = []
PATHS_SEEN: list[str] = []
FAILING = {"on": True}  # first run: two routes fail; later runs: everything answers


def price(base: int) -> dict:
    fuel, udf, psf = base * 13 // 100, 32000, 9100
    gst = (base + fuel) * 5 // 100
    return {"base_fare_paise": base, "fuel_surcharge_paise": fuel, "udf_paise": udf, "psf_paise": psf,
            "gst_paise": gst, "platform_fee_paise": 0, "total_payable_paise": base + fuel + udf + psf + gst}


class FixtureSite(BaseHTTPRequestHandler):
    def log_message(self, *args) -> None:  # keep test output quiet
        pass

    def _send(self, status: int, body: bytes, ctype: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        url = urlparse(self.path)
        UA_SEEN.append(self.headers.get("User-Agent", ""))
        PATHS_SEEN.append(url.path)
        if url.path == "/robots.txt":
            return self._send(200, b"User-agent: *\nDisallow: /private/\n", "text/plain")
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        route, window = f"{q['from']}-{q['to']}", int(q["w"])
        if FAILING["on"] and route == "BLR-HYD":
            return self._send(500, b'{"error":"upstream"}')
        if FAILING["on"] and route == "DEL-CCU":
            return self._send(200, b'{"flights": [ {"no": "6E1", ')  # truncated JSON
        base = 400000 + window * 1000
        flights = [{"no": f"6E{100 + i}", "price": price(base + i * 2500)} for i in range(5)]
        if route == "DEL-BOM" and window == 1:
            flights.append({"no": "6E999", "price": price(base * 4)})  # outlier
            flights.append({"no": "6E998", "price": price(base), "seats": 1})  # phantom
            bad = price(base)
            bad["total_payable_paise"] += 100  # components don't add up
            flights.append({"no": "6E997", "price": bad})
        return self._send(200, json.dumps({"flights": flights}).encode())


@pytest.fixture(scope="module")
def site():
    server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureSite)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture(scope="module")
def env(site, tmp_path_factory):
    tmp = tmp_path_factory.mktemp("collector")
    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
    e = dict(os.environ)
    e.update({
        "DATABASE_URL": f"sqlite:///{(tmp / 'collector.db').as_posix()}",
        "RAW_ARCHIVE_URL": (tmp / "raw").as_uri(),
        "ENABLED_SOURCES": "indigo,akasa,spicejet",
        "ADAPTER_OVERRIDES": "indigo=fixture_adapters:LocalIndigo,akasa=fixture_adapters:BlockedAkasa",
        "RATE_LIMIT_SECONDS": "0",
        "MAX_RETRIES": "0",
        "FIXTURE_BASE_URL": site,
        "BASE_DATE": today,
        "ENV": "test",
        "PYTHONPATH": os.pathsep.join([str(HERE), e.get("PYTHONPATH", "")]),
    })
    return e, tmp, today


def run_collector(e: dict, slot: str = "manual") -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, "-m", "collector.orchestrator.run", "--slot", slot], env=e,
                          capture_output=True, text=True, timeout=300)


@pytest.fixture(scope="module")
def first_run(env):
    e, tmp, today = env
    result = run_collector(e)
    assert result.returncode == 0, result.stdout + result.stderr
    from server.db.session import make_engine

    db = make_engine(e["DATABASE_URL"])
    yield db, result, tmp, today
    db.dispose()


def test_declared_user_agent_and_robots(first_run):
    _, result, _, _ = first_run
    assert UA_SEEN and all(ua.startswith("AeroFareX-StatisticalCollector/") for ua in UA_SEEN)
    assert "/robots.txt" in PATHS_SEEN
    assert not any(p.startswith("/private/") for p in PATHS_SEEN), "a robots.txt-disallowed URL was fetched"
    assert "spicejet: enabled but its adapter isn't configured yet" in result.stderr + result.stdout


def test_raw_payloads_archived_and_hashed(first_run):
    db, _, _, _ = first_run
    with db.connect() as conn:
        raws = conn.execute(text("SELECT * FROM raw_observations WHERE source = 'indigo'")).mappings().all()
    assert len(raws) == 25  # 5 routes × 5 windows
    assert len({r["batch_hash"] for r in raws}) == 1 and raws[0]["prev_batch_hash"] is None
    for r in raws:
        path = Path(r["object_key"].replace("file:///", "").replace("file://", ""))
        body = gzip.decompress(path.read_bytes())
        assert hashlib.sha256(body).hexdigest() == r["sha256"]
    # The run record's hash commits to every source batch in the run.
    from collector.storage.raw_archive import batch_hash

    with db.connect() as conn:
        batches = conn.execute(text(
            "SELECT DISTINCT batch_hash FROM raw_observations ORDER BY fetched_at")).scalars().all()
        run_hash = conn.execute(text("SELECT batch_hash FROM collection_runs")).scalar()
    assert run_hash in {batch_hash(None, batches), batch_hash(None, list(reversed(batches)))}


def test_observations_classified(first_run):
    db, _, _, _ = first_run
    with db.connect() as conn:
        rows = conn.execute(text(
            "SELECT route_id, advance_days, flight_number, available, missing_reason, validation_status, source "
            "FROM fare_observations")).mappings().all()
    by = lambda **kw: [r for r in rows if all(r[k] == v for k, v in kw.items())]  # noqa: E731
    assert len(by(route_id="BLR-HYD", missing_reason="SOURCE_ERROR")) == 5
    assert len(by(route_id="DEL-CCU", missing_reason="PARSER_ERROR")) == 5
    assert by(flight_number="6E999")[0]["validation_status"] == "FLAGGED"  # IQR outlier
    assert by(flight_number="6E998")[0]["validation_status"] == "FLAGGED"  # phantom
    assert by(flight_number="6E997")[0]["validation_status"] == "INVALID"  # doesn't add up
    assert len(by(source="akasa", missing_reason="BLOCKED")) == 25
    with db.connect() as conn:
        orphan = conn.execute(text(
            "SELECT count(*) FROM fare_components c JOIN fare_observations o USING (observation_id) "
            "WHERE o.validation_status = 'INVALID'")).scalar()
    assert orphan == 0


def test_circuits_and_run_record(first_run):
    db, _, _, _ = first_run
    with db.connect() as conn:
        health = {r["source_id"]: r for r in conn.execute(text("SELECT * FROM source_health")).mappings()}
        run = conn.execute(text("SELECT * FROM collection_runs")).mappings().one()
    assert health["akasa"]["state"] == "OPEN" and health["akasa"]["opened_at"]
    assert health["indigo"]["state"] == "DEGRADED"  # 15 of 25 cells fine
    assert run["status"] == "PARTIAL" and run["observations"] > 0 and len(run["batch_hash"]) == 64
    assert "BLOCKED" in run["note"]


def test_publish_refuses_incomplete_base_period(first_run, env):
    _, _, _, today = first_run
    e, _, _ = env
    result = subprocess.run([sys.executable, "-m", "server.cli", "publish", "--date", today], env=e,
                            capture_output=True, text=True, timeout=120)
    assert result.returncode == 1
    assert "not published" in result.stderr and "base period" in result.stderr
    assert "Traceback" not in result.stderr


def test_second_run_chains_and_skips_open_source(first_run, env):
    db, _, _, _ = first_run
    e, _, _ = env
    FAILING["on"] = False
    with db.connect() as conn:
        first_hash = conn.execute(text("SELECT batch_hash FROM raw_observations WHERE source='indigo' LIMIT 1")).scalar()
    PATHS_SEEN.clear()
    result = run_collector(e, slot="manual")
    assert result.returncode == 0, result.stderr
    with db.connect() as conn:
        prevs = conn.execute(text(
            "SELECT DISTINCT prev_batch_hash FROM raw_observations WHERE source='indigo' AND prev_batch_hash IS NOT NULL"
        )).scalars().all()
        runs = conn.execute(text("SELECT count(*) FROM collection_runs")).scalar()
    assert prevs == [first_hash]  # the new batch links to the previous one
    assert runs == 2
    assert "circuit OPEN" in result.stdout + result.stderr  # akasa skipped during cooldown


def test_publish_from_collected_data(first_run, env):
    db, _, _, today = first_run
    e, _, _ = env
    result = subprocess.run([sys.executable, "-m", "server.cli", "publish", "--date", today], env=e,
                            capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stdout + result.stderr
    out = json.loads(result.stdout[result.stdout.index("{"):])
    assert abs(out["values"]["AFI"] - 100) < 1e-9  # the base day itself
    with db.connect() as conn:
        snap = conn.execute(text("SELECT * FROM index_snapshots WHERE index_name='AFI'")).mappings().one()
    assert snap["provenance"] == "REAL" and 0 < snap["coverage_ratio"] < 1


def test_nothing_enabled_does_nothing(env):
    e, _, _ = env
    e2 = dict(e, ENABLED_SOURCES="")
    result = run_collector(e2)
    assert result.returncode == 0 and "nothing to collect" in result.stdout + result.stderr


# ---------------------------------------------------------------- unit
def test_circuit_breaker_transitions():
    from collector.orchestrator.circuit_breaker import Circuit, after_run, should_run

    now = datetime(2026, 9, 28, tzinfo=timezone.utc)
    kw = dict(threshold=3, degraded_below=0.8)
    c = Circuit("x")
    c = after_run(c, 0, 25, False, "t1", **kw)
    assert (c.state, c.consecutive_failures) == ("DEGRADED", 1)
    c = after_run(after_run(c, 0, 25, False, "t2", **kw), 0, 25, False, "2026-09-27T00:00:00Z", **kw)
    assert c.state == "OPEN"
    assert should_run(c, now, timedelta(hours=48)) == (False, c)
    go, trial = should_run(c, now, timedelta(hours=12))
    assert go and trial.state == "RECOVERING"
    assert after_run(trial, 25, 25, False, "t4", **kw).state == "HEALTHY"
    assert after_run(trial, 0, 25, False, "t4", **kw).state == "OPEN"
    assert after_run(Circuit("y"), 25, 25, True, "t5", **kw).state == "OPEN"


def test_local_archive_is_append_only(tmp_path):
    from collector.storage.raw_archive import ArchiveConflict, LocalArchive

    archive = LocalArchive(tmp_path)
    url = archive.put("2026-09-28/indigo/run/x.json.gz", b'{"a":1}')
    assert archive.get(url) == b'{"a":1}'
    with pytest.raises(ArchiveConflict):
        archive.put("2026-09-28/indigo/run/x.json.gz", b'{"a":2}')
