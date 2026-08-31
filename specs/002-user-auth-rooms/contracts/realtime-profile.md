# Realtime Contract: Profile Requests

Namespace: `/room`

All events require valid room session and existing membership. Server remains source of truth.

## Client to Server

### room:profileRequest

Participant requests room-specific profile change.

```json
{
  "name": "Ana QA",
  "avatar": "🐼",
  "role": "QA"
}
```

**Rules**:

- At least one field must be present.
- Requested role must be allowed in room configuration.
- Request starts as `pending`.
- Request does not change current participant until host approves.

### room:profileDecision

Host approves or rejects request.

```json
{
  "requestId": "request-id",
  "decision": "approved"
}
```

```json
{
  "requestId": "request-id",
  "decision": "rejected"
}
```

**Rules**:

- Only host may decide.
- Only pending request may be decided.
- Approved request updates room membership and emits fresh `room:state`.
- Rejected request emits decision notification but does not mutate membership.

## Server to Client

### room:profileRequestPending

Sent to host when participant submits request.

```json
{
  "id": "request-id",
  "requesterParticipantId": "participant-id",
  "requesterName": "Ana",
  "requestedName": "Ana QA",
  "requestedAvatar": "🐼",
  "requestedRole": "QA",
  "createdAt": "2026-08-31T12:00:00.000Z"
}
```

### room:profileDecision

Sent to requester after host decision.

```json
{
  "requestId": "request-id",
  "decision": "approved",
  "decidedAt": "2026-08-31T12:01:00.000Z"
}
```

### room:error

Existing error channel may return:

```json
{
  "message": "FORBIDDEN"
}
```

```json
{
  "message": "INVALID_PROFILE_REQUEST"
}
```

```json
{
  "message": "PROFILE_REQUEST_NOT_FOUND"
}
```

## Snapshot Impact

`room:state.participants[]` must reflect approved room-specific display name, avatar, and role. Pending or rejected requests must not change visible participant state.
