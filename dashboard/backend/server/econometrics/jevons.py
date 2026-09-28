"""Elementary aggregation: the Jevons (unweighted geometric) mean of a cell's fares (TRD Part B §2)."""
from __future__ import annotations

import math
from typing import Iterable


def geo_mean(values: Iterable[float]) -> float:
    total = 0.0
    n = 0
    for v in values:
        if v <= 0:
            raise ValueError("Jevons mean needs strictly positive prices")
        total += math.log(v)
        n += 1
    if n == 0:
        raise ValueError("Jevons mean of an empty cell")
    return math.exp(total / n)
