# Realtime Contract: Room Profile And Role Updates

Namespace: `/room`

All events require valid room session and existing membership. Server remains source of truth.

## Client to Server

### room:profileUpdate

Participant updates room-specific display fields directly.

```json
{
  "name": "Ana QA",
  "avatar": "🐼"
}
```

**Rules**:

- At least one field must be present.
- Caller may update only own room display fields.
- Update applies immediately and emits fresh `room:state`.

### room:roleChangeRequest

Participant requests room-specific role change.

```json
{
  "role": "QA"
}
```

**Rules**:

- Requested role must be allowed in room configuration.
- Request starts as `pending`.
- Request does not change current participant role until host approves.

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

Sent to host when participant submits role change request.

```json
{
  "id": "request-id",
  "requesterParticipantId": "participant-id",
  "requesterName": "Ana",
  "currentRole": "Dev",
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
  "message": "INVALID_PROFILE_UPDATE"
}
```

```json
{
  "message": "INVALID_ROLE_REQUEST"
}
```

```json
{
  "message": "PROFILE_REQUEST_NOT_FOUND"
}
```

## Snapshot Impact

`room:state.participants[]` must reflect immediate room display name/avatar updates and approved role changes. Pending or rejected role requests must not change visible role state.
