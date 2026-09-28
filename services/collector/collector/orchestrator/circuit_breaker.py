"""
Circuit breaker per source: HEALTHY -> DEGRADED -> OPEN -> RECOVERING -> HEALTHY.

  * a BLOCKED answer (403/429/robots.txt refusal) opens the circuit at once: the source
    said no, so we stop and seek a data agreement (decision D7) instead of retrying
  * a run where nothing succeeded counts as a failure; `threshold` in a row opens it
  * a run with some failures (success ratio under `degraded_below`) is DEGRADED
  * an OPEN source is skipped until `cooldown` passes, then gets one RECOVERING trial;
    a failed trial re-opens it
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta


@dataclass(frozen=True)
class Circuit:
    source_id: str
    state: str = "HEALTHY"
    consecutive_failures: int = 0
    opened_at: str | None = None
    last_success_at: str | None = None


def should_run(c: Circuit, now: datetime, cooldown: timedelta) -> tuple[bool, Circuit]:
    """(run this source now?, circuit to use for the run)."""
    if c.state != "OPEN":
        return True, c
    if c.opened_at and datetime.fromisoformat(c.opened_at.replace("Z", "+00:00")) + cooldown > now:
        return False, c
    return True, replace(c, state="RECOVERING")


def after_run(c: Circuit, ok: int, total: int, blocked: bool, now_iso: str, *, threshold: int,
              degraded_below: float) -> Circuit:
    if total == 0:
        return c
    if blocked:
        return replace(c, state="OPEN", consecutive_failures=c.consecutive_failures + 1, opened_at=now_iso)
    if ok == 0:
        failures = c.consecutive_failures + 1
        if c.state == "RECOVERING" or failures >= threshold:
            return replace(c, state="OPEN", consecutive_failures=failures, opened_at=now_iso)
        return replace(c, state="DEGRADED", consecutive_failures=failures)
    state = "DEGRADED" if ok / total < degraded_below else "HEALTHY"
    return replace(c, state=state, consecutive_failures=0, opened_at=None, last_success_at=now_iso)
