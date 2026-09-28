"""M3: the index maths, checked independently of the seed."""
import math

import pytest

from server.econometrics.basket import WINDOW_WEIGHT, WINDOWS
from server.econometrics.engine import CarrierDef, IndexEngine, Obs, RouteDef, split_by
from server.econometrics.jevons import geo_mean
from server.econometrics.jsnum import js_round
from server.econometrics.outliers import iqr_flags


def test_booking_curve_sums_to_one():
    assert math.isclose(sum(WINDOW_WEIGHT.values()), 1.0)


def test_geo_mean():
    assert math.isclose(geo_mean([100, 400]), 200)
    with pytest.raises(ValueError):
        geo_mean([])
    with pytest.raises(ValueError):
        geo_mean([100, 0])


def test_js_round_matches_math_round():
    assert [js_round(x) for x in (0.5, 1.5, 2.5, -0.5, -1.5, 2.4999)] == [1, 2, 3, 0, -1, 2]


def test_iqr_flags_log_outlier():
    prices = [5000, 5100, 5200, 5050, 4950, 14000]
    assert iqr_flags(prices) == [False] * 5 + [True]
    assert iqr_flags([100, 1000]) == [False, False]  # too few to screen


def test_split_by_keeps_total():
    parts = split_by(3.0, {"a": 1.0, "b": 2.0})
    assert math.isclose(sum(parts.values()), 3.0)
    even = split_by(1.0, {"a": 0.0, "b": 0.0})
    assert even == {"a": 0.5, "b": 0.5}


def _obs(date, route, window, price, source="indigo", carrier="6E", available=True, status="VALID"):
    comps = None
    if available:
        comps = {"base_fare_paise": price, "fuel_surcharge_paise": price // 10, "udf_paise": 0, "psf_paise": 0,
                 "gst_paise": 0, "platform_fee_paise": 0}
        comps["total_payable_paise"] = sum(comps.values())
    return Obs(f"{date}{route}{window}{source}{price}", f"{date}T00:00:00Z", date, source, "HTTP", route, carrier,
               None, date, window, None, None, None, available, None if available else "SOLD_OUT", status,
               "REAL", comps)


def _engine(observations):
    routes = [RouteDef("A-B", "A → B", "AAA", "BBB", 3.0), RouteDef("C-D", "C → D", "CCC", "DDD", 1.0)]
    return IndexEngine(observations, routes, [CarrierDef("6E", "IndiGo")], base_date="2026-01-01",
                       first_date="2026-01-01")


def test_index_is_100_on_base_and_weighted_after():
    obs = []
    for r in ("A-B", "C-D"):
        for w in WINDOWS:
            obs.append(_obs("2026-01-01", r, w, 10000))
            # Day 2: A-B up 10%, C-D flat -> index = 100 × (0.75 × 1.1 + 0.25 × 1.0) = 107.5
            obs.append(_obs("2026-01-02", r, w, 11000 if r == "A-B" else 10000))
    eng = _engine(obs)
    assert math.isclose(eng.index_value("2026-01-01", "base"), 100)
    assert math.isclose(eng.index_value("2026-01-02", "base"), 107.5)


def test_empty_cell_carries_forward_and_is_imputed():
    obs = [_obs("2026-01-01", r, w, 10000) for r in ("A-B", "C-D") for w in WINDOWS]
    obs.append(_obs("2026-01-02", "A-B", "T+1", 0, available=False))
    eng = _engine(obs)
    cell = eng.cell_value("2026-01-02", "A-B", "T+1", "base")
    assert cell.imputed and math.isclose(cell.value, 10000)
    q = eng.quality("2026-01-02")
    assert q.expected == 1 and q.observed == 0 and q.by_rule["CARRY_FORWARD"] == 1


def test_flagged_quotes_are_excluded():
    obs = [_obs("2026-01-01", r, w, 10000) for r in ("A-B", "C-D") for w in WINDOWS]
    obs.append(_obs("2026-01-01", "A-B", "T+1", 90000, source="akasa", status="FLAGGED"))
    eng = _engine(obs)
    assert math.isclose(eng.cell_value("2026-01-01", "A-B", "T+1", "base").value, 10000)


def test_attribution_reconciles_on_every_axis():
    obs = []
    for d, bump in (("2026-01-01", 1.0), ("2026-01-02", 1.07)):
        for r in ("A-B", "C-D"):
            for i, w in enumerate(WINDOWS):
                obs.append(_obs(d, r, w, int(10000 * (bump if r == "A-B" else 1 + i / 100))))
    eng = _engine(obs)
    for m in ("base", "total"):
        delta, axes = eng.attribution("2026-01-02", m)
        moved = eng.index_value("2026-01-02", m) - eng.index_value("2026-01-01", m)
        assert math.isclose(delta, moved, abs_tol=1e-9)
        for axis, items in axes.items():
            assert math.isclose(sum(c.contribution for c in items), moved, abs_tol=1e-9), axis
