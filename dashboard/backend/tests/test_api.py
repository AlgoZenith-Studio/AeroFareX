"""Auth, error envelope, contract shape, public API behaviour."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

ANALYST_PATHS = [
    "index/latest", "index/history", "index/family", "index/attribution/2026-09-27", "index/vintages/2026-09-27",
    "routes", "routes/DEL-BOM/fares", "observations", "lead-time/matrix", "quality/coverage", "quality/imputation",
    "health", "sources", "methodology", "export/csv", "export/sdmx",
]


def error_shape(body: dict) -> bool:
    return set(body) == {"error", "code", "message", "correlation_id"}


@pytest.mark.parametrize("path", ANALYST_PATHS)
def test_every_analyst_route_needs_a_token(client, path):
    r = client.get(f"/api/v1/{path}", headers={"Authorization": ""})
    assert r.status_code == 401 and r.json()["code"] == "AUTH_REQUIRED" and error_shape(r.json())


@pytest.mark.parametrize("path", ANALYST_PATHS)
def test_every_analyst_route_works_for_analysts(client, path):
    r = client.get(f"/api/v1/{path}")
    assert r.status_code == 200, r.text


def test_invalid_token_and_pending_account(client):
    r = client.get("/api/v1/index/latest", headers={"Authorization": "Bearer forged"})
    assert r.status_code == 401 and r.json()["code"] == "INVALID_TOKEN"
    r = client.get("/api/v1/index/latest", headers={"Authorization": "Bearer pending"})
    assert r.status_code == 403 and r.json()["code"] == "ACCESS_PENDING"
    r = client.get("/api/v1/index/latest", headers={"Authorization": "Bearer admin"})
    assert r.status_code == 200


def test_dev_role_is_refused_in_production():
    from server.core.auth import check_auth_config
    from server.core.config import Settings

    with pytest.raises(RuntimeError):
        check_auth_config(Settings(env="production", auth_dev_role="ADMIN"))


def test_envelope_and_correlation_id(client):
    r = client.get("/api/v1/routes", headers={"x-correlation-id": "abc123"})
    body = r.json()
    assert set(body) == {"data", "meta"}
    assert body["meta"]["total"] == 5 and body["meta"]["page"] == 1
    assert re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", body["meta"]["generated_at"])
    assert r.headers["x-correlation-id"] == "abc123"
    single = client.get("/api/v1/index/latest").json()
    assert set(single["meta"]) == {"generated_at"}


@pytest.mark.parametrize("path,status,code", [
    ("index/latest?date=2020-01-01", 404, "DATE_OUT_OF_RANGE"),
    ("index/latest?date=yesterday", 422, "INVALID_PARAMETER"),
    ("index/latest?series=XYZ", 422, "INVALID_PARAMETER"),
    ("index/history?series=AFI,NOPE", 422, "UNKNOWN_SERIES"),
    ("index/attribution/2026-08-29", 404, "NO_PREVIOUS_DAY"),
    ("index/attribution/2026-09-27?series=ANC-AFI", 422, "UNSUPPORTED_SERIES"),
    ("routes/DEL-XXX/fares", 404, "ROUTE_NOT_FOUND"),
    ("observations/not-an-id", 404, "OBSERVATION_NOT_FOUND"),
    ("nope", 404, "NOT_FOUND"),
])
def test_errors(client, path, status, code):
    r = client.get(f"/api/v1/{path}")
    assert r.status_code == status and r.json()["code"] == code and error_shape(r.json())


def test_nullable_fields_are_present(client):
    missing = [o for o in client.get("/api/v1/observations", params={"date": "2026-09-10"}).json()["data"]
               if not o["available"]]
    assert missing, "seed has missing quotes on the blocked day"
    o = missing[0]
    assert o["components"] is None and o["flight_number"] is None and o["missing_reason"]


def test_contract_field_names_match_shared_types(client):
    """Every interface field in packages/shared-types appears in the matching response."""
    ts = (Path(__file__).resolve().parents[3] / "packages" / "shared-types" / "index.ts").read_text(encoding="utf-8")

    def fields(name: str) -> set[str]:
        body = re.search(rf"export interface {name}(?: extends \w+)? \{{(.*?)\n\}}", ts, re.S).group(1)
        return set(re.findall(r"^\s+(\w+)\??:", body, re.M))

    checks = {
        "IndexLatest": client.get("/api/v1/index/latest").json()["data"],
        "IndexFamily": client.get("/api/v1/index/family").json()["data"],
        "Attribution": client.get("/api/v1/index/attribution/2026-09-27").json()["data"],
        "RouteSummary": client.get("/api/v1/routes").json()["data"][0],
        "LeadTimeMatrix": client.get("/api/v1/lead-time/matrix").json()["data"],
        "CoverageDay": client.get("/api/v1/quality/coverage").json()["data"][0],
        "HealthSnapshot": client.get("/api/v1/health").json()["data"],
        "SourceHealth": client.get("/api/v1/sources").json()["data"][0],
        "QualityMetadata": client.get("/api/v1/index/latest").json()["data"]["quality"],
    }
    for name, payload in checks.items():
        assert fields(name) == set(payload), f"{name}: {fields(name) ^ set(payload)}"
    audit = client.get("/api/v1/observations").json()["data"][0]
    assert fields("Observation") == set(audit)


def test_vintages_endpoint(client):
    data = client.get("/api/v1/index/vintages/2026-09-27").json()["data"]
    assert {(v["series"], v["vintage"], v["is_current"]) for v in data} == {
        ("AFI", 1, True), ("TCT-AFI", 1, True), ("ANC-AFI", 1, True)}


def test_republish_adds_a_vintage(tmp_path):
    """A revision is a new vintage; the old one stays and the reader picks the newest."""
    from server.core.config import get_settings
    from server.db.migrate import migrate
    from server.db.session import make_engine
    from server.seed.load import load_demo
    from server.services.publish import publish_date
    from server.services.published import load_published

    engine = make_engine(f"sqlite:///{(tmp_path / 'revise.db').as_posix()}")
    migrate(engine, get_settings().migrations_dir)
    load_demo(engine)
    result = publish_date(engine, "2026-09-27", actor="test")
    assert result.vintage == 2 and result.reconciled
    pub = load_published(engine)
    assert pub.get("AFI", "2026-09-27").vintage == 2
    assert pub.quality("2026-09-27")["vintage"] == 2
    engine.dispose()


def test_export_csv(client):
    r = client.get("/api/v1/export/csv")
    assert r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().split("\n")
    assert lines[0].startswith("date,AFI,TCT-AFI,ANC-AFI") and len(lines) == 31


def test_export_sdmx(client):
    body = client.get("/api/v1/export/sdmx").json()
    ds = body["data"]["dataSets"][0]["series"]
    assert len(ds) == 3 and len(ds["0"]["observations"]) == 30


# ---------------------------------------------------------------- public API
def test_public_needs_no_token_and_is_cacheable(client):
    r = client.get("/api/v1/public/latest", headers={"Authorization": ""})
    assert r.status_code == 200
    assert r.headers["cache-control"].startswith("public, max-age=")
    data = r.json()["data"]
    assert data["series"] == "AFI" and data["drip_gap_pct"] > 10


def test_public_routes_and_methodology(client):
    routes = client.get("/api/v1/public/routes/summary", headers={"Authorization": ""}).json()["data"]
    assert len(routes) == 5
    for r in routes:
        assert r["total_paise"] - r["advertised_paise"] == r["added_paise"] > 0
    m = client.get("/api/v1/public/methodology", headers={"Authorization": ""}).json()["data"]
    assert m["sections"]


def test_public_fare_search(client):
    r = client.get("/api/v1/public/fares/search", params={"from": "DEL", "to": "BOM", "date": "2026-10-05"},
                   headers={"Authorization": ""})
    body = r.json()["data"]
    assert body["from"] == "DEL" and body["sample"] is True and len(body["flights"]) == 8
    offer = body["flights"][0]["offers"][0]
    assert offer["total_paise"] == sum(offer[k] for k in
                                       ("advertised_paise", "fuel_paise", "airport_paise", "gst_paise", "platform_paise"))
    r = client.get("/api/v1/public/fares/search", params={"from": "DEL", "to": "GOI", "date": "2026-10-05"},
                   headers={"Authorization": ""})
    assert r.status_code == 404 and r.json()["code"] == "ROUTE_NOT_TRACKED"


def test_public_rate_limit(client):
    from public_api.guard import limiter
    from server.core.config import get_settings

    limiter.reset()
    limit = get_settings().public_rate_limit_per_minute
    codes = [client.get("/api/v1/public/methodology", headers={"Authorization": "", "x-forwarded-for": "10.9.9.9"})
             .status_code for _ in range(limit + 1)]
    assert codes[:limit] == [200] * limit and codes[-1] == 429
    limiter.reset()


def test_healthz(client):
    assert client.get("/healthz", headers={"Authorization": ""}).json() == {"status": "ok"}
