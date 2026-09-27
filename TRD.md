# AeroFareX: Real-time Airfare Price Index for India
## Technical Requirements & Build Specification Document (TRD) · Version 2.2
**Project:** AeroFareX  
**Companions:** AeroFareX PRD v2.2 · `Project_context.md` (living build log, read it first)  
**Last updated:** 2026-09-28

> **What changed in v2.2:** database is **SQLite** (not PostgreSQL/TimescaleDB); backend runs as **one Railway service**; frontends and identity on **Firebase**; the analyst dashboard has **one role (analyst)**; the landing site gained a **public fare checker with optional traveller accounts**; the collector stack is **Scrapy + Scrapling** with a browser only where a source requires a session. Sections below are updated accordingly; Part B (methodology) is unchanged.

**Stack Architecture:**
- **Public Landing Site (`landing/`):**
  - **Frontend (`landing/frontend`):** Vite 8 + React 19 + React Router 7, TypeScript, plain CSS bound to `packages/design-tokens` (no Tailwind here), Three.js 3D hero aircraft, Lenis smooth scroll. Pages: `/` (home), `/fares` (fare checker), `/account` (traveller profile). Firebase Auth + Firestore for optional traveller accounts.
  - **Backend:** the public read-only API (`/api/v1/public/*`) is a router inside the single backend service (see Part H). `landing/backend` holds its code package.
- **Analyst Platform (`dashboard/`):**
  - **Frontend (`dashboard/frontend`):** Next.js 16 App Router (`src/app`, static export), React 19, TypeScript, Tailwind CSS v4 with the design-token preset, TanStack Query, hand-built SVG charts (d3-scale / d3-shape), Firebase Auth (analyst role claim). Runs fully on mock data via `NEXT_PUBLIC_USE_MOCK=true`.
  - **Backend (`dashboard/backend/server`):** FastAPI (Python 3.11+), Pydantic v2, NumPy/Pandas/SciPy/Statsmodels, SQLAlchemy (SQLite), Firebase Admin SDK for token verification. Deployed as routers of the single backend service.
- **Data & Ingestion Engine (`services/collector`):** Python; Scrapy (scheduling conventions, per-domain rate limits, retries, pipelines) + Scrapling selectors for HTML-only sources; plain-HTTP replay of each source's own fare request wherever permitted; Playwright only to obtain a session for sources that require one. Declared, rate-limited, never evasive (3.5 s jittered delay, circuit breakers).
- **Data stores:** SQLite (WAL mode, STRICT tables, append-only triggers) on a Railway volume, backed up by Railway volume backups + Litestream to Firebase Storage; Firebase Cloud Storage for raw artifacts (append-only, hashed); Cloud Firestore for live collector health and traveller data.
- **Hosting:** Firebase Hosting (both frontends) · Railway (one backend service `aerofarex-core`).

---

## Part A · System Architecture & Tech Stack

```
                 Public travellers                          Analysts (NSO · RBI · DGCA · MoCA)
                        │                                                 │
                        ▼                                                 ▼
   ┌──────────────────────────────────────┐        ┌──────────────────────────────────────────┐
   │ landing/frontend  (Firebase Hosting)  │        │ dashboard/frontend  (Firebase Hosting)    │
   │  /         home, 3D hero, index story │        │  Next.js 16 static export                 │
   │  /fares    fare checker (5 free       │ Analyst│  Overview · Attribution · Routes ·        │
   │            guest searches, then sign) │ access │  Lead time · Quality · Source health ·    │
   │  /account  history, saved routes,     ├───────►│  Methodology                              │
   │            delete data / account      │ link   │  Login + "Request access" (pending until  │
   └───────────┬──────────────────┬────────┘        │  an admin grants the analyst role)        │
               │ REST (public)    │ Firebase Auth   └──────┬───────────────────┬───────────────┘
               │                  │ + Firestore            │ REST + Bearer JWT │ Firebase Auth
               ▼                  ▼ users/{uid}/…          ▼ (role=ANALYST)    ▼ Firestore health
   ┌─────────────────────────────────────────────────────────────────────────────────────────┐
   │ Railway service "aerofarex-core"  (FastAPI, single instance, volume at /data)             │
   │   /api/v1/public/*   public, cached, read-only                                           │
   │   /api/v1/*          analyst routers, Firebase token + role check on every request       │
   │   scheduler (APScheduler, Asia/Kolkata): collect 02:30 · 05:30 · 13:00 · 19:00 IST,      │
   │                                          publish index ~20:00 IST                        │
   │   collector: fetch → raw archive → parse → validate → SQLite                             │
   │   /data/aerofarex.db  SQLite (WAL, STRICT, append-only triggers)                          │
   └───────────────┬────────────────────────────────────────────────────┬────────────────────┘
                   │ raw payloads (SHA-256, batch hash chain)             │ health metrics
                   ▼                                                      ▼
        Firebase Cloud Storage (append-only)                   Cloud Firestore (sources/, alerts/)
        + Litestream DB replica / nightly snapshot
```

