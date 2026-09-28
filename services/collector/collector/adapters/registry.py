"""Which adapter serves which source, and which sources are collected this run."""
from __future__ import annotations

import importlib

from ..config import CollectorSettings
from .base import Adapter
from .sources import AirIndia, Akasa, IndiGo, MakeMyTrip, SpiceJet

ADAPTERS: dict[str, type[Adapter]] = {
    cls.source_id: cls for cls in (IndiGo, AirIndia, Akasa, SpiceJet, MakeMyTrip)
}


def _load(path: str) -> type[Adapter]:
    module, _, name = path.partition(":")
    cls = getattr(importlib.import_module(module), name)
    if not (isinstance(cls, type) and issubclass(cls, Adapter)):
        raise TypeError(f"{path} is not an Adapter")
    return cls


def adapter_class(source_id: str, settings: CollectorSettings) -> type[Adapter]:
    if source_id in settings.adapter_overrides:
        return _load(settings.adapter_overrides[source_id])
    try:
        return ADAPTERS[source_id]
    except KeyError:
        raise KeyError(f"no adapter for source {source_id!r}") from None


def enabled_adapters(settings: CollectorSettings) -> tuple[list[Adapter], list[str]]:
    """(adapters to run, notes about enabled sources that were skipped)."""
    run, notes = [], []
    for source_id in settings.enabled_sources:
        try:
            cls = adapter_class(source_id, settings)
        except KeyError as exc:
            notes.append(str(exc))
            continue
        if not cls.configured:
            notes.append(f"{source_id}: enabled but its adapter isn't configured yet")
            continue
        run.append(cls())
    return run, notes
