# tests

`uv run pytest` from the repo root.

| File | What |
| :--- | :--- |
| `test_schema.py` | Append-only triggers, add-up CHECK, missing-reason CHECK, idempotent migrations |
| `test_econometrics.py` | Jevons, Laspeyres weights, carry-forward, exclusions, attribution reconciles |
| `test_parity.py` | Every analyst endpoint vs the TypeScript mock's own output (`fixtures/mock_parity.json`) |
| `test_api.py` | Auth on every route, error envelope, contract field names vs shared-types, vintages, exports, public API |

Regenerate the parity fixture after changing the mock: `node dashboard/backend/tests/parity/export_mock.mjs`.
