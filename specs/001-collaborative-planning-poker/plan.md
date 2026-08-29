# Implementation Plan: Collaborative Real-Time Planning Poker

**Branch**: `001-collaborative-planning-poker` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

## Summary

Harden existing Planning Poker MVP into secure, recoverable, reportable realtime session. Preserve current
React/NestJS/Prisma/Redis foundations; complete shared contracts, server-authoritative rounds, collaboration
recovery, configurable OpenAI-compatible LLM participation, reports, exports, responsive UX, and verification.

## Technical Context

**Language/Version**: TypeScript 6, Node.js 22+, React 19

**Primary Dependencies**: React/Vite, Socket.IO 4, Zustand, Framer Motion, TailwindCSS, NestJS 12,
Prisma 6, PostgreSQL, Redis/ioredis, JWT, bcrypt, native fetch for configurable OpenAI-compatible LLM APIs

**Storage**: PostgreSQL for durable entities/reports; Redis for active-round coordination, recovery, and
Socket.IO adapter state

**Testing**: Vitest, NestJS testing utilities, Supertest, Socket.IO multi-client tests, frontend build/lint,
browser acceptance, Prisma validation, Docker Compose validation

**Target Platform**: Dockerized Linux API with PostgreSQL/Redis and modern responsive browsers

**Project Type**: Full-stack monorepo web application

**Performance Goals**: 95% of state changes visible within 2 seconds for 10 participants; 99% state recovery
within 30 seconds; server-driven timers

**Constraints**: Environment-only secrets; hidden votes before reveal; server-authoritative transitions;
versioned production migrations; no polling; graceful LLM failure; session-gated report viewing; PO/authorized
Scrum Master-only exports; provider configured by base URL, model, and key

**Scale/Scope**: Rooms up to 12 participants, optional LLM participant, 5+ stories, horizontally coordinated API

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Shared types and Socket.IO event contracts precede gateway and frontend work.
- [x] Server-authoritative timers, vote revelation, permissions, and room transitions are preserved.
- [x] PostgreSQL persistence, recovery, migrations, and Redis scaling responsibilities are explicit.
- [x] Role authorization, payload validation, secret handling, and private-room access are covered.
- [x] Verification plan covers affected layers, realtime multi-client flows, and Docker validation.
- [x] `TASKS.md` impact and `prompt.md` traceability are identified.

No violations. Provider-neutral LLM replaces earlier Anthropic-specific assumption while preserving optional AI
through an OpenAI-compatible adapter boundary.

## Phase 0: Research Decisions

- Use one provider-neutral adapter over `/chat/completions`; OpenRouter, OpenAI, Ollama, Groq, and similar
  providers configure through `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY`.
- Enforce structured JSON output, deck validation, bounded context, timeout, provider error mapping, and
  per-round request limit in backend.
- Keep human estimation functional when key/provider absent or output invalid.
- Persist active timer deadlines in `VoteRound`; use Redis for active-state coordination across instances.
- Separate report viewing authorization from export authorization.

## Phase 1: Design and Contracts

### Durable model

Use Prisma entities `User`, `Room`, `RoomConfig`, `RoomParticipant`, `Story`, `VoteRound`, `Vote`,
`ChatMessage`, and `SprintReport`. Extend `VoteRound` with timer/discussion deadline metadata and
`SprintReport` with export references. Version every schema change and preserve existing data.

### Realtime boundaries

Shared event maps define room join/configuration, story transitions, voting, timers, discussion, chat,
reactions, report readiness, and `ai:status`. Gateway validates commands, delegates durable/active state work,
and emits sanitized snapshots. Vote values stay masked before authorized reveal.

### Backend modules

```text
api/src/
├── auth/       # guest/JWT session and role authorization
├── realtime/   # state repository, round transitions, timers, presence, Redis
├── ai/         # provider-neutral LLM adapter and AI participant lifecycle
├── reports/    # aggregation, achievements, CSV/PDF renderers, REST
├── room.dto.ts
├── room.controller.ts
├── room.service.ts
└── room.gateway.ts
```

### Frontend boundaries

```text
frontend/src/
├── components/                 # connection/error/status primitives
├── features/room/              # join/configuration/story management
├── features/table/             # table, cards, presence, reactions, AI
├── features/discussion/        # chat and discussion timer
├── features/report/            # report page and exports
├── stores/app-store.ts
└── lib/socket.ts
```

### Verification

Required gates: shared contract tests, authorization/session tests, round/timer/persistence integration,
multi-client reconnect flow, report/export tests, LLM failure tests, frontend build/lint, Prisma validation,
Docker Compose config, and quickstart acceptance flow. Mark tasks complete only after relevant verification.

## Implementation Order

1. Complete setup, shared contracts, Prisma migrations, environment validation, authorization/session, and
   Redis/PostgreSQL room state.
2. Isolate round transitions/deadline timers; integrate sanitized gateway snapshots and reconnect hydration.
3. Complete US1 room/story/vote flow, then US2 collaboration/recovery.
4. Complete configurable LLM participant and explicit human fallback.
5. Complete report aggregation, authorization, CSV/PDF exports, and report frontend.
6. Finish Docker production migration behavior, redacted correlation logging, responsive/accessibility checks,
   and acceptance gates.

## Project Structure

Documentation/contracts live under `specs/001-collaborative-planning-poker/`; source remains in existing
three-part monorepo: `frontend/`, `api/`, and `packages/shared-types/`. Add focused module/test boundaries
only where ownership or verification needs them.

## Complexity Tracking

No constitution violations require exception approval. Redis coordination, provider-neutral LLM integration,
and PDF/CSV export are explicit product requirements isolated behind module boundaries.
