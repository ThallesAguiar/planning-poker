# Tasks: User Auth Rooms

**Input**: Design documents from `specs/002-user-auth-rooms/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required by plan. Add Vitest/API tests and Playwright E2E before implementation tasks where practical.

**Organization**: Tasks grouped by user story so each story can be built and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when previous phase dependencies are satisfied
- **[Story]**: User story label for story phases only
- Every task includes exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature tracking and preserve approved visual baseline.

- [ ] T001 Create visual baseline screenshots for current entry, room, dashboard, and profile views in `frontend/tests/visual-baseline.spec.ts`
- [ ] T002 [P] Add account/session environment notes to `api/.env.example`
- [ ] T003 [P] Add account/session environment notes to `.env.example`
- [ ] T004 Update implementation checklist notes in `specs/002-user-auth-rooms/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, persistence, and auth primitives required before any user story.

**Critical**: No user story work starts until this phase is complete.

- [ ] T005 Extend shared account, membership, room list, and profile request types in `packages/shared-types/src/index.ts`
- [ ] T006 Mirror generated shared declarations for account and profile types in `packages/shared-types/src/index.d.ts`
- [ ] T007 Extend `User` and `RoomParticipant` models and add `RoomProfileChangeRequest` model in `api/prisma/schema.prisma`
- [ ] T008 Create Prisma migration for account credentials, membership profile fields, last seen, and profile requests in `api/prisma/migrations/20260831000000_user_auth_rooms/migration.sql`
- [ ] T009 [P] Add auth DTOs for register, login, and account profile responses in `api/src/auth/auth.dto.ts`
- [ ] T010 [P] Add account room DTOs and profile request DTOs in `api/src/room.dto.ts`
- [ ] T011 Add account session issue/verify helpers alongside room sessions in `api/src/auth/session.service.ts`
- [ ] T012 Add password hashing and credential validation helpers in `api/src/auth/auth.service.ts`
- [ ] T013 Register `AuthService` and auth controller providers in `api/src/app.module.ts`
- [ ] T014 Add account token extraction helper for REST requests in `api/src/auth/account-session.guard.ts`
- [ ] T015 Add shared auth error code coverage in `api/src/auth/session.service.spec.ts`
- [ ] T016 [P] Add migration/model validation tests for duplicate membership and profile request states in `api/src/auth/auth.service.spec.ts`

**Checkpoint**: Contracts, schema, and account auth foundation ready.

---

## Phase 3: User Story 1 - Account Access Keeps Room History (Priority: P1) MVP

**Goal**: User can register/login, join a room, log out/in, and see joined rooms in "Minhas Salas".

**Independent Test**: Register user, join room, log out, log back in, open "Minhas Salas", reopen same room.

### Tests for User Story 1

- [ ] T017 [P] [US1] Add REST tests for `/auth/register`, duplicate email, `/auth/login`, `/auth/me`, and logout client behavior in `api/src/auth/auth.controller.spec.ts`
- [ ] T018 [P] [US1] Add REST tests for `GET /rooms/mine` returning owned and joined rooms in `api/src/room.service.spec.ts`
- [ ] T019 [P] [US1] Add Playwright E2E for register, join private room, logout/login, and room visible in "Minhas Salas" in `frontend/tests/account-rooms.spec.ts`

### Implementation for User Story 1

- [ ] T020 [US1] Implement `POST /auth/register`, `POST /auth/login`, and `GET /auth/me` in `api/src/auth/auth.controller.ts`
- [ ] T021 [US1] Implement account registration, login verification, duplicate email rejection, and safe user serialization in `api/src/auth/auth.service.ts`
- [ ] T022 [US1] Implement `GET /rooms/mine` account room listing in `api/src/room.controller.ts`
- [ ] T023 [US1] Implement owned/joined room query and response mapping in `api/src/room.service.ts`
- [ ] T024 [US1] Add account session state, login/register/logout helpers, and account token storage in `frontend/src/stores/app-store.ts`
- [ ] T025 [US1] Add auth API helper functions for register, login, me, and rooms mine in `frontend/src/lib/auth.ts`
- [ ] T026 [US1] Wire existing entry surface to register/login/logout without changing approved CSS in `frontend/src/App.tsx`
- [ ] T027 [US1] Replace mock room cards in "Minhas Salas" with authenticated `GET /rooms/mine` data in `frontend/src/features/dashboard/DashboardPages.tsx`
- [ ] T028 [US1] Add account-aware room open action from "Minhas Salas" to `/room/:code` in `frontend/src/features/dashboard/DashboardPages.tsx`

