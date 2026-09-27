# AeroFareX — Real-time Airfare Price Index for India

Sovereign-grade airfare price measurement platform built for MoSPI / Smart India Hackathon.
Full specification: [`PRD.md`](./PRD.md) · [`TRD.md`](./TRD.md) — the sole source of truth for this project.

**New here, or feeding this repo to an AI assistant? Read [`Project_context.md`](./Project_context.md) first:** current state, decisions, how to run, and the change log.

Published indices: **AFI** (headline base fare) · **TCT-AFI** (total cost of travel) · **ANC-AFI** (ancillary fees).

## Repository Layout

```text
AeroFareX/
├── landing/                     # Public Citizen Transparency Site & Public API
│   ├── frontend/                # Public landing web app (citizen transparency, headline index widget)
│   └── backend/                 # Public lightweight read-only REST API (cached, rate-limited)
│
├── dashboard/                   # Sovereign Gated Analyst Platform & Econometric Engine
│   ├── frontend/                # Next.js 16 analyst portal (analyst-only; App Router in src/app, charts, DataTables)
│   └── backend/                 # FastAPI analytical backend (server/api/v1, server/econometrics, SQLite)
│
├── services/
│   └── collector/               # Data collection & ingestion engine — scraper adapters, scheduler, sanitization pipeline
│
├── packages/
│   ├── design-tokens/           # Single source of truth for tokens.css + Tailwind preset
│   └── shared-types/            # TypeScript contracts shared across landing and dashboard
│
├── infra/
│   ├── db/migrations/           # SQLite schema migrations
│   ├── firebase/                # Firestore/Storage security rules, firebase.json
│   └── docker/                  # docker-compose and container definitions for local dev
│
├── data/
│   └── seed/                    # 30-day realistic seed dataset + generator (powers NEXT_PUBLIC_USE_MOCK)
│
├── Project_context.md           # Living build log — read first
├── PRD.md                       # Product Requirements Document v2.2
└── TRD.md                       # Technical Requirements & Build Spec v2.2
```

Full per-folder-and-file rationale (why each split exists, what belongs where, cross-cutting
naming rules): see **`TRD.md` Part G — Repository Structure & Monorepo Layout**.

## Local Development

See per-component `README.md` files:
- **Landing Page:** `landing/frontend` & `landing/backend`
- **Analyst Portal:** `dashboard/frontend` & `dashboard/backend`
- **Collector:** `services/collector`

The frontend apps are designed to run fully decoupled from backends via `NEXT_PUBLIC_USE_MOCK=true`, seeded from `data/seed`.

## Non-Negotiable Rules

See `TRD.md` Part C, Section 2 for the seven frontend rules (no dual-axis charts, fixed categorical
slot palette, mandatory quality metadata, integer-paise money, etc.). These are enforced in code review,
not optional style preferences.
