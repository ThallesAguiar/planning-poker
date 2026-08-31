# Implementation Plan: User Auth Rooms

**Branch**: `002-user-auth-rooms` | **Date**: 2026-08-31 | **Spec**: `specs/002-user-auth-rooms/spec.md`

**Input**: Feature specification from `specs/002-user-auth-rooms/spec.md`

## Summary

Add persistent account authentication to existing Planning Poker flow without changing approved visuals, so registered users can log in, keep room memberships, reopen rooms from "Minhas Salas", avoid duplicate participants on rejoin, and update room name/avatar directly while role changes still require host approval.

## Technical Context

**Language/Version**: TypeScript 6, React 19, NestJS 12, Node.js runtime in Docker

**Primary Dependencies**: React Router 7, Zustand 5, Socket.IO client/server 4, Framer Motion 12, NestJS WebSockets, Prisma 6, bcrypt 6, jsonwebtoken 9, ioredis 6

**Storage**: PostgreSQL 16 via Prisma, Redis 7 for realtime scaling/session coordination

**Testing**: Vitest for API and service tests, Playwright for frontend end-to-end flows, oxlint for linting, Prisma validation

**Target Platform**: Docker Compose local development, browser frontend served by Vite/nginx, NestJS API container

**Project Type**: Monorepo web application with frontend, backend API/gateway, and shared types package

**Performance Goals**: Reopen saved room in under 30 seconds for 95% of returning users, propagate approved role changes or direct room profile updates to active participants within 2 seconds, keep duplicate prevention stable across 10 consecutive rejoins for same account

**Constraints**: Preserve current visual layout and table styling, keep server authoritative for membership and permissions, require private-room password only for non-members, expire account sessions after 12 hours, use feature-local spec/tasks as planning source

**Scale/Scope**: Existing Planning Poker product with room entry, poker table, dashboard, reports, AI participant, and multi-client realtime behavior; feature spans auth, persistence, REST, websocket session restore, and frontend account flows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Shared types and Socket.IO event contracts precede gateway and frontend work. Pass: account session and membership identity need shared typing before gateway/frontend updates.
- Server-authoritative timers, vote revelation, permissions, and room transitions are preserved. Pass: auth feature reuses server authority for membership reuse, private-room validation, and role approval.
- PostgreSQL persistence, recovery, migrations, and Redis scaling responsibilities are explicit. Pass: persistent users/memberships live in PostgreSQL; reconnect/session coordination remains explicit for Redis-backed realtime path.
- Role authorization, payload validation, secret handling, and private-room access are covered. Pass: login tokens, password hashing, room-password enforcement, and host-only role approval are mandatory design scope.
- Verification plan covers affected layers, realtime multi-client flows, and Docker validation. Pass: API, frontend, Playwright, Prisma, and multi-client rejoin flows are included.
- `TASKS.md` impact and prompt traceability are identified. Pass: feature uses `specs/002-user-auth-rooms/tasks.md` for implementation tasks; root `TASKS.md` remains tracking artifact, not task source.

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
|-- src/
|   |-- auth/
|   |-- realtime/
|   |-- reports/
|   |-- ai/
|   |-- app.module.ts
|   |-- room.controller.ts
|   |-- room.dto.ts
|   |-- room.gateway.ts
|   `-- room.service.ts
`-- test/

frontend/
|-- src/
|   |-- features/
|   |   |-- dashboard/
|   |   |-- report/
|   |   |-- room/
|   |   `-- table/
|   |-- lib/
|   |-- stores/
|   |-- App.tsx
|   `-- routes.tsx
`-- tests/
    `-- room-entry.spec.ts

packages/
`-- shared-types/
    `-- package.json
```

**Structure Decision**: Keep current monorepo split. Add auth and membership persistence in `api`, reuse shared contracts in `packages/shared-types`, extend dashboard/entry/table behavior in `frontend`, and verify flows with existing Playwright suite plus API/Vitest coverage.

## Phase 0: Research

Research decisions resolved:

- Email/password is first account identity method.
- Registered account identity is duplicate-prevention boundary for room rejoin.
- Guest flow remains available, with in-session guest-to-account claim for current membership.
- Existing members rejoin private rooms without re-entering password.
- Direct room name/avatar changes apply immediately; only room role changes require host approval.
- Visual surfaces remain unchanged except controls strictly needed for auth/profile behavior.

## Phase 1: Design & Contracts

Design artifacts required:

- `research.md`: finalized decisions and rejected alternatives
- `data-model.md`: account, guest, membership, role request, and account session model
- `contracts/rest-auth-rooms.md`: auth, room join/rejoin, saved-room, and direct room profile update contract
- `contracts/realtime-profile.md`: direct room profile update broadcast and host-approved role request events
- `quickstart.md`: manual and automated validation path

Agent context requirement:

- `AGENTS.md` must keep pointing to `specs/002-user-auth-rooms/plan.md`

## Post-Design Constitution Check

- Shared contract first: preserved by explicit REST and realtime contract updates before implementation.
- Server authority: preserved; client only requests join/rejoin/profile/role actions.
- Persistence and recovery: preserved; memberships survive logout and reconnect, while active browser room session disconnects on logout.
- Secure role-bound actions: preserved; room role changes require host decision, direct room profile changes stay scoped to caller membership.
- Verified quality: preserved; plan includes API tests, multi-client/rejoin checks, wrong-password checks, and Playwright coverage.
- Task tracking: preserved; implementation work should sync `specs/002-user-auth-rooms/tasks.md` and reflect real completion in root `TASKS.md`.

## Complexity Tracking

No constitution violations identified. No additional complexity exemptions required.
