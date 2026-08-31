# REST Contract: Auth, Rooms, Memberships

All responses that include user or room membership data must exclude password hashes and room password hashes.

## POST /auth/register

Create registered account and return account session.

**Request**:

```json
{
  "email": "ana@example.com",
  "password": "secret-password",
  "name": "Ana",
  "avatar": "🦊",
  "claimGuestSessionToken": "optional-current-guest-room-session-token"
}
```

**Success 201**:

```json
{
  "user": {
    "id": "user-id",
    "email": "ana@example.com",
    "name": "Ana",
    "avatar": "🦊"
  },
  "token": "account-session-token",
  "expiresAt": "2026-08-31T23:59:59.000Z"
}
```

**Errors**:

- `409 EMAIL_ALREADY_EXISTS`
- `400 INVALID_INPUT`

## POST /auth/login

Authenticate registered account.

**Request**:

```json
{
  "email": "ana@example.com",
  "password": "secret-password"
}
```

**Success 200**:

```json
{
  "user": {
    "id": "user-id",
    "email": "ana@example.com",
    "name": "Ana",
    "avatar": "🦊"
  },
  "token": "account-session-token",
  "expiresAt": "2026-08-31T23:59:59.000Z"
}
```

**Errors**:

- `401 INVALID_CREDENTIALS`
- `400 INVALID_INPUT`

## POST /auth/logout

Invalidate current account session and disconnect active browser room session association.

**Authorization**: account session required.

**Success 204**:

No body.

**Errors**:

- `401 UNAUTHENTICATED`

## GET /auth/me

Return current account.

**Authorization**: account session required.

**Success 200**:

```json
{
  "id": "user-id",
  "email": "ana@example.com",
  "name": "Ana",
  "avatar": "🦊"
}
```

**Errors**:

- `401 UNAUTHENTICATED`

## GET /rooms/mine

Return rooms owned or joined by current account.

**Authorization**: account session required.

**Success 200**:

```json
[
  {
    "id": "room-id",
    "code": "D00B27",
    "name": "Sprint Planning",
    "status": "aberta",
    "visibility": "PRIVATE",
    "role": "Dev",
    "joinedAt": "2026-08-31T12:00:00.000Z",
    "lastSeenAt": "2026-08-31T12:10:00.000Z",
    "participantId": "participant-id",
    "isOwner": false
  }
]
```

**Errors**:

- `401 UNAUTHENTICATED`

## POST /rooms/:id/join

Join room as guest or registered account. Existing registered members reuse membership and do not create duplicate participants.

**Authorization**: optional account session.

**Request**:

```json
{
  "name": "Ana",
  "avatar": "🦊",
  "role": "Dev",
  "password": "optional-room-password"
}
```

**Success 200/201**:

```json
{
  "token": "room-session-token",
  "sessionId": "stable-user-or-guest-id",
  "participantId": "participant-id",
  "roomId": "room-id",
  "role": "Dev",
  "reusedMembership": true
}
```

**Rules**:

- Registered account already in room: reuse existing membership.
- Registered account not in private room: require correct password.
- Guest user: use existing guest session when valid, otherwise create one.
- Non-member wrong password: reject and do not create membership.

**Errors**:

- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 ROOM_NOT_FOUND`
- `409 ROOM_FULL`
- `400 INVALID_PASSWORD`
- `400 INVALID_INPUT`

## POST /rooms/:id/rejoin

Open existing room membership without room password.

**Authorization**: account session required.

**Success 200**:

```json
{
  "token": "room-session-token",
  "sessionId": "user-id",
  "participantId": "participant-id",
  "roomId": "room-id",
  "role": "Dev"
}
```

**Errors**:

- `401 UNAUTHENTICATED`
- `403 NOT_ROOM_MEMBER`
- `404 ROOM_NOT_FOUND`

## PATCH /rooms/:id/members/me

Update caller room-specific display fields directly without changing account profile.

**Authorization**: room session or account-backed room session required.

**Request**:

```json
{
  "name": "Ana QA",
  "avatar": "🦊"
}
```

**Success 200**:

```json
{
  "participantId": "participant-id",
  "name": "Ana QA",
  "avatar": "🦊",
  "updatedAt": "2026-08-31T12:15:00.000Z"
}
```

**Rules**:

- Caller may update only their own room display name/avatar.
- At least one of `name` or `avatar` is required.
- Update must not change global account profile.

**Errors**:

- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `400 INVALID_INPUT`

## GET /rooms/:id/profile-requests

Return pending room role change requests visible to host.

**Authorization**: room/account session for host required.

**Success 200**:

```json
[
  {
    "id": "request-id",
    "requesterParticipantId": "participant-id",
    "currentRole": "Dev",
    "requestedRole": "QA",
    "status": "pending",
    "createdAt": "2026-08-31T12:00:00.000Z"
  }
]
```

**Errors**:

- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