**Why one backend service:** SQLite is a single file on one Railway volume; a volume attaches to one service only. So the API routers, scheduler and collector run in one process that owns the database. If load ever requires multiple instances, switch `DATABASE_URL` to Postgres (SQLAlchemy keeps this a config change).

---

## Part B · Mathematical & Econometric Methodology

### 1. The Chained DGCA-Weighted Laspeyres Formula
The national headline index **AFI** on day $t$ relative to base period $0$ is computed as:

$$\text{AFI}_t = 100 \times \sum_{r \in R} \left[ W_r \times \sum_{k \in K} \left( \omega_k \times \frac{P_{r,k,t}}{P_{r,k,0}} \right) \right]$$

Where:
* $r \in R$: The 5 representative route sectors ($R = \{\text{DEL-BOM}, \text{DEL-BLR}, \text{BOM-BLR}, \text{DEL-CCU}, \text{BLR-HYD}\}$).
* $W_r$: Normalized official DGCA passenger volume share for route $r$ ($\sum_{r \in R} W_r = 1.0$).
* $k \in K$: Advance booking horizons ($K = \{T+1, T+7, T+15, T+30, T+45\}$).
* $\omega_k$: Empirical booking share allocation (derived from DGCA booking curves; $\sum_{k \in K} \omega_k = 1.0$).
* $P_{r,k,t}$: Elementary cell aggregate (Jevons geometric mean of sanitized fares on day $t$).
* $P_{r,k,0}$: Base period price benchmark (September 2026 = 100).
* **Monthly Chaining:** Links new route shares periodically to prevent long-term basket distortion while restricting chain drift to $< 0.15$.

### 2. Elementary Aggregation (Cell Level)
For every route-window cell $(r, k)$ on day $t$, individual quotes are aggregated using the unweighted geometric mean:
$$P_{r,k,t} = \left( \prod_{i=1}^{N_{r,k,t}} p_{r,k,t,i} \right)^{\frac{1}{N_{r,k,t}}}$$
*Using geometric mean satisfies the axiomatic properties of transitivity and commensurability under IMF/ILO Consumer Price Index Manual standards.*

### 3. Offer-to-Transaction Correction (Booking Curve)
Advertised fares at short horizons ($T+1$) exhibit sharp exponential spikes, but represent minimal passenger volume. The booking curve weights each horizon empirically:
- **$T+1$ (Emergency / Day-before):** $\omega_{T+1} = 0.10$ (or $0.08$)
- **$T+7$ (Short-lead business):** $\omega_{T+7} = 0.22$
- **$T+15$ (Mid-lead leisure/business):** $\omega_{T+15} = 0.35$
- **$T+30$ (Standard advance):** $\omega_{T+30} = 0.23$
- **$T+45$ (Early bird):** $\omega_{T+45} = 0.10$

### 4. Hedonic Quality-Adjustment Regression ($h\text{-1.2}$)
To ensure changes in fare family inclusions (e.g. loss of free baggage, change fees) are not recorded as pure inflation, prices are quality-adjusted:
$$\ln(p_i) = \beta_0 + \sum_{m} \beta_m X_{i,m} + \sum_{\tau} \delta_\tau D_{i,\tau} + \epsilon_i$$
Where $X_{i,m}$ represents characteristic vector $m$ (carrier LCC status, departure time band, baggage allowance kg, refundability flag), and $D_{i,\tau}$ are time dummy coefficients capturing true underlying price movement.

