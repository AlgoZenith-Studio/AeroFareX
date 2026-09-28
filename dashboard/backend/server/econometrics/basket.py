"""Methodology constants: advance windows and the booking curve (TRD Part B §1, §3)."""
from __future__ import annotations

from typing import Literal

Window = Literal["T+1", "T+7", "T+15", "T+30", "T+45"]
Measure = Literal["base", "total"]
Series = Literal["AFI", "TCT-AFI", "ANC-AFI"]

WINDOWS: tuple[Window, ...] = ("T+1", "T+7", "T+15", "T+30", "T+45")
WINDOW_DAYS: dict[str, int] = {"T+1": 1, "T+7": 7, "T+15": 15, "T+30": 30, "T+45": 45}
DAYS_WINDOW: dict[int, str] = {v: k for k, v in WINDOW_DAYS.items()}

# Booking-curve weights ω_k (offer-to-transaction correction). Sum = 1.
WINDOW_WEIGHT: dict[str, float] = {"T+1": 0.1, "T+7": 0.22, "T+15": 0.35, "T+30": 0.23, "T+45": 0.1}

# AFI tracks the base fare; TCT-AFI the total cost to the traveller.
SERIES_MEASURE: dict[str, Measure] = {"AFI": "base", "TCT-AFI": "total"}
SERIES: tuple[Series, ...] = ("AFI", "TCT-AFI", "ANC-AFI")

COMPONENT_KEYS = (
    "base_fare_paise", "fuel_surcharge_paise", "udf_paise", "psf_paise", "gst_paise", "platform_fee_paise",
)
COMPONENT_LABELS: dict[str, str] = {
    "base": "Base fare",
    "fuel": "Fuel surcharge",
    "airport": "Airport fees (UDF/PSF)",
    "gst": "GST",
    "platform": "Platform fee",
}
MISSING_REASONS = (
    "SOLD_OUT", "NO_FLIGHT", "MISSING_SOURCE", "SOURCE_ERROR", "PARSER_ERROR", "BLOCKED", "UNKNOWN",
)
IMPUTATION_RULES = ("CROSS_SOURCE", "CELL_MEAN", "CARRY_FORWARD", "EXCLUDED")
ANCILLARY_ITEMS = ("SEAT", "BAG", "MEAL")
