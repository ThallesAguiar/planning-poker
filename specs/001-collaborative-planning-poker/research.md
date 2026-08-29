# Research: Collaborative Real-Time Planning Poker

## Decision: Preserve current monorepo and harden incrementally

**Rationale**: Repository already contains working NestJS, React, Prisma, Socket.IO, Redis, Docker,
and shared-type foundations. Incremental hardening reduces regression risk and matches constitution
simplicity and verification gates.

**Alternatives considered**: Rebuild from new framework structure; rejected because it discards
verified room and smoke-test behavior without adding user value.

## Decision: Shared TypeScript contract is canonical

**Rationale**: Both applications are TypeScript and already import `packages/shared-types`. Define
payloads, snapshots, errors, roles, vote values, timers, and reports there. Gateway maps Prisma
records into public types instead of exporting database shapes.

**Alternatives considered**: Duplicate DTOs; rejected because current drift (`cafe` versus `café`,
`role` versus `papel`) threatens realtime safety.

## Decision: Server state machine plus durable event facts

**Rationale**: Atomic transitions are needed for present, vote, reveal, discussion, revote, finalize,
skip, and close. PostgreSQL stores durable facts; Redis stores active coordination and Socket.IO
fanout. Each transition validates phase and role, writes required records, then broadcasts sanitized
snapshot.

**Alternatives considered**: Client-led transitions or pure Redis state; rejected because integrity,
durable reports, and recovery require server and PostgreSQL authority.

## Decision: Reconnection uses signed session identity and snapshot hydration

**Rationale**: Guest session ID or JWT identifies participant; join rehydrates participant, active
round, timer deadline, and ordered messages. Remaining time derives from server deadline, never client
ticks.

**Alternatives considered**: Browser-local state or polling; rejected because they lose history and
violate realtime requirements.

## Decision: Authorization policy centralized in gateway/service

**Rationale**: Role checks must apply equally to Socket.IO and REST. Policy maps action to owner,
permitted Scrum Master action, voter eligibility, and closed-room behavior. Validation rejects bad
room, story, phase, deck value, membership, or payload before mutation.

**Alternatives considered**: UI-only hiding; rejected because it cannot protect room control.

## Decision: Report visibility follows room membership

**Rationale**: Any participant with valid room session may inspect closed-session learning data;
exports remain restricted to PO or explicitly authorized Scrum Master. This matches collaboration
needs while limiting bulk data extraction.

**Alternatives considered**: Public link access; rejected because chat, participation, and estimates
may contain private team information.

## Decision: Configurable LLM provider behind isolated adapter with strict output validation

**Rationale**: Provider availability, cost, timeout, and response shape must not affect human play. A
configurable OpenAI-compatible boundary supports OpenRouter, OpenAI, Ollama, and similar providers.
Adapter receives story context and allowed values, returns validated value plus short rationale, and
reports unavailable/error without creating vote.

**Alternatives considered**: AI logic inside gateway; rejected because provider failures would couple
external policy to room state transitions.

## Decision: Report built from normalized persisted facts

**Rationale**: Aggregation must include rounds, timing, divergence, chat, participation, and badges.
One report DTO feeds web, CSV, and PDF to prevent export drift.

**Alternatives considered**: Store only preformatted snapshot; rejected because historical queries and
consistent exports need normalized source facts.

## Decision: Verification matrix follows affected layer

**Rationale**: Contract tests cover shared payloads; integration tests cover REST and state changes;
multi-client tests cover secrecy and timers; frontend build/lint and browser checks cover UI; Docker
checks cover startup; fault tests cover AI and reconnection.

**Alternatives considered**: Unit tests alone; rejected because primary risk is cross-client behavior.
