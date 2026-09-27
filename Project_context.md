# AeroFareX — Project Context (living build log)

> **Read this first.** This file tells a teammate (or their AI assistant) exactly where the project stands:
> what is built, what was decided and why, how to run it, and what is left. It is updated with every
> meaningful change. **Spec:** [`PRD.md`](./PRD.md) (product, v2.2) and [`TRD.md`](./TRD.md) (technical, v2.2).
> If this file and the spec disagree, this file is newer — fix the spec.
>
> **For AI assistants:** load this file, then `TRD.md`, before editing code. Follow the "Rules" section
> strictly. When you finish a change, add an entry to the Change log at the bottom.

**Last updated:** 2026-09-28 · **Latest commit at time of writing:** `0df0262` (dashboard v1 + user view v1)

---

## At a glance

| ✅ Built so far | ▶ Build next (main stream) |
| :--- | :--- |
| Landing site: 3D hero, fly-through workflow transition, full home page | **Dashboard backend `aerofarex-core`**: FastAPI + SQLite on Railway |
| Public fare checker `/fares` + traveller accounts `/account` (mock data, mock auth) | **Collector**: Scrapy + Scrapling (+ Playwright only where a session is needed) → raw archive → parse → validate → SQLite |
| Analyst dashboard: shell, auth, request-access, login page, **Overview** (mock API with real index maths) | **Index engine**: Jevons → booking-weighted chained Laspeyres → attribution, published nightly |
| Design tokens, shared TS API contracts, Firestore rules | Swap both frontends from mock to the real API |