### 5. Movement Attribution Engine (Waterfall Decomposition)
When $\text{AFI}_t$ moves by $\Delta I_t = \text{AFI}_t - \text{AFI}_{t-1}$, the change is decomposed additively:
$$\Delta I_t = \sum_{r \in R} \delta_r = \sum_{c \in C} \delta_c = \sum_{k \in K} \delta_k = \sum_{m \in M} \delta_m = \delta_{\text{fuel}} + \delta_{\text{demand}}$$
* **Reconciliation Constraint:** The API enforces $\left| \sum \delta - \Delta I_t \right| < 10^{-4}$ and flags `reconciled: true`. If the client detects a mismatch, a prominent reconciliation warning is displayed.

---

## Part C · Design Tokens & UI Component Specifications

### 1. Color Palette & Semantic Tokens
**Single source of truth:** `packages/design-tokens/brand.css` (brand palette + semantic roles), with `tokens.css` (dashboard/data-viz layer, imports brand.css), `brand.ts` (TS mirror) and `tailwind-preset.js`. **No colour literal may appear in any component or app stylesheet.** Full guide: `packages/design-tokens/README.md` and `AI_COWORKER/shared_memory/design/DESIGN_SYSTEM.md`.

Brand palette ("Vivid Sky Blue" + black/white):

| Token | Hex | Use |
| :--- | :--- | :--- |
| `--sky-100` | `#f5fdff` | Page canvas, alternating bands |
| `--sky-200` | `#d6f7ff` | Tints, selected states, pale cards |
| `--sky-300` | `#a8eeff` | Borders, secondary marks |
| `--sky-400` | `#6ce2ff` | Editorial band, highlighted card (black text on it) |
| `--sky-500` | `#00ccff` | Primary buttons and fills (black text on it) |
| `--sky-600` | `#0096c7` | **New in v2.2.** Chart lines/marks (sky-500 fails the chart lightness band and is 1.9:1 on white) |
| `--sky-800` | `#00607a` | Blue text/links on light (6.7:1) |
| `--sky-900` | `#002b38` | Rules, labels on sky bands |
| `--ink` / `--black` / `--white` | | Dark base / text / cards |

Data-viz layer (`tokens.css`):
- Categorical slots (fixed entity binding, never recycled): `--slot-1` = `--sky-600` (AFI / IndiGo), `--slot-2` `#eb6834` (TCT-AFI / Air India), `--slot-3` `#1baf7a` (Akasa), `--slot-4` `#eda100` (ANC-AFI / SpiceJet), `--slot-5` `#e87ba4` (MakeMyTrip). Validated with the dataviz palette validator (lightness band, chroma, CVD separation, normal-vision floor).
- Diverging (waterfalls, period change): `--diverge-up` `#d0582a`, `--diverge-down` = `--sky-600`, `--diverge-mid` = `--line-control` (neutral zero).
- Status (never series colours, always icon + label): `--status-good` `#0ca30c`, `--status-warning` `#fab219`, `--status-serious` `#ec835a`, `--status-critical` `#d03b3b`.

Typography (both apps): **AFX Serif** (Anthropic Serif Display Bold) for headings and big numbers, its ExtraBold Italic for emphasis, **Google Sans** for everything else, JetBrains Mono for hashes. Landing hero headline uses Valty (demo licence, confirm before launch).

Dashboard look: pale sky canvas, white 22 px-radius cards, one highlighted sky-400 card with black text, pale sky-200 accent cards, sky-500 primary buttons with black text. Landing look: editorial bands, 1.5 px ruled square panels (`--line-deep`), offset sky-block shadow for "best" items. Both honour fluid type (`clamp`) so the layout scales with browser zoom.

