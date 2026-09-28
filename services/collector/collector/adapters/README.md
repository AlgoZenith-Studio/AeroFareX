# adapters

One adapter per source: `indigo`, `air_india`, `akasa`, `spicejet`, `makemytrip`. An adapter
builds the source's own fare request (`build_requests`) and reads its answer (`parse`); the
pipeline does everything else, so every source gets the same etiquette and audit trail.

| File | What |
| :--- | :--- |
| `base.py` | The contract: `FareQuery`, `FareRequest`, `RawResponse`, `ParsedFare`, `Adapter` |
| `sources.py` | The five basket adapters. **All `configured = False`** until their endpoint is found and permission confirmed; the setup checklist is in the module docstring |
| `registry.py` | Source id -> adapter; `ENABLED_SOURCES` picks which run |

Each adapter is versioned (`adapter_version`, recorded on every observation) and declares its
`fetch_tier` (`HTTP` / `DYNAMIC` / `BROWSER`). Put 3–5 real responses per source under
`fixtures/<source>/` and test `parse` against them before enabling it.
