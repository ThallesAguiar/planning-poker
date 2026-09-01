# Tasks: User Auth Rooms

**Input**: Design documents from `specs/002-user-auth-rooms/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by spec and plan. Add API/Vitest and Playwright coverage for each user story.

**Organization**: Tasks grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after current phase dependencies are satisfied
- **[Story]**: Present only in user story phases
- Every task includes exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding, environment notes, and visual baseline checks.

- [X] T001 Add account/session environment placeholders to `.env.example`
- [X] T002 [P] Add account/session environment placeholders to `api/.env.example`
- [X] T003 [P] Create Playwright visual shell baseline spec in `frontend/tests/visual-baseline.spec.ts`
- [X] T004 Record auth-room validation flow updates in `specs/002-user-auth-rooms/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts, persistence, auth primitives, and server session rules.

**Critical**: No user story work begins until this phase is complete.

- [X] T005 Extend shared auth, membership, room list, and role-request types in `packages/shared-types/src/index.ts`
- [X] T006 Mirror shared type declarations in `packages/shared-types/src/index.d.ts`
- [X] T007 Extend `User` and `RoomParticipant` models for account auth and room profile fields in `api/prisma/schema.prisma`
- [X] T008 Add `RoomRoleChangeRequest` persistence model in `api/prisma/schema.prisma`
- [X] T009 Create Prisma migration for auth fields, membership profile fields, last-seen tracking, and role requests in `api/prisma/migrations/20260831000000_user_auth_rooms/migration.sql`
- [X] T010 [P] Add account auth DTOs in `api/src/auth/auth.dto.ts`
- [X] T011 [P] Extend room join, room list, room profile, and role request DTOs in `api/src/room.dto.ts`
- [X] T012 Add account token issue/verify helpers with 12-hour expiry in `api/src/auth/session.service.ts`
- [X] T013 Add account authorization helper for REST and websocket flows in `api/src/auth/authorization.service.ts`
- [X] T014 Create account auth service for hashing, credential validation, and safe serialization in `api/src/auth/auth.service.ts`
- [X] T015 Create auth controller for register, login, logout, and me endpoints in `api/src/auth/auth.controller.ts`
- [X] T016 Register auth providers and controller in `api/src/app.module.ts`
- [X] T017 [P] Add session and authorization coverage for account token expiry in `api/src/auth/session.service.spec.ts`
- [X] T018 [P] Add auth service coverage for password hashing and duplicate email rejection in `api/src/auth/auth.service.spec.ts`

**Checkpoint**: Shared contracts, schema, auth primitives, and session rules ready.

---

## Phase 3: User Story 1 - Account Access Keeps Room History (Priority: P1) MVP

**Goal**: User registers or logs in, joins room, logs out/in, and sees joined rooms in "Minhas Salas".

**Independent Test**: Register user, join room, log out, log back in, open "Minhas Salas", reopen same room.

### Tests for User Story 1

- [ ] T019 [P] [US1] Add auth controller tests for register, login, me, logout, duplicate email, and short password in `api/src/auth/auth.controller.spec.ts`
- [ ] T020 [P] [US1] Add room listing tests for `GET /rooms/mine` in `api/src/room.service.spec.ts`
- [ ] T021 [P] [US1] Add Playwright flow for register, join, logout/login, and saved rooms in `frontend/tests/account-rooms.spec.ts`

### Implementation for User Story 1

- [X] T022 [US1] Implement `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me` in `api/src/auth/auth.controller.ts`
- [X] T023 [US1] Implement account registration, login verification, guest-claim hook, and logout invalidation in `api/src/auth/auth.service.ts`
- [X] T024 [US1] Implement `GET /rooms/mine` in `api/src/room.controller.ts`
- [X] T025 [US1] Implement owned/joined room query and response mapping in `api/src/room.service.ts`
- [X] T026 [US1] Add account API client helpers in `frontend/src/lib/auth.ts`
- [X] T027 [US1] Extend app store with account session, auth actions, and saved-room loading in `frontend/src/stores/app-store.ts`
- [X] T028 [US1] Wire login, register, logout, and session restore on existing entry surface in `frontend/src/App.tsx`
- [X] T029 [US1] Replace mock "Minhas Salas" data with authenticated account room data in `frontend/src/features/dashboard/DashboardPages.tsx`
- [X] T030 [US1] Open saved rooms from dashboard with account-aware navigation in `frontend/src/features/dashboard/DashboardPages.tsx`

