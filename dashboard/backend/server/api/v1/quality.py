"""/quality/*: coverage and imputation per published day."""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, Query

from ...econometrics.engine import IndexEngine
from ...schemas.api import CoverageDay, Envelope
from ...services.published import PublishedIndex
from ..deps import DATE_PATTERN, envelope, index_engine, published

router = APIRouter(prefix="/quality", tags=["quality"])


def _coverage(start: str | None, end: str | None, pub: PublishedIndex, eng: IndexEngine) -> dict:
    data = [
        {"date": d, "provenance": pub.by_series["AFI"][d].provenance, **asdict(eng.quality(d))}
        for d in pub.dates
        if (start is None or d >= start) and (end is None or d <= end)
    ]
    return envelope(data, len(data))


@router.get("/coverage", response_model=Envelope[list[CoverageDay]], response_model_exclude_unset=True)
def coverage(from_: str | None = Query(None, alias="from", pattern=DATE_PATTERN),
             to: str | None = Query(None, pattern=DATE_PATTERN),
             pub: PublishedIndex = Depends(published), eng: IndexEngine = Depends(index_engine)):
    return _coverage(from_, to, pub, eng)


@router.get("/imputation", response_model=Envelope[list[CoverageDay]], response_model_exclude_unset=True)
def imputation(from_: str | None = Query(None, alias="from", pattern=DATE_PATTERN),
               to: str | None = Query(None, pattern=DATE_PATTERN),
               pub: PublishedIndex = Depends(published), eng: IndexEngine = Depends(index_engine)):
    """Same records as /coverage; the dashboard reads the by_rule block from here."""
    return _coverage(from_, to, pub, eng)
