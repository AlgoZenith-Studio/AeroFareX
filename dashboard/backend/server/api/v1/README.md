# server/api/v1

One router per TRD Part D resource group, all behind the analyst role check: `index.py`
(latest, history, family, attribution, vintages), `routes.py`, `observations.py`,
`lead_time.py`, `quality.py`, `health.py` (health, sources), `methodology.py`, `export.py`
(csv, sdmx).
