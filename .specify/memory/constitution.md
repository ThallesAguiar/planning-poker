<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified constraints: Anthropic-specific AI integration -> configurable provider-neutral LLM integration
- Version change: unversioned template -> 1.0.0
- Modified principles: template placeholders -> all five project principles below
- Added sections: Technology and Product Constraints; Delivery and Quality Gates
- Removed sections: none
- Templates requiring updates: ✅ .specify/templates/plan-template.md; ✅ .specify/templates/tasks-template.md;
  ✅ .specify/templates/spec-template.md (validated); ✅ .specify/templates/commands/ (none present);
  ✅ README.md (validated)
- Follow-up TODOs: ratification date remains TODO because repository history does not identify the
  original governance adoption date.
-->

# Planning Poker Constitution

## Core Principles

### I. Shared Contracts First

Shared domain types and Socket.IO event contracts MUST be defined before dependent gateway and
frontend behavior. Backend and frontend MUST consume the shared contracts instead of maintaining
incompatible local copies. Contract changes MUST document compatibility impact and update consumers
in the same change. This keeps realtime behavior coherent across the monorepo.

### II. Server-Authoritative Realtime

The backend MUST remain the source of truth for room state, permissions, vote visibility, timers,
revelation, discussion transitions, and final story values. Clients MUST render authoritative events
and MUST NOT decide critical timing or reveal conditions locally. Reconnection MUST restore the latest
persisted or recoverable room snapshot without losing room history. This prevents divergent game state
and protects voting integrity.

### III. Persistence and Recovery

Rooms, participants, stories, vote rounds, votes, chat messages, and sprint reports MUST be persisted
in PostgreSQL. Operational state needed for active rounds and horizontal scaling MUST use the approved
shared state path, including Redis where required. Startup and reconnection flows MUST define how state
is restored. Development shortcuts such as `prisma db push` MUST NOT replace versioned migrations in
production. This makes sessions auditable and resumable.

### IV. Secure Role-Bound Actions

Administrative operations MUST validate authenticated or guest session identity, room membership,
payloads, and role permissions on the server. PO-only actions MUST reject unauthorized participants;
configurable Scrum Master permissions MUST be enforced when enabled. Secrets MUST come from environment
configuration and MUST NOT be hardcoded in source or images. Passwords and tokens MUST be stored and
handled using appropriate one-way hashing or secure token practices. This protects room control and
participant data.

### V. Verified, Playful Product Quality

Every completed behavior MUST have verification appropriate to its layer, including contract,
integration, realtime, frontend, or export tests where applicable. Changes MUST preserve the primary
user journey: create or join a room, estimate collaboratively, discuss divergence, finalize stories,
and produce a report. Frontend work MUST include accessible, responsive states and the specified
game-like interaction quality, including motion or feedback where relevant. Tests and documented
manual checks MUST pass before work is marked complete. This balances reliable delivery with the
product's required fun and visual quality.

## Technology and Product Constraints

The v1 system MUST use React with Vite, TypeScript, Socket.IO client, Zustand or Redux Toolkit,
Framer Motion, and TailwindCSS for the frontend; NestJS, TypeScript, REST, and a Socket.IO gateway
for the backend; PostgreSQL with Prisma or TypeORM for persistence; Redis integration for realtime
scaling; JWT for lightweight authentication; and an isolated configurable LLM integration for the AI
participant, using an OpenAI-compatible endpoint or a provider-specific adapter when required. The API MUST run in a multi-stage Docker image. Development Compose MUST provide API,
PostgreSQL, and Redis services, healthchecks, healthy dependencies, environment-based secrets, and
automatic development migrations.

The product MUST support room configuration, role permissions, private-room access, server timers,
hidden votes before reveal, discussion and revote flows, chat, reconnection, AI participation when
enabled, and persistent sprint reporting. PDF and CSV export, historical reports, and full account
login MAY be delivered incrementally when their contracts and fallback behavior are explicit.

## Delivery and Quality Gates

Work MUST follow dependency order: shared data model and event contracts, persistence, backend REST
and gateway, frontend, AI, then reports and exports. Each change MUST identify affected layers and
update `TASKS.md` in its layer-oriented tracking format. A task MAY be marked complete only after its
implementation is verified; scaffolding, mocks, and partial flows MUST remain marked partial or
pending. Before merge, run relevant builds, lint, unit tests, contract or integration tests, and
Docker validation. Realtime changes MUST include multi-client or equivalent event-flow verification,
and security-sensitive changes MUST include authorization and secret-handling checks.

## Governance

This constitution governs architecture, implementation, testing, and completion claims. When another
document conflicts with it, this constitution takes precedence unless an amendment explicitly changes
the rule. Amendments MUST state motivation, affected principles, migration or compatibility impact,
and verification plan. The maintainer MUST update dependent templates, runtime guidance, and
`TASKS.md`, then review the result against `prompt.md`.

Versioning follows semantic versioning: MAJOR for incompatible governance or principle removal or
redefinition, MINOR for new principles or materially expanded mandatory scope, and PATCH for
clarifications or non-semantic wording changes. Compliance MUST be reviewed at feature planning,
implementation completion, and release review. Reviewers MUST reject unsupported completion claims,
missing persistence or authorization checks, and unverified realtime behavior.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date unknown | **Last Amended**: 2026-08-28