Full detail: [§3 What is done](#3-what-is-done-detailed) · [§4 Next task](#4--next-task--dashboard-backend-the-main-stream) · [§5 Remaining](#5-what-is-remaining-prioritised)

### Reference map (open these alongside this file)

| Topic | Where |
| :--- | :--- |
| Repo overview, layout, rules | [README.md](./README.md) |
| Product scope, stakeholders, roadmap, access model | [PRD.md](./PRD.md) · [§9 Access model](./PRD.md#9-access-model--data-protection-v22) · [§10 Build status](./PRD.md#10-build-status-2026-09-28) |
| Architecture & stack | [TRD Part A](./TRD.md#part-a--system-architecture--tech-stack) |
| Index maths (Jevons, Laspeyres, booking curve, hedonic, attribution) | [TRD Part B](./TRD.md#part-b--mathematical--econometric-methodology) |
| Design tokens & the 7 frontend rules | [TRD Part C](./TRD.md#part-c--design-tokens--ui-component-specifications) · [design-tokens README](./packages/design-tokens/README.md) |
| API contracts (public + analyst) | [TRD Part D](./TRD.md#part-d--api-contracts--endpoint-specifications) · [shared-types](./packages/shared-types/index.ts) |
| Database schema (SQLite DDL, append-only triggers) | [TRD Part E](./TRD.md#part-e--database-schema-sqlite) · [infra/db README](./infra/db/README.md) |
| Mock/seed data spec | [TRD Part F](./TRD.md#part-f--seed-data--mock-server-specification) · [dashboard mock layer](./dashboard/frontend/src/lib/mock/) |
| Repo structure | [TRD Part G](./TRD.md#part-g--repository-structure--monorepo-layout) |
| Auth, roles, deployment (Railway + Firebase), collector etiquette | [TRD Part H](./TRD.md#part-h--identity-access--deployment) |
| Dashboard backend plan per folder | [dashboard/backend](./dashboard/backend/README.md) · [api/v1](./dashboard/backend/server/api/v1/README.md) · [core](./dashboard/backend/server/core/README.md) · [db](./dashboard/backend/server/db/README.md) · [econometrics](./dashboard/backend/server/econometrics/README.md) · [models](./dashboard/backend/server/models/README.md) · [schemas](./dashboard/backend/server/schemas/README.md) · [services](./dashboard/backend/server/services/README.md) · [tests](./dashboard/backend/tests/README.md) |
| Public API plan | [landing/backend](./landing/backend/README.md) |
| Collector plan per folder | [collector](./services/collector/README.md) · [adapters](./services/collector/adapters/README.md) · [orchestrator](./services/collector/orchestrator/README.md) · [pipeline](./services/collector/pipeline/README.md) · [storage](./services/collector/storage/README.md) |
| Firebase rules | [infra/firebase README](./infra/firebase/README.md) · [firestore.rules](./infra/firebase/firestore.rules) |
| Frontends | [landing/frontend](./landing/frontend/README.md) · [dashboard/frontend](./dashboard/frontend/README.md) |

---

## 1. What AeroFareX is (one paragraph)

A daily airfare price index for India built for MoSPI (Smart India Hackathon). It collects real fares on
India's 5 busiest routes from airlines and booking sites 4× a day, splits every price into base fare +
fuel + airport fees + GST + platform fee, and publishes three indices: **AFI** (base fare), **TCT-AFI**
(total cost you actually pay) and **ANC-AFI** (ancillaries). The gap between AFI and TCT-AFI is the
"drip-pricing" wedge — the product's central finding. Two surfaces:

| Surface | Folder | Audience | Status |
| :--- | :--- | :--- | :--- |
| Public website + fare checker | `landing/frontend` | Everyone / travellers | Built (fare data mocked) |
| Analyst dashboard | `dashboard/frontend` | NSO, RBI, DGCA, MoCA analysts | Shell + Overview built on mock data |
| Backend API + collector | `dashboard/backend`, `landing/backend`, `services/collector` | — | **Not started** (only READMEs) |

---

## 2. Key decisions (and why) — do not undo without discussing

| # | Decision | Why |
| :- | :--- | :--- |
| D1 | **Database = SQLite** (WAL, STRICT tables, append-only triggers), via SQLAlchemy | Small data volume; simple ops. `DATABASE_URL` can switch to Postgres later. Replaces the original PostgreSQL/TimescaleDB plan. |
| D2 | **Backend = one Railway service `aerofarex-core`** (FastAPI + APScheduler + collector) with a volume at `/data` | SQLite is one file; a Railway volume attaches to one service only. Railway cron jobs can't share it, so scheduling runs in-process (Asia/Kolkata). |
| D3 | **Firebase** for Hosting (both frontends), Auth, Firestore (collector health + traveller data), Cloud Storage (raw payloads, DB backups) | Already in the plan; free/cheap; one project `aerofarex`. Render and Cloud Run were considered and dropped. |
| D4 | **Dashboard has ONE role: analyst** (`role` custom claim `ANALYST`; `ADMIN` = same access for now). VIEWER removed. | Public users go to the landing site instead. Unapproved accounts see "Access request pending". |
| D5 | **Landing site gets a public fare checker** (`/fares`) + optional **traveller accounts** (`/account`). **5 free guest searches**, sign-in prompt on the 6th. | Non-experts can't use index points; they need real prices. PRD's "citizen comparison page", promoted to Tier 1. |
| D6 | **Collector = Scrapy + Scrapling**, plain-HTTP replay of each source's own fare request where permitted; Playwright only to obtain a session if a source needs it. Firecrawl/Crawl4AI not used in production. | Stable, cheap, auditable. Raw responses archived and re-parsable. |
| D7 | **Ethical collection**: declared user-agent, 1 request at a time per domain, 3.5 s jittered delay, circuit breaker. **No proxy rotation, CAPTCHA solving or bot evasion.** A block = ask for a data agreement. | Government project; "never clandestine" (PRD 5.1). Long term: licensed airline/GDS feeds. |
| D8 | **Mock-first frontends**: both apps run with no backend. Mock layer mirrors the real API contracts exactly. | Frontend work isn't blocked; swapping to real data is a config change. |
| D9 | **Design**: dashboard uses light theme (pale sky canvas, white cards, one sky-400 highlight card, black text on sky). Landing keeps its editorial ruled-panel style. Both use AFX Serif for headings/numbers + Google Sans. | User direction; matches brand.css. |
| D10 | Chart line colour for AFI/IndiGo = **`--sky-600` `#0096c7`** (new token) | `#00ccff` failed the palette validator for thin lines (1.9:1 on white). |

---

## 3. What is DONE (detailed)

### 3.1 Landing site — `landing/frontend` (Vite 8 + React 19 + React Router 7, plain CSS)
**Home page (`/`, `src/App.tsx`)**
- 3D hero: NASA DC-8 model flies in over clouds (`components/HeroScene.tsx`, Three.js; phones redraw at 30 fps after intro).
- **Fly-through transition** (`components/FlyThrough.tsx`) below the hero: 3 screens tall, pinned, light sky-400 background matching the manifesto; a plane with a canvas contrail flies across while the **workflow panel** (`components/WorkflowCard.tsx`) plays *Collect → Unbundle → Index → Publish* directly on the background (no box). Performance-optimised: transform/opacity only, one rAF loop, static plane bitmap; 0 dropped frames in testing.
- Sections: Manifesto, Trust strip, Features, What we track, Hidden fees, Route explorer, How it works, Who it's for, CTA band, footer.
- Section headings: `line-height: 1.12` so descenders don't clash.

**Header (`components/Header.tsx`)**: nav (Features, What we track, Hidden fees, **Search fares**, How it works), **Sign in / avatar** (traveller account), **Analyst access** button → dashboard login in "Request access" mode (`/login/?mode=signup`). `components/NavAnchor.tsx` makes `#section` links work from any page.

**Fare checker (`/fares`, `src/pages/FaresPage.tsx`)**
- Search: From / To with suggestions (your recent searches, popular routes, airports; keyboard navigable), swap button, date (1–45 days ahead).
- Results: headline stats (cheapest real price, lowest advertised, average added at checkout); one card per flight comparing the **airline site vs MakeMyTrip / EaseMyTrip / ixigo** (advertised, added later, you pay, "Details" breakdown into base/fuel/airport/GST/platform); cheapest flight highlighted with the offset sky block; "When should you book?" strip (T+1…T+45).
- Guest limit: **5 searches per browser** (`lib/guestGate.ts`), then a "Keep searching for free" sign-in dialog on the 6th attempt (no visible scrollbar).
- Untracked route → friendly empty state with popular-route chips. Honest disclaimer: prices are sample data until live collection.
- Mock data: `src/data/fares.ts` (`searchFares`, deterministic per search).

**Account (`/account`, `src/pages/AccountPage.tsx`)**: sign in / create account (email+password, Google, forgot password) when signed out; when signed in: profile header, stats, **search history** (re-run, delete, clear all), **saved routes**, sign out, **delete account and data** (DPDP).
- Auth: `lib/userAuth.tsx`; data: `lib/userStore.ts` (Firestore `users/{uid}/searches|saved`, falls back to browser storage).
- **`VITE_MOCK_AUTH=true`** (current `.env.local`): sign-up/sign-in work locally without Firebase; new mock accounts get sample history.
- Firestore security rules written: `infra/firebase/firestore.rules` (owner-only traveller data; analyst-read health). **Not deployed yet.**

### 3.2 Analyst dashboard — `dashboard/frontend` (Next.js 16 static export, Tailwind v4, TanStack Query)
- **Shell**: sidebar with long logo + nav (Overview, Attribution, Routes, Lead time, Data quality, Source health, Methodology, Sign out), export card (hidden on short windows); top bar with Ctrl+K search, "Mock data" test controls, alert bell, **profile menu** (role, pages, sign-in method, sign out). Fluid sizing for browser zoom.
- **Auth** (`src/lib/auth/AuthProvider.tsx`): Firebase email/password + Google, **Request access** sign-up (creates a role-less account → "Access request pending"), password reset, `refreshRole`. Dev preview: `NEXT_PUBLIC_AUTH_DEV_ROLE=ADMIN` (only in `next dev`).
- **Login page** (`src/app/login/page.tsx`): photo panel (`public/mini_img.webp`) with the logo on a whitish "jelly" plate, sunset background (`public/long_bg.jpg`), card 752×561, **Back to website** button (→ `NEXT_PUBLIC_LANDING_URL`).
- **Overview page** (`src/app/page.tsx`): KPI cards (AFI highlighted, TCT-AFI, hidden-fee gap, ANC-AFI) with QualityBadges; index-history line chart (one axis, hatched simulated span + provenance boundary, crosshair tooltip, table toggle); today's publication; routes list; hidden fees pill bars; coverage gauge; next-collection countdown with slot timeline; data sources with circuit states; "What moved the AFI today" diverging bars (reconciled).
- **Component kit**: `ChartFrame` (5 states + table toggle), `DataTable` (sortable, semantic), `QualityBadge`, `StatusPill`, `States` (loading/empty/error/partial/stale), `PageHeader`; charts `LineChart`, `PillBars`, `CoverageGauge`, `ContributionBars`, `Hatch`.
- **Mock API** (`src/lib/mock/`): implements every TRD Part D analyst endpoint over a deterministic 30-day seed with the **real index maths** (Jevons + booking-weighted Laspeyres; attribution reconciles on all 5 axes). Latest: AFI ≈ 101.4, TCT-AFI ≈ 113.1, gap ≈ +11.5%. Includes a blocked day, a degraded source, outliers, missing reasons.
- CSV export of the index family (client-side).
- Role tool: `npm run set-role -- <email> <ANALYST|ADMIN|NONE>` (needs `GOOGLE_APPLICATION_CREDENTIALS`).

### 3.3 Shared
- `packages/design-tokens`: added `--sky-600`, `--diverge-up/down/mid`; Tailwind preset updated.
- `packages/shared-types/index.ts`: full TypeScript API contracts (index, attribution, routes, observations, lead time, coverage, health).
- `.gitignore`: `*firebase-adminsdk*.json` added (never commit the service-account key).
- `PRD.md` and `TRD.md` updated to v2.2 (SQLite, Railway, Firebase, access model, fare checker, collector stack, new tokens, Part H).

---

## 4. ▶ NEXT TASK — Dashboard backend (the main stream)

**Goal:** replace the dashboard's mock API with a real one fed by real collected fares, so the Overview
(and later every page) shows live AFI / TCT-AFI / ANC-AFI. Everything the backend must return is
already fixed by the TypeScript contracts in [`packages/shared-types/index.ts`](./packages/shared-types/index.ts)
and implemented by the mock in [`dashboard/frontend/src/lib/mock/handlers.ts`](./dashboard/frontend/src/lib/mock/handlers.ts)
— **use the mock as the executable spec**: same paths, params, envelope and numbers-behaviour.

Specs to follow: [TRD Part A](./TRD.md#part-a--system-architecture--tech-stack) (architecture) ·
[Part B](./TRD.md#part-b--mathematical--econometric-methodology) (maths) ·
[Part D](./TRD.md#part-d--api-contracts--endpoint-specifications) (endpoints) ·
[Part E](./TRD.md#part-e--database-schema-sqlite) (schema) ·
[Part H](./TRD.md#part-h--identity-access--deployment) (auth + deployment + collector etiquette).

### 4.1 Shape of the service (one Railway service, owns the SQLite file)

```
aerofarex-core (FastAPI, Python 3.11+)                   ← deployed on Railway, volume /data
├── /api/v1/*            analyst routers   (dashboard/backend/server/api/v1)   Firebase token + role check
├── /api/v1/public/*     public routers    (landing/backend)                   cached, no auth
├── scheduler            APScheduler, tz Asia/Kolkata
│     02:30 · 05:30 · 13:00 · 19:00 IST  → collector run (all sources × 5 routes × 5 windows)
│     ~20:00 IST                          → index publication (compute + write index_snapshots)
├── collector            services/collector  (Scrapy + Scrapling + optional Playwright)
└── /data/aerofarex.db   SQLite (WAL, STRICT, append-only triggers) + Litestream → Firebase Storage
```

### 4.2 Collector pipeline (Scrapy · Scrapling · Playwright) — `services/collector`

```
schedule slot ─► FETCH (Scrapy spider per source)
                  • preferred: replay the site's own fare JSON request over plain HTTP (found once in Chrome DevTools)
                  • HTML-only source: parse with Scrapling selectors
                  • session-only source: Playwright opens the page once to obtain cookies/token, then plain HTTP
                  • declared UA, 1 request at a time per domain, 3.5 s jitter, retries, circuit breaker
               ─► RAW ARCHIVE  gzip payload → SHA-256 → batch hash chain → Firebase Storage (append-only) → raw_observations
               ─► PARSE        adapter.parse(raw) → Pydantic FareObservation (+ components, integer paise)
               ─► VALIDATE     components add up to total (exact) · IQR outliers FLAGGED not deleted · phantom-ticket filter
               ─► LOAD         fare_observations + fare_components (SQLite)
               ─► HEALTH       success rate, empty-field rate, fee-share drift, response-shape change → Firestore sources/
```
Parse runs **separately from fetch** and can re-run over the archive after a parser fix (bump `adapter_version`).

**Tool roles** (decision D6): **Scrapy** = spiders, scheduling conventions, per-domain throttling, retries,
item pipelines · **Scrapling** = resilient/adaptive HTML selectors (only when a source has no JSON) ·
**Playwright** (via `scrapy-playwright`) = browser only to obtain a session for sources that need it ·
**Pydantic** = schema + validation. *Not used in production:* Firecrawl, Crawl4AI, proxy rotation, stealth/anti-bot tools.

### 4.3 Target folder layout

```
services/collector/
├── pyproject.toml
├── adapters/{base.py, indigo/, air_india/, akasa/, spicejet/, makemytrip/}   # each: build_requests(), parse(), fixtures/, test_parse.py
├── orchestrator/{settings.py, spiders/fetch.py, session.py (Playwright), circuit_breaker.py}
├── storage/raw_archive.py            # SHA-256, batch hash chain, Firebase Storage upload
├── pipeline/{schema.py, validate.py, parse_job.py, load.py}
└── monitoring/health.py              # metrics → Firestore

dashboard/backend/server/
├── main.py                           # FastAPI app: mounts analyst + public routers, starts scheduler
├── core/{config.py, auth.py (Firebase token + role), errors.py (error envelope)}
├── db/{session.py (SQLAlchemy, WAL pragmas), migrations → infra/db/migrations}
├── models/                           # ORM for TRD Part E tables
├── schemas/                          # Pydantic mirrors of packages/shared-types
├── econometrics/{jevons.py, laspeyres.py, booking_curve.py, attribution.py, outliers.py, surge.py}
├── services/{publish.py, quality.py, health.py}
└── api/v1/{index.py, routes.py, observations.py, lead_time.py, quality.py, health.py, export.py}
```

### 4.4 Build order (milestones — each ends with something testable)

| # | Milestone | Done when |
| :- | :--- | :--- |
| M1 | FastAPI skeleton + SQLite schema/migrations + append-only triggers + health endpoint | `pytest` proves UPDATE/DELETE on raw/observations fails; `/api/v1/health` returns the envelope |
| M2 | Load the **existing mock seed** into SQLite (port `seed.ts` logic or export JSON) | DB has the same 30 days the dashboard mock shows |
| M3 | Econometrics in Python (Jevons, weighted Laspeyres, attribution) | Python AFI/TCT-AFI for the seed **match the mock's numbers** (≈101.4 / 113.1 on 27 Sep) and attribution reconciles (< 1e-4) |
| M4 | Analyst routers for every TRD Part D endpoint + Firebase token/role check | Dashboard runs with `NEXT_PUBLIC_USE_MOCK=false` and looks identical |
| M5 | Collector skeleton + **one real adapter end-to-end** (fetch → archive → parse → validate → load) | One source's real fares land in SQLite 4×/day; parser tests pass on archived fixtures |
| M6 | Scheduler + nightly publication + Firestore health | Index publishes unattended; Source health shows live circuit states |
| M7 | Remaining adapters (one at a time) + public fare-search endpoint for `/fares` | Landing fare checker shows real prices |
| M8 | Deploy to Railway (volume, backups, Litestream) + Firebase Hosting | Public URLs live |

### 4.5 Before writing an adapter (per source)
1. Check the site's terms; prefer permission or a data agreement (PRD §5.1, decision D7).
2. In Chrome DevTools → Network → Fetch/XHR, run a search, find the fare request, *Copy as cURL*.
3. Test plain-HTTP replay (change only route/date). Works → no browser. Needs a token → Playwright session only.
4. Save 3–5 real responses as `fixtures/`, write `parse()` against them, assert the add-up check.
5. Enable behind the circuit breaker; watch health metrics for a week.

---

## 5. What is REMAINING (prioritised)

### P0 — to make it real (detailed plan in [§4](#4--next-task--dashboard-backend-the-main-stream))
1. **Backend `aerofarex-core`** (FastAPI): SQLite schema + migrations (TRD Part E, with append-only triggers), analyst routers matching `packages/shared-types`, public routers incl. `GET /api/v1/public/fares/search`, Firebase token + role verification on every analyst request, APScheduler jobs, Litestream + Railway backups, `railway.json`.
2. **Collector** (`services/collector`): Scrapy project skeleton, raw archive (SHA-256 + batch hash chain → Firebase Storage), Pydantic schema with "components add up to total" check, IQR outliers, one adapter end-to-end first (find each source's fare request via DevTools; confirm permission).
3. **Firebase console setup**: enable Email/Password (+ Google) sign-in, create Firestore, deploy `infra/firebase/firestore.rules`, grant yourself `ANALYST` via `set-role`, then set `VITE_MOCK_AUTH=false` and clear `NEXT_PUBLIC_AUTH_DEV_ROLE`.
4. **Wire frontends to the API**: dashboard `NEXT_PUBLIC_USE_MOCK=false`; landing fare checker → public fares endpoint.

### P1 — dashboard pages (placeholders exist, component kit is ready)
Attribution (waterfall, 5 axes, reconciliation banner) · Routes + route detail (base vs total, fee composition, carriers, observation table + **audit drawer**) · Lead time (heatmap, price curve, booking weights) · Data quality (coverage trend, imputation, missing reasons, outliers) · Source health (live Firestore circuit states, run log) · Methodology.

### P2 — later
- Admin tools: approve access requests in-app, source pause/resume, revision (vintage) publishing, audit log (needs a backend endpoint; the Admin key can't live in the browser).
- Carriers / Components (ANC-AFI) / Cost comparison pages; SDMX export.
- Dashboard dark mode (tokens partly exist, not wired).
- Price alerts for saved routes; more routes; more OTAs (each needs an adapter + permission).
- Deploy: Firebase Hosting for both frontends; Railway service.

### Known issues / to confirm
- `dashboard/frontend/public/mini_img.png` (2.2 MB source) is committed next to the compressed `mini_img.webp` actually used — consider removing the PNG from the repo.
- Valty (hero font) is a demo licence; Anthropic Serif licence to confirm before public launch.
- Fare checker platforms EaseMyTrip/ixigo are sample data only (not in the collector plan yet).
- If `NODE_ENV=production` is set in your shell, `npm install` skips dev dependencies: use `npm install --include=dev`.

---

## 6. How to run (local)

```bash
npm install --include=dev          # from repo root (npm workspaces)

# Landing site  → http://localhost:5173  (/, /fares, /account)
cd landing/frontend && npx vite

# Analyst dashboard → http://localhost:3000
cd dashboard/frontend && npx next dev
```

**Env files** (gitignored `.env.local`; templates in `.env.example`):
| App | Variable | Purpose |
| :--- | :--- | :--- |
| landing | `VITE_PORTAL_URL` | Dashboard URL (Analyst access button) |
| landing | `VITE_FIREBASE_*` | Firebase web config (public identifiers) |
| landing | `VITE_MOCK_AUTH` | `true` = local mock traveller accounts |
| dashboard | `NEXT_PUBLIC_USE_MOCK` | `true` = seeded mock API |
| dashboard | `NEXT_PUBLIC_FIREBASE_*` | Firebase web config |
| dashboard | `NEXT_PUBLIC_AUTH_DEV_ROLE` | `ADMIN`/`ANALYST` = skip Firebase in `next dev` only |
| dashboard | `NEXT_PUBLIC_LANDING_URL` | "Back to website" link target |

Firebase web config values are public identifiers (safe in `.env.local`). The **service-account JSON is secret** — keep it outside the repo.

---

## 7. Rules every change must follow

1. **No colour literals** in components or app CSS — use tokens from `packages/design-tokens` (add new ones there, validated).
2. **Money is integer paise** everywhere; format to ₹ only at render.
3. **Charts:** one y-axis only; fixed entity colours; grey zero on diverging; table view for every chart; quality badge on every published number; hatch simulated data.
4. Every data component handles **loading / empty / error / partial / stale**.
5. **Mock layer must match the API contract** in `packages/shared-types` field for field.
6. **Security:** role checks happen on the backend; never ship the Firebase Admin key to a browser; traveller data owner-only.
7. **Collector ethics** (D7) are non-negotiable.
8. Match the existing look: landing = editorial ruled panels; dashboard = light sky cards; both fonts as in D9; fluid sizes (`clamp`) so zoom works.

---

## 8. Change log (newest first — append here)

| Date | Commit | Change |
| :--- | :--- | :--- |
| 2026-09-28 | (next commit) | PRD/TRD → v2.2; `Project_context.md` created (at-a-glance, reference map to TRD/READMEs, §4 next task: dashboard backend + collector plan); README points here. |
| 2026-09-28 | `0df0262` | Dashboard v1 (shell, auth, Overview, mock API, login with photo/glass logo, request access, back-to-website) and user view v1 (`/fares`, `/account`, mock auth, Firestore rules, 5-search guest limit, rebuilt fare table with square cards). |
| 2026-09-27 | `153c7cb` | Fly-through transition revamp: light sky, workflow panel on background, performance fixes. |
| 2026-09-27 | `a404eb3`/`4fff40c` | Workflow animation in transition; merge with teammate's receipt work (receipt card later removed). |
| 2026-09-27 | `f12577f` | Landing v2.2: 3D hero aircraft with approach path. |
