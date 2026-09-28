"""In-process response cache and per-IP rate limit for the public API (TRD Part D §1)."""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Callable


class TTLCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: dict[str, tuple[float, Any]] = {}

    def get_or_set(self, key: str, ttl: float, produce: Callable[[], Any]) -> Any:
        now = time.monotonic()
        with self._lock:
            hit = self._items.get(key)
            if hit and hit[0] > now:
                return hit[1]
        value = produce()
        with self._lock:
            self._items[key] = (now + ttl, value)
            if len(self._items) > 2048:  # bound memory: drop expired, then oldest
                for k in [k for k, (exp, _) in self._items.items() if exp <= now] or list(self._items)[:512]:
                    self._items.pop(k, None)
        return value

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


class RateLimiter:
    """Sliding one-minute window per client key."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, per_minute: int) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and q[0] <= now - 60:
                q.popleft()
            if len(q) >= per_minute:
                return False
            q.append(now)
            if len(self._hits) > 10000:
                for k in [k for k, v in self._hits.items() if not v]:
                    self._hits.pop(k, None)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


cache = TTLCache()
limiter = RateLimiter()
