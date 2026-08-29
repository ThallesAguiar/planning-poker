# Realtime Contract

Namespace: `/room`. Internal Socket.IO room key: database room ID or normalized invite code. Server
is authoritative; clients emit commands and render server events.

## Client commands

| Event | Payload | Authorization and effect |
|---|---|---|
| `room:join` | room key, name, avatar, optional role/session/password/token | Validate access, create or restore participant, emit sanitized state |
| `room:leave` | none | Mark participant disconnected; preserve membership |
| `room:configure` | partial configuration | PO; lobby only; validate values |
| `room:transferOwner` | participant ID | Current PO; target belongs to room |
| `story:present` | story ID | PO; create numbered round and reflection deadline |
| `vote:cast` | story ID, deck value | Eligible member; active matching round; upsert one vote |
| `vote:forceReveal` | none | PO or configured mediator; reveal active round |
| `vote:revote` | none or story ID | PO/mediator; end prior round and create next if allowed |
| `story:finalize` | value, criterion | Authorized decider; revealed/discussion phase; persist final |
| `story:skip` | none | PO; mark current story skipped |
| `chat:message` | text, optional type | Member; trim, bound, persist, broadcast |
| `reaction:send` | allowed reaction value | Member; ephemeral broadcast, no chat record |
| `report:generate` | none | PO; close room, persist report, emit readiness |

## Server events

| Event | Payload |
|---|---|
| `room:state` | sanitized snapshot; hidden vote values before reveal |
| `room:error` | stable error code and user-safe message |
| `room:participantUpdate` | updated participant/presence snapshot |
| `timer:start` | timer type, server deadline, duration |
| `timer:tick` | timer type, server deadline, remaining seconds |
| `vote:progress` | voted count, eligible total |
| `vote:reveal` | sanitized votes, unanimous, average, min, max, mode, divergence |
| `discussion:start` | story ID, deadline, remaining seconds |
| `discussion:end` | story ID and reason |
| `reaction:show` | reaction value and participant ID |
| `report:ready` | report ID and available web/export references |

## Invariants

- No client receives vote values before reveal, including snapshots, errors, or reconnect payloads.
- Every administrative command validates membership, role, phase, target room/story, and payload.
- Timer deadline comes from server; tick loss does not change transition behavior.
- Reconnect emits one complete state snapshot and does not duplicate membership.
- Stable errors include `ROOM_NOT_FOUND`, `PASSWORD_REQUIRED`, `INVALID_PASSWORD`, `FORBIDDEN`,
  `INVALID_PHASE`, `INVALID_VOTE`, `ROOM_FULL`, and `AI_UNAVAILABLE`.
