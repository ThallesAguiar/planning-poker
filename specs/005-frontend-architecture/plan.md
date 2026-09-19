# Implementation Plan: Frontend Architecture Reorganization

**Branch**: `005-frontend-architecture` | **Date**: 2026-09-18 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification plus route-page hierarchy clarification.

## Summary

Reorganize React frontend into responsibility layers and domain-grouped pages. Preserve existing
behavior and URLs, add room Studio page at `/rooms/:code/studio`, retain React Router and Zustand,
then prove compatibility with build, lint, and Playwright.

## Technical Context

**Language/Version**: TypeScript 6, React 19

**Primary Dependencies**: React Router DOM 7.18, Zustand 5, Socket.IO client 4, Framer Motion 12

**Storage**: Browser localStorage and sessionStorage for account and room recovery; backend remains
authoritative for persisted room data

**Testing**: `npm run build`, `npm run lint`, Playwright 1.62 end-to-end suites

**Target Platform**: Modern browsers; Vite development server and nginx SPA container

**Project Type**: Web application frontend in full-stack monorepo

**Performance Goals**: Existing and new routes remain interactive after direct navigation or refresh;
relocation introduces no duplicate socket listeners or redundant data requests

**Constraints**: Preserve current seven route patterns, Portuguese UI text, selectors where practical,
Socket.IO cleanup and reconnection, browser storage keys, and Zustand behavior. New Studio route uses
the public room code then existing room Studio authorization. Do not add Redux solely to mirror image.

**Scale/Scope**: 21 active source modules, one global store, eight route patterns after addition, and
five existing Playwright specs plus Studio-route coverage. No backend, shared-contract, or persistence
change.

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design.*

- PASS: Shared types and Socket.IO contracts remain unchanged; relocation changes frontend ownership.
- PASS: Server-authoritative round, reveal, permission, and room state remain unchanged; listener
  lifecycle receives regression coverage.
- PASS: Persistence, migrations, Redis, and backend authorization remain unchanged.
- PASS: Room Studio page resolves the public code then uses existing server owner authorization; guest,
  non-owner, and unavailable-room states must not expose protected configuration.
- PASS: Build, lint, direct-link refresh, existing Playwright, and new Studio-route E2E coverage are
  required. Run frontend container smoke only if image-serving files change.
- PASS: `TASKS.md` records architecture, route, test evidence, pending work, and prompt traceability.

## Project Structure

### Documentation

```text
specs/005-frontend-architecture/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/navigation-and-boundaries.md
└── tasks.md                 # Created later by /speckit-tasks
```

### Source Code

```text
frontend/src/
├── api/                     # HTTP clients and response mapping
├── assets/                  # Bundled static assets when present
├── components/
│   ├── layout/              # Shared chrome
│   ├── room/                # Reusable table, configuration, Studio form
│   └── ui/                  # Generic controls
├── context/                 # Scoped providers only when needed
├── data/                    # Immutable app content
├── hooks/                   # Session, route and lifecycle logic
├── pages/
│   ├── home/index.tsx
│   ├── rooms/index.tsx
│   ├── rooms/room/index.tsx
│   ├── studio/index.tsx
│   ├── studio/room/index.tsx
│   └── reports/index.tsx
├── routes/                  # Paths, helpers, guards and route map
├── services/                # Socket connection and commands
├── stores/                  # Existing Zustand global state
└── utils/                   # Pure helpers
```

**Structure Decision**: Page directories group route-level screens by domain. Folder hierarchy does
not force URL hierarchy: `pages/studio/room/index.tsx` owns `/rooms/:code/studio`. `RoomConfiguration`
remains a room component because it is a modal, not a route. Existing in-table Studio panel becomes a
navigation entry to the dedicated page; form presentation is shared, never duplicated.

## Complexity Tracking

No constitution violations require justification.