**Checkpoint**: US1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Same User Rejoins Without Duplicates (Priority: P1)

**Goal**: Same logged-in account rejoins same room as same participant, including private rooms.

**Independent Test**: Rejoin same room repeatedly with same account and confirm one participant identity.

### Tests for User Story 2

- [ ] T031 [P] [US2] Add room service tests for membership reuse and wrong-password rejection for non-members in `api/src/room.service.spec.ts`
- [ ] T032 [P] [US2] Add gateway tests for reconnecting same account without duplicate participants in `api/src/room.gateway.spec.ts`
- [ ] T033 [P] [US2] Add Playwright flow for same-account rejoin without duplicates in `frontend/tests/account-rooms.spec.ts`
- [ ] T034 [P] [US2] Add Playwright flow for private-room member rejoin from "Minhas Salas" without password in `frontend/tests/account-rooms.spec.ts`

### Implementation for User Story 2

- [X] T035 [US2] Update `POST /rooms/:id/join` to accept account session and reuse membership in `api/src/room.controller.ts`
- [X] T036 [US2] Implement membership reuse, guest/account separation, and `lastSeenAt` updates in `api/src/room.service.ts`
- [X] T037 [US2] Implement `POST /rooms/:id/rejoin` in `api/src/room.controller.ts`
- [X] T038 [US2] Implement member-only room-session issuance for saved rooms in `api/src/room.service.ts`
- [X] T039 [US2] Update websocket join/reconnect flow to restore existing participant state in `api/src/room.gateway.ts`
- [X] T040 [US2] Persist room session keys by account and room to prevent guest/account collisions in `frontend/src/stores/app-store.ts`
- [X] T041 [US2] Send account token on join and use rejoin path for saved rooms in `frontend/src/App.tsx`
- [X] T042 [US2] Ensure dashboard room-entry actions prefer account rejoin without password in `frontend/src/features/dashboard/DashboardPages.tsx`

**Checkpoint**: US1 and US2 work independently and together.

---

## Phase 5: User Story 3 - Role Changes Require Host Permission In Room (Priority: P2)

**Goal**: Participant updates room name/avatar directly and requests role changes that host approves or rejects.

**Independent Test**: Change name/avatar directly, request role change, host approves or rejects, all clients reflect correct result.

### Tests for User Story 3

- [ ] T043 [P] [US3] Add service tests for direct room profile update and role request lifecycle in `api/src/room.service.spec.ts`
- [ ] T044 [P] [US3] Add gateway tests for `room:profileUpdate`, `room:roleChangeRequest`, and `room:profileDecision` in `api/src/room.gateway.spec.ts`
- [ ] T045 [P] [US3] Add Playwright multi-user flow for direct profile update and host role approval in `frontend/tests/profile-approval.spec.ts`
- [ ] T046 [P] [US3] Add Playwright rejection flow for denied role change in `frontend/tests/profile-approval.spec.ts`

### Implementation for User Story 3

- [X] T047 [US3] Implement `PATCH /rooms/:id/members/me` in `api/src/room.controller.ts`
- [X] T048 [US3] Implement direct room display name/avatar update in `api/src/room.service.ts`
- [X] T049 [US3] Implement role-request persistence, host decision, and requester notification in `api/src/room.service.ts`
- [X] T050 [US3] Implement host-only `GET /rooms/:id/profile-requests` in `api/src/room.controller.ts`
- [X] T051 [US3] Add `room:profileUpdate`, `room:roleChangeRequest`, and `room:profileDecision` handlers in `api/src/room.gateway.ts`
- [X] T052 [US3] Broadcast updated `room:state`, pending requests, and decision events from `api/src/room.gateway.ts`
- [ ] T053 [US3] Extend room store state for direct profile edits, pending role requests, and decision feedback in `frontend/src/stores/app-store.ts`
- [ ] T054 [US3] Add direct room profile edit controls without layout redesign in `frontend/src/App.tsx`
- [ ] T055 [US3] Add host queue and requester decision feedback UI in `frontend/src/App.tsx`

**Checkpoint**: US3 independently functional on top of foundational auth/session work.

---

## Phase 6: User Story 4 - Account Session Does Not Change Current Visual Design (Priority: P3)

**Goal**: Account, room history, rejoin, and profile behavior preserve current approved visuals.

**Independent Test**: Compare entry, room, dashboard, and profile shells before and after implementation; only minimal auth/profile controls differ.

### Tests for User Story 4

