"""Collection / publication times (TRD Part A: 02:30 · 05:30 · 13:00 · 19:00 IST, publish ~20:00 IST)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def iso_ms(dt: datetime) -> str:
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def next_at(times: list[str], now: datetime | None = None) -> datetime:
    """The next occurrence of any HH:MM (IST) after `now`."""
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(IST).date()
    for offset in range(0, 3):
        day = today + timedelta(days=offset)
        for t in sorted(times):
            h, m = (int(x) for x in t.split(":"))
            at = datetime(day.year, day.month, day.day, h, m, tzinfo=IST)
            if at > now:
                return at
    raise ValueError("no schedule times configured")


def last_at(times: list[str], now: datetime | None = None) -> datetime:
    """The most recent occurrence of any HH:MM (IST) at or before `now`."""
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(IST).date()
    for offset in range(0, 3):
        day = today - timedelta(days=offset)
        for t in sorted(times, reverse=True):
            h, m = (int(x) for x in t.split(":"))
            at = datetime(day.year, day.month, day.day, h, m, tzinfo=IST)
            if at <= now:
                return at
    raise ValueError("no schedule times configured")


def ist_today(now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(IST).date()