**Checkpoint**: US1 independently functional and testable.

---

## Phase 4: User Story 2 - Same User Rejoins Without Duplicates (Priority: P1)

**Goal**: Same logged-in account reenters same room as same participant, including private rooms.

**Independent Test**: Join same room 10 times with same account and confirm one participant identity.

### Tests for User Story 2

- [ ] T029 [P] [US2] Add API tests proving logged-in rejoin reuses `RoomParticipant` and reports `reusedMembership` in `api/src/room.service.spec.ts`
- [ ] T030 [P] [US2] Add gateway tests proving same account across reconnects emits one participant in `room:state` in `api/src/room.gateway.spec.ts`
- [ ] T031 [P] [US2] Add Playwright E2E for repeated same-account rejoin without duplicate participants in `frontend/tests/account-rooms.spec.ts`
- [ ] T032 [P] [US2] Add Playwright E2E for existing private-room member rejoin from "Minhas Salas" without password in `frontend/tests/account-rooms.spec.ts`

### Implementation for User Story 2

- [ ] T033 [US2] Update `POST /rooms/:id/join` to accept optional account authorization and reuse membership in `api/src/room.controller.ts`
- [ ] T034 [US2] Update join session logic to use registered `userId`, reuse `(roomId,userId)`, set `lastSeenAt`, and avoid duplicate participant creation in `api/src/room.service.ts`
- [ ] T035 [US2] Add `POST /rooms/:id/rejoin` member-only session issuance in `api/src/room.controller.ts`
- [ ] T036 [US2] Implement member-only private-room rejoin and room-session issuance in `api/src/room.service.ts`
- [ ] T037 [US2] Update websocket `room:join` to trust valid account-backed room session and reuse participant state in `api/src/room.gateway.ts`
- [ ] T038 [US2] Send account token on join/rejoin requests and prefer rejoin for saved rooms in `frontend/src/App.tsx`
- [ ] T039 [US2] Ensure room token/session storage is keyed by account and room to avoid guest/account collision in `frontend/src/App.tsx`

**Checkpoint**: US1 and US2 work independently and together.

---

## Phase 5: User Story 3 - Profile Changes Require Host Permission In Room (Priority: P2)

**Goal**: Participant requests room profile change; host approves/rejects; approved change updates table for everyone.

**Independent Test**: Non-host requests name/avatar/role change, host approves, all clients see update; reject path keeps previous state.

### Tests for User Story 3

- [ ] T040 [P] [US3] Add service tests for creating, approving, rejecting, and forbidding invalid profile requests in `api/src/room.service.spec.ts`
- [ ] T041 [P] [US3] Add gateway tests for `room:profileRequest`, `room:profileRequestPending`, and `room:profileDecision` in `api/src/room.gateway.spec.ts`
- [ ] T042 [P] [US3] Add Playwright multi-user E2E for profile request approval and rejection in `frontend/tests/profile-approval.spec.ts`

### Implementation for User Story 3

- [ ] T043 [US3] Implement profile request persistence and host decision methods in `api/src/room.service.ts`
- [ ] T044 [US3] Add `GET /rooms/:id/profile-requests` host-only endpoint in `api/src/room.controller.ts`
- [ ] T045 [US3] Add `room:profileRequest` and `room:profileDecision` handlers with host authorization in `api/src/room.gateway.ts`
- [ ] T046 [US3] Emit `room:profileRequestPending`, `room:profileDecision`, and updated `room:state` from `api/src/room.gateway.ts`
- [ ] T047 [US3] Add room profile request client handlers and pending request state in `frontend/src/stores/app-store.ts`
- [ ] T048 [US3] Add request/approval controls to existing room UI without changing approved layout styles in `frontend/src/App.tsx`
- [ ] T049 [US3] Show pending profile requests for host and decision feedback for requester in `frontend/src/App.tsx`

**Checkpoint**: US3 independently functional after foundational account/session work.

---

## Phase 6: User Story 4 - Account Session Does Not Change Current Visual Design (Priority: P3)

**Goal**: Account, room history, rejoin, and profile behavior keep current approved visual design.

**Independent Test**: Compare entry/table/dashboard/profile visual shell before and after feature; only account/profile controls changed.

### Tests for User Story 4

