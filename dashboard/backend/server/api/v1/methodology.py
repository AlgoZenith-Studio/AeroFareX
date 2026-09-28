"""/methodology: the rules the published numbers were computed with (TRD Part B)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ...core.config import get_settings
from ...econometrics.basket import WINDOW_WEIGHT
from ...econometrics.engine import IndexEngine
from ...schemas.api import Envelope, Methodology
from ..deps import envelope, index_engine

router = APIRouter(tags=["methodology"])


def methodology(eng: IndexEngine) -> dict:
    s = get_settings()
    return {
        "methodology_version": s.methodology_version,
        "base_period": s.base_date,
        "formula": "AFI_t = 100 × Σ_r W_r × Σ_k ω_k × P(r,k,t) / P(r,k,0)  (Laspeyres, DGCA route weights W_r, "
                   "booking-curve window weights ω_k). TCT-AFI uses the total payable fare; AFI the base fare.",
        "elementary_aggregate": "P(r,k,t) is the Jevons (unweighted geometric) mean of valid quotes for route r, "
                                "advance window k, on search day t.",
        "route_weights": [{"key": r.route_id, "label": r.label, "weight": eng.route_weight[r.route_id]} for r in eng.routes],
        "window_weights": [{"key": k, "label": k, "weight": w} for k, w in WINDOW_WEIGHT.items()],
        "outlier_rule": f"Quotes outside {s.outlier_iqr_multiplier} × IQR of log fares in their route-window cell are "
                        "FLAGGED, kept for audit, and excluded from the index.",
        "imputation_rules": {
            "CROSS_SOURCE": "Missing quote in a cell with two or more valid quotes from other sources.",
            "CELL_MEAN": "Missing quote in a cell with exactly one valid quote.",
            "CARRY_FORWARD": "Cell with no valid quote: the previous day's cell value is carried forward.",
            "EXCLUDED": "Flagged outlier, excluded from aggregation.",
        },
        "attribution": "ΔI is decomposed additively by route, carrier, advance window, fare component and driver; "
                       f"every axis must sum to ΔI within {s.attribution_reconciliation_tolerance} (reconciled).",
        "quality_thresholds": {"GOOD": "coverage ≥ 90%", "SERIOUS": "coverage 80–90%", "CRITICAL": "coverage < 80%"},
        "notes": [
            "Money is stored as integer paise; ₹ formatting happens only at display.",
            "Published values are never edited: a revision is a new vintage (see /index/vintages/{date}).",
            "The driver split (fuel vs demand) uses the day-on-day change in the observed fuel-surcharge share "
            "until an ATF price feed is connected.",
            "Monthly chaining of route weights applies from the second month of live data; until then the base "
            "is fixed at the base period.",
        ],
    }


@router.get("/methodology", response_model=Envelope[Methodology], response_model_exclude_unset=True)
def get_methodology(eng: IndexEngine = Depends(index_engine)):
    return envelope(methodology(eng))
