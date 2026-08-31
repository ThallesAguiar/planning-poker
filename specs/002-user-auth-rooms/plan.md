# Implementation Plan: User Auth Rooms

**Branch**: `001-collaborative-planning-poker` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-user-auth-rooms/spec.md`

## Summary

Add persistent user accounts and room membership recovery to the existing Planning Poker app. Registered users can sign up, log in, see rooms they own or joined, and rejoin the same room as the same participant. Guest entry stays available. Room profile edits become request/approval actions controlled by the room host. Current entry/table/dashboard styling must be preserved; implementation may only add behavior and minimal controls needed for the new flows.

## Technical Context

**Language/Version**: TypeScript 6, Node.js 22+, React 19

**Primary Dependencies**: React/Vite, Socket.IO 4, Zustand, Framer Motion, TailwindCSS, NestJS 12, Prisma 6, PostgreSQL, Redis/ioredis, JWT, bcrypt, class-validator, Playwright, Vitest

**Storage**: PostgreSQL for users, credentials, memberships, profile change requests, and room history; Redis remains active room/snapshot coordination

**Testing**: Vitest unit/integration tests for auth, room membership, and profile approvals; Playwright Chromium E2E for signup/login, room list, rejoin without duplicates, private-room access, and no visual flow regression; frontend build/lint; API build/test; Prisma validate; Docker Compose config

**Target Platform**: Dockerized Linux API with PostgreSQL/Redis and modern desktop browsers

**Project Type**: Full-stack monorepo web application

**Performance Goals**: Returning user finds and reopens joined room in under 30 seconds; approved profile changes visible to active room participants within 2 seconds; auth/session checks add no visible delay to room entry in normal local/dev conditions

**Constraints**: Preserve current visual design and layout; support guest entry; wrong-password non-members never enter table; registered members rejoin private rooms without password; same account must map to one room participant; host approval required for in-room profile changes; use spec-local tasks for this feature

**Scale/Scope**: Existing room scale up to 12 participants; account and membership flows for MVP, including one account credential method, room list, membership reuse, and profile approval state

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Shared types and Socket.IO event contracts precede gateway and frontend work.
- [x] Server-authoritative timers, vote revelation, permissions, and room transitions are preserved.
- [x] PostgreSQL persistence, recovery, migrations, and Redis scaling responsibilities are explicit.
- [x] Role authorization, payload validation, secret handling, and private-room access are covered.
- [x] Verification plan covers affected layers, realtime multi-client flows, and Docker validation.
- [x] `TASKS.md` impact and prompt traceability are identified.

No violations. Root `TASKS.md` remains project status reference, but this feature's implementation tasks must be generated from `specs/002-user-auth-rooms/tasks.md` after `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/002-user-auth-rooms/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- rest-auth-rooms.md
|   `-- realtime-profile.md
`-- tasks.md
```

### Source Code (repository root)

```text
api/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
`-- src/
    |-- auth/
    |-- room.controller.ts
    |-- room.dto.ts
    |-- room.gateway.ts
    `-- room.service.ts

frontend/
`-- src/
    |-- App.tsx
    |-- features/dashboard/
    |-- routes.tsx
    |-- stores/app-store.ts
    `-- lib/socket.ts

packages/shared-types/
`-- src/index.ts
```

**Structure Decision**: Keep existing monorepo boundaries. Add auth/session/account behavior inside `api/src/auth/`, durable membership behavior in room service/gateway, frontend behavior in existing entry/dashboard/table screens, and shared contracts in `packages/shared-types/src/index.ts`. Do not create a new app or visual system.

## Complexity Tracking

No constitution violations require exception approval.

## Phase 0: Research Decisions

See [research.md](./research.md).

## Phase 1: Design and Contracts

See [data-model.md](./data-model.md), [contracts/rest-auth-rooms.md](./contracts/rest-auth-rooms.md), [contracts/realtime-profile.md](./contracts/realtime-profile.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

- [x] Shared account, membership, auth, and profile-approval contracts are identified before implementation.
- [x] Room join and profile mutation remain server-authoritative.
- [x] Durable user/membership/profile-request storage uses PostgreSQL with migration requirement.
- [x] Private-room password rules, JWT/session identity, host approval, and duplicate prevention are covered.
- [x] Verification covers API, gateway, frontend flows, and no-style-change acceptance.
- [x] `prompt.md` traceability preserved: authentication is optional/lightweight in original scope and now becomes required for saved room history.

No violations.

## Implementation Order

1. Extend shared contracts for account session, room membership, room list, and profile request events.
2. Add PostgreSQL fields/models and migration for registered credentials and room profile change requests.
3. Add REST auth/account endpoints and room list/member rejoin endpoints.
4. Update room join logic so registered account identity reuses existing participant and private-room members bypass password.
5. Add realtime profile request/approval events with host-only decisions and room snapshot update.
6. Wire frontend login/register/logout, room list data, membership-aware entry, and profile request behavior without changing approved visual style.
7. Add unit/integration/E2E coverage, then run build/lint/Prisma/Docker gates.