### 2. Seven Non-Negotiable Frontend Rules
1. **No Dual-Axis Charts Anywhere:** Multiple series must share a single Y-axis or be converted into two separate stacked charts.
2. **Fixed Categorical Slot Order:** Colors follow the entity, never the filtered rank. Removing a carrier does not repaint remaining lines.
3. **Neutral Grey Midpoint on Diverging Ramps:** Used only where zero-crossing occurs (waterfalls, period change). Never place a distinct hue at zero.
4. **Accessible Table View on Every Chart:** Every `ChartFrame` provides a toggle switch producing a semantic, sortable `DataTable`.
5. **Mandatory Quality Metadata:** Every published index number is accompanied by a `QualityBadge`. If coverage $< 90\%$, a serious status band is rendered.
6. **Explicit Texture for Simulated Data:** Records with `provenance == SIMULATED` render with a 45° tone-on-tone hatch pattern, and time series draw a `provenance_boundary` rule.
7. **Integer Paise Throughout:** Money values are strictly represented in integer paise ($1\text{ INR} = 100\text{ paise}$) to eliminate float reconciliation glitches.

Every data-bearing component implements five states: **Loading** (skeleton), **Empty** (states why), **Error** (retry, no invented values), **Partial** (coverage < 90% band), **Stale** (older than one publication cycle).

---

## Part D · API Contracts & Endpoint Specifications

Base URL: `/api/v1` (one service, see Part H). All responses follow the standard envelope:
```json
{
  "data": [ ... ],
  "meta": { "page": 1, "page_size": 50, "total": 1284, "generated_at": "2026-09-21T02:47:11Z" }
}
```
Errors: `{ "error", "code", "message", "correlation_id" }`. TypeScript contracts: `packages/shared-types/index.ts` (the dashboard mock layer implements them exactly; the FastAPI Pydantic schemas must match field for field).

### 1. Public Endpoints (no auth, CDN/in-memory cached)
- `GET /api/v1/public/latest?series={AFI|TCT-AFI}`: headline numbers and the drip-pricing gap.
- `GET /api/v1/public/methodology`: plain-language methodology.
- `GET /api/v1/public/routes/summary`: five-route advertised vs total comparison.
- `GET /api/v1/public/fares/search?from=DEL&to=BOM&date=YYYY-MM-DD`: **new in v2.2**, powers `/fares`. Returns flights on the tracked route with one offer per platform (airline site, OTAs), each split into `advertised_paise`, `fuel_paise`, `airport_paise`, `gst_paise`, `platform_paise`, `total_paise`, plus `by_days_ahead` (cheapest total at T+1/7/15/30/45) and `seen_at`. Untracked routes return `404 ROUTE_NOT_TRACKED`. Mock implementation: `landing/frontend/src/data/fares.ts` (`searchFares`).

Traveller history and saved routes are **not** served by this API: the landing site reads/writes them directly in Firestore under `users/{uid}/…`, protected by `infra/firebase/firestore.rules`.

### 2. Analyst Endpoints (Firebase ID token, role `ANALYST` or `ADMIN`)
- `GET /api/v1/index/latest?series={AFI|TCT-AFI|ANC-AFI}&date=`
- `GET /api/v1/index/history?series=AFI,TCT-AFI,ANC-AFI&from=&to=` (includes `provenance_boundary`)
- `GET /api/v1/index/family?date=` (members + `drip_gap_points`, `drip_gap_pct`)
- `GET /api/v1/index/attribution/{date}?series=` (axes: route, carrier, window, component, driver; `reconciled`)
- `GET /api/v1/routes?date=` · `GET /api/v1/routes/{routeId}/fares`
- `GET /api/v1/observations?date=&route=` · `GET /api/v1/observations/{id}` (full audit record: sha256, batch hashes, adapter version, object key)
- `GET /api/v1/lead-time/matrix?date=`
- `GET /api/v1/quality/coverage?from=&to=` · `GET /api/v1/quality/imputation`
- `GET /api/v1/health` · `GET /api/v1/sources`
- `GET /api/v1/methodology` · `GET /api/v1/index/vintages/{date}`
- `GET /api/v1/export/csv` · `GET /api/v1/export/sdmx`

