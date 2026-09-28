# dashboard/backend — `aerofarex-core`

The one backend service (TRD Part A/H, decisions D1/D2): FastAPI + SQLite, the index engine,
the analyst API, the public API (mounted from `landing/backend`), and the scheduler that runs
the collector (`services/collector`) and publishes the index.

## Run it

```bash
uv sync --all-packages                 # from the repo root: .venv with all backend packages
uv run aerofarex seed-demo             # dev only: load the dashboard's 30-day demo data, publish it
uv run aerofarex serve --reload        # http://localhost:8000/docs
uv run pytest                          # every backend + collector test
```

To point the dashboard at it: `dashboard/frontend/.env.local` → `NEXT_PUBLIC_USE_MOCK=false`, and
for local preview without Firebase set `AUTH_DEV_ROLE=ADMIN` in `dashboard/backend/.env.local`.

## Commands

| Command | What |
| :--- | :--- |
| `aerofarex migrate` | Apply `infra/db/migrations/*.sql` not yet applied |
| `aerofarex seed-demo` | Load the demo seed and publish all 30 days. Refused in production and on a database with collected data |
| `aerofarex publish [--date D]` | Publish D (default: today IST) as a new vintage; refuses a day with no usable quotes or an incomplete base period |
| `aerofarex serve` | Run the API |
| `python -m collector.orchestrator.run --slot 19:00` | One collection run (the scheduler does this at each slot) |

## Layout

| Folder | What |
| :--- | :--- |
| `server/core` | Settings, Firebase token + role check, error envelope |
| `server/db` | SQLite engine (WAL, foreign keys, busy timeout) and the migration runner |
| `server/models` | SQLAlchemy Core tables mirroring the migrations |
| `server/econometrics` | Jevons cells, Laspeyres index, booking curve, quality, attribution, IQR outliers |
| `server/services` | Dataset loading + cache, publication (vintages), schedule, scheduler |
| `server/api/v1` | Analyst routers, one per TRD Part D resource |
| `server/schemas` | Pydantic mirrors of `packages/shared-types` |
| `server/seed` | The dashboard demo seed, ported bit-for-bit from `seed.ts` |
| `tests` | Schema guarantees, maths, auth/errors/contract, and parity with the mock |

## How we know it matches the mock

`tests/parity/export_mock.mjs` runs the dashboard's TypeScript mock and the landing fare mock
and writes their responses to `tests/fixtures/mock_parity.json`; `tests/test_parity.py` checks
the API against it endpoint by endpoint (relative tolerance 1e-12). Regenerate the fixture
with `node dashboard/backend/tests/parity/export_mock.mjs` whenever the mock changes.
Intended differences: ANC-AFI (< 0.001 points, integer-paise storage), the attribution
`driver` split (observed fuel share instead of the mock's hidden series), and seeded `raw_id`s
(the mock's collide).
