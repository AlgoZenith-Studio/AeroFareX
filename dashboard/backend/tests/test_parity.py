"""
M2–M4: the FastAPI backend, loaded with the demo seed, serves what the dashboard's mock
API serves, compared endpoint by endpoint against the TypeScript's own output
(tests/fixtures/mock_parity.json, produced by tests/parity/export_mock.mjs).

Known, intended differences (asserted separately below):
  * ANC-AFI: the backend stores ancillary prices as integer paise (TRD rule), the mock
    uses an unrounded factor, so values differ by < 0.001 points.
  * attribution `driver` axis: the backend splits fuel vs demand from the observed
    fuel-surcharge share; the mock from its generator's hidden fuel series. Both still
    sum to ΔI exactly.
  * raw_id: the mock's audit ids collide (character-sum seed); the seed gives each raw
    record a unique UUID. `search_date` is an extra field the mock leaks from its seed.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

MOCK = json.loads((Path(__file__).parent / "fixtures" / "mock_parity.json").read_text(encoding="utf-8"))
IGNORE = {"search_date", "raw_id"}


def assert_same(actual, expected, path="$", rel=1e-12, abs_=1e-9):
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path}: expected object, got {type(actual).__name__}"
        keys = set(expected) - IGNORE
        assert keys <= set(actual), f"{path}: missing {sorted(keys - set(actual))}"
        for k in keys:
            assert_same(actual[k], expected[k], f"{path}.{k}", rel, abs_)
    elif isinstance(expected, list):
        assert isinstance(actual, list) and len(actual) == len(expected), \
            f"{path}: length {len(actual) if isinstance(actual, list) else '-'} != {len(expected)}"
        for i, (a, e) in enumerate(zip(actual, expected)):
            assert_same(a, e, f"{path}[{i}]", rel, abs_)
    elif isinstance(expected, float) or isinstance(actual, float):
        assert math.isclose(actual, expected, rel_tol=rel, abs_tol=abs_), f"{path}: {actual} != {expected}"
    else:
        assert actual == expected, f"{path}: {actual!r} != {expected!r}"


def get(client, path, **params):
    r = client.get(f"/api/v1/{path}", params=params)
    assert r.status_code == 200, r.text
    return r.json()["data"]


@pytest.mark.parametrize("series", ["AFI", "TCT-AFI"])
def test_index_latest(client, series):
    assert_same(get(client, "index/latest", series=series), MOCK["index_latest"][series])


def test_index_latest_anc_within_rounding(client):
    got, want = get(client, "index/latest", series="ANC-AFI"), MOCK["index_latest"]["ANC-AFI"]
    assert abs(got["value"] - want["value"]) < 1e-3
    assert_same({k: v for k, v in got.items() if k not in ("value", "previous_value", "change", "change_pct")},
                {k: v for k, v in want.items() if k not in ("value", "previous_value", "change", "change_pct")})


def test_index_latest_on_a_date(client):
    assert_same(get(client, "index/latest", series="AFI", date="2026-09-12"), MOCK["index_latest_mid"])


def test_index_history(client):
    got = get(client, "index/history", series="AFI,TCT-AFI,ANC-AFI")
    assert_same(got[:2], MOCK["index_history"][:2])
    anc, want = got[2], MOCK["index_history"][2]
    assert anc["provenance_boundary"] == want["provenance_boundary"]
    for a, w in zip(anc["points"], want["points"], strict=True):
        assert a["date"] == w["date"] and a["provenance"] == w["provenance"] and abs(a["value"] - w["value"]) < 1e-3
    assert_same(get(client, "index/history", series="AFI", **{"from": "2026-09-20", "to": "2026-09-25"}),
                MOCK["index_history_window"])


def test_index_family(client):
    got, want = get(client, "index/family"), MOCK["index_family"]
    assert_same(got["members"][:2], want["members"][:2])
    assert_same(got["drip_gap_points"], want["drip_gap_points"])
    assert_same(got["drip_gap_pct"], want["drip_gap_pct"])


@pytest.mark.parametrize("key", sorted(MOCK["attribution"]))
def test_attribution(client, key):
    date, series = key.split("|")
    got, want = get(client, f"index/attribution/{date}", series=series), MOCK["attribution"][key]
    assert got["reconciled"] is True and want["reconciled"] is True
    driver_got, driver_want = got["axes"].pop("driver"), want["axes"].pop("driver")
    assert_same(got, want, rel=1e-9, abs_=1e-9)
    assert [c["key"] for c in driver_got] == [c["key"] for c in driver_want]
    assert math.isclose(sum(c["contribution"] for c in driver_got), got["delta"], abs_tol=1e-9)


def test_routes(client):
    assert_same(get(client, "routes"), MOCK["routes"])
    assert_same(get(client, "routes", date="2026-09-10"), MOCK["routes_mid"])


def test_route_fares(client):
    assert_same(get(client, "routes/DEL-BOM/fares"), MOCK["route_fares"])


def test_observations(client):
    assert_same(get(client, "observations", date="2026-09-10"), MOCK["observations"])
    assert_same(get(client, "observations", date="2026-09-27", route="BLR-HYD"), MOCK["observations_route"])


def test_observation_audit(client):
    for obs_id, want in MOCK["observation_audit"].items():
        got = get(client, f"observations/{obs_id}")
        assert_same(got, want)
        assert len(got["raw_id"]) == 36


def test_lead_time(client):
    assert_same(get(client, "lead-time/matrix"), MOCK["lead_time"])
    assert_same(get(client, "lead-time/matrix", date="2026-09-10"), MOCK["lead_time_blocked"])


def test_coverage(client):
    assert_same(get(client, "quality/coverage"), MOCK["coverage"])
    assert_same(get(client, "quality/imputation"), MOCK["coverage"])


def test_sources_and_runs(client):
    assert_same(get(client, "sources"), MOCK["sources"])
    assert_same(get(client, "health")["runs"], MOCK["runs"])


def _mock_fares_to_api(m: dict) -> dict:
    return {
        "from": m["from"], "to": m["to"], "date": m["date"], "days_ahead": m["daysAhead"],
        "flights": [{
            "carrier": f["carrier"], "carrier_code": f["carrierCode"], "flight_no": f["flightNo"],
            "depart": f["depart"], "arrive": f["arrive"], "duration": f["duration"],
            "offers": [{
                "platform": o["platform"], "advertised_paise": o["parts"]["advertisedPaise"],
                "fuel_paise": o["parts"]["fuelPaise"], "airport_paise": o["parts"]["airportPaise"],
                "gst_paise": o["parts"]["gstPaise"], "platform_paise": o["parts"]["platformPaise"],
                "total_paise": o["parts"]["totalPaise"],
            } for o in f["offers"]],
        } for f in m["flights"]],
        "by_days_ahead": [{"days": b["days"], "label": b["label"], "cheapest_paise": b["cheapestPaise"]}
                          for b in m["byDaysAhead"]],
    }


@pytest.mark.parametrize("key", sorted(MOCK["fares"]))
def test_fare_search_matches_landing_mock(key):
    from public_api.fares import search

    frm, to, date = key.split("-", 2)
    got = search(frm, to, date, today=MOCK["fares_now"][:10])
    assert got["sample"] is True
    assert_same({k: v for k, v in got.items() if k not in ("seen_at", "sample")}, _mock_fares_to_api(MOCK["fares"][key]))