Every analyst request verifies the Firebase ID token server-side and checks `role ∈ {ANALYST, ADMIN}`. Hiding pages in the UI is not a security control.

---

## Part E · Database Schema (SQLite)

SQLite 3 with `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`. All tables `STRICT`. Enums become `CHECK` constraints; timestamps are ISO-8601 UTC text; money is integer paise. Accessed through SQLAlchemy so `DATABASE_URL` can later point at Postgres without code changes. Migrations live in `infra/db/migrations`.

```sql
-- Append-only raw observations (payload itself lives in Firebase Storage)
CREATE TABLE raw_observations (
    raw_id          TEXT PRIMARY KEY,               -- UUID
    run_id          TEXT NOT NULL,
    source          TEXT NOT NULL,
    object_key      TEXT NOT NULL,                  -- gs://aerofarex-raw-observations/...
    sha256          TEXT NOT NULL CHECK (length(sha256) = 64),
    batch_hash      TEXT NOT NULL CHECK (length(batch_hash) = 64),
    prev_batch_hash TEXT,
    adapter_version TEXT NOT NULL,
    fetch_tier      TEXT NOT NULL CHECK (fetch_tier IN ('HTTP','DYNAMIC','BROWSER')),
    fetched_at      TEXT NOT NULL
) STRICT;

CREATE TABLE fare_observations (
    observation_id       TEXT PRIMARY KEY,
    observed_at          TEXT NOT NULL,
    raw_id               TEXT NOT NULL REFERENCES raw_observations(raw_id),
    source               TEXT NOT NULL,
    route_id             TEXT NOT NULL,
    carrier_code         TEXT NOT NULL CHECK (length(carrier_code) = 2),
    flight_number        TEXT,
    departure_datetime   TEXT,
    search_date          TEXT NOT NULL,
    departure_date       TEXT NOT NULL,
    advance_days         INTEGER NOT NULL,
    fare_family          TEXT,
    baggage_allowance_kg INTEGER,
    refundable           INTEGER CHECK (refundable IN (0,1)),
    available            INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)),
    missing_reason       TEXT CHECK (missing_reason IN ('SOLD_OUT','NO_FLIGHT','MISSING_SOURCE','SOURCE_ERROR','PARSER_ERROR','BLOCKED','UNKNOWN')),
    validation_status    TEXT NOT NULL DEFAULT 'VALID' CHECK (validation_status IN ('VALID','INVALID','FLAGGED')),
    provenance           TEXT NOT NULL DEFAULT 'REAL' CHECK (provenance IN ('REAL','SIMULATED')),
    fingerprint          TEXT NOT NULL,
    adapter_version      TEXT NOT NULL
) STRICT;
CREATE INDEX idx_obs_cell ON fare_observations (search_date, route_id, advance_days);

CREATE TABLE fare_components (
    observation_id      TEXT PRIMARY KEY REFERENCES fare_observations(observation_id),
    base_fare_paise     INTEGER NOT NULL CHECK (base_fare_paise >= 0),
    fuel_surcharge_paise INTEGER NOT NULL CHECK (fuel_surcharge_paise >= 0),
    gst_paise           INTEGER NOT NULL CHECK (gst_paise >= 0),
    udf_paise           INTEGER NOT NULL CHECK (udf_paise >= 0),
    psf_paise           INTEGER NOT NULL CHECK (psf_paise >= 0),
    platform_fee_paise  INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_paise >= 0),
    total_payable_paise INTEGER NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'INR',
    CHECK (total_payable_paise = base_fare_paise + fuel_surcharge_paise + gst_paise
                               + udf_paise + psf_paise + platform_fee_paise)
) STRICT;

CREATE TABLE index_snapshots (
    snapshot_id      TEXT PRIMARY KEY,
    index_name       TEXT NOT NULL CHECK (index_name IN ('AFI','TCT-AFI','ANC-AFI')),
    index_date       TEXT NOT NULL,
    value            REAL NOT NULL,
    base_value       REAL NOT NULL DEFAULT 100,
    base_period      TEXT NOT NULL,
    coverage_ratio   REAL NOT NULL,
    imputation_ratio REAL NOT NULL,
    provenance       TEXT NOT NULL CHECK (provenance IN ('REAL','SIMULATED')),
    vintage          INTEGER NOT NULL DEFAULT 1,
    is_provisional   INTEGER NOT NULL DEFAULT 0,
    calculated_at    TEXT NOT NULL,
    UNIQUE (index_name, index_date, vintage)
) STRICT;

-- Append-only guarantee enforced in the database, not only in code
CREATE TRIGGER raw_no_update BEFORE UPDATE ON raw_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER raw_no_delete BEFORE DELETE ON raw_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER obs_no_update BEFORE UPDATE ON fare_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER obs_no_delete BEFORE DELETE ON fare_observations BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER snap_no_update BEFORE UPDATE ON index_snapshots BEGIN SELECT RAISE(ABORT, 'publish a new vintage instead'); END;
```
Revisions are new `vintage` rows, never edits. Other tables (sources, routes, route_weights, carriers, index_contributions, adapter_health, audit_events) follow the same conventions.

