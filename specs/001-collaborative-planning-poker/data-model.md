# Data Model: Collaborative Real-Time Planning Poker

## Durable entities

### User

- `id`: unique string; `name`: required display name; `avatarUrl`: optional avatar; `email`: optional
- `isGuest`: guest/account flag; `createdAt`: creation timestamp
- Relationships: many `RoomParticipant` records

### Room

- `id`, `inviteCode`, `name`, `status`, `ownerId`, `visibility`, `passwordHash`, `createdAt`
- Relationships: one `RoomConfig`; many participants, stories, messages, reports
- Invariants: invite code unique; private room stores hash only; closed room rejects mutations

### RoomConfig

- `roomId`, `deckType`, `deckValues`, reflection/discussion seconds, AI flag, participant limit
- permitted roles, anonymous voting, automatic reveal, consensus criterion, unlimited revote flag
- Invariants: positive bounded durations; positive participant limit; non-empty unique deck values;
  supported roles and consensus criterion only

### RoomParticipant

- `id`, `roomId`, `userId`, `role`, `isAI`, `status`, `joinedAt`
- Invariants: unique `(roomId, userId)`; observer cannot vote; AI requires room AI enabled;
  participant count cannot exceed limit; only one active owner

### Story

- `id`, `roomId`, `title`, `description`, `order`, `status`, `finalValue`, `criterion`,
  `totalSeconds`, `rounds`
- States: `pendente -> em_votacao -> em_discussao/revelada -> estimada`; `pendente -> pulada`
- Invariants: order unique within room; final value only on `estimada`; skipped story has no active
  round; total time sums server-measured reflection and discussion durations

### VoteRound

- `id`, `storyId`, `number`, `startedAt`, `endedAt`
- Invariants: number increases per story; at most one active round per story; ended round immutable

### Vote

- `id`, `voteRoundId`, `participantId`, `value`, `castAt`, `revealed`
- Invariants: unique `(voteRoundId, participantId)`; value belongs to round deck; reveal only during
  server reveal; observer never owns vote

### ChatMessage

- `id`, `roomId`, nullable `storyId`, `participantId`, `text`, `type`, `createdAt`
- Types: `comentario`, `justificativa`, `sistema`
- Invariants: trimmed bounded text; author belongs to room; story link belongs to room

### SprintReport

- `id`, `roomId`, `generatedAt`, `summary`, optional CSV/PDF references
- Summary includes story outcomes, round metrics, divergence, chat evidence, participation, and
  achievements
- Invariant: report remains readable after closure and uses sanitized participant data

## Operational state

Active coordination needs room phase, current story, active round, timer type, timer deadline,
connected membership, and reveal eligibility. PostgreSQL remains durable source; Redis stores
short-lived coordination/deadline data and Socket.IO adapter state. Redis loss triggers hydration from
PostgreSQL and a safe stopped-timer state, never fabricated progress.

## Transition rules

```text
lobby -> votacao          present story (authorized)
votacao -> revelada       all votes, reflection timeout, or forced reveal
revelada -> discussao     revealed values diverge
revelada -> finalizada    accepted final value
discussao -> revelada     discussion timeout or explicit end
discussao -> votacao      authorized revote, if policy permits
lobby -> pulada           authorized skip
finalizada -> lobby       next pending story exists
finalizada -> encerrada   no pending story or report close
```

Every transition validates state, identity, role, payload, and ownership. Transaction writes durable
changes before broadcasting sanitized public snapshot.
