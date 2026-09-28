"""
The index engine over a set of observations (TRD Part B §1–3, §5).

  cell     Jevons mean of usable quotes in (search date, route, window); an empty cell
           carries the previous day's value forward and is marked imputed
  index    100 × Σ_r W_r Σ_k ω_k × cell(t) / cell(base)   (Laspeyres, fixed base)
  quality  expected vs usable quotes, imputation by rule, missing by reason
  waterfall additive decomposition of ΔI on five axes that each sum to ΔI

Ported from dashboard/frontend/src/lib/mock/seed.ts; keep the two in step.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Iterable

from .basket import (
    COMPONENT_KEYS, COMPONENT_LABELS, IMPUTATION_RULES, MISSING_REASONS, WINDOW_WEIGHT, WINDOWS, Measure,
)
from .jevons import geo_mean
from .jsnum import add_days, js_round


@dataclass(frozen=True)
class RouteDef:
    route_id: str
    label: str
    origin: str
    destination: str
    pax_share: float


@dataclass(frozen=True)
class CarrierDef:
    code: str
    label: str


@dataclass
class Obs:
    observation_id: str
    observed_at: str
    search_date: str
    source: str
    fetch_tier: str
    route_id: str
    carrier_code: str
    flight_number: str | None
    departure_date: str
    window: str
    fare_family: str | None
    baggage_allowance_kg: int | None
    refundable: bool | None
    available: bool
    missing_reason: str | None
    validation_status: str
    provenance: str
    components: dict[str, int] | None

    @property
    def usable(self) -> bool:
        return self.available and self.validation_status == "VALID" and self.components is not None


def measure_of(components: dict[str, int], m: Measure) -> int:
    return components["base_fare_paise"] if m == "base" else components["total_payable_paise"]


@dataclass
class Cell:
    value: float
    imputed: bool


@dataclass
class DayQuality:
    expected: int
    observed: int
    coverage: float
    imputation_rate: float
    by_rule: dict[str, int]
    missing_by_reason: dict[str, int]


@dataclass
class Contribution:
    key: str
    label: str
    contribution: float


class BasePeriodIncomplete(ValueError):
    """A base-period cell has no price, so no relative can be formed for it."""


def split_by(total: float, parts: dict[str, float]) -> dict[str, float]:
    s = 0.0
    for v in parts.values():
        s += v
    if abs(s) < 1e-12:
        return {k: total / len(parts) for k in parts}
    return {k: (total * v) / s for k, v in parts.items()}


@dataclass
class IndexEngine:
    """All index maths for one dataset. Cheap to build; cells are memoised."""

    observations: list[Obs]
    routes: list[RouteDef]
    carriers: list[CarrierDef]
    base_date: str
    first_date: str
    # ANC-AFI: {search_date: {item: [price_paise, ...]}}
    ancillary: dict[str, dict[str, list[int]]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self._cells: dict[tuple[str, str, str], list[Obs]] = {}
        for o in self.observations:
            self._cells.setdefault((o.search_date, o.route_id, o.window), []).append(o)
        self._by_date: dict[str, list[Obs]] = {}
        for o in self.observations:
            self._by_date.setdefault(o.search_date, []).append(o)
        pax_total = 0.0
        for r in self.routes:
            pax_total += r.pax_share
        self.route_weight = {r.route_id: r.pax_share / pax_total for r in self.routes}
        self._cell_cache: dict[tuple[str, str, str, str], Cell] = {}
        self._basket_cache: dict[str, float | None] = {}

    # ------------------------------------------------------------ cells
    def cell_observations(self, date: str, route: str, window: str) -> list[Obs]:
        return self._cells.get((date, route, window), [])

    def observations_on(self, date: str) -> list[Obs]:
        return self._by_date.get(date, [])

    def cell_value(self, date: str, route: str, window: str, m: Measure) -> Cell:
        key = (date, route, window, m)
        cached = self._cell_cache.get(key)
        if cached is not None:
            return cached
        # Iterative carry-forward (a long outage must not hit the recursion limit).
        chain: list[tuple[str, str, str, str]] = []
        d = date
        result: Cell | None = None
        while True:
            k = (d, route, window, m)
            hit = self._cell_cache.get(k)
            if hit is not None:
                result = hit
                break
            usable = [o for o in self.cell_observations(d, route, window) if o.usable]
            if usable:
                result = Cell(geo_mean(measure_of(o.components, m) for o in usable), False)  # type: ignore[arg-type]
                self._cell_cache[k] = result
                break
            chain.append(k)
            if d <= self.first_date:
                result = Cell(0.0, True)
                break
            d = add_days(d, -1)
        for k in reversed(chain):
            result = Cell(result.value, True)
            self._cell_cache[k] = result
        return self._cell_cache[key] if key in self._cell_cache else result

    # ------------------------------------------------------------ index
    def index_value(self, date: str, m: Measure) -> float:
        total = 0.0
        for r in self.routes:
            for k in WINDOWS:
                base = self.cell_value(self.base_date, r.route_id, k, m).value
                if base <= 0:
                    raise BasePeriodIncomplete(
                        f"the base period ({self.base_date}) has no price for {r.route_id} {k}")
                total += self.route_weight[r.route_id] * WINDOW_WEIGHT[k] * (
                    self.cell_value(date, r.route_id, k, m).value / base
                )
        return 100 * total

    def basket(self, date: str) -> float | None:
        """ANC-AFI basket: Σ over items of the Jevons mean price; carried forward when empty."""
        if date in self._basket_cache:
            return self._basket_cache[date]
        d = date
        value: float | None = None
        while d >= self.first_date:
            items = self.ancillary.get(d)
            if items and all(items.get(i) for i in ("SEAT", "BAG", "MEAL")):
                value = 0.0
                for item in ("SEAT", "BAG", "MEAL"):
                    value += geo_mean(items[item])
                break
            d = add_days(d, -1)
        self._basket_cache[date] = value
        return value

    def ancillary_index(self, date: str) -> float | None:
        now, base = self.basket(date), self.basket(self.base_date)
        if now is None or not base:
            return None
        return (100 * now) / base

    def route_index(self, route: str, date: str) -> float:
        s = 0.0
        for w in WINDOWS:
            s = s + WINDOW_WEIGHT[w] * (
                self.cell_value(date, route, w, "total").value / self.cell_value(self.base_date, route, w, "total").value
            )
        return 100 * s

    # ------------------------------------------------------------ quality
    def quality(self, date: str) -> DayQuality:
        by_rule = {r: 0 for r in IMPUTATION_RULES}
        missing = {r: 0 for r in MISSING_REASONS}
        expected = 0
        valid = 0
        for r in self.routes:
            for k in WINDOWS:
                obs = self.cell_observations(date, r.route_id, k)
                good = sum(1 for o in obs if o.usable)
                expected += len(obs)
                valid += good
                for o in obs:
                    if o.validation_status == "FLAGGED":
                        by_rule["EXCLUDED"] += 1
                    if not o.available:
                        missing[o.missing_reason or "UNKNOWN"] += 1
                        if good == 0:
                            by_rule["CARRY_FORWARD"] += 1
                        elif good >= 2:
                            by_rule["CROSS_SOURCE"] += 1
                        else:
                            by_rule["CELL_MEAN"] += 1
        imputed = by_rule["CROSS_SOURCE"] + by_rule["CELL_MEAN"] + by_rule["CARRY_FORWARD"]
        return DayQuality(
            expected=expected,
            observed=valid,
            coverage=valid / expected if expected else 0.0,
            imputation_rate=imputed / expected if expected else 0.0,
            by_rule=by_rule,
            missing_by_reason=missing,
        )

    def provenance(self, date: str) -> str:
        """REAL only when every usable quote behind the day is REAL."""
        obs = [o for o in self.observations_on(date) if o.usable]
        return "REAL" if obs and all(o.provenance == "REAL" for o in obs) else "SIMULATED"

    # ------------------------------------------------------------ attribution
    def fuel_share_of_change(self, date: str) -> float:
        """Share of the day's move attributed to jet fuel: from the day-on-day change in the
        observed fuel-surcharge-to-base ratio (an ATF price feed replaces this later)."""

        def ratio(d: str) -> float | None:
            obs = [o for o in self.observations_on(d) if o.usable]
            vals = [o.components["fuel_surcharge_paise"] / o.components["base_fare_paise"]  # type: ignore[index]
                    for o in obs if o.components["base_fare_paise"] > 0]  # type: ignore[index]
            return sum(vals) / len(vals) if vals else None

        now, before = ratio(date), ratio(add_days(date, -1))
        if now is None or before is None:
            return 0.05
        return min(0.6, max(0.05, abs(now - before) * 30))

    def attribution(self, date: str, m: Measure) -> tuple[float, dict[str, list[Contribution]]]:
        prev = add_days(date, -1)
        route: dict[str, float] = {}
        window: dict[str, float] = {}
        carrier: dict[str, float] = {c.code: 0.0 for c in self.carriers}
        component: dict[str, float] = {"base": 0.0, "fuel": 0.0, "airport": 0.0, "gst": 0.0, "platform": 0.0}
        fuel_share = self.fuel_share_of_change(date)

        for r in self.routes:
            for k in WINDOWS:
                now = self.cell_value(date, r.route_id, k, m).value
                before = self.cell_value(prev, r.route_id, k, m).value
                base_val = self.cell_value(self.base_date, r.route_id, k, m).value
                delta = (100 * self.route_weight[r.route_id] * WINDOW_WEIGHT[k] * (now - before)) / base_val
                route[r.route_id] = route.get(r.route_id, 0.0) + delta
                window[k] = window.get(k, 0.0) + delta

                now_obs = [o for o in self.cell_observations(date, r.route_id, k) if o.usable]
                prev_obs = [o for o in self.cell_observations(prev, r.route_id, k) if o.usable]

                def log_share(obs: list[Obs], code: str) -> float:
                    if not obs:
                        return 0.0
                    s = 0.0
                    for o in obs:
                        if o.carrier_code == code:
                            s += math.log(measure_of(o.components, m))  # type: ignore[arg-type]
                    return s / len(obs)

                parts = {c.code: log_share(now_obs, c.code) - log_share(prev_obs, c.code) for c in self.carriers}
                for code, v in split_by(delta, parts).items():
                    carrier[code] += v

                if m == "base":
                    component["base"] += delta
                else:
                    def mean(obs: list[Obs], f: Callable[[dict[str, int]], int]) -> float:
                        if not obs:
                            return 0.0
                        s = 0.0
                        for o in obs:
                            s += f(o.components)  # type: ignore[arg-type]
                        return s / len(obs)

                    def d(f: Callable[[dict[str, int]], int]) -> float:
                        return mean(now_obs, f) - mean(prev_obs, f)

                    by_component = split_by(delta, {
                        "base": d(lambda c: c["base_fare_paise"]),
                        "fuel": d(lambda c: c["fuel_surcharge_paise"]),
                        "airport": d(lambda c: c["udf_paise"] + c["psf_paise"]),
                        "gst": d(lambda c: c["gst_paise"]),
                        "platform": d(lambda c: c["platform_fee_paise"]),
                    })
                    for key, value in by_component.items():
                        component[key] += value

        total = 0.0
        for v in route.values():
            total += v
        route_label = {r.route_id: r.label for r in self.routes}
        carrier_label = {c.code: c.label for c in self.carriers}

        def listing(rec: dict[str, float], name: Callable[[str], str] | None = None) -> list[Contribution]:
            return [Contribution(key, name(key) if name else key, v) for key, v in rec.items()]

        axes = {
            "route": listing(route, route_label.__getitem__),
            "window": listing(window),
            "carrier": listing(carrier, carrier_label.__getitem__),
            "component": listing(component, COMPONENT_LABELS.__getitem__),
            "driver": [
                Contribution("fuel", "Jet fuel (ATF) cost", total * fuel_share),
                Contribution("demand", "Demand", total * (1 - fuel_share)),
            ],
        }
        return total, axes

    # ------------------------------------------------------------ route aggregates
    def route_day(self, route: str, date: str) -> dict[str, int]:
        """ω-weighted daily component aggregate for one route (arithmetic mean per window)."""
        out: dict[str, float] = {k: 0 for k in COMPONENT_KEYS}
        for w in WINDOWS:
            obs = [o for o in self.cell_observations(date, route, w)
                   if o.available and o.validation_status == "VALID" and o.components is not None]
            if not obs:
                continue
            for k in COMPONENT_KEYS:
                s = 0
                for o in obs:
                    s = s + o.components[k]  # type: ignore[index]
                out[k] += WINDOW_WEIGHT[w] * (s / len(obs))
        result = {k: js_round(out[k]) for k in COMPONENT_KEYS}
        total = 0
        for k in COMPONENT_KEYS:
            total += result[k]
        result["total_payable_paise"] = total
        return result

    def lead_time_cells(self, date: str) -> list[dict]:
        cells = []
        for r in self.routes:
            for w in WINDOWS:
                obs = self.cell_observations(date, r.route_id, w)
                c = self.cell_value(date, r.route_id, w, "total")
                reason = next((o.missing_reason for o in obs if o.missing_reason), None) or "UNKNOWN"
                cells.append({
                    "route_id": r.route_id,
                    "window": w,
                    "total_fare_paise": None if c.imputed else js_round(c.value),
                    "missing_reason": reason if c.imputed else None,
                })
        return cells


def success_rate(observations: Iterable[Obs], source: str, dates: set[str]) -> float:
    obs = [o for o in observations if o.source == source and o.search_date in dates]
    return sum(1 for o in obs if o.available) / len(obs) if obs else 0.0