**Backups:** Railway volume backups (scheduled) + Litestream continuous replication to Firebase Storage (a GCS bucket) + nightly full snapshot.

---

## Part F · Seed Data & Mock Server Specification

Both frontends run without any backend.

**Dashboard** (`NEXT_PUBLIC_USE_MOCK=true`): implemented in `dashboard/frontend/src/lib/mock/` (`seed.ts` generator, `handlers.ts` endpoint implementations, `controls.ts` test controls). Deterministic seed:
1. **Time span:** 30 days, 2026-08-29 → 2026-09-27; **base date 2026-09-01 = 100**.
2. **Provenance:** first 18 days `SIMULATED`, last 12 `REAL`, with `provenance_boundary`.
3. **Prices:** T+1 ≈ 3.2× T+45; weekend departures +15–25%; festival surge 18–24 Sep; each source samples a fixed weekday/weekend mix so the index doesn't wobble weekly.
4. **Components:** fuel surcharge share drifts up, airport UDF revised on 12 Sep, OTA platform fee creeps up: this produces the growing drip-pricing gap (latest AFI ≈ 101.4, TCT-AFI ≈ 113.1, gap ≈ +11.5%).
5. **Edge cases:** ~3% missing across every `missing_reason`, flagged outliers retained, SpiceJet `DEGRADED`, a full `BLOCKED` day for MakeMyTrip on 10 Sep (coverage dips to ~76%).
6. **Real math:** indices are computed with Jevons cells + booking-curve-weighted Laspeyres over the seed, so attribution genuinely reconciles on all five axes.
7. **Test controls:** a "Mock data" pill in the top bar simulates latency, failure rate, empty lists and stale data.

**Landing fare checker:** `landing/frontend/src/data/fares.ts` generates deterministic flights × platforms per search. `VITE_MOCK_AUTH=true` makes traveller sign-up/sign-in work locally (history in browser storage, sample history seeded for new mock accounts).

---

## Part G · Repository Structure & Monorepo Layout

npm workspaces (`package.json` → `landing/frontend`, `dashboard/frontend`, `packages/*`). **Note:** if `NODE_ENV=production` is set in your shell, run `npm install --include=dev`, or dev tools (TypeScript, Vite, types) are skipped.

