# AeroFareX — Real-time Airfare Price Index for India

Sovereign-grade airfare price measurement platform built for MoSPI / Smart India Hackathon.
Full specification: [`PRD.md`](./PRD.md) · [`TRD.md`](./TRD.md) — the sole source of truth for this project.

Published indices: **AFI** (headline base fare) · **TCT-AFI** (total cost of travel) · **ANC-AFI** (ancillary fees).

## Repository Layout

```text
AeroFareX/
├── apps/
│   ├── frontend/            Next.js 18+ — src/dashboard (gated analyst app) + src/landing (public site)
│   └── backend/             FastAPI — app/dashboard (index engine, gated REST) + app/landing (public REST)
├── services/
│   └── collector/           Data collection & ingestion engine — scraper adapters, scheduler, sanitization pipeline
├── packages/
│   ├── design-tokens/       Single source of truth for tokens.css + Tailwind preset (shared by apps/frontend)
│   └── shared-types/        TypeScript types shared between the frontend app and the mock API layer
├── infra/
│   ├── db/migrations/       PostgreSQL + TimescaleDB schema migrations
│   ├── firebase/            Firestore/Storage security rules, firebase.json
│   └── docker/              docker-compose and container definitions for local dev
├── data/
│   └── seed/                30-day realistic seed dataset + generator (powers NEXT_PUBLIC_USE_MOCK)
├── PRD.md                   Product Requirements Document v2.0
└── TRD.md                   Technical Requirements & Build Spec v2.0
```

Full per-folder-and-file rationale (why each split exists, what belongs where, cross-cutting
naming rules): see **`TRD.md` Part G — Repository Structure & Monorepo Layout**.

## Local Development

See per-app `README.md` files in `apps/frontend`, `apps/backend`, and `services/collector` for setup instructions
once each is scaffolded. The frontend is designed to run fully decoupled from the backend via
`NEXT_PUBLIC_USE_MOCK=true`, seeded from `data/seed`.

## Non-Negotiable Rules

See `TRD.md` Part C, Section 2 for the seven frontend rules (no dual-axis charts, fixed categorical
slot palette, mandatory quality metadata, integer-paise money, etc.). These are enforced in code review,
not optional style preferences.
