# services/collector

Data collection for AeroFareX: declared, identifiable, rate-limited, never clandestine
(TRD Part A/H, decisions D6/D7). Runs at 02:30 · 05:30 · 13:00 · 19:00 IST, started by the
scheduler inside `aerofarex-core`.

```
plan ─► fetch (Scrapy, orchestrator/spider.py) ─► raw archive (SHA-256 + batch hash chain)
     ─► parse (adapter) ─► validate (add-up · IQR outliers · phantom fares) ─► SQLite
     ─► circuit breaker + health (source_health, collection_runs, Firestore)
```

| Folder | What |
| :--- | :--- |
| `collector/adapters/` | One adapter per source. **None is configured yet**: see the checklist in `adapters/sources.py` |
| `collector/orchestrator/` | Run entry point, the Scrapy spider (all etiquette), circuit breaker |
| `collector/pipeline/` | Parse, validate, load |
| `collector/storage/` | Raw payload archive (local dir or Firebase Storage), append-only |
| `collector/monitoring/` | Firestore health push |
| `tests/` | End-to-end runs against a local test server (never a real site) |

```bash
# one manual run (does nothing until a source is enabled AND its adapter configured)
ENABLED_SOURCES=indigo uv run python -m collector.orchestrator.run --slot manual
```

Settings: `services/collector/.env.example`. HTML-only sources would use Scrapling selectors
inside `parse`, and session-only sources a Playwright step to obtain cookies; neither is
needed until such a source is approved.
