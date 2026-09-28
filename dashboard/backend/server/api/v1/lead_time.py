"""/lead-time/matrix: total fare per route × advance window, with the booking-curve weights."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ...econometrics.basket import WINDOW_WEIGHT, WINDOWS
from ...econometrics.engine import IndexEngine
from ...schemas.api import Envelope, LeadTimeMatrix
from ...services.published import PublishedIndex
from ..deps import date_query, envelope, index_engine, published

router = APIRouter(prefix="/lead-time", tags=["lead-time"])


@router.get("/matrix", response_model=Envelope[LeadTimeMatrix], response_model_exclude_unset=True)
def lead_time_matrix(date: str | None = date_query(), pub: PublishedIndex = Depends(published),
                     eng: IndexEngine = Depends(index_engine)):
    day = pub.resolve_date(date)
    provenance = pub.by_series["AFI"][day].provenance
    cells = [dict(c, provenance=provenance) for c in eng.lead_time_cells(day)]
    return envelope({"date": day, "windows": list(WINDOWS), "weights": dict(WINDOW_WEIGHT), "cells": cells})