```text
AeroFareX/
├── Project_context.md            # Living build log: current state, decisions, how to run. Read first.
├── PRD.md · TRD.md               # Product + technical specification (v2.2)
├── landing/
│   ├── frontend/                 # Vite + React public site
│   │   └── src/
│   │       ├── App.tsx           # Home page (hero, fly-through transition, sections)
│   │       ├── main.tsx          # Router: / · /fares · /account
│   │       ├── pages/            # FaresPage.tsx, AccountPage.tsx
│   │       ├── components/       # Header, HeroScene (3D), FlyThrough, WorkflowCard, AuthPanel, PageShell, NavAnchor
│   │       ├── views/            # Home-page sections
│   │       ├── data/             # mockData.ts (index story), fares.ts (fare checker mock), nav.ts
│   │       ├── lib/              # firebase.ts, userAuth.tsx, userStore.ts, guestGate.ts, format.ts
│   │       └── styles/           # landing.css, fares.css (token-bound, no colour literals)
│   └── backend/                  # Public API package (router of aerofarex-core)
├── dashboard/
│   ├── frontend/                 # Next.js 16 analyst portal
│   │   ├── src/app/              # Routes: / (overview), attribution, routes, routes/[routeId], lead-time,
│   │   │                         #   quality, health, methodology, login
│   │   ├── src/components/       # shell/ (AppShell, Sidebar, Topbar, ProfileMenu, Gates, MockControls),
│   │   │                         #   ui/ (ChartFrame, DataTable, QualityBadge, States, …), charts/, overview/
│   │   ├── src/lib/              # api/ (client, hooks), mock/ (seed, handlers), auth/, firebase/, config, nav, format
│   │   └── scripts/set-role.mjs  # Grant/revoke the analyst role (Firebase Admin)
│   └── backend/server/           # FastAPI analyst routers, econometrics, models, schemas, services
├── services/collector/           # adapters/ · orchestrator/ · pipeline/ · storage/ · monitoring/
├── packages/
│   ├── design-tokens/            # brand.css, tokens.css, brand.ts, tailwind-preset.js
│   └── shared-types/             # index.ts: API contracts (TS)
├── infra/
│   ├── db/migrations/            # SQLite DDL migrations
│   ├── firebase/                 # firestore.rules (written), storage.rules, firebase.json
│   └── docker/
└── data/seed/                    # Seed generator notes (dashboard seed lives in its mock layer)
```

---

## Part H · Identity, Access & Deployment

### 1. Access model
| Surface | Who | Sign-in | Gate |
| :--- | :--- | :--- | :--- |
| Landing `/`, `/fares` | Everyone | Optional | 5 free guest searches per browser, then sign-in prompt on the 6th |
| Landing `/account` | Travellers | Firebase Auth (email/password, Google) | Own data only (Firestore rules) |
| Dashboard | Analysts (NSO, RBI, DGCA, MoCA) | Firebase Auth + "Request access" sign-up | Custom claim `role ∈ {ANALYST, ADMIN}`; no claim → "Access request pending" |

- One Firebase project (`aerofarex`) serves both apps. Traveller accounts never receive a `role` claim, so they can't open the dashboard.
- Roles are granted with `npm run set-role -- <email> <ANALYST|ADMIN|NONE>` (needs a service-account key via `GOOGLE_APPLICATION_CREDENTIALS`; never commit it; `*firebase-adminsdk*.json` is gitignored). An admin UI with a backend endpoint replaces this later.
- `ADMIN` currently equals `ANALYST`; admin-only tools (user approvals, source controls, revision publishing, audit log) are planned.
- Local preview without Firebase: `NEXT_PUBLIC_AUTH_DEV_ROLE=ANALYST|ADMIN` (dashboard, `next dev` only, ignored in production) and `VITE_MOCK_AUTH=true` (landing).
- Personal data (traveller history) follows DPDP Act 2023 expectations: purpose notice, delete-history and delete-account controls on `/account`.

### 2. Deployment
- **Railway**: one service `aerofarex-core` (FastAPI + APScheduler + collector), volume at `/data`, `DATABASE_URL=sqlite:////data/aerofarex.db`, `TZ=Asia/Kolkata`. Single instance (volumes don't support replicas); brief downtime on redeploy is covered by the scheduler's misfire grace. Railway cron jobs are not used (they must exit and can't share the volume).
- **Firebase**: Hosting (both static frontends), Auth, Firestore (`infra/firebase/firestore.rules`: `firebase deploy --only firestore:rules`), Cloud Storage (raw payloads, DB replicas).
- **Collector etiquette**: declared user-agent `AeroFareX-StatisticalCollector/2.0 (+https://mospi.gov.in/aerofarex-collector)`, one request at a time per domain, 3.5 s jittered delay, circuit breaker; no proxy rotation, CAPTCHA solving or bot-evasion. A source that blocks the declared collector is treated as a "no" → seek a data agreement. Long term: licensed airline/GDS feeds.