- [ ] T056 [P] [US4] Add Playwright screenshot assertions for entry shell in `frontend/tests/visual-baseline.spec.ts`
- [ ] T057 [P] [US4] Add Playwright screenshot assertions for room shell in `frontend/tests/visual-baseline.spec.ts`
- [ ] T058 [P] [US4] Add Playwright screenshot assertions for dashboard and profile shells in `frontend/tests/visual-baseline.spec.ts`

### Implementation for User Story 4

- [ ] T059 [US4] Audit auth controls to reuse current layout classes in `frontend/src/App.tsx`
- [ ] T060 [US4] Audit dashboard and profile bindings without broad style changes in `frontend/src/features/dashboard/DashboardPages.tsx`
- [ ] T061 [US4] Record intentional visual deltas for auth/profile controls in `specs/002-user-auth-rooms/quickstart.md`

**Checkpoint**: Feature behavior added without unintended visual regressions.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, documentation, validation, and project tracking.

- [ ] T062 [P] Add auth and room-membership notes to `README.md`
- [ ] T063 [P] Verify REST and realtime responses never expose password hashes or room password hashes in `api/src/auth/auth.controller.spec.ts`
- [ ] T064 [P] Verify expired account sessions are rejected for room-list, rejoin, and role-request flows in `api/src/auth/auth.controller.spec.ts`
- [X] T065 Run `npx prisma validate` in `api`
- [X] T066 Run `npm run build` in `api`
- [X] T067 Run `npm test` in `api`
- [X] T068 Run `npm run build` in `frontend`
- [X] T069 Run `npm run lint` in `frontend`
- [ ] T070 Run Playwright account, room-entry, profile, and visual specs in `frontend`
- [X] T071 Run `docker compose config --quiet` in repository root
- [X] T072 Update implementation status and verification notes in `TASKS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2 and is MVP.
- **Phase 4 US2**: Depends on Phase 2 and final integration depends on US1 auth/session flow.
- **Phase 5 US3**: Depends on Phase 2 and benefits from US2 stable membership reuse.
- **Phase 6 US4**: Depends on visible frontend changes from US1-US3.
- **Phase 7 Polish**: Depends on desired story completion.

### User Story Dependencies

- **US1**: First deliverable for persistent identity and room history.
- **US2**: Requires account session from US1 to prove duplicate-free rejoin.
- **US3**: Requires stable room membership identity and host authorization.
- **US4**: Verifies visual preservation across all previous stories.

### Within Each User Story

- Tests first where practical.
- Persistence and service changes before controllers and gateway handlers.
- Backend contracts before frontend consumers.
- Story checkpoint before marking next phase complete.

### Parallel Opportunities

- T002-T003 can run in parallel.
- T010-T011 and T017-T018 can run in parallel after schema direction is fixed.
- T019-T021 can run in parallel for US1.
- T031-T034 can run in parallel for US2.
- T043-T046 can run in parallel for US3.
- T056-T058 can run in parallel for US4.
- T062-T064 can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
Task: "T019 [US1] Add auth controller tests in api/src/auth/auth.controller.spec.ts"
Task: "T020 [US1] Add room list tests in api/src/room.service.spec.ts"
Task: "T021 [US1] Add Playwright account flow in frontend/tests/account-rooms.spec.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "T031 [US2] Add room service rejoin tests in api/src/room.service.spec.ts"
Task: "T032 [US2] Add gateway duplicate-prevention tests in api/src/room.gateway.spec.ts"
Task: "T033 [US2] Add Playwright same-account rejoin flow in frontend/tests/account-rooms.spec.ts"
```

---

## Parallel Example: User Story 3

```bash
Task: "T043 [US3] Add room service profile/role tests in api/src/room.service.spec.ts"
Task: "T044 [US3] Add gateway profile/role event tests in api/src/room.gateway.spec.ts"
Task: "T045 [US3] Add Playwright approval flow in frontend/tests/profile-approval.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete Phase 3.
4. Validate registration, login, logout, saved rooms, and reopen room flow.

### Incremental Delivery

1. Deliver US1 for persistent account and room history.
2. Deliver US2 for duplicate-free rejoin and private member rejoin.
3. Deliver US3 for direct room profile edit plus host-approved role changes.
4. Deliver US4 for visual preservation checks.

### Notes

- Use `specs/002-user-auth-rooms/tasks.md` as task source for this feature.
- Update root `TASKS.md` only after real implementation and verification.
- Preserve guest entry flow while adding registered account behavior.
- Do not change approved visual style beyond minimal auth/profile controls.
