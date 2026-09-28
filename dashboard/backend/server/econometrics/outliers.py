"""
Outlier screening (TRD Part B / collector pipeline): 1.5 × IQR per route-window cell.
Outliers are FLAGGED and kept (never deleted), and excluded from the index.
"""
from __future__ import annotations

import math
from typing import Sequence


def _quantile(sorted_values: Sequence[float], q: float) -> float:
    """Linear interpolation between order statistics (numpy's default 'linear' method)."""
    pos = (len(sorted_values) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)


def iqr_flags(prices: Sequence[float], multiplier: float = 1.5, min_n: int = 4) -> list[bool]:
    """True where a price lies outside [Q1 − m·IQR, Q3 + m·IQR], screened on log prices.

    Fares are right-skewed (T+1 can be 3× T+45), so the fence is set on log prices.
    Cells with fewer than `min_n` quotes are not screened: the quartiles mean nothing.
    """
    if len(prices) < min_n:
        return [False] * len(prices)
    logs = [math.log(p) for p in prices]
    ordered = sorted(logs)
    q1 = _quantile(ordered, 0.25)
    q3 = _quantile(ordered, 0.75)
    iqr = q3 - q1
    lo, hi = q1 - multiplier * iqr, q3 + multiplier * iqr
    return [not (lo <= v <= hi) for v in logs]
