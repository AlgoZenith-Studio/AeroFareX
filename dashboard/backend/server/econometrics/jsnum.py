"""JavaScript number semantics needed for bit-exact parity with the TypeScript spec."""
from __future__ import annotations

import math
from datetime import date, timedelta


def js_round(x: float) -> int:
    """Math.round: halves round towards +infinity (Python's round() is banker's)."""
    floor = math.floor(x)
    return floor + 1 if x - floor >= 0.5 else floor


def add_days(iso: str, days: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=days)).isoformat()


def is_weekend(iso: str) -> bool:
    return date.fromisoformat(iso).weekday() >= 5
