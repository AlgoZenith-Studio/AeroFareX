# landing/backend

The public read-only API (`/api/v1/public/*`, TRD Part D §1), package `public_api`. It has no
server of its own: `aerofarex-core` mounts it next to the analyst API (decision D2), and it
reads the same published snapshots.

| Endpoint | What |
| :--- | :--- |
| `GET /api/v1/public/latest?series=AFI\|TCT-AFI` | Headline value, day-on-day change, drip-pricing gap, quality block |
| `GET /api/v1/public/methodology` | Plain-language methodology |
| `GET /api/v1/public/routes/summary` | Advertised vs total fare per route, latest day |
| `GET /api/v1/public/fares/search?from=DEL&to=BOM&date=YYYY-MM-DD` | Flights × platforms for `/fares`; `404 ROUTE_NOT_TRACKED` for other routes |

No sign-in. Responses are cached in-process and sent with `Cache-Control: public, max-age=…`;
each client IP gets `PUBLIC_RATE_LIMIT_PER_MINUTE` requests a minute (`429 RATE_LIMITED`).

**Fare search is sample data** (`"sample": true` on every response): a bit-exact port of the
landing mock (`landing/frontend/src/data/fares.ts`), so `/fares` can switch to it with identical
output. It becomes real once the collector has flight-level offers from every platform.

| File | What |
| :--- | :--- |
| `public_api/router.py` | The four endpoints, cache, rate limit |
| `public_api/fares.py` | Fare search (sample) |
| `public_api/schemas.py` | Response models; TS mirrors are the `Public*` types in `packages/shared-types` |
| `public_api/guard.py` | TTL cache and per-IP rate limiter |