- [ ] T050 [P] [US4] Add Playwright screenshot assertions for entry screen visual shell in `frontend/tests/visual-baseline.spec.ts`
- [ ] T051 [P] [US4] Add Playwright screenshot assertions for room table visual shell in `frontend/tests/visual-baseline.spec.ts`
- [ ] T052 [P] [US4] Add Playwright screenshot assertions for "Minhas Salas" and profile visual shell in `frontend/tests/visual-baseline.spec.ts`

### Implementation for User Story 4

- [ ] T053 [US4] Audit account controls to reuse existing classes and avoid broad CSS changes in `frontend/src/App.tsx`
- [ ] T054 [US4] Audit dashboard/profile account data bindings without changing card/sidebar visual styles in `frontend/src/features/dashboard/DashboardPages.tsx`
- [ ] T055 [US4] Update visual baseline notes with intentional account/profile control deltas in `specs/002-user-auth-rooms/quickstart.md`

**Checkpoint**: Behavior changed; approved visual style preserved.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security, docs, validation, and final gates across stories.

- [ ] T056 [P] Add auth and membership contract notes to `README.md`
- [ ] T057 Verify no password hash, token secret, or room password leaks in REST or realtime responses in `api/src/auth/auth.controller.spec.ts`
- [ ] T058 Verify invalid/expired account sessions are rejected for `GET /rooms/mine`, `/rooms/:id/rejoin`, and profile requests in `api/src/auth/auth.controller.spec.ts`
- [ ] T059 Run `npx prisma validate` from `api`
- [ ] T060 Run `npm run build` from `api`
- [ ] T061 Run `npm test` from `api`
- [ ] T062 Run `npm run build` from `frontend`
- [ ] T063 Run `npm run lint` from `frontend`
- [ ] T064 Run Playwright account and room entry E2E from `frontend`
- [ ] T065 Run `docker compose config --quiet` from repository root
- [ ] T066 Update root project status for implemented and verified feature work in `TASKS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1; blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2; MVP.
- **Phase 4 US2**: Depends on Phase 2 and integrates with US1 account session behavior.
- **Phase 5 US3**: Depends on Phase 2 and needs room membership identity from US2 for full value.
- **Phase 6 US4**: Can start after first frontend account controls exist, but final pass depends on US1-US3.
- **Phase 7 Polish**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1**: First MVP; account access and room history.
- **US2**: Can begin after foundation, but final flow depends on US1 auth/session.
- **US3**: Depends on stable membership identity and host authorization.
- **US4**: Cross-checks all visible work.

### Within Each User Story

- Tests before implementation where listed.
- Data/model changes before service changes.
- Services before REST/gateway endpoints.
- Backend contracts before frontend consumers.
- Story checkpoint before next priority is marked complete.

### Parallel Opportunities

- T002-T003 can run in parallel.
- T009-T010 and T016 can run in parallel after schema plan is known.
- T017-T019 can run in parallel for US1 test coverage.
- T029-T032 can run in parallel for US2 test coverage.
- T040-T042 can run in parallel for US3 test coverage.
- T050-T052 can run in parallel for US4 visual checks.
- T056-T058 can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
Task: "T017 [US1] Add REST tests for auth controller in api/src/auth/auth.controller.spec.ts"
Task: "T018 [US1] Add REST tests for rooms mine in api/src/room.service.spec.ts"
Task: "T019 [US1] Add Playwright E2E in frontend/tests/account-rooms.spec.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "T029 [US2] Add API tests for membership reuse in api/src/room.service.spec.ts"
Task: "T030 [US2] Add gateway tests for reconnect identity in api/src/room.gateway.spec.ts"
Task: "T031 [US2] Add Playwright repeated rejoin E2E in frontend/tests/account-rooms.spec.ts"
```

---

## Parallel Example: User Story 3

```bash
Task: "T040 [US3] Add profile request service tests in api/src/room.service.spec.ts"
Task: "T041 [US3] Add profile request gateway tests in api/src/room.gateway.spec.ts"
Task: "T042 [US3] Add Playwright profile approval E2E in frontend/tests/profile-approval.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 US1.
4. Stop and validate registration, login, room history, and reopen room from "Minhas Salas".

### Incremental Delivery

1. US1: persistent account and room history.
2. US2: duplicate-free rejoin and private member rejoin.
3. US3: host-approved room profile changes.
4. US4: visual style preservation checks.

### Notes

- Do not use root `TASKS.md` as source of implementation tasks for this feature.
- Update root `TASKS.md` only after actual implementation or verification changes.
- Do not alter current visual styling except minimal controls required by account/profile behavior.
- Preserve guest room entry while adding registered account behavior.
