"""/export/*: the published index family as CSV or SDMX-JSON."""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, Response

from ...core.config import get_settings
from ...econometrics.basket import SERIES
from ...services.published import PublishedIndex, quality_status
from ..deps import now_iso, published

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/csv", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
def export_csv(pub: PublishedIndex = Depends(published)):
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["date", *SERIES, "drip_gap_points", "provenance", "coverage", "imputation_rate",
                     "quality_status", "vintage", "methodology_version"])
    for d in pub.dates:
        afi = pub.by_series["AFI"][d]
        values = [pub.get(s, d) for s in SERIES]
        tct = pub.get("TCT-AFI", d)
        writer.writerow([
            d, *[f"{v.value:.4f}" if v else "" for v in values],
            f"{tct.value - afi.value:.4f}" if tct else "", afi.provenance, f"{afi.coverage:.4f}",
            f"{afi.imputation_rate:.4f}", quality_status(afi.coverage), afi.vintage, afi.methodology_version,
        ])
    return Response(
        buf.getvalue(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="aerofarex-index-family.csv"'},
    )


@router.get("/sdmx")
def export_sdmx(pub: PublishedIndex = Depends(published)):
    """SDMX-JSON 2.0 data message: one series per index, observations keyed by day."""
    days = pub.dates
    series = {}
    for i, name in enumerate(s for s in SERIES if s in pub.by_series):
        points = pub.by_series[name]
        series[f"{i}"] = {
            "observations": {
                str(t): [points[d].value, 0 if points[d].provenance == "REAL" else 1]
                for t, d in enumerate(days) if d in points
            }
        }
    body = {
        "meta": {"schema": "https://json.sdmx.org/2.0.0/sdmx-json-data-schema.json", "id": "AEROFAREX-AFI",
                 "prepared": now_iso(), "sender": {"id": "AEROFAREX", "name": "AeroFareX"}},
        "data": {
            "structures": [{
                "name": "AeroFareX airfare price indices (base " + get_settings().base_date + " = 100)",
                "dimensions": {
                    "series": [{"id": "INDEX", "name": "Index", "values": [{"id": s} for s in SERIES if s in pub.by_series]}],
                    "observation": [{"id": "TIME_PERIOD", "name": "Day", "values": [{"id": d} for d in days]}],
                },
                "attributes": {"observation": [{"id": "PROVENANCE", "name": "Provenance",
                                                "values": [{"id": "REAL"}, {"id": "SIMULATED"}]}]},
            }],
            "dataSets": [{"structure": 0, "series": series}],
        },
    }
    return JSONResponse(body, media_type="application/vnd.sdmx.data+json;version=2.0.0")
