"""Read-side of publication: the latest vintage of every published snapshot."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import Engine, select

from ..core.config import get_settings
from ..core.errors import ApiError
from ..models import index_snapshots as snap_t


@dataclass(frozen=True)
class Snapshot:
    snapshot_id: str
    series: str
    date: str
    value: float
    base_period: str
    coverage: float
    imputation_rate: float
    provenance: str
    vintage: int
    methodology_version: str
    calculated_at: str


class PublishedIndex:
    """{series: {date: Snapshot}} using each date's highest vintage."""

    def __init__(self, snapshots: list[Snapshot]) -> None:
        self.by_series: dict[str, dict[str, Snapshot]] = {}
        for s in sorted(snapshots, key=lambda x: (x.series, x.date, x.vintage)):
            self.by_series.setdefault(s.series, {})[s.date] = s
        afi = self.by_series.get("AFI", {})
        self.dates: list[str] = sorted(afi)
        self.latest: str | None = self.dates[-1] if self.dates else None

    def get(self, series: str, date: str) -> Snapshot | None:
        return self.by_series.get(series, {}).get(date)

    def resolve_date(self, date: str | None) -> str:
        """The requested published date, or the latest one when none is given."""
        if self.latest is None:
            raise ApiError(404, "NO_PUBLICATION", "No index has been published yet.")
        if date is None:
            return self.latest
        if date not in self.by_series.get("AFI", {}):
            raise ApiError(404, "DATE_OUT_OF_RANGE", f"No published index for {date}.")
        return date

    def provenance_boundary(self) -> str | None:
        """First date from which every published day is REAL (charts draw a rule here)."""
        boundary = None
        for d in reversed(self.dates):
            if self.by_series["AFI"][d].provenance != "REAL":
                break
            boundary = d
        return boundary

    def quality(self, date: str, series: str = "AFI") -> dict:
        s = self.get(series, date) or self.by_series["AFI"][date]
        return quality_meta(s, is_provisional=date == self.latest)


def quality_status(coverage: float) -> str:
    return "GOOD" if coverage >= 0.9 else "SERIOUS" if coverage >= 0.8 else "CRITICAL"


def quality_meta(s: Snapshot, is_provisional: bool) -> dict:
    return {
        "coverage": s.coverage,
        "imputation_rate": s.imputation_rate,
        "provenance": s.provenance,
        "vintage": s.vintage,
        "is_provisional": is_provisional,
        "methodology_version": s.methodology_version,
        "quality_status": quality_status(s.coverage),
    }


def load_published(db: Engine) -> PublishedIndex:
    with db.connect() as conn:
        rows = conn.execute(select(snap_t)).all()
    return PublishedIndex([
        Snapshot(r.snapshot_id, r.index_name, r.index_date, r.value, r.base_period, r.coverage_ratio,
                 r.imputation_ratio, r.provenance, r.vintage, r.methodology_version, r.calculated_at)
        for r in rows
    ])


def base_period() -> str:
    return get_settings().base_date
