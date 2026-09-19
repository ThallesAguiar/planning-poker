# Tasks: Frontend Architecture Reorganization

**Input**: Design documents from `/specs/005-frontend-architecture/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/navigation-and-boundaries.md, quickstart.md

**Tests**: Build, lint, and Playwright are required by FR-007. New browser coverage is required for
the room Studio route and its authorization states.

**Organization**: Tasks grouped by user story. This feature task list is the Spec Kit planning
artifact; root `TASKS.md` is not changed by this workflow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable after dependencies complete
- **[US#]**: User story traceability

## Phase 1: Setup

**Purpose**: Establish migration map and preserve baseline behavior before file moves.

- [X] T001 Inventory current imports, route paths, storage keys, Socket.IO listeners, Portuguese test selectors, and source ownership in `frontend/src/` and `frontend/tests/`
- [X] T002 Capture baseline evidence with `npm run build`, `npm run lint`, and `npm run test:e2e` from `frontend/`
- [X] T003 Create route ownership contract in `frontend/src/routes/paths.ts` from `specs/005-frontend-architecture/contracts/navigation-and-boundaries.md`

---

## Phase 2: Foundational

**Purpose**: Create shared boundaries required by all page migrations.

- [X] T004 Create centralized path constants and parameter builders in `frontend/src/routes/paths.ts`
- [X] T005 Create route map and fallback composition in `frontend/src/routes/index.tsx`; update `frontend/src/main.tsx` to consume it
- [X] T006 [P] Move HTTP account client from `frontend/src/lib/auth.ts` to `frontend/src/api/auth.ts` and update consumers
- [X] T007 [P] Move HTTP Studio clients from `frontend/src/lib/studio.ts` and `frontend/src/lib/room-studio.ts` to `frontend/src/api/`
- [X] T008 [P] Move Socket.IO singleton from `frontend/src/lib/socket.ts` to `frontend/src/services/socket.ts` and update consumers
- [X] T009 [P] Extract room-code parsing and immutable avatar/deck data from `frontend/src/App.tsx` into `frontend/src/utils/room-code.ts` and `frontend/src/data/`
- [X] T010 Preserve global Zustand state as `frontend/src/stores/app-store.ts`; remove old `frontend/src/lib/` only after all imports migrate

**Checkpoint**: Existing router renders all prior addresses through `frontend/src/routes/`; no stale
`lib/` imports remain.

---

## Phase 3: User Story 1 - Use Existing Product Flows (Priority: P1)

**Goal**: Existing home, account, entry, room, and report flows retain behavior after page extraction.

**Independent Test**: Existing Playwright suites complete successfully against migrated pages without
new user-visible behavior except planned room Studio navigation.

### Tests for User Story 1

- [X] T011 [P] [US1] Update direct-navigation and refresh assertions in `frontend/tests/room-entry.spec.ts` for centralized route map
- [X] T012 [P] [US1] Update account, saved-room, and dashboard navigation assertions in `frontend/tests/auth-rooms.spec.ts`
- [X] T013 [P] [US1] Update report-route assertions in `frontend/tests/report.spec.ts`

### Implementation for User Story 1

- [X] T014 [US1] Extract home, account, login, registration, create-room, and join-room composition from `frontend/src/App.tsx` into `frontend/src/pages/home/index.tsx`
- [X] T015 [US1] Extract room-entry, browser-session restore, reconnect, storage cleanup, and socket listener lifecycle into `frontend/src/hooks/use-room-session.ts` and `frontend/src/pages/rooms/room/index.tsx`
- [X] T016 [P] [US1] Move saved rooms, profile, and settings page composition from `frontend/src/features/dashboard/DashboardPages.tsx` into `frontend/src/pages/rooms/index.tsx`, `frontend/src/pages/profile/index.tsx`, and `frontend/src/pages/settings/index.tsx`
- [X] T017 [P] [US1] Move report composition and report HTTP client from `frontend/src/features/report/ReportPage.tsx` and `frontend/src/api/reports.ts` into `frontend/src/pages/reports/index.tsx` and `frontend/src/api/reports.ts`
- [X] T018 [US1] Replace `frontend/src/App.tsx` consumers with page imports in `frontend/src/routes/index.tsx`; delete obsolete feature files only after import and route checks pass
- [X] T019 [US1] Run `npm run build`, `npm run lint`, and affected Playwright specs from `frontend/`; fix behavior or selector regressions

**Checkpoint**: Home, account, room entry/reconnect, active table, and report journeys remain usable.

---

## Phase 4: User Story 2 - Maintainable Frontend Boundaries (Priority: P2)

**Goal**: Developers locate active frontend modules by responsibility and no duplicate implementation remains.

**Independent Test**: Source review confirms each active module matches the boundary contract and
TypeScript resolves every import.

### Tests for User Story 2

- [X] T020 [P] [US2] Add architecture import and duplicate-module checks to `frontend/package.json` scripts or `frontend/tests/architecture.spec.ts`

### Implementation for User Story 2

- [X] T021 [P] [US2] Move reusable table, chat, participant, hand, status, story, configuration, and AI presentation from `frontend/src/features/table/` and `frontend/src/features/room/` into `frontend/src/components/room/`
- [X] T022 [P] [US2] Move reusable dashboard shell and navigation composition into `frontend/src/components/layout/`
- [X] T023 [P] [US2] Extract generic presentational controls from migrated pages into `frontend/src/components/ui/`
- [X] T024 [US2] Move room Socket.IO command functions from `frontend/src/features/table/room-actions.ts` into `frontend/src/services/room-actions.ts` and update all room components
- [X] T025 [US2] Add real assets or scoped providers only where consumed in `frontend/src/assets/` and `frontend/src/context/`; do not create placeholder files or replace Zustand
- [X] T026 [US2] Remove empty, obsolete, duplicate, and stale source paths under `frontend/src/features/`, `frontend/src/lib/`, and root `frontend/src/routes.tsx`; verify no circular imports
- [X] T027 [US2] Run architecture checks, `npm run build`, and `npm run lint` from `frontend/`

**Checkpoint**: Responsibility contract holds; active source has no stale imports or duplicate modules.

---

## Phase 5: User Story 3 - Predictable Navigation (Priority: P3)

**Goal**: Every route resolves predictably; user Studio and room Studio are separate canonical pages.

**Independent Test**: Directly open and refresh all route patterns, including room Studio authorization
states, and validate expected destination or recovery behavior.

### Tests for User Story 3

- [X] T028 [P] [US3] Add owner, guest, non-owner, unknown-code, and refresh coverage for `/rooms/:code/studio` in `frontend/tests/studio-route.spec.ts`
- [X] T029 [P] [US3] Add wildcard fallback and direct-refresh coverage for all route constants in `frontend/tests/room-entry.spec.ts`

### Implementation for User Story 3

- [X] T030 [US3] Move account Studio composition from `frontend/src/features/dashboard/StudioPage.tsx` into `frontend/src/pages/studio/index.tsx`; preserve `/studio`
- [X] T031 [US3] Extract editable room Studio form from `frontend/src/features/room/RoomStudioPanel.tsx` into `frontend/src/components/room/RoomStudioForm.tsx`
- [X] T032 [US3] Implement `frontend/src/pages/studio/room/index.tsx` to resolve room code, enforce existing account-owner authorization, and render loading, forbidden, missing-room, and error states without exposing configuration
- [X] T033 [US3] Register `/rooms/:code/studio` in `frontend/src/routes/index.tsx` using `frontend/src/routes/paths.ts`; preserve existing `/studio` and all prior paths
- [X] T034 [US3] Replace editable in-table `RoomStudioPanel` rendering in `frontend/src/components/room/TableScreen.tsx` with navigation to the canonical room Studio page; remove duplicate editable panel implementation
- [X] T035 [US3] Run new Studio-route Playwright coverage plus existing Studio, room, and authentication suites from `frontend/`

**Checkpoint**: User Studio stays at `/studio`; room Studio is editable only at `/rooms/:code/studio`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Prove final compatibility and document completed work.

- [X] T036 [P] Review public route contract against `frontend/src/routes/paths.ts` and `specs/005-frontend-architecture/contracts/navigation-and-boundaries.md`
- [X] T037 [P] Perform browser deep-link smoke checks for `/`, `/rooms`, `/profile`, `/settings`, `/studio`, `/room/:code`, `/rooms/:code/studio`, `/report/:id/:roomCode?`, and an unknown path
- [X] T038 Run full `npm run build`, `npm run lint`, and `npm run test:e2e` from `frontend/`; record exact results
- [X] T039 If frontend container files changed, run `docker compose up --build -d frontend` and verify deep-link SPA fallback at `http://localhost:5173`

