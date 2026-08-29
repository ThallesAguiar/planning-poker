---

description: "Implementation tasks for Collaborative Real-Time Planning Poker"

---

# Tasks: Collaborative Real-Time Planning Poker

**Input**: Design documents from `/specs/001-collaborative-planning-poker/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included because specification defines measurable security, realtime, recovery, and
end-to-end acceptance outcomes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish dependencies, module boundaries, and shared contract conventions.

- [ ] T001 Add backend module folders and test entry points under `api/src/auth`, `api/src/realtime`, `api/src/ai`, `api/src/reports`, and `api/test`.
- [x] T002 [P] Add report and AI runtime configuration keys with safe defaults in `docker-compose.yml` and `api/.env.example`.
- [~] T003 [P] Add shared event/error/value constants and strict type-check configuration in `packages/shared-types/src/index.ts` and `packages/shared-types/tsconfig.json`.
- [ ] T004 [P] Add frontend feature folder boundaries under `frontend/src/features/` and reusable status components under `frontend/src/components/`.
- [x] T005 [P] Document feature setup and verification commands in `specs/001-collaborative-planning-poker/quickstart.md`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete shared contracts, durable active-round state, validation, and authorization
before user-story work.

- [~] T006 Define canonical room, role, story, vote, timer, error, report, and AI types in `packages/shared-types/src/index.ts`.
- [~] T007 Define typed Socket.IO client/server event maps matching `specs/001-collaborative-planning-poker/contracts/realtime.md` in `packages/shared-types/src/index.ts`.
- [~] T008 [P] Add request/response and error DTO types matching `specs/001-collaborative-planning-poker/contracts/rest.md` in `packages/shared-types/src/index.ts`.
- [ ] T009 [P] Add contract tests for event secrecy, payload names, role values, and vote values in `packages/shared-types/src/index.test.ts`.
- [~] T010 Extend Prisma schema with active-round timer deadline, discussion timing, finalization metadata, and report export fields in `api/prisma/schema.prisma`.
- [~] T011 Create versioned migration for active-round persistence and required uniqueness/index constraints in `api/prisma/migrations/`.
- [~] T012 Implement validated environment configuration and secret checks in `api/src/config.ts` and `api/src/app.module.ts`.
- [~] T013 Implement shared room state repository with memory fallback, Redis snapshot coordination, and gateway integration in `api/src/realtime/room-state.service.ts`; PostgreSQL merge/hydration and stale-snapshot reconciliation remain pending.
- [~] T014 Implement server deadline timer service with deadline persistence and single-process expiry handling in `api/src/realtime/timer.service.ts` and `api/src/room.gateway.ts`; atomic multi-instance expiry remains pending.
- [~] T015 Implement centralized role, membership, phase, payload, and closed-room policy in `api/src/auth/authorization.service.ts`.
- [~] T016 Implement JWT/guest session creation and verification in `api/src/auth/session.service.ts`.
- [ ] T017 Replace duplicated gateway types with shared types and state services in `api/src/room.gateway.ts`.
- [ ] T018 Add foundational authorization, timer, persistence, and reconnect tests in `api/test/foundation.integration.spec.ts`.

**Checkpoint**: Shared contracts, durable state, validation, and authorization ready.

## Phase 3: User Story 1 - Create and Run Estimation Room (Priority: P1)

**Goal**: PO creates/configures room, manages stories, and completes a valid estimation round.

**Independent Test**: Create room, join multiple participants, present story, vote, reveal, then
finalize or revote while observing hidden values and statistics.

### Tests for User Story 1

- [ ] T019 [P] [US1] Add REST contract tests for room/config/story operations in `api/test/room.contract.spec.ts`.
- [ ] T020 [P] [US1] Add multi-client test for join, present, vote progress, hidden votes, reveal, revote, and finalize in `api/test/room-estimation.integration.spec.ts`.
- [ ] T021 [P] [US1] Add frontend interaction tests for room setup, story presentation, card selection, and reveal gating in `frontend/src/features/room/room-flow.test.tsx`.

### Implementation for User Story 1

- [~] T022 [US1] Implement room configuration and story CRUD DTO validation in `api/src/room.dto.ts` and `api/src/room.controller.ts`.
- [ ] T023 [US1] Implement room creation, invite lookup, private access, configuration, and story ordering in `api/src/room.service.ts`.
- [~] T024 [US1] Implement guest/JWT join bootstrap and role assignment in `api/src/room.controller.ts`, `api/src/room.service.ts`, and `api/src/auth/session.service.ts`.
- [ ] T025 [US1] Implement atomic present, vote, reveal, revote, finalize, and skip transitions in `api/src/realtime/round.service.ts`.
- [ ] T026 [US1] Wire typed room commands and sanitized snapshots to the gateway in `api/src/room.gateway.ts`.
- [ ] T027 [US1] Add real PO configuration and story management screens in `frontend/src/features/room/RoomConfiguration.tsx` and `frontend/src/features/room/StoryList.tsx`.
- [~] T028 [US1] Add typed room join form with role/avatar selection and private password handling in `frontend/src/features/room/JoinRoom.tsx`.
- [ ] T029 [US1] Add table cards, progress, reveal gating, statistics, and finalization controls in `frontend/src/features/table/PlanningTable.tsx`.
- [ ] T030 [US1] Update Zustand state and Socket.IO actions for authoritative room phases and vote visibility in `frontend/src/stores/app-store.ts` and `frontend/src/lib/socket.ts`.
- [ ] T031 [US1] Add accessible error, loading, full-room, invalid-vote, and unauthorized-action states in `frontend/src/components/RoomStatus.tsx`.

**Checkpoint**: US1 independently demonstrates a complete human estimation round.

## Phase 4: User Story 2 - Realtime Collaboration and Recovery (Priority: P1)

**Goal**: Team collaborates through chat, discussion, reactions, presence, timers, and reconnection.

**Independent Test**: Two browser clients exchange chat, cast divergent votes, discuss, disconnect,
reconnect, and recover identical authoritative state.

### Tests for User Story 2

- [ ] T032 [P] [US2] Add multi-client discussion, timer expiry, reaction, and observer permission tests in `api/test/collaboration.integration.spec.ts`.
- [ ] T033 [P] [US2] Add reconnect hydration and Redis-backed active-round recovery tests in `api/test/reconnection.integration.spec.ts`.
- [ ] T034 [P] [US2] Add browser-level responsive and reconnect-state checks in `frontend/tests/collaboration.e2e.ts`.

### Implementation for User Story 2

- [ ] T035 [US2] Persist discussion start/end and reflection/discussion elapsed time in `api/src/realtime/round.service.ts`.
- [ ] T036 [US2] Implement participant presence, chat history, story-linked justification, and reaction events in `api/src/room.gateway.ts` and `api/src/realtime/presence.service.ts`.
- [ ] T037 [US2] Implement reconnect session hydration from PostgreSQL/Redis without duplicate membership in `api/src/realtime/room-state.service.ts`.
- [ ] T038 [US2] Add observer read-only policy and configurable Scrum Master mediation in `api/src/auth/authorization.service.ts`.
- [ ] T039 [US2] Add discussion panel, server countdown, presence indicators, chat, and reactions in `frontend/src/features/discussion/DiscussionPanel.tsx` and `frontend/src/features/table/Presence.tsx`.
- [ ] T040 [US2] Add reconnecting, restored, disconnected, and closed-room UI states in `frontend/src/components/ConnectionStatus.tsx` and `frontend/src/stores/app-store.ts`.
- [ ] T041 [US2] Add card slide/flip, consensus particles, reaction overlays, muteable sounds, and theme tokens in `frontend/src/features/table/animations.ts`, `frontend/src/features/table/Reactions.tsx`, and `frontend/src/index.css`.

**Checkpoint**: US1 and US2 independently support trustworthy multi-client estimation.

## Phase 5: User Story 3 - Sprint Reports and Sharing (Priority: P2)

**Goal**: Authorized users close session, inspect permanent report, and export PDF/CSV.

**Independent Test**: Complete several stories with different rounds and discussions, generate report,
then verify metrics, participation, evidence, and exports.

### Tests for User Story 3

- [~] T042 [P] [US3] Add report aggregation and authorization tests in `api/src/reports/report.service.spec.ts`; full integration coverage remains pending.
- [ ] T043 [P] [US3] Add CSV/PDF content and download tests in `api/test/report-export.integration.spec.ts`.
- [ ] T044 [P] [US3] Add report page and export-link tests in `frontend/src/features/report/ReportPage.test.tsx`.

### Implementation for User Story 3

- [~] T045 [US3] Implement normalized report aggregation for stories, rounds, timing, chat, and participation in `api/src/reports/report.service.ts`; divergence metrics remain pending.
- [x] T046 [US3] Implement achievements/badges calculation in `api/src/reports/achievements.service.ts`.
- [~] T047 [US3] Implement report REST endpoints, participant-session viewing, restricted export, and idempotent report generation in `api/src/reports/report.controller.ts` and `api/src/reports/report.service.ts`; PDF and full room-closure authorization remain pending.
- [~] T048 [US3] Implement CSV and PDF rendering in `api/src/reports/report.service.ts` and `api/src/reports/pdf-export.service.ts`; shared report DTO remains pending.
- [~] T049 [US3] Add permanent report route and story views in `frontend/src/features/report/ReportPage.tsx` and `frontend/src/routes.tsx`; participation and achievement views remain pending.
- [~] T050 [US3] Add report REST viewing and CSV export client in `frontend/src/features/report/report-api.ts`; report readiness/realtime integration and PDF remain pending.

**Checkpoint**: Completed session produces durable, viewable, exportable report.

## Phase 6: AI Participant (Cross-Cutting Product Requirement)

- [x] T051 Create provider-neutral OpenAI-compatible LLM adapter with configurable base URL/model, timeout, bounded prompt, structured response parsing, and provider error mapping in `api/src/ai/llm.client.ts`.
- [~] T052 Add AI participant lifecycle, deck validation, vote casting, chat-context justification persistence, gateway status dispatch, and frontend controls; full failure policy remains pending.
- [x] T053 Add AI configuration controls and unavailable/error status in `frontend/src/features/room/RoomConfiguration.tsx` and `frontend/src/features/table/AIParticipant.tsx`.
- [~] T054 Add unit coverage for timeout, invalid output, missing key, and cost-limit behavior; integration and human-only fallback tests remain pending.

## Phase 7: Polish and Cross-Cutting Verification

- [x] T055 Add frontend container and development environment wiring in `frontend/Dockerfile` and `docker-compose.yml`.
- [x] T056 Replace development schema push with production-safe migration/entrypoint behavior in `api/Dockerfile` and `api/package.json`.
- [~] T057 Add security log redaction and HTTP correlation IDs in `api/src/main.ts` and `api/src/realtime/logger.service.ts`; gateway event correlation remains pending.
- [ ] T058 Add full prompt traceability and implementation status links in `TASKS.md`.
- [ ] T059 Run frontend build/lint, API build/unit/E2E, Prisma validation, Docker config, and multi-client acceptance flow from `specs/001-collaborative-planning-poker/quickstart.md`.
- [ ] T060 Run responsive accessibility and performance verification against SC-001 through SC-007 in `frontend/tests/acceptance.e2e.ts` and `api/test/acceptance.integration.spec.ts`.

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) precedes Foundational (Phase 2).
- Foundational (Phase 2) blocks all user stories.
- US1 establishes the core round flow; US2 depends on its room state transitions.
- US3 depends on persisted round/discussion facts from US1 and US2.
- AI can start after shared contracts and round service exist, then integrates before final polish.
- Polish depends on desired stories and AI/report scope being complete.

### Parallel Opportunities

- T002-T005 can run in parallel.
- T008-T009 and T011-T012 can run in parallel after T006-T007.
- T019-T021 can run in parallel before US1 implementation.
- T032-T034 can run in parallel before US2 implementation.
- T042-T044 can run in parallel before US3 implementation.
- T051, T055, and T057 can run in parallel after foundational contracts.

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1, including its contract and multi-client tests.
3. Validate create/join, story, vote, reveal, revote, and finalization flow.
4. Stop for MVP demo before adding collaboration polish, AI, and reports.

### Incremental Delivery

1. Add US2 for discussion, presence, recovery, and playful interaction.
2. Add US3 for durable reports and exports.
3. Add optional AI participant with failure isolation.
4. Run Phase 7 gates and update root `TASKS.md` after every relevant implementation batch.

## Notes

- Every task has exact file path and sequential ID.
- `[P]` marks tasks with independent files and no incomplete dependency.
- `[US1]`, `[US2]`, and `[US3]` map directly to `spec.md` user stories.
- Existing partial code remains incomplete until corresponding task verification passes.