## Dependencies & Execution Order

- Phase 1 precedes Phase 2.
- Phase 2 blocks all user stories.
- US1 establishes page extraction before US2 removes legacy modules.
- US2 establishes stable component and service boundaries before US3 moves the room Studio panel.
- US3 depends on T004, T005, T007, T021, and T024; it preserves user Studio while adding room Studio.
- Phase 6 follows all selected user stories.

## Parallel Opportunities

- T006, T007, T008, and T009 can run after T003.
- T011, T012, and T013 can run together after baseline evidence.
- T016 and T017 can run after page conventions exist.
- T021, T022, and T023 can run together when their import boundaries are assigned.
- T028 and T029 can run together before T032 through T034.
- T036 and T037 can run together after implementation.

## Implementation Strategy

### MVP

Complete T001-T019 first. Existing user flows render through domain pages with no product regression.

### Incremental Delivery

1. Complete shared route, API, service, data, and utility boundaries.
2. Extract existing flows into pages and validate compatibility.
3. Consolidate reusable components and remove legacy paths.
4. Move room Studio into its canonical route and validate authorization.
5. Run full quality gates and record evidence in this feature's implementation handoff.

## Implementation evidence

- 2026-09-19: `npm run build` passed.
- 2026-09-19: `npm run lint` passed.
- 2026-09-19: `FRONTEND_URL=http://127.0.0.1:5174`, `VITE_API_URL=http://localhost:3333`, `npm run test:e2e -- --workers=1` passed: 23 tests.
- 2026-09-19: `docker compose up --build -d frontend` passed; nginx returned SPA fallback for `/rooms/DEMO/studio`.
